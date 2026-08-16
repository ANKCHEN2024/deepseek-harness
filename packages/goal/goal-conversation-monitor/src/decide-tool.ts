/** Model-facing decide tool for auto-dev monitor inference turns. */

import type { Context } from '@deepseek-ai/cordis'
import type { GoalView } from '@deepseek-ai/dsh-goal'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView } from '@deepseek-ai/dsh-tools'

/** Arguments for `auto_dev_decide`. */
export interface AutoDevDecideArgs {
  readonly decision: 'create' | 'none'
  /** Required non-empty when decision is create. */
  readonly objective?: string
}

/** Compact tool result. */
export interface AutoDevDecideResult {
  readonly decision: 'create' | 'none'
  readonly goal: GoalView | null
}

/**
 * Register `auto_dev_decide` on the tools registry.
 * @param ctx - context carrying tools and autoDev.
 * @returns disposer that unregisters the tool.
 */
export function registerAutoDevDecideTool(ctx: Context): () => void {
  return ctx.tools.register(defineTool({
    name: 'auto_dev_decide',
    description: 'Report whether unfinished project work remains for auto-dev monitoring. '
      + 'Use decision "create" with a concrete objective, or "none" when nothing remains. '
      + 'Only valid while auto-dev is switched on.',
    parameters: {
      decision: {
        type: 'string',
        required: true,
        enum: ['create', 'none'],
        description: 'create a goal for remaining work, or none when finished',
      },
      objective: {
        type: 'string',
        description: 'Concrete completion objective; required when decision is create',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          decision: { type: 'string', required: true },
          goal: { type: 'json', required: true },
        },
      },
      render: (_args: unknown, value: AutoDevDecideResult) => [
        { type: 'text' as const, text: JSON.stringify(value) },
      ],
    },
    execute(args: AutoDevDecideArgs, exec) {
      const agent = exec.agent
      if (agent === undefined) {
        throw new HarnessError('auto_dev_decide requires a calling agent', 'AUTO_DEV_AGENT_REQUIRED')
      }
      if (!ctx.autoDev.isOn(agent)) {
        throw new HarnessError('auto_dev_decide requires auto-dev to be switched on', 'AUTO_DEV_SWITCH_OFF')
      }
      if (args.decision === 'none') {
        ctx.autoDev.markQuietUntilHuman(agent)
        return Promise.resolve({ decision: 'none' as const, goal: null })
      }
      const objective = args.objective?.trim() ?? ''
      if (objective.length === 0) {
        throw new HarnessError('create requires a non-empty objective', 'AUTO_DEV_OBJECTIVE_REQUIRED')
      }
      const current = ctx.goals.get(agent)
      if (current !== undefined && current.phase !== 'complete') {
        throw new HarnessError(
          'auto_dev_decide create requires no current incomplete goal',
          'AUTO_DEV_GOAL_EXISTS',
        )
      }
      const goal = ctx.goals.create(agent, { objective })
      return Promise.resolve({ decision: 'create' as const, goal })
    },
    presentCall: (args: AutoDevDecideArgs): GenericCallView => ({
      card: 'generic',
      title: 'Auto-dev decide',
      kind: 'other',
      rawInput: args.decision === 'create' ? args.objective : args.decision,
    }),
  }))
}
