import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { adjustRunPlan, advanceRun, createRun, loadConfig, noteWorkerUsage, planTodos, STATE_ENTRY, TERMINAL } from './loop.mjs';
import { runProcess } from './process.mjs';
import { buildWorkerContext, confirmSpec, createDraftSpec, parseRequirementDocument } from './spec.mjs';
import { emptyRepositoryState, loadRepositoryState, saveRepositoryState } from './persist.mjs';

const tolerance = { type: 'object', additionalProperties: false };
const POST_COMPACTION_PREFIX = '[POST-COMPACTION CURRENT TASK CONTEXT]\n';

function toolSchema(properties, required = Object.keys(properties)) {
  return { type: 'object', properties, required, additionalProperties: false, ...tolerance };
}

const SPEC_PARAMETERS = toolSchema({
  goal: { type: 'string', minLength: 1 },
  scope: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1 },
  non_goals: { type: 'array', items: { type: 'string', minLength: 1 } },
  constraints: { type: 'array', items: { type: 'string', minLength: 1 } },
  acceptance_criteria: {
    type: 'array', minItems: 1,
    items: toolSchema({
      id: { type: 'string', pattern: '^AC-[1-9][0-9]*$' },
      text: { type: 'string', minLength: 1 },
    }),
  },
});

const TODO_SCHEMA = toolSchema({
  id: { type: 'string' },
  goal: { type: 'string', minLength: 1 },
  depends_on: { type: 'array', items: { type: 'string' } },
  ac_ids: { type: 'array', items: { type: 'string' }, minItems: 1 },
  kind: { type: 'string', enum: ['implementation', 'repair'] },
}, ['id', 'goal', 'depends_on', 'ac_ids']);

const PLAN_PARAMETERS = toolSchema({
  operation: { type: 'string', enum: ['initial', 'add_repair', 'reorder', 'revise_dependencies', 'decision'] },
  todos: { type: 'array', minItems: 1, items: TODO_SCHEMA },
  todo: TODO_SCHEMA,
  order: { type: 'array', items: { type: 'string' }, minItems: 1 },
  dependencies: {
    type: 'array',
    items: toolSchema({ id: { type: 'string' }, depends_on: { type: 'array', items: { type: 'string' } } }, ['id', 'depends_on']),
  },
  decision: { type: 'string', minLength: 1, maxLength: 500 },
  todo_id: { type: 'string' },
}, []);

function todoSummary(state) {
  return state.todos.map(todo => `${todo.state === 'DONE' ? '[x]' : todo.state === 'IN_PROGRESS' ? '[>]' : '[ ]'} ${todo.id} ${todo.goal} (${todo.ac_ids.join(', ')})`).join('\n');
}

