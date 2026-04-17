/**
 * qflow 配置管理器 - 读写 qflow.config.json
 *
 * 负责项目级 qflow 配置的加载、保存和默认值生成。
 * 配置文件路径: {projectRoot}/.qflow/qflow.config.json
 *
 * 函数列表:
 * - loadConfig()              从项目根目录加载配置文件
 * - saveConfig()              保存配置到项目根目录
 * - getDefaultConfig()        生成带默认值的配置对象
 * - setConfigField()          原子更新单个配置字段（v16.0 C-4）
 * - getMode()                 获取当前运行模式（环境变量优先）
 * - invalidateConfigCache()   手动失效配置缓存（v16.0 Q-4）
 * - detectProjectRoot()       从 cwd 向上查找项目根目录（v20.0 P2-14）
 * - detectProjectPhase()      检测项目阶段（v21.0 P3-1）
 * - whatNext()                智能推荐下一步操作（v21.0 P3-2）
 * - interactiveSetup()        交互式配置向导（v21.0 P3-3）
 * - generateMcpManifest()     生成 MCP manifest（v21.0 P3-16）
 */

import path from 'node:path'; // 路径拼接工具
import { QflowConfigSchema, type QflowConfig, type Mode } from '../schemas/config.js'; // 配置 schema 和类型
import { readJSON, writeJSON, ensureDir, fileExists } from '../utils/file-io.js'; // 文件读写工具 + 存在性检查
import { withFileLock } from '../utils/file-io.js'; // v16.0 C-4: 文件锁用于原子更新
import { log } from '../utils/logger.js'; // 日志工具
import { QFLOW_DIR } from '../shared/tool-utils.js'; // .qflow 目录常量
import { CONFIG_CACHE_TTL } from '../shared/constants.js'; // v16.0 Q-5: 配置缓存 TTL 常量

/** 配置文件名 */
const CONFIG_FILENAME = 'qflow.config.json'; // 固定文件名

/** v16.0 Q-4: 配置内存缓存（key=projectRoot, value={config, expiry}） */
const configCache = new Map<string, { config: QflowConfig; expiry: number }>(); // 内存缓存

/**
 * 拼接配置文件的绝对路径
 * @param projectRoot - 项目根目录
 * @returns 配置文件绝对路径
 */
function configPath(projectRoot: string): string {
  return path.join(projectRoot, QFLOW_DIR, CONFIG_FILENAME); // {projectRoot}/.qflow/qflow.config.json
}

/**
 * 从项目根目录加载 qflow 配置
 *
 * 读取 {projectRoot}/.qflow/qflow.config.json，用 Zod schema 校验。
 * 文件不存在时自动创建默认配置并保存。
 *
 * @param projectRoot - 项目根目录绝对路径
 * @returns 校验后的配置对象
 */
export async function loadConfig(projectRoot: string): Promise<QflowConfig> {
  // v16.0 Q-4: 检查内存缓存是否命中且未过期
  const cached = configCache.get(projectRoot); // 查缓存
  if (cached && Date.now() < cached.expiry) { // 缓存存在且未过期
    log.debug(`loadConfig: 命中缓存 (TTL=${CONFIG_CACHE_TTL}ms)`); // 调试日志
    return cached.config; // 直接返回缓存
  }

  const filePath = configPath(projectRoot); // 拼接路径
  log.debug(`加载配置: ${filePath}`); // 输出调试日志

  const raw = await readJSON<unknown>(filePath); // 读取 JSON 文件

  if (raw === null) { // 文件不存在
    log.info('配置文件不存在，创建默认配置'); // 提示用户
    const defaultConfig = getDefaultConfig(projectRoot); // 生成默认配置
    await saveConfig(projectRoot, defaultConfig); // 写入磁盘
    return defaultConfig; // 返回默认配置
  }

  const parsed = QflowConfigSchema.safeParse(raw); // 用 Zod 校验
  if (!parsed.success) { // 校验失败
    log.error(`配置文件格式错误: ${parsed.error.message}`); // 输出错误详情
    throw new Error(`qflow.config.json 校验失败: ${parsed.error.message}`); // 抛出异常
  }

  // v16.0 Q-4: 写入缓存
  configCache.set(projectRoot, { config: parsed.data, expiry: Date.now() + CONFIG_CACHE_TTL }); // 缓存 + TTL
  log.debug(`配置加载成功: 项目=${parsed.data.projectName}, 模式=${parsed.data.mode}`); // 输出调试信息
  return parsed.data; // 返回校验后的配置
}

