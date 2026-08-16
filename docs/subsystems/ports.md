# Port Allocation

[中文](ports.zh.md) | English

The port allocation subsystem assigns durable, registry-globally unique TCP ports to server roles across every workspace and session. One host-side registry (`ctx.ports`, package [dsh-ports](../../packages/ports/ports)) owns validation, loopback probing, and persistence over the [domain data form](storage.md); the model-facing consumer [dsh-tool-ports](../../packages/ports/tool-ports) resolves the calling session's scope, allocates before the model starts any port-listening server, and releases when the server stops. The product decision lives in the [multi-project port allocation Agent Note](../../.agents/notes/implemented/feature/2026-08-15-multi-project-port-allocation.md).

## Scopes

```ts type-equiv
/**
 * Who a port lease is recorded for. Workspace scope keeps one project's
 * allocations stable across sessions; the global scope covers directories no
 * workspace registry owns. Uniqueness of assigned ports is registry-global
 * regardless of scope, so two projects can never receive the same port.
 */
type PortScope =
  | { readonly kind: 'global' }
  | { readonly kind: 'workspace'; readonly workspaceId: WorkspaceId }
```

The scope kinds are the first token of the durable lease key, so global and workspace keys never collide. The workspace scope adds per-project port stability, not isolation.

## Leases

```ts type-equiv
/**
 * One durable port lease: the port assigned to one (scope, purpose) pair.
 * The record never mutates after creation — a new allocation for the same
 * key reuses the port as-is, and release deletes the record.
 */
interface PortLease {
  /** The scope the lease was recorded for. */
  readonly scope: PortScope
  /** The server role the port was assigned to, as given at allocation. */
  readonly purpose: string
  /** The assigned TCP port. */
  readonly port: number
  /** ISO-8601 creation instant of the durable record. */
  readonly createdAt: string
}
```

A lease is stored once at allocation under the composite key `leaseKey(scope, purpose)` in the `ports` domain (version 1, one `leases` table) and deleted at release. The leased port is authoritative for its purpose: re-allocating the same pair returns the same port unchanged and never moves it, even when a foreign process took the port over — the allocation result only flags that state (`inUse`) so the model can decide to release and re-allocate.

## Allocation requests and results

```ts type-equiv
/**
 * One allocation request from a consumer (the model tool is the primary one).
 * `count` allocates several distinct ports at once; each extra port's lease
 * purpose gets a `#2`…`#n` suffix.
 */
interface AllocatePortRequest {
  /** The scope to record the lease under. */
  readonly scope: PortScope
  /** Stable label for the server role, e.g. `dev-server` or `docs-preview`. */
  readonly purpose: string
  /** How many ports to allocate. Defaults to 1. */
  readonly count?: number
  /** Ports to try first, in order; each must be free and unassigned. */
  readonly preferred?: readonly number[]
}
```

```ts type-equiv
/** The complete allocation outcome for one request. */
interface AllocatePortResult {
  /** The scope the leases were recorded under. */
  readonly scope: PortScope
  /** One entry per requested port, in allocation order. */
  readonly ports: readonly AllocatedPort[]
}
```

`AllocatedPort` carries `port`, `purpose`, `reused`, and `inUse` per entry.

## The registry: `ctx.ports`

[`PortsRegistry`](#ctxports--portsregistry) opens the `ports` domain at startup and serializes every allocation and release on one in-process write chain, so the probe-then-persist pair of two concurrent allocations can never hand out the same port. For a new lease the registry probes candidates with a throwaway loopback bind — first the `preferred` ports in order (an explicit preference overrides `avoidPorts`), then the ascending scan from `minPort` to `maxPort`, skipping every already-leased port, OS-occupied ports, and the `avoidPorts` list — and persists the record before returning. A probe that neither binds nor fails within `probeTimeoutMs` counts as occupied.

Validation rejects blank or oversized purposes, out-of-range counts, and out-of-range ports with a `PortError` whose stable `code` is `PORTS_INVALID_PURPOSE`, `PORTS_INVALID_COUNT`, `PORTS_INVALID_PORT`, or `PORTS_EXHAUSTED` (no free candidate in the configured range). `release(port)` deletes every lease holding that port; `leases()` snapshots the durable table. Config validation (`minPort`/`maxPort` bounds, positive limits) rejects at load.

## Consumers

[dsh-tool-ports](../../packages/ports/tool-ports) is the product consumer: `allocate_port` resolves the workspace owning the session cwd (falling back to `global`), allocates, and renders the assignment; `release_port` frees a port. The shipped Web composition mounts the registry beside the storage/domain stack in the [web-app bundle patch](../../packages/bundle/web-app/cordis.patch.yml) and the tools in the `standard`/`code` agent presets.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxports--portsregistry"></a>

### `ctx.ports` — `PortsRegistry`

The port-lease registry. Startup waits for `storageDomain`, opens the `ports` domain, and only then serves allocations; the persistence dependency is mandatory so an unavailable peer can never be mistaken for an empty lease set. All allocation and release operations serialize on one in-process write chain: the probe-then-persist pair of two concurrent allocations can therefore never hand out the same port.

```ts cordis-catalog
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
allocate(request: AllocatePortRequest): Promise<AllocatePortResult>

/**
 * Release every lease that holds `port`, whatever its scope or purpose.
 * @param port - The leased port to free.
 * @returns `true` when at least one lease was deleted.
 */
release(port: number): Promise<boolean>

/**
 * Synchronous snapshot of every durable lease. Reads the domain's
 * in-memory table; no persistence reads.
 * @returns the lease records in storage order.
 */
leases(): readonly PortLease[]
```

Source: [`packages/ports/ports/src/index.ts:111`](../../packages/ports/ports/src/index.ts)
<!-- END GENERATED cordis-surface -->
