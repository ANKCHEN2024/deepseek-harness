# @deepseek-ai/dsh-client-ui-dev-workflow

English | [中文](README.zh.md)

Web project-development workflow toolbox: contributes a grouped shortcut strip to `conversation.details.workflow` and a header utility that re-opens the right details column. Forty-nine SDLC and agent-playbook actions cover Agent, plan, design, build, quality, cleanup, ship, and post-delivery wrap-up (project summary, standardize, product deck, component library, architecture retro, knowledge base, demo kit). The quality group includes a visual check that compares implementation screenshots against the design spec. The Agent group drives multi-step tool loops (autonomous, investigate, fix, verify gates, goal-driven, parallel). Ship includes review-changes, commit draft, commit-and-push, and publish-to-private-GitHub alongside the existing release actions. Each click opens an inline send-confirmation bar: it shows the action hint, an optional task-scope input, and a per-send mode switch, and remote side-effect actions (commit-push, private publish) default to analyze-only with a risk notice. Confirming sends a whitespace-bounded `/dev-<action>` token plus mode/task text through session-scoped `conversation.send`, so host `dsh-tool-skill` injects the matching bundled skill from `@deepseek-ai/dsh-skill-dev-workflow`. When that skill is missing from the session catalog, the toolbox falls back to a plain Chinese prompt. Send failures show a categorized error with retry in place; success shows a transient sent toast, records the action as recent, and returns focus to the origin action (or the panel when that action unmounted). A panel toggle chooses analyze-only versus allow-edits. The package does not register Host slash commands and does not replace the tool-details seat below the strip.

On mount the panel calls `layout.openDetails()` and loads `skill.list` to badge actions whose skills are present. A persisted store (`dsh.dev-workflow.panel.v1`) keeps mode, exclusive accordion stage, recent (cap 8), pins (cap 6), and the quick-access tab across remounts. The strip adds local search plus a merged quick strip (Suggested / Pinned / Recent segments, up to three client-heuristic suggestions from the flat SDLC order) with ghost pin controls beside each action; suggestions do not read git. Stage actions render as single-line labels (hints live in `title`). The send-confirmation bar shows the hint body; the optional notes input appends a task-scope paragraph, and the static `ACTION_RISK` table drives the risk copy and per-send default mode, with remote publish actions defaulting to analyze-only. The bar scrolls into view when it opens, and Escape cannot dismiss it while a send is in flight. The mode selector is a single-line segmented control; stage headings disable while searching. Search reports a match count and offers an in-box clear button; `/` or Ctrl/Cmd+K focuses it (never from inside an input) and Escape clears it; the no-match state lists recent actions as a fallback. Sent and pin-full feedback render as auto-dismissing chips that stick to the visible bottom edge of the panel. The quick strip uses segmented-control semantics, pin buttons carry per-action names, and action hints are screen-reader readable. Styling uses tokens only; copy goes through the `dev-workflow` locale namespace. Behavior is specified by the [Web project development workflow toolbox Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-toolbox.md), the [send-confirmation Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-send-confirmation.md), the [keyboard and accessibility Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-keyboard-a11y.md), and the [focus and feedback Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-focus-feedback.md).

## Model Experience

### Dev workflow sends

#### What the model sees

Each button injects one user text message into the live session. When the skill is available, the message begins with `/dev-<action>` so the host pre-step loads the skill body as `skill-invocation` context (same path as the `/` skill menu). Mode constraints and the stage focus text ride in the same user message. No tool schema or system-prompt section is owned here.

#### Token effect

One user text message per click (the action token plus optional mode/task text); no standing prompt-section or tool-schema cost. When the skill resolves, that turn also carries the injected skill body, whose token cost belongs to `@deepseek-ai/dsh-skill-dev-workflow`.

#### KV Cache effect

A click appends a new user turn (and, when the gesture matches, skill injection for that turn), so the provider request prefix changes from that turn onward. Idle UI (no click) does not assemble or send provider requests beyond the optional `skill.list` catalog fetch.

## Known Limitations and Deferred Work

- **The action set is fixed** — there is no settings UI or cordis config for custom workflows in this package.
- **Skills are host-bundled** — bodies live in `@deepseek-ai/dsh-skill-dev-workflow`; this client only emits the `/name` gesture and falls back to plain prompts when the skill is absent.
- **Opening the column shares the details panel with tool inspection** — selecting a tool call still uses the lower half of the same column; this package does not own tool rendering.
- **Suggestions are client heuristics** — ranking uses recent clicks and the flat group order only; skill-badge state remains panel-local and resets on remount. Accordion expand keeps at most one stage open.
- **Long labels truncate in the two-column stage grids** — narrow details columns elide long action labels (e.g. the English `Publish private repo`) with a `title` tooltip; the send-confirmation bar always shows the full action name.
- **GitHub publish actions need local tooling** — `commit-push` / `github-private-publish` rely on the host agent's `git`/`gh` and existing auth; the toolbox does not store tokens or open a native Git UI.
- **Risk levels are static client hints** — `ACTION_RISK` classifies from each action prompt's edit clauses; it reads no repository or remote state and is not a Host permission or sandbox switch. The analyze-only default for remote publish actions is just a UI pre-selection in the send bar.
