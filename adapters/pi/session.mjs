// Shared session state and operations for the /surgical extension.
import { readFile } from 'node:fs/promises';
import { createRun, loadConfig, STATE_ENTRY, TERMINAL } from './loop.mjs';
import { runProcess } from './process.mjs';
import { confirmSpec, createDraftSpec } from './spec.mjs';
import { assertPiVersion, discussionPrompt, workerPrompt } from './prompts.mjs';
import { createRepositoryStore } from './repository-store.mjs';
import { formatRunStatus, formatSpec, formatSpecStatus } from './status.mjs';

export function createSession(pi) {
  const s = {
    active: undefined, lastState: undefined, starting: undefined, discussion: false,
    discussionSession: undefined, toolsBeforeDiscussion: undefined,
    draftSpec: null, confirmedSpec: null,
    displayedRevision: null, displayedDigest: null, displayedSessionId: null,
    confirmationJob: null, postCompactionContext: false,
  };
  const store = createRepositoryStore();

  const mutateRepository = (ctx, update) => store.mutate(ctx.cwd, update);
  const flushPersist = () => store.flush();

  const scheduleRunPersist = (ctx, state) => {
    s.lastState = state;
    pi.appendEntry(STATE_ENTRY, state);
    return store.scheduleRun(ctx.cwd, state);
  };

  // A run whose state could not be persisted must never stay PR_READY or keep running.
  // save() routes through onChange, which schedules the persisted write.
  const blockOnPersistenceFailure = async (target, reason) => {
    if (TERMINAL.has(target.state.status)) {
      target.state.status = 'BLOCKED';
      target.state.reason = reason;
      target.state.readySnapshot = null;
      target.save();
    } else {
      await target.stop('BLOCKED', reason);
    }
    await flushPersist();
  };

  const reloadRepository = async ctx => {
    const repository = await store.reload(ctx.cwd);
    s.draftSpec = repository.draft_spec ?? null;
    s.confirmedSpec = repository.confirmed_spec ?? null;
    s.lastState = repository.run ?? s.lastState;
    return repository;
  };

  const restoreDiscussionTools = () => {
    if (pi.setActiveTools && s.toolsBeforeDiscussion) {
      pi.setActiveTools(s.toolsBeforeDiscussion);
      s.toolsBeforeDiscussion = undefined;
    }
  };

  const markDisplayed = (spec, ctx) => {
    s.displayedRevision = spec.revision;
    s.displayedDigest = spec.digest;
    s.displayedSessionId = ctx.sessionManager.getSessionId();
  };

  const clearDisplayed = () => {
    s.displayedRevision = null;
    s.displayedDigest = null;
    s.displayedSessionId = null;
  };

  const confirmDisplayedDraft = (ctx, source) => {
    if (s.confirmationJob) return Promise.reject(new Error('A confirmation is already in progress; wait for it to finish.'));
    const job = (async () => {
      if (s.active && !TERMINAL.has(s.active.state.status)) throw new Error('An implementation run is already active; confirmation cannot change its frozen scope.');
      if (!ctx.isIdle()) throw new Error('Finish the current agent turn before confirming scope.');
      if (!s.draftSpec) throw new Error('No draft Goal Specification to confirm. Use /surgical <goal>, /surgical discuss or /surgical import first.');
      const sessionId = ctx.sessionManager.getSessionId();
      const expectedSession = s.displayedSessionId;
      const expectedRevision = s.displayedRevision;
      const expectedDigest = s.displayedDigest;
      if (expectedSession !== sessionId) {
        throw new Error('The draft was not displayed in this session. Review the full latest scope with /surgical status, then confirm again.');
      }
      await reloadRepository(ctx);
      if (ctx.sessionManager.getSessionId() !== sessionId || s.displayedSessionId !== expectedSession) {
        throw new Error('The session changed before confirmation; review the latest full scope again.');
      }
      if (!s.draftSpec) throw new Error('No draft Goal Specification to confirm. Use /surgical <goal>, /surgical discuss or /surgical import first.');
      if (s.draftSpec.revision !== expectedRevision || s.draftSpec.digest !== expectedDigest
        || s.displayedRevision !== expectedRevision || s.displayedDigest !== expectedDigest) {
        throw new Error(`The draft changed before confirmation (revision ${s.draftSpec.revision}). Review the full latest scope with /surgical status, then confirm again.`);
      }
      const confirmed = confirmSpec(s.draftSpec, sessionId, { source });
      await mutateRepository(ctx, state => {
        state.confirmed_spec = confirmed;
        state.draft_spec = null;
        return state;
      });
      s.confirmedSpec = confirmed;
      s.draftSpec = null;
      s.discussion = false;
      markDisplayed(confirmed, ctx);
      restoreDiscussionTools();
      return confirmed;
    })();
    s.confirmationJob = job;
    return job.finally(() => {
      if (s.confirmationJob === job) s.confirmationJob = null;
    });
  };

  const show = ctx => {
    const spec = s.draftSpec ?? s.confirmedSpec;
    const lines = [...formatRunStatus(s.lastState), ...formatSpecStatus(spec)];
    if (store.failure) lines.push(`PERSISTENCE FAILURE: ${store.failure.message}. Implementation/confirmation cannot proceed.`);
    pi.sendMessage({ customType: 'surgical-status', display: true, content: lines.join('\n'), details: s.lastState ?? null });
    if (spec) markDisplayed(spec, ctx);
  };

  const stop = async (ctx, status, reason) => {
    s.starting?.abort();
    if (s.active && !TERMINAL.has(s.active.state.status)) {
      await s.active.stop(status, reason);
      scheduleRunPersist(ctx, s.active.state);
      ctx.abort();
    }
    await flushPersist();
  };

  const readDraft = async (ctx, value, source, sourceRef = null) => {
    const draft = createDraftSpec(value, { source, sourceRef });
    await mutateRepository(ctx, state => {
      state.draft_spec = draft;
      state.confirmed_spec = null;
      return state;
    });
    s.draftSpec = draft;
    s.confirmedSpec = null;
    clearDisplayed();
    // Persistence alone is not a user-facing display. The caller must show the
    // full draft before recording it as displayed for confirmation.
    return draft;
  };

  const beginDiscussion = async (ctx, goal = '') => {
    if ((s.active && !TERMINAL.has(s.active.state.status)) || s.starting) throw new Error('An implementation run is already active; stop it before discussing new scope.');
    if (!ctx.isIdle()) throw new Error('Finish the current agent turn before starting requirement discussion.');
    await mutateRepository(ctx, state => {
      state.draft_spec = null;
      state.confirmed_spec = null;
      return state;
    });
    s.draftSpec = null;
    s.confirmedSpec = null;
    clearDisplayed();
    s.discussion = true;
    s.discussionSession = ctx.sessionManager.getSessionId();
    if (pi.getActiveTools && pi.setActiveTools) {
      s.toolsBeforeDiscussion ??= pi.getActiveTools();
      pi.setActiveTools([...new Set(['read', 'grep', 'find', 'ls', 'surgical_spec'])]);
    }
    const prompt = discussionPrompt(goal);
    s.discussionSession = ctx.sessionManager.getSessionId();
    pi.sendMessage({ customType: 'surgical-discussion', content: prompt, display: true }, { triggerTurn: true });
    await ctx.waitForIdle();
    if (s.discussion && s.draftSpec) {
      pi.sendMessage({
        customType: 'surgical-spec-draft', display: true,
        content: `${formatSpec(s.draftSpec)}\n\nReview this full draft. Reply with 确认，开始 (or confirm and start) to confirm this exact revision and start automatically; /surgical confirm remains available. Implementation has not started.`,
        details: s.draftSpec,
      });
      markDisplayed(s.draftSpec, ctx);
    }
  };

  const startRun = async (ctx) => {
    if (s.starting || !ctx.isIdle() || (s.active && (!TERMINAL.has(s.active.state.status) || s.active.busy))) {
      pi.sendMessage({ customType: 'surgical-status', content: 'An agent or Surgical Dev run is already active.', display: true });
      return;
    }
    if (s.draftSpec || s.discussion) {
      pi.sendMessage({ customType: 'surgical-status', content: 'A draft Goal Specification is pending. Review /surgical status, then confirm the shown draft or /surgical discard before running.', display: true });
      return;
    }
    if (!s.confirmedSpec) {
      pi.sendMessage({ customType: 'surgical-status', content: 'No confirmed Goal Specification. Start with /surgical <goal>; advanced: /surgical import <requirements.md>, then /surgical confirm.', display: true });
      return;
    }
    store.clearFailure();
    const startup = new AbortController();
    s.starting = startup;
    let run;
    try {
      const { config, policyDigest } = await loadConfig(ctx.cwd);
      const version = await runProcess([...config.reviewerCommand, '--version'], { cwd: ctx.cwd, signal: startup.signal, timeoutMs: 10_000 });
      if (startup.signal.aborted) throw new Error('Startup cancelled');
      assertPiVersion(version);
      const worker = await readFile(new URL('../../roles/worker.md', import.meta.url), 'utf8');
      const discipline = await readFile(new URL('../../skills/engineering-discipline/SKILL.md', import.meta.url), 'utf8');
      run = await createRun({
        cwd: ctx.cwd, spec: s.confirmedSpec, config, policyDigest,
        workerSessionId: ctx.sessionManager.getSessionId(),
        model: ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : undefined,
        onChange: state => {
          scheduleRunPersist(ctx, state);
          ctx.ui.setStatus('surgical', `${state.status} · ${state.todos.filter(todo => todo.state === 'DONE').length}/${state.todos.length} todos · checks ${state.checkAttempts}`);
          if (state.status === 'TIMED_OUT') ctx.abort();
        },
      });
      s.active = run;
      await scheduleRunPersist(ctx, run.state);
      await flushPersist();
      if (store.failure) throw new Error(`Persistence failed: ${store.failure.message}`);
      if (startup.signal.aborted) { await run.stop('CANCELLED', 'Startup cancelled'); return; }
      await scheduleRunPersist(ctx, run.state);
      await flushPersist();
      if (store.failure) throw new Error(`Persistence failed: ${store.failure.message}`);
      const prompt = workerPrompt({ worker, discipline, state: s.active.state, checks: config.checks });
      run.workerRunning = true;
      pi.sendMessage({ customType: 'surgical-goal', content: prompt, display: true }, { triggerTurn: true });
      await ctx.waitForIdle();
      run.workerRunning = false;
      await flushPersist();
      if (!TERMINAL.has(run.state.status)) await run.stop('BLOCKED', 'Pi settled without completing the independent acceptance loop');
    } catch (error) {
      if (run && !TERMINAL.has(run.state.status)) await run.stop('BLOCKED', error.message);
      else { pi.sendMessage({ customType: 'surgical-status', content: `Surgical Dev could not start: ${error.message}`, display: true }); return; }
    } finally {
      if (run) {
        await ctx.waitForIdle();
        run.workerRunning = false;
        if (TERMINAL.has(run.state.status)) await run.close();
        await scheduleRunPersist(ctx, run.state);
        await flushPersist();
        if (store.failure && run.state.status === 'PR_READY') {
          await blockOnPersistenceFailure(run, `Persistence failed after acceptance: ${store.failure.message}`);
        }
        if (!store.failure && run.state.status === 'PR_READY') s.lastState = structuredClone(run.state);
      }
      if (s.starting === startup) s.starting = undefined;
    }
    show(ctx);
  };

  return { s, store, mutateRepository, flushPersist, scheduleRunPersist, blockOnPersistenceFailure, restoreDiscussionTools, markDisplayed, clearDisplayed, confirmDisplayedDraft, show, stop, readDraft, beginDiscussion, startRun };
}
