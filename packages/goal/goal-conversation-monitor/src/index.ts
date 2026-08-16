/**
 * Conversation-driven auto-dev monitor: process-local switch over same-session goals.
 * @module @deepseek-ai/dsh-goal-conversation-monitor
 */

import { isDeepStrictEqual } from 'node:util'
import { Context, Service } from '@deepseek-ai/cordis'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import type { GoalRef, GoalView } from '@deepseek-ai/dsh-goal'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, MessageId, MessageSource } from '@deepseek-ai/dsh-llm'
import { registerAutoDevDecideTool } from './decide-tool.ts'
import { registerAutoDevCommand } from './command.ts'
import { AUTO_DEV_MONITOR_PLUGIN, renderAutoDevInferencePrompt } from './prompt.ts'
import type { AutoDevMonitor, AutoDevStatus } from './types.ts'

export type { AutoDevMonitor, AutoDevStatus } from './types.ts'
export { AUTO_DEV_MONITOR_PLUGIN, renderAutoDevInferencePrompt } from './prompt.ts'
export type { AutoDevDecideArgs, AutoDevDecideResult } from './decide-tool.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    autoDev: AutoDevMonitorService
  }
}

/** Per-agent process-local switch, holds, and quiet flag. */
interface AgentSwitchState {
  on: boolean
  cancelHold: boolean
  quietUntilHuman: boolean
}

/** One queued or claimed monitor inference reservation. */
interface MonitorAttempt {
  readonly messageId: MessageId
  readonly content: ContentBlock[]
  phase: 'queued' | 'claimed'
  stale: boolean
}

/** Exact current ref for a view. */
function goalRef(goal: GoalView): GoalRef {
  return { id: goal.id, revision: goal.revision }
}

/** Whether a source is this package's monitor inference message. */
function isMonitorSource(source: MessageSource): boolean {
  return source.kind === 'plugin' && source.plugin === AUTO_DEV_MONITOR_PLUGIN
}

/**
 * Auto-dev monitor service (`ctx.autoDev`).
 * Owns the process-local switch, idle resume/inference policy, and decide tool.
 */
export class AutoDevMonitorService extends Service implements AutoDevMonitor {
  static inject = ['agents', 'goals', 'sessions', 'tools', 'commands']

  private readonly switches = new WeakMap<Agent, AgentSwitchState>()
  private readonly attempts = new WeakMap<Agent, MonitorAttempt>()

  /**
   * @param ctx - Cordis context carrying agents, goals, sessions, and tools.
   */
  constructor(ctx: Context) {
    super(ctx, 'autoDev')
    ctx.effect(() => registerAutoDevDecideTool(ctx), 'auto-dev: decide tool')
    ctx.effect(() => registerAutoDevCommand(ctx), 'auto-dev: slash command')
    for (const agent of ctx.agents.list()) {
      this.forceOff(agent)
    }
    ctx.on('agent/session-start', ({ agent }) => {
      this.forceOff(agent)
    })
    ctx.on('agent/status', ({ agent, status }) => {
      if (status === 'idle') this.onIdle(agent)
    })
    ctx.on('goal/changed', ({ agent, change }) => {
      if (!this.isOn(agent)) return
      if (change.operation === 'pause') this.stateFor(agent).cancelHold = true
    })
    ctx.on('agent/inbox/inserted', ({ agent, message }) => {
      if (!this.isOn(agent)) return
      const attempt = this.attempts.get(agent)
      /* v8 ignore next 4 -- own monitor insertion must not mark the reservation stale */
      if (attempt !== undefined && message.id === attempt.messageId
        && isMonitorSource(message.source)
        && isDeepStrictEqual(message.content, attempt.content)) {
        return
      }
      if (message.source.kind === 'user') {
        const state = this.stateFor(agent)
        state.cancelHold = false
        state.quietUntilHuman = false
      }
      if (attempt?.phase === 'queued') attempt.stale = true
      if (agent.status === 'idle') this.onIdle(agent)
    })
    ctx.on('agent/inbox/claimed', ({ agent, message }) => {
      const attempt = this.attempts.get(agent)
      /* v8 ignore next 3 -- claim advances a reserved monitor message to the claimed phase */
      if (attempt !== undefined && message.id === attempt.messageId) {
        attempt.phase = 'claimed'
      }
    })
    /* v8 ignore next 7 -- discard of the reserved monitor message drops the reservation */
    ctx.on('agent/inbox/discarded', ({ agent, message }) => {
      const attempt = this.attempts.get(agent)
      if (attempt !== undefined && message.id === attempt.messageId) {
        this.attempts.delete(agent)
      }
    })
    ctx.on('agent/pre-step', async (payload, next): Promise<PreStepDecision> => {
      const { agent, messages } = payload
      const attempt = this.attempts.get(agent)
      if (attempt === undefined) return next()
      const mine = messages.find(message => message.id === attempt.messageId)
      if (mine === undefined) return next()
      /* v8 ignore next 6 -- stale/off/content mismatch rejects before downstream */
      if (attempt.stale
        || !isMonitorSource(mine.source)
        || !isDeepStrictEqual(mine.content, attempt.content)
        || !this.isOn(agent)) {
        this.attempts.delete(agent)
        return { kind: 'reject' }
      }
      const before = await next()
      /* v8 ignore next 4 -- downstream reject clears the monitor reservation */
      if (before.kind === 'reject') {
        this.attempts.delete(agent)
        return before
      }
      const still = this.attempts.get(agent)
      /* v8 ignore next 4 -- post-next race: switch off or stale reservation after downstream allow */
      if (still === undefined || still.stale || !this.isOn(agent)) {
        this.attempts.delete(agent)
        return { kind: 'reject' }
      }
      return before
    })
  }

