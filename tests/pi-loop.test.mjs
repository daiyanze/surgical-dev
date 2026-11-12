import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { adjustRunPlan, createRun, advanceRun, parseReviewerOutput, planTodos, validateConfig } from '../adapters/pi/loop.mjs';
import { confirmSpec, createDraftSpec } from '../adapters/pi/spec.mjs';
import { captureSnapshot, runProcess } from '../adapters/pi/process.mjs';

const fixture = fileURLToPath(new URL('./fixtures/pi-reviewer.mjs', import.meta.url));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const config = overrides => validateConfig({ checks: [[process.execPath, '-e', 'process.exit(0)']], reviewerCommand: [process.execPath, fixture], ...overrides });
const oneSpec = goal => spec(goal, [{ id: 'AC-1', text: goal }]);
const spec = (goal, acceptance_criteria, extra = {}) => confirmSpec(createDraftSpec({
  goal, scope: [goal], non_goals: [], constraints: [], acceptance_criteria, ...extra,
}), 'worker-session');

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
  const run = await createRun({ cwd, spec: oneSpec('Put 42 in answer.txt'), config: config({ checks: [check] }), workerSessionId: 'worker-1' });
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
  const run = await createRun({ cwd, spec: oneSpec('Put 42 in answer.txt'), config: config(), workerSessionId: 'worker-2' });
  t.after(() => run.close());
  const first = await advanceRun(run);
  assert.equal(first.action, 'continue');
  assert.match(first.feedback, /Make AC-1 pass without changing scope/);
  const oldHead = run.state.review.head_sha;
  await writeFile(join(cwd, 'answer.txt'), '42');
  assert.equal((await advanceRun(run)).action, 'ready');
  assert.notEqual(run.state.review.head_sha, oldHead);
  assert.equal(run.state.reviewRepairsUsed, 1);
});

test('review repair feedback bounds the diagnostic while preserving full findings and frozen scope', async t => {
  const cwd = await repository(t, 'x'.repeat(6000));
  const run = await createRun({ cwd, spec: oneSpec('Put exactly 42 in answer.txt'), config: config({ maxPromptChars: 3000 }), workerSessionId: 'bounded-review' });
  t.after(() => run.close());
  const result = await advanceRun(run);
  assert.equal(result.action, 'continue');
  assert.equal(run.state.review.verdict, 'CHANGES_REQUIRED');
  assert.ok(result.feedback.length <= 3000);
  assert.match(result.feedback, /Put exactly 42 in answer\.txt/);
  assert.match(result.feedback, /AC-1/);
  const finding = run.state.review.blocking_findings[0];
  assert.ok(finding.evidence.length > 1000, 'Full diagnostic must remain persisted');
  const context = result.feedback.slice(result.feedback.indexOf('Current Todo context'));
  const parsed = JSON.parse(context.slice(context.indexOf('{')));
  assert.equal(parsed.current_diagnostic.kind, 'independent_review_findings');
  assert.equal(parsed.current_diagnostic.findings[0].clearance_condition, 'Make AC-1 pass without changing scope');
  assert.ok(parsed.current_diagnostic.findings[0].evidence.length < finding.evidence.length);
  assert.match(parsed.current_diagnostic.findings[0].evidence, /truncated/);
});

test('review repair feedback stops BLOCKED when the bounded mandatory diagnostic cannot fit', async t => {
  const cwd = await repository(t, 'x'.repeat(6000));
  const run = await createRun({ cwd, spec: oneSpec('Put exactly 42 in answer.txt'), config: config({ maxPromptChars: 800 }), workerSessionId: 'unfittable-review' });
  t.after(() => run.close());
  const result = await advanceRun(run);
  assert.equal(result.action, 'stop');
  assert.equal(run.state.status, 'BLOCKED');
  assert.match(run.state.reason, /maxPromptChars/);
  assert.equal(run.state.review.verdict, 'CHANGES_REQUIRED');
  assert.ok(run.state.review.blocking_findings[0].evidence.length > 1000, 'Full diagnostics remain persisted on BLOCKED');
});

