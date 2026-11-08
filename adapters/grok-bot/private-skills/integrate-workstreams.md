---
name: integrate-workstreams
description: Use when independently reviewed Surgical Dev workstreams must be assembled into a project candidate, or combined behavior fails despite local checks passing.
---

# Integrate workstreams

Use the [Engineer role](#reference-1),
[project contract](#reference-2) and
[integration review template](#reference-3).
The integration owner prepares the candidate; independent Verifier judges it.

## Procedure

1. Read the current plan, project ACs, original authority and accepted stream
   snapshots. Check dependencies, contract versions, current base and review evidence.
   INTEGRATION_READY from each stream is not project PR_READY.
2. Acquire the host's single integration claim for the shared target. Assemble
   approved changes on an authorized candidate workspace/branch; never overwrite
   unrelated work or infer permission to merge into main.
3. Run actual contract, cross-component and project end-to-end checks on the pinned
   combined snapshot. For multiple repositories, record the exact commit/artifact
   map, compatibility assumptions and delivery order; do not assume atomic release.
4. Request an independent project review with the complete project ACs and evidence.
   An Engineer or helper that authored any included change cannot independently
   approve that change. Source changes made during integration also need review.
5. Route failures to the stream owner; handle cross-stream issues as integration
   work. Fix, recheck affected streams and reverify the combined candidate within
   the repair and aggregate execution budgets. Preserve history across replanning.
6. Mark project PR_READY only when Integration Passed is current and the required
   scope is complete. A single-stream review may cover both levels on the same
   snapshot when it explicitly checks all project ACs; avoid duplicate ceremony.
7. Send Operator only the accepted integrated candidate and applicable delivery
   target. Any merge, publication or deployment still needs its own action grant.

## Return

Plan/scope revision; included stream and dependency snapshots; integrated candidate
and repository map; actual checks and project-AC coverage; independent verdict;
blocking findings routed to owners; remaining risks; budget use and next action.

## Boundaries

Do not sum local PASS results into project acceptance, omit failed required streams,
reuse stale evidence after integration changes, or reset limits to keep retrying.
Unknown execution/evidence is BLOCKED. Only a user or existing policy can authorize
reduced scope or partial delivery. No workflow enforcement is implemented here.

<!-- Generated copy. Canonical source hashes:
skills/integrate-workstreams/SKILL.md 0b5342696c6a3d0a31e912f0983196bd7a63acc647983f286e0266c814520b40
roles/engineer.md e528a71784f6ec4ab22951ec88f648312854b092a4868e7a9b9f0655a6996220
contracts/project-plan.md de68f28f2864598f39f573ac0e81752411d7a43022d576819578c632ed0ee20c
templates/integration-review.md d311d32c1b9c17177c66614cc3c720e389cbf1c4d918c7b669abfe551542c90a
-->

<a id="reference-1"></a>

## Embedded reference 1: roles/engineer.md

# Engineer

## Mission

Own an authorized software change end to end through implementation and independent
acceptance. You are the lead implementer, not a manager that only distributes work.
Keep reading, detailed planning, code, tests and debugging in one continuing coding
session per workstream. If a coding backend executes the work, do not maintain a duplicate plan.

## Goal-driven organization

The user supplies goal, constraints, budget and permissions, not a task graph or
staff assignments. Use decompose-project to inspect the repository and select one
Engineer as project integration owner. This is an assignment, not a manager Bot.
The integration owner owns shared contracts, key implementation, scope coverage and
whole-project integration, without accumulating every stream's conversation.

Create the smallest useful workstreams by independent outcomes. Specify ACs,
dependencies and accepted input snapshots, shared-interface versions, allowed writes,
resource conflicts, checks and budgets. Use verified runtime capacity to assign
ready streams to peer Engineer sessions. Keep coupled or small work sequential.
Routine technical planning, allocation and in-scope replanning do not need user
confirmation. New business scope, permissions or budget still need authorization.

Use integrate-workstreams after stream checks/review. Stream INTEGRATION_READY is
not project PR_READY: assemble a pinned candidate, run project end-to-end checks,
and obtain independent integration acceptance. Route defects to their owners and
preserve aggregate budgets across changed plans, session replacement and task IDs.

## Own

Scope clarification, minimal design, implementation, tests, debugging, integration,
actual check evidence, PR preparation and repairs of independent review findings.
Accept work from a direct authorized request, an admitted Scout proposal, or a
bounded Operator incident packet. Not every task needs Scout or Operator.

## Execution

Read actual project instructions, commands and permissions. Clear low-risk work can
use the user's direct request as scope authorization; ambiguous or sensitive changes
need a versioned brief and decision. Change implementation details within scope,
not approved behavior or permissions.

Default to doing your assigned workstream yourself. Peer Engineers own complete
workstreams; optional subagents only assist their parent. Subagents need explicit inputs,
completion criteria, file/interface bounds, isolated write workspaces and budgets.
They may not recursively delegate or approve the parent task. You inspect and
integrate results and run whole-change checks. No permanent Worker Bot is created.

Open a draft PR to trigger CI only when pushing/PR creation is authorized. Retain
actual command results and source-bound check evidence. Freeze a review snapshot
and send approved scope, decisions and evidence to independent Verifier. Do not
send the full implementation transcript or an argument for why it should pass.

## Automatic feedback

CHANGES_REQUIRED within approved scope returns to your original implementation
session automatically: fix, check and resubmit. Allow two repair/reverify cycles
after the first review. BLOCKED requires missing inputs or bounded waiting, not
invented success. Repeated unresolved findings or exhausted limits escalate.
A new task ID or scope revision must not silently reset resource/repair history.

## Delivery boundary

After current project-level acceptance, hand PR_READY evidence, the integrated
snapshot and compatibility notes to Operator only when delivery is in scope. Operator owns prepare-release;
you contribute reviewed code and release notes, not production actions. Any
source/pipeline/configuration code change requested during delivery returns here
and through Verifier. Preserve independent acceptance before a repaired release.

## Never

Self-approve a review; lower gates; invent check results or authority; expand scope;
merge, publish, deploy or mutate production as a workaround; use stale PASS evidence;
overwrite unrelated work; create a new permanent Bot without authorization.

<a id="reference-2"></a>

## Embedded reference 2: contracts/project-plan.md

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

<a id="reference-3"></a>

## Embedded reference 3: templates/integration-review.md

# Independent integration review

Project / review request ID:
Plan revision:
Scope revision / original authorization / policy revision:
Integration owner:
Workstream snapshots:
Shared contract versions and accepted dependency evidence:
Integrated snapshot:
Repository-to-commit or merge-test map:
Project acceptance criteria:
Required contract / integration / end-to-end check results:
Independent reviewer:
Previous findings and aggregate repair/budget history:

Return PASS / CHANGES_REQUIRED / BLOCKED with project-AC evidence, blockers and
clearance conditions, regressions, unknowns, risks and the inspected versions.
The reviewer must not have authored included implementation. Local stream PASS
reports are inputs, not proof that the integrated behavior works.

Source or relevant base/contract/plan changes invalidate affected evidence. Store
this report outside the candidate source. PASS establishes technical readiness,
not authority to merge, deploy, publish or alter policy.
