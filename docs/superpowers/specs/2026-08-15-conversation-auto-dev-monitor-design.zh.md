# 设计规格：会话驱动自动开发监测

[English](2026-08-15-conversation-auto-dev-monitor-design.md) | 中文

Status: approved

相关：[同会话 goal-round 驱动器](../../../.agents/notes/implemented/feature/2026-07-19-same-session-goal-round-driver.md)、[持久化同会话 goal 域](../../../.agents/notes/implemented/feature/2026-07-19-persisted-same-session-goal-domain.md)、[Goal 子系统](../../subsystems/goal.md)

## 问题

用户希望有一种显式开启的模式：监测当前产品工作区会话，推断未完成工作，在无需再次确认的情况下创建或重新武装同会话 goal，并持续开发直到模型将 goal 标为 complete 或 blocked。现有 `goal-round-driver` 已经能续跑已武装的 goal，但在用户只拨一次开关之后，没有组件能从对话残留工作发明或重新武装该 goal。缺少专用监测消费方时，操作者必须为每次长时项目推进手工建 goal 或点击工具箱动作。

## 决策摘要

新增策略插件 `@deepseek-ai/dsh-goal-conversation-monitor`，与 `dsh-goal`、`dsh-tool-goal`、`dsh-goal-round-driver` 并列挂载。每个 agent 上的显式武装开关（默认关，跨 session-start 不继承）是自动 create / edit / resume goal 的唯一人工授权。开关打开且 agent 空闲、无竞争人工消息时，监测器要么让位给已 active 且已武装的 goal（由驱动器拥有轮次），在 cancel-hold 已清除时程序化 resume 暂停/已 disarm 的 goal，要么最多准入一次监测推断轮。推断不得伪造 `{ kind: 'user' }`，也不得走 `create_goal` / `update_goal` 的 create-edit-resume 路径（`dsh-tool-goal` 要求直接人工证明）。监测器自有模型侧 decide 工具，仅在开关打开时变更 `ctx.goals`。完成判定仍由后续 goal round 上的 `update_goal complete` 由模型自证；阻塞与现有审批缝停止循环。关闭开关会 disarm 续行并取消进行中的监测预留。

## 非目标

- 监测 Cursor、VS Code 或任何外部 IDE 对话。
- 在 `ctx.goals` 之外再造一套完成状态机。
- 修改 `dsh-agent-loop`，或把本策略并入 `goal-round-driver`。
- 由独立评估器认证「完成」。
- 常开监测，或在会话恢复 / fork / 进程重启后持久化开关。
- 自动恢复 `blocked` goal；自动重试驱动器已拒绝的供应商 / 持久化失败。
- 并行 goal 或多 agent 工作区编排。

## 架构

```text
[switch ON] → idle + no competing human inbox work
                 │
                 ├─ active + armed goal → yield (goal-round-driver)
                 ├─ blocked goal → stay idle (human must clear)
                 ├─ paused/disarmed + cancel-hold clear → ctx.goals.resume → yield
                 └─ no goal / complete → one monitor inference turn (plugin source)
                              → monitor-owned decide tool → ctx.goals create/none
                              → or report no residual work
                 │
                 └─ armed goal → driver continues until complete | blocked | switch OFF
```

| 单元 | 职责 |
|---|---|
| `dsh-goal-conversation-monitor` | 进程内开关；空闲检查点；程序化 resume；监测 decide 工具；最多一次监测预留；固定推断提示词 |
| `dsh-goal` | 持久目标、阶段、修订、轮次上限（不变） |
| `dsh-tool-goal` | 模型侧 create / update / get；goal round 上的 complete / blocked（不变；create/edit/resume 仍仅直接人工） |
| `dsh-goal-round-driver` | 已武装 goal 的轮次准入与结算（不变） |
| UI / 命令（薄层） | `/auto-dev on\|off\|status` 与发送这些命令的标题栏 utility 开关 |

## 授权与开关

- 打开开关是本策略的人工授权激活边，类似于为续行权威显式执行 `/goal resume`。
- 关闭开关调用 `disarm`，若存在则取消已预留的监测提示，并拒绝进一步推断，直到再次打开。
- `agent/session-start`、在已有 agent 上加载插件，以及监测器卸载都会强制关开关并 disarm，与 goal 激活不持久化一致。
- 开关仅进程本地；持久会话状态从不记录「auto-dev 曾打开」。

## 空闲与推断策略

开关打开时，在每个整 agent 空闲边上：

