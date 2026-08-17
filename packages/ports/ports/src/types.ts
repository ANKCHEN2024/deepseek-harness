/**
 * Public type vocabulary of the port-lease registry: the scope a lease belongs
 * to, the durable lease record, and the allocation request/result pair. Types
 * only — this file carries no runtime code.
 * @module @deepseek-ai/dsh-ports/src/types
 */

import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'

/**
 * Who a port lease is recorded for. Workspace scope keeps one project's
 * allocations stable across sessions; the global scope covers directories no
 * workspace registry owns. Uniqueness of assigned ports is registry-global
 * regardless of scope, so two projects can never receive the same port.
 */
export type PortScope =
  | { readonly kind: 'global' }
  | { readonly kind: 'workspace'; readonly workspaceId: WorkspaceId }

/**
 * One durable port lease: the port assigned to one (scope, purpose) pair.
 * The record never mutates after creation — a new allocation for the same
 * key reuses the port as-is, and release deletes the record.
 */
export interface PortLease {
  /** The scope the lease was recorded for. */
  readonly scope: PortScope
  /** The server role the port was assigned to, as given at allocation. */
  readonly purpose: string
  /** The assigned TCP port. */
  readonly port: number
  /** ISO-8601 creation instant of the durable record. */
  readonly createdAt: string
}

/**
 * One allocation request from a consumer (the model tool is the primary one).
 * `count` allocates several distinct ports at once; each extra port's lease
 * purpose gets a `#2`…`#n` suffix.
 */
export interface AllocatePortRequest {
  /** The scope to record the lease under. */
  readonly scope: PortScope
  /** Stable label for the server role, e.g. `dev-server` or `docs-preview`. */
  readonly purpose: string
  /** How many ports to allocate. Defaults to 1. */
  readonly count?: number
  /** Ports to try first, in order; each must be free and unassigned. */
  readonly preferred?: readonly number[]
}

/** One allocated port as reported back to the caller. */
export interface AllocatedPort {
  /** The assigned port. */
  readonly port: number
  /** The lease purpose this port was recorded under. */
  readonly purpose: string
  /** Whether a durable lease for this purpose already existed (stability reuse). */
  readonly reused: boolean
  /** Whether a process was accepting connections on the port at allocation time (advisory). */
  readonly inUse: boolean
}

/** The complete allocation outcome for one request. */
export interface AllocatePortResult {
  /** The scope the leases were recorded under. */
  readonly scope: PortScope
  /** One entry per requested port, in allocation order. */
  readonly ports: readonly AllocatedPort[]
}
