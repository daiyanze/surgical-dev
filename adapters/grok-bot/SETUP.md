# Grok Bot adoption guide — four-role design

These are user-controlled setup instructions, not an importer, runtime plugin or
guarantee that autonomous handoffs work in this account. Read [sources](../../references/sources.md).

## 1. Select the workflow owner

Use Grok-native role ownership for the initial deployment. A runtime-owned loop
is a later alternative, not a second planner/review loop. Record this choice
in the approved project policy and keep one active parent writing task per repo.

## 2. Create/select only four persistent identities

With explicit setup authorization, create/select Product Scout, Engineer, Verifier,
and Operator. Send each its corresponding self-contained first-message file:

- [PRODUCT_SCOUT_SETUP.md](PRODUCT_SCOUT_SETUP.md)
- [ENGINEER_SETUP.md](ENGINEER_SETUP.md)
- [VERIFIER_SETUP.md](VERIFIER_SETUP.md)
- [OPERATOR_SETUP.md](OPERATOR_SETUP.md)

Do not create a Temp Worker Bot. A temporary subagent is an execution capability,
not a persistent roster member. Read back role understanding and capability gaps.
Separate per-task implementation/review contexts; do not use one growing group
chat as everyone's complete source of truth.

## 3. Confirm access and actual capabilities

Test role addressing, request/response correlation, coding executor authentication,
status/resume/cancel, isolated workspaces, independent review, CI evidence access,
and the chosen operational action path. Do not fabricate unsupported tools.
A failed optional subagent probe permits sequential Engineer work; a failed
independent-review requirement blocks unattended acceptance.

## 4. Configure project policy before activation

Use [project-policy.example.yaml](../../contracts/project-policy.example.yaml)
as a questionnaire. The example is disabled/DRAFT_ONLY and is not a native import.
Confirm current repository commands, required checks, original authorization,
allowed paths/actions, budgets, role destinations and the desired delivery target.
Ten canonical Skills and flattened private-Skill texts are included in this content
pack. They are not installed in any account; no event subscriptions are provided.

## 5. Keep actual boundaries

Grok roles do not isolate filesystem credentials. Production actions should go
through a scoped trusted executor/pipeline, not a secret exposed to every shared
shell session. Preserve platform action approvals and repository protections.
Internal handoff approval does not grant production authority. A chat PASS is not
a trusted CI check until an actual integration securely supplies one.

## 6. Pilot, then automate narrowly

Start with an explicit safe task, keep Scout proposals and Operator activity
read-only/preparatory where appropriate, and test failure paths. Add methods and
triggers only after actual verification. Do not automatically schedule monitoring,
create Bot accounts, enable production access, or start paid runs from these files.

Use the ten files in `private-skills/`, generated from canonical `skills/` sources.
Assign discover-opportunity/evaluate-outcome to Scout; surgical-dev/ship-feature/
fix-bug/delegate-bounded-task to Engineer; verify-change to Verifier; and
prepare-release/release-and-observe/handle-incident to Operator.
Follow [MIGRATION.md](../../MIGRATION.md); do not retain conflicting active v1 rules.
