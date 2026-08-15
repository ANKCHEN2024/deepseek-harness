// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import {
  WorkflowPanel, resolveQuickTab, defaultSendMode,
  type WorkflowRunResult,
} from '../src/client/WorkflowPanel.tsx'
import { OpenWorkflowAction } from '../src/client/OpenWorkflowAction.tsx'
import {
  ACTION_RISK, focusBlockFor, messageFor, preambleFor, promptFor, skillNameFor, WORKFLOW_GROUPS,
  type WorkflowActionId, type WorkflowMode,
} from '../src/client/prompts.ts'
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

/** Run stub signature matching the panel's inject face. */
type RunFn = (id: WorkflowActionId, mode: WorkflowMode, focus: string) => Promise<WorkflowRunResult>

function mountPanel(overrides: {
  run?: RunFn
  listSkillNames?: () => Promise<readonly string[]>
  openPanel?: () => void
} = {}) {
  const instance = createDevWorkflowStore().create()
  const run = overrides.run ?? vi.fn<RunFn>(async () => ({ ok: true as const }))
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

  it('assigns a risk level to every grouped action', () => {
    for (const id of WORKFLOW_GROUPS.flatMap(group => group.actions)) {
      expect(ACTION_RISK[id]).toBeTruthy()
    }
    expect(ACTION_RISK['commit-push']).toBe('publishes')
    expect(ACTION_RISK['github-private-publish']).toBe('publishes')
    expect(ACTION_RISK.implement).toBe('writes-repo')
    expect(ACTION_RISK.requirements).toBe('safe')
  })

  it('appends the trimmed task scope to messageFor and keeps empty focus off the body', () => {
    const withFocus = messageFor('docs', 'edit', { focus: '  导出超时  ' })
    expect(withFocus).toContain('本次任务范围（仅针对此范围，不要扩大到无关内容）：\n导出超时\n')
    expect(withFocus).toMatch(new RegExp(`^/${skillNameFor('docs')}\\n\\n`))
    expect(focusBlockFor('  x  ')).toBe('\n本次任务范围（仅针对此范围，不要扩大到无关内容）：\nx\n')
    expect(focusBlockFor('   ')).toBe('')
    expect(focusBlockFor(undefined)).toBe('')
    expect(messageFor('docs', 'edit')).not.toContain('本次任务范围')
    expect(messageFor('docs', 'edit', { skillAvailable: false, focus: 'x' })).not.toMatch(/^\//)
  })
})

