# Grok Bot setup — manual, content-only

This is not a Grok plugin manifest or an automatic installer. Follow the visible
account capabilities; never invent an import command. Official sources are in
[Sources](../../docs/sources.md).

## 1. Create or select two Bots

Create Engineer and Verifier. Send the complete message in
[ENGINEER_SETUP.md](ENGINEER_SETUP.md) to Engineer and
[VERIFIER_SETUP.md](VERIFIER_SETUP.md) to Verifier. Keep these one-time messages
separate from normal task prompts. Ask each Bot to confirm its access gaps.
Do not copy the entire design document into both permanent roles.

## 2. Save private Skills explicitly

The [private-skills](private-skills) directory contains six self-contained text
versions. Their required role, workflow, and handoff references are embedded, so
copying one does not leave broken package-relative links. They are generated from
the canonical `skills/`, `roles/`, `references/`, and `templates/` files; edit those
canonical files first, then regenerate the copies before redistributing:

```bash
python3 scripts/export_grok_skills.py
```

Run this from the package root. It writes local generated text only; it does not
call Grok, connect to an account, or install anything.

For each chosen file, provide its complete contents and ask the Bot to save it as
a private Skill under the stated name. This is a user-controlled setup action, not
an automatic action performed by this archive. Read back the saved content and
check availability before assigning real work. Do not claim a save succeeded
without observing it. Use the current app's supported sharing/import controls.

Enable for Engineer: `surgical-dev`, `ship-feature`, `fix-bug`,
`delegate-bounded-task`, and `prepare-release`.
Enable for Verifier: `verify-change`.
Do not use the same implementation chat as the independent review conversation.
Private Skill access and separate Bot roles are not filesystem or credential
isolation. Only create or publish shared/team Skills with explicit permission.

## 3. Configure one project

Use [project.example.yaml](../../contracts/project.example.yaml) as a questionnaire,
not an import file. Read actual project commands, check names, paths, and
permissions. Obtain action-specific authorization. Keep production credentials
out of coding and verification environments. Approve internal handoffs separately
from external writes, merge, or release operations.

## 4. Pick one workflow owner

For a Grok-native pilot, Engineer coordinates the coding session and separate
Verifier handoff. If a future runtime plugin owns that loop, Grok must not start a
second competing implementation/review workflow. This package supplies no bridge.

## 5. Run one safe pilot

Use the [first task template](../../templates/first-task.md). Confirm what actually
ran. If independent review is unavailable, the outcome is BLOCKED, not PR_READY.
Use existing CI and human merge decisions. Save the observed report; do not infer
success from the existence of a Skill.
