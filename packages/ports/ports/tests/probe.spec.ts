import { afterEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:net'
import type { Server } from 'node:net'
import { probePort } from '../src/probe.ts'

const openServers: Server[] = []

async function listenOn(port: number): Promise<Server> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen({ port, host: '127.0.0.1' }, resolve)
  })
  return server
}

const closeServer = (server: Server): Promise<void> => new Promise((resolve) => { server.close(() => { resolve() }) })

afterEach(async () => {
  await Promise.allSettled(openServers.splice(0).map(closeServer))
})

describe('port probing', () => {
  it('reports a free port and releases the probe bind', async () => {
    const server = await listenOn(0)
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('expected a TCP address')
    await closeServer(server)
    await expect(probePort(address.port)).resolves.toBe(true)
    // The abort path must have released the bind: the port binds again at once.
    openServers.push(await listenOn(address.port))
  })

  it('reports an occupied port', async () => {
    const server = await listenOn(0)
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('expected a TCP address')
    openServers.push(server)
    await expect(probePort(address.port)).resolves.toBe(false)
  })

  it('resolves false when the probe neither binds nor fails within its budget, and releases a late bind', async () => {
    // Reserve a port we know is free so its listen completes after the fake timeout.
    const free = await listenOn(0)
    const address = free.address()
    if (address === null || typeof address === 'string') throw new Error('expected a TCP address')
    await closeServer(free)

    vi.useFakeTimers()
    const promise = probePort(address.port, 1000)
    vi.runAllTimers()
    await expect(promise).resolves.toBe(false)
    vi.useRealTimers()
    // Let the pending bind land so the late-listening cleanup path runs deterministically.
    await new Promise(resolve => setTimeout(resolve, 50))
    // The late bind was released: the port binds again at once.
    openServers.push(await listenOn(address.port))
  })

  it('ignores a bind error that arrives after the timeout settled the probe', async () => {
    const occupied = await listenOn(0)
    const address = occupied.address()
    if (address === null || typeof address === 'string') throw new Error('expected a TCP address')
    openServers.push(occupied)

    vi.useFakeTimers()
    const promise = probePort(address.port, 1000)
    vi.runAllTimers()
    await expect(promise).resolves.toBe(false)
    vi.useRealTimers()
    // Let the real EADDRINUSE land; the settled probe must ignore it.
    await new Promise(resolve => setTimeout(resolve, 50))
  })
})
