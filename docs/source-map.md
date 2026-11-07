# Source map and extraction scope

Canonical design: [design.en.md](design.en.md). It is preserved as a reference.
The current package reorganizes it; it does not implement the future runtime.

| Source section | Split resource |
|---|---|
| 2 and 8: role boundaries | `roles/`, one-time Grok setup messages |
| 4–6: workflow and evidence | `references/workflow.md`, `templates/`, `contracts/` |
| 7: five methods | Five method `SKILL.md` files, retaining the original method text |
| Workflow activation from the prior blueprint | `skills/surgical-dev/SKILL.md` |
| 3 and 9: setup | `contracts/project.example.yaml`, `adapters/` |
| 10: pilot | `tests/acceptance-scenarios.md` |
| 11: task input | `templates/first-task.md` |

Packaging additions: YAML Skill metadata, explicit local resource references,
JSON Schema record shapes, sample unapproved/blocked records, local Pi content
manifest, and structural tests. The schema and manifest are not Grok APIs.

The canonical Skill files load references on demand. Grok private-skill copies
embed those same referenced resources to avoid broken links on single-file import.
Copies are generated artifacts, not a separate source of rules.

No account changes, installations into a user's runtime, paid model calls, live
agent evaluations, repository writes, external posts, merges, or deployments were
performed in preparing the package. Static validation is reported separately.
