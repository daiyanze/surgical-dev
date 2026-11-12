import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  addRepairTodo, buildWorkerContext, confirmSpec, createDraftSpec, INPUT_CONFIRMATION_SOURCE,
  parseRequirementDocument, planRevision, specPayloadDigest, validateConfirmedSpec,
  validatePlanTodos,
} from '../adapters/pi/spec.mjs';
import { loadRepositoryState, saveRepositoryState } from '../adapters/pi/persist.mjs';

async function repo(t) {
  const cwd = await mkdtemp(join(tmpdir(), 'surgical-spec-test-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd });
  execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd });
  await writeFile(join(cwd, 'README.md'), '# fixture\n');
  execFileSync('git', ['add', '.'], { cwd });
  execFileSync('git', ['commit', '-qm', 'baseline'], { cwd });
  return cwd;
}

const sample = (overrides = {}) => ({
  goal: 'Ship search pagination',
  scope: ['Paginate search results', 'Cover empty and final pages'],
  non_goals: ['Do not change the search API'],
  constraints: ['Keep existing project checks green'],
  acceptance_criteria: [
    { id: 'AC-1', text: 'Search results are paginated with page size configuration' },
    { id: 'AC-2', text: 'Empty and final pages have regression coverage' },
  ],
  ...overrides,
});

test('draft specification cannot become confirmed without an explicit user-command confirmation', () => {
  const draft = createDraftSpec(sample());
  assert.equal(draft.status, 'DRAFT');
  assert.equal(draft.confirmation, null);
  assert.throws(() => validateConfirmedSpec(draft), /confirmed by the user/i);
  const confirmed = confirmSpec(draft, 'host-session');
  assert.equal(confirmed.status, 'CONFIRMED');
  assert.equal(confirmed.confirmation.source, 'USER_COMMAND:/surgical confirm');
  assert.equal(confirmed.confirmation.session_id, 'host-session');
  assert.equal(confirmed.digest, specPayloadDigest(confirmed));
  assert.equal(confirmSpec({ ...confirmed, status: 'DRAFT' }, 'host-session').status, 'CONFIRMED');
});

test('input-phrase confirmation records truthful provenance distinct from a user command', () => {
  const confirmed = confirmSpec(createDraftSpec(sample()), 'host-session', { source: INPUT_CONFIRMATION_SOURCE });
  assert.equal(confirmed.confirmation.source, 'USER_INPUT:confirm-and-start');
  assert.equal(confirmed.confirmation.session_id, 'host-session');
  assert.doesNotMatch(confirmed.confirmation.source, /USER_COMMAND/);
  assert.equal(validateConfirmedSpec(confirmed).confirmation.source, 'USER_INPUT:confirm-and-start');
  assert.throws(() => confirmSpec(createDraftSpec(sample()), 'host-session', { source: 'USER_COMMAND:/forged' }), /Unknown confirmation source/);
});

test('tampered or partial confirmed specifications are rejected', () => {
  const confirmed = confirmSpec(createDraftSpec(sample()), 'host-session');
  assert.throws(() => validateConfirmedSpec({ ...confirmed, scope: [...confirmed.scope, 'secret scope'] }), /digest/i);
  assert.throws(() => validateConfirmedSpec({ ...confirmed, acceptance_criteria: [...confirmed.acceptance_criteria, { id: 'AC-3', text: 'later addition' }] }), /digest/i);
  assert.throws(() => validateConfirmedSpec({ ...confirmed, status: 'DRAFT' }), /confirmed by the user/i);
});

test('confirmation is persisted in git metadata, outside the audited source snapshot', async t => {
  const cwd = await repo(t);
  const confirmed = confirmSpec(createDraftSpec(sample()), 'persisted-session');
  await saveRepositoryState(cwd, { schema_version: 1, draft_spec: null, confirmed_spec: confirmed, run: null });
  const loaded = await loadRepositoryState(cwd);
  assert.deepEqual(loaded.confirmed_spec, confirmed);
  validateConfirmedSpec(loaded.confirmed_spec);
  const logged = execFileSync('git', ['ls-files'], { cwd, encoding: 'utf8' });
  assert.ok(!logged.includes('surgical-dev/state.json'));
});

test('state writes are atomic and change-only', async t => {
  const cwd = await repo(t);
  const state = { schema_version: 1, draft_spec: createDraftSpec(sample()), confirmed_spec: null, run: null };
  await saveRepositoryState(cwd, state);
  const first = await stat(join(cwd, '.git', 'surgical-dev', 'state.json'));
  await new Promise(resolve => setTimeout(resolve, 20));
  await saveRepositoryState(cwd, state);
  const second = await stat(join(cwd, '.git', 'surgical-dev', 'state.json'));
  assert.equal(first.mtimeMs, second.mtimeMs, 'Unchanged state must not be rewritten');
  const text = await readFile(join(cwd, '.git', 'surgical-dev', 'state.json'), 'utf8');
  assert.equal(JSON.parse(text).schema_version, 1);
  assert.equal(JSON.parse(text).revision, 1);
});

