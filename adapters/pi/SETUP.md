# Pi setup — autonomous development pilot

The package exposes thirteen Skills and one opt-in extension. The extension closes
the single-workstream loop: Worker → actual checks → independent Verifier → repair.
The current Worker session owns implementation throughout. Success is `PR_READY`.

## Install

Requirements: Pi **1.5.2+**, Node **22.19+**, Git, and Linux or macOS. The integration
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

## Run

Start at a clean Git repository root with an existing commit. Commit the
configuration and any prior work before starting. Submodules are not supported.

```text
/surgical run Implement search pagination with tests for empty and final pages.
/surgical status
/surgical stop
```

The goal is recorded as a fixed `AC-1` covering the entire requested outcome. Use
a goal whose expected behavior can be independently inspected. Routine repairs do
not require a person to relay check failures or review findings. An unavailable
dependency or unresolved requirement can still produce a visible `BLOCKED` result.

| Status | Meaning |
|---|---|
| IMPLEMENTING | Worker is implementing or repairing in its original session |
| CHECKING | The controller is executing the committed check policy |
| VERIFYING | A fresh independent Pi reviewer is inspecting the fixed snapshot |
| PR_READY | Checks and independent acceptance passed for the recorded source tree |
| BLOCKED | Missing capability/evidence, stale source, changed policy or invalid review |
| ESCALATED | Check, review/repair or model-turn budget exhausted |
| CANCELLED | Explicit stop, session switch/shutdown or an observed host abort |
| TIMED_OUT | Total run deadline expired |

`PR_READY` records acceptance of a particular tree, not perpetual approval of later
edits. Source changes after completion need another check/review run. This pilot
does not create a PR, commit your work, merge, publish or deploy it. Implementation
changes remain in your checkout; snapshot creation preserves your staging.

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

Run counters, check outputs and structured review evidence are saved in Pi custom
session entries. Resume displays an interrupted run as `BLOCKED`; it does not
automatically restart processes or replenish a previous run's budgets. A project
lock in the common Git directory (`surgical-dev.loop.lock`) rejects concurrent runs,
including across worktrees. After a hard crash, inspect the recorded PID/session,
remaining processes and source changes before manually removing a stale lock.
Automatic reconciliation and durable resume belong to the next phase.

## Review and trust boundaries

The controller snapshots working-tree content with an alternate Git index and
creates a detached temporary worktree. The reviewer receives the goal, base/candidate
identity, actual check evidence and diff, without Worker's conversation history.
It starts with read/grep/find/ls only; extensions, MCP, context files, Skills,
templates, themes and project approval/config execution are disabled for that child.
The packaged Verifier instructions are supplied explicitly.

Acceptance requires a successful final model result, independently observed source
inspection, the exact original criterion and a valid structured verdict. An exit
code of 0 alone is insufficient. The controller supplies session/snapshot/check
provenance in the existing [review contract](../../contracts/review.schema.json).
Live source is rechecked after checks, review and final settlement; stale results
cannot make the task ready.

These are tool restrictions and workspace separation, **not an OS sandbox**. The
Worker, check commands and Pi processes retain the launching user's permissions.
Use a trusted repository and a controlled environment with the access appropriate
to the task. The loop does not enforce dollar budgets or production authorization;
cost visibility is recorded as `UNKNOWN`. Its bounds are turns, attempts and time.
The general multi-stream project-policy example remains disabled.

## Portable Skills and verification

`/skill:surgical-dev <goal>` remains available as an instruction-only entry point.
The other methods and Codex adapter retain their existing semantics. No permanent
manager agent, background scheduler or recursive team is created by installation.

```bash
npm test
SURGICAL_PI_EXECUTABLE=/absolute/path/to/pi npm run test:pi-host
```

The first suite uses real Git/subprocess fixtures and a simulated Pi event interface.
The second uses actual Pi Worker/reviewer processes and their tools with a local
deterministic model endpoint. It verifies lifecycle integration without credentials
or API spend. Neither is a real-model capability evaluation; see
[validation](../../VALIDATION.md) for what has and has not been exercised.
