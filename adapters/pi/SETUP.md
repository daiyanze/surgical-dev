# Pi setup — Skills-only package

This archive has `pi.skills` metadata and ten discoverable Skills. It has no
extensions, hooks, custom tools, subagent scheduler, or automatic session launcher.
Package structure follows the official [Pi package documentation](https://pi.dev/docs/latest/packages)
and [Skill documentation](https://pi.dev/docs/latest/skills), checked 2026-11-07.
The local installation itself has not been exercised in this delivery environment.

## Install locally

Extract the archive to a stable folder and inspect its contents first. Pi records
local package paths without copying the directory, so do not delete or move it
while it is installed. From the folder containing `surgical-dev/`, run:

```bash
pi install ./surgical-dev
```

That command modifies Pi's user settings. To restrict installation to a chosen
project, run from that project's directory and use an absolute package path:

```bash
pi install -l /absolute/path/to/surgical-dev
```

Start a new Pi session for the target repository. After confirming the Skills are
discoverable, use the documented Skill command:

```text
/skill:surgical-dev Fix the selected bug within the approved scope.
```

For implementation the current session remains Engineer. Scout, Verifier and
Operator methods must run in their appropriate contexts with verified handoffs.
Pi metadata does not create four Bots or enforce role routing. Referenced files are resolved from the
loaded Skill's directory, not from the target repository. Keep the entire package
layout intact; copying only `skills/` drops shared role and workflow references.

## Independent review in the content-only pilot

Prepare the [review request](../../templates/review-request.md), including current
scope, provenance, snapshot and checks. A human may route it to a genuinely
separate Verifier session or Bot. In an already authorized, isolated review
workspace, a separate Pi session can load:

```text
/skill:verify-change Review the supplied version-bound request independently.
```

Do not copy Engineer's conversation history. Do not give the review environment
production credentials. Starting a new session alone does not make shell access
read-only. Use actual runtime permissions and safe environment controls.
The report comes back through the approved handoff and is checked against the
current task. If no separate reviewer exists, leave the task BLOCKED.

## What is deliberately absent

`/surgeon start`, `/surgeon review`, `/surgeon status` and `surgeon_*` tools are not
provided. Do not invoke them as though they existed. See
[runtime-next.md](../../docs/runtime-next.md) for the remaining implementation.

## Offline structural tests

With Node.js 18 or later, no npm dependency installation is required:

```bash
cd /absolute/path/to/surgical-dev
npm test
```

These tests check package resources and consistency, not real agent behavior.
