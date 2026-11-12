import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { git } from './process.mjs';

export const LEARNING_SCHEMA_VERSION = 1;
export const MAX_LEARNING_RECORDS = 50;
export const LEARNING_HINT_THRESHOLD = 2;
const MAX_LEARNING_HINT_CHARS = 1200;
const MAX_LABEL_CHARS = 300;
const MAX_SUMMARY_CHARS = 400;

const digest = value => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();

function truncate(value, limit) {
  const text = String(value ?? '');
  if (text.length <= limit) return text;
  const suffix = '...';
  return text.slice(0, Math.max(0, limit - suffix.length)) + suffix;
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

function redactText(value, limit = MAX_SUMMARY_CHARS) {
  return truncate(redactSecrets(String(value ?? '')).replace(/\s+/g, ' ').trim(), limit);
}

function normalizeFailureText(value, limit = MAX_SUMMARY_CHARS) {
  const text = redactSecrets(String(value ?? ''))
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join(' | ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:ms|s|sec(?:onds?)?)\b/gi, '<duration>')
    .replace(/\s+/g, ' ')
    .trim();
  return truncate(text, limit);
}

export async function learningPath(cwd) {
  const common = resolve(cwd, await git(cwd, ['rev-parse', '--git-common-dir']));
  return join(common, 'surgical-dev', 'learning.json');
}

function sanitizeRecord(value) {
  if (typeof value?.signature !== 'string' || !value.signature || typeof value.label !== 'string'
    || !Number.isSafeInteger(value.count) || value.count < 1) return null;
  return {
    signature: truncate(value.signature, 80),
    label: redactText(value.label, MAX_LABEL_CHARS),
    kind: value.kind === 'review' ? 'review' : 'check',
    count: value.count,
    first_seen: typeof value.first_seen === 'string' ? truncate(value.first_seen, 40) : null,
    last_seen: typeof value.last_seen === 'string' ? truncate(value.last_seen, 40) : null,
    last_run_id: typeof value.last_run_id === 'string' ? truncate(value.last_run_id, 120) : null,
  };
}

function emptyLearning() {
  return { schema_version: LEARNING_SCHEMA_VERSION, revision: 0, records: [], updated_at: null };
}

// Pre-release store formats are not supported. An unreadable, unsupported or
// unrecognized file reads as empty and is replaced by the next successful write.
// Records are ordered least-recently-seen first; the newest record is last.
async function readLearningFile(path) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return emptyLearning();
    throw error;
  }
  if (parsed?.schema_version !== LEARNING_SCHEMA_VERSION || !Array.isArray(parsed.records)) return emptyLearning();
  const records = parsed.records.map(sanitizeRecord).filter(Boolean);
  return {
    schema_version: LEARNING_SCHEMA_VERSION,
    revision: Number.isSafeInteger(parsed.revision) ? parsed.revision : 0,
    records: records.slice(-MAX_LEARNING_RECORDS),
    updated_at: typeof parsed.updated_at === 'string' ? parsed.updated_at : null,
  };
}

export async function loadLearning(cwd) {
  return readLearningFile(await learningPath(cwd));
}

async function saveLearning(cwd, records, expectedRevision) {
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
    if (previous.revision !== expectedRevision) {
      throw new Error(`Surgical Dev learning store was changed by another session (expected revision ${expectedRevision}, found ${previous.revision}); refusing to overwrite`);
    }
    const value = { schema_version: LEARNING_SCHEMA_VERSION, revision: previous.revision + 1, records, updated_at: now() };
    const temporary = join(directory, `.learning.${process.pid}.${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, path);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  } finally {
    await lock.close().catch(() => {});
    await rm(lockPath, { force: true }).catch(() => {});
  }
}

// Removes any existing record for the signature, then appends the new count at the newest end.
function observe(records, occurrence, runId) {
  const index = records.findIndex(item => item.signature === occurrence.signature);
  const previous = index === -1 ? null : records.splice(index, 1)[0];
  const at = now();
  const record = {
    signature: occurrence.signature,
    label: occurrence.label,
    kind: occurrence.kind,
    count: (previous?.count ?? 0) + 1,
    first_seen: previous?.first_seen ?? at,
    last_seen: at,
    last_run_id: runId ?? null,
  };
  records.push(record);
  return record;
}

// Callers catch any throw and keep it as a bounded warning; learning never gates acceptance.
async function observeAll(cwd, runId, occurrences) {
  if (!occurrences.length) return [];
  const state = await loadLearning(cwd);
  const records = [...state.records];
  const captured = occurrences.map(occurrence => observe(records, occurrence, runId));
  await saveLearning(cwd, records.slice(-MAX_LEARNING_RECORDS), state.revision);
  return captured;
}

export function checkFailureSignature(command, summary, exitCode = null, timedOut = false) {
  const argv = (command ?? []).map(String);
  const text = normalizeFailureText(summary) || (timedOut ? 'timed out' : `exit ${exitCode ?? 'unknown'}`);
  return {
    kind: 'check',
    signature: digest(`check\0${JSON.stringify(argv)}\0${text}`),
    label: redactText(`check ${redactText(argv.join(' '), 200)}: ${text}`, MAX_LABEL_CHARS),
  };
}

function reviewFindingSignature(finding) {
  const location = normalizeFailureText(finding?.location, 120).replace(/:\d+(?:-\d+)?\b/g, ':<line>');
  const impact = normalizeFailureText(finding?.impact ?? finding?.clearance_condition ?? finding?.id, 200);
  const clearance = normalizeFailureText(finding?.clearance_condition, 200);
  return {
    kind: 'review',
    signature: digest(`review\0${location}\0${impact}\0${clearance}`),
    label: redactText(`${impact} (${location})`, MAX_LABEL_CHARS),
  };
}

// Each call returns the records it observed (count already incremented).
export async function recordCheckFailure(cwd, { runId, check }) {
  return observeAll(cwd, runId, [checkFailureSignature(check?.command, check?.summary, check?.exitCode, check?.timedOut)]);
}

export async function recordReviewFindings(cwd, { runId, findings }) {
  return observeAll(cwd, runId, (findings ?? []).map(reviewFindingSignature));
}

// Returns '' or one advisory line (prefixed by a newline) for the most-recurrent observed record.
export function learningHint(records) {
  const recurring = (records ?? [])
    .filter(record => record.count >= LEARNING_HINT_THRESHOLD)
    .sort((a, b) => b.count - a.count)[0];
  if (!recurring) return '';
  return truncate(
    `\nLEARNING (advisory, not a gate): this failure has occurred ${recurring.count} times in this repository: ${recurring.label}.`,
    MAX_LEARNING_HINT_CHARS,
  );
}
