# Agent Note: Web 工作流工具箱键盘与无障碍打磨

Status: implemented

[English](2026-08-15-web-dev-workflow-keyboard-a11y.md) | 中文

## Problem

工具箱以鼠标操作为主：搜索框没有键盘入口，搜索无结果时没有出路，另有三个语义问题伤害辅助技术用户——快捷区声明了没有 tabpanel 的 tablist、每个收藏按钮共享同一个静态无障碍名称、动作说明只存在于屏幕阅读器与触屏用户都看不到的 `title` 提示里。

## Decision

键盘处理保持面板作用域：面板根节点上的 `keydown` 处理器只会看到从工具箱内部冒泡上来的事件，因此不会与 composer 的 `/` 斜杠菜单竞争。`/` 与 Ctrl/Cmd+K 聚焦搜索框（事件源自输入框时除外）；Escape 清空搜索并失焦，但发送条的 Escape 优先——发送条自己的处理器先调用 `preventDefault`，面板处理器检查 `event.defaultPrevented` 后跳过。

无结果状态现在在空提示下方渲染最多三条最近动作作为兜底路径。

无障碍变更：快捷区从 `role=tablist`/`tab`/`aria-selected` 改为分段控件（`role=group` + `aria-pressed`），与面板既有的模式切换一致；收藏按钮按动作命名（`收藏或取消收藏：<动作>`）；每个动作按钮内部以视觉隐藏文本携带一行说明，让无障碍名称包含说明，同时避免快捷区与阶段网格重复渲染时的 id 冲突。

## Alternatives considered

### 为什么不做全局 Ctrl+K 命令面板？

GUI 没有命令面板宿主，工具箱只是多个面板之一；document 级监听有拦截 composer 击键的风险。面板作用域的 keydown 在面板内获得同样的可发现性，且不新增全局面。

### 为什么不用 `aria-describedby` id 指向说明？

一个动作会同时渲染在快捷区与阶段网格里，稳定 id 必然冲突。内联视觉隐藏文本完全绕开 id 管理。

## Consequences

- 面板内的 `/` 是聚焦手势而非输入——仅当焦点不在输入框时生效，向搜索框或发送条输入斜杠不受影响。
- 无新增 locale key：兜底复用现有 `section.recent` 标题。
- 测试中快捷区查询从 `role=tab` 改为 `role=button` + `aria-pressed`；收藏查询匹配按动作命名的标签前缀。
- 工具箱仍为纯展示：未改变任何模型可见消息或会话事件。
