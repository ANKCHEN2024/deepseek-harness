// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor, act } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { WorkflowPanel, resolveQuickTab } from '../src/client/WorkflowPanel.tsx'
import { OpenWorkflowAction } from '../src/client/OpenWorkflowAction.tsx'
import { messageFor, preambleFor, promptFor, skillNameFor, WORKFLOW_GROUPS } from '../src/client/prompts.ts'
import { createDevWorkflowStore } from '../src/client/stores.ts'
import { zh } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  localStorage.clear()
})

const t = makeTranslate(zh)

/** Test-local selector hook over a framework-neutral store instance. */
function hookOf<T>(inst: { subscribe: (fn: () => void) => () => void; getSnapshot: () => T }) {
  return function useSelector<S>(sel: (s: T) => S): S {
    return sel(useSyncExternalStore(inst.subscribe, inst.getSnapshot))
  }
}

/** Shared runtime props the panel does not exercise in these unit tests. */
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
  } as const
}

function mountPanel(overrides: {
  run?: () => Promise<string | null>
  listSkillNames?: () => Promise<readonly string[]>
  openPanel?: () => void
} = {}) {
  const instance = createDevWorkflowStore().create()
  const run = overrides.run ?? vi.fn(async () => null)
  const openPanel = overrides.openPanel ?? vi.fn()
  const listSkillNames = overrides.listSkillNames ?? vi.fn(async () => [] as string[])
  const view = render(
    <WorkflowPanel
      {...unusedRuntime()}
      useStore={hookOf(instance.store)}
      actions={instance.actions}
      run={run}
      listSkillNames={listSkillNames}
      openPanel={openPanel}
      t={t}
    />,
  )
  return { view, run, openPanel, listSkillNames, instance }
}

