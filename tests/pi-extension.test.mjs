import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { registerSurgicalLoop } from '../adapters/pi/extension.mjs';

const reviewer = fileURLToPath(new URL('./fixtures/pi-reviewer.mjs', import.meta.url));

async function host(t, options = {}) {
  const cwd = await mkdtemp(join(tmpdir(), 'surgical-extension-test-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, stdio: 'ignore' });
  git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
  await writeFile(join(cwd, 'answer.txt'), options.answer ?? '0');
  await writeFile(join(cwd, '.surgical-dev.json'), JSON.stringify({ checks: [[process.execPath, '-e', 'process.exit(0)']], reviewerCommand: [process.execPath, reviewer], ...options.config }));
  git('add', '.'); git('commit', '-qm', 'baseline');
  const handlers = new Map(), commands = new Map(), records = [], messages = [];
  let busy = false, resolveIdle, resolveStarted;
  const started = new Promise(resolve => { resolveStarted = resolve; });
  const idle = new Promise(resolve => { resolveIdle = resolve; });
  const ctx = {
    cwd, hasUI: false, mode: 'json', model: undefined,
    sessionManager: { getSessionId: () => 'engineer-session', getEntries: () => records, getBranch: () => records },
    isIdle: () => !busy, hasPendingMessages: () => false,
    waitForIdle: () => busy ? idle : Promise.resolve(),
    abort: () => {}, ui: { setStatus: () => {}, notify: () => {} },
  };
  const pi = {
    on: (name, handler) => handlers.set(name, handler),
    registerCommand: (name, command) => commands.set(name, command),
    appendEntry: (customType, data) => records.push({ type: 'custom', customType, data: structuredClone(data) }),
    sendMessage: (message, opts) => {
      messages.push(message);
      if (opts?.triggerTurn) { busy = true; resolveStarted(); }
    },
  };
  registerSurgicalLoop(pi);
  const emit = (name, event = {}) => handlers.get(name)?.(event, ctx);
  const settle = async aborted => { await emit('agent_settled', { aborted }); busy = false; resolveIdle(); };
  t.after(async () => { await commands.get('surgical').handler('stop', ctx); resolveIdle(); });
  return { cwd, ctx, records, messages, started, emit, settle, command: args => commands.get('surgical').handler(args, ctx), state: () => records.at(-1)?.data };
}
// A normal final assistant response is not continuable until feedback is added.
const boundary = extra => ({ entries: [], continue: false, outcome: 'completed', context: { contextEntries: [], contextMessages: [], llmMessages: [], pendingMessages: [], canContinue: false }, ...extra });

test('command stays in its original session until review repair and final settlement finish', async t => {
  const h = await host(t);
  let returned = false;
  const running = h.command('run Put 42 in answer.txt').then(() => { returned = true; });
  await h.started;
  assert.equal(returned, false);
  const preceding = { type: 'custom_message', customType: 'other-extension', content: 'Keep this', display: false };
  const first = await h.emit('agent_before_settle', boundary({ entries: [preceding] }));
  assert.equal(first.continue, true);
  assert.deepEqual(first.entries[0], preceding);
  assert.match(first.entries.at(-1).content, /answer.txt must contain 42/);
  await writeFile(join(h.cwd, 'answer.txt'), '42');
  await h.emit('agent_before_settle', boundary());
  assert.notEqual(h.state().status, 'PR_READY');
  await h.settle(false);
  await running;
  assert.equal(h.state().status, 'PR_READY');
  assert.equal(h.state().engineerSessionId, 'engineer-session');
});

test('an aborted boundary never dispatches checks or a reviewer', async t => {
  const h = await host(t);
  const running = h.command('run Put 42 in answer.txt');
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
  const running = h.command('run Verify the answer');
  await h.started;
  await h.emit('agent_before_settle', boundary());
  await h.settle(true); await running;
  assert.equal(h.state().status, 'CANCELLED');
  assert.ok(!h.messages.some(message => message.details?.status === 'PR_READY'));
});

test('stop interrupts an in-progress reviewer and requests no next turn', async t => {
  const h = await host(t, { answer: '42' });
  const running = h.command('run Verify the answer; slow-review');
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
  const running = h.command('run Fix the answer');
  await h.started;
  assert.equal(await h.emit('agent_before_settle', boundary({ continue: true })), undefined);
  assert.equal(h.state().checkAttempts, 0);
  await h.command('stop'); await h.settle(true); await running;
});

test('a changed check policy blocks verification instead of accepting weaker commands', async t => {
  const h = await host(t, { answer: '42' });
  const running = h.command('run Verify the answer');
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

test('stop during command preflight prevents starting the Engineer', async t => {
  const h = await host(t);
  let incorrectlyStarted = false;
  h.started.then(async () => { incorrectlyStarted = true; await h.command('stop'); await h.settle(true); });
  const running = h.command('run Fix the answer');
  await h.command('stop');
  await running;
  assert.equal(incorrectlyStarted, false);
  assert.ok(!h.messages.some(message => message.customType === 'surgical-goal'));
});
