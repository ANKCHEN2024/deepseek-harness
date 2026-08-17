# Agent Note: Web workflow toolbox keyboard and accessibility polish

Status: implemented

English | [中文](2026-08-15-web-dev-workflow-keyboard-a11y.zh.md)

## Problem

The toolbox was mouse-first: the search input had no keyboard entry point, an empty search result offered no way forward, and three semantics hurt assistive-tech users — the quick strip declared a tablist with no tabpanels, every pin button shared one static accessible name, and action hints lived only in `title` tooltips that screen readers and touch users never see.

## Decision

Key handling stays panel-scoped: a `keydown` handler on the panel root only sees events bubbling from inside the toolbox, so it cannot compete with the composer's `/` slash menu. `/` and Ctrl/Cmd+K focus the search input unless the event originates from an input; Escape clears the search and blurs it, but a send-bar Escape wins first because the send bar's own handler calls `preventDefault` and the panel handler checks `event.defaultPrevented`.

The no-match state now renders up to three recent actions below the empty message as a fallback path.

Accessibility changes: the quick strip switched from `role=tablist`/`tab`/`aria-selected` to a segmented control (`role=group` plus `aria-pressed`), matching the panel's existing mode toggles; pin buttons get per-action names (`收藏或取消收藏：<action>`); and each action button carries its one-line hint as visually hidden text inside the button, so the accessible name includes the hint without duplicate-id risks across the quick strip and stage grids.

## Alternatives considered

### Why not a global Ctrl+K command palette?

The GUI has no command-palette host and the toolbox is one panel among several; a document-level listener would risk intercepting composer keystrokes. Panel-scoped keydown gets the same discoverability inside the panel with no global surface.

### Why not `aria-describedby` ids for the hints?

An action renders in both the quick strip and its stage grid, so stable ids would collide. Inline visually hidden text avoids id management entirely.

## Consequences

- `/` inside the panel is a focus gesture, not typing — it only applies when focus is outside inputs, so typing a slash into the search or send-bar inputs is unaffected.
- No new locale keys: the fallback reuses the existing `section.recent` title.
- Quick-strip queries in tests moved from `role=tab` to `role=button` + `aria-pressed`; pin queries match the per-action label prefix.
- The toolbox remains presentation-only: no model-visible message or session event changed.
