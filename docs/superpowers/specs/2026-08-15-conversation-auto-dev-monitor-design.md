# Design Spec: Conversation-driven auto-dev monitor

English | [中文](2026-08-15-conversation-auto-dev-monitor-design.zh.md)

Status: approved

Related: [Same-session goal-round driver](../../../.agents/notes/implemented/feature/2026-07-19-same-session-goal-round-driver.md), [Persisted same-session goal domain](../../../.agents/notes/implemented/feature/2026-07-19-persisted-same-session-goal-domain.md), [Goal subsystem](../../subsystems/goal.md)

## Problem

Users want an explicit opt-in mode that watches the current product workspace conversation, infers unfinished work, creates or rearms a same-session goal without further confirmation, and keeps developing until the model marks the goal complete or blocked. The existing `goal-round-driver` already continues an armed goal, but nothing may invent or rearm that goal from conversation residuals after the user flips a single switch. Without a dedicated monitor consumer, operators must manually create goals or click toolbox actions for every long-running project push.

## Decision summary

Ship a new policy plugin `@deepseek-ai/dsh-goal-conversation-monitor` that mounts beside `dsh-goal`, `dsh-tool-goal`, and `dsh-goal-round-driver`. An explicit per-agent armed switch (default off, never inherited across session start) is the sole human authority for automatic goal create / edit / resume. While the switch is on and the agent is idle with no competing human work, the monitor either yields to an already active armed goal (driver owns rounds), programmatically resumes a paused/disarmed goal when the cancel-hold is clear, or admits at most one monitor inference turn. Inference must not forge `{ kind: 'user' }` and must not call `create_goal` / `update_goal` create-edit-resume paths (those require direct-human attestation in `dsh-tool-goal`). Instead the monitor owns a model-facing decide tool that mutates `ctx.goals` only while the switch is on. Completion stays model-self-certified via `update_goal complete` on later goal rounds; blocking and existing approval seams stop the loop. Turning the switch off disarms continuation and cancels any in-flight monitor reservation.

## Non-goals

- Monitoring Cursor, VS Code, or any external IDE chat.
- A second completion state machine outside `ctx.goals`.
- Changing `dsh-agent-loop`, or merging this policy into `goal-round-driver`.
- Independent evaluator certification of “done”.
- Always-on monitoring, or persisting the switch across session resume / fork / process restart.
- Auto-resume of a `blocked` goal; auto-retry of provider / durability failures already refused by the driver.
- Parallel goals or multi-agent workspace orchestration.

## Architecture

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

| Unit | Responsibility |
|---|---|
| `dsh-goal-conversation-monitor` | Process-local switch; idle checkpoint; programmatic resume; monitor decide tool; at most one monitor reservation; fixed inference prompt |
| `dsh-goal` | Durable objective, phase, revision, round cap (unchanged) |
| `dsh-tool-goal` | Model-facing create / update / get; complete / blocked on goal rounds (unchanged; create/edit/resume stay direct-human) |
| `dsh-goal-round-driver` | Armed-goal round admission and settlement (unchanged) |
| UI / command (thin) | `/auto-dev on\|off\|status` and a header utility toggle that sends those commands |

## Authority and switch

- Opening the switch is the human-authorized activation edge for this policy, analogous to an explicit `/goal resume` for continuation authority.
- Closing the switch calls `disarm`, cancels a reserved monitor prompt if present, and refuses further inference until opened again.
- `agent/session-start`, plugin load over live agents, and monitor teardown force the switch off and disarm, matching goal activation non-persistence.
- The switch is process-local only; durable session state never records “auto-dev was on”.

## Idle and inference policy

At each whole-agent idle edge while the switch is on:

1. If competing ordinary (non-monitor, non-goal) work is queued or the agent is not idle, do nothing.
2. If the current goal is `active` and armed, yield — the round driver schedules the next `<goal_round>`.
3. If the current goal is `blocked`, do nothing (operator or later human turn must unblock).
4. If the current goal is `active` but disarmed, or `paused`, and the cancel-hold is clear, call `ctx.goals.resume` when round capacity remains; on success, yield to the driver. Never auto-resume while the cancel-hold is set.
5. If there is no current goal, or the goal is `complete`, reserve one monitor inference turn with `MessageSource` `{ kind: 'plugin', plugin: 'goal-conversation-monitor' }` (no forged `user` source) and a fixed prompt that:
   - treats conversation history, tool results, and the workspace as authoritative;
   - requires the monitor-owned decide tool to create a goal only when concrete unfinished project work remains;
   - forbids inventing work for routine chatter or already-completed objectives;
   - when nothing remains, reports `none` and leaves no new armed goal.
