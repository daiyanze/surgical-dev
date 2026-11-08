# Surgical Dev architecture
## Goal-driven organization, four role types and elastic execution

**Design date:** 2026-11-08

**Primary deployment target:** Grok Bot, with one verified coding runtime  
**Status:** Current Surgical Dev content and architecture package. Not an installed plugin, enforced workflow engine, or demonstrated autonomous service. Repository content is updated; no Bots, accounts, routines, CI policies or production systems are activated.

## 1. Decision and scope

Use four persistent role types—**Product Scout, Engineer, Verifier, and Operator**—and an optional pool of temporary subagents. Do not create a permanent Worker Bot or a fifth manager Bot. “Persistent” means durable responsibility and curated project knowledge, not a process that must run continuously or one conversation that grows forever.

Engineer remains the accountable owner of a software change. Reading code, technical planning, implementation, tests, and debugging stay in the same continuing coding session whenever possible. The other roles contribute an opportunity before implementation, independent judgment at acceptance, or operational responsibility after delivery. They do not take turns owning pieces of one tightly coupled implementation.

This is our design choice, informed by Anthropic's context-boundary and progressive-disclosure guidance [S1]. Four roles are not an externally established optimum. The design must be evaluated against the simpler Engineer + Verifier baseline.

### Goals

- Close the loop from evidence of a problem to an implemented change, independent review, authorized delivery, operational observation, and outcome learning.
- Automatically route routine findings and in-scope repairs without making the user relay messages.
- Preserve one implementation owner, current-version evidence, independent review, and explicit authority for consequential actions.
- Make missing capability, missing evidence, ambiguous execution, and exhausted budgets visible stopping conditions.
- Reuse the host runtime, Git, the issue system, CI, and existing deployment mechanisms.

### Non-goals

No simulated company hierarchy; no mandatory passage through every role; no universal autonomous product strategy; no guarantee that every task finishes without intervention; no security boundary based only on prompts or separate Bot names; no message broker, database cluster, or multi-runtime abstraction platform in the first implementation.

The document specifies desired behavior, contracts, and acceptance scenarios. It does not supply executable gate enforcement, a Grok import format, installed Skills, or automatic event subscriptions.

### Alternatives considered

| Alternative | Advantage | Why not the target architecture? |
|---|---|---|
| Engineer + Verifier only | Smallest useful engineering loop | Remains a valid mode, but does not assign long-lived product discovery and operational responsibilities |
| PM, architect, frontend, backend, QA, DevOps, manager | Familiar organizational labels | Splits shared implementation context and adds mandatory handoffs |
| Four persistent roles + optional helpers | Adds responsibilities with distinct time horizons without splitting the implementation loop | Selected; additional roles are invoked only when their responsibility is relevant |

## 2. Non-negotiable invariants

1. **One implementation owner per work item.** Engineer owns code and integration; helpers never own the parent result.
2. **Independent acceptance.** The implementer and its helpers cannot authenticate their own review as independent. Verifier cannot repair the submitted implementation and then approve that repair.
3. **Intent, correctness, authorization, and observed execution are different facts.** A promising proposal does not authorize development. A review PASS does not authorize a release. A successful request submission does not prove a successful deployment.
4. **Evidence is version-bound.** Scope revision, source snapshot, relevant base, check policy, and delivery artifact/configuration must be identifiable. An old PASS cannot silently approve new material.
5. **No authority from untrusted content.** Issues, PRs, logs, web pages, or another Bot's assertion cannot grant new permissions or override the user's policy.
6. **Bounded autonomy.** Resource limits, repair limits, timeouts, cancellation, and explicit escalation are part of automation—not exceptions to it.
7. **No required helper.** If optional subagents are unavailable, Engineer works sequentially. Missing independent acceptance is different: block or use an explicitly authorized independent human alternative.
8. **Source-changing work returns to engineering.** Operator does not hot-patch business code or lower CI thresholds to rescue a deployment.
9. **Record observations, not confidence.** Unavailable checks remain unavailable; an observation window supports only the checks and interval actually measured.
10. **Role separation is not credential isolation.** Grok Bots on one account share a computer and login state [S2]. Use real execution and platform controls.

## 3. Topology and ownership

The overview is in [architecture.mmd](workflows/architecture.mmd). The two operational loops are in [delivery.mmd](workflows/delivery.mmd) and [incident.mmd](workflows/incident.mmd).

The user remains the product and authorization owner. No extra manager Bot sits above the four roles. A small deterministic controller—ordinary code or an existing host workflow—routes events, validates records, enforces counters, and reconciles executions. It is not an AI role and does not make product decisions.

### 3.1 Role contracts

