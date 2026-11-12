import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  checkFailureSignature, learningPath, loadLearning, loadRelevantLessons,
  proposeLesson, promoteLessonsForRun, recordCheckFailure, recordReviewFindings,
  selectRelevantLessons,
} from '../adapters/pi/learning.mjs';
import { advanceRun, createRun, validateConfig } from '../adapters/pi/loop.mjs';
import { confirmSpec, createDraftSpec } from '../adapters/pi/spec.mjs';

const reviewer = new URL('./fixtures/pi-reviewer.mjs', import.meta.url).pathname;
const git = (cwd, ...argv) => execFileSync('git', argv, { cwd, encoding: 'utf8' }).trim();
async function repo(t, answer = '0') {
  const cwd = await mkdtemp(join(tmpdir(), 'surgical-learning-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  git(cwd, 'init', '-q');
  git(cwd, 'config', 'user.email', 'test@example.invalid');
  git(cwd, 'config', 'user.name', 'Test');
  await writeFile(join(cwd, 'answer.txt'), answer);
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-qm', 'baseline');
  return cwd;
}
const check = (summary, command = ['node', 'test.js']) => ({
  id: 'check-1', command, exitCode: 1, timedOut: false, summary,
});
const lesson = (recordId, runId, extra = {}) => ({
  recordId, runId, rootCause: 'Missing validation of empty pages',
  preventativeRule: 'Cover empty pages in a regression test before changing pagination',
  scope: 'search pagination', tags: ['search', 'pagination'],
  validation: 'Run the empty page regression test', ...extra,
});
const spec = goal => confirmSpec(createDraftSpec({
  goal, scope: [goal], non_goals: [], constraints: [],
  acceptance_criteria: [{ id: 'AC-1', text: goal }],
}), 'worker-session');

test('first failure is only an observation; two matching failures across runs are a learning opportunity', async t => {
  const cwd = await repo(t);
  const event = check('pagination empty page failed, expected []');
  const first = await recordCheckFailure(cwd, { runId: 'run-a', todoId: 'TODO-1', check: event, goal: 'search pagination', scope: ['search'] });
  assert.equal(first.record.status, 'OBSERVED');
  assert.equal(first.hint, null);
  const second = await recordCheckFailure(cwd, { runId: 'run-b', todoId: 'TODO-2', check: { ...event, id: 'check-2' }, goal: 'search pagination', scope: ['search'] });
  assert.equal(second.record.status, 'RECURRING');
  assert.equal(second.record.occurrence_count, 2);
  assert.equal(second.record.run_ids.length, 2);
  assert.match(second.hint.instruction, /surgical_lesson/);
  const unrelated = await recordCheckFailure(cwd, { runId: 'run-b', check: check('build out of disk'), goal: 'search pagination' });
  assert.equal(unrelated.record.status, 'OBSERVED');
  assert.equal((await loadLearning(cwd)).records.length, 2);
});

test('proposals require evidenced recurrence from the current run; unaccepted candidates are never injected', async t => {
  const cwd = await repo(t);
  const observed = await recordCheckFailure(cwd, { runId: 'one', check: check('pagination empty page failed'), goal: 'search pagination' });
  await assert.rejects(() => proposeLesson(cwd, lesson(observed.record.id, 'one')), /at least two/);
  await recordCheckFailure(cwd, { runId: 'two', check: check('pagination empty page failed'), goal: 'search pagination' });
  await assert.rejects(() => proposeLesson(cwd, lesson(observed.record.id, 'other')), /current run/);
  await assert.rejects(() => proposeLesson(cwd, lesson(observed.record.id, 'two', { validation: ' ' })), /validation/);
  const candidate = await proposeLesson(cwd, lesson(observed.record.id, 'two'));
  assert.equal(candidate.status, 'CANDIDATE');
  assert.deepEqual((await loadRelevantLessons(cwd, { goal: 'search pagination' })).lessons, []);
  assert.deepEqual(await promoteLessonsForRun(cwd, 'other'), []);
  assert.equal((await loadLearning(cwd)).records[0].status, 'CANDIDATE');
});

test('accepted lessons persist locally outside the working tree and are injected only when relevant', async t => {
  const cwd = await repo(t);
  const evt = check('pagination empty page failed');
  await recordCheckFailure(cwd, { runId: 'one', check: evt, goal: 'search pagination' });
  const repeated = await recordCheckFailure(cwd, { runId: 'two', check: evt, goal: 'search pagination' });
  await proposeLesson(cwd, lesson(repeated.record.id, 'two'));
  assert.deepEqual(await promoteLessonsForRun(cwd, 'two'), [repeated.record.id]);
  const path = await learningPath(cwd);
  assert.ok(path.startsWith(resolve(cwd, '.git') + '/'));
  assert.equal(git(cwd, 'status', '--porcelain'), '');
  const json = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(json.records[0].status, 'ACTIVE');
  const selected = await loadRelevantLessons(cwd, { goal: 'Fix search pagination empty pages', scope: [] });
  assert.equal(selected.lessons.length, 1);
  assert.match(selected.text, /lower-trust/);
  assert.match(selected.text, /Cover empty pages/);
  assert.deepEqual((await loadRelevantLessons(cwd, { goal: 'optimize authentication cookies' })).lessons, []);
  assert.equal(selectRelevantLessons((await loadLearning(cwd)).records, { goal: '' }).lessons.length, 0);
});

test('relevance matching recognizes Chinese and Japanese terms without word boundaries', async t => {
  const cwd = await repo(t);
  const evt = check('分页在空页面失败');
  await recordCheckFailure(cwd, { runId: 'one', check: evt, goal: '搜索分页功能' });
  const repeated = await recordCheckFailure(cwd, { runId: 'two', check: evt, goal: '搜索分页功能' });
  await proposeLesson(cwd, lesson(repeated.record.id, 'two', {
    scope: '搜索分页', tags: ['分页', '搜索'],
    preventativeRule: '为搜索分页补充空页面回归测试',
  }));
  await promoteLessonsForRun(cwd, 'two');
  assert.equal((await loadRelevantLessons(cwd, { goal: '完善搜索分页结果在空页面时的行为' })).lessons.length, 1);
  assert.deepEqual((await loadRelevantLessons(cwd, { goal: '修复用户认证令牌刷新' })).lessons, []);
});

test('recurrence despite an active lesson marks it NEEDS_REVISION and requires fresh acceptance', async t => {
  const cwd = await repo(t);
  const evt = check('pagination empty page failed');
  await recordCheckFailure(cwd, { runId: 'run1', check: evt });
  const repeated = await recordCheckFailure(cwd, { runId: 'run2', check: evt });
  await proposeLesson(cwd, lesson(repeated.record.id, 'run2'));
  await promoteLessonsForRun(cwd, 'run2');
  const again = await recordCheckFailure(cwd, { runId: 'run3', check: evt });
  assert.equal(again.record.status, 'NEEDS_REVISION');
  assert.match(again.hint.instruction, /revised grounded lesson/);
  assert.deepEqual((await loadRelevantLessons(cwd, { goal: 'search pagination' })).lessons, []);
  const revised = await proposeLesson(cwd, lesson(repeated.record.id, 'run3', { preventativeRule: 'Use a stronger pagination regression check' }));
  assert.equal(revised.status, 'CANDIDATE');
  assert.deepEqual(await promoteLessonsForRun(cwd, 'run2'), []);
  await promoteLessonsForRun(cwd, 'run3');
  assert.equal((await loadLearning(cwd)).records[0].status, 'ACTIVE');
});

test('independent review findings are deduplicated by issue rather than review attempt ID', async t => {
  const cwd = await repo(t);
  const finding = { id: 'R-1', location: 'src/pager.ts:44', impact: 'Wrong next-page computation', clearance_condition: 'Validate the final page cursor' };
  const [first] = await recordReviewFindings(cwd, { runId: 'r1', findings: [finding], goal: 'search pagination' });
  const [second] = await recordReviewFindings(cwd, { runId: 'r2', findings: [{ ...finding, id: 'R-2', location: 'src/pager.ts:45' }], goal: 'search pagination' });
  assert.equal(first.record.status, 'OBSERVED');
  assert.equal(second.record.status, 'RECURRING');
  assert.equal((await loadLearning(cwd)).records.length, 1);
});

test('bounded selection limits volume and retains no untrusted partial fragments', async t => {
  const cwd = await repo(t);
  for (let i = 0; i < 6; i++) {
    const evt = check('pagination issue ' + i);
    await recordCheckFailure(cwd, { runId: 'a', check: evt, goal: 'search pagination' });
    const repeated = await recordCheckFailure(cwd, { runId: 'b', check: evt, goal: 'search pagination' });
    await proposeLesson(cwd, lesson(repeated.record.id, 'b', { rootCause: 'Pagination bug number ' + i, tags: ['search', 'pagination'] }));
  }
  await promoteLessonsForRun(cwd, 'b');
  const result = await loadRelevantLessons(cwd, { goal: 'search pagination' });
  assert.ok(result.lessons.length > 0 && result.lessons.length <= 3);
  assert.ok(result.text.length <= 1200, String(result.text.length));
  assert.deepEqual((await loadRelevantLessons(cwd, { goal: 'search pagination' }, { maxChars: 80 })).lessons, []);
});

test('stored check summaries are bounded, redacted and command is hashed', async t => {
  const cwd = await repo(t);
  const event = check('Bearer token123456789 and password=abcdef12345678901234\n' + 'x'.repeat(5000),
    ['node', 'test.js', '--api-key=mysecretvalue']);
  const result = await recordCheckFailure(cwd, { runId: 'a', check: event });
  const raw = await readFile(await learningPath(cwd), 'utf8');
  assert.doesNotMatch(raw, /token123456789|abcdef12345678901234|mysecretvalue|xxxxx{100}/);
  assert.ok(raw.length < 3000);
  assert.equal(result.record.signature, checkFailureSignature(event.command, event.summary, 1, false).signature);
});

test('normal run acceptance promotes a candidate only after the final project checks and independent PASS', async t => {
  const cwd = await repo(t);
  const rule = [process.execPath, '-e', 'if(require("fs").readFileSync("answer.txt","utf8").trim()!=="42"){ console.error("expected 42"); process.exit(1) }'];
  const config = validateConfig({ checks: [rule], reviewerCommand: [process.execPath, reviewer] });
  const run = await createRun({ cwd, spec: spec('Put 42 in answer.txt'), config, workerSessionId: 'worker' });
  t.after(() => run.close());
  assert.equal((await advanceRun(run)).action, 'continue');
  const second = await advanceRun(run);
  assert.equal(second.action, 'continue');
  const state = await loadLearning(cwd);
  assert.equal(state.records[0].occurrence_count, 2);
  await proposeLesson(cwd, lesson(state.records[0].id, run.state.id, {
    rootCause: 'answer remained 0', preventativeRule: 'Test expected 42',
    scope: 'answer.txt', tags: ['answer'],
    validation: 'Run repository check',
  }));
  assert.equal((await loadLearning(cwd)).records[0].status, 'CANDIDATE');
  await writeFile(join(cwd, 'answer.txt'), '42');
  assert.equal((await advanceRun(run)).action, 'ready');
  assert.equal((await loadLearning(cwd)).records[0].status, 'CANDIDATE', 'review-ready is not final acceptance');
  await run.finish();
  assert.equal(run.state.status, 'PR_READY');
  assert.equal((await loadLearning(cwd)).records[0].status, 'CANDIDATE', 'in-memory readiness must not prematurely activate a lesson');
  assert.deepEqual(await promoteLessonsForRun(cwd, run.state.id), [state.records[0].id]);
  assert.equal((await loadLearning(cwd)).records[0].status, 'ACTIVE');
});
