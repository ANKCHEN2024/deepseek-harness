/**
 * Model-facing `allocate_port` / `release_port` tools over `ctx.ports`, plus
 * the standing guidance section that tells the model to allocate before
 * starting any port-listening server. This package owns schemas, validation,
 * scope resolution, prompt guidance, and presentation, never probing or
 * durability — those live in `@deepseek-ai/dsh-ports`.
 * @module @deepseek-ai/dsh-tool-ports
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-ports'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { applyAllocatePortTool } from './allocate.ts'
import { applyReleasePortTool } from './release.ts'

export {
  applyAllocatePortTool,
  formatAllocateOutput,
  parseAllocateArgs,
  presentAllocateCall,
  resolvePortScope,
} from './allocate.ts'
export type { AllocatePortValue } from './allocate.ts'
export {
  applyReleasePortTool,
  formatReleaseOutput,
  parseReleaseArgs,
  presentReleaseCall,
} from './release.ts'
export type { ReleasePortValue } from './release.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'tool-ports'

/** Services required by the port tool suite: the registries and the shared lease registry. */
export const inject = ['tools', 'systemPrompt', 'ports']

/** Default cooperative tool-call timeout budget (ms) for `allocate_port`. */
export const DEFAULT_ALLOCATE_TIMEOUT_MS = 30_000
/** Default cooperative tool-call timeout budget (ms) for `release_port`. */
export const DEFAULT_RELEASE_TIMEOUT_MS = 10_000

/** Plugin config: per-tool cooperative timeout budgets. */
export interface Config {
  /** Cooperative timeout budget (ms) for `allocate_port`. Defaults to 30000. */
  allocateTimeoutMs?: number
  /** Cooperative timeout budget (ms) for `release_port`. Defaults to 10000. */
  releaseTimeoutMs?: number
}

export const Config: z<Config> = z.object({
  allocateTimeoutMs: z.number().default(DEFAULT_ALLOCATE_TIMEOUT_MS),
  releaseTimeoutMs: z.number().default(DEFAULT_RELEASE_TIMEOUT_MS),
})

/** The guidance every session carrying these tools reads before starting servers. */
function guidance(): string {
  return 'Before starting a dev server, preview server, or any long-running command that listens on a TCP port, '
    + 'call allocate_port with a stable purpose label for that server and pass the allocated port to the command '
    + '(e.g. `pnpm dev --port <port>`). Ports are shared across every project workspace, so allocations never '
    + 'collide; the same project and purpose reuse the same port across sessions. Call release_port when the '
    + 'server stops so its port can be allocated again.'
}

/** Configured timeout budgets must be positive integers. */
function assertPositiveInteger(field: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`tool-ports: ${field} must be a positive integer`)
  }
}

/**
 * Register both port tools and their standing guidance section.
 * @param ctx - context whose `tools` and `systemPrompt` registries receive
 *   the registrations; both are effect-scoped and unregister on dispose.
 * @param config - validated {@link Config}.
 */
export function apply(ctx: Context, config: Config): void {
  const allocateTimeoutMs = config.allocateTimeoutMs ?? DEFAULT_ALLOCATE_TIMEOUT_MS
  const releaseTimeoutMs = config.releaseTimeoutMs ?? DEFAULT_RELEASE_TIMEOUT_MS
  assertPositiveInteger('allocateTimeoutMs', allocateTimeoutMs)
  assertPositiveInteger('releaseTimeoutMs', releaseTimeoutMs)

  ctx.systemPrompt.section({
    name: 'tool:allocate_port',
    order: 111,
    text: guidance(),
  })
  applyAllocatePortTool(ctx, allocateTimeoutMs)
  applyReleasePortTool(ctx, releaseTimeoutMs)
}
