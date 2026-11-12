import { createHash, randomUUID } from 'node:crypto';

export const AC_ID = /^AC-[1-9][0-9]*$/;
export const COMMAND_CONFIRMATION_SOURCE = 'USER_COMMAND:/surgical confirm';
export const INPUT_CONFIRMATION_SOURCE = 'USER_INPUT:confirm-and-start';
export const CONFIRMATION_SOURCES = new Set([COMMAND_CONFIRMATION_SOURCE, INPUT_CONFIRMATION_SOURCE]);
export const TODO_ID = /^TODO-[A-Za-z0-9][A-Za-z0-9-]*$/;
export const nonempty = value => typeof value === 'string' && value.trim().length > 0;
export const strings = value => Array.isArray(value) && value.every(nonempty);
export const uniqueStrings = value => strings(value) && new Set(value).size === value.length;
export const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
export const digest = value => createHash('sha256').update(value).digest('hex');
const canonical = value => JSON.stringify(value);
const trimmed = value => value.trim();

export function specPayloadDigest(spec) {
  return digest(canonical({
    goal: spec.goal,
    scope: spec.scope,
    non_goals: spec.non_goals,
    constraints: spec.constraints,
    acceptance_criteria: spec.acceptance_criteria,
  }));
}

function normalizeAcceptanceCriteria(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Goal Specification needs at least one acceptance criterion');
  const ids = new Set();
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Acceptance criteria must be objects');
    if (!AC_ID.test(item.id ?? '') || !nonempty(item.text)) throw new Error('Acceptance criteria need AC-N ids and nonempty text');
    if (ids.has(item.id)) throw new Error(`Duplicate acceptance criterion: ${item.id}`);
    ids.add(item.id);
    return { id: item.id, text: trimmed(item.text) };
  });
}

export function normalizeSpecInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Goal Specification must be an object');
  if (!nonempty(value.goal)) throw new Error('Goal Specification needs a goal');
  if (!uniqueStrings(value.scope) || value.scope.length === 0) throw new Error('Goal Specification needs a nonempty unique scope');
  if (!uniqueStrings(value.non_goals ?? [])) throw new Error('non_goals must be unique strings');
  if (!uniqueStrings(value.constraints ?? [])) throw new Error('constraints must be unique strings');
  return {
    goal: trimmed(value.goal),
    scope: value.scope.map(trimmed),
    non_goals: (value.non_goals ?? []).map(trimmed),
    constraints: (value.constraints ?? []).map(trimmed),
    acceptance_criteria: normalizeAcceptanceCriteria(value.acceptance_criteria),
  };
}

export function createDraftSpec(value, { source = 'discussion', sourceRef = null } = {}) {
  const input = normalizeSpecInput(value);
  const spec = {
    schema_version: 1,
    goal_id: randomUUID(),
    revision: 1,
    ...input,
    status: 'DRAFT',
    source: { kind: source, ref: sourceRef === null ? null : String(sourceRef) },
    created_at: new Date().toISOString(),
    confirmed_at: null,
    confirmation: null,
    digest: null,
  };
  spec.digest = specPayloadDigest(spec);
  return spec;
}

export function confirmSpec(draft, sessionId, { source = COMMAND_CONFIRMATION_SOURCE } = {}) {
  if (!draft || draft.status !== 'DRAFT') throw new Error('Only a draft Goal Specification can be confirmed');
  if (!nonempty(sessionId)) throw new Error('A host session is required to record confirmation');
  if (!CONFIRMATION_SOURCES.has(source)) throw new Error(`Unknown confirmation source: ${source}`);
  const payload = normalizeSpecInput(draft);
  const confirmed = {
    ...draft,
    ...payload,
    revision: Number.isSafeInteger(draft.revision) ? draft.revision : 1,
    status: 'CONFIRMED',
    confirmed_at: new Date().toISOString(),
    confirmation: {
      source,
      session_id: sessionId,
      confirmed_at: new Date().toISOString(),
      spec_digest: specPayloadDigest({ ...draft, ...payload }),
    },
  };
  confirmed.digest = specPayloadDigest(confirmed);
  return confirmed;
}

export function validateConfirmedSpec(spec) {
  const payload = normalizeSpecInput(spec);
  if (spec.status !== 'CONFIRMED' || !spec.confirmation || !CONFIRMATION_SOURCES.has(spec.confirmation.source)) {
    throw new Error('Implementation requires a Goal Specification confirmed by the user');
  }
  if (!nonempty(spec.confirmation.session_id) || !nonempty(spec.confirmation.confirmed_at)) throw new Error('Confirmed Goal Specification is missing its confirmation record');
  const expected = specPayloadDigest({ ...spec, ...payload });
  if (spec.digest !== expected || spec.confirmation.spec_digest !== expected) throw new Error('Confirmed Goal Specification digest does not match its frozen content');
  return { ...spec, ...payload, digest: expected };
}

