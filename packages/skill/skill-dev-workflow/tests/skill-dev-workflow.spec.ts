import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import * as SkillDevWorkflow from '@deepseek-ai/dsh-skill-dev-workflow'
import { WORKFLOW_SKILL_IDS, skillNameFor } from '../src/catalog.ts'

describe('dsh-skill-dev-workflow', () => {
  it('registers every toolbox skill as user- and model-invocable', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    const fiber = await ctx.plugin(SkillDevWorkflow)
    const resourcePath = fileURLToPath(new URL('../src/', import.meta.url))

    const listed = await ctx.skills.list()
    expect(listed).toHaveLength(WORKFLOW_SKILL_IDS.length)
    expect(listed.every(s => s.provider === 'dev-workflow')).toBe(true)
    expect(listed.every(s => s.invocation.userInvocable && s.invocation.modelInvocable)).toBe(true)
    expect(listed.map(s => s.name).sort()).toEqual(
      WORKFLOW_SKILL_IDS.map(skillNameFor).slice().sort(),
    )

    const loaded = await ctx.skills.get(skillNameFor('implement'))
    expect(loaded?.content).toContain('Dev workflow — implement')
    expect(loaded?.content).toContain('Tool use')
    expect(loaded?.resourceBase).toEqual({ kind: 'directory', path: resourcePath })

    await fiber.dispose()
    expect(await ctx.skills.list()).toEqual([])
  })
})
