# Dev Workflow Smart Strip Implementation Plan

English | [中文](2026-08-15-dev-workflow-smart-strip.zh.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add search, recent, pins, client-side suggestions, and a persisted panel store to `@deepseek-ai/dsh-client-ui-dev-workflow` without changing skills or Host commands.

**Architecture:** A `defineStore` + `persist` handle owns mode / accordion / recent / pinned. A pure `suggestActions` helper ranks up to three next actions from the flat `WORKFLOW_GROUPS` order. `WorkflowPanel` reads/writes the store, filters by local search text, and records recent only after a successful `run`.

**Tech Stack:** React + CSS Modules (`--dsw-*` tokens), `defineStore` from `@deepseek-ai/dsh-client-runtime/client`, Vitest + Testing Library (jsdom), existing `/dev-<id>` send path.

**Spec:** [docs/superpowers/specs/2026-08-15-dev-workflow-toolbox-smart-strip-design.md](../specs/2026-08-15-dev-workflow-toolbox-smart-strip-design.md)

## Global Constraints

- No git / repo-status RPCs; suggestions are client heuristics only.
- No new Host slash commands; no edits to `@deepseek-ai/dsh-skill-dev-workflow`.
- Persist key exactly `dsh.dev-workflow.panel.v1`.
- Recent cap 8 (UI shows 5); pinned cap 6; suggestions max 3.
- Product copy Chinese; code comments English; files end with one trailing newline.
- Windows shell: do not chain with `&&`; run commands separately.
- Commit only when the user asks, or at plan handoff checkpoints the user already authorized for this WIP fork branch.

---

### Task 1: `suggestActions` pure helper + unit tests

**Files:**
- Create: `packages/client/ui-dev-workflow/src/client/suggest.ts`
- Create: `packages/client/ui-dev-workflow/tests/suggest.spec.ts`
- Modify: none (reads `WORKFLOW_GROUPS` / `WorkflowActionId` from `prompts.ts`)

**Interfaces:**
- Consumes: `WORKFLOW_GROUPS`, `WorkflowActionId`, `WorkflowMode` from `./prompts.ts`
- Produces: `suggestActions(input: { recent: readonly WorkflowActionId[]; pinned: readonly WorkflowActionId[]; mode: WorkflowMode }): WorkflowActionId[]` (length ≤ 3)

- [ ] **Step 1: Write the failing test**

```ts
// packages/client/ui-dev-workflow/tests/suggest.spec.ts
import { describe, expect, it } from 'vitest'
import { suggestActions } from '../src/client/suggest.ts'

describe('suggestActions', () => {
  it('returns Plan first three when recent is empty', () => {
    expect(suggestActions({ recent: [], pinned: [], mode: 'edit' })).toEqual([
      'requirements',
      'user-stories',
      'task-breakdown',
    ])
  })

  it('suggests next in same group then fills to three', () => {
    expect(suggestActions({ recent: ['implement'], pinned: [], mode: 'analyze' })).toEqual([
      'refactor',
      'optimize',
      'code-review',
    ])
  })

  it('crosses to the next group at a group tail', () => {
    expect(suggestActions({ recent: ['debug'], pinned: [], mode: 'edit' })[0]).toBe('commit-message')
  })

  it('wraps from demo-kit back to requirements', () => {
    expect(suggestActions({ recent: ['demo-kit'], pinned: [], mode: 'edit' })[0]).toBe('requirements')
  })

  it('dedupes and caps at three', () => {
    const out = suggestActions({ recent: ['docs', 'docs'], pinned: ['docs'], mode: 'edit' })
    expect(out).toHaveLength(3)
    expect(new Set(out).size).toBe(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run packages/client/ui-dev-workflow/tests/suggest.spec.ts`

Expected: FAIL (module not found / `suggestActions` undefined)

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/client/ui-dev-workflow/src/client/suggest.ts
import { WORKFLOW_GROUPS, type WorkflowActionId, type WorkflowMode } from './prompts.ts'

const FLAT: readonly WorkflowActionId[] = WORKFLOW_GROUPS.flatMap(g => g.actions)

/**
 * Client-only next-action suggestions from recent history (no git).
 * @param input - recent (newest first), pinned (unused for ranking), mode (reserved).
 * @returns up to three distinct action ids.
 */
export function suggestActions(input: {
  readonly recent: readonly WorkflowActionId[]
  readonly pinned: readonly WorkflowActionId[]
  readonly mode: WorkflowMode
}): WorkflowActionId[] {
  void input.pinned
  void input.mode
  if (input.recent.length === 0) {
    return ['requirements', 'user-stories', 'task-breakdown']
  }
  const anchor = input.recent[0]!
  const idx = FLAT.indexOf(anchor)
  const start = idx < 0 ? 0 : idx + 1
  const out: WorkflowActionId[] = []
  for (let i = 0; i < FLAT.length && out.length < 3; i++) {
    const id = FLAT[(start + i) % FLAT.length]!
    if (!out.includes(id)) out.push(id)
  }
  return out
}
```

Note: walking forward from the anchor covers “same-group next”, “cross group”, and “wrap”; filling to 3 with subsequent FLAT entries matches the spec’s neighbor-fill rule without a second adjacency table.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run packages/client/ui-dev-workflow/tests/suggest.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit** (when user authorizes commits)

```powershell
git add packages/client/ui-dev-workflow/src/client/suggest.ts packages/client/ui-dev-workflow/tests/suggest.spec.ts
git commit -m "feat(ui-dev-workflow): add client suggestActions helper"
```

---

### Task 2: `createDevWorkflowStore` + unit tests

**Files:**
- Create: `packages/client/ui-dev-workflow/src/client/stores.ts`
- Create: `packages/client/ui-dev-workflow/tests/stores.client.spec.ts`
- Modify: none

**Interfaces:**
- Consumes: `defineStore`, `EngineStoreHandle` from `@deepseek-ai/dsh-client-runtime/client`; `WorkflowActionId`, `WorkflowMode`, `WORKFLOW_GROUPS` from `./prompts.ts`
- Produces: `createDevWorkflowStore(): EngineStoreHandle<DevWorkflowState, DevWorkflowActions>`; action names `setMode`, `setOpenGroup`, `recordRecent`, `togglePin`, `clearRecent`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createDevWorkflowStore } from '../src/client/stores.ts'

describe('createDevWorkflowStore', () => {
  it('records recent newest-first, deduped, capped at 8', () => {
    const store = createDevWorkflowStore().create()
    for (const id of ['requirements', 'docs', 'implement', 'refactor', 'optimize', 'debug', 'commit-message', 'pr-description', 'changelog'] as const) {
      store.getState().actions.recordRecent(id)
    }
    const recent = store.getState().recent
    expect(recent[0]).toBe('changelog')
    expect(recent).toHaveLength(8)
    expect(recent).not.toContain('requirements')
    store.getState().actions.recordRecent('docs')
    expect(store.getState().recent[0]).toBe('docs')
    expect(store.getState().recent.filter(x => x === 'docs')).toHaveLength(1)
  })

  it('togglePin caps at 6 and clearRecent empties', () => {
    const store = createDevWorkflowStore().create()
    const ids = ['requirements', 'docs', 'implement', 'refactor', 'optimize', 'debug', 'commit-message'] as const
    for (const id of ids) store.getState().actions.togglePin(id)
    expect(store.getState().pinned).toHaveLength(6)
    store.getState().actions.togglePin('requirements')
    expect(store.getState().pinned).not.toContain('requirements')
    store.getState().actions.recordRecent('docs')
    store.getState().actions.clearRecent()
    expect(store.getState().recent).toEqual([])
  })
})
```

(Adjust `getState` / `actions` access to match the exact `EngineStoreHandle.create()` API used by `createWorkspaceViewStore` tests — mirror `packages/client/ui-layout/tests/layout-store.client.spec.ts`.)

- [ ] **Step 2: Run failing test**

Run: `pnpm exec vitest run packages/client/ui-dev-workflow/tests/stores.client.spec.ts`

Expected: FAIL (module missing)

- [ ] **Step 3: Implement store**

```ts
// packages/client/ui-dev-workflow/src/client/stores.ts
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import { WORKFLOW_GROUPS, type WorkflowActionId, type WorkflowMode } from './prompts.ts'

const VALID = new Set<string>(WORKFLOW_GROUPS.flatMap(g => g.actions))
const HEADINGS = WORKFLOW_GROUPS.map(g => g.headingKey)
type OpenGroup = (typeof WORKFLOW_GROUPS)[number]['headingKey'] | null

export type DevWorkflowState = {
  mode: WorkflowMode
  openGroup: OpenGroup
  recent: WorkflowActionId[]
  pinned: WorkflowActionId[]
}

type DevWorkflowActions = {
  setMode: (draft: DevWorkflowState, mode: WorkflowMode) => void
  setOpenGroup: (draft: DevWorkflowState, openGroup: OpenGroup) => void
  recordRecent: (draft: DevWorkflowState, id: WorkflowActionId) => void
  togglePin: (draft: DevWorkflowState, id: WorkflowActionId) => void
  clearRecent: (draft: DevWorkflowState) => void
}

function sanitize(list: readonly string[]): WorkflowActionId[] {
  return list.filter((id): id is WorkflowActionId => VALID.has(id))
}

export function createDevWorkflowStore(): EngineStoreHandle<DevWorkflowState, DevWorkflowActions> {
  return defineStore({
    init: (): DevWorkflowState => ({
      mode: 'edit',
      openGroup: 'group.plan',
      recent: [],
      pinned: [],
    }),
    persist: 'dsh.dev-workflow.panel.v1',
    actions: {
      setMode: (d, mode) => { d.mode = mode },
      setOpenGroup: (d, openGroup) => {
        d.openGroup = openGroup === null || HEADINGS.includes(openGroup) ? openGroup : 'group.plan'
      },
      recordRecent: (d, id) => {
        if (!VALID.has(id)) return
        d.recent = [id, ...d.recent.filter(x => x !== id)].slice(0, 8)
      },
      togglePin: (d, id) => {
        if (!VALID.has(id)) return
        if (d.pinned.includes(id)) {
          d.pinned = d.pinned.filter(x => x !== id)
          return
        }
        if (d.pinned.length >= 6) return
        d.pinned = [...d.pinned, id]
      },
      clearRecent: (d) => { d.recent = [] },
    },
  })
}

/** Drop unknown ids after rehydrate (call from panel mount if persist API does not). */
export function sanitizeDevWorkflowState(state: DevWorkflowState): DevWorkflowState {
  return {
    ...state,
    recent: sanitize(state.recent),
    pinned: sanitize(state.pinned),
  }
}
```

Align `persist` / rehydrate hooks with whatever `defineStore` already supports in workspace view (prefer built-in persist; use `sanitizeDevWorkflowState` only if needed).

- [ ] **Step 4: Pass tests**

Run: `pnpm exec vitest run packages/client/ui-dev-workflow/tests/stores.client.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit** (when authorized)

```powershell
git add packages/client/ui-dev-workflow/src/client/stores.ts packages/client/ui-dev-workflow/tests/stores.client.spec.ts
git commit -m "feat(ui-dev-workflow): persist panel mode recent and pins"
```

---

### Task 3: Wire store into slot registration

**Files:**
- Modify: `packages/client/ui-dev-workflow/src/client/index.ts`
- Modify: `packages/client/ui-dev-workflow/src/client/WorkflowPanel.tsx` (props type only in this task if needed)

**Interfaces:**
- Consumes: `createDevWorkflowStore` from `./stores.ts`
- Produces: `slots.register({ ..., store: createDevWorkflowStore, ...}, WorkflowPanel)` so `PropsStore` injects `useStore` / `actions`

- [ ] **Step 1: Add store to register call**

In `index.ts` workflow register options, add `store: createDevWorkflowStore` next to `locale: NS` (same pattern as `packages/client/ui-layout/src/client/index.ts` / workspace).

- [ ] **Step 2: Extend `WorkflowPanelProps` with `PropsStore<ReturnType<typeof createDevWorkflowStore>>`**

Import `PropsStore` and the store factory type; components must read `useStore` / `actions` from props (never call the factory outside `apply` / tests).

- [ ] **Step 3: Typecheck package**

Run: `pnpm exec tsc -b packages/client/ui-dev-workflow/tsconfig.json --pretty false`

Expected: exit 0 (or only pre-existing errors unrelated to this change)

- [ ] **Step 4: Commit** (when authorized)

---

### Task 4: Panel UI — search, suggest, recent, pin + locales/CSS

**Files:**
- Modify: `packages/client/ui-dev-workflow/src/client/WorkflowPanel.tsx`
- Modify: `packages/client/ui-dev-workflow/src/client/DevWorkflow.module.css`
- Modify: `packages/client/ui-dev-workflow/src/client/locales.ts` (zh + en keys)
- Modify: `packages/client/ui-dev-workflow/tests/workflow.client.spec.tsx`

**Interfaces:**
- Consumes: `suggestActions`, store actions, existing `run` / `listSkillNames` / `openPanel`
- Produces: updated panel behavior per spec UI section

New locale keys (exact):

| Key | zh | en |
|---|---|---|
| `search.placeholder` | 搜索动作… | Search actions… |
| `search.empty` | 无匹配动作 | No matching actions |
| `section.suggest` | 建议 | Suggested |
| `section.pinned` | 收藏 | Pinned |
| `section.recent` | 最近 | Recent |
| `recent.clear` | 清空 | Clear |
| `pin.aria` | 收藏或取消收藏 | Pin or unpin |
| `pin.full` | 收藏已满（最多 6 个） | Pin list full (max 6) |

- [ ] **Step 1: Extend failing/updated panel tests** covering: search filters; empty recent shows Plan suggestions; successful `run` calls `recordRecent`; pin button toggles without calling `run`.

Tests must pass a real `createDevWorkflowStore().create()` (or the PropsStore mock shape used elsewhere) instead of only local `useState`.

- [ ] **Step 2: Implement panel layout order:** mode → search → (if query empty) suggest / pinned / recent → accordion. On successful `run` → `actions.recordRecent(id)`. Mode/openGroup from store. Pin control is a separate `<button type="button">` beside each action.

- [ ] **Step 3: CSS** using only `--dsw-*` tokens; compact section titles; search input full width.

- [ ] **Step 4: Run**

```powershell
pnpm exec vitest run packages/client/ui-dev-workflow/tests
```

Expected: all PASS

- [ ] **Step 5: Commit** (when authorized)

---

### Task 5: Docs + Agent Note

**Files:**
- Modify: `packages/client/ui-dev-workflow/README.md`, `README.zh.md`, `README.i18n.yaml`
- Modify or create: `.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-toolbox.{md,zh.md,i18n.yaml}` (extend Decision/Consequences for persist + suggest) **or** new note `2026-08-15-dev-workflow-smart-strip` cross-linked

- [ ] **Step 1: Update Known Limitations** — remove “mode/accordion not persisted”; state suggestions are client heuristics without git.
- [ ] **Step 2: Agent Note** present-tense Decision covering store persist key and suggest adjacency.
- [ ] **Step 3: Re-record pairing**

```powershell
pnpm run verify-translation-pairing --write packages/client/ui-dev-workflow/README.md
pnpm run verify-translation-pairing --write .agents/notes/implemented/feature/<note>.md
```

- [ ] **Step 4: Commit** (when authorized)

---

### Task 6: Verification gate

- [ ] **Step 1:** `pnpm exec vitest run packages/client/ui-dev-workflow/tests`
- [ ] **Step 2:** `pnpm exec tsc -b packages/client/ui-dev-workflow/tsconfig.json --pretty false`
- [ ] **Step 3:** If default-visible chrome copy changed in assembled web UI, run `DSH_SNAPSHOT=replay pnpm run test:web` (otherwise skip)
- [ ] **Step 4:** Push to fork branch `wip/ankchen-local-2026-08-15` only when user asks

---

## Spec coverage checklist

| Spec requirement | Task |
|---|---|
| `suggestActions` heuristics | Task 1 |
| Store persist `dsh.dev-workflow.panel.v1` | Task 2 |
| Register store on slot | Task 3 |
| Search / suggest / recent / pin UI | Task 4 |
| README + Agent Note | Task 5 |
| Package tests + typecheck | Task 6 |
| No skill / Host command changes | All (explicit non-touch) |

## Placeholder / consistency self-review

- No TBD steps; action names match across Tasks 2–4.
- `suggestActions` fill strategy uses FLAT forward walk (equivalent to spec adjacency examples).
- Commits gated on user authorization (fork WIP already exists).
