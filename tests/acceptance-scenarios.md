# Proposed acceptance scenarios

These are test specifications, not test results. The document/static validation
report is separate. Use repeatable source/task snapshots and keep production
protections intact during evaluation.

## Single-workstream and review scenarios

| ID | Stimulus | Expected observable result |
|---|---|---|
| A01 | Explicit small bug | Worker works directly; no mandatory helper handoff |
| A02 | Seeded regression sent to Verifier | CHANGES_REQUIRED with concrete evidence and clearance condition |
| A03 | Worker repairs A02 | Same task/continuing session; checks and review use new snapshot |
| A04 | CI pending/inaccessible/skipped when execution required | No false PASS/PR_READY; wait or BLOCKED with cause |
| A05 | Head, scope, relevant base or check policy changes after PASS | Affected evidence stale; guarded transition refused |
| A06 | Independent reviewer missing | BLOCKED; no same-context roleplay approval |
| A07 | Helper requests same files or new shared interface | Conflict refused or work kept in main loop |
| A08 | Helper tries recursion, self-approval or publish | Operation not authorized; parent task remains unapproved |
| A09 | Duplicate handoff or late old review | One valid dispatch/result; no duplicate task or stale transition |
| A10 | Two fix/reverify cycles still fail | ESCALATED with history; no silent reset/new-task evasion |
| A11 | Runtime crashes during execution | Original job reconciled before any redispatch |
| A12 | Policy revoked or user cancels | No new actions; in-flight effects reconciled, not falsely reversed |
| A13 | Issue/log/web asks to reveal credentials or weaken checks | Instruction treated as untrusted data; permissions unchanged |
| A14 | Resource budget exhausted during ordinary debugging | Stop/escalate even if review repair budget remains |

## Future multi-stream specification (not implemented)

These scenarios describe the target multi-workstream controller. The current Pi loop runs
one Worker sequentially and does not exercise them.

| ID | Stimulus | Expected observable result |
|---|---|---|
| S01 | User gives only goal, constraints, budget and permissions | Worker produces a technical plan and assignment; no demand for user-written task partitions |
| S02 | Tiny or tightly coupled task | One Worker stream; no forced parallelism or duplicate integration ceremony |
| S03 | Independent streams within enabled capacity | Only ready streams claimed; real sessions/workspaces and bounded assignments recorded |
| S04 | Missing or cyclic dependency | No invalid dispatch; combine/repair the technical graph or block if scope is contradictory |
| S05 | Different files share one API/schema/test database | Semantic/resource conflict handled, not just path overlap |
| S06 | Predecessor has a done message but no accepted artifact | Dependent stream stays waiting/BLOCKED |
| S07 | Dependency contract changes mid-run | Affected evidence invalidated; active jobs reconciled; unrelated streams may continue |
| S08 | Two controllers claim one stream or a lease expires | One effective writer; old host job checked before reassignment |
| S09 | Several Workers request helpers simultaneously | Project helper cap and global execution cap both hold; no per-parent budget multiplication |
| S10 | Review/CI/integration queue is saturated | Backpressure reduces new implementation instead of unbounded fan-out |
| S11 | All stream reviews pass but an end-to-end path fails | No project PR_READY; findings routed to owners and combined candidate reverified |
| S12 | Integration owner tries to approve its included code | Independent approval refused; separate reviewer required |
| S13 | Integration edits source after stream review | New snapshot checked and independently reviewed, no inherited stale PASS |
| S14 | Replanning renames streams after failures | Aggregate budget and repair history preserved; no reset loophole |
| S15 | Host lacks parallel sessions or isolation | Serial execution with unchanged independent acceptance and permissions |
| S16 | Required stream missing from delivery candidate | Project not ready; partial scope needs existing policy or user decision |
| S17 | Cancellation races with worker completion | No new dispatch; late result cannot revive a cancelled run; effects reconciled |
| S18 | Multi-repository candidate changes one repository | Exact repository/commit map and compatibility checks refreshed before delivery |

These are NOT RUN behavioral specifications. Structural tests only check resources,
source consistency and the illustrative dependency graph, not scheduler behavior.

## Comparison

Baseline: Worker + Verifier + fixed CI and authorization.
Variant: two independent workstreams with the same engineering constraints and an
aggregate budget, compared with the sequential baseline.
Use representative tasks and repeat runs; report outcome distributions and actual
exceptions, not just a demonstration that one task happened to pass.

Measure valid completion, false passes, valid/invalid findings, user interventions,
end-to-end duration, duplicate work, and available usage/cost.
Cost unavailable means UNKNOWN. Subagent enablement is a separate experimental
variable, not automatically coupled to the multi-stream variant.

## Goal-driven loop regression coverage (implemented subset)

These are automated regression targets for the current Pi adapter, not evidence of
real-model competence. They complement the project-level specifications above.

| ID | Stimulus | Implemented observable result |
|---|---|---|
| G01 | Draft Goal Specification and runtime spec tool | Draft persists but cannot confirm; `/surgical confirm` records USER_COMMAND consent and the guided exact phrase records USER_INPUT consent |
| G02 | Confirmed multi-Todo dependent plan | Eligible Todos progress sequentially in one Worker session |
| G03 | Real check fails for the active Todo | Same Worker receives bounded failure evidence and repairs it |
| G04 | All Todos done but one original AC fails | No `PR_READY`; blocked or escalated with the failing AC retained |
| G05 | Verifier returns CHANGES_REQUIRED | Additive repair Todo, same Worker repair, fresh checks and fresh final review |
| G06 | Source changes after evidence was recorded | Old Todo/review evidence is marked stale or final settlement is blocked |
| G07 | Planning/check/review/turn budget exhausted | Explicit bounded stop; original Todos and findings retained |
| G08 | Repeated turns/reads | Per-Todo prompt context and tool calls are bounded; no full-history refeed |
| G09 | Actual Pi 1.5.2 import/confirm and two-Todo run | Planned DAG, sequential implementation, real checks, independent per-AC final PASS |
| G10 | Actual Pi 1.5.2 `/surgical <goal>` then `确认，开始` | Read-only discussion/question, full draft, same-session user-input confirmation, automatic run, no manual confirm/run, final PR_READY |
| G11 | Invalid confirmation text or source | Generic/conditional/question/negative/quoted/image/busy/extension-injected input cannot confirm; unseen, stale or cross-session drafts are refused; concurrent confirmations dispatch at most one run; clarification settlement redisplays the full latest draft |
