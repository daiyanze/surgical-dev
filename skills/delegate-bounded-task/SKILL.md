---
name: delegate-bounded-task
description: Use when an active Surgeon task contains an independent investigation or a subtask with stable interfaces and isolated file ownership.
---

# delegate-bounded-task

For authorized Surgeon tasks only. Read the [Engineer role](../../roles/engineer.md)
and [workflow rules](../../references/workflow.md) as needed. Host capabilities
and real approvals, not this file, determine what can execute.

**When to use:** Independent research, processing source material that would consume substantial context, or parallel implementation with stable interface and file boundaries.

**Inputs and access:** A complete delegation package, isolated working directory, and the minimum access required.

**Procedure:** Determine whether delegation has a real benefit → check dependencies and conflicts → assign one clearly accountable Worker → obtain evidence → have Engineer inspect and integrate the result → rerun affected checks.

**Verification:** Confirm that the result meets the criteria, uses the correct version, and stays within the allowed file scope. A Worker's completion claim does not mean the result is ready to integrate.

**Return:** Concise findings, evidence and code references, limitations, and blockers.

**Approval:** No recursive delegation. No changes to shared interfaces or production systems, and no publishing. Additional resource consumption must remain within existing authorization.

## Return

Use the [worker handoff](../../templates/worker-handoff.md) where appropriate,
then return the evidence and outcome specified above. Unknown required evidence
remains unknown. Do not claim a missing tool, session, or Skill was executed.

The dispatched executor also receives the [Worker role](../../roles/worker.md).
No Worker is created by installing this Skill. Keep the work in the main session
when independence or safe isolation cannot be established.
