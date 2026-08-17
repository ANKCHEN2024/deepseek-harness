# Toolbox UI Density and Quick-Area Merge Implementation Plan

English | [中文](2026-08-15-dev-workflow-toolbox-ui-density.zh.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the development toolbox's visual density and merge suggest/pinned/recent into a single quick segment area, without changing skills or the send protocol.

**Architecture:** Extend the persisted `quickTab` inside `ui-dev-workflow`, rearrange the top chrome of `WorkflowPanel`, and tighten spacing in the CSS Module; action hints stay only in `title`.

**Tech Stack:** React, CSS Modules, `defineStore` persist, Vitest + Testing Library, bilingual locale.

## Global Constraints

- Only change `packages/client/ui-dev-workflow` and related docs/Agent Note; no skill-package changes.
- Styles use only `--dsw-alias-*`; product copy keys live in `locales.ts`.
- Keep the persist key `dsh.dev-workflow.panel.v1`.
- On Windows, do not chain shell commands with `&&`; use semicolons or separate calls.

---

### Task 1: Store `quickTab`

- [x] store field, `setQuickTab`, and tests landed

### Task 2: Panel quick segments + single-row actions + density CSS

- [x] locales, panel, CSS, and tests landed

### Task 3: Docs sync

- [x] README / Agent Note / spec status updated