/**
 * 保存配置到项目根目录
 *
 * 自动创建 .qflow 目录（如不存在），然后原子写入配置文件。
 *
 * @param projectRoot - 项目根目录绝对路径
 * @param config      - 要保存的配置对象
 */
export async function saveConfig(projectRoot: string, config: QflowConfig): Promise<void> {
  const filePath = configPath(projectRoot); // 拼接路径
  await ensureDir(path.join(projectRoot, QFLOW_DIR)); // 确保 .qflow 目录存在
  await writeJSON(filePath, config); // 原子写入
  // v16.0 Q-7: write-through — 写入后同步更新缓存
  configCache.set(projectRoot, { config, expiry: Date.now() + CONFIG_CACHE_TTL }); // 更新缓存
  log.debug(`配置已保存: ${filePath}`); // 输出调试日志
}

/**
 * 生成默认配置对象
 *
 * 使用 Zod schema 的 default 值填充，项目名称取目录名。
 *
 * @param projectRoot - 项目根目录绝对路径
 * @param projectName - 可选的项目名称，默认取目录名
 * @returns 带默认值的配置对象
 */
export function getDefaultConfig(projectRoot: string, projectName?: string): QflowConfig {
  const name = projectName ?? path.basename(projectRoot); // 项目名取目录名兜底
  return QflowConfigSchema.parse({ // 通过 Zod schema parse 填充默认值
    projectName: name, // 项目名称
    projectRoot, // 项目根目录
    responseLanguage: 'zh-CN', // 默认响应语言为中文
  });
}

/**
 * 获取当前运行模式
 *
 * 优先级: 环境变量 QFLOW_MODE > 配置文件 mode 字段 > 默认 'standard'
 * 接受 'core' | 'standard' | 'all' | 'autopilot' | 'review' | 'extra' 六个值。
 *
 * @returns 当前运行模式
 */
export function getMode(): Mode {
  const envMode = process.env.QFLOW_MODE; // 读取环境变量
  if (
    envMode === 'minimal' ||
    envMode === 'core' ||
    envMode === 'standard' ||
    envMode === 'all' ||
    envMode === 'autopilot' || // 自动驾驶模式
    envMode === 'review' ||    // 评审模式
    envMode === 'extra'        // 扩展模式
  ) {
    return envMode; // 环境变量值合法，直接返回
  }
  return 'standard'; // 默认值
}

/**
 * v16.0 C-4: 原子更新单个配置字段
 *
 * 使用 withFileLock 保护，读取 → 修改 → 写入 一气呵成，
 * 支持顶层字段（如 responseLanguage）和嵌套字段（如 ai.provider）。
 *
 * @param projectRoot - 项目根目录绝对路径
 * @param field       - 字段名（支持 'responseLanguage', 'projectName' 等顶层字段）
 * @param value       - 字段值
 */
export async function setConfigField(projectRoot: string, field: string, value: unknown): Promise<void> {
  const filePath = configPath(projectRoot); // 配置文件路径
  await ensureDir(path.join(projectRoot, QFLOW_DIR)); // 确保 .qflow 目录存在

  await withFileLock(filePath, async () => {
    const raw = await readJSON<Record<string, unknown>>(filePath); // 读取原始 JSON
    const data = raw ?? {}; // 文件不存在则创建空对象
    data[field] = value; // 设置字段值

    // 重新校验确保合法
    const parsed = QflowConfigSchema.safeParse(data); // Zod 校验
    if (!parsed.success) {
      throw new Error(`setConfigField: 字段 "${field}" 值不合法: ${parsed.error.message}`); // 校验失败抛出
    }

    await writeJSON(filePath, parsed.data); // 原子写入校验后的数据
    // v16.0 Q-7: write-through — setConfigField 后同步更新缓存
    configCache.set(projectRoot, { config: parsed.data, expiry: Date.now() + CONFIG_CACHE_TTL }); // 更新缓存
    log.info(`setConfigField: ${field} = ${JSON.stringify(value)}`); // 记录更新日志
  });
}

