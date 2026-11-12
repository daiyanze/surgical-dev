# Learning — advisory records from repeated failures

Purpose: when the same check failure or blocking review finding recurs, give the next
repair attempt a visible hint. Learning never creates a gate, changes acceptance criteria,
grants permission or overrides an independent review.

## What Pi records

For each normalized failure signature, the Pi extension keeps a short label and an
occurrence count. Two kinds of event are counted:

- a configured project check that fails (the label combines the command with a sanitized
  summary of its output);
- a blocking finding from the independent Verifier (the label combines the impact and location).

Secrets are redacted before storage. Full logs, model transcripts and customer data are not
stored.

## Where records live

Records are written atomically to `<git-common-dir>/surgical-dev/learning.json`. That path is
outside the source snapshot, so learning does not change the candidate. The file is shared by
local worktrees of one repository. It is never committed, and it does not sync between clones.

## What the Worker sees

When a signature reaches its second occurrence, the Worker's repair feedback includes one
advisory line that begins `LEARNING (advisory, not a gate):` and gives the label and the count. The Worker decides whether the recurrence
points to a cause worth investigating. Nothing else is injected at the start of a run.

## What learning does not do

- It does not change acceptance criteria, checks, scope or budgets.
- It does not block `PR_READY`. Storage errors are reported as warnings.
- It has no proposal tool, no lesson lifecycle and no promotion step.
- It does not copy records between clones or into tracked files.

Users can list the latest 20 records with `/surgical lessons`, which shows the label, kind,
count and last-seen time.

## Portable manual method

Other hosts, and observations that Pi does not see (for example, a repeated product
misunderstanding), can follow the manual steps in the learn-from-failures Skill. Record a
shared lesson with the [lesson template](../templates/lesson.md) only after human review,
and keep it free of secrets, customer data and raw logs. Treat any such lesson as lower-trust
guidance that cannot override current scope, project checks or an independent Verifier.
