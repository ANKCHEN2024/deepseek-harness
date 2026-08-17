# 会话驱动自动开发监测 — 实现计划

[English](2026-08-15-conversation-auto-dev-monitor.md) | 中文

> **面向代理执行者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans，按任务逐步实现。步骤使用复选框（`- [ ]`）跟踪。

**目标：** 交付显式开启的会话监测器：推断工作区未完成工作，在不伪造人工证明的前提下创建或重新武装同会话 goal，并让位给 `goal-round-driver` 直至模型 complete 或 blocked。

**架构：** 新 Host 插件 `@deepseek-ai/dsh-goal-conversation-monitor` 拥有进程内每 agent 开关、cancel-hold、空闲策略、监测推断预留（`plugin` MessageSource），以及仅在开关打开时变更 `ctx.goals` 的 `auto_dev_decide` 工具。`/auto-dev` 同包注册。Web 开关从 `conversation.session.header.utilities` 经 `conversation.send` 发送斜杠命令。仅挂载到 web-app + ACP 示例 overlay（不进 `dsh-base`）。

**技术栈：** Cordis 插件、`dsh-goal` / `dsh-agent` / `dsh-tools`、Vitest + agent-loop-testkit、ACP 无密钥快照、React CSS Modules 客户端插件。

**规格：** [docs/superpowers/specs/2026-08-15-conversation-auto-dev-monitor-design.md](../specs/2026-08-15-conversation-auto-dev-monitor-design.md)

## 全局约束

- 监测轮绝不伪造 `{ kind: 'user' }`；使用 `{ kind: 'plugin', plugin: 'goal-conversation-monitor' }`。
- 不扩大 `dsh-tool-goal` 的直接人工 create/edit/resume 权威；仅在开关打开时经 `auto_dev_decide` + `ctx.goals.*` 发明目标。
- 不修改 `dsh-agent-loop`，不把策略并入 `goal-round-driver`。
- 开关默认关；在 `agent/session-start`、覆盖已有 agent 加载、以及 teardown 时强制关；永不持久化开关。
- 取消导致 pause/disarm 后置 cancel-hold，直到新的 `{ kind: 'user' }` 消息或开关 off→on。
- 无 cordis `defaultOn` 可调项。
- 不挂载进 `packages/bundle/base`；仅 web-app + ACP 示例。
- Windows shell：不要用 `&&` 串联；命令分开跑。
- 仅在用户要求时提交。
- 产品 UI 文案中文；代码注释英文；文件以恰好一个尾随换行结束。
- 非平凡变更须在同一 PR 含 Agent Note 三件套。

## 文件映射

| 路径 | 职责 |
|---|---|
| `packages/goal/goal-conversation-monitor/` | 开关服务、空闲策略、提示词、decide 工具、`/auto-dev`、invariant |
| `packages/client/ui-auto-dev/` | 发送 `/auto-dev on\|off` 的标题栏 utility |
| `packages/bundle/web-app/cordis.patch.yml` + `package.json` | 挂载 Host + Client 插件 |
| `examples/acp-agent/auto-dev.cordis.yml` + 快照夹具 | 无密钥 ACP 快照 |
| `packages/goal/README.md` | 分组表行 |
| `.agents/notes/implemented/feature/2026-08-15-conversation-auto-dev-monitor.*` | 决策记录 |
| `docs/subsystems/goal.md`（+ zh/i18n） | 若有导出类型则链到监测消费方 |
| `tsconfig.host.json` / `tsconfig.client.json` | 聚合 references |

---

### Task 1: 包脚手架 + 开关服务

**文件：**
- Create: `packages/goal/goal-conversation-monitor/package.json`
- Create: `packages/goal/goal-conversation-monitor/tsconfig.json`
- Create: `packages/goal/goal-conversation-monitor/src/index.ts`
- Create: `packages/goal/goal-conversation-monitor/src/invariant.ts`
- Create: `packages/goal/goal-conversation-monitor/src/types.ts`
- Create: `packages/goal/goal-conversation-monitor/tests/switch.spec.ts`
- Modify: `tsconfig.host.json`（加 reference）
- Modify: `packages/goal/README.md`（+ zh）

**接口：**
- Produces: Cordis 服务 `autoDev`（`ctx.autoDev`），含：

