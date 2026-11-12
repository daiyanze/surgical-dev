// Actual Pi 1.5.2 processes and tools with deterministic local model responses.
// This proves host integration, not model quality. No paid API or credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runProcess } from '../adapters/pi/process.mjs';
import { loadRepositoryState } from '../adapters/pi/persist.mjs';

async function runRpcCommands(pi, argv, { cwd, env, timeoutMs = 30_000 }) {
  const child = spawn(pi, argv, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const responses = new Map();
  let buffer = '', stderr = '', nextId = 1, closed = false;
  const timer = setTimeout(() => {
    child.kill('SIGKILL');
  }, timeoutMs);
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  child.stdout.on('data', chunk => {
    buffer += chunk.toString();
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        if (record.type === 'response' && responses.has(record.id)) {
          responses.get(record.id)(record);
          responses.delete(record.id);
        }
      } catch {}
    }
  });
  const closedPromise = new Promise(resolve => child.on('close', code => { closed = true; resolve(code); }));
  try {
    for (const message of ['/surgical import requirements.json', '/surgical status', '/surgical confirm']) {
      const id = `rpc-${nextId++}`;
      const response = new Promise((resolve, reject) => {
        const responseTimer = setTimeout(() => {
          if (responses.delete(id)) reject(new Error(`RPC command timed out: ${message}`));
        }, timeoutMs);
        responses.set(id, record => {
          clearTimeout(responseTimer);
          resolve(record);
        });
      });
      child.stdin.write(JSON.stringify({ id, type: 'prompt', message }) + '\n');
      const result = await response;
      if (!result.success) throw new Error(`RPC command failed: ${message}: ${result.error}`);
    }
    child.stdin.end();
    const code = await closedPromise;
    return { code, stderr };
  } finally {
    clearTimeout(timer);
    if (!closed) child.kill('SIGKILL');
    await closedPromise.catch(() => {});
  }
}

async function guidedRpcSession(pi, argv, { cwd, env, timeoutMs = 60_000 }) {
  const child = spawn(pi, argv, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const responses = new Map();
  const settledWaiters = [];
  let buffer = '', stderr = '', nextId = 1, closed = false;
  const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
  const removeSettled = entry => {
    const index = settledWaiters.indexOf(entry);
    if (index >= 0) settledWaiters.splice(index, 1);
  };
  const failSettled = error => {
    for (const entry of settledWaiters.splice(0)) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
  };
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  child.stdout.on('data', chunk => {
    buffer += chunk.toString();
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        if (record.type === 'agent_settled') {
          const entry = settledWaiters.shift();
          if (entry) { clearTimeout(entry.timer); entry.resolve(record); }
        }
        if (record.type === 'response' && responses.has(record.id)) {
          const { resolve, reject, timer: responseTimer } = responses.get(record.id);
          clearTimeout(responseTimer);
          responses.delete(record.id);
          if (record.success) resolve(record);
          else reject(new Error(record.error ?? 'RPC prompt failed'));
        }
      } catch {}
    }
  });
  const closedPromise = new Promise(resolve => child.on('close', code => {
    closed = true;
    clearTimeout(timer);
    for (const { reject, timer: responseTimer } of responses.values()) {
      clearTimeout(responseTimer);
      reject(new Error('RPC process exited before responding'));
    }
    responses.clear();
    failSettled(new Error('RPC process exited before settling'));
    resolve(code);
  }));
  const waitForSettled = message => new Promise((resolve, reject) => {
    const entry = {
      resolve,
      reject,
      timer: setTimeout(() => {
        removeSettled(entry);
        reject(new Error(`RPC agent did not settle: ${message}`));
      }, timeoutMs),
    };
    settledWaiters.push(entry);
  });
  const send = async (message, { waitForSettled: shouldWait = true } = {}) => {
    const id = `guided-${nextId++}`;
    const settled = shouldWait ? waitForSettled(message) : null;
    const response = new Promise((resolve, reject) => {
      const responseTimer = setTimeout(() => {
        if (responses.delete(id)) reject(new Error(`RPC command timed out: ${message}`));
      }, timeoutMs);
      responses.set(id, {
        resolve: record => resolve(record),
        reject: error => reject(error),
        timer: responseTimer,
      });
    });
    child.stdin.write(JSON.stringify({ id, type: 'prompt', message }) + '\n');
    const record = await response;
    if (settled) await settled;
    return record;
  };
  const end = async () => {
    child.stdin.end();
    const code = await closedPromise;
    return { code, stderr };
  };
  return { child, send, end };
}

