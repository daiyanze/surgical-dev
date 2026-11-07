---
name: surgical-dev
description: Use when the user invokes Surgical Dev or resumes its four-role workflow for discovery, implementation, independent review, delivery or incidents.
---

# Surgical Dev v2

Read actual project instructions, the [shared boundaries](../../roles/team-boundaries.md)
and [workflow](../../references/workflow.md). This is a content-only package; no
role dispatcher, scheduler, authorization service or enforced state machine is installed.

## Route only the responsibility needed

- Research/opportunity: Product Scout uses discover-opportunity. A proposal cannot
  admit itself; retain original user or trusted-policy authorization before coding.
- Clear feature/bug: Engineer uses ship-feature or fix-bug directly. Keep reading,
  planning, implementation and debugging in the same conversation and coding session.
- Optional bounded work: Engineer uses delegate-bounded-task only if enabled, with
  at most two temporary subagents, isolated workspaces and no recursive delegation.
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
Stop at PR_READY unless delivery is in scope. No mandatory Scout or Operator pass.

## Return

Actual state and responsible role; linked task/review/release/incident IDs as relevant;
current scope/source/check evidence; verdict or absence; unresolved risks and next
authorized action. Never invent agent runs, approvals, telemetry or product impact.