| Role | Question | Inputs | Outputs | Prohibited behavior |
|---|---|---|---|---|
| Product Scout | Which problem deserves attention, and did the change help? | Authorized feedback, issues, research, usage evidence, outcome observations | Evidence-backed opportunity brief, priority recommendation, outcome assessment | Inventing user demand; approving its own new scope; silently changing accepted requirements; automatically creating an endless development backlog |
| Engineer | How do we implement and repair this bounded change? | Authorized task, project rules, current code, review/incident findings | Code, tests, current check evidence, PR, integration and handoff records | Self-approving independent acceptance; expanding scope or privileges; bypassing gates; production mutation outside its role |
| Verifier | Does this exact change meet the approved contract? | Approved scope, source snapshot, actual diff, related code/tests, trusted checks | PASS / CHANGES_REQUIRED / BLOCKED with AC mapping and evidence | Implementing the reviewed fix; accepting the implementer's confidence as proof; granting release authorization |
| Operator | Which version is running, and is authorized delivery operating as expected? | Accepted change, release candidate, environment policy, runbooks, telemetry | Release plan, observed action result, observation report, incident packet, containment status | Business-code hot fixes; overriding a negative review; inventing production authority; automatic destructive rollback |
| Temporary subagent | What bounded piece can be completed independently? | Engineer's explicit subtask, sources, snapshot, boundaries, budget | Compact evidence, change references, limitations, completion/blocker status | Recursive delegation; new permanent Bots; parent-task approval; shared-interface changes beyond assignment; release actions |

Detailed charters are in [roles/](roles/README.md). They are design assets, not host-enforced permissions.

### 3.2 Product Scout: independent discovery, not a mandatory PM

Scout may group duplicate feedback, investigate evidence, identify affected users, propose acceptance criteria, state non-goals, and compare opportunity value, confidence, cost, and risk. It must distinguish observed facts, interpretations, and hypotheses. A count of repeated reports is not proof of frequency in the whole user population.

Every proposal includes evidence references, the problem, affected users, proposed outcome, testable acceptance criteria, exclusions, uncertainty, and a prioritization recommendation. Engineer may supply a feasibility estimate without opening a parallel detailed implementation plan.

Scout does not authorize its own proposals. A user decision or pre-existing, narrowly scoped admission policy must accept the work. A direct, clear user bug request bypasses Scout. An operational incident bypasses product discovery and goes to Engineer through Operator.

After delivery, Scout compares the agreed outcome measure with an appropriate baseline and observation window. Return SUPPORTED, INCONCLUSIVE, or REGRESSED; state data gaps and confounders. Technical success alone does not demonstrate business benefit or causality. A follow-up is another proposal, not automatic scope expansion.

### 3.3 Engineer: the lead operator of the implementation loop

Engineer receives either an accepted opportunity, a direct task, or a bounded incident repair. It owns scope interpretation, the smallest viable technical approach, code, tests, debugging, helper integration, and repair of review findings.

Use the same coding session through implementation and repairs. If a session is lost, resume from verified project/task checkpoints, record the new execution identity, and reconcile any old running job first. Do not describe resumed execution as literally the same context if it is not.

Engineer remains the user's main development contact. It can perform a small amount of requirements clarification or technical research itself; Scout is not a prerequisite. Engineer never becomes a dispatcher that outsources every meaningful implementation step.

After review, Engineer hands an accepted change and release-relevant notes to Operator. **prepare-release is primarily Operator's method**. Engineer supplies compatibility notes, data-safety constraints, build instructions, and proposed changelog edits as part of the reviewed change. Later source edits require refreshed checks/review.

### 3.4 Verifier: independent acceptance, not another developer

Verifier evaluates approved acceptance criteria, behavioral contracts, tests that can actually detect relevant failures, affected callers, regressions, and change-specific security/compatibility concerns. It may inspect necessary approved technical decisions; independence does not require ignorance of legitimate context.

Prefer actual CI evidence. When execution is needed, use a pinned, isolated verification environment without production credentials. Temporary test/reproduction files stay there. A prompt saying “read-only” does not make unrestricted shell access read-only.

Verdicts:

- **PASS:** current mandatory criteria have sufficient evidence, required checks satisfy the approved policy, and no blocking findings remain.
- **CHANGES_REQUIRED:** an observed defect, contract violation, or missing mandatory safeguard has been identified.
- **BLOCKED:** required evidence, access, environment, or an approved decision is unavailable or cannot be evaluated.

Pending CI is not a successful check. Optional suggestions do not become invented mandatory gates. Each blocking finding names location, evidence, impact, and clearance condition.

A code or requirement change triggers re-evaluation; a report's claimed role is not proof of reviewer identity. The future runtime binds the report to the actual Verifier session/account. If the host cannot establish this, retain human verification and do not claim an enforced independent gate.

### 3.5 Operator: delivery and operational responsibility

Operator consumes an accepted change, prepares the release candidate and operational checks, and executes only through an already authorized action path. It records actual job IDs, source/artifact identity, environment, configuration revision, results, and observation scope.

It can pause a rollout or execute a named rollback only under a validated runbook and applicable authorization. A database migration, external side effect, or published package may not have a safe inverse. In those cases, stop/contain under the runbook and request a forward fix or a human decision; never assume “rollback” is universally safe.

