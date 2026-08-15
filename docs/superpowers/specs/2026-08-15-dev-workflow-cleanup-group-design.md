# Design Spec: Toolbox Cleanup Group

English | [中文](2026-08-15-dev-workflow-cleanup-group-design.zh.md)

Status: implemented (see the plan at docs/superpowers/plans/2026-08-15-dev-workflow-cleanup-group.md)

Related:
- [Web project development workflow toolbox](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-toolbox.md)
- [Smart strip design](./2026-08-15-dev-workflow-toolbox-smart-strip-design.md)

## Problem

The toolbox already covers planning → wrap-up, but lacks daily housekeeping entry points: dead code, redundant dependencies, temp files, debug residue, and the like. Users need one click into a cleanup task that is analyze-only or allows edits, instead of more aggregate buttons or panel-only slimming.

## Decision summary

Add a stage group `group.cleanup` (copy: 清理 / Cleanup) between `quality` and `ship`, with **5** fixed actions, extending the client and `@deepseek-ai/dsh-skill-dev-workflow` in sync. The send path, persist store, and search/suggest/pin mechanics stay unchanged; `suggestActions` still walks the flat `WORKFLOW_GROUPS` order, so the cleanup group slots naturally between quality and ship.

## Non-goals

- No git integration / no auto-run "force delete" privilege beyond repo commands.
- No new Host slash commands; no change to the smart-strip persist key.
- No custom cleanup-rule UI.
- No default-collapse panel slimming this round (can be split out later).

## Action catalog (5)

| id | Chinese label | Responsibility |
|---|---|---|
| `dead-code` | 清死代码 | Unused exports, unreachable branches, obvious dead files; evidence before deletion |
| `deps-hygiene` | 整理依赖 | Unused dependencies, duplicates, versions that deviate from repo conventions; align with the existing package manager |
| `temp-cleanup` | 清临时残留 | Build artifacts, caches, clearly temporary files; respect `.gitignore` and package conventions |
| `import-hygiene` | 整理 import | Sort/dedupe/complete type-only imports; align with repo lint/format conventions |
| `debug-residue` | 清调试残留 | Temporary `console`/`debugger`, stale debug comments, accidentally committed local paths |

For each action:
- Skill name: `dev-<id>`
- Body: shared preamble (analyze/edit) + Chinese task body
- Skill body: English procedure + the existing `TOOL_RULES` (consistent with the current catalog)

## Group order

```
plan → design → build → quality → cleanup → ship → wrap
```

The default accordion stays `group.plan`; the cleanup group is not expanded by default.

## Implementation surface

| Package/file | Change |
|---|---|
| `ui-dev-workflow` `prompts.ts` | Extend `WorkflowActionId`, `WORKFLOW_GROUPS`, `WORKFLOW_BODIES` |
| `ui-dev-workflow` `locales.ts` | `group.cleanup`, 5 pairs of `action.*` / `hint.*` (zh+en) |
| `ui-dev-workflow` `WorkflowPanel.tsx` | `ACTION_LABEL` / `ACTION_HINT` maps |
| `ui-dev-workflow` tests | Action count 33→38; optionally assert the cleanup heading |
| `skill-dev-workflow` `catalog.ts` | Sync 5 `WorkflowSkillId`s and entries |
| `skill-dev-workflow` tests | Update name-count assertions |
| README / Agent Note | Action count and group description; bilingual pairing `--write` |

Smart-strip `stores` / `suggest`: no logic change needed (`VALID`/`FLAT` derive from `WORKFLOW_GROUPS`).

## Prompt contract (highlights)

Shared: read repo evidence first; analyze mode only lists items and paths without editing files; edit mode makes minimal changes and states how to verify; do not guess at files that do not exist.

Each action outputs at least:
1. Scope and evidence sources
2. A list of items to handle (by risk)
3. A suggested order
4. Verification (prefer real commands)

`temp-cleanup` and `deps-hygiene` additionally stress: never delete user-unignored source; mark uncertainty as to-confirm.

## Tests

1. `WORKFLOW_GROUPS` flat length 38; ids unique.
2. Each new id: `messageFor` contains `/dev-<id>`; no leading `/` when `skillAvailable: false`.
3. The panel can expand 清理 and clicking one triggers `run(id, mode)`.
4. Skill catalog: `WORKFLOW_SKILL_IDS` contains the 5 new ids; `skillNameFor` prefixes `dev-`.

## Acceptance criteria

- The right-side toolbox shows the 清理 group with the 5 buttons above.
- Clicks go through the existing skill/prompt path; analyze/edit still apply.
- Search matches the new labels/hints; suggestion adjacency can cross into the cleanup group.
- No new Host commands; no git awareness.