```ts
interface AutoDevMonitor {
  /** Whether the process-local switch is on for this exact live agent. */
  isOn(agent: Agent): boolean
  /** Turn the switch on or off; off disarms goals and cancels monitor work. */
  setOn(agent: Agent, on: boolean): void
  /** Snapshot for `/auto-dev status` and tests. */
  status(agent: Agent): {
    readonly on: boolean
    readonly cancelHold: boolean
    readonly goal: GoalView | undefined
  }
}
```

- [ ] **Step 1: 编写失败的开关测试**

```ts
// packages/goal/goal-conversation-monitor/tests/switch.spec.ts
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import GoalService from '@deepseek-ai/dsh-goal'
import { SessionId } from '@deepseek-ai/dsh-session'
import * as monitor from '../src/index.ts'

const contexts: Context[] = []
afterEach(async () => {
  await Promise.allSettled(contexts.splice(0).map(c => c.fiber.dispose()))
})

async function harness() {
  const ctx = new Context()
  contexts.push(ctx)
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(GoalService)
  await ctx.plugin(monitor)
  await ctx.plugin(AgentLoop, { agents: [] })
  const agent = ctx.agentLoop.create(SessionId(`auto-dev-${Math.random()}`), {
    provider: 'mock',
    model: 'mock',
  })
  return { ctx, agent }
}

describe('autoDev switch', () => {
  it('defaults off and does not persist across session-start', async () => {
    const { ctx, agent } = await harness()
    expect(ctx.autoDev.isOn(agent)).toBe(false)
    ctx.autoDev.setOn(agent, true)
    expect(ctx.autoDev.isOn(agent)).toBe(true)
    // Fire the same session-start edge the goal domain uses; expect forced off.
    ctx.emit(agent.session, 'agent/session-start', { agent })
    expect(ctx.autoDev.isOn(agent)).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试 — 预期失败（无 `ctx.autoDev`）**

Run: `pnpm exec vitest run packages/goal/goal-conversation-monitor/tests/switch.spec.ts`

Expected: FAIL resolving `autoDev` / module missing.

- [ ] **Step 3: 脚手架包 + 最小服务**

对标 `goal-round-driver` 的 package.json peers（`agents`、`goals`、`sessions`，随后加 `commands`）。导出 `name = 'goal-conversation-monitor'`，`inject = ['agents', 'goals', 'sessions']`，以 Service 或 `apply` 经 `ctx.effect` 注册 `ctx.autoDev`。在 session-start 与覆盖已有 agent 应用时强制 `setOn(false)`。`invariant.ts`：空伴生，带包专属 `No runtime invariant:` 理由，说明开关为进程本地、持久关系仍由 goal/session fold 拥有。

- [ ] **Step 4: 重跑开关测试 — 预期 PASS**

- [ ] **Step 5: 注册 `tsconfig.host.json` reference；更新分组 README 表**

---

### Task 2: 空闲策略 — 让位、阻塞、程序化 resume、cancel-hold

**文件：**
- Modify: `packages/goal/goal-conversation-monitor/src/index.ts`
- Create: `packages/goal/goal-conversation-monitor/tests/idle-policy.spec.ts`

**接口：**
- Consumes: `ctx.autoDev`、`ctx.goals`、agent idle/status 事件（同 `goal-round-driver` 空闲检查点模式）
- Produces: cancel-hold 标志；策略第 4 步适用时程序化 `goals.resume`；尚无推断

- [ ] **Step 1: 编写失败的空闲策略测试**

用例（此处脚本适配器可选 — 优先直接 goal 变更 + idle 发射）：

1. 开关关 + idle → 即使存在 paused goal 也不 resume。
2. 开关开 + active armed → 监测器不调用 resume（让位；驱动器拥有）。
3. 开关开 + blocked → 不 resume。
4. 开关开 + paused + 无 cancel-hold → `resume` → armed。
5. 在 goal 尝试路径上 `agent.cancel` 之后：置 cancel-hold；idle 不得 resume；人工 `{ kind: 'user' }` followup 清除 hold；下一次 idle 可 resume。
6. 开关 off→on 清除 cancel-hold。

研读 `packages/goal/goal-round-driver/src/index.ts` 的空闲监听与取消；复用同一套公开 agent 事件，不导入驱动器内部。

- [ ] **Step 2: 跑 — 预期 FAIL**

- [ ] **Step 3: 实现尚无推断的空闲检查点**

在 `isOn` 时的 idle 上仅应用规格步骤 1–4。每 agent 跟踪 cancel-hold。开关关时：`goals.disarm(agent)`，清除预留（尚无），保持开关 false。

- [ ] **Step 4: 跑 — 预期 PASS**

---

### Task 3: 推断提示词 + `auto_dev_decide` 工具 + 预留

**文件：**
- Create: `packages/goal/goal-conversation-monitor/src/prompt.ts`
- Create: `packages/goal/goal-conversation-monitor/src/decide-tool.ts`
- Modify: `packages/goal/goal-conversation-monitor/src/index.ts`
- Modify: `packages/goal/goal-conversation-monitor/package.json`（peer `dsh-tools`）
- Create: `packages/goal/goal-conversation-monitor/tests/inference.spec.ts`

**接口：**
- Produces:

```ts
/** Fixed monitor inference body for Agent.followup. */
function renderAutoDevInferencePrompt(): ContentBlock[]

