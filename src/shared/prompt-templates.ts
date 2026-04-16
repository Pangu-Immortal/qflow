/**
 * Prompt 模板系统 - 加载、渲染和选择 AI 提示词模板
 *
 * 从 data/prompts/ 目录加载 JSON 格式的 Prompt 模板，
 * 支持 {{变量}} 占位符替换和条件变体选择。
 *
 * 函数列表：
 *   - getModulesDir():  获取 data/prompts/ 目录的绝对路径
 *   - loadPromptTemplate(templatePath): 从文件加载 Prompt 模板 JSON
 *   - renderPrompt(template, variables): 将 {{varName}} 替换为实际值
 *   - selectVariant(template, context): 根据上下文条件选择模板变体
 */

import path from 'node:path'; // 路径处理工具
import { fileURLToPath } from 'node:url'; // ESM 环境下获取当前文件路径
import { readJSON } from '../utils/file-io.js'; // JSON 读取工具
import { log } from '../utils/logger.js'; // 日志工具

/** 单个 Prompt 变体结构（含可选 condition） */
export interface PromptVariant {
  condition?: string; // 选择条件描述（如 "expansionPrompt exists"）
  system: string;     // 系统提示词
  user: string;       // 用户提示词
}

/** Prompt 模板 JSON 文件的完整结构 */
export interface PromptTemplate {
  id: string;                                    // 模板唯一标识
  description: string;                           // 模板描述
  parameters: Record<string, string>;            // 参数说明映射
  prompts: Record<string, PromptVariant>;        // 变体集合，key 为变体名
}

/** 变量替换映射表类型 */
export type PromptVariables = Record<string, string | number>;

/**
 * 获取 data/prompts/ 目录的绝对路径
 *
 * 运行时从 dist/shared/ 出发，需要回退两级到项目根，再进入 data/prompts/。
 *
 * @returns data/prompts/ 的绝对路径
 */
function getModulesDir(): string {
  const currentFile = fileURLToPath(import.meta.url); // 当前文件绝对路径（dist/shared/prompt-templates.js）
  return path.resolve(path.dirname(currentFile), '..', '..', 'data', 'prompts'); // 向上两级到项目根目录
}

/**
 * 从文件加载 Prompt 模板
 *
 * @param templatePath - 模板文件名（不含目录前缀），如 "analyze-complexity.json"
 * @returns 解析后的模板对象，加载失败返回 null
 */
export async function loadPromptTemplate(templatePath: string): Promise<PromptTemplate | null> {
  const fullPath = path.join(getModulesDir(), templatePath); // 拼接完整路径
  log.debug(`加载 Prompt 模板: ${fullPath}`); // 调试日志

  const template = await readJSON<PromptTemplate>(fullPath); // 读取并解析 JSON
  if (!template) { // 文件不存在或解析失败
    log.warn(`Prompt 模板未找到: ${fullPath}`); // 警告日志
    return null; // 返回 null
  }

  // 基本结构校验：检查必要字段是否存在
  if (!template.id || typeof template.id !== 'string') { // id 字段缺失或类型错误
    log.warn(`Prompt 模板结构校验失败: 缺少 id 字段，文件: ${fullPath}`); // 警告日志
    return null; // 返回 null
  }
  if (!template.prompts || typeof template.prompts !== 'object' || Array.isArray(template.prompts)) { // prompts 字段缺失或类型错误
    log.warn(`Prompt 模板结构校验失败: 缺少 prompts 字段，模板: ${template.id}，文件: ${fullPath}`); // 警告日志
    return null; // 返回 null
  }

  log.debug(`Prompt 模板已加载: ${template.id}，变体数: ${Object.keys(template.prompts).length}`); // 调试日志
  return template; // 返回模板对象
}

/**
 * 将模板中的 {{varName}} 占位符替换为实际值
 *
 * 遍历 variables 中的所有键值对，将模板字符串中匹配的 {{key}} 替换为对应值。
 * 未匹配的占位符保留原样（不会报错）。
 *
 * @param template - 包含 {{varName}} 占位符的模板字符串
 * @param variables - 变量名到值的映射
 * @returns 替换后的字符串
 */
export function renderPrompt(template: string, variables: PromptVariables): string {
  let result = template; // 拷贝模板字符串

  // 第一步：处理 {{#if varName}}...{{/if}} 条件块
  // 变量存在且非空时保留块内容，否则移除整个块（含换行符）
  result = result.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match: string, varName: string, content: string) => {
      const value = variables[varName];
      return (value !== undefined && value !== '' && value !== null) ? content : ''; // 变量有值时保留块内容，否则清空
    }
  );

  // 第二步：简单 {{key}} 占位符替换
  for (const [key, value] of Object.entries(variables)) { // 遍历所有变量
    const placeholder = `{{${key}}}`; // 构建占位符模式
    result = result.split(placeholder).join(String(value)); // 全局替换
  }
  return result; // 返回替换后的结果
}

/**
 * 根据上下文条件选择合适的模板变体
 *
 * 选择逻辑：
 * 1. 遍历所有非 "default" 的变体
 * 2. 检查变体的 condition 中提到的变量是否在 context 中存在且非空
 * 3. 第一个匹配的变体被选中
 * 4. 无匹配时 fallback 到 "default" 变体
 *
 * @param template - Prompt 模板对象
 * @param context - 上下文变量映射（用于条件判断）
 * @returns 选中的变体对象
 */
export function selectVariant(template: PromptTemplate, context: PromptVariables): PromptVariant {
  const prompts = template.prompts; // 取出所有变体

  // 遍历非 default 变体，检查条件
  for (const [name, variant] of Object.entries(prompts)) {
    if (name === 'default') continue; // 跳过默认变体
    if (!variant.condition) continue; // 无条件的非 default 变体也跳过

    // 简单条件解析：condition 格式为 "varName exists"
    const match = variant.condition.match(/^(\w+)\s+exists$/); // 匹配 "xxx exists" 模式
    if (match) { // 匹配成功
      const varName = match[1]; // 提取变量名
      const value = context[varName]; // 查找上下文中的值
      if (value !== undefined && value !== '' && value !== null) { // 变量存在且非空
        log.debug(`选择 Prompt 变体: ${name}（条件: ${variant.condition}）`); // 调试日志
        return variant; // 返回匹配的变体
      }
    }
  }

  // fallback 到 default
  const defaultVariant = prompts['default']; // 取默认变体
  if (defaultVariant) { // 默认变体存在
    log.debug('选择 Prompt 变体: default'); // 调试日志
    return defaultVariant; // 返回默认变体
  }

  // 极端情况：连 default 都没有，取第一个变体
  const firstKey = Object.keys(prompts)[0]; // 取第一个 key
  log.warn(`Prompt 模板 ${template.id} 没有 default 变体，使用: ${firstKey}`); // 警告日志
  return prompts[firstKey]; // 返回第一个变体
}
