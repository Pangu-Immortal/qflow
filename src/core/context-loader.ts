/**
 * CLAUDE.md 模块化加载引擎 - 按需加载上下文模块
 *
 * 从 data/context-modules/ 目录读取预定义的上下文模块文件，
 * 按需加载并缓存到内存，支持 token 计数和压缩建议。
 *
 * 模块存储: ~/.claude/tools/qflow/data/context-modules/
 * 可用模块: core, phase1, phase2, ui-constraints, context-guard,
 *          thinking-tiers, iron-rules, readme-spec, reverse
 *
 * 函数列表:
 * - loadModules()      按名称加载多个模块，合并返回
 * - unloadModules()    从内存缓存中卸载指定模块，释放 token
 * - getStatus()        获取已加载和可用模块的状态（含逐模块 token 明细）
 * - compressContext()   执行上下文压缩（aggressive 实际卸载，moderate 仅建议）
 * - getModulesDir()     获取模块目录路径
 */

import path from 'node:path'; // 路径拼接工具
import { promises as fs } from 'node:fs'; // 异步文件操作
import { fileURLToPath } from 'node:url'; // ESM 中获取文件路径
import { estimateTokens, formatTokens } from '../utils/token-counter.js'; // Token 计数工具
import { fileExists } from '../utils/file-io.js'; // 文件存在检查
import { log } from '../utils/logger.js'; // 日志工具

/** 可用的模块名称列表 */
const AVAILABLE_MODULES = [
  'core',             // 核心提示词
  'phase1',           // 阶段一：工程理解
  'phase2',           // 阶段二：实现阶段
  'ui-constraints',   // UI 开发铁律
  'context-guard',    // 上下文守卫机制
  'thinking-tiers',   // 思考分级策略
  'iron-rules',       // 强制执行约束
  'readme-spec',      // README 沉淀规范
  'reverse',          // 逆向还原专用约束
] as const;

/** 模块名到实际文件名的映射表（对外接口不变，内部路径使用映射后的文件名） */
export const MODULE_FILE_MAP: Record<string, string> = {
  'core': 'core',                         // 核心模块，文件名无前缀
  'phase1': 'module-phase1',              // 阶段一模块
  'phase2': 'module-phase2',              // 阶段二模块
  'ui-constraints': 'module-ui-constraints',   // UI 约束模块
  'context-guard': 'module-context-guard',     // 上下文守卫模块
  'thinking-tiers': 'module-thinking-tiers',   // 思考分级模块
  'iron-rules': 'module-iron-rules',           // 铁律模块
  'readme-spec': 'module-readme-spec',         // README 规范模块
  'reverse': 'module-reverse',                 // 逆向还原模块
};

/** 已加载模块的内存缓存: 模块名 -> 文件内容 */
const loadedModules: Map<string, string> = new Map();

/**
 * 获取模块文件存放目录的绝对路径
 *
 * 基于编译后文件位置推算: dist/core/context-loader.js → 向上两级到 qflow 根目录
 * 再进入 data/context-modules/
 *
 * @returns 模块目录的绝对路径
 */
export function getModulesDir(): string {
  const currentFile = fileURLToPath(import.meta.url); // 当前文件绝对路径（dist/core/context-loader.js）
  return path.resolve(path.dirname(currentFile), '..', '..', 'data', 'context-modules'); // 向上两级到项目根目录
}

/**
 * 按名称加载多个上下文模块
 *
 * 读取每个模块的文件内容（.md 文件），合并为一个字符串返回。
 * 已缓存的模块直接从内存读取，未缓存的从磁盘加载后写入缓存。
 *
 * @param moduleNames - 要加载的模块名称列表
 * @returns 已加载的模块名列表、总 token 数、合并后的内容
 */
