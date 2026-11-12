# State transition requirements

This table describes future guards; it is not an implemented state machine.
An execution condition BLOCKED/ESCALATED/CANCELLED/TIMED_OUT preserves the prior
stage. Only observed, authorized events can resume or advance it.

## Project

GOAL -> PLANNING -> EXECUTING -> INTEGRATING -> INTEGRATION_VERIFYING -> PR_READY.
User scope/authority admission precedes execution. Worker automatically supplies
technical partitions and assignments under that scope. PLANNING admission checks
an acyclic dependency graph, accepted input versions, conflicts and budget.

Project PR_READY requires required streams INTEGRATION_READY, a current combined
candidate, actual project-level checks and independent Integration Passed. A failed
integration returns affected work to its Worker without resetting project usage.
Scope changes require applicable admission; routine in-scope technical replanning
only records a new plan revision and invalidates affected downstream evidence.
One stream may use the same review for local and integrated ACs on an identical
snapshot; independent acceptance cannot be bypassed by selecting serial mode.

## Work item / workstream

| From | Event / guard | To / effect |
|---|---|---|
| BRIEF | Valid current scope admission, setup and budget | IMPLEMENTING |
| IMPLEMENTING | Source snapshot ready; actual check execution started | CHECKING |
| CHECKING | Mandatory checks satisfied for current snapshot | VERIFYING; dispatch one identified independent review |
| CHECKING | Failed check, repair authorized and budget remains | IMPLEMENTING |
| CHECKING | Evidence pending or unavailable | BLOCKED condition; save known job and wait/recovery rule |
| VERIFYING | Authenticated independent PASS, evidence still current | INTEGRATION_READY; single-stream project may reach PR_READY only if project ACs are covered |
| VERIFYING | CHANGES_REQUIRED within scope and cycle budget | IMPLEMENTING; invalidate affected evidence |
| VERIFYING | Missing required evidence or authority | BLOCKED condition |
| VERIFYING | Repair limit exhausted or repeated unresolved failure | ESCALATED condition |
| Any active stage | Accepted scope changes | BRIEF; new revision, preserve history and budget accounting |
| INTEGRATION_READY | Relevant source/check-policy/baseline/dependency changes | Reopen affected checks/review; invalidate downstream acceptance |
| Project PR_READY | Required checks and independent Integration Passed current | Record PR_READY; it is not an action grant |

Increment a repair cycle when review-driven fixes are made and resubmitted, not
for a pending-CI wait or duplicate review message. Persist the increment atomically.

## Final-action freshness

Immediately before merge/publish/deploy/rollback, the trusted action executor checks
current grant/revocation, candidate identity, target configuration, gates and lock.
If an in-flight action has already happened, stop new actions and reconcile it;
do not pretend a revocation retroactively reverses the operation.
