/**
 * Stable skill ids / names / bodies for the project-development workflow
 * toolbox. Names are kebab tokens matching the host `/name` gesture.
 */

/** Toolbox action id; mirrors the client `WorkflowActionId` set. */
export type WorkflowSkillId =
  | 'agent-autonomous'
  | 'agent-investigate'
  | 'agent-fix-loop'
  | 'agent-verify-gate'
  | 'agent-goal-drive'
  | 'agent-parallel'
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
  | 'visual-check'
  | 'debug'
  | 'dead-code'
  | 'deps-hygiene'
  | 'temp-cleanup'
  | 'import-hygiene'
  | 'debug-residue'
  | 'git-status-brief'
  | 'commit-message'
  | 'commit-draft'
  | 'commit-push'
  | 'github-private-publish'
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

- Do not assert facts without evidence from read/search/command tools.
- Prefer repository conventions, scripts, and tests already in the tree.
- Do not invent files, APIs, or schemas that are not present.
- Multi-step work: use todo tools when available; check items off as you finish them.
- Long-running objectives: use goal tools (\`get_goal\` / \`create_goal\` / \`update_goal\`) when available; keep the objective measurable.
- After a failed command or test, change the hypothesis — do not repeat the same failing invocation.
- When the user message sets 执行模式 to 只分析, do not create, modify, or delete files and do not run mutating commands.
- When 执行模式 is 可改代码, make the smallest verified change set and say how to verify with real repo commands.
- Stop when success criteria are met, or when blocked by missing access/environment — state the blocker clearly.
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
  'agent-autonomous',
  'agent-investigate',
  'agent-fix-loop',
  'agent-verify-gate',
  'agent-goal-drive',
  'agent-parallel',
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
  'visual-check',
  'debug',
  'dead-code',
  'deps-hygiene',
  'temp-cleanup',
  'import-hygiene',
  'debug-residue',
  'git-status-brief',
  'commit-message',
  'commit-draft',
  'commit-push',
  'github-private-publish',
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
  'agent-autonomous': {
    name: skillNameFor('agent-autonomous'),
    description: 'Run an evidence-backed autonomous loop: explore, plan, land, verify, report.',
    content: skillDoc('Dev workflow — agent autonomous', `Run a strong-agent closed loop:

1. Explore with tools; list evidence
2. State success criteria; use todos when available
3. Use goal tools for multi-turn objectives when available
4. Edit mode: small verified landings; analyze-only: plan and file list only
5. Verify with real repo scripts/tests; retry with new hypotheses on failure
6. Report outcomes, evidence, verification, residual risks
Stop when criteria are met or a clear blocker is documented.`),
  },
  'agent-investigate': {
    name: skillNameFor('agent-investigate'),
    description: 'Evidence-first deep investigation with confidence-graded conclusions.',
    content: skillDoc('Dev workflow — agent investigate', `Investigate with evidence first:

1. Name the question and unknowns
2. Cross-check with read/search/commands; cite paths
3. Separate fact / inference / unverified; give confidence
4. List actionable fixes without widening scope
5. Deliver a report: conclusions, evidence chain, next experiments
Stop when the question has a defensible answer or gaps are listed.`),
  },
  'agent-fix-loop': {
    name: skillNameFor('agent-fix-loop'),
    description: 'Full fix loop: reproduce, root-cause, minimal fix, lock with tests, re-verify.',
    content: skillDoc('Dev workflow — agent fix loop', `Run a complete fix loop:

1. Reproduce or locate failure signals
2. Form testable root-cause hypotheses; prove or disprove with tools
3. Edit mode: minimal fix; analyze-only: patch-level plan
4. Add or update a locking test when editing
5. Re-run verification; return to hypotheses if still red
Stop when green or blocked on environment/credentials.`),
  },
  'agent-verify-gate': {
    name: skillNameFor('agent-verify-gate'),
    description: 'Run the repository real quality gates and drive them green when edits are allowed.',
    content: skillDoc('Dev workflow — agent verify gate', `Drive quality gates green:

1. Discover real check commands from scripts/CI/README
2. Analyze-only: run safe read-only checks or list commands; no file edits
3. Edit mode: run → fix → re-run until green or blocked
4. Fix root causes; never delete tests to go green
5. Report commands, results, changes, remaining reds
Stop when critical gates pass or external blockers remain.`),
  },
  'agent-goal-drive': {
    name: skillNameFor('agent-goal-drive'),
    description: 'Drive multi-turn work through goal and todo tools against measurable success criteria.',
    content: skillDoc('Dev workflow — agent goal drive', `Drive work with goals:

1. get_goal; create_goal with a measurable objective if none
2. Split near-term steps with todos when available
3. Advance per 执行模式 against the goal criteria
4. complete or blocked the goal with a clear reason
5. Report goal state, progress, and next-round advice
Do not replace goal/todo state with empty prose.`),
  },
  'agent-parallel': {
    name: skillNameFor('agent-parallel'),
    description: 'Split work into parallel vs serial slices; delegate with subagents when available.',
    content: skillDoc('Dev workflow — agent parallel', `Parallelize deliberately:

1. Map dependencies; mark parallel slices and the critical path
2. If subagent/delegation tools exist, assign independent slices and merge results
3. Otherwise produce a clear serial plan with merge points and still tool-loop the main path
4. Edit mode: land the main-path minimal increment; analyze-only: plan and contracts
5. Report the parallel graph, slice status, merge risks
Stop when the plan is executable or the main path is verified.`),
  },
  requirements: {
    name: skillNameFor('requirements'),
    description: 'Run structured product requirements analysis for the current workspace.',
    content: skillDoc('Dev workflow — requirements', `Produce a structured requirements brief and persist it as the pipeline artifact:
1. Goals and measurable success criteria
2. Target users and primary / reverse scenarios
3. In scope / out of scope
4. Constraints (tech, time, deps, compliance)
5. Open questions that cannot be inferred from the repo
6. Acceptance criteria (Given/When/Then or equivalent)
7. Suggested next stage (plan / design / implement)
Artifact: when edits are allowed, write the seven sections to docs/requirements.md as the shared requirements artifact; analyze-only mode outputs the same sections as text.`),
  },
  'user-stories': {
    name: skillNameFor('user-stories'),
    description: 'Write prioritized user stories and acceptance scenarios for the current goal.',
    content: skillDoc('Dev workflow — user stories', `Write user stories and scenes, continuing the pipeline from the requirements artifact:
1. Read docs/requirements.md first when it exists; align scope and acceptance criteria with it
2. Stories as “As a… I want… so that…”, ordered by value
3. 2–5 acceptance conditions per story
4. Dependencies, risks, and parallelizable items
5. MVP vs later iterations
When edits are allowed, write the stories to docs/user-stories.md and leave the requirements artifact untouched.
Do not implement unless 执行模式 allows edits and the user asked to implement.`),
  },
  'task-breakdown': {
    name: skillNameFor('task-breakdown'),
    description: 'Break the current goal into an ordered executable task list with dependencies.',
    content: skillDoc('Dev workflow — task breakdown', `Split the goal into executable tasks, consuming the pipeline artifacts:
1. Read docs/requirements.md and docs/user-stories.md first when they exist; every task traces to a story or requirement
2. Priority order; each item needs deliverable, deps, and S/M/L complexity
3. Parallelizable work and the critical path
4. Suggested implementation order and milestone checkpoints
5. Files / modules to read first
6. Mirror the task list into the todo tool when available and keep the two consistent
When edits are allowed, write the breakdown to docs/task-breakdown.md.
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
    content: skillDoc('Dev workflow — UI design', `Produce a UI / interaction design spec from design drafts and the requirements:
1. Consume design drafts first: read image files (screenshots, Figma exports, wireframes) present in the workspace or attached to the request; extract layout, spacing, color, type, components, and states from them, and mark what each draft leaves unspecified
2. Information architecture and primary views
3. Key user flows including failure branches
4. Layout, component hierarchy, and key copy per view
5. Empty / loading / error / success / unauthorized states
6. Design tokens and accessibility constraints (contrast, spacing, responsive, keyboard)
7. Per-view acceptance criteria that a later implementation check can verify against
Align with any design system already in the repo. When edits are allowed, write the spec to docs/ui-design.md for the visual check and implementation to reference.`),
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
1. Read related code, tests, and nearby conventions first; when pipeline artifacts exist (docs/requirements.md, docs/user-stories.md, docs/task-breakdown.md, docs/ui-design.md), read them and keep the change aligned with their scope and acceptance criteria
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
    content: skillDoc('Dev workflow — accessibility', `Check accessibility and usability for Web / UI code, runtime first:
1. When browser or screenshot tools are available, open the target pages and inspect the rendered result (semantics, focus order, keyboard reachability, contrast), keeping evidence where the tool allows
2. With no runtime tools, fall back to static review of the UI code
3. Contrast and readability
4. Form labels, errors, and status announcements
5. List issues, user impact, and fixes
Align with component-library conventions when present.`),
  },
  'visual-check': {
    name: skillNameFor('visual-check'),
    description: 'Compare the implemented UI against the design spec and report prioritized deviations.',
    content: skillDoc('Dev workflow — visual check', `Verify that the implemented UI matches the design intent:
1. Read the design spec (docs/ui-design.md) when present; otherwise rebuild the checklist from design drafts (image files) and acceptance criteria
2. Capture the implemented UI with browser / screenshot tools when available; with none, state exactly which screens and states the user should capture and how to provide them as images
3. Compare every view and state against the spec: layout, spacing, color, type, component variants, copy, empty / loading / error states
4. Report a prioritized deviation list (blocker / major / minor): location, expected vs actual, suggested fix per item; this action reports, it does not fix code
5. Hand accessibility differences spotted during comparison to the accessibility check
When edits are allowed, write the report to docs/visual-check.md and reference the screenshot paths.`),
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
  'dead-code': {
    name: skillNameFor('dead-code'),
    description: 'Remove unused exports and unreachable code with evidence.',
    content: skillDoc('Dev workflow — dead code', `Clean dead code and unused exports:

1. Gather evidence via read/search: unreferenced exports, unreachable branches, orphan files
2. List candidates by risk (high: public API; low: private dead code)
3. State verification (typecheck, tests, build)
4. No drive-by refactors
When edits are allowed, delete minimally and name paths; analyze-only: list only.`),
  },
  'deps-hygiene': {
    name: skillNameFor('deps-hygiene'),
    description: 'Tidy unused, duplicate, or mis-scoped dependencies against real imports.',
    content: skillDoc('Dev workflow — deps hygiene', `Improve dependency hygiene:

1. Compare package.json / lockfile to real imports for unused, duplicate, or stale declarations
2. Align with the repo package manager and workspace conventions
3. Propose add / remove / move-to-devDeps with risks
4. Give verification commands (install, build, relevant tests)
Do not invent packages; mark unknowns. When edits are allowed, update manifests.`),
  },
  'temp-cleanup': {
    name: skillNameFor('temp-cleanup'),
    description: 'Remove safe build artifacts and temporary files without touching source.',
    content: skillDoc('Dev workflow — temp cleanup', `Clean temporary and build residue:

1. Identify safe artifacts / caches / explicit temp files (prefer ignored paths)
2. Separate auto-deletable vs needs confirmation
3. Never delete non-ignored source, secrets, or user data
4. Provide delete list and rollback notes
Analyze-only: list only; when edits are allowed, delete only evidenced residue.`),
  },
  'import-hygiene': {
    name: skillNameFor('import-hygiene'),
    description: 'Sort, dedupe, and type-only-import cleanup matching repo lint rules.',
    content: skillDoc('Dev workflow — import hygiene', `Tidy imports:

1. Follow repo lint / format / path-alias conventions
2. Dedupe, sort, add type-only imports, drop unused imports
3. List per-file changes; avoid unrelated logic edits
4. Document how to verify with existing scripts
When edits are allowed, keep the diff minimal.`),
  },
  'debug-residue': {
    name: skillNameFor('debug-residue'),
    description: 'Remove leftover console, debugger, and temporary debug comments.',
    content: skillDoc('Dev workflow — debug residue', `Clean debug residue:

1. Search for temporary console / debugger / stale debug comments / local paths
2. Classify delete vs promote to real logging vs keep
3. List evidence per file
4. Verify related tests or manual paths still work
Do not silently remove intentional diagnostic hooks; mark uncertainties.`),
  },
  'git-status-brief': {
    name: skillNameFor('git-status-brief'),
    description: 'Read-only summary of branch, diff, remotes, and next commit advice.',
    content: skillDoc('Dev workflow — git status brief', `Summarize Git state (read-only):

1. Branch, ahead/behind, dirty or clean
2. Status and key diffs by file; flag possible secret paths
3. Remotes (name, host; upstream vs personal)
4. Advise: keep editing, prepare commit, or ready to commit-push
Never run commit / push / gh repo create; stay read-only in both modes.`),
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
  'commit-draft': {
    name: skillNameFor('commit-draft'),
    description: 'Prepare a manual commit package: files, message, and commands without executing.',
    content: skillDoc('Dev workflow — commit draft', `Prepare a manual commit package (do not execute):

1. Files to include (exclude .env, secrets, unrelated artifacts)
2. One subject ≤72 chars (Conventional Commits if the repo uses them) plus optional body
3. Exact commands (add/commit; list push as a separate next step)
4. Risks and open questions
Never run mutating git/gh commands in either mode.`),
  },
  'commit-push': {
    name: skillNameFor('commit-push'),
    description: 'Commit current changes and push to a suitable personal remote.',
    content: skillDoc('Dev workflow — commit and push', `Commit and push to a personal remote:

1. Read-only status/diff/remotes first; exclude secrets
2. Analyze-only: print commands, target remote, and risks — no commit/push
3. Edit mode: create a minimal clear commit, then push
4. Prefer personal origin / non-upstream; if only upstream exists, stop and suggest adding a personal remote or using private-publish
5. Report hash, remote, branch, verification
No force-push to main/master; do not change git config.`),
  },
  'github-private-publish': {
    name: skillNameFor('github-private-publish'),
    description: 'Publish the workspace to a personal private GitHub repository.',
    content: skillDoc('Dev workflow — GitHub private publish', `Publish to a personal private GitHub repo:

1. If a personal remote exists, prefer private visibility then push
2. If none: in edit mode use gh to create --private and push (requires gh auth)
3. Analyze-only: print gh/git commands, suggested name, private flag, risks — no create/push
4. Never create a public repo; never push to upstream orgs such as deepseek-ai
5. Exclude .env/secrets; report private URL and keep-upstream-for-fetch advice
Do not change global git user; no --force.`),
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
    content: skillDoc('Dev workflow — component library', `Extract reusable UI component assets and manage design tokens:
1. Inventory (name, responsibility, entry path)
2. Props / variants / empty-loading-error states
3. Design tokens: extract color, spacing, type, radius, and shadow tokens from theme / CSS files; list each token's semantic name, raw value, and code location
4. Usage examples and anti-patterns
5. A11y conventions
6. Gaps and extraction priority
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
