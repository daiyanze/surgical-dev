# Validation report

Package: `surgical-dev`, `0.3.0-content` · 2026-11-08.
Scope: current architecture, role/Skill content, record shapes and package integrity.

## Observed checks

- Node package suite: 28 structural tests passed. Coverage includes thirteen Skill
  definitions, required files, local links, canonical/generated role consistency,
  embedded-source hashes, disabled defaults, goal/plan/integration contracts and
  the illustrative three-stream dependency graph, plus standalone Skill references.
- The skills CLI installed the entry Skill and twelve Skills separately into
  isolated local Codex test directories with `--copy`. The installed entry
  contained its required reference files. This was a local-path installation
  test, not a claim that public skills.sh indexing is complete.
- `scripts/sync_skill_references.py --check` confirmed each Skill's bundled
  Markdown references match the canonical sources.
- Python record suite: 12 JSON Schema shape tests passed in an isolated test
  environment with the declared `tests/requirements.txt` dependencies.
- Engineering discipline checks cover explicit assumptions, minimal implementation,
  surgical edits, and observable success criteria. The additional method was
  structurally validated but not exercised by a real coding Agent.

These tests validate declared content and basic shapes. They do not authenticate
approvals, prove that a reviewer ran, validate live dependency artifacts, or show
that a scheduler enforces the contracts. A well-formed PASS is not proof of success.

## Reproduce

```bash
npm test
python3 scripts/sync_skill_references.py --check
python3 -m venv .venv
.venv/bin/python -m pip install -r tests/requirements.txt
.venv/bin/python tests/contracts_test.py
```

Use an isolated Python environment. Node package tests have no package dependencies.
`SHA256SUMS` covers distributed content other than itself; verify with
`sha256sum -c SHA256SUMS` or `shasum -a 256 -c SHA256SUMS` on macOS.
To regenerate it, run `git ls-files -z ':!SHA256SUMS' | xargs -0 sha256sum > SHA256SUMS`
on Linux, or replace `sha256sum` with `shasum -a 256` on macOS. CI regenerates
`SHA256SUMS` and fails unless the working tree is unchanged afterwards.

## Not performed

The 42 behavioral acceptance scenarios are specifications and remain NOT RUN.
No real parallel Engineer team, independent Agent behavioral evaluation, automatic
scheduler, account setup, Pi Git install or skills.sh remote Git install, CI enforcement integration, merge,
publication, deployment or incident response was executed. Mermaid source is
provided but visual rendering has not been tested. The content was self-reviewed;
no independent runtime acceptance result is claimed.

Runtime requirements are listed in [runtime-next.md](docs/runtime-next.md).
The example policy remains disabled/DRAFT_ONLY and grants no operational access.
