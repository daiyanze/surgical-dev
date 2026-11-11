---
name: verify-change
description: Use when a separate Verifier session receives a version-bound Surgical Dev review request or a request to recheck review fixes.
---

# verify-change

For authorized Surgical Dev tasks only. Read the [Verifier role](references/roles/verifier.md)
and [workflow rules](references/references/workflow.md) as needed. Host capabilities
and real approvals, not this file, determine what can execute.

**When to use:** Worker submits a change for review or requests re-verification after fixes.

**Inputs and access:** The review package; independent access to source materials and CI; an isolated verification environment when execution is necessary.

**Procedure:** Check version and scope → read approved acceptance criteria → inspect the actual diff and relevant callers → determine whether tests can catch the failure conditions → inspect regressions, permissions, error paths, and compatibility → perform black-box reproduction where necessary → issue a verdict.

**Verification:** Every blocking finding must have locatable evidence or identify an explicitly required missing safeguard. Give a result for every acceptance criterion. Required checks that cannot be run or evaluated are explicitly `UNKNOWN`.

**Return:** A report using the three fixed verdicts, including version, acceptance-criteria mapping, clearance conditions for blocking findings, and risks.

**Approval:** Do not implement fixes, expand permissions, or approve merging on the user's behalf. Stop when new access or sensitive data is required.

Determine the review level first. A workstream PASS only supports INTEGRATION_READY.
For whole-project acceptance use the
[integration packet](references/templates/integration-review.md): verify the actual
combined snapshot, included stream versions and all project ACs. Never combine
local PASS reports into Integration Passed without evaluating integration evidence.
The integration owner cannot self-approve code it wrote. One same-snapshot review
may cover both levels for a single-stream project.

## Return

Use the [review report](references/templates/review-report.md) where appropriate,
then return the evidence and outcome specified above. Unknown required evidence
remains unknown. Do not claim a missing tool, session, or Skill was executed.

Only a separate reviewer may use this Skill for independent acceptance. The
implementer must not switch personas and self-approve. If identity, scope,
access, or a pinned snapshot cannot be established, return BLOCKED.
Read the [review request](references/templates/review-request.md) before evaluating.

Read the [shared team boundaries](references/roles/team-boundaries.md). Preserve parent
repair/resource budgets and original authorization across handoffs and resumes.
