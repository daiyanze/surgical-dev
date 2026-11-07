# Validation report

Package: `surgical-dev`, `0.2.0-content` · 2026-11-07
Scope: v2 content migration, not an autonomous runtime.

## Observed checks

- `npm test`: 18 structural tests passed: ten Skill definitions, role/setup
  consistency, local Markdown links, legacy schema metadata, defaults and Grok hashes.
- `python3 tests/contracts_test.py` with `tests/requirements.txt` installed in an
  isolated dependency directory: 12 legacy v1 JSON Schema shape tests passed.
- Ten Skill YAML frontmatters and both disabled policy examples parsed successfully.
- `npm pack --dry-run --ignore-scripts --json`: package content inspected; no runtime
  dependencies, installation hooks or generated runtime tools.
- Grok exports regenerated from canonical content; repeated generation is byte-identical.
- Independent read-only content review found no blocking role/permission/workflow
  contradictions. Cosmetic quick-start markers were corrected after review.
- `SHA256SUMS` covers repository content except itself; verify with `sha256sum -c
  SHA256SUMS` (or `shasum -a 256 -c SHA256SUMS` on macOS).

During migration, the first structural run exposed a missing role index and
package-relative links in flattened copies. Both were corrected; all 18 checks
then passed. Legacy schemas remain unchanged and are explicitly v1-only.

## Reproduce

```bash
npm test
python3 -m pip install -r tests/requirements.txt
python3 tests/contracts_test.py
python3 scripts/export_grok_skills.py
npm pack --dry-run --ignore-scripts --json
```

Use a separate Python test environment. Regenerating text does not install Skills
or authorize account/production actions. JSON validation checks shape, not identity,
original authorization, current evidence, or substantive acceptance.

## Not performed

No Pi installation, Grok Bot setup, account Skill installation, event subscription,
live multi-agent handoff/repair loop, CI integration, release, deployment, rollback,
or operational/product outcome evaluation. The behavioral acceptance scenarios
remain NOT RUN. Mermaid sources are included but were not visually rendered.
The independent content review is not an end-to-end runtime acceptance test.

## Source provenance

- Approved v2 design archive `surgeon-agent-team-v2-design.zip`:
  `031fa6d2e924c9b2eaa6cd97a16fae50b96e1926c06ed9ebdbbbe5417bb24995`.
- Original v1 archive `surgeon-agent-team-split.zip`:
  `7f2bb81aef8a54140f7d937778d2e19b59869f535e0c4b9b0ed73a6c1be52df2`.
- V1 design body is retained under an explicit historical notice. V2 design links,
  entry naming and adoption status are adapted to this repository. Neither source
  archive was modified. Runtime enforcement remains in `docs/runtime-next.md`.
