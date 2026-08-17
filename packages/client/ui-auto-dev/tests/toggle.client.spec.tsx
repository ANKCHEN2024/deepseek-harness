// @vitest-environment jsdom
/**
 * Client apply wiring: dictionaries register through ctx.effect, the header
 * utility sends `/auto-dev on|off` through the session conversation service,
 * and the node half is a no-op.
 */

import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject, type AutoDevToggleInjected } from '../src/client/index.ts'
import { apply as nodeApply } from '../src/index.ts'
import { AutoDevToggle } from '../src/client/AutoDevToggle.tsx'
import { en, NS, zh } from '../src/client/locales.ts'

afterEach(cleanup)

/** One captured slots.register call. */
interface Registered {
  spec: {
    name: string
    id: string
    order: number
    locale: string
    inject: (sessionId: string) => AutoDevToggleInjected
  }
  component: unknown
}

/** Service doubles the client apply reads. */
function bench() {
  const ctx = new Context()
  const registered: Registered[] = []
  const localeDispose = vi.fn()
  const localeCalls: { ns: unknown; dictionaries: unknown }[] = []
  const registerLocale = vi.fn((ns: unknown, dictionaries: unknown) => {
    localeCalls.push({ ns, dictionaries })
    return localeDispose
  })
  const scope = vi.fn()
  ctx.provide('locale', { register: registerLocale })
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
  return { ctx, registered, localeDispose, localeCalls, scope }
}

/** Boot the client apply against the doubles and wait for the fiber. */
async function boot() {
  const doubles = bench()
  const fiber = doubles.ctx.plugin({ inject: [...inject], apply: apply as never })
  await fiber.await()
  return { ...doubles, fiber }
}

/** Shared runtime props the toggle does not exercise in these unit tests. */
function unusedRuntime() {
  return {
    SessionProvider: ({ children }: { children: (id: never) => unknown }) => children('s1' as never),
    sessionId: 's1' as never,
    useSession: () => { throw new Error('unused') },
    useSessions: () => { throw new Error('unused') },
    useWorkspaces: () => { throw new Error('unused') },
    useProjection: () => undefined,
    useInput: () => { throw new Error('unused') },
    inputActions: {
      setDraft: () => {},
      addImages: () => true,
      removeImage: () => {},
      pruneImages: () => {},
      submit: () => {},
    },
  }
}

describe('ui-auto-dev client apply', () => {
  it('declares its service dependencies', () => {
    expect(inject).toEqual(['slots', 'sessions', 'conversation', 'locale'])
  })

  it('has a no-op node half', () => {
    expect(() => nodeApply()).not.toThrow()
  })

  it('registers dictionaries and the header utility', async () => {
    const { fiber, localeDispose, localeCalls, registered } = await boot()
    expect(localeCalls).toHaveLength(1)
    expect(localeCalls[0]!.ns).toBe(NS)
    expect(registered).toHaveLength(1)
    expect(registered[0]!.spec).toMatchObject({
      name: 'conversation.session.header.utilities',
      id: 'auto-dev-toggle',
      order: 35,
      locale: NS,
    })
    expect(registered[0]!.component).toBe(AutoDevToggle)
    await fiber.dispose()
    expect(localeDispose).toHaveBeenCalledOnce()
  })

  it('sends /auto-dev on and off through conversation.send', async () => {
    const send = vi.fn(async (_message: string) => {})
    const { registered, scope } = await boot()
    scope.mockReturnValue({ get: () => ({ send }) })
    const face = registered[0]!.spec.inject('s1')
    await face.sendCommand('/auto-dev on')
    await face.sendCommand('/auto-dev off')
    expect(send).toHaveBeenCalledWith('/auto-dev on')
    expect(send).toHaveBeenCalledWith('/auto-dev off')
  })
})

describe('AutoDevToggle', () => {
  it('toggles by sending on then off after success', async () => {
    const sendCommand = vi.fn(async (_line: string) => {})
    const view = render(
      <AutoDevToggle
        {...unusedRuntime()}
        sendCommand={sendCommand}
        t={makeTranslate(zh)}
      />,
    )
    const button = view.getByRole('button', { name: zh['toggle.aria.off'] })
    fireEvent.click(button)
    await waitFor(() => {
      expect(sendCommand).toHaveBeenCalledWith('/auto-dev on')
    })
    await waitFor(() => {
      expect(view.getByRole('button', { name: zh['toggle.aria.on'] }).getAttribute('aria-pressed')).toBe('true')
    })
    fireEvent.click(view.getByRole('button', { name: zh['toggle.aria.on'] }))
    await waitFor(() => {
      expect(sendCommand).toHaveBeenCalledWith('/auto-dev off')
    })
    expect(en['toggle.label']).toBe('Auto-dev')
  })
})
