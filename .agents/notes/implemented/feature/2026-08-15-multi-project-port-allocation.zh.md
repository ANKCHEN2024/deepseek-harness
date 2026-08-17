# Agent Note: 多项目端口分配

Status: implemented

[English](2026-08-15-multi-project-port-allocation.md) | 中文

## Problem

不同项目工作区里启动的 dev server 会在默认端口上打架：两个 Vite 应用都抢 5173，Next 应用从 React 应用手里拿走 3000，而智能体只有在 `EADDRINUSE` 之后才发现冲突。会话之间互不知道对方的服务器，重启会丢失之前人工选择的端口，也没有一个持久的、跨会话的位置记录“哪个项目把哪个服务器角色跑在哪个端口”。

## Decision

Harness 交付一个端口租约注册表（`ctx.ports`，[dsh-ports](../../../../packages/ports/ports)）和模型可见工具（[dsh-tool-ports](../../../../packages/ports/tool-ports)），让模型在启动任何监听端口的服务器之前先完成分配。

### 注册表

`ctx.ports` 是位于[领域数据形式](../../../../docs/subsystems/storage.md)之上的一个宿主侧 `Service`：它打开 `ports` 领域（版本 1，一张 `leases` 表），为每个（作用域，用途）对持久化一条记录。作用域是 `global` 或 `{ kind: 'workspace', workspaceId }`；无论哪种作用域，已分配端口的唯一性都是注册表全局的，因此两个项目永远不会拿到同一端口。workspace 作用域增加的是逐项目稳定性，而非隔离。

分配在一条进程内写链上串行执行（沿用[工作区注册表](../../../../packages/workspace/workspace/src/index.ts)的模式），因此两个并发分配的“先探测后持久化”组合不可能发出同一端口。对新租约，注册表用一次性回环绑定探测候选端口——先按序尝试 `preferred`，再从 `minPort`（4000）到 `maxPort`（49999）升序扫描——跳过所有已租约端口、操作系统已占用端口，以及流行 dev 默认端口的 `avoidPorts` 列表（3000、5173、8080、……）。显式 `preferred` 端口覆盖 `avoidPorts`；一次探测在 `probeTimeoutMs` 内既不绑定成功也不失败即视为已占用。记录在分配返回之前完成持久化。

租约端口对其用途具有权威性：对同一对的再次分配原样返回同一端口（`reused: true`）且绝不迁移，即使端口已被外部进程占用——结果只标记该状态（`inUse`），由模型决定是否释放后重新分配。释放是显式的（`release(port)` 删除持有该端口的全部租约）。校验错误携带稳定 code（`PORTS_INVALID_PURPOSE`、`PORTS_INVALID_COUNT`、`PORTS_INVALID_PORT`、`PORTS_EXHAUSTED`）；配置违规在加载时拒绝。

### 工具与指引

`allocate_port(purpose, count?, preferred?)` 解析当前会话的作用域——拥有其 cwd 的工作区，回退到 `global`——经 `ctx.ports` 完成分配，并逐端口渲染一行文本：分配结果、作用域、`--port` 用法与复用契约。`release_port(port)` 释放端口。两者都是互斥调用。一段常驻提示词（`tool:allocate_port`，order 111）指示模型在启动任何 dev server、预览服务器或监听端口的命令之前先分配，并在服务器停止时释放。

### 组合

Web profile 在 [web-app bundle patch](../../../../packages/bundle/web-app/cordis.patch.yml) 中把注册表挂在存储/领域栈旁，`standard`/`code` 智能体预设挂载工具。TUI 与 headless 模式不组合存储领域，因此注册表仅限 Web。

## Alternatives considered

**被动冲突检测。** 监视端口占用，在 `EADDRINUSE` 之后报告冲突并建议空闲端口。这让每个冲突都只能到失败时才被发现，也不提供跨会话或重启的稳定性；而需求是提前规划、避免冲突。

**自动改写命令。** 识别 dev-server 命令并注入 `--port` 空闲端口。各框架命令语法不一，一次误判会破坏无关命令，模型也会失去对自身理解的选择的控制；显式工具让分配保持为模型可见的决策。

**按工作区隔离端口。** 各工作区独立分配，同一端口可以在不同项目间重复。这样两个项目同时跑服务器时依然冲突，而这正是被报告的问题；注册表全局唯一性才是移除该问题的保证。

**占用时自动迁移。** 复用租约的端口被占用时，静默重新分配并更新租约。第二个会话查询其项目稳定端口时，会把租约从它所描述的仍在运行的服务器上挪走；租约保持权威，`inUse` 标志把决策交给模型。

**进程退出自动回收。** 跟踪 shell 后台任务，在服务器死亡时释放租约。这把注册表耦合到任务运行时，并杀死保留租约所换来的稳定性（崩溃的 dev server 重启后拿回自己的端口）；显式释放才是可预测的契约。

## Consequences

- **租约比其服务器长寿。** 已死服务器的端口在 `release_port` 之前保持保留。这是稳定性保证——项目跨会话与重启保留端口——但陈旧租约会积累到模型释放为止；自动回收已延后。
- **遵守取决于模型行为。** 指引要求先分配，但没有什么阻止模型在裸默认端口上跑服务器；未经工具启动的进程仍可能与 DSH 分配的端口冲突。
- **探测是回环尽力而为。** 只绑定非回环接口的进程可能被误判为空闲；注册表内部冲突依然不可能，因为已租约端口绝不会被二次发放。
- **每进程一个注册表。** 两个独立的 dsh 进程探测同一操作系统而不共享租约。
- **工具从不隐藏端口。** 模型仍需把端口传给命令；渲染结果明确写明这一点。

## Verification

- 包测试钉住分配顺序、租约权威复用（含被占用的 `inUse` 标志）、preferred/avoid 行为、耗尽、并发串行化、释放、重启持久化，并达到逐文件 100% 覆盖。
- 工具包钉住 schema、作用域解析（工作区、无注册表、cwd 不可解析、目录无人拥有）、稳定 code 的错误包装与注册表销毁安全。
- 一个 keyless ACP 快照（`examples/acp-agent/tests/ports.snapshot.ts`）通过组装应用重放“同一用途分配两次”，并钉住渲染出的 “Allocated port … / Reusing port …” 转录。
- [ports 子系统页](../../../../docs/subsystems/ports.md)记录作用域/租约/请求/结果词汇；生成的 Cordis、工具与持久化目录携带服务与工具 schema。
