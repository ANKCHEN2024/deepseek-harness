# Dev Workflow Cleanup Group Implementation Plan

> **For agentic workers:** Execute inline or via subagent-driven-development. Checkboxes track progress.

**Goal:** Add a `cleanup` stage with five actions between quality and ship in the web toolbox and matching bundled skills.

**Architecture:** Extend `WorkflowActionId` / `WORKFLOW_GROUPS` / `WORKFLOW_BODIES` and mirror ids in `skill-dev-workflow` catalog; update locales and panel label maps; bump action-count tests 33→38.

**Tech Stack:** Existing ui-dev-workflow + skill-dev-workflow patterns (`/dev-<id>`, `TOOL_RULES`).

**Spec:** [docs/superpowers/specs/2026-08-15-dev-workflow-cleanup-group-design.md](../specs/2026-08-15-dev-workflow-cleanup-group-design.md)

## Global Constraints

- Five ids only: `dead-code`, `deps-hygiene`, `temp-cleanup`, `import-hygiene`, `debug-residue`.
- Group order: plan → design → build → quality → **cleanup** → ship → wrap.
- No Host commands; no git-aware UI; persist key unchanged.
- Chinese product copy; English skill procedures; bilingual README/Agent Note + `--write`.

### Task 1: Client prompts + locales + panel maps

- [ ] Extend `prompts.ts`, `locales.ts`, `WorkflowPanel.tsx` maps
- [ ] Update tests expecting 33 → 38; assert cleanup heading
- [ ] Run `pnpm exec vitest run packages/client/ui-dev-workflow/tests`

### Task 2: Skill catalog

- [ ] Extend `catalog.ts` ids + entries
- [ ] Update skill package tests
- [ ] Run `pnpm exec vitest run packages/skill/skill-dev-workflow/tests`

### Task 3: Docs

- [ ] README en/zh, Agent Note en/zh, re-record i18n
- [ ] Mark cleanup-group design status implemented

### Task 4: Verify

- [ ] Package tests + `tsc -b` for both packages
