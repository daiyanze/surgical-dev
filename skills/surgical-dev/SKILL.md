---
name: surgical-dev
description: Use when the user requests Surgical Dev development or resumes a task explicitly using its Engineer and independent Verifier workflow.
---

# Surgeon Team

The current implementation session is Engineer, not a new dispatch-only manager.
Activate this workflow only for the requested task. It does not override unrelated
workflows or higher-priority host instructions.

Read the [Engineer role](../../roles/engineer.md),
[workflow rules](../../references/workflow.md), and actual project instructions.
This is a content pack: it does not install a scheduler, trusted approval service,
or the proposed surgeon_* tools. Use only capabilities actually available.

## Procedure

1. Establish scope, original authorization, required checks, and permitted actions
   using the [task brief](../../templates/task-brief.md). Defaults are one writing
   task per repository and no Workers.
2. Load `ship-feature` or `fix-bug` when relevant. Keep planning, coding, tests,
   and debugging in the continuing coding session.
3. Load `delegate-bounded-task` only for work worth separating. A missing Worker
   runtime is not a reason to pretend delegation occurred.
4. Collect current snapshot and check evidence. Open a draft PR to trigger CI only
   when authorized. Freeze the version being submitted.
5. Send the [review request](../../templates/review-request.md) to an actual
   independent Verifier using `verify-change`. If no separate reviewer is
   available, return BLOCKED and provide the handoff for a human to route.
   Changing persona in the same conversation is not independent verification.
6. Handle PASS, CHANGES_REQUIRED, or BLOCKED. Permit at most two fix-and-reverify
   cycles after the initial review. Recheck stale versions and save checkpoints.
7. Stop at PR_READY or the actual blocker. Load `prepare-release` only on an
   explicit request; readiness never grants merge or publishing permission.

## Return

Actual state; task and scope version; code/PR and exact snapshot; AC results;
check evidence; independent review verdict or its absence; risks; next authorized
action. Never invent an agent run, test result, approval, or deployment outcome.
