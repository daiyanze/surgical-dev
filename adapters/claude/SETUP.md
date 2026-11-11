# Claude Code setup — Skills, independent review, and native loops

Claude Code can load all thirteen Skills and automate work with native commands.
This repository does not include a Claude Code implementation of the Pi
check/review/repair controller. Guidance below follows official documentation
checked on 2026-11-11; no Claude Code runtime session was tested here.

## Install and invoke

From the target project, using Node 22.20+ for the skills CLI:

```bash
npx skills add daiyanze/surgical-dev --skill '*' -a claude-code -y
```

The installer exposes the Skills in `.claude/skills/`. Add `-g` for user-level
installation. In Claude Code:

```text
/surgical-dev Fix duplicate form submissions. Keep the API and add a regression test.
/ship-feature Add search pagination, including empty results and the final page.
/fix-bug Two clicks on checkout create two orders. Find and repair the cause.
```

These are alternative entry points. See the official
[Skills guide](https://code.claude.com/docs/en/skills) for discovery and invocation.

## Independent review

After checks pass, use a fresh reviewer session or a **non-fork subagent** that
did not write the change. Provide the completed
[review request](../../templates/review-request.md): goal, fixed source snapshot,
constraints, and actual check evidence. In a new session, invoke `/verify-change`
with that packet. For a subagent, explicitly include the `verify-change`
instructions; Skills invoked in the parent are not automatically inherited by
an ordinary fresh subagent. Give the reviewer source access without editing rights.

Return actionable findings to the original Worker, rerun checks, and request
another independent review. A changed candidate needs fresh acceptance. See
[Claude Code subagents](https://code.claude.com/docs/en/sub-agents) for context and
tool configuration.

## Native automation

- **`/goal` continues toward a completion condition.** For example, after installing
  the Skills, ask:

  ```text
  /goal Use surgical-dev to fix duplicate form submissions. The goal is met when regression checks pass and a fresh Verifier using verify-change reports no blockers. Stop and report a blocker if progress requires unavailable access, or after two review/repair cycles.
  ```

  This is a suggested prompt, not a runtime-tested adapter. The goal evaluator
  reads the conversation; it does not independently inspect files or run checks.
  Keep the separate Verifier. Limits expressed in a goal are model-evaluated,
  rather than the Pi extension's controller-enforced counters. Use `/goal clear`
  to remove the goal. [Official goal documentation](https://code.claude.com/docs/en/goal).

- **`/loop` repeats prompts on a schedule.** For example,
  `/loop 5m Check the current branch's CI status and report failures.` is useful
  for periodic monitoring. Scheduled work runs while Claude Code is running and
  idle. [Official scheduling documentation](https://code.claude.com/docs/en/scheduled-tasks).

Both use the session's available capabilities and permissions. Configure the
access required by the task before expecting unattended operation. These native
controls do not establish that Surgical Dev's snapshot, evidence, and repair
contracts have been enforced by a dedicated controller.
