# ports/ — port lease family

English | [中文](README.zh.md)

This family owns durable TCP port allocation: one shared registry that hands out non-colliding ports across every workspace and session, and the model-facing tools that allocate before starting servers.

| Package | Role | ctx key |
|---|---|---|
| [`ports/`](ports/README.md) | Durable port lease registry: validation, loopback probing, and allocation | `ctx.ports` |
| [`tool-ports/`](tool-ports/README.md) | Model-facing `allocate_port` / `release_port` tools plus standing guidance | — |

The [registry package reference](ports/README.md) owns allocation semantics, durability, and failure modes; the [tool package reference](tool-ports/README.md) owns schemas, scope resolution, and model-visible text.

The subsystem reference — scopes, leases, and the allocation rules — is [docs/subsystems/ports.md](../../docs/subsystems/ports.md).
