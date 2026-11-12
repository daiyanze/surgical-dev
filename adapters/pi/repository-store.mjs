import { emptyRepositoryState, loadRepositoryState, saveRepositoryState } from './persist.mjs';

// Revision-checked, serialized writes of the repository state file. Pi-free so queue
// ordering and persistence-failure propagation can be tested directly.
export function createRepositoryStore({ load = loadRepositoryState, save = saveRepositoryState } = {}) {
  let state = emptyRepositoryState();
  let loaded = false;
  let chain = Promise.resolve();
  let failure = null;
  let pendingRun = null;
  let runScheduled = false;

  const queue = operation => {
    const pending = chain.then(operation);
    chain = pending.catch(() => {});
    return pending;
  };

  const saveMutation = async (cwd, update) => {
    const previous = state;
    const next = structuredClone(previous);
    const result = await update(next);
    state = result ?? next;
    try {
      state = await save(cwd, state, { expectedRevision: previous.revision });
      failure = null;
      return state;
    } catch (error) {
      state = previous;
      failure = error;
      throw error;
    }
  };

  return {
    get failure() { return failure; },
    setFailure(error) { failure = error; },
    clearFailure() { failure = null; },
    invalidate() { loaded = false; },
    async ensure(cwd) {
      if (!loaded) {
        state = await load(cwd);
        loaded = true;
      }
      return state;
    },
    async reload(cwd) {
      state = await load(cwd);
      loaded = true;
      return state;
    },
    mutate: (cwd, update) => queue(() => saveMutation(cwd, update)),
    // Snapshots coalesce: one queued write persists the newest pending run state.
    scheduleRun(cwd, runState) {
      pendingRun = runState;
      if (runScheduled) return chain;
      runScheduled = true;
      return queue(async () => {
        runScheduled = false;
        const pending = pendingRun;
        pendingRun = null;
        if (!pending) return;
        try {
          await saveMutation(cwd, repository => {
            repository.run = pending;
            return repository;
          });
        } catch (error) {
          failure = error;
        }
      });
    },
    async flush() {
      await chain.catch(() => {});
      return failure;
    },
  };
}
