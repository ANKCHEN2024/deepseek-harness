import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import GoalService from '@deepseek-ai/dsh-goal'
import type { GoalView } from '@deepseek-ai/dsh-goal'
import { createUserMessage, LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import AutoDevMonitorService from '../src/index.ts'
import * as goalDriver from '@deepseek-ai/dsh-goal-round-driver'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.allSettled(contexts.splice(0).map(c => c.fiber.dispose()))
})

class ScriptedAdapter extends LlmAdapter {
  constructor(private readonly script: Array<StreamChunk[] | 'hang'>) {
    super()
  }

  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const entry = this.script.shift()
    if (entry === undefined) throw new Error('ScriptedAdapter: script exhausted')
    if (entry === 'hang') {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: 'partial' }
      await new Promise<void>((_resolve, reject) => {
        if (options.signal?.aborted) {
          reject(new Error('aborted'))
          return
        }
        options.signal?.addEventListener('abort', () => { reject(new Error('aborted')) }, { once: true })
      })
      return
    }
    for (const chunk of entry) yield chunk
  }
}

function textResponse(text: string): StreamChunk[] {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

async function harness(options: {
  readonly withDriver?: boolean
  readonly script?: Array<StreamChunk[] | 'hang'>
} = {}) {
  const ctx = new Context()
  contexts.push(ctx)
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(CommandRuntime)
  await ctx.plugin(GoalService)
  await ctx.plugin(AutoDevMonitorService)
  if (options.withDriver) await ctx.plugin(goalDriver)
  await ctx.plugin(AgentLoop, { agents: [] })
  if (options.script !== undefined) {
    ctx.llm.registerAdapter(['mock'], new ScriptedAdapter(options.script))
  }
  const agent = ctx.agentLoop.create(SessionId(`auto-dev-idle-${Math.random()}`), {
    provider: 'mock',
    model: 'mock',
  })
  return { ctx, agent }
}

async function waitForGoal(
  ctx: Context,
  agent: Agent,
  predicate: (goal: GoalView | undefined) => boolean,
): Promise<GoalView | undefined> {
  return vi.waitFor(() => {
    const goal = ctx.goals.get(agent)
    expect(predicate(goal)).toBe(true)
    return goal
  })
}

describe('autoDev idle policy', () => {
  it('does not resume a paused goal while the switch is off', async () => {
    const { ctx, agent } = await harness()
    const created = ctx.goals.create(agent, { objective: 'stay paused' })
    ctx.goals.pause(agent, created)
    expect(ctx.goals.get(agent)?.phase).toBe('paused')
    await agent.whenIdle()
    await new Promise((resolve) => { setImmediate(resolve) })
    expect(ctx.goals.get(agent)).toMatchObject({ phase: 'paused', activation: 'disarmed' })
  })

  it('yields when the goal is already active and armed', async () => {
    const { ctx, agent } = await harness()
    const created = ctx.goals.create(agent, { objective: 'already armed' })
    expect(created.activation).toBe('armed')
    ctx.autoDev.setOn(agent, true)
    const resume = vi.spyOn(ctx.goals, 'resume')
    await agent.whenIdle()
    await new Promise((resolve) => { setImmediate(resolve) })
    expect(resume).not.toHaveBeenCalled()
    expect(ctx.goals.get(agent)?.activation).toBe('armed')
  })

  it('does not resume a blocked goal', async () => {
    const { ctx, agent } = await harness()
    const created = ctx.goals.create(agent, { objective: 'blocked work' })
    ctx.goals.block(agent, created, { code: 'need-human', message: 'need a decision' })
    ctx.autoDev.setOn(agent, true)
    await agent.whenIdle()
    await new Promise((resolve) => { setImmediate(resolve) })
    expect(ctx.goals.get(agent)?.phase).toBe('blocked')
  })

  it('resumes a paused goal when the switch is on and cancel-hold is clear', async () => {
    const { ctx, agent } = await harness()
    const created = ctx.goals.create(agent, { objective: 'resume me' })
    ctx.goals.pause(agent, created)
    // Pausing while off must not arm cancel-hold for a later switch-on.
    ctx.autoDev.setOn(agent, true)
    expect(ctx.autoDev.status(agent).cancelHold).toBe(false)
    await agent.whenIdle()
    await waitForGoal(ctx, agent, goal => goal?.phase === 'active' && goal.activation === 'armed')
  })

  it('sets cancel-hold after cancel pauses a goal and clears it on human input', async () => {
    const { ctx, agent } = await harness({
      withDriver: true,
      script: ['hang', textResponse('ack'), textResponse('after resume')],
    })
    ctx.goals.create(agent, { objective: 'cancel me', maxGoalRounds: 4 })
    ctx.autoDev.setOn(agent, true)
    await vi.waitFor(() => { expect(agent.status).toBe('running') })
    agent.cancel('user')
    await agent.whenIdle()
    await waitForGoal(ctx, agent, goal => goal?.phase === 'paused')
    expect(ctx.autoDev.status(agent).cancelHold).toBe(true)

    await agent.whenIdle()
    await new Promise((resolve) => { setImmediate(resolve) })
    expect(ctx.goals.get(agent)?.phase).toBe('paused')

    agent.followup(createUserMessage({
      content: [{ type: 'text', text: 'continue please' }],
      source: { kind: 'user' },
    }))
    await agent.whenIdle()
    expect(ctx.autoDev.status(agent).cancelHold).toBe(false)
    await waitForGoal(ctx, agent, goal => goal?.phase === 'active' && goal.activation === 'armed')
  })

  it('clears cancel-hold when the switch is turned off then on', async () => {
    const { ctx, agent } = await harness({
      withDriver: true,
      script: ['hang', textResponse('after toggle resume')],
    })
    ctx.goals.create(agent, { objective: 'toggle clears hold', maxGoalRounds: 4 })
    ctx.autoDev.setOn(agent, true)
    await vi.waitFor(() => { expect(agent.status).toBe('running') })
    agent.cancel('user')
    await waitForGoal(ctx, agent, goal => goal?.phase === 'paused')
    expect(ctx.autoDev.status(agent).cancelHold).toBe(true)
    ctx.autoDev.setOn(agent, false)
    ctx.autoDev.setOn(agent, true)
    expect(ctx.autoDev.status(agent).cancelHold).toBe(false)
    await agent.whenIdle()
    await waitForGoal(ctx, agent, goal => goal?.phase === 'active' && goal.activation === 'armed')
  })
})
