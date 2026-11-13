// Worker/reviewer token and cost accounting for a run.

function providerUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const number = value => Number.isFinite(value) ? value : null;
  const value = {
    input: number(usage.input) ?? number(usage.inputTokens),
    output: number(usage.output) ?? number(usage.outputTokens),
    total: number(usage.total) ?? number(usage.totalTokens),
    cost: number(usage.cost?.total) ?? number(usage.cost),
  };
  const available = ['input', 'output', 'total'].some(key => value[key] !== null && value[key] > 0);
  return available ? { ...value, cost_known: value.cost !== null } : null;
}

export function noteWorkerUsage(state, usage) {
  state.usage.calls.workerAssistant += 1;
  const measured = providerUsage(usage);
  if (!measured) {
    state.usage.worker_usage_complete = false;
    state.usage.worker_unreported = (state.usage.worker_unreported ?? 0) + 1;
    refreshUsageTotals(state);
    return false;
  }
  if (state.usage.tokens === 'UNKNOWN') {
    state.usage.tokens = { input: 0, output: 0, total: 0, cost: 0, calls: 0, cost_known: true };
  }
  const total = state.usage.tokens;
  for (const key of ['input', 'output', 'total']) if (measured[key] !== null) total[key] += measured[key];
  if (!measured.cost_known) state.usage.worker_cost_complete = false;
  total.cost = state.usage.worker_cost_complete ? total.cost + (measured.cost ?? 0) : 'UNKNOWN';
  total.calls += 1;
  total.cost_known = state.usage.worker_cost_complete;
  refreshUsageTotals(state);
  return true;
}

export function aggregateUsage(events) {
  let totals = null, calls = 0, measured = 0, missing = 0, costComplete = true;
  for (const event of events) {
    if (event.type !== 'message_end' || event.message?.role !== 'assistant') continue;
    calls++;
    const usage = providerUsage(event.message.usage);
    if (!usage) { missing++; continue; }
    measured++;
    if (!totals) totals = { input: 0, output: 0, total: 0, cost: 0, calls: 0, cost_known: true };
    for (const key of ['input', 'output', 'total']) if (usage[key] !== null) totals[key] += usage[key];
    if (!usage.cost_known) costComplete = false;
    totals.cost = costComplete ? totals.cost + (usage.cost ?? 0) : 'UNKNOWN';
    totals.calls++;
  }
  if (totals) totals.cost_known = costComplete;
  return {
    usage: totals ?? 'UNKNOWN',
    calls,
    complete: calls > 0 && missing === 0 && measured === calls && costComplete,
  };
}

export function refreshUsageTotals(state) {
  const worker = state.usage.tokens;
  const reviewer = state.usage.reviewer;
  const complete = state.usage.worker_usage_complete === true
    && state.usage.reviewer_usage_complete === true
    && state.usage.worker_cost_complete === true
    && state.usage.reviewer_cost_complete === true;
  if (!complete || worker === 'UNKNOWN' || reviewer === 'UNKNOWN' || !worker || !reviewer
      || typeof worker.cost !== 'number' || typeof reviewer.cost !== 'number') {
    state.usage.total_tokens = 'UNKNOWN';
    return;
  }
  state.usage.total_tokens = {
    input: worker.input + reviewer.input,
    output: worker.output + reviewer.output,
    total: worker.total + reviewer.total,
    cost: worker.cost + reviewer.cost,
    worker_calls: worker.calls,
    reviewer_calls: reviewer.calls,
  };
}

export function accumulateReviewerUsage(state, review) {
  const incoming = review.reviewer_usage ?? 'UNKNOWN';
  const complete = review.reviewer_usage_complete === true && incoming !== 'UNKNOWN';
  state.usage.calls.reviewer = (state.usage.calls.reviewer ?? 0) + (review.reviewer_calls ?? 0);
  if (state.usage.reviewer_seen !== true) {
    state.usage.reviewer_seen = true;
    state.usage.reviewer = incoming === 'UNKNOWN' ? 'UNKNOWN' : { ...incoming };
    state.usage.reviewer_usage_complete = complete;
    state.usage.reviewer_cost_complete = complete && typeof incoming.cost === 'number';
  } else if (incoming !== 'UNKNOWN') {
    if (state.usage.reviewer === 'UNKNOWN') state.usage.reviewer = { ...incoming };
    else {
      const total = state.usage.reviewer;
      for (const key of ['input', 'output', 'total']) total[key] += incoming[key] ?? 0;
      total.calls = (total.calls ?? 0) + (incoming.calls ?? 0);
      if (state.usage.reviewer_cost_complete === true && typeof incoming.cost === 'number') total.cost += incoming.cost;
      else { state.usage.reviewer_cost_complete = false; total.cost = 'UNKNOWN'; }
    }
    state.usage.reviewer_usage_complete = state.usage.reviewer_usage_complete === true && complete;
  } else {
    state.usage.reviewer_usage_complete = false;
  }
  refreshUsageTotals(state);
}
