# Proposed record contracts

These are field requirements for the future implementation—not native API payloads,
a JSON Schema implementation, or proof that a stored claim is authentic.
Records link to immutable snapshots or externally versioned facts where possible.

## Shared fields

`record_id`, `record_type`, `project_id`, `revision`, `owner`, `created_at`,
`updated_at`, `state`, `execution_condition`, `source_refs`, `policy_revision`.
A blocked condition additionally requires `resume_from`, `reason`,
`responsible_party`, `resume_condition` and a deadline/budget rule.
`owner` is descriptive; trusted execution identity is captured by the adapter.

## Work item

`task_id`, originating request or confirmed goal, scope revision and snapshot,
original authority reference, ACs, non-goals, allowed actions, repository,
base/head/source snapshot, required-check policy, Worker execution ID,
active subtask IDs, repair-cycle count, budgets, current evidence and next action.
Store clean-source identity or explicitly enumerate staged/unstaged/untracked inputs;
do not equate an unchanged HEAD with unchanged source.

## Review

`review_id`, task/scope/snapshot/check-policy identifiers, verified Verifier session
binding, attempt and repair-cycle number, prior-finding references, observed checks,
AC-by-AC PASS/FAIL/UNKNOWN, verdict, findings, remaining risks, report location.
A schema-valid review record alone does not validate these project-level guards.
Every blocker includes ID, location, evidence, impact and clearance condition.
A model-supplied reviewer name is not identity verification. A well-formed PASS
must still be substantively supported by current evidence.

## Handoff/event envelope

`event_id`, `event_type`, `project_id`, `correlation_id`, `causation_id`,
`producer_execution_ref`, explicit `recipient_ref`, `record_ref`, `record_revision`,
`snapshot_ref`, `requested_action`, `evidence_refs`, `timestamp`, `dedupe_key`.
Bind producer identity through trusted host data, not payload strings.

For non-idempotent effects, record intent before execution, correlate the remote
operation and reconcile before retry. Neither a duplicate message nor an ACK may
create another operation. No exactly-once guarantee is assumed.
