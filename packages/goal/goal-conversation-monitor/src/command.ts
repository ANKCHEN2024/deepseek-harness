/** Human-facing `/auto-dev` command over the conversation monitor switch. */

import type { Context } from '@deepseek-ai/cordis'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'

const USAGE = 'Usage: /auto-dev [on|off|status]'

type AutoDevCommand =
  | { readonly kind: 'status' }
  | { readonly kind: 'on' }
  | { readonly kind: 'off' }
  | { readonly kind: 'invalid' }

/** Parse only the grammar owned by `/auto-dev`. */
function parseAutoDevCommand(rawInput: string): AutoDevCommand {
  const input = rawInput.trim().toLowerCase()
  if (input.length === 0 || input === 'status') return { kind: 'status' }
  if (input === 'on') return { kind: 'on' }
  if (input === 'off') return { kind: 'off' }
  return { kind: 'invalid' }
}

/** Fail loudly if a locally closed union gains an unhandled member. */
/* v8 ignore start -- closed-union backstop is unreachable without violating the TypeScript contract */
function assertNever(value: never, label: string): never {
  throw new TypeError(`unknown ${label}: ${String(value)}`)
}
/* v8 ignore stop */

/** Execute one parsed `/auto-dev` command. */
function executeAutoDevCommand(ctx: Context, invocation: CommandInvocation): CommandResult {
  const command = parseAutoDevCommand(invocation.rawInput)
  switch (command.kind) {
    case 'invalid':
      return { kind: 'error', text: USAGE }
    case 'on':
      ctx.autoDev.setOn(invocation.agent, true)
      return { kind: 'success', text: 'Auto-dev monitoring is on.' }
    case 'off':
      ctx.autoDev.setOn(invocation.agent, false)
      return { kind: 'success', text: 'Auto-dev monitoring is off.' }
    case 'status': {
      const status = ctx.autoDev.status(invocation.agent)
      const goalLine = status.goal === undefined
        ? 'Goal: none'
        : `Goal: ${status.goal.phase} (${status.goal.activation}) — ${status.goal.objective}`
      return {
        kind: 'success',
        text: [
          `Auto-dev: ${status.on ? 'on' : 'off'}`,
          `Cancel-hold: ${status.cancelHold ? 'yes' : 'no'}`,
          goalLine,
          '',
          USAGE,
        ].join('\n'),
      }
    }
    /* v8 ignore next 2 -- AutoDevCommand is closed and every member is handled above */
    default: return assertNever(command, 'auto-dev command')
  }
}

/**
 * Register `/auto-dev` on the commands registry.
 * @param ctx - context carrying commands and autoDev.
 * @returns disposer that unregisters the command.
 */
export function registerAutoDevCommand(ctx: Context): () => void {
  return ctx.commands.register({
    name: 'auto-dev',
    description: 'turn conversation auto-dev monitoring on or off',
    input: { hint: '[on|off|status]' },
    handler: invocation => executeAutoDevCommand(ctx, invocation),
  })
}
