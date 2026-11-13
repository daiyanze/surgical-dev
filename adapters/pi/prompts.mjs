// Stateless text and checks used by the /surgical extension (no shared closure state).
import { buildWorkerContext } from './spec.mjs';

export const POST_COMPACTION_PREFIX = '[POST-COMPACTION CURRENT TASK CONTEXT]\n';
const MIN_PI = [1, 5, 2];

export function assertPiVersion(version) {
  const match = version.stdout.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:\s|$)/);
  const parts = match?.slice(1).map(Number);
  const diff = parts?.map((part, i) => part - MIN_PI[i]).find(d => d !== 0) ?? 0;
  if (version.code !== 0 || !parts || diff < 0) throw new Error('The Pi loop and reviewer require Pi v1.5.2 or later');
}

export const discussionPrompt = goal => `You are preparing a Surgical Dev Goal Specification. This is DISCUSSION ONLY: do not implement, edit files, write source, run checks or claim user approval. Read the repository instructions and relevant project files with the read-only tools. Ask only questions whose answers materially change scope, constraints, non-goals or independently testable acceptance criteria. When the boundaries are clear, call surgical_spec with goal, scope, non_goals, constraints and multiple independent acceptance_criteria (AC-N ids). The tool can only save a DRAFT; it cannot confirm consent. After saving, summarize the proposed boundaries and ask the user to review the exact full draft. The user can reply with the exact phrase 确认，开始 (or confirm and start) to confirm and start automatically, or use /surgical confirm for the advanced command flow. If material ambiguity remains, ask the user instead of inventing an answer.\n\nInitial request:\n${goal}`;

export const workerPrompt = ({ worker, discipline, state, checks }) => `${worker}\n\n${discipline}\n\nSurgical Dev task ${state.id}\nConfirmed Goal Specification:\n${JSON.stringify(state.spec, null, 2)}\nRequired project check commands (argv): ${JSON.stringify(checks)}\n\nThis run uses one persistent Worker session and sequentially handles multiple Todos. Start in PLANNING unless a plan is already frozen. In planning, read the repository and call surgical_plan with a minimal Todo DAG. Every Todo must have id, goal, depends_on and ac_ids, and every original AC must be covered exactly once. Do not implement while planning. After the plan is accepted, implement only the current Todo, stop at the check boundary, repair real check failures in this same session, then continue to the next eligible Todo. Do not declare Todos done; the controller marks completion only from successful checks. Never approve your own implementation, change the confirmed scope or ACs, remove original Todos, weaken checks, change .surgical-dev.json, hide changes with ignore rules, push, merge, release or deploy. If the goal needs unavailable access or an unresolved product decision, explain the blocker. Stop at PR_READY unless delivery is separately authorized.\n\nBegin now.`;

// Returns { message } to inject, or { blocked } with the reason the run must stop.
export function postCompactionMessage(state) {
  const budget = state.config.maxPromptChars;
  const limit = budget - POST_COMPACTION_PREFIX.length;
  if (limit < 1) return { blocked: `Post-compaction context prefix is ${POST_COMPACTION_PREFIX.length} chars, over the ${budget}-char maxPromptChars budget; no context was injected.` };
  const todo = state.todos.find(item => item.id === state.activeTodoId) ?? state.todos.find(item => item.state !== 'DONE');
  let content;
  try {
    content = todo
      ? buildWorkerContext(state, todo, limit)
      : `Surgical Dev state after compaction. Goal: ${state.spec.goal}. All required Todos are done; current status ${state.status}.`;
  } catch (error) {
    return { blocked: `Post-compaction context could not be bounded safely: ${error.message}` };
  }
  const message = `${POST_COMPACTION_PREFIX}${content}`;
  if (message.length > budget) return { blocked: `Post-compaction context is ${message.length} chars, over the ${budget}-char maxPromptChars budget; no context was injected.` };
  return { message };
}
