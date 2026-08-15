// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { WorkflowPanel } from '../src/client/WorkflowPanel.tsx'
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
    expect(ids).toHaveLength(33)
    expect(new Set(ids).size).toBe(33)
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

describe('WorkflowPanel', () => {
  it('renders suggestions, stage headings, skill badges, and sends with active mode', async () => {
    const run = vi.fn(async () => null)
    const openPanel = vi.fn()
    const listSkillNames = vi.fn(async () => ['dev-docs', 'dev-requirements'])
    const { view } = mountPanel({ run, openPanel, listSkillNames })
    expect(openPanel).toHaveBeenCalled()
    expect(view.getByTestId('dev-workflow-suggest')).toBeTruthy()
    expect(view.getByText('建议')).toBeTruthy()
    expect(view.getByText('规划')).toBeTruthy()
    expect(view.getAllByText('需求分析').length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(view.getAllByText('Skill').length).toBeGreaterThan(0)
    })
    expect(view.queryByText('设计 UI')).toBeNull()
    fireEvent.click(view.getByText('设计'))
    expect(view.getByText('设计 UI')).toBeTruthy()
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
    expect(view.getByTestId('dev-workflow-recent')).toBeTruthy()
    fireEvent.change(view.getByPlaceholderText('搜索动作…'), { target: { value: 'PR' } })
    expect(view.queryByTestId('dev-workflow-suggest')).toBeNull()
    expect(view.getByText('写 PR 说明')).toBeTruthy()
    expect(view.queryByText('写项目文档')).toBeNull()
  })

  it('pins without sending and keeps at most one stage open', async () => {
    const { view, run } = mountPanel()
    const pinButtons = view.getAllByLabelText('收藏或取消收藏')
    fireEvent.click(pinButtons[0]!)
    expect(run).not.toHaveBeenCalled()
    expect(view.getByTestId('dev-workflow-pinned')).toBeTruthy()
    expect(view.queryByText('写提交说明')).toBeNull()
    fireEvent.click(view.getByText('交付'))
    expect(view.getByText('写提交说明')).toBeTruthy()
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
