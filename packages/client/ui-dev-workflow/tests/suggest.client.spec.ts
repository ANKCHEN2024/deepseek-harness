import { describe, expect, it } from 'vitest'
import { suggestActions } from '../src/client/suggest.ts'

describe('suggestActions', () => {
  it('returns Plan first three when recent is empty', () => {
    expect(suggestActions({ recent: [], pinned: [], mode: 'edit' })).toEqual([
      'requirements',
      'user-stories',
      'task-breakdown',
    ])
  })

  it('suggests next in same group then fills to three', () => {
    expect(suggestActions({ recent: ['implement'], pinned: [], mode: 'analyze' })).toEqual([
      'refactor',
      'optimize',
      'code-review',
    ])
  })

  it('crosses to the next group at a group tail', () => {
    expect(suggestActions({ recent: ['debug'], pinned: [], mode: 'edit' })[0]).toBe('dead-code')
  })

  it('crosses from cleanup into ship', () => {
    expect(suggestActions({ recent: ['debug-residue'], pinned: [], mode: 'edit' })[0]).toBe('git-status-brief')
  })

  it('wraps from demo-kit back to the first agent playbook', () => {
    expect(suggestActions({ recent: ['demo-kit'], pinned: [], mode: 'edit' })[0]).toBe('agent-autonomous')
  })

  it('dedupes and caps at three', () => {
    const out = suggestActions({ recent: ['docs', 'docs'], pinned: ['docs'], mode: 'edit' })
    expect(out).toHaveLength(3)
    expect(new Set(out).size).toBe(3)
  })
})
