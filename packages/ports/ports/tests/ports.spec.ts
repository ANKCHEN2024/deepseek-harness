import { afterEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:net'
import type { Server } from 'node:net'
import { Context } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import { DomainFacility } from '@deepseek-ai/dsh-storage-domain'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { MemoryMediaPool, MemoryStorageBackend } from '../../../storage/storage-domain/tests/helpers/memory-backend.ts'
import PortsRegistry, { leaseKey, PortError, portsDomainSpec } from '../src/index.ts'
import type { PortsRegistryConfig, PortScope } from '../src/index.ts'

const GLOBAL: PortScope = { kind: 'global' }
const WORKSPACE = (id: string): PortScope => ({ kind: 'workspace', workspaceId: WorkspaceId(id) })

const TEST_CONFIG: PortsRegistryConfig = { minPort: 43000, maxPort: 43099, avoidPorts: [] }

interface Harness {
  ctx: Context
  fiber: Awaited<ReturnType<Context['plugin']>>
  pool: MemoryMediaPool
  ports: PortsRegistry
}

async function harness(
  config: PortsRegistryConfig = {},
  pool: MemoryMediaPool = new MemoryMediaPool(),
): Promise<Harness> {
  const ctx = new Context()
  await ctx.plugin(Storage)
  ctx.storage.backend.register('memory', new MemoryStorageBackend(pool))
  const facility = new DomainFacility(ctx, { backend: 'memory', routes: {} })
  ctx.storage.mount('domain', facility)
  ctx.provide('storageDomain', facility)
  const fiber = await ctx.plugin(PortsRegistry, config)
  return { ctx, fiber, pool, ports: ctx.ports }
}

async function listenOn(port: number): Promise<Server> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen({ port, host: '127.0.0.1' }, resolve)
  })
  return server
}

const closeServer = (server: Server): Promise<void> => new Promise((resolve) => { server.close(() => { resolve() }) })

const openServers: Server[] = []

afterEach(async () => {
  await Promise.allSettled(openServers.splice(0).map(closeServer))
})

describe('ports registry config', () => {
  it('rejects ranges, port lists, and bounds that cannot work before any domain opens', async () => {
    const badConfigs: Partial<PortsRegistryConfig>[] = [
      { minPort: 0 },
      { maxPort: 65536 },
      { minPort: 43010, maxPort: 43000 },
      { avoidPorts: [3.5] },
      { maxPurposeChars: 0 },
      { maxCountPerAllocate: 0 },
      { probeTimeoutMs: 0 },
    ]
    for (const config of badConfigs) {
      await expect(harness(config)).rejects.toThrow(TypeError)
    }
  })

  it('applies the shipped defaults without configuration', async () => {
    const { ports } = await harness()
    const result = await ports.allocate({ scope: GLOBAL, purpose: 'defaults' })
    expect(result.ports).toHaveLength(1)
    expect(result.ports[0]?.port).toBeGreaterThanOrEqual(4000)
    expect(result.ports[0]?.port).toBeLessThanOrEqual(49999)
    expect([3000, 5173, 8080]).not.toContain(result.ports[0]?.port)
  })
})

