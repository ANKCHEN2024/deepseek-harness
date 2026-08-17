/**
 * Client apply wiring: dictionaries register through ctx.effect, both slot
 * injections capture their registrations, and the workflow inject face lists
 * skill names and sends skill-gesture messages through the session's
 * conversation service with categorized failures. Node half is a no-op.
 */

import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply, inject, type WorkflowPanelInjected } from '../src/client/index.ts'
import { apply as nodeApply } from '../src/index.ts'
import { NS } from '../src/client/locales.ts'

/** One captured slots.register call: spec + component, inject face on demand. */
interface Registered {
  spec: {
    name: string
    id: string
    order: number
    locale: string
    store: unknown
    inject: (sessionId: string) => WorkflowPanelInjected
  }
  component: unknown
}

/** Service doubles the client apply reads, plus the captured registrations. */
function bench() {
  const ctx = new Context()
  const registered: Registered[] = []
  const localeDispose = vi.fn()
  const localeCalls: { ns: unknown; dictionaries: unknown }[] = []
  const registerLocale = vi.fn((ns: unknown, dictionaries: unknown) => {
    localeCalls.push({ ns, dictionaries })
    return localeDispose
  })
  const listSkills = vi.fn()
  const openDetails = vi.fn()
  const scope = vi.fn()
  ctx.provide('locale', { register: registerLocale })
  ctx.provide('connection', { api: { skills: { list: listSkills } } })
  ctx.provide('layout', { openDetails })
  ctx.provide('sessions', { scope })
  ctx.provide('conversation', {})
  ctx.provide('slots', {
    inject: (_name: string, factory: () => Registered) => {
      factory()
    },
    register: (spec: Registered['spec'], component: unknown) => {
      registered.push({ spec, component })
      return () => {}
    },
  })
  return { ctx, registered, localeDispose, localeCalls, listSkills, openDetails, scope }
}

/** Boot the client apply against the doubles and wait for the fiber. */
async function boot() {
  const doubles = bench()
  const fiber = doubles.ctx.plugin({ inject: [...inject], apply: apply as never })
  await fiber.await()
  return { ...doubles, fiber }
}

/** Face + doubles of the details toolbox registration (first entry). */
async function panelFace() {
  const booted = await boot()
  const entry = booted.registered[0]
  if (entry === undefined) throw new Error('details toolbox registration missing')
  return { face: entry.spec.inject('s1'), ...booted }
}

