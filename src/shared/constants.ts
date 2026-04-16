/**
 * 全局常量定义
 *
 * 将散落在各模块中的硬编码魔数统一提取到此文件，
 * 便于集中管理、调优和测试。
 *
 * 常量列表：
 * - LOCK_TIMEOUT          文件锁超时毫秒数
 * - LOCK_RETRY_INTERVAL   文件锁重试间隔毫秒数
 * - DEFAULT_TEMPERATURE   AI 默认温度参数
 * - DEFAULT_MAX_TOKENS    AI 默认最大 token 数
 * - AI_REQUEST_TIMEOUT    AI 单次请求超时毫秒数
 * - MAX_RETRIES           AI 最大重试次数
 * - RETRY_BASE_DELAY      AI 重试基础延迟毫秒数（指数退避）
 * - ANTHROPIC_API_VERSION Anthropic Messages API 版本号
 * - MEMORY_CACHE_TTL      内存缓存有效期毫秒数
 * - GIT_TIMEOUT           Git 命令超时毫秒数
 * - MAX_LOG_ENTRIES        日志轮转上限条数
 * - MAX_ENGINE_CACHE      引擎缓存 LRU 上限
 * - DEFAULT_PRIORITY      默认任务优先级
 * - HOOK_TIMEOUT          钩子执行超时毫秒数
 * - SPEC_ID_PAD_WIDTH     Spec ID 补零宽度
 * - SPEC_MIN_CONTENT_LENGTH Spec 最小内容长度
 * - SPEC_LONG_CONTENT_THRESHOLD Spec 长内容阈值
 * - GEN_FROM_CODE_MAX_FILES 代码生成最大文件数
 * - GEN_FROM_CODE_MAX_CHARS 代码生成每文件最大字符数
 * - AI_GEN_SPEC_MAX_TOKENS AI 生成 Spec 最大 token
 * - MERMAID_LABEL_MAX_LENGTH Mermaid 标签最大长度
 * - CONFIG_CACHE_TTL      配置缓存 TTL
 */

/** 文件锁超时毫秒数 */
export const LOCK_TIMEOUT = 10_000;
/** 文件锁重试间隔毫秒数 */
export const LOCK_RETRY_INTERVAL = 50;
/** AI 默认温度参数 */
export const DEFAULT_TEMPERATURE = 0.7;
/** AI 默认最大 token 数 */
export const DEFAULT_MAX_TOKENS = 4096;
/** AI 单次请求超时毫秒数 */
export const AI_REQUEST_TIMEOUT = 30_000;
/** AI 最大重试次数 */
export const MAX_RETRIES = 2;
/** AI 重试基础延迟毫秒数（指数退避） */
export const RETRY_BASE_DELAY = 2000;
/** 内存缓存有效期毫秒数 */
export const MEMORY_CACHE_TTL = 1000;
/** Anthropic Messages API 版本号（用于 anthropic-version 请求头） */
export const ANTHROPIC_API_VERSION = '2023-06-01';
/** Git 命令超时毫秒数 */
export const GIT_TIMEOUT = 30_000;
/** 日志轮转上限条数 */
export const MAX_LOG_ENTRIES = 1000;
/** 引擎缓存 LRU 上限 */
export const MAX_ENGINE_CACHE = 50;
/** 默认任务优先级 */
export const DEFAULT_PRIORITY = 5;
/** 钩子执行超时毫秒数 */
export const HOOK_TIMEOUT = 10_000;

