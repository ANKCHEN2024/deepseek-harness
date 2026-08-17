import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { CallId } from '@deepseek-ai/dsh-llm'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { PortError } from '@deepseek-ai/dsh-ports'
import type { AllocatePortRequest, AllocatePortResult } from '@deepseek-ai/dsh-ports'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { ToolExecutionInput, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import * as ToolPorts from '@deepseek-ai/dsh-tool-ports'
import {
  formatAllocateOutput,
  formatReleaseOutput,
  parseAllocateArgs,
  parseReleaseArgs,
  presentAllocateCall,
  presentReleaseCall,
  resolvePortScope,
} from '@deepseek-ai/dsh-tool-ports'

const testToolSignal = new AbortController().signal

const allocated = (request: AllocatePortRequest, port: number): AllocatePortResult => ({
  scope: request.scope,
  ports: [{ port, purpose: request.purpose, reused: false, inUse: false }],
})

const agent = (cwd: string | undefined): ToolExecutionInput['agent'] =>
  ({ session: { header: { cwd } } }) as unknown as ToolExecutionInput['agent']

interface MountOptions {
  config?: ToolPorts.Config
  allocate?: (request: AllocatePortRequest) => Promise<AllocatePortResult>
  release?: (port: number) => Promise<boolean>
  workspaceRegistry?: { resolveByPath: (path: string) => Promise<{ id: string; title: string } | undefined> }
}

async function mount(options: MountOptions = {}): Promise<{
  ctx: Context
  fiber: Awaited<ReturnType<Context['plugin']>>
  allocate: NonNullable<MountOptions['allocate']>
  release: NonNullable<MountOptions['release']>
  call: (name: string, args: unknown, agent?: ToolExecutionInput['agent']) => Promise<ToolExecutionResult>
}> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  const allocate = options.allocate ?? vi.fn(async (request: AllocatePortRequest) => allocated(request, 43000))
  const release = options.release ?? vi.fn(async () => true)
  ctx.provide('ports', { allocate, release } as never)
  if (options.workspaceRegistry !== undefined) ctx.provide('workspaceRegistry', options.workspaceRegistry as never)
  const fiber = await ctx.plugin(ToolPorts, options.config ?? {})
  let counter = 0
  const call = (name: string, args: unknown, caller?: ToolExecutionInput['agent']) =>
    ctx.tools.execute({
      signal: testToolSignal,
      callId: CallId(`call-${++counter}`),
      name,
      arguments: args,
      ...caller === undefined ? {} : { agent: caller },
    })
  return { ctx, fiber, allocate, release, call }
}

describe('tool-ports registration', () => {
  it('registers both tools and the standing guidance section', async () => {
    const { ctx } = await mount()
    expect(ctx.tools.schemas().map(schema => schema.name).sort()).toEqual(['allocate_port', 'release_port'])
    const prompt = renderPrompt(await ctx.systemPrompt.assemble())
    expect(prompt).toContain('call allocate_port with a stable purpose label')
    expect(prompt).toContain('Call release_port when the server stops')
  })

  it('unregisters tools and guidance when the plugin fiber disposes (HMR safety)', async () => {
    const { ctx, fiber } = await mount()
    expect(ctx.tools.schemas()).toHaveLength(2)
    await fiber.dispose()
    expect(ctx.tools.schemas()).toHaveLength(0)
    const sections = (await ctx.systemPrompt.assemble()).sections.map(section => section.name)
    expect(sections).not.toContain('tool:allocate_port')
  })

  it('stays pending until ctx.ports exists (inject)', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(ToolPorts)
    expect(ctx.tools.schemas()).toHaveLength(0)
  })

  it('declares both tools exclusive so shared-state mutations stay ordered', async () => {
    const { ctx } = await mount()
    for (const name of ['allocate_port', 'release_port']) {
      expect(ctx.tools.executionMode({
        signal: testToolSignal,
        callId: CallId(`mode-${name}`),
        name,
        arguments: name === 'allocate_port' ? { purpose: 'x' } : { port: 43000 },
      })).toEqual({ kind: 'exclusive' })
    }
  })

  it('applies default timeout budgets when called directly without loader normalization', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    ctx.provide('ports', { allocate: vi.fn(), release: vi.fn() } as never)
    ToolPorts.apply(ctx, {})
    expect(ctx.tools.schemas().map(schema => schema.name).sort()).toEqual(['allocate_port', 'release_port'])
  })

  it('rejects non-positive timeout budgets', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    ctx.provide('ports', { allocate: vi.fn(), release: vi.fn() } as never)
    await expect(ctx.plugin(ToolPorts, { allocateTimeoutMs: 0 })).rejects.toThrow('allocateTimeoutMs must be a positive integer')

    const other = new Context()
    await other.plugin(SystemPrompt)
    await other.plugin(ToolRuntime)
    other.provide('ports', { allocate: vi.fn(), release: vi.fn() } as never)
    await expect(other.plugin(ToolPorts, { releaseTimeoutMs: 0 })).rejects.toThrow('releaseTimeoutMs must be a positive integer')

    const fractional = new Context()
    await fractional.plugin(SystemPrompt)
    await fractional.plugin(ToolRuntime)
    fractional.provide('ports', { allocate: vi.fn(), release: vi.fn() } as never)
    await expect(fractional.plugin(ToolPorts, { allocateTimeoutMs: 1.5 })).rejects.toThrow('allocateTimeoutMs must be a positive integer')
  })
})

