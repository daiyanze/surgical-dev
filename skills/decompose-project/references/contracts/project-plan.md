# Project and workstream contracts

These are requirements for a host adapter and readable task records, not an
implemented scheduler or a native Grok/Pi payload. A plan is not an action grant.

## Project goal and technical plan

The user supplies goal, constraints, budget and permissions. Engineer reads the
repository, chooses a project **integration owner**, and produces the technical
plan without asking the user to split tasks or choose agents. The integration
owner is an Engineer assignment, not a fifth permanent role; it owns shared
contracts, key implementation and integrated delivery, not everyone's transcript.

Required plan fields:

| Field | Meaning |
|---|---|
| project_id, plan_id, plan_revision | Stable project identity and versioned plan |
| goal_ref, scope_revision, authorization_ref, policy_revision | Original objective and authority; never self-authored approval |
| project_acceptance_criteria, non_goals | Observable whole-project outcome and exclusions |
| integration_owner_ref | Actual Engineer identity resolved by the host |
| workstreams | Minimal set of independently testable outcomes, or one stream |
| shared_contracts | Owner, interface/version, consumers, change policy and evidence |
| capacity, budget_ref | Project/global finite ceilings, not per-child duplicated budgets |
| integration_target, integration_checks | Agreed candidate branch/environment and end-to-end checks |
| status, blocker, next_action | Actual state and named recovery condition |

## Workstream

Each stream names workstream_id, project/plan/scope revision, objective, acceptance
criteria mapped to project ACs, non-goals, depends_on, dependency snapshots,
contract versions, write_paths, shared_resources, check requirements, base/head,
workspace/branch, actual assignee_execution_ref, budget allocation, repair history,
review references and next action. A repository path alone does not describe a
semantic boundary: record shared interfaces and runtime resources too.

A peer Engineer owns a complete stream through design, code, tests and repair.
A temporary subagent owns only a bounded auxiliary result and returns it to its
parent Engineer; it cannot claim the stream or project independently accepted.
A small task uses one Engineer with the same evidence rules, not a mandatory DAG.

## Scheduling admission

The future controller must atomically establish all of the following:

1. Current scope/policy permits execution; finite project budgets remain.
2. The dependency graph is acyclic, IDs are unique, all dependencies are known,
   and every predecessor has a currently accepted artifact or contract snapshot.
   A predecessor's 'done' message without accessible artifacts is insufficient.
3. File ownership, shared interfaces, test databases, ports and preview environments
   do not conflict. Unknown overlap is serialized, not assumed independent.
4. A compatible Engineer session and isolated workspace are available; the same
   workstream is not already executing. Global and per-project capacity both apply.
5. A single-owner claim/lease and execution ID are persisted before dispatch.

The controller allocates only ready streams and slows new implementation when
review/integration queues or conflicts become the bottleneck. No quorum of Bots
or extra manager is required. The integration owner may revise ordering, combine
coupled streams and reassign idle capacity within the original scope and budget.
New business scope, extra authority or budget increases require the user/policy.

A lease expiring or a caller timing out does not prove the old execution stopped.
Reconcile the host job and side effects before reassignment; use execution epochs
or equivalent stale-writer rejection. Unknown state remains BLOCKED. Replanning,
restarts and renamed tasks preserve the aggregate budget and repair history.

## Dependency change and cancellation

Pin dependency artifact/snapshot and contract versions in every dispatch. On a
relevant change, mark downstream evidence stale, stop incompatible new dispatch,
and reconcile active work before resubmission. Unaffected streams may continue.
Cycles or inseparable responsibilities are combined or serialized; an unresolved
business contradiction is escalated, not hidden by deleting dependencies.

Cancellation stops new dispatch, requests cancellation of children and reconciles
actual termination. Preserve user changes and useful evidence. Do not delete a
workspace with uncollected work as a cleanup shortcut.

## Integration acceptance

A stream's INTEGRATION_READY means its own checks and independent review pass.
It does **not** make the project PR_READY. The integration owner serializes assembly
of accepted changes into a pinned candidate and runs shared-contract and project
end-to-end checks. Only an independent Verifier can satisfy **Integration Passed**.

The integration packet binds plan/scope revision, included workstream snapshots,
contract versions, repository-to-commit map, actual integrated/merge-test snapshot,
check-policy revision, project-AC evidence and the real review execution identity.
No author of an included implementation, including the integration owner or a
helper, may approve that implementation as its independent reviewer.

Route integration defects to the owning Engineer; the integration owner handles
cross-stream design/assembly issues. Recheck repaired streams and the new combined
candidate. Default: at most two fix-and-reverify cycles per review target, with a
finite project-wide execution ceiling; new plan IDs do not replenish either limit.

PR_READY requires complete required project scope, current integration checks and
independent acceptance. Partial delivery needs an explicit existing scope policy
or a user decision; individual green PRs do not implicitly reduce project ACs.
For a single stream, one independent review may cover both local and project ACs
on the identical snapshot; do not manufacture a duplicate reviewer conversation.

Protected merges, preview changes and releases retain their own authorizations.
A candidate branch is not permission to merge to main. Multi-repository delivery
pins a commit/artifact map, compatibility constraints and release order; it does
not promise atomic cross-repository merges or universally reversible rollback.

## Host capability fallback

When parallel sessions or isolation are unavailable, use one continuing Engineer
sequentially and preserve independent review. If independent review itself is
unavailable, report BLOCKED or use a specifically authorized human alternative.
Creating new persistent Bots is separate from launching permitted task sessions.
No runtime capacity is created by installing these documents.
