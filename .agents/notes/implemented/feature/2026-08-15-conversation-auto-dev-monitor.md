# Agent Note: Conversation Auto-Dev Monitor

Status: implemented

English | [中文](2026-08-15-conversation-auto-dev-monitor.zh.md)

## Problem

Long-running project work in a DeepSeek Harness Web session often stalls when the human stops prompting: unfinished work remains visible in the conversation and workspace, but nothing rearms a same-session goal unless the human creates one. Operators want an explicit opt-in monitor that keeps developing until the model certifies completion, without forging a `{ kind: 'user' }` attestation that would widen `dsh-tool-goal` human authority, and without inventing a second agent loop beside `goal-round-driver`.

## Decision

Ship `@deepseek-ai/dsh-goal-conversation-monitor` (`ctx.autoDev`) as a Host plugin layered on existing goals and `goal-round-driver`.

### Switch and authority

A process-local per-agent switch defaults off and never persists. `/auto-dev on|off|status` and the Web header toggle (`dsh-client-ui-auto-dev` → `conversation.send`) are the human admission path. Turning the switch on is the authorization for later programmatic `goals.resume` and for `auto_dev_decide` mutations. Session-start, load-over-live-agents, and switch-off force the switch off and disarm process-local activation.

### Idle policy

While the switch is on at whole-agent idle: yield when the inbox has work or the goal is active and armed; skip blocked goals; set cancel-hold on pause while the switch is on and refuse auto-resume until a new `{ kind: 'user' }` message or switch off→on; otherwise resume paused/disarmed goals when capacity remains; when there is no goal or the goal is complete, reserve one monitor inference turn unless quiet-after-`none` is set.

### Inference and invent path

Inference uses `Agent.followup` with MessageSource `{ kind: 'plugin', plugin: 'goal-conversation-monitor' }` and a pre-step fence on that reservation. The model calls `auto_dev_decide` with `create` (non-empty objective → `ctx.goals.create`) or `none` (quiet until human). `dsh-tool-goal` create/edit/resume authority is not widened. Completion still goes through later goal rounds and `update_goal` complete.

### Composition

Mounted in the web-app bundle and an ACP example overlay only — not in `dsh-base`. ACP `session/prompt` admits slash-only lines through `ctx.commands` when that registry is composed (same rule as the Web host).

## Alternatives considered

**New agent loop / schedule polling.** Would duplicate round admission, cancellation, and durability already owned by `goal-round-driver`; rejected in favor of Approach A (monitor over existing goals).

**Forge `{ kind: 'user' }` for invent.** Would satisfy `dsh-tool-goal` create checks but launder human attestation; rejected. Invent stays on `auto_dev_decide` + `ctx.goals.*` while the switch is on.

**Widen `dsh-tool-goal` for plugin sources.** Couples every goal consumer to monitor semantics and weakens the direct-human create/edit/resume invariant; rejected.

**Durable switch / defaultOn.** Conflicts with the product rule that each session must explicitly opt in and that session restart forces off; rejected.

**Mount in `dsh-base`.** Would arm every profile without product consent; rejected for opt-in web/ACP compositions only.

## Consequences

- **No evaluator.** The model decides unfinished work and completion; certification remains self-attested.
- **Cancel-hold after cancel pause.** Automatic resume is blocked until a human user message or switch cycle; operators must re-engage after cancel.
- **Quiet after empty `none`.** A second idle without a human edge does not re-infer.
- **Optimistic header UI.** The toggle mirrors the last successful on/off send; it does not subscribe to a live switch projection.
- **ACP slash admission is composition-dependent.** Without `dsh-commands`, slash-looking text remains an ordinary user message.

## Verification

- Package tests cover switch force-off, idle yield/block/resume/cancel-hold, inference create/none/quiet, `/auto-dev` command, and decide-tool authority.
- Client tests cover header utility registration and `/auto-dev on|off` sends.
- Keyless ACP snapshot `examples/acp-agent/tests/auto-dev.snapshot.ts` invents via plugin-sourced inference after `/auto-dev on` and completes the goal through the assembled app.
- Package READMEs document Model Experience and limitations; web-app mounts Host + Client plugins.
