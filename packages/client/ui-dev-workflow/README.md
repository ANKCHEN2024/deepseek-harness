# @deepseek-ai/dsh-client-ui-dev-workflow

English | [中文](README.zh.md)

Web project-development workflow toolbox: contributes a grouped shortcut strip to `conversation.details.workflow` and a header utility that re-opens the right details column. Thirty-three SDLC actions cover plan, design, build, quality, ship, and post-delivery wrap-up (project summary, standardize, product deck, component library, architecture retro, knowledge base, demo kit). Each click sends a whitespace-bounded `/dev-<action>` token plus mode/task text through session-scoped `conversation.send`, so host `dsh-tool-skill` injects the matching bundled skill from `@deepseek-ai/dsh-skill-dev-workflow`. When that skill is missing from the session catalog, the toolbox falls back to a plain Chinese prompt. A panel toggle chooses analyze-only versus allow-edits. The package does not register Host slash commands and does not replace the tool-details seat below the strip.

On mount the panel calls `layout.openDetails()` and loads `skill.list` to badge actions whose skills are present. A persisted store (`dsh.dev-workflow.panel.v1`) keeps mode, exclusive accordion stage, recent (cap 8), and pins (cap 6) across remounts. The strip adds local search, up to three client-heuristic suggestions from the flat SDLC order, and pin controls beside each action; suggestions do not read git. Styling uses tokens only; copy goes through the `dev-workflow` locale namespace. Behavior is specified by the [Web project development workflow toolbox Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-toolbox.md).

## Model Experience

Each button injects one user text message into the live session. When the skill is available, the message begins with `/dev-<action>` so the host pre-step loads the skill body as `skill-invocation` context (same path as the `/` skill menu). Mode constraints and the stage focus text ride in the same user message. No tool schema or system-prompt section is owned here.

#### KV Cache effect

A click appends a new user turn (and, when the gesture matches, skill injection for that turn), so the provider request prefix changes from that turn onward. Idle UI (no click) does not assemble or send provider requests beyond the optional `skill.list` catalog fetch.

## Known Limitations and Deferred Work

- **The action set is fixed** — there is no settings UI or cordis config for custom workflows in this package.
- **Skills are host-bundled** — bodies live in `@deepseek-ai/dsh-skill-dev-workflow`; this client only emits the `/name` gesture and falls back to plain prompts when the skill is absent.
- **Opening the column shares the details panel with tool inspection** — selecting a tool call still uses the lower half of the same column; this package does not own tool rendering.
- **Suggestions are client heuristics** — ranking uses recent clicks and the flat group order only; skill-badge state remains panel-local and resets on remount. Accordion expand keeps at most one stage open.
