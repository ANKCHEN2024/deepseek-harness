# @deepseek-ai/dsh-client-ui-dev-workflow

[English](README.md) | 中文

Web 项目开发流程工具箱：向 `conversation.details.workflow` 贡献分组快捷按钮条，并向会话标题栏 utilities 贡献重新打开右侧详情列的入口。三十三个 SDLC 动作覆盖规划、设计、开发、质量、交付与交付后总结（项目总结、标准化、产品介绍、组件库、架构回顾、知识库沉淀、演示材料）。每次点击通过会话作用域的 `conversation.send` 发送空白边界的 `/dev-<action>` 加上模式/任务正文，由 host 的 `dsh-tool-skill` 注入 `@deepseek-ai/dsh-skill-dev-workflow` 中对应的随包 skill；若会话目录中没有该 skill，则回退为纯中文提示词。面板可在「只分析」与「可改代码」间切换。本包不注册 Host slash 命令，也不替换按钮条下方的工具详情席位。

面板挂载时调用 `layout.openDetails()`，并拉取 `skill.list` 为已存在的 skill 打标记。阶段分组用手风琴展开（同时最多一个；默认打开「规划」）。样式只用 token；文案走 `dev-workflow` locale。行为由 [Web 项目开发流程工具箱 Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-toolbox.md) 规定。

## 模型体验

每次点击向当前会话注入一条用户文本消息。skill 可用时，消息以 `/dev-<action>` 开头，host pre-step 将该 skill 正文作为 `skill-invocation` 上下文注入（与 `/` skill 菜单同一路径）。模式约束与阶段焦点写在同一条用户消息里。本包不拥有工具 schema 或系统提示词分节。

#### KV Cache effect

一次点击追加新的用户回合（手势命中时还会注入该回合的 skill），因此从该回合起 provider 请求前缀会变化。空闲 UI（未点击）除可选的 `skill.list` 目录拉取外，不会组装或发送 provider 请求。

## 已知限制与暂缓事项

- **动作集合是固定的** —— 本包没有自定义工作流的设置 UI 或 cordis 配置。
- **Skill 由 host 随包提供** —— 正文在 `@deepseek-ai/dsh-skill-dev-workflow`；本客户端只发出 `/name` 手势，skill 缺失时回退纯提示词。
- **打开该列与工具详情共用详情面板** —— 选中工具调用仍使用同一列下半部分；本包不拥有工具渲染。
- **模式、手风琴与 Skill 标记是面板本地状态** —— 详情入口重新挂载时会重置；不持久化。手风琴同时最多打开一个阶段。
