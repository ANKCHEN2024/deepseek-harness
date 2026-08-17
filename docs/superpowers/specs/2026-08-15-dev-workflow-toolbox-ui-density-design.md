# Design Spec: Toolbox UI Density and Quick-Area Merge

English | [中文](2026-08-15-dev-workflow-toolbox-ui-density-design.zh.md)

Status: implemented (see the plan at docs/superpowers/plans/2026-08-15-dev-workflow-toolbox-ui-density.md)

Related: [Web project development workflow toolbox Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-toolbox.md), [Smart strip spec](./2026-08-15-dev-workflow-toolbox-smart-strip-design.md)

## Problem

After the smart strip landed, the right-side development toolbox is feature-complete, but the vertical stacking is too heavy: the double-row mode cards, the three parallel suggest/pinned/recent sections, and two-row group actions (title + description). The narrow details column shows few useful actions above the fold, and scan cost is high.

## Decision summary

Do a presentation-layer optimization inside `@deepseek-ai/dsh-client-ui-dev-workflow`: tighten density; merge suggest/pinned/recent into a single quick section (segmented switching); make group actions single-row titles with the hint only in `title`. Do not change the action catalog, skills, send protocol, or layout slots.

## Non-goals

- No adding or removing `WorkflowActionId`s, no changes to `dsh-skill-dev-workflow`.
- No reading git / no repo-aware recommendations.
- No replacing `conversation.details.tool`, no change to the header open-button semantics.
- No component library, Tailwind, or literal colors; only `--dsw-alias-*`.
- No persist-key bump; add fields incrementally on `dsh.dev-workflow.panel.v1`.

## Architecture

| Unit | Responsibility | Dependency |
|---|---|---|
| `stores.ts` | Add `quickTab` and `setQuickTab`; validation and fallback rules are derived in the panel | existing persist |
| `WorkflowPanel.tsx` | Compact mode strip, quick segments, single-row group actions | store + inject unchanged |
| `DevWorkflow.module.css` | Tighten spacing and control heights; segment strip styles | tokens only |
| `locales.ts` | Quick-section segment copy; mode hints may stay for `title` | the `dev-workflow` namespace |

## Store contract

persist key: `dsh.dev-workflow.panel.v1` (unchanged).

New field:

| Field | Type | Default | Notes |
|---|---|---|---|
| `quickTab` | `'suggest' \| 'pinned' \| 'recent'` | `'suggest'` | the quick segment the user last chose |

New action: `setQuickTab(tab)`.

The panel resolves the effective tab:

1. If the list for `quickTab` is non-empty → use `quickTab`.
2. Otherwise fall back in order: `suggest` (`suggestActions` non-empty) → `pinned` → `recent`.
3. All three empty → do not render the quick section.

While searching (`query.trim()` non-empty) hide the whole quick section (consistent with hiding the three sections today).

`recent` / `pinned` / `mode` / `openGroup` semantics match the smart-strip spec.

## UI layout (top to bottom)

1. **Mode**: two-column segmented buttons; only the main label inside the button; `title` (and `aria-description` when needed) uses the existing `mode.*.hint`. Target height about 32px, no more 44px+ double-row cards.
2. **Search**: behavior unchanged.
3. **Quick**: heading row + a three-segment control (建议 / 收藏 / 最近); render only the compact action list of the current effective tab. The clear button shows only on 最近 with a non-empty list. The pin-full hint stays the bottom status.
4. **Stage accordion**: the seven groups stay; group actions are single-row labels + optional Skill badge; `title` is the hint (with the badge copy appended when a skill exists, as today). Search-time expansion of matching groups is unchanged.

## Visual density

- `.panel` gap, section gaps, and grid gaps shrink slightly overall (e.g. 12→8, 8→6).
- Compact buttons and single-row group buttons align `min-height` to about 32px.
- Pin column width and row height align; interactions unchanged (separate pin button).

## Tests

- Component tests: default quick tab; manual tab switching; fallback after a tab becomes empty; search hides the quick section; mode switch still sends; single-row actions still carry the hint in `title`.
- In-package tests stay at 100% within the coverage gate.
- If the assembled visible output changes, verify with `DSH_SNAPSHOT=replay pnpm run test:web`; refresh only for intentional changes.

## Docs

- This spec; the same change updates the Agent Note (or a short cross-linked feature note) and a one-line layout description in `packages/client/ui-dev-workflow/README.md` and `README.zh.md`.
