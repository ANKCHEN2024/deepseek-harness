# @deepseek-ai/dsh-client-ui-dev-workflow

[English](README.md) | 中文

Web 项目开发流程工具箱：向 `conversation.details.workflow` 贡献分组快捷按钮条，并向会话标题栏 utilities 贡献重新打开右侧详情列的入口。四十八个 SDLC 与 Agent 剧本动作覆盖 Agent、规划、设计、开发、质量、清理、交付与交付后总结（项目总结、标准化、产品介绍、组件库、架构回顾、知识库沉淀、演示材料）。Agent 组驱动多步工具循环（自主闭环、深度探查、修复闭环、门禁打绿、目标驱动、并行拆解）。交付组在原有发布动作之外，另含查看改动、准备提交、提交并推送、发布到私有库。每次点击先在面板内打开发送确认条：显示动作说明、可选的任务范围输入与本次发送的模式切换；远程副作用动作（提交并推送、发布到私有库）默认以「只分析」打开并显示风险提示。确认后通过会话作用域的 `conversation.send` 发送空白边界的 `/dev-<action>` 加上模式/任务正文，由 host 的 `dsh-tool-skill` 注入 `@deepseek-ai/dsh-skill-dev-workflow` 中对应的随包 skill；若会话目录中没有该 skill，则回退为纯中文提示词。发送失败就地显示分类错误并可重试，成功显示「已发送」状态并记录最近。面板可在「只分析」与「可改代码」间切换。本包不注册 Host slash 命令，也不替换按钮条下方的工具详情席位。

面板挂载时调用 `layout.openDetails()`，并拉取 `skill.list` 为已存在的 skill 打标记。持久化 store（`dsh.dev-workflow.panel.v1`）跨 remount 保存模式、互斥手风琴阶段、最近（最多 8）、收藏（最多 6）与快捷分段。按钮条提供本地搜索，以及合并后的快捷区（建议 / 收藏 / 最近分段，基于扁平 SDLC 顺序最多三条客户端启发式建议）与每个动作旁的收藏控件；建议不读 git。阶段动作为单行标签（说明放在 `title`）。发送确认条把说明正文展示出来，可选补充说明会拼成任务范围段落；`ACTION_RISK` 静态风险表决定风险文案与本次发送的默认模式，远程发布动作默认「只分析」。样式只用 token；文案走 `dev-workflow` locale。行为由 [Web 项目开发流程工具箱 Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-toolbox.md) 与 [发送确认条 Agent Note](../../../.agents/notes/implemented/feature/2026-08-15-web-dev-workflow-send-confirmation.md) 规定。

## 模型体验

每次点击向当前会话注入一条用户文本消息。skill 可用时，消息以 `/dev-<action>` 开头，host pre-step 将该 skill 正文作为 `skill-invocation` 上下文注入（与 `/` skill 菜单同一路径）。模式约束与阶段焦点写在同一条用户消息里。本包不拥有工具 schema 或系统提示词分节。

#### KV Cache effect

一次点击追加新的用户回合（手势命中时还会注入该回合的 skill），因此从该回合起 provider 请求前缀会变化。空闲 UI（未点击）除可选的 `skill.list` 目录拉取外，不会组装或发送 provider 请求。

## 已知限制与暂缓事项

- **动作集合是固定的** —— 本包没有自定义工作流的设置 UI 或 cordis 配置。
- **Skill 由 host 随包提供** —— 正文在 `@deepseek-ai/dsh-skill-dev-workflow`；本客户端只发出 `/name` 手势，skill 缺失时回退纯提示词。
- **打开该列与工具详情共用详情面板** —— 选中工具调用仍使用同一列下半部分；本包不拥有工具渲染。
- **建议是客户端启发式** —— 排序只依据最近点击与扁平分组顺序；Skill 标记仍为面板本地状态，remount 时重置。手风琴同时最多打开一个阶段。
- **GitHub 发布动作依赖本机工具** ——「提交并推送 / 发布到私有库」依赖 host Agent 侧的 `git`/`gh` 与已有登录；工具箱不存 token，也不提供原生 Git UI。
- **风险分级是静态客户端提示** —— `ACTION_RISK` 依据动作提示词中的编辑条款分级，不读取仓库或远端状态，也不是 Host 权限或沙箱开关；远程发布动作默认「只分析」只是发送确认条里的 UI 预选。
