# Runtime work still needed

The package provides six Skills, two roles (Worker and Verifier), goal and work-item
templates, and record/state specifications. The Pi adapter implements a goal-driven
single-workstream loop: guided `/surgical <goal>` discussion or imported requirement
preparation, exact user-boundary confirmation or the advanced command, a validated
Todo DAG, one persistent Worker handling Todos
sequentially, actual checks, one independent final combined review, additive repair,
finite cumulative budgets and a version-bound `PR_READY` result. Compact plan/memory
state is file-backed under Git metadata and survives Pi compaction. See
[Pi setup](../adapters/pi/SETUP.md) and [validation](../VALIDATION.md).

The optional Learning Loop counts recurring check/review failure signatures locally
in `<git-common-dir>/surgical-dev/learning.json`, redacts secrets, and shows one
advisory `LEARNING` line at the second occurrence. It has no lifecycle, promotion or
lesson tool, and it does not sync history between clones.

## Next phases

1. **Real-model pilot:** run representative bugs and features with configured Pi
   models, including DeepSeek. Measure unattended acceptance, false acceptance,
   repair attempts, latency and cost before widening task scope.
2. **Durable recovery:** reconcile crashed processes/locks and restore an interrupted
   run without resetting its counters or duplicating work. Interruption metadata is
   persisted, but automatic background resume is not enabled.
3. **Authorized delivery:** create PRs and reconcile CI, then add explicitly scoped
   merge/deploy executors with observed outcomes and recovery.
4. **Multiple workstreams:** parallel isolated Worker sessions, shared
   resource/capacity accounting and independent multi-workstream integration. The
   current adapter deliberately handles one Worker and one workstream sequentially.

Use one workflow owner: host-native for the first capability pilot, or a future
runtime-owned loop, never two competing planners/review loops. Reuse existing
host/CI facilities; the controller is ordinary code, not another agent.

Required controller behavior for the broader architecture:

- Validate an acyclic dependency graph and accepted input snapshots; resolve real
  Worker/Verifier execution identities and safe workspaces.
- Claim ready streams atomically within project/global capacity. Check file,
  contract and shared-resource conflicts; apply review/integration backpressure.
- Keep one implementation owner per stream and one Worker integration owner.
  Helpers are auxiliary jobs under the same aggregate budget, not recursive teams.
- Persist plan/task/event/action IDs, leases, counters and cancellation. An expired
  lease or timeout requires job reconciliation before rescheduling, not duplication.
- Preserve scope, repair history and total usage during replanning/reassignment.
  Unsupported parallel execution falls back to serial; absent review blocks.
- Use scoped external action executors and observed delivery outcomes; no merge or
  production rights come from extra capacity or a technical plan.

Reuse host primitives first; add no generic workflow server without a demonstrated
need. The single-stream adapter covers only its documented subset. Multi-project
authority, restart reconciliation, parallel scheduling and external actions above
remain implementation requirements. Add acceptance scenarios for each newly enabled
capability; structural tests alone cannot establish them.