describe('defaultSendMode', () => {
  it('starts publish actions analyze-only and everything else on the global mode', () => {
    expect(defaultSendMode('commit-push', 'edit')).toBe('analyze')
    expect(defaultSendMode('github-private-publish', 'edit')).toBe('analyze')
    expect(defaultSendMode('commit-push', 'analyze')).toBe('analyze')
    expect(defaultSendMode('implement', 'edit')).toBe('edit')
    expect(defaultSendMode('requirements', 'analyze')).toBe('analyze')
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
    const run = vi.fn<RunFn>(async () => ({ ok: true as const }))
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
    const sendbar = view.getByTestId('dev-workflow-sendbar')
    expect(within(sendbar).getByText(/发送前确认/)).toBeTruthy()
    expect(within(sendbar).getByText(/写项目文档/)).toBeTruthy()
    fireEvent.click(within(sendbar).getByRole('button', { name: '确认发送' }))
    await waitFor(() => {
      expect(run).toHaveBeenCalledWith('docs', 'analyze', '')
    })
  })

  it('records recent after a successful send and filters by search', async () => {
    const { view, run, instance } = mountPanel({
      run: vi.fn<RunFn>(async () => ({ ok: true as const })),
    })
    fireEvent.click(view.getAllByText('需求分析')[0]!)
    fireEvent.click(view.getByRole('button', { name: '确认发送' }))
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

  it('shows a categorized send failure with expandable detail and retry', async () => {
    const run = vi.fn<RunFn>(async () => ({
      ok: false as const,
      kind: 'send' as const,
      detail: 'conversation.send failed: OFFLINE: gone',
    }))
    const { view } = mountPanel({ run })
    fireEvent.click(view.getAllByText('需求分析')[0]!)
    fireEvent.click(view.getByRole('button', { name: '确认发送' }))
    await waitFor(() => {
      expect(view.getByText('发送失败')).toBeTruthy()
    })
    expect(view.queryByText('conversation.send failed: OFFLINE: gone')).toBeNull()
    fireEvent.click(view.getByRole('button', { name: '查看详情' }))
    expect(view.getByText('conversation.send failed: OFFLINE: gone')).toBeTruthy()
    fireEvent.click(view.getByRole('button', { name: '重试' }))
    await waitFor(() => {
      expect(run).toHaveBeenCalledTimes(2)
    })
    expect(run).toHaveBeenCalledWith('requirements', 'edit', '')
  })

  it('shows session and service copy for scope and service failures', async () => {
    const runScope = vi.fn<RunFn>(async () => ({
      ok: false as const,
      kind: 'scope' as const,
      detail: 'no scope',
    }))
    const first = mountPanel({ run: runScope })
    fireEvent.click(first.view.getAllByText('需求分析')[0]!)
    fireEvent.click(first.view.getByRole('button', { name: '确认发送' }))
    await waitFor(() => {
      expect(first.view.getByText('当前会话不可用')).toBeTruthy()
    })
    cleanup()
    const runService = vi.fn<RunFn>(async () => ({
      ok: false as const,
      kind: 'service' as const,
      detail: 'service down',
    }))
    const second = mountPanel({ run: runService })
    fireEvent.click(second.view.getAllByText('需求分析')[0]!)
    fireEvent.click(second.view.getByRole('button', { name: '确认发送' }))
    await waitFor(() => {
      expect(second.view.getByText('会话服务不可用')).toBeTruthy()
    })
  })

  it('opens the send bar with the action hint, focuses the task input, and cancels via Escape and button', () => {
    const { view, run } = mountPanel()
    const action = view.getAllByText('需求分析')[0]!.closest('button')!
    fireEvent.click(action)
    expect(view.getByTestId('dev-workflow-sendbar')).toBeTruthy()
    expect(view.getByText('目标、范围、验收标准')).toBeTruthy()
    const input = view.getByPlaceholderText('本次任务或范围，例如：修复 session 导出超时') as HTMLInputElement
    expect(document.activeElement).toBe(input)
    fireEvent.keyDown(view.getByTestId('dev-workflow-sendbar-form'), { key: 'a' })
    expect(view.getByTestId('dev-workflow-sendbar')).toBeTruthy()
    fireEvent.keyDown(view.getByTestId('dev-workflow-sendbar-form'), { key: 'Escape' })
    expect(view.queryByTestId('dev-workflow-sendbar')).toBeNull()
    expect(run).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(action)
    fireEvent.click(view.getAllByText('需求分析')[0]!)
    fireEvent.click(view.getByRole('button', { name: '取消' }))
    expect(view.queryByTestId('dev-workflow-sendbar')).toBeNull()
    expect(run).not.toHaveBeenCalled()
  })

  it('passes the trimmed task scope to run and submits on form submit', async () => {
    const { view, run } = mountPanel()
    fireEvent.click(view.getAllByText('需求分析')[0]!)
    fireEvent.change(view.getByPlaceholderText('本次任务或范围，例如：修复 session 导出超时'), {
      target: { value: '  导出超时排查  ' },
    })
    fireEvent.submit(view.getByTestId('dev-workflow-sendbar-form'))
    await waitFor(() => {
      expect(run).toHaveBeenCalledWith('requirements', 'edit', '导出超时排查')
    })
  })

  it('defaults publish actions to analyze with risk copy and sends only after switching to edit', async () => {
    const { view, run } = mountPanel()
    fireEvent.click(view.getByText('交付'))
    fireEvent.click(view.getByText('提交并推送'))
    const sendbar = view.getByTestId('dev-workflow-sendbar')
    expect(within(sendbar).getByText('该动作会真实提交并推送到远程仓库，请确认后执行。')).toBeTruthy()
    expect(within(sendbar).getByText('为安全起见默认使用「只分析」预览；确认安全后再切换。')).toBeTruthy()
    expect(within(sendbar).getByRole('button', { name: '只分析' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.change(
      within(sendbar).getByPlaceholderText('本次任务或范围，例如：修复 session 导出超时'),
      { target: { value: '推到个人分支' } },
    )
    fireEvent.click(within(sendbar).getByRole('button', { name: '可改代码' }))
    expect(within(sendbar).queryByText('为安全起见默认使用「只分析」预览；确认安全后再切换。')).toBeNull()
    fireEvent.click(within(sendbar).getByRole('button', { name: '确认发送' }))
    await waitFor(() => {
      expect(run).toHaveBeenCalledWith('commit-push', 'edit', '推到个人分支')
    })
  })

  it('shows repo risk for writes-repo actions only in edit mode and none for safe actions', () => {
    const { view } = mountPanel()
    fireEvent.click(view.getByText('设计'))
    fireEvent.click(view.getByText('写项目文档'))
    let sendbar = view.getByTestId('dev-workflow-sendbar')
    expect(within(sendbar).getByText('「可改代码」模式下该动作可能修改仓库文件。')).toBeTruthy()
    fireEvent.click(within(sendbar).getByRole('button', { name: '只分析' }))
    expect(within(sendbar).queryByText('「可改代码」模式下该动作可能修改仓库文件。')).toBeNull()
    fireEvent.click(view.getAllByText('需求分析')[0]!)
    sendbar = view.getByTestId('dev-workflow-sendbar')
    expect(within(sendbar).queryByText('该动作会真实提交并推送到远程仓库，请确认后执行。')).toBeNull()
    expect(within(sendbar).queryByText('「可改代码」模式下该动作可能修改仓库文件。')).toBeNull()
  })

  it('replaces the pending action when another action is clicked', () => {
    const { view } = mountPanel()
    fireEvent.click(view.getAllByText('需求分析')[0]!)
    expect(within(view.getByTestId('dev-workflow-sendbar')).getByText(/需求分析/)).toBeTruthy()
    fireEvent.click(view.getAllByText('用户故事')[0]!)
    const sendbar = view.getByTestId('dev-workflow-sendbar')
    expect(within(sendbar).getByText(/用户故事/)).toBeTruthy()
    expect(within(sendbar).queryByText(/需求分析/)).toBeNull()
  })

  it('shows the sent status with the action label and clears it after 4 seconds', async () => {
    vi.useFakeTimers()
    try {
      const { view } = mountPanel()
      fireEvent.click(view.getAllByText('需求分析')[0]!)
      fireEvent.click(view.getByRole('button', { name: '确认发送' }))
      await act(async () => {})
      expect(view.getByText('已发送到会话：需求分析')).toBeTruthy()
      act(() => { vi.advanceTimersByTime(4000) })
      expect(view.queryByText('已发送到会话：需求分析')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
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
    fireEvent.click(view.getByRole('button', { name: '确认发送' }))
    await waitFor(() => {
      expect(view.getByText('发送失败')).toBeTruthy()
    })
    cleanup()
    const runErr = vi.fn(async () => {
      throw new Error('offline')
    })
    const again = mountPanel({ run: runErr })
    fireEvent.click(again.view.getAllByText('需求分析')[0]!)
    fireEvent.click(again.view.getByRole('button', { name: '确认发送' }))
    await waitFor(() => {
      expect(again.view.getByText('发送失败')).toBeTruthy()
    })
  })

  it('ignores late skill list and run results after unmount', async () => {
    let resolveSkills!: (names: readonly string[]) => void
    let resolveRun!: (value: WorkflowRunResult) => void
    let rejectRun!: (reason: unknown) => void
    const listSkillNames = vi.fn(() => new Promise<readonly string[]>((resolve) => {
      resolveSkills = resolve
    }))
    const run = vi.fn(() => new Promise<WorkflowRunResult>((resolve, reject) => {
      resolveRun = resolve
      rejectRun = reject
    }))
    const first = mountPanel({ listSkillNames, run })
    fireEvent.click(first.view.getAllByText('需求分析')[0]!)
    fireEvent.click(first.view.getByRole('button', { name: '确认发送' }))
    cleanup()
    resolveSkills(['dev-requirements'])
    resolveRun({ ok: true })
    await Promise.resolve()

    let resolveSkills2!: (names: readonly string[]) => void
    const listSkillNames2 = vi.fn(() => new Promise<readonly string[]>((resolve) => {
      resolveSkills2 = resolve
    }))
    const run2 = vi.fn(() => new Promise<WorkflowRunResult>((_resolve, reject) => {
      rejectRun = reject
    }))
    const second = mountPanel({ listSkillNames: listSkillNames2, run: run2 })
    fireEvent.click(second.view.getAllByText('需求分析')[0]!)
    fireEvent.click(second.view.getByRole('button', { name: '确认发送' }))
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
