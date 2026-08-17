# Agent Note: Win32 对话框路径扫描以完整 UTF-16 NUL 单元结尾

Status: implemented

[English](2026-08-15-win32-dialog-utf16-nul-scan.md) | 中文

## Problem

`packages/host/directory-picker-native/src/win32-dialog-bindings.ts` 的 `readUtf16` 扫描 `IShellItem::GetDisplayName(SIGDN_FILESYSPATH)` 缓冲区寻找 NUL 终止符时，检查的是每个 UTF-16 单元的第一个字节是否为零。该字节是单元的低字节，因此任何码点低字节为 `0x00` 的字符——`开`（U+5F00）、`─`（U+2500）、`⼀`（U+2F00）以及大量其他汉字与符号——都会提前终止扫描。选择 `D:\Desktop\陕煤煤层气开发利用有限公司` 会返回 `D:\Desktop\陕煤煤层气`；`workspace.create` 随后以 `ENOENT` 拒绝被截断的路径，界面显示「无法打开文件夹」。

## Decision

扫描现在仅在完整的 `0x0000` 单元（两个字节均为零）处终止，低字节为零的字符属于真实内容。回归测试通过 mock 的 koffi COM 世界驱动完整对话框会话，以 `D:\Desktop\陕煤煤层气开发利用有限公司` 为选中路径，断言完整往返。

## Alternatives considered

**用 koffi 的 `str16` 解码出参。** 否决：`_Out_ void **` 出参给出的是原始地址，`koffi.decode(addr, 'str16')` 会把它当作指针解引用，在真实 Windows 上崩溃——这正是字节扫描存在的原因。

**从视图末尾反向扫描最后一个非零单元。** 否决：对恰好以 NUL 结尾的内容并不比所选方案更健壮，而且正向扫描是其余各处已经评审过的代码。

## Consequences

目录名含任何 UTF-16LE 低字节为零字符的路径现在能完整通过选择器，测试固定了这一边界使其不会无声回归。扫描上限（32768 字节）不变：更长的路径仍同以前一样在视图边界截断。