// ─── v18.0: Profile 管理方法 ─────────────────────────────

/**
 * 加载指定名称的 Profile 配置
 *
 * @param projectRoot  - 项目根目录
 * @param profileName  - Profile 名称
 * @returns Profile 配置对象，不存在时返回 null
 */
export async function loadProfile(projectRoot: string, profileName: string): Promise<import('../schemas/config.js').Profile | null> {
  const config = await loadConfig(projectRoot); // 加载配置
  if (!config.profiles || config.profiles.length === 0) return null; // 无 Profile
  const profile = config.profiles.find(p => p.name === profileName); // 查找
  return profile ?? null; // 返回
}

/**
 * 应用 Profile - 设置 mode 和 contextModules
 *
 * @param projectRoot  - 项目根目录
 * @param profileName  - Profile 名称
 * @returns 应用后的配置
 */
export async function applyProfile(projectRoot: string, profileName: string): Promise<QflowConfig> {
  const config = await loadConfig(projectRoot); // 加载配置
  const profile = config.profiles?.find(p => p.name === profileName); // 查找 Profile
  if (!profile) throw new Error(`Profile "${profileName}" 不存在`); // Profile 不存在

  config.mode = profile.mode; // 应用运行模式
  if (profile.contextModules) {
    config.contextModules = profile.contextModules; // 应用上下文模块
  }
  await saveConfig(projectRoot, config); // 保存配置
  log.info(`applyProfile: 已应用 Profile "${profileName}" (mode=${profile.mode})`); // 日志
  return config;
}

// ─── v21.0 P3: 项目阶段感知与引导功能 ─────────────────────────────

/**
 * v21.0 P3-1: 检测项目当前所处阶段
 *
 * 扫描 .qflow/ 目录，根据任务状态分布和 Spec 数量推断阶段：
 * - 'init':         配置存在但无任务和 Spec
 * - 'planning':     有 Spec 或待处理任务，尚未开始执行
 * - 'implementing': 有正在进行（active）的任务
 * - 'reviewing':    有处于评审（review）状态的任务
 * - 'done':         所有任务已完成，或完成率 >= 80%
 *
 * @param projectRoot - 项目根目录绝对路径
 * @returns 阶段名称和推断依据列表
 */
export async function detectProjectPhase(projectRoot: string): Promise<{ phase: string; evidence: string[] }> {
  const evidence: string[] = []; // 收集推断依据
  const qflowDir = path.join(projectRoot, QFLOW_DIR); // .qflow 目录路径

  // 检查 .qflow 目录是否存在
  if (!(await fileExists(qflowDir))) {
    return { phase: 'init', evidence: ['未找到 .qflow 目录'] }; // 目录不存在，视为初始化前
  }

  // 读取任务列表
  const tasksPath = path.join(qflowDir, 'tasks.json'); // tasks.json 路径
  let tasks: Array<{ status: string }> = []; // 任务列表
  try {
    const data = await readJSON<{ tasks?: Array<{ status: string }> }>(tasksPath); // 读取 JSON
    tasks = data?.tasks ?? []; // 取出任务数组，不存在则为空
  } catch { /* 无任务文件，忽略错误 */ }

  // 统计 specs 目录中的 Spec 文件数量
  const specsDir = path.join(qflowDir, 'specs'); // specs 目录路径
  let specCount = 0; // Spec 文件计数
  try {
    const { promises: fs } = await import('node:fs'); // 动态导入 fs.promises
    const entries = await fs.readdir(specsDir); // 读取目录条目
    specCount = entries.filter(e => e.endsWith('.json')).length; // 只计 JSON 文件
  } catch { /* specs 目录不存在，忽略错误 */ }

  // 统计各状态任务数量
  const total = tasks.length; // 任务总数
  const doneCount = tasks.filter(t => t.status === 'done').length; // 已完成数量
  const activeCount = tasks.filter(t => t.status === 'active').length; // 进行中数量
  const reviewCount = tasks.filter(t => t.status === 'review').length; // 评审中数量
  const pendingCount = tasks.filter(t => t.status === 'pending').length; // 待处理数量

  // 记录统计信息作为推断依据
  evidence.push(`任务总数: ${total}, done: ${doneCount}, active: ${activeCount}, review: ${reviewCount}, pending: ${pendingCount}`);
  evidence.push(`Spec 数量: ${specCount}`);

  // 阶段判断逻辑（优先级从高到低）
  if (total === 0 && specCount === 0) {
    return { phase: 'init', evidence: [...evidence, '无任务和 Spec，处于初始化阶段'] }; // 空项目
  }
  if (total > 0 && doneCount / total >= 0.8) {
    return { phase: 'done', evidence: [...evidence, `完成率 ${Math.round(doneCount / total * 100)}% >= 80%`] }; // 完成率超过 80%
  }
  if (reviewCount > 0) {
    return { phase: 'reviewing', evidence: [...evidence, `有 ${reviewCount} 个任务处于评审状态`] }; // 有评审中任务
  }
  if (activeCount > 0) {
    return { phase: 'implementing', evidence: [...evidence, `有 ${activeCount} 个任务正在进行`] }; // 有活跃任务
  }
  if (specCount > 0 || pendingCount > 0) {
    return { phase: 'planning', evidence: [...evidence, '有 Spec 或待处理任务，处于规划阶段'] }; // 规划中
  }
  return { phase: 'init', evidence: [...evidence, '默认初始化阶段'] }; // 兜底返回初始阶段
}

