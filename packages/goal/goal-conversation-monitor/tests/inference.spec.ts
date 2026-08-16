import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import GoalService from '@deepseek-ai/dsh-goal'
import type { GoalView } from '@deepseek-ai/dsh-goal'
import { CallId, createUserMessage, LlmAdapter } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import AutoDevMonitorService, { AUTO_DEV_MONITOR_PLUGIN } from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.allSettled(contexts.splice(0).map(c => c.fiber.dispose()))
})

type ScriptEntry = StreamChunk[]

class ScriptedAdapter extends LlmAdapter {
  readonly requests: GenerateOptions[] = []

  constructor(private readonly script: ScriptEntry[]) {
    super()
  }

  override async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options)
    const entry = this.script.shift()
    if (entry === undefined) throw new Error('ScriptedAdapter: script exhausted')
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

function toolCall(name: string, args: Record<string, unknown>, id = 'c1'): StreamChunk[] {
  const argumentsJson = JSON.stringify(args)
  return [
    { type: 'block-start', index: 0, blockType: 'tool-call' },
    {
      type: 'block-end',
      index: 0,
      block: { type: 'tool-call', id: CallId(id), name, arguments: argumentsJson },
    },
    { type: 'finish', reason: { kind: 'tool-calls' } },
  ]
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

async function harness(script: ScriptEntry[]) {
  const ctx = new Context()
  contexts.push(ctx)
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(CommandRuntime)
  await ctx.plugin(GoalService)
  await ctx.plugin(AutoDevMonitorService)
  await ctx.plugin(AgentLoop, { agents: [] })
  const adapter = new ScriptedAdapter(script)
  ctx.llm.registerAdapter(['mock'], adapter)
  const agent = ctx.agentLoop.create(SessionId(`auto-dev-inf-${Math.random()}`), {
    provider: 'mock',
    model: 'mock',
  })
  return { ctx, agent, adapter }
}

describe('autoDev inference', () => {
  it('creates and arms a goal from auto_dev_decide create', async () => {
    const { ctx, agent, adapter } = await harness([
      toolCall('auto_dev_decide', { decision: 'create', objective: 'ship the feature' }),
      textResponse('acknowledged create'),
    ])
    ctx.autoDev.setOn(agent, true)
    await waitForGoal(ctx, agent, goal => goal?.phase === 'active' && goal.activation === 'armed')
    expect(ctx.goals.get(agent)?.objective).toBe('ship the feature')
    await agent.whenIdle()
    expect(adapter.requests[0]?.messages.some(m => m.source.kind === 'plugin'
      && m.source.plugin === AUTO_DEV_MONITOR_PLUGIN)).toBe(true)
  })

  it('stays quiet after none until a human message', async () => {
    const { ctx, agent, adapter } = await harness([
      toolCall('auto_dev_decide', { decision: 'none' }),
      textResponse('nothing left'),
      textResponse('human turn'),
      toolCall('auto_dev_decide', { decision: 'none' }, 'c2'),
      textResponse('still nothing'),
    ])
    ctx.autoDev.setOn(agent, true)
    await agent.whenIdle()
    expect(ctx.goals.get(agent)).toBeUndefined()
    const afterNone = adapter.requests.length
    await new Promise((resolve) => { setImmediate(resolve) })
    expect(adapter.requests.length).toBe(afterNone)

    agent.followup(createUserMessage({
      content: [{ type: 'text', text: 'please keep going on the unfinished feature' }],
      source: { kind: 'user' },
    }))
    await agent.whenIdle()
    expect(adapter.requests.length).toBeGreaterThan(afterNone)
  })

  it('keeps create_goal unavailable without direct-human authority on a monitor turn', async () => {
    // Monitor turns use plugin MessageSource; dsh-tool-goal create_goal requires
    // a direct-human user message in the open turn — covered by tool-goal tests.
    // Here we only assert the monitor path never forges a user source.
    const { adapter, agent, ctx } = await harness([
      toolCall('auto_dev_decide', { decision: 'create', objective: 'real work' }),
      textResponse('ok'),
    ])
    ctx.autoDev.setOn(agent, true)
    await waitForGoal(ctx, agent, goal => goal?.objective === 'real work')
    const monitorMessage = adapter.requests[0]?.messages.find(m => m.role === 'user')
    expect(monitorMessage?.source.kind).toBe('plugin')
  })
})