test('complete requirement documents import without a discussion turn', () => {
  const draft = parseRequirementDocument(`# Goal\nAdd team invitations\n\n## Scope\n- Send invitations\n- Accept invitations\n\n## Non-goals\n- Billing\n\n## Constraints\n- Keep the existing auth API\n\n## Acceptance Criteria\n- AC-1: An invited user can accept before expiry\n- AC-2: Expired invitations are rejected\n`, 'docs/requirements.md');
  assert.equal(draft.status, 'DRAFT');
  assert.equal(draft.source.kind, 'imported-document');
  assert.equal(draft.source.ref, 'docs/requirements.md');
  assert.equal(draft.acceptance_criteria.length, 2);
  assert.deepEqual(draft.acceptance_criteria.map(ac => ac.id), ['AC-1', 'AC-2']);
  assert.deepEqual(draft.non_goals, ['Billing']);
});

test('todo plan validates dependencies and complete AC coverage', () => {
  const spec = confirmSpec(createDraftSpec(sample()), 'session');
  const todos = validatePlanTodos([
    { id: 'TODO-1', goal: 'Implement pagination', depends_on: [], ac_ids: ['AC-1'] },
    { id: 'TODO-2', goal: 'Cover edge pages', depends_on: ['TODO-1'], ac_ids: ['AC-2'] },
  ], spec);
  assert.deepEqual(todos.map(todo => todo.state), ['PENDING', 'PENDING']);
  assert.ok(planRevision(todos).length > 10);
  assert.throws(() => validatePlanTodos([
    { id: 'TODO-1', goal: 'Only implementation', depends_on: [], ac_ids: ['AC-1'] },
  ], spec), /does not cover/i);
  assert.throws(() => validatePlanTodos([
    { id: 'TODO-1', goal: 'A', depends_on: ['TODO-2'], ac_ids: ['AC-1'] },
    { id: 'TODO-2', goal: 'B', depends_on: ['TODO-1'], ac_ids: ['AC-2'] },
  ], spec), /cycle/i);
  assert.throws(() => validatePlanTodos([
    { id: 'TODO-1', goal: 'A', depends_on: [], ac_ids: ['AC-99'] },
    { id: 'TODO-2', goal: 'B', depends_on: ['TODO-1'], ac_ids: ['AC-2'] },
  ], spec), /unknown acceptance criterion/i);
});

test('repair tasks are additive and preserve every original todo and AC', () => {
  const spec = confirmSpec(createDraftSpec(sample()), 'session');
  const todos = validatePlanTodos([
    { id: 'TODO-1', goal: 'Implement pagination', depends_on: [], ac_ids: ['AC-1'] },
    { id: 'TODO-2', goal: 'Cover edge pages', depends_on: ['TODO-1'], ac_ids: ['AC-2'] },
  ], spec);
  const state = { spec, todos, planRevision: planRevision(todos) };
  const repair = addRepairTodo(state, [{ id: 'AC-2', result: 'FAIL', evidence_refs: ['search.test.js:10'] }], 1);
  assert.equal(repair.id, 'TODO-R1');
  assert.equal(repair.kind, 'repair');
  assert.deepEqual(repair.ac_ids, ['AC-2']);
  assert.deepEqual(state.todos.slice(0, 2).map(todo => todo.id), ['TODO-1', 'TODO-2']);
  assert.deepEqual(state.spec.acceptance_criteria, spec.acceptance_criteria);
});

test('current-Todo context stays valid JSON and preserves mandatory constraints under large optional history', () => {
  const longGoal = `Keep the answer correct ${'goal detail '.repeat(120)}`;
  const spec = confirmSpec(createDraftSpec({
    goal: longGoal,
    scope: ['Only answer.txt', `Scope item ${'x'.repeat(400)}`],
    non_goals: ['Do not change the API'],
    constraints: [`Keep checks green ${'y'.repeat(500)}`],
    acceptance_criteria: [
      { id: 'AC-1', text: `answer.txt is 42 ${'a'.repeat(300)}` },
      { id: 'AC-2', text: 'cover.txt is covered' },
    ],
  }), 'session');
  const todos = validatePlanTodos([
    { id: 'TODO-1', goal: 'Implement answer', depends_on: [], ac_ids: ['AC-1'] },
    { id: 'TODO-2', goal: 'Implement cover', depends_on: ['TODO-1'], ac_ids: ['AC-2'] },
  ], spec);
  const state = {
    spec, todos, turnsUsed: 5, checkAttempts: 2, reviewRepairsUsed: 1,
    config: { maxTurns: 40, maxCheckAttempts: 6, maxReviewRepairCycles: 2 },
    decisions: Array.from({ length: 20 }, (_, i) => ({ text: `decision ${i}`, at: 'now', by: 'worker' })),
    recentFailures: Array.from({ length: 20 }, (_, i) => ({ todo_id: 'TODO-1', kind: 'check', summary: 'failure '.repeat(1000) })),
  };
  const context = buildWorkerContext(state, todos[1], 8000);
  assert.ok(context.length <= 8000);
  const parsed = JSON.parse(context);
  assert.equal(parsed.current_todo.id, 'TODO-2');
  assert.deepEqual(parsed.current_todo.depends_on, ['TODO-1']);
  assert.deepEqual(parsed.current_todo.ac_ids, ['AC-2']);
  assert.deepEqual(parsed.constraints, spec.constraints);
  assert.deepEqual(parsed.current_acceptance_criteria.map(ac => ac.id), ['AC-2']);
  assert.deepEqual(parsed.scope, spec.scope);
  assert.deepEqual(parsed.non_goals, spec.non_goals);
  assert.ok(!('recent_decisions' in parsed) || parsed.recent_decisions.every(item => !item.text.startsWith('decision 0')));
});

