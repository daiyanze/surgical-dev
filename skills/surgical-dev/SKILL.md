---
name: surgical-dev
description: Use when the user invokes Surgical Dev with a goal or resumes its four-role workflow for project organization, implementation, independent acceptance, delivery or incidents.
---

# Surgical Dev

## Engineering discipline

Before coding, surface assumptions that materially affect the goal. Prefer
the smallest sufficient design, limit changes to approved outcomes, and verify
observable success. Load engineering-discipline for detail if installed.
These habits require no extra role, approval gate or speculative abstraction.

Read actual project instructions, the [shared boundaries](references/roles/team-boundaries.md)
and [workflow](references/references/workflow.md). This Skill supplies instructions.
The full Pi package additionally provides an opt-in `/surgical run` loop for one
Engineer and an independent Verifier. Skill loading alone does not activate it or
install a scheduler or authorization service.

## Route only the responsibility needed

- Research/opportunity: Product Scout uses discover-opportunity. A proposal cannot
  admit itself; retain original user or trusted-policy authorization before coding.
- Clear feature/bug: Engineer uses ship-feature or fix-bug directly. Keep reading,
  planning, implementation and debugging in the same conversation and coding session.
- Multi-outcome goal: Engineer uses decompose-project. The user supplies goal,
  constraints, budget and permissions, not assignments. An Engineer integration
  owner establishes minimal workstreams, dependencies, shared contracts and project
  ACs. A verified host/controller assigns ready work to peer Engineer sessions within
  policy caps. Small/coupled work and unsupported parallelism stay sequential.
- Optional bounded work: Engineer uses delegate-bounded-task only if enabled, with
  at most two temporary subagents across the project, isolated workspaces and no
  recursive delegation. Helpers are not peer workstream owners.
- Acceptance: a genuinely separate Verifier uses verify-change. Never switch persona
  to approve your own work. Missing independent review is BLOCKED; a documented human
  alternative is allowed. PASS does not authorize delivery.
- Delivery: Operator uses prepare-release, then release-and-observe only for authorized
  actions. Preparation does not grant merge, tag, package or deployment permission.
- Incident: Operator uses handle-incident; send bounded repairs directly to Engineer.
- Product results: Scout uses evaluate-outcome; new follow-ups need separate admission.

## Continue the engineering loop

Bind scope, original authority, exact source snapshot and check policy. Collect real
check evidence, then request independent review. CHANGES_REQUIRED returns to the
original Engineer session automatically when a verified handoff exists. Permit at
most two repair/reverify cycles after initial review; preserve total budgets across
new IDs/restarts. BLOCKED retains owner, reason, prior phase and resume condition.
Use integrate-workstreams for the combined candidate. Local stream acceptance is
INTEGRATION_READY, not project completion. Project PR_READY needs current project
checks and independent Integration Passed. One stream may reuse one review covering
all project ACs on the same snapshot. Stop at PR_READY unless delivery is in scope.
No mandatory Scout or Operator pass, no manager agent and no automatic permanent-agent creation.
In-scope technical replanning/allocation is automatic; new scope, authority or budget
requires a decision. Unsupported runtime operations must not be presented as executed.

## Return

Actual project/workstream state and responsible role; plan/task/review/release/incident IDs;
current scope/source/check evidence; verdict or absence; unresolved risks and next
authorized action. Never invent agent runs, approvals, telemetry or product impact.
