import { useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { WorkflowActionId, WorkflowMode } from './prompts.ts'
import { skillNameFor, WORKFLOW_GROUPS } from './prompts.ts'
import { suggestActions } from './suggest.ts'
import type { createDevWorkflowStore, DevWorkflowQuickTab } from './stores.ts'
import { NS, type DevWorkflowKey } from './locales.ts'
import css from './DevWorkflow.module.css'

/** Locale key for each workflow action button label. */
const ACTION_LABEL: Readonly<Record<WorkflowActionId, DevWorkflowKey>> = {
  'agent-autonomous': 'action.agent-autonomous',
  'agent-investigate': 'action.agent-investigate',
  'agent-fix-loop': 'action.agent-fix-loop',
  'agent-verify-gate': 'action.agent-verify-gate',
  'agent-goal-drive': 'action.agent-goal-drive',
  'agent-parallel': 'action.agent-parallel',
  requirements: 'action.requirements',
  'user-stories': 'action.user-stories',
  'task-breakdown': 'action.task-breakdown',
  docs: 'action.docs',
  'ui-design': 'action.ui-design',
  'tech-design': 'action.tech-design',
  'api-design': 'action.api-design',
  'data-model': 'action.data-model',
  implement: 'action.implement',
  refactor: 'action.refactor',
  optimize: 'action.optimize',
  'code-review': 'action.code-review',
  'security-review': 'action.security-review',
  'add-tests': 'action.add-tests',
  'a11y-check': 'action.a11y-check',
  debug: 'action.debug',
  'dead-code': 'action.dead-code',
  'deps-hygiene': 'action.deps-hygiene',
  'temp-cleanup': 'action.temp-cleanup',
  'import-hygiene': 'action.import-hygiene',
  'debug-residue': 'action.debug-residue',
  'git-status-brief': 'action.git-status-brief',
  'commit-message': 'action.commit-message',
  'commit-draft': 'action.commit-draft',
  'commit-push': 'action.commit-push',
  'github-private-publish': 'action.github-private-publish',
  'pr-description': 'action.pr-description',
  changelog: 'action.changelog',
  'release-notes': 'action.release-notes',
  'version-tag': 'action.version-tag',
  'deploy-checklist': 'action.deploy-checklist',
  'migration-plan': 'action.migration-plan',
  'rollback-plan': 'action.rollback-plan',
  'smoke-verify': 'action.smoke-verify',
  'handoff-notes': 'action.handoff-notes',
  'project-summary': 'action.project-summary',
  standardize: 'action.standardize',
  'product-deck': 'action.product-deck',
  'component-library': 'action.component-library',
  'architecture-retro': 'action.architecture-retro',
  'knowledge-base': 'action.knowledge-base',
  'demo-kit': 'action.demo-kit',
}

/** Locale key for each workflow action one-line hint. */
const ACTION_HINT: Readonly<Record<WorkflowActionId, DevWorkflowKey>> = {
  'agent-autonomous': 'hint.agent-autonomous',
  'agent-investigate': 'hint.agent-investigate',
  'agent-fix-loop': 'hint.agent-fix-loop',
  'agent-verify-gate': 'hint.agent-verify-gate',
  'agent-goal-drive': 'hint.agent-goal-drive',
  'agent-parallel': 'hint.agent-parallel',
  requirements: 'hint.requirements',
  'user-stories': 'hint.user-stories',
  'task-breakdown': 'hint.task-breakdown',
  docs: 'hint.docs',
  'ui-design': 'hint.ui-design',
  'tech-design': 'hint.tech-design',
  'api-design': 'hint.api-design',
  'data-model': 'hint.data-model',
  implement: 'hint.implement',
  refactor: 'hint.refactor',
  optimize: 'hint.optimize',
  'code-review': 'hint.code-review',
  'security-review': 'hint.security-review',
  'add-tests': 'hint.add-tests',
  'a11y-check': 'hint.a11y-check',
  debug: 'hint.debug',
  'dead-code': 'hint.dead-code',
  'deps-hygiene': 'hint.deps-hygiene',
  'temp-cleanup': 'hint.temp-cleanup',
  'import-hygiene': 'hint.import-hygiene',
  'debug-residue': 'hint.debug-residue',
  'git-status-brief': 'hint.git-status-brief',
  'commit-message': 'hint.commit-message',
  'commit-draft': 'hint.commit-draft',
  'commit-push': 'hint.commit-push',
  'github-private-publish': 'hint.github-private-publish',
  'pr-description': 'hint.pr-description',
  changelog: 'hint.changelog',
  'release-notes': 'hint.release-notes',
  'version-tag': 'hint.version-tag',
  'deploy-checklist': 'hint.deploy-checklist',
  'migration-plan': 'hint.migration-plan',
  'rollback-plan': 'hint.rollback-plan',
  'smoke-verify': 'hint.smoke-verify',
  'handoff-notes': 'hint.handoff-notes',
  'project-summary': 'hint.project-summary',
  standardize: 'hint.standardize',
  'product-deck': 'hint.product-deck',
  'component-library': 'hint.component-library',
  'architecture-retro': 'hint.architecture-retro',
  'knowledge-base': 'hint.knowledge-base',
  'demo-kit': 'hint.demo-kit',
}

type WorkflowGroupHeading = (typeof WORKFLOW_GROUPS)[number]['headingKey']

/** Injected verbs for the workflow panel. */
export interface WorkflowPanelInjected {
  /**
   * Send one workflow prompt into this session under the chosen mode.
   * @param id - workflow action id.
   * @param mode - analyze-only or allow-edits.
   * @returns null on success; an English failure line otherwise.
   */
  run: (id: WorkflowActionId, mode: WorkflowMode) => Promise<string | null>
  /**
   * List user-invocable skill names available to this session (for Skill badges).
   * @returns skill name tokens without a leading slash.
   */
  listSkillNames: () => Promise<readonly string[]>
  /** Ensure the right details column is open for this toolbox. */
  openPanel: () => void
}

/** Full props for the details-column workflow toolbox. */
export type WorkflowPanelProps =
  PropsRuntime<'conversation.details.workflow'>
  & InjectFace<WorkflowPanelInjected>
  & PropsStore<ReturnType<typeof createDevWorkflowStore>>
  & PropsLocale<typeof NS>

/**
 * Resolve which quick-access tab has content, preferring the user's choice.
 * @param preferred - persisted tab selection (may be missing on older persist blobs).
 * @param lengths - current list sizes for suggest / pinned / recent.
 * @returns the tab to show, or null when every list is empty.
 */
export function resolveQuickTab(
  preferred: DevWorkflowQuickTab | undefined,
  lengths: Readonly<{ suggest: number; pinned: number; recent: number }>,
): DevWorkflowQuickTab | null {
  const choice = preferred === 'pinned' || preferred === 'recent' || preferred === 'suggest'
    ? preferred
    : 'suggest'
  if (lengths[choice] > 0) return choice
  if (lengths.suggest > 0) return 'suggest'
  if (lengths.pinned > 0) return 'pinned'
  if (lengths.recent > 0) return 'recent'
  return null
}

/**
 * Grouped SDLC shortcut buttons with search and a merged quick-access strip.
 * Stage groups use exclusive accordion expand (at most one open).
 * Each click sends a skill gesture (`/dev-<id>`) plus task text through `run`.
 */
export function WorkflowPanel({
  run,
  listSkillNames,
  openPanel,
  useStore,
  actions,
  t,
}: WorkflowPanelProps) {
  const mode = useStore(s => s.mode)
  const openGroup = useStore(s => s.openGroup)
  const recent = useStore(s => s.recent)
  const pinned = useStore(s => s.pinned)
  const quickTab = useStore(s => s.quickTab)
  const [query, setQuery] = useState('')
  const [skillNames, setSkillNames] = useState<ReadonlySet<string>>(() => new Set())
  const [busy, setBusy] = useState<WorkflowActionId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pinFullHint, setPinFullHint] = useState(false)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    openPanel()
    void listSkillNames().then((names) => {
      if (!aliveRef.current) return
      setSkillNames(new Set(names))
    }, () => {
      // listSkillNames rejected: leave badges empty; buttons still work.
    })
    return () => {
      aliveRef.current = false
    }
  }, [listSkillNames, openPanel])

  const trimmed = query.trim().toLowerCase()
  const searching = trimmed.length > 0
  const matches = (id: WorkflowActionId): boolean => {
    if (!searching) return true
    const label = t(ACTION_LABEL[id]).toLowerCase()
    const hint = t(ACTION_HINT[id]).toLowerCase()
    return label.includes(trimmed) || hint.includes(trimmed)
  }

  const suggestions = searching
    ? []
    : suggestActions({ recent, pinned, mode })
  const recentShown = searching ? [] : recent.slice(0, 5)
  const pinnedShown = searching ? [] : pinned
  const activeQuick = searching
    ? null
    : resolveQuickTab(quickTab, {
      suggest: suggestions.length,
      pinned: pinnedShown.length,
      recent: recentShown.length,
    })

  const quickIds = activeQuick === 'suggest'
    ? suggestions
    : activeQuick === 'pinned'
      ? pinnedShown
      : activeQuick === 'recent'
        ? recentShown
        : []

  const toggleGroup = (headingKey: WorkflowGroupHeading): void => {
    actions.setOpenGroup(openGroup === headingKey ? null : headingKey)
  }

  const onPin = (id: WorkflowActionId): void => {
    if (!pinned.includes(id) && pinned.length >= 6) {
      setPinFullHint(true)
      return
    }
    setPinFullHint(false)
    actions.togglePin(id)
  }

  const onClick = (id: WorkflowActionId): void => {
    /* v8 ignore next -- action buttons set disabled while busy */
    if (busy !== null) return
    setBusy(id)
    setError(null)
    void run(id, mode).then((failure) => {
      if (!aliveRef.current) return
      setBusy(null)
      if (failure === null) {
        actions.recordRecent(id)
        setError(null)
        return
      }
      setError(failure)
    }, (reason: unknown) => {
      if (!aliveRef.current) return
      setBusy(null)
      setError(reason instanceof Error ? reason.message : String(reason))
    })
  }

  const renderActionButton = (id: WorkflowActionId) => {
    const hasSkill = skillNames.has(skillNameFor(id))
    const isPinned = pinned.includes(id)
    const title = hasSkill ? `${t(ACTION_HINT[id])} · ${t('skill.badge')}` : t(ACTION_HINT[id])
    return (
      <div key={id} className={css.actionRow}>
        <button
          type="button"
          className={css.button}
          disabled={busy !== null}
          aria-busy={busy === id || undefined}
          title={title}
          onClick={() => { onClick(id) }}
        >
          {busy === id
            ? <span className={css.buttonLabel}>{t('busy')}</span>
            : (
              <>
                <span className={css.buttonLabel}>{t(ACTION_LABEL[id])}</span>
                {hasSkill && <span className={css.skillBadge}>{t('skill.badge')}</span>}
              </>
            )}
        </button>
        <button
          type="button"
          className={css.pin}
          data-active={isPinned || undefined}
          aria-label={t('pin.aria')}
          aria-pressed={isPinned}
          disabled={busy !== null}
          onClick={() => { onPin(id) }}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
            <path
              d="M8 2l1.2 3.6H13l-3 2.2 1.2 3.6L8 9.2 4.8 11.4 6 7.8 3 5.6h3.8L8 2z"
              fill={isPinned ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    )
  }

  let anyMatch = false
  for (const group of WORKFLOW_GROUPS) {
    if (group.actions.some(matches)) {
      anyMatch = true
      break
    }
  }

  const quickTabs: readonly { id: DevWorkflowQuickTab; label: DevWorkflowKey; count: number }[] = [
    { id: 'suggest', label: 'section.suggest', count: suggestions.length },
    { id: 'pinned', label: 'section.pinned', count: pinnedShown.length },
    { id: 'recent', label: 'section.recent', count: recentShown.length },
  ]

  return (
    <div className={css.panel} data-testid="dev-workflow-panel" data-mode={mode}>
      <div className={css.mode}>
        <div className={css.modeLabel} id="dev-workflow-mode-label">{t('mode.label')}</div>
        <div className={css.modeRow} role="group" aria-labelledby="dev-workflow-mode-label">
          <button
            type="button"
            className={css.modeButton}
            data-active={mode === 'analyze' || undefined}
            aria-pressed={mode === 'analyze'}
            title={t('mode.analyze.hint')}
            onClick={() => { actions.setMode('analyze') }}
          >
            {t('mode.analyze')}
          </button>
          <button
            type="button"
            className={css.modeButton}
            data-active={mode === 'edit' || undefined}
            aria-pressed={mode === 'edit'}
            title={t('mode.edit.hint')}
            onClick={() => { actions.setMode('edit') }}
          >
            {t('mode.edit')}
          </button>
        </div>
      </div>

      <label className={css.search}>
        <span className={css.visuallyHidden}>{t('search.placeholder')}</span>
        <input
          type="search"
          className={css.searchInput}
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(event) => { setQuery(event.target.value) }}
        />
      </label>

      {activeQuick !== null && (
        <section className={css.section} data-testid="dev-workflow-quick">
          <div className={css.sectionHeading}>
            <div className={css.sectionTitle}>{t('section.quick')}</div>
            {activeQuick === 'recent' && (
              <button
                type="button"
                className={css.clearRecent}
                onClick={() => { actions.clearRecent() }}
              >
                {t('recent.clear')}
              </button>
            )}
          </div>
          <div
            className={css.quickTabs}
            role="tablist"
            aria-label={t('section.quick')}
          >
            {quickTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                className={css.quickTab}
                data-active={activeQuick === tab.id || undefined}
                aria-selected={activeQuick === tab.id}
                disabled={tab.count === 0}
                onClick={() => { actions.setQuickTab(tab.id) }}
              >
                {t(tab.label)}
              </button>
            ))}
          </div>
          <div
            className={css.compactGrid}
            data-testid={
              activeQuick === 'suggest'
                ? 'dev-workflow-suggest'
                : activeQuick === 'pinned'
                  ? 'dev-workflow-pinned'
                  : 'dev-workflow-recent'
            }
          >
            {quickIds.map(id => renderActionButton(id))}
          </div>
        </section>
      )}

      {searching && !anyMatch && (
        <div className={css.empty} role="status">{t('search.empty')}</div>
      )}

      {WORKFLOW_GROUPS.map((group) => {
        const visible = group.actions.filter(matches)
        if (searching && visible.length === 0) return null
        const expanded = searching || openGroup === group.headingKey
        return (
          <section key={group.headingKey} className={css.group}>
            <button
              type="button"
              className={css.headingRow}
              aria-expanded={expanded}
              onClick={() => {
                if (searching) return
                toggleGroup(group.headingKey)
              }}
            >
              <span className={css.heading}>{t(group.headingKey)}</span>
              {!searching && (
                <svg className={css.chevron} viewBox="0 0 16 16" width="12" height="12" aria-hidden>
                  <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            {expanded && (
              <div className={css.grid}>
                {visible.map(id => renderActionButton(id))}
              </div>
            )}
          </section>
        )
      })}
      {pinFullHint && (
        <div className={css.hintStatus} role="status">{t('pin.full')}</div>
      )}
      {error !== null && (
        <div className={css.error} role="status" title={error}>{t('sendFailed')}</div>
      )}
    </div>
  )
}
