# Install and distribute Surgical Dev

Surgical Dev is a **content-only Skills package**. Installing it makes task
instructions discoverable; it does **not** provision Bots, launch Engineer or
Verifier sessions, enforce approval gates, or enable automatic dispatch.
Independent review still requires a separate real reviewer context.

## 1. Install with Pi (GitHub source)

Pi can install the package straight from Git, without an npm publication:

```bash
pi install git:github.com/daiyanze/surgical-dev
```

Start a fresh Pi session and invoke `/skill:surgical-dev <your authorized goal>`.
This uses the package's existing `pi.skills` metadata and retains the complete
repository content. See [Pi setup](../adapters/pi/SETUP.md).

## 2. Install with the skills CLI (skills.sh)

Run from the **target project** directory. Select the coding agent when asked:

```bash
npx skills add daiyanze/surgical-dev --skill surgical-dev
```

To install all thirteen methods, choose an agent explicitly, for example:

```bash
npx skills add daiyanze/surgical-dev --skill '*' -a codex -y
```

Use `-a claude-code`, `-a opencode`, etc. for a different supported agent.
Add `-g` only if you want user-level rather than project-level installation.
Do not use `--all` unless you really intend to install for every supported agent.

The skills CLI copies or links **individual Skill directories**. The
`skills/*/references/` files are therefore part of the distribution and are
kept in sync with canonical role, workflow and template docs. Installing a
Skill does **not** set up other roles or automatically activate their methods.

The skills.sh directory uses actual skills CLI installation data for discovery;
publishing a GitHub repository is not a guarantee of immediate directory ranking
or visibility. Source: [skills CLI](https://github.com/vercel-labs/skills/blob/main/docs/commands.md).

## 3. GitHub Releases

GitHub is the source repository. For a reproducible published snapshot,
maintainers can create a **Git tag and GitHub Release** after testing the
contents and reviewing the release:

```bash
python3 scripts/sync_skill_references.py --check
python3 scripts/export_grok_skills.py
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
python3 scripts/export_grok_skills.py
npm test
```

The sync script updates in-Skill reference bundles; the export script updates
the self-contained Grok texts. CI checks these generated files remain current.
Both are local text operations with no account configuration or network access.

No npm registry package or Claude Code Marketplace plugin is published by this
repository. The existing `private: true` manifest is intentional until a
separate registry publication is approved.