1. 若有竞争的普通（非监测、非 goal）工作排队，或 agent 非空闲，则不做任何事。
2. 若当前 goal 为 `active` 且已武装，则让位 — 轮次驱动器调度下一条 `<goal_round>`。
3. 若当前 goal 为 `blocked`，则不做任何事（操作者或后续人工轮次必须解除阻塞）。
4. 若当前 goal 为 `active` 但已 disarm，或为 `paused`，且 cancel-hold 已清除，在仍有轮次容量时调用 `ctx.goals.resume`；成功后让位给驱动器。cancel-hold 置位时绝不自动 resume。
5. 若无当前 goal，或 goal 为 `complete`，则预留一次监测推断轮，消息来源为 `MessageSource` `{ kind: 'plugin', plugin: 'goal-conversation-monitor' }`（不伪造 `user` 来源），固定提示词要求：
   - 以对话历史、工具结果与工作区为权威；
   - 仅在仍有具体未完成项目工作时，通过监测器自有 decide 工具创建 goal；
   - 禁止为闲聊或已完成目标发明工作；
   - 若无剩余工作，报告 `none` 且不新建已武装 goal。
6. 推断轮结算后再次进入空闲策略。若 goal 现已武装，由驱动器续跑。若 decide 工具报告 `none`，监测器保持安静，直到之后的人工消息产生新的空闲边（或操作者拨动开关）。

监测轮永不增加 `roundsStarted`。每个 agent 最多一个监测预留。人工消息会使待定监测预留变为陈旧，与驱动器的人工抢占规则一致。

## 失败与停止条件

| 条件 | 行为 |
|---|---|
| 开关关闭 | Disarm；取消监测预留；不再推断 |
| Goal `complete` 且推断未发现残留工作 | 空闲直至人工输入或开关循环 |
| Goal `blocked` | 停止自动工作；保留可见的持久阻塞原因 |
| 取消监测或 goal 轮 | 遵循现有驱动器 pause/disarm 规则；开关可仍为开，但不与故意取消对抗 — 见下方取消细化 |
| 供应商 / 持久化错误 | 驱动器结算不变（block 或 disarm）；无监测重试环 |
| 危险工具调用 | 现有审批 / 权限预设不变 |

**取消细化（已锁定）：** 取消导致 goal 被 pause 或 disarm 之后，监测器不得在下一次空闲边上自动 resume，直到会话中出现新的人工用户消息，或操作者将开关关掉再打开。这样可避免取消被立即撤销。

## 配置

插件配置（仅部署可调项）：

- 不提供会默认打开监测的 cordis 可调项。

**已锁定：** 省略 `defaultOn`。可选后续：仅当测试证明空闲抖动时再加 `inferenceCooldownMs`；首版除「一次预留 + 空推断后等待人工边」外不加冷却。

组合：叶子 / profile 显式挂载；在某 profile 明确加入之前，不启用进最小 headless 默认组合。

## 体验

- 斜杠命令 `/auto-dev on`、`/auto-dev off`、`/auto-dev status`（阶段、开关、当前 goal 摘要）。
- Web：在 `conversation.session.header.utilities` 上放一个开关，通过 `conversation.send` 发送 `/auto-dev on` 或 `/auto-dev off`（与工具箱相同的薄路径）；v1 不新增 Host RPC。
- 除现有 goal 完成收尾外，不另做「项目完成」提示。

## 测试

- 包测使用真实 agent 循环与脚本化模型：开关关则惰性；开关开 + 无残留不建 goal；开关开 + 未完成目标则创建并武装；已武装 goal 让位给驱动器；blocked 不 resume；取消后空闲在人工消息或开关循环前不自动 resume；飞行中关开关会 disarm。
- 无密钥 ACP（或 web-app）快照经真实示例组合：人工开启 auto-dev，对话暗示未完成工作，监测推断创建 goal，自动跑一轮 goal round，模型完成；规范化转录断言来源与生命周期，无需真实 API key。
- 新 `src/` 满足按文件覆盖率门禁；HMR 卸载移除开关服务贡献。

## 曾考虑的替代

- 把推断并入 `goal-round-driver` — 否决；该插件的契约是续跑已授权 goal，不是发明目标。
- 基于 schedule 轮询 `/dev-agent-autonomous` — 否决；不精确、重复 goal 生命周期、完成语义弱。
- 无模型轮的程序化目标抽取 — 推迟；v1 用一次监测推断轮加监测器自有 decide 工具理解对话。

## 已锁定的规划选择

- Web 槽位：`conversation.session.header.utilities`。
- 消息来源：现有 `plugin` kind，plugin id 为 `goal-conversation-monitor`（仅当后续 pre-step 栅栏需要时再声明合并专用 `MessageSourceMap` 键）。
- Goal 发明/恢复权威：开关 + 程序化 / `auto_dev_decide` 工具路径；不扩大 `dsh-tool-goal` 的直接人工证明语义。