describe('ports registry allocation', () => {
  it('allocates the first free port in range, persists it, and reports a fresh lease', async () => {
    const { ports } = await harness(TEST_CONFIG)
    const result = await ports.allocate({ scope: GLOBAL, purpose: 'dev-server' })
    expect(result.ports).toEqual([{ port: 43000, purpose: 'dev-server', reused: false, inUse: false }])
    expect(ports.leases()).toHaveLength(1)
  })

  it('reuses the leased port for the same scope and purpose without writing', async () => {
    const { ports } = await harness(TEST_CONFIG)
    const first = await ports.allocate({ scope: GLOBAL, purpose: 'dev-server' })
    const again = await ports.allocate({ scope: GLOBAL, purpose: 'dev-server' })
    expect(again.ports).toEqual([{ port: first.ports[0]!.port, purpose: 'dev-server', reused: true, inUse: false }])
    expect(ports.leases()).toHaveLength(1)
  })

  it('flags a reused port whose lease was taken over by another process, and keeps the lease stable', async () => {
    const { ports } = await harness(TEST_CONFIG)
    const first = await ports.allocate({ scope: GLOBAL, purpose: 'dev-server' })
    const port = first.ports[0]!.port
    openServers.push(await listenOn(port))
    const again = await ports.allocate({ scope: GLOBAL, purpose: 'dev-server' })
    expect(again.ports).toEqual([{ port, purpose: 'dev-server', reused: true, inUse: true }])
  })

  it('assigns different ports to the same purpose across workspaces and to different purposes within one', async () => {
    const { ports } = await harness(TEST_CONFIG)
    const left = await ports.allocate({ scope: WORKSPACE('ws-left'), purpose: 'dev-server' })
    const right = await ports.allocate({ scope: WORKSPACE('ws-right'), purpose: 'dev-server' })
    const docs = await ports.allocate({ scope: WORKSPACE('ws-left'), purpose: 'docs-preview' })
    const assigned = new Set([left.ports[0]!.port, right.ports[0]!.port, docs.ports[0]!.port])
    expect(assigned.size).toBe(3)
  })

  it('reuses a workspace lease after a simulated restart over the same medium', async () => {
    const pool = new MemoryMediaPool()
    const first = await harness(TEST_CONFIG, pool)
    const allocated = await first.ports.allocate({ scope: WORKSPACE('ws-restart'), purpose: 'dev-server' })
    await first.fiber.dispose()

    const second = await harness(TEST_CONFIG, pool)
    const again = await second.ports.allocate({ scope: WORKSPACE('ws-restart'), purpose: 'dev-server' })
    expect(again.ports[0]).toMatchObject({
      port: allocated.ports[0]!.port,
      purpose: 'dev-server',
      reused: true,
    })
  })

  it('allocates several distinct ports for one count and suffixes extra purposes', async () => {
    const { ports } = await harness({ ...TEST_CONFIG, maxCountPerAllocate: 4 })
    const result = await ports.allocate({ scope: GLOBAL, purpose: 'stack', count: 3 })
    const assigned = result.ports.map(entry => entry.port)
    expect(new Set(assigned).size).toBe(3)
    expect(result.ports.map(entry => entry.purpose)).toEqual(['stack', 'stack#2', 'stack#3'])
  })

  it('skips already-leased ports and OS-occupied ports during the scan', async () => {
    const { ports } = await harness(TEST_CONFIG)
    openServers.push(await listenOn(43000))
    const first = await ports.allocate({ scope: GLOBAL, purpose: 'taken-by-os' })
    expect(first.ports[0]?.port).toBe(43001)
    const second = await ports.allocate({ scope: GLOBAL, purpose: 'taken-by-lease' })
    expect(second.ports[0]?.port).toBe(43002)
  })

  it('honors preferred ports in order, skipping unavailable ones', async () => {
    const { ports } = await harness(TEST_CONFIG)
    openServers.push(await listenOn(43050))
    await ports.allocate({ scope: GLOBAL, purpose: 'squatter' }) // leases 43000
    const result = await ports.allocate({
      scope: GLOBAL,
      purpose: 'preferred',
      preferred: [43000, 43050, 43060],
    })
    expect(result.ports[0]?.port).toBe(43060)
  })

  it('lets an explicit preferred port override the avoid list', async () => {
    const { ports } = await harness({ ...TEST_CONFIG, avoidPorts: [43070] })
    const result = await ports.allocate({ scope: GLOBAL, purpose: 'explicit', preferred: [43070] })
    expect(result.ports[0]?.port).toBe(43070)
  })

  it('skips avoided ports during the automatic scan', async () => {
    const { ports } = await harness({ ...TEST_CONFIG, avoidPorts: [43000, 43001] })
    const result = await ports.allocate({ scope: GLOBAL, purpose: 'avoided' })
    expect(result.ports[0]?.port).toBe(43002)
  })

  it('trims the purpose before recording it', async () => {
    const { ports } = await harness(TEST_CONFIG)
    const result = await ports.allocate({ scope: GLOBAL, purpose: '  dev-server  ' })
    expect(result.ports[0]?.purpose).toBe('dev-server')
    expect(ports.leases()[0]?.purpose).toBe('dev-server')
  })

  it('reports exhaustion when no candidate port is free', async () => {
    const { ports } = await harness({ minPort: 43100, maxPort: 43100, avoidPorts: [] })
    openServers.push(await listenOn(43100))
    await expect(ports.allocate({ scope: GLOBAL, purpose: 'exhausted' }))
      .rejects.toThrow(new PortError('no free port available between 43100 and 43100', 'PORTS_EXHAUSTED'))
  })

  it('serializes concurrent allocations so they never share a port', async () => {
    const { ports } = await harness(TEST_CONFIG)
    const [first, second, third] = await Promise.all([
      ports.allocate({ scope: GLOBAL, purpose: 'concurrent-a' }),
      ports.allocate({ scope: GLOBAL, purpose: 'concurrent-b' }),
      ports.allocate({ scope: GLOBAL, purpose: 'concurrent-c' }),
    ])
    const assigned = [first, second, third].map(result => result.ports[0]!.port)
    expect(new Set(assigned).size).toBe(3)
  })
})

