// surgical_spec and surgical_plan tools.
import { adjustRunPlan, planTodos, TERMINAL } from './loop.mjs';
import { formatSpec } from './status.mjs';
import { PLAN_PARAMETERS, SPEC_PARAMETERS } from './tool-schemas.mjs';

export function registerTools(pi, { s, store, scheduleRunPersist, flushPersist, blockOnPersistenceFailure, markDisplayed, readDraft }) {
  if (pi.registerTool) {
    pi.registerTool({
      name: 'surgical_spec',
      label: 'Save draft Goal Specification',
      description: 'Save a DRAFT Goal Specification during Surgical Dev requirement discussion. This cannot confirm user consent.',
      parameters: SPEC_PARAMETERS,
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        try {
          if (s.active && !TERMINAL.has(s.active.state.status)) throw new Error('A confirmed implementation run is active; scope cannot change');
          if (!s.discussion || ctx.sessionManager.getSessionId() !== s.discussionSession) throw new Error('surgical_spec is only available during /surgical discuss');
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
          if (!s.active || TERMINAL.has(s.active.state.status)) throw new Error('No active run');
          if (ctx.sessionManager.getSessionId() !== s.active.state.workerSessionId) throw new Error('Only the owning Worker session can plan');
          const operation = params.operation ?? 'initial';
          let state;
          if (operation === 'initial') {
            if (!Array.isArray(params.todos) || params.todos.length === 0) throw new Error('Initial planning needs todos');
            state = planTodos(s.active, params.todos);
          } else {
            state = adjustRunPlan(s.active, params);
          }
          await scheduleRunPersist(ctx, state);
          await flushPersist();
          if (store.failure) {
            const reason = `Plan persistence failed: ${store.failure.message}`;
            await blockOnPersistenceFailure(s.active, reason);
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
}
