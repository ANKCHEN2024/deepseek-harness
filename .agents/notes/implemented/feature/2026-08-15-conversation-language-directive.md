# Agent Note: Deployment conversation language directive

Status: implemented

English | [中文](2026-08-15-conversation-language-directive.zh.md)

## Problem

A model answers in the language it infers from the conversation, and a deployment whose persona and tool guidance are English tends to get English replies. Deployments and individual presets need one configuration key that pins the conversation language — including the internal thinking a reasoning model performs, not only the visible replies — without rewriting the persona text.

## Decision

`dsh-system-prompt` gains a `language` config key. It registers an unconditional order-−50 `deployment:language` section (between the harness identity at −100 and the persona at 0) whose text is the fixed directive `Always think and respond in <language>. This includes your internal reasoning, not only your visible replies.` Empty means no directive; the section drops at render. The pinned sentence has one owner: the exported `languageDirective(language)` helper.

The `dsh-persona` row gains the same key, registered in the mounting scope like its persona slot, so a preset overrides the deployment directive for its agent alone. Its schema deliberately omits a default: an omitted key keeps the deployment directive, `''` occupies the slot with empty text and shadows the directive away, and any other value replaces it with the identical fixed sentence.

App spines that already forward prompt config (`agent-spine-demo` and its `dsh-acp-demo` wrapper) forward `language` exactly like `persona`; the Web deployment configures it on the host `system-prompt` row.

## Alternatives considered

**Write the directive into each persona text.** Works with zero code but is not a setting: every preset duplicates the sentence, the thinking-phase phrasing drifts across copies, and there is no deployment default to override per preset.

**A dedicated language row package.** The registry slot and the preset row are two small halves of one concept; a separate package would duplicate the shadowing pattern `dsh-persona` already implements for its identity slot.

**A runtime user-settings namespace with GUI controls.** A live-reloadable per-user language is possible but needs a settings namespace, a file-backed provider, prompt-consumer wiring, and a browser settings panel; the fixed per-deployment and per-preset keys cover the reported need today.

## Consequences

One key on either plane pins the model's conversation language, visible replies and internal reasoning alike, with the same sentence everywhere. The section is static per agent, so the directive adds a fixed prefix cost and stays KV-cache-prefix-stable for the agent's life. The Web GUI reads it from the host row or the preset row; a change requires a server restart, like every other prompt-config change.
