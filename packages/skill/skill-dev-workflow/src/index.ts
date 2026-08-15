/**
 * Bundled project-development workflow skills: one user- and model-invocable
 * skill per toolbox action. Bodies are Chinese agent procedures; the web
 * toolbox loads them through the host `/name` gesture (`dsh-tool-skill`).
 * @module @deepseek-ai/dsh-skill-dev-workflow
 */

import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import {
  BUNDLED_SKILL_RANK,
  type SkillCandidate,
  type SkillDefinition,
  type SkillProvider,
} from '@deepseek-ai/dsh-skill'
import { WORKFLOW_SKILL_ENTRIES, WORKFLOW_SKILL_IDS, type WorkflowSkillId } from './catalog.ts'

export type { WorkflowSkillId }
export {
  skillNameFor,
  WORKFLOW_SKILL_ENTRIES,
  WORKFLOW_SKILL_IDS,
  WORKFLOW_SKILL_NAMES,
} from './catalog.ts'

const PROVIDER_NAME = 'dev-workflow'
const RESOURCE_BASE = {
  kind: 'directory' as const,
  path: fileURLToPath(new URL('.', import.meta.url)),
}

function candidateFor(id: WorkflowSkillId): SkillCandidate {
  const entry = WORKFLOW_SKILL_ENTRIES[id]
  return {
    name: entry.name,
    description: entry.description,
    invocation: { modelInvocable: true, userInvocable: true },
    provider: PROVIDER_NAME,
    source: 'bundled',
    resourceBase: RESOURCE_BASE,
    rank: BUNDLED_SKILL_RANK,
    locator: id,
  }
}

const CANDIDATES: readonly SkillCandidate[] = WORKFLOW_SKILL_IDS.map(candidateFor)

const provider: SkillProvider = {
  name: PROVIDER_NAME,
  list: () => Promise.resolve(CANDIDATES),
  get(candidate): Promise<SkillDefinition | undefined> {
    const id = candidate.locator
    if (typeof id !== 'string' || !(id in WORKFLOW_SKILL_ENTRIES)) {
      return Promise.resolve(undefined)
    }
    const entry = WORKFLOW_SKILL_ENTRIES[id as WorkflowSkillId]
    return Promise.resolve({
      name: entry.name,
      description: entry.description,
      invocation: { modelInvocable: true, userInvocable: true },
      provider: PROVIDER_NAME,
      source: 'bundled',
      resourceBase: RESOURCE_BASE,
      content: entry.content,
    })
  },
}

/** Cordis plugin name. */
export const name = 'skill-dev-workflow'
/** Service required by the bundled provider. */
export const inject = ['skills']

/** Register the bundled project-development workflow skills on `ctx.skills`. */
export function apply(ctx: Context): void {
  ctx.skills.registerProvider(() => provider)
}