/**
 * v21.0 P3-2: 根据项目阶段智能推荐下一步操作
 *
 * 先调用 detectProjectPhase() 获取当前阶段，再根据阶段返回有序的工具推荐列表。
 * 每条推荐包含工具名、描述和优先级（数字越小优先级越高）。
 *
 * @param projectRoot - 项目根目录绝对路径
 * @returns 当前阶段和推荐操作列表
 */
export async function whatNext(projectRoot: string): Promise<{ phase: string; recommendations: Array<{ tool: string; description: string; priority: number }> }> {
  const { phase } = await detectProjectPhase(projectRoot); // 获取当前阶段
  const recommendations: Array<{ tool: string; description: string; priority: number }> = []; // 推荐列表

  // 根据阶段填充推荐工具
  switch (phase) {
    case 'init': // 初始化阶段：引导用户创建基础配置
      recommendations.push(
        { tool: 'qflow_project_init', description: '初始化项目 qflow 配置', priority: 1 },
        { tool: 'qflow_spec_init', description: '创建第一个 Spec 文档描述需求', priority: 2 },
        { tool: 'qflow_onboard', description: '查看项目引导信息', priority: 3 },
      );
      break;
    case 'planning': // 规划阶段：引导用户创建和分解任务
      recommendations.push(
        { tool: 'qflow_task_create', description: '创建任务分解需求', priority: 1 },
        { tool: 'qflow_parse_prd', description: '从 PRD 文档自动生成任务', priority: 2 },
        { tool: 'qflow_task_expand', description: '拆解复杂任务为子任务', priority: 3 },
        { tool: 'qflow_analyze_all_complexity', description: '分析所有任务复杂度', priority: 4 },
      );
      break;
    case 'implementing': // 实现阶段：引导用户执行任务
      recommendations.push(
        { tool: 'qflow_task_next', description: '获取下一个推荐执行的任务', priority: 1 },
        { tool: 'qflow_task_start', description: '启动任务获取完整执行上下文', priority: 2 },
        { tool: 'qflow_task_set_status', description: '更新任务状态', priority: 3 },
        { tool: 'qflow_defer_work', description: '记录需要延迟处理的工作', priority: 4 },
      );
      break;
    case 'reviewing': // 评审阶段：引导用户完成审查和验收
      recommendations.push(
        { tool: 'qflow_parallel_review', description: '执行三层并行审查', priority: 1 },
        { tool: 'qflow_acceptance_audit', description: '验收标准核查', priority: 2 },
        { tool: 'qflow_report_progress', description: '生成项目进度报告', priority: 3 },
      );
      break;
    case 'done': // 完成阶段：引导用户归档和交接
      recommendations.push(
        { tool: 'qflow_report_progress', description: '生成最终进度报告', priority: 1 },
        { tool: 'qflow_session_handoff', description: '生成会话交接摘要', priority: 2 },
        { tool: 'qflow_deferred_list', description: '检查是否有延迟工作未处理', priority: 3 },
      );
      break;
  }

  log.info(`whatNext: 项目阶段="${phase}"，推荐 ${recommendations.length} 个操作`); // 记录推荐结果
  return { phase, recommendations }; // 返回阶段和推荐列表
}

