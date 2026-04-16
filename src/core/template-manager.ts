/**
 * 模板管理器 - Spec/Task/Workflow 模板管理
 *
 * 管理模板的创建、应用、列出。支持 {{variable}} 变量替换。
 * 数据目录: {projectRoot}/.qflow/templates/{templateId}.json
 *
 * 函数列表:
 * - createTemplate() 创建模板
 * - applyTemplate()  应用模板（变量替换）
 * - getTemplate()    获取模板
 * - listTemplates()  列出所有模板
 * - deleteTemplate() 删除模板
 */

import path from 'node:path'; // 路径拼接工具
import { promises as fs } from 'node:fs'; // 异步文件操作
import { readJSONSafe, writeJSON, ensureDir, fileExists } from '../utils/file-io.js'; // 文件读写工具
import { log } from '../utils/logger.js'; // 日志工具
import { TemplateSchema } from '../schemas/template.js'; // 模板 Zod Schema
import { uniqueId, QFLOW_DIR } from '../shared/tool-utils.js'; // 全局唯一 ID 生成工具 + .qflow 目录常量

/** 模板数据目录 */
const TEMPLATES_DIR = 'templates'; // 模板文件目录

/** 模板类型 */
export type TemplateType = 'spec' | 'task' | 'workflow'; // 三种模板类型

/** 模板变量定义 */
export interface TemplateVariable {
  name: string; // 变量名（对应 {{name}} 占位符）
  description: string; // 变量描述
  required: boolean; // 是否必填
  defaultValue?: string; // 默认值（可选）
}

/** 模板对象 */
export interface Template {
  id: string; // 模板唯一 ID，格式: TPL{timestamp}
  name: string; // 模板名称
  type: TemplateType; // 模板类型
  description: string; // 模板描述
  content: string; // 模板内容（包含 {{variable}} 占位符）
  variables: TemplateVariable[]; // 变量定义列表
  createdAt: string; // 创建时间
  updatedAt: string; // 更新时间
}

/** 变量替换匹配正则 */
const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g; // 匹配 {{varName}} 格式

/**
 * 模板管理器类
 *
 * 每个实例绑定一个项目根目录，操作该项目的模板数据。
 */
export class TemplateManager {
  /** 项目根目录绝对路径 */
  private readonly projectRoot: string;

  /** 模板目录路径 */
  private readonly templatesDir: string;

