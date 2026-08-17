/**
 * Port lease registry (`ctx.ports`): durable, registry-globally unique TCP
 * port allocations over the domain data form. One host-side instance serves
 * every session and workspace, so dev servers started for different projects
 * can never receive the same port, while re-allocating the same
 * (scope, purpose) pair always returns its previously leased port — the
 * stability that survives restarts. The registry owns validation, probing,
 * and durability; the model-facing tools live in `@deepseek-ai/dsh-tool-ports`.
 * @module @deepseek-ai/dsh-ports
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'
import { portsDomainSpec } from './spec.ts'
import type { PortLeaseRecord } from './spec.ts'
import { DEFAULT_PROBE_TIMEOUT_MS, probePort } from './probe.ts'
import type {
  AllocatePortRequest,
  AllocatePortResult,
  AllocatedPort,
  PortLease,
  PortScope,
} from './types.ts'

export type {
  AllocatePortRequest,
  AllocatePortResult,
  AllocatedPort,
  PortLease,
  PortScope,
} from './types.ts'
export { portsDomainSpec } from './spec.ts'
export type { PortLeaseRecord } from './spec.ts'
export { DEFAULT_PROBE_TIMEOUT_MS, probePort } from './probe.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    ports: PortsRegistry
  }
}

/**
 * A port-allocation request violated the registry's rules. The stable `code`
 * is the model-facing error taxonomy; messages stay concrete for humans.
 */
export class PortError extends Error {
  /**
   * @param message - Concrete description of the violation.
   * @param code - Stable error code, e.g. `PORTS_INVALID_PORT`.
   */
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'PortError'
  }
}

/**
 * The durable table key for one (scope, purpose) pair. The scope kind is the
 * first token, so global and workspace keys can never collide; workspace ids
 * are UUIDs, so no escaping is required for arbitrary purpose text.
 * @param scope - The lease scope.
 * @param purpose - The server role label.
 * @returns the composite lease key.
 */
export function leaseKey(scope: PortScope, purpose: string): string {
  return scope.kind === 'global' ? `global:${purpose}` : `workspace:${scope.workspaceId}:${purpose}`
}

/** Well-known dev-server defaults the allocator leaves alone unless explicitly preferred. */
const DEFAULT_AVOID_PORTS = [3000, 3001, 4200, 5173, 5174, 8000, 8080, 8888, 9000]

/**
 * Registry config: the probe range, reserved defaults, and per-request
 * bounds. Every field is optional for direct construction; the Loader's
 * schemastery schema fills the defaults before the constructor runs.
 */
export interface PortsRegistryConfig {
  /** First port of the automatic scan range. Defaults to 4000. */
  minPort?: number
  /** Last port of the automatic scan range. Defaults to 49999. */
  maxPort?: number
  /** Ports the automatic scan skips (explicit `preferred` ports override this). */
  avoidPorts?: number[]
  /** Maximum length of one allocation purpose. Defaults to 64. */
  maxPurposeChars?: number
  /** Maximum ports one allocation may request. Defaults to 4. */
  maxCountPerAllocate?: number
  /** Bound on one probe bind. Defaults to 1000. */
  probeTimeoutMs?: number
}

/** Schemastery config: every field is deployment-tunable and defaults are product choices. */
export const Config: z<PortsRegistryConfig> = z.object({
  minPort: z.number().default(4000),
  maxPort: z.number().default(49999),
  avoidPorts: z.array(z.number()).default(DEFAULT_AVOID_PORTS),
  maxPurposeChars: z.number().default(64),
  maxCountPerAllocate: z.number().default(4),
  probeTimeoutMs: z.number().default(DEFAULT_PROBE_TIMEOUT_MS),
})

/**
 * The port-lease registry. Startup waits for `storageDomain`, opens the
 * `ports` domain, and only then serves allocations; the persistence
 * dependency is mandatory so an unavailable peer can never be mistaken for
 * an empty lease set. All allocation and release operations serialize on one
 * in-process write chain: the probe-then-persist pair of two concurrent
 * allocations can therefore never hand out the same port.
 */
export class PortsRegistry extends Service {
  static inject = ['storageDomain']
  static Config = Config

  private table?: KvTable<string, PortLeaseRecord>
  private readonly minPort: number
  private readonly maxPort: number
  private readonly avoidPorts: ReadonlySet<number>
  private readonly maxPurposeChars: number
  private readonly maxCountPerAllocate: number
  private readonly probeTimeoutMs: number
  private operationTail: Promise<void> = Promise.resolve()

  constructor(ctx: Context, config: PortsRegistryConfig = {}) {
    super(ctx, 'ports')
    this.minPort = config.minPort ?? 4000
    this.maxPort = config.maxPort ?? 49999
    this.avoidPorts = new Set(config.avoidPorts ?? DEFAULT_AVOID_PORTS)
    this.maxPurposeChars = config.maxPurposeChars ?? 64
    this.maxCountPerAllocate = config.maxCountPerAllocate ?? 4
    this.probeTimeoutMs = config.probeTimeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS
    this.validateConfig()
  }

  /** Open the ports domain and bind its lifetime to this plugin. */
  protected async [Service.init](): Promise<void> {
    const domain: Domain<typeof portsDomainSpec> = await this.ctx.storageDomain.open(portsDomainSpec)
    this.ctx.effect(() => () => domain.close(), 'ports.domainClose')
    this.table = domain.table('leases')
  }

