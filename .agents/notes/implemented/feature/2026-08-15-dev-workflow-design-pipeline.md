# Agent Note: Dev workflow toolbox design pipeline

Status: implemented

English | [中文](2026-08-15-dev-workflow-design-pipeline.zh.md)

## Problem

The [web development workflow toolbox](2026-08-15-web-dev-workflow-toolbox.md) shipped forty-eight actions that treat design as a text-producing step before implementation: `dev-ui-design` explicitly produced a text plan with no design-draft input, no action compared the implemented UI against the design, and the requirements → user stories → task breakdown → implementation stages each emitted free-form text with no artifact the next stage could consume. Design intent never became a checkable constraint, so visual drift, unmanaged tokens, and static-only accessibility checks went unverified.

## Decision

`@deepseek-ai/dsh-skill-dev-workflow` and `@deepseek-ai/dsh-client-ui-dev-workflow` add one action and deepen six existing ones around two mechanisms.

**Design-draft consumption and visual verification.** `dev-ui-design` now consumes design drafts (image files read through the environment's image-reading tool) to extract layout, spacing, color, type, components, and states, marks what each draft leaves unspecified, and emits per-view acceptance criteria. A new `dev-visual-check` action in the quality group captures the implemented UI with browser/screenshot tools when available (otherwise tells the user exactly which screens and states to capture) and compares each view and state against the design spec, reporting a prioritized blocker/major/minor deviation list without fixing code. `dev-a11y-check` becomes runtime-first: it opens the target pages when browser tools exist and falls back to static review otherwise. `dev-component-library` additionally extracts design tokens (semantic name, raw value, code location).

**Artifact handoff between stages.** The pipeline stages share fixed artifacts under `docs/`: `requirements.md`, `user-stories.md`, `task-breakdown.md`, `ui-design.md`, `visual-check.md`. Each stage reads the previous artifact when it exists and writes its own only in edit mode (`analyze` emits the same sections as text). `dev-task-breakdown` also mirrors its task list into the todo tool when available, and `dev-implement` reads the pipeline artifacts to keep changes aligned with scope and acceptance criteria.

Both the bundled skill bodies (`catalog.ts`) and the client fallback prompts (`prompts.ts`) carry the new wording; the action catalog, risk table (`visual-check` is `writes-repo` because edit mode writes the report), group layout, and Chinese/English locale entries are updated in lockstep. The toolbox action count is now forty-nine.

## Alternatives considered

### Why not a design-asset capability package?

Screenshot capture, image generation, and visual diff engines are runtime capabilities the dev-workflow skill catalog deliberately stays independent of. The skills consume whatever image-reading and browser tools the environment provides and instruct the user when they are absent, matching the existing "use X tools when available" convention. A capability seam can be added later without changing the skill wording.

### Why not a new "design" stage group?

The toolbox already has a design stage; visual check is a verification action and sits in the quality group next to the accessibility check, keeping the stage semantics (design = produce, quality = verify) intact.

### Why files under `docs/` rather than a dedicated plan directory?

`docs/` is the repository-standard location for project documents, and the pipeline artifacts are ordinary project documents. A bespoke directory would need a new convention with no consumer.

## Consequences

- Design intent is now a checkable input: drafts enter `ui-design`, and `visual-check` verifies the implementation against the spec, closing the visual-drift gap.
- The artifact chain makes consecutive toolbox actions composable; each stage reads the previous artifact instead of re-deriving scope from the conversation.
- Skill bodies and fallback prompts remain plain text in two packages and stay environment-agnostic (browser/image tools are optional), so the new actions degrade to explicit user instructions rather than failing.
- The client search count for design-related matches grows from two to three (the visual-check hint contains 设计); the panel test pins the new number.
