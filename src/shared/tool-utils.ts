/**
 * MCP 工具公共函数
 *
 * 提取各 Tier 工具文件中的重复代码：
 * - resolveRoot(): 解析项目根目录
 * - errResp(): 构造错误响应
 * - jsonResp(): 构造 JSON 响应
 * - uniqueId(): 生成全局唯一 ID（时间戳 + 计数器 + 随机串）
 * - sanitizeId(): 清洗用户输入的 ID，防止路径遍历和命令注入
 * - assertPathWithinRoot(): v12.0 路径边界校验，防止路径穿越攻击
 * - QFLOW_DIR: .qflow 目录常量，消除魔术字符串
 */
import { fileExists } from '../utils/file-io.js'; // 文件存在性检查
import path from 'node:path';                      // 路径处理

/** .qflow 目录名常量，消除魔术字符串 */
export const QFLOW_DIR = '.qflow';

/**
 * 清洗用户输入的 ID，防止路径遍历和命令注入
 *
 * 仅允许字母、数字、中文、点(.)、横杠(-)、下划线(_)。
 * 禁止路径遍历字符（..、/、\）。
 *
 * @param id - 用户输入的原始 ID
 * @param label - ID 类型标签（用于错误信息），默认 'ID'
 * @returns 清洗后的安全 ID
 * @throws 包含非法字符或路径遍历时抛出错误
 */
export function sanitizeId(id: string, label: string = 'ID'): string {
  if (!/^[a-zA-Z0-9\u4e00-\u9fff._-]+$/.test(id)) { // 仅允许安全字符（含中文）
    throw new Error(`${label} "${id}" 包含非法字符，仅允许字母、数字、中文、连字符、下划线、点号`);
  }
  if (id.includes('..') || id.includes('/') || id.includes('\\')) { // 禁止路径遍历
    throw new Error(`${label} "${id}" 包含路径遍历字符，已拒绝`);
  }
  return id; // 返回原始 ID（已通过校验）
}

/** 项目边界标记文件列表，遇到这些文件时停止向上查找 */
const PROJECT_BOUNDARY_MARKERS = ['.git', 'package.json', 'Cargo.toml', 'go.mod', 'pyproject.toml'];

/** 解析项目根目录：优先使用参数，否则从 cwd 向上查找 .qflow/，遇到项目边界标记时停止 */
export async function resolveRoot(projectRoot?: string): Promise<string | null> {
  if (projectRoot) return projectRoot;              // 显式指定时直接返回
  let dir = process.cwd();                          // 从当前工作目录开始
  for (let i = 0; i < 10; i++) {                    // 最多向上查找 10 层
    if (await fileExists(path.join(dir, '.qflow', 'qflow.config.json'))) return dir; // 找到配置文件即返回

    // P7-P2-2: 检查项目边界标记，如果当前目录有边界标记但没有 .qflow/，停止向上查找
    let hasBoundary = false; // 是否存在边界标记
    for (const marker of PROJECT_BOUNDARY_MARKERS) { // 遍历所有边界标记
      if (await fileExists(path.join(dir, marker))) { // 检测到边界标记
        hasBoundary = true; // 设置标记
        break; // 无需继续检查其他标记
      }
    }
    if (hasBoundary) break; // 到达项目边界但未找到 .qflow/，停止向上查找

    const parent = path.dirname(dir);               // 获取父目录
    if (parent === dir) break;                      // 到达文件系统根目录则停止
    dir = parent;
  }
  return null;                                      // 未找到 qflow 项目
}

/** 构造 MCP 错误响应 */
export function errResp(msg: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }] };
}

/** 构造 MCP JSON 响应 */
export function jsonResp(data: Record<string, unknown> | unknown[] | unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

/** 全局 ID 计数器，保证同毫秒内生成的 ID 也不会重复 */
let _idCounter = 0;

/**
 * 生成全局唯一 ID
 *
 * 组成结构：[前缀][时间戳毫秒]-[自增计数器]-[4位随机串]
 * 例如：task-1710000000000-0-a3f2
 *
 * @param prefix - 可选前缀字符串，用于区分不同业务场景
 * @returns 全局唯一字符串 ID
 */
export function uniqueId(prefix: string = ''): string {
  const ts = Date.now();                             // 当前时间戳（毫秒）
  const counter = _idCounter++;                      // 自增计数器，同毫秒内保证唯一
  const rand = Math.random().toString(36).slice(2, 6); // 4位随机字母数字串
  return `${prefix}${ts}-${counter}-${rand}`;        // 拼接最终唯一 ID
}

/**
 * v12.0: 校验文件路径是否在项目根目录内，防止路径穿越攻击
 *
 * 使用 path.resolve() 解析为绝对路径后，检查是否以根目录开头。
 * 穿越时抛出错误，阻止 ../../etc/passwd 等攻击路径。
 *
 * @param root - 项目根目录的绝对路径
 * @param filePath - 用户输入的文件路径（可以是相对路径）
 * @returns 解析后的安全绝对路径
 * @throws 路径穿越时抛出错误
 */
export function assertPathWithinRoot(root: string, filePath: string): string {
  const resolved = path.resolve(root, filePath); // 解析为绝对路径
  const normalizedRoot = path.resolve(root); // 标准化根路径
  if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) { // 不在根目录内且不是根目录本身
    throw new Error(`路径 "${filePath}" 超出项目根目录边界（${normalizedRoot}），已拒绝`); // 拒绝穿越路径
  }
  return resolved; // 返回安全的绝对路径
}

// ==================== v13.0 T-5: MCP 工具元数据注册表 ====================

/** 工具元数据 */
export interface ToolMeta {
  name: string; // 工具名称
  description: string; // 工具描述
  tier: string; // 所属层级（core/standard/extra/all/autopilot/review）
}

/** 全局工具元数据注册表 */
const toolRegistry = new Map<string, ToolMeta>(); // name → ToolMeta 映射

/**
 * v13.0 T-5: 注册工具元数据到全局注册表
 *
 * @param name - 工具名称
 * @param description - 工具描述
 * @param tier - 所属层级
 */
export function registerToolMeta(name: string, description: string, tier: string): void {
  toolRegistry.set(name, { name, description, tier }); // 写入注册表
}

/**
 * v13.0 T-5: 搜索已注册的 MCP 工具
 *
 * 在工具名称和描述中进行模糊匹配（大小写不敏感）。
 *
 * @param query - 搜索关键词
 * @param tierFilter - 可选的层级过滤
 * @returns 匹配的工具列表
 */
export function searchTools(query: string, tierFilter?: string): ToolMeta[] {
  const lowerQuery = query.toLowerCase(); // 搜索词小写化
  const results: ToolMeta[] = []; // 结果列表
  for (const meta of toolRegistry.values()) { // 遍历注册表
    if (tierFilter && meta.tier !== tierFilter) continue; // 层级过滤
    if (meta.name.toLowerCase().includes(lowerQuery) || meta.description.toLowerCase().includes(lowerQuery)) { // 名称或描述匹配
      results.push(meta); // 加入结果
    }
  }
  return results; // 返回匹配列表
}

/**
 * v13.0 T-5: 获取所有已注册工具的元数据列表
 *
 * @returns 所有工具元数据
 */
export function getAllToolMetas(): ToolMeta[] {
  return [...toolRegistry.values()]; // 返回注册表副本
}
