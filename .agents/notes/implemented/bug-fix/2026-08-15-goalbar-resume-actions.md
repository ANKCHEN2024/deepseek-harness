# Agent Note: GoalBar resume stays clickable and covers rearm phases

Status: implemented

English | [中文](2026-08-15-goalbar-resume-actions.zh.md)

## Problem

Clicking **Resume goal** / **恢复目标** in the conversation GoalBar could appear to do nothing. Two independent defects stacked: (1) `runAction` cleared its pending fence only on a resolved Remote envelope, so a thrown face left every icon permanently `disabled` with no alert; (2) the strip offered resume only for `paused`, while the host already accepts resume for `blocked` and for durable-`active` goals that `agent/session-start` left disarmed — after reload the bar showed pause only, with no way to re-arm from the strip.

## Decision

`GoalBar.runAction` uses `try`/`finally` (and surfaces unexpected throws as the inline alert) so pending always clears. The strip shows resume for `active`, `paused`, and `blocked`. Host `goals.resume` treats an already-armed active goal as a no-op success at the same revision, so a visible resume on active does not reject when continuation is already armed.

## Alternatives considered

**Expose process-local `activation` on the goal projection or a new `goal.get` RPC, and show resume only when disarmed.** Rejected for this fix: it needs a new live channel and changes the mutations-only goals wire contract; offering resume on active plus an idempotent armed path restores the re-arm affordance without that channel. A future activation face can still refine the label.

**Catch only the already-armed rejection in the client.** Rejected: `/goal resume` and tools would keep failing on the same redundant click; fixing the domain verb once keeps command, tool, and UI aligned.

## Consequences

Paused and blocked goals keep a working resume control even after a transport throw. Active goals expose resume so session-start disarm can be re-armed from the strip; redundant armed resumes succeed without writing a revision. The projection still omits activation, so active armed and active disarmed share one phase label.