test('generated review includes only review-contract fields and the completeness flag', async t => {
  const cwd = await repository(t, '42');
  const run = await createRun({ cwd, spec: oneSpec('Keep answer correct'), config: config(), workerSessionId: 'review-contract' });
  t.after(() => run.close());
  assert.equal((await advanceRun(run)).action, 'ready');
  const schema = JSON.parse(await readFile(new URL('../contracts/review.schema.json', import.meta.url), 'utf8'));
  assert.equal(schema.additionalProperties, false);
  for (const key of Object.keys(run.state.review)) {
    assert.ok(Object.hasOwn(schema.properties, key), `Generated review field ${key} is missing from contracts/review.schema.json`);
  }
  for (const key of schema.required) assert.ok(Object.hasOwn(run.state.review, key), `Generated review is missing required field ${key}`);
  assert.equal(typeof run.state.review.reviewer_usage_complete, 'boolean');
});

test('two review repair cycles are allowed; the next failure stops with history intact', async t => {
  const cwd = await repository(t);
  const run = await createRun({ cwd, spec: oneSpec('Put 42 in answer.txt'), config: config(), workerSessionId: 'worker-3' });
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
    const run = await createRun({ cwd, spec: oneSpec(`Verify answer; ${mode}`), config: config(), workerSessionId: 'worker-4' });
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
  const run = await createRun({ cwd, spec: oneSpec('Keep answer correct'), config: config({ checks: [[process.execPath, '-e', 'require("fs").writeFileSync("answer.txt","different")']] }), workerSessionId: 'worker-5' });
  t.after(() => run.close());
  assert.equal((await advanceRun(run)).action, 'stop');
  assert.equal(run.state.status, 'BLOCKED');
  assert.equal(run.state.reviewAttempts, 0);
  assert.match(run.state.reason, /snapshot|changed/i);
});

test('an unreachable reviewer is recorded as blocked', async t => {
  const cwd = await repository(t, '42');
  const run = await createRun({ cwd, spec: oneSpec('Keep answer correct'), config: config({ reviewerCommand: ['/missing/pi'] }), workerSessionId: 'worker-6' });
  t.after(() => run.close());
  assert.equal((await advanceRun(run)).action, 'stop');
  assert.equal(run.state.status, 'BLOCKED');
});

test('check-attempt limits prevent an endless failing-check loop', async t => {
  const cwd = await repository(t);
  const run = await createRun({ cwd, spec: oneSpec('Fix the task'), config: config({ checks: [[process.execPath, '-e', 'process.exit(1)']], maxCheckAttempts: 2 }), workerSessionId: 'worker-7' });
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
  const run = await createRun({ cwd, spec: oneSpec('First task'), config: config(), workerSessionId: 'one' });
  t.after(() => run.close());
  await assert.rejects(createRun({ cwd, spec: oneSpec('Second task'), config: config(), workerSessionId: 'two' }), /active|lock|claimed/i);
});

test('the last allowed Worker turn can still pass verification', async t => {
  const cwd = await repository(t, '42');
  const run = await createRun({ cwd, spec: oneSpec('Keep answer correct'), config: config({ maxTurns: 1 }), workerSessionId: 'last-turn' });
  t.after(() => run.close());
  run.state.turnsUsed = 1;
  assert.equal((await advanceRun(run)).action, 'ready');
  await run.finish();
  assert.equal(run.state.status, 'PR_READY');
});

test('a changed candidate at final settlement invalidates the review', async t => {
  const cwd = await repository(t, '42');
  const run = await createRun({ cwd, spec: oneSpec('Keep answer correct'), config: config(), workerSessionId: 'stale' });
  t.after(() => run.close());
  assert.equal((await advanceRun(run)).action, 'ready');
  await writeFile(join(cwd, 'answer.txt'), 'changed after review');
  await run.finish();
  assert.equal(run.state.status, 'BLOCKED');
  assert.match(run.state.reason, /snapshot changed/);
});

test('large diffs reach the reviewer without exceeding per-argument OS limits', async t => {
  const cwd = await repository(t, '42');
  const run = await createRun({ cwd, spec: oneSpec('Keep answer correct'), config: config(), workerSessionId: 'large-diff' });
  t.after(() => run.close());
  await writeFile(join(cwd, 'large.txt'), 'source context\n'.repeat(15_000));
  assert.equal((await advanceRun(run)).action, 'ready');
});

