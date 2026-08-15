# 开发工具箱 UI 密度与快捷区合并 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收紧开发工具箱视觉密度，并将建议/收藏/最近合并为单一快捷分段区，不改 skill 与发送协议。

**Architecture:** 在 `ui-dev-workflow` 内扩展 persist `quickTab`，重排 `WorkflowPanel` 顶部 chrome，CSS Module 收紧间距；动作 hint 仅保留在 `title`。

**Tech Stack:** React、CSS Modules、`defineStore` persist、Vitest + Testing Library、中英文 locale。

## Global Constraints

- 仅改 `packages/client/ui-dev-workflow` 与相关 docs/Agent Note；不改 skill 包。
- 样式只用 `--dsw-alias-*`；产品文案中文键在 `locales.ts`。
- persist 键保持 `dsh.dev-workflow.panel.v1`。
- Windows 下 shell 不用 `&&`；用分号或分开调用。

---

### Task 1: Store `quickTab`

- [x] store 字段、`setQuickTab`、测试已落地

### Task 2: 面板快捷分段 + 单行动作 + 密度 CSS

- [x] locale、面板、CSS、测试已落地

### Task 3: 文档同步

- [x] README / Agent Note / 规格状态已更新
