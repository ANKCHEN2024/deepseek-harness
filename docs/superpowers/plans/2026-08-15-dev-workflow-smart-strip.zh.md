# Dev Workflow Smart Strip 实现计划

[English](2026-08-15-dev-workflow-smart-strip.md) | 中文

> **给 Agent 工作者：** 必须使用子 skill：用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐项实现本计划。步骤用复选框（`- [ ]`）语法追踪。

**目标：** 为 `@deepseek-ai/dsh-client-ui-dev-workflow` 增加搜索、最近、钉选、客户端建议与持久化面板 store，不改 skill 或 Host 命令。

**架构：** 一个 `defineStore` + `persist` 句柄持有 mode / 手风琴 / recent / pinned。一个纯 `suggestActions` 助手按 `WORKFLOW_GROUPS` 扁平顺序对最多三个下一步动作排序。`WorkflowPanel` 读写 store，按本地搜索文本过滤，仅在 `run` 成功后记录 recent。

**技术栈：** React + CSS Modules（`--dsw-*` token）、来自 `@deepseek-ai/dsh-client-runtime/client` 的 `defineStore`、Vitest + Testing Library（jsdom）、现有 `/dev-<id>` 发送路径。

**规格：** [docs/superpowers/specs/2026-08-15-dev-workflow-toolbox-smart-strip-design.md](../specs/2026-08-15-dev-workflow-toolbox-smart-strip-design.md)

## 全局约束

- 无 git / 仓库状态 RPC；建议只是客户端启发式。
- 无新 Host slash 命令；不改 `@deepseek-ai/dsh-skill-dev-workflow`。
- persist 键精确为 `dsh.dev-workflow.panel.v1`。
- recent 上限 8（UI 显示 5）；pinned 上限 6；建议最多 3。
- 产品文案中文；代码注释英文；文件以恰好一个换行结尾。
- Windows shell：不要用 `&&` 串联；命令分开运行。
- 只在用户要求时提交，或在本 WIP fork 分支用户已授权的计划交接检查点提交。

---

### 任务 1：`suggestActions` 纯助手 + 单元测试

**文件：**
- 新建：`packages/client/ui-dev-workflow/src/client/suggest.ts`
- 新建：`packages/client/ui-dev-workflow/tests/suggest.spec.ts`
- 修改：无（从 `prompts.ts` 读 `WORKFLOW_GROUPS` / `WorkflowActionId`）

**接口：**
- 消费：来自 `./prompts.ts` 的 `WORKFLOW_GROUPS`、`WorkflowActionId`、`WorkflowMode`
- 产出：`suggestActions(input: { recent: readonly WorkflowActionId[]; pinned: readonly WorkflowActionId[]; mode: WorkflowMode }): WorkflowActionId[]`（长度 ≤ 3）

- [ ] **步骤 1：先写失败的测试**

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

- [ ] **步骤 2：跑测试确认失败**

运行：`pnpm exec vitest run packages/client/ui-dev-workflow/tests/suggest.spec.ts`

预期：FAIL（模块不存在 / `suggestActions` 未定义）

- [ ] **步骤 3：写最小实现**

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

说明：从锚点向前走同时覆盖「同组下一个」「跨组」与「wrap」；用后续 FLAT 项补到 3 与规格的邻居补齐规则一致，无需第二张邻接表。

- [ ] **步骤 4：跑测试确认通过**

运行：`pnpm exec vitest run packages/client/ui-dev-workflow/tests/suggest.spec.ts`

预期：PASS

- [ ] **步骤 5：提交**（用户授权提交时）

```powershell
git add packages/client/ui-dev-workflow/src/client/suggest.ts packages/client/ui-dev-workflow/tests/suggest.spec.ts
git commit -m "feat(ui-dev-workflow): add client suggestActions helper"
```

---

### 任务 2：`createDevWorkflowStore` + 单元测试

**文件：**
- 新建：`packages/client/ui-dev-workflow/src/client/stores.ts`
- 新建：`packages/client/ui-dev-workflow/tests/stores.client.spec.ts`
- 修改：无

**接口：**
- 消费：来自 `@deepseek-ai/dsh-client-runtime/client` 的 `defineStore`、`EngineStoreHandle`；来自 `./prompts.ts` 的 `WorkflowActionId`、`WorkflowMode`、`WORKFLOW_GROUPS`
- 产出：`createDevWorkflowStore(): EngineStoreHandle<DevWorkflowState, DevWorkflowActions>`；动作名 `setMode`、`setOpenGroup`、`recordRecent`、`togglePin`、`clearRecent`

- [ ] **步骤 1：先写失败的测试**

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

（按 `createWorkspaceViewStore` 测试所使用的精确 `EngineStoreHandle.create()` API 调整 `getState` / `actions` 访问——镜像 `packages/client/ui-layout/tests/layout-store.client.spec.ts`。）

- [ ] **步骤 2：跑失败的测试**

运行：`pnpm exec vitest run packages/client/ui-dev-workflow/tests/stores.client.spec.ts`

预期：FAIL（模块不存在）

- [ ] **步骤 3：实现 store**

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

把 `persist` / rehydrate 钩子对齐 workspace view 中 `defineStore` 已支持的机制（优先用内置 persist；仅在需要时用 `sanitizeDevWorkflowState`）。

- [ ] **步骤 4：通过测试**

运行：`pnpm exec vitest run packages/client/ui-dev-workflow/tests/stores.client.spec.ts`

预期：PASS

- [ ] **步骤 5：提交**（授权时）

