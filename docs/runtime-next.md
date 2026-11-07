# Runtime work still needed

The v2 content migration provides four charters, ten methods, setup drafts and
record/state specifications. It does not implement an autonomous runtime.

Use one workflow owner: Grok-native for the first capability pilot, or a future
runtime-owned loop, never two competing planners/review loops. Reuse existing
host/CI facilities; the controller is ordinary code, not a fifth Bot.

Remaining work: authenticated role addressing; independent review context;
version/check/artifact gate enforcement; persisted task/event/action IDs and
locks; deduplication; finite total budgets; cancellation and restart reconciliation;
trusted action executor and operational observation. Validate the
[acceptance scenarios](../tests/acceptance-scenarios.md) before activation.
No runtime scenario is claimed as passed by the package structural tests.
