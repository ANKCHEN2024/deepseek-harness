# @deepseek-ai/dsh-goal-conversation-monitor

[English](README.md) | 中文

显式选择加入的会话自动开发监测器，作用于同会话 [`ctx.goals`](../goal/README.md)。进程本地开关打开时，空闲检查点可在不伪造人类 `{ kind: 'user' }` 证明的前提下发明或重新武装 goal；goal 武装后仍由 [`goal-round-driver`](../goal-round-driver/README.md) 拥有顺序 goal round。

## Composition

```yaml
- id: goal
  name: '@deepseek-ai/dsh-goal'

- id: tool-goal
  name: '@deepseek-ai/dsh-tool-goal'

- id: goal-round-driver
  name: '@deepseek-ai/dsh-goal-round-driver'

- id: goal-conversation-monitor
  name: '@deepseek-ai/dsh-goal-conversation-monitor'
```

仅挂载于选择加入的表面（例如 web-app 包与 ACP 示例 overlay）。不要把该行加入 `dsh-base`。本插件没有可调配置；开关默认关闭且永不持久。

## Switch and human command

`ctx.autoDev` 拥有进程本地、按 agent 的开关。`/auto-dev on|off|status`（空输入表示 status）是人类准入路径。打开开关即授权后续程序性的 `goals.resume`，以及 `auto_dev_decide` 对 goal 的变更。session-start、加载覆盖已有 live agent，以及关闭开关，都会强制关闭开关并 disarm 进程本地的 goal 激活。

## Idle policy

开关打开时的整 agent 空闲检查点：

1. 收件箱已有工作，或当前 goal 为 active 且 armed 时让出（round driver 拥有该路径）。
2. goal 为 blocked 时跳过。
3. 开关打开期间若出现 `goal/changed` pause，则设置 cancel-hold；在新的 `{ kind: 'user' }` 消息或开关 off→on 之前拒绝自动 resume。
4. 否则在仍有容量时 resume 处于 paused 或 disarmed 的 goal。
5. 当没有 goal 或 goal 已 complete，且 quiet-after-`none` 已清除时，预约一次监测推断回合。

## Monitor inference and decide tool

推断使用 `Agent.followup`，MessageSource 为 `{ kind: 'plugin', plugin: 'goal-conversation-monitor' }`。pre-step 围栏仅在开关仍打开时接纳该预约消息的 id 与内容。模型必须调用 `auto_dev_decide`，决策为带非空 objective 的 `create`，或 `none`。create 仅在开关打开时调用 `ctx.goals.create`；它不会放宽 `dsh-tool-goal` 的直接人类 create/edit/resume 权限。`none` 之后，quiet-until-human 会抑制进一步推断，直到人类消息或开关循环。发明出的工作的完成仍通过后续 goal round 与普通 goal 工具下的 `update_goal` complete。

## Model Experience

### Auto-dev inference prompt

#### What the model sees

一条保留的用户角色 `<auto_dev_monitor>` 块：指示模型以对话历史、工具结果与工作区为权威；在仍有未完成项目工作时用精确 objective 调用 `auto_dev_decide` 的 `create`；在无剩余工作时调用 `none`；并禁止在该回合调用 `create_goal` 或仅人类可用的 goal 变更。

#### Token effect

每次获准推断增加一块固定指令。后续请求会重发已保留的监测回合，直到 compaction 遮蔽它们。

#### KV Cache effect

在同一 epoch 内仅追加：每次获准推断都在可复用前缀之后延伸现有对话。

### `auto_dev_decide`

#### What the model sees

在 auto-dev 打开时用于报告 create-or-none 的工具。create 需要具体 objective，且当前不能有未完成 goal；none 会标记 quiet-until-human。

#### Token effect

普通工具 schema，加上紧凑 JSON `{ decision, goal }` 结果。发明出的 goal 随后进入与其他武装 goal 相同的 round-driver 提示路径。

#### KV Cache effect

与其他同会话工具回合相同；不另起 agent，也不复制前缀。

## Known Limitations and Deferred Work

- **无独立评估器** — 是否仍有未完成工作、以及后续 goal round 何时可完成，由模型决定；基于评估器的认证仍延后。
- **开关永不持久** — session-start 与进程重启后 auto-dev 始终为关；产品要求每个会话显式打开。
- **发明路径是 decide 工具，不是 tool-goal create** — 监测回合不得伪造 `{ kind: 'user' }`；监测回合中的 `create_goal` 仍由 `dsh-tool-goal` 拒绝。
- **取消 pause 后的 cancel-hold** — 在人类 user 消息或开关 off→on 之前阻止自动 resume；无关的、未 pause 的 disarm 不设置 hold。
- **空 `none` 后的 quiet** — 没有人类边沿时，第二次空闲不会再次推断；这是有意设计，不是缺失的重试策略。
- **未挂载于 `dsh-base`** — 需要监测的部署必须在 web 或示例组合层选择加入。
