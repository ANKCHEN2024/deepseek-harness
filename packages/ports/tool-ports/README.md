# @deepseek-ai/dsh-tool-ports

English | [中文](README.zh.md)

The model-facing port tools for [`ctx.ports`](../ports/README.md): `allocate_port` and `release_port`, plus the standing guidance section that tells the model to allocate before starting any port-listening server. This package owns schemas, validation, scope resolution, prompt guidance, and presentation, never probing or durability — those live in the registry. The product decision lives in the [multi-project port allocation Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-multi-project-port-allocation.md).

## Tools

- `allocate_port(purpose, count?, preferred?)` resolves the calling session's scope, allocates through `ctx.ports`, and reports one entry per port with its assignment, the scope label, and the stable-reuse contract. The scope is the workspace owning the session cwd (`workspace "<title>"` label) or `global` when no workspace registry is mounted, the cwd is absent or unresolvable, or no workspace owns the directory. Reused leases whose port a process now occupies carry an explicit escape hatch: release, then allocate again.
- `release_port(port)` frees every lease on `port` and reports whether any existed.

Both calls are exclusive, so a model-ordered batch observes earlier mutations. UI clients receive pure generic cards titled by the purpose or port; the result renders as plain text, with no structured card.

## Prompt

The package registers one standing guidance section, `tool:allocate_port` (quoted under Model Experience).

## Config

```yaml
- id: tool-ports
  name: '@deepseek-ai/dsh-tool-ports'
  config:
    allocateTimeoutMs: 30000
    releaseTimeoutMs: 10000
```

Both values must be positive integers; they are the cooperative tool-call budgets attached as `ToolDefinition.timeoutMs` for `@deepseek-ai/dsh-tool-call-timeout-policy` to enforce. Registry errors surface with their stable `PortError` code; non-registry failures propagate unchanged.

## Model Experience

### System prompt

#### What the model sees

The standing guidance section `tool:allocate_port`, on every request where this plugin's prompt registration is in scope:

##### Port allocation guidance

```markdown
Before starting a dev server, preview server, or any long-running command that listens on a TCP port, call allocate_port with a stable purpose label for that server and pass the allocated port to the command (e.g. `pnpm dev --port <port>`). Ports are shared across every project workspace, so allocations never collide; the same project and purpose reuse the same port across sessions. Call release_port when the server stops so its port can be allocated again.
```

#### Token effect

Small fixed input cost per request.

#### KV Cache effect

Prefix-stable while the guidance text and the plugin scope are unchanged.

### Tool schemas and results

#### What the model sees

The generated [`allocate_port` and `release_port` schemas](../../../docs/tool-catalog.md#deepseek-aidsh-tool-ports). Results are plain text: one line per port naming the assignment, the scope, the `--port` usage, the reuse contract, and — when the leased port was taken over — the reallocation escape hatch. Allocations write the ports domain durably without queuing model context.

#### Token effect

Fixed schema cost plus one short text result per call.

#### KV Cache effect

Schemas are prefix-stable while their definitions and visibility are unchanged. Calls and results append after the reusable request prefix without invalidating earlier entries.

## Known Limitations and Deferred Work

- **Tooling cannot start servers** — the tools only assign ports; the model still has to pass the port to its command. Guidance says so, but compliance remains model behavior.
- **No automatic release on process exit** — leases outlive their servers until `release_port`; the registry has no process-tree liveness view to reclaim them.
- **Workspace scope depends on the registry** — without `@deepseek-ai/dsh-workspace` in the host composition every allocation is global-scoped; uniqueness still holds.
