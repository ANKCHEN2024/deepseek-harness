# ports/ — 端口租约家族

[English](README.md) | 中文

该家族拥有持久化 TCP 端口分配能力：一个跨所有工作区与会话共享的注册表，发放互不冲突的端口；以及对应的模型工具，供模型在启动服务器前完成分配。

| 包 | 角色 | ctx 键 |
|---|---|---|
| [`ports/`](ports/README.md) | 持久化端口租约注册表：校验、回环探测与分配 | `ctx.ports` |
| [`tool-ports/`](tool-ports/README.md) | 模型可见的 `allocate_port` / `release_port` 工具与常驻指引 | — |

[注册表包参考](ports/README.md)负责分配语义、持久化与失败模式；[工具包参考](tool-ports/README.md)负责工具 schema、作用域解析与模型可见文本。

子系统参考——作用域、租约与分配规则——见 [docs/subsystems/ports.md](../../docs/subsystems/ports.md)。
