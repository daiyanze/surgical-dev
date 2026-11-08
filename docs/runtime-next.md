# Runtime work still needed

The content pack provides four role types, thirteen methods, goal/plan/integration
templates and record/state specifications. It does not implement an autonomous runtime.

Use one workflow owner: Grok-native for the first capability pilot, or a future
runtime-owned loop, never two competing planners/review loops. Reuse existing
host/CI facilities; the controller is ordinary code, not a fifth Bot.

Required controller behavior:

- Accept goals and authority, then have Engineer generate the technical plan; do
  not require user-written task partitions or assignments.
- Validate an acyclic dependency graph and accepted input snapshots; resolve real
  Engineer/Verifier execution identities and safe workspaces.
- Claim ready streams atomically within project/global capacity. Check file,
  contract and shared-resource conflicts; apply review/integration backpressure.
- Keep one implementation owner per stream and one Engineer integration owner.
  Helpers are auxiliary jobs under the same aggregate budget, not recursive teams.
- Persist plan/task/event/action IDs, leases, counters and cancellation. An expired
  lease or timeout requires job reconciliation before rescheduling, not duplication.
- Collect actual stream checks and independent reviews; then require version-bound
  project integration evidence before PR_READY. Reject stale/self-authored approvals.
- Preserve scope, repair history and total usage during replanning/reassignment.
  Unsupported parallel execution falls back to serial; absent review blocks.
- Use scoped external action executors and observed delivery outcomes; no merge or
  production rights come from extra capacity or a technical plan.

Reuse host primitives first; add no generic workflow server without a demonstrated
need. All of the above remains an implementation requirement, not shipped runtime code. Validate the
[acceptance scenarios](../tests/acceptance-scenarios.md) before activation.
No runtime scenario is claimed as passed by the package structural tests.
