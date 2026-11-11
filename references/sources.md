# Sources and verification scope

S1 and S5 consulted on 2026-11-07; S7 on 2026-11-08.
This is a design, not a measured performance claim.
Current product capabilities remain subject to the actual account, host and version.

- **S1. Anthropic — Building agents: When to fold subagents into your main agent loop.**
  https://claude.com/resources/articles/building-agents-when-to-fold-subagents-into-your-main-agent-loop
  Indexed official excerpts from the `/it/`, `/fr/` and `/de/` variants supported the
  context-boundary/progressive-disclosure rationale. Full-page open requests failed
  during this update; no claim is made that the entire current article was re-read.
- **S5. GitHub Docs — About protected branches.**
  https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
  Full page retrieved: required checks, review settings, stale approvals, expected
  check sources, merge queues and bypass controls. GitHub's acceptable status
  semantics are not identical to proving that every intended test executed.

- **S7. Chih-Hsuan Yang, Xinyang Li, Rajeev Thakur and Feng Yan (2026) — Beyond Division of Labor: How Roles Shape Feedback and Recovery in Multi-Agent Systems.**
  https://arxiv.org/abs/2611.03931
  [PDF](https://arxiv.org/pdf/2611.03931) · [HTML](https://arxiv.org/html/2611.03931v1)
  Full paper and relevant supplementary experiments consulted on 2026-11-08.
  In a fixed Planner–Executor–Reviewer team, reviewer-controlled submission can
  limit access to external corrective feedback. In a single exploratory run with
  gemma-4 on 400 Omni-MATH problems, submitting every cycle improved recovery
  while preserving the role prompts.
  Design relevance for Surgical Dev: assess feedback access, routing and recovery
  separately from role fidelity. As an engineering implication, distinguish
  permission to run authorized diagnostics from acceptance and delivery gates.
  Scope: text-based mathematical/scientific reasoning with a ground-truth-informed
  evaluator; not a software-development benchmark or proof that removing roles or
  release authorization improves engineering outcomes. The findings do not
  establish an optimal checking frequency or cost advantage.

## Project inputs

- User-provided goals and agreed four-role, goal-driven organization model.
- Current role, workflow, evidence, repair-budget and authorization contracts.
- Automatic technical decomposition, bounded capacity and independent integration acceptance are project design choices; their behavior still requires host-level validation.

No copied third-party source code, credentials or vendor logos are included.
The roles, state names, budgets and formats are design choices, not vendor APIs.

## Skill format and host documentation

Checked on 2026-11-07; Codex, Claude Code, and skills CLI documentation rechecked
on 2026-11-11. These support file formats and setup instructions, not
the reliability of this workflow. No provider endorsement is implied. Account UI
and runtime versions still need local verification.

- [Agent Skills specification](https://agentskills.io/specification): Skill metadata and directory format.
- [Pi packages](https://pi.dev/docs/latest/packages): `pi.skills`, local install paths, and installation scope.
- [Pi Skills](https://pi.dev/docs/latest/skills): discovery, resource-relative paths, and `/skill:name`.
- [Codex skills](https://learn.chatgpt.com/docs/build-skills) (formerly `developers.openai.com/codex/skills`): `.agents/skills/` discovery, `$name` / `/skills` invocation.
- [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents): `.codex/agents/*.toml`, `agents.max_concurrent_threads_per_session`, sandbox inheritance.
- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode): `codex exec`, workspace access, structured output, and continuation.
- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk): starting, continuing, and resuming threads for programmatic workflows.
- [Claude Code Skills](https://code.claude.com/docs/en/skills): project and personal Skill discovery and `/name` invocation.
- [Claude Code subagents](https://code.claude.com/docs/en/sub-agents): separate contexts, fork behavior, explicit Skill instructions, and tool configuration.
- [Claude Code goals](https://code.claude.com/docs/en/goal): automatic continuation toward a condition; the evaluator reads conversation evidence rather than independently inspecting files.
- [Claude Code scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks): `/loop` scheduling and execution conditions.
- [skills CLI](https://github.com/vercel-labs/skills): installation commands, agent selection, and Node requirements.
- [skills CLI supported agents](https://github.com/vercel-labs/skills/blob/main/docs/agents.md): per-agent install paths.

The Codex CLI's local help was inspected, but no Codex or Claude Code model session
was run. Native host automation capabilities are documentation-backed; this is not
evidence that a dedicated Surgical Dev controller exists for either host. Pi's
implemented lifecycle and separate evaluation limits are recorded in
[validation](../VALIDATION.md).
