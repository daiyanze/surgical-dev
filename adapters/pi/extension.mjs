import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { adjustRunPlan, advanceRun, createRun, loadConfig, noteWorkerUsage, planTodos, STATE_ENTRY, TERMINAL } from './loop.mjs';
import { runProcess } from './process.mjs';
import {
  COMMAND_CONFIRMATION_SOURCE, confirmSpec, createDraftSpec,
  INPUT_CONFIRMATION_SOURCE, parseRequirementDocument,
} from './spec.mjs';
import { loadLearning } from './learning.mjs';
import { isExplicitConfirmation } from './confirmation.mjs';
import { assertPiVersion, discussionPrompt, postCompactionMessage, workerPrompt } from './prompts.mjs';
import { createRepositoryStore } from './repository-store.mjs';
import { formatRunStatus, formatSpec, formatSpecStatus } from './status.mjs';
import { PLAN_PARAMETERS, SPEC_PARAMETERS } from './tool-schemas.mjs';

export { isExplicitConfirmation };

const RESERVED_COMMANDS = new Set(['discuss', 'import', 'confirm', 'run', 'status', 'lessons', 'stop', 'discard']);

export function registerSurgicalLoop(pi) {
  let active, lastState, starting, discussion = false, discussionSession, toolsBeforeDiscussion;
  let draftSpec = null, confirmedSpec = null, displayedRevision = null, displayedDigest = null, displayedSessionId = null;
  let confirmationJob = null;
  let postCompactionContext = false;
  const store = createRepositoryStore();

  const mutateRepository = (ctx, update) => store.mutate(ctx.cwd, update);
  const flushPersist = () => store.flush();

  const scheduleRunPersist = (ctx, state) => {
    lastState = state;
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
    draftSpec = repository.draft_spec ?? null;
    confirmedSpec = repository.confirmed_spec ?? null;
    lastState = repository.run ?? lastState;
    return repository;
  };

  const restoreDiscussionTools = () => {
    if (pi.setActiveTools && toolsBeforeDiscussion) {
      pi.setActiveTools(toolsBeforeDiscussion);
      toolsBeforeDiscussion = undefined;
    }
  };

  const markDisplayed = (spec, ctx) => {
    displayedRevision = spec.revision;
    displayedDigest = spec.digest;
    displayedSessionId = ctx.sessionManager.getSessionId();
  };

  const clearDisplayed = () => {
    displayedRevision = null;
    displayedDigest = null;
    displayedSessionId = null;
  };

  const confirmDisplayedDraft = (ctx, source) => {
    if (confirmationJob) return Promise.reject(new Error('A confirmation is already in progress; wait for it to finish.'));
    const job = (async () => {
      if (active && !TERMINAL.has(active.state.status)) throw new Error('An implementation run is already active; confirmation cannot change its frozen scope.');
      if (!ctx.isIdle()) throw new Error('Finish the current agent turn before confirming scope.');
      if (!draftSpec) throw new Error('No draft Goal Specification to confirm. Use /surgical <goal>, /surgical discuss or /surgical import first.');
      const sessionId = ctx.sessionManager.getSessionId();
      const expectedSession = displayedSessionId;
      const expectedRevision = displayedRevision;
      const expectedDigest = displayedDigest;
      if (expectedSession !== sessionId) {
        throw new Error('The draft was not displayed in this session. Review the full latest scope with /surgical status, then confirm again.');
      }
      await reloadRepository(ctx);
      if (ctx.sessionManager.getSessionId() !== sessionId || displayedSessionId !== expectedSession) {
        throw new Error('The session changed before confirmation; review the latest full scope again.');
      }
      if (!draftSpec) throw new Error('No draft Goal Specification to confirm. Use /surgical <goal>, /surgical discuss or /surgical import first.');
      if (draftSpec.revision !== expectedRevision || draftSpec.digest !== expectedDigest
        || displayedRevision !== expectedRevision || displayedDigest !== expectedDigest) {
        throw new Error(`The draft changed before confirmation (revision ${draftSpec.revision}). Review the full latest scope with /surgical status, then confirm again.`);
      }
      const confirmed = confirmSpec(draftSpec, sessionId, { source });
      await mutateRepository(ctx, state => {
        state.confirmed_spec = confirmed;
        state.draft_spec = null;
        return state;
      });
      confirmedSpec = confirmed;
      draftSpec = null;
      discussion = false;
      markDisplayed(confirmed, ctx);
      restoreDiscussionTools();
      return confirmed;
    })();
    confirmationJob = job;
    return job.finally(() => {
      if (confirmationJob === job) confirmationJob = null;
    });
  };

  const show = ctx => {
    const spec = draftSpec ?? confirmedSpec;
    const lines = [...formatRunStatus(lastState), ...formatSpecStatus(spec)];
    if (store.failure) lines.push(`PERSISTENCE FAILURE: ${store.failure.message}. Implementation/confirmation cannot proceed.`);
    pi.sendMessage({ customType: 'surgical-status', display: true, content: lines.join('\n'), details: lastState ?? null });
    if (spec) markDisplayed(spec, ctx);
  };

  const stop = async (ctx, status, reason) => {
    starting?.abort();
    if (active && !TERMINAL.has(active.state.status)) {
      await active.stop(status, reason);
      scheduleRunPersist(ctx, active.state);
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
    draftSpec = draft;
    confirmedSpec = null;
    clearDisplayed();
    // Persistence alone is not a user-facing display. The caller must show the
    // full draft before recording it as displayed for confirmation.
    return draft;
  };

  const beginDiscussion = async (ctx, goal = '') => {
    if ((active && !TERMINAL.has(active.state.status)) || starting) throw new Error('An implementation run is already active; stop it before discussing new scope.');
    if (!ctx.isIdle()) throw new Error('Finish the current agent turn before starting requirement discussion.');
    await mutateRepository(ctx, state => {
      state.draft_spec = null;
      state.confirmed_spec = null;
      return state;
    });
    draftSpec = null;
    confirmedSpec = null;
    clearDisplayed();
    discussion = true;
    discussionSession = ctx.sessionManager.getSessionId();
    if (pi.getActiveTools && pi.setActiveTools) {
      toolsBeforeDiscussion ??= pi.getActiveTools();
      pi.setActiveTools([...new Set(['read', 'grep', 'find', 'ls', 'surgical_spec'])]);
    }
    const prompt = discussionPrompt(goal);
    discussionSession = ctx.sessionManager.getSessionId();
    pi.sendMessage({ customType: 'surgical-discussion', content: prompt, display: true }, { triggerTurn: true });
    await ctx.waitForIdle();
    if (discussion && draftSpec) {
      pi.sendMessage({
        customType: 'surgical-spec-draft', display: true,
        content: `${formatSpec(draftSpec)}\n\nReview this full draft. Reply with 确认，开始 (or confirm and start) to confirm this exact revision and start automatically; /surgical confirm remains available. Implementation has not started.`,
        details: draftSpec,
      });
      markDisplayed(draftSpec, ctx);
    }
  };

  const startRun = async (ctx) => {
    if (starting || !ctx.isIdle() || (active && (!TERMINAL.has(active.state.status) || active.busy))) {
      pi.sendMessage({ customType: 'surgical-status', content: 'An agent or Surgical Dev run is already active.', display: true });
      return;
    }
    if (draftSpec || discussion) {
      pi.sendMessage({ customType: 'surgical-status', content: 'A draft Goal Specification is pending. Review /surgical status, then confirm the shown draft or /surgical discard before running.', display: true });
      return;
    }
    if (!confirmedSpec) {
      pi.sendMessage({ customType: 'surgical-status', content: 'No confirmed Goal Specification. Start with /surgical <goal>; advanced: /surgical import <requirements.md>, then /surgical confirm.', display: true });
      return;
    }
    store.clearFailure();
    const startup = new AbortController();
    starting = startup;
    let run;
    try {
      const { config, policyDigest } = await loadConfig(ctx.cwd);
      const version = await runProcess([...config.reviewerCommand, '--version'], { cwd: ctx.cwd, signal: startup.signal, timeoutMs: 10_000 });
      if (startup.signal.aborted) throw new Error('Startup cancelled');
      assertPiVersion(version);
      const worker = await readFile(new URL('../../roles/worker.md', import.meta.url), 'utf8');
      const discipline = await readFile(new URL('../../skills/engineering-discipline/SKILL.md', import.meta.url), 'utf8');
      run = await createRun({
        cwd: ctx.cwd, spec: confirmedSpec, config, policyDigest,
        workerSessionId: ctx.sessionManager.getSessionId(),
        model: ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : undefined,
        onChange: state => {
          scheduleRunPersist(ctx, state);
          ctx.ui.setStatus('surgical', `${state.status} · ${state.todos.filter(todo => todo.state === 'DONE').length}/${state.todos.length} todos · checks ${state.checkAttempts}`);
          if (state.status === 'TIMED_OUT') ctx.abort();
        },
      });
      active = run;
      await scheduleRunPersist(ctx, run.state);
      await flushPersist();
      if (store.failure) throw new Error(`Persistence failed: ${store.failure.message}`);
      if (startup.signal.aborted) { await run.stop('CANCELLED', 'Startup cancelled'); return; }
      await scheduleRunPersist(ctx, run.state);
      await flushPersist();
      if (store.failure) throw new Error(`Persistence failed: ${store.failure.message}`);
      const prompt = workerPrompt({ worker, discipline, state: active.state, checks: config.checks });
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
        if (!store.failure && run.state.status === 'PR_READY') lastState = structuredClone(run.state);
      }
      if (starting === startup) starting = undefined;
    }
    show(ctx);
  };

  if (pi.registerTool) {
    pi.registerTool({
      name: 'surgical_spec',
      label: 'Save draft Goal Specification',
      description: 'Save a DRAFT Goal Specification during Surgical Dev requirement discussion. This cannot confirm user consent.',
      parameters: SPEC_PARAMETERS,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        try {
          if (active && !TERMINAL.has(active.state.status)) throw new Error('A confirmed implementation run is active; scope cannot change');
          if (!discussion || ctx.sessionManager.getSessionId() !== discussionSession) throw new Error('surgical_spec is only available during /surgical discuss');
          const draft = await readDraft(ctx, params, 'discussion');
          pi.sendMessage({
            customType: 'surgical-spec-draft', display: true,
            content: `${formatSpec(draft)}\n\nDraft only: it is not confirmed. Review this full draft. Reply with 确认，开始 (or confirm and start) to confirm this exact revision and start automatically, or use /surgical confirm.`,
            details: draft,
          });
          markDisplayed(draft, ctx);
          return {
            content: [{ type: 'text', text: `${formatSpec(draft)}\n\nDraft only: it is not confirmed. The user must review this exact revision and confirm with the exact phrase 确认，开始 / confirm and start or /surgical confirm; a model cannot provide that consent.` }],
            details: { status: draft.status, goal_id: draft.goal_id, revision: draft.revision, digest: draft.digest },
          };
        } catch (error) {
          return { content: [{ type: 'text', text: `Goal Specification not saved: ${error.message}` }], details: { error: error.message } };
        }
      },
    });

    pi.registerTool({
      name: 'surgical_plan',
      label: 'Submit Todo plan',
      description: 'Submit the Todo dependency plan for the confirmed Surgical Dev Goal Specification. Only valid during the planning phase.',
      parameters: PLAN_PARAMETERS,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        try {
          if (!active || TERMINAL.has(active.state.status)) throw new Error('No active run');
          if (ctx.sessionManager.getSessionId() !== active.state.workerSessionId) throw new Error('Only the owning Worker session can plan');
          const operation = params.operation ?? 'initial';
          let state;
          if (operation === 'initial') {
            if (!Array.isArray(params.todos) || params.todos.length === 0) throw new Error('Initial planning needs todos');
            state = planTodos(active, params.todos);
          } else {
            state = adjustRunPlan(active, params);
          }
          await scheduleRunPersist(ctx, state);
          await flushPersist();
          if (store.failure) {
            const reason = `Plan persistence failed: ${store.failure.message}`;
            await blockOnPersistenceFailure(active, reason);
            return { content: [{ type: 'text', text: `Plan not accepted; run BLOCKED: ${reason}` }], details: { error: reason, blocked: true } };
          }
          const message = operation === 'initial'
            ? `Plan accepted (${state.planRevision}). Current Todo: ${state.activeTodoId}. Implement only that Todo now.`
            : `Plan ${operation} accepted; plan revision ${state.planRevision}. Current Todo: ${state.activeTodoId ?? 'none'}.`;
          return {
            content: [{ type: 'text', text: message }],
            details: { plan_revision: state.planRevision, current_todo: state.activeTodoId, operation },
          };
        } catch (error) {
          return { content: [{ type: 'text', text: `Plan rejected: ${error.message}. Fix the plan and call surgical_plan again.` }], details: { error: error.message } };
        }
      },
    });
  }

  pi.registerCommand('surgical', {
    description: 'Start with /surgical <goal>; advanced: discuss <goal> | import <file> | confirm | run | status | lessons | stop | discard',
    handler: async (args, ctx) => {
      const raw = args ?? '';
      const trimmed = raw.trimStart();
      const first = trimmed.match(/^(\S+)/)?.[1] ?? '';
      if (!first || first === 'status') { show(ctx); return; }
      if (first === 'lessons') {
        try {
          const { records } = await loadLearning(ctx.cwd);
          const lines = records.slice(-20).map(item =>
            `${item.label} [${item.kind}] (${item.count}x, last seen ${item.last_seen})`);
          const body = lines.length ? `Local Learning Loop records (latest 20):\n${lines.join('\n')}` : 'No local Learning Loop records yet.';
          pi.sendMessage({ customType: 'surgical-learning', display: true,
            content: `${body}\nRecords are advisory and stay in Git metadata.`,
          });
        } catch (error) {
          pi.sendMessage({ customType: 'surgical-learning', display: true, content: `Learning records unavailable: ${error.message}` });
        }
        return;
      }
      if (!RESERVED_COMMANDS.has(first)) {
        try { await beginDiscussion(ctx, raw.trim()); }
        catch (error) { pi.sendMessage({ customType: 'surgical-status', content: `Discussion could not start: ${error.message}`, display: true }); }
        return;
      }
      const [verb, ...parts] = trimmed.trim().split(/\s+/);
      if (verb === 'stop') { await stop(ctx, 'CANCELLED', 'Stopped by user'); await flushPersist(); show(ctx); return; }
      if (verb === 'discard') {
        if (active && !TERMINAL.has(active.state.status)) { pi.sendMessage({ customType: 'surgical-status', content: 'Stop the active run before discarding scope.', display: true }); return; }
        try {
          await mutateRepository(ctx, state => { state.draft_spec = null; return state; });
          discussion = false; draftSpec = null; clearDisplayed();
          restoreDiscussionTools();
          pi.sendMessage({ customType: 'surgical-status', content: 'Draft Goal Specification discarded. No implementation was started.', display: true });
        } catch (error) {
          pi.sendMessage({ customType: 'surgical-status', content: `Discard failed: ${error.message}`, display: true });
        }
        return;
      }
      if (verb === 'confirm') {
        try {
          const confirmed = await confirmDisplayedDraft(ctx, COMMAND_CONFIRMATION_SOURCE);
          pi.sendMessage({
            customType: 'surgical-status', display: true,
            content: `${formatSpec(confirmed)}\n\nConfirmed and frozen. Use /surgical run to start. Confirmation source: ${confirmed.confirmation.source} (${confirmed.confirmation.session_id}).`,
          });
        } catch (error) {
          pi.sendMessage({ customType: 'surgical-status', content: `Confirmation failed: ${error.message}`, display: true });
        }
        return;
      }
      if (verb === 'import') {
        if (!parts.length) { pi.sendMessage({ customType: 'surgical-status', content: 'Usage: /surgical import <requirements.md|requirements.json>', display: true }); return; }
        if ((active && !TERMINAL.has(active.state.status)) || starting) { pi.sendMessage({ customType: 'surgical-status', content: 'An implementation run is already active.', display: true }); return; }
        try {
          const path = resolve(ctx.cwd, parts.join(' '));
          const text = await readFile(path, 'utf8');
          const draft = parseRequirementDocument(text, path);
          await mutateRepository(ctx, state => { state.draft_spec = draft; state.confirmed_spec = null; return state; });
          draftSpec = draft;
          confirmedSpec = null;
          discussion = false;
          restoreDiscussionTools();
          clearDisplayed();
          pi.sendMessage({
            customType: 'surgical-spec-draft', display: true,
            content: `${formatSpec(draft)}\n\nImported without a redundant discussion turn. Review this full draft. Reply with 确认，开始 (or confirm and start) to confirm this exact revision and start automatically, or use /surgical confirm. No implementation has started.`,
            details: draft,
          });
          markDisplayed(draft, ctx);
        } catch (error) {
          pi.sendMessage({ customType: 'surgical-status', content: `Import failed: ${error.message}`, display: true });
        }
        return;
      }
      if (verb === 'discuss') {
        if (!parts.length) { pi.sendMessage({ customType: 'surgical-status', content: 'Usage: /surgical discuss <goal>', display: true }); return; }
        try { await beginDiscussion(ctx, parts.join(' ')); }
        catch (error) { pi.sendMessage({ customType: 'surgical-status', content: `Discussion could not start: ${error.message}`, display: true }); }
        return;
      }
      if (verb !== 'run') {
        pi.sendMessage({ customType: 'surgical-status', content: 'Usage: /surgical <goal> | discuss <goal> | import <file> | confirm | run | status | lessons | stop | discard', display: true });
        return;
      }
      if (parts.length) {
        const requested = parts.join(' ');
        if (confirmedSpec && requested === confirmedSpec.goal) { await startRun(ctx); return; }
        try {
          await beginDiscussion(ctx, requested);
          pi.sendMessage({ customType: 'surgical-status', display: true, content: 'The requested goal does not exactly match the confirmed scope, so the old confirmation is invalid. This is requirement discussion only; review the full draft, then confirm with 确认，开始 / confirm and start or the advanced /surgical confirm, and /surgical run.' });
        } catch (error) {
          pi.sendMessage({ customType: 'surgical-status', content: `Discussion could not start: ${error.message}`, display: true });
        }
        return;
      }
      if (draftSpec || discussion) {
        pi.sendMessage({ customType: 'surgical-status', display: true, content: 'A draft/discussion is pending. Review /surgical status, then confirm the shown draft or /surgical discard before /surgical run without a goal.' });
        return;
      }
      await startRun(ctx);
    },
  });

  pi.on('input', async (event, ctx) => {
    const userBoundary = event.source === 'interactive' || event.source === 'rpc';
    if (!isExplicitConfirmation(event.text)) {
      if (userBoundary && draftSpec && displayedRevision !== null) clearDisplayed();
      return { action: 'continue' };
    }
    const workflowActive = Boolean(draftSpec || discussion || starting || confirmationJob || (active && !TERMINAL.has(active.state.status)));
    if (!workflowActive) return { action: 'continue' };
    if (!userBoundary) return { action: 'continue' };
    if (Array.isArray(event.images) && event.images.length) {
      pi.sendMessage({ customType: 'surgical-status', display: true, content: 'Confirmation phrase ignored because an image was attached. Confirm the exact displayed draft with plain text only.' });
      return { action: 'handled' };
    }
    if (event.streamingBehavior || !ctx.isIdle()) {
      pi.sendMessage({ customType: 'surgical-status', display: true, content: 'Finish the current agent turn before confirming scope; queued or steering input cannot confirm.' });
      return { action: 'handled' };
    }
    try {
      const confirmed = await confirmDisplayedDraft(ctx, INPUT_CONFIRMATION_SOURCE);
      pi.sendMessage({
        customType: 'surgical-status', display: true,
        content: `${formatSpec(confirmed)}\n\nConfirmed from the user's input phrase. Starting the existing Worker loop automatically. Confirmation source: ${confirmed.confirmation.source} (${confirmed.confirmation.session_id}).`,
      });
      try {
        const dispatch = pi.sendUserMessage('/surgical run', { expandPromptTemplates: true });
        if (dispatch && typeof dispatch.catch === 'function') {
          dispatch.catch(error => pi.sendMessage({ customType: 'surgical-status', display: true, content: `Automatic run dispatch failed: ${error.message}` }));
        }
      } catch (error) {
        pi.sendMessage({ customType: 'surgical-status', display: true, content: `Automatic run dispatch failed: ${error.message}` });
      }
    } catch (error) {
      pi.sendMessage({ customType: 'surgical-status', display: true, content: `Confirmation failed: ${error.message}` });
    }
    return { action: 'handled' };
  });

  pi.on('before_agent_start', async (_event, ctx) => {
    if (postCompactionContext && active && !TERMINAL.has(active.state.status)) {
      postCompactionContext = false;
      const { message, blocked } = postCompactionMessage(active.state);
      if (blocked) { await stop(ctx, 'BLOCKED', blocked); return; }
      return { message: { customType: 'surgical-post-compaction', display: false, content: message } };
    }
    if (!discussion || active) return;
    return {
      message: {
        customType: 'surgical-discussion-context', display: false,
        content: `[SURGICAL DEV DISCUSSION ACTIVE] Requirement preparation only. Do not implement or edit source. Read relevant project files, ask only material ambiguities, and call surgical_spec to save a DRAFT structure. The user must explicitly confirm with 确认，开始 / confirm and start or /surgical confirm; a tool cannot confirm.`,
      },
    };
  });

  pi.on('turn_start', async (_event, ctx) => {
    if (!active || TERMINAL.has(active.state.status)) return;
    active.state.turnsUsed++;
    active.save();
    if (active.state.turnsUsed > active.state.config.maxTurns) await stop(ctx, 'ESCALATED', 'Worker turn budget exhausted');
  });

  pi.on('tool_execution_end', async (event) => {
    if (!active || TERMINAL.has(active.state.status)) return;
    active.state.usage.calls.workerToolCalls = (active.state.usage.calls.workerToolCalls ?? 0) + 1;
    if (event.toolName === 'surgical_plan') active.state.usage.planCalls = (active.state.usage.planCalls ?? 0) + 1;
    active.save();
  });

  pi.on('message_end', async (event) => {
    if (!active || TERMINAL.has(active.state.status) || event.message?.role !== 'assistant') return;
    noteWorkerUsage(active.state, event.message.usage);
    active.save();
  });

  pi.on('agent_before_settle', async (event, ctx) => {
    if (!active || TERMINAL.has(active.state.status)) return;
    if (ctx.sessionManager.getSessionId() !== active.state.workerSessionId) {
      await active.stop('BLOCKED', 'Worker session changed');
      return;
    }
    if (event.outcome !== 'completed') {
      await active.stop(event.outcome === 'aborted' ? 'CANCELLED' : 'BLOCKED', `Worker ended with ${event.outcome}`);
      return;
    }
    if (event.continue || event.context.pendingMessages.length || ctx.hasPendingMessages()) return;
    const result = await advanceRun(active);
    await scheduleRunPersist(ctx, active.state);
    await flushPersist();
    if (store.failure) {
      await blockOnPersistenceFailure(active, `Persistence failed: ${store.failure.message}`);
      return;
    }
    if (result.action === 'continue') {
      if (active.state.turnsUsed >= active.state.config.maxTurns) {
        await active.stop('ESCALATED', 'No further Worker turn is available; feedback retained');
        return;
      }
      return {
        entries: [...event.entries, { type: 'custom_message', customType: 'surgical-feedback', content: result.feedback, display: false }],
        continue: true,
      };
    }
  });

  pi.on('agent_settled', async (event, ctx) => {
    if (!event.aborted && discussion && draftSpec && (!active || TERMINAL.has(active.state.status))) {
      const sessionId = ctx.sessionManager.getSessionId();
      const alreadyShown = displayedSessionId === sessionId
        && displayedRevision === draftSpec.revision
        && displayedDigest === draftSpec.digest;
      if (!alreadyShown) {
        pi.sendMessage({
          customType: 'surgical-spec-draft', display: true,
          content: `${formatSpec(draftSpec)}\n\nReview this full latest draft. Reply with 确认，开始 (or confirm and start) to confirm this exact revision and start automatically; /surgical confirm remains available. No implementation has started.`,
          details: draftSpec,
        });
        markDisplayed(draftSpec, ctx);
      }
    }
    if (!active) return;
    active.workerRunning = false;
    if (event.aborted) await active.stop('CANCELLED', 'Agent abort observed at settlement; no continuation dispatched');
    else if (active.state.readySnapshot && !TERMINAL.has(active.state.status)) {
      try { await active.finish(); }
      catch (error) { await active.stop('BLOCKED', error.message); }
    }
    await scheduleRunPersist(ctx, active.state);
    await flushPersist();
    if (store.failure && active.state.status === 'PR_READY') {
      await blockOnPersistenceFailure(active, `Persistence failed after acceptance: ${store.failure.message}`);
      pi.sendMessage({ customType: 'surgical-status', display: true, content: `PR_READY was not reported because persistence failed: ${store.failure.message}` });
    }
    if (TERMINAL.has(active.state.status)) await active.close();
  });

  pi.on('session_before_compact', async (_event, ctx) => {
    if (active) await scheduleRunPersist(ctx, active.state);
    await flushPersist();
    if (store.failure && active && !TERMINAL.has(active.state.status)) {
      await active.stop('BLOCKED', `Persistence failed before compaction: ${store.failure.message}`);
    }
    // Preserve Pi's own generated compaction summary. The file-backed plan is
    // injected as bounded current-task context once after compaction.
  });

  pi.on('session_compact', async () => {
    if (active && !TERMINAL.has(active.state.status)) postCompactionContext = true;
  });

  pi.on('session_start', async (_event, ctx) => {
    active = undefined;
    discussion = false;
    postCompactionContext = false;
    store.invalidate();
    restoreDiscussionTools();
    try {
      const repository = await store.ensure(ctx.cwd);
      draftSpec = repository.draft_spec ?? null;
      confirmedSpec = repository.confirmed_spec ?? null;
      // A persisted draft has not been shown in this session until /status or a
      // fresh display. Never turn persistence alone into confirmation consent.
      clearDisplayed();
      lastState = repository.run ?? null;
    } catch (error) {
      store.setFailure(error);
      const entries = ctx.sessionManager.getEntries();
      lastState = entries.filter(entry => entry.type === 'custom' && entry.customType === STATE_ENTRY).at(-1)?.data;
      pi.sendMessage({ customType: 'surgical-status', display: true, content: `Surgical Dev state could not be loaded: ${error.message}` });
    }
    if (lastState && !TERMINAL.has(lastState.status)) {
      // Observational only: do not overwrite another live session's shared run
      // state. The existing run lock governs ownership and recovery.
      lastState = {
        ...lastState,
        status: 'BLOCKED',
        reason: 'Previous run was interrupted or is owned by another session. Inspect its processes and repository lock; automatic restart recovery is not enabled.',
        interruption: { detected_at: new Date().toISOString(), previous_status: lastState.status },
      };
      pi.appendEntry(STATE_ENTRY, lastState);
    }
  });

  pi.on('session_before_switch', async (_event, ctx) => { await stop(ctx, 'CANCELLED', 'Session switched'); restoreDiscussionTools(); clearDisplayed(); await flushPersist(); });
  pi.on('session_shutdown', async (_event, ctx) => { await stop(ctx, 'CANCELLED', 'Pi session shut down'); restoreDiscussionTools(); clearDisplayed(); await flushPersist(); });
}
