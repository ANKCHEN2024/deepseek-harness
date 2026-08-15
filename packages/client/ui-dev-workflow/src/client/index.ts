/**
 * Project development workflow toolbox, browser half: contributes the
 * right-column SDLC shortcut strip and a header utility that re-opens it.
 * Clicks send `/dev-<action>` plus mode/task text through conversation.send so
 * host `dsh-tool-skill` injects the bundled skill body; falls back to a plain
 * prompt when the skill is absent from the session catalog.
 */
import type { ConnectionHandle, SessionId } from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { WorkflowPanel, type WorkflowPanelInjected } from './WorkflowPanel.tsx'
import { OpenWorkflowAction, type OpenWorkflowInjected } from './OpenWorkflowAction.tsx'
import {
  messageFor,
  skillNameFor,
  type WorkflowActionId,
  type WorkflowMode,
} from './prompts.ts'
import { createDevWorkflowStore } from './stores.ts'
import { en, NS, zh, type DevWorkflowKey } from './locales.ts'

export type { DevWorkflowKey, WorkflowActionId, WorkflowMode }
export type { WorkflowPanelInjected, WorkflowPanelProps } from './WorkflowPanel.tsx'
export type { OpenWorkflowInjected, OpenWorkflowActionProps } from './OpenWorkflowAction.tsx'
export {
  messageFor,
  preambleFor,
  promptFor,
  skillNameFor,
  WORKFLOW_BODIES,
  WORKFLOW_GROUPS,
} from './prompts.ts'

/** Required services for locale, slots, session-scoped send, skills list, and panel geometry. */
export const inject = ['slots', 'sessions', 'conversation', 'layout', 'locale', 'connection']

/**
 * Client plugin body: register dictionaries, the details toolbox, and the
 * header re-open control.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-dev-workflow: dictionaries')
  const skillsApi = (ctx.get('connection') as ConnectionHandle).api.skills

  ctx.slots.inject(
    'conversation.details.workflow',
    () => ctx.slots.register({
      name: 'conversation.details.workflow',
      id: 'dev-workflow',
      order: 10,
      locale: NS,
      store: createDevWorkflowStore,
      inject: (sessionId: SessionId): WorkflowPanelInjected => ({
        openPanel: () => { ctx.layout.openDetails() },
        listSkillNames: async () => {
          try {
            const { result } = await skillsApi.list({ sessionId })
            if (!result.ok) return []
            return result.value.skills.map(skill => skill.name)
          } catch {
            // skill.list transport/RPC failure: hide Skill badges, keep buttons.
            return []
          }
        },
        run: async (id: WorkflowActionId, mode: WorkflowMode) => {
          const actx = ctx.sessions.scope(sessionId)
          if (actx === undefined) {
            return `session "${String(sessionId)}" resolved no scope`
          }
          const conversation = actx.get('conversation')
          if (conversation === undefined) {
            return 'conversation service unavailable'
          }
          let skillAvailable = false
          try {
            const { result } = await skillsApi.list({ sessionId })
            skillAvailable = result.ok
              && result.value.skills.some(skill => skill.name === skillNameFor(id))
          } catch {
            // skill.list transport/RPC failure: send a plain prompt instead.
            skillAvailable = false
          }
          try {
            await conversation.send(messageFor(id, mode, { skillAvailable }))
            return null
          } catch (reason: unknown) {
            return reason instanceof Error ? reason.message : String(reason)
          }
        },
      }),
    }, WorkflowPanel),
  )

  ctx.slots.inject(
    'conversation.session.header.utilities',
    () => ctx.slots.register({
      name: 'conversation.session.header.utilities',
      id: 'open-dev-workflow',
      order: 40,
      locale: NS,
      inject: (): OpenWorkflowInjected => ({
        openPanel: () => { ctx.layout.openDetails() },
      }),
    }, OpenWorkflowAction),
  )
}
