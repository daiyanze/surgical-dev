# Pi autonomous loop implementation plan

> For agentic workers: execute inline using superpowers:executing-plans and test-driven-development. The accepted scope is the conversation's P0 + P1: one Engineer, fixed checks, independent review, automatic repair, bounded termination.

**Goal:** Add an opt-in Pi command that completes a bounded development task without manual feedback handoffs.

**Architecture:** Keep the current Pi session as Engineer. A small extension executes configured checks and starts a fresh read-tool-only Pi reviewer on a Git snapshot; actual findings request continuation in the same Engineer session. Existing role instructions and review record fields are reused. No service, daemon, automatic merge or deployment is added.

**Tech stack:** Node standard library and Pi v1.5.2 extension/JSON CLI interfaces; no new package dependencies.

**Spec:** P0/P1 of the roadmap approved for implementation in this conversation, plus the existing roles/verifier.md, contracts/review.schema.json, and tests/acceptance-scenarios.md.

## Constraints and decisions

- Provide `/surgical run <goal>`, `/surgical status`, and `/surgical stop`.
- Read fixed checks and finite limits from committed `.surgical-dev.json`; require a clean Git checkout at start.
- Defaults: 40 Engineer turns, 6 check attempts, at most 2 review/repair cycles, 1800 seconds total, 120 seconds per check, 180 seconds per reviewer.
- Preserve user staging by capturing snapshots with an alternate Git index. Review a detached disposable worktree; compare live source after checks and review.
- Disable reviewer extension/MCP/skill/template/context discovery and permit only read/grep/find/ls. These tool restrictions do not claim OS-level isolation.
- Validate reviewer session identity, final model stop reason, acceptance evidence, and findings. Bind identity and check metadata in controller code, not model output.
- Persist run state in Pi custom entries. Interrupted runs stop; automatic crash recovery and restarting expired budgets are outside P1.
- Keep all verification feedback available to Engineer. Do not modify delivery permissions or create scheduled jobs.

## Tasks

### 1. Runtime and meaningful regression tests

Files: adapters/pi/loop.mjs, adapters/pi/process.mjs, tests/pi-loop.test.mjs, tests/fixtures/pi-reviewer.mjs.

- [x] Write failing tests for check failure -> repair -> independent review -> PASS on real temporary Git repositories and real subprocesses.
- [x] Add cases for invalid/failed reviewer output, stale snapshots, bounded repair cycles, cancellation/timeouts, and unchanged user index.
- [x] Implement the smallest process/snapshot/review functions and loop state machine that pass those tests.

### 2. Pi event adapter and package integration

Files: adapters/pi/extensions/surgical.ts, adapters/pi/extension.mjs, package.json, tests/package.test.mjs.

- [x] Write tests driving command/lifecycle handlers with the documented Pi event shapes; preserve preceding boundary entries and avoid resubmission after abort.
- [x] Register the opt-in extension and include all runtime tests in npm test.
- [x] Install into an isolated Pi 1.5.2 configuration and verify the actual host lifecycle with a local deterministic model endpoint.

### 3. Documentation and verification

Files: README.md, adapters/pi/SETUP.md, docs/distribution.md, docs/runtime-next.md, VALIDATION.md, examples/pi-loop.config.json, relevant content-only descriptions, SHA256SUMS.

- [x] Document exact installation/configuration/commands and the distinction between runtime code, offline protocol tests and real model runs.
- [x] Synchronize references, run all Node/Python suites and regenerate checksums after staging final files.
- [x] Obtain an independent review and resolve concrete findings before committing on feat/pi-autonomous-loop.

## Review focus

- Empty or changed check policy cannot silently produce readiness.
- A successful child exit with failed/truncated model output never grants PASS.
- New files/deletions/staged contents belong to the reviewed snapshot; review results become stale after any relevant edit.
- Stop, abort, timeout, duplicate lifecycle events and session switching cannot start extra repair turns. Pi's native Escape signal is deferred during boundary checks; `/surgical stop` cancels subprocesses immediately.
- Missing Pi/authentication or unavailable independent review is recorded as BLOCKED, never success.
