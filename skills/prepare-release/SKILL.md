---
name: prepare-release
description: Use when release preparation is requested for a specified candidate and environment.
---

# prepare-release

Owner: operator. Read the [role](../../roles/operator.md),
[shared boundaries](../../roles/team-boundaries.md) and
[workflow](../../references/workflow.md). Use only existing capabilities and
original task/action authorization; these instructions grant no permissions.

## Procedure

Inspect current independent review and required checks. Identify each necessary action and its original grant. Verify actual release source, trusted build/provenance, artifact digest, environment/configuration, observation checks/window and applicable recovery runbook. If the artifact is built after merge, record that dependency and wait for the authorized protected merge/build before declaring Release Ready. Assess irreversible effects; never assume rollback. Return source or pipeline changes to Engineer and Verifier. Preparation performs no merge, tag, publication or deployment.

Preserve IDs, source/policy versions and finite budgets. On missing required access,
authority or evidence, preserve prior phase, reason, owner and resume condition.

## Return

Use the [handoff template](../../templates/release-handoff.md).
PLANNED, PRECHECKING or READY release plan with exact candidate, missing gates, risks and separately authorized actions. Never claim execution.
