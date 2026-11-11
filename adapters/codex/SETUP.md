# Codex setup — Skills, independent review, and automation

This package supplies Skills and an optional reviewer configuration for Codex.
Codex itself supports subagents and programmatic execution; a Surgical Dev loop
controller is not included. Behavior below follows the official documentation on
[skills](https://learn.chatgpt.com/docs/build-skills) and
[subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), checked
2026-11-11. The install step was run against a temporary project with the skills
CLI, and local CLI help was inspected. No Codex model session was run, so skill
discovery, subagent spawning, and a complete development loop remain unverified here.

## Install

From the target project:

```bash
npx skills add daiyanze/surgical-dev --skill '*' -a codex -y
```

This copies the thirteen Skills, with their bundled references, into
`.agents/skills/` (the repository-level Codex skills directory). Add `-g` for the
user-level `~/.agents/skills/`. Restart Codex if a Skill does not appear.

Optional reviewer agent (project level):

```bash
mkdir -p .codex/agents
curl -fsSL https://raw.githubusercontent.com/daiyanze/surgical-dev/main/adapters/codex/agents/verifier.toml \
  -o .codex/agents/verifier.toml
```

The skills CLI does not install this file. Read it before use.

## Use

In Codex CLI or the IDE extension, type `$surgical-dev` or run `/skills`:

```text
$surgical-dev Fix the selected bug within the approved scope.
```

The current session is Worker. It can use native subagents when instructed;
installing these files does not install an automatic check/review/repair controller.
Choose `$ship-feature` or `$fix-bug` directly for a known task.

## Independent review

The Verifier must be a separate context that did not write the change. Choose one:

1. **Reviewer subagent.** After checks pass, ask Codex to spawn the `verifier` agent
   with the filled [review request](../../templates/review-request.md) and explicit
   instructions to use `$verify-change`. The subagent has its own thread and
   instructions; do not substitute the Worker's self-review.
2. **Separate session.** Open a new Codex session in a clean checkout or worktree
   of the exact candidate snapshot and run `$verify-change` with the same request.

Limits of option 1, from the Codex docs: a subagent inherits the parent's sandbox
and approvals, and "do not edit files" is an instruction, not a read-only sandbox.
The parent also chooses what the reviewer sees. For sensitive changes, use option 2
in a separately restricted environment with only the reviewer's required access.
A new session or worktree alone does not isolate credentials. If no separate
reviewer is available, leave the task BLOCKED.

## Native automation

For a non-interactive run from the target repository:

```bash
codex exec --sandbox workspace-write \
  '$surgical-dev Fix duplicate form submissions, preserve the API, run regression checks, and request an independent verifier.'
```

Keep the single quotes: they prevent the shell from expanding `$surgical-dev`.
This is a prompt-directed Codex run. Surgical Dev's Pi controller does not run
inside it. The [non-interactive guide](https://learn.chatgpt.com/docs/non-interactive-mode)
covers structured output and resuming runs. The
[Codex SDK](https://learn.chatgpt.com/docs/codex-sdk) can continue a thread with
another `run()` call or resume it by ID, providing building blocks for a controller.
Unattended work needs the required tools and permissions already available.

## Parallel streams

Codex can run subagents in parallel (`agents.max_concurrent_threads_per_session`).
Give each editing stream its own checkout or worktree; otherwise stay serial,
as the policy default requires. Keep
`temporary_subagents_enabled: false` unless you have set up isolation and accept
that helpers share the parent's permissions.

## Not provided

No `/surgical run` controller, scheduler, or enforced Surgical Dev lifecycle.
The Skills can guide role selection and native delegation. See
[distribution](../../docs/distribution.md) and
[remaining runtime work](../../docs/runtime-next.md).
