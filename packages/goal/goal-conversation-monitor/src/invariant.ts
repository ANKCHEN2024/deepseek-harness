/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-goal-conversation-monitor`.
 * @module @deepseek-ai/dsh-goal-conversation-monitor/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-goal-conversation-monitor'

/** Cordis companion plugin name. */
export const name = 'goal-conversation-monitor-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the auto-dev switch is process-local only; durable goal
 * and session relations stay owned by the goal and session folds.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