test('mandatory current-Todo context over budget blocks instead of truncating frozen scope', () => {
  const spec = confirmSpec(createDraftSpec({
    goal: 'G', scope: ['S'], non_goals: [], constraints: [`C ${'z'.repeat(2000)}`],
    acceptance_criteria: [{ id: 'AC-1', text: `A ${'a'.repeat(2000)}` }],
  }), 'session');
  const todos = validatePlanTodos([{ id: 'TODO-1', goal: 'Do it', depends_on: [], ac_ids: ['AC-1'] }], spec);
  assert.throws(() => buildWorkerContext({
    spec, todos, turnsUsed: 1, checkAttempts: 0, reviewRepairsUsed: 0,
    config: { maxTurns: 40, maxCheckAttempts: 6, maxReviewRepairCycles: 2 }, decisions: [], recentFailures: [],
  }, todos[0], 1000), /cannot be truncated|over the 1000-char/);
});

test('simultaneous state writers allow exactly one winner and preserve its state', async t => {
  const cwd = await repo(t);
  const base = await loadRepositoryState(cwd);
  const drafts = ['writer one', 'writer two'].map(goal => createDraftSpec(sample({ goal })));
  const results = await Promise.allSettled(drafts.map(draft =>
    saveRepositoryState(cwd, { ...base, draft_spec: draft }, { expectedRevision: base.revision })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  const winner = results.find(result => result.status === 'fulfilled').value;
  const loaded = await loadRepositoryState(cwd);
  assert.equal(loaded.revision, 1);
  assert.equal(loaded.draft_spec.goal, winner.draft_spec.goal);
});

test('per-Todo context omits unrelated ACs and always prioritizes the current failure near budget', () => {
  const acs = Array.from({ length: 30 }, (_, i) => ({ id: `AC-${i + 1}`, text: `Criterion ${i + 1} ${'detail '.repeat(20)}` }));
  const spec = confirmSpec(createDraftSpec({
    goal: 'Many criteria', scope: ['Only current criterion'], non_goals: ['No API change'],
    constraints: ['Keep checks green'], acceptance_criteria: acs,
  }), 'session');
  const todos = validatePlanTodos(acs.map((ac, i) => ({
    id: `TODO-${i + 1}`, goal: `Implement ${ac.id}`, depends_on: i ? [`TODO-${i}`] : [], ac_ids: [ac.id],
  })), spec);
  const state = {
    spec, todos, turnsUsed: 3, checkAttempts: 1, reviewRepairsUsed: 0,
    config: { maxTurns: 40, maxCheckAttempts: 6, maxReviewRepairCycles: 2 },
    decisions: Array.from({ length: 30 }, (_, i) => ({ text: `decision ${i}`, at: 'now', by: 'worker' })),
    recentFailures: [
      { todo_id: 'TODO-3', kind: 'check', command: ['npm', 'test'], exit_code: 1, check_id: 'check-current', summary: `current diagnostic ${'x'.repeat(5000)}`, summary_truncated: false },
      ...Array.from({ length: 5 }, (_, i) => ({ todo_id: 'TODO-2', kind: 'check', summary: 'old '.repeat(1000), at: 'now' })),
    ],
  };
  const context = buildWorkerContext(state, todos[2], 5000);
  assert.ok(context.length <= 5000);
  const parsed = JSON.parse(context);
  assert.deepEqual(parsed.current_acceptance_criteria.map(ac => ac.id), ['AC-3']);
  assert.ok(!context.includes('AC-1'));
  assert.ok(!('todo_progress' in parsed) || parsed.todo_progress.every(item => item.id !== 'AC-1'));
  assert.equal(parsed.current_failure.command.join(' '), 'npm test');
  assert.equal(parsed.current_failure.exit_code, 1);
  assert.match(parsed.current_failure.summary, /current diagnostic/);
  assert.equal(parsed.current_failure.summary_truncated, true);
  assert.equal(parsed.current_failure.full_ref, 'check-current');
  assert.ok(!('recent_decisions' in parsed) || parsed.recent_decisions.every(item => !item.text.startsWith('decision 0')));
});
