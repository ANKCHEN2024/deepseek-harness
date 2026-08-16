/** Types for the conversation auto-dev monitor switch. */

import type { Agent } from '@deepseek-ai/dsh-agent'
import type { GoalView } from '@deepseek-ai/dsh-goal'

/** Process-local auto-dev switch and hold state for one agent. */
export interface AutoDevStatus {
  /** Whether automatic monitoring is armed for this agent. */
  readonly on: boolean
  /** Whether cancel suppressed auto-resume until human re-engagement. */
  readonly cancelHold: boolean
  /** Current goal view, if any. */
  readonly goal: GoalView | undefined
}

/**
 * Conversation-driven auto-dev control surface (`ctx.autoDev`).
 * The switch is process-local and never persisted.
 */
export interface AutoDevMonitor {
  /**
   * Whether the process-local switch is on for this exact live agent.
   * @param agent - exact live agent.
   */
  isOn(agent: Agent): boolean
  /**
   * Turn the switch on or off; off disarms goals and cancels monitor work.
   * @param agent - exact live agent.
   * @param on - desired armed state.
   */
  setOn(agent: Agent, on: boolean): void
  /**
   * Snapshot for `/auto-dev status` and tests.
   * @param agent - exact live agent.
   */
  status(agent: Agent): AutoDevStatus
  /**
   * After an empty inference (`none`), stay quiet until a human message or switch cycle.
   * @param agent - exact live agent.
   */
  markQuietUntilHuman(agent: Agent): void
}