function sectionName(heading) {
  return heading.trim().toLowerCase().replace(/[:.]$/, '');
}

function markdownSections(text) {
  const sections = new Map();
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*$/);
    if (heading) {
      current = sectionName(heading[1]);
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (current) sections.get(current).push(line);
  }
  return sections;
}

function values(lines = []) {
  const output = [];
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) output.push(paragraph.join(' ').trim());
    paragraph = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const bullet = line.match(/^(?:[-*+]|\d+[.)])\s+(.+)$/);
    if (bullet) { flush(); output.push(bullet[1].trim()); }
    else paragraph.push(line);
  }
  flush();
  return output.filter(nonempty);
}

function section(sections, names) {
  for (const [name, lines] of sections) if (names.includes(name)) return lines;
  return undefined;
}

export function parseRequirementDocument(text, sourceRef = null) {
  if (!nonempty(text)) throw new Error('Requirement document is empty');
  const trimmedText = text.trim();
  if (trimmedText.startsWith('{')) {
    let value;
    try { value = JSON.parse(trimmedText); } catch (error) { throw new Error(`Invalid Goal Specification JSON: ${error.message}`); }
    return createDraftSpec(value, { source: 'imported-document', sourceRef });
  }
  const sections = markdownSections(text);
  const goalLines = section(sections, ['goal', 'objective', 'summary']);
  const scopeLines = section(sections, ['scope', 'in scope', 'in-scope']);
  const nonGoalLines = section(sections, ['non-goals', 'non goals', 'out of scope', 'exclusions', 'non-goal']);
  const constraintLines = section(sections, ['constraints', 'constraint', 'requirements']);
  const acLines = section(sections, ['acceptance criteria', 'acceptance', 'success criteria', 'acceptance criterion']);
  if (!goalLines || !values(goalLines).length) throw new Error('Imported requirement needs a Goal section');
  if (!scopeLines || !values(scopeLines).length) throw new Error('Imported requirement needs a Scope section');
  if (!acLines || !values(acLines).length) throw new Error('Imported requirement needs an Acceptance Criteria section');
  const acs = values(acLines).map((line, index) => {
    const match = line.match(/^(AC-[1-9][0-9]*)\s*[:.)-]\s*(.+)$/i);
    return {
      id: match ? match[1].toUpperCase() : `AC-${index + 1}`,
      text: match ? match[2] : line,
    };
  });
  return createDraftSpec({
    goal: values(goalLines).join(' '),
    scope: values(scopeLines),
    non_goals: nonGoalLines ? values(nonGoalLines) : [],
    constraints: constraintLines ? values(constraintLines) : [],
    acceptance_criteria: acs,
  }, { source: 'imported-document', sourceRef });
}

function normalizeTodo(todo, index) {
  if (!todo || typeof todo !== 'object' || Array.isArray(todo)) throw new Error('Todo plan entries must be objects');
  const id = todo.id ?? `TODO-${index + 1}`;
  if (!TODO_ID.test(id)) throw new Error(`Invalid Todo id: ${id}`);
  if (!nonempty(todo.goal)) throw new Error(`Todo ${id} needs a goal`);
  if (!uniqueStrings(todo.ac_ids) || todo.ac_ids.length === 0) throw new Error(`Todo ${id} must reference at least one AC id`);
  if (!uniqueStrings(todo.depends_on ?? [])) throw new Error(`Todo ${id} has invalid dependencies`);
  return {
    id,
    goal: trimmed(todo.goal),
    kind: todo.kind === 'repair' ? 'repair' : 'implementation',
    required: true,
    state: 'PENDING',
    depends_on: [...(todo.depends_on ?? [])],
    ac_ids: [...todo.ac_ids],
    evidence: [],
    attempts: 0,
  };
}

