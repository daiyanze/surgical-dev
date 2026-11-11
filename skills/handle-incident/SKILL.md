---
name: handle-incident
description: Use when an operational alert or incident requires triage, authorized containment and recovery.
---

# handle-incident

Owner: worker. Read the [role](references/roles/worker.md),
[shared boundaries](references/roles/team-boundaries.md) and
[workflow](references/references/workflow.md). Use only existing capabilities and
original task/action authorization; these instructions grant no permissions.

## Procedure

Deduplicate alerts and inspect actual version, impact and evidence. Separate symptoms from confirmed cause. Contain only within authorized runbook bounds; verify reversibility before rollback and reconcile unknown jobs before retry. Keep bounded source/pipeline/IaC repairs in the current Worker's implementation context, using fix-bug and independent Verifier acceptance; route another workstream's defect to its existing owner. Do not bypass review with a production hot patch or wait for Scout. Recheck release gates for repaired delivery and observe recovery. Never replay the known-bad release or silently start ongoing monitoring.

Preserve IDs, source/policy versions and finite budgets. On missing required access,
authority or evidence, preserve prior phase, reason, owner and resume condition.

## Return

Use the [incident record](references/templates/incident-packet.md).
Incident state, impact, confirmed facts, containment results, linked repair, recovery criteria and residual risks. CONTAINED is not RESOLVED; resolution needs observed recovery.
