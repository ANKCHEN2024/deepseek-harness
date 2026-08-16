/**
 * Local TCP port probing: bind-test one port on the IPv4 loopback to learn
 * whether a process already accepts connections there. Best effort — the
 * registry treats an unresolved probe as occupied, so allocation never hands
 * out a port it could not verify.
 * @module @deepseek-ai/dsh-ports/src/probe
 */

import { createServer } from 'node:net'

/** Default probe budget: an unanswered bind attempt counts as occupied. */
export const DEFAULT_PROBE_TIMEOUT_MS = 1000

/** The loopback address probes bind; dev servers listening on any local interface still answer here. */
const PROBE_HOST = '127.0.0.1'

/**
 * Probe whether one TCP port is free on the IPv4 loopback. Binds a throwaway
 * server, resolves `true` when the bind succeeds, and closes it again. A
 * failed bind (port in use or unprivileged), or a bind that neither succeeds
 * nor fails within `timeoutMs`, resolves `false`.
 * @param port - The TCP port to probe.
 * @param timeoutMs - Bound on the whole probe; defaults to
 *   {@link DEFAULT_PROBE_TIMEOUT_MS}.
 * @returns whether the port accepted the probe bind.
 */
export function probePort(port: number, timeoutMs: number = DEFAULT_PROBE_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.unref()
    let settled = false
    const finish = (free: boolean): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(free)
      if (server.listening) server.close(() => {})
    }
    const timer = setTimeout(() => { finish(false) }, timeoutMs)
    timer.unref()
    server.once('error', () => { finish(false) })
    server.once('listening', () => {
      // A timeout may already have settled the probe; a bind that lands late
      // must still release its port.
      if (settled) {
        server.close(() => {})
        return
      }
      finish(true)
    })
    server.listen({ port, host: PROBE_HOST })
  })
}
