# @deepseek-ai/dsh-ports

English | [中文](README.zh.md)

Port lease registry (`ctx.ports`) for the DeepSeek Harness: durable, registry-globally unique TCP port allocations over the domain data form. One host-side instance serves every session and workspace, so dev servers started for different projects can never receive the same port; re-allocating the same (scope, purpose) pair always returns its previously leased port, the stability that survives restarts. The registry owns validation, probing, and durability; the model-facing tools live in [`@deepseek-ai/dsh-tool-ports`](../tool-ports/README.md).

## Shape

- `allocate({ scope, purpose, count?, preferred? })` — records the lease for one (scope, purpose) pair and returns one entry per requested port. A pair that already holds a durable lease returns that port unchanged (`reused: true`) and only flags whether a process currently listens on it (`inUse`); the leased port is authoritative for its purpose and never moves by itself. New leases probe the OS first — skipping every already-leased port, OS-occupied ports, and the configured `avoidPorts` — then persist before returning. `count` allocates several distinct ports, suffixed `#2`…`#n`; `preferred` ports are tried first, in order, and override `avoidPorts` (an explicit request is the caller's call).
- `release(port)` — deletes every lease that holds `port`, whatever its scope or purpose, and returns whether any existed.
- `leases()` — synchronous snapshot of every durable lease from the domain's in-memory table.
- `leaseKey(scope, purpose)` — the composite durable table key; the scope kind is the first token, so global and workspace keys never collide.

Scopes are `{ kind: 'global' }` or `{ kind: 'workspace', workspaceId }`. Port uniqueness is registry-global regardless of scope; the workspace scope adds per-project stability, not isolation.

All allocation and release operations serialize on one in-process write chain, so the probe-then-persist pair of two concurrent allocations can never hand out the same port. Errors carry a stable `code` (`PORTS_INVALID_PURPOSE`, `PORTS_INVALID_COUNT`, `PORTS_INVALID_PORT`, `PORTS_EXHAUSTED`) through `PortError`.

`storageDomain` is a required startup dependency: the registry opens the `ports` domain (version 1, one `leases` table) and stays pending until persistence can serve it.

## Config

```yaml
- id: ports
  name: '@deepseek-ai/dsh-ports'
  config:
    minPort: 4000
    maxPort: 49999
    avoidPorts: [3000, 3001, 4200, 5173, 5174, 8000, 8080, 8888, 9000]
    maxPurposeChars: 64
    maxCountPerAllocate: 4
    probeTimeoutMs: 1000
```

Every value is deployment-tunable; the defaults are product choices. Invalid values (out-of-range ports, `minPort` above `maxPort`, non-positive bounds) reject at load. `avoidPorts` keeps the automatic scan away from well-known dev-server defaults so other projects' bare defaults stay free; a bind probe that neither succeeds nor fails within `probeTimeoutMs` counts as occupied.

## Model Experience

### Port lease registry

#### What the model sees

Nothing directly. `ctx.ports` serves allocations to host-side consumers only: the package registers no tools, injects no prompts, and writes no session events. Model-visible text comes exclusively from [`@deepseek-ai/dsh-tool-ports`](../tool-ports/README.md).

#### Token effect

Zero direct tokens on every request.

#### KV Cache effect

Independent of live requests: the package never touches a request prefix, so it cannot invalidate provider cache reuse.

## Known Limitations and Deferred Work

- **Leases outlive their servers** — release is explicit (`release_port`); a lease for a dead server still reserves its port until released, which is what keeps restarts stable. Automatic reclamation is deferred.
- **Probing is loopback best-effort** — a process bound to a non-loopback interface only can appear free; allocation still never hands out a leased port, so DSH-internal collisions are impossible.
- **One registry per process** — two independent dsh processes probe the same OS but do not share leases; a port allocated in one can still be claimed by the other's later allocation if the first server stopped.
- **Web-surface provider** — the shipped composition mounts `ctx.ports` beside the storage/domain stack of the Web profile; TUI and headless modes compose no storage domain, so mounting this row there leaves it pending.

The persistence design follows the [domain KV storage Agent Note](../../../.agents/notes/proposed/architecture/2026-07-24-domain-kv-storage-and-workspace.md); the product decision lives in the [multi-project port allocation Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-multi-project-port-allocation.md).
