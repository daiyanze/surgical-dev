// Actual Pi processes and tools, deterministic local model responses. No paid API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runProcess } from '../adapters/pi/process.mjs';

test('actual Pi repairs a failed check and accepts a fresh independent review', { timeout: 60_000 }, async t => {
  assert.ok(process.env.SURGICAL_PI_EXECUTABLE, 'Set SURGICAL_PI_EXECUTABLE to a Pi v1.5.2+ executable');
  const pi = resolve(process.env.SURGICAL_PI_EXECUTABLE);
  const directory = await mkdtemp(join(tmpdir(), 'surgical-pi-host-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const cwd = join(directory, 'project'), agentDir = join(directory, 'agent');
  await mkdir(cwd); await mkdir(agentDir);
  const requests = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    requests.push(body);
    const reviewer = JSON.stringify(body.messages[0]).includes('independently verify a fixed source snapshot');
    const last = body.messages.at(-1);
    let content, call;
    if (reviewer) {
      if (last.role !== 'tool') call = { name: 'read', arguments: JSON.stringify({ path: 'answer.txt' }) };
      else content = JSON.stringify({
        verdict: 'PASS', acceptance_results: [{ id: 'AC-1', result: 'PASS', evidence_refs: ['answer.txt:1'] }],
        blocking_findings: [], non_blocking_suggestions: [], remaining_risks: [], blocked_reason: null,
      });
    } else if (last.role === 'tool') content = 'The answer is now 42; ready for verification.';
    else if (JSON.stringify(body.messages).includes('Required check failed.')) call = { name: 'write', arguments: JSON.stringify({ path: 'answer.txt', content: '42\n' }) };
    else content = 'Candidate ready for verification.'; // Deliberately fails the first check.
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
  await writeFile(join(cwd, '.surgical-dev.json'), JSON.stringify({ checks: [check], reviewerCommand: [pi], timeoutSeconds: 40, reviewTimeoutSeconds: 15 }));
  await writeFile(join(cwd, 'answer.txt'), '0\n');
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  git('add', '.'); git('commit', '-qm', 'baseline');
  const session = join(directory, 'engineer.jsonl');
  const packagePath = fileURLToPath(new URL('..', import.meta.url));
  const env = { ...process.env, PI_CODING_AGENT_DIR: agentDir };
  const installed = await runProcess([pi, 'install', packagePath], { cwd, env, timeoutMs: 10_000 });
  assert.equal(installed.code, 0, installed.stderr);
  const result = await runProcess([
    pi, '--mode', 'json', '--print', '--session', session,
    '--no-mcp', '--no-context-files', '--no-skills', '--no-prompt-templates', '--no-themes', '--no-approve',
    '--provider', 'surgical-fixture', '--model', 'fixture', '--thinking', 'off',
    '/surgical run Put 42 in answer.txt',
  ], { cwd, env, timeoutMs: 50_000 });
  assert.equal(result.code, 0, result.stderr);
  assert.ok(!result.timedOut, 'Pi must finish without external termination');
  const entries = (await readFile(session, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const states = entries.filter(entry => entry.type === 'custom' && entry.customType === 'surgical-dev-run').map(entry => entry.data);
  const state = states.at(-1);
  assert.equal(state?.status, 'PR_READY', `${state?.reason}\n${result.stderr}\n${result.stdout.slice(-3000)}`);
  assert.equal(state.checkAttempts, 2);
  assert.equal(state.reviewAttempts, 1);
  assert.equal(state.review.verdict, 'PASS');
  assert.notEqual(state.review.reviewer_session_ref, state.engineerSessionId);
  assert.equal((await readFile(join(cwd, 'answer.txt'), 'utf8')).trim(), '42');
  assert.equal(git('diff', '--cached'), '');
  assert.equal(git('worktree', 'list', '--porcelain').split('\n').filter(line => line.startsWith('worktree ')).length, 1);
  assert.ok(requests.some(request => JSON.stringify(request.messages).includes('Required check failed.')));
  assert.ok(requests.some(request => request.tools?.map(tool => tool.function.name).sort().join(',') === 'find,grep,ls,read'));
  assert.equal(entries[0].id, state.engineerSessionId);
});
