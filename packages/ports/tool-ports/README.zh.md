# @deepseek-ai/dsh-tool-ports

[English](README.md) | 中文

面向 [`ctx.ports`](../ports/README.md) 的模型端口工具：`allocate_port` 与 `release_port`，外加一段常驻指引，告诉模型在启动任何监听端口的服务器之前先完成分配。本包负责工具 schema、校验、作用域解析、提示词指引与展示，从不负责探测或持久化——这些都在注册表中。产品决策见[多项目端口分配 Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-multi-project-port-allocation.md)。

## 工具

- `allocate_port(purpose, count?, preferred?)` 解析当前会话的作用域，通过 `ctx.ports` 完成分配，并逐端口报告分配结果、作用域标签与稳定复用契约。作用域是拥有会话 cwd 的工作区（标签为 `workspace "<title>"`）；当宿主没有挂载工作区注册表、cwd 缺失或不可解析、或没有工作区拥有该目录时，为 `global`。被其他进程占用的复用租约端口会附带明确的逃生通道：先 release，再重新 allocate。
- `release_port(port)` 释放 `port` 上的全部租约，并报告是否存在过租约。

两个调用都是互斥的，因此模型顺序发出的一批调用能观察到先前的变更。UI 客户端收到以用途或端口为标题的普通 generic 卡片；结果以纯文本渲染，没有结构化卡片。

## 提示词

本包注册一段常驻指引，名为 `tool:allocate_port`（全文见模型体验）。

## 配置

```yaml
- id: tool-ports
  name: '@deepseek-ai/dsh-tool-ports'
  config:
    allocateTimeoutMs: 30000
    releaseTimeoutMs: 10000
```

两个值都必须是正整数；它们作为 `ToolDefinition.timeoutMs` 附在工具上，由 `@deepseek-ai/dsh-tool-call-timeout-policy` 执行协作超时预算。注册表错误以稳定的 `PortError` code 呈现；非注册表失败原样传播。

## 模型体验

### 系统提示词

#### 模型看到什么

常驻指引小节 `tool:allocate_port`，凡本插件提示词注册生效的请求都携带：

##### 端口分配指引

```markdown
Before starting a dev server, preview server, or any long-running command that listens on a TCP port, call allocate_port with a stable purpose label for that server and pass the allocated port to the command (e.g. `pnpm dev --port <port>`). Ports are shared across every project workspace, so allocations never collide; the same project and purpose reuse the same port across sessions. Call release_port when the server stops so its port can be allocated again.
```

#### Token 影响

每个请求固定的小额输入成本。

#### KV Cache 影响

指引文本与插件作用域不变时前缀稳定。

### 工具 schema 与结果

#### 模型看到什么

生成的 [`allocate_port` 与 `release_port` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-ports)。结果为纯文本：每个端口一行，写明分配结果、作用域、`--port` 用法、复用契约，以及租约端口被占用时的重新分配逃生通道。分配持久写入 ports 领域，不排队任何模型上下文。

#### Token 影响

固定 schema 成本加每次调用一段简短文本结果。

#### KV Cache 影响

schema 定义与可见性不变时前缀稳定。调用与结果追加在可复用请求前缀之后，不会使之前的条目失效。

## 已知限制与待办

- **工具不能启动服务器** — 工具只分配端口；模型仍需把端口传给命令。指引已写明，但遵守仍取决于模型行为。
- **进程退出不自动释放** — 租约比其服务器长寿，直到 `release_port`；注册表没有进程树存活视图可自动回收。
- **workspace 作用域依赖注册表** — 宿主组合中没有 `@deepseek-ai/dsh-workspace` 时，所有分配都是全局作用域；唯一性依然成立。
