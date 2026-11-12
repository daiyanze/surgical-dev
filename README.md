# Surgical Dev

**Give your coding agent a clear way to build, verify, and repair.**

Surgical Dev is a collection of Skills for coding agents. It gives them a repeatable
way to understand a goal, make focused changes, get independent review, and work
through the findings. Use it with Pi, Codex, Claude Code, or other hosts that support
Agent Skills.

## Why it exists

Generating code is one part of delivering a working change. A task can still go
wrong when:

- **The scope drifts.** A small fix grows into a rewrite, assumptions go unstated,
  and unrelated code changes along the way.
- **The context gets fragmented.** Planning, coding, and debugging bounce between
  agents. You end up restoring context and relaying feedback yourself.
- **“Done” is hard to trust.** The author reviews its own work, checks refer to an
  earlier revision, or individually passing pieces fail when combined.

Surgical Dev addresses these problems through explicit working habits, ownership,
and acceptance criteria. The aim is to reduce the coordination you need to do
between giving an agent a goal and receiving a verified change.

## How it works

One **Worker** owns implementation from reading the repository through debugging
and repair. A separate **Verifier** inspects the result against the goal and actual
check evidence. Findings return to the Worker that already understands the work.

![Surgical Dev workflow: a goal enters one Worker context; failed project checks and required review fixes return to that same Worker. Passing checks sends a fixed snapshot to a fresh Verifier. Passing independent review leads to PR Ready.](docs/images/workflow.png)

This is the loop for **one workstream**. Every repair goes through checks and a
fresh review again. Missing evidence or exhausted limits stops the loop with a
visible reason. Larger projects also need decomposition and integration acceptance.

The name comes from a surgical team: a lead practitioner stays with the task while
others provide focused support. There are three roles: **Product Scout** investigates
what to build and evaluates outcomes; **Worker** implements, repairs, and handles
authorized delivery and incidents; **Verifier** independently checks the result.
Most changes need only Worker and Verifier. Worker keeps ownership when the task
continues into delivery or operations.

## What makes it different

- **Keep the implementation context together.** Reading, planning, coding, testing,
  and repairs stay in one Worker session per workstream. Delegate independent
  questions or separable outcomes when the host can support them safely.
- **Make the smallest sufficient change.** Surface consequential assumptions,
  follow the existing codebase, and keep edits tied to the requested outcome.
  Verification should demonstrate the behavior the user asked for.
- **Make review independent and actionable.** The Verifier uses a separate context
  and inspects current source and evidence. Blocking findings explain the defect,
  its impact, and what resolves it; optional style preferences remain advisory.
- **Work from goals, with explicit limits.** You provide the goal and constraints;
  Worker organizes the technical work. The methods define bounded repair cycles
  and require a visible blocker when inputs, evidence, or execution capacity are missing.

The [thirteen Skills](skills/) cover features, bug fixes, project decomposition,
integration, review, and delivery. Load the methods a task needs. They provide
instructions; the host supplies tools, sessions, isolation, and execution control.

## Get started

### Install for your agent

Run the matching command from your project directory:

```bash
# Codex: all thirteen Skills
npx skills add daiyanze/surgical-dev --skill '*' -a codex -y

# Claude Code: all thirteen Skills
npx skills add daiyanze/surgical-dev --skill '*' -a claude-code -y

# Pi: all thirteen Skills plus the optional loop extension
pi install git:github.com/daiyanze/surgical-dev
```

