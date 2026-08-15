# Agent Note: Terminate the Win32 dialog path scan on the full UTF-16 NUL unit

Status: implemented

English | [中文](2026-08-15-win32-dialog-utf16-nul-scan.zh.md)

## Problem

`readUtf16` in `packages/host/directory-picker-native/src/win32-dialog-bindings.ts` scans the `IShellItem::GetDisplayName(SIGDN_FILESYSPATH)` buffer for a NUL terminator by checking whether the first byte of each UTF-16 unit is zero. That byte is the unit's low byte, so any character whose code point's low byte is `0x00` — `开` (U+5F00), `─` (U+2500), `⼀` (U+2F00), and thousands of other CJK and symbol characters — ends the scan early. Selecting `D:\Desktop\陕煤煤层气开发利用有限公司` returned `D:\Desktop\陕煤煤层气`; `workspace.create` then rejected the truncated path with `ENOENT` and the GUI showed "无法打开文件夹".

## Decision

The scan now terminates only on the full `0x0000` unit — both bytes zero — so a character with a zero low byte is real content. The regression test drives the whole dialog conversation through the mocked koffi COM world with `D:\Desktop\陕煤煤层气开发利用有限公司` as the selected path and asserts the full round trip.

## Alternatives considered

**Decode the out-param through koffi's `str16`.** Rejected: `_Out_ void **` out-params surface a raw address that `koffi.decode(addr, 'str16')` dereferences as a pointer, crashing on real Windows — the same reason the byte scan exists at all.

**Scan backwards from the end of the view for the last non-zero unit.** Rejected: no more robust than the chosen fix for content that happens to end in NUL units, and the forward scan is the code already reviewed everywhere else.

## Consequences

Paths whose directories contain any character with a zero UTF-16LE low byte now survive the picker whole, and the test pins the boundary so it cannot silently regress. The scan bound (32768 bytes) is unchanged: longer paths keep truncating at the view bound, as before.
