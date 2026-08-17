# Dev Workflow Cleanup Group 实现计划

[English](2026-08-15-dev-workflow-cleanup-group.md) | 中文

> **给 Agent 工作者：** 可内联执行，或经 subagent-driven-development 执行。用复选框追踪进度。

**目标：** 在 Web 工具箱的 quality 与 ship 之间新增 `cleanup` 阶段与五个动作，并在打包的 skill 中同步。

**架构：** 扩展 `WorkflowActionId` / `WORKFLOW_GROUPS` / `WORKFLOW_BODIES`，并在 `skill-dev-workflow` catalog 中镜像这些 id；更新文案与面板标签映射；把动作计数测试 33→38。

**技术栈：** 现有 ui-dev-workflow + skill-dev-workflow 模式（`/dev-<id>`、`TOOL_RULES`）。

**规格：** [docs/superpowers/specs/2026-08-15-dev-workflow-cleanup-group-design.md](../specs/2026-08-15-dev-workflow-cleanup-group-design.md)

## 全局约束

- 只有五个 id：`dead-code`、`deps-hygiene`、`temp-cleanup`、`import-hygiene`、`debug-residue`。
- 分组顺序：plan → design → build → quality → **cleanup** → ship → wrap。
- 无 Host 命令；无 git 感知 UI；persist 键不变。
- 中文产品文案；英文 skill procedure；README/Agent Note 双语 + `--write`。

### 任务 1：Client prompts + locales + panel maps

- [ ] 扩展 `prompts.ts`、`locales.ts`、`WorkflowPanel.tsx` 的映射
- [ ] 更新期望 33 → 38 的测试；断言 cleanup 标题
- [ ] 运行 `pnpm exec vitest run packages/client/ui-dev-workflow/tests`

### 任务 2：Skill catalog

- [ ] 扩展 `catalog.ts` 的 id 与 entries
- [ ] 更新 skill 包测试
- [ ] 运行 `pnpm exec vitest run packages/skill/skill-dev-workflow/tests`

### 任务 3：文档

- [ ] README 英/中、Agent Note 英/中，重录 i18n
- [ ] 将 cleanup-group 设计状态标记为已实现

### 任务 4：验证

- [ ] 两个包的测试 + `tsc -b`
