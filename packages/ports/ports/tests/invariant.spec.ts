import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry, { InvariantError } from '@deepseek-ai/dsh-invariants'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { DomainChanged } from '@deepseek-ai/dsh-storage-domain'
import * as PortsInvariant from '../src/invariant.ts'
import type { PortLease, PortScope } from '../src/index.ts'

const WORKSPACE: PortScope = { kind: 'workspace', workspaceId: WorkspaceId('ws-invariant') }

const change = (domain: string, table: string, key: string): DomainChanged => ({
  domain,
  table,
  key,
  operation: 'put',
  value: {},
})

const lease = (purpose: string, port: number): PortLease => ({
  scope: WORKSPACE,
  purpose,
  port,
  createdAt: '2026-01-01T00:00:00.000Z',
})

async function mount(leases: readonly PortLease[]): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(InvariantRegistry, { enabled: true })
  ctx.provide('ports', { leases: () => leases } as never)
  await ctx.plugin(PortsInvariant)
  return ctx
}

describe('ports package invariant', () => {
  it('accepts leases whose ports are unique', async () => {
    const ctx = await mount([lease('dev-server', 43000), lease('docs', 43001)])
    expect(() => {
      ctx.emit('domain/changed', change('ports', 'leases', 'workspace:ws-invariant:dev-server'))
    }).not.toThrow()
  })

  it('fails when two leases share a port', async () => {
    const ctx = await mount([lease('dev-server', 43000), lease('docs', 43000)])
    expect(() => {
      ctx.emit('domain/changed', change('ports', 'leases', 'workspace:ws-invariant:docs'))
    }).toThrow(expect.objectContaining<Partial<InvariantError>>({
      code: 'INVARIANT',
      packageName: '@deepseek-ai/dsh-ports',
    }))
  })

  it('ignores writes to other domains and tables', async () => {
    const ctx = await mount([lease('dev-server', 43000), lease('docs', 43000)])
    expect(() => {
      ctx.emit('domain/changed', change('workspace', 'workspaces', 'x'))
    }).not.toThrow()
  })
})
