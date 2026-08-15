/**
 * Stable skill ids / names / bodies for the project-development workflow
 * toolbox. Names are kebab tokens matching the host `/name` gesture.
 */

/** Toolbox action id; mirrors the client `WorkflowActionId` set. */
export type WorkflowSkillId =
  | 'requirements'
  | 'user-stories'
  | 'task-breakdown'
  | 'docs'
  | 'ui-design'
  | 'tech-design'
  | 'api-design'
  | 'data-model'
  | 'implement'
  | 'refactor'
  | 'optimize'
  | 'code-review'
  | 'security-review'
  | 'add-tests'
  | 'a11y-check'
  | 'debug'
  | 'commit-message'
  | 'pr-description'
  | 'changelog'
  | 'release-notes'
  | 'version-tag'
  | 'deploy-checklist'
  | 'migration-plan'
  | 'rollback-plan'
  | 'smoke-verify'
  | 'handoff-notes'
  | 'project-summary'
  | 'standardize'
  | 'product-deck'
  | 'component-library'
  | 'architecture-retro'
  | 'knowledge-base'
  | 'demo-kit'

/** One bundled skill's catalog fields and instruction body. */
export interface WorkflowSkillEntry {
  /** Host `/name` token (`dev-<id>`). */
  readonly name: string
  /** Model- and menu-facing description (English; catalog convention). */
  readonly description: string
  /** Full skill markdown loaded into `<skill_content>`. */
  readonly content: string
}

/**
 * Map a toolbox action id to its bundled skill name.
 * @param id - workflow skill / action id.
 * @returns whitespace-bounded `/name` token without the leading slash.
 */
export function skillNameFor(id: WorkflowSkillId): string {
  return `dev-${id}`
}

const TOOL_RULES = `## Tool use

- Inspect the workspace with read/search tools before asserting facts.
- Prefer existing repository conventions, scripts, and tests.
- Do not invent files, APIs, or schemas that are not in the tree.
- When the user message sets 执行模式 to 只分析, do not create, modify, or delete files and do not run mutating commands.
- When 执行模式 is 可改代码, make the smallest verified change set and say how to verify.
- Reply in Chinese unless the user asks otherwise.`

function skillDoc(title: string, procedure: string): string {
  return `# ${title}

${TOOL_RULES}

## Procedure

${procedure}
`
}

/** Ordered skill ids (matches the web toolbox action catalog). */
export const WORKFLOW_SKILL_IDS: readonly WorkflowSkillId[] = [
  'requirements',
  'user-stories',
  'task-breakdown',
  'docs',
  'ui-design',
  'tech-design',
  'api-design',
  'data-model',
  'implement',
  'refactor',
  'optimize',
  'code-review',
  'security-review',
  'add-tests',
  'a11y-check',
  'debug',
  'commit-message',
  'pr-description',
  'changelog',
  'release-notes',
  'version-tag',
  'deploy-checklist',
  'migration-plan',
  'rollback-plan',
  'smoke-verify',
  'handoff-notes',
  'project-summary',
  'standardize',
  'product-deck',
  'component-library',
  'architecture-retro',
  'knowledge-base',
  'demo-kit',
] as const

