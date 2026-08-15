# Design Spec: Agent Power Toolbox (Playbook Group + Deeper Skills)

English | [中文](2026-08-15-dev-workflow-agent-power-design.zh.md)

Status: implemented (see the plan at docs/superpowers/plans/2026-08-15-dev-workflow-agent-power.md)

Related: [Web project development workflow toolbox](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-toolbox.md)

## Problem

The toolbox already has many SDLC shortcuts, but most are single-shot focus prompts. A strong agent's value lies in multi-step tool loops, verification gates, goal continuation, and evidence-first triage; the current skills' Tool use sections are too short to drive those behaviors.

## Decisions (all decided by the product side)

This round adopts **A (capability orchestration) + D (deeper skills)**, with a light touch of **B (Goal / Todo and other model-visible tools)**:

1. Add a pinned group `group.agent` (copy: Agent) containing **6** multi-step playbook actions.
2. Deepen the shared `TOOL_RULES` of all `skill-dev-workflow` skills into an agent work loop (tool loop, todo, goal, gates, stop conditions).
3. **Not doing**: native Git UI, a git-reading suggestion engine, cutting the existing 42 actions, new Host commands.

## New actions (6)

| id | Label | Playbook highlights |
|---|---|---|
| `agent-autonomous` | Autonomous loop | Explore → plan → ship → verify → report; edit mode may write the repo |
| `agent-investigate` | Deep investigate | Evidence only; cross-check with multiple tools; grade conclusion confidence |
| `agent-fix-loop` | Fix loop | Repro → root cause → minimal fix → lock test → re-verify |
| `agent-verify-gate` | Green the gates | Run the repo's real checks; edit mode fixes to green, analyze lists failures and fix order |
| `agent-goal-drive` | Goal-driven | Use `create_goal`/`update_goal`/`get_goal` to start or continue long tasks; pair with todo |
| `agent-parallel` | Parallelize | Split into parallelizable subtasks; use subagent/delegation tools when present, else a clear serial plan |

## Group order

```
agent → plan → design → build → quality → cleanup → ship → wrap
```

The default accordion stays `group.plan` (less noise); empty-recent suggestions stay the first three Plan actions.

Action count: 42 → **48**.

## Shared TOOL_RULES deepening (highlights)

On top of the existing rules, add:

- Do not assert before evidence; build an evidence chain with read/search/command tools.
- Write a todo for multi-step work first (when the tool is available) and check items off as they finish.
- Use goal tools for cross-turn objectives; do not substitute empty words for status.
- After a failure, change the hypothesis and retry; never repeat the same failing command.
- Edit mode: after changing, state how to verify with the repo's real scripts.
- Analyze-only: no repo writes and no mutating commands.

Each playbook skill's Procedure spells out steps and stop conditions.

## Implementation surface

Same as existing extensions: `prompts.ts`, `locales`, `WorkflowPanel` maps, `catalog.ts`, tests 42→48, README/Agent Note, `--write`.

## Acceptance

- The toolbox top shows the Agent group and 6 buttons.
- The injected skill body contains the deepened Tool use.
- Analyze/edit constraints remain enforced by the preamble plus the skill together.
