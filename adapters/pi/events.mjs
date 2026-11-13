// Pi lifecycle event handlers for the /surgical loop.
import { advanceRun, noteWorkerUsage, STATE_ENTRY, TERMINAL } from './loop.mjs';
import { isExplicitConfirmation } from './confirmation.mjs';
import { INPUT_CONFIRMATION_SOURCE } from './spec.mjs';
import { postCompactionMessage } from './prompts.mjs';
import { formatSpec } from './status.mjs';

export function registerEvents(pi, { s, store, scheduleRunPersist, flushPersist, blockOnPersistenceFailure, restoreDiscussionTools, clearDisplayed, markDisplayed, confirmDisplayedDraft, stop }) {
  pi.on('input', async (event, ctx) => {
    const userBoundary = event.source === 'interactive' || event.source === 'rpc';
    if (!isExplicitConfirmation(event.text)) {
      if (userBoundary && s.draftSpec && s.displayedRevision !== null) clearDisplayed();
      return { action: 'continue' };
    }
    const workflowActive = Boolean(s.draftSpec || s.discussion || s.starting || s.confirmationJob || (s.active && !TERMINAL.has(s.active.state.status)));
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
    if (s.postCompactionContext && s.active && !TERMINAL.has(s.active.state.status)) {
      s.postCompactionContext = false;
      const { message, blocked } = postCompactionMessage(s.active.state);
      if (blocked) { await stop(ctx, 'BLOCKED', blocked); return; }
      return { message: { customType: 'surgical-post-compaction', display: false, content: message } };
    }
    if (!s.discussion || s.active) return;
    return {
      message: {
        customType: 'surgical-discussion-context', display: false,
        content: `[SURGICAL DEV DISCUSSION ACTIVE] Requirement preparation only. Do not implement or edit source. Read relevant project files, ask only material ambiguities, and call surgical_spec to save a DRAFT structure. The user must explicitly confirm with 确认，开始 / confirm and start or /surgical confirm; a tool cannot confirm.`,
      },
    };
  });

  pi.on('turn_start', async (_event, ctx) => {
    if (!s.active || TERMINAL.has(s.active.state.status)) return;
    s.active.state.turnsUsed++;
    s.active.save();
    if (s.active.state.turnsUsed > s.active.state.config.maxTurns) await stop(ctx, 'ESCALATED', 'Worker turn budget exhausted');
  });

  pi.on('tool_execution_end', async (event) => {
    if (!s.active || TERMINAL.has(s.active.state.status)) return;
    s.active.state.usage.calls.workerToolCalls = (s.active.state.usage.calls.workerToolCalls ?? 0) + 1;
    if (event.toolName === 'surgical_plan') s.active.state.usage.planCalls = (s.active.state.usage.planCalls ?? 0) + 1;
    s.active.save();
  });

  pi.on('message_end', async (event) => {
    if (!s.active || TERMINAL.has(s.active.state.status) || event.message?.role !== 'assistant') return;
    noteWorkerUsage(s.active.state, event.message.usage);
    s.active.save();
  });

  pi.on('agent_before_settle', async (event, ctx) => {
    if (!s.active || TERMINAL.has(s.active.state.status)) return;
    if (ctx.sessionManager.getSessionId() !== s.active.state.workerSessionId) {
      await s.active.stop('BLOCKED', 'Worker session changed');
      return;
    }
    if (event.outcome !== 'completed') {
      await s.active.stop(event.outcome === 'aborted' ? 'CANCELLED' : 'BLOCKED', `Worker ended with ${event.outcome}`);
      return;
    }
    if (event.continue || event.context.pendingMessages.length || ctx.hasPendingMessages()) return;
    const result = await advanceRun(s.active);
    await scheduleRunPersist(ctx, s.active.state);
    await flushPersist();
    if (store.failure) {
      await blockOnPersistenceFailure(s.active, `Persistence failed: ${store.failure.message}`);
      return;
    }
    if (result.action === 'continue') {
      if (s.active.state.turnsUsed >= s.active.state.config.maxTurns) {
        await s.active.stop('ESCALATED', 'No further Worker turn is available; feedback retained');
        return;
      }
      return {
        entries: [...event.entries, { type: 'custom_message', customType: 'surgical-feedback', content: result.feedback, display: false }],
        continue: true,
      };
    }
  });

  pi.on('agent_settled', async (event, ctx) => {
    if (!event.aborted && s.discussion && s.draftSpec && (!s.active || TERMINAL.has(s.active.state.status))) {
      const sessionId = ctx.sessionManager.getSessionId();
      const alreadyShown = s.displayedSessionId === sessionId
        && s.displayedRevision === s.draftSpec.revision
        && s.displayedDigest === s.draftSpec.digest;
      if (!alreadyShown) {
        pi.sendMessage({
          customType: 'surgical-spec-draft', display: true,
          content: `${formatSpec(s.draftSpec)}\n\nReview this full latest draft. Reply with 确认，开始 (or confirm and start) to confirm this exact revision and start automatically; /surgical confirm remains available. No implementation has started.`,
          details: s.draftSpec,
        });
        markDisplayed(s.draftSpec, ctx);
      }
    }
    if (!s.active) return;
    s.active.workerRunning = false;
    if (event.aborted) await s.active.stop('CANCELLED', 'Agent abort observed at settlement; no continuation dispatched');
    else if (s.active.state.readySnapshot && !TERMINAL.has(s.active.state.status)) {
      try { await s.active.finish(); }
      catch (error) { await s.active.stop('BLOCKED', error.message); }
    }
    await scheduleRunPersist(ctx, s.active.state);
    await flushPersist();
    if (store.failure && s.active.state.status === 'PR_READY') {
      await blockOnPersistenceFailure(s.active, `Persistence failed after acceptance: ${store.failure.message}`);
      pi.sendMessage({ customType: 'surgical-status', display: true, content: `PR_READY was not reported because persistence failed: ${store.failure.message}` });
    }
    if (TERMINAL.has(s.active.state.status)) await s.active.close();
  });

  pi.on('session_before_compact', async (_event, ctx) => {
    if (s.active) await scheduleRunPersist(ctx, s.active.state);
    await flushPersist();
    if (store.failure && s.active && !TERMINAL.has(s.active.state.status)) {
      await s.active.stop('BLOCKED', `Persistence failed before compaction: ${store.failure.message}`);
    }
    // Preserve Pi's own generated compaction summary. The file-backed plan is
    // injected as bounded current-task context once after compaction.
  });

  pi.on('session_compact', async () => {
    if (s.active && !TERMINAL.has(s.active.state.status)) s.postCompactionContext = true;
  });

  pi.on('session_start', async (_event, ctx) => {
    s.active = undefined;
    s.discussion = false;
    s.postCompactionContext = false;
    store.invalidate();
    restoreDiscussionTools();
    try {
      const repository = await store.ensure(ctx.cwd);
      s.draftSpec = repository.draft_spec ?? null;
      s.confirmedSpec = repository.confirmed_spec ?? null;
      // A persisted draft has not been shown in this session until /status or a
      // fresh display. Never turn persistence alone into confirmation consent.
      clearDisplayed();
      s.lastState = repository.run ?? null;
    } catch (error) {
      store.setFailure(error);
      const entries = ctx.sessionManager.getEntries();
      s.lastState = entries.filter(entry => entry.type === 'custom' && entry.customType === STATE_ENTRY).at(-1)?.data;
      pi.sendMessage({ customType: 'surgical-status', display: true, content: `Surgical Dev state could not be loaded: ${error.message}` });
    }
    if (s.lastState && !TERMINAL.has(s.lastState.status)) {
      // Observational only: do not overwrite another live session's shared run
      // state. The existing run lock governs ownership and recovery.
      s.lastState = {
        ...s.lastState,
        status: 'BLOCKED',
        reason: 'Previous run was interrupted or is owned by another session. Inspect its processes and repository lock; automatic restart recovery is not enabled.',
        interruption: { detected_at: new Date().toISOString(), previous_status: s.lastState.status },
      };
      pi.appendEntry(STATE_ENTRY, s.lastState);
    }
  });

  pi.on('session_before_switch', async (_event, ctx) => { await stop(ctx, 'CANCELLED', 'Session switched'); restoreDiscussionTools(); clearDisplayed(); await flushPersist(); });
  pi.on('session_shutdown', async (_event, ctx) => { await stop(ctx, 'CANCELLED', 'Pi session shut down'); restoreDiscussionTools(); clearDisplayed(); await flushPersist(); });
}
