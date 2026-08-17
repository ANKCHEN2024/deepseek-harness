# Agent Note: Shell 超时标记不得被读成整轮终止

Status: implemented

[English](2026-08-15-shell-timeout-not-turn-stop.md) | 中文

## Problem

在 Windows 上，pwsh（或 bash）前台超时会强制结束进程，结果常为退出码 `1` 且无 signal。Shell 工具渲染器同时追加 `[timed out after …ms]` 与 `[exit code: 1]`。pwsh 工具说明又要求模型把「中断后的裸 exit 1」当成终止而非命令失败。于是模型在超时或普通失败后结束本轮助手回合、不再同轮重试；即使用户未暂停目标、驱动器也未 disarm，也会表现为「停了且不会自动继续」。

## Decision

当 `timedOut` 为真时，渲染器只输出超时标记，不再附带 signal / exit 标记。工具描述与 pwsh system-prompt 小节写明：超时与非零退出应在同一轮内恢复处理。goal-round 提示同样要求模型不要仅因命令超时或失败就结束本轮。

## Alternatives considered

**只提高执行器默认 `timeoutMs`。** 否决为唯一修复：更长预算只能减少超时，无法阻止「kill 后的 exit 1」被读成终止，普通非零失败仍会被当成停止信号。

**在每次工具错误后自动 rearm / resume goal。** 否决：取消与提供方错误路径仍须用户授权；观察到的停顿来自歧义标记下的模型行为，而非驱动器未唤醒。

## Consequences

超时结果读作预算耗尽。无超时标记的 Windows exit-1 kill 仍可区分。同轮重试依赖模型遵守更清晰的约定；用户取消仍会按原策略暂停 goal。
