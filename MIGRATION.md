# Migration: v1 two-role content pack -> v2 architecture

This repository now contains the v2 content migration. Account configuration and
runtime automation have not been activated. Update the full package, not selected
files over an installed v1 copy. The original design archive remains unchanged.

## Preserve

Engineer owns the continuous implementation loop; Verifier is independent;
mandatory evidence is current; review repairs are bounded; helpers are optional;
release permission is distinct from technical acceptance.

## Content migration and remaining runtime work

| Existing resource | v2 change |
|---|---|
| `roles/engineer.md` | Add admitted Scout/incident inputs; keep coding ownership; hand release preparation to Operator |
| `roles/verifier.md` | Preserve independence; include current check policy, source mapping and explicit release boundary |
| `roles/worker.md` | Keep compatibility alias if needed; explain it means temporary subagent, not a permanent Bot |
| New role assets | Add Product Scout and Operator; no manager Bot |
| `skills/surgical-dev` | Route task type; do not force every role into every task |
| `skills/prepare-release` | Move primary ownership from Engineer to Operator; preparation still does not execute release |
| New methods | Design/test discover-opportunity, evaluate-outcome, release-and-observe, handle-incident |
| Workflow/evidence refs | Add operational release/incident/outcome loops; preserve original authorization and current snapshots |
| Contracts/templates | Add opportunity, release, incident, outcome and event records; keep IDs linked rather than copying chats |
| Grok setup/export | Generate four setup drafts; regenerate any flattened private Skill text from canonical sources |
| Pi/runtime adapter | Implement role routing and independent evidence controls only once; do not duplicate a Grok loop |
| Tests | Add artifact drift, duplicate operation, unsafe rollback, proposal self-admission and outcome uncertainty cases |

## Safe cutover

1. Inventory active tasks, role messages, Skills, automation triggers and policy
   grants. Do not modify them solely because this design was generated.
2. Author/validate the v2 content and capability mapping in an isolated trial.
3. Complete in-flight tasks under frozen v1 policy, or explicitly pause and migrate
   with source/scope/execution IDs and repair budgets retained.
4. Update canonical resources and remove conflicting active v1 role assignments.
   Preserve historical documents as history, not a second current rule source.
5. Read back role instructions and inspect actual enabled Skill availability.
6. Validate direct bug, review-repair, and preview delivery before adding triggers.
7. Activate only the narrow, user-approved project policy; never widen production
   permissions because new Operator or Scout roles now exist.

The source archive remains unchanged and its hash is recorded in VALIDATION.md.