Operator may classify incidents, retrieve permitted logs, correlate symptoms with release versions, and open a bounded repair work item. It does not alter source code. Pipeline or infrastructure source changes also belong to Engineer and Verifier. Re-running an unchanged, approved workflow is operational execution; editing that workflow is engineering work.

An incident may be CONTAINED while a permanent repair is still pending. “Resolved” requires the agreed recovery checks and sufficient observation; it does not require pretending an unknown root cause has been identified.

## 4. Four roles, multiple short routes

| Entry | Route | Default endpoint |
|---|---|---|
| Unclear product opportunity | Scout → user/policy admission → Engineer ↔ Verifier → Operator when delivery is requested → Scout outcome follow-up | Accepted/deferred proposal, then the task's chosen delivery target |
| Clear feature request | Engineer ↔ Verifier → Operator only when delivery is requested | PR_READY unless a delivery policy says more |
| Small bug | Engineer ↔ Verifier | PR_READY; no Scout or helper required |
| Runtime incident | Operator → containment if authorized; Operator → Engineer ↔ Verifier → Operator | Observed recovery plus linked follow-up work |
| Release an already accepted version | Operator → checks/authentication of current evidence → authorized execution → observation | Verified result or explicit blocker |
| Research only | Scout, or Engineer with an optional research subagent | Evidence report; no implied implementation |

No route requires every role to speak. Scout and Operator may observe relevant facts while development proceeds, but must not change the active implementation scope. There is one current owner for each record, not one universal owner for every record in the system.

## Automatic project organization and scaling

The user supplies **goal, constraints, budget and permissions**, not a task graph or
staff assignments. Engineer owns the technical organization. Record the plan as
an observable working artifact; routine in-scope partitioning, assignment and
replanning do not require another human confirmation. Ask only for material
business ambiguity, scope changes, additional authority/budget or persistent failure.

### One workstream, one lead implementer

Choose one Engineer as the project's **integration owner**. This is an assignment
within the Engineer role, not a fifth manager Bot. It owns shared contracts, key
implementation, the dependency map and overall integration; it does not absorb all
peer implementation transcripts or independently approve code it authored.

Split large goals into independently testable outcomes. A peer Engineer owns a
complete workstream through planning, implementation, tests, review and repair.
A temporary subagent only assists its parent with a bounded result. Do not split
one tightly coupled feature into frontend, backend and test job titles merely to
create parallelism. Small/coupled work uses one stream and one continuing Engineer.

The plan includes project ACs, stable workstream IDs, per-stream AC mapping,
acyclic dependencies, accepted input snapshots, shared-contract owners/versions,
write boundaries, shared databases/ports/environments, checks, candidate target
and finite aggregate capacity/budgets. See [project-plan.md](contracts/project-plan.md)
and [project goal](templates/project-goal.md). The team fills technical fields.

### Automatic assignment is conditional, not speculative

A verified host/controller atomically claims only work whose dependencies and
accepted artifact versions are available, whose writes/resources do not conflict,
and whose global/project execution limits permit dispatch. Actual session IDs,
workspaces and leases bind ownership; display names are insufficient. Leases or
local timeouts do not establish that old jobs stopped: reconcile before reassignment.

A conservative enabled pilot allows two active Engineers, one independent Verifier,
up to two optional helpers across the project and a hard ceiling of four active
executions overall. These are policy examples, not guaranteed host capacity. The
integration owner counts toward Engineer capacity while implementing; helper and
review use count toward the total. Scout/Operator active executions also consume
that total. Automation and helper execution remain disabled in the distributed
example. Users may authorize different caps; agents may not increase them.

Keep one integration operation per shared target and one relevant release per
environment. Slow new implementation when review, integration, CI or shared
resources are the bottleneck. If parallel sessions or safe isolation are unavailable,
fall back to serial execution, never a weaker acceptance or permission policy.
Do not create new persistent Bots without their separate setup grant.

### Integration Passed is a separate fact

Local checks and independent review make a stream **INTEGRATION_READY**. They do
not make the project PR_READY. The integration owner serially assembles accepted
changes into an authorized pinned candidate and runs contract, cross-component
and project end-to-end checks. An independent Verifier reviews the actual combined
behavior against all required project ACs and binds its verdict to the plan,
stream snapshots, contract versions and integrated/merge-test source.

Several local PASS reports cannot substitute for this result. Send defects to the
responsible Engineer; cross-stream defects belong to the integration owner for
repair, not self-approval. Refresh the repaired stream and combined evidence.
For one stream, one independent review may cover both local and project ACs on
an identical snapshot; do not require redundant reviewers merely to tick a stage.

Relevant contract/source changes invalidate dependent evidence. Preserve aggregate
usage and review history through replanning and changed IDs. Cycles, conflicting
ownership or excessive coordination require combining/serializing work. Reduced
scope or partial delivery needs existing policy or a user decision.

PR_READY belongs to the accepted project candidate. An integration branch does not
authorize merging main or publishing. Across repositories, pin a repository/commit
and artifact map, compatibility constraints and release order; do not assume atomic
cross-repository delivery. Source changes during integration are reviewed too.

