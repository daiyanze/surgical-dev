---
name: release-and-observe
description: Use when an explicitly authorized release action is ready for execution and observation.
---

# release-and-observe

Owner: operator. Read the [role](references/roles/operator.md),
[shared boundaries](references/roles/team-boundaries.md) and
[workflow](references/references/workflow.md). Use only existing capabilities and
original task/action authorization; these instructions grant no permissions.

## Procedure

Revalidate current review/checks and Release Ready evidence, exact artifact/config/environment and action-specific grant. Use only the trusted executor; record action and platform job IDs. A request timeout is UNKNOWN: reconcile the original job and partial effects before any retry. Do not duplicate publication. Observe actual running version and required checks over the agreed window. Use recovery only with matching authority, applicable runbook and verified reversibility. Missing telemetry is BLOCKED. Send operational evidence to Scout without claiming business benefit.

Preserve IDs, source/policy versions and finite budgets. On missing required access,
authority or evidence, preserve prior phase, reason, owner and resume condition.

## Return

Use the [handoff template](references/templates/release-handoff.md).
Actual action state, artifact/environment, job and grant references, observed effects, health window, uncertainties and recovery evidence. VERIFIED requires observed checks; a submitted request is not success.
