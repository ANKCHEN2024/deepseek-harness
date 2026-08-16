# @deepseek-ai/dsh-client-ui-auto-dev

[English](README.md) | 中文

会话标题栏工具：通过 `conversation.send` 发送 `/auto-dev on|off`，打开或关闭会话自动开发监测。进程本地开关与空闲策略由 Host 插件 [`@deepseek-ai/dsh-goal-conversation-monitor`](../../goal/goal-conversation-monitor/README.md) 拥有。

## Composition

```yaml
- id: goal-conversation-monitor
  name: '@deepseek-ai/dsh-goal-conversation-monitor'

- id: ui-auto-dev
  name: '@deepseek-ai/dsh-client-ui-auto-dev'
```

槽位：`conversation.session.header.utilities`（id `auto-dev-toggle`，order 35）。

## Known Limitations and Deferred Work

- **仅乐观 UI** — 按钮反映最近一次成功的 on/off 发送；不订阅实时开关投影。会话重启后 Host 开关为关，重新挂载的控件也从关开始。
- **需要 Host 监测器** — 没有 `goal-conversation-monitor` 时，Host 命令注册表无法解析 `/auto-dev`。
