import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import type { Agent } from '@deepseek-ai/dsh-agent'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import GoalService from '@deepseek-ai/dsh-goal'
import { SessionId } from '@deepseek-ai/dsh-session'
import AutoDevMonitorService from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.allSettled(contexts.splice(0).map(c => c.fiber.dispose()))
})

interface Harness {
  readonly ctx: Context
  readonly agent: Agent
}

async function harness(): Promise<Harness> {
  const ctx = new Context()
  contexts.push(ctx)
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(CommandRuntime)
  await ctx.plugin(GoalService)
  await ctx.plugin(AutoDevMonitorService)
  await ctx.plugin(AgentLoop, { agents: [] })
  const agent = ctx.agentLoop.create(SessionId(`auto-dev-cmd-${Math.random()}`), {
    provider: 'mock',
    model: 'mock',
  })
  return { ctx, agent }
}

async function run(test: Harness, suffix = ''): Promise<string> {
  const execution = await test.ctx.commands.execute(
    test.agent,
    `/auto-dev${suffix}`,
    new AbortController().signal,
  )
  if (execution === undefined) throw new Error('auto-dev command was not registered')
  if (execution.result.kind === 'error') return execution.result.text
  return execution.result.text ?? ''
}

describe('/auto-dev command', () => {
  it('reports off by default and toggles on/off', async () => {
    const test = await harness()
    expect(await run(test)).toContain('Auto-dev: off')
    expect(await run(test, ' on')).toBe('Auto-dev monitoring is on.')
    expect(await run(test, ' status')).toContain('Auto-dev: on')
    expect(await run(test, ' off')).toBe('Auto-dev monitoring is off.')
    expect(test.ctx.autoDev.isOn(test.agent)).toBe(false)
  })

  it('rejects unknown input', async () => {
    const test = await harness()
    expect(await run(test, ' maybe')).toContain('Usage:')
  })

  it('reports cancel-hold and goal lines in status', async () => {
    const test = await harness()
    expect(await run(test, ' status')).toContain('Goal: none')
    const created = test.ctx.goals.create(test.agent, { objective: 'status objective' })
    expect(await run(test, ' on')).toBe('Auto-dev monitoring is on.')
    test.ctx.goals.pause(test.agent, created)
    expect(test.ctx.autoDev.status(test.agent).cancelHold).toBe(true)
    const status = await run(test, ' status')
    expect(status).toContain('Cancel-hold: yes')
    expect(status).toContain('Goal: paused')
    expect(status).toContain('status objective')
  })
})
