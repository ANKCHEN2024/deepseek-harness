import { useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { WorkflowActionId, WorkflowMode } from './prompts.ts'
import { skillNameFor, WORKFLOW_GROUPS } from './prompts.ts'
import { NS, type DevWorkflowKey } from './locales.ts'
import css from './DevWorkflow.module.css'

/** Locale key for each workflow action button label. */
const ACTION_LABEL: Readonly<Record<WorkflowActionId, DevWorkflowKey>> = {
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
  'commit-message': 'action.commit-message',
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
  'commit-message': 'hint.commit-message',
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

/** Accordion default: only the Plan stage starts open. */
const DEFAULT_OPEN_GROUP: WorkflowGroupHeading = 'group.plan'

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
  & PropsLocale<typeof NS>

/**
 * Grouped SDLC shortcut buttons with an analyze/edit mode toggle.
 * Stage groups use exclusive accordion expand (at most one open).
 * Each click sends a skill gesture (`/dev-<id>`) plus task text through `run`.
 */
export function WorkflowPanel({ run, listSkillNames, openPanel, t }: WorkflowPanelProps) {
  const [mode, setMode] = useState<WorkflowMode>('edit')
  const [openGroup, setOpenGroup] = useState<WorkflowGroupHeading | null>(DEFAULT_OPEN_GROUP)
  const [skillNames, setSkillNames] = useState<ReadonlySet<string>>(() => new Set())
  const [busy, setBusy] = useState<WorkflowActionId | null>(null)
  const [error, setError] = useState<string | null>(null)
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

  const toggleGroup = (headingKey: WorkflowGroupHeading): void => {
    setOpenGroup(prev => (prev === headingKey ? null : headingKey))
  }

  const onClick = (id: WorkflowActionId): void => {
    if (busy !== null) return
    setBusy(id)
    setError(null)
    void run(id, mode).then((failure) => {
      if (!aliveRef.current) return
      setBusy(null)
      setError(failure)
    }, (reason: unknown) => {
      if (!aliveRef.current) return
      setBusy(null)
      setError(reason instanceof Error ? reason.message : String(reason))
    })
  }

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
            onClick={() => { setMode('analyze') }}
          >
            <span>{t('mode.analyze')}</span>
            <span className={css.modeHint}>{t('mode.analyze.hint')}</span>
          </button>
          <button
            type="button"
            className={css.modeButton}
            data-active={mode === 'edit' || undefined}
            aria-pressed={mode === 'edit'}
            onClick={() => { setMode('edit') }}
          >
            <span>{t('mode.edit')}</span>
            <span className={css.modeHint}>{t('mode.edit.hint')}</span>
          </button>
        </div>
      </div>
      {WORKFLOW_GROUPS.map((group) => {
        const expanded = openGroup === group.headingKey
        return (
          <section key={group.headingKey} className={css.group}>
            <button
              type="button"
              className={css.headingRow}
              aria-expanded={expanded}
              onClick={() => { toggleGroup(group.headingKey) }}
            >
              <span className={css.heading}>{t(group.headingKey)}</span>
              <svg className={css.chevron} viewBox="0 0 16 16" width="12" height="12" aria-hidden>
                <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {expanded && (
              <div className={css.grid}>
                {group.actions.map((id) => {
                  const hasSkill = skillNames.has(skillNameFor(id))
                  return (
                    <button
                      key={id}
                      type="button"
                      className={css.button}
                      disabled={busy !== null}
                      aria-busy={busy === id || undefined}
                      title={hasSkill ? `${t(ACTION_HINT[id])} · ${t('skill.badge')}` : t(ACTION_HINT[id])}
                      onClick={() => { onClick(id) }}
                    >
                      {busy === id
                        ? <span className={css.buttonLabel}>{t('busy')}</span>
                        : (
                          <>
                            <span className={css.buttonTop}>
                              <span className={css.buttonLabel}>{t(ACTION_LABEL[id])}</span>
                              {hasSkill && <span className={css.skillBadge}>{t('skill.badge')}</span>}
                            </span>
                            <span className={css.buttonHint}>{t(ACTION_HINT[id])}</span>
                          </>
                        )}
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
      {error !== null && (
        <div className={css.error} role="status" title={error}>{t('sendFailed')}</div>
      )}
    </div>
  )
}
