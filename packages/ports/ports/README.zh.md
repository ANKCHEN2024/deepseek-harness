# @deepseek-ai/dsh-ports

[English](README.md) | 中文

DeepSeek Harness 的端口租约注册表（`ctx.ports`）：基于领域数据形式的持久化、注册表全局唯一的 TCP 端口分配。一个宿主侧实例服务所有会话与工作区，因此为不同项目启动的 dev server 永远不会拿到同一端口；对同一（作用域，用途）对的再次分配总是返回其先前租约端口——这种稳定性在重启后依然成立。注册表负责校验、探测与持久化；模型可见工具位于 [`@deepseek-ai/dsh-tool-ports`](../tool-ports/README.md)。

## 接口

- `allocate({ scope, purpose, count?, preferred? })` — 为某一（作用域，用途）对记录租约，并返回每个请求端口的一项。已持有持久租约的对原样返回该端口（`reused: true`），只标记当前是否有进程在监听它（`inUse`）；租约端口对该用途具有权威性，绝不自行迁移。新租约先探测操作系统——跳过所有已租约端口、操作系统已占用端口以及配置的 `avoidPorts`——并在持久化之后才返回。`count` 一次分配多个互不相同的端口，追加 `#2`…`#n` 后缀；`preferred` 端口按序优先尝试，并覆盖 `avoidPorts`（显式请求由调用方做主）。
- `release(port)` — 删除持有 `port` 的全部租约（无论作用域或用途），并返回是否存在过租约。
- `leases()` — 从领域内存表同步快照全部持久租约。
- `leaseKey(scope, purpose)` — 复合持久表键；作用域种类是第一段，因此 global 与 workspace 键永不冲突。

作用域为 `{ kind: 'global' }` 或 `{ kind: 'workspace', workspaceId }`。无论作用域如何，端口唯一性都是注册表全局的；workspace 作用域增加的是逐项目稳定性，而非隔离。

全部分配与释放操作在一条进程内写链上串行执行，因此两个并发分配的“先探测后持久化”组合绝不会发出同一端口。错误经 `PortError` 携带稳定 `code`（`PORTS_INVALID_PURPOSE`、`PORTS_INVALID_COUNT`、`PORTS_INVALID_PORT`、`PORTS_EXHAUSTED`）。

`storageDomain` 是必需的启动依赖：注册表打开 `ports` 领域（版本 1，一张 `leases` 表），并在持久化就绪前保持 pending。

## 配置

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

每个值都可随部署调整；默认值属于产品决策。非法值（端口越界、`minPort` 大于 `maxPort`、非正数边界）在加载时即被拒绝。`avoidPorts` 让自动扫描避开常见的 dev-server 默认端口，把其他项目的裸默认端口留空；一次绑定探测在 `probeTimeoutMs` 内既不成功也不失败即视为已占用。

## 模型体验

### 端口租约注册表

#### 模型看到什么

直接看不到任何东西。`ctx.ports` 只服务宿主侧消费者：本包不注册工具、不注入提示词、不写会话事件。模型可见文本全部来自 [`@deepseek-ai/dsh-tool-ports`](../tool-ports/README.md)。

#### Token 影响

每个请求零直接 token。

#### KV Cache 影响

与实时请求无关：本包从不触碰请求前缀，因此不可能破坏 provider 缓存复用。

## 已知限制与待办

- **租约比其服务器长寿** — 释放是显式的（`release_port`）；已死服务器的租约在释放前仍保留其端口，这正是重启稳定性的来源。自动回收已延后。
- **探测是回环尽力而为** — 只绑定非回环接口的进程可能被误判为空闲；但分配永远不会发出已租约端口，因此 DSH 内部的冲突不可能发生。
- **每进程一个注册表** — 两个独立的 dsh 进程探测同一操作系统但不共享租约；若第一个服务器已停止，其中一方分配的端口仍可能被另一方稍后的分配占用。
- **Web 界面的 provider** — 出厂组合将 `ctx.ports` 挂在 Web profile 的存储/领域栈旁；TUI 与 headless 模式不组合存储领域，因此在那里挂载本行会一直 pending。

持久化设计沿用[领域 KV 存储 Agent Note](../../../.agents/notes/proposed/architecture/2026-07-24-domain-kv-storage-and-workspace.md)；产品决策见[多项目端口分配 Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-multi-project-port-allocation.md)。
