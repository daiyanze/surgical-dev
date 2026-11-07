---
name: ship-feature
description: Use when an authorized Surgical Dev task introduces a feature or changes observable product behavior.
---

# ship-feature

For authorized Surgical Dev tasks only. Read the [Engineer role](../../roles/engineer.md)
and [workflow rules](../../references/workflow.md) as needed. Host capabilities
and real approvals, not this file, determine what can execute.

**When to use:** Feature development or behavior changes with a clear user benefit.

**Inputs and access:** User objective, repository, project rules, scope authorization, existing tests, and CI. Use only authorized read, write, and execution capabilities.

**Procedure:** Read the objective and current implementation → define testable acceptance criteria and non-goals → establish Scope Ready → plan, implement, test, and debug in the same coding session → retain evidence → open a draft PR when authorized → run CI → request independent acceptance review.

**Verification:** Map every acceptance criterion to evidence; confirm version alignment; stay within scope; ensure required checks pass.

**Return:** Code/PR, version, acceptance-criteria mapping, evidence, limitations, and actions awaiting approval.

**Approval:** New business scope, high-risk behavior, unauthorized external writes, merging, and publishing require approval.

## Return

Use the [work item](../../templates/work-item.md) where appropriate,
then return the evidence and outcome specified above. Unknown required evidence
remains unknown. Do not claim a missing tool, session, or Skill was executed.

Read the [shared team boundaries](../../roles/team-boundaries.md). Preserve parent
repair/resource budgets and original authorization across handoffs and resumes.
