/** Model-visible inference prompt for one auto-dev monitor turn. */

import type { ContentBlock } from '@deepseek-ai/dsh-llm'

/** Stable plugin id used as MessageSource.plugin for monitor turns. */
export const AUTO_DEV_MONITOR_PLUGIN = 'goal-conversation-monitor'

/**
 * Render the complete monitor-inference instruction retained in session history.
 * @returns a fresh one-block prompt for `Agent.followup()`.
 */
export function renderAutoDevInferencePrompt(): ContentBlock[] {
  return [{
    type: 'text',
    text: '<auto_dev_monitor>\n'
      + 'Auto-dev monitoring is on. Review the conversation history, tool results, and the '
      + 'current workspace as authoritative. If concrete unfinished project work remains, call '
      + 'auto_dev_decide with decision "create" and a precise objective. If nothing remains to '
      + 'build, call auto_dev_decide with decision "none". Do not invent routine chatter as a '
      + 'goal. Do not call create_goal or update_goal create/edit/resume in this turn.\n'
      + '</auto_dev_monitor>',
  }]
}