export function validatePlanTodos(todos, spec) {
  if (!Array.isArray(todos) || todos.length === 0) throw new Error('A Todo plan needs at least one entry');
  const normalized = todos.map(normalizeTodo);
  const ids = new Set();
  for (const todo of normalized) {
    if (ids.has(todo.id)) throw new Error(`Duplicate Todo id: ${todo.id}`);
    ids.add(todo.id);
  }
  const acIds = new Set(spec.acceptance_criteria.map(ac => ac.id));
  for (const todo of normalized) {
    for (const dependency of todo.depends_on) {
      if (!ids.has(dependency)) throw new Error(`Todo ${todo.id} depends on unknown ${dependency}`);
      if (dependency === todo.id) throw new Error(`Todo ${todo.id} cannot depend on itself`);
    }
    for (const ac of todo.ac_ids) {
      if (!acIds.has(ac)) throw new Error(`Todo ${todo.id} references unknown acceptance criterion ${ac}`);
    }
  }
  const covered = new Set(normalized.flatMap(todo => todo.ac_ids));
  const missing = [...acIds].filter(ac => !covered.has(ac));
  if (missing.length) throw new Error(`Todo plan does not cover acceptance criteria: ${missing.join(', ')}`);
  const visiting = new Set(), visited = new Set();
  const byId = new Map(normalized.map(todo => [todo.id, todo]));
  const visit = id => {
    if (visiting.has(id)) throw new Error(`Todo dependency graph contains a cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).depends_on) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const todo of normalized) visit(todo.id);
  return normalized;
}

export function planRevision(todos) {
  return digest(canonical(todos.map(({ id, goal, kind, required, depends_on, ac_ids }) => ({ id, goal, kind, required, depends_on, ac_ids }))));
}

export function nextEligibleTodo(todos, currentId = null) {
  const byId = new Map(todos.map(todo => [todo.id, todo]));
  if (currentId) {
    const current = byId.get(currentId);
    if (current && current.state !== 'DONE') return current;
  }
  return todos.find(todo => todo.state === 'PENDING'
    && todo.depends_on.every(dependency => byId.get(dependency)?.state === 'DONE')) ?? null;
}

export function allRequiredDone(todos) {
  return todos.length > 0 && todos.every(todo => !todo.required || todo.state === 'DONE');
}

export function addRepairTodo(state, findings, cycle) {
  const existing = new Set(state.todos.map(todo => todo.id));
  let id = `TODO-R${cycle}`;
  let suffix = 1;
  while (existing.has(id)) id = `TODO-R${cycle}-${suffix++}`;
  const acIds = [...new Set((findings ?? []).flatMap(finding => finding.ac_ids ?? (AC_ID.test(finding.id ?? '') ? [finding.id] : [])))]
    .filter(ac => state.spec.acceptance_criteria.some(criterion => criterion.id === ac));
  const repairedAcs = acIds.length ? acIds : state.spec.acceptance_criteria.map(ac => ac.id);
  const todo = {
    id,
    goal: `Repair independent review findings: ${(findings ?? []).map(finding => finding.clearance_condition ?? finding.impact ?? finding.id).filter(Boolean).join('; ') || 'resolve outstanding findings'}`,
    kind: 'repair',
    required: true,
    state: 'PENDING',
    depends_on: state.todos.map(item => item.id),
    ac_ids: repairedAcs,
    evidence: [],
    attempts: 0,
  };
  state.todos.push(todo);
  state.planRevision = planRevision(state.todos);
  return todo;
}

export function defaultTodos(spec) {
  return validatePlanTodos(spec.acceptance_criteria.map((ac, index) => ({
    id: `TODO-${index + 1}`,
    goal: `Implement and verify ${ac.id}: ${ac.text}`,
    depends_on: index === 0 ? [] : [`TODO-${index}`],
    ac_ids: [ac.id],
  })), spec);
}

export function bounded(value, limit) {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 40))}\n...[truncated ${value.length - limit + 40} chars]`;
}

export class ContextBudgetError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ContextBudgetError';
  }
}

function failureContext(failure, limit = 700) {
  const summary = bounded(failure.summary ?? '', limit);
  return {
    at: failure.at,
    todo_id: failure.todo_id,
    kind: failure.kind,
    check_id: failure.check_id ?? null,
    command: failure.command ?? null,
    exit_code: failure.exit_code ?? null,
    timed_out: failure.timed_out ?? null,
    summary,
    summary_truncated: Boolean(failure.summary_truncated) || summary !== (failure.summary ?? ''),
    full_ref: failure.check_id ?? null,
  };
}

function decisionContext(decision) {
  return {
    at: decision.at,
    by: decision.by,
    text: bounded(decision.text ?? '', 300),
    todo_id: decision.todo_id ?? null,
  };
}

