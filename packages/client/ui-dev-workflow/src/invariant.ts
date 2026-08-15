/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-dev-workflow`.
 * @module @deepseek-ai/dsh-client-ui-dev-workflow/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-dev-workflow'

/** Cordis companion plugin name. */
export const name = 'client-ui-dev-workflow-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this package contributes skill-backed shortcuts into
 * two slots and issues conversation.send / layout.openDetails / skill.list.
 * It emits no cordis events, owns no cross-plugin mutable state, and its slot
 * registrations prove disposal through the HMR-safety path of the slot system.
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
