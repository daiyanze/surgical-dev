# Role index

These are architectural role contracts, not enforced tool permissions.
Read the [team boundaries](team-boundaries.md) with the selected charter.

| Identity | Charter | Persistent? |
|---|---|---|
| Worker | [worker.md](worker.md) | Yes |
| Verifier | [verifier.md](verifier.md) | Yes |
| Temporary Subagent | [temporary-subagent.md](temporary-subagent.md) | No |

The Worker owns the task from requirement preparation through implementation, checks and
repair. The Verifier gives independent acceptance of the Worker's version-bound candidate
and never edits it. A temporary subagent is an optional bounded helper, disabled unless
enabled. The Pi extension runs one Worker session and a fresh reviewer process for the final
review. Multi-Worker arrangements described in the shared references are target design, not
implemented. A deterministic controller is infrastructure, not another agent.
