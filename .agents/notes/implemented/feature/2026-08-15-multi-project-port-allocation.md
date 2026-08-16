# Agent Note: Multi-project Port Allocation

Status: implemented

English | [中文](2026-08-15-multi-project-port-allocation.zh.md)

## Problem

Dev servers started inside different project workspaces collide on default ports: two Vite apps both try 5173, a Next app takes 3000 from a React app, and the agent only discovers the conflict after `EADDRINUSE`. Sessions know nothing about each other's servers, restarts lose whatever manual port choice was made, and there is no durable, cross-session place that records which project runs which server role on which port.

## Decision

The harness ships a port lease registry (`ctx.ports`, [dsh-ports](../../../../packages/ports/ports)) and model-facing tools ([dsh-tool-ports](../../../../packages/ports/tool-ports)) so the model allocates before it starts any port-listening server.

### Registry

`ctx.ports` is one host-side `Service` over the [domain data form](../../../../docs/subsystems/storage.md): it opens the `ports` domain (version 1, one `leases` table) and persists one record per (scope, purpose) pair. Scope is `global` or `{ kind: 'workspace', workspaceId }`; uniqueness of assigned ports is registry-global either way, so two projects can never receive the same port. The workspace scope adds per-project stability, not isolation.

Allocation serializes on one in-process write chain (the [workspace registry](../../../../packages/workspace/workspace/src/index.ts) pattern), so the probe-then-persist pair of two concurrent allocations cannot hand out the same port. For a new lease the registry probes candidates with a throwaway loopback bind — first the `preferred` ports in order, then an ascending scan from `minPort` (4000) to `maxPort` (49999) — skipping every already-leased port, OS-occupied ports, and the `avoidPorts` list of popular dev defaults (3000, 5173, 8080, …). An explicit `preferred` port overrides `avoidPorts`; a probe that neither binds nor fails within `probeTimeoutMs` counts as occupied. Records persist before the allocation returns.

The leased port is authoritative for its purpose: re-allocating the same pair returns the same port unchanged (`reused: true`) and never moves it, even when a foreign process took it over — the result flags that state (`inUse`) and the model decides to release and re-allocate. Release is explicit (`release(port)` deletes every lease holding the port). Validation errors carry stable codes (`PORTS_INVALID_PURPOSE`, `PORTS_INVALID_COUNT`, `PORTS_INVALID_PORT`, `PORTS_EXHAUSTED`); config violations reject at load.

### Tools and guidance

`allocate_port(purpose, count?, preferred?)` resolves the calling session's scope — the workspace owning its cwd, falling back to `global` — allocates through `ctx.ports`, and renders one text line per port with the assignment, the scope, the `--port` usage, and the reuse contract. `release_port(port)` frees a port. Both are exclusive. A standing prompt section (`tool:allocate_port`, order 111) instructs the model to allocate before starting any dev server, preview server, or port-listening command, and to release when the server stops.

### Composition

The Web profile mounts the registry beside the storage/domain stack in the [web-app bundle patch](../../../../packages/bundle/web-app/cordis.patch.yml), and the `standard`/`code` agent presets mount the tools. TUI and headless modes compose no storage domain, so the registry stays Web-only.

## Alternatives considered

**Passive conflict detection.** Watch port occupancy and report conflicts after `EADDRINUSE`, suggesting free ports. This leaves every conflict to be discovered at failure time and provides no stability across sessions or restarts; the requested feature is planning ahead of conflicts.

**Automatic command rewriting.** Detect dev-server commands and inject `--port` with a free port. Command grammars vary across frameworks, a false rewrite breaks an unrelated command, and the model loses control over a choice it understands; an explicit tool keeps the assignment a model-visible decision.

**Per-workspace port isolation.** Allocate independently per workspace so the same port may repeat across projects. Two projects then still collide whenever both run servers at once, which is exactly the reported failure; registry-global uniqueness is the guarantee that removes it.

**Auto-move on occupied reuse.** When a reused lease's port is taken over, silently re-allocate and update the lease. A second session checking its project's stable port would then move the lease away from the still-running server it describes; the lease stays authoritative and the `inUse` flag hands the decision to the model.

**Automatic reclamation on process exit.** Track shell background jobs and release leases when their servers die. That couples the registry to the jobs runtime and kills the stability a retained lease buys (a crashed dev server gets its port back on restart); explicit release is the predictable contract.

## Consequences

- **Leases outlive their servers.** A dead server's port stays reserved until `release_port`. That is the stability guarantee — a project keeps its port across sessions and restarts — but stale leases accumulate until the model releases them; automatic reclamation is deferred.
- **Compliance is model behavior.** Guidance says to allocate, but nothing prevents a model from running a server on a raw default port; conflicts with DSH-assigned ports remain possible from non-tool-started processes.
- **Probing is loopback best-effort.** A process bound to a non-loopback interface only can appear free; registry-internal collisions are still impossible because leased ports are never handed out twice.
- **One registry per process.** Two independent dsh processes probe the same OS without sharing leases.
- **The tool never hides the port.** The model still passes the port to its command; the rendered result says so explicitly.

## Verification

- Package tests pin allocation order, lease-authoritative reuse (including the taken-over `inUse` flag), preferred/avoid behavior, exhaustion, serialized concurrency, release, restart persistence, and 100% per-file coverage.
- The tool package pins schemas, scope resolution (workspace, absent registry, unresolvable cwd, unowned directory), error wrapping with stable codes, and registry-disposal safety.
- A keyless ACP snapshot (`examples/acp-agent/tests/ports.snapshot.ts`) replays one purpose allocated twice through the assembled app and pins the rendered "Allocated port … / Reusing port …" transcript.
- The [ports subsystem page](../../../../docs/subsystems/ports.md) documents the scope/lease/request/result vocabulary, and the generated Cordis, tool, and persistence catalogs carry the service and tool schemas.