```powershell
git add packages/client/ui-dev-workflow/src/client/stores.ts packages/client/ui-dev-workflow/tests/stores.client.spec.ts
git commit -m "feat(ui-dev-workflow): persist panel mode recent and pins"
```

---

### 任务 3：把 store 接入 slot 注册

**文件：**
- 修改：`packages/client/ui-dev-workflow/src/client/index.ts`
- 修改：`packages/client/ui-dev-workflow/src/client/WorkflowPanel.tsx`（本任务只在需要时改 props 类型）

**接口：**
- 消费：来自 `./stores.ts` 的 `createDevWorkflowStore`
- 产出：`slots.register({ ..., store: createDevWorkflowStore, ...}, WorkflowPanel)`，使 `PropsStore` 注入 `useStore` / `actions`

- [ ] **步骤 1：给 register 调用加 store**

在 `index.ts` 的 workflow register 选项里，把 `store: createDevWorkflowStore` 加在 `locale: NS` 旁（与 `packages/client/ui-layout/src/client/index.ts` / workspace 同模式）。

- [ ] **步骤 2：用 `PropsStore<ReturnType<typeof createDevWorkflowStore>>` 扩展 `WorkflowPanelProps`**

导入 `PropsStore` 与 store 工厂类型；组件必须从 props 读 `useStore` / `actions`（除 `apply` / 测试外不得调用工厂）。

- [ ] **步骤 3：类型检查包**

运行：`pnpm exec tsc -b packages/client/ui-dev-workflow/tsconfig.json --pretty false`

预期：exit 0（或只有与本改动无关的既有错误）

- [ ] **步骤 4：提交**（授权时）

---

### 任务 4：面板 UI——搜索、建议、最近、钉选 + 文案/CSS

**文件：**
- 修改：`packages/client/ui-dev-workflow/src/client/WorkflowPanel.tsx`
- 修改：`packages/client/ui-dev-workflow/src/client/DevWorkflow.module.css`
- 修改：`packages/client/ui-dev-workflow/src/client/locales.ts`（zh + en 键）
- 修改：`packages/client/ui-dev-workflow/tests/workflow.client.spec.tsx`

**接口：**
- 消费：`suggestActions`、store 动作、现有 `run` / `listSkillNames` / `openPanel`
- 产出：按规格 UI 节更新的面板行为

新文案键（精确）：

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

- [ ] **步骤 1：扩展失败/更新的面板测试**，覆盖：搜索过滤；空 recent 显示 Plan 建议；成功的 `run` 调用 `recordRecent`；钉选按钮切换且不调用 `run`。

测试必须传入真实的 `createDevWorkflowStore().create()`（或其他地方使用的 PropsStore mock 形状），而不是只靠本地 `useState`。

- [ ] **步骤 2：实现面板布局顺序：** mode → search → （query 为空时）suggest / pinned / recent → accordion。成功的 `run` → `actions.recordRecent(id)`。mode/openGroup 来自 store。钉选控件是每个动作旁的独立 `<button type="button">`。

- [ ] **步骤 3：CSS** 只用 `--dsw-*` token；紧凑分区标题；搜索输入全宽。

- [ ] **步骤 4：运行**

```powershell
pnpm exec vitest run packages/client/ui-dev-workflow/tests
```

预期：全部 PASS

- [ ] **步骤 5：提交**（授权时）

---

### 任务 5：文档 + Agent Note

**文件：**
- 修改：`packages/client/ui-dev-workflow/README.md`、`README.zh.md`、`README.i18n.yaml`
- 修改或新建：`.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-toolbox.{md,zh.md,i18n.yaml}`（扩展 Decision/Consequences 覆盖 persist + suggest）**或** 新建 `2026-08-15-dev-workflow-smart-strip` note 并交叉链接

- [ ] **步骤 1：更新 Known Limitations**——去掉「mode/accordion 不持久」；写明建议是客户端启发式、无 git。
- [ ] **步骤 2：Agent Note** 以现在时 Decision 覆盖 store persist 键与建议邻接。
- [ ] **步骤 3：重录配对**

```powershell
pnpm run verify-translation-pairing --write packages/client/ui-dev-workflow/README.md
pnpm run verify-translation-pairing --write .agents/notes/implemented/feature/<note>.md
```

- [ ] **步骤 4：提交**（授权时）

---

### 任务 6：验证门禁

- [ ] **步骤 1：** `pnpm exec vitest run packages/client/ui-dev-workflow/tests`
- [ ] **步骤 2：** `pnpm exec tsc -b packages/client/ui-dev-workflow/tsconfig.json --pretty false`
- [ ] **步骤 3：** 若组装 Web UI 的默认可见 chrome 文案有变，运行 `DSH_SNAPSHOT=replay pnpm run test:web`（否则跳过）
- [ ] **步骤 4：** 仅在用户要求时推送到 fork 分支 `wip/ankchen-local-2026-08-15`

---

## 规格覆盖清单

| 规格要求 | 任务 |
|---|---|
| `suggestActions` 启发式 | 任务 1 |
| Store persist `dsh.dev-workflow.panel.v1` | 任务 2 |
| 在 slot 上注册 store | 任务 3 |
| 搜索 / 建议 / 最近 / 钉选 UI | 任务 4 |
| README + Agent Note | 任务 5 |
| 包测试 + typecheck | 任务 6 |
| 不改 skill / Host 命令 | 全部（明确不触碰） |

## 占位 / 一致性自检

- 无 TBD 步骤；动作名在任务 2–4 间一致。
- `suggestActions` 补齐策略用 FLAT 向前走（等价于规格邻接示例）。
- 提交以用户授权为门槛（fork WIP 已存在）。
