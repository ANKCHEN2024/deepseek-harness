# Agent Note: Web workflow toolbox focus and feedback polish

Status: implemented

English | [中文](2026-08-15-web-dev-workflow-focus-feedback.zh.md)

## Problem

The toolbox had four usability gaps around action feedback and focus flow. First, the send-confirmation bar mounts at the panel top regardless of which action opened it: clicking a ship-stage action near the bottom of a long details column left the bar out of view, making the click appear to do nothing. Second, transient feedback (sent confirmation, pin-full hint) rendered at the very end of the panel, below every stage group, so users acting near the top never saw it. Third, focus died at both ends of a send: a successful send unmounted the focused confirm button and dropped focus to the document body, and Escape could dismiss the send bar while a send was in flight, leaving a hidden busy state that disabled every button until settlement. Fourth, small-feedback gaps: Ctrl/Cmd+K stole focus from the task-scope input mid-composition, stage headings stayed clickable (and inert) during search, the search box had no consistent clear affordance or match feedback, the two-row mode block wasted ~20px, and bordered pin buttons doubled the chrome of every action row.

## Decision

- The send bar carries a ref; the existing focus effect also calls `scrollIntoView({ block: 'nearest' })` (optional-call guarded because jsdom lacks the method) so opening from any scroll position brings the bar minimally into view.
- Sent and pin-full feedback moved to a `position: sticky; bottom` chip stack at the panel end: it floats at the visible bottom edge while the panel is scrolled, scrolls away with the panel's end, and auto-dismisses (4s sent, 3s pin-full).
- Focus flow: a `useLayoutEffect` on the sent state restores focus to the origin action button after the post-send commit; when that button unmounted (suggestion rotation after `recordRecent` changes the suggestion list), focus lands on the panel root (`tabIndex={-1}`) instead of the body. The send bar's Escape handler always calls `preventDefault` and ignores the key while `busy`, so an in-flight send cannot be visually dismissed.
- Search polish: panel keydown now skips `/` and Ctrl/Cmd+K when the event target is any input (Escape still clears the search from the box); a custom in-box clear button (with the native WebKit cancel button suppressed) clears and refocuses; a `role=status` line reports the match count; stage headings get `disabled` while searching because search auto-expands every stage.
- Density: the execution-mode block is one row (label left, two-button segmented control right); pin buttons are borderless ghosts that reveal on hover or focus-visible, matching the header utility.

## Alternatives considered

### Why not render the send bar next to the clicked action?

Anchoring the bar in the group grid requires per-row state and relayout of the two-column grid, and the bar's height would push neighboring actions around. Scroll-into-view keeps one stable bar at the top with minimal motion.

### Why not a portal-based toast?

The slot system has no toast host; a fixed-position overlay inside the details column would need viewport math and theme coordination for little gain over `position: sticky` within the existing scroll container.

### Why not hide the send bar on Escape and keep the send running?

Hiding the bar while the send is in flight strands the user with every button disabled and no visible reason; blocking the key keeps the in-flight state honest.

## Consequences

- The panel root is now a programmatic focus target (`tabIndex={-1}`); tests assert focus landing on either the origin button or the panel.
- `search.matches` uses a `{n}` placeholder replaced at render time — the locale system has no interpolation.
- The search wrapper changed from an implicit `<label>` to a labeled div (`htmlFor` plus id) so the clear button is not nested inside a label.
- Focus and dismissal rules extend the [keyboard note](2026-08-15-web-dev-workflow-keyboard-a11y.md): Escape inside the send bar is now a busy-aware no-op, and the search shortcuts never fire from inputs.