export function buildWorkerContext(state, todo, limit = 12_000, diagnostic = null) {
  const currentAcs = state.spec.acceptance_criteria.filter(ac => todo.ac_ids.includes(ac.id));
  const currentFailure = [...state.recentFailures].reverse().find(failure => failure.todo_id === todo.id) ?? null;
  const serialize = value => JSON.stringify(value, null, 2);
  const mandatoryFor = failure => ({
    goal: state.spec.goal,
    scope: state.spec.scope,
    non_goals: state.spec.non_goals,
    constraints: state.spec.constraints,
    current_acceptance_criteria: currentAcs,
    current_todo: {
      id: todo.id,
      goal: todo.goal,
      kind: todo.kind,
      required: todo.required,
      state: todo.state,
      depends_on: todo.depends_on,
      ac_ids: todo.ac_ids,
      evidence: todo.evidence.map(item => ({ kind: item.kind, tree: item.tree, check_ids: item.check_ids ?? [] })),
    },
    dependency_summary: todo.depends_on.map(id => {
      const dependency = state.todos.find(item => item.id === id);
      return dependency ? { id: dependency.id, state: dependency.state, goal: dependency.goal, ac_ids: dependency.ac_ids } : { id, state: 'MISSING' };
    }),
    ...(diagnostic === null ? {} : { current_diagnostic: diagnostic }),
    current_failure: failure,
    run_budget: {
      turns_used: state.turnsUsed,
      max_turns: state.config.maxTurns,
      check_attempts: state.checkAttempts,
      max_check_attempts: state.config.maxCheckAttempts,
      review_repairs_used: state.reviewRepairsUsed,
      max_review_repair_cycles: state.config.maxReviewRepairCycles,
    },
  });
  let mandatory = mandatoryFor(currentFailure ? failureContext(currentFailure, 1200) : null);
  if (serialize(mandatory).length > limit && currentFailure) {
    mandatory = mandatoryFor(failureContext(currentFailure, 300));
  }
  if (serialize(mandatory).length > limit) {
    throw new ContextBudgetError(`Mandatory current-Todo context is ${serialize(mandatory).length} chars, over the ${limit}-char maxPromptChars budget. The confirmed scope/ACs and current diagnostic are not silently truncated; raise maxPromptChars or reduce the confirmed specification.`);
  }
  const optional = {
    recent_failures: state.recentFailures.filter(failure => failure !== currentFailure).slice(-3).map(failure => failureContext(failure)),
    todo_progress: state.todos.map(item => ({ id: item.id, state: item.state, depends_on: item.depends_on })),
    recent_decisions: state.decisions.slice(-5).map(decisionContext),
  };
  const included = { ...mandatory };
  for (const [key, value] of Object.entries(optional)) {
    const candidate = { ...included, [key]: value };
    if (serialize(candidate).length <= limit) included[key] = value;
  }
  return serialize(included);
}

export function validateExistingTodos(todos, spec) {
  if (!Array.isArray(todos) || todos.length === 0) throw new Error('Todo plan needs at least one entry');
  const ids = new Set();
  const acIds = new Set(spec.acceptance_criteria.map(ac => ac.id));
  for (const todo of todos) {
    if (!TODO_ID.test(todo.id ?? '')) throw new Error(`Invalid Todo id: ${todo.id}`);
    if (ids.has(todo.id)) throw new Error(`Duplicate Todo id: ${todo.id}`);
    ids.add(todo.id);
    if (!nonempty(todo.goal)) throw new Error(`Todo ${todo.id} needs a goal`);
    if (!uniqueStrings(todo.ac_ids ?? []) || todo.ac_ids.length === 0) throw new Error(`Todo ${todo.id} must reference at least one AC id`);
    if (!uniqueStrings(todo.depends_on ?? [])) throw new Error(`Todo ${todo.id} has invalid dependencies`);
    for (const ac of todo.ac_ids) if (!acIds.has(ac)) throw new Error(`Todo ${todo.id} references unknown acceptance criterion ${ac}`);
    if (!['PENDING', 'IN_PROGRESS', 'DONE', 'BLOCKED'].includes(todo.state)) throw new Error(`Todo ${todo.id} has an invalid state`);
    if (!Array.isArray(todo.evidence)) throw new Error(`Todo ${todo.id} needs evidence storage`);
  }
  for (const todo of todos) {
    for (const dependency of todo.depends_on) {
      if (!ids.has(dependency)) throw new Error(`Todo ${todo.id} depends on unknown ${dependency}`);
      if (dependency === todo.id) throw new Error(`Todo ${todo.id} cannot depend on itself`);
    }
  }
  const covered = new Set(todos.flatMap(todo => todo.ac_ids));
  const missing = [...acIds].filter(ac => !covered.has(ac));
  if (missing.length) throw new Error(`Todo plan does not cover acceptance criteria: ${missing.join(', ')}`);
  const visiting = new Set(), visited = new Set(), byId = new Map(todos.map(todo => [todo.id, todo]));
  const visit = id => {
    if (visiting.has(id)) throw new Error(`Todo dependency graph contains a cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).depends_on) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const todo of todos) visit(todo.id);
  return todos;
}
