# Role index

These are architectural role contracts, not enforced tool permissions.
Read the [team boundaries](team-boundaries.md) with the selected charter.

| Identity | Charter | Persistent? |
|---|---|---|
| Product Scout | [product-scout.md](product-scout.md) | Yes |
| Worker | [worker.md](worker.md) | Yes |
| Verifier | [verifier.md](verifier.md) | Yes |
| Temporary Subagent | [temporary-subagent.md](temporary-subagent.md) | No |

These are three role types; execution sessions are bounded by project capacity. Peer Worker
instances may own independent workstreams within policy capacity; independent
Verifier instances form a review pool. One Worker also serves as integration
owner. The user does not manually split work or assign agents. Persistent agent
creation remains a separate setup permission, not automatic task fan-out.

Worker owns implementation, authorized delivery, observation and incident handling.
It continues across those responsibilities without a mandatory role handoff.
Product Scout proposes opportunities and evaluates outcomes; it does not approve
its own new scope. Verifier authors independent acceptance of the Worker's changes.
A deterministic controller is infrastructure, not another agent.