/** Bundled skill catalog keyed by toolbox action id. */
export const WORKFLOW_SKILL_ENTRIES: Readonly<Record<WorkflowSkillId, WorkflowSkillEntry>> = {
  requirements: {
    name: skillNameFor('requirements'),
    description: 'Run structured product requirements analysis for the current workspace.',
    content: skillDoc('Dev workflow — requirements', `Produce a structured requirements brief with:

1. Goals and measurable success criteria
2. Target users and primary / reverse scenarios
3. In scope / out of scope
4. Constraints (tech, time, deps, compliance)
5. Open questions that cannot be inferred from the repo
6. Acceptance criteria (Given/When/Then or equivalent)
7. Suggested next stage (plan / design / implement)`),
  },
  'user-stories': {
    name: skillNameFor('user-stories'),
    description: 'Write prioritized user stories and acceptance scenarios for the current goal.',
    content: skillDoc('Dev workflow — user stories', `Write user stories and scenes:

1. Stories as “As a… I want… so that…”, ordered by value
2. 2–5 acceptance conditions per story
3. Dependencies, risks, and parallelizable items
4. MVP vs later iterations
Do not implement unless 执行模式 allows edits and the user asked to implement.`),
  },
  'task-breakdown': {
    name: skillNameFor('task-breakdown'),
    description: 'Break the current goal into an ordered executable task list with dependencies.',
    content: skillDoc('Dev workflow — task breakdown', `Split the goal into executable tasks:

1. Priority order; each item needs deliverable, deps, and S/M/L complexity
2. Parallelizable work and the critical path
3. Suggested implementation order and milestone checkpoints
4. Files / modules to read first
Do not start coding unless 执行模式 allows edits and the user explicitly asked.`),
  },
  docs: {
    name: skillNameFor('docs'),
    description: 'Write or update project documentation from the real repository structure.',
    content: skillDoc('Dev workflow — documentation', `Write or update docs (README first; architecture notes under docs/ when needed):

1. What the project is and the problem it solves
2. Quick start / local run with real commands
3. Directory and module responsibilities
4. Key configuration, conventions, and extension points
5. FAQ and troubleshooting entry points
Reflect the real tree; read code before writing. When edits are allowed, apply doc changes and name paths.`),
  },
  'ui-design': {
    name: skillNameFor('ui-design'),
    description: 'Produce a text UI/UX design for the current product surfaces.',
    content: skillDoc('Dev workflow — UI design', `Produce a text UI / interaction design (no external design tools):

1. Information architecture and primary views
2. Key user flows including failure branches
3. Layout, component hierarchy, and key copy
4. Empty / loading / error / success / unauthorized states
5. Accessibility and responsive constraints
Align with any design system already in the repo.`),
  },
  'tech-design': {
    name: skillNameFor('tech-design'),
    description: 'Produce an implementable technical design grounded in the current stack.',
    content: skillDoc('Dev workflow — tech design', `Produce an implementable technical design:

1. Current-state summary of relevant modules
2. Option comparison with at least one alternative
3. Data flow / interfaces / module boundaries / error handling
4. Risks, rollback, and verification
5. Milestones and task slices
Fit the repository stack and layout conventions.`),
  },
  'api-design': {
    name: skillNameFor('api-design'),
    description: 'Design or tidy API/protocol surfaces against existing routes and contracts.',
    content: skillDoc('Dev workflow — API design', `Design or tidy the API / protocol surface:

1. Resources and operations (auth, idempotency)
2. Request / response fields, error codes, and examples
3. Compatibility and versioning
4. Alignment points with existing routes / RPC
5. Contract test suggestions
Follow OpenAPI, Typert, or other repo conventions when present.`),
  },
  'data-model': {
    name: skillNameFor('data-model'),
    description: 'Clarify entities, persistence, constraints, and migration impact.',
    content: skillDoc('Dev workflow — data model', `Clarify the data model and persistence design:

1. Entities, relationships, and lifecycles
2. Fields, constraints, indexes, migration impact
3. Read/write paths and consistency needs
4. Diff vs existing schema / store / on-disk formats
5. Migration and backfill risks
Do not invent tables or formats that are not in the tree.`),
  },
  implement: {
    name: skillNameFor('implement'),
    description: 'Implement the current requirement with small verified repository changes.',
    content: skillDoc('Dev workflow — implement', `Implement the current requirement:

1. Read related code, tests, and nearby conventions first
2. Change in small steps; keep package boundaries and style
3. Add necessary tests; keep the change reviewable
4. State verification steps (commands or manual paths)
In analyze-only mode: output an implementation plan and file list only.`),
  },
  refactor: {
    name: skillNameFor('refactor'),
    description: 'Perform behavior-preserving refactors with verification.',
    content: skillDoc('Dev workflow — refactor', `Perform a targeted behavior-preserving refactor:

1. State the pain and goal (readability / dedupe / clearer boundaries)
2. List intended files and invariants
3. Refactor in verifiable steps
4. Add or update tests that lock behavior
Do not sneak in features. Analyze-only mode: plan only.`),
  },
  optimize: {
    name: skillNameFor('optimize'),
    description: 'Find evidence-backed performance or resource improvements.',
    content: skillDoc('Dev workflow — optimize', `Locate and improve performance or resource issues:

1. Gather evidence (hot paths, redundant IO, repeat work, large payloads)
2. Define measurable before/after checks
3. Apply the smallest useful optimization
4. Call out risks and rollback
Without data, propose a measurement plan first.`),
  },
  'code-review': {
    name: skillNameFor('code-review'),
    description: 'Review current changes by severity with a merge recommendation.',
    content: skillDoc('Dev workflow — code review', `Review the current changes or named range by severity:

1. Correctness and edge cases
2. Security and permissions
3. Performance and resources
4. Maintainability, naming, and test gaps
5. Suggested fix order with example patches
Lead with a merge recommendation, then details. Prefer analysis; fix only clear high-severity issues when edits are allowed.`),
  },
  'security-review': {
    name: skillNameFor('security-review'),
    description: 'Run a lightweight threat-focused security review of the workspace changes.',
    content: skillDoc('Dev workflow — security review', `Run a lightweight security review:

1. Trust boundaries, input validation, injection, path traversal
2. Secrets / credentials / PII handling
3. AuthZ and privilege risks
4. Dependency notes based only on visible repo facts
5. Fixes ordered by severity
Do not perform real attacks. Follow 执行模式 for edits.`),
  },
  'add-tests': {
    name: skillNameFor('add-tests'),
    description: 'Add high-value tests matching the repository test stack.',
    content: skillDoc('Dev workflow — add tests', `Add tests for the relevant changes or modules:

1. Identify critical paths, edges, and regression risks
2. Prefer tests whose failure is valuable; match existing runners and layout
3. Document how to run them
4. When edits are allowed, add runnable tests`),
  },
  'a11y-check': {
    name: skillNameFor('a11y-check'),
    description: 'Check accessibility and usability issues in Web/UI code.',
    content: skillDoc('Dev workflow — accessibility', `Check accessibility and usability for Web / UI code:

1. Semantics, focus order, keyboard access
2. Contrast and readability
3. Form labels, errors, and status announcements
4. List issues, user impact, and fixes
Align with component-library conventions when present.`),
  },
  debug: {
    name: skillNameFor('debug'),
    description: 'Debug from evidence, apply a minimal fix, and lock it with a test.',
    content: skillDoc('Dev workflow — debug', `Debug and fix from evidence:

1. Reproduce or read logs/code; no unsupported guesses
2. Minimal fix
3. Add or update a locking test
4. State verification steps
Analyze-only mode: hypothesis tests and proposed fix only.`),
  },
  'commit-message': {
    name: skillNameFor('commit-message'),
    description: 'Draft conventional commit subjects and bodies from the current diff.',
    content: skillDoc('Dev workflow — commit message', `Draft commit message(s) from the real diff:

1. Inspect git status / diff (and recent log when needed)
2. One primary subject ≤72 chars, imperative; follow Conventional Commits if the repo uses them
3. Optional body: motive, key changes, risks, verification
4. If the change should be split, propose separate subjects
Do not include secrets. Analyze-only: text only, no git commit.`),
  },
  'pr-description': {
    name: skillNameFor('pr-description'),
    description: 'Write a paste-ready pull request description from the real changes.',
    content: skillDoc('Dev workflow — PR description', `Write a paste-ready PR description:

1. Summary (motive, ≤3 bullets)
2. Change summary (user-visible vs internal; by module)
3. Test plan (checkable commands / manual paths)
4. Risks, rollback points, breaking changes
5. Screenshot / recording / issue link suggestions when useful
Ground in git status / diff / recent commits.`),
  },
  changelog: {
    name: skillNameFor('changelog'),
    description: 'Write user-facing changelog entries matching repository format.',
    content: skillDoc('Dev workflow — changelog', `Write or update changelog entries:

1. Group by user-visible change (Added / Changed / Fixed / Deprecated / Removed / Security / Breaking)
2. User-facing tone; one scannable line each
3. Match Keep a Changelog or the repo's existing format
4. Suggest version and date placeholders
When edits are allowed, write the file and name the path.`),
  },
  'release-notes': {
    name: skillNameFor('release-notes'),
    description: 'Write user-facing release notes with upgrades and known issues.',
    content: skillDoc('Dev workflow — release notes', `Write user-facing release notes:

1. One-line highlight plus version placeholder
2. User-visible changes by theme (not by commit)
3. Breaking changes / upgrade steps / compatibility window
4. Known issues and workarounds
5. Verification tips and support entry points
Do not market internal refactors as features.`),
  },
  'version-tag': {
    name: skillNameFor('version-tag'),
    description: 'Propose SemVer bumps, version files, tags, and release checks.',
    content: skillDoc('Dev workflow — version and tag', `Propose version release and tagging:

1. SemVer recommendation (major / minor / patch) with rationale
2. Version files / changelog / lockfiles to sync
3. Tag name, release branch, and commit order
4. Post-release checks (build / test / publish)
Align with changeset, lerna, release-please, or similar repo tooling.`),
  },
  'deploy-checklist': {
    name: skillNameFor('deploy-checklist'),
    description: 'Build a per-environment deploy checklist from real scripts and CI.',
    content: skillDoc('Dev workflow — deploy checklist', `Produce a checkable per-environment deploy list:

1. Pre-merge: typecheck, tests, lint, build, docs/config review
2. Staging: deploy steps, smoke, data prep
3. Production: window, owners, communications
4. Config / secrets / flags / migration order
5. Monitors, alerts, on-call, rollback triggers
Use real scripts and CI commands from this repo; mark unknowns.`),
  },
  'migration-plan': {
    name: skillNameFor('migration-plan'),
    description: 'Plan data/config/compatibility migrations with backfill and abort rules.',
    content: skillDoc('Dev workflow — migration plan', `Plan data / config / compatibility migration:

1. Migration targets (schema, formats, config keys, API compat)
2. Forward steps, duration, lock/downtime needs
3. Backfill, dual-write, or compatible-read strategy
4. Verification queries / sampling
5. Abort and rollback conditions
Inspect existing migration tooling first.`),
  },
  'rollback-plan': {
    name: skillNameFor('rollback-plan'),
    description: 'Write an executable layered rollback playbook for the release.',
    content: skillDoc('Dev workflow — rollback plan', `Write an executable rollback playbook:

1. Trigger conditions (error rate, critical path failure, data anomalies)
2. Layered rollback: app / config / migration / feature flags
3. Step order and role placeholders
4. Post-rollback verification
5. Irreversible steps and data-repair alternatives
Match the repo's real release mechanism.`),
  },
  'smoke-verify': {
    name: skillNameFor('smoke-verify'),
    description: 'Design post-deploy smoke and acceptance verification paths.',
    content: skillDoc('Dev workflow — smoke verify', `Design post-deploy smoke / acceptance checks:

1. 5–15 highest-value paths (auth, read/write, key failure states)
2. Steps, expected results, and failure signals
3. Automated commands vs must-manual items
4. Pass / watch / rollback exit criteria
Reuse existing e2e, snapshot, or smoke scripts when present.`),
  },
  'handoff-notes': {
    name: skillNameFor('handoff-notes'),
    description: 'Write ops handoff notes covering runtime, config, and triage.',
    content: skillDoc('Dev workflow — handoff notes', `Write delivery / ops handoff notes:

1. In-scope and out-of-scope for this delivery
2. Runtime deps (services, queues, storage, third parties)
3. Config, secrets, flags, and default pitfalls
4. Symptom → triage entry → escalation
5. Monitors, logs, on-call placeholders
Keep sentences short and actionable.`),
  },
  'project-summary': {
    name: skillNameFor('project-summary'),
    description: 'Write a post-delivery project retrospective against real outcomes.',
    content: skillDoc('Dev workflow — project summary', `Write a post-delivery project summary / retrospective:

1. Goals vs outcomes (map to requirements / acceptance; explain misses)
2. Key decisions and trade-offs
3. Risks, issues, and open items
4. Lessons (Keep / Improve / Try)
5. Follow-ups with suggested priority
Ground in real repo changes and docs; no empty platitudes.`),
  },
  standardize: {
    name: skillNameFor('standardize'),
    description: 'Turn project conventions into reusable standards and templates.',
    content: skillDoc('Dev workflow — standardize', `Codify reusable standards from this project:

1. Layout / naming / module boundaries / package conventions
2. Doc templates (README, PR, changelog, …)
3. Scripts, CI, local commands, and quality gates
4. Gap list (present vs proposed)
5. Minimal checkable rollout steps
When edits are allowed, write under docs/ or the agreed location; no unrelated refactors.`),
  },
  'product-deck': {
    name: skillNameFor('product-deck'),
    description: 'Draft a PDF-ready product introduction narrative in Markdown.',
    content: skillDoc('Dev workflow — product deck', `Write a user/customer-facing product introduction (PDF-ready):

1. One-page summary: what, who, core value
2. Problem → solution → capabilities (by user benefit)
3. Typical scenarios and demo path
4. Differentiation, boundaries, non-promises
5. How to get started and where to get support
Emit clear Markdown suitable for print / “Save as PDF”. When edits are allowed, write under docs/. Do not require a binary PDF engine in this environment.`),
  },
  'component-library': {
    name: skillNameFor('component-library'),
    description: 'Extract a reusable component inventory and docs from existing UI.',
    content: skillDoc('Dev workflow — component library', `Extract reusable UI component assets:

1. Inventory (name, responsibility, entry path)
2. Props / variants / empty-loading-error states
3. Usage examples and anti-patterns
4. Design tokens / theme / a11y conventions
5. Gaps and extraction priority
Align with any design system already in the repo. When edits are allowed, write component docs and name paths.`),
  },
  'architecture-retro': {
    name: skillNameFor('architecture-retro'),
    description: 'Retrospective on final architecture, debt, and evolution options.',
    content: skillDoc('Dev workflow — architecture retro', `Produce a post-delivery architecture retrospective:

1. Final architecture summary (boundaries, data flow, external deps)
2. Drift from the original plan and why
3. Tech debt and hotspots with evidence
4. Evolution options (near / mid / explicitly not)
5. Suggested architecture doc location
Describe layers in text; do not invent missing services.`),
  },
  'knowledge-base': {
    name: skillNameFor('knowledge-base'),
    description: 'Draft a searchable knowledge base of FAQ, triage, and ops notes.',
    content: skillDoc('Dev workflow — knowledge base', `Draft a searchable project knowledge base:

1. FAQ (install, config, common failures)
2. Triage trees (symptom → check → fix)
3. Ops / on-call notes
4. Deduplicate and cross-link existing README / docs / handoff
5. Suggested directory and filenames
When edits are allowed, write under docs/ with real commands.`),
  },
  'demo-kit': {
    name: skillNameFor('demo-kit'),
    description: 'Assemble a demo script, screenshot list, and talk track.',
    content: skillDoc('Dev workflow — demo kit', `Prepare a demo materials kit:

1. Demo goal and audience
2. Step-by-step script with talk points and timing
3. Screenshot / recording checklist and framing notes
4. Talk outline (open → value → demo → Q&A)
5. Fallback lines and known limits
Use real runnable paths; mark environment gaps.`),
  },
}

/** All bundled `/name` tokens for this provider. */
export const WORKFLOW_SKILL_NAMES: readonly string[] = WORKFLOW_SKILL_IDS.map(skillNameFor)