describe('allocate_port tool', () => {
  it('allocates through the registry and renders the assignment', async () => {
    const { call, allocate } = await mount()
    const result = await call('allocate_port', { purpose: 'dev-server' })
    expect(result.isError).toBe(false)
    expect(result.value).toEqual({
      scope: 'global',
      ports: [{ port: 43000, purpose: 'dev-server', reused: false, inUse: false }],
    })
    expect(allocate).toHaveBeenCalledWith({ scope: { kind: 'global' }, purpose: 'dev-server' })
    const block = result.content[0]
    const text = block !== undefined && block.type === 'text' ? block.text : ''
    expect(text).toContain('Allocated port 43000 for "dev-server" (scope: global).')
    expect(text).toContain('call release_port when the server stops')
  })

  it('resolves the owning workspace scope from the calling session cwd', async () => {
    const { call, allocate } = await mount({
      workspaceRegistry: {
        resolveByPath: vi.fn(async (path: string) => path === '/projects/demo'
          ? { id: WorkspaceId('ws-demo'), title: 'Demo' }
          : undefined),
      },
    })
    const result = await call('allocate_port', { purpose: 'dev-server' }, agent('/projects/demo'))
    expect(result.isError).toBe(false)
    expect(result.value).toMatchObject({ scope: 'workspace "Demo"' })
    expect(allocate).toHaveBeenCalledWith({
      scope: { kind: 'workspace', workspaceId: WorkspaceId('ws-demo') },
      purpose: 'dev-server',
    })
  })

  it('falls back to the global scope without a workspace registry or when resolution rejects', async () => {
    const withoutRegistry = await mount()
    const first = await withoutRegistry.call('allocate_port', { purpose: 'dev-server' }, agent('/projects/loose'))
    expect(withoutRegistry.allocate).toHaveBeenCalledWith({ scope: { kind: 'global' }, purpose: 'dev-server' })
    expect(first.isError).toBe(false)

    const rejecting = await mount({
      workspaceRegistry: { resolveByPath: vi.fn(async () => { throw new Error('cwd gone') }) },
    })
    const second = await rejecting.call('allocate_port', { purpose: 'dev-server' }, agent('/projects/gone'))
    expect(rejecting.allocate).toHaveBeenCalledWith({ scope: { kind: 'global' }, purpose: 'dev-server' })
    expect(second.isError).toBe(false)
  })

  it('falls back to the global scope for a directory no workspace owns', async () => {
    const { call, allocate } = await mount({
      workspaceRegistry: { resolveByPath: vi.fn(async () => undefined) },
    })
    const result = await call('allocate_port', { purpose: 'dev-server' }, agent('/projects/unowned'))
    expect(result.isError).toBe(false)
    expect(allocate).toHaveBeenCalledWith({ scope: { kind: 'global' }, purpose: 'dev-server' })
  })

  it('passes count and preferred ports through', async () => {
    const { call, allocate } = await mount()
    const result = await call('allocate_port', { purpose: 'stack', count: 2, preferred: [43100] })
    expect(result.isError).toBe(false)
    expect(allocate).toHaveBeenCalledWith({ scope: { kind: 'global' }, purpose: 'stack', count: 2, preferred: [43100] })
  })

  it('surfaces registry errors with their stable codes', async () => {
    const { call } = await mount({
      allocate: vi.fn(async () => { throw new PortError('no free port available between 1 and 2', 'PORTS_EXHAUSTED') }),
    })
    const result = await call('allocate_port', { purpose: 'dev-server' })
    expect(result.isError).toBe(true)
    if (!result.isError) throw new Error('expected a failure')
    expect(result.error.info?.code).toBe('PORTS_EXHAUSTED')
  })

  it('propagates non-registry failures unchanged', async () => {
    const { call } = await mount({
      allocate: vi.fn(async () => { throw new Error('storage fault') }),
    })
    const result = await call('allocate_port', { purpose: 'dev-server' })
    expect(result.isError).toBe(true)
    if (!result.isError) throw new Error('expected a failure')
    expect(result.error.message).toContain('storage fault')
    expect(result.error.info).toBeUndefined()
  })

  it('validates blank purposes, bad counts, and bad preferred ports', async () => {
    const { call, allocate } = await mount()
    const blank = await call('allocate_port', { purpose: '   ' })
    expect(blank.isError).toBe(true)
    const badCount = await call('allocate_port', { purpose: 'ok', count: 0 })
    expect(badCount.isError).toBe(true)
    const badPreferred = await call('allocate_port', { purpose: 'ok', preferred: [70_000] })
    expect(badPreferred.isError).toBe(true)
    expect(allocate).not.toHaveBeenCalled()
  })

  it('parses and formats allocation values directly', () => {
    expect(parseAllocateArgs({ purpose: 'dev-server' })).toEqual({ purpose: 'dev-server' })
    expect(parseAllocateArgs({ purpose: 'dev-server', count: 2, preferred: [43000] }))
      .toEqual({ purpose: 'dev-server', count: 2, preferred: [43000] })
    const text = formatAllocateOutput({
      scope: 'global',
      ports: [
        { port: 43000, purpose: 'dev-server', reused: false, inUse: false },
        { port: 43001, purpose: 'docs', reused: true, inUse: true },
      ],
    })
    expect(text).toContain('Allocated port 43000 for "dev-server" (scope: global).')
    expect(text).toContain('Reusing port 43001 for "docs" (scope: global).')
    expect(text).toContain('call release_port(43001), then allocate_port again.')
    expect(presentAllocateCall({ purpose: 'dev-server' }))
      .toEqual({ card: 'generic', title: 'Allocate port for dev-server', kind: 'other', rawInput: 'dev-server' })
  })

  it('resolves scopes without a session cwd', async () => {
    const ctx = new Context()
    await expect(resolvePortScope(ctx, undefined)).resolves.toEqual({ scope: { kind: 'global' }, label: 'global' })
  })
})

