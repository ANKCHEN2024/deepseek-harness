/**
 * Fixed project-development workflow prompts. Product copy stays Chinese;
 * ids are stable English keys for tests and inject faces. An execution mode
 * prefixes each body so the same action can stay analysis-only or allow edits.
 */

/** Stable workflow action id. */
export type WorkflowActionId =
  | 'agent-autonomous'
  | 'agent-investigate'
  | 'agent-fix-loop'
  | 'agent-verify-gate'
  | 'agent-goal-drive'
  | 'agent-parallel'
  | 'requirements'
  | 'user-stories'
  | 'task-breakdown'
  | 'docs'
  | 'ui-design'
  | 'tech-design'
  | 'api-design'
  | 'data-model'
  | 'implement'
  | 'refactor'
  | 'optimize'
  | 'code-review'
  | 'security-review'
  | 'add-tests'
  | 'a11y-check'
  | 'debug'
  | 'dead-code'
  | 'deps-hygiene'
  | 'temp-cleanup'
  | 'import-hygiene'
  | 'debug-residue'
  | 'git-status-brief'
  | 'commit-message'
  | 'commit-draft'
  | 'commit-push'
  | 'github-private-publish'
  | 'pr-description'
  | 'changelog'
  | 'release-notes'
  | 'version-tag'
  | 'deploy-checklist'
  | 'migration-plan'
  | 'rollback-plan'
  | 'smoke-verify'
  | 'handoff-notes'
  | 'project-summary'
  | 'standardize'
  | 'product-deck'
  | 'component-library'
  | 'architecture-retro'
  | 'knowledge-base'
  | 'demo-kit'

/**
 * How far the model may go when acting on a workflow prompt.
 * `analyze` forbids file edits; `edit` allows minimal verified changes.
 */
export type WorkflowMode = 'analyze' | 'edit'

/** One grouped section of the toolbox. */
export interface WorkflowGroup {
  /** Locale key for the group heading. */
  readonly headingKey:
    | 'group.agent'
    | 'group.plan'
    | 'group.design'
    | 'group.build'
    | 'group.quality'
    | 'group.cleanup'
    | 'group.ship'
    | 'group.wrap'
  /** Ordered actions in this group. */
  readonly actions: readonly WorkflowActionId[]
}

/** Toolbox layout: agent playbooks first, then SDLC stages through wrap-up. */
export const WORKFLOW_GROUPS: readonly WorkflowGroup[] = [
  { headingKey: 'group.agent', actions: [
    'agent-autonomous',
    'agent-investigate',
    'agent-fix-loop',
    'agent-verify-gate',
    'agent-goal-drive',
    'agent-parallel',
  ] },
  { headingKey: 'group.plan', actions: ['requirements', 'user-stories', 'task-breakdown'] },
  { headingKey: 'group.design', actions: ['docs', 'ui-design', 'tech-design', 'api-design', 'data-model'] },
  { headingKey: 'group.build', actions: ['implement', 'refactor', 'optimize'] },
  { headingKey: 'group.quality', actions: ['code-review', 'security-review', 'add-tests', 'a11y-check', 'debug'] },
  { headingKey: 'group.cleanup', actions: [
    'dead-code',
    'deps-hygiene',
    'temp-cleanup',
    'import-hygiene',
    'debug-residue',
  ] },
  { headingKey: 'group.ship', actions: [
    'git-status-brief',
    'commit-message',
    'commit-draft',
    'commit-push',
    'github-private-publish',
    'pr-description',
    'changelog',
    'release-notes',
    'version-tag',
    'deploy-checklist',
    'migration-plan',
    'rollback-plan',
    'smoke-verify',
    'handoff-notes',
  ] },
  { headingKey: 'group.wrap', actions: [
    'project-summary',
    'standardize',
    'product-deck',
    'component-library',
    'architecture-retro',
    'knowledge-base',
    'demo-kit',
  ] },
]

