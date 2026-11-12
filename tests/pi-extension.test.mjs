import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { isExplicitConfirmation, registerSurgicalLoop } from '../adapters/pi/extension.mjs';
import { loadRepositoryState, saveRepositoryState } from '../adapters/pi/persist.mjs';
import { loadLearning } from '../adapters/pi/learning.mjs';

const reviewer = fileURLToPath(new URL('./fixtures/pi-reviewer.mjs', import.meta.url));

async function host(t, options = {}) {
  const cwd = await mkdtemp(join(tmpdir(), 'surgical-extension-test-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, stdio: 'ignore' });
  git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  await writeFile(join(cwd, 'answer.txt'), options.answer ?? '0');
  await writeFile(join(cwd, '.surgical-dev.json'), JSON.stringify({ checks: [[process.execPath, '-e', 'process.exit(0)']], reviewerCommand: [process.execPath, reviewer], ...options.config }));
  git('add', '.'); git('commit', '-qm', 'baseline');
  const handlers = new Map(), commands = new Map(), tools = new Map(), records = [], messages = [], userMessages = [], dispatches = [];
  let busy = false, resolveIdle, resolveStarted, sessionId = 'worker-session';
  let activeTools = ['read', 'bash', 'edit', 'write', 'grep', 'find', 'ls', 'surgical_spec', 'surgical_plan'];
  const started = new Promise(resolve => { resolveStarted = resolve; });
  let idle;
  const resetIdle = () => { idle = new Promise(resolve => { resolveIdle = resolve; }); };
  resetIdle();
  const ctx = {
    cwd, hasUI: false, mode: 'json', model: undefined,
    sessionManager: { getSessionId: () => sessionId, getEntries: () => records, getBranch: () => records },
    isIdle: () => !busy, hasPendingMessages: () => false,
    waitForIdle: () => busy ? idle : Promise.resolve(),
    abort: () => {}, ui: { setStatus: () => {}, notify: () => {} },
  };
  const pi = {
    on: (name, handler) => handlers.set(name, handler),
    registerCommand: (name, command) => commands.set(name, command),
    registerTool: tool => tools.set(tool.name, tool),
    getActiveTools: () => [...activeTools],
    setActiveTools: names => { activeTools = [...names]; },
    appendEntry: (customType, data) => records.push({ type: 'custom', customType, data: structuredClone(data) }),
    sendMessage: (message, opts) => {
      messages.push(message);
      if (opts?.triggerTurn) { busy = true; resetIdle(); resolveStarted(); }
    },
    sendUserMessage: (content, opts) => {
      userMessages.push({ content, opts });
      if (!opts?.expandPromptTemplates || typeof content !== 'string' || !content.startsWith('/')) return undefined;
      const [name, ...parts] = content.slice(1).split(/\s+/);
      const command = commands.get(name);
      if (!command) return undefined;
      const pending = Promise.resolve().then(() => command.handler(parts.join(' '), ctx));
      dispatches.push(pending);
      return pending;
    },
  };
  registerSurgicalLoop(pi);
  const emit = (name, event = {}) => handlers.get(name)?.(event, ctx);
  const settle = async aborted => { await emit('agent_settled', { aborted }); busy = false; resolveIdle(); };
  t.after(async () => { await commands.get('surgical').handler('stop', ctx); resolveIdle(); });
  return {
    cwd, ctx, records, messages, userMessages, dispatches, started, emit, settle, tools,
    command: args => commands.get('surgical').handler(args, ctx),
    input: (text, { source = 'interactive', images = [], streamingBehavior } = {}) => handlers.get('input')?.({ text, images, source, streamingBehavior }, ctx),
    setBusy: value => { if (value && !busy) resetIdle(); busy = value; if (!value) resolveIdle(); },
    setSessionId: value => { sessionId = value; },
    state: () => records.at(-1)?.data,
    activeTools: () => [...activeTools],
  };
}

async function prepare(h, goal, acceptance = [{ id: 'AC-1', text: goal }]) {
  const path = join(tmpdir(), `surgical-requirements-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  await writeFile(path, JSON.stringify({
    goal, scope: [goal], non_goals: [], constraints: [], acceptance_criteria: acceptance,
  }));
  await h.command(`import ${path}`);
  await h.command('confirm');
}

async function start(h, goal, acceptance) {
  await prepare(h, goal, acceptance);
  return h.command('run');
}

async function draftOnly(h, goal, acceptance = [{ id: 'AC-1', text: goal }]) {
  const path = join(tmpdir(), `surgical-draft-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  await writeFile(path, JSON.stringify({ goal, scope: [goal], non_goals: [], constraints: [], acceptance_criteria: acceptance }));
  await h.command(`import ${path}`);
}
// A normal final assistant response is not continuable until feedback is added.
const boundary = extra => ({ entries: [], continue: false, outcome: 'completed', context: { contextEntries: [], contextMessages: [], llmMessages: [], pendingMessages: [], canContinue: false }, ...extra });

async function waitFor(predicate, timeoutMs = 3000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for test condition');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

async function finishGuidedRun(h) {
  await waitFor(() => h.messages.some(message => message.customType === 'surgical-goal'));
  const running = h.dispatches.at(-1);
  assert.ok(running, 'The automatic /surgical run dispatch must be queued');
  await h.emit('agent_before_settle', boundary());
  await h.settle(false);
  await running;
}

test('repeated failures add one advisory hint to repair feedback, expose no lesson tool, and do not change acceptance', async t => {
  const rule = [process.execPath, '-e', 'if(require("fs").readFileSync("answer.txt","utf8").trim()!=="42"){console.error("expected 42");process.exit(1)}'];
  const h = await host(t, { config: { checks: [rule] } });
  const running = start(h, 'Put 42 in answer.txt');
  await h.started;
  const first = await h.emit('agent_before_settle', boundary());
  assert.equal(first.continue, true);
  assert.doesNotMatch(first.entries.at(-1).content, /LEARNING/);
  const second = await h.emit('agent_before_settle', boundary());
  assert.equal(second.continue, true);
  assert.match(second.entries.at(-1).content, /LEARNING \(advisory, not a gate\): this failure has occurred 2 times in this repository: check .*expected 42\./);
  assert.deepEqual([...h.tools.keys()].sort(), ['surgical_plan', 'surgical_spec']);
  assert.equal((await loadLearning(h.cwd)).records[0].count, 2);
  await writeFile(join(h.cwd, 'answer.txt'), '42');
  await h.emit('agent_before_settle', boundary());
  await h.settle(false);
  await running;
  assert.equal(h.state().status, 'PR_READY');
  await h.command('lessons');
  assert.match(h.messages.at(-1).content, /\[check\] \(2x, last seen /);
  assert.ok(!h.messages.some(message => /Advisory lessons|Promoted/.test(message.content ?? '')));
});

test('command stays in its original session until review repair and final settlement finish', async t => {
  const h = await host(t);
  let returned = false;
  const running = start(h, 'Put 42 in answer.txt').then(() => { returned = true; });
  await h.started;
  assert.equal(returned, false);
  const preceding = { type: 'custom_message', customType: 'other-extension', content: 'Keep this', display: false };
  const first = await h.emit('agent_before_settle', boundary({ entries: [preceding] }));
  assert.equal(first.continue, true);
  assert.deepEqual(first.entries[0], preceding);
  assert.match(first.entries.at(-1).content, /Make AC-1 pass without changing scope/);
  await writeFile(join(h.cwd, 'answer.txt'), '42');
  await h.emit('agent_before_settle', boundary());
  assert.notEqual(h.state().status, 'PR_READY');
  await h.settle(false);
  await running;
  assert.equal(h.state().status, 'PR_READY');
  assert.equal(h.state().workerSessionId, 'worker-session');
});

test('an aborted boundary never dispatches checks or a reviewer', async t => {
  const h = await host(t);
  const running = start(h, 'Put 42 in answer.txt');
  await h.started;
  const result = await h.emit('agent_before_settle', boundary({ outcome: 'aborted' }));
  assert.ok(!result?.continue);
  await h.settle(true); await running;
  assert.equal(h.state().status, 'CANCELLED');
  assert.equal(h.state().checkAttempts, 0);
  assert.equal(h.state().reviewAttempts, 0);
});

test('Escape during verification cannot publish a successful completion at settlement', async t => {
  const h = await host(t, { answer: '42' });
  const running = start(h, 'Verify the answer');
  await h.started;
  await h.emit('agent_before_settle', boundary());
  await h.settle(true); await running;
  assert.equal(h.state().status, 'CANCELLED');
  assert.ok(!h.messages.some(message => message.details?.status === 'PR_READY'));
});

test('stop interrupts an in-progress reviewer and requests no next turn', async t => {
  const h = await host(t, { answer: '42' });
  const running = start(h, 'Verify the answer; slow-review');
  await h.started;
  const checking = h.emit('agent_before_settle', boundary());
  const cancel = setTimeout(() => { void h.command('stop'); }, 200);
  t.after(() => clearTimeout(cancel));
  const result = await checking;
  assert.ok(!result?.continue);
  await h.settle(true); await running;
  assert.equal(h.state().status, 'CANCELLED');
});

test('another pending continuation defers verification until work really settles', async t => {
  const h = await host(t);
  const running = start(h, 'Fix the answer');
  await h.started;
  assert.equal(await h.emit('agent_before_settle', boundary({ continue: true })), undefined);
  assert.equal(h.state().checkAttempts, 0);
  await h.command('stop'); await h.settle(true); await running;
});

test('a changed check policy blocks verification instead of accepting weaker commands', async t => {
  const h = await host(t, { answer: '42' });
  const running = start(h, 'Verify the answer');
  await h.started;
  await writeFile(join(h.cwd, '.surgical-dev.json'), '{"checks":[]}');
  await h.emit('agent_before_settle', boundary());
  await h.settle(false); await running;
  assert.equal(h.state().status, 'BLOCKED');
  assert.match(h.state().reason, /policy changed/);
});

test('installation and status alone start no agent run', async t => {
  const h = await host(t);
  await h.emit('session_start');
  await h.command('status');
  assert.equal(h.records.length, 0);
  assert.equal(h.ctx.isIdle(), true);
});

test('stop during command preflight prevents starting the Worker', async t => {
  const h = await host(t);
  let incorrectlyStarted = false;
  h.started.then(async () => { incorrectlyStarted = true; await h.command('stop'); await h.settle(true); });
  await prepare(h, 'Fix the answer');
  const running = h.command('run');
  await h.command('stop');
  await running;
  assert.equal(incorrectlyStarted, false);
  assert.ok(!h.messages.some(message => message.customType === 'surgical-goal'));
});

test('discussion saves only a draft; explicit user command confirmation is persisted and no tool can confirm', async t => {
  const h = await host(t);
  const running = h.command('discuss Put 42 in answer.txt');
  await h.started;
  const specTool = h.tools.get('surgical_spec');
  assert.ok(specTool, 'surgical_spec must be available for requirement preparation');
  const saved = await specTool.execute('call-1', {
    goal: 'Put 42 in answer.txt', scope: ['Change only answer.txt'], non_goals: ['Do not change the API'],
    constraints: ['Keep checks green'], acceptance_criteria: [{ id: 'AC-1', text: 'answer.txt contains 42' }],
  }, undefined, undefined, h.ctx);
  assert.match(saved.content[0].text, /not confirmed/i);
  assert.ok(h.messages.some(message => message.customType === 'surgical-spec-draft'
    && /Scope:/.test(message.content ?? '') && /Acceptance criteria:/.test(message.content ?? '')), 'The tool must display the full draft before it can count as shown');
  let repository = await loadRepositoryState(h.cwd);
  assert.equal(repository.draft_spec.status, 'DRAFT');
  assert.equal(repository.draft_spec.confirmation, null);
  assert.equal(repository.confirmed_spec, null);
  assert.equal(h.tools.get('surgical_confirm'), undefined, 'No runtime tool may self-confirm consent');
  assert.ok(!h.activeTools().includes('edit') && !h.activeTools().includes('write') && !h.activeTools().includes('bash'));
  await h.settle(false);
  await running;
  await h.command('confirm');
  repository = await loadRepositoryState(h.cwd);
  assert.equal(repository.draft_spec, null);
  assert.equal(repository.confirmed_spec.status, 'CONFIRMED');
  assert.equal(repository.confirmed_spec.confirmation.source, 'USER_COMMAND:/surgical confirm');
  assert.equal(repository.confirmed_spec.confirmation.session_id, 'worker-session');
  assert.ok(h.activeTools().includes('edit') && h.activeTools().includes('write'));
});

test('guided confirmation accepts only the exact benign allowlist and rejects questions, negation, conditions, quotes and images', () => {
  for (const text of ['确认，开始', '确认开始', '  确认，开始。', 'confirm and start', 'Confirm and Start!']) {
    assert.equal(isExplicitConfirmation(text), true, text);
  }
  for (const text of ['好', 'yes', '确认', '不确认，开始', '先别确认，开始', '确认，开始？', 'confirm and start?',
    '确认，开始，但是先不要运行', 'confirm and start, but wait', '“确认，开始”', '`确认，开始`', 'confirm and start please', '']) {
    assert.equal(isExplicitConfirmation(text), false, text);
  }
});

test('bare /surgical shows guidance and an unknown first word starts read-only discussion with the full raw goal', async t => {
  const h = await host(t);
  await h.command('   ');
  assert.ok(h.messages.some(message => /Start with \/surgical <goal>/.test(message.content ?? '') && /Advanced commands:/.test(message.content ?? '')));
  assert.ok(!h.messages.some(message => message.customType === 'surgical-discussion'));

  const running = h.command('Fix   the\nanswer');
  await h.started;
  const discussion = h.messages.find(message => message.customType === 'surgical-discussion');
  assert.ok(discussion, 'Unknown first word must route to requirement discussion');
  assert.match(discussion.content, /Fix   the\nanswer/, 'Internal whitespace and the full goal are preserved');
  assert.ok(!h.activeTools().includes('edit') && !h.activeTools().includes('write') && !h.activeTools().includes('bash'));
  await h.settle(false);
  await running;
  const repository = await loadRepositoryState(h.cwd);
  assert.equal(repository.draft_spec, null);
  assert.equal(repository.confirmed_spec, null);
  assert.equal(repository.run, null, 'Discussion alone must not start implementation');
});

test('a shown full draft plus trusted interactive or RPC confirmation persists USER_INPUT provenance and auto-dispatches exactly one run', async t => {
  for (const [phrase, source] of [['确认，开始', 'interactive'], ['confirm and start', 'rpc']]) {
    const h = await host(t, { answer: '42' });
    await draftOnly(h, `Guided ${source} goal`);
    assert.ok(h.messages.some(message => message.customType === 'surgical-spec-draft'
      && /Scope:/.test(message.content ?? '') && /Non-goals:/.test(message.content ?? '')
      && /Constraints:/.test(message.content ?? '') && /Acceptance criteria:/.test(message.content ?? '')));
    const result = await h.input(phrase, { source });
    assert.equal(result.action, 'handled');
    let repository = await loadRepositoryState(h.cwd);
    assert.equal(repository.draft_spec, null);
    assert.equal(repository.confirmed_spec.status, 'CONFIRMED');
    assert.equal(repository.confirmed_spec.confirmation.source, 'USER_INPUT:confirm-and-start');
    assert.equal(repository.confirmed_spec.confirmation.session_id, 'worker-session');
    assert.equal(h.userMessages.length, 1);
    assert.equal(h.userMessages[0].content, '/surgical run');
    assert.equal(h.userMessages[0].opts.expandPromptTemplates, true);
    const repeat = await h.input(phrase, { source });
    assert.equal(repeat.action, 'handled');
    assert.equal(h.userMessages.length, 1, 'A repeated confirmation cannot auto-run twice');
    await finishGuidedRun(h);
    assert.equal(h.state().status, 'PR_READY');
    repository = await loadRepositoryState(h.cwd);
    assert.equal(repository.confirmed_spec.confirmation.source, 'USER_INPUT:confirm-and-start');
  }
});

test('ambiguous, conditional, negative, quoted, question and image confirmations never confirm an unseen draft', async t => {
  const h = await host(t);
  await draftOnly(h, 'Invalid confirmation variants');
  const variants = ['好', 'yes', '不确认，开始', '确认，开始，但是先不要运行', '确认，开始？', 'confirm and start?',
    '“确认，开始”', '`确认，开始`', 'confirm and start please'];
  for (const text of variants) {
    await h.command('status');
    const result = await h.input(text);
    assert.notEqual(result.action, 'handled', text);
    assert.equal((await loadRepositoryState(h.cwd)).confirmed_spec, null, text);
  }
  await h.command('status');
  const image = await h.input('确认，开始', { images: [{ type: 'image', data: 'fixture', mimeType: 'image/png' }] });
  assert.equal(image.action, 'handled');
  assert.equal((await loadRepositoryState(h.cwd)).confirmed_spec, null);
  assert.equal(h.userMessages.length, 0);
});

test('ordinary confirmation chat passes through when no Surgical workflow is pending', async t => {
  const h = await host(t);
  const result = await h.input('confirm and start');
  assert.equal(result.action, 'continue');
  assert.equal((await loadRepositoryState(h.cwd)).confirmed_spec, null);
  assert.equal(h.userMessages.length, 0);
});

test('ordinary confirmation chat passes through after only the advanced command confirmation or a completed run', async t => {
  const confirmedOnly = await host(t);
  await prepare(confirmedOnly, 'Advanced confirmed only');
  let before = confirmedOnly.messages.length;
  let result = await confirmedOnly.input('confirm and start');
  assert.equal(result.action, 'continue');
  assert.equal(confirmedOnly.messages.length, before, 'No failure or status message may be injected');
  assert.equal(confirmedOnly.userMessages.length, 0);
  assert.equal((await loadRepositoryState(confirmedOnly.cwd)).confirmed_spec.confirmation.source, 'USER_COMMAND:/surgical confirm');

  const completed = await host(t, { answer: '42' });
  const running = start(completed, 'Completed guided gate');
  await completed.started;
  await completed.emit('agent_before_settle', boundary());
  await completed.settle(false);
  await running;
  assert.equal(completed.state().status, 'PR_READY');
  before = completed.messages.length;
  result = await completed.input('confirm and start');
  assert.equal(result.action, 'continue');
  assert.equal(completed.messages.length, before, 'A terminal run and old confirmation must not swallow ordinary chat');
  assert.equal(completed.userMessages.length, 0);
});

test('clarification settlement redisplays the full latest draft once so trusted confirmation can auto-run', async t => {
  const h = await host(t, { answer: '42' });
  const running = h.command('discuss Clarification goal');
  await h.started;
  await h.tools.get('surgical_spec').execute('clarify-spec', {
    goal: 'Clarification goal', scope: ['Keep the change bounded'], non_goals: ['Do not change the API'],
    constraints: ['Keep checks green'], acceptance_criteria: [{ id: 'AC-1', text: 'The bounded change is verified' }],
  }, undefined, undefined, h.ctx);
  await h.settle(false);
  await running;
  let draftDisplays = h.messages.filter(message => message.customType === 'surgical-spec-draft').length;
  await h.emit('agent_settled', { aborted: false });
  assert.equal(h.messages.filter(message => message.customType === 'surgical-spec-draft').length, draftDisplays,
    'An already displayed, matching draft is not repeated at settlement');

  const clarification = await h.input('Please clarify the edge case before we proceed.');
  assert.equal(clarification.action, 'continue');
  await h.emit('agent_settled', { aborted: false });
  const displayed = h.messages.filter(message => message.customType === 'surgical-spec-draft');
  assert.equal(displayed.length, draftDisplays + 1, 'An unchanged draft is redisplayed after clarification settlement');
  assert.match(displayed.at(-1).content, /Scope:[\s\S]*Non-goals:[\s\S]*Constraints:[\s\S]*Acceptance criteria:/);
  assert.match(displayed.at(-1).content, /确认，开始/);
  draftDisplays = displayed.length;

  const confirmed = await h.input('确认，开始');
  assert.equal(confirmed.action, 'handled');
  assert.equal(h.messages.filter(message => message.customType === 'surgical-spec-draft').length, draftDisplays,
    'Confirmation itself adds no extra model-turn draft display');
  await finishGuidedRun(h);
  assert.equal(h.state().status, 'PR_READY', h.state().reason);
  assert.equal((await loadRepositoryState(h.cwd)).confirmed_spec.confirmation.source, 'USER_INPUT:confirm-and-start');
});

test('unseen, cross-session and externally replaced drafts refuse confirmation without marking them displayed', async t => {
  const h = await host(t);
  await draftOnly(h, 'Unseen goal');
  await h.emit('session_start');
  let result = await h.input('确认，开始');
  assert.equal(result.action, 'handled');
  assert.match(h.messages.at(-1).content, /not displayed/i);
  assert.equal((await loadRepositoryState(h.cwd)).confirmed_spec, null);

  await h.command('status');
  h.setSessionId('other-session');
  result = await h.input('confirm and start');
  assert.equal(result.action, 'handled');
  assert.match(h.messages.at(-1).content, /not displayed|session changed/i);
  assert.equal((await loadRepositoryState(h.cwd)).confirmed_spec, null);
  assert.equal(h.userMessages.length, 0);

  const stale = await host(t);
  await draftOnly(stale, 'First displayed goal');
  const before = await loadRepositoryState(stale.cwd);
  const replacement = { ...before.draft_spec, goal: 'Replaced by another session', scope: ['Replaced by another session'], digest: null };
  replacement.acceptance_criteria = [{ id: 'AC-1', text: 'Replaced by another session' }];
  const { specPayloadDigest } = await import('../adapters/pi/spec.mjs');
  replacement.digest = specPayloadDigest(replacement);
  await saveRepositoryState(stale.cwd, { ...before, draft_spec: replacement }, { expectedRevision: before.revision });
  result = await stale.input('确认，开始');
  assert.equal(result.action, 'handled');
  assert.match(stale.messages.at(-1).content, /draft changed before confirmation/i);
  assert.equal((await loadRepositoryState(stale.cwd)).confirmed_spec, null);
  assert.equal(stale.userMessages.length, 0);
});

test('extension-injected confirmation text cannot grant consent', async t => {
  const h = await host(t);
  await draftOnly(h, 'Extension injection goal');
  const result = await h.input('确认，开始', { source: 'extension' });
  assert.equal(result.action, 'continue');
  assert.equal((await loadRepositoryState(h.cwd)).confirmed_spec, null);
  assert.equal(h.userMessages.length, 0);
});

test('busy or queued confirmation input cannot confirm or auto-run', async t => {
  const h = await host(t);
  await draftOnly(h, 'Busy confirmation goal');
  h.setBusy(true);
  for (const streamingBehavior of ['steer', 'followUp']) {
    const result = await h.input('确认，开始', { streamingBehavior });
    assert.equal(result.action, 'handled');
    assert.equal((await loadRepositoryState(h.cwd)).confirmed_spec, null);
    assert.equal(h.userMessages.length, 0);
  }
  h.setBusy(false);
  const result = await h.input('确认，开始');
  assert.equal(result.action, 'handled');
  assert.equal((await loadRepositoryState(h.cwd)).confirmed_spec.confirmation.source, 'USER_INPUT:confirm-and-start');
  await finishGuidedRun(h);
});

test('concurrent input confirmations use single-flight and dispatch at most one run', async t => {
  const h = await host(t, { answer: '42' });
  await draftOnly(h, 'Concurrent confirmation goal');
  const results = await Promise.all([h.input('确认，开始'), h.input('confirm and start')]);
  assert.deepEqual(results.map(result => result.action), ['handled', 'handled']);
  const repository = await loadRepositoryState(h.cwd);
  assert.equal(repository.confirmed_spec.confirmation.source, 'USER_INPUT:confirm-and-start');
  assert.equal(h.userMessages.length, 1, 'Only one auto-run dispatch may be queued');
  assert.ok(h.messages.some(message => /confirmation is already in progress/i.test(message.content ?? '')));
  await finishGuidedRun(h);
});

test('concurrent command and input confirmations share one single-flight guard', async t => {
  const h = await host(t);
  await draftOnly(h, 'Concurrent command confirmation goal');
  const [, result] = await Promise.all([h.command('confirm'), h.input('确认，开始')]);
  assert.equal(result.action, 'handled');
  const repository = await loadRepositoryState(h.cwd);
  assert.equal(repository.confirmed_spec.confirmation.source, 'USER_COMMAND:/surgical confirm');
  assert.equal(h.userMessages.length, 0, 'The losing input confirmation must not dispatch another run');
  assert.ok(h.messages.some(message => /confirmation is already in progress/i.test(message.content ?? '')));
});

test('persistence failure during input confirmation never reports consent or dispatches a run', async t => {
  const h = await host(t);
  await draftOnly(h, 'Persistent input failure');
  const directory = join(h.cwd, '.git', 'surgical-dev');
  await chmod(directory, 0o500);
  try {
    const result = await h.input('确认，开始');
    assert.equal(result.action, 'handled');
    assert.match(h.messages.at(-1).content, /Confirmation failed:.*permission|Confirmation failed:.*EACCES/i);
    const repository = await loadRepositoryState(h.cwd);
    assert.equal(repository.confirmed_spec, null);
    assert.equal(h.userMessages.length, 0);
  } finally {
    await chmod(directory, 0o700);
  }
});

test('a confirmed multi-AC spec is planned through surgical_plan and progresses sequentially in one Worker session', async t => {
  const h = await host(t, { answer: '0', config: { checks: [[process.execPath, '-e', 'if(require("fs").readFileSync("answer.txt","utf8").trim()!=="42")process.exit(1)']] } });
  await writeFile(join(h.cwd, 'cover.txt'), '0');
  execFileSync('git', ['add', 'cover.txt'], { cwd: h.cwd, stdio: 'ignore' });
  execFileSync('git', ['commit', '-qm', 'cover baseline'], { cwd: h.cwd, stdio: 'ignore' });
  const goal = 'Cover both answers; multi-pass';
  await prepare(h, goal, [
    { id: 'AC-1', text: 'answer.txt is 42' },
    { id: 'AC-2', text: 'cover.txt is covered' },
  ]);
  const running = h.command('run');
  await h.started;
  const plan = await h.tools.get('surgical_plan').execute('plan-1', {
    todos: [
      { id: 'TODO-1', goal: 'Set answer', depends_on: [], ac_ids: ['AC-1'] },
      { id: 'TODO-2', goal: 'Set cover', depends_on: ['TODO-1'], ac_ids: ['AC-2'] },
    ],
  }, undefined, undefined, h.ctx);
  assert.match(plan.content[0].text, /Plan accepted/);
  assert.equal(h.state().status, 'IMPLEMENTING');
  const implement = await h.emit('agent_before_settle', boundary());
  assert.equal(implement.continue, true);
  assert.match(implement.entries.at(-1).content, /TODO-1/);
  await writeFile(join(h.cwd, 'answer.txt'), '42');
  const next = await h.emit('agent_before_settle', boundary());
  assert.equal(next.continue, true);
  assert.match(next.entries.at(-1).content, /TODO-2/);
  await writeFile(join(h.cwd, 'cover.txt'), 'covered');
  await h.emit('agent_before_settle', boundary());
  await h.settle(false);
  await running;
  assert.equal(h.state().status, 'PR_READY');
  assert.equal(h.state().workerSessionId, 'worker-session');
  assert.deepEqual(h.state().todos.map(todo => todo.state), ['DONE', 'DONE']);
  assert.equal(h.state().review.acceptance_results.length, 2);
});

test('native compaction is preserved and current-task context is injected once after it', async t => {
  const h = await host(t, { answer: '42', config: { maxPromptChars: 1000 } });
  const running = start(h, 'Verify the answer');
  await h.started;
  const before = await h.emit('session_before_compact', {
    preparation: { firstKeptEntryId: 'entry-1', tokensBefore: 1234 },
    branchEntries: [], customInstructions: undefined, reason: 'threshold', willRetry: false, signal: undefined,
  });
  assert.equal(before, undefined, 'Pi must keep its own generated summary');
  await h.emit('session_compact', { compactionEntry: { summary: 'native Pi summary' }, reason: 'threshold', willRetry: false, fromExtension: false });
  const injected = await h.emit('before_agent_start', {});
  assert.match(injected.message.content, /POST-COMPACTION CURRENT TASK CONTEXT/);
  assert.match(injected.message.content, /AC-1/);
  assert.match(injected.message.content, /TODO-1/);
  assert.ok(injected.message.content.length <= 1000, 'The post-compaction prefix counts toward maxPromptChars');
  assert.equal(await h.emit('before_agent_start', {}), undefined, 'Context is injected once, not every turn');
  await h.command('stop'); await h.settle(true); await running;
});

test('post-compaction current-Todo context counts its prefix and stops BLOCKED when it would overshoot', async t => {
  const h = await host(t, { answer: '42', config: { maxPromptChars: 740 } });
  const running = start(h, 'Verify the answer');
  await h.started;
  await h.emit('session_compact', { compactionEntry: { summary: 'native Pi summary' }, reason: 'threshold', willRetry: false, fromExtension: false });
  const injected = await h.emit('before_agent_start', {});
  assert.equal(injected, undefined, 'No oversized context may be injected');
  assert.equal(h.state().status, 'BLOCKED');
  assert.match(h.state().reason, /maxPromptChars|bounded/i);
  await h.settle(true); await running;
});

test('post-compaction context without a current Todo stops BLOCKED instead of embedding an oversized goal', async t => {
  const h = await host(t, { answer: '42', config: { maxPromptChars: 200 } });
  const running = start(h, 'G'.repeat(500), [
    { id: 'AC-1', text: 'first criterion' },
    { id: 'AC-2', text: 'second criterion' },
  ]);
  await h.started;
  await h.emit('session_compact', { compactionEntry: { summary: 'native Pi summary' }, reason: 'threshold', willRetry: false, fromExtension: false });
  const injected = await h.emit('before_agent_start', {});
  assert.equal(injected, undefined, 'No oversized context may be injected');
  assert.equal(h.state().status, 'BLOCKED');
  assert.match(h.state().reason, /maxPromptChars|bounded/i);
  await h.settle(true); await running;
});


test('run with a goal routes to discussion unless it exactly matches the confirmed scope', async t => {
  const h = await host(t, { answer: '42' });
  await prepare(h, 'Confirmed goal');
  let running = h.command('run Confirmed goal');
  await h.started;
  await h.emit('agent_before_settle', boundary());
  await h.settle(false);
  await running;
  assert.equal(h.state().status, 'PR_READY');

  await draftOnly(h, 'Different goal');
  let repository = await loadRepositoryState(h.cwd);
  assert.equal(repository.confirmed_spec, null, 'Import invalidates the prior confirmation');
  assert.equal(repository.draft_spec.goal, 'Different goal');
  await h.command('run');
  assert.ok(h.messages.some(message => /draft\/discussion is pending/.test(message.content ?? '')));

  running = h.command('run Another new goal');
  await h.started;
  await h.settle(false);
  await running;
  repository = await loadRepositoryState(h.cwd);
  assert.equal(repository.draft_spec, null);
  assert.equal(repository.confirmed_spec, null);
  assert.ok(h.messages.some(message => /does not exactly match the confirmed scope/.test(message.content ?? '')));
});

test('confirmation rejects a draft replaced after its displayed revision', async t => {
  const h = await host(t);
  await draftOnly(h, 'First displayed goal');
  const before = await loadRepositoryState(h.cwd);
  const replacement = { ...before.draft_spec, goal: 'Replaced by another session', scope: ['Replaced by another session'], digest: null };
  replacement.acceptance_criteria = [{ id: 'AC-1', text: 'Replaced by another session' }];
  const { specPayloadDigest } = await import('../adapters/pi/spec.mjs');
  replacement.digest = specPayloadDigest(replacement);
  await saveRepositoryState(h.cwd, { ...before, draft_spec: replacement }, { expectedRevision: before.revision });

  await h.command('confirm');
  assert.ok(h.messages.some(message => /draft changed before confirmation/.test(message.content ?? '')));
  let repository = await loadRepositoryState(h.cwd);
  assert.equal(repository.confirmed_spec, null);
  await h.command('confirm');
  assert.equal(h.messages.filter(message => /draft changed before confirmation/.test(message.content ?? '')).length, 2, 'Repeated confirm cannot consume unseen scope');

  await h.command('status');
  await h.command('confirm');
  repository = await loadRepositoryState(h.cwd);
  assert.equal(repository.confirmed_spec.goal, 'Replaced by another session');
  assert.equal(repository.confirmed_spec.confirmation.source, 'USER_COMMAND:/surgical confirm');
});

test('new discussion is allowed after a terminal run and clears superseded confirmation', async t => {
  const h = await host(t, { answer: '42' });
  let running = start(h, 'Verify the answer');
  await h.started;
  await h.emit('agent_before_settle', boundary());
  await h.settle(false);
  await running;
  assert.equal(h.state().status, 'PR_READY');

  running = h.command('discuss A new bounded goal');
  await h.started;
  await h.settle(false);
  await running;
  const repository = await loadRepositoryState(h.cwd);
  assert.equal(repository.confirmed_spec, null);
  assert.equal(repository.draft_spec, null);
});

test('state write failures are visible and never report a confirmed or saved draft', async t => {
  const h = await host(t);
  await draftOnly(h, 'Keep this draft');
  const directory = join(h.cwd, '.git', 'surgical-dev');
  await chmod(directory, 0o500);
  try {
    const importedPath = join(tmpdir(), `surgical-fail-${Date.now()}.json`);
    await writeFile(importedPath, JSON.stringify({ goal: 'New draft', scope: ['New draft'], non_goals: [], constraints: [], acceptance_criteria: [{ id: 'AC-1', text: 'New draft' }] }));
    await h.command(`import ${importedPath}`);
    assert.ok(h.messages.some(message => /Import failed:.*permission|Import failed:.*EACCES/i.test(message.content ?? '')));
    await h.command('confirm');
    assert.ok(h.messages.some(message => /Confirmation failed:.*permission|Confirmation failed:.*EACCES/i.test(message.content ?? '')));
    const repository = await loadRepositoryState(h.cwd);
    assert.equal(repository.confirmed_spec, null);
  } finally {
    await chmod(directory, 0o700);
  }
});

test('mixed or missing usage keeps totals UNKNOWN while exposing measured subtotals', async t => {
  const h = await host(t, { answer: '42' });
  const running = start(h, 'Verify the answer');
  await h.started;
  h.emit('message_end', { message: { role: 'assistant', usage: { input: 10, output: 5, total: 15 } } });
  h.emit('message_end', { message: { role: 'assistant', usage: { input: 0, output: 0, total: 0 } } });
  const state = h.state();
  assert.equal(state.usage.tokens.input, 10);
  assert.equal(state.usage.tokens.output, 5);
  assert.equal(state.usage.tokens.total, 15);
  assert.equal(state.usage.tokens.cost, 'UNKNOWN');
  assert.equal(state.usage.worker_usage_complete, false);
  assert.equal(state.usage.total_tokens, 'UNKNOWN');
  assert.equal(state.usage.calls.workerAssistant, 2);
  await h.command('stop'); await h.settle(true); await running;
});

test('a persisted draft must be shown in this session before it can be confirmed', async t => {
  const h = await host(t);
  await draftOnly(h, 'Persisted but unseen');
  await h.emit('session_start');
  await h.command('confirm');
  assert.ok(h.messages.some(message => /not displayed|draft changed before confirmation/.test(message.content ?? '')));
  let repository = await loadRepositoryState(h.cwd);
  assert.equal(repository.confirmed_spec, null);
  await h.command('status');
  await h.command('confirm');
  repository = await loadRepositoryState(h.cwd);
  assert.equal(repository.confirmed_spec.goal, 'Persisted but unseen');
});

test('session startup observes another nonterminal run without mutating shared state', async t => {
  const h = await host(t);
  const before = await loadRepositoryState(h.cwd);
  const run = {
    id: 'other-live-run', status: 'IMPLEMENTING', reason: null, goal: 'other session work',
    todos: [], activeTodoId: null, checkAttempts: 0, turnsUsed: 0,
    usage: { tokens: 'UNKNOWN' }, config: { maxTurns: 40, maxCheckAttempts: 6, maxReviewRepairCycles: 2 },
  };
  const saved = await saveRepositoryState(h.cwd, { ...before, run }, { expectedRevision: before.revision });
  await h.emit('session_start');
  const after = await loadRepositoryState(h.cwd);
  assert.equal(after.revision, saved.revision, 'Session startup must not write shared run state');
  assert.equal(after.run.status, 'IMPLEMENTING');
  assert.equal(h.state().status, 'BLOCKED', 'Only local presentation is marked interrupted');
});

test('discussion tools are restored on switch and shutdown', async t => {
  const h = await host(t);
  const running = h.command('discuss A bounded goal');
  await h.started;
  await h.settle(false);
  await running;
  assert.ok(!h.activeTools().includes('edit'));
  await h.emit('session_before_switch', { reason: 'resume' });
  assert.ok(h.activeTools().includes('edit') && h.activeTools().includes('write'));
});

test('plan persistence failure stops the run BLOCKED before checks or review', async t => {
  const h = await host(t, { answer: '0' });
  await prepare(h, 'Persisted plan failure', [
    { id: 'AC-1', text: 'first' },
    { id: 'AC-2', text: 'second' },
  ]);
  const running = h.command('run');
  await h.started;
  assert.equal(h.state().status, 'PLANNING');
  const lockPath = join(h.cwd, '.git', 'surgical-dev', 'state.lock');
  await writeFile(lockPath, '{}');
  try {
    const result = await h.tools.get('surgical_plan').execute('plan-fail', {
      todos: [
        { id: 'TODO-1', goal: 'First', depends_on: [], ac_ids: ['AC-1'] },
        { id: 'TODO-2', goal: 'Second', depends_on: ['TODO-1'], ac_ids: ['AC-2'] },
      ],
    }, undefined, undefined, h.ctx);
    assert.match(result.content[0].text, /run BLOCKED/i);
    assert.equal(h.state().status, 'BLOCKED');
    assert.match(h.state().reason, /persistence failed/i);
    assert.equal(h.state().checkAttempts, 0);
    assert.equal(h.state().reviewAttempts, 0);
  } finally {
    await rm(lockPath, { force: true });
  }
  await h.settle(false);
  await running;
  assert.equal(h.state().status, 'BLOCKED');
});
