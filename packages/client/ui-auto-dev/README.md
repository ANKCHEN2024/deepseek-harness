# @deepseek-ai/dsh-client-ui-auto-dev

English | [中文](README.zh.md)

Session-header utility that turns conversation auto-dev monitoring on or off by sending `/auto-dev on|off` through `conversation.send`. The Host plugin [`@deepseek-ai/dsh-goal-conversation-monitor`](../../goal/goal-conversation-monitor/README.md) owns the process-local switch and idle policy.

## Composition

```yaml
- id: goal-conversation-monitor
  name: '@deepseek-ai/dsh-goal-conversation-monitor'

- id: ui-auto-dev
  name: '@deepseek-ai/dsh-client-ui-auto-dev'
```

Slot: `conversation.session.header.utilities` (id `auto-dev-toggle`, order 35).

## Known Limitations and Deferred Work

- **Optimistic UI only** — the button mirrors the last successful on/off send; it does not subscribe to a live switch projection. Session restart leaves the host switch off while a remounted control starts off.
- **Requires Host monitor** — without `goal-conversation-monitor`, `/auto-dev` does not resolve on the Host command registry.
