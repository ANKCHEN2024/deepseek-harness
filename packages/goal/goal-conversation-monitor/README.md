# @deepseek-ai/dsh-goal-conversation-monitor

English | [中文](README.zh.md)

Explicit opt-in conversation auto-dev monitor over same-session [`ctx.goals`](../goal/README.md). While the process-local switch is on, idle checkpoints may invent or rearm goals without forging a human `{ kind: 'user' }` attestation; [`goal-round-driver`](../goal-round-driver/README.md) still owns sequential goal rounds after a goal is armed.

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

Mount only in surfaces that opt in (for example the web-app bundle and an ACP example overlay). Do not add this row to `dsh-base`. The plugin has no tunable configuration; the switch defaults off and is never durable.

## Switch and human command

`ctx.autoDev` owns a process-local per-agent switch. `/auto-dev on|off|status` (empty input means status) is the human admission path. Turning the switch on is the authorization for later programmatic `goals.resume` and for `auto_dev_decide` mutations. Session-start, load-over-live-agents, and switch-off force the switch off and disarm process-local goal activation.

## Idle policy

At whole-agent idle while the switch is on:

1. Yield when the inbox already has work, or when the current goal is active and armed (the round driver owns that path).
2. Skip when the goal is blocked.
3. Set cancel-hold on a `goal/changed` pause while the switch is on; refuse auto-resume until a new `{ kind: 'user' }` message or a switch off→on cycle.
4. Otherwise resume a paused or disarmed goal when capacity remains.
5. When there is no goal or the goal is complete, and quiet-after-`none` is clear, reserve one monitor inference turn.

## Monitor inference and decide tool

Inference uses `Agent.followup` with MessageSource `{ kind: 'plugin', plugin: 'goal-conversation-monitor' }`. A pre-step fence admits only that reserved message id and content while the switch remains on. The model must call `auto_dev_decide` with `create` (non-empty objective) or `none`. Create calls `ctx.goals.create` only while the switch is on; it does not widen `dsh-tool-goal` direct-human create/edit/resume. After `none`, quiet-until-human suppresses further inference until a human message or switch cycle. Completion of invented work still goes through later goal rounds and `update_goal` complete under ordinary goal tools.

## Model Experience

### Auto-dev inference prompt

#### What the model sees

One retained user-role `<auto_dev_monitor>` block instructing the model to treat conversation history, tool results, and the workspace as authoritative; to call `auto_dev_decide` with `create` plus a precise objective when unfinished project work remains; to call `none` when nothing remains; and not to call `create_goal` or human-only goal mutations on that turn.

#### Token effect

One fixed instruction block per admitted inference. Later requests resend retained monitor turns until compaction shadows them.

#### KV Cache effect

Append-only within an epoch: each admitted inference extends the existing conversation after its reusable prefix.

### `auto_dev_decide`

#### What the model sees

A tool that reports create-or-none for remaining work while auto-dev is switched on. Create requires a concrete objective and no incomplete current goal; none marks quiet-until-human.

#### Token effect

Ordinary tool schema plus compact JSON `{ decision, goal }` results. Invented goals then enter the round-driver prompt path like any other armed goal.

#### KV Cache effect

Same as other same-session tool turns; no separate agent or copied prefix.

## Known Limitations and Deferred Work

- **No independent evaluator** — the model decides whether unfinished work remains and when a later goal round may complete; evaluator-backed certification remains deferred.
- **Switch is never durable** — session-start and process restart always leave auto-dev off; the product requires an explicit on each session.
- **Invent path is decide-tool, not tool-goal create** — monitor turns must not forge `{ kind: 'user' }`; `create_goal` during a monitor turn remains rejected by `dsh-tool-goal`.
- **Cancel-hold after cancel pause** — automatic resume is blocked until a human user message or switch off→on; unrelated disarms without pause do not set the hold.
- **Quiet after empty `none`** — a second idle without a human edge does not re-infer; this is intentional, not a missing retry policy.
- **Not mounted in `dsh-base`** — deployments that want monitoring must opt in at the web or example composition layer.
