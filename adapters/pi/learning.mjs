import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { git } from './process.mjs';

export const LEARNING_SCHEMA_VERSION = 1;
export const MAX_LEARNING_RECORDS = 50;
export const MAX_LEARNING_LESSONS = 3;
export const MAX_LEARNING_CONTEXT_CHARS = 1200;
const MAX_LABEL_CHARS = 300;
const MAX_SUMMARY_CHARS = 400;
const MAX_LESSON_FIELD_CHARS = 500;
const MAX_TAGS = 12;
const MAX_RUN_IDS = 10;

const STATUSES = new Set(['OBSERVED', 'RECURRING', 'CANDIDATE', 'ACTIVE', 'NEEDS_REVISION']);
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'when', 'then', 'into', 'only',
  'keep', 'must', 'should', 'does', 'have', 'has', 'not', 'are', 'was', 'were', 'will',
  'can', 'could', 'would', 'about', 'after', 'before', 'some', 'than', 'them', 'they',
  'you', 'your', 'our', 'its', 'all', 'any', 'each', 'use', 'using', 'changed', 'change',
  'fix', 'bug', 'code', 'project', 'task', 'test', 'tests', 'issue', 'error', 'errors',
  'implement', 'update', 'new', 'add', 'verify', 'problem', 'make',
  '问题', '修复', '测试', '功能', '方法', '以及', '添加', '完成', '新增', '实现',
]);

const digest = value => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();

export function truncate(value, limit) {
  const text = String(value ?? '');
  if (text.length <= limit) return text;
  const suffix = '...';
  return text.slice(0, Math.max(0, limit - suffix.length)) + suffix;
}

export function redactText(value, limit = MAX_SUMMARY_CHARS) {
  const text = redactSecrets(String(value ?? ''))
    .replace(/\s+/g, ' ')
    .trim();
  return truncate(text, limit);
}

function redactSecrets(value) {
  return value
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\b(authorization|api[_-]?key|access[_-]?token|token|secret|password|passwd)\b(\s*[:=]\s*)([^\s,;]+)/gi,
      (_match, name, separator) => `${name}${separator}[REDACTED]`)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]')
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[REDACTED]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED]')
    .replace(/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, '[REDACTED]');
}

function normalizeFailureText(value, limit = MAX_SUMMARY_CHARS) {
  const lines = redactSecrets(String(value ?? ''))
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 5);
  let text = lines.join(' | ');
  text = text
    .replace(/\b\d+(?:\.\d+)?\s*(?:ms|s|sec(?:onds?)?)\b/gi, '<duration>')
    .replace(/\s+/g, ' ')
    .trim();
  return truncate(text, limit);
}

export function emptyLearningState() {
  return {
    schema_version: LEARNING_SCHEMA_VERSION,
    revision: 0,
    records: [],
    updated_at: null,
  };
}

export async function learningPath(cwd) {
  const common = resolve(cwd, await git(cwd, ['rev-parse', '--git-common-dir']));
  return join(common, 'surgical-dev', 'learning.json');
}

function sanitizeTags(value, limit = MAX_TAGS) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter(tag => typeof tag === 'string' && tag.trim())
    .map(tag => redactText(tag, 40))
    .filter(Boolean))].slice(0, limit);
}

function sanitizeLesson(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const evidence = value.evidence && typeof value.evidence === 'object' ? value.evidence : {};
  return {
    root_cause: redactText(value.root_cause, MAX_LESSON_FIELD_CHARS),
    preventative_rule: redactText(value.preventative_rule, MAX_LESSON_FIELD_CHARS),
    scope: redactText(value.scope, MAX_LESSON_FIELD_CHARS),
    validation: redactText(value.validation, MAX_LESSON_FIELD_CHARS),
    tags: sanitizeTags(value.tags),
    evidence: {
      run_id: typeof evidence.run_id === 'string' ? truncate(evidence.run_id, 120) : null,
      occurrence_count: Number.isSafeInteger(evidence.occurrence_count) ? evidence.occurrence_count : 0,
      signature: typeof evidence.signature === 'string' ? truncate(evidence.signature, 80) : null,
    },
    proposed_at: typeof value.proposed_at === 'string' ? truncate(value.proposed_at, 40) : null,
    promoted_at: typeof value.promoted_at === 'string' ? truncate(value.promoted_at, 40) : null,
    needs_revision_at: typeof value.needs_revision_at === 'string' ? truncate(value.needs_revision_at, 40) : null,
  };
}

function sanitizeRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const signature = typeof value.signature === 'string' ? value.signature : '';
  if (!signature) return null;
  const status = STATUSES.has(value.status) ? value.status : 'OBSERVED';
  const count = Number.isSafeInteger(value.occurrence_count) && value.occurrence_count > 0 ? value.occurrence_count : 1;
  return {
    id: typeof value.id === 'string' && value.id.trim() ? truncate(value.id, 80) : `LES-${signature.slice(0, 16)}`,
    kind: value.kind === 'review' ? 'review' : 'check',
    signature: truncate(signature, 80),
    label: redactText(value.label, MAX_LABEL_CHARS),
    tags: sanitizeTags(value.tags),
    occurrence_count: count,
    run_ids: Array.isArray(value.run_ids) ? value.run_ids.filter(id => typeof id === 'string').slice(-MAX_RUN_IDS) : [],
    first_seen: typeof value.first_seen === 'string' ? truncate(value.first_seen, 40) : null,
    last_seen: typeof value.last_seen === 'string' ? truncate(value.last_seen, 40) : null,
    last_evidence: value.last_evidence && typeof value.last_evidence === 'object' ? {
      run_id: typeof value.last_evidence.run_id === 'string' ? truncate(value.last_evidence.run_id, 120) : null,
      todo_id: typeof value.last_evidence.todo_id === 'string' ? truncate(value.last_evidence.todo_id, 80) : null,
      check_id: typeof value.last_evidence.check_id === 'string' ? truncate(value.last_evidence.check_id, 160) : null,
      at: typeof value.last_evidence.at === 'string' ? truncate(value.last_evidence.at, 40) : null,
    } : null,
    status,
    lesson: sanitizeLesson(value.lesson),
  };
}

function sanitizeState(value) {
  if (!value || typeof value !== 'object' || value.schema_version !== LEARNING_SCHEMA_VERSION) {
    throw new Error('Unsupported Surgical Dev learning store version');
  }
  return {
    schema_version: LEARNING_SCHEMA_VERSION,
    revision: Number.isSafeInteger(value.revision) ? value.revision : 0,
    records: Array.isArray(value.records) ? value.records.map(sanitizeRecord).filter(Boolean).slice(-MAX_LEARNING_RECORDS) : [],
    updated_at: typeof value.updated_at === 'string' ? value.updated_at : null,
  };
}

async function readLearningFile(path) {
  try {
    return sanitizeState(JSON.parse(await readFile(path, 'utf8')));
  } catch (error) {
    if (error.code === 'ENOENT') return emptyLearningState();
    throw new Error(`Cannot read Surgical Dev learning store: ${error.message}`);
  }
}

export async function loadLearning(cwd) {
  return readLearningFile(await learningPath(cwd));
}

function comparable(value) {
  const copy = { ...value };
  delete copy.updated_at;
  delete copy.revision;
  return JSON.stringify(copy);
}

