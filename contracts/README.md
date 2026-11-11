# Task, review and project contracts

Use [record requirements](record-contracts.md), [project plans](project-plan.md),
[state guards](state-transitions.md) and the [disabled policy](project-policy.example.yaml).
The JSON schemas below cover only basic task/review shapes. They do not validate
workstream dependencies, project integration, identity, scheduling or authority.
No autonomous controller or complete cross-record validator is provided.

These are proposed JSON Schema 2020-12 shapes, not a native host API or an
implemented state machine. Use the [task schema](task.schema.json) and
[review schema](review.schema.json) with a compatible validator if desired.
The Markdown [handoffs](../templates) remain usable without JSON tooling.

[Project setup](project-policy.example.yaml) is a questionnaire. Empty permissions and
null values confer no authority. Fill them from the actual project and user.

Examples are an [unapproved brief](../examples/task.brief.json) and a
[blocked review](../examples/review.blocked.json); neither is a successful run.

## What schema validation can check

Required fields, allowed states/verdicts, SHA formatting, bounded repair counters,
blocked-state metadata, and minimum report shape. A PASS-shaped report must have
check references, passing AC results, no blocking findings, and reviewer and
snapshot references. PR_READY-shaped tasks need check and review references.

## What schema validation cannot check

Whether the user approved anything, whether references exist, whether CI ran,
whether check policy changed, whether actual checkout contents match a SHA,
whether AC IDs cover the approved task without duplicates, whether review was
independent, or whether the report is truthful. These require cross-record and
external checks in a future host adapter or the human-controlled pilot.

String provenance fields are references to verify, not authenticated identities.
No schema lets the implementer grant itself permissions. Local records are not a
security boundary. See [workflow rules](../references/workflow.md).

## Default limits

`project-policy.example.yaml` is the only source for these numbers. The table below
only describes them; tests keep the two in sync. Temporary helpers are disabled by
default (`temporary_subagents_enabled: false`). All limits apply together.

| Policy key | Default | Meaning |
|---|---|---|
| `max_active_projects_per_repo` | 1 | Active projects per repository |
| `max_active_workers` | 2 | All active Worker executions, including integration, delivery and incident handling |
| `max_active_verifiers` | 1 | Active Verifier executions |
| `max_total_active_executions` | 4 | All active role and helper executions combined |
| `max_active_integrations_per_target` | 1 | Active integrations per shared target |
| `max_active_releases_per_environment` | 1 | Active releases per environment |
| `max_active_subagents_project` | 2 | Active temporary subagents across the project, not multiplied by Worker count |
| `max_review_repair_cycles` | 2 | Fix-and-reverify cycles per review target |
| `max_transient_retries` | 3 | Retries after transient failures |
