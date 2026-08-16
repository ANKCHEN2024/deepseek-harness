import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import GoalService from '@deepseek-ai/dsh-goal'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools'
import AutoDevMonitorService from '../src/index.ts'
import type { AutoDevDecideArgs } from '../src/decide-tool.ts'

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
  const agent = ctx.agentLoop.create(SessionId(`auto-dev-decide-${Math.random()}`), {
    provider: 'mock',
    model: 'mock',
  })
  return { ctx, agent }
}

/** Resolve the registered decide tool definition. */
function decideTool(ctx: Context): ToolDefinition {
  const tool = ctx.tools.get('auto_dev_decide')
  if (tool === undefined) throw new Error('auto_dev_decide was not registered')
  return tool
}

/** Minimal exec face for direct tool.execute calls. */
function execFace(agent: unknown): ToolRunContext {
  return { agent } as ToolRunContext
}

describe('auto_dev_decide tool', () => {
  it('rejects missing agent, switch-off, empty objective, and incomplete goal', async () => {
    const { ctx, agent } = await harness()
    const tool = decideTool(ctx)

    await expect(tool.execute({ decision: 'create', objective: 'x' }, execFace(undefined)))
      .rejects.toMatchObject({ code: 'AUTO_DEV_AGENT_REQUIRED' } satisfies Partial<HarnessError>)

    await expect(tool.execute({ decision: 'create', objective: 'x' }, execFace(agent)))
      .rejects.toMatchObject({ code: 'AUTO_DEV_SWITCH_OFF' })

    ctx.autoDev.setOn(agent, true)
    await expect(tool.execute({ decision: 'create', objective: '   ' }, execFace(agent)))
      .rejects.toMatchObject({ code: 'AUTO_DEV_OBJECTIVE_REQUIRED' })
    await expect(tool.execute({ decision: 'create' }, execFace(agent)))
      .rejects.toMatchObject({ code: 'AUTO_DEV_OBJECTIVE_REQUIRED' })

    ctx.goals.create(agent, { objective: 'already there' })
    await expect(tool.execute({ decision: 'create', objective: 'another' }, execFace(agent)))
      .rejects.toMatchObject({ code: 'AUTO_DEV_GOAL_EXISTS' })
  })

  it('presents create and none calls', async () => {
    const { ctx } = await harness()
    const tool = decideTool(ctx)
    const present = tool.presentCall as (args: AutoDevDecideArgs) => { rawInput?: string }
    expect(present({ decision: 'create', objective: 'ship it' }).rawInput).toBe('ship it')
    expect(present({ decision: 'none' }).rawInput).toBe('none')
  })

  it('creates after a complete goal and renders none', async () => {
    const { ctx, agent } = await harness()
    const tool = decideTool(ctx)
    ctx.autoDev.setOn(agent, true)
    const first = ctx.goals.create(agent, { objective: 'done already' })
    ctx.goals.complete(agent, first)
    const created = await tool.execute(
      { decision: 'create', objective: 'next objective' },
      execFace(agent),
    ) as { decision: string; goal: { objective: string } }
    expect(created).toMatchObject({ decision: 'create', goal: { objective: 'next objective' } })
    const rendered = tool.output.render({}, { decision: 'none', goal: null })
    expect(rendered[0]).toMatchObject({ type: 'text', text: '{"decision":"none","goal":null}' })
  })
})