// ─── v16.0 Q-1: Spec 相关常量 ───────────────────────────
/** Spec ID 补零宽度（padStart 参数） */
export const SPEC_ID_PAD_WIDTH = 4;
/** Spec 最小内容长度（verify 判定内容过短的阈值） */
export const SPEC_MIN_CONTENT_LENGTH = 50;
/** Spec 长内容阈值（RFC 2119 检测触发阈值） */
export const SPEC_LONG_CONTENT_THRESHOLD = 200;
/** generateFromCodebase 最大读取文件数 */
export const GEN_FROM_CODE_MAX_FILES = 5;
/** generateFromCodebase 每文件最大字符数 */
export const GEN_FROM_CODE_MAX_CHARS = 2000;
/** AI 生成 Spec 最大 token 数 */
export const AI_GEN_SPEC_MAX_TOKENS = 2048;
/** Mermaid 图标签最大长度 */
export const MERMAID_LABEL_MAX_LENGTH = 30;
/** 配置缓存 TTL 毫秒数（v16.0 Q-5: 从 1000 提升到 5000 提高命中率） */
export const CONFIG_CACHE_TTL = 5_000;

// ─── v17.0 TDD-1: TDD Autopilot 相关常量 ───────────────────
/** TDD 最大迭代次数（test→write→implement→verify→commit 循环上限） */
export const TDD_MAX_ITERATIONS = 10;
/** TDD 测试命令超时毫秒数 */
export const TDD_TEST_TIMEOUT = 30_000;
/** TDD 验证阶段超时毫秒数 */
export const TDD_VERIFY_TIMEOUT = 60_000;
/** TDD 阶段枚举值 */
export const TDD_PHASES = ['test', 'write', 'implement', 'verify', 'commit'] as const;

// ─── v17.0 SC-1: Scope 动态调节相关常量 ─────────────────────
/** Scope 调节最小强度 */
export const SCOPE_STRENGTH_MIN = 1;
/** Scope 调节最大强度 */
export const SCOPE_STRENGTH_MAX = 5;
/** Scope 调节默认强度 */
export const SCOPE_STRENGTH_DEFAULT = 3;

// ─── v17.0 IA-8: 动态指令装配相关常量 ──────────────────────
/** 指令装配 Context 最大字符数 */
export const MAX_CONTEXT_LENGTH = 4000;
/** 指令装配 Rules 最大字符数 */
export const MAX_RULES_LENGTH = 2000;
/** 指令装配 Templates 最大字符数 */
export const MAX_TEMPLATE_LENGTH = 2000;

// ─── v17.x FX-1: DFS 递归深度保护 ──────────────────────────
/** DFS 递归深度上限（防止无限递归，适用于 getTaskTree 等递归函数） */
export const MAX_LOOP_DEPTH = 100;

// ─── v18.0: CLI Provider 相关常量 ──────────────────────────
/** CLI 子进程执行超时毫秒数 */
export const CLI_SPAWN_TIMEOUT = 120_000;
/** CLI 子进程最大输出缓冲区字节数（10MB） */
export const CLI_MAX_BUFFER = 10 * 1024 * 1024; // 10MB

// ─── v18.0: Tag Workspaces ──────────────────────────────────
/** 标签工作区最大数量上限 */
export const MAX_TAG_WORKSPACES = 50;

// ─── v18.0: Watch Engine ─────────────────────────────────────
/** 文件监控防抖毫秒数 */
export const WATCH_DEBOUNCE_MS = 300;
/** 文件监控环形缓冲区最大事件数 */
export const WATCH_MAX_EVENTS = 500;

// ─── v18.0: Fuzzy Search 相关常量 ──────────────────────────
/** 模糊搜索默认相似度阈值（0-1，低于此值的结果被过滤） */
export const FUZZY_DEFAULT_THRESHOLD = 0.3;
/** 模糊搜索默认结果上限 */
export const FUZZY_DEFAULT_LIMIT = 20;