test('cancellation during final snapshot capture cannot resurrect readiness', async t => {
  const cwd = await repository(t, '42');
  const run = await createRun({ cwd, spec: oneSpec('Keep answer correct'), config: config(), workerSessionId: 'cancel-finalize' });
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
  const run = await createRun({ cwd, spec: oneSpec('Keep answer correct'), config: config(), workerSessionId: 'old-owner' });
  t.after(() => run.close());
  run.workerRunning = true;
  await run.stop('CANCELLED', 'Stop requested');
  await assert.rejects(createRun({ cwd, spec: oneSpec('New task'), config: config(), workerSessionId: 'new-owner' }), /claimed|lock/);
  run.workerRunning = false;
  await run.close();
  const next = await createRun({ cwd, spec: oneSpec('New task'), config: config(), workerSessionId: 'new-owner' });
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

test('multi-Todo dependency progression stays in one Worker session and is settled by real checks', async t => {
  const cwd = await repository(t);
  await writeFile(join(cwd, 'cover.txt'), '0');
  git(cwd, 'add', 'cover.txt');
  git(cwd, 'commit', '-qm', 'cover baseline');
  const check = [process.execPath, '-e', 'const fs=require("fs");if(fs.readFileSync("answer.txt","utf8").trim()!=="42"&&fs.readFileSync("cover.txt","utf8").trim()!=="covered"){console.error("candidate incomplete");process.exit(1)}'];
  const goalSpec = spec('Cover pagination; multi-pass', [
    { id: 'AC-1', text: 'answer.txt contains 42' },
    { id: 'AC-2', text: 'cover.txt contains covered' },
  ]);
  const todos = [
    { id: 'TODO-1', goal: 'Set answer', depends_on: [], ac_ids: ['AC-1'] },
    { id: 'TODO-2', goal: 'Set cover', depends_on: ['TODO-1'], ac_ids: ['AC-2'] },
  ];
  const run = await createRun({ cwd, spec: goalSpec, todos, config: config({ checks: [check] }), workerSessionId: 'multi-worker' });
  t.after(() => run.close());
  const first = await advanceRun(run);
  assert.equal(first.action, 'continue');
  assert.equal(run.state.todos[0].state, 'IN_PROGRESS');
  assert.equal(run.state.todos[1].state, 'PENDING');
  await writeFile(join(cwd, 'answer.txt'), '42');
  const second = await advanceRun(run);
  assert.equal(second.action, 'continue');
  assert.equal(run.state.todos[0].state, 'DONE');
  assert.match(second.feedback, /TODO-2/);
  await writeFile(join(cwd, 'cover.txt'), 'covered');
  const settled = await advanceRun(run);
  assert.equal(settled.action, 'ready');
  assert.equal(run.state.workerSessionId, 'multi-worker');
  assert.deepEqual(run.state.todos.map(todo => todo.state), ['DONE', 'DONE']);
  assert.equal(run.state.todos[0].evidence[0].stale, true, 'Later source changes invalidate older Todo evidence');
  assert.equal(run.state.review.acceptance_results.length, 2);
  await run.finish();
  assert.equal(run.state.status, 'PR_READY');
});

test('all Todos done but an original AC fails cannot produce PR_READY', async t => {
  const cwd = await repository(t, '42');
  const goalSpec = spec('Cover both answers; ac-2-fail', [
    { id: 'AC-1', text: 'answer.txt is 42' },
    { id: 'AC-2', text: 'the second behavior is covered' },
  ]);
  const todos = [{ id: 'TODO-1', goal: 'Both behaviors', depends_on: [], ac_ids: ['AC-1', 'AC-2'] }];
  const run = await createRun({ cwd, spec: goalSpec, todos, config: config({ maxReviewRepairCycles: 0 }), workerSessionId: 'ac-fail' });
  t.after(() => run.close());
  const result = await advanceRun(run);
  assert.equal(result.action, 'stop');
  assert.equal(run.state.todos.every(todo => todo.state === 'DONE'), true);
  assert.notEqual(run.state.status, 'PR_READY');
  assert.equal(run.state.status, 'ESCALATED');
  assert.equal(run.state.review.acceptance_results.find(result => result.id === 'AC-2').result, 'FAIL');
});

test('a PASS verdict with an unevidenced AC is treated as a malformed report', async t => {
  const cwd = await repository(t, '42');
  const goalSpec = spec('Cover both answers; pass-but-ac-fail', [
    { id: 'AC-1', text: 'answer.txt is 42' },
    { id: 'AC-2', text: 'the second behavior is covered' },
  ]);
  const todos = [{ id: 'TODO-1', goal: 'Both behaviors', depends_on: [], ac_ids: ['AC-1', 'AC-2'] }];
  const run = await createRun({ cwd, spec: goalSpec, todos, config: config(), workerSessionId: 'malformed-pass' });
  t.after(() => run.close());
  const result = await advanceRun(run);
  assert.equal(result.action, 'stop');
  assert.equal(run.state.status, 'BLOCKED');
  assert.match(run.state.reason, /PASS needs complete acceptance evidence/);
  assert.notEqual(run.state.status, 'PR_READY');
});

test('verifier findings create only an additive repair Todo and trigger a fresh review', async t => {
  const cwd = await repository(t, '42');
  const run = await createRun({ cwd, spec: oneSpec('Verify answer; verifier-repair-once'), config: config(), workerSessionId: 'repair-worker' });
  t.after(() => run.close());
  const first = await advanceRun(run);
  assert.equal(first.action, 'continue');
  assert.match(first.feedback, /TODO-R1/);
  assert.equal(run.state.todos[0].state, 'DONE');
  assert.equal(run.state.todos[1].kind, 'repair');
  assert.deepEqual(run.state.todos.slice(0, 1).map(todo => todo.id), ['TODO-1']);
  await writeFile(join(cwd, 'repair.txt'), 'fixed');
  const reviewed = await advanceRun(run);
  assert.equal(reviewed.action, 'ready');
  assert.equal(run.state.reviewAttempts, 2);
  assert.equal(run.state.reviewRepairsUsed, 1);
  assert.deepEqual(run.state.todos.map(todo => todo.state), ['DONE', 'DONE']);
  assert.ok(run.state.review.source_tree === run.state.finalCheckTree);
});

test('planning feedback respects maxPromptChars instead of truncating the confirmed goal', async t => {
  const cwd = await repository(t);
  const goal = 'G'.repeat(300);
  const goalSpec = spec(goal, [
    { id: 'AC-1', text: 'first criterion' },
    { id: 'AC-2', text: 'second criterion' },
  ]);
  const run = await createRun({ cwd, spec: goalSpec, config: config({ maxPromptChars: 200 }), workerSessionId: 'planning-budget' });
  t.after(() => run.close());
  const result = await advanceRun(run);
  assert.equal(result.action, 'stop');
  assert.equal(run.state.status, 'BLOCKED');
  assert.match(run.state.reason, /maxPromptChars/);
});

test('planning is bounded and falls back to an AC-complete deterministic Todo plan', async t => {
  const cwd = await repository(t, '42');
  const goalSpec = spec('Cover both answers', [
    { id: 'AC-1', text: 'answer.txt is 42' },
    { id: 'AC-2', text: 'coverage exists' },
  ]);
  const run = await createRun({ cwd, spec: goalSpec, config: config({ maxPlanRounds: 2 }), workerSessionId: 'planner' });
  t.after(() => run.close());
  assert.equal(run.state.status, 'PLANNING');
  assert.equal((await advanceRun(run)).action, 'continue');
  assert.equal((await advanceRun(run)).action, 'continue');
  const fallback = await advanceRun(run);
  assert.equal(fallback.action, 'continue');
  assert.match(fallback.feedback, /Planning rounds were exhausted/);
  assert.equal(run.state.todos.length, 2);
  assert.deepEqual(run.state.todos.map(todo => todo.ac_ids[0]), ['AC-1', 'AC-2']);
  assert.equal(run.state.planRounds, 3);
});

test('turn and check budgets are cumulative across Todos', async t => {
  const cwd = await repository(t, '42');
  await writeFile(join(cwd, 'cover.txt'), 'covered');
  git(cwd, 'add', 'cover.txt');
  git(cwd, 'commit', '-qm', 'cover baseline');
  const check = [process.execPath, '-e', 'const fs=require("fs");if(fs.readFileSync("cover.txt","utf8").trim()!=="covered")process.exit(1)'];
  const goalSpec = spec('Cover both files', [
    { id: 'AC-1', text: 'answer.txt is 42' },
    { id: 'AC-2', text: 'cover.txt is covered' },
  ]);
  const todos = [
    { id: 'TODO-1', goal: 'First', depends_on: [], ac_ids: ['AC-1'] },
    { id: 'TODO-2', goal: 'Second', depends_on: ['TODO-1'], ac_ids: ['AC-2'] },
  ];
  const run = await createRun({ cwd, spec: goalSpec, todos, config: config({ checks: [check], maxTurns: 3, maxCheckAttempts: 3 }), workerSessionId: 'budget-worker' });
  t.after(() => run.close());
  assert.equal((await advanceRun(run)).action, 'continue');
  assert.equal(run.state.todos[0].state, 'DONE');
  run.state.turnsUsed = 4;
  const result = await advanceRun(run);
  assert.equal(result.action, 'stop');
  assert.equal(run.state.status, 'ESCALATED');
  assert.match(run.state.reason, /turn budget/i);
  assert.equal(run.state.todos[1].state, 'IN_PROGRESS');
});

test('current-todo feedback is bounded instead of refeeding the full run history', async t => {
  const cwd = await repository(t);
  const check = [process.execPath, '-e', 'process.exit(1)'];
  const run = await createRun({ cwd, spec: oneSpec('Fix the task'), config: config({ checks: [check], maxPromptChars: 2000 }), workerSessionId: 'bounded' });
  t.after(() => run.close());
  for (let i = 0; i < 20; i++) run.state.decisions.push({ at: 'now', by: 'worker', text: 'x'.repeat(500), todo_id: null });
  const result = await advanceRun(run);
  assert.equal(result.action, 'continue');
  const context = result.feedback.slice(result.feedback.indexOf('{'));
  assert.ok(context.length <= 2000 + 100);
  assert.ok(!context.includes('x'.repeat(500)));
});

test('reviewer workspace identity accepts a symlinked spelling but rejects a different path', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'surgical-review-path-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const real = join(directory, 'real');
  await mkdir(real);
  await writeFile(join(real, 'answer.txt'), '42\n');
  const linked = join(directory, 'linked');
  await symlink(real, linked);
  const report = {
    verdict: 'PASS',
    acceptance_results: [{ id: 'AC-1', result: 'PASS', evidence_refs: ['answer.txt:1'] }],
    blocking_findings: [], non_blocking_suggestions: [], remaining_risks: [], blocked_reason: null,
  };
  const output = [
    JSON.stringify({ type: 'session', id: 'reviewer-session', cwd: real }),
    JSON.stringify({ type: 'tool_execution_end', toolName: 'read', isError: false }),
    JSON.stringify({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: JSON.stringify(report) }], stopReason: 'stop' } }),
  ].join('\n');
  const spec = confirmSpec(createDraftSpec({ goal: 'answer is 42', scope: ['answer'], non_goals: [], constraints: [], acceptance_criteria: [{ id: 'AC-1', text: 'answer is 42' }] }), 'x');
  assert.equal(parseReviewerOutput(output, 'reviewer-session', linked, spec).report.verdict, 'PASS');
  assert.throws(() => parseReviewerOutput(output, 'reviewer-session', join(directory, 'other'), spec), /workspace mismatch/);
});

