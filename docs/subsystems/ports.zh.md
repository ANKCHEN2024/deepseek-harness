# 端口分配

中文 | [English](ports.md)

端口分配子系统为跨所有工作区与会话的服务器角色分配持久化、注册表全局唯一的 TCP 端口。一个宿主侧注册表（`ctx.ports`，包 [dsh-ports](../../packages/ports/ports)）负责校验、回环探测与基于[领域数据形式](storage.md)的持久化；模型可见消费者 [dsh-tool-ports](../../packages/ports/tool-ports) 解析当前会话的作用域，在模型启动任何监听端口的服务器之前完成分配，并在服务器停止时释放。产品决策见[多项目端口分配 Agent Note](../../.agents/notes/implemented/feature/2026-08-15-multi-project-port-allocation.md)。

## 作用域

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

作用域种类是持久租约键的第一段，因此 global 与 workspace 键永不冲突。workspace 作用域增加的是逐项目端口稳定性，而非隔离。

## 租约

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

租约在分配时以复合键 `leaseKey(scope, purpose)` 写入 `ports` 领域（版本 1，一张 `leases` 表），在释放时删除。租约端口对该用途具有权威性：对同一对的再次分配原样返回同一端口且绝不迁移，即使端口已被外部进程占用——分配结果只标记该状态（`inUse`），由模型决定是否释放后重新分配。

## 分配请求与结果

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

`AllocatedPort` 逐项携带 `port`、`purpose`、`reused` 与 `inUse`。

## 注册表：`ctx.ports`

[`PortsRegistry`](#ctxports--portsregistry) 在启动时打开 `ports` 领域，并把每次分配与释放在一条进程内写链上串行执行，因此两个并发分配的“先探测后持久化”组合绝不会发出同一端口。对新租约，注册表用一次性回环绑定探测候选端口——先按序尝试 `preferred`（显式偏好覆盖 `avoidPorts`），再从 `minPort` 到 `maxPort` 升序扫描，跳过所有已租约端口、操作系统已占用端口与 `avoidPorts` 列表——并在返回前完成持久化。一次探测在 `probeTimeoutMs` 内既不绑定成功也不失败即视为已占用。

校验拒绝空白或超长用途、越界数量与越界端口，抛出携带稳定 `code` 的 `PortError`：`PORTS_INVALID_PURPOSE`、`PORTS_INVALID_COUNT`、`PORTS_INVALID_PORT` 或 `PORTS_EXHAUSTED`（配置范围内没有空闲候选）。`release(port)` 删除持有该端口的全部租约；`leases()` 快照持久表。配置校验（`minPort`/`maxPort` 边界、正数限制）在加载时拒绝。

## 消费者

[dsh-tool-ports](../../packages/ports/tool-ports) 是产品消费者：`allocate_port` 解析拥有会话 cwd 的工作区（回退到 `global`）、完成分配并渲染结果；`release_port` 释放端口。出厂 Web 组合在 [web-app bundle patch](../../packages/bundle/web-app/cordis.patch.yml) 中把注册表挂在存储/领域栈旁，并在 `standard`/`code` 智能体预设中挂载工具。

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