describe('dev-workflow prompts', () => {
  it('covers every grouped action with mode-aware Chinese prompts and skill tokens', () => {
    const ids = WORKFLOW_GROUPS.flatMap(group => group.actions)
    expect(ids).toHaveLength(48)
    expect(new Set(ids).size).toBe(48)
    for (const id of ids) {
      const edit = promptFor(id, 'edit')
      const analyze = promptFor(id, 'analyze')
      expect(edit).toContain('请先查看当前工作区')
      expect(edit).toContain('执行模式：可改代码')
      expect(analyze).toContain('执行模式：只分析')
      expect(analyze).not.toContain('执行模式：可改代码')
      expect(edit.length).toBeGreaterThan(80)
      expect(skillNameFor(id)).toBe(`dev-${id}`)
      expect(messageFor(id, 'edit')).toMatch(new RegExp(`^/${skillNameFor(id)}\\n\\n`))
      expect(messageFor(id, 'edit', { skillAvailable: false })).not.toMatch(/^\//)
    }
  })

  it('preambleFor switches only the mode constraint line', () => {
    expect(preambleFor('analyze')).toContain('不要创建、修改或删除任何文件')
    expect(preambleFor('edit')).toContain('可以直接修改仓库')
  })
})

describe('resolveQuickTab', () => {
  it('prefers the stored tab when that list is non-empty, else falls back', () => {
    expect(resolveQuickTab('recent', { suggest: 2, pinned: 1, recent: 3 })).toBe('recent')
    expect(resolveQuickTab('recent', { suggest: 2, pinned: 1, recent: 0 })).toBe('suggest')
    expect(resolveQuickTab('suggest', { suggest: 0, pinned: 1, recent: 2 })).toBe('pinned')
    expect(resolveQuickTab(undefined, { suggest: 0, pinned: 0, recent: 1 })).toBe('recent')
    expect(resolveQuickTab('pinned', { suggest: 0, pinned: 0, recent: 0 })).toBeNull()
  })
})

describe('WorkflowPanel', () => {
  it('renders suggestions, stage headings, skill badges, and sends with active mode', async () => {
    const run = vi.fn(async () => null)
    const openPanel = vi.fn()
    const listSkillNames = vi.fn(async () => ['dev-docs', 'dev-requirements'])
    const { view } = mountPanel({ run, openPanel, listSkillNames })
    expect(openPanel).toHaveBeenCalled()
    expect(view.getByTestId('dev-workflow-quick')).toBeTruthy()
    expect(view.getByTestId('dev-workflow-suggest')).toBeTruthy()
    expect(view.getByText('快捷')).toBeTruthy()
    expect(view.getByText('规划')).toBeTruthy()
    expect(view.getByText('Agent')).toBeTruthy()
    fireEvent.click(view.getByText('Agent'))
    expect(view.getByText('自主闭环')).toBeTruthy()
    expect(view.getByText('门禁打绿')).toBeTruthy()
    expect(view.getAllByText('需求分析').length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(view.getAllByText('Skill').length).toBeGreaterThan(0)
    })
    expect(view.queryByText('设计 UI')).toBeNull()
    fireEvent.click(view.getByText('清理'))
    expect(view.getByText('清死代码')).toBeTruthy()
    expect(view.getByText('整理依赖')).toBeTruthy()
    fireEvent.click(view.getByText('设计'))
    expect(view.getByText('设计 UI')).toBeTruthy()
    const designUi = view.getByText('设计 UI').closest('button')
    expect(designUi?.getAttribute('title')).toContain('信息架构')
    fireEvent.click(view.getByText('只分析'))
    fireEvent.click(view.getByText('写项目文档'))
    await waitFor(() => {
      expect(run).toHaveBeenCalledWith('docs', 'analyze')
    })
  })

  it('records recent after a successful send and filters by search', async () => {
    const { view, run, instance } = mountPanel({
      run: vi.fn(async () => null),
    })
    fireEvent.click(view.getAllByText('需求分析')[0]!)
    await waitFor(() => {
      expect(run).toHaveBeenCalled()
      expect(instance.store.getSnapshot().recent[0]).toBe('requirements')
    })
    fireEvent.click(view.getByRole('tab', { name: '最近' }))
    expect(view.getByTestId('dev-workflow-recent')).toBeTruthy()
    expect(instance.store.getSnapshot().quickTab).toBe('recent')
    fireEvent.change(view.getByPlaceholderText('搜索动作…'), { target: { value: 'PR' } })
    expect(view.queryByTestId('dev-workflow-quick')).toBeNull()
    expect(view.getByText('写 PR 说明')).toBeTruthy()
    expect(view.queryByText('写项目文档')).toBeNull()
  })

  it('pins without sending and keeps at most one stage open', async () => {
    const { view, run } = mountPanel()
    const pinButtons = view.getAllByLabelText('收藏或取消收藏')
    fireEvent.click(pinButtons[0]!)
    expect(run).not.toHaveBeenCalled()
    fireEvent.click(view.getByRole('tab', { name: '收藏' }))
    expect(view.getByTestId('dev-workflow-pinned')).toBeTruthy()
    expect(view.queryByText('写提交说明')).toBeNull()
    fireEvent.click(view.getByText('交付'))
    expect(view.getByText('写提交说明')).toBeTruthy()
    expect(view.getByText('提交并推送')).toBeTruthy()
    expect(view.getByText('发布到私有库')).toBeTruthy()
    expect(view.getByText('写发布说明')).toBeTruthy()
    fireEvent.click(view.getByText('总结'))
    expect(view.queryByText('写发布说明')).toBeNull()
    expect(view.getByText('项目总结')).toBeTruthy()
  })

  it('surfaces sendFailed when run returns an English failure line', async () => {
    const run = vi.fn(async () => 'conversation.send failed: OFFLINE: gone')
    const { view } = mountPanel({ run })
    fireEvent.click(view.getAllByText('需求分析')[0]!)
    await waitFor(() => {
      expect(view.getByText('发送失败')).toBeTruthy()
    })
    expect(run).toHaveBeenCalledWith('requirements', 'edit')
  })

  it('clears recent from the recent quick tab and shows pin-full status', async () => {
    const { view, instance } = mountPanel()
    act(() => {
      for (const id of [
        'requirements',
        'docs',
        'implement',
        'refactor',
        'optimize',
        'debug',
      ] as const) {
        instance.actions.togglePin(id)
      }
    })
    expect(instance.store.getSnapshot().pinned).toHaveLength(6)
    const stories = view.getAllByText('用户故事')[0]!
    const pin = stories.closest('div')?.querySelector('button[aria-label="收藏或取消收藏"]')
    expect(pin).toBeTruthy()
    fireEvent.click(pin!)
    expect(view.getByText('收藏已满（最多 6 个）')).toBeTruthy()
    act(() => { instance.actions.recordRecent('docs') })
    fireEvent.click(view.getByRole('tab', { name: '最近' }))
    fireEvent.click(view.getByText('清空'))
    expect(instance.store.getSnapshot().recent).toEqual([])
  })

  it('shows search empty state and ignores stage clicks while searching', () => {
    const { view, instance } = mountPanel()
    fireEvent.change(view.getByPlaceholderText('搜索动作…'), { target: { value: 'zzz-no-match' } })
    expect(view.getByText('无匹配动作')).toBeTruthy()
    fireEvent.change(view.getByPlaceholderText('搜索动作…'), { target: { value: 'PR' } })
    expect(view.getByText('写 PR 说明')).toBeTruthy()
    fireEvent.click(view.getByText('交付'))
    expect(instance.store.getSnapshot().openGroup).toBe('group.plan')
  })

  it('collapses the open stage when its heading is clicked again', () => {
    const { view, instance } = mountPanel()
    expect(instance.store.getSnapshot().openGroup).toBe('group.plan')
    fireEvent.click(view.getByText('规划'))
    expect(instance.store.getSnapshot().openGroup).toBeNull()
  })

  it('surfaces sendFailed when run rejects with Error or non-Error', async () => {
    const run = vi.fn(async () => {
      throw 'network down'
    })
    const { view } = mountPanel({ run })
    fireEvent.click(view.getAllByText('需求分析')[0]!)
    await waitFor(() => {
      expect(view.getByText('发送失败')).toBeTruthy()
    })
    cleanup()
    const runErr = vi.fn(async () => {
      throw new Error('offline')
    })
    const again = mountPanel({ run: runErr })
    fireEvent.click(again.view.getAllByText('需求分析')[0]!)
    await waitFor(() => {
      expect(again.view.getByText('发送失败')).toBeTruthy()
    })
  })

  it('ignores late skill list and run results after unmount', async () => {
    let resolveSkills!: (names: readonly string[]) => void
    let resolveRun!: (value: string | null) => void
    let rejectRun!: (reason: unknown) => void
    const listSkillNames = vi.fn(() => new Promise<readonly string[]>((resolve) => {
      resolveSkills = resolve
    }))
    const run = vi.fn(() => new Promise<string | null>((resolve, reject) => {
      resolveRun = resolve
      rejectRun = reject
    }))
    const first = mountPanel({ listSkillNames, run })
    fireEvent.click(first.view.getAllByText('需求分析')[0]!)
    cleanup()
    resolveSkills(['dev-requirements'])
    resolveRun(null)
    await Promise.resolve()

    let resolveSkills2!: (names: readonly string[]) => void
    const listSkillNames2 = vi.fn(() => new Promise<readonly string[]>((resolve) => {
      resolveSkills2 = resolve
    }))
    const run2 = vi.fn(() => new Promise<string | null>((_resolve, reject) => {
      rejectRun = reject
    }))
    const second = mountPanel({ listSkillNames: listSkillNames2, run: run2 })
    fireEvent.click(second.view.getAllByText('需求分析')[0]!)
    cleanup()
    resolveSkills2([])
    rejectRun(new Error('gone'))
    await Promise.resolve()
    expect(run).toHaveBeenCalled()
    expect(run2).toHaveBeenCalled()
  })

  it('can switch back to edit mode after analyze', () => {
    const { view, instance } = mountPanel()
    fireEvent.click(view.getByText('只分析'))
    expect(instance.store.getSnapshot().mode).toBe('analyze')
    fireEvent.click(view.getByText('可改代码'))
    expect(instance.store.getSnapshot().mode).toBe('edit')
  })

  it('keeps buttons usable when listSkillNames rejects', async () => {
    const listSkillNames = vi.fn(async () => {
      throw new Error('skills unavailable')
    })
    const { view } = mountPanel({ listSkillNames })
    await waitFor(() => {
      expect(listSkillNames).toHaveBeenCalled()
    })
    expect(view.getAllByText('需求分析').length).toBeGreaterThan(0)
    expect(view.queryByText('Skill')).toBeNull()
  })
})

describe('OpenWorkflowAction', () => {
  it('opens the details panel from the header utility', () => {
    const openPanel = vi.fn()
    const view = render(
      <OpenWorkflowAction
        {...unusedRuntime()}
        openPanel={openPanel}
        t={t}
      />,
    )
    fireEvent.click(view.getByLabelText('打开开发流程工具箱'))
    expect(openPanel).toHaveBeenCalledTimes(1)
  })
})
