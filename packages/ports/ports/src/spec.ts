/**
 * The ports domain declaration: the durable record schema and the
 * `defineDomain` spec the registry opens. The zod schema is the
 * durable-boundary validator; the domain name, version, and table names are
 * the single source of the domain's identity.
 * @module @deepseek-ai/dsh-ports/src/spec
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'

/** Workspace id schema at the durable boundary; branding has no runtime representation. */
const workspaceId = z.string().transform(value => value as WorkspaceId)

/**
 * Durable shape of one lease record. The record is written once at allocation
 * and deleted at release; `port` uniqueness across every record is the
 * registry's core invariant, enforced by the allocation write chain and
 * re-checked by the package invariant.
 */
export const portLeaseRecord = z.object({
  scope: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('global') }),
    z.object({ kind: z.literal('workspace'), workspaceId }),
  ]),
  purpose: z.string(),
  port: z.number().int().min(1).max(65535),
  createdAt: z.string(),
})

/** One stored lease record, inferred from {@link portLeaseRecord}. */
export type PortLeaseRecord = z.infer<typeof portLeaseRecord>

/**
 * The ports domain spec: one `leases` table keyed by the composite
 * scope/purpose key. The registry opens this through `ctx.storageDomain`;
 * the spec object is the single source of the domain's identity, version,
 * and schemas.
 */
export const portsDomainSpec = defineDomain({
  name: 'ports',
  version: 1,
  tables: { leases: domainTable<string, PortLeaseRecord>(portLeaseRecord) },
})
