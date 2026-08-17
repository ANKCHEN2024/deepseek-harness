/**
 * A per-agent persona as a composable row.
 *
 * `dsh-system-prompt` owns the global persona and the global language
 * directive as its own config, and registers both sections unconditionally —
 * so this row is **scope-only**. Mounted inside an agent preset it shadows
 * the deployment persona (and, when configured, the deployment language
 * directive) for that one session, exactly like the per-child persona
 * `dsh-subagent` installs; mounted globally it collides with the registry's
 * own registration and fails loud.
 *
 * That constraint is the reason the row exists. An agent preset cannot mount
 * the prompt registry itself, so without a row of its own a preset could
 * change an agent's tools but never its identity.
 * @module @deepseek-ai/dsh-persona
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-system-prompt'

// Imported rather than restated: the registry declares the slots this row
// replaces, and two hardcoded copies would drift into a preset whose persona
// or language directive silently lands beside the deployment's instead of
// shadowing it.
import {
  LANGUAGE_ORDER,
  LANGUAGE_SECTION,
  PERSONA_ORDER,
  PERSONA_SECTION,
  languageDirective,
} from '@deepseek-ai/dsh-system-prompt'

export { LANGUAGE_ORDER, LANGUAGE_SECTION, PERSONA_ORDER, PERSONA_SECTION }

/** Cordis plugin name. */
export const name = 'persona'

/** The prompt registry this row contributes to. */
export const inject = ['systemPrompt']

/** Plugin config: the persona text this composition contributes. */
export interface Config {
  /**
   * Persona prose rendered as the `deployment:persona` section. A template:
   * complete `{{…}}` groups interpolate strictly against registered prompt
   * variables. Empty text drops the section at render, matching the registry.
   */
  text: string
  /** Make this persona the complete system prompt, suppressing every other section. */
  complete?: boolean
  /** Suppress dynamic runtime-context snapshots for this persona's agent scope. */
  includeRuntimeContext?: boolean
  /**
   * Conversation language for this agent scope, rendered as the
   * `deployment:language` directive. Omitted keeps the deployment directive;
   * `''` shadows it away entirely; any other value replaces it with the same
   * fixed directive sentence the registry renders.
   */
  language?: string
}

/** Runtime schema for the persona row. */
export const Config: z<Config> = z.object({
  text: z.string().required(),
  complete: z.boolean().default(false),
  includeRuntimeContext: z.boolean().default(true),
  // No default: an omitted language keeps the deployment directive, while an
  // explicit empty string shadows it away for this scope.
  language: z.string(),
})

/**
 * Register the persona section for the mounting context's scope.
 * @param ctx - an agent scope context; an unscoped context collides with the
 * prompt registry's own persona registration and rejects.
 * @param config - the persona text and complete-prompt policy.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.effect(() => ctx.systemPrompt.section({
    name: PERSONA_SECTION,
    order: PERSONA_ORDER,
    text: config.text,
    ...(config.complete ? { complete: true } : {}),
  }), 'persona.section()')
  // Register only when configured: an omitted language keeps the deployment
  // directive, while `''` occupies the slot with empty text and shadows it away.
  const language = config.language
  if (language !== undefined) {
    ctx.effect(() => ctx.systemPrompt.section({
      name: LANGUAGE_SECTION,
      order: LANGUAGE_ORDER,
      text: language === '' ? '' : languageDirective(language),
    }), 'persona.language()')
  }
  if (!(config.includeRuntimeContext ?? true)) ctx.systemPrompt.suppressRuntimeContext()
}
