# Design Spec: Toolbox GitHub Commit (Manual / Auto)

English | [中文](2026-08-15-dev-workflow-github-publish-design.zh.md)

Status: implemented (see the plan at docs/superpowers/plans/2026-08-15-dev-workflow-github-publish.md)

Related: [Web project development workflow toolbox](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-toolbox.md)

## Problem

In the Web toolbox, users need GitHub commit capability for the current workspace project: manual preparation (view status, draft messages and commands) as well as, when permitted, automatic commit / push to a personal private repo. The existing 写提交说明 and 写 PR 说明 lean copywriting and do not cover push and private-repo creation.

## Decision summary

Adopt the hybrid mode (option C + implementation path 1): toolbox buttons still send `/dev-<id>` + prompt/skill, and the agent executes through the existing shell/`gh` capabilities; no new Host Git UI. Add 4 actions at the front of the **ship** group. `analyze` only outputs lists and commands; `edit` allows repo writes and network pushes.

## Non-goals

- No in-panel native git dialog or Host `git.commit` RPC.
- No GitHub token storage; rely on locally configured `git` / `gh auth`.
- No forced rewrite of upstream deepseek-ai remotes; the default target is the user's own remote / a newly created private repo.
- Never include `.env` or secret files in commits.

## New actions (4)

| id | Label (zh) | Mode | Behavior |
|---|---|---|---|
| `git-status-brief` | 查看改动 | Manual | status/diff/branch/remote summary + commit suggestions |
| `commit-draft` | 准备提交 | Manual | Proposed file list, commit message, commands to run; does not execute |
| `commit-push` | 提交并推送 | Auto | Commit after checking; push to a configured suitable remote (prefer non-upstream) |
| `github-private-publish` | 发布到私有库 | Auto | Without a suitable remote, `gh repo create --private` then push; otherwise verify private and push |

Coexists with the existing `commit-message` / `pr-description`: `commit-message` leans copywriting; `commit-draft` leans a paste-ready whole preparation pack.

## Group position

The `ship` group order becomes:

`git-status-brief` → `commit-message` → `commit-draft` → `commit-push` → `github-private-publish` → `pr-description` → … (the rest of the ship actions unchanged)

Action count: 38 → **42**.

## Security and modes

- `analyze`: forbid `git commit` / `git push` / `gh repo create` and other write operations.
- `edit`: minimal changes; `status`/`diff` first; exclude secrets and unrelated files before committing; state which remote was used.
- `github-private-publish`: default `--private`; if the user already points at a public fork, flag the visibility risk in the output and ask or stop at to-confirm (analyze only hints).

## Implementation surface

Same playbook as the cleanup group: `prompts.ts`, `locales.ts`, `WorkflowPanel` maps, `skill-dev-workflow` catalog, test counts, README / Agent Note, pairing `--write`.

## Acceptance

- The ship group shows the 4 new buttons; skill names are `dev-<id>`.
- Clicking an auto action in analyze mode does not demand a real push (copy forbids it).
- Edit-mode copy states private-repo and secret exclusion clearly.
