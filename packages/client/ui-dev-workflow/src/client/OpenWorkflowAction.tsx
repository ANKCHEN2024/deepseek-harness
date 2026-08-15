import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { NS } from './locales.ts'
import css from './DevWorkflow.module.css'

/** Injected open verb for the header utility. */
export interface OpenWorkflowInjected {
  /** Open the right-column workflow toolbox. */
  openPanel: () => void
}

/** Full props for the session-header open-workflow control. */
export type OpenWorkflowActionProps =
  PropsRuntime<'conversation.session.header.utilities'>
  & InjectFace<OpenWorkflowInjected>
  & PropsLocale<typeof NS>

/** Compact header control that re-opens the right-column workflow toolbox. */
export function OpenWorkflowAction({ openPanel, t }: OpenWorkflowActionProps) {
  return (
    <button
      type="button"
      className={css.open}
      aria-label={t('open.aria')}
      title={t('open.title')}
      onClick={() => { openPanel() }}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
        <path
          d="M3 3.5h4.5V8H3V3.5zm5.5 0H13V8H8.5V3.5zM3 9h4.5v3.5H3V9zm5.5 0H13v3.5H8.5V9z"
          fill="currentColor"
        />
      </svg>
    </button>
  )
}
