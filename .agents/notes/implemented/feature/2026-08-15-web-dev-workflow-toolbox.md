# Agent Note: Web project development workflow toolbox

Status: implemented

English | [中文](2026-08-15-web-dev-workflow-toolbox.zh.md)

## Problem

Web users building products with the harness need one-click entry points for common project-lifecycle work — requirements, documentation, UI design, implementation, review, tests, debug, and release notes. Those intents are ordinary conversation prompts, not Host slash commands such as `/plan` or `/compact`.

The right details column already exists for tool-call inspection, but it starts closed and has no chrome for workflow shortcuts. Putting the toolbox on the composer left/right seats would bury lifecycle actions among input chrome; replacing the entire `details` single seat would drop tool details.

## Decision

`@deepseek-ai/dsh-client-ui-conversation` declares a session-scoped list slot `conversation.details.workflow` inside the existing DetailsPanel. The panel always renders that list above the tool-details body. `@deepseek-ai/dsh-client-ui-dev-workflow` injects a grouped button strip into that slot and a header utility that calls `layout.openDetails()`.

Each button runs `sessions.scope(sessionId).conversation.send(messageFor(id, mode))`. When the matching bundled skill from `@deepseek-ai/dsh-skill-dev-workflow` is present in `skill.list`, the message leads with `/dev-<action>` so host `dsh-tool-skill` injects `<skill_content>` on the same path as the `/` skill menu; otherwise the toolbox sends a plain Chinese prompt. Thirty-three actions span plan/design/build/quality/ship/wrap-up; the ship group covers commit → PR → changelog/release notes → version/tag → deploy → migration/rollback → smoke verify → handoff; the wrap-up group covers project summary → standardize → product deck → component library → architecture retro → knowledge base → demo kit. Buttons show one-line hints and a Skill badge when the catalog lists the skill; stage groups use exclusive accordion expand (at most one open; Plan starts open). `@deepseek-ai/dsh-client-ui-layout` starts details at the contract default, keeps it open across Session switches (including blank new-session heroes), and only forces width 0 when no Session is current; the workflow package still exposes a header control that calls `layout.openDetails()` after an explicit close. Narrow viewports may still auto-close via the concession chain.

## Alternatives considered

### Why not composer `conversation.input.left`?

That seat is for compact input-adjacent controls. An SDLC toolbox with staged groups and hints needs vertical space; forcing it into the composer row either overflows or loses scannability.

### Why not replace the `details` single seat?

Replacing DetailsPanel would require re-implementing tool-detail rendering or forking ui-tool wiring. Declaring a child list seat keeps tool inspection and adds workflow chrome without a second column.

### Why not Host slash commands?

`/plan` and `/compact` are harness control surfaces with their own lifecycle. "Write project docs" and "Design UI" are model tasks. Promoting them to `ctx.commands` would invent command handlers that only forward text. Loading real skill bodies uses the existing user `/name` gesture instead of new Host commands.

### Why not a dedicated `skills.invoke` RPC?

Invocation is already `session.prompt` plus a whitespace-bounded `/name`. A second wire path would duplicate policy, logging, and TUI/ACP parity for no gain.

## Consequences

- The right column now has a permanent product purpose beyond tool inspection when the workflow plugin is mounted.
- Default-open details increases horizontal chrome on narrow viewports until the layout concession chain closes it; blank sessions now keep the toolbox reachable before the first user message.
- Fixed prompts and skill bodies are product copy: changing wording or the action catalog is a package change in `ui-dev-workflow` and `skill-dev-workflow`, not a settings document.
- Analyze/edit mode is panel-local UI state that only changes the user-message preamble; it is not a Host permission or sandbox switch.
- Skill execution shares the host `/name` gesture with the slash menu; missing catalog entries fall back to plain prompts rather than forging `<skill_content>` on the client.
