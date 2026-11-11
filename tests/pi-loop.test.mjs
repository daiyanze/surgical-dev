import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRun, advanceRun, validateConfig } from '../adapters/pi/loop.mjs';
import { captureSnapshot, runProcess } from '../adapters/pi/process.mjs';

const fixture = fileURLToPath(new URL('./fixtures/pi-reviewer.mjs', import.meta.url));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const config = overrides => validateConfig({ checks: [[process.execPath, '-e', 'process.exit(0)']], reviewerCommand: [process.execPath, fixture], ...overrides });

async function repository(t, text = '0') {
  const cwd = await mkdtemp(join(tmpdir(), 'surgical-loop-test-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  git(cwd, 'init', '-q');
  git(cwd, 'config', 'user.name', 'Test');
  git(cwd, 'config', 'user.email', 'test@example.invalid');
  await writeFile(join(cwd, 'answer.txt'), text);
  await writeFile(join(cwd, '.gitignore'), 'ignored/\n');
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-qm', 'baseline');
  return cwd;
}

test('failed real check returns evidence, then repaired source passes independent review', async t => {
  const cwd = await repository(t);
  const check = [process.execPath, '-e', 'if(require("fs").readFileSync("answer.txt","utf8").trim()!=="42"){console.error("expected 42");process.exit(1)}'];
  const run = await createRun({ cwd, goal: 'Put 42 in answer.txt', config: config({ checks: [check] }), workerSessionId: 'worker-1' });
  t.after(() => run.close());
  const first = await advanceRun(run);
  assert.equal(first.action, 'continue');
  assert.match(first.feedback, /expected 42/);
  assert.equal(run.state.reviewAttempts, 0);
  await writeFile(join(cwd, 'answer.txt'), '42');
  const next = await advanceRun(run);
  assert.equal(next.action, 'ready');
  assert.equal(run.state.review.verdict, 'PASS');
  assert.equal(run.state.review.review_scope, 'INTEGRATION');
  assert.notEqual(run.state.review.reviewer_session_ref, 'worker-1');
  assert.equal(run.state.workerSessionId, 'worker-1');
  assert.equal(run.state.checkAttempts, 2);
  assert.equal(git(cwd, 'diff', '--cached'), '');
  assert.match(git(cwd, 'status', '--porcelain'), /answer.txt/);
});

test('review findings return directly to Worker and the repaired snapshot is reviewed anew', async t => {
  const cwd = await repository(t);
  const run = await createRun({ cwd, goal: 'Put 42 in answer.txt', config: config(), workerSessionId: 'worker-2' });
  t.after(() => run.close());
  const first = await advanceRun(run);
  assert.equal(first.action, 'continue');
  assert.match(first.feedback, /answer.txt must contain 42/);
  const oldHead = run.state.review.head_sha;
  await writeFile(join(cwd, 'answer.txt'), '42');
  assert.equal((await advanceRun(run)).action, 'ready');
  assert.notEqual(run.state.review.head_sha, oldHead);
  assert.equal(run.state.reviewRepairsUsed, 1);
});

test('two review repair cycles are allowed; the next failure stops with history intact', async t => {
  const cwd = await repository(t);
  const run = await createRun({ cwd, goal: 'Put 42 in answer.txt', config: config(), workerSessionId: 'worker-3' });
  t.after(() => run.close());
  assert.equal((await advanceRun(run)).action, 'continue');
  assert.equal((await advanceRun(run)).action, 'continue');
  assert.equal((await advanceRun(run)).action, 'stop');
  assert.equal(run.state.status, 'ESCALATED');
  assert.equal(run.state.reviewRepairsUsed, 2);
  assert.equal(run.state.reviewAttempts, 3);
});

for (const mode of ['model-error', 'invalid-json', 'missing-evidence', 'wrong-session', 'wrong-criterion', 'blocked-review', 'extra-field', 'duplicate-evidence', 'duplicate-notes']) {
  test(`reviewer ${mode} cannot produce readiness even with successful exit`, async t => {
    const cwd = await repository(t, '42');
    const run = await createRun({ cwd, goal: `Verify answer; ${mode}`, config: config(), workerSessionId: 'worker-4' });
    t.after(() => run.close());
    const result = await advanceRun(run);
    assert.equal(result.action, 'stop');
    assert.equal(run.state.status, 'BLOCKED');
    assert.ok(run.state.reason);
  });
}

test('snapshot includes staged, unstaged, deleted and new files without changing the real index', async t => {
  const cwd = await repository(t);
  await writeFile(join(cwd, 'staged.txt'), 'staged');
  git(cwd, 'add', 'staged.txt');
  const indexBefore = git(cwd, 'write-tree');
  await writeFile(join(cwd, 'new.txt'), 'new');
  await rm(join(cwd, 'answer.txt'));
  const shot = await captureSnapshot(cwd);
  const paths = git(cwd, 'ls-tree', '-r', '--name-only', shot.tree).split('\n');
  assert.ok(paths.includes('staged.txt'));
  assert.ok(paths.includes('new.txt'));
  assert.ok(!paths.includes('answer.txt'));
  assert.equal(git(cwd, 'write-tree'), indexBefore);
});

test('a check that changes the candidate cannot certify its earlier snapshot', async t => {
  const cwd = await repository(t, '42');
  const run = await createRun({ cwd, goal: 'Keep answer correct', config: config({ checks: [[process.execPath, '-e', 'require("fs").writeFileSync("answer.txt","different")']] }), workerSessionId: 'worker-5' });
  t.after(() => run.close());
  assert.equal((await advanceRun(run)).action, 'stop');
  assert.equal(run.state.status, 'BLOCKED');
  assert.equal(run.state.reviewAttempts, 0);
  assert.match(run.state.reason, /snapshot|changed/i);
});

test('an unreachable reviewer is recorded as blocked', async t => {
  const cwd = await repository(t, '42');
  const run = await createRun({ cwd, goal: 'Keep answer correct', config: config({ reviewerCommand: ['/missing/pi'] }), workerSessionId: 'worker-6' });
  t.after(() => run.close());
  assert.equal((await advanceRun(run)).action, 'stop');
  assert.equal(run.state.status, 'BLOCKED');
});

test('check-attempt limits prevent an endless failing-check loop', async t => {
  const cwd = await repository(t);
  const run = await createRun({ cwd, goal: 'Fix the task', config: config({ checks: [[process.execPath, '-e', 'process.exit(1)']], maxCheckAttempts: 2 }), workerSessionId: 'worker-7' });
  t.after(() => run.close());
  assert.equal((await advanceRun(run)).action, 'continue');
  assert.equal((await advanceRun(run)).action, 'stop');
  assert.equal(run.state.checkAttempts, 2);
  assert.equal(run.state.status, 'ESCALATED');
});

test('cancel terminates a running process instead of waiting for its configured duration', async () => {
  const controller = new AbortController();
  const promise = runProcess([process.execPath, '-e', 'setInterval(()=>{},1000)'], { signal: controller.signal, timeoutMs: 20_000 });
  setTimeout(() => controller.abort(), 50);
  const result = await promise;
  assert.equal(result.aborted, true);
  assert.notEqual(result.code, 0);
});

test('timeout is distinct from success', async () => {
  const result = await runProcess([process.execPath, '-e', 'setInterval(()=>{},1000)'], { timeoutMs: 50 });
  assert.equal(result.timedOut, true);
  assert.notEqual(result.code, 0);
});

test('invalid checks and unbounded or excessive limits are rejected', () => {
  for (const bad of [{ checks: [] }, { checks: ['npm test'] }, { maxTurns: 0 }, { maxReviewRepairCycles: 3 }, { timeoutSeconds: Infinity }]) {
    assert.throws(() => config(bad));
  }
});

test('a second run cannot claim the same repository while its owner is active', async t => {
  const cwd = await repository(t);
  const run = await createRun({ cwd, goal: 'First task', config: config(), workerSessionId: 'one' });
  t.after(() => run.close());
  await assert.rejects(createRun({ cwd, goal: 'Second task', config: config(), workerSessionId: 'two' }), /active|lock|claimed/i);
});

test('the last allowed Worker turn can still pass verification', async t => {
  const cwd = await repository(t, '42');
  const run = await createRun({ cwd, goal: 'Keep answer correct', config: config({ maxTurns: 1 }), workerSessionId: 'last-turn' });
  t.after(() => run.close());
  run.state.turnsUsed = 1;
  assert.equal((await advanceRun(run)).action, 'ready');
  await run.finish();
  assert.equal(run.state.status, 'PR_READY');
});

test('a changed candidate at final settlement invalidates the review', async t => {
  const cwd = await repository(t, '42');
  const run = await createRun({ cwd, goal: 'Keep answer correct', config: config(), workerSessionId: 'stale' });
  t.after(() => run.close());
  assert.equal((await advanceRun(run)).action, 'ready');
  await writeFile(join(cwd, 'answer.txt'), 'changed after review');
  await run.finish();
  assert.equal(run.state.status, 'BLOCKED');
  assert.match(run.state.reason, /snapshot changed/);
});

test('large diffs reach the reviewer without exceeding per-argument OS limits', async t => {
  const cwd = await repository(t, '42');
  const run = await createRun({ cwd, goal: 'Keep answer correct', config: config(), workerSessionId: 'large-diff' });
  t.after(() => run.close());
  await writeFile(join(cwd, 'large.txt'), 'source context\n'.repeat(15_000));
  assert.equal((await advanceRun(run)).action, 'ready');
});

test('cancellation during final snapshot capture cannot resurrect readiness', async t => {
  const cwd = await repository(t, '42');
  const run = await createRun({ cwd, goal: 'Keep answer correct', config: config(), workerSessionId: 'cancel-finalize' });
  t.after(() => run.close());
  assert.equal((await advanceRun(run)).action, 'ready');
  const finishing = run.finish();
  await run.stop('CANCELLED', 'User stopped during finalization');
  await finishing;
  assert.equal(run.state.status, 'CANCELLED');
});

test('a newly force-added ignored file is part of the reviewed source', async t => {
  const cwd = await repository(t);
  await mkdir(join(cwd, 'ignored'));
  await writeFile(join(cwd, 'ignored', 'source.js'), 'staged source');
  git(cwd, 'add', '-f', 'ignored/source.js');
  const index = git(cwd, 'write-tree');
  const shot = await captureSnapshot(cwd);
  assert.match(git(cwd, 'ls-tree', '-r', '--name-only', shot.tree), /ignored\/source.js/);
  assert.equal(git(cwd, 'write-tree'), index);
  await writeFile(join(cwd, 'ignored', 'source.js'), 'changed source');
  assert.notEqual((await captureSnapshot(cwd)).tree, shot.tree);
});

test('cancellation retains repository ownership until the Worker settles', async t => {
  const cwd = await repository(t);
  const run = await createRun({ cwd, goal: 'Keep answer correct', config: config(), workerSessionId: 'old-owner' });
  t.after(() => run.close());
  run.workerRunning = true;
  await run.stop('CANCELLED', 'Stop requested');
  await assert.rejects(createRun({ cwd, goal: 'New task', config: config(), workerSessionId: 'new-owner' }), /claimed|lock/);
  run.workerRunning = false;
  await run.close();
  const next = await createRun({ cwd, goal: 'New task', config: config(), workerSessionId: 'new-owner' });
  await next.close();
});

test('cancellation stops background descendants that ignore SIGTERM', { skip: process.platform !== 'linux' }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'surgical-child-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const pidFile = join(directory, 'pid');
  const grandchild = `process.on('SIGTERM',()=>{});require('fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setInterval(()=>{},1000)`;
  const parent = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(grandchild)}],{stdio:'ignore'});setInterval(()=>{},1000)`;
  const controller = new AbortController();
  const running = runProcess([process.execPath, '-e', parent], { signal: controller.signal, timeoutMs: 3000 });
  let pid;
  for (let i = 0; i < 100 && !pid; i++) {
    pid = Number(await readFile(pidFile, 'utf8').catch(() => ''));
    if (!pid) await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.ok(pid, 'Grandchild must be running before cancellation');
  t.after(() => { try { process.kill(pid, 'SIGKILL'); } catch {} });
  controller.abort();
  assert.equal((await running).aborted, true);
  const status = await readFile(`/proc/${pid}/stat`, 'utf8').catch(() => '');
  assert.ok(!status || status.split(' ')[2] === 'Z', 'No active descendant may survive cancellation');
});
