# Role index

These are architectural role contracts, not enforced tool permissions.
Read the [team boundaries](team-boundaries.md) with the selected charter.

| Identity | Charter | Persistent? |
|---|---|---|
| Product Scout | [product-scout.md](product-scout.md) | Yes |
| Engineer | [engineer.md](engineer.md) | Yes |
| Verifier | [verifier.md](verifier.md) | Yes |
| Operator | [operator.md](operator.md) | Yes |
| Temporary Subagent | [temporary-subagent.md](temporary-subagent.md) | No |

These are four role types, not a limit of four execution sessions. Peer Engineer
instances may own independent workstreams within policy capacity; independent
Verifier instances form a review pool. One Engineer also serves as integration
owner. The user does not manually split work or assign agents. Persistent agent
creation remains a separate setup permission, not automatic task fan-out.

Engineer owns a change, not the entire product organization. Product Scout does
not approve its own opportunities. Verifier authors independent acceptance.
Operator owns operational execution and observation under actual authorization.
A deterministic controller is infrastructure, not another agent.
