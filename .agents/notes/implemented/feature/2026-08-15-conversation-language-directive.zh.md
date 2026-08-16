# Agent Note：部署对话语言指令

Status: implemented

[English](2026-08-15-conversation-language-directive.md) | 中文

## 问题

模型按对话内容推断回答语言；人设和工具引导均为英文的部署，通常得到的也是英文回复。部署和单个 preset 都需要一个配置键来固定对话语言——包括推理模型在内部思考阶段使用的语言，而不只是可见回复——无需改写人设文本。

## 决策

`dsh-system-prompt` 新增 `language` 配置键。它无条件注册一个顺序为 −50 的 `deployment:language` 段落（位于 −100 的 harness 身份与 0 的人设之间），文本为固定指令 `Always think and respond in <language>. This includes your internal reasoning, not only your visible replies.` 为空表示无指令，渲染时删除该段。固定句子只有一个归属：导出的 `languageDirective(language)` 辅助函数。

`dsh-persona` 行获得同名配置键，与人设槽位一样注册在挂载作用域内，因此 preset 可以只为自己的 agent 覆盖部署指令。其 schema 刻意省略默认值：省略该键时保留部署指令，`''` 以空文本占据槽位并遮蔽该指令，其他任何值都会用完全相同的固定句子替换它。

已经转发提示词配置的应用骨架（`agent-spine-demo` 及其 `dsh-acp-demo` 封装）像转发 `persona` 一样转发 `language`；Web 部署则在宿主的 `system-prompt` 行上配置它。

## 已考虑的其他方案

**把指令写进每份人设文本。** 零代码即可实现，但不是设置：每个 preset 都会复制这句话，思考阶段的措辞在各副本间漂移，也不存在可供每个 preset 覆盖的部署默认值。

**单独的 language 行包。** 注册表槽位与 preset 行是同一个概念的两小部分；单独的包会重复 `dsh-persona` 为身份槽位实现的遮蔽模式。

**带 GUI 控件的运行时用户设置命名空间。** 可热重载的按用户语言是可行的，但需要设置命名空间、文件后端提供方、提示词消费端接线和浏览器设置面板；固定的按部署与按 preset 键已经覆盖当前报告的需求。

## 后果

两个平面上的一个键即可固定模型的对话语言，可见回复与内部推理一致，各处渲染同一句话。该段对每个 agent 是静态的，因此指令增加固定的前缀成本，并在 agent 生命周期内保持 KV 缓存前缀稳定。Web GUI 从宿主行或 preset 行读取它；与所有提示词配置变更一样，修改需要重启服务器。
