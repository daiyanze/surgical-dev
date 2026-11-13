# Role index

These are architectural role contracts, not enforced tool permissions.
Read the [team boundaries](team-boundaries.md) with the selected charter.

| Identity | Charter | Persistent? |
|---|---|---|
| Worker | [worker.md](worker.md) | Yes |
| Verifier | [verifier.md](verifier.md) | Yes |

The Worker owns the task from requirement preparation through implementation, checks and
repair. The Verifier gives independent acceptance of the Worker's version-bound candidate
and never edits it. The Pi extension runs one Worker session and a fresh reviewer process
for the final review. Parallel Workers and temporary helper subagents are not implemented.
A deterministic controller is infrastructure, not another agent.