test('reviewer evidence must resolve to real in-checkout path:line references', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'surgical-evidence-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'answer.txt'), '42\nsecond line\n');
  const spec = confirmSpec(createDraftSpec({ goal: 'answer is 42', scope: ['answer'], non_goals: [], constraints: [], acceptance_criteria: [{ id: 'AC-1', text: 'answer is 42' }] }), 'x');
  const outputFor = ref => [
    JSON.stringify({ type: 'session', id: 's', cwd: directory }),
    JSON.stringify({ type: 'tool_execution_end', toolName: 'read', isError: false }),
    JSON.stringify({ type: 'message_end', message: {
      role: 'assistant', stopReason: 'stop',
      content: [{ type: 'text', text: JSON.stringify({
        verdict: 'PASS', acceptance_results: [{ id: 'AC-1', result: 'PASS', evidence_refs: [ref] }],
        blocking_findings: [], non_blocking_suggestions: [], remaining_risks: [], blocked_reason: null,
      }) }],
    } }),
  ].join('\n');
  assert.equal(parseReviewerOutput(outputFor('answer.txt:2'), 's', directory, spec).report.verdict, 'PASS');
  for (const bad of ['answer.txt:3', '../outside.txt:1', '/etc/passwd:1', 'I read the source and it is fine', 'answer.txt:0', 'missing.txt:1', '.git/config:1']) {
    assert.throws(() => parseReviewerOutput(outputFor(bad), 's', directory, spec), /Evidence reference/);
  }
});

