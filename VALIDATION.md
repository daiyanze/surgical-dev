# Validation report

Package: `surgical-dev` · 2026-11-11.
Scope: portable Skills, record contracts and the opt-in Pi single-workstream loop.
Implementation baseline: `ec8d56a`.

## Observed checks

| Check | Result | What it establishes |
|---|---|---|
| `npm test` | 64 passed | 29 package checks and 35 runtime regressions using real Git and subprocesses |
| `python3 tests/contracts_test.py` | 19 passed | Existing task, review and project-plan schema constraints |
| `python3 scripts/sync_skill_references.py --check` | Passed | Standalone Skills match canonical Markdown references |
| `npm run test:pi-host` with Pi 1.5.2 | 1 passed | Local package installation and actual Pi Worker/reviewer lifecycle with a deterministic local model |
| Independent code review | Findings resolved | Five reproduced lifecycle, ownership, snapshot and cancellation issues were fixed and regression-tested |

The Node regression suite checks real failure evidence returning to Worker,
review findings returning for repair, fresh reviewer identities and candidate
snapshots, two-cycle repair limits, cumulative check/turn limits, changed policy,
failed/malformed model output, stale acceptance, cancellation, process deadlines,
project locks and staging preservation. It includes newly force-added ignored
files and cancellation of subprocess descendants. The Pi event harness is a test
double; subprocess reviewer fixtures are not live model evaluations.

## Actual Pi host integration

The host test uses the released `@earendil-works/pi-coding-agent@1.5.2`, Node 24
and Git on Linux. It installs this package into a temporary Pi configuration and
loads the extension through `pi.extensions`. It then starts an actual Pi Worker
with a local OpenAI-compatible model fixture:

1. The first candidate fails a real check on `answer.txt`.
2. The extension adds failure evidence and Pi continues in the original session.
3. Pi executes a real write tool to repair the file; the next check passes.
4. The controller starts a separate Pi process in a detached Git worktree, with
   read tools only. Pi performs an actual read and returns the structured review.
5. Final settlement records `PR_READY`, two check attempts, one independent review
   and distinct Worker/Verifier session IDs. The real index stays unchanged and
   the disposable worktree is removed.

The model responses in this test are deterministic. This proves the actual host's
installation, event, tool and process integration; it does not establish DeepSeek
or any other model's engineering competence. No account credentials or paid API
calls are used. The initially incorrect `canContinue` guard was reproduced through
this real-host path before it was fixed.

## Reproduce

```bash
npm test
python3 scripts/sync_skill_references.py --check
python3 -m venv .venv
.venv/bin/python -m pip install -r tests/requirements.txt
.venv/bin/python tests/contracts_test.py

# Pi 1.5.2+ and Node 22.19+ are required for the actual-host check:
SURGICAL_PI_EXECUTABLE=/absolute/path/to/pi npm run test:pi-host
```

The standard Node suites need no npm dependencies. CI installs a pinned Pi host in
a separate temporary directory for the integration test; it does not add runtime
dependencies to this package. The host test itself uses a temporary Git repository
and isolated `PI_CODING_AGENT_DIR` and leaves user settings unchanged.

`SHA256SUMS` covers tracked distributed files other than itself. Verify with
`sha256sum -c SHA256SUMS` or `shasum -a 256 -c SHA256SUMS` on macOS. To regenerate,
stage new files first, then run:

```bash
git ls-files -z ':!SHA256SUMS' | xargs -0 sha256sum > SHA256SUMS
```

CI checks that regeneration leaves the working tree unchanged.

## Limits and work not performed

- No real-model unattended-development evaluation, DeepSeek authentication test,
  long-duration run or live production task was performed.
- The full behavioral acceptance matrix is still a specification; this report
  claims only the explicitly tested single-workstream subset.
- Durable crash recovery, multi-stream scheduling, automatic PR creation, merge,
  publication, deployment and incident response are not implemented by this loop.
- Native Escape is observed at settlement during verification; `/surgical stop`
  is the immediate subprocess cancellation path. See [Pi setup](adapters/pi/SETUP.md).
- Read-tool restrictions are not an OS sandbox or a production authorization
  service. Turn/attempt/time bounds do not constitute a monetary budget.
- Local package installation was exercised; installation from a published Git tag,
  remote Git installation and a production release were not part of this check.

The general project-policy example remains disabled/DRAFT_ONLY. Remaining work is
tracked in [runtime-next.md](docs/runtime-next.md).