/** Shared workspace-inspection lead-in (mode-specific lines append after). */
const SHARED_LEAD = '请先查看当前工作区与仓库现状，再开始输出。用中文回复。不要猜测不存在的文件；需要信息时先读取或搜索。'

/**
 * Mode-specific constraints prepended to every workflow prompt.
 * @param mode - analyze-only or allow-edits.
 * @returns preamble block including a trailing blank line.
 */
export function preambleFor(mode: WorkflowMode): string {
  const modeLine = mode === 'analyze'
    ? '执行模式：只分析。本轮只输出分析、方案与清单，不要创建、修改或删除任何文件；不要运行会改动仓库的命令。'
    : '执行模式：可改代码。需要落地时可以直接修改仓库；改动保持最小、可验证，并说明如何验证；不要做无关重构。'
  return `${SHARED_LEAD}\n${modeLine}\n`
}

/** Prompt body for each workflow action (without the shared preamble). */
export const WORKFLOW_BODIES: Readonly<Record<WorkflowActionId, string>> = {
  'agent-autonomous': `请以强 Agent 方式自主闭环完成本目标（不要只给空泛建议）：
1. 先用工具探查仓库与相关上下文，列出证据
2. 写清成功标准与范围；多步时用 todo（若可用）拆解并逐项推进
3. 长任务用 goal 工具建立或更新目标（若可用），便于多轮续跑
4. 可改代码：小步落地并每步可验证；只分析：只给计划、拟改文件与验证命令
5. 用仓库真实脚本/测试做验证；失败则换假设继续，禁止同命令空转
6. 结束时汇报：做了什么、证据、如何验证、残留风险
停止条件：成功标准已满足，或证据表明无法在当前权限/环境下完成（明确阻塞原因）。`,

  'agent-investigate': `请做证据优先的深度探查（默认不改代码，除非执行模式允许且探查需要最小探针）：
1. 明确要回答的问题与未知项
2. 用读/搜/命令交叉取证；每条结论标注证据路径
3. 区分事实 / 推断 / 待核实；给出置信度
4. 若发现可行动修复，列入建议优先级，但不擅自扩大范围
5. 输出探查报告：结论、证据链、下一步实验
停止条件：问题已有可辩护结论，或列出无法取证的缺口。`,

  'agent-fix-loop': `请跑完整修复闭环：
1. 复现或定位失败信号（日志、测试、UI 现象）
2. 形成可检验的根因假设；用工具证实或证伪
3. 可改代码：最小修复；只分析：给出补丁级方案与拟改文件
4. 补或更新能锁住该问题的测试（可改时直接做）
5. 再跑相关验证；失败则回到假设，不要宣称已修好
停止条件：验证通过，或阻塞需用户提供环境/凭证。`,

  'agent-verify-gate': `请把仓库质量门禁打绿（或给出打绿路径）：
1. 从 package 脚本 / CI / README 找出真实检查命令（typecheck、test、lint、build 等）
2. 只分析：运行只读检查（若安全）或列出应跑命令与预期；不要改文件
3. 可改代码：跑门禁 → 按失败修复 → 再跑，直到绿或明确阻塞
4. 优先修根因，避免跳过测试；不要删测试来「变绿」
5. 汇报：已跑命令、结果、改动、仍红项
停止条件：关键门禁通过，或剩余失败需外部依赖。`,

  'agent-goal-drive': `请用目标驱动推进当前工作（发挥多轮 Agent 能力）：
1. 用 get_goal 查看是否已有目标；没有则 create_goal 写清客观可验证的 objective
2. 用 todo（若可用）拆近端步骤；每完成一步更新 todo / goal
3. 按执行模式推进实现或只输出计划；持续对照 goal 成功标准
4. 完成则 update_goal complete；阻塞则 blocked 并写清原因
5. 汇报 goal 状态、本轮进展、下一轮建议
不要用空话代替 goal/todo 状态。`,

  'agent-parallel': `请把工作拆成可并行与必须串行的部分：
1. 先探查依赖，标出可并行切片与关键路径
2. 若环境提供 subagent/委托类工具：为独立切片委派，并汇总结果
3. 若无委托能力：给出清晰串行计划与合并点，仍按强 Agent 工具循环推进主路径
4. 可改代码时落地主路径最小增量；只分析则停在计划与接口契约
5. 汇报：并行图、各切片状态、合并风险
停止条件：切片计划可执行，或主路径已验证交付。`,

  requirements: `请做需求分析，并输出结构化结果，至少包含：
1. 目标与成功标准（可度量）
2. 目标用户与关键使用场景（含反向场景）
3. 范围内 / 范围外
4. 关键约束（技术、时间、依赖、合规）
5. 待确认问题（仅列无法从仓库推断的问题）
6. 验收标准清单（Given/When/Then 或等价条目）
7. 建议的下一步（规划 / 设计 / 实现）`,

  'user-stories': `请把当前目标写成用户故事与场景：
1. 以「作为…我希望…以便…」列出故事，按价值排序
2. 每个故事附 2–5 条验收条件
3. 标出依赖、风险与可并行项
4. 区分 MVP 与后续迭代
不要开始改代码，除非执行模式允许且我已要求实现。`,

  'task-breakdown': `请把当前目标拆成可执行任务列表：
1. 按优先级排序；每项写清交付物、依赖、预估复杂度（S/M/L）
2. 标出可并行项与关键路径
3. 给出建议的实施顺序与里程碑检查点
4. 点名需要先读的文件 / 模块
不要开始改代码，除非执行模式允许且我明确要求实现。`,

  docs: `请撰写或更新项目文档（优先 README，必要时补充 docs/ 架构说明）：
1. 项目是什么、解决什么问题
2. 快速开始 / 本地运行（真实命令）
3. 目录与模块职责
4. 关键配置、约定与扩展点
5. 常见问题与排障入口
文档必须反映仓库真实结构；缺信息时先读代码再写。若执行模式允许改文件，直接提交文档改动并说明路径。`,

  'ui-design': `请做 UI / 交互设计方案（文字稿，不接外部设计工具）：
1. 信息架构与主要页面 / 视图
2. 关键用户流程（含分支与失败路径）
3. 各页面布局、组件层级与关键文案
4. 状态（空 / 加载 / 错误 / 成功 / 权限不足）
5. 视觉与可用性约束（对比度、间距、响应式、键盘操作）
若仓库已有设计系统或 UI 约定，请对齐它们。`,

  'tech-design': `请输出可落地的技术方案：
1. 现状摘要（相关模块与约束）
2. 方案选型与取舍（至少对比一个备选）
3. 数据流 / 接口 / 模块边界 / 错误处理
4. 风险、回滚与验证方式
5. 里程碑与任务切片
方案必须贴合当前仓库技术栈与目录约定。`,

  'api-design': `请设计或整理 API / 协议面：
1. 资源与操作一览（含鉴权与幂等要求）
2. 请求 / 响应字段、错误码与示例
3. 兼容性与版本策略
4. 与现有代码 / 路由 / RPC 的对齐点
5. 测试与契约验证建议
若仓库已有 OpenAPI、Typert 或同类约定，请遵循。`,

  'data-model': `请梳理数据模型与持久化设计：
1. 实体、关系与生命周期
2. 字段含义、约束、索引与迁移影响
3. 读写路径与一致性要求
4. 与现有 schema / store / 文件格式的差异
5. 迁移与回填风险
不要臆造不存在的表或文件格式。`,

  implement: `请实现当前需求：
1. 先读相关代码、测试与邻近约定
2. 小步修改，保持现有风格与包边界
3. 补必要测试；改动说明要可审查
4. 给出验证步骤（命令或手工路径）
若执行模式为只分析：只给出实现计划与拟改文件列表，不改仓库。`,

  refactor: `请做有目标的重构（行为保持不变）：
1. 说明痛点与目标（可读性 / 去重 / 边界清晰）
2. 列出拟改文件与不变式
3. 分步重构；每步可验证
4. 补或更新锁住行为的测试
禁止顺手加功能；若执行模式为只分析：只输出重构计划。`,

  optimize: `请定位并优化性能或资源问题：
1. 先找证据（热点路径、多余 IO、重复计算、过大载荷）
2. 给出可度量的前后对比方式
3. 实施最小优化；避免过早抽象
4. 说明风险与回退
若缺乏数据，先写测量方案再改代码（只分析模式下只给方案）。`,

  'code-review': `请对当前改动或指定范围做代码审查，按严重程度列出问题：
1. 正确性与边界条件
2. 安全与权限
3. 性能与资源
4. 可维护性、命名与测试缺口
5. 建议的修复顺序与示例改法
先给结论（可否合并），再给明细。只分析为主；仅在执行模式允许且问题明确时直接修高优先级缺陷。`,

  'security-review': `请做安全向审查（威胁建模轻量版）：
1. 信任边界、输入校验、注入与路径穿越
2. 密钥 / 凭证 / PII 处理
3. 权限与越权风险
4. 依赖与供给链注意点（仅基于仓库可见信息）
5. 按严重程度给出修复建议
不要进行实际攻击；需要改代码时遵循执行模式。`,

  'add-tests': `请为相关改动或模块补充测试：
1. 识别关键路径、边界与回归风险
2. 优先补失败会值钱的用例；对齐现有测试工具与目录
3. 说明如何运行这些测试
4. 若执行模式允许，直接添加测试文件并确保可运行`,

  'a11y-check': `请做无障碍与可用性检查（针对 Web / UI 相关代码）：
1. 语义结构、焦点顺序、键盘可达
2. 对比度与可读性
3. 表单标签、错误提示与状态通知
4. 列出问题、影响用户与修复建议
有现成组件库约定时对齐约定；执行模式允许时可直接修明显问题。`,

  debug: `请排查并修复问题：
1. 根据报错 / 现象定位根因（先复现或读日志 / 代码，禁止无证据猜测）
2. 给出最小修复
3. 补充或更新能锁住该问题的测试
4. 说明验证步骤
只分析模式下：只输出根因假设检验步骤与拟修复方案。`,

  'dead-code': `请清理死代码与未使用导出：
1. 用读取 / 搜索找证据：未引用导出、不可达分支、明显无入口文件
2. 按风险列出拟删 / 拟收紧项（高：公共 API；低：私有死代码）
3. 说明如何验证（类型检查、测试、构建）
4. 不要为「干净」而大范围重构
若执行模式允许，做最小删除并说明路径；只分析模式下只给清单。`,

  'deps-hygiene': `请整理依赖卫生：
1. 对照 package.json / 锁文件与真实 import，找未用、重复、过时声明
2. 对齐本仓库包管理器与 workspace 约定
3. 列出建议变更（增 / 删 / 移到 devDependencies）与风险
4. 给出验证命令（install、build、相关测试）
禁止臆造不存在的包；不确定标为待确认。执行模式允许时可改清单文件。`,

  'temp-cleanup': `请清理临时与构建残留：
1. 识别可安全删除的产物 / 缓存 / 明确临时文件（优先已 ignore 的路径）
2. 区分「可自动删」与「需人工确认」
3. 禁止删除未忽略的源码、密钥、用户数据
4. 给出删除清单与回滚方式
只分析模式下只列清单；可改代码时仅删有证据的残留并说明。`,

  'import-hygiene': `请整理 import：
1. 对齐仓库 lint / format / 路径别名约定
2. 去重、排序、补类型-only import、去掉未用导入
3. 按文件列出拟改点；避免无关逻辑改动
4. 说明如何用现有脚本验证
执行模式允许时可直接改文件；改动保持最小。`,

  'debug-residue': `请清理调试残留：
1. 搜索临时 console / debugger / 过期调试注释 / 误提交本地路径
2. 区分应删、应改为正式日志、应保留的诊断
3. 按文件列出证据与建议
4. 验证：相关测试或手工路径仍可用
不要静默删除有意保留的诊断钩子；不确定先标出。`,

  'git-status-brief': `请汇总当前工作区的 Git 状态（只读）：
1. 分支名、是否领先/落后 remote、工作区是否干净
2. git status 与关键 diff 摘要（按文件；标出可能含密钥的路径）
3. 已配置 remote 一览（名称与 URL 主机；标明 upstream vs 个人）
4. 建议：继续改、先准备提交、或可直接提交并推送
不要执行 commit / push / gh repo create；只分析与可改代码模式下本动作都保持只读。`,

  'commit-draft': `请准备一份「手动提交包」（不要执行 commit / push）：
1. 拟纳入本次提交的文件列表（排除 .env、密钥、无关产物）
2. 1 条主提交标题（≤72 字符；若仓库用 Conventional Commits 则遵循）与可选正文
3. 将要执行的命令清单（add / commit；如需再 push 则单独列出并标为下一步）
4. 风险与待确认项
本动作无论执行模式如何，都不要运行会改动仓库或远程的命令。`,

  'commit-push': `请把当前改动提交并推送到合适的个人 remote：
1. 先只读检查 status / diff / remote；排除密钥与无关文件
2. 若执行模式为只分析：只输出将执行的命令、目标 remote、风险，不要 commit/push
3. 若执行模式为可改代码：创建最小提交（清晰说明），再 push
4. 目标 remote 优先个人 origin / 非 upstream；若只有 upstream，停止并说明需先加个人 remote 或改用「发布到私有库」
5. 完成后给出 commit hash、remote、分支与验证方式
不要 force-push 到 main/master；不要改 git config。`,

  'github-private-publish': `请把当前工作区发布到「个人 GitHub 私有库」：
1. 检查是否已有指向用户自己的 remote；有则确认可见性偏好为 private 后 push
2. 若没有合适 remote：在可改代码模式下用 gh 创建 --private 仓库并 push（需本机 gh 已登录）
3. 只分析模式：只给出将执行的 gh/git 命令、建议仓库名、私有标志与风险，不创建、不 push
4. 不要把仓库建成 public；不要推送到 deepseek-ai 等上游组织
5. 排除 .env 与密钥；完成后给出仓库 URL（私有）与后续建议（如保留 upstream 仅用于拉取）
不要修改全局 git user；不要 --force。`,

  'pr-description': `请撰写 PR 说明（可直接粘贴到 GitHub / GitLab）：
1. Summary（动机与背景，3 条以内）
2. 改动摘要（用户可见 vs 内部；按模块分组）
3. Test plan（可勾选命令 / 手工路径）
4. 风险、回滚点与 Breaking changes
5. 截图 / 录屏 / 相关 Issue 链接建议（如适用）
先看 git status / diff / 近期提交再写；不确定处明确标注。`,

  changelog: `请撰写或更新 Changelog 条目：
1. 按用户可感知变更分组（Added / Changed / Fixed / Deprecated / Removed / Security / Breaking）
2. 语气面向使用者，避免实现细节堆砌；每条一行可扫读
3. 遵循仓库既有 Changelog / Keep a Changelog / 包版本文件格式
4. 给出建议版本号占位与日期占位
执行模式允许时可写入对应文件并说明路径。`,

  'release-notes': `请撰写面向用户的发布说明（可作公告正文）：
1. 一句话亮点 + 版本号占位
2. 用户可见变更（按主题，非按 commit）
3. Breaking changes / 升级步骤 / 兼容窗口
4. 已知问题与临时规避
5. 验证建议与获取支持的入口
基于仓库真实改动与文档；不要把内部重构写成卖点。`,

  'version-tag': `请给出版本发布与打标签方案：
1. 根据改动类型建议 SemVer（major / minor / patch）及理由
2. 需要同步的版本文件 / changelog / 锁文件列表
3. 建议的 tag 名、发布分支与提交顺序
4. 发布后需跑的检查（build / test / publish）
若仓库有 changeset、lerna、release-please 等约定，请对齐；只分析模式下只给方案不改文件。`,

  'deploy-checklist': `请给出分环境上线检查清单（可勾选）：
1. 合并前：类型检查、测试、lint、构建、文档与配置审查
2. 预发：部署步骤、烟雾验证、数据准备
3. 生产：发布窗口、变更所有者、沟通对象
4. 配置 / 密钥 / 特性开关 / 迁移执行顺序
5. 监控指标、告警、值班与回滚触发条件
结合本仓库 scripts、CI 与文档中的真实命令；缺失项标为待确认。`,

  'migration-plan': `请制定数据 / 配置 / 兼容性迁移方案：
1. 迁移对象（schema、文件格式、配置键、API 兼容）
2. 正向步骤、预估耗时与锁/停机需求
3. 回填、双写或兼容读取策略
4. 验证查询 / 抽样检查
5. 失败时的中止与回滚条件
不要臆造不存在的存储；先核对仓库中的迁移工具与历史迁移。`,

  'rollback-plan': `请写出可执行的回滚预案：
1. 回滚触发条件（错误率、核心路径失败、数据异常）
2. 按层回滚：应用版本 / 配置 / 迁移 / 特性开关
3. 逐步操作顺序与责任人角色（占位）
4. 回滚后验证清单
5. 不可逆步骤与数据修复备选
方案必须对应本仓库真实发布方式；做不到的步骤明确标注。`,

  'smoke-verify': `请设计上线后烟雾 / 验收验证：
1. 5–15 条最高价值路径（含登录、读写、关键失败态）
2. 每条写清步骤、期望结果与失败信号
3. 自动化可跑的命令 vs 必须手工的项
4. 建议的验证窗口与退出标准（通过 / 观察 / 回滚）
优先复用仓库已有 e2e、snapshot、smoke 脚本。`,

  'handoff-notes': `请撰写交付 / 运维交接说明：
1. 本次交付范围与不在范围内事项
2. 架构与运行依赖（服务、队列、存储、第三方）
3. 配置、密钥、特性开关与默认值注意点
4. 常见故障症状 → 排查入口 → 升级路径
5. 监控面板、日志位置、值班联系占位
面向接手的人，短句可执行；基于仓库真实结构。`,

  'project-summary': `请撰写项目交付后的总结 / 复盘（面向团队与干系人）：
1. 目标回顾与达成情况（对照需求 / 验收标准；未达成项写清原因）
2. 关键决策与取舍（选了什么、放弃了什么、为何）
3. 风险、问题与应对（含仍开放项）
4. 经验与可复用做法（Keep / Improve / Try）
5. 后续事项与建议优先级
基于仓库真实改动、文档与会话可核实事实；不要空泛鸡汤。`,

  standardize: `请把本项目沉淀为可复用的标准化约定：
1. 目录 / 命名 / 模块边界 / 包约定
2. 代码与文档模板（README、PR、Changelog 等）
3. 脚本、CI、本地命令与质量门禁对齐建议
4. 与仓库现状的差异清单（已有 vs 建议）
5. 最小落地步骤（可勾选）
若执行模式允许，直接写入 docs/ 或约定位置并说明路径；禁止无关大重构。`,

  'product-deck': `请撰写面向用户 / 客户的产品介绍文稿（可导出 PDF）：
1. 一页摘要：产品是什么、为谁、核心价值
2. 问题 → 方案 → 关键能力（按用户收益，非按模块堆砌）
3. 典型使用场景与演示路径
4. 差异化 / 边界 / 不承诺事项
5. 获取方式、开始步骤、支持入口
输出结构清晰的 Markdown（含标题层级），适合打印或浏览器「打印为 PDF」；若执行模式允许，写入 docs/ 并说明路径。不要依赖本环境生成二进制 PDF。`,

  'component-library': `请从现有 UI / 前端代码提炼组件库资产：
1. 可复用组件清单（名称、职责、入口路径）
2. 每个组件的 props / 变体 / 状态（空、加载、错误）
3. 使用示例与反模式
4. 设计 token / 主题 / 无障碍约定
5. 缺口与建议的下一步抽取顺序
对齐仓库已有设计系统；若执行模式允许，写入组件文档并说明路径。`,

  'architecture-retro': `请做交付后架构回顾：
1. 最终架构摘要（模块边界、数据流、外部依赖）
2. 与初期方案的偏差及原因
3. 技术债与热点（含证据）
4. 演进建议（短期可做 / 中期 / 明确不做）
5. 建议的架构文档落点
用图文可描述的层次说明即可；不要臆造不存在的服务。`,

  'knowledge-base': `请把项目知识沉淀为可检索知识库草稿：
1. FAQ（安装、配置、常见失败）
2. 排障决策树（症状 → 检查 → 修复）
3. 运维 / 值班笔记要点
4. 与现有 README / docs / 交接说明的去重与交叉引用
5. 建议的目录结构与文件名
若执行模式允许，写入 docs/ 并保持与真实命令一致。`,

  'demo-kit': `请准备演示材料包：
1. 演示目标与受众
2. 分步 Demo 脚本（含旁白要点与预计时长）
3. 需要准备的截图 / 录屏清单与建议取景
4. 讲解大纲（开场 → 价值 → 演示 → Q&A）
5. 失败兜底话术与已知限制说明
基于真实可运行路径；缺环境时标为待确认。`,

  'commit-message': `请根据当前改动撰写提交说明（可直接使用）：
1. 先查看 git status / diff（及必要时近期日志）归纳意图
2. 给出 1 条主提交标题（≤72 字符，祈使语气；若仓库用 Conventional Commits 则遵循）
3. 可选正文：动机、关键改动、风险、验证方式
4. 若改动应拆成多次提交，给出拆分建议与各自标题
不要包含密钥或无关文件；只分析模式下只输出文案不执行 commit。`,
}