The [skills CLI](https://github.com/vercel-labs/skills) requires Node 22.20+.
Pi has its own [requirements and setup](adapters/pi/SETUP.md).
For just the entry Skill, replace `--skill '*'` with `--skill surgical-dev`.
See [installation options](docs/distribution.md) for scope and other hosts.

### Start with a concrete goal

The Skill name is the same across hosts; the invocation syntax differs:

| Host | Example in an interactive session |
|---|---|
| Codex CLI / IDE | `$surgical-dev Fix duplicate form submissions. Keep the API and add a regression test.` |
| Claude Code | `/surgical-dev Fix duplicate form submissions. Keep the API and add a regression test.` |
| Pi | `/skill:surgical-dev Fix duplicate form submissions. Keep the API and add a regression test.` |

You can also select a specific method. These examples use Codex syntax; use `/name`
in Claude Code or `/skill:name` in Pi:

```text
$ship-feature Add search pagination. Cover empty results and the final page.
$fix-bug Submitting the checkout form twice creates two orders. Preserve the API.
$decompose-project Add team invitations with expiry, acceptance, and audit history.
```

Give the agent the outcome, constraints, and observable success criteria. For a
larger project, Worker organizes the workstreams and dependencies.

## Which Skill should I use?

All thirteen Skills can be requested directly. **Start with `surgical-dev` for
everyday work**, or select a method when you already know what you need. They are
reusable methods, not thirteen stages that every task must pass through.

| Skill | When to use it | What it produces |
|---|---|---|
| [surgical-dev](skills/surgical-dev/SKILL.md) | Start from a development goal | Selects the relevant responsibility and methods, then guides the work |
| [ship-feature](skills/ship-feature/SKILL.md) | Add a feature or change behavior | Acceptance criteria, focused implementation, tests, and a review handoff |
| [fix-bug](skills/fix-bug/SKILL.md) | Investigate and repair a defect | Reproduction evidence, a supported cause, a minimal fix, and regression checks |
| [decompose-project](skills/decompose-project/SKILL.md) | Organize a goal with several outcomes | Testable workstreams, dependencies, interface boundaries, and integration ownership |
| [engineering-discipline](skills/engineering-discipline/SKILL.md) | Keep any coding task focused | Explicit assumptions, simple design, scoped edits, and observable checks |
| [verify-change](skills/verify-change/SKILL.md) | Independently assess a candidate | `PASS`, `CHANGES_REQUIRED`, or `BLOCKED`, with evidence and actionable findings |
| [delegate-bounded-task](skills/delegate-bounded-task/SKILL.md) | Hand off an independent question or isolated subtask | A bounded helper assignment and usable findings; requires enabled delegation |
| [integrate-workstreams](skills/integrate-workstreams/SKILL.md) | Combine accepted workstreams | An integrated candidate, whole-project checks, and independent acceptance |
| [discover-opportunity](skills/discover-opportunity/SKILL.md) | Decide what is worth building | A sourced problem proposal, priority, and measurable outcome |
| [evaluate-outcome](skills/evaluate-outcome/SKILL.md) | Assess a shipped change against its goal | A baseline-based assessment: supported, inconclusive, or regressed |
| [prepare-release](skills/prepare-release/SKILL.md) | Check whether a candidate is ready to release | Readiness evidence, observation and recovery plans; no release execution |
| [release-and-observe](skills/release-and-observe/SKILL.md) | Perform an already authorized release | Execution evidence, health observations, and the actual release outcome |
| [handle-incident](skills/handle-incident/SKILL.md) | Respond to a production incident | Triage, authorized containment, bounded repair, and recovery evidence |

**Independent review needs a separate context.** Run `verify-change` in a fresh
reviewer session or subagent that did not write the change. Supply the goal, fixed
source snapshot, and check results using the [review request](templates/review-request.md).
Invoking it inside the author's conversation does not establish independent acceptance.
See the [Codex](adapters/codex/SETUP.md) and [Claude Code](adapters/claude/SETUP.md)
guides for examples.

`decompose-project` supplies a plan; the host supplies execution and scheduling.
Release methods operate within the task's existing authorization. Using
`ship-feature` does not itself authorize deployment.

## Which agents can run an automatic loop?

**Pi, Codex, and Claude Code can all automate work.** The distinction is what the
host provides and which Surgical Dev controller this repository includes:

| Host | Native automation / available execution | Surgical Dev support here |
|---|---|---|
| **Pi** | Extensions can control the session and launch a reviewer | **Implemented:** requirement discussion/import, explicit confirmation, Todo planning, one persistent Worker, checks, independent final review, repairs, and bounded stopping for one workstream |
| **Codex** | `codex exec` runs non-interactively; the SDK continues or resumes threads; subagents support separate review | All Skills and an optional reviewer configuration. No bundled Surgical Dev loop controller |
| **Claude Code** | `/goal` continues toward a completion condition; `/loop` repeats prompts on a schedule; subagents support separate review | All Skills and setup guidance. No bundled Surgical Dev loop controller |

Claude Code's `/goal` evaluator reads the conversation; it does not independently
inspect source or run checks. Request a separate Verifier for Surgical Dev acceptance.
`/loop` is useful for periodic checks such as monitoring CI; it is a scheduling
mechanism, not a definition of when a development task is complete.

Host commands and examples: [Pi setup](adapters/pi/SETUP.md),
[Codex setup](adapters/codex/SETUP.md), and [Claude Code setup](adapters/claude/SETUP.md).
Codex and Claude guidance is based on official documentation; their complete
Surgical Dev workflows have not been runtime-tested here. Pi's lifecycle has been
tested with real Pi processes and a local deterministic model; see
[validation](VALIDATION.md) for the remaining real-model evaluation work.

### Automate the loop with Pi

The full Pi package includes an optional extension for goal-driven autonomous
development. The normal path is **discuss → confirm → run → final acceptance**:

```text
# 1. Discuss requirements. This turn is read-only and must not implement.
/surgical discuss Fix duplicate form submissions. Keep the public API.

# Or import a complete requirements document without redundant discussion.
/surgical import requirements.md

# 2. Review the structured Goal Specification, then confirm it yourself.
/surgical status
/surgical confirm

# 3. Start planning and implementation; the Worker stays in one session.
/surgical run

# Inspect or stop at any time.
/surgical status
/surgical stop
```

The confirmed specification freezes scope, non-goals, constraints and multiple
independent acceptance criteria. Worker then plans a validated Todo DAG, implements
eligible Todos sequentially in the same Pi session, and lets the controller mark a
Todo done only after real project checks pass. A fresh independent Verifier reviews
the final combined source snapshot and evidence per original AC. Findings return
directly to that Worker for an additive repair Todo, followed by fresh checks and a
fresh review.

With Pi 1.5.2+, create and commit `.surgical-dev.json` in the target repository:

```json
{
  "checks": [["npm", "test"]]
}
```

Use checks that actually exist in your project. Start from a clean Git repository
root. `/surgical confirm` is an idle user command bound to the latest displayed draft
revision; no model tool or Worker turn can supply that confirmation. The extension
stores its compact, revision-checked plan/memory state under Git metadata
(`.git/surgical-dev/state.json`), outside the reviewed source snapshot. Snapshots
cover Git-tracked plus nonignored working-tree source; files excluded by `.gitignore`
remain outside that boundary.

`PR_READY` requires every required Todo done, every original AC independently
evidenced, configured project checks passing on the current tree, and a final
combined independent review PASS. The extension leaves the implementation in your
checkout. It does **not** commit, create a PR, merge, publish or deploy. It runs one
Worker sequentially, does not run parallel Workers, and does not automatically resume
after an interruption. Token/cost statistics are reported as `UNKNOWN` unless the Pi
host supplies usage. Follow [Pi setup](adapters/pi/SETUP.md) for configuration,
persistence and limits. Installing Skills alone does not activate this loop.

## Further reading

- [Installation and distribution](docs/distribution.md) — install one Skill or the full collection; understand host capabilities and package scope.
- [Pi setup](adapters/pi/SETUP.md) — configure checks, start and stop the automatic loop, and understand limits and recovery.
- [Codex setup](adapters/codex/SETUP.md) — invoke Skills, arrange independent review, and use non-interactive execution.
- [Claude Code setup](adapters/claude/SETUP.md) — invoke Skills, set up a fresh reviewer, and distinguish `/goal` from `/loop`.
- [Roles](roles/README.md) and [team boundaries](roles/team-boundaries.md) — who owns implementation, acceptance, discovery, and delivery.
- [Detailed workflow](references/workflow.md) — handoffs, repair cycles, and project-level integration.
- [Project goal](templates/project-goal.md) and [review request](templates/review-request.md) — reusable starting points for a task and its independent acceptance.
- [Contracts and limits](contracts/README.md) — evidence records, state transitions, and execution budgets.
- [Architecture](ARCHITECTURE.en.md) · [中文摘要](ARCHITECTURE.zh-CN.md) — the broader design and its rationale.
- [Validation](VALIDATION.md) — completed checks, host integration coverage, and the limits of current evidence.
- [Automation roadmap](docs/runtime-next.md) — remaining work toward unattended delivery and recovery.

## References

- [Anthropic: When to fold subagents into your main agent loop](https://claude.com/resources/articles/building-agents-when-to-fold-subagents-into-your-main-agent-loop) — context continuity and selective delegation.
- [Andrej Karpathy's coding observations](https://x.com/karpathy/status/2015883857489522876) and [community Skill implementation](https://github.com/multica-ai/andrej-karpathy-skills) — assumptions, simplicity, focused changes, and verifiable outcomes.
- [Superpowers](https://github.com/obra/superpowers) — reusable engineering methods, review, and verification.
- [Multica Best Practices](https://github.com/it235/multica-best-practices) — role boundaries, handoffs, and evidence.
- [Beyond Division of Labor: How Roles Shape Feedback and Recovery in Multi-Agent Systems](https://arxiv.org/abs/2611.03931) — feedback access and recovery as design considerations; this is not a software productivity benchmark.
- [Agent Skills specification](https://agentskills.io/specification) — the portable Skill format.

See [sources and verification scope](references/sources.md) for source details,
official host documentation, and the limits of the claims drawn from them.