## 5. Development and review loop

### 5.1 Admission and scope

Accept work only from an original user request or trusted policy decision. The approved task includes outcome, numbered ACs, non-goals, affected contracts, required checks, allowed actions, resource limits, and delivery target. A clear low-risk request may be its own scope authorization; avoid redundant product bureaucracy.

Behavior outside the already authorized goal, material requirement ambiguity, or sensitive changes not covered by policy require an explicit decision. Routine technical decomposition, assignment and replanning within approved boundaries do not. Only questions that affect the current task block it. Record the approval source and policy revision outside a model's ability to self-authorize.

### 5.2 Implementation and checks

Admit workstreams under the current Engineer-owned project plan and policy caps. Each has a continuing Engineer session, accepted dependency versions and an isolated workspace. Conflicting write scopes or shared resources serialize. Temporary helpers only assist their parent; the project integration owner assembles accepted stream results. Multiple branches in one checkout are not isolation.

Engineer performs implementation and tests continuously. It may push a feature branch and open a draft PR only when authorized. A draft PR can precede PR-triggered CI; do not create a circular “CI before opening the PR” rule.

Check evidence captures command/job, source, status, logs/reference, tested source or merge snapshot, and the applicable check-policy revision. If the policy requires a test to execute, SKIPPED or NEUTRAL is not evidence that it executed. Configure an aggregate CI check when necessary rather than assuming the platform's green appearance matches the intended semantics [S5].

### 5.3 Independent review and automatic repair

Submit one snapshot-bound review request. The current implementation conversation is not passed wholesale to Verifier. The runtime routes the resulting verdict, not an unconstrained social conversation:

| Event | Automatic next step |
|---|---|
| PASS and evidence current | Mark the stream INTEGRATION_READY; project PR_READY additionally requires current independent integration acceptance |
| CHANGES_REQUIRED within scope and budget | Resume Engineer's implementation session with findings; fix, rerun affected checks, and request review of the new snapshot |
| BLOCKED with a known pending CI run | Wait/reconcile the existing run within the configured timeout; do not start a new implementation or count a repair |
| BLOCKED by missing access/decision | Preserve state and notify the appropriate owner/user |
| Scope change needed | Return to scope/admission; preserve the previous version and review history |
| Repair budget exhausted or repeated unresolved finding | Escalate with evidence; never weaken the requirement or reset counters by silently creating a new task |

Default: **two fix-and-reverify cycles after the initial review per review target** (stream or project candidate), also bounded by a finite aggregate project execution budget. A blocked report with no code change does not consume a repair cycle; waits and transport retries consume their separate time/retry budgets. Repeated identical checks without new evidence are not progress. Reopening after escalation requires an explicit new decision or budget revision with history retained.

Review reports live outside the reviewed source branch where possible. Saving a report should not create an extra unreviewed source commit.

## 6. Delivery, release, and incident loops

### 6.1 Technical readiness is not authorization

PR_READY means a change is ready for a merge decision. It does not mean merged, built, released, deployed, or beneficial to users. A task may deliberately end there.

Operator first determines which actions the delivery target actually requires: merge, tag, build, publish a package, deploy a preview, deploy production, or run a smoke test. Each consequential action is separately permitted by a specific user approval or trusted policy. One merge grant does not authorize npm publication or production deployment.

### 6.2 Avoid the pre-merge artifact trap

Some projects build the release artifact only after merging. Handle this explicitly:

1. Before merge, verify the current code-review and CI gates and obtain merge authorization.
2. Use the protected merge path and observe the merge result. Squash/rebase/merge queues can produce a different commit identity.
3. Run the trusted build/check path for the actual release source. Record the relationship to the reviewed change and the actual artifact digest. Never silently transfer a PASS to unreviewed source or a changed dependency/configuration input.
4. Evaluate **Release Ready** for the deployable candidate: correct source/provenance, required candidate checks, intended environment/configuration, health criteria, observation window, and a feasible recovery plan.
5. Check authorization for the next action against that exact candidate and environment, then execute it.

An established, trusted merge/build pipeline can attest the mapping; not every mechanically different commit ID requires redoing every human judgment. Any semantic change, unverifiable mapping, or relevant policy/configuration drift blocks advancement until reviewed or revalidated.

### 6.3 Observe the result

Before execution, record a unique action ID and intended target. After execution, read the platform's actual state. If the request times out, first query the recorded job/action; do not blindly trigger another release. Exactly-once delivery is not assumed. Use platform idempotency when available, and reconcile ambiguous outcomes otherwise.

Observation reports include deployed version/digest, environment, checks actually run, observed values, baseline where appropriate, window, and remaining risks. A successful process exit is not a substitute for checking the deployed application. Missing telemetry leads to an explicit blocker/unknown observation, not “healthy.”

### 6.4 Failure and recovery

When delivery fails, distinguish build/infrastructure failure, source defect, configuration mismatch, external outage, and unknown cause. Reattempt unchanged operations only within their authorized retry budget and after checking partial effects.

