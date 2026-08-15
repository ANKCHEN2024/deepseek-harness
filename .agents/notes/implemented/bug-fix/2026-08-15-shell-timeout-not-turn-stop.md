# Agent Note: Shell timeout markers must not look like turn termination

Status: implemented

English | [中文](2026-08-15-shell-timeout-not-turn-stop.zh.md)

## Problem

On Windows, a pwsh (or bash) foreground timeout force-kills the process and often settles as exit code `1` with no signal. The shell tool renderer appended both `[timed out after …ms]` and `[exit code: 1]`. The pwsh tool description told the model to treat a bare Windows exit `1` after an interruption as termination rather than a command failure. Models then ended the assistant turn after a timeout or ordinary failure instead of retrying in the same turn, and goal work appeared to “stop with no auto-continue” even though the harness had not paused or disarmed the goal.

## Decision

When `timedOut` is true, renderers emit only the timeout marker — not signal or exit markers. Tool descriptions and the pwsh system-prompt section state that timeouts and non-zero exits are recoverable in the same turn. The goal-round prompt likewise tells the model not to stop the turn solely because a command timed out or failed.

## Alternatives considered

**Raise the default executor `timeoutMs` only.** Rejected as the sole fix: longer budgets reduce timeouts but do not stop exit-1-after-kill from being misread as termination, and ordinary non-zero failures would still look like a stop signal.

**Auto-rearm or auto-resume the goal after every tool error.** Rejected: cancel and provider-error paths must stay human-authorized; the observed stop was model behavior after ambiguous markers, not a missing driver wakeup.

## Consequences

Timeout results read as budget expiry. Windows exit-1 kills without a timeout marker remain distinguishable. Within-turn retries after shell failures depend on model compliance with the clearer contract; cancel still pauses goals as before.
