import test from 'node:test';
import assert from 'node:assert/strict';
import { isExplicitConfirmation } from '../adapters/pi/confirmation.mjs';
import { formatRunStatus, formatSpec } from '../adapters/pi/status.mjs';
import { createRepositoryStore } from '../adapters/pi/repository-store.mjs';

const draft = {
  status: 'DRAFT', goal_id: 'G1', revision: 2, digest: 'abcdef1234567890', goal: 'Ship it',
  scope: ['answer.txt'], non_goals: [], constraints: ['keep checks green'],
  acceptance_criteria: [{ id: 'AC-1', text: 'answer is 42' }],
};

test('confirmation accepts only the exact benign phrase and rejects questions, negation, quotes and extras', () => {
  for (const text of ['确认，开始', '  确认开始。', 'confirm and start', 'Confirm and Start!']) assert.equal(isExplicitConfirmation(text), true, text);
  for (const text of ['确认', 'yes', 'confirm and start?', 'confirm and start, but wait', '`confirm and start`', '不确认，开始', '', null]) {
    assert.equal(isExplicitConfirmation(text), false, String(text));
  }
});

test('formatSpec renders the frozen fields with a DRAFT consent line only while unconfirmed', () => {
  const text = formatSpec(draft);
  assert.match(text, /^DRAFT Goal Specification G1 revision 2 \(abcdef123456\)\nGoal: Ship it\n/);
  assert.match(text, /Non-goals:\n {2}- \(none\)\n/);
  assert.match(text, /Constraints:\n {2}- keep checks green\n/);
  assert.match(text, /Acceptance criteria:\n {2}AC-1: answer is 42/);
  assert.match(text, /DRAFT: no implementation is allowed/);
  assert.doesNotMatch(formatSpec({ ...draft, status: 'CONFIRMED' }), /DRAFT: no implementation/);
});

test('formatRunStatus reports absence and omits unknown learning warnings when none exist', () => {
  assert.deepEqual(formatRunStatus(null), ['No Surgical Dev run in this session.']);
  const lines = formatRunStatus({
    status: 'BLOCKED', reason: 'stopped', goal: 'g', todos: [{ state: 'DONE' }, { state: 'PENDING' }],
    activeTodoId: 'TODO-2', turnsUsed: 1, config: { maxTurns: 40, maxCheckAttempts: 6, maxReviewRepairCycles: 2 },
    checkAttempts: 0, reviewAttempts: 0, reviewRepairsUsed: 0, usage: { tokens: 'UNKNOWN' },
  });
  assert.equal(lines[2], 'Todos: 1/2 done; current TODO-2');
  assert.ok(lines.every(line => !/Learning store warnings/.test(line)));
});

test('repository store runs queued writes in order and keeps the persisted revision monotonic', async () => {
  let stored = { schema_version: 1, revision: 0, draft_spec: null, confirmed_spec: null, run: null };
  const order = [];
  const store = createRepositoryStore({
    load: async () => structuredClone(stored),
    save: async (_cwd, state, { expectedRevision }) => {
      await new Promise(resolve => setTimeout(resolve, 5));
      if (expectedRevision !== stored.revision) throw new Error('changed by another session');
      stored = { ...state, revision: stored.revision + 1 };
      order.push(stored.draft_spec?.goal);
      return stored;
    },
  });
  await store.ensure('/repo');
  const writes = ['a', 'b', 'c'].map(goal => store.mutate('/repo', state => { state.draft_spec = { goal }; return state; }));
  await Promise.all(writes);
  assert.deepEqual(order, ['a', 'b', 'c']);
  assert.equal(stored.revision, 3);
  assert.equal(await store.flush(), null);
});

test('a failed save rejects the mutation, rolls back, blocks flush until a later success', async () => {
  let stored = { schema_version: 1, revision: 0, draft_spec: null, run: null };
  let fail = true;
  const store = createRepositoryStore({
    load: async () => structuredClone(stored),
    save: async (_cwd, state) => {
      if (fail) throw new Error('disk full');
      stored = { ...state, revision: stored.revision + 1 };
      return stored;
    },
  });
  await store.ensure('/repo');
  await assert.rejects(store.mutate('/repo', state => { state.draft_spec = { goal: 'lost' }; return state; }), /disk full/);
  assert.equal(stored.draft_spec, null, 'the rejected write must not reach storage');
  assert.equal((await store.flush()).message, 'disk full');
  await store.scheduleRun('/repo', { id: 'run-1' });
  assert.equal((await store.flush()).message, 'disk full');
  fail = false;
  await store.mutate('/repo', state => { state.draft_spec = { goal: 'kept' }; return state; });
  assert.equal(await store.flush(), null);
  assert.equal(stored.draft_spec.goal, 'kept');
});
