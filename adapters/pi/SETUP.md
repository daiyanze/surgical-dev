# Pi setup — goal-driven autonomous development

The package exposes six Skills and one opt-in extension. The extension runs a
goal-driven single-workstream loop: requirement discussion/import → explicit user
confirmation → Todo planning → one persistent Worker → actual checks → independent
final Verifier → additive repair. The Worker session owns implementation throughout.
Success is `PR_READY` for the confirmed specification and current source tree.

## Install

Requirements: Pi **1.5.2+**, Node **24** (the verified version; Pi 1.5.2 declares `>=22.19.0`, and Node 22.13 fails), Git, and Linux or macOS. The integration
suite is exercised on Linux. Windows process-tree cancellation is not supported by
this pilot. Authenticate a model through Pi's normal setup first.

```bash
pi install git:github.com/daiyanze/surgical-dev
```

For a local checkout, retain the whole package at a stable path:

```bash
pi install /absolute/path/to/surgical-dev
```

Pi records local paths without copying them. Use `pi install -l <absolute-path>`
from the target project for project-scoped installation. Start a fresh Pi session
after installing. The [package](https://pi.dev/docs/latest/packages) and
[extension](https://pi.dev/docs/latest/extensions) interfaces were checked against
the released Pi 1.5.2 source and exercised by the local host integration test.

Individual Skill installation through the skills CLI includes instructions only;
it does not install this extension. See [distribution](../../docs/distribution.md).

## Configure the target repository once

Create and commit `.surgical-dev.json` in the repository root:

```json
{
  "checks": [["npm", "test"], ["npm", "run", "build"]],
  "reviewerCommand": ["pi"],
  "maxTurns": 40,
  "maxCheckAttempts": 6,
  "maxReviewRepairCycles": 2,
  "maxPlanRounds": 3,
  "maxPromptChars": 12000,
  "timeoutSeconds": 1800,
  "checkTimeoutSeconds": 120,
  "reviewTimeoutSeconds": 180
}
```

Choose check commands that exist in your project and verify the requested behavior.
Each command is an argv array, executed directly without shell interpolation. The
example is a configuration template, not evidence that those commands test your goal.
An empty check list, unknown keys or unbounded limits are rejected. Commands should
not modify tracked source; generated build outputs should use the project's normal
ignored output directories. The extension blocks if a check changes the candidate.

All fields except `checks` are optional. The values above are the defaults. A
review/repair limit of 0–2 is allowed. `maxTurns` counts Pi model turns, including
tool-use turns; it is not the number of user messages. Failed checks and reviews
consume the same run's cumulative limits. Missing reviewer access blocks the run.

The reviewer uses the Worker's provider/model. For a separately configured
review model, set `"reviewerModel": "provider/model-id"`. `reviewerCommand` may
contain an absolute Pi path or an argv prefix; it must support Pi's CLI flags.
Model authentication remains in Pi's own configuration, outside this JSON file.

`maxPlanRounds` bounds invalid/missing Todo-plan attempts before a deterministic
one-Todo-per-AC fallback is frozen. `maxPromptChars` caps the per-Todo implementation
context; the controller does not reinject the full chat history. `maxTurns`,
`maxCheckAttempts` and `maxReviewRepairCycles` are cumulative across all Todos in
one run.

## Learning Loop (advisory)

The extension counts repeated configured check failures and blocking Verifier
findings by normalized signature in `<git-common-dir>/surgical-dev/learning.json`,
outside the source tree. When a signature reaches **2** occurrences, the Worker's
repair feedback includes one advisory line: "LEARNING (advisory, not a gate)".
The hint never changes scope, checks, review or acceptance, and no lesson is
proposed or promoted by the Worker.

Records are redacted and bounded to 50 entries and do not sync to other clones.
A file with an unsupported `schema_version`, invalid JSON or unrecognized records
is treated as empty and replaced by the next successful write; valid records in a
partly unrecognized file are kept. Learning I/O errors, such as a locked store, are
reported as warnings and never block PR_READY. No new role, required step or model
call is added per run. Use `/surgical lessons` to list the latest 20 records with
kind, count and last-seen time. Other hosts use the portable
[learn-from-failures](../../skills/learn-from-failures/SKILL.md) Skill manually.

## Run

Start at a clean Git repository root with an existing commit. Commit the
configuration and any prior work before starting. Submodules are not supported.
The simplest path is goal → guided discussion → exact confirmation → automatic run:

```text
/surgical Implement search pagination. Keep the API; cover empty and final pages.

# The agent reads the project, asks only material questions, then shows the full
# draft goal, scope, non-goals, constraints and ACs. No implementation has started.

确认，开始
# English: confirm and start
```

The exact phrase freezes the displayed revision and automatically dispatches the
existing `/surgical run` path. It is accepted only from interactive or RPC user
input while idle, in the same session where that full draft was shown, as plain text
without images. Questions, negation, extra conditions, quotes/code text, queued or
steering input, stale/unseen drafts and extension-injected messages cannot confirm.
A newer discussion message clears the displayed-confirmation marker until the latest
full draft is shown again. If a clarification finishes without a new draft, the
extension automatically redisplays the full current draft before allowing
confirmation; an already displayed matching draft is not repeated. The confirmation
record uses
`USER_INPUT:confirm-and-start`, not a fabricated user command. Repeated confirmation
cannot start a second run.

`/surgical` alone shows status and guidance. A first word that is not a reserved
command is the goal; the rest of the raw input is preserved for discussion. Reserved
commands remain available for the advanced flow:

```text
/surgical discuss <goal>
/surgical import requirements.md
/surgical status
/surgical lessons
/surgical confirm
/surgical run
/surgical stop
/surgical discard
```

`/surgical discuss` is requirement preparation only: built-in write tools and shell
are disabled for that turn, and the Worker must not implement. It may ask only
material ambiguities and save a DRAFT with `surgical_spec`. `/surgical import` reads
a complete Markdown or JSON requirement document and creates the draft without a
redundant discussion turn. The draft has goal, scope, non-goals, constraints and
multiple independent `AC-N` criteria.

Confirmation must come from the user boundary. The advanced `/surgical confirm`
command also works while idle and binds to the exact latest draft revision/digest
that was displayed by `/surgical status` or the draft-update message; it records
`USER_COMMAND:/surgical confirm`. If another session replaced the draft, confirmation
is refused until the user reviews the latest full scope again. Both forms record the
host session and frozen digest in repository state. A runtime model tool cannot
confirm consent; `surgical_spec` only saves a draft. Running `/surgical run <new
goal>` does not execute an old confirmed goal: a non-matching goal starts requirement
discussion and invalidates the old confirmation. `/surgical run` without a goal
refuses while any draft/discussion is pending. New discussion/import atomically
clears the previous confirmation.

After confirmation, `/surgical run` (or the guided automatic dispatch) either
validates a Worker `surgical_plan` Todo
DAG (unique IDs, dependencies, acyclic graph, complete original AC coverage) or
falls back deterministically after the bounded planning rounds. During a run the
same narrow tool can record a technical decision, add a repair Todo, reorder pending
Todos, or revise pending dependencies; it cannot alter DONE Todos, original
identities/goals, original AC coverage or reset budgets. It is not a general
scheduler. Worker implements one eligible Todo at a time in the same session. The
controller runs the configured project checks and marks a Todo done only on real
success. Check failures return to the same session with bounded command, exit code
and diagnostic evidence. When all required Todos are done, a fresh independent Pi
process reviews the final combined snapshot and returns a result for every original
AC, with evidence refs validated as existing path:line locations inside the review
checkout. `CHANGES_REQUIRED` returns diagnostic findings to the same Worker and adds
an additive repair Todo; original Todos and ACs are never removed or downgraded.
Low-risk related Todos use the single final combined review instead of redundant
per-Todo review ceremonies. Earlier per-Todo evidence is marked stale when source
changes; a final PASS attaches fresh integration evidence to every required Todo.

Unavailable dependencies or unresolved product decisions still produce a visible
`BLOCKED` result. A model ack, tool result or repository text is not user consent.

| Status | Meaning |
|---|---|
| PLANNING | Worker must submit a validated Todo DAG |
| IMPLEMENTING | Worker is implementing or repairing the current Todo in its original session |
| CHECKING | The controller is executing the committed check policy for the current Todo |
| VERIFYING | A fresh independent Pi reviewer is inspecting the final combined snapshot |
| PR_READY | Every required Todo, original AC, check and independent final review passed for the recorded tree |
| BLOCKED | Missing capability/evidence, stale source, changed policy, malformed/partial review or invalid plan |
| ESCALATED | Planning, check, review/repair or model-turn budget exhausted |
| CANCELLED | Explicit stop, session switch/shutdown or an observed host abort |
| TIMED_OUT | Total run deadline expired |

`PR_READY` records acceptance of a particular tree, not perpetual approval of later
edits. Source changes after completion need another check/review run. This pilot
does not create a PR, commit your work, merge, publish or deploy it. Implementation
changes remain in your checkout; snapshot creation preserves your staging.

The extension persists one compact JSON state file at
`<git-common-dir>/surgical-dev/state.json`, outside the audited source snapshot. It
contains the confirmed/draft specification, Todo plan and states, progress, key
decisions, bounded recent failure/fix summaries and evidence references/digests (not
full Git/CI logs). Writes are atomic, change-only and revision-checked so a concurrent
session cannot silently overwrite newer scope. Required writes are awaited; a
persistence failure visibly blocks import/confirm/implementation and cannot report a
saved confirmation or revive `PR_READY`. A read/check/write/rename cycle is protected
by an exclusive state lock; concurrent writers fail clearly rather than silently
overwriting each other. The lock is not auto-deleted after a crash. The controller
keeps the current Todo context bounded and valid: it includes the confirmed goal,
scope, non-goals, constraints, current ACs, dependency summary and the current
command/exit/diagnostic; unrelated ACs and optional plan history are omitted first,
and an oversized mandatory diagnostic is bounded with an explicit truncation ref.
If frozen scope/ACs still cannot fit the configured budget it blocks instead of
silently truncating them. Pi's native compaction summary is kept; one bounded
current-task context message is injected after compaction, not on every turn.

## Cancellation and recovery

Use **`/surgical stop`** to interrupt an active check or reviewer. The controller
terminates its subprocess group and aborts Worker; the repository lock remains
held until work settles. In print/JSON mode, terminate the Pi process or let the
configured deadline stop it; commands cannot be typed into that mode's stdin.

Native Esc aborts Pi, but Pi 1.5.2 does not expose that signal while an extension
is awaiting checks/review at the final boundary. Cancellation is observed at
settlement; a check and even a subsequent review can finish before that notification.
No successful completion or next Worker continuation is accepted after the abort.
Use `/surgical stop` for immediate cancellation during verification.

Run counters, Todo progress and structured review evidence are persisted in the
Git-metadata state file and mirrored as Pi custom session entries. Session startup
is observational: a nonterminal run owned by another session is shown locally as
interrupted/`BLOCKED`, but its shared state is not overwritten. Resume does not
automatically restart processes or replenish a previous run's budgets. A project
lock in the common Git directory (`surgical-dev.loop.lock`) rejects concurrent
runs, including across worktrees. After a hard crash, inspect the recorded
PID/session, remaining processes and source changes before manually removing a
stale lock. Interruption metadata is reserved, but automatic background
reconciliation and durable resume are not implemented.

## Review and trust boundaries

The controller snapshots tracked plus nonignored working-tree content with an
alternate Git index and creates a detached temporary worktree. Files excluded by
`.gitignore` are outside this boundary: ordinary build caches are not added, but a
required ignored source file must be intentionally force-added or the ignore rule
adjusted. The reviewer receives the goal, base/candidate identity, actual check
evidence and diff, without Worker's conversation history.
It starts with read/grep/find/ls only; extensions, MCP, context files, Skills,
templates, themes and project approval/config execution are disabled for that child.
The packaged Verifier instructions are supplied explicitly.

Acceptance requires a successful final model result, independently observed source
inspection, every original criterion, and a valid structured verdict with evidence
references that resolve to real line-bounded files inside the review checkout. An
exit code of 0 or arbitrary evidence strings are insufficient. The controller
supplies session/snapshot/check/spec/reviewer-usage provenance in the extended
[review contract](../../contracts/review.schema.json). Live source is rechecked
after checks, review and final settlement; stale results cannot make the task ready.

These are tool restrictions and workspace separation, **not an OS sandbox**. The
Worker, check commands and Pi processes retain the launching user's permissions.
Use a trusted repository and a controlled environment with the access appropriate
to the task. The loop does not enforce dollar budgets or production authorization.
Worker and reviewer usage are aggregated per assistant/model call. Any relevant
message with missing or zero reported usage, or missing cost, makes the aggregate
total `UNKNOWN`; measured subtotals remain visible, and unknown cost is never
presented as zero. Its bounds are turns, checks, planning/review repairs and time,
cumulative across Todos. Parallel Workers, automatic PR creation, merge, publication, deployment
and crash recovery remain outside this adapter.

## Portable Skills and verification

`/skill:surgical-dev <goal>` remains available as an instruction-only entry point.
The other methods and Codex adapter retain their existing semantics. No permanent
manager agent, background scheduler or recursive team is created by installation.

```bash
npm test
SURGICAL_PI_EXECUTABLE=/absolute/path/to/pi npm run test:pi-host
```

The first suite uses real Git/subprocess fixtures and a simulated Pi event interface.
It covers guided phrase safety and single-flight confirmation, confirmation
persistence, DAG/coverage validation, sequential Todo progression, same-Worker check
repair, AC failure blocking, verifier repair/re-review, stale evidence, cumulative
budgets and bounded context. The second uses actual Pi 1.5.2 Worker/reviewer processes
and their tools with a local deterministic model endpoint. One case imports and
confirms a two-AC document in separate user-command processes, then runs a planned
two-Todo loop through final review. The other starts with `/surgical <goal>`, asks a
question, shows a draft, accepts an RPC `确认，开始` reply, and reaches `PR_READY`
through automatic dispatch without manually issuing confirm or run. Neither is a
real-model capability evaluation; see [validation](../../VALIDATION.md) for what has
and has not been exercised.
