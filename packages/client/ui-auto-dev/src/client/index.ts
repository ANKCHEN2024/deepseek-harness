/**
 * Auto-dev header toggle, browser half: contributes a session-header utility
 * that sends `/auto-dev on|off` through conversation.send so the host command
 * arms or disarms the process-local monitor switch.
 */
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { AutoDevToggle, type AutoDevToggleInjected } from './AutoDevToggle.tsx'
import { en, NS, zh, type AutoDevKey } from './locales.ts'

export type { AutoDevKey }
export type { AutoDevToggleInjected, AutoDevToggleProps } from './AutoDevToggle.tsx'
export { AutoDevToggle } from './AutoDevToggle.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The auto-dev header toggle's copy. */
    'auto-dev': AutoDevKey
  }
}

/** Required services for locale, slots, and session-scoped send. */
export const inject = ['slots', 'sessions', 'conversation', 'locale']

/**
 * Client plugin body: register dictionaries and the header utility.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-auto-dev: dictionaries')

  ctx.slots.inject(
    'conversation.session.header.utilities',
    () => ctx.slots.register({
      name: 'conversation.session.header.utilities',
      id: 'auto-dev-toggle',
      order: 35,
      locale: NS,
      inject: (sessionId: SessionId): AutoDevToggleInjected => ({
        sendCommand: async (line) => {
          const actx = ctx.sessions.scope(sessionId)
          if (actx === undefined) {
            throw new Error(`session "${String(sessionId)}" resolved no scope`)
          }
          const conversation = actx.get('conversation')
          if (conversation === undefined) {
            throw new Error('conversation service unavailable')
          }
          await conversation.send(line)
        },
      }),
    }, AutoDevToggle),
  )
}
