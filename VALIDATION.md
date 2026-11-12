# Validation report

Package: `surgical-dev` · 2026-11-12.
Scope: portable Skills, record contracts and the opt-in Pi goal-driven single-workstream loop.
Implementation baseline: repository branch `feat/goal-driven-autonomous-development` (review findings addressed and independently checked).

## Observed checks

| Check | Result | What it establishes |
|---|---|---|
| `npm test` | 107 passed, 1 platform skip (macOS) | Package checks plus spec/state, loop and extension regressions using real Git and subprocesses |
| `python3 tests/contracts_test.py` | 20 passed | Existing task, review and project-plan schema constraints |
| `python3 scripts/sync_skill_references.py --check` | Passed | Standalone Skills match canonical Markdown references |
| `npm run test:pi-host` with Pi 1.5.2 | 1 passed | Actual Pi import/confirm commands then a planned two-Todo Worker/final-review lifecycle with a deterministic local model |
| Independent code review | Findings addressed | Separate Pi/DeepSeek review plus parent inspection and regression checks of the final fixes |

The Node regression suite checks confirmation persistence and draft-only runtime
tools; imported requirement documents; Goal Specification digest/tamper/revision
binding; exclusive-lock state CAS with exactly one concurrent winner and visible
persistence failure; shown-revision confirmation and observational startup without
shared-run mutation; Todo DAG/coverage validation; multi-Todo dependency progression;
real-check-based Todo completion; same-Worker repair; AC evidence requirements;
evidence path:line existence, terminal-newline line bounds and Git-control-file
rejection; malformed or partial review rejection; additive repair Todos and fresh
re-review; transactional pending-only plan adjustments and decision notes that leave
state unchanged on rejection; stale per-Todo evidence plus final integration evidence;
cumulative turn/check/review budgets; bounded valid-JSON per-Todo context containing
only current ACs and prioritizing the current failure; native compaction with one
post-compaction context injection; mixed Worker/reviewer usage accounting with
UNKNOWN aggregate totals; deadline checks before subprocess spawn; cancellation,
locks and staging preservation.
The Pi event harness is a test double; subprocess reviewer fixtures are not live
model evaluations.

## Actual Pi host integration

The host test uses the released `@earendil-works/pi-coding-agent@1.5.2`. It installs
this package into a temporary Pi configuration and loads the extension through
`pi.extensions`. It then runs real Pi processes with a local OpenAI-compatible model
fixture:

1. A separate user-command process imports a two-AC requirements document.
2. A separate user-command process confirms it; the confirmation session differs
   from the Worker session and no runtime tool supplied consent.
3. A Worker process calls the real `surgical_plan` tool with a dependent two-Todo
   DAG and implements only the current Todo in one continuing session.
4. The controller runs real project checks after each Todo and marks completion.
5. All Todos done, a fresh Pi reviewer process reads both changed files in a
   detached worktree and returns CHANGES_REQUIRED with validated path:line evidence.
6. The same Worker receives the findings, adds an additive repair Todo, writes the
   repair, passes checks, and a fresh reviewer returns per-AC PASS.
7. Final settlement records `PR_READY`, final integration evidence for each Todo,
   distinct Worker/Verifier session IDs and persisted file-backed state; exact model
   call counts and one initial plan submission are asserted. The real index stays
   unchanged and the disposable worktree is removed.

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
- Durable crash recovery/automatic background resume, parallel multi-Worker
  scheduling, automatic PR creation, merge, publication, deployment and incident
  response are not implemented by this loop.
- The host test uses a deterministic model; it does not establish competence or
  acceptance quality for DeepSeek or any real model.
- Native Escape is observed at settlement during verification; `/surgical stop`
  is the immediate subprocess cancellation path. See [Pi setup](adapters/pi/SETUP.md).
- Read-tool restrictions are not an OS sandbox or a production authorization
  service. Turn/attempt/time bounds do not constitute a monetary budget.
- Local package installation was exercised; installation from a published Git tag,
  remote Git installation and a production release were not part of this check.

The general project-policy example remains disabled/DRAFT_ONLY. Remaining work is
tracked in [runtime-next.md](docs/runtime-next.md).
