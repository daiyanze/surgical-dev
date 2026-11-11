---
name: prepare-release
description: Use when release preparation is requested for a specified candidate and environment.
---

# prepare-release

Owner: worker. Read the [role](references/roles/worker.md),
[shared boundaries](references/roles/team-boundaries.md) and
[workflow](references/references/workflow.md). Use only existing capabilities and
original task/action authorization; these instructions grant no permissions.

## Procedure

Inspect current independent project integration acceptance and required checks. Local workstream PASS reports are insufficient for a multi-stream project; bind the plan, included snapshots and combined candidate. Identify each necessary action and its original grant. Verify actual release source, trusted build/provenance, artifact digest, environment/configuration, observation checks/window and applicable recovery runbook. If the artifact is built after merge, record that dependency and wait for the authorized protected merge/build before declaring Release Ready. Assess irreversible effects; never assume rollback. Handle required source or pipeline changes in the Worker's implementation loop, rerun checks and obtain fresh independent Verifier acceptance before resuming preparation. Preparation performs no merge, tag, publication or deployment.

Preserve IDs, source/policy versions and finite budgets. On missing required access,
authority or evidence, preserve prior phase, reason, owner and resume condition.

## Return

Use the [release record](references/templates/release-handoff.md).
PLANNED, PRECHECKING or READY release plan with exact candidate, missing gates, risks and separately authorized actions. Never claim execution.
