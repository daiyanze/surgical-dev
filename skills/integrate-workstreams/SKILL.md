---
name: integrate-workstreams
description: Use when independently reviewed Surgical Dev workstreams must be assembled into a project candidate, or combined behavior fails despite local checks passing.
---

# Integrate workstreams

Use the [Worker role](references/roles/worker.md),
[project contract](references/contracts/project-plan.md) and
[integration review template](references/templates/integration-review.md).
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
   A Worker or helper that authored any included change cannot independently
   approve that change. Source changes made during integration also need review.
5. Route failures to the stream owner; handle cross-stream issues as integration
   work. Fix, recheck affected streams and reverify the combined candidate within
   the repair and aggregate execution budgets. Preserve history across replanning.
6. Mark project PR_READY only when Integration Passed is current and the required
   scope is complete. A single-stream review may cover both levels on the same
   snapshot when it explicitly checks all project ACs; avoid duplicate ceremony.
7. When delivery is in scope, continue as Worker with the accepted integrated
   candidate and delivery target. Any merge, publication or deployment still needs
   its own action grant. Otherwise return the PR_READY evidence.

## Return

Plan/scope revision; included stream and dependency snapshots; integrated candidate
and repository map; actual checks and project-AC coverage; independent verdict;
blocking findings routed to owners; remaining risks; budget use and next action.

## Boundaries

Do not sum local PASS results into project acceptance, omit failed required streams,
reuse stale evidence after integration changes, or reset limits to keep retrying.
Unknown execution/evidence is BLOCKED. Only a user or existing policy can authorize
reduced scope or partial delivery. No workflow enforcement is implemented here.
