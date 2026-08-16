/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-ports`.
 * @module @deepseek-ai/dsh-ports/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import type { DomainChanged } from '@deepseek-ai/dsh-storage-domain'
import { leaseKey } from '@deepseek-ai/dsh-ports'

const PACKAGE_NAME = '@deepseek-ai/dsh-ports'

/** Cordis companion plugin name. */
export const name = 'ports-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * Owned relationship: port uniqueness across every lease. Each
 * `domain/changed` write to the `ports` domain re-folds the registry's
 * complete lease set; two records sharing a port would prove an allocation
 * path that bypassed the registry's write chain.
 */
const install: InvariantInstaller = Object.assign(
  (ctx: Context, fail: (message: string) => never) => {
    ctx.on('domain/changed', (change: DomainChanged) => {
      if (change.domain !== 'ports' || change.table !== 'leases') return
      const byPort = new Map<number, string>()
      for (const lease of ctx.ports.leases()) {
        const key = leaseKey(lease.scope, lease.purpose)
        const holder = byPort.get(lease.port)
        if (holder !== undefined) {
          fail(`port ${lease.port} is leased by both '${holder}' and '${key}' — an allocation bypassed the ports registry`)
        }
        byPort.set(lease.port, key)
      }
    })
  },
  { inject: ['ports'] },
)

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