test('runtime API requires a confirmed specification and rejects a conflicting goal', async t => {
  const cwd = await repository(t);
  await assert.rejects(createRun({ cwd, config: config(), workerSessionId: 'no-spec' }), /confirmed Goal Specification/);
  const goalSpec = oneSpec('Original goal');
  await assert.rejects(createRun({ cwd, goal: 'Different goal', spec: goalSpec, config: config(), workerSessionId: 'conflict' }), /conflicts/);
});

test('plan adjustments preserve original Task identity and allow additive repair, pending reorder and dependency notes', async t => {
  const cwd = await repository(t);
  const goalSpec = spec('Three-part goal', [
    { id: 'AC-1', text: 'first' },
    { id: 'AC-2', text: 'second' },
    { id: 'AC-3', text: 'third' },
  ]);
  const todos = [
    { id: 'TODO-1', goal: 'First', depends_on: [], ac_ids: ['AC-1'] },
    { id: 'TODO-2', goal: 'Second', depends_on: ['TODO-1'], ac_ids: ['AC-2'] },
    { id: 'TODO-3', goal: 'Third', depends_on: [], ac_ids: ['AC-3'] },
  ];
  const run = await createRun({ cwd, spec: goalSpec, todos, config: config(), workerSessionId: 'adjust' });
  t.after(() => run.close());
  const original = structuredClone(run.state.todos.slice(0, 3));
  run.state.todos[0].state = 'DONE';
  adjustRunPlan(run, { operation: 'reorder', order: ['TODO-3', 'TODO-2'] });
  assert.deepEqual(run.state.todos.slice(0, 3).map(todo => todo.id), ['TODO-1', 'TODO-3', 'TODO-2']);
  adjustRunPlan(run, { operation: 'revise_dependencies', dependencies: [{ id: 'TODO-2', depends_on: [] }] });
  assert.deepEqual(run.state.todos.find(todo => todo.id === 'TODO-2').depends_on, []);
  const repair = adjustRunPlan(run, { operation: 'add_repair', todo: { id: 'TODO-R9', goal: 'Repair second', depends_on: ['TODO-2'], ac_ids: ['AC-2'] }, decision: 'Chose an additive repair without changing scope' });
  assert.equal(repair.todos.at(-1).kind, 'repair');
  const identity = todos => todos.map(todo => ({ id: todo.id, goal: todo.goal, ac_ids: todo.ac_ids })).sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(identity(repair.todos.slice(0, 3)), identity(original));
  assert.equal(repair.decisions.filter(decision => /additive repair/.test(decision.text)).length, 1);
  const decisionsBefore = run.state.decisions.length;
  adjustRunPlan(run, { operation: 'decision', decision: 'Keep the surgical scope', todo_id: 'TODO-1' });
  assert.equal(run.state.decisions.length, decisionsBefore + 1);
  assert.equal(run.state.decisions.filter(decision => decision.text === 'Keep the surgical scope').length, 1);
  assert.equal(run.state.decisions.at(-1).todo_id, 'TODO-1');
  const beforeInvalid = { todos: JSON.stringify(run.state.todos), plan: run.state.planRevision, decisions: JSON.stringify(run.state.decisions) };
  await assert.rejects((async () => adjustRunPlan(run, { operation: 'revise_dependencies', dependencies: [{ id: 'TODO-1', depends_on: [] }] }))(), /Only pending Todos/);
  await assert.rejects((async () => adjustRunPlan(run, { operation: 'revise_dependencies', dependencies: [{ id: 'TODO-3', depends_on: ['TODO-2'] }, { id: 'TODO-2', depends_on: ['TODO-3'] }] }))(), /cycle/i);
  assert.equal(JSON.stringify(run.state.todos), beforeInvalid.todos);
  assert.equal(run.state.planRevision, beforeInvalid.plan);
  assert.equal(JSON.stringify(run.state.decisions), beforeInvalid.decisions);
});