// ─── v19.0: Constitution 系统 + 技术债修复 相关常量 ─────────────
/** Constitution 最大原则数量上限 */
export const CONSTITUTION_MAX_PRINCIPLES = 50;
/** 循环任务最大迭代次数 */
export const LOOP_MAX_ITERATIONS = 100;
/** 循环任务冷却间隔毫秒数 */
export const LOOP_COOLDOWN_MS = 1000;
/** Sprint 单个冲刺最大故事数 */
export const SPRINT_MAX_STORIES = 100;
/** 插件清单版本号 */
export const PLUGIN_MANIFEST_VERSION = '1.0';
/** 代码评审超时毫秒数（5 分钟） */
export const REVIEW_TIMEOUT = 300_000;
/** 澄清对话最大轮数 */
export const CLARIFICATION_MAX_ROUNDS = 20;
/** 系统预置角色数量 */
export const PERSONA_COUNT = 12;
/** 多方参与最大参与者数 */
export const PARTY_MAX_PARTICIPANTS = 6;
/** 计划最大产物数量 */
export const PLAN_MAX_ARTIFACTS = 20;
/** 质量门禁通过分数阈值（百分制） */
export const GATE_PASS_THRESHOLD = 80;
/** readdir 分页大小（每次最多返回条数） */
export const READDIR_PAGE_SIZE = 500;

// ─── P3: Scale-Adaptive Planning 相关常量 ────────────────────
/** 快速轨道复杂度上限（复杂度 <= 此值走 quick 轨道） */
export const SCALE_QUICK_THRESHOLD = 3;        // 快速轨道复杂度上限
/** 企业轨道复杂度下限（复杂度 >= 此值走 enterprise 轨道） */
export const SCALE_ENTERPRISE_THRESHOLD = 8;   // 企业轨道复杂度下限
/** 三条规划轨道枚举 */
export const SCALE_TRACKS = ['quick', 'standard', 'enterprise'] as const; // 三条轨道

// ─── P3-11: Deferred Loading 相关常量 ────────────────────────
/** 延迟加载预估 token 节省比例 */
export const DEFERRED_LOADING_SAVINGS = '~16%';
/** 可延迟加载的工具分类 */
export const DEFERRED_TOOL_CATEGORIES = ['extra-task', 'extra-spec', 'extra-research', 'review'] as const;

// ─── v21.0: P1 新增常量 ──────────────────────────────────────
/** 研究详细度级别 */
export const RESEARCH_DETAIL_LEVELS = ['low', 'medium', 'high'] as const;
/** 推理深度级别 */
export const REASONING_EFFORTS = ['low', 'medium', 'high'] as const;
/** 延迟工作文件名 */
export const DEFERRED_WORK_FILE = 'deferred-work.md';
/** 任务启动上下文最大依赖数 */
export const TASK_START_MAX_DEPS = 10;
/** 批量重写最大任务数 */
export const BATCH_REWRITE_MAX_TASKS = 50;

// ─── v21.0: P2 质量门禁增强常量 ──────────────────────────────────
/** 推理精化方法列表（8 种） */
export const ELICITATION_METHODS_LIST = ['pre-mortem', 'first-principles', 'inversion', 'red-team', 'scenario-planning', 'assumption-mapping', 'five-whys', 'constraint-relaxation'] as const;
/** 故障诊断层级（3 层） */
export const FAULT_LAYERS_LIST = ['intent', 'spec', 'code'] as const;
/** 无损压缩最低比率（低于此值认为压缩失败） */
export const COMPRESSION_MIN_RATIO = 0.3;
/** 无损压缩最大比率（超过此值可能丢失信息） */
export const COMPRESSION_MAX_RATIO = 0.95;
/** 压缩 round-trip 验证关键词最低保留率 */
export const COMPRESSION_KEYWORD_RETENTION = 0.8;

// ─── v22.0 新增常量 ─────────────────────────────────────────
/** Undo 环形缓冲最大条目数 */
export const UNDO_LOG_MAX = 50;
/** 归档批次大小 */
export const ARCHIVE_BATCH_SIZE = 100;
/** 过期扫描最大任务数 */
export const OVERDUE_SCAN_LIMIT = 500;
/** 搜索默认返回数量 */
export const TASK_SEARCH_DEFAULT_LIMIT = 30;
/** Spec 导出子目录名 */
export const SPEC_EXPORT_DIR = 'exports';