/** Tool name exactly `auto_dev_decide`. */
type AutoDevDecideArgs = {
  readonly decision: 'create' | 'none'
  /** Required non-empty when decision is create. */
  readonly objective?: string
}
```

- 消息来源精确为：`{ kind: 'plugin', plugin: 'goal-conversation-monitor' }`
- 工具执行：开关关则拒绝；`create` 时调用 `ctx.goals.create(agent, { objective })`（替换 complete 时用 edit）；`none` 为空操作；返回紧凑 JSON `{ decision, goal }`

- [ ] **Step 1: 编写失败的推断测试**（真实循环 + ScriptedAdapter，对标 goal-round-driver）

1. 开关开、无 goal，模型调用 `auto_dev_decide` create → goal 武装；下一次 idle 让位给驱动器（harness 中挂载驱动器）。
2. 开关开，模型调用 `none` → 无 goal；无新人工消息时第二次 idle 不再推断（安静直至人工边）。
3. 待定监测预留 + 人工 followup → 预留陈旧 / 不作为混合批次准入。
4. 监测轮中的 `create_goal` 仍被 tool-goal 拒绝（权威回归守卫）。

- [ ] **Step 2: 跑 — 预期 FAIL**

- [ ] **Step 3: 实现提示词、工具注册、预留 + pre-step 栅栏**

仅栅栏监测器自己的排队消息 id/content（轻量镜像驱动器陈旧检查）。结算后再次进入空闲策略。空 `none` 之后置 `quietUntilHuman = true`，由下一次用户消息或开关循环清除。

- [ ] **Step 4: 跑 — 预期 PASS**

---

### Task 4: `/auto-dev` 命令

**文件：**
- Create: `packages/goal/goal-conversation-monitor/src/command.ts`
- Modify: `packages/goal/goal-conversation-monitor/src/index.ts`（`inject` 增加 `commands`）
- Create: `packages/goal/goal-conversation-monitor/tests/command.spec.ts`

**接口：**
- 注册斜杠命令 `auto-dev`，raw input 为 `on` | `off` | `status` | 空→status

```text
Usage: /auto-dev [on|off|status]
```

- [ ] **Step 1: 失败的命令测试**（模式来自 `command-goal`）

- [ ] **Step 2: 实现 `command.ts` 并在 `apply` 中注册**

- [ ] **Step 3: 测试 PASS**

---

### Task 5: 包 README + Model Experience + 限制

**文件：**
- Create: `packages/goal/goal-conversation-monitor/README.md`（+ zh + i18n）
- 确保 Known Limitations 覆盖：无评估器；开关不持久；发明路径是 decide-tool 而非 tool-goal create；cancel-hold 语义

- [ ] **Step 1: 编写双语 README，按 goal-round-driver 的 Model Experience 节写推断提示词与 decide 工具**

- [ ] **Step 2: `pnpm run verify-translation-pairing --write packages/goal/goal-conversation-monitor/README.md`**

---

### Task 6: Web-app 组合挂载（先 Host）

**文件：**
- Modify: `packages/bundle/web-app/package.json`（依赖）
- Modify: `packages/bundle/web-app/cordis.patch.yml`（在 `goal-round-driver` 后 insert `goal-conversation-monitor`）
- Modify: `apps/cli/composition.md`（若 web profile 图列出插件）

- [ ] **Step 1: 添加 patch 行**

```yaml
- id: goal-conversation-monitor
  name: '@deepseek-ai/dsh-goal-conversation-monitor'