describe('release_port tool', () => {
  it('releases through the registry and renders the outcome', async () => {
    const { call, release } = await mount()
    const result = await call('release_port', { port: 43000 })
    expect(result.isError).toBe(false)
    expect(result.value).toEqual({ released: true, message: 'Released port 43000; it can be allocated again.' })
    expect(release).toHaveBeenCalledWith(43000)
  })

  it('reports an unknown port without failing', async () => {
    const { call } = await mount({ release: vi.fn(async () => false) })
    const result = await call('release_port', { port: 43000 })
    expect(result.isError).toBe(false)
    expect(result.value).toMatchObject({ released: false, message: 'No allocation found for port 43000.' })
  })

  it('validates the port before calling the registry', async () => {
    const { call, release } = await mount()
    const result = await call('release_port', { port: 70_000 })
    expect(result.isError).toBe(true)
    expect(release).not.toHaveBeenCalled()
  })

  it('wraps registry errors with their stable codes and propagates other failures', async () => {
    const portError = await mount({ release: vi.fn(async () => { throw new PortError('no free port', 'PORTS_EXHAUSTED') }) })
    const wrapped = await portError.call('release_port', { port: 43000 })
    expect(wrapped.isError).toBe(true)
    if (!wrapped.isError) throw new Error('expected a failure')
    expect(wrapped.error.info?.code).toBe('PORTS_EXHAUSTED')

    const plain = await mount({ release: vi.fn(async () => { throw new Error('storage fault') }) })
    const propagated = await plain.call('release_port', { port: 43000 })
    expect(propagated.isError).toBe(true)
    if (!propagated.isError) throw new Error('expected a failure')
    expect(propagated.error.message).toContain('storage fault')
    expect(propagated.error.info).toBeUndefined()
  })

  it('parses and formats release values directly', () => {
    expect(parseReleaseArgs({ port: 43000 })).toEqual({ port: 43000 })
    expect(() => parseReleaseArgs({ port: 1.5 })).toThrow('port must be an integer')
    expect(formatReleaseOutput(true, 43000)).toContain('Released port 43000')
    expect(formatReleaseOutput(false, 43000)).toBe('No allocation found for port 43000.')
    expect(presentReleaseCall({ port: 43000 }))
      .toEqual({ card: 'generic', title: 'Release port 43000', kind: 'other', rawInput: 43000 })
  })
})
