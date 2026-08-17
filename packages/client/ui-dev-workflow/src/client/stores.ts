/**
 * Persisted viewing state for the development workflow toolbox panel.
 * Module exports the factory only; register() receives it and components
 * derive PropsStore from the return type.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import { WORKFLOW_GROUPS, type WorkflowActionId, type WorkflowMode } from './prompts.ts'

const VALID = new Set<string>(WORKFLOW_GROUPS.flatMap(group => group.actions))
const HEADINGS = new Set(WORKFLOW_GROUPS.map(group => group.headingKey))

/** Accordion heading key or null when every stage is collapsed. */
export type DevWorkflowOpenGroup = (typeof WORKFLOW_GROUPS)[number]['headingKey'] | null

/** Active segment in the merged quick-access strip. */
export type DevWorkflowQuickTab = 'suggest' | 'pinned' | 'recent'

/** Panel-local toolbox preferences persisted across remounts and reloads. */
export type DevWorkflowState = {
  mode: WorkflowMode
  openGroup: DevWorkflowOpenGroup
  recent: WorkflowActionId[]
  pinned: WorkflowActionId[]
  quickTab: DevWorkflowQuickTab
}

/**
 * Annotation twin of the actions literal below; drift fails assignability
 * at the defineStore call.
 */
type DevWorkflowActions = {
  setMode: (draft: DevWorkflowState, mode: WorkflowMode) => void
  setOpenGroup: (draft: DevWorkflowState, openGroup: DevWorkflowOpenGroup) => void
  setQuickTab: (draft: DevWorkflowState, tab: DevWorkflowQuickTab) => void
  recordRecent: (draft: DevWorkflowState, id: WorkflowActionId) => void
  togglePin: (draft: DevWorkflowState, id: WorkflowActionId) => void
  clearRecent: (draft: DevWorkflowState) => void
}

/**
 * Create the workflow toolbox viewing store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createDevWorkflowStore(): EngineStoreHandle<DevWorkflowState, DevWorkflowActions> {
  return defineStore({
    init: (): DevWorkflowState => ({
      mode: 'edit',
      openGroup: 'group.plan',
      recent: [],
      pinned: [],
      quickTab: 'suggest',
    }),
    persist: 'dsh.dev-workflow.panel.v1',
    actions: {
      setMode: (d, mode) => { d.mode = mode },
      setOpenGroup: (d, openGroup) => {
        if (openGroup === null || HEADINGS.has(openGroup)) {
          d.openGroup = openGroup
          return
        }
        d.openGroup = 'group.plan'
      },
      setQuickTab: (d, tab) => { d.quickTab = tab },
      recordRecent: (d, id) => {
        if (!VALID.has(id)) return
        d.recent = [id, ...d.recent.filter(x => x !== id)].slice(0, 8)
      },
      togglePin: (d, id) => {
        if (!VALID.has(id)) return
        if (d.pinned.includes(id)) {
          d.pinned = d.pinned.filter(x => x !== id)
          return
        }
        if (d.pinned.length >= 6) return
        d.pinned = [...d.pinned, id]
      },
      clearRecent: (d) => { d.recent = [] },
    },
  })
}
