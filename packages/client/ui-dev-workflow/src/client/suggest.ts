/**
 * Client-only next-action suggestions for the workflow toolbox.
 * Ranking uses the flat SDLC group order; it does not read git or the session log.
 */
import { WORKFLOW_GROUPS, type WorkflowActionId, type WorkflowMode } from './prompts.ts'

/** Flattened action order matching {@link WORKFLOW_GROUPS}. */
const FLAT: readonly WorkflowActionId[] = WORKFLOW_GROUPS.flatMap(group => group.actions)

const EMPTY_RECENT_DEFAULT: readonly WorkflowActionId[] = [
  'requirements',
  'user-stories',
  'task-breakdown',
]

/**
 * Suggest up to three next workflow actions from recent history.
 * @param input - recent (newest first), pinned (unused for ranking), mode (reserved).
 * @returns up to three distinct action ids.
 */
export function suggestActions(input: {
  readonly recent: readonly WorkflowActionId[]
  readonly pinned: readonly WorkflowActionId[]
  readonly mode: WorkflowMode
}): WorkflowActionId[] {
  void input.pinned
  void input.mode
  if (input.recent.length === 0) return [...EMPTY_RECENT_DEFAULT]

  const anchor = input.recent[0]
  /* v8 ignore next -- callers only pass catalog ids; empty recent already returned */
  if (anchor === undefined) return [...EMPTY_RECENT_DEFAULT]
  const idx = FLAT.indexOf(anchor)
  // A non-catalog anchor (-1) wraps to the first entry: -1 + 1 = 0.
  const start = idx + 1
  const out: WorkflowActionId[] = []
  for (let i = 0; i < FLAT.length && out.length < 3; i++) {
    const id = FLAT[(start + i) % FLAT.length]
    /* v8 ignore next -- FLAT is non-empty and modulo stays in range */
    if (id === undefined) continue
    // Three consecutive positions in a cycle of 48 distinct ids never repeat.
    out.push(id)
  }
  return out
}
