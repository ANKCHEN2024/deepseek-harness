# Agent Note: Web 工作流工具箱发送确认条

Status: implemented

[English](2026-08-15-web-dev-workflow-send-confirmation.md) | 中文

## Problem

工作流工具箱（[2026-08-15-web-dev-workflow-toolbox](2026-08-15-web-dev-workflow-toolbox.md)）此前点击即发送。随之有三个缺口：点击无法携带任务描述，每个动作只能基于固定提示词与对话上下文猜测范围；远程副作用动作（提交并推送、发布到私有库）在误点时就会真实执行 `git`/`gh` 命令，因为「只分析/可改代码」只是软性提示词前缀，不是 Host 权限；反馈只有短暂的 busy 状态——失败只在面板底部显示一行英文，成功则完全静默。

## Decision

点击不再直接发送，而是在面板内打开内联发送确认条。确认条展示动作说明、可选的单行任务范围输入与本次发送的模式切换（不触碰持久化的面板模式）。确认后发送 `messageFor(id, mode, { focus })`；输入非空时 `focusBlockFor` 追加「本次任务范围」段落。

`prompts.ts` 中的静态 `ACTION_RISK` 表依据各动作提示词里的编辑条款，把 48 个动作分为 `safe` / `writes-repo` / `publishes`。`defaultSendMode` 让 `publishes` 动作默认以「只分析」打开；`writes-repo` 动作跟随面板全局模式。确认条渲染风险文案：发布动作始终显示远程副作用提示，处于「只分析」时另显示默认降级说明；可改仓库动作仅在「可改代码」时显示仓库变更提示。该表只是客户端提示文案——不是 Host 权限或沙箱开关。

`run` 返回结构化 `WorkflowRunResult`（`{ ok: true }` 或 `{ ok: false, kind: 'scope' | 'service' | 'send', detail }`），取代 `string | null`。失败时确认条保持打开，按类别显示本地化文案、可展开的详情与「重试」按钮；成功则收起确认条、记录最近并显示 4 秒后自动清除的「已发送」状态。Esc 或取消关闭确认条并把焦点还给原按钮；打开时焦点落入任务输入框，Enter 提交。

面板 spec 覆盖完整确认条流程（默认模式、风险文案、焦点透传、提交、Esc/取消、重试、分类失败、已发送计时）。新增 apply spec 覆盖客户端入口的 inject face 与 `run` 各路径——此前 `src/client/index.ts` 在 per-file 覆盖率门禁中是 0%。同时移除了 `suggest.ts` 里两个不可达的防御分支。

## Alternatives considered

### 为什么不用模态风险确认？

`ui-primitives/RiskConfirmation` 意味着为破坏性意图设置阻断式对话框。工作流确认条是发送组装步骤（模式 + 范围 + 确认一体），不是闸门；模态框会遮住它所需的说明与输入。

### 为什么不把所有可改代码动作都默认「只分析」？

对 `implement`、`debug` 与 Agent 剧本强制「只分析」，会给最常见流程中的可逆工作区编辑多加一次切换。只有难以撤销的远程发布动作默认「只分析」；本地写入跟随全局模式并保留可见提示。

### 为什么不用 git 状态来强化风险？

建议本就设计为不读仓库；引入 git-status RPC 会为一个提示词前缀就能表达的提示扩大客户端数据面。静态表让该特性保持无传输依赖。

## Consequences

- 每个动作多一次确认，取代点击即发送；Esc 与 Enter 让键盘用户成本很低。
- 产品文案新增 sendbar/风险/状态 locale key（zh/en）与「本次任务范围」段落，全部走既有 `dev-workflow` 命名空间。
- `run` 注入契约从 `string | null` 改为 `WorkflowRunResult`；面板是其唯一消费者。
- `suggest.ts` 移除了不可达的去重守卫与负索引回绕：48 个互异 id 的循环中连续三个位置不会重复，非目录锚点（-1）经 `-1 + 1 = 0` 回绕到首项。对目录 id 的行为不变。
- `packages/client/ui-dev-workflow/src/client/index.ts` 现已纳入单测；此前在 per-file 覆盖率门禁中是 0%。
