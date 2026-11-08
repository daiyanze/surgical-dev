# State transition requirements

This table describes future guards; it is not an implemented state machine.
An execution condition BLOCKED/ESCALATED/CANCELLED/TIMED_OUT preserves the prior
stage. Only observed, authorized events can resume or advance it.

## Project

GOAL -> PLANNING -> EXECUTING -> INTEGRATING -> INTEGRATION_VERIFYING -> PR_READY.
User scope/authority admission precedes execution. Engineer automatically supplies
technical partitions and assignments under that scope. PLANNING admission checks
an acyclic dependency graph, accepted input versions, conflicts and budget.

Project PR_READY requires required streams INTEGRATION_READY, a current combined
candidate, actual project-level checks and independent Integration Passed. A failed
integration returns affected work to its Engineer without resetting project usage.
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
| Project PR_READY | Delivery requested and integrated evidence current | Create/link Operator release record; PR_READY is not an action grant |

Increment a repair cycle when review-driven fixes are made and resubmitted, not
for a pending-CI wait or duplicate review message. Persist the increment atomically.

## Opportunity

DRAFT -> PROPOSED when the evidence brief is ready. A trusted admission decision
sets ACCEPTED, DEFERRED or REJECTED. Only ACCEPTED may produce authorized engineering
work, subject to project scope. An outcome observation may produce a new proposal,
not automatic acceptance. Direct tasks need no opportunity record.

## Release/action run

PLANNED -> PRECHECKING -> READY -> EXECUTING -> OBSERVING -> VERIFIED.
Each transition requires current inputs. READY requires the checks appropriate to
that operation; execution additionally requires its action-specific grant.
An early merge/build action and a later deployment can be separate linked runs.

EXECUTING with an unknown remote outcome is BLOCKED pending reconciliation, not
FAILED-by-assumption and not permission to retry. Observed failure records FAILED
and links an incident. A separate authorized successful recovery may mark the
release ROLLED_BACK; a safe rollback is never assumed. Source changes reopen an
Engineer work item; policy/env/artifact changes require fresh applicable guards.

## Incident

OPEN -> TRIAGED -> MITIGATING -> CONTAINED -> RESOLVED is one possible path, not
mandatory escalation theater. CONTAINED requires observed mitigation. RESOLVED
requires recovery criteria and window; unresolved permanent fixes stay linked.
An incident may skip mitigation when only observation or a source fix is needed.
It may stay TRIAGED/BLOCKED when no safe recovery action is authorized.

## Outcome

PENDING -> SUPPORTED / INCONCLUSIVE / REGRESSED from observed data and the agreed
measurement method. Assessment changes are new revisions. They do not rewrite
historical technical review or authorize new development by themselves.

## Final-action freshness

Immediately before merge/publish/deploy/rollback, the trusted action executor checks
current grant/revocation, candidate identity, target configuration, gates and lock.
If an in-flight action has already happened, stop new actions and reconcile it;
do not pretend a revocation retroactively reverses the operation.
