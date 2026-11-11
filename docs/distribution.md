# Install and distribute Surgical Dev

Surgical Dev distributes **portable Skills and an opt-in Pi extension**. Installing
the Pi package registers the methods and `/surgical` command. Running `/surgical run`
starts one Engineer/check/review/repair loop. Installing individual Skills through
the skills CLI provides instructions; the extension requires the full Pi package.

## 1. Install with Pi (GitHub source)

Pi can install the package straight from Git, without an npm publication:

```bash
pi install git:github.com/daiyanze/surgical-dev
```

Start a fresh Pi 1.5.2+ session. Configure the target repository as described in
[Pi setup](../adapters/pi/SETUP.md), then invoke `/surgical run <your authorized goal>`.
`/skill:surgical-dev` remains the portable instruction-only entry point. Package
metadata includes both `pi.skills` and `pi.extensions`; retain the complete layout.

## 2. Install with the skills CLI (skills.sh)

Run from the **target project** directory. Select the coding agent when asked:

```bash
npx skills add daiyanze/surgical-dev --skill surgical-dev
```

To install all thirteen methods, choose an agent explicitly, for example:

```bash
npx skills add daiyanze/surgical-dev --skill '*' -a codex -y
```

Use `-a pi`, `-a claude-code`, `-a opencode`, etc. for a different supported agent.
Codex and Pi both read the repository-level `.agents/skills/` directory, as do
several other agents; see the CLI's
[supported agents](https://github.com/vercel-labs/skills/blob/main/docs/agents.md)
table for each agent's path. Codex details: [Codex setup](../adapters/codex/SETUP.md).
Add `-g` only if you want user-level rather than project-level installation.
Do not use `--all` unless you really intend to install for every supported agent.

The skills CLI copies or links **individual Skill directories**. The
`skills/*/references/` files are therefore part of the distribution and are
kept in sync with canonical role, workflow and template docs. Installing a
Skill does **not** set up other roles or automatically activate their methods.

The skills.sh directory uses actual skills CLI installation data for discovery;
publishing a GitHub repository is not a guarantee of immediate directory ranking
or visibility. Source: [skills CLI](https://github.com/vercel-labs/skills/blob/main/docs/commands.md).

## Host capability tiers

Any agent that reads `SKILL.md` can load the methods. What differs is whether the
host can meet the workflow's requirements. Pi's single-workstream lifecycle is
tested with actual Pi processes and a local deterministic model. Real-model behavior
and the broader target architecture require separate evaluation.

| Requirement | Pi | Codex |
|---|---|---|
| Skill loading | `/skill:name`, reads `.agents/skills/` | `$name` or `/skills`, reads `.agents/skills/` |
| Independent Verifier | Extension launches a fresh read-tool Pi process on a Git snapshot | Reviewer subagent or separate session; see [Codex setup](../adapters/codex/SETUP.md) |
| Parallel Engineers | Single Engineer in the shipped loop | Subagents exist, workspace isolation not documented; stay serial unless each stream has its own worktree |
| Handoff between sessions | Automatic checks/review feedback with `/surgical run` | Manual |

Single-session hosts use serial work and a human-routed review. Hosts with
multi-session support may run bounded parallel streams only with isolated
workspaces and the caps in [default limits](../contracts/README.md#default-limits).
An agent not listed here: check the same four rows against its documentation
before claiming more than serial work with a separate reviewer.

## 3. GitHub Releases

GitHub is the source repository. For a reproducible published snapshot,
maintainers can create a **Git tag and GitHub Release** after testing the
contents and reviewing the release:

```bash
python3 scripts/sync_skill_references.py --check
npm test
git diff --exit-code
# After approval, choose a release tag:
git tag <release-tag>
git push origin <release-tag>
gh release create <release-tag> --generate-notes
```

Releases are **manual** by default. The above commands are instructions,
not actions performed by adding this document. Do not tag or publish until
you have reviewed the release contents. GitHub automatically provides
source-code archives for tags.

## Maintenance and checks

Canonical source docs live under `roles/`, `references/`, `contracts/`
and `templates/`. After changing them:

```bash
python3 scripts/sync_skill_references.py
npm test
```

The sync script updates in-Skill reference bundles; CI checks they remain current.
It is a local text operation with no account configuration or network access.

No npm registry package or Claude Code Marketplace plugin is published by this
repository. The existing `private: true` manifest is intentional until a
separate registry publication is approved.