describe('ui-dev-workflow client apply', () => {
  it('declares its service dependencies', () => {
    expect(inject).toEqual(['slots', 'sessions', 'conversation', 'layout', 'locale', 'connection'])
  })

  it('registers the locale dictionaries through ctx.effect and unwinds on dispose', async () => {
    const { fiber, localeDispose, localeCalls } = await boot()
    expect(localeCalls).toHaveLength(1)
    expect(localeCalls[0]!.ns).toBe(NS)
    const dictionaries = localeCalls[0]!.dictionaries as { zh: Record<string, unknown>; en: Record<string, unknown> }
    expect(Object.keys(dictionaries).sort()).toEqual(['en', 'zh'])
    expect(dictionaries.zh['sendbar.confirm']).toBe('确认发送')
    expect(dictionaries.en['sendbar.confirm']).toBe('Send')
    await fiber.dispose()
    expect(localeDispose).toHaveBeenCalledOnce()
  })

  it('registers the details toolbox and header utility entries', async () => {
    const { registered, openDetails } = await boot()
    expect(registered.map(entry => entry.spec.name)).toEqual([
      'conversation.details.workflow',
      'conversation.session.header.utilities',
    ])
    expect(registered[0]!.spec).toMatchObject({ id: 'dev-workflow', order: 10, locale: NS })
    expect(registered[1]!.spec).toMatchObject({ id: 'open-dev-workflow', order: 40, locale: NS })
    expect(typeof registered[0]!.spec.store).toBe('function')
    const utilityFace = (registered[1]!.spec.inject as unknown as () => { openPanel: () => void })()
    utilityFace.openPanel()
    expect(openDetails).toHaveBeenCalledOnce()
  })

  it('injects openPanel and skill listing with failure fallbacks', async () => {
    const { face, openDetails, listSkills } = await panelFace()
    face.openPanel()
    expect(openDetails).toHaveBeenCalledOnce()
    listSkills.mockResolvedValue({
      result: { ok: true, value: { skills: [{ name: 'dev-docs' }, { name: 'plan' }] } },
    })
    await expect(face.listSkillNames()).resolves.toEqual(['dev-docs', 'plan'])
    listSkills.mockResolvedValue({ result: { ok: false, value: { skills: [] } } })
    await expect(face.listSkillNames()).resolves.toEqual([])
    listSkills.mockRejectedValue(new Error('offline'))
    await expect(face.listSkillNames()).resolves.toEqual([])
  })

  it('sends the skill gesture with mode and focus through the session conversation', async () => {
    const send = vi.fn(async (_message: string) => {})
    const { face, listSkills, scope } = await panelFace()
    scope.mockReturnValue({ get: (name: string) => name === 'conversation' ? { send } : undefined })
    listSkills.mockResolvedValue({ result: { ok: true, value: { skills: [{ name: 'dev-docs' }] } } })
    await expect(face.run('docs', 'analyze', '导出超时')).resolves.toEqual({ ok: true })
    expect(scope).toHaveBeenCalledWith('s1')
    expect(send).toHaveBeenCalledOnce()
    const message = send.mock.calls[0]![0]
    expect(message).toMatch(/^\/dev-docs\n\n/)
    expect(message).toContain('执行模式：只分析')
    expect(message).toContain('导出超时')
  })

  it('falls back to a plain prompt when the catalog lacks the skill or the list throws', async () => {
    const send = vi.fn(async (_message: string) => {})
    const { face, listSkills, scope } = await panelFace()
    scope.mockReturnValue({ get: (name: string) => name === 'conversation' ? { send } : undefined })
    listSkills.mockResolvedValue({ result: { ok: true, value: { skills: [{ name: 'other-skill' }] } } })
    await expect(face.run('docs', 'edit', '')).resolves.toEqual({ ok: true })
    expect(send.mock.calls[0]![0]).not.toMatch(/^\//)
    expect(send.mock.calls[0]![0]).toContain('执行模式：可改代码')
    send.mockClear()
    listSkills.mockRejectedValue(new Error('skills offline'))
    await expect(face.run('docs', 'edit', '')).resolves.toEqual({ ok: true })
    expect(send).toHaveBeenCalledOnce()
    expect(send.mock.calls[0]![0]).not.toMatch(/^\//)
  })

  it('reports scope and service failures before sending', async () => {
    const { face, scope } = await panelFace()
    scope.mockReturnValue(undefined)
    await expect(face.run('docs', 'edit', '')).resolves.toEqual({
      ok: false, kind: 'scope', detail: 'session "s1" resolved no scope',
    })
    scope.mockReturnValue({ get: () => undefined })
    await expect(face.run('docs', 'edit', '')).resolves.toEqual({
      ok: false, kind: 'service', detail: 'conversation service unavailable',
    })
  })

  it('reports send failures with the transport message', async () => {
    const send = vi.fn(async () => { throw new Error('OFFLINE: gone') })
    const { face, listSkills, scope } = await panelFace()
    scope.mockReturnValue({ get: (name: string) => name === 'conversation' ? { send } : undefined })
    listSkills.mockResolvedValue({ result: { ok: false, value: { skills: [] } } })
    await expect(face.run('docs', 'edit', '')).resolves.toEqual({
      ok: false, kind: 'send', detail: 'OFFLINE: gone',
    })
    send.mockRejectedValue('OFFLINE: raw')
    await expect(face.run('docs', 'edit', '')).resolves.toEqual({
      ok: false, kind: 'send', detail: 'OFFLINE: raw',
    })
  })
})

describe('node half', () => {
  it('node apply is an intentional no-op (loader-managed lifecycle only)', () => {
    nodeApply()
    expect(true).toBe(true)
  })
})