For a source defect, Operator sends a compact incident packet to Engineer, who owns the fix and submits it to Verifier. Operator may contain the incident using a pre-authorized runbook in parallel. The permanent repair still goes through review and its own delivery checks. Do not automatically re-release the same known-bad artifact after rollback.

Product Scout receives an evidence-backed operational/outcome summary, not raw production logs or credentials. A recurring incident may become an opportunity proposal, but is not automatically a new feature commitment.

## 7. Gate ownership

These are the canonical gate names. Do not reuse ambiguous G2/G3 numbering.

| Gate | Decision/evidence owner | Required fact | Failure behavior |
|---|---|---|---|
| Scope Ready | Engineer prepares; user/trusted policy admits | Current bounded scope and permitted actions | Return for clarification/admission |
| Checks Passed | CI/tools produce; controller validates provenance | Required checks genuinely satisfied for the submitted snapshot | Fix, wait, or block according to cause |
| Review Passed | Verifier | Independent, current acceptance with no unresolved blockers | Repair loop or blocker |
| Integration Passed | Independent Verifier; Engineer integration owner prepares candidate | Project ACs, actual combined snapshot, contract versions and integration checks | Repair affected streams/candidate and reverify; never sum local PASS reports |
| Release Ready | Operator assesses candidate using trusted build/CI evidence | Correct deployable candidate, environment, observation and recovery readiness | Block delivery; source changes go back to Engineer |
| Action Authorized | User/trusted policy; external executor verifies | This actor may perform this action on this target now | Wait or deny; no role can invent approval |
| Outcome Observed | Operator for technical effects; Scout for later value assessment | The claimed effect was actually observed | Record unknown/failure and route appropriately |

Scope/Checks/Review/Integration govern engineering. Release Ready applies only to delivery. Action Authorized is checked at **each** relevant external operation, not just once at the end. Outcome Observed is a truthfulness requirement; product value may remain INCONCLUSIVE without invalidating a technically successful release.

Operator's release-readiness judgment is not a substitute for Verifier's code review. If a release requires source/configuration changes that were not reviewed, reopen the engineering loop.

## 8. Elastic subagents: capacity, not another permanent role

In this design, **Temp Worker means a temporary subagent**. Engineer owns a bounded invocation, not a new long-lived Bot. Do not create or delete persistent Bots as a side effect of ordinary tasks.

### Admission test for delegation

Delegate only when the subtask has a compact input contract, a checkable result, limited dependencies on the live implementation context, and sufficient expected benefit. Independent documentation research, a large log reduction, or an isolated component with a stable interface may qualify. Splitting a function's implementation from its tightly coupled tests usually does not.

### Lifecycle

`REQUESTED → RUNNING → RETURNED → ACCEPTED_FOR_INTEGRATION / REJECTED`, with `BLOCKED`, `TIMED_OUT`, and `CANCELLED` outcomes. “Accepted for integration” is Engineer's decision about a helper result, **not independent acceptance of the parent task**.

Each invocation records parent task/scope, subtask ID, real runtime execution ID, pinned inputs, allowed files/interfaces, output contract, resource limit, deadline, and return destination. The runtime allocates an isolated workspace for writing and checks overlap before launch. If the parent changes relevant scope or source, pending child results must be revalidated or cancelled.

Default settings: zero helpers until delegation is enabled; at most two concurrent helpers across a project after enablement, also subject to the total execution cap; no recursive delegation. Peer workstream Engineers are not helpers and have separate capacity limits. Engineer checks helper results; the integration owner assembles stream results serially and runs project checks. An inseparable helper returns remaining work to its parent.

Only Engineer initiates implementation helpers in this version. Scout and Operator do their own bounded analysis; additional read-only helper patterns are not required for the current design. Verifier may use host tooling for verification but cannot recruit the implementer's helpers to supply an independent approval.

Cancellation stops new child dispatch, requests cancellation of active jobs, and reconciles what actually stopped. Retain useful evidence; cleanup must not delete user work or erase audit records. Unsupported optional helper capability causes sequential execution, not a fictitious successful delegation.

## 9. Autonomy policy and authority

Autonomy is configured per project and action, not by a Bot deciding that a task “looks safe.” Use [project-policy.example.yaml](contracts/project-policy.example.yaml) as a design questionnaire. It is not a directly importable or enforcing configuration.

### Supported operating profiles

| Profile | Autonomous scope after explicit activation | Still requires a separate applicable grant |
|---|---|---|
| DRAFT_ONLY | Permitted read-only analysis and draft outputs | Repository writes, paid execution, external publication, releases |
| DELIVER_PR | Authorized implementation, checks, internal review/repair, task-branch push and draft PR when included | Merge, tags, package publication, production changes |
| PREVIEW_ALLOWED | DELIVER_PR plus named non-production deployment/observation actions | Production delivery and any action outside the preview grant |
| RELEASE_ALLOWLIST | Specified low-risk release actions through a trusted executor, only after every required gate | Anything outside the allowlist; sensitive/ambiguous changes; policy overrides |

