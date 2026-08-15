# Dev Workflow Agent Power 实现计划

[English](2026-08-15-dev-workflow-agent-power.md) | 中文

> 规格：[2026-08-15-dev-workflow-agent-power-design.md](../specs/2026-08-15-dev-workflow-agent-power-design.md)

**目标：** 新增 `group.agent` 分组与六个剧本动作，并加深共享 skill `TOOL_RULES`。

### 任务 1：prompts + locales + panel + tests（42→48）

- [x] `group.agent`、六个剧本提示词、双语文案与面板映射已落地；动作数 42→48，包测试通过

### 任务 2：catalog TOOL_RULES + six skills + skill tests

- [x] 共享 `TOOL_RULES` 加深与六个剧本 skill 已落地；skill 测试通过

### 任务 3：README / Agent Note + `--write` + bundle

- [x] README 双语与 i18n 配对已更新；Agent Note 已落地；bundle 只按包名引用，无需变更
