# Codex setup — Skills plus one optional reviewer agent

This is content only. It adds no hooks, plugin, scheduler or automatic handoff.
Codex behavior below follows the official Codex documentation on
[skills](https://learn.chatgpt.com/docs/build-skills) and
[subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), checked
2026-11-10. The install step was run against a temporary project with the skills
CLI; no Codex session was run, so skill discovery and subagent spawning are
unverified here.

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

The current session is Engineer. Nothing else is started for you.

## Independent review

The Verifier must be a separate context that did not write the change. Choose one:

1. **Reviewer subagent.** After checks pass, ask Codex to spawn the `verifier` agent
   with only the filled [review request](../../templates/review-request.md), then
   run `$verify-change` on it. The subagent has its own thread and instructions.
2. **Separate session (stronger).** Open a new Codex session in a clean checkout or
   worktree of the head snapshot and run `$verify-change` with the same request.

Limits of option 1, from the Codex docs: a subagent inherits the parent's sandbox
and approvals, and "do not edit files" is an instruction, not a read-only sandbox.
The parent also chooses what the reviewer sees. Use option 2 for sensitive changes
or when the review environment must not share the Engineer's credentials. If no
separate reviewer is available, leave the task BLOCKED.

## Parallel streams

Codex can run subagents in parallel (`agents.max_concurrent_threads_per_session`),
but the documentation does not describe isolated workspaces for them. Without a
separate worktree per stream, stay serial, as the policy default requires. Keep
`temporary_subagents_enabled: false` unless you have set up isolation and accept
that helpers share the parent's permissions.

## Not provided

No `/surgeon` commands, role routing or automatic handoff between sessions. See
[distribution](../../docs/distribution.md) and
[remaining runtime work](../../docs/runtime-next.md).