/**
 * Build the full prompt for one workflow action under an execution mode.
 * Prefer {@link messageFor} so the host skill gesture loads the bundled skill.
 * @param id - workflow action id.
 * @param mode - analyze-only or allow-edits.
 * @returns prompt text without a leading `/skill` token.
 */
export function promptFor(id: WorkflowActionId, mode: WorkflowMode = 'edit'): string {
  return `${preambleFor(mode)}${WORKFLOW_BODIES[id]}`
}

/**
 * Bundled skill `/name` token for a toolbox action (`dev-<id>`).
 * @param id - workflow action id.
 * @returns skill name without the leading slash.
 */
export function skillNameFor(id: WorkflowActionId): string {
  return `dev-${id}`
}

/**
 * User message that loads the bundled workflow skill then applies mode + focus.
 * The leading `/dev-<id>` token is the host gesture recognized by `dsh-tool-skill`.
 * @param id - workflow action id.
 * @param mode - analyze-only or allow-edits.
 * @param options - when `skillAvailable` is false, omit the slash token and send a plain prompt.
 * @returns text for `conversation.send`.
 */
export function messageFor(
  id: WorkflowActionId,
  mode: WorkflowMode = 'edit',
  options: { skillAvailable?: boolean } = {},
): string {
  const body = promptFor(id, mode)
  if (options.skillAvailable === false) return body
  return `/${skillNameFor(id)}\n\n${body}`
}
