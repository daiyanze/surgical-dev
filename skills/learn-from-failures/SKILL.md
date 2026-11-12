---
name: learn-from-failures
description: Use when the same evidenced defect, check failure, review finding or product misunderstanding recurs, to turn a verified fix into scoped and revisable prevention guidance.
---

# Learn from failures — cross-role Learning Loop

This is a **method**, not a new role, approval authority or mandatory ceremony.
Read the [learning workflow](references/references/learning.md) and preserve
the [shared role boundaries](references/roles/team-boundaries.md).

1. **Observe evidence, not a story.** Product Scout identifies repeated
   source-linked user problems or mistaken assumptions; Worker sees failed
   project checks or incidents; Verifier reports concrete independent findings.
   Record the original source, affected goal/snapshot, and a stable problem
   signature. Do not equate similar wording with a proven shared root cause.
2. **Escalate a pattern to a candidate, never to a veto.** Two matching
   occurrences trigger an optional learning pass. The owning Worker finds the
   supported root cause, a narrow prevention rule, where it applies, and a
   project-specific way to validate it. If evidence is insufficient, leave the
   observation unresolved. Scout and Verifier contribute evidence; they do not
   approve code, change scope or self-promote lessons.
3. **Verify before reuse.** Run the original project checks and obtain the
   independent Verifier's PASS on the *current* candidate. Pi promotes a
   proposed recurring-issue candidate only after the normal PR_READY gate.
   A suggested rule cannot replace checks, approved ACs, or user authority.
4. **Apply selectively, revise openly.** Load only rules relevant to the
   current goal and scope, at most three brief hints, always marked advisory
   lower-trust context. If an active rule fails to prevent recurrence, mark it
   NEEDS_REVISION and seek new evidence rather than imposing a stronger gate.
5. **Share deliberately.** Pi stores observations locally in the Git common
   directory, not in source files. To share a lesson with collaborators, review
   and copy a sanitized version using the [lesson template](references/templates/lesson.md)
   into the project's tracked docs in a separately authorized change.

## Pi automatic behavior

With the full Pi extension, real check failures and independent
CHANGES_REQUIRED blocking findings create bounded observations automatically.
After a repeated signature, Worker sees a record ID and may call
`surgical_lesson` with `record_id`, `root_cause`, `preventative_rule`,
`scope`, `tags` and `validation`. A candidate from this run becomes ACTIVE
only after final acceptance. Recurrence despite an ACTIVE lesson marks it
NEEDS_REVISION. The store is `<git-common-dir>/surgical-dev/learning.json`;
it is **not shared between clones** or silently committed. Learning errors
remain visible warnings, not acceptance blockers.
The optional `/surgical lessons` command lists recent local record IDs, counts
and statuses without adding them to the working tree.

On other hosts, or for Scout observations outside Pi's check/review events,
follow these steps manually with dated evidence and project-approved records.
Never claim automatic observation, persistent memory or verified prevention if
the host does not provide it.

## Return

Return the original issue and evidence references, recurrence count, supported
cause (or uncertainty), scoped preventive rule and observable validation, current
lesson status and any known counterexamples. Report what the runtime actually
stored or reused, never pretend the candidate is an independent review PASS.
