import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  checkFailureSignature, learningHint, learningPath, loadLearning,
  MAX_LEARNING_RECORDS, recordCheckFailure, recordReviewFindings,
} from '../adapters/pi/learning.mjs';

const git = (cwd, ...argv) => execFileSync('git', argv, { cwd, encoding: 'utf8' }).trim();
async function repo(t) {
  const cwd = await mkdtemp(join(tmpdir(), 'surgical-learning-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  git(cwd, 'init', '-q');
  git(cwd, 'config', 'user.email', 'test@example.invalid');
  git(cwd, 'config', 'user.name', 'Test');
  await writeFile(join(cwd, 'answer.txt'), '0');
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-qm', 'baseline');
  return cwd;
}
const check = (summary, command = ['node', 'test.js']) => ({
  id: 'check-1', command, exitCode: 1, timedOut: false, summary,
});

test('a failure is counted per occurrence and the advisory hint appears only from the second occurrence', async t => {
  const cwd = await repo(t);
  const [first] = await recordCheckFailure(cwd, { runId: 'run-a', check: check('pagination empty page failed') });
  assert.equal(first.count, 1);
  assert.equal(learningHint([first]), '');
  const [second] = await recordCheckFailure(cwd, { runId: 'run-b', check: check('pagination empty page failed') });
  assert.equal(second.count, 2);
  assert.equal(second.first_seen, first.first_seen);
  assert.equal(second.last_run_id, 'run-b');
  assert.match(learningHint([second]), /^\nLEARNING \(advisory, not a gate\): this failure has occurred 2 times in this repository: check node test\.js: pagination empty page failed\.$/);
  const [other] = await recordCheckFailure(cwd, { runId: 'run-b', check: check('build out of disk') });
  assert.equal(learningHint([other]), '');
  const state = await loadLearning(cwd);
  assert.equal(state.schema_version, 1);
  assert.equal(state.records.length, 2);
});

test('stored text is redacted and bounded, and the command is hashed into the signature', async t => {
  const cwd = await repo(t);
  const event = check('Bearer token123456789 and password=abcdef12345678901234\n' + 'x'.repeat(5000),
    ['node', 'test.js', '--api-key=mysecretvalue']);
  const [record] = await recordCheckFailure(cwd, { runId: 'a', check: event });
  const raw = await readFile(await learningPath(cwd), 'utf8');
  assert.doesNotMatch(raw, /token123456789|abcdef12345678901234|mysecretvalue|x{100}/);
  assert.ok(record.label.length <= 300);
  assert.ok(raw.length < 1000, String(raw.length));
  assert.equal(record.signature, checkFailureSignature(event.command, event.summary, 1, false).signature);
});

test('the store keeps at most 50 records and evicts the least recently seen one', async t => {
  const cwd = await repo(t);
  for (let i = 0; i < MAX_LEARNING_RECORDS; i++) {
    await recordCheckFailure(cwd, { runId: `run-${i}`, check: check(`failure number ${i}`) });
  }
  await recordCheckFailure(cwd, { runId: 'refresh', check: check('failure number 0') });
  await recordCheckFailure(cwd, { runId: 'extra-a', check: check('failure number 50') });
  await recordCheckFailure(cwd, { runId: 'extra-b', check: check('failure number 51') });
  const { records } = await loadLearning(cwd);
  assert.equal(records.length, MAX_LEARNING_RECORDS);
  assert.ok(records.some(record => record.label.endsWith(': failure number 0') && record.count === 2), 'refreshed record survives');
  assert.ok(!records.some(record => record.label.endsWith(': failure number 1')), 'least recently seen record is evicted');
  assert.ok(!records.some(record => record.label.endsWith(': failure number 2')));
});

test('an unsupported or unparsable learning store reads as empty and is replaced by the next write', async t => {
  const cwd = await repo(t);
  const path = await learningPath(cwd);
  await mkdir(dirname(path), { recursive: true });
  for (const old of [
    JSON.stringify({ schema_version: 0, records: [{ signature: 'x', label: 'old lesson', status: 'ACTIVE' }] }),
    '{not json',
  ]) {
    await writeFile(path, old);
    assert.deepEqual((await loadLearning(cwd)).records, []);
    const [record] = await recordCheckFailure(cwd, { runId: 'a', check: check('anything') });
    assert.equal(record.count, 1);
    const stored = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(stored.schema_version, 1);
    assert.equal(stored.records.length, 1);
  }
});

test('a store with some unrecognized records keeps the valid ones', async t => {
  const cwd = await repo(t);
  const path = await learningPath(cwd);
  const valid = { signature: 'abc', label: 'check npm test: failed', kind: 'check', count: 3, first_seen: null, last_seen: null, last_run_id: null };
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ schema_version: 1, revision: 4, records: [valid, { label: 'no signature' }] }));
  const state = await loadLearning(cwd);
  assert.deepEqual(state.records.map(record => record.signature), ['abc']);
  assert.equal(state.revision, 4);
});

test('review findings are counted by issue rather than by reviewer finding ID', async t => {
  const cwd = await repo(t);
  const finding = { id: 'R-1', location: 'src/pager.ts:44', impact: 'Wrong next-page computation', clearance_condition: 'Validate the final page cursor' };
  await recordReviewFindings(cwd, { runId: 'r1', findings: [finding] });
  const [again] = await recordReviewFindings(cwd, { runId: 'r2', findings: [{ ...finding, id: 'R-2', location: 'src/pager.ts:45' }] });
  assert.equal(again.count, 2);
  assert.equal((await loadLearning(cwd)).records.length, 1);
});