  /**
   * Whether the process-local switch is on for this exact live agent.
   * @param agent - exact live agent.
   * @returns true only while the switch is armed for this agent instance.
   */
  isOn(agent: Agent): boolean {
    this.requireLive(agent)
    return this.switches.get(agent)?.on === true
  }

  /**
   * Turn the switch on or off; off disarms goals and clears local armed state.
   * @param agent - exact live agent.
   * @param on - desired armed state.
   */
  setOn(agent: Agent, on: boolean): void {
    this.requireLive(agent)
    if (!on) {
      this.forceOff(agent)
      return
    }
    const state = this.stateFor(agent)
    state.on = true
    state.cancelHold = false
    state.quietUntilHuman = false
    if (agent.status === 'idle') this.onIdle(agent)
  }

  /**
   * Snapshot for `/auto-dev status` and tests.
   * @param agent - exact live agent.
   * @returns switch, cancel-hold, and current goal view.
   */
  status(agent: Agent): AutoDevStatus {
    this.requireLive(agent)
    const state = this.switches.get(agent)
    return {
      on: state?.on === true,
      cancelHold: state?.cancelHold === true,
      goal: this.ctx.goals.get(agent),
    }
  }

  /**
   * After an empty inference (`none`), stay quiet until a human message or switch cycle.
   * @param agent - exact live agent.
   */
  markQuietUntilHuman(agent: Agent): void {
    this.requireLive(agent)
    this.stateFor(agent).quietUntilHuman = true
  }

  /**
   * Idle checkpoint: yield, refuse blocked, resume when allowed, or reserve inference.
   * @param agent - exact live agent that just became idle.
   */
  private onIdle(agent: Agent): void {
    if (this.ctx.agents.get(agent.id) !== agent) return
    if (!this.isOn(agent)) return
    if (agent.status !== 'idle') return

    const attempt = this.attempts.get(agent)
    if (attempt !== undefined) {
      this.attempts.delete(agent)
    }

    if (agent.inbox.nextTurn.length > 0 || agent.inbox.nextStep.length > 0) return

    const goal = this.ctx.goals.get(agent)
    if (goal?.phase === 'blocked') return
    if (goal?.phase === 'active' && goal.activation === 'armed') return

    const state = this.stateFor(agent)
    if (state.cancelHold) return

    if (goal?.phase === 'active' && goal.activation === 'disarmed') {
      this.tryResume(agent, goal)
      return
    }
    if (goal?.phase === 'paused') {
      this.tryResume(agent, goal)
      return
    }

    if (state.quietUntilHuman) return
    if (goal === undefined || goal.phase === 'complete') {
      this.reserveInference(agent)
    }
  }

  /** Queue one monitor inference turn when inventing a goal may be needed. */
  private reserveInference(agent: Agent): void {
    if (this.attempts.get(agent) !== undefined) return
    const content = renderAutoDevInferencePrompt()
    const message = createUserMessage({
      content,
      source: { kind: 'plugin', plugin: AUTO_DEV_MONITOR_PLUGIN },
    })
    const reservation: MonitorAttempt = {
      messageId: message.id,
      content,
      phase: 'queued',
      stale: false,
    }
    this.attempts.set(agent, reservation)
    try {
      agent.followup(message)
    } catch {
      this.attempts.delete(agent)
    }
  }

  /** Resume when round capacity remains; swallow capacity/ref races quietly. */
  private tryResume(agent: Agent, goal: GoalView): void {
    if (goal.roundsStarted >= goal.maxGoalRounds) return
    try {
      this.ctx.goals.resume(agent, goalRef(goal))
    } catch {
      // Stale ref or capacity race: wait for the next idle or human edge.
    }
  }

  /** Force the switch off, disarm goals, and drop a pending monitor reservation. */
  private forceOff(agent: Agent): void {
    const state = this.stateFor(agent)
    state.on = false
    state.cancelHold = false
    state.quietUntilHuman = false
    this.attempts.delete(agent)
    this.ctx.goals.disarm(agent)
  }

  /** Lazy per-agent state bucket. */
  private stateFor(agent: Agent): AgentSwitchState {
    const existing = this.switches.get(agent)
    if (existing !== undefined) return existing
    const created: AgentSwitchState = { on: false, cancelHold: false, quietUntilHuman: false }
    this.switches.set(agent, created)
    return created
  }

  /** Reject callers that pass a retired or foreign agent instance. */
  private requireLive(agent: Agent): void {
    if (this.ctx.agents.get(agent.id) !== agent) {
      throw new TypeError('autoDev requires the exact live agent instance')
    }
  }
}

export default AutoDevMonitorService
