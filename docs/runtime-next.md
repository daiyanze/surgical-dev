# Runtime implementation not included

This release is the split content layer. It contains no mock execution wrappers or
empty extensions pretending to provide a runtime. Do not register a missing file
in a plugin manifest.

A future adapter must implement and test independent reviewer sessions, observed
session provenance, version-bound evidence, controlled checks, state transitions,
rework accounting, duplicate suppression, and interrupted-run recovery. Keep
normal implementation in the existing main session.

The planned `surgeon_start_task`, `surgeon_check`, `surgeon_review`, and
`surgeon_status` interfaces are design names, not tools installed by this package.
One adapter is enough initially. Do not add multiple runtimes, a broker, or a
database merely because the content is portable.

Schemas validate record shape; they do not fetch CI, compare actual snapshots,
authenticate users, identify a real separate session, or enforce permissions.
A JSON PASS or approval reference is not proof. Runtime hooks only cover actions
routed through them; unrestricted shell or alternate credentials can bypass them.

Retain repository checks, branch protection, trusted approvals, least privilege,
and isolated environments as external controls. Passing a human-readable procedure
or static test never establishes production readiness.

Implement against tests that reject stale commits, dirty/untracked changes,
changed scope/check policy, unknown CI, self-authored reviewer identity, duplicate
runs, exhausted repair budgets, and unauthorized merge/release actions. Run real
with/without-Skill tasks before claiming behavioral effectiveness.
