import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import GoalService from '@deepseek-ai/dsh-goal'
import { SessionId } from '@deepseek-ai/dsh-session'
import AutoDevMonitorService from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.allSettled(contexts.splice(0).map(c => c.fiber.dispose()))
})

async function harness() {
  const ctx = new Context()
  contexts.push(ctx)
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(CommandRuntime)
  await ctx.plugin(GoalService)
  await ctx.plugin(AutoDevMonitorService)
  await ctx.plugin(AgentLoop, { agents: [] })
  const agent = ctx.agentLoop.create(SessionId(`auto-dev-edge-${Math.random()}`), {
    provider: 'mock',
    model: 'mock',
  })
  return { ctx, agent }
}

describe('autoDev edge paths', () => {
  it('rejects requireLive for a foreign agent instance', async () => {
    const { ctx, agent } = await harness()
    const foreign = { ...agent, id: agent.id } as Agent
    expect(() => ctx.autoDev.isOn(foreign)).toThrow(/exact live agent/)
  })

  it('forces live agents off when the monitor loads over them', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await mountAgentLoopTestDependencies(ctx)
    await ctx.plugin(CommandRuntime)
    await ctx.plugin(GoalService)
    await ctx.plugin(AgentLoop, { agents: [] })
    const agent = ctx.agentLoop.create(SessionId(`auto-dev-preload-${Math.random()}`), {
      provider: 'mock',
      model: 'mock',
    })
    await ctx.plugin(AutoDevMonitorService)
    expect(ctx.autoDev.isOn(agent)).toBe(false)
  })

  it('resumes an active disarmed goal when idle with the switch on', async () => {
    const { ctx, agent } = await harness()
    const created = ctx.goals.create(agent, { objective: 'disarmed resume' })
    ctx.goals.disarm(agent)
    expect(ctx.goals.get(agent)).toMatchObject({ phase: 'active', activation: 'disarmed' })
    ctx.autoDev.setOn(agent, true)
    await vi.waitFor(() => {
      expect(ctx.goals.get(agent)?.activation).toBe('armed')
    })
    expect(created.id).toBe(ctx.goals.get(agent)?.id)
  })

  it('clears a pending reservation when followup throws', async () => {
    const { ctx, agent } = await harness()
    const followup = vi.spyOn(agent, 'followup').mockImplementation(() => {
      throw new Error('followup refused')
    })
    ctx.autoDev.setOn(agent, true)
    expect(followup).toHaveBeenCalled()
    followup.mockRestore()
  })
})
