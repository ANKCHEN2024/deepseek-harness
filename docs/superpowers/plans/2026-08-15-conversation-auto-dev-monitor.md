# Conversation Auto-Dev Monitor Implementation Plan

English | [中文](2026-08-15-conversation-auto-dev-monitor.zh.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an explicit opt-in conversation monitor that infers unfinished workspace work, creates or rearms same-session goals without forging human attestation, and yields to `goal-round-driver` until the model completes or blocks.

**Architecture:** New Host plugin `@deepseek-ai/dsh-goal-conversation-monitor` owns a process-local per-agent switch, cancel-hold, idle policy, monitor inference reservation (`plugin` MessageSource), and `auto_dev_decide` tool that mutates `ctx.goals` only while the switch is on. `/auto-dev` lives in the same package. Web toggle sends slash commands through `conversation.send` from `conversation.session.header.utilities`. Mount only in web-app + an ACP example overlay (not `dsh-base`).

**Tech Stack:** Cordis plugins, `dsh-goal` / `dsh-agent` / `dsh-tools`, Vitest + agent-loop-testkit, ACP keyless snapshots, React CSS Modules client plugin.

**Spec:** [docs/superpowers/specs/2026-08-15-conversation-auto-dev-monitor-design.md](../specs/2026-08-15-conversation-auto-dev-monitor-design.md)

## Global Constraints

- Never forge `{ kind: 'user' }` for monitor turns; use `{ kind: 'plugin', plugin: 'goal-conversation-monitor' }`.
- Do not widen `dsh-tool-goal` direct-human create/edit/resume authority; invent via `auto_dev_decide` + `ctx.goals.*` only while switch is on.
- Do not modify `dsh-agent-loop` or fold policy into `goal-round-driver`.
- Switch defaults off; force off on `agent/session-start`, load-over-live-agents, and teardown; never persist the switch.
- After cancel pause/disarm, set cancel-hold until a new `{ kind: 'user' }` message or switch off→on.
- No cordis `defaultOn` tunable.
- Not mounted in `packages/bundle/base`; mount in web-app + ACP example only.
- Windows shell: do not chain with `&&`; run commands separately.
- Commit only when the user asks.
- Product UI copy Chinese; code comments English; files end with one trailing newline.
- Non-trivial change requires an Agent Note triplet in the same PR.

## File map

| Path | Role |
|---|---|
| `packages/goal/goal-conversation-monitor/` | Switch service, idle policy, prompt, decide tool, `/auto-dev`, invariant |
| `packages/client/ui-auto-dev/` | Header utility toggle sending `/auto-dev on\|off` |
| `packages/bundle/web-app/cordis.patch.yml` + `package.json` | Mount Host + Client plugins |
| `examples/acp-agent/auto-dev.cordis.yml` + snapshot fixtures | Keyless ACP snapshot |
| `packages/goal/README.md` | Group table row |
| `.agents/notes/implemented/feature/2026-08-15-conversation-auto-dev-monitor.*` | Decision record |
| `docs/subsystems/goal.md` (+ zh/i18n) | Link to monitor consumer if types surface |
| `tsconfig.host.json` / `tsconfig.client.json` | Aggregate references |

---

### Task 1: Package scaffold + switch service

**Files:**
- Create: `packages/goal/goal-conversation-monitor/package.json`
- Create: `packages/goal/goal-conversation-monitor/tsconfig.json`
- Create: `packages/goal/goal-conversation-monitor/src/index.ts`
- Create: `packages/goal/goal-conversation-monitor/src/invariant.ts`
- Create: `packages/goal/goal-conversation-monitor/src/types.ts`
- Create: `packages/goal/goal-conversation-monitor/tests/switch.spec.ts`
- Modify: `tsconfig.host.json` (add reference)
- Modify: `packages/goal/README.md` (+ zh)

**Interfaces:**
- Produces: Cordis service `autoDev` (`ctx.autoDev`) with:

```ts
interface AutoDevMonitor {
  /** Whether the process-local switch is on for this exact live agent. */
  isOn(agent: Agent): boolean
  /** Turn the switch on or off; off disarms goals and cancels monitor work. */
  setOn(agent: Agent, on: boolean): void
  /** Snapshot for `/auto-dev status` and tests. */
  status(agent: Agent): {
    readonly on: boolean
    readonly cancelHold: boolean
    readonly goal: GoalView | undefined
  }
}
```

- [ ] **Step 1: Write the failing switch tests**

```ts
// packages/goal/goal-conversation-monitor/tests/switch.spec.ts
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import GoalService from '@deepseek-ai/dsh-goal'
import { SessionId } from '@deepseek-ai/dsh-session'
import * as monitor from '../src/index.ts'

const contexts: Context[] = []
afterEach(async () => {
  await Promise.allSettled(contexts.splice(0).map(c => c.fiber.dispose()))
})

async function harness() {
  const ctx = new Context()
  contexts.push(ctx)
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(GoalService)
  await ctx.plugin(monitor)
  await ctx.plugin(AgentLoop, { agents: [] })
  const agent = ctx.agentLoop.create(SessionId(`auto-dev-${Math.random()}`), {
    provider: 'mock',
    model: 'mock',
  })
  return { ctx, agent }
}

describe('autoDev switch', () => {
  it('defaults off and does not persist across session-start', async () => {
    const { ctx, agent } = await harness()
    expect(ctx.autoDev.isOn(agent)).toBe(false)
    ctx.autoDev.setOn(agent, true)
    expect(ctx.autoDev.isOn(agent)).toBe(true)
    // Fire the same session-start edge the goal domain uses; expect forced off.
    ctx.emit(agent.session, 'agent/session-start', { agent })
    expect(ctx.autoDev.isOn(agent)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect fail (no `ctx.autoDev`)**

Run: `pnpm exec vitest run packages/goal/goal-conversation-monitor/tests/switch.spec.ts`

Expected: FAIL resolving `autoDev` / module missing.

- [ ] **Step 3: Scaffold package + minimal service**

Mirror `goal-round-driver` package.json peers (`agents`, `goals`, `sessions`, `commands` later). Export `name = 'goal-conversation-monitor'`, `inject = ['agents', 'goals', 'sessions']`, default-export or Service class registering `ctx.autoDev` via `ctx.effect`. Force `setOn(false)` on session-start and when applying over live agents. `invariant.ts`: empty companion with a package-specific `No runtime invariant:` reason naming that the switch is process-local and durable relations stay in goal/session folds.

- [ ] **Step 4: Re-run switch tests — expect PASS**

- [ ] **Step 5: Register `tsconfig.host.json` reference; update group README table**

---

### Task 2: Idle policy — yield, block, programmatic resume, cancel-hold

**Files:**
- Modify: `packages/goal/goal-conversation-monitor/src/index.ts`
- Create: `packages/goal/goal-conversation-monitor/tests/idle-policy.spec.ts`

**Interfaces:**
- Consumes: `ctx.autoDev`, `ctx.goals`, agent idle/status events (same pattern as `goal-round-driver` idle checkpoint)
- Produces: cancel-hold flag; programmatic `goals.resume` when policy step 4 applies; no inference yet

- [ ] **Step 1: Write failing idle-policy tests**

Cases (scripted adapter optional here — prefer direct goal mutations + idle emission):

1. Switch off + idle → no resume even if paused goal exists.
2. Switch on + active armed → monitor does not call resume (yield; driver owns).
3. Switch on + blocked → no resume.
4. Switch on + paused + no cancel-hold → `resume` → armed.
5. After `agent.cancel` on a goal attempt path: set cancel-hold; idle must not resume; human `{ kind: 'user' }` followup clears hold; next idle may resume.
6. Switch off→on clears cancel-hold.

Study `packages/goal/goal-round-driver/src/index.ts` for idle listening and cancellation; reuse the same public agent events, do not import driver internals.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement idle checkpoint without inference**

On idle while `isOn`: apply spec steps 1–4 only. Track cancel-hold per agent. On switch off: `goals.disarm(agent)`, clear reservation (none yet), keep switch false.

- [ ] **Step 4: Run — expect PASS**

---

### Task 3: Inference prompt + `auto_dev_decide` tool + reservation

**Files:**
- Create: `packages/goal/goal-conversation-monitor/src/prompt.ts`
- Create: `packages/goal/goal-conversation-monitor/src/decide-tool.ts`
- Modify: `packages/goal/goal-conversation-monitor/src/index.ts`
- Modify: `packages/goal/goal-conversation-monitor/package.json` (peer `dsh-tools`)
- Create: `packages/goal/goal-conversation-monitor/tests/inference.spec.ts`

**Interfaces:**
- Produces:

```ts
/** Fixed monitor inference body for Agent.followup. */
function renderAutoDevInferencePrompt(): ContentBlock[]

/** Tool name exactly `auto_dev_decide`. */
type AutoDevDecideArgs = {
  readonly decision: 'create' | 'none'
  /** Required non-empty when decision is create. */
  readonly objective?: string
}
```

- Message source exactly: `{ kind: 'plugin', plugin: 'goal-conversation-monitor' }`
- Tool execute: reject if switch off; on `create` call `ctx.goals.create(agent, { objective })` (or edit when replacing complete); on `none` no-op; return compact JSON `{ decision, goal }`

- [ ] **Step 1: Write failing inference tests** (real loop + ScriptedAdapter like goal-round-driver)

1. Switch on, no goal, model calls `auto_dev_decide` create → goal armed; next idle yields to driver (mount driver in harness).
2. Switch on, model calls `none` → no goal; second idle without new human message does not re-infer (quiet until human edge).
3. Pending monitor reservation + human followup → reservation stale / not admitted as mixed batch.
4. `create_goal` during monitor turn still rejected by tool-goal (authority regression guard).

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement prompt, tool registration, reservation + pre-step fence**

Fence only the monitor’s own queued message id/content (mirror driver stale checks lightly). After settle, re-enter idle policy. After empty `none`, set `quietUntilHuman = true` cleared by next user message or switch cycle.

- [ ] **Step 4: Run — expect PASS**

---

### Task 4: `/auto-dev` command

**Files:**
- Create: `packages/goal/goal-conversation-monitor/src/command.ts`
- Modify: `packages/goal/goal-conversation-monitor/src/index.ts` (`inject` add `commands`)
- Create: `packages/goal/goal-conversation-monitor/tests/command.spec.ts`

**Interfaces:**
- Register slash command `auto-dev` with raw input `on` | `off` | `status` | empty→status

```text
Usage: /auto-dev [on|off|status]
```

- [ ] **Step 1: Failing command tests** (pattern from `command-goal`)

- [ ] **Step 2: Implement `command.ts` + register in `apply`**

- [ ] **Step 3: Tests PASS**

---

### Task 5: Package README + Model Experience + limitations

**Files:**
- Create: `packages/goal/goal-conversation-monitor/README.md` (+ zh + i18n)
- Ensure Known Limitations section covers: no evaluator; switch not durable; invent path is decide-tool not tool-goal create; cancel-hold semantics

- [ ] **Step 1: Write bilingual README following goal-round-driver Model Experience sections for the inference prompt and decide tool**

- [ ] **Step 2: `pnpm run verify-translation-pairing --write packages/goal/goal-conversation-monitor/README.md`**

---

### Task 6: Web-app composition mount (Host only first)

**Files:**
- Modify: `packages/bundle/web-app/package.json` (dependency)
- Modify: `packages/bundle/web-app/cordis.patch.yml` (insert `goal-conversation-monitor` after `goal-round-driver`)
- Modify: `apps/cli/composition.md` if the web profile graph lists plugins

- [ ] **Step 1: Add patch row**

```yaml
- id: goal-conversation-monitor
  name: '@deepseek-ai/dsh-goal-conversation-monitor'
```

- [ ] **Step 2: `pnpm install` then `pnpm run verify-cordis-config` (or the scoped gate used by doc-sync for compositions)**

Do **not** add to `packages/bundle/base`.

---

### Task 7: Keyless ACP snapshot

**Files:**
- Create: `examples/acp-agent/auto-dev.cordis.yml` (include base ACP + insert monitor + tool-goal + goal-round-driver if not already present)
- Create: `examples/acp-agent/tests/auto-dev-snapshots/...` fixtures
- Create: `examples/acp-agent/tests/auto-dev.snapshot.ts`
- Modify: `examples/package.json` if new deps needed

**Scenario:**
1. Human: `/auto-dev on` plus a message stating unfinished concrete work (or enable then send work description).
2. Scripted/replay model: first turn `auto_dev_decide` create; second goal round completes via `update_goal`.
3. Assert session JSONL: plugin-sourced inference message, `goal/change` create, goal-sourced round, complete; switch never appears as durable state.

- [ ] **Step 1: Author snapshot test skeleton following `examples/acp-agent/tests/ports.snapshot.ts`**

- [ ] **Step 2: Record expected outputs with the repo’s snapshot record path when needed; commit fixtures that replay keyless on macOS/Linux**

- [ ] **Step 3: `pnpm run test:snapshot -t auto-dev` (or the filter name chosen) — PASS**

---

### Task 8: Client header toggle

**Files:**
- Create: `packages/client/ui-auto-dev/` (package.json, tsconfig, tsdown, src/index.ts, src/client/*, invariant, README pair)
- Create: `AutoDevToggle.tsx` + locales + CSS module
- Modify: `tsconfig.client.json`
- Modify: `packages/bundle/web-app/cordis.patch.yml` (`dsh.client` row) + `package.json`

**Interfaces:**
- Slot: `conversation.session.header.utilities`
- Inject: `conversation.send('/auto-dev on')` / `off` via session scope (copy ui-dev-workflow send pattern)
- Optimistic local UI state is acceptable; authoritative status comes from command result text if shown, or next `/auto-dev status` — v1 may toggle by sending on/off only without live mirror

- [ ] **Step 1: Failing client spec (`// @vitest-environment jsdom`) asserting button sends the right slash text**

- [ ] **Step 2: Implement plugin + styles using `--dsw-*` tokens**

- [ ] **Step 3: `pnpm run test:gui` covering the new package — PASS**

---

### Task 9: Agent Note + catalog/docs touch-ups

**Files:**
- Create: `.agents/notes/implemented/feature/2026-08-15-conversation-auto-dev-monitor.md` (+ zh + i18n)
- Update: `docs/subsystems/goal.md` (+ zh) with a short “consumers” pointer to the monitor (no new types unless exported)
- Run: scoped `doc-sync` pieces that cover new packages (tool-catalog if decide tool appears, config-catalog, module-graph)

- [ ] **Step 1: Write Agent Note (problem, decision, alternatives, consequences, testing)**

- [ ] **Step 2: Pair + `verify-translation-pairing --write` for note and subsystem edits**

- [ ] **Step 3: `pnpm run test:coverage -- packages/goal/goal-conversation-monitor` and client coverage for ui-auto-dev — 100% on `src/`**

---

## Spec coverage checklist

| Spec requirement | Task |
|---|---|
| Explicit switch, force-off on session-start | 1 |
| Idle yield / block / programmatic resume / cancel-hold | 2 |
| Plugin-sourced inference + decide tool (no forged user) | 3 |
| `/auto-dev` command | 4 |
| Opt-in composition (not base) | 6 |
| Keyless snapshot | 7 |
| Header utilities toggle via send | 8 |
| Agent Note + docs | 5, 9 |
| No tool-goal authority widen | 3 regression test |

## Placeholder / consistency self-review

- No TBD left in tasks; open planning choices locked in the approved spec.
- Service name `autoDev` / plugin id `goal-conversation-monitor` / tool `auto_dev_decide` / command `auto-dev` used consistently.
- Quiet-after-`none` is the concrete mechanism for “stay quiet until human edge”.
