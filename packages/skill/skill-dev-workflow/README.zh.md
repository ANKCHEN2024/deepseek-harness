# @deepseek-ai/dsh-skill-dev-workflow

[English](README.md) | 中文

项目开发流程随包 skill 提供方（`dev-requirements`、`dev-implement`、`dev-pr-description` 等）。在 `ctx.skills` 上注册一个不可变提供方，将工具箱各阶段贡献为用户与模型均可调用的 skill。`dsh-tool-skill` 仍是目录渲染以及 `/name` / `skill` 工具加载的唯一归属方。

挂载该插件（base 组合中默认启用）后，agent 即可加载这些 skill。Web 工具箱通过 `conversation.send` 发送空白边界的 `/dev-<action>`；host 的 pre-step 会像菜单点选或手输斜杠一样注入 `<skill_content>`。行为由 [Web 项目开发流程工具箱 Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-toolbox.md) 规定。

## 模型体验

### 开发流程 skill 正文

#### 模型看到什么

每个 skill 正文是持久指令文本。模型通过 `skill` 工具加载，或用户（含工具箱）发送 `/dev-<action>` 时，渲染后的正文会注入该回合。model-invocable 条目的描述会出现在面向模型的目录中。

#### Token 影响

无常驻提示词分节或工具 schema 成本。加载 skill 会把正文加入该回合的注入上下文；目录条目为每个 model-invocable skill 在 skill 列表中增加一行描述。

#### KV Cache effect

加载 skill 会把正文追加到该回合的注入上下文，从而从该回合起改变前缀。空闲的目录列举本身不会发送 provider 请求。

## 已知限制与暂缓事项

- **正文是固定产品文案** —— 没有用于按部署自定义流程的 cordis 配置。
- **无随包二进制资产** —— 这些 skill 只有指令；除 markdown 正文外不附带模板文件。
