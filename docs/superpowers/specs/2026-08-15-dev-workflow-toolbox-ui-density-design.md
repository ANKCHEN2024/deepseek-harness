# 设计规格：开发工具箱 UI 密度与快捷区合并

状态：已实现（见实现计划 docs/superpowers/plans/2026-08-15-dev-workflow-toolbox-ui-density.md）

关联：[Web project development workflow toolbox Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-toolbox.md)、[智能条规格](./2026-08-15-dev-workflow-toolbox-smart-strip-design.md)

## 问题

右侧开发工具箱在智能条落地后功能齐全，但垂直堆叠过重：模式双行卡片、建议/收藏/最近三个并列区块、分组动作双行（标题+说明）。窄详情列首屏有效动作少，扫读成本高。

## 决策摘要

在 `@deepseek-ai/dsh-client-ui-dev-workflow` 内做呈现层优化：收紧密度；把建议/收藏/最近合并为单一「快捷」分区（分段切换）；分组动作改为单行标题，hint 仅进 `title`。不改动作目录、skill、发送协议、布局槽位。

## 非目标

- 不新增或删除 `WorkflowActionId`，不改 `dsh-skill-dev-workflow`。
- 不读 git / 不做仓库感知推荐。
- 不替换 `conversation.details.tool`，不改 header 打开按钮语义。
- 不引入组件库、Tailwind 或字面量颜色；仅用 `--dsw-alias-*`。
- 不升级 persist 键名；在 `dsh.dev-workflow.panel.v1` 上增量字段。

## 架构

| 单元 | 职责 | 依赖 |
|---|---|---|
| `stores.ts` | 新增 `quickTab` 与 `setQuickTab`；校验与回退规则在面板推导 | 现有 persist |
| `WorkflowPanel.tsx` | 紧凑模式条、快捷分段、单行分组动作 | store + inject 不变 |
| `DevWorkflow.module.css` | 间距与控件高度收紧；分段条样式 | tokens only |
| `locales.ts` | 快捷区分段文案；模式 hint 可保留供 `title` | `dev-workflow` 命名空间 |

## Store 契约

persist 键：`dsh.dev-workflow.panel.v1`（不变）。

新增字段：

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `quickTab` | `'suggest' \| 'pinned' \| 'recent'` | `'suggest'` | 用户上次选择的快捷分段 |

新增 action：`setQuickTab(tab)`。

面板解析「有效 tab」：

1. 若 `quickTab` 对应列表非空 → 用 `quickTab`。
2. 否则按顺序回退：`suggest`（`suggestActions` 非空）→ `pinned` → `recent`。
3. 三者皆空 → 不渲染快捷区。

搜索中（`query.trim()` 非空）隐藏整块快捷区（与现网隐藏三区块一致）。

`recent` / `pinned` / `mode` / `openGroup` 语义与智能条规格相同。

## UI 布局（自上而下）

1. **模式**：两列分段按钮；按钮内仅主标签；`title`（及需要时的 `aria-description`）使用现有 `mode.*.hint`。目标高度约 32px 级，不再使用 44px+ 双行卡片。
2. **搜索**：行为不变。
3. **快捷**：标题行 + 三分段控件（建议 / 收藏 / 最近）；仅渲染当前有效 tab 的紧凑动作列表。清空按钮仅在「最近」且列表非空时显示。钉选满提示仍为底部 status。
4. **阶段手风琴**：七组不变；组内动作为单行标签 + 可选 Skill 徽章；`title` 为 hint（有 skill 时附加徽章文案，与现网一致）。搜索时展开命中组的行为不变。

## 视觉密度

- `.panel` gap、区块 gap、grid gap 整体略减（例如 12→8、8→6）。
- 紧凑按钮与分组单行按钮 `min-height` 对齐约 32px。
- pin 列宽与行高对齐；不改交互（独立钉选按钮）。

## 测试

- 组件测试：默认快捷 tab；手动切换 tab；某 tab 变空后回退；搜索隐藏快捷区；模式切换仍发送；单行动作仍带 hint 于 `title`。
- 覆盖率门禁范围内包内测试保持 100%。
- 若 assembled 可见输出变化，用 `DSH_SNAPSHOT=replay pnpm run test:web` 验证；有意变更再 refresh。

## 文档

- 本规格；同变更更新 Agent Note（或短 feature note 交叉链接）与 `packages/client/ui-dev-workflow/README(.zh).md` 一句布局描述。
