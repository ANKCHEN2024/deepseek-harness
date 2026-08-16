/**
 * The model-facing `release_port` tool: free one leased port through
 * `ctx.ports`. Validation, registry errors, and result formatting live here;
 * the registry owns durability.
 * @module @deepseek-ai/dsh-tool-ports/src/release
 */

import type { Context } from '@deepseek-ai/cordis'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import { PortError } from '@deepseek-ai/dsh-ports'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView } from '@deepseek-ai/dsh-tools'

/** The `release_port` result value. */
export interface ReleasePortValue {
  /** Whether a lease for the port existed and was deleted. */
  released: boolean
  /** One-line outcome for the model. */
  message: string
}

/** Output schema for {@link ReleasePortValue}. */
const RELEASE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    released: { type: 'boolean', required: true },
    message: { type: 'string', required: true },
  },
} as const

const RELEASE_DESCRIPTION =
  'Release an allocated TCP port so it can be assigned again. Pass the port number previously returned by allocate_port.'

/**
 * Validate value constraints the schema DSL cannot express: an in-range
 * integer port.
 * @param args - the schema-validated `release_port` arguments.
 * @returns the accepted port.
 */
export function parseReleaseArgs(args: { port: number }): { port: number } {
  if (!Number.isSafeInteger(args.port) || args.port < 1 || args.port > 65535) {
    throw new HarnessError(
      `port must be an integer between 1 and 65535, got ${JSON.stringify(args.port)}`,
      'PORTS_INVALID_PORT',
    )
  }
  return { port: args.port }
}

/**
 * Format the release outcome as one model-facing line.
 * @param released - whether a lease was deleted.
 * @param port - the released port.
 * @returns the rendered text.
 */
export function formatReleaseOutput(released: boolean, port: number): string {
  return released
    ? `Released port ${port}; it can be allocated again.`
    : `No allocation found for port ${port}.`
}

/**
 * Pending-call presentation: a generic card titled by the port.
 * @param args - the raw tool arguments; only `port` feeds the view.
 * @returns the generic call view.
 */
export function presentReleaseCall(args: { port: number }): GenericCallView {
  return { card: 'generic', title: `Release port ${args.port}`, kind: 'other', rawInput: args.port }
}

/**
 * Register the `release_port` tool.
 * @param ctx - context whose `tools` registry receives the registration; the
 *   registration is effect-scoped and unregisters on plugin dispose.
 * @param timeoutMs - the cooperative tool-call budget (ms) attached as the
 *   tool's `ToolDefinition.timeoutMs` for `@deepseek-ai/dsh-tool-call-timeout-policy` to enforce.
 */
export function applyReleasePortTool(ctx: Context, timeoutMs: number): void {
  ctx.tools.register(defineTool({
    name: 'release_port',
    description: RELEASE_DESCRIPTION,
    parameters: {
      port: { type: 'number', required: true, description: 'The allocated port to release.' },
    },
    output: {
      schema: RELEASE_OUTPUT_SCHEMA,
      render: (_args, value: ReleasePortValue) => [{ type: 'text' as const, text: value.message }],
    },
    timeoutMs,
    isConcurrencySafe: () => false,
    async execute(args) {
      const input = parseReleaseArgs(args)
      let released: boolean
      try {
        released = await ctx.ports.release(input.port)
      } catch (error) {
        if (error instanceof PortError) throw new HarnessError(error.message, error.code)
        throw error
      }
      return { released, message: formatReleaseOutput(released, input.port) }
    },
    presentCall: presentReleaseCall,
  }))
}
