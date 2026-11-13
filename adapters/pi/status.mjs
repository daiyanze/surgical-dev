// Pure status-text helpers: no Pi runtime, I/O or closure state.

export function formatSpec(spec) {
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
  if (spec.status === 'DRAFT') lines.push('DRAFT: no implementation is allowed. While idle, reply with the exact phrase 确认，开始 / confirm and start or use /surgical confirm to freeze this exact revision; a model tool cannot confirm.');
  return lines.join('\n');
}

const jsonOrUnknown = value => (typeof value === 'object' ? JSON.stringify(value) : 'UNKNOWN');

export function formatRunStatus(state) {
  if (!state) return ['No Surgical Dev run in this session.'];
  const done = state.todos.filter(todo => todo.state === 'DONE').length;
  const lines = [
    `Surgical Dev: ${state.status}`,
    state.reason ?? (state.status === 'PR_READY'
      ? `Checks and independent review passed for recorded tree ${state.readySnapshot?.tree}. Delivery was not performed.`
      : state.goal),
    `Todos: ${done}/${state.todos.length} done${state.activeTodoId ? `; current ${state.activeTodoId}` : ''}`,
    `Usage: turns ${state.turnsUsed}/${state.config.maxTurns}; checks ${state.checkAttempts}/${state.config.maxCheckAttempts}; reviews ${state.reviewAttempts}; repairs ${state.reviewRepairsUsed}/${state.config.maxReviewRepairCycles}; worker tokens ${jsonOrUnknown(state.usage?.tokens)}; reviewer tokens ${jsonOrUnknown(state.usage?.reviewer)}; total ${jsonOrUnknown(state.usage?.total_tokens)}`,
  ];
  if (state.learningWarnings?.length) lines.push(`Learning store warnings (do not affect approval): ${state.learningWarnings.join('; ')}`);
  return lines;
}

export function formatSpecStatus(spec) {
  if (!spec) return [
    'Start with /surgical <goal>. The agent reads the project, asks material questions and shows the full draft scope/non-goals/constraints/ACs before any implementation.',
    'Advanced commands: /surgical discuss <goal> | import <file> | confirm | run | status | stop | discard.',
  ];
  const lines = [formatSpec(spec)];
  if (spec.status === 'CONFIRMED') lines.push('Confirmed boundaries are frozen. Use /surgical run to start the Worker loop.');
  else lines.push('Review this full draft. Reply with 确认，开始 (or confirm and start) to confirm this exact revision and start automatically, or use /surgical confirm for the advanced command flow.');
  return lines;
}
