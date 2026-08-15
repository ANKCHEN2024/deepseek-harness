# 设计规格：开发工具箱智能条与交互效率

[English](2026-08-15-dev-workflow-toolbox-smart-strip-design.md) | 中文

状态：已实现（见实现计划 docs/superpowers/plans/2026-08-15-dev-workflow-smart-strip.md）

关联：[Web project development workflow toolbox Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-toolbox.md)

## 问题

右侧开发工具箱已有 33 个 SDLC 动作，但面板状态不持久、缺少搜索与「下一步」引导，日常使用成本高。目标是在不接 git、不增 Host 命令、不改 skill 目录的前提下，提升查找效率与阶段引导。

## 决策摘要

在 `@deepseek-ai/dsh-client-ui-dev-workflow` 内增加：过滤搜索、最近使用、收藏钉选、客户端启发式建议条，以及 `defineStore` + `persist` 的面板状态。发送路径仍为 `conversation.send(messageFor(...))`；`@deepseek-ai/dsh-skill-dev-workflow` 不变。

## 非目标

- 不读 `git status` / diff，不做仓库感知推荐。
- 不提供自定义 prompt / cordis 配置 / 设置页。
- 不引入剧本式多步串联 UI。
- 不新增动作 id，不改 skill 正文。
- 不替换工具详情栏；建议条仍在 `conversation.details.workflow` 内。

## 架构

| 单元 | 职责 | 依赖 |
|---|---|---|
| `stores.ts` → `createDevWorkflowStore` | 持久化 mode、openGroup、recent、pinned | `defineStore`（与 workspace view 同模式） |
| `suggest.ts` → `suggestActions` | 纯函数：由 recent + pinned + mode 产出最多 3 个建议 id | `prompts.ts` 的分组与 id |
| `WorkflowPanel.tsx` | 搜索 / 建议 / 最近 / 收藏 / 分组手风琴；读写 store | inject `run` / `listSkillNames` / `openPanel` |
| `index.ts` | register 时挂上 `store: createDevWorkflowStore` | 现有 inject 面不变 |
| `locales.ts` | 新增文案键（搜索占位、建议、最近、收藏、清空等） | `dev-workflow` 命名空间 |

技能徽章、busy、error 仍为组件本地状态；不进 store。

## Store 契约

`persist` 键：`dsh.dev-workflow.panel.v1`。

状态字段：

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `mode` | `'analyze' \| 'edit'` | `'edit'` | 与现网一致 |
| `openGroup` | 分组 headingKey 或 `null` | `'group.plan'` | 互斥手风琴；`null` 表示全收起 |
| `recent` | `WorkflowActionId[]` | `[]` | 最近成功发送的动作，最新在前，上限 **8** |
| `pinned` | `WorkflowActionId[]` | `[]` | 用户钉选，上限 **6**，顺序即展示顺序 |

Actions：

- `setMode(mode)`
- `setOpenGroup(headingKey | null)`
- `recordRecent(id)` — 去重后插到队首，截断到 8
- `togglePin(id)` — 已钉则移除；未钉且未满则追加；已满则 no-op（UI 提示用 locale）
- `clearRecent()` — 清空最近列表

Store 是面板级全局（跨 Session 复用同一 persist），不按 `sessionId` 分片：工具箱偏好是用户习惯，不是会话内容。

## 建议规则（`suggestActions`）

输入：`recent`、`pinned`、`mode`。输出：最多 3 个互不重复的 `WorkflowActionId`，且不与「仅展示用」的重复策略冲突（见 UI）。

固定阶段邻接（硬编码表，与 `WORKFLOW_GROUPS` 顺序一致）：

1. 若 `recent` 为空：返回 Plan 组前三项 `requirements`、`user-stories`、`task-breakdown`。
2. 否则取 `recent[0]` 为锚点：
   - 优先同组内「下一个」动作；
   - 若已是组内最后一项，取下一组的第一项；
   - wrap 组末项之后回落到 `requirements`。