6. After an inference turn settles, re-enter the idle policy. If a goal is now armed, the driver continues. If the decide tool reported `none`, the monitor stays quiet until a later human message produces a new idle edge (or the operator toggles the switch).

Monitor turns never increment `roundsStarted`. At most one monitor reservation exists per agent. Human messages make a pending monitor reservation stale, matching the driver’s human-preemption rules.

## Failure and stop conditions

| Condition | Behavior |
|---|---|
| Switch off | Disarm; cancel monitor reservation; no further inference |
| Goal `complete` and inference finds no residual work | Idle until human input or switch cycle |
| Goal `blocked` | Stop automatic work; leave durable blocker visible |
| Cancellation of a monitor or goal round | Follow existing driver pause/disarm rules; switch stays on but does not fight an intentional cancel — next idle may resume only if still armed or policy step 4 applies after human re-engagement; prefer: after cancel-induced pause, do not auto-resume until a human message or explicit switch off/on |
| Provider / durability errors | Unchanged driver settlement (block or disarm); no monitor retry loop |
| Dangerous tool calls | Existing approval / permission presets unchanged |

**Cancel refinement (locked):** after a cancellation pauses or disarms a goal, the monitor must not auto-resume on the next idle edge until either a new human user message arrives in the session or the operator turns the switch off and on again. This prevents cancel from being immediately undone.

## Configuration

Plugin config (deployment tunables only):

- `defaultOn`: always `false` in shipped compositions; if a deployment sets true, session-start still forces off unless a future explicit product decision reverses non-persistence (out of scope — ship with force-off on session-start regardless of `defaultOn`, and treat `defaultOn` as “initial value only for brand-new agents before first session-start” or omit entirely).

**Locked:** omit `defaultOn`. The plugin has no cordis tunable that enables monitoring by default. Optional later: `inferenceCooldownMs` only if tests prove idle thrash; start with no cooldown beyond “one reservation + wait for human edge after empty inference”.

Composition: opt-in leaf / profile mount; not enabled in minimal headless defaults until a profile explicitly adds it.

## UX

- Slash command `/auto-dev on`, `/auto-dev off`, `/auto-dev status` (phase, switch, current goal summary).
- Web: one toggle in `conversation.session.header.utilities` that sends `/auto-dev on` or `/auto-dev off` through `conversation.send` (same thin path as the toolbox); no new Host RPC for v1.
- No separate “project complete” toast beyond existing goal complete wrap-up.

## Testing

- Package tests with the real agent loop and scripted model: switch off is inert; switch on + empty residual does not create a goal; switch on + unfinished objective creates and arms; armed goal yields to the driver; blocked does not resume; cancel then idle does not auto-resume until human message or switch cycle; switch off mid-flight disarms.
- Keyless ACP (or web-app) snapshot through a real example composition: human enables auto-dev, conversation implies unfinished work, monitor inference creates a goal, one automatic goal round runs, model completes; normalized transcript asserts sources and lifecycle without a live API key.
- Per-file coverage gate on new `src/`; HMR disposal removes the switch service contribution.

## Alternatives considered

- Fold inference into `goal-round-driver` — rejected; that plugin’s contract is continuation of an already-authorized goal, not invention of objectives.
- Schedule-based `/dev-agent-autonomous` polling — rejected; imprecise, duplicates goal lifecycle, weak completion semantics.
- Programmatic objective extraction without a model turn — deferred; conversation understanding uses one monitor inference turn plus the monitor-owned decide tool for v1.

## Locked planning choices

- Web slot: `conversation.session.header.utilities`.
- Message source: existing `plugin` kind with plugin id `goal-conversation-monitor` (dedicated `MessageSourceMap` key only if a later pre-step fence requires it).
- Goal invent/resume authority: switch + programmatic/`auto_dev_decide` tool path; do not widen `dsh-tool-goal` direct-human attestation.