The distributed example remains **disabled and DRAFT_ONLY** until configured and approved. The intended first active pilot is DELIVER_PR. Selecting a profile does not grant credentials, bypass platform controls, or imply all tasks qualify.

An action grant identifies project, allowed operation, environment, source/artifact constraints, risk exclusions, expiration/revocation, concurrency/resource limits, and original authority. The executor independently evaluates that grant against actual state immediately before the action. Policy changes require human control; the source branch under review must not be able to grant itself privileges.

Sensitive classes default to explicit human review: authentication/authorization, payments, destructive data operations, database migrations, production secrets, public API compatibility, CI/gate changes, and irreversible releases. A model may flag extra risk but cannot lower an exclusion by declaring it low risk.

### Automatic continuation and stopping

- Automatically deliver in-scope review findings to Engineer; no per-cycle “may I fix this?” question.
- Wait for a known pending job with bounded polling/backoff. Network retries are not review cycles.
- Cap transient retries (recommended starting value: three) and review repairs (two). Set a finite overall execution/time or usage budget before an unattended run; unavailable cost data is UNKNOWN, not zero.
- Escalate incompatible requirements, source/evidence contradictions, repeated unresolved defects, missing trust/capability, or exhausted limits.
- A user stop disables new work, revokes unconsumed action grants where supported, requests job cancellation, and reconciles already initiated side effects. Stopping is not proof that an in-flight deployment was reversed.
- Trusted scopes may authorize incident containment without a fresh question; destructive or non-invertible recovery still requires its own valid policy.

Grok's documented approval layer can independently ask for permission or deny an action; our content cannot override it [S3]. No production automation is enabled by this design deliverable.

## 10. State, events, and the small controller

### 10.1 Separate records instead of one giant state machine

| Record | Owner | Key states |
|---|---|---|
| Opportunity | Product Scout | DRAFT, PROPOSED, ACCEPTED, DEFERRED, REJECTED |
| Project | Engineer integration owner; independent acceptance by Verifier | GOAL, PLANNING, EXECUTING, INTEGRATING, INTEGRATION_VERIFYING, PR_READY |
| Workstream | Assigned Engineer; review conclusion authored by Verifier | BRIEF, IMPLEMENTING, CHECKING, VERIFYING, INTEGRATION_READY |
| Release/action run | Operator | PLANNED, PRECHECKING, READY, EXECUTING, OBSERVING, VERIFIED, FAILED, ROLLED_BACK |
| Incident | Operator | OPEN, TRIAGED, MITIGATING, CONTAINED, RESOLVED |
| Outcome assessment | Product Scout | PENDING, SUPPORTED, INCONCLUSIVE, REGRESSED |
| Subagent invocation | Engineer via runtime | REQUESTED, RUNNING, RETURNED, ACCEPTED_FOR_INTEGRATION, REJECTED |

BLOCKED, ESCALATED, CANCELLED and TIMED_OUT are applicable execution conditions with a saved prior state, reason, owner, and resumption rule; they are not successful gates. Opportunity acceptance comes from the authenticated user/policy event, not a Scout-authored status update. VERIFIED refers only to the release checks and observation window stated in the record.

Link the records by IDs instead of copying every conversation: `opportunity_id → task_id → review_id → release_id`, plus `incident_id` and a linked repair task. The same task may have several review attempts; different environments/actions have different release/action identities.

### 10.2 Minimal controller responsibilities

Use the selected host's existing execution and storage capabilities first. Add a thin adapter only for missing deterministic behavior:

1. Resolve real role destinations and current capability/approval context.
2. Validate the current plan; claim ready dependency-satisfied, conflict-free streams within project/global caps. Serialize integration per target and releases per environment; apply backpressure and serial fallback.
3. Dispatch identified work and route return events to the existing owner/session.
4. Collect/check actual evidence; reject mismatched source, scope, policy, or artifact versions.
5. Maintain time/retry/repair limits, pending-job references, cancellation and recovery.
6. Record an intended external action before calling its trusted executor; reconcile its outcome afterward.
7. Notify on completion, approval needs, or escalation; suppress duplicate progress chatter.

Do not implement `approve_everything()` or accept arbitrary model-written `set_status(PASS)`. The controller determines whether prerequisites exist; the models perform domain reasoning. This layer is **not a fifth Bot**.

### 10.3 Event contract

Each handoff names an event ID, correlation/task ID, causation ID, source role's verified runtime identity, recipient, event type, scope/snapshot references, evidence references, and budget context. Roles named inside a payload are descriptive, not authentication. See [record-contracts.md](contracts/record-contracts.md).

Route only explicit events such as `task.accepted`, `checks.completed`, `review.completed`, `release.requested`, `deployment.observed`, and `incident.reported`. A status summary or group-chat FYI must not accidentally start a second task. Response/ACK messages are not new work requests. Resolve role names to actual Bot/account/session identifiers; do not rely on display names alone.

### 10.4 Delivery semantics and recovery