3. 再补一到两个「同组其余高频邻居」：锚点的前一项（若有）、或下一组第二项；不足则用下一组后续动作填满到 3。
4. 去重；若结果与 `pinned` 前几项完全重叠，仍保留建议（建议区与收藏区可同 id，点击行为相同）。
5. `mode` 本轮不改变建议集合（预留扩展；analyze/edit 只影响发送 preamble）。

邻接表示例（实现以代码表为准）：`implement` → `refactor` → `optimize` → `code-review`；`debug` → `commit-message`；`pr-description` → `changelog`；`handoff-notes` → `project-summary`。

## UI 布局（自上而下）

1. **模式切换**（现有 analyze / edit）— 读写 `store.mode`。
2. **搜索框** — 本地字符串；匹配动作中文标签与 hint（`t(ACTION_LABEL)` / `t(ACTION_HINT)`），大小写不敏感；有查询时隐藏建议/最近/收藏区块，分组内只显示命中动作（空组折叠）；无命中显示「无匹配」状态文案。
3. **建议** — 标题 + 最多 3 个紧凑按钮；无搜索时显示。
4. **收藏** — 仅当 `pinned.length > 0`；按钮可二次点击取消钉选（或行内取消控件）；钉满时 `togglePin` no-op 并短暂 status 提示。
5. **最近** — 最多展示 5 条（store 存 8，UI 截断）；提供「清空」。
6. **分组手风琴** — 行为与现网一致；`openGroup` 来自 store。每个动作按钮支持：主点击 = 发送；次要控件（如小图钉）= `togglePin`（键盘：按钮 `title` 保留 hint；钉选用独立 button 避免误触发送）。

视觉：继续只用 `--dsw-*` token；建议/最近用略弱的分区标题，避免第二套「仪表盘」感。

## 数据流

1. 面板挂载：`openPanel()`；`listSkillNames()` 填徽章；`useStore` 读 persist 状态。
2. 用户点动作（建议 / 最近 / 收藏 / 分组）：`run(id, mode)`；成功（返回 `null`）后 `actions.recordRecent(id)`；失败不写入 recent。
3. 搜索、钉选、展开、模式切换只改 store / 本地 query，不发消息。

## 错误处理

- `run` 失败：现有 error 条；不更新 recent。
- `listSkillNames` 失败：徽章空；建议与按钮仍可用。
- persist 损坏 / 非法 id：`init` 或读后过滤未知 id，回落到默认。

## 测试

包内 `tests/`（jsdom 组件 + 纯函数）：

1. `suggestActions`：空 recent、组中、组末跨组、wrap 末回落、去重上限 3。
2. store：`recordRecent` 去重与截断；`togglePin` 上限 6；非法 id 过滤（若实现守卫）。
3. `WorkflowPanel`：搜索过滤可见性；成功发送后 recent 出现；钉选切换；mode/openGroup 经 store 读写（可用 `createDevWorkflowStore().create()` 注入）。

不要求本轮改 `test:web` 快照，除非组装后的右侧栏文案成为可见回归要求；若 PR 改了默认可见 chrome，按 client AGENTS 补 `DSH_SNAPSHOT=replay` 判定。

## 文档与 Agent Note

实现 PR 须：

- 更新 `packages/client/ui-dev-workflow/README{,.zh,.i18n.yaml}`（Known Limitations：去掉「mode/accordion 不持久」；写明建议为客户端启发式、无 git）。
- 新增或更新 Agent Note（扩展现有 toolbox note，或新开 feature note 并交叉链接），描述 store persist 与建议规则。

## 验收标准

- 刷新页面后 mode、展开阶段、最近、收藏仍在。
- 无历史时建议为 Plan 三项；有历史时建议跟锚点邻接。
- 搜索能在 33 个动作中按中文标签/hint 过滤。
- 点击建议/最近/分组按钮仍走 `/dev-<id>` + preamble（skill 可用时）。
- 无新 Host 命令；skill 包无改动。