  /**
   * Allocate `count` ports for one (scope, purpose) pair. A pair that already
   * holds a durable lease returns that port unchanged — the leased port is
   * authoritative for its purpose, and the result only flags whether a
   * process currently listens on it. New leases probe the OS first (skipping
   * every already-leased port), then persist before returning.
   * @param request - The scope, purpose, optional count, and optional
   *   preferred ports.
   * @returns the allocation outcome after durability.
   */
  allocate(request: AllocatePortRequest): Promise<AllocatePortResult> {
    return this.enqueueOperation(async () => {
      const purpose = this.validatePurpose(request.purpose)
      const count = request.count ?? 1
      if (!Number.isSafeInteger(count) || count < 1 || count > this.maxCountPerAllocate) {
        throw new PortError(
          `count must be an integer between 1 and ${this.maxCountPerAllocate}`,
          'PORTS_INVALID_COUNT',
        )
      }
      const preferred = (request.preferred ?? []).map(port => this.validatePort(port))
      const purposes = this.purposeKeys(purpose, count)
      return await this.allocateQueued(request.scope, purposes, preferred)
    })
  }

  /**
   * Release every lease that holds `port`, whatever its scope or purpose.
   * @param port - The leased port to free.
   * @returns `true` when at least one lease was deleted.
   */
  release(port: number): Promise<boolean> {
    return this.enqueueOperation(async () => {
      this.validatePort(port)
      const table = this.requireTable()
      let released = false
      for (const [key, record] of table.entries()) {
        if (record.port !== port) continue
        await table.delete(key)
        released = true
      }
      return released
    })
  }

  /**
   * Synchronous snapshot of every durable lease. Reads the domain's
   * in-memory table; no persistence reads.
   * @returns the lease records in storage order.
   */
  leases(): readonly PortLease[] {
    return [...this.requireTable().entries()].map(([, record]) => record)
  }

  private async allocateQueued(
    scope: PortScope,
    purposes: readonly string[],
    preferred: readonly number[],
  ): Promise<AllocatePortResult> {
    const table = this.requireTable()
    const reserved = new Set<number>()
    for (const [, record] of table.entries()) reserved.add(record.port)

    const ports: AllocatedPort[] = []
    for (const purpose of purposes) {
      const key = leaseKey(scope, purpose)
      const existing = table.get(key)
      if (existing !== undefined) {
        const inUse = !(await probePort(existing.port, this.probeTimeoutMs))
        ports.push({ port: existing.port, purpose, reused: true, inUse })
        continue
      }
      const port = await this.findFreePort(reserved, preferred)
      if (port === undefined) {
        throw new PortError(
          `no free port available between ${this.minPort} and ${this.maxPort}`,
          'PORTS_EXHAUSTED',
        )
      }
      reserved.add(port)
      await table.put(key, {
        scope,
        purpose,
        port,
        createdAt: new Date().toISOString(),
      })
      ports.push({ port, purpose, reused: false, inUse: false })
    }
    return { scope, ports }
  }

  private async findFreePort(reserved: ReadonlySet<number>, preferred: readonly number[]): Promise<number | undefined> {
    for (const port of preferred) {
      if (reserved.has(port)) continue
      if (await probePort(port, this.probeTimeoutMs)) return port
    }
    for (let port = this.minPort; port <= this.maxPort; port++) {
      if (reserved.has(port) || this.avoidPorts.has(port)) continue
      if (await probePort(port, this.probeTimeoutMs)) return port
    }
    return undefined
  }

  private validatePurpose(purpose: string): string {
    const trimmed = purpose.trim()
    if (trimmed.length === 0) {
      throw new PortError('purpose must be a non-empty string', 'PORTS_INVALID_PURPOSE')
    }
    if (trimmed.length > this.maxPurposeChars) {
      throw new PortError(
        `purpose must be at most ${this.maxPurposeChars} characters`,
        'PORTS_INVALID_PURPOSE',
      )
    }
    return trimmed
  }

  private validatePort(port: number): number {
    if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
      throw new PortError(`port must be an integer between 1 and 65535, got ${JSON.stringify(port)}`, 'PORTS_INVALID_PORT')
    }
    return port
  }

  private purposeKeys(purpose: string, count: number): string[] {
    if (count === 1) return [purpose]
    return Array.from({ length: count }, (_, index) => index === 0 ? purpose : `${purpose}#${index + 1}`)
  }

  private validateConfig(): void {
    const ports = [this.minPort, this.maxPort, ...this.avoidPorts]
    for (const port of ports) {
      if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
        throw new TypeError(`ports config: every port must be an integer between 1 and 65535, got ${JSON.stringify(port)}`)
      }
    }
    if (this.minPort > this.maxPort) {
      throw new TypeError(`ports config: minPort ${this.minPort} must not exceed maxPort ${this.maxPort}`)
    }
    if (!Number.isSafeInteger(this.maxPurposeChars) || this.maxPurposeChars < 1) {
      throw new TypeError(`ports config: maxPurposeChars must be a positive integer, got ${JSON.stringify(this.maxPurposeChars)}`)
    }
    if (!Number.isSafeInteger(this.maxCountPerAllocate) || this.maxCountPerAllocate < 1) {
      throw new TypeError(`ports config: maxCountPerAllocate must be a positive integer, got ${JSON.stringify(this.maxCountPerAllocate)}`)
    }
    if (!Number.isSafeInteger(this.probeTimeoutMs) || this.probeTimeoutMs < 1) {
      throw new TypeError(`ports config: probeTimeoutMs must be a positive integer, got ${JSON.stringify(this.probeTimeoutMs)}`)
    }
  }

  private requireTable(): KvTable<string, PortLeaseRecord> {
    if (this.table === undefined) throw new Error('ports registry is not started yet')
    return this.table
  }

  private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail.then(operation)
    this.operationTail = result.then(() => {}, () => {})
    return result
  }
}

export default PortsRegistry
