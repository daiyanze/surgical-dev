# First pilot task message

Use Surgical Dev for this explicitly authorized goal.

Project/repository: <identifier>
Objective: <bounded problem>
Acceptance criteria: <observable behavior>
Out of scope: <exclusions>
Authorized actions: <explicit list; distinguish edit/test/push/PR/merge/deploy>
Resource limits and delivery target: <limits; normally PR_READY for the pilot>

Do not ask the user to split tasks or assign agents. Engineer reads the repository,
chooses an integration owner, and organizes the smallest useful workstreams within
these bounds; stay serial when small, coupled or missing safe parallel capability.
Keep implementation and tests in one Engineer coding session per stream. Use an independent
Verifier, fix in-scope findings automatically within the configured repair budget,
and preserve current source/scope/dependency/check evidence. Verify the combined
project behavior, not only individual streams. Do not invoke Scout or helpers
unless their distinct work is needed. Do not create permanent Bots or routines.

Only hand delivery to Operator if authorized for this task. Return actual status,
evidence, risks and the specific decision needed if blocked. Do not call PR_READY
merged or released, or a deployment request a successful deployment.