  /**
   * @param projectRoot - 项目根目录绝对路径
   */
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot; // 保存项目根路径
    this.templatesDir = path.join(projectRoot, QFLOW_DIR, TEMPLATES_DIR); // 拼接模板目录路径
  }

  /**
   * 创建模板
   *
   * @param name        - 模板名称
   * @param type        - 模板类型
   * @param description - 模板描述
   * @param content     - 模板内容（含 {{variable}} 占位符）
   * @param variables   - 变量定义列表
   * @returns 新创建的模板对象
   */
  async createTemplate(
    name: string,
    type: TemplateType,
    description: string,
    content: string,
    variables: TemplateVariable[],
  ): Promise<Template> {
    const templateId = uniqueId('TPL'); // 生成全局唯一模板 ID（防止碰撞）
    const now = new Date().toISOString(); // 当前时间戳

    // 校验：content 中的变量占位符必须在 variables 中有定义
    const contentVars = new Set<string>(); // 内容中出现的变量名集合
    let match: RegExpExecArray | null; // 正则匹配结果
    const regex = new RegExp(VARIABLE_PATTERN.source, 'g'); // 重新创建正则避免 lastIndex 问题
    while ((match = regex.exec(content)) !== null) { // 逐个匹配
      contentVars.add(match[1]); // 收集变量名
    }

    const definedVars = new Set(variables.map((v) => v.name)); // 已定义的变量名集合
    for (const varName of contentVars) { // 检查每个内容变量
      if (!definedVars.has(varName)) { // 未定义
        log.warn(`模板内容中引用了未定义的变量 {{${varName}}}，已自动添加为非必填`); // 警告
        variables.push({ name: varName, description: '自动检测', required: false }); // 自动添加
      }
    }

    const template: Template = { // 构造模板对象
      id: templateId, // 唯一标识
      name, // 名称
      type, // 类型
      description, // 描述
      content, // 内容
      variables, // 变量定义
      createdAt: now, // 创建时间
      updatedAt: now, // 更新时间
    };

    await ensureDir(this.templatesDir); // 确保目录存在
    await writeJSON(path.join(this.templatesDir, `${templateId}.json`), template); // 写入文件
    log.info(`模板已创建: ${templateId} - ${name} (${type})`); // 信息日志
    return template; // 返回新模板
  }

  /**
   * 应用模板（变量替换）
   *
   * 将模板中的 {{varName}} 替换为传入的 values。
   * 必填变量未提供时报错。
   *
   * @param templateId - 模板 ID
   * @param values     - 变量值映射: { varName: value }
   * @returns 替换后的内容字符串
   */
  async applyTemplate(templateId: string, values: Record<string, string>): Promise<string> {
    const template = await this.getTemplate(templateId); // 获取模板
    if (!template) throw new Error(`模板 ${templateId} 不存在`); // 校验存在

    // 检查必填变量是否全部提供
    const missingRequired: string[] = []; // 缺失的必填变量
    for (const variable of template.variables) { // 遍历变量定义
      if (variable.required && !(variable.name in values)) { // 必填且未提供
        if (variable.defaultValue === undefined) { // 无默认值
          missingRequired.push(variable.name); // 记录缺失
        }
      }
    }

    if (missingRequired.length > 0) { // 有缺失的必填变量
      throw new Error(`模板 ${templateId} 缺少必填变量: ${missingRequired.join(', ')}`); // 抛出错误
    }

    // 构建完整的值映射（含默认值）
    const fullValues: Record<string, string> = {}; // 完整值映射
    for (const variable of template.variables) { // 遍历变量定义
      if (variable.name in values) { // 用户提供了值
        fullValues[variable.name] = values[variable.name]; // 使用用户值
      } else if (variable.defaultValue !== undefined) { // 有默认值
        fullValues[variable.name] = variable.defaultValue; // 使用默认值
      }
    }

    // 执行变量替换
    const result = template.content.replace( // 正则替换
      VARIABLE_PATTERN, // 匹配 {{varName}}
      (_match, varName: string) => { // 替换函数
        if (varName in fullValues) { // 有对应值
          return fullValues[varName]; // 替换为值
        }
        return `{{${varName}}}`; // 无对应值，保留原样
      },
    );

    log.info(`模板 ${templateId} 已应用，替换了 ${Object.keys(fullValues).length} 个变量`); // 信息日志
    return result; // 返回替换后的内容
  }

  /**
   * 获取模板
   *
   * @param templateId - 模板 ID
   * @returns 模板对象，未找到返回 null
   */
  async getTemplate(templateId: string): Promise<Template | null> {
    const safeId = templateId.replace(/[^a-zA-Z0-9._-]/g, ''); // 清洗 templateId 防止路径遍历
    const filePath = path.join(this.templatesDir, `${safeId}.json`); // 拼接文件路径（使用清洗后的 ID）
    return readJSONSafe(filePath, TemplateSchema); // 读取并校验后返回
  }

  /**
   * 列出所有模板
   *
   * @param filter - 可选过滤条件
   * @returns 模板列表
   */
  async listTemplates(filter?: { type?: TemplateType }): Promise<Template[]> {
    if (!(await fileExists(this.templatesDir))) return []; // 目录不存在返回空

    const entries = await fs.readdir(this.templatesDir); // 读取目录内容
    const templates: Template[] = []; // 结果列表

    for (const entry of entries) { // 遍历每个文件
      if (!entry.endsWith('.json')) continue; // 跳过非 JSON
      const template = await readJSONSafe(path.join(this.templatesDir, entry), TemplateSchema); // 读取并校验模板
      if (!template) continue; // 读取失败跳过

      if (filter?.type && template.type !== filter.type) continue; // 类型不匹配

      templates.push(template); // 追加到结果
    }

    return templates.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // 按创建时间降序
  }

  /**
   * 删除模板
   *
   * @param templateId - 模板 ID
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const safeId = templateId.replace(/[^a-zA-Z0-9._-]/g, ''); // 清洗 templateId 防止路径遍历
    const filePath = path.join(this.templatesDir, `${safeId}.json`); // 拼接文件路径（使用清洗后的 ID）
    if (!(await fileExists(filePath))) { // 文件不存在
      throw new Error(`模板 ${templateId} 不存在`); // 抛出错误
    }

    await fs.unlink(filePath); // 删除文件
    log.info(`模板已删除: ${templateId}`); // 信息日志
  }
}
