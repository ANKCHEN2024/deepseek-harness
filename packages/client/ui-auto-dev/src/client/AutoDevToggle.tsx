import { useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { NS, type AutoDevKey } from './locales.ts'
import css from './AutoDevToggle.module.css'

/** Injected send verb for the header auto-dev toggle. */
export interface AutoDevToggleInjected {
  /**
   * Send one `/auto-dev` slash line through the session conversation service.
   * @param line - exact slash command text including the leading slash.
   */
  sendCommand: (line: string) => Promise<void>
}

/** Full props for the session-header auto-dev toggle. */
export type AutoDevToggleProps =
  PropsRuntime<'conversation.session.header.utilities'>
  & InjectFace<AutoDevToggleInjected>
  & PropsLocale<typeof NS>

/**
 * Compact header control that toggles conversation auto-dev monitoring.
 * Optimistic local armed state flips after a successful `/auto-dev on|off` send;
 * session restart leaves the host switch off, so a remount starts off.
 */
export function AutoDevToggle({ sendCommand, t }: AutoDevToggleProps) {
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)

  const ariaKey: AutoDevKey = on ? 'toggle.aria.on' : 'toggle.aria.off'
  const titleKey: AutoDevKey = on ? 'toggle.title.on' : 'toggle.title.off'

  return (
    <button
      type="button"
      className={`${css.button}${on ? ` ${css.on}` : ''}`}
      aria-label={t(ariaKey)}
      title={t(titleKey)}
      aria-pressed={on}
      disabled={busy}
      onClick={() => {
        if (busy) return
        const next = !on
        const line = next ? '/auto-dev on' : '/auto-dev off'
        setBusy(true)
        void sendCommand(line).then(
          () => {
            setOn(next)
            setBusy(false)
          },
          () => {
            setBusy(false)
          },
        )
      }}
    >
      <span className={css.dot} aria-hidden />
      {t('toggle.label')}
    </button>
  )
}
