# Design Spec: Toolbox Smart Strip and Interaction Efficiency

English | [中文](2026-08-15-dev-workflow-toolbox-smart-strip-design.zh.md)

Status: implemented (see the plan at docs/superpowers/plans/2026-08-15-dev-workflow-smart-strip.md)

Related: [Web project development workflow toolbox Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-toolbox.md)

## Problem

The right-side development toolbox already has 33 SDLC actions, but the panel state is not persisted and search plus next-step guidance are missing, making daily use costly. The goal is to improve lookup efficiency and stage guidance without touching git, adding Host commands, or changing the skill catalog.

## Decision summary

Add to `@deepseek-ai/dsh-client-ui-dev-workflow`: filtered search, recent usage, pin favorites, a client-side heuristic suggestion strip, and a `defineStore` + `persist` panel state. The send path stays `conversation.send(messageFor(...))`; `@deepseek-ai/dsh-skill-dev-workflow` is unchanged.

## Non-goals

- No reading `git status` / diff, no repo-aware recommendations.
- No custom prompt / cordis config / settings page.
- No playbook-style multi-step chained UI.
- No new action ids, no skill body changes.
- No replacing the tool details column; the suggestion strip stays inside `conversation.details.workflow`.

## Architecture

| Unit | Responsibility | Dependency |
|---|---|---|
| `stores.ts` → `createDevWorkflowStore` | Persist mode, openGroup, recent, pinned | `defineStore` (same pattern as the workspace view) |
| `suggest.ts` → `suggestActions` | Pure function: produce at most 3 suggested ids from recent + pinned + mode | groups and ids from `prompts.ts` |
| `WorkflowPanel.tsx` | Search / suggest / recent / pinned / group accordion; reads and writes the store | inject `run` / `listSkillNames` / `openPanel` |
| `index.ts` | Attach `store: createDevWorkflowStore` at register | existing inject face unchanged |
| `locales.ts` | New copy keys (search placeholder, suggested, pinned, recent, clear, etc.) | the `dev-workflow` namespace |

Skill badges, busy, and error stay component-local state; not in the store.

## Store contract

`persist` key: `dsh.dev-workflow.panel.v1`.

State fields:

| Field | Type | Default | Notes |
|---|---|---|---|
| `mode` | `'analyze' \| 'edit'` | `'edit'` | same as current |
| `openGroup` | a group headingKey or `null` | `'group.plan'` | exclusive accordion; `null` means all collapsed |
| `recent` | `WorkflowActionId[]` | `[]` | last successfully sent actions, newest first, capped at **8** |
| `pinned` | `WorkflowActionId[]` | `[]` | user pins, capped at **6**, order is display order |

Actions:

- `setMode(mode)`
- `setOpenGroup(headingKey | null)`
- `recordRecent(id)` — dedupe, insert at head, truncate to 8
- `togglePin(id)` — pinned → remove; unpinned and not full → append; full → no-op (the UI hint uses locale)
- `clearRecent()` — clear the recent list

The store is panel-level global (one persist shared across Sessions), not sharded by `sessionId`: toolbox preferences are user habits, not session content.

## Suggestion rules (`suggestActions`)

Input: `recent`, `pinned`, `mode`. Output: at most 3 distinct `WorkflowActionId`s, without conflicting with the display-only dedupe policy (see UI).

Fixed stage adjacency (hardcoded table, consistent with the `WORKFLOW_GROUPS` order):

1. If `recent` is empty: return the first three Plan actions `requirements`, `user-stories`, `task-breakdown`.
2. Otherwise take `recent[0]` as the anchor:
   - prefer the next action in the same group;
   - if it is the last in its group, take the first action of the next group;
   - after the final group item, wrap back to `requirements`.
3. Fill one or two more "high-frequency same-group neighbors": the anchor's previous item (if any), or the second item of the next group; otherwise fill to 3 with subsequent actions of the next group.
4. Dedupe; if the result fully overlaps the first `pinned` items, keep the suggestions (suggest and pinned areas may share ids; clicking behaves the same).
5. `mode` does not change the suggestion set this round (reserved for extension; analyze/edit only affect the send preamble).

Adjacency examples (the code table wins): `implement` → `refactor` → `optimize` → `code-review`; `debug` → `commit-message`; `pr-description` → `changelog`; `handoff-notes` → `project-summary`.

## UI layout (top to bottom)

1. **Mode switch** (existing analyze / edit) — reads and writes `store.mode`.
2. **Search box** — local string; matches Chinese action labels and hints (`t(ACTION_LABEL)` / `t(ACTION_HINT)`), case-insensitive; with a query, hide the suggest/recent/pinned sections and show only matching actions inside groups (empty groups collapse); no match shows the 无匹配 empty-state copy.
3. **Suggested** — heading + at most 3 compact buttons; shown when not searching.
4. **Pinned** — only when `pinned.length > 0`; a second click unpins (or an inline unpin control); when full, `togglePin` no-ops with a brief status hint.
5. **Recent** — show at most 5 (store keeps 8, UI truncates); provides 清空.
6. **Group accordion** — behavior as current; `openGroup` comes from the store. Each action button supports: main click = send; secondary control (e.g. a small pin) = `togglePin` (keyboard: the button `title` keeps the hint; pinning uses a separate button to avoid accidental sends).

Visuals: keep using only `--dsw-*` tokens; suggested/recent use slightly weaker section headings to avoid a second dashboard feel.

## Data flow

1. Panel mount: `openPanel()`; `listSkillNames()` fills badges; `useStore` reads the persisted state.
2. User clicks an action (suggest / recent / pinned / group): `run(id, mode)`; on success (returns `null`) call `actions.recordRecent(id)`; failures do not write recent.
3. Search, pinning, expanding, and mode switching only change the store / local query and send no message.

## Error handling

- `run` failure: existing error strip; no recent update.
- `listSkillNames` failure: empty badges; suggestions and buttons still work.
- Corrupt persist / invalid ids: filter unknown ids at `init` or after read, fall back to defaults.

## Tests

In-package `tests/` (jsdom components + pure functions):

1. `suggestActions`: empty recent, mid-group, cross-group at a group tail, wrap back at the end, dedupe cap 3.
2. store: `recordRecent` dedupe and truncation; `togglePin` cap 6; invalid-id filtering (if the guard is implemented).
3. `WorkflowPanel`: search filter visibility; recent appears after a successful send; pin toggling; mode/openGroup read and write through the store (injectable via `createDevWorkflowStore().create()`).

No `test:web` snapshot change is required this round unless the assembled right-column copy becomes a visible regression requirement; if the PR changes default-visible chrome, add the `DSH_SNAPSHOT=replay` judgment per client AGENTS.

## Docs and Agent Note

The implementation PR must:

- Update `packages/client/ui-dev-workflow/README{,.zh,.i18n.yaml}` (Known Limitations: remove "mode/accordion not persisted"; state that suggestions are client heuristics without git).
- Add or update an Agent Note (extend the existing toolbox note, or open a new feature note with cross-links) describing store persist and the suggestion rules.

## Acceptance criteria

- After a page refresh, mode, expanded stage, recent, and pinned persist.
- With no history, suggestions are the three Plan actions; with history, suggestions follow anchor adjacency.
- Search filters the 33 actions by Chinese label/hint.
- Clicking suggest/recent/group buttons still goes through `/dev-<id>` + preamble (when the skill is available).
- No new Host commands; the skill package is unchanged.