export async function loadModules(
  moduleNames: string[],
): Promise<{ loaded: string[]; totalTokens: number; content: string }> {
  const modulesDir = getModulesDir(); // 获取模块目录
  const loaded: string[] = []; // 成功加载的模块名
  const contentParts: string[] = []; // 各模块内容

  for (const name of moduleNames) { // 遍历每个请求的模块名
    if (loadedModules.has(name)) { // 已在缓存中
      loaded.push(name); // 记录
      contentParts.push(loadedModules.get(name)!); // 从缓存取内容
      log.debug(`模块 ${name} 从缓存加载`); // 调试日志
      continue;
    }

    const fileName = MODULE_FILE_MAP[name] || name; // 通过映射表获取实际文件名，未映射则原样使用
    const filePath = path.join(modulesDir, `${fileName}.md`); // 拼接模块文件路径
    if (!(await fileExists(filePath))) { // 文件不存在
      log.warn(`模块 ${name} 不存在: ${filePath}`); // 警告日志
      continue; // 跳过
    }

    const content = await fs.readFile(filePath, 'utf-8'); // 读取文件内容
    loadedModules.set(name, content); // 写入缓存
    loaded.push(name); // 记录
    contentParts.push(content); // 追加内容
    log.debug(`模块 ${name} 已加载 (${formatTokens(estimateTokens(content))} tokens)`); // 调试日志
  }

  const mergedContent = contentParts.join('\n\n---\n\n'); // 用分隔线合并
  const totalTokens = estimateTokens(mergedContent); // 计算总 token 数

  log.info(`已加载 ${loaded.length} 个模块，总计 ${formatTokens(totalTokens)} tokens`); // 信息日志
  return { loaded, totalTokens, content: mergedContent }; // 返回结果
}

/**
 * 从内存缓存中卸载指定模块，释放 token
 *
 * 遍历 moduleNames，检查每个模块是否在 loadedModules 缓存中，
 * 若存在则计算其 token 数、从缓存中移除。'core' 模块永远不会被卸载。
 *
 * @param moduleNames - 要卸载的模块名称列表
 * @returns 实际卸载的模块名列表和释放的总 token 数
 */
export function unloadModules(moduleNames: string[]): { unloaded: string[]; freedTokens: number } {
  const unloaded: string[] = []; // 实际卸载的模块名
  let freedTokens = 0; // 释放的 token 总数

  for (const name of moduleNames) { // 遍历每个请求卸载的模块名
    if (name === 'core') { // core 模块永不卸载
      log.warn(`跳过卸载 core 模块（核心模块不可卸载）`); // 警告日志
      continue;
    }

    const content = loadedModules.get(name); // 从缓存中获取模块内容
    if (!content) { // 模块未在缓存中
      log.debug(`模块 ${name} 未加载，跳过卸载`); // 调试日志
      continue;
    }

    const tokens = estimateTokens(content); // 计算该模块占用的 token 数
    loadedModules.delete(name); // 从缓存中移除
    freedTokens += tokens; // 累加释放的 token
    unloaded.push(name); // 记录已卸载
    log.info(`模块 ${name} 已卸载，释放 ${formatTokens(tokens)} tokens`); // 信息日志
  }

  log.info(`共卸载 ${unloaded.length} 个模块，释放 ${formatTokens(freedTokens)} tokens`); // 汇总日志
  return { unloaded, freedTokens }; // 返回结果
}

/**
 * 获取模块加载状态
 *
 * @returns 已加载模块列表、可用模块列表、已加载内容的总 token 数、逐模块 token 明细
 */
export async function getStatus(): Promise<{
  loaded: string[];
  availableModules: string[];
  totalTokens: number;
  moduleTokens: Record<string, number>;
}> {
  const modulesDir = getModulesDir(); // 获取模块目录
  const available: string[] = []; // 实际可用（文件存在）的模块名

  for (const name of AVAILABLE_MODULES) { // 遍历预定义模块
    const fileName = MODULE_FILE_MAP[name] || name; // 通过映射表获取实际文件名
    const filePath = path.join(modulesDir, `${fileName}.md`); // 拼接路径
    if (await fileExists(filePath)) { // 文件存在
      available.push(name); // 加入可用列表
    }
  }

  // 计算已加载内容的总 token 数和逐模块明细
  let totalTokens = 0; // 累计
  const moduleTokens: Record<string, number> = {}; // 逐模块 token 明细
  for (const [name, content] of loadedModules.entries()) { // 遍历缓存
    const tokens = estimateTokens(content); // 计算该模块 token 数
    moduleTokens[name] = tokens; // 记录到明细
    totalTokens += tokens; // 累加
  }

  return {
    loaded: [...loadedModules.keys()], // 已加载的模块名列表
    availableModules: available, // 可用的模块名列表
    totalTokens, // 总 token 数
    moduleTokens, // 逐模块 token 明细
  };
}

