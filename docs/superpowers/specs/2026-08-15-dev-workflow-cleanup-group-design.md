# 设计规格：开发工具箱「清理」分组

状态：已实现（见实现计划 docs/superpowers/plans/2026-08-15-dev-workflow-cleanup-group.md）

关联：
- [Web project development workflow toolbox](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-toolbox.md)
- [智能条设计](./2026-08-15-dev-workflow-toolbox-smart-strip-design.md)

## 问题

工具箱已覆盖规划→总结，但缺少日常收尾类入口：死代码、多余依赖、临时文件、调试残留等。用户需要一键进入「只分析或可改代码」的清理任务，而不是再堆综合按钮或只做面板减负。

## 决策摘要

在 `quality` 与 `ship` 之间新增阶段分组 `group.cleanup`（文案：清理 / Cleanup），加入 **5** 个固定动作，客户端与 `@deepseek-ai/dsh-skill-dev-workflow` 同步扩展。发送路径、persist store、搜索/建议/收藏机制不变；`suggestActions` 仍按 `WORKFLOW_GROUPS` 扁平顺序邻接，清理组自然插入质量与交付之间。

## 非目标

- 不接 git / 不自动跑仓库命令以外的「强制删除」特权。
- 不新增 Host slash 命令；不改智能条 persist 键。
- 不做自定义清理规则 UI。
- 不在本轮做面板默认折叠减负（可后续单开）。

## 动作目录（5）

| id | 中文标签 | 职责 |
|---|---|---|
| `dead-code` | 清死代码 | 未用导出、不可达分支、明显死文件；先证据后删 |
| `deps-hygiene` | 整理依赖 | 未用依赖、重复依赖、与仓库约定不符的版本；对齐现有包管理器 |
| `temp-cleanup` | 清临时残留 | 构建产物、缓存、明确的临时文件；尊重 `.gitignore` 与包约定 |
| `import-hygiene` | 整理 import | 排序/去重/补齐类型导入；对齐仓库 lint/format 约定 |
| `debug-residue` | 清调试残留 | 临时 `console`/`debugger`、过期调试注释、误提交的本地路径 |

每个动作：
- skill 名：`dev-<id>`
- 正文：共享 preamble（analyze/edit）+ 中文任务正文
- skill body：英文 procedure + 既有 `TOOL_RULES`（与现 catalog 一致）

## 分组顺序

```
plan → design → build → quality → cleanup → ship → wrap
```

默认手风琴仍为 `group.plan`；清理组不默认展开。

## 实现面

| 包/文件 | 变更 |
|---|---|
| `ui-dev-workflow` `prompts.ts` | 扩展 `WorkflowActionId`、`WORKFLOW_GROUPS`、`WORKFLOW_BODIES` |
| `ui-dev-workflow` `locales.ts` | `group.cleanup`、5 组 `action.*` / `hint.*`（zh+en） |
| `ui-dev-workflow` `WorkflowPanel.tsx` | `ACTION_LABEL` / `ACTION_HINT` 映射 |
| `ui-dev-workflow` 测试 | 动作总数 33→38；可选断言清理组标题 |
| `skill-dev-workflow` `catalog.ts` | 同步 5 个 `WorkflowSkillId` 与 entries |
| `skill-dev-workflow` 测试 | 名称数量断言更新 |
| README / Agent Note | 动作数与分组描述；中英配对 `--write` |

智能条 `stores` / `suggest`：无需改逻辑（`VALID`/`FLAT` 源自 `WORKFLOW_GROUPS`）。

## Prompt 契约（要点）

共用：先读仓库证据；只分析模式下只列清单与路径，不改文件；可改代码时最小变更并说明验证；不要猜测不存在的文件。

各动作至少输出：
1. 范围与证据来源
2. 拟处理项清单（按风险）
3. 建议顺序
4. 验证方式（真实命令优先）

`temp-cleanup` 与 `deps-hygiene` 额外强调：禁止删除用户未忽略的源码；不确定标为待确认。

## 测试

1. `WORKFLOW_GROUPS` 扁平长度 38；id 唯一。
2. 每个新 id：`messageFor` 含 `/dev-<id>`；`skillAvailable: false` 时无前导 `/`。
3. 面板可展开「清理」并点击其一触发 `run(id, mode)`。
4. skill catalog：`WORKFLOW_SKILL_IDS` 含 5 新 id；`skillNameFor` 前缀 `dev-`。

## 验收标准

- 右侧工具箱出现「清理」组，内含上述 5 按钮。
- 点击走既有 skill/prompt 路径；analyze/edit 仍生效。
- 搜索可命中新标签/hint；建议邻接可跨到清理组。
- 无新 Host 命令；无 git 感知。
