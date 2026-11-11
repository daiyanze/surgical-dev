---
name: decompose-project
description: Use when an authorized Surgical Dev goal spans several independently testable outcomes, has shared dependencies, or needs technical replanning within existing bounds.
---

# Decompose a project

Use the [Worker role](references/roles/worker.md),
[project contract](references/contracts/project-plan.md) and
[plan template](references/templates/project-plan.md).
This is a planning method; it does not install a scheduler or grant execution.

## Procedure

1. Read the user's goal, constraints, finite budget, permissions, project rules and
   actual repository boundaries. Resolve only material missing business decisions.
   Do not ask the user to split the project or assign agents.
2. Choose one Worker as integration owner. Keep tightly coupled work together;
   use one stream when splitting would add more coordination than useful parallelism.
3. Partition by independently testable outcomes, not frontend/backend/test titles.
   Assign each stream project ACs, dependencies, versioned interfaces, allowed writes,
   shared resources, checks, budget and an integration destination.
4. Make the graph acyclic and pin accepted dependency artifacts. Establish the
   minimum shared contracts first; do not require a complete upfront system design.
5. Request bounded peer Worker sessions through verified host capabilities. The
   controller admits only ready, non-conflicting work within global/project caps.
   A peer owns its own implementation/review loop; a helper only assists its parent.
6. Record assignments and plan revisions. Reorder, combine or serialize work within
   scope without repeatedly asking the user. Preserve resource/repair history;
   invalidate affected downstream evidence when a contract or source changes.
7. Fall back to sequential work when parallel execution or isolation is unavailable.
   Missing independent acceptance is BLOCKED, never same-context self-approval.

## Return

Plan/goal/scope/authority references; chosen integration owner; minimal workstreams
and dependency graph; contract versions; write/resource boundaries; capacity and
budget; project acceptance/integration checks; actual assignments or unresolved
capabilities; next action and only the decisions genuinely requiring the user.

## Boundaries

Do not create permanent agents, expand scope/budgets, change approvals or release code
as a consequence of planning. Do not recursively fan out teams or manufacture a
parallel task merely to fill capacity. A recorded plan is not an enforced gate.
