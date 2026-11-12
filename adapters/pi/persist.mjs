import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { git } from './process.mjs';

export function emptyRepositoryState() {
  return {
    schema_version: 1,
    revision: 0,
    draft_spec: null,
    confirmed_spec: null,
    run: null,
    updated_at: null,
  };
}

export async function repositoryStatePath(cwd) {
  const common = resolve(cwd, await git(cwd, ['rev-parse', '--git-common-dir']));
  return join(common, 'surgical-dev', 'state.json');
}

async function readStateFile(path) {
  try {
    const text = await readFile(path, 'utf8');
    const parsed = JSON.parse(text);
    if (!parsed || parsed.schema_version !== 1) throw new Error('Unsupported Surgical Dev state file version');
    parsed.revision = Number.isSafeInteger(parsed.revision) ? parsed.revision : 0;
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return emptyRepositoryState();
    throw new Error(`Cannot read Surgical Dev state: ${error.message}`);
  }
}

export async function loadRepositoryState(cwd) {
  return readStateFile(await repositoryStatePath(cwd));
}

function comparable(value) {
  const copy = { ...value };
  delete copy.updated_at;
  delete copy.revision;
  return JSON.stringify(copy);
}

export async function saveRepositoryState(cwd, state, { expectedRevision } = {}) {
  const path = await repositoryStatePath(cwd);
  const directory = dirname(path);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const lockPath = join(directory, 'state.lock');
  let lock;
  try {
    lock = await open(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Surgical Dev state is locked by another session; refusing concurrent overwrite');
    throw error;
  }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    const previous = await readStateFile(path);
    if (expectedRevision !== undefined && previous.revision !== expectedRevision) {
      throw new Error(`Surgical Dev state was changed by another session (expected revision ${expectedRevision}, found ${previous.revision}); refusing to overwrite`);
    }
    if (comparable(previous) === comparable(state)) return previous;
    const value = {
      ...state,
      schema_version: 1,
      revision: previous.revision + 1,
      updated_at: new Date().toISOString(),
    };
    const temporary = join(directory, `.state.${process.pid}.${randomUUID()}.tmp`);
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

export async function updateRepositoryState(cwd, update) {
  const state = await loadRepositoryState(cwd);
  const next = await update(structuredClone(state)) ?? state;
  return saveRepositoryState(cwd, next, { expectedRevision: state.revision });
}
