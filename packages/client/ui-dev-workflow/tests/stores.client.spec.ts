// @vitest-environment jsdom
/**
 * createDevWorkflowStore unit account: recent/pin caps and independent instances.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createDevWorkflowStore } from '../src/client/stores.ts'

beforeEach(() => { localStorage.clear() })

describe('createDevWorkflowStore', () => {
  it('records recent newest-first, deduped, capped at 8', () => {
    const { store, actions } = createDevWorkflowStore().create()
    for (const id of [
      'requirements',
      'docs',
      'implement',
      'refactor',
      'optimize',
      'debug',
      'commit-message',
      'pr-description',
      'changelog',
    ] as const) {
      actions.recordRecent(id)
    }
    const recent = store.getSnapshot().recent
    expect(recent[0]).toBe('changelog')
    expect(recent).toHaveLength(8)
    expect(recent).not.toContain('requirements')
    actions.recordRecent('docs')
    expect(store.getSnapshot().recent[0]).toBe('docs')
    expect(store.getSnapshot().recent.filter(x => x === 'docs')).toHaveLength(1)
  })

  it('togglePin caps at 6 and clearRecent empties', () => {
    const { store, actions } = createDevWorkflowStore().create()
    for (const id of [
      'requirements',
      'docs',
      'implement',
      'refactor',
      'optimize',
      'debug',
      'commit-message',
    ] as const) {
      actions.togglePin(id)
    }
    expect(store.getSnapshot().pinned).toHaveLength(6)
    expect(store.getSnapshot().pinned).not.toContain('commit-message')
    actions.togglePin('requirements')
    expect(store.getSnapshot().pinned).not.toContain('requirements')
    actions.recordRecent('docs')
    actions.clearRecent()
    expect(store.getSnapshot().recent).toEqual([])
  })

  it('each create() is an independent instance', () => {
    const a = createDevWorkflowStore().create()
    const b = createDevWorkflowStore().create()
    a.actions.setMode('analyze')
    expect(b.store.getSnapshot().mode).toBe('edit')
  })

  it('defaults quickTab to suggest and sets it', () => {
    const { store, actions } = createDevWorkflowStore().create()
    expect(store.getSnapshot().quickTab).toBe('suggest')
    actions.setQuickTab('recent')
    expect(store.getSnapshot().quickTab).toBe('recent')
  })

  it('setOpenGroup accepts null and known headings, else resets to plan', () => {
    const { store, actions } = createDevWorkflowStore().create()
    actions.setOpenGroup(null)
    expect(store.getSnapshot().openGroup).toBeNull()
    actions.setOpenGroup('group.ship')
    expect(store.getSnapshot().openGroup).toBe('group.ship')
    actions.setOpenGroup('group.missing' as 'group.plan')
    expect(store.getSnapshot().openGroup).toBe('group.plan')
  })

  it('ignores unknown action ids for recent and pin', () => {
    const { store, actions } = createDevWorkflowStore().create()
    actions.recordRecent('not-real' as 'docs')
    expect(store.getSnapshot().recent).toEqual([])
    actions.togglePin('not-real' as 'docs')
    expect(store.getSnapshot().pinned).toEqual([])
  })
})
