# 设计规格：工具箱 GitHub 提交（手动 / 自动）

状态：已实现（见实现计划 docs/superpowers/plans/2026-08-15-dev-workflow-github-publish.md）

关联：[Web project development workflow toolbox](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-toolbox.md)

## 问题

用户在 Web 工具箱中需要面向「当前工作区项目」的 GitHub 提交能力：既要手动准备（看状态、起草说明与命令），也要在许可下自动 commit / 推到个人私有库。现有「写提交说明」「写 PR 说明」偏文案，不覆盖 push 与建私有库。

## 决策摘要

采用混合模式（方案 C + 实现路径 1）：仍通过工具箱按钮发送 `/dev-<id>` + prompt/skill，由 Agent 使用既有 shell/`gh` 能力执行；不新建 Host Git UI。在 **交付（ship）** 组前置增加 4 个动作。`analyze` 只输出清单与命令；`edit` 才允许写库与网络推送。

## 非目标

- 不做面板内原生 git 对话框或 Host `git.commit` RPC。
- 不存储 GitHub token；依赖本机已配置的 `git` / `gh auth`。
- 不强制改写上游 deepseek-ai remotes；默认目标是用户自己的 remote / 新建私有库。
- 不把 `.env`、密钥文件纳入提交。

## 新动作（4）

| id | 标签（zh） | 模式 | 行为 |
|---|---|---|---|
| `git-status-brief` | 查看改动 | 手动 | status/diff/分支/remote 摘要 + 提交建议 |
| `commit-draft` | 准备提交 | 手动 | 拟提交文件列表、commit 文案、将执行的命令；不执行 |
| `commit-push` | 提交并推送 | 自动 | 检查后 commit；push 到已配置的合适 remote（优先非 upstream） |
| `github-private-publish` | 发布到私有库 | 自动 | 无合适 remote 时 `gh repo create --private` 并 push；已有则核对私有并 push |

与现有 `commit-message` / `pr-description` 并存：`commit-message` 偏文案；`commit-draft` 偏「可粘贴的整份准备包」。

## 分组位置

`ship` 组顺序调整为：

`git-status-brief` → `commit-message` → `commit-draft` → `commit-push` → `github-private-publish` → `pr-description` → …（其余 ship 动作不变）

动作总数：38 → **42**。

## 安全与模式

- `analyze`：禁止 `git commit` / `git push` / `gh repo create` 等写操作。
- `edit`：最小变更；先 `status`/`diff`；提交前排除密钥与无关文件；说明用了哪个 remote。
- `github-private-publish`：默认 `--private`；若用户已指向公开 fork，须在输出中标明可见性风险并询问或停在待确认（只分析时只提示）。

## 实现面

与 cleanup 组相同套路：`prompts.ts`、`locales.ts`、`WorkflowPanel` 映射、`skill-dev-workflow` catalog、测试计数、README / Agent Note、配对 `--write`。

## 验收

- 交付组可见 4 个新按钮；skill 名 `dev-<id>`。
- 只分析点击自动类动作不要求真推送（文案禁止）。
- 可改代码文案明确私有库与密钥排除。
