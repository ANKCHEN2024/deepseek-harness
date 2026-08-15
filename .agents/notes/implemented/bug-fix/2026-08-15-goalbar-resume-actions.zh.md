# Agent Note: GoalBar 恢复按钮可再次点击并覆盖需重新启用续行的 phase

Status: implemented

[English](2026-08-15-goalbar-resume-actions.md) | 中文

## Problem

对话 GoalBar 中点击 **恢复目标** / **Resume goal** 可能看起来完全无响应。两个独立缺陷叠加：（1）`runAction` 只在 Remote 信封正常返回时清除 pending 栅栏，面抛错后所有图标会永久 `disabled` 且无提示；（2）条带只对 `paused` 提供恢复，而 host 已接受 `blocked`，以及 `agent/session-start` 后持久 phase 仍为 `active` 但已 disarm 的目标——刷新后条带只显示暂停，无法从条带重新启用续行。

## Decision

`GoalBar.runAction` 使用 `try`/`finally`（并把意外抛错显示为内联 alert），保证 pending 总会清除。条带对 `active`、`paused`、`blocked` 都显示恢复。Host `goals.resume` 将已 armed 的 active 目标视为同 revision 的幂等成功，这样 active 上的恢复按钮在续行已启用时不会误报无效转换。

## Alternatives considered

**在 goal 投影或新建 `goal.get` RPC 上暴露进程本地 `activation`，仅在 disarmed 时显示恢复。** 本修复否决：需要新的活通道，并改动「仅变更」的 goals 线协议；在 active 上提供恢复并配合幂等 armed 路径即可恢复重新启用续行的入口。日后 activation 面仍可细化文案。

**仅在客户端吞掉 already-armed 拒绝。** 否决：`/goal resume` 与工具在重复点击时仍会失败；在领域动词上一处修好，可让命令、工具与 UI 对齐。

## Consequences

即使发生传输抛错，paused 与 blocked 的恢复控件仍可再次点击。active 目标暴露恢复，以便会话启动后的 disarm 可从条带重新启用续行；已 armed 的冗余 resume 成功且不写 revision。投影仍省略 activation，因此 active armed 与 active disarmed 共用同一 phase 文案。
