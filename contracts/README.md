# Task and review contracts

These are proposed JSON Schema 2020-12 shapes, not a native Grok/Pi API or an
implemented state machine. Use the [task schema](task.schema.json) and
[review schema](review.schema.json) with a compatible validator if desired.
The Markdown [handoffs](../templates) remain usable without JSON tooling.

[Project setup](project.example.yaml) is a questionnaire. Empty permissions and
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
