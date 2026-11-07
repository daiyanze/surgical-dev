---
name: prepare-release
description: Use when the user explicitly requests release preparation for a specified version and target environment.
---

# prepare-release

For authorized Surgeon tasks only. Read the [Engineer role](../../roles/engineer.md)
and [workflow rules](../../references/workflow.md) as needed. Host capabilities
and real approvals, not this file, determine what can execute.

**When to use:** The user explicitly requests release preparation. Do not load this Skill by default for every feature task.

**Inputs and access:** Approved version, target environment, release method, current CI results, changelog, and rollback plan.

**Procedure:** Confirm the version to release → check compatibility and configuration → inspect the changelog and version number → organize release steps, risks, and rollback → request authorization for the relevant actions.

**Verification:** The preparation report and artifacts refer to the same version; necessary runtime checks and rollback prerequisites are actionable.

**Return:** A release checklist and risks. If execution has not occurred, report `PREPARED`, not `RELEASED`.

**Approval:** Tagging, creating a Release, publishing a package, and deploying to production each follow their specific authorization. Do not infer “publish now” from “prepare a release.”

## Return

Use the [task brief](../../templates/task-brief.md) where appropriate,
then return the evidence and outcome specified above. Unknown required evidence
remains unknown. Do not claim a missing tool, session, or Skill was executed.
