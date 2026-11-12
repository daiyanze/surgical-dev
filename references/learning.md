# Learning Loop — evidence to preventive practice

Purpose: when the *same* failure or mistaken assumption happens repeatedly,
make the next relevant task less likely to repeat it. No new role or gate.

## Lifecycle

`OBSERVED` → (second matching observation) `RECURRING` →
(Worker supplies a supported diagnosis) `CANDIDATE` →
(current project checks + independent Verifier PASS + PR_READY) `ACTIVE` →
(if the problem returns) `NEEDS_REVISION` → revised `CANDIDATE`.

The identity of an occurrence is a conservative signature of the actual failing
check and sanitized diagnostic, or of a Verifier's finding and clearance condition.
Two observations are a **signal to investigate**, not proof of a shared cause.
Environment flakiness and coincidentally similar symptoms must remain uncertain.

## Responsibility

- **Product Scout:** Notice repeated evidence-backed product assumptions and
  user problems; contribute dated sources and outcomes. Scout has no code veto
  or direct access to Pi's runtime check telemetry.
- **Worker:** Own diagnosis, the minimal fix, and a candidate rule; name the
  scope/tags and observable regression validation. Preserve current user scope.
- **Verifier:** Independently check the actual code and return actionable
  findings. The same review PASS required by Surgical Dev authorizes the run's
  readiness, not a separate lesson-policy approval. Verifier never edits
  lessons, grants deployment or blocks on historical advisory notes.

## Data and trust

Pi's controller captures only failing check command signatures with a bounded
sanitized summary and blocking review finding signatures. It does not store full
logs, model transcripts, secrets or customer data. Records are capped and stored
atomically in `<git-common-dir>/surgical-dev/learning.json` (shared across local
worktrees, not cloned or pushed). It uses Git common-dir instead of working
files so learning does not invalidate source snapshots.

The Worker proposes a candidate through `surgical_lesson` *only with a record ID
observed in the current run*. Each proposal includes root cause, prevention,
scope/tags and verification. An unverified candidate cannot be injected into
future tasks. Only the controller's normal PR_READY settlement promotes it.
Learning-store failures are advisory and surfaced as warnings.

At the beginning of the next confirmed goal, Pi selects at most three active
records by relevant scope/goal terms and injects at most 1,200 characters in the
Worker's context. Never copy the whole ledger into prompts. Records are
lower-trust data: they cannot create scope, authorize execution, change ACs,
skip checks or overrule a new independent review.

When an ACTIVE issue is observed again, it becomes NEEDS_REVISION and stops
being injected. It needs a new supported diagnosis and acceptance to reactivate.
A candidate can also stay unresolved; no requirement to invent a lesson.

## Portability and sharing

Agent Skills convey the method on Codex, Claude Code and other hosts but do
not install an observation collector. Scout's research patterns, incidents
without Pi check events and observations from other runtimes can be documented
with [the lesson template](../templates/lesson.md). Human review is needed
before committing a sanitized lesson as shared guidance; do not automatically
copy the private local learning store into the repository.