test('actual Pi 1.5.2 imports/confirms a spec and settles a planned multi-Todo run', { timeout: 90_000 }, async t => {
  assert.ok(process.env.SURGICAL_PI_EXECUTABLE, 'Set SURGICAL_PI_EXECUTABLE to a Pi v1.5.2+ executable');
  const pi = resolve(process.env.SURGICAL_PI_EXECUTABLE);
  const directory = await mkdtemp(join(tmpdir(), 'surgical-pi-host-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const cwd = join(directory, 'project'), agentDir = join(directory, 'agent');
  await mkdir(cwd); await mkdir(agentDir);
  const requests = [], workerRequests = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    requests.push(body);
    const firstMessage = JSON.stringify(body.messages[0] ?? '');
    const reviewer = firstMessage.includes('independently verify a fixed source snapshot')
      || JSON.stringify(body.messages).includes('You are a fresh independent Verifier');
    if (!reviewer) workerRequests.push(body);
    const last = body.messages.at(-1);
    let content, call;
    if (reviewer) {
      const toolMessages = body.messages.filter(message => message.role === 'tool');
      if (toolMessages.length === 0) call = { name: 'read', arguments: JSON.stringify({ path: 'answer.txt' }) };
      else if (toolMessages.length === 1) call = { name: 'read', arguments: JSON.stringify({ path: 'cover.txt' }) };
      else {
        const requestText = body.messages.map(message => typeof message.content === 'string'
          ? message.content
          : (message.content ?? []).map(part => part.text ?? '').join('\n')).find(text => text.includes('\nREQUEST_JSON\n'));
        if (!requestText) throw new Error('Reviewer request JSON not found');
        const marker = requestText.lastIndexOf('\nREQUEST_JSON\n');
        const request = JSON.parse(requestText.slice(marker + 14));
        const answerOk = readFileSync(join(cwd, 'answer.txt'), 'utf8').trim() === '42';
        const coverOk = readFileSync(join(cwd, 'cover.txt'), 'utf8').trim() === 'covered';
        const repairOk = existsSync(join(cwd, 'repair.txt'));
        const ok = answerOk && coverOk && repairOk;
        content = JSON.stringify({
          verdict: ok ? 'PASS' : 'CHANGES_REQUIRED',
          acceptance_results: request.acceptance_criteria.map(ac => ({ id: ac.id, result: ok ? 'PASS' : 'FAIL', evidence_refs: ['answer.txt:1', 'cover.txt:1'] })),
          blocking_findings: ok ? [] : [{ id: 'F-1', location: 'cover.txt:1', evidence: 'Files do not contain the expected values', impact: 'AC not met', clearance_condition: 'Write both expected values in scope' }],
          non_blocking_suggestions: [], remaining_risks: [], blocked_reason: null,
        });
      }
    } else {
      const text = JSON.stringify(body.messages);
      const current = JSON.stringify(last);
      if (last.role === 'tool') {
        const priorCall = body.messages
          .flatMap(message => message.role === 'assistant' ? (message.tool_calls ?? []) : [])
          .find(toolCall => toolCall.id === last.tool_call_id);
        const toolName = priorCall?.function?.name;
        if (toolName === 'surgical_plan' && readFileSync(join(cwd, 'answer.txt'), 'utf8').trim() !== '42') {
          call = { name: 'write', arguments: JSON.stringify({ path: 'answer.txt', content: '42\n' }) };
        } else {
          content = 'Candidate changes written; ready for real checks.';
        }
      } else if (current.includes('call surgical_plan') && !text.includes('"name":"surgical_plan"')) {
        call = {
          name: 'surgical_plan',
          arguments: JSON.stringify({
            todos: [
              { id: 'TODO-1', goal: 'Set answer', depends_on: [], ac_ids: ['AC-1'] },
              { id: 'TODO-2', goal: 'Set cover', depends_on: ['TODO-1'], ac_ids: ['AC-2'] },
            ],
          }),
        };
      } else if (current.includes('Independent final review requires changes') && !existsSync(join(cwd, 'repair.txt'))) {
        call = { name: 'write', arguments: JSON.stringify({ path: 'repair.txt', content: 'repaired\n' }) };
      } else if (readFileSync(join(cwd, 'answer.txt'), 'utf8').trim() !== '42') {
        call = { name: 'write', arguments: JSON.stringify({ path: 'answer.txt', content: '42\n' }) };
      } else if (readFileSync(join(cwd, 'cover.txt'), 'utf8').trim() !== 'covered') {
        call = { name: 'write', arguments: JSON.stringify({ path: 'cover.txt', content: 'covered\n' }) };
      } else {
        content = 'No further source changes are needed in this turn.';
      }
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const send = (delta, finish_reason = null) => res.write(`data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', created: 1, model: 'fixture', choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
    send({ role: 'assistant', ...(call ? { tool_calls: [{ index: 0, id: `call_${requests.length}`, type: 'function', function: call }] } : { content }) });
    send({}, call ? 'tool_calls' : 'stop');
    res.end('data: [DONE]\n\n');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  await writeFile(join(agentDir, 'models.json'), JSON.stringify({ providers: { 'surgical-fixture': {
    baseUrl: `http://127.0.0.1:${server.address().port}/v1`, api: 'openai-completions', apiKey: 'fixture-only',
    models: [{ id: 'fixture', contextWindow: 128_000, maxTokens: 4096, reasoning: false, input: ['text'] }],
  } } }));
  await writeFile(join(agentDir, 'settings.json'), JSON.stringify({ retry: { enabled: false }, compaction: { enabled: false }, modelCatalog: { autoUpdate: false } }));
  const check = [process.execPath, '-e', 'if(require("fs").readFileSync("answer.txt","utf8").trim()!=="42"){console.error("expected 42");process.exit(1)}'];
  const requirements = {
    goal: 'Produce a verified two-part answer',
    scope: ['answer.txt contains 42', 'cover.txt contains covered'],
    non_goals: ['Do not change the public API'],
    constraints: ['Use the existing project check'],
    acceptance_criteria: [
      { id: 'AC-1', text: 'answer.txt contains 42' },
      { id: 'AC-2', text: 'cover.txt contains covered' },
    ],
  };
  await writeFile(join(cwd, '.surgical-dev.json'), JSON.stringify({ checks: [check], reviewerCommand: [pi], timeoutSeconds: 60, reviewTimeoutSeconds: 20 }));
  await writeFile(join(cwd, 'requirements.json'), JSON.stringify(requirements));
  await writeFile(join(cwd, 'answer.txt'), '0\n');
  await writeFile(join(cwd, 'cover.txt'), '0\n');
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  git('add', '.'); git('commit', '-qm', 'baseline');
  const packagePath = fileURLToPath(new URL('..', import.meta.url));
  const env = {
    ...process.env,
    PI_CODING_AGENT_DIR: agentDir,
    PATH: `/Users/daiyanze/.local/share/mise/installs/node/24.15.0/bin:/opt/homebrew/bin:${process.env.PATH ?? ''}`,
  };
  const installed = await runProcess([pi, 'install', packagePath], { cwd, env, timeoutMs: 15_000 });
  assert.equal(installed.code, 0, installed.stderr);
  const confirmSession = join(directory, 'confirm.jsonl');
  const workerSession = join(directory, 'worker.jsonl');
  const command = async (session, prompt, timeoutMs = 20_000) => runProcess([
    pi, '--mode', 'json', '--print', '--session', session,
    '--no-mcp', '--no-context-files', '--no-skills', '--no-prompt-templates', '--no-themes', '--no-approve',
    '--provider', 'surgical-fixture', '--model', 'fixture', '--thinking', 'off', prompt,
  ], { cwd, env, timeoutMs });
  const confirmedCommands = await runRpcCommands(pi, [
    '--mode', 'rpc', '--session', confirmSession,
    '--no-mcp', '--no-context-files', '--no-skills', '--no-prompt-templates', '--no-themes', '--no-approve',
    '--provider', 'surgical-fixture', '--model', 'fixture', '--thinking', 'off',
  ], { cwd, env, timeoutMs: 40_000 });
  assert.equal(confirmedCommands.code, 0, confirmedCommands.stderr);
  const beforeRun = await loadRepositoryState(cwd);
  assert.equal(beforeRun.confirmed_spec.status, 'CONFIRMED');
  assert.equal(beforeRun.confirmed_spec.confirmation.source, 'USER_COMMAND:/surgical confirm');
  const result = await command(workerSession, '/surgical run', 70_000);
  assert.equal(result.code, 0, result.stderr);
  assert.ok(!result.timedOut, 'Pi must finish without external termination');
  const repository = await loadRepositoryState(cwd);
  const state = repository.run;
  assert.equal(state?.status, 'PR_READY', `${state?.reason}\n${result.stderr}\n${result.stdout.slice(-3000)}`);
  assert.equal(state.checkAttempts, 3, JSON.stringify(state.checks.map(check => [check.todo_id, check.exitCode, check.summary])));
  assert.equal(state.reviewAttempts, 2);
  assert.equal(state.reviewRepairsUsed, 1);
  assert.equal(state.review.verdict, 'PASS');
  assert.equal(state.review.acceptance_results.length, 2);
  assert.deepEqual(state.todos.map(todo => todo.id), ['TODO-1', 'TODO-2', 'TODO-R1']);
  assert.deepEqual(state.todos.map(todo => todo.state), ['DONE', 'DONE', 'DONE']);
  assert.equal(state.todos[2].kind, 'repair');
  assert.equal(state.todos[0].evidence.find(item => item.kind === 'check').check_attempt, 1);
  assert.equal(state.usage.planCalls, 1);
  assert.equal(state.usage.calls.workerToolCalls, 4);
  assert.equal(state.usage.calls.workerAssistant, workerRequests.length);
  assert.equal(state.usage.calls.reviewer, 6, 'Two reviewer processes each made three assistant calls (two reads, final report)');
  const planCalls = new Set(requests.flatMap(request => (request.messages ?? []).flatMap(message => message.role === 'assistant' ? (message.tool_calls ?? []) : [])).filter(call => call.function?.name === 'surgical_plan').map(call => call.id)).size;
  assert.equal(planCalls, 1, 'The initial plan is submitted exactly once');
  assert.notEqual(state.review.reviewer_session_ref, state.workerSessionId);
  assert.ok(beforeRun.confirmed_spec.confirmation.session_id);
  assert.notEqual(beforeRun.confirmed_spec.confirmation.session_id, state.workerSessionId);
  assert.equal((await readFile(join(cwd, 'answer.txt'), 'utf8')).trim(), '42');
  assert.equal((await readFile(join(cwd, 'cover.txt'), 'utf8')).trim(), 'covered');
  assert.equal(git('diff', '--cached'), '');
  assert.equal(git('worktree', 'list', '--porcelain').split('\n').filter(line => line.startsWith('worktree ')).length, 1);
  assert.ok(requests.some(request => JSON.stringify(request.messages).includes('surgical_plan')));
  assert.ok(workerRequests.some(request => JSON.stringify(request.messages).includes('Independent final review requires changes')));
  assert.ok(requests.some(request => request.tools?.map(tool => tool.function.name).sort().join(',') === 'find,grep,ls,read'));
  const entries = (await readFile(workerSession, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(entries[0].id, state.workerSessionId);
});

test('actual Pi 1.5.2 guides /surgical <goal> through discussion, exact input confirmation and automatic PR_READY', { timeout: 120_000 }, async t => {
  assert.ok(process.env.SURGICAL_PI_EXECUTABLE, 'Set SURGICAL_PI_EXECUTABLE to a Pi v1.5.2+ executable');
  const pi = resolve(process.env.SURGICAL_PI_EXECUTABLE);
  const directory = await mkdtemp(join(tmpdir(), 'surgical-pi-guided-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const cwd = join(directory, 'project'), agentDir = join(directory, 'agent');
  await mkdir(cwd); await mkdir(agentDir);
  const requests = [], workerRequests = [];
  const textParts = message => typeof message.content === 'string'
    ? message.content
    : (message.content ?? []).map(part => part.text ?? '').join('\n');
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    requests.push(body);
    const allText = body.messages.map(textParts).join('\n');
    const reviewer = JSON.stringify(body.messages[0] ?? '').includes('independently verify a fixed source snapshot')
      || allText.includes('You are a fresh independent Verifier');
    if (!reviewer) workerRequests.push(body);
    const last = body.messages.at(-1);
    let content, call;
    if (reviewer) {
      const toolMessages = body.messages.filter(message => message.role === 'tool');
      if (toolMessages.length === 0) call = { name: 'read', arguments: JSON.stringify({ path: 'answer.txt' }) };
      else if (toolMessages.length === 1) call = { name: 'read', arguments: JSON.stringify({ path: 'cover.txt' }) };
      else {
        const requestText = body.messages.map(textParts).find(text => text.includes('\nREQUEST_JSON\n'));
        if (!requestText) throw new Error('Reviewer request JSON not found');
        const request = JSON.parse(requestText.slice(requestText.lastIndexOf('\nREQUEST_JSON\n') + 14));
        const answerOk = readFileSync(join(cwd, 'answer.txt'), 'utf8').trim() === '42';
        const coverOk = readFileSync(join(cwd, 'cover.txt'), 'utf8').trim() === 'covered';
        const ok = answerOk && coverOk;
        content = JSON.stringify({
          verdict: ok ? 'PASS' : 'CHANGES_REQUIRED',
          acceptance_results: request.acceptance_criteria.map(ac => ({ id: ac.id, result: ok ? 'PASS' : 'FAIL', evidence_refs: ['answer.txt:1', 'cover.txt:1'] })),
          blocking_findings: ok ? [] : [{ id: 'F-1', location: 'cover.txt:1', evidence: 'Files do not contain the expected values', impact: 'AC not met', clearance_condition: 'Write both expected values in scope' }],
          non_blocking_suggestions: [], remaining_risks: [], blocked_reason: null,
        });
      }
    } else if (allText.includes('Surgical Dev task ')) {
      const assistantCalls = body.messages.flatMap(message => message.role === 'assistant' ? (message.tool_calls ?? []) : []);
      const planCall = assistantCalls.some(toolCall => toolCall.function?.name === 'surgical_plan');
      const current = JSON.stringify(last);
      if (last.role === 'tool') {
        const priorCall = body.messages
          .flatMap(message => message.role === 'assistant' ? (message.tool_calls ?? []) : [])
          .find(toolCall => toolCall.id === last.tool_call_id);
        const toolName = priorCall?.function?.name;
        if (toolName === 'surgical_plan' && readFileSync(join(cwd, 'answer.txt'), 'utf8').trim() !== '42') {
          call = { name: 'write', arguments: JSON.stringify({ path: 'answer.txt', content: '42\n' }) };
        } else {
          content = 'Candidate changes written; ready for real checks.';
        }
      } else if (current.includes('call surgical_plan') && !planCall) {
        call = {
          name: 'surgical_plan',
          arguments: JSON.stringify({
            todos: [
              { id: 'TODO-1', goal: 'Set answer', depends_on: [], ac_ids: ['AC-1'] },
              { id: 'TODO-2', goal: 'Set cover', depends_on: ['TODO-1'], ac_ids: ['AC-2'] },
            ],
          }),
        };
      } else if (readFileSync(join(cwd, 'answer.txt'), 'utf8').trim() !== '42') {
        call = { name: 'write', arguments: JSON.stringify({ path: 'answer.txt', content: '42\n' }) };
      } else if (readFileSync(join(cwd, 'cover.txt'), 'utf8').trim() !== 'covered') {
        call = { name: 'write', arguments: JSON.stringify({ path: 'cover.txt', content: 'covered\n' }) };
      } else {
        content = 'No further source changes are needed in this turn.';
      }
    } else if (allText.includes('You are preparing a Surgical Dev Goal Specification')) {
      const specCall = body.messages
        .flatMap(message => message.role === 'assistant' ? (message.tool_calls ?? []) : [])
        .some(toolCall => toolCall.function?.name === 'surgical_spec');
      const question = 'Does the public API need to stay unchanged?';
      const hasQuestion = allText.includes(question);
      if (specCall) {
        content = 'Draft saved. Review the full scope and confirm when ready.';
      } else if (hasQuestion) {
        call = {
          name: 'surgical_spec',
          arguments: JSON.stringify({
            goal: 'Produce a verified two-part answer',
            scope: ['answer.txt contains 42', 'cover.txt contains covered'],
            non_goals: ['Do not change the public API'],
            constraints: ['Use the existing project check'],
            acceptance_criteria: [
              { id: 'AC-1', text: 'answer.txt contains 42' },
              { id: 'AC-2', text: 'cover.txt contains covered' },
            ],
          }),
        };
      } else if (!body.messages.some(message => message.role === 'tool')) {
        call = { name: 'read', arguments: JSON.stringify({ path: 'README.md' }) };
      } else {
        content = question;
      }
    } else {
      throw new Error('Unrecognized fixture request');
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const send = (delta, finish_reason = null) => res.write(`data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', created: 1, model: 'fixture', choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
    send({ role: 'assistant', ...(call ? { tool_calls: [{ index: 0, id: `call_${requests.length}`, type: 'function', function: call }] } : { content }) });
    send({}, call ? 'tool_calls' : 'stop');
    res.end('data: [DONE]\n\n');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  await writeFile(join(agentDir, 'models.json'), JSON.stringify({ providers: { 'surgical-fixture': {
    baseUrl: `http://127.0.0.1:${server.address().port}/v1`, api: 'openai-completions', apiKey: 'fixture-only',
    models: [{ id: 'fixture', contextWindow: 128_000, maxTokens: 4096, reasoning: false, input: ['text'] }],
  } } }));
  await writeFile(join(agentDir, 'settings.json'), JSON.stringify({ retry: { enabled: false }, compaction: { enabled: false }, modelCatalog: { autoUpdate: false } }));
  const check = [process.execPath, '-e', 'if(require("fs").readFileSync("answer.txt","utf8").trim()!=="42"){console.error("expected 42");process.exit(1)}'];
  await writeFile(join(cwd, '.surgical-dev.json'), JSON.stringify({ checks: [check], reviewerCommand: [pi], timeoutSeconds: 60, reviewTimeoutSeconds: 20 }));
  await writeFile(join(cwd, 'README.md'), '# Guided fixture\nKeep the public API stable.\n');
  await writeFile(join(cwd, 'answer.txt'), '0\n');
  await writeFile(join(cwd, 'cover.txt'), '0\n');
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  git('add', '.'); git('commit', '-qm', 'baseline');
  const packagePath = fileURLToPath(new URL('..', import.meta.url));
  const env = {
    ...process.env,
    PI_CODING_AGENT_DIR: agentDir,
    PATH: `/Users/daiyanze/.local/share/mise/installs/node/24.15.0/bin:/opt/homebrew/bin:${process.env.PATH ?? ''}`,
  };
  const installed = await runProcess([pi, 'install', packagePath], { cwd, env, timeoutMs: 15_000 });
  assert.equal(installed.code, 0, installed.stderr);
  const session = join(directory, 'guided.jsonl');
  const rpc = await guidedRpcSession(pi, [
    '--mode', 'rpc', '--session', session,
    '--no-mcp', '--no-context-files', '--no-skills', '--no-prompt-templates', '--no-themes', '--no-approve',
    '--provider', 'surgical-fixture', '--model', 'fixture', '--thinking', 'off',
  ], { cwd, env, timeoutMs: 100_000 });
  let ended = false;
  t.after(async () => { if (!ended) rpc.child?.kill?.('SIGKILL'); });
  const first = await rpc.send('/surgical Produce a verified two-part answer');
  assert.equal(first.success, true);
  let repository = await loadRepositoryState(cwd);
  assert.equal(repository.draft_spec, null, 'The first discussion turn asks before inventing a draft');

  const answer = await rpc.send('Keep the public API stable; use the existing project check.');
  assert.equal(answer.success, true);
  repository = await loadRepositoryState(cwd);
  assert.equal(repository.confirmed_spec, null);
  assert.equal(repository.draft_spec.goal, 'Produce a verified two-part answer');
  assert.deepEqual(repository.draft_spec.acceptance_criteria.map(ac => ac.id), ['AC-1', 'AC-2']);
  assert.equal((await readFile(join(cwd, 'answer.txt'), 'utf8')).trim(), '0');
  assert.equal((await readFile(join(cwd, 'cover.txt'), 'utf8')).trim(), '0');
  assert.equal(git('status', '--porcelain'), '', 'No source mutation is allowed before explicit confirmation');

  const confirmed = await rpc.send('确认，开始');
  assert.equal(confirmed.success, true);
  const deadline = Date.now() + 100_000;
  while (Date.now() < deadline) {
    repository = await loadRepositoryState(cwd);
    if (repository.run && ['PR_READY', 'BLOCKED', 'ESCALATED', 'CANCELLED', 'TIMED_OUT'].includes(repository.run.status)) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  ended = true;
  const finished = await rpc.end();
  assert.equal(finished.code, 0, finished.stderr);
  repository = await loadRepositoryState(cwd);
  const state = repository.run;
  assert.equal(state?.status, 'PR_READY', `${state?.reason}\n${finished.stderr}`);
  assert.equal(repository.confirmed_spec.confirmation.source, 'USER_INPUT:confirm-and-start');
  assert.equal(repository.confirmed_spec.confirmation.session_id, state.workerSessionId);
  assert.equal(state.checkAttempts, 2, JSON.stringify(state.checks.map(check => [check.todo_id, check.exitCode, check.summary])));
  assert.equal(state.reviewAttempts, 1);
  assert.equal(state.review.verdict, 'PASS');
  assert.equal(state.review.acceptance_results.length, 2);
  assert.deepEqual(state.todos.map(todo => todo.id), ['TODO-1', 'TODO-2']);
  assert.deepEqual(state.todos.map(todo => todo.state), ['DONE', 'DONE']);
  assert.equal(state.usage.planCalls, 1);
  assert.notEqual(state.review.reviewer_session_ref, state.workerSessionId);
  assert.equal((await readFile(join(cwd, 'answer.txt'), 'utf8')).trim(), '42');
  assert.equal((await readFile(join(cwd, 'cover.txt'), 'utf8')).trim(), 'covered');
  assert.ok(workerRequests.some(request => JSON.stringify(request.messages).includes('surgical_spec')));
  assert.ok(requests.some(request => JSON.stringify(request.messages).includes('surgical_plan')));
  assert.ok(!requests.some(request => request.messages?.some(message => textParts(message).includes('/surgical run'))), 'No manually issued run command is needed');
});
