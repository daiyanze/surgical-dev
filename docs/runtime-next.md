# Runtime work still needed

The package provides four role types, thirteen methods, goal/plan/integration
templates and record/state specifications. The Pi adapter implements the first
single-workstream loop: fixed goal, actual checks, fresh independent review,
automatic repair, finite budgets and a version-bound `PR_READY` result. See
[Pi setup](../adapters/pi/SETUP.md) and [validation](../VALIDATION.md).

## Next phases

1. **Real-model pilot:** run representative bugs and features with configured Pi
   models, including DeepSeek. Measure unattended acceptance, false acceptance,
   repair attempts, latency and cost before widening task scope.
2. **Durable recovery:** reconcile crashed processes/locks, persist resumable work
   and usage, and restore a run without resetting its counters or duplicating work.
3. **Authorized delivery:** create PRs and reconcile CI, then add explicitly scoped
   merge/deploy executors with observed outcomes and recovery.
4. **Multiple workstreams:** dependency planning, isolated Engineer sessions, shared
   resource/capacity accounting and independent integrated acceptance.

Use one workflow owner: host-native for the first capability pilot, or a future
runtime-owned loop, never two competing planners/review loops. Reuse existing
host/CI facilities; the controller is ordinary code, not a fifth agent.

Required controller behavior for the broader architecture:

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
need. The single-stream adapter covers only its documented subset. Multi-project
authority, restart reconciliation, parallel scheduling and external actions above
remain implementation requirements. Validate the [acceptance scenarios](../tests/acceptance-scenarios.md)
for each newly enabled capability; structural tests alone cannot establish them.