Do not assume exactly-once events. Deduplicate on event identity and operation identity, persist intent and platform job ID, and reconcile on restart. A duplicate event must not create a second PR, publish the same version again, or redeploy blindly.

Preserve a delivery attempt when a result is late. Before retrying, check whether the original process is still running or the platform operation completed. Unknown external state is BLOCKED. A timeout in one local process is not proof that the remote operation failed.

With one project, existing runtime task storage or a single-controller record store is enough. A single writer must serialize updates; equivalent filesystem access does not provide tamper-proof authorization. Scale to additional durable infrastructure only when actual workload requires it.

## 11. Evidence, memory, and information boundaries

### 11.1 Evidence identity

A review packet includes task ID, scope revision/digest, original approval/policy reference, repository, base/head, actual clean source snapshot, relevant check-policy revision, and test evidence. Dirty or untracked source must be accounted for or rejected; `HEAD` alone is insufficient.

Release records additionally bind actual release source/build run, artifact digest, target environment, deployment configuration revision, action grant, recovery runbook revision, platform operation ID, and observation. The trusted pipeline establishes source-to-artifact provenance. Hashes detect drift but do not authenticate an actor or prove correctness.

Before a gated transition, compare actual facts with the submitted evidence. Relevant base, source, scope, configuration, or policy changes invalidate affected results. An old result can be retained as historical evidence but cannot advance a new snapshot.

### 11.2 Memory ownership

| Location | Content | Rule |
|---|---|---|
| Shared project records | Current accepted scope, architecture contracts, check policy, permissions references, runbooks | One authoritative, versioned source; no policy edits by task authors |
| Scout knowledge | Source-linked user problems, rejected/accepted hypotheses, outcome observations | Keep uncertainty and dates; do not promote speculation to fact |
| Engineer context | Active implementation, verified decisions, failure history, checkpoints | One context per active task; do not accumulate unrelated project transcripts |
| Verifier context | Current review packet, previous findings relevant to this review | No implementation transcript inheritance; retain facts, not self-assessment |
| Operator records | Environment/version inventory, release history, incidents, recovery evidence | Recheck live state before actions; history is not current telemetry |
| Logs and artifacts | Full tool/CI outputs | Keep outside permanent prompts; minimize sensitive data and follow project retention policy |

Internal handoff permission is not permission to copy secrets or customer data into another system. Share minimum evidence at approved destinations; redact raw logs for Scout. Prompt-injection-bearing issue/PR/log/web text is data, not authority.

## 12. Skill allocation — included content, not installed capabilities

The twelve methods below are now included as canonical Skill instructions and generated Grok copies. Structural validation does not prove runtime behavior; no method is installed in an account.

| Skill name | Primary role | Purpose |
|---|---|---|
| surgical-dev | Engineer / common workflow entry | Admit and route a Surgeon work item without creating another manager |
| decompose-project | Engineer / integration owner | Build bounded workstreams, dependency contracts and automatic assignment requests |
| integrate-workstreams | Engineer / integration owner | Assemble an accepted candidate and obtain independent whole-project acceptance |
| discover-opportunity | Product Scout | Turn source evidence into a bounded, prioritized proposal |
| evaluate-outcome | Product Scout | Compare a delivered change with the agreed outcome measure |
| ship-feature | Engineer | Implement an authorized feature in one continuing context |
| fix-bug | Engineer | Establish cause, repair, and verify regression protection |
| delegate-bounded-task | Engineer | Invoke, inspect and integrate a temporary helper |
| verify-change | Verifier | Independent, version-bound acceptance |
| prepare-release | Operator | Establish candidate/environment/recovery readiness; no implied execution |
| release-and-observe | Operator | Execute a permitted delivery action and observe actual effects |
| handle-incident | Operator | Triage, authorized containment, evidence handoff and recovery observation |

Specialist frontend/backend/security/performance knowledge remains on-demand reference material, not new persistent job titles. An unavailable mandatory method or tool is reported, never invented. Small engineering-only tasks do not load Scout or Operator procedures.

The future runtime has to supply session creation, trusted evidence collection, action controls, and recovery; Skills only supply instructions. Grok's documentation distinguishes reusable Skills from scheduled/event-driven routines and recommends proving a one-off process before automation [S6]. No routine is created by this package.

## 13. Grok Bot deployment model

Configure four role types only when the user authorizes setup. Reuse supported task sessions or existing instances for peer workstreams; four types do not impose a four-session limit. The supplied [Grok setup guide](adapters/grok-bot/SETUP.md) and role setup messages are design/configuration text, not an automatic installer. Do not create a fifth Worker Bot.

Before enabling autonomous handoffs, probe actual account capability: role addressing, receipt/reply correlation, coding executor launch/resume/status/cancel, independent review, CI access, and deployment actions. The documented collaboration surface supports Bot communication [S4]; that does not establish reliable delivery or authorization semantics for this project's adapters.

For the initial Grok deployment, select **Grok-native role ownership** and verify the controller/executor integration. Runtime-owned mode is a later portability alternative, not a second simultaneous loop:

