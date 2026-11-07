---
name: fix-bug
description: Use when an authorized Surgical Dev task concerns a reproducible defect, regression, failing test, or unexpected behavior.
---

# fix-bug

For authorized Surgical Dev tasks only. Read the [Engineer role](../../roles/engineer.md)
and [workflow rules](../../references/workflow.md) as needed. Host capabilities
and real approvals, not this file, determine what can execute.

**When to use:** Observable defects, regressions, failing tests, or unexpected behavior.

**Inputs and access:** Failure symptoms, expected behavior, environment, and reproduction information. Do not treat an unverified hypothesis as the root cause.

**Procedure:** Reproduce or gather evidence → narrow down the cause → make the smallest fix → add regression protection → rerun the original reproduction and related tests → request independent acceptance review. Keep debugging and fixing in one context.

**Verification:** Explain how the failure occurs and how the change removes it. Where applicable, demonstrate that the regression test fails before the fix and passes afterward. State explicitly when that comparison cannot be performed safely.

**Return:** Root-cause evidence, minimal changes, re-verification results, and remaining limitations.

**Approval:** Do not “fix” a problem by changing product rules, deleting tests, relaxing thresholds, or altering security configuration without approval.

## Return

Use the [work item](../../templates/work-item.md) where appropriate,
then return the evidence and outcome specified above. Unknown required evidence
remains unknown. Do not claim a missing tool, session, or Skill was executed.

Read the [shared team boundaries](../../roles/team-boundaries.md). Preserve parent
repair/resource budgets and original authorization across handoffs and resumes.
