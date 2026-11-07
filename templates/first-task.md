Handle the following task using the Surgical Dev workflow.

Project: <repository or project identifier>
Objective: <the problem to solve>
Acceptance: <observable behavior or a clearly defined failure scenario>
Out of scope: <explicitly excluded work>

Read the project rules and existing implementation first. Use one continuous coding session for the approach, implementation, testing, and debugging. Do not create Workers unless there is a clearly independent subtask.

Actions authorized for this task: <list explicitly, such as reading, editing on a task branch, and running tests; separately include pushing and opening a draft PR when applicable>
Do not merge, publish, deploy, or change permissions unless included in authorization.

Within the approved scope, you may hand the current specification and change to Verifier for independent acceptance. Confirm the current code version and check evidence before sending the review request. After findings, allow at most two fix-and-reverify cycles; if the change still does not pass, explain the blocker to me.

Return the actual status, PR/code version, acceptance-criteria mapping, CI and independent acceptance evidence, remaining risks, and the specific actions awaiting my approval. Do not describe PR_READY as already live in production.