/**
 * 执行上下文压缩
 *
 * aggressive 策略: 实际卸载非 core、非保留的已加载模块，返回压缩结果
 * moderate 策略: 不实际操作，仅返回压缩建议文本
 *
 * @param strategy      - 压缩策略: aggressive（激进）或 moderate（温和），默认 moderate
 * @param preserveItems - 需要保留的模块名列表（不会被卸载）
 * @returns 压缩结果，包含策略、前后 token 对比、建议文本
 */
export async function compressContext(
  strategy: 'aggressive' | 'moderate' = 'moderate',
  preserveItems?: string[],
): Promise<{
  strategy: string;
  tokensBefore: number;
  tokensAfter: number;
  freedTokens: number;
  unloaded: string[];
  suggestions: string;
}> {
  const statusBefore = await getStatus(); // 压缩前状态
  const tokensBefore = statusBefore.totalTokens; // 压缩前总 token 数
  const preserve = new Set(preserveItems || []); // 保留项集合
  const lines: string[] = []; // 建议文本行

  lines.push(`## 上下文压缩建议 (${strategy} 策略)`); // 标题
  lines.push(`当前已加载 ${statusBefore.loaded.length} 个模块，${formatTokens(tokensBefore)} tokens`); // 当前状态
  lines.push(''); // 空行

  let unloaded: string[] = []; // 实际卸载的模块名
  let freedTokens = 0; // 释放的 token 数

  if (strategy === 'aggressive') { // 激进策略：实际卸载模块
    // 收集所有非 core、非保留的已加载模块
    const toUnload = statusBefore.loaded.filter(name =>
      name !== 'core' && !preserve.has(name) // 排除 core 和保留项
    );

    if (toUnload.length > 0) { // 有可卸载的模块
      const result = unloadModules(toUnload); // 执行卸载
      unloaded = result.unloaded; // 实际卸载列表
      freedTokens = result.freedTokens; // 实际释放 token
    }

    lines.push('### 卸载结果:'); // 小标题
    for (const name of statusBefore.loaded) { // 遍历压缩前已加载模块
      if (name === 'core') {
        lines.push(`- [保留] ${name} (核心模块)`); // core 始终保留
      } else if (preserve.has(name)) {
        lines.push(`- [保留] ${name} (用户指定保留)`); // 用户保留
      } else if (unloaded.includes(name)) {
        const tokens = statusBefore.moduleTokens[name] || 0; // 该模块释放的 token
        lines.push(`- [已卸载] ${name} (释放 ${formatTokens(tokens)} tokens)`); // 已卸载
      }
    }
    lines.push(''); // 空行
    lines.push(`共释放 ${formatTokens(freedTokens)} tokens`); // 释放汇总
  } else { // 温和策略：仅建议
    lines.push('### 建议:'); // 小标题
    lines.push('- 保留 core 和当前阶段模块'); // 保留建议
    lines.push('- 卸载非当前阶段的模块'); // 卸载建议
    lines.push('- 如需更多空间，切换到 aggressive 策略'); // 升级建议

    // 列出各模块 token 占用
    lines.push(''); // 空行
    lines.push('### 逐模块 token 占用:'); // 小标题
    for (const [name, tokens] of Object.entries(statusBefore.moduleTokens)) { // 遍历模块 token 明细
      lines.push(`- ${name}: ${formatTokens(tokens)} tokens`); // 逐项列出
    }
  }

  if (preserveItems && preserveItems.length > 0) { // 有保留项
    lines.push(''); // 空行
    lines.push('### 强制保留项:'); // 小标题
    for (const item of preserveItems) { // 遍历保留项
      lines.push(`- ${item}`); // 列出
    }
  }

  const tokensAfter = tokensBefore - freedTokens; // 压缩后 token 数

  return {
    strategy,
    tokensBefore,
    tokensAfter,
    freedTokens,
    unloaded,
    suggestions: lines.join('\n'), // 合并建议文本
  };
}