export function registerSurgicalLoop(pi) {
  let active, lastState, starting, discussion = false, discussionSession, toolsBeforeDiscussion;
  let draftSpec = null, confirmedSpec = null, displayedRevision = null, displayedDigest = null;
  let repositoryState = emptyRepositoryState(), repositoryLoaded = false;
  let writeChain = Promise.resolve(), persistFailure = null;
  let pendingRunState = null, runPersistScheduled = false;
  let postCompactionContext = false;

  const ensureRepository = async ctx => {
    if (repositoryLoaded) return repositoryState;
    repositoryState = await loadRepositoryState(ctx.cwd);
    repositoryLoaded = true;
    return repositoryState;
  };

  const saveMutation = async (ctx, update) => {
    const previous = repositoryState;
    const next = structuredClone(previous);
    const result = await update(next);
    repositoryState = result ?? next;
    try {
      repositoryState = await saveRepositoryState(ctx.cwd, repositoryState, { expectedRevision: previous.revision });
      persistFailure = null;
      return repositoryState;
    } catch (error) {
      repositoryState = previous;
      persistFailure = error;
      throw error;
    }
  };

  const queueWrite = operation => {
    const pending = writeChain.then(operation);
    writeChain = pending.catch(() => {});
    return pending;
  };

  const mutateRepository = (ctx, update) => queueWrite(() => saveMutation(ctx, update));

  const flushPersist = async () => {
    await writeChain.catch(() => {});
    return persistFailure;
  };

  const scheduleRunPersist = (ctx, state) => {
    lastState = state;
    pi.appendEntry(STATE_ENTRY, state);
    pendingRunState = state;
    if (runPersistScheduled) return writeChain;
    runPersistScheduled = true;
    return queueWrite(async () => {
      runPersistScheduled = false;
      const pending = pendingRunState;
      pendingRunState = null;
      if (!pending) return;
      try {
        await saveMutation(ctx, repository => {
          repository.run = pending;
          return repository;
        });
      } catch (error) {
        persistFailure = error;
      }
    });
  };

  const reloadRepository = async ctx => {
    repositoryState = await loadRepositoryState(ctx.cwd);
    repositoryLoaded = true;
    draftSpec = repositoryState.draft_spec ?? null;
    confirmedSpec = repositoryState.confirmed_spec ?? null;
    lastState = repositoryState.run ?? lastState;
    return repositoryState;
  };

  const formatSpec = spec => {
    const lines = [
      `${spec.status} Goal Specification ${spec.goal_id} revision ${spec.revision} (${spec.digest.slice(0, 12)})`,
      `Goal: ${spec.goal}`,
      'Scope:',
      ...spec.scope.map(item => `  - ${item}`),
      'Non-goals:',
      ...(spec.non_goals.length ? spec.non_goals.map(item => `  - ${item}`) : ['  - (none)']),
      'Constraints:',
      ...(spec.constraints.length ? spec.constraints.map(item => `  - ${item}`) : ['  - (none)']),
      'Acceptance criteria:',
      ...spec.acceptance_criteria.map(ac => `  ${ac.id}: ${ac.text}`),
    ];
    if (spec.status === 'DRAFT') lines.push('DRAFT: no implementation is allowed. Type /surgical confirm while idle to freeze this exact revision; a model tool cannot confirm.');
    return lines.join('\n');
  };

  const restoreDiscussionTools = () => {
    if (pi.setActiveTools && toolsBeforeDiscussion) {
      pi.setActiveTools(toolsBeforeDiscussion);
      toolsBeforeDiscussion = undefined;
    }
  };

  const requirePersistence = async (ctx, action) => {
    const failure = await flushPersist();
    if (failure) {
      if (active && !TERMINAL.has(active.state.status)) {
        active.state.status = 'BLOCKED';
        active.state.reason = `Persistence failed: ${failure.message}`;
        active.state.readySnapshot = null;
        active.readySnapshot = null;
        active.save();
      }
      pi.sendMessage({ customType: 'surgical-status', display: true, content: `${action} blocked: persistence failed: ${failure.message}` });
      return false;
    }
    return true;
  };

  const show = () => {
    const spec = draftSpec ?? confirmedSpec;
    const lines = [];
    if (lastState) {
      lines.push(`Surgical Dev: ${lastState.status}`);
      lines.push(lastState.reason ?? (lastState.status === 'PR_READY'
        ? `Checks and independent review passed for recorded tree ${lastState.acceptedSnapshot?.tree}. Delivery was not performed.`
        : lastState.goal));
      const done = lastState.todos.filter(todo => todo.state === 'DONE').length;
      lines.push(`Todos: ${done}/${lastState.todos.length} done${lastState.activeTodoId ? `; current ${lastState.activeTodoId}` : ''}`);
      lines.push(`Usage: turns ${lastState.turnsUsed}/${lastState.config.maxTurns}; checks ${lastState.checkAttempts}/${lastState.config.maxCheckAttempts}; reviews ${lastState.reviewAttempts}; repairs ${lastState.reviewRepairsUsed}/${lastState.config.maxReviewRepairCycles}; worker tokens ${typeof lastState.usage?.tokens === 'object' ? JSON.stringify(lastState.usage.tokens) : 'UNKNOWN'}; reviewer tokens ${typeof lastState.usage?.reviewer === 'object' ? JSON.stringify(lastState.usage.reviewer) : 'UNKNOWN'}; total ${typeof lastState.usage?.total_tokens === 'object' ? JSON.stringify(lastState.usage.total_tokens) : 'UNKNOWN'}`);
    } else {
      lines.push('No Surgical Dev run in this session.');
    }
    if (spec) {
      lines.push(formatSpec(spec));
      if (spec.status === 'CONFIRMED') lines.push('Confirmed boundaries are frozen. Use /surgical run to start the Worker loop.');
    } else {
      lines.push('Use /surgical discuss <goal> or /surgical import <requirements.md>, then /surgical confirm and /surgical run.');
    }
    if (persistFailure) lines.push(`PERSISTENCE FAILURE: ${persistFailure.message}. Implementation/confirmation cannot proceed.`);
    pi.sendMessage({ customType: 'surgical-status', display: true, content: lines.join('\n'), details: lastState ?? null });
    if (spec) {
      displayedRevision = spec.revision;
      displayedDigest = spec.digest;
    }
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
    displayedRevision = null;
    displayedDigest = null;
    discussion = true;
    discussionSession = ctx.sessionManager.getSessionId();
    if (pi.getActiveTools && pi.setActiveTools) {
      toolsBeforeDiscussion ??= pi.getActiveTools();
      pi.setActiveTools([...new Set(['read', 'grep', 'find', 'ls', 'surgical_spec'])]);
    }
    const prompt = `You are preparing a Surgical Dev Goal Specification. This is DISCUSSION ONLY: do not implement, edit files, write source, run checks or claim user approval. Read the repository instructions and relevant project files with the read-only tools. Ask only questions whose answers materially change scope, constraints, non-goals or independently testable acceptance criteria. When the boundaries are clear, call surgical_spec with goal, scope, non_goals, constraints and multiple independent acceptance_criteria (AC-N ids). The tool can only save a DRAFT; it cannot confirm consent. After saving, summarize the proposed boundaries and ask the user to review them and type /surgical confirm. If material ambiguity remains, ask the user instead of inventing an answer.\n\nInitial request:\n${goal}`;
    discussionSession = ctx.sessionManager.getSessionId();
    pi.sendMessage({ customType: 'surgical-discussion', content: prompt, display: true }, { triggerTurn: true });
    await ctx.waitForIdle();
    if (discussion && draftSpec) {
      pi.sendMessage({
        customType: 'surgical-spec-draft', display: true,
        content: `${formatSpec(draftSpec)}\n\nReview the latest draft, then type /surgical confirm. Implementation has not started.`,
        details: draftSpec,
      });
      displayedRevision = draftSpec.revision;
      displayedDigest = draftSpec.digest;
    }
  };

  const startRun = async (ctx) => {
    if (starting || !ctx.isIdle() || (active && (!TERMINAL.has(active.state.status) || active.busy))) {
      pi.sendMessage({ customType: 'surgical-status', content: 'An agent or Surgical Dev run is already active.', display: true });
      return;
    }
    if (draftSpec || discussion) {
      pi.sendMessage({ customType: 'surgical-status', content: 'A draft Goal Specification is pending. Review /surgical status, then /surgical confirm or /surgical discard before running.', display: true });
      return;
    }
    if (!confirmedSpec) {
      pi.sendMessage({ customType: 'surgical-status', content: 'No confirmed Goal Specification. Use /surgical discuss <goal> or /surgical import <requirements.md>, then /surgical confirm.', display: true });
      return;
    }
    persistFailure = null;
    const startup = new AbortController();
    starting = startup;
    let run;
    try {
      const { config, policyDigest } = await loadConfig(ctx.cwd);
      const version = await runProcess([...config.reviewerCommand, '--version'], { cwd: ctx.cwd, signal: startup.signal, timeoutMs: 10_000 });
      if (startup.signal.aborted) throw new Error('Startup cancelled');
      const match = version.stdout.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:\s|$)/);
      if (version.code !== 0 || !match || Number(match[1]) < 1 || (Number(match[1]) === 1 && (Number(match[2]) < 5 || (Number(match[2]) === 5 && Number(match[3]) < 2)))) {
        throw new Error('The Pi loop and reviewer require Pi v1.5.2 or later');
      }
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
      if (persistFailure) throw new Error(`Persistence failed: ${persistFailure.message}`);
      if (startup.signal.aborted) { await run.stop('CANCELLED', 'Startup cancelled'); return; }
      await scheduleRunPersist(ctx, run.state);
      await flushPersist();
      if (persistFailure) throw new Error(`Persistence failed: ${persistFailure.message}`);
      const prompt = `${worker}\n\n${discipline}\n\nSurgical Dev task ${active.state.id}\nConfirmed Goal Specification:\n${JSON.stringify(active.state.spec, null, 2)}\nRequired project check commands (argv): ${JSON.stringify(config.checks)}\n\nThis run uses one persistent Worker session and sequentially handles multiple Todos. Start in PLANNING unless a plan is already frozen. In planning, read the repository and call surgical_plan with a minimal Todo DAG. Every Todo must have id, goal, depends_on and ac_ids, and every original AC must be covered exactly once. Do not implement while planning. After the plan is accepted, implement only the current Todo, stop at the check boundary, repair real check failures in this same session, then continue to the next eligible Todo. Do not declare Todos done; the controller marks completion only from successful checks. Never approve your own implementation, change the confirmed scope or ACs, remove original Todos, weaken checks, change .surgical-dev.json, hide changes with ignore rules, push, merge, release or deploy. If the goal needs unavailable access or an unresolved product decision, explain the blocker. Stop at PR_READY unless delivery is separately authorized.\n\nBegin now.`;
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
        if (persistFailure && run.state.status === 'PR_READY') {
          run.state.status = 'BLOCKED';
          run.state.reason = `Persistence failed after acceptance: ${persistFailure.message}`;
          run.state.readySnapshot = null;
          run.readySnapshot = null;
          await scheduleRunPersist(ctx, run.state);
          await flushPersist();
        }
      }
      if (starting === startup) starting = undefined;
    }
    show();
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
            content: `${formatSpec(draft)}\n\nDraft only: it is not confirmed. Review this exact revision and type /surgical confirm.`,
            details: draft,
          });
          displayedRevision = draft.revision;
          displayedDigest = draft.digest;
          return {
            content: [{ type: 'text', text: `${formatSpec(draft)}\n\nDraft only: it is not confirmed. The user must review this exact revision and type /surgical confirm; a model cannot provide that consent.` }],
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
          if (persistFailure) {
            const reason = `Plan persistence failed: ${persistFailure.message}`;
            if (!TERMINAL.has(active.state.status)) await active.stop('BLOCKED', reason);
            else {
              active.state.status = 'BLOCKED';
              active.state.reason = reason;
              active.state.readySnapshot = null;
              active.readySnapshot = null;
              active.save();
            }
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
    description: 'Discuss/confirm a goal, then run the bounded Worker/Verifier loop: discuss <goal> | import <file> | confirm | run | status | stop | discard',
    handler: async (args, ctx) => {
      const [verb = 'status', ...parts] = args.trim().split(/\s+/);
      if (!verb || verb === 'status') { show(); return; }
      if (verb === 'stop') { await stop(ctx, 'CANCELLED', 'Stopped by user'); await flushPersist(); show(); return; }
      if (verb === 'discard') {
        if (active && !TERMINAL.has(active.state.status)) { pi.sendMessage({ customType: 'surgical-status', content: 'Stop the active run before discarding scope.', display: true }); return; }
        try {
          await mutateRepository(ctx, state => { state.draft_spec = null; return state; });
          discussion = false; draftSpec = null; displayedRevision = null; displayedDigest = null;
          if (pi.setActiveTools && toolsBeforeDiscussion) { pi.setActiveTools(toolsBeforeDiscussion); toolsBeforeDiscussion = undefined; }
          pi.sendMessage({ customType: 'surgical-status', content: 'Draft Goal Specification discarded. No implementation was started.', display: true });
        } catch (error) {
          pi.sendMessage({ customType: 'surgical-status', content: `Discard failed: ${error.message}`, display: true });
        }
        return;
      }
      if (verb === 'confirm') {
        if (active && !TERMINAL.has(active.state.status)) { pi.sendMessage({ customType: 'surgical-status', content: 'An implementation run is already active; confirmation cannot change its frozen scope.', display: true }); return; }
        if (!ctx.isIdle()) { pi.sendMessage({ customType: 'surgical-status', content: 'Finish the current agent turn before confirming scope.', display: true }); return; }
        if (!draftSpec) { pi.sendMessage({ customType: 'surgical-status', content: 'No draft Goal Specification to confirm. Use /surgical discuss or /surgical import first.', display: true }); return; }
        try {
          await reloadRepository(ctx);
          if (!draftSpec) throw new Error('No draft Goal Specification to confirm');
          if (draftSpec.revision !== displayedRevision || draftSpec.digest !== displayedDigest) {
            throw new Error(`The draft changed before confirmation (revision ${draftSpec.revision}). Review the full latest scope with /surgical status, then confirm again.`);
          }
          const confirmed = confirmSpec(draftSpec, ctx.sessionManager.getSessionId());
          await mutateRepository(ctx, state => { state.confirmed_spec = confirmed; state.draft_spec = null; return state; });
          confirmedSpec = confirmed;
          draftSpec = null;
          discussion = false;
          displayedRevision = confirmed.revision;
          displayedDigest = confirmed.digest;
          restoreDiscussionTools();
          pi.sendMessage({
            customType: 'surgical-status', display: true,
            content: `${formatSpec(confirmed)}\n\nConfirmed and frozen. Use /surgical run to start. Confirmation source: USER_COMMAND:/surgical confirm (${confirmed.confirmation.session_id}).`,
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
          pi.sendMessage({
            customType: 'surgical-spec-draft', display: true,
            content: `${formatSpec(draft)}\n\nImported without a redundant discussion turn. Review this exact revision, then type /surgical confirm. No implementation has started.`,
            details: draft,
          });
          displayedRevision = draft.revision;
          displayedDigest = draft.digest;
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
        pi.sendMessage({ customType: 'surgical-status', content: 'Usage: /surgical discuss <goal> | import <file> | confirm | run | status | stop | discard', display: true });
        return;
      }
      if (parts.length) {
        const requested = parts.join(' ');
        if (confirmedSpec && requested === confirmedSpec.goal) { await startRun(ctx); return; }
        try {
          await beginDiscussion(ctx, requested);
          pi.sendMessage({ customType: 'surgical-status', display: true, content: 'The requested goal does not exactly match the confirmed scope, so the old confirmation is invalid. This is requirement discussion only; use /surgical confirm then /surgical run after reviewing the draft.' });
        } catch (error) {
          pi.sendMessage({ customType: 'surgical-status', content: `Discussion could not start: ${error.message}`, display: true });
        }
        return;
      }
      if (draftSpec || discussion) {
        pi.sendMessage({ customType: 'surgical-status', display: true, content: 'A draft/discussion is pending. Review /surgical status, then /surgical confirm or /surgical discard before /surgical run without a goal.' });
        return;
      }
      await startRun(ctx);
    },
  });

  pi.on('before_agent_start', async (_event, ctx) => {
    if (postCompactionContext && active && !TERMINAL.has(active.state.status)) {
      postCompactionContext = false;
      const limit = active.state.config.maxPromptChars - POST_COMPACTION_PREFIX.length;
      if (limit < 1) {
        await stop(ctx, 'BLOCKED', `Post-compaction context prefix is ${POST_COMPACTION_PREFIX.length} chars, over the ${active.state.config.maxPromptChars}-char maxPromptChars budget; no context was injected.`);
        return;
      }
      const todo = active.state.todos.find(item => item.id === active.state.activeTodoId)
        ?? active.state.todos.find(item => item.state !== 'DONE');
      let content;
      try {
        content = todo
          ? buildWorkerContext(active.state, todo, limit)
          : `Surgical Dev state after compaction. Goal: ${active.state.spec.goal}. All required Todos are done; current status ${active.state.status}.`;
      } catch (error) {
        await stop(ctx, 'BLOCKED', `Post-compaction context could not be bounded safely: ${error.message}`);
        return;
      }
      const message = `${POST_COMPACTION_PREFIX}${content}`;
      if (message.length > active.state.config.maxPromptChars) {
        await stop(ctx, 'BLOCKED', `Post-compaction context is ${message.length} chars, over the ${active.state.config.maxPromptChars}-char maxPromptChars budget; no context was injected.`);
        return;
      }
      return { message: { customType: 'surgical-post-compaction', display: false, content: message } };
    }
    if (!discussion || active) return;
    return {
      message: {
        customType: 'surgical-discussion-context', display: false,
        content: `[SURGICAL DEV DISCUSSION ACTIVE] Requirement preparation only. Do not implement or edit source. Read relevant project files, ask only material ambiguities, and call surgical_spec to save a DRAFT structure. The user must explicitly type /surgical confirm; a tool cannot confirm.`,
      },
    };
  });

  pi.on('turn_start', async (_event, ctx) => {
    if (!active || TERMINAL.has(active.state.status)) return;
    active.state.turnsUsed++;
    active.state.usage.workerTurns = active.state.turnsUsed;
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
    if (persistFailure) {
      if (TERMINAL.has(active.state.status)) {
        active.state.status = 'BLOCKED';
        active.state.reason = `Persistence failed: ${persistFailure.message}`;
        active.state.readySnapshot = null;
        active.readySnapshot = null;
        active.save();
        await scheduleRunPersist(ctx, active.state);
        await flushPersist();
      } else {
        await active.stop('BLOCKED', `Persistence failed: ${persistFailure.message}`);
      }
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
    if (!active) return;
    active.workerRunning = false;
    if (event.aborted) await active.stop('CANCELLED', 'Agent abort observed at settlement; no continuation dispatched');
    else if (active.readySnapshot && !TERMINAL.has(active.state.status)) {
      try { await active.finish(); }
      catch (error) { await active.stop('BLOCKED', error.message); }
    }
    await scheduleRunPersist(ctx, active.state);
    await flushPersist();
    if (persistFailure && active.state.status === 'PR_READY') {
      active.state.status = 'BLOCKED';
      active.state.reason = `Persistence failed after acceptance: ${persistFailure.message}`;
      active.state.readySnapshot = null;
      active.readySnapshot = null;
      active.save();
      await scheduleRunPersist(ctx, active.state);
      await flushPersist();
      pi.sendMessage({ customType: 'surgical-status', display: true, content: `PR_READY was not reported because persistence failed: ${persistFailure.message}` });
    }
    if (TERMINAL.has(active.state.status)) await active.close();
  });

  pi.on('session_before_compact', async (_event, ctx) => {
    if (active) await scheduleRunPersist(ctx, active.state);
    await flushPersist();
    if (persistFailure && active && !TERMINAL.has(active.state.status)) {
      await active.stop('BLOCKED', `Persistence failed before compaction: ${persistFailure.message}`);
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
    repositoryLoaded = false;
    restoreDiscussionTools();
    try {
      const repository = await ensureRepository(ctx);
      draftSpec = repository.draft_spec ?? null;
      confirmedSpec = repository.confirmed_spec ?? null;
      // A persisted draft has not been shown in this session until /status or a
      // fresh display. Never turn persistence alone into confirmation consent.
      displayedRevision = null;
      displayedDigest = null;
      lastState = repository.run ?? null;
    } catch (error) {
      persistFailure = error;
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

  pi.on('session_before_switch', async (_event, ctx) => { await stop(ctx, 'CANCELLED', 'Session switched'); restoreDiscussionTools(); await flushPersist(); });
  pi.on('session_shutdown', async (_event, ctx) => { await stop(ctx, 'CANCELLED', 'Pi session shut down'); restoreDiscussionTools(); await flushPersist(); });
}