export async function saveLearning(cwd, state, { expectedRevision } = {}) {
  const path = await learningPath(cwd);
  const directory = dirname(path);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const lockPath = join(directory, 'learning.lock');
  let lock;
  try {
    lock = await open(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Surgical Dev learning store is locked by another session; refusing concurrent overwrite');
    throw error;
  }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, at: now() }));
    const previous = await readLearningFile(path);
    if (expectedRevision !== undefined && previous.revision !== expectedRevision) {
      throw new Error(`Surgical Dev learning store was changed by another session (expected revision ${expectedRevision}, found ${previous.revision}); refusing to overwrite`);
    }
    if (comparable(previous) === comparable(state)) return previous;
    const value = {
      schema_version: LEARNING_SCHEMA_VERSION,
      revision: previous.revision + 1,
      records: state.records.slice(-MAX_LEARNING_RECORDS),
      updated_at: now(),
    };
    const temporary = join(directory, `.learning.${process.pid}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, path);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
    return value;
  } finally {
    await lock.close().catch(() => {});
    await rm(lockPath, { force: true }).catch(() => {});
  }
}

export async function updateLearning(cwd, update) {
  const state = await loadLearning(cwd);
  const next = await update(structuredClone(state)) ?? state;
  return saveLearning(cwd, next, { expectedRevision: state.revision });
}

export function deriveTags(values, limit = MAX_TAGS) {
  const text = Array.isArray(values) ? values.join(' ') : String(values ?? '');
  const lower = text.toLowerCase();
  const words = [...lower.matchAll(/[\p{L}\p{N}][\p{L}\p{N}_-]{2,}/gu)].map(match => match[0]);
  // CJK text has no required spaces; adjacent pairs allow a short Chinese or
  // Japanese scope keyword to match an otherwise differently phrased goal.
  const cjkPairs = [...lower.matchAll(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,}/gu)]
    .flatMap(match => Array.from(match[0]).slice(0, -1).map((_, index) => match[0].slice(index, index + 2)));
  return [...new Set([...cjkPairs, ...words])].filter(word => !STOP_WORDS.has(word)).slice(0, limit);
}

export function checkFailureSignature(command, summary, exitCode = null, timedOut = false) {
  const commandText = redactText((command ?? []).join(' '), 200);
  const text = normalizeFailureText(summary) || (timedOut ? 'timed out' : `exit ${exitCode ?? 'unknown'}`);
  const signature = digest(`check\0${JSON.stringify((command ?? []).map(String))}\0${text}`);
  return {
    kind: 'check',
    signature,
    label: truncate(redactText(`check ${commandText}: ${text}`, MAX_LABEL_CHARS), MAX_LABEL_CHARS),
    tags: deriveTags(text),
  };
}

export function reviewFindingSignature(finding) {
  const location = normalizeFailureText(finding?.location, 120).replace(/:\d+(?:-\d+)?\b/g, ':<line>');
  const impact = normalizeFailureText(finding?.impact ?? finding?.clearance_condition ?? finding?.id, 200);
  const clearance = normalizeFailureText(finding?.clearance_condition, 200);
  const signature = digest(`review\0${location}\0${impact}\0${clearance}`);
  return {
    kind: 'review',
    signature,
    label: truncate(redactText(`${impact} (${location})`, MAX_LABEL_CHARS), MAX_LABEL_CHARS),
    tags: deriveTags(`${location} ${impact} ${clearance}`),
  };
}

function mergeTags(...groups) {
  return [...new Set(groups.flat())].slice(0, MAX_TAGS);
}

function upsertRecord(state, occurrence) {
  const at = now();
  let record = state.records.find(item => item.signature === occurrence.signature);
  if (!record) {
    record = {
      id: `LES-${occurrence.signature.slice(0, 16)}`,
      kind: occurrence.kind,
      signature: occurrence.signature,
      label: occurrence.label,
      tags: mergeTags(occurrence.tags ?? []),
      occurrence_count: 1,
      run_ids: occurrence.run_id ? [occurrence.run_id] : [],
      first_seen: at,
      last_seen: at,
      last_evidence: {
        run_id: occurrence.run_id ?? null,
        todo_id: occurrence.todo_id ?? null,
        check_id: occurrence.check_id ?? null,
        at,
      },
      status: 'OBSERVED',
      lesson: null,
    };
    state.records.push(record);
    return record;
  }
  record.occurrence_count += 1;
  record.last_seen = at;
  record.label = occurrence.label;
  record.tags = mergeTags(record.tags ?? [], occurrence.tags ?? []);
  if (occurrence.run_id && !record.run_ids.includes(occurrence.run_id)) {
    record.run_ids = [...record.run_ids, occurrence.run_id].slice(-MAX_RUN_IDS);
  }
  record.last_evidence = {
    run_id: occurrence.run_id ?? record.last_evidence?.run_id ?? null,
    todo_id: occurrence.todo_id ?? record.last_evidence?.todo_id ?? null,
    check_id: occurrence.check_id ?? record.last_evidence?.check_id ?? null,
    at,
  };
  if (record.occurrence_count >= 2 && record.status === 'OBSERVED') record.status = 'RECURRING';
  if (record.occurrence_count >= 2 && record.status === 'ACTIVE') {
    record.status = 'NEEDS_REVISION';
    if (record.lesson) record.lesson.needs_revision_at = at;
  }
  return record;
}

export function trimLearningRecords(state) {
  if (state.records.length <= MAX_LEARNING_RECORDS) return state;
  const lessons = state.records.filter(record => record.lesson)
    .sort((a, b) => String(b.last_seen ?? '').localeCompare(String(a.last_seen ?? '')))
    .slice(0, MAX_LEARNING_RECORDS);
  const keep = new Set(lessons.map(record => record.id));
  const observations = state.records.filter(record => !keep.has(record.id))
    .sort((a, b) => String(b.last_seen ?? '').localeCompare(String(a.last_seen ?? '')));
  state.records = [...lessons, ...observations].slice(0, MAX_LEARNING_RECORDS);
  return state;
}

export function recurrenceHint(record) {
  if (!record || record.occurrence_count < 2 || record.status === 'ACTIVE') return null;
  return {
    record_id: record.id,
    kind: record.kind,
    label: truncate(record.label, 240),
    occurrences: record.occurrence_count,
    status: record.status,
    instruction: record.status === 'NEEDS_REVISION'
      ? 'A prior active lesson did not prevent this recurrence. Propose a revised grounded lesson with surgical_lesson, or leave the issue unresolved. This hint is advisory and never blocks checks or review.'
      : record.status === 'CANDIDATE'
        ? 'A candidate lesson exists but is not trusted yet. It becomes active only after this run reaches PR_READY; do not treat it as approval.'
        : 'Recurrence detected. Only if grounded in the original evidence, call surgical_lesson with a concrete root cause, preventative rule, scope, tags and validation. Otherwise leave it unresolved.',
  };
}

async function rememberOccurrences(cwd, occurrences) {
  const captured = [];
  await updateLearning(cwd, state => {
    for (const occurrence of occurrences) captured.push(upsertRecord(state, occurrence));
    trimLearningRecords(state);
    return state;
  });
  return captured.map(record => ({ record, hint: recurrenceHint(record) }));
}

export async function recordCheckFailure(cwd, { runId, todoId, check, goal, scope }) {
  const normalized = checkFailureSignature(check?.command, check?.summary, check?.exitCode, check?.timedOut);
  const [result] = await rememberOccurrences(cwd, [{
    ...normalized,
    run_id: runId,
    todo_id: todoId,
    check_id: check?.id ?? null,
    tags: mergeTags(deriveTags([goal ?? '', ...(scope ?? [])]), normalized.tags),
  }]);
  return result;
}

export async function recordReviewFindings(cwd, { runId, todoId, findings, goal, scope }) {
  const normalized = (findings ?? []).map(finding => reviewFindingSignature(finding));
  return rememberOccurrences(cwd, normalized.map(item => ({
    ...item,
    run_id: runId,
    todo_id: todoId,
    check_id: null,
    tags: mergeTags(deriveTags([goal ?? '', ...(scope ?? [])]), item.tags),
  })));
}

function requiredText(value, name, limit) {
  const text = redactText(value, limit);
  if (!text) throw new Error(`${name} must be nonempty text`);
  return text;
}

export async function proposeLesson(cwd, { recordId, runId, rootCause, preventativeRule, scope, tags, validation }) {
  if (!recordId || typeof recordId !== 'string') throw new Error('A recurring issue record_id is required');
  if (!runId || typeof runId !== 'string') throw new Error('A current run is required to propose a lesson');
  const lesson = {
    root_cause: requiredText(rootCause, 'root_cause', MAX_LESSON_FIELD_CHARS),
    preventative_rule: requiredText(preventativeRule, 'preventative_rule', MAX_LESSON_FIELD_CHARS),
    scope: requiredText(scope, 'scope', MAX_LESSON_FIELD_CHARS),
    validation: requiredText(validation, 'validation', MAX_LESSON_FIELD_CHARS),
    tags: sanitizeTags(tags),
  };
  let proposed = null;
  await updateLearning(cwd, state => {
    const record = state.records.find(item => item.id === recordId);
    if (!record) throw new Error('The lesson must reference an existing recurring issue record');
    if (record.occurrence_count < 2) throw new Error('A lesson requires at least two observed occurrences of the original issue');
    if (!record.run_ids.includes(runId)) throw new Error('A lesson requires evidence from the current run; the referenced recurrence is not from this run');
    if (record.status === 'ACTIVE') throw new Error('An active lesson cannot be re-proposed without a new recurrence');
    record.status = 'CANDIDATE';
    record.tags = mergeTags(record.tags ?? [], lesson.tags);
    record.lesson = {
      ...lesson,
      evidence: {
        run_id: runId,
        occurrence_count: record.occurrence_count,
        signature: record.signature,
      },
      proposed_at: now(),
      promoted_at: null,
      needs_revision_at: null,
    };
    proposed = record;
    trimLearningRecords(state);
    return state;
  });
  return proposed;
}

export async function promoteLessonsForRun(cwd, runId) {
  const promoted = [];
  await updateLearning(cwd, state => {
    for (const record of state.records) {
      if (record.status !== 'CANDIDATE') continue;
      if (record.lesson?.evidence?.run_id !== runId) continue;
      record.status = 'ACTIVE';
      record.lesson.promoted_at = now();
      promoted.push(record.id);
    }
    return state;
  });
  return promoted;
}

export function selectRelevantLessons(records, query, { max = MAX_LEARNING_LESSONS, maxChars = MAX_LEARNING_CONTEXT_CHARS } = {}) {
  const queryTags = new Set(deriveTags([query?.goal ?? '', ...(query?.scope ?? [])], 30));
  if (!queryTags.size) return { lessons: [], text: '' };
  const ranked = records
    .filter(record => record.status === 'ACTIVE' && record.lesson)
    .map(record => {
      const recordTags = new Set(deriveTags([
        ...(record.tags ?? []),
        ...(record.lesson.tags ?? []),
        record.label,
        record.lesson.scope,
      ], 40));
      const score = [...queryTags].filter(tag => recordTags.has(tag)).length;
      return { record, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || String(b.record.lesson.promoted_at ?? '').localeCompare(String(a.record.lesson.promoted_at ?? '')));

  const header = 'Advisory recurring-failure lessons (lower-trust hints; not acceptance evidence, scope, or permission):';
  if (maxChars < header.length) return { lessons: [], text: '' };
  let text = header;
  const lessons = [];
  for (const { record } of ranked) {
    if (lessons.length >= max) break;
    const remaining = maxChars - text.length;
    if (remaining < 60) break;
    const lesson = record.lesson;
    const line = `\n- ${record.id} (seen ${record.occurrence_count}x): Root: ${truncate(lesson.root_cause, 120)}; Prevent: ${truncate(lesson.preventative_rule, 160)}; Scope: ${truncate(lesson.scope, 100)}; Verify: ${truncate(lesson.validation, 110)}`;
    if (line.length > remaining) break;
    text += line;
    lessons.push({
      record_id: record.id,
      trust: 'ADVISORY_LOW_TRUST',
      occurrences: record.occurrence_count,
      root_cause: lesson.root_cause,
      preventative_rule: lesson.preventative_rule,
      scope: lesson.scope,
      tags: [...lesson.tags],
      validation: lesson.validation,
      promoted_at: lesson.promoted_at,
    });
  }
  return { lessons, text };
}

export async function loadRelevantLessons(cwd, query, options = {}) {
  const state = await loadLearning(cwd);
  return selectRelevantLessons(state.records, query, options);
}