/**
 * v21.0 P3-3: 返回交互式配置向导步骤
 *
 * 检查项目当前配置状态，生成带有完成标志的分步引导列表，
 * 帮助用户从零开始搭建 qflow 工作流。
 *
 * @param projectRoot - 项目根目录绝对路径
 * @returns 配置步骤列表，每步包含完成状态
 */
export async function interactiveSetup(projectRoot: string): Promise<{ steps: Array<{ step: number; title: string; description: string; tool: string; required: boolean; completed: boolean }> }> {
  const qflowDir = path.join(projectRoot, QFLOW_DIR); // .qflow 目录路径
  const configExists = await fileExists(path.join(qflowDir, 'qflow.config.json')); // 配置文件是否存在
  const tasksExists = await fileExists(path.join(qflowDir, 'tasks.json')); // 任务文件是否存在
  const specsExists = await fileExists(path.join(qflowDir, 'specs')); // specs 目录是否存在

  // 定义引导步骤列表，completed 字段反映当前实际状态
  const steps = [
    { step: 1, title: '初始化项目', description: '创建 .qflow/ 目录和配置文件', tool: 'qflow_project_init', required: true, completed: configExists },
    { step: 2, title: '创建 Spec 文档', description: '描述项目需求或架构规格', tool: 'qflow_spec_init', required: false, completed: specsExists },
    { step: 3, title: '创建任务', description: '从 Spec 或 PRD 创建任务列表', tool: 'qflow_task_create', required: true, completed: tasksExists },
    { step: 4, title: '配置工作流', description: '选择 Agile 工作流模板（可选）', tool: 'qflow_agile_workflows', required: false, completed: false }, // 工作流模板无法自动检测
  ];

  log.info(`interactiveSetup: 已完成 ${steps.filter(s => s.completed).length}/${steps.length} 步`); // 记录完成进度
  return { steps }; // 返回步骤列表
}

/**
 * v21.0 P3-16: 生成 MCP manifest.json 配置文件内容
 *
 * 根据当前项目配置生成符合 MCP 规范的 manifest 对象，
 * 可用于工具安装、分享或对接其他 MCP 客户端。
 *
 * @param projectRoot - 项目根目录绝对路径
 * @returns MCP manifest 对象
 */
export async function generateMcpManifest(projectRoot: string): Promise<Record<string, unknown>> {
  const config = await loadConfig(projectRoot); // 加载当前项目配置

  // 构建符合 MCP schema_version 1.0 规范的 manifest 对象
  const manifest: Record<string, unknown> = {
    schema_version: '1.0', // MCP manifest 版本号
    name: 'qflow', // 工具名称（固定）
    display_name: `qflow - ${config.projectName}`, // 带项目名的展示名称
    description: 'Claude Code 自动化工具链 MCP Server', // 工具描述
    version: '22.1.0', // qflow 当前版本
    transport: { type: 'stdio', command: 'node', args: ['dist/mcp.js'] }, // 传输层配置（stdio 模式）
    project: { name: config.projectName, root: projectRoot, mode: config.mode }, // 项目基本信息
    capabilities: { tools: true, resources: false, prompts: false }, // 功能声明
    generatedAt: new Date().toISOString(), // 生成时间戳
  };

  log.info(`generateMcpManifest: 已生成 MCP manifest (project=${config.projectName})`); // 记录生成日志
  return manifest; // 返回 manifest 对象
}

/**
 * v16.0 Q-4: 手动失效指定项目的配置缓存
 *
 * 用于外部模块在直接修改配置文件后强制刷新缓存。
 * 不传参数时清空所有缓存。
 *
 * @param projectRoot - 项目根目录（可选，不传则清空全部）
 */
/**
 * v18.0: 生成 MCPB Bundle 配置
 *
 * 根据当前项目配置生成 MCP Bundle JSON，包含工具列表和配置信息，
 * 可用于导出或分享项目的 MCP 工具配置。
 *
 * @param projectRoot - 项目根目录
 * @returns MCPB Bundle 对象
 */
