# Agent Note: Web workflow toolbox send confirmation

Status: implemented

English | [中文](2026-08-15-web-dev-workflow-send-confirmation.zh.md)

## Problem

The workflow toolbox ([2026-08-15-web-dev-workflow-toolbox](2026-08-15-web-dev-workflow-toolbox.md)) sent on first click. Three gaps followed: a click could not carry a task description, so every action ran a fixed prompt with only conversation context for scope; remote side-effect actions (`commit-push`, `github-private-publish`) executed real `git`/`gh` commands on a mis-click because the analyze/edit toggle is a soft prompt preamble, not a Host permission; and feedback was a transient busy state — failures surfaced as one English line at the panel bottom while success was silent.

## Decision

Clicks open an inline send-confirmation bar in the panel instead of sending. The bar shows the action hint, an optional single-line task-scope input, and a per-send analyze/edit switch that never touches the persisted panel mode. Confirm sends `messageFor(id, mode, { focus })`; `focusBlockFor` appends a `本次任务范围` paragraph when the input is non-empty.

A static `ACTION_RISK` table in `prompts.ts` classifies each of the 48 actions as `safe` / `writes-repo` / `publishes` from its prompt body's edit clauses. `defaultSendMode` opens `publishes` actions analyze-only; `writes-repo` actions follow the panel's global mode. The bar renders risk copy: publish actions always show the remote-side-effect line plus the analyze-default explanation while in analyze; writes-repo actions show a repo-change line only while in edit. The table is client-side advisory copy — it is not a Host permission or sandbox switch.

`run` returns a structured `WorkflowRunResult` (`{ ok: true }` or `{ ok: false, kind: 'scope' | 'service' | 'send', detail }`) instead of `string | null`. The bar stays open on failure with localized per-kind copy, an expandable detail line, and a Retry button; success closes the bar, records recent, and shows a sent status line that auto-clears after 4 seconds. Escape or Cancel closes the bar and restores focus to the originating button; focus lands in the task input on open, and Enter submits.

The panel spec drives the whole bar flow (default modes, risk copy, focus passing, submit, Escape/cancel, retry, categorized failures, sent-status timer). A new apply spec covers the client entry's inject faces and `run` paths — `src/client/index.ts` sat at 0% in the per-file coverage gate before this change. Two dead defensive branches in `suggest.ts` were removed with it.

## Alternatives considered

### Why not a modal risk confirmation?

`ui-primitives/RiskConfirmation` implies a blocking dialog for destructive intent. The workflow bar is a send-composition step (mode + scope + confirmation in one), not a gate; a modal would hide the hint and the input the composition needs.

### Why not default every edit-capable action to analyze?

Forcing analyze on `implement`, `debug`, and the Agent playbooks would add a toggle to the most common flow for reversible working-tree edits. Only remote publish actions, which are hard to undo, default to analyze; local writes follow the global mode and keep a visible notice.

### Why not read git state to sharpen the risk?

Suggestions already avoid reading the repository by design; a git-status RPC would widen the client's data surface for a hint the prompt preamble can express. The static table keeps the feature transport-free.

## Consequences

- One extra confirm per action replaces click-to-send; Escape and Enter keep it cheap for keyboard users.
- Product copy grew by the sendbar/risk/status locale keys (zh/en) plus the `本次任务范围` focus paragraph, all inside the existing `dev-workflow` namespace.
- The `run` inject-face contract changed from `string | null` to `WorkflowRunResult`; the panel is its only consumer.
- `suggest.ts` lost its unreachable dedupe guard and negative-index wrap: three consecutive positions in a cycle of 48 distinct ids never repeat, and a non-catalog anchor (-1) wraps through `-1 + 1 = 0`. Behavior for catalog ids is unchanged.
- `packages/client/ui-dev-workflow/src/client/index.ts` is now unit-covered; before this change it sat at 0% in the per-file coverage gate.
