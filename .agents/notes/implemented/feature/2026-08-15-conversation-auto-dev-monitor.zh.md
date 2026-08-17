# Agent Note: 会话自动开发监测器

Status: implemented

[English](2026-08-15-conversation-auto-dev-monitor.md) | 中文

## Problem

DeepSeek Harness Web 会话中的长期项目工作，常在人类停止继续提问后停滞：对话与工作区仍可见未完成工作，但除非人类创建 goal，否则不会重新武装同会话 goal。运维希望有一个显式选择加入的监测器，持续开发直到模型证明完成，同时不伪造会放宽 `dsh-tool-goal` 人类权限的 `{ kind: 'user' }` 证明，也不在 `goal-round-driver` 之外另造第二套 agent 循环。

## Decision

交付 `@deepseek-ai/dsh-goal-conversation-monitor`（`ctx.autoDev`），作为叠在既有 goals 与 `goal-round-driver` 之上的 Host 插件。

### Switch and authority

进程本地、按 agent 的开关默认关闭且永不持久。`/auto-dev on|off|status` 与 Web 标题栏开关（`dsh-client-ui-auto-dev` → `conversation.send`）是人类准入路径。打开开关即授权后续程序性的 `goals.resume`，以及 `auto_dev_decide` 变更。session-start、加载覆盖已有 live agent，以及关闭开关，都会强制关闭并 disarm 进程本地激活。

### Idle policy

开关打开时的整 agent 空闲：收件箱有工作或 goal 为 active 且 armed 时让出；blocked 则跳过；开关打开期间的 pause 设置 cancel-hold，在新的 `{ kind: 'user' }` 消息或开关 off→on 之前拒绝自动 resume；否则在仍有容量时 resume paused/disarmed goal；没有 goal 或 goal 已 complete 时，除非 quiet-after-`none`，否则预约一次监测推断。

### Inference and invent path

推断使用 `Agent.followup`，MessageSource 为 `{ kind: 'plugin', plugin: 'goal-conversation-monitor' }`，并对该预约做 pre-step 围栏。模型调用 `auto_dev_decide`：`create`（非空 objective → `ctx.goals.create`）或 `none`（quiet until human）。不放宽 `dsh-tool-goal` 的 create/edit/resume 权限。完成仍通过后续 goal round 与 `update_goal` complete。

### Composition

仅挂载于 web-app 包与 ACP 示例 overlay，不进入 `dsh-base`。当组合挂载了 `dsh-commands` 时，ACP `session/prompt` 将纯斜杠命令行经该注册表准入（与 Web 宿主相同）。

## Alternatives considered

**新的 agent 循环 / 定时轮询。** 会重复 `goal-round-driver` 已拥有的 round 准入、取消与持久性；拒绝，采用方案 A（叠在既有 goals 上的监测器）。

**为发明伪造 `{ kind: 'user' }`。** 可通过 `dsh-tool-goal` 的 create 检查，但会洗白人类证明；拒绝。发明保留在开关打开时的 `auto_dev_decide` + `ctx.goals.*`。

**为 plugin 源放宽 `dsh-tool-goal`。** 把监测语义耦合进每个 goal 消费者，并削弱直接人类 create/edit/resume 不变量；拒绝。

**持久开关 / defaultOn。** 与「每会话必须显式选择加入、session 重启强制关闭」冲突；拒绝。

**挂入 `dsh-base`。** 会在未获产品同意时武装所有 profile；拒绝，仅 opt-in 的 web/ACP 组合。

## Consequences

- **无评估器。** 未完成工作与完成由模型决定；认证仍为自我证明。
- **取消 pause 后的 cancel-hold。** 在人类 user 消息或开关循环之前阻止自动 resume。
- **空 `none` 后的 quiet。** 没有人类边沿时，第二次空闲不会再次推断。
- **乐观标题栏 UI。** 开关反映最近一次成功的 on/off 发送；不订阅实时开关投影。
- **ACP 斜杠准入依赖组合。** 没有 `dsh-commands` 时，看起来像斜杠的文本仍是普通用户消息。

## Verification

- 包测试覆盖开关强制关闭、空闲让出/阻塞/resume/cancel-hold、推断 create/none/quiet、`/auto-dev` 命令，以及 decide 工具权限。
- 客户端测试覆盖标题栏工具注册与 `/auto-dev on|off` 发送。
- 无密钥 ACP 快照 `examples/acp-agent/tests/auto-dev.snapshot.ts` 在 `/auto-dev on` 后经由 plugin 源推断发明 goal，并在组装应用中完成。
- 包 README 记录 Model Experience 与限制；web-app 挂载 Host + Client 插件。
