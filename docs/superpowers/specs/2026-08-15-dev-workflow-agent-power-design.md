# 设计规格：Agent 能力强化工具箱（剧本组 + 加深 skill）

状态：已实现（见实现计划 docs/superpowers/plans/2026-08-15-dev-workflow-agent-power.md）

关联：[Web project development workflow toolbox](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-toolbox.md)

## 问题

工具箱已有大量 SDLC 快捷键，但大多是「单次焦点提示」。强 Agent 的价值在多步工具循环、验证门禁、目标续行与证据优先排查；当前 skill 的 Tool use 过短，不足以驱动这些行为。

## 决策（全部由产品方拍板）

本轮采用 **A（能力编排）+ D（加深 skill）**，并 **轻量接入 B（Goal / Todo 等模型可见工具）**：

1. 新增置顶分组 `group.agent`（文案：Agent），内含 **6** 个多步剧本动作。
2. 加深全部 `skill-dev-workflow` 的共享 `TOOL_RULES` 为 Agent 工作环（工具循环、todo、goal、门禁、停止条件）。
3. **不做**：原生 Git UI、读 git 的建议引擎、砍现有 42 个动作、新 Host 命令。

## 新动作（6）

| id | 标签 | 剧本要点 |
|---|---|---|
| `agent-autonomous` | 自主闭环 | 探查→方案→落地→验证→汇报；可改模式可写库 |
| `agent-investigate` | 深度探查 | 只靠证据；多工具交叉；结论分级置信度 |
| `agent-fix-loop` | 修复闭环 | 复现→根因→最小修复→锁测→再验证 |
| `agent-verify-gate` | 门禁打绿 | 跑仓库真实检查；可改则修到绿，只分析则列失败与修复序 |
| `agent-goal-drive` | 目标驱动 | 用 `create_goal`/`update_goal`/`get_goal` 建立或续跑长任务；配合 todo |
| `agent-parallel` | 并行拆解 | 可并行子任务；有 subagent/委托工具则用，否则清晰串行计划 |

## 分组顺序

```
agent → plan → design → build → quality → cleanup → ship → wrap
```

默认手风琴仍为 `group.plan`（降低干扰）；空 recent 的建议仍为 Plan 前三项。

动作总数：42 → **48**。

## 共享 TOOL_RULES 加深（要点）

在现有规则上增加：

- 未取证前不断言；用读/搜/跑命令形成证据链。
- 多步工作先写 todo（若工具可用），完成一项勾一项。
- 跨多轮目标用 goal 工具；不要用空话代替状态。
- 失败后换假设再试，禁止同命令空转。
- 可改模式：改完必须说明如何用仓库真实脚本验证。
- 只分析：禁止写库与变更性命令。

各剧本 skill 的 Procedure 写清步骤与停止条件。

## 实现面

与既有扩展相同：`prompts.ts`、`locales`、`WorkflowPanel` 映射、`catalog.ts`、测试 42→48、README/Agent Note、`--write`。

## 验收

- 工具箱顶部出现 Agent 组与 6 按钮。
- skill 注入正文含加深后的 Tool use。
- analyze/edit 约束仍由 preamble + skill 共同约束。
