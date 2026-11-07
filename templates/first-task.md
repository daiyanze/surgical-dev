# First pilot task message

Use the Surgeon Agent Team v2 design for this explicitly authorized task.

Project/repository: <identifier>
Objective: <bounded problem>
Acceptance criteria: <observable behavior>
Out of scope: <exclusions>
Authorized actions: <explicit list; distinguish edit/test/push/PR/merge/deploy>
Resource limits and delivery target: <limits; normally PR_READY for the pilot>

Keep implementation and tests in one Engineer coding session. Use an independent
Verifier, fix in-scope findings automatically within the configured repair budget,
and preserve current source/scope/check evidence. Do not invoke Scout or helpers
unless their distinct work is needed. Do not create permanent Bots or routines.

Only hand delivery to Operator if authorized for this task. Return actual status,
evidence, risks and the specific decision needed if blocked. Do not call PR_READY
merged or released, or a deployment request a successful deployment.
