import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { agentEvents } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import GoalService from '@deepseek-ai/dsh-goal'
import { SessionId } from '@deepseek-ai/dsh-session'
import CommandRuntime from '@deepseek-ai/dsh-commands'
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
    agentEvents(ctx, agent).emit('agent/session-start', { source: 'resume' })
    expect(ctx.autoDev.isOn(agent)).toBe(false)
  })
})
