---
name: learn-from-failures
description: Use when the same evidenced defect, check failure or review finding recurs, to turn a verified fix into scoped, revisable prevention guidance.
---

# Learn from failures

This is a manual method, not a role, approval authority or mandatory ceremony.
Read the [learning reference](references/references/learning.md) and preserve the
[shared role boundaries](references/roles/team-boundaries.md).

1. **Observe evidence, not a story.** Record the source (failing check output, review
   finding, issue or log), the affected snapshot and a stable problem signature. Do not
   equate similar wording with a proven shared root cause.
2. **Investigate, do not gate.** Two matching occurrences justify an investigation. The
   owning Worker identifies the supported cause (or states the uncertainty), a narrow
   preventive rule, where it applies and how to validate it. If evidence is insufficient,
   leave the observation open. Nothing here approves code, changes scope or grants authority.
3. **Verify before reuse.** Run the project's own checks and obtain an independent
   Verifier PASS on the current candidate before relying on the rule. A suggested rule
   cannot replace checks, approved acceptance criteria or user authority.
4. **Apply selectively, revise openly.** Apply a rule only where it is relevant, always as
   advisory, lower-trust context. If it does not prevent recurrence, revise it with new
   evidence rather than adding a stronger gate.
5. **Share deliberately.** Write a lesson with the [lesson template](references/templates/lesson.md)
   and commit a sanitized copy only after human review. Do not copy local learning data
   from Git metadata into tracked files.

## Pi behavior

With the Pi extension, configured check failures and blocking Verifier findings are counted
locally in `<git-common-dir>/surgical-dev/learning.json`. On the second occurrence the Worker's
repair feedback gets one advisory line. Pi does not record product or incident observations,
does not create lesson records and does not change acceptance. On other hosts, follow these
steps by hand. Never claim automatic observation or persistent memory that the host does not
provide.

## Return

Return the original issue and evidence references, recurrence count, supported cause (or
uncertainty), scoped preventive rule with its validation, and any known counterexamples.
Report what was actually recorded or reused. Do not present a suggested rule as an
independent PASS.
