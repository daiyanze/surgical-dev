# Task and review contracts

Use [record requirements](record-contracts.md) and [state guards](state-transitions.md).
The JSON schemas below cover only basic task/review shapes. They do not validate
identity, scheduling or authority, and they are not a cross-record validator.
The optional Pi extension implements a bounded single-workstream
goal/Todo/check/independent-review/repair loop with its own runtime checks; see
[Pi setup](../adapters/pi/SETUP.md) and [validation](../VALIDATION.md). The schemas
alone do not enforce that loop.

These are proposed JSON Schema 2020-12 shapes, not a native host API or an
implemented state machine. Use the [task schema](task.schema.json) and
[review schema](review.schema.json) with a compatible validator if desired.
The Markdown [handoffs](../templates) remain usable without JSON tooling.

Empty permissions and null values confer no authority.

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
external checks by a runtime adapter or a human. Pi validates its documented
single-workstream subset; these schemas do not establish the broader guarantees.

String provenance fields are references to verify, not authenticated identities.
No schema lets the implementer grant itself permissions. Local records are not a
security boundary. See [workflow rules](../references/workflow.md).