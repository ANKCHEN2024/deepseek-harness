# @deepseek-ai/dsh-skill-dev-workflow

English | [中文](README.zh.md)

Bundled provider of project-development workflow skills (`dev-requirements`, `dev-implement`, `dev-pr-description`, …). Registers one immutable provider on `ctx.skills` that contributes every toolbox stage as a user- and model-invocable skill. `dsh-tool-skill` remains the sole owner of catalog rendering and `/name` / `skill` tool loading.

Mount the plugin (enabled in the base composition) so agents can load these skills. The web toolbox sends whitespace-bounded `/dev-<action>` tokens through `conversation.send`; the host pre-step injects `<skill_content>` the same way as a menu pick or hand-typed slash. Behavior is specified by the [Web project development workflow toolbox Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-toolbox.md).

## Model Experience

Each skill body is durable instruction text. When the model loads a skill through the `skill` tool or the user (or toolbox) sends `/dev-<action>`, the rendered body is injected for that turn. Skill descriptions appear in the model-facing catalog for model-invocable entries.

#### KV Cache effect

Loading a skill appends its body to that turn's injected context, changing the prefix from that turn onward. Idle catalog listing does not send a provider request by itself.

## Known Limitations and Deferred Work

- **Bodies are fixed product copy** — there is no cordis config to customize per-deployment procedures.
- **No packaged binary assets** — these skills are instruction-only; they do not ship templates beyond the markdown body.