export async function generateMcpbBundle(projectRoot: string): Promise<Record<string, unknown>> {
  const config = await loadConfig(projectRoot); // 加载配置
  const bundle: Record<string, unknown> = {
    name: `qflow-${config.projectName}`, // Bundle 名称
    version: '22.1.0', // 当前版本
    description: `qflow MCPB Bundle for ${config.projectName}`, // 描述
    mode: config.mode, // 运行模式
    projectRoot, // 项目根目录
    contextModules: config.contextModules || [], // 上下文模块
    generatedAt: new Date().toISOString(), // 生成时间
  };

  // 如果有 profiles，也包含进来
  if (config.profiles && config.profiles.length > 0) {
    bundle.profiles = config.profiles.map(p => ({ name: p.name, mode: p.mode })); // 仅导出名称和模式
  }

  log.info(`generateMcpbBundle: 已生成 Bundle (project=${config.projectName})`); // 日志
  return bundle;
}

export function invalidateConfigCache(projectRoot?: string): void {
  if (projectRoot) {
    configCache.delete(projectRoot); // 清除指定项目缓存
    log.debug(`invalidateConfigCache: 已清除 ${projectRoot} 的配置缓存`); // 调试日志
  } else {
    configCache.clear(); // 清空所有缓存
    log.debug('invalidateConfigCache: 已清空所有配置缓存'); // 调试日志
  }
}

// ─── v20.0 P2-14: 自动检测项目根目录 ─────────────────────────────

/** 常见项目标识文件列表（用于在无 .qflow/ 时兜底判断） */
const PROJECT_MARKERS = [ // 各语言/框架的项目标识文件
  'package.json',     // Node.js / JavaScript
  'Cargo.toml',       // Rust
  'go.mod',           // Go
  'pyproject.toml',   // Python (PEP 518)
  'pom.xml',          // Java Maven
  'build.gradle',     // Java/Kotlin Gradle
  'build.gradle.kts', // Kotlin Gradle (KTS)
  'Makefile',         // C/C++/通用
  'CMakeLists.txt',   // CMake
  'pubspec.yaml',     // Dart/Flutter
  'Gemfile',          // Ruby
  'composer.json',    // PHP
] as const;

/**
 * 从 cwd 向上查找项目根目录
 *
 * 查找策略（优先级从高到低）：
 * 1. 包含 .qflow/ 目录的最近祖先目录
 * 2. 包含项目标识文件（package.json 等）的最近祖先目录
 * 3. 全部未找到返回 null
 *
 * @param startDir - 起始搜索目录，默认 process.cwd()
 * @returns 项目根目录绝对路径，未找到返回 null
 */
export async function detectProjectRoot(startDir?: string): Promise<string | null> {
  let current = path.resolve(startDir ?? process.cwd()); // 取绝对路径作为起点
  const root = path.parse(current).root; // 文件系统根（如 / 或 C:\）
  let markerFallback: string | null = null; // 记录首个命中项目标识文件的目录（兜底）

  while (true) { // 逐级向上遍历
    // 优先检查 .qflow/ 目录
    const qflowPath = path.join(current, QFLOW_DIR); // 拼接 .qflow 路径
    if (await fileExists(qflowPath)) { // 存在 .qflow 目录
      log.debug(`detectProjectRoot: 找到 .qflow 目录 → ${current}`); // 调试日志
      return current; // 立即返回
    }

    // 如果尚未记录兜底目录，检查项目标识文件
    if (markerFallback === null) {
      for (const marker of PROJECT_MARKERS) { // 遍历标识文件
        const markerPath = path.join(current, marker); // 拼接标识文件路径
        if (await fileExists(markerPath)) { // 命中标识文件
          markerFallback = current; // 记录为兜底目录
          log.debug(`detectProjectRoot: 命中项目标识 ${marker} → ${current}`); // 调试日志
          break; // 只需记录首个命中
        }
      }
    }

    // 到达文件系统根，停止遍历
    if (current === root) break; // 已达根目录

    current = path.dirname(current); // 上移一层
  }

  if (markerFallback) { // 未找到 .qflow 但有项目标识
    log.debug(`detectProjectRoot: 无 .qflow，使用项目标识兜底 → ${markerFallback}`); // 调试日志
  } else {
    log.debug('detectProjectRoot: 未找到任何项目根目录'); // 调试日志
  }
  return markerFallback; // 返回兜底目录或 null
}