test('an accepted plan does not trigger a duplicate implementation prompt and reports rich check diagnostics', async t => {
  const cwd = await repository(t, '0');
  const goalSpec = spec('Plan then check', [
    { id: 'AC-1', text: 'answer is 42' },
    { id: 'AC-2', text: 'coverage exists' },
  ]);
  const run = await createRun({ cwd, spec: goalSpec, config: config({ checks: [[process.execPath, '-e', 'console.error("expected 42");process.exit(1)']] }), workerSessionId: 'plan-prompt' });
  t.after(() => run.close());
  planTodos(run, [
    { id: 'TODO-1', goal: 'First', depends_on: [], ac_ids: ['AC-1'] },
    { id: 'TODO-2', goal: 'Second', depends_on: ['TODO-1'], ac_ids: ['AC-2'] },
  ]);
  assert.equal(run.state.awaitingImplementation, false);
  const result = await advanceRun(run);
  assert.equal(result.action, 'continue');
  assert.equal(run.state.todos[0].state, 'IN_PROGRESS');
  assert.match(result.feedback, /expected 42/);
  assert.match(result.feedback, /process\.exit\(1\)/);
  assert.match(result.feedback, /"exit_code": 1/);
  assert.equal(run.state.usage.promptRounds, 1, 'No duplicate implementation prompt after plan acceptance');
});

