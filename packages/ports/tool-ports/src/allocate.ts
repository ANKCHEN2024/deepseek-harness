/**
 * The model-facing `allocate_port` tool: resolve the calling session's
 * project scope, allocate through `ctx.ports`, and render the assignment.
 * This module owns only the model-facing schema, argument validation, scope
 * resolution, and result formatting — probing, durability, and uniqueness
 * live in the ports registry.
 * @module @deepseek-ai/dsh-tool-ports/src/allocate
 */

import type { Context } from '@deepseek-ai/cordis'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import { PortError } from '@deepseek-ai/dsh-ports'
import type { AllocatePortResult, PortScope } from '@deepseek-ai/dsh-ports'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-workspace'

/**
 * The `allocate_port` result value: the display label of the resolved scope
 * plus one entry per allocated port. `scope` carries the label rather than
 * the durable scope shape because the model reads it, not the registry.
 */
export interface AllocatePortValue {
  /** Display label of the resolved scope: `global` or the workspace title. */
  scope: string
  /** One entry per allocated port. */
  ports: {
    port: number
    purpose: string
    reused: boolean
    inUse: boolean
  }[]
}

/** Output schema for {@link AllocatePortValue}. */
const ALLOCATE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scope: { type: 'string', required: true },
    ports: {
      type: 'array',
      required: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          port: { type: 'integer', required: true },
          purpose: { type: 'string', required: true },
          reused: { type: 'boolean', required: true },
          inUse: { type: 'boolean', required: true },
        },
      },
    },
  },
} as const

const ALLOCATE_DESCRIPTION =
  'Allocate one or more TCP ports for a server role in the current project. Allocations are shared across '
  + 'every project workspace, so assigned ports never collide, and the same project and purpose reuse the '
  + 'same port across sessions. Call release_port when the server stops.'

/**
 * Validate value constraints the schema DSL cannot express: a non-blank
 * purpose, a positive-integer count, and in-range preferred ports.
 * @param args - the schema-validated `allocate_port` arguments.
 * @returns the accepted arguments, passed through unchanged.
 */
export function parseAllocateArgs(args: { purpose: string; count?: number; preferred?: number[] }): {
  purpose: string
  count?: number
  preferred?: number[]
} {
  if (args.purpose.trim().length === 0) {
    throw new HarnessError('purpose must be a non-empty string', 'PORTS_INVALID_PURPOSE')
  }
  if (args.count !== undefined && (!Number.isSafeInteger(args.count) || args.count < 1)) {
    throw new HarnessError('count must be a positive integer', 'PORTS_INVALID_COUNT')
  }
  for (const port of args.preferred ?? []) {
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
      throw new HarnessError(
        `preferred port must be an integer between 1 and 65535, got ${JSON.stringify(port)}`,
        'PORTS_INVALID_PORT',
      )
    }
  }
  return {
    purpose: args.purpose,
    ...args.count === undefined ? {} : { count: args.count },
    ...args.preferred === undefined ? {} : { preferred: args.preferred },
  }
}

/**
 * Resolve the allocation scope for one session cwd: the owning workspace when
 * a workspace registry is mounted and knows the directory, otherwise the
 * global scope. Ports stay unique registry-globally either way; the workspace
 * scope only adds per-project port stability.
 * @param ctx - context that may carry a workspace registry.
 * @param cwd - the calling session's cwd, when one exists.
 * @returns the durable scope plus its model-facing display label.
 */
export async function resolvePortScope(ctx: Context, cwd: string | undefined): Promise<{ scope: PortScope; label: string }> {
  const workspaceRegistry = ctx.get('workspaceRegistry')
  if (workspaceRegistry === undefined || cwd === undefined) return { scope: { kind: 'global' }, label: 'global' }
  try {
    const workspace = await workspaceRegistry.resolveByPath(cwd)
    if (workspace !== undefined) {
      return {
        scope: { kind: 'workspace', workspaceId: workspace.id },
        label: `workspace "${workspace.title}"`,
      }
    }
  } catch {
    // A gone or unresolvable cwd still gets a global allocation; collisions stay prevented.
  }
  return { scope: { kind: 'global' }, label: 'global' }
}

/**
 * Format one allocation outcome as model-facing text: one line per port with
 * the assignment, the scope, the stable-reuse note, and — when the leased
 * port was taken over — the explicit reallocation escape hatch.
 * @param value - the tool result value.
 * @returns the rendered text.
 */
export function formatAllocateOutput(value: AllocatePortValue): string {
  return value.ports.map((entry) => {
    const head = `${entry.reused ? 'Reusing' : 'Allocated'} port ${entry.port} for "${entry.purpose}" (scope: ${value.scope}).`
    if (entry.inUse) {
      return `${head} NOTE: a process is currently listening on this port. If that is not this project's `
        + `server for this purpose, call release_port(${entry.port}), then allocate_port again.`
    }
    return `${head} Pass it to your server command, e.g. \`--port ${entry.port}\`. The same project and `
      + 'purpose keep this port across sessions; call release_port when the server stops.'
  }).join('\n')
}

/**
 * Pending-call presentation: a generic card titled by the requested purpose.
 * @param args - the raw tool arguments; only `purpose` feeds the view.
 * @returns the generic call view.
 */
export function presentAllocateCall(args: { purpose: string }): GenericCallView {
  return { card: 'generic', title: `Allocate port for ${args.purpose}`, kind: 'other', rawInput: args.purpose }
}

/**
 * Register the `allocate_port` tool.
 * @param ctx - context whose `tools` registry receives the registration; the
 *   registration is effect-scoped and unregisters on plugin dispose.
 * @param timeoutMs - the cooperative tool-call budget (ms) attached as the
 *   tool's `ToolDefinition.timeoutMs` for `@deepseek-ai/dsh-tool-call-timeout-policy` to enforce.
 */
export function applyAllocatePortTool(ctx: Context, timeoutMs: number): void {
  ctx.tools.register(defineTool({
    name: 'allocate_port',
    description: ALLOCATE_DESCRIPTION,
    parameters: {
      purpose: {
        type: 'string',
        required: true,
        description: 'Stable short label for this server role, e.g. "dev-server" or "docs-preview". Reusing the same label in the same project returns the same port.',
      },
      count: {
        type: 'number',
        description: 'How many ports to allocate. Defaults to 1; extra ports get #2, #3... suffixes.',
      },
      preferred: {
        type: 'array',
        items: { type: 'number' },
        description: 'Ports to try first, in order; each must be free and unassigned.',
      },
    },
    output: {
      schema: ALLOCATE_OUTPUT_SCHEMA,
      render: (_args, value: AllocatePortValue) => [{ type: 'text' as const, text: formatAllocateOutput(value) }],
    },
    timeoutMs,
    // Allocation mutates shared durable registry state; serialized calls keep ordering predictable.
    isConcurrencySafe: () => false,
    async execute(args, exec) {
      const input = parseAllocateArgs(args)
      const { scope, label } = await resolvePortScope(ctx, exec.agent?.session.header.cwd)
      let result: AllocatePortResult
      try {
        result = await ctx.ports.allocate({
          scope,
          purpose: input.purpose,
          ...input.count === undefined ? {} : { count: input.count },
          ...input.preferred === undefined ? {} : { preferred: input.preferred },
        })
      } catch (error) {
        if (error instanceof PortError) throw new HarnessError(error.message, error.code)
        throw error
      }
      return {
        scope: label,
        ports: result.ports.map(({ port, purpose, reused, inUse }) => ({ port, purpose, reused, inUse })),
      }
    },
    presentCall: presentAllocateCall,
  }))
}
