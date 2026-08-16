# Agent Note: Web 项目开发流程工具箱

Status: implemented

[English](2026-08-15-web-dev-workflow-toolbox.md) | 中文

## Problem

用 Harness 做产品开发的 Web 用户需要一键进入常见项目生命周期工作——需求分析、文档、UI 设计、实现、审查、测试、排障与发布说明。这些意图是普通会话提示词，不是 `/plan`、`/compact` 这类 Host slash 命令。

右侧详情列已存在并用于工具调用检视，但默认关闭，也没有工作流快捷入口。把工具箱塞进 composer 的 left/right 席位会把生命周期动作埋进输入条；整列替换 `details` 单槽又会丢掉工具详情。

## Decision

`@deepseek-ai/dsh-client-ui-conversation` 在现有 DetailsPanel 内声明会话作用域 list 槽 `conversation.details.workflow`。面板始终在工具详情正文上方渲染该列表。`@deepseek-ai/dsh-client-ui-dev-workflow` 向该槽注入分组按钮条，并向标题栏 utilities 贡献调用 `layout.openDetails()` 的入口。

每次点击先打开内联发送确认条（任务范围输入、本次发送模式、风险文案——见[发送确认条笔记](2026-08-15-web-dev-workflow-send-confirmation.md)）；确认后对 `sessions.scope(sessionId).conversation.send(messageFor(id, mode, { focus }))` 发送消息。当 `skill.list` 中存在 `@deepseek-ai/dsh-skill-dev-workflow` 的对应随包 skill 时，消息以 `/dev-<action>` 开头，由 host `dsh-tool-skill` 按与 `/` skill 菜单相同的路径注入 `<skill_content>`；否则回退为纯中文提示词。四十九个动作覆盖 Agent/规划/设计/开发/质量/清理/交付/总结；Agent 组覆盖自主闭环 → 深度探查 → 修复闭环 → 门禁打绿 → 目标驱动 → 并行拆解；质量组覆盖代码审查 → 安全审查 → 补测试 → 无障碍 → 视觉核对 → 排查修复；清理组覆盖清死代码 → 整理依赖 → 清临时残留 → 整理 import → 清调试残留；交付组覆盖查看改动 → 写提交说明 → 准备提交 → 提交并推送 → 发布到私有库 → PR → Changelog/发布说明 → 版本标签 → 上线 → 迁移/回滚 → 上线验证 → 交接；总结组覆盖项目总结 → 标准化 → 产品介绍 → 组件库 → 架构回顾 → 知识库沉淀 → 演示材料。随包 skill 正文共享加深后的 Agent 工具环规则（证据、todo、goal、失败换假设）。目录命中时按钮显示 Skill 标记；一行说明放在按钮 `title`。阶段分组用手风琴展开（同时最多一个；默认打开「规划」）。`defineStore` 持久化键 `dsh.dev-workflow.panel.v1` 跨 remount/刷新保存模式、展开阶段、最近（最多 8）、收藏（最多 6）与 `quickTab`；面板另提供本地搜索与合并快捷区（建议 / 收藏 / 最近分段），以及基于扁平分组顺序的最多三条客户端启发式建议（不读 git）和每个动作旁的收藏控件。成功的 `run` 调用 `recordRecent`；收藏切换不发送消息。`@deepseek-ai/dsh-client-ui-layout` 以约定默认宽度启动详情列，在 Session 切换（含空白新会话 hero）时保持打开，仅在没有当前 Session 时强制宽度为 0；工作流包仍提供标题栏入口，在用户显式关闭后调用 `layout.openDetails()`。窄视口仍可能被让步链自动关闭。

## Alternatives considered

### 为什么不用 composer 的 `conversation.input.left`？

该席位适合紧凑的输入旁控件。带阶段分组与说明的 SDLC 工具箱需要纵向空间；塞进 composer 行要么溢出，要么难以扫读。

### 为什么不替换整个 `details` 单槽？

替换 DetailsPanel 需要重做工具详情渲染或分叉 ui-tool 接线。声明子级 list 席位可在保留工具检视的同时增加工作流 chrome，无需第四列。

### 为什么不用 Host slash 命令？

`/plan` 与 `/compact` 是带自身生命周期的 harness 控制面。「写项目文档」「设计 UI」是模型任务。把它们升为 `ctx.commands` 只会发明只转发文本的命令处理程序。加载真正的 skill 正文改用已有的用户 `/name` 手势，而不是新的 Host 命令。

### 为什么不做专用的 `skills.invoke` RPC？

调用路径已经是 `session.prompt` 加上空白边界的 `/name`。再建一条 wire 路径只会重复策略、日志与 TUI/ACP 对齐，没有收益。

## Consequences

- 在挂载工作流插件后，右侧列除工具检视外有了常驻产品用途。
- 默认打开详情会增加窄视口上的横向 chrome，直到布局让步链将其关闭；空白会话在首条用户消息前即可使用工具箱。
- 固定提示词与 skill 正文是产品文案：改措辞或动作目录是 `ui-dev-workflow` 与 `skill-dev-workflow` 包内变更，不是 settings 文档。
- 「只分析 / 可改代码」、手风琴阶段、最近、收藏与快捷分段持久化在 `dsh.dev-workflow.panel.v1`；它们只改变用户消息前缀或面板 chrome，不是 Host 权限或沙箱开关。
- 建议仅按最近点击与扁平 SDLC 顺序排序；不检查仓库。
- Skill 执行与斜杠菜单共用 host `/name` 手势；目录缺失时回退纯提示词，不在客户端伪造 `<skill_content>`。
- 设计阶段流水线扩展（设计稿消费、视觉核对与阶段间工件交接）由[设计流水线笔记](2026-08-15-dev-workflow-design-pipeline.md)持有；本笔记只保留工具箱 chrome 事实。
