# Sources and verification scope

Sources S1-S6 consulted on 2026-11-07; S7 on 2026-11-08.
This is a design, not a measured performance claim.
Current product capabilities remain subject to the actual account, host and version.

- **S1. Anthropic — Building agents: When to fold subagents into your main agent loop.**
  https://claude.com/resources/articles/building-agents-when-to-fold-subagents-into-your-main-agent-loop
  Indexed official excerpts from the `/it/`, `/fr/` and `/de/` variants supported the
  context-boundary/progressive-disclosure rationale. Full-page open requests failed
  during this update; no claim is made that the entire current article was re-read.
- **S2. Grok Bot — Frequently asked questions / computer model.**
  https://docs.x.ai/grok-bot/faq
  https://docs.x.ai/grok-bot/computer-and-apps
  Official indexed text states that one user's Bots share a computer, files,
  browser sessions and command-line credentials; role separation is not isolation.
- **S3. Grok Bot — Approvals, security, and privacy.**
  https://docs.x.ai/grok-bot/approvals-security-and-privacy
  Official text describes Auto Review and action-specific approval rules. A grant
  in this design does not override the product's approval layer.
- **S4. Grok Bot — Message and collaborate.**
  https://docs.x.ai/grok-bot/chat-and-collaboration
  Official indexed text supports messaging and role addressing. Full direct-page
  retrieval was unavailable; reliable event delivery, resume/cancel semantics and
  authenticated workflow events must be tested in the chosen implementation.
- **S5. GitHub Docs — About protected branches.**
  https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
  Full page retrieved: required checks, review settings, stale approvals, expected
  check sources, merge queues and bypass controls. GitHub's acceptable status
  semantics are not identical to proving that every intended test executed.
- **S6. Grok Bot — Skills and routines.**
  https://docs.x.ai/grok-bot/skills-routines-and-automations
  Official indexed text distinguishes reusable methods from schedule/event triggers
  and recommends proving a one-off workflow before automating it.

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