describe('ports registry validation', () => {
  it('rejects blank, oversized, or over-counted requests with stable codes', async () => {
    const { ports } = await harness({ ...TEST_CONFIG, maxPurposeChars: 8, maxCountPerAllocate: 2 })
    await expect(ports.allocate({ scope: GLOBAL, purpose: '   ' }))
      .rejects.toThrow(new PortError('purpose must be a non-empty string', 'PORTS_INVALID_PURPOSE'))
    await expect(ports.allocate({ scope: GLOBAL, purpose: 'way-too-long' }))
      .rejects.toThrow(new PortError('purpose must be at most 8 characters', 'PORTS_INVALID_PURPOSE'))
    await expect(ports.allocate({ scope: GLOBAL, purpose: 'ok', count: 3 }))
      .rejects.toThrow(new PortError('count must be an integer between 1 and 2', 'PORTS_INVALID_COUNT'))
    await expect(ports.allocate({ scope: GLOBAL, purpose: 'ok', preferred: [0] }))
      .rejects.toThrow(new PortError('port must be an integer between 1 and 65535, got 0', 'PORTS_INVALID_PORT'))
  })

  it('releases every lease on a port and reports whether any existed', async () => {
    const { ports } = await harness(TEST_CONFIG)
    await ports.allocate({ scope: GLOBAL, purpose: 'kept' })
    const second = await ports.allocate({ scope: GLOBAL, purpose: 'to-release' })
    const port = second.ports[0]!.port
    expect(await ports.release(port)).toBe(true)
    expect(ports.leases().map(lease => lease.purpose)).toEqual(['kept'])
    expect(await ports.release(port)).toBe(false)
    await expect(ports.release(70_000)).rejects.toThrow(new PortError(
      'port must be an integer between 1 and 65535, got 70000',
      'PORTS_INVALID_PORT',
    ))
  })

  it('builds collision-free composite lease keys', () => {
    expect(leaseKey(GLOBAL, 'x')).toBe('global:x')
    expect(leaseKey(WORKSPACE('ws-1'), 'x')).toBe('workspace:ws-1:x')
    expect(leaseKey(GLOBAL, 'workspace:ws-1:x')).not.toBe(leaseKey(WORKSPACE('ws-1'), 'x'))
  })
})

describe('ports registry lifecycle', () => {
  it('rejects operations before startup and closes its domain on dispose', async () => {
    const pendingCtx = new Context()
    await pendingCtx.plugin(Storage)
    pendingCtx.storage.backend.register('memory', new MemoryStorageBackend())
    const pendingFacility = new DomainFacility(pendingCtx, { backend: 'memory', routes: {} })
    pendingCtx.storage.mount('domain', pendingFacility)
    pendingCtx.provide('storageDomain', pendingFacility)
    const pending = new PortsRegistry(pendingCtx)
    await expect(pending.allocate({ scope: GLOBAL, purpose: 'early' })).rejects.toThrow('ports registry is not started yet')

    const { ctx, fiber, ports } = await harness(TEST_CONFIG)
    await ports.allocate({ scope: GLOBAL, purpose: 'live' })
    await fiber.dispose()
    expect(ctx.storageDomain.get('ports')).toBeUndefined()
  })

  it('fails loud when the ports domain is already open', async () => {
    const { ctx, ports } = await harness(TEST_CONFIG)
    await expect(ctx.storageDomain.open(portsDomainSpec)).rejects.toThrow(/already open/)
    expect(ports.leases()).toHaveLength(0)
  })
})
