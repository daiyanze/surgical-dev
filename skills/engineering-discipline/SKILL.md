---
name: engineering-discipline
description: Use when planning, implementing, debugging or reviewing code to expose assumptions, avoid overengineering, keep diffs narrow, and verify success.
---

# Engineering discipline

Adapt four habits from [Karpathy-inspired coding guidelines](https://github.com/multica-ai/andrej-karpathy-skills).
Apply them inside Surgical Dev's existing Worker and Verifier loop, not as a new agent or approval gate.

## Think before coding

Read relevant code and tests. Surface assumptions and tradeoffs affecting approved
requirements, safety or public contracts rather than guessing silently. Resolve
questions using existing project evidence or ask only when authority is missing.
Routine implementation choices remain with Worker.

## Simplicity first

Use the smallest sufficient solution and established patterns. Avoid speculative
features, one-off abstractions, unnecessary configurability and dependencies.
Preserve necessary compatibility, security and error handling.

## Surgical changes

Trace each changed file to an acceptance criterion, required dependency or
cleanup introduced by this change. Match local conventions. Do not reformat
adjacent files, refactor unrelated modules or delete old dead code. Keep shared
interfaces under a clear owner and revalidate their consumers.

## Goal-driven execution

Translate the task into observable success criteria and actual checks. For bugs,
prefer reproducing the failure before fixing it where feasible. For refactors,
verify behavior before and after. Implement, test, inspect failures and repair
within the authorized budget. Worker self-checks; Verifier independently
reviews the current snapshot.

## Review guidance

Look for unsupported consequential assumptions, unrequested complexity,
unrelated edits and missing evidence. Concrete contract violations can block.
Style preferences and optional simplifications remain advisory.
Keep trivial fixes lightweight.

## Return

Report relevant assumptions, the minimal approach, changed-file rationale,
checks actually run and remaining risks. Do not invent evidence or permissions.