test('reviewer usage is captured while unavailable Worker token totals stay UNKNOWN', async t => {
  const cwd = await repository(t, '42');
  const run = await createRun({ cwd, spec: oneSpec('Verify answer; reviewer-usage'), config: config(), workerSessionId: 'usage' });
  t.after(() => run.close());
  assert.equal((await advanceRun(run)).action, 'ready');
  assert.equal(run.state.usage.reviewer.input, 10);
  assert.equal(run.state.usage.reviewer.output, 5);
  assert.equal(run.state.usage.reviewer.total, 15);
  assert.equal(run.state.usage.reviewer.calls, 1);
  assert.equal(run.state.usage.tokens, 'UNKNOWN');
  assert.equal(run.state.usage.total_tokens, 'UNKNOWN');
});

test('expired deadline stops before spawning a check and without spending the attempt', async t => {
  const cwd = await repository(t);
  const marker = join(cwd, 'should-not-run');
  const run = await createRun({ cwd, spec: oneSpec('Never start late'), config: config({ checks: [[process.execPath, '-e', `require('fs').writeFileSync(${JSON.stringify(marker)}, 'ran')`]] }), workerSessionId: 'deadline' });
  t.after(() => run.close());
  run.state.deadlineAt = Date.now() - 1;
  const result = await advanceRun(run);
  assert.equal(result.action, 'stop');
  assert.equal(run.state.status, 'TIMED_OUT');
  assert.equal(run.state.checkAttempts, 0);
  await assert.rejects(readFile(marker, 'utf8'), /ENOENT/);
});

test('mixed reviewer usage exposes a subtotal but keeps the aggregate total UNKNOWN', async t => {
  const cwd = await repository(t, '42');
  const run = await createRun({ cwd, spec: oneSpec('Verify answer; reviewer-usage-mixed'), config: config(), workerSessionId: 'usage-mixed' });
  t.after(() => run.close());
  assert.equal((await advanceRun(run)).action, 'ready');
  assert.equal(run.state.usage.reviewer.input, 10);
  assert.equal(run.state.usage.reviewer.total, 15);
  assert.equal(run.state.usage.reviewer_usage_complete, false);
  assert.equal(run.state.usage.total_tokens, 'UNKNOWN');
});