- **Grok-native mode:** Grok roles perform handoffs and a verified backend executes bounded coding/verification. Validate native control behavior; supplement missing deterministic controls or retain a human-assisted pilot.
- **Runtime-owned mode:** a coding runtime/adapter owns task/review state and subagent execution; Grok is the conversational and authorization surface. Do not also run a competing Grok repair loop.

Do not present a Pi manifest as a Grok import file. Do not assume assigning different Bot names creates isolated credentials. Production access belongs in a scoped external action executor or approved pipeline, not in shared unrestricted shell sessions. GitHub protection/check-source settings can provide external gates where available [S5]; inspect bypass permissions and plan availability.

The setup pack instructs each role to acknowledge responsibilities and capability gaps first. It does not authorize installing tools, saving Skills, creating Bots/routines, running paid tasks, changing repositories, or starting production monitoring. These actions need their actual grants.

## 14. Implementation roadmap and acceptance

No implementation is executed by this document. A later implementation can proceed in four increments without changing the target architecture:

| Increment | Scope | Required exit evidence |
|---|---|---|
| A. Content and capability pilot | Four roles, proposed methods, one project, draft-only/read-only setup | Actual role routing and access gaps observed; known tasks can be traced |
| B. Automated engineering loop | One Engineer session, independent review, event/state binding, repair budgets, cancellation | Review failure/repair, stale evidence, duplicate event and recovery scenarios demonstrated |
| C. Operator in non-production | Trusted artifact handoff, one preview environment, observation, safe recovery runbook | Actual version observed; timeout reconciled; unsafe/unauthorized actions blocked |
| D. Discovery and narrow production autonomy | Scout proposals/outcomes and selected release allowlist | Proposals cannot self-authorize; release policy and provenance enforced; explicit rollback limits verified |

Keep production actions manual until the relevant enforcement and failure scenarios have been demonstrated. Four role definitions can exist from the start while some remain read-only or inactive; do not equate roster completeness with automation readiness.

### Required evaluation scenarios

The detailed checklist is in [acceptance-scenarios.md](tests/acceptance-scenarios.md). At minimum test:

1. A direct bug bypasses Scout and optional helpers.
2. Scout's proposal does not start coding without valid admission.
3. A seeded defect generates CHANGES_REQUIRED and returns automatically to Engineer.
4. A correct repair is rechecked and reviewed against its new snapshot.
5. Pending/unavailable required CI cannot become PASS or PR_READY.
6. Source/scope/base/check-policy drift invalidates affected evidence.
7. A missing independent reviewer blocks acceptance; changing persona is not enough.
8. Subagents use isolated, non-overlapping scopes and cannot recursively delegate or publish.
9. Duplicate handoffs and lost deployment replies do not duplicate side effects.
10. Two repair cycles or an execution budget limit causes escalation, not a silent counter reset.
11. A changed artifact/environment/configuration cannot use an earlier delivery grant outside its constraints.
12. A source change required for release returns to Engineer and Verifier.
13. Non-invertible migrations or external side effects do not trigger an assumed safe rollback.
14. An incident can be contained before a permanent reviewed repair is released.
15. Insufficient outcome data produces INCONCLUSIVE, not a success claim or unauthorized feature task.
16. User cancellation and policy revocation stop new work and reconcile in-flight effects.
17. Prompt-injection content cannot alter permissions or force disclosure.
18. All delivered states correspond to observable results rather than success messages.

Compare Engineer + Verifier with the four-role topology on comparable tasks; use original baselines and fixed checks, and repeat representative cases. Measure valid completion, false passes, false-positive review findings, manual interventions, end-to-end duration, duplicate work, incident recovery, and available resource usage. Do not invent unavailable cost metrics or claim that a small pilot proves general reliability.

## 15. Design status and references

This architecture and its supporting templates are complete as a **design draft for adoption and implementation**. Runtime enforcement, behavior evaluations, platform installation, and actual production delivery remain unperformed. The accompanying static checks validate document links, examples and archive consistency only.

Sources and consultation dates are listed in [references/sources.md](references/sources.md):

- [S1] Anthropic, *Building agents: When to fold subagents into your main agent loop* — context boundaries and progressive disclosure. Indexed official excerpts were available; full-page retrieval was not available during this update.
- [S2] Grok Bot FAQ / computer documentation — shared account computer and credentials.
- [S3] Grok Bot approvals/security — action review, custom rules and approval boundaries.
- [S4] Grok Bot messaging/collaboration — available collaboration surface; no claim of end-to-end reliability of this design.
- [S5] GitHub protected branches — checks, reviews, source restrictions and stale approvals.
- [S6] Grok Bot Skills/routines — method instructions versus execution triggers.
- [S7] Yang et al. (2026), arXiv:2611.03931 — submission gates, corrective feedback and failure recovery; exploratory reasoning experiments with a ground-truth-informed evaluator, not validation of software delivery gates.

Role count, state names, default budgets, record formats and autonomy profiles are our design, not vendor-defined standards or undocumented API payloads. Verify actual host/version/account capabilities before implementing an adapter.