```

- [ ] **Step 2: `pnpm install` 然后 `pnpm run verify-cordis-config`（或 doc-sync 用于组合的 scoped 门禁）**

**不要**加到 `packages/bundle/base`。

---

### Task 7: 无密钥 ACP 快照

**文件：**
- Create: `examples/acp-agent/auto-dev.cordis.yml`（include 基础 ACP + insert monitor + 若尚未存在则加 tool-goal + goal-round-driver）
- Create: `examples/acp-agent/tests/auto-dev-snapshots/...` 夹具
- Create: `examples/acp-agent/tests/auto-dev.snapshot.ts`
- Modify: `examples/package.json`（若需新依赖）

**场景：**
1. 人工：`/auto-dev on` 加上说明未完成具体工作的消息（或先开启再发送工作描述）。
2. 脚本化/回放模型：第一轮 `auto_dev_decide` create；第二轮 goal round 经 `update_goal` 完成。
3. 断言 session JSONL：plugin 来源推断消息、`goal/change` create、goal 来源 round、complete；开关永不作为持久状态出现。

- [ ] **Step 1: 按 `examples/acp-agent/tests/ports.snapshot.ts` 编写快照测试骨架**

- [ ] **Step 2: 需要时用仓库的快照录制路径录制期望输出；提交可在 macOS/Linux 无密钥回放的夹具**

- [ ] **Step 3: `pnpm run test:snapshot -t auto-dev`（或所选过滤器名）— PASS**

---

### Task 8: 客户端标题栏开关

**文件：**
- Create: `packages/client/ui-auto-dev/`（package.json、tsconfig、tsdown、src/index.ts、src/client/*、invariant、README 对）
- Create: `AutoDevToggle.tsx` + locales + CSS module
- Modify: `tsconfig.client.json`
- Modify: `packages/bundle/web-app/cordis.patch.yml`（`dsh.client` 行）+ `package.json`

**接口：**
- 槽位：`conversation.session.header.utilities`
- Inject：经 session scope 的 `conversation.send('/auto-dev on')` / `off`（复制 ui-dev-workflow 发送模式）
- 乐观本地 UI 状态可接受；权威状态来自命令结果文本（若展示）或下一次 `/auto-dev status` — v1 可仅发送 on/off，不做实时镜像

- [ ] **Step 1: 失败的客户端规格（`// @vitest-environment jsdom`）断言按钮发送正确斜杠文本**

- [ ] **Step 2: 实现插件 + 使用 `--dsw-*` token 的样式**

- [ ] **Step 3: `pnpm run test:gui` 覆盖新包 — PASS**

---

### Task 9: Agent Note + 目录/文档收尾

**文件：**
- Create: `.agents/notes/implemented/feature/2026-08-15-conversation-auto-dev-monitor.md`（+ zh + i18n）
- Update: `docs/subsystems/goal.md`（+ zh）用简短「消费方」指针指向监测器（无新类型则不扩导出）
- Run: 覆盖新包的 scoped `doc-sync` 片段（若 decide 工具出现则 tool-catalog、config-catalog、module-graph）

- [ ] **Step 1: 编写 Agent Note（问题、决策、替代、后果、测试）**

- [ ] **Step 2: 配对 + 对 note 与子系统编辑执行 `verify-translation-pairing --write`**

- [ ] **Step 3: `pnpm run test:coverage -- packages/goal/goal-conversation-monitor` 以及 ui-auto-dev 的客户端覆盖率 — `src/` 100%**

---

## 规格覆盖检查表

| 规格要求 | Task |
|---|---|
| 显式开关，session-start 强制关 | 1 |
| 空闲让位 / 阻塞 / 程序化 resume / cancel-hold | 2 |
| Plugin 来源推断 + decide 工具（不伪造 user） | 3 |
| `/auto-dev` 命令 | 4 |
| 可选组合（不进 base） | 6 |
| 无密钥快照 | 7 |
| 经 send 的 header utilities 开关 | 8 |
| Agent Note + 文档 | 5, 9 |
| 不扩大 tool-goal 权威 | 3 回归测试 |

## 占位符 / 一致性自检

- 任务中无 TBD；规划未决项已在批准规格中锁定。
- 服务名 `autoDev` / 插件 id `goal-conversation-monitor` / 工具 `auto_dev_decide` / 命令 `auto-dev` 全文一致。
- `none` 后安静是「直至人工边保持安静」的具体机制。
