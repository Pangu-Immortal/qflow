/**
 * 工作流 Schema 管理器
 *
 * 管理 .qflow/schemas/ 目录下的自定义工作流 Schema。
 * 支持 CRUD 操作和校验，允许用户定义非线性工作流替代默认的
 * proposal->design->tasks->implementation 硬编码顺序。
 *
 * 数据目录: {projectRoot}/.qflow/schemas/{schemaId}.json
 *
 * 函数列表:
 * - initSchema()       创建新的工作流 Schema
 * - getSchema()        获取指定 Schema
 * - listSchemas()      列出所有可用 Schema
 * - validateSchema()   校验 Schema 定义合法性（含循环依赖检测）
 * - forkSchema()       复制（分叉）Schema，指定源 ID 和目标 ID
 * - getDefaultSchema() 获取默认工作流 Schema
 */

import path from 'node:path'; // 路径拼接工具
import { promises as fs } from 'node:fs'; // 异步文件操作
import {
  WorkflowSchemaDefinitionSchema,
  type WorkflowSchemaDefinition,
} from '../schemas/workflow-schema.js'; // 工作流 Schema Zod 定义和类型
import { readJSON, writeJSON, ensureDir, fileExists } from '../utils/file-io.js'; // 文件工具
import { QFLOW_DIR, sanitizeId } from '../shared/tool-utils.js'; // 目录常量 + ID 校验
import { log } from '../utils/logger.js'; // 日志工具

/** schemas 子目录名称 */
const SCHEMAS_DIR = 'schemas';

/**
 * 工作流 Schema 管理器
 *
 * 每个实例绑定一个项目根目录，操作该项目的 .qflow/schemas/ 目录。
 */
export class WorkflowSchemaManager {
  /** 项目根目录绝对路径 */
  private readonly projectRoot: string;

  /** schemas 目录路径 */
  private readonly schemasDir: string;

  /**
   * @param projectRoot - 项目根目录绝对路径
   */
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot; // 保存项目根路径
    this.schemasDir = path.join(projectRoot, QFLOW_DIR, SCHEMAS_DIR); // schemas 目录
  }

  /**
   * 创建新的工作流 Schema
   *
   * 校验 Schema 定义合法性后写入 .qflow/schemas/{schemaId}.json。
   *
   * @param definition - 工作流 Schema 定义
   * @returns 创建成功的 Schema 定义
   * @throws Schema 定义不合法或存在循环依赖时抛出错误
   */
  async initSchema(definition: WorkflowSchemaDefinition): Promise<WorkflowSchemaDefinition> {
    // 1. Zod 校验结构
    const parsed = WorkflowSchemaDefinitionSchema.safeParse(definition); // Zod 结构校验
    if (!parsed.success) { // 校验失败
      throw new Error(`工作流 Schema 格式错误: ${parsed.error.message}`); // 抛出详细错误
    }
    const schema = parsed.data; // 取出校验后的数据

    // 2. 校验 ID 安全性
    sanitizeId(schema.id, 'Schema ID'); // 防止路径遍历攻击

    // 3. 校验依赖合法性（循环依赖 + 引用不存在的产物）
    const validation = this.validateSchema(schema); // 执行逻辑校验
    if (!validation.valid) { // 校验不通过
      throw new Error(`工作流 Schema 校验失败:\n${validation.issues.join('\n')}`); // 抛出所有问题
    }

    // 4. 写入文件
    await ensureDir(this.schemasDir); // 确保 schemas 目录存在
    const filePath = path.join(this.schemasDir, `${schema.id}.json`); // 文件路径
    await writeJSON(filePath, schema); // 原子写入 JSON
    log.info(`工作流 Schema 已创建: ${schema.id} - ${schema.name}`); // 信息日志
    return schema; // 返回创建的 Schema
  }

  /**
   * 获取指定 Schema
   *
   * @param schemaId - Schema ID
   * @returns Schema 定义，未找到返回 null
   */
  async getSchema(schemaId: string): Promise<WorkflowSchemaDefinition | null> {
    sanitizeId(schemaId, 'Schema ID'); // 防止路径遍历攻击
    const filePath = path.join(this.schemasDir, `${schemaId}.json`); // 拼接文件路径
    const raw = await readJSON<unknown>(filePath); // 读取 JSON 文件
    if (raw === null) return null; // 文件不存在

    const parsed = WorkflowSchemaDefinitionSchema.safeParse(raw); // Zod 校验
    if (!parsed.success) { // 校验失败
      log.warn(`工作流 Schema ${schemaId} 格式异常: ${parsed.error.message}`); // 警告日志
      return null; // 返回 null
    }
    return parsed.data; // 返回校验后的 Schema
  }

  /**
   * 列出所有可用 Schema
   *
   * 遍历 schemas 目录下的 *.json 文件，逐个加载并返回摘要信息。
   *
   * @returns Schema 摘要列表（id, name, description, artifactCount）
   */
  async listSchemas(): Promise<Array<{
    id: string;              // Schema ID
    name: string;            // 显示名称
    description?: string;    // 描述
    artifactCount: number;   // 产物类型数量
  }>> {
    if (!(await fileExists(this.schemasDir))) return []; // 目录不存在，返回空列表

    const entries = await fs.readdir(this.schemasDir); // 读取目录内容
    const jsonFiles = entries.filter(e => e.endsWith('.json')); // 仅保留 JSON 文件

    const results: Array<{ id: string; name: string; description?: string; artifactCount: number }> = []; // 结果列表

    // 并行加载所有 Schema 文件
    const loaded = await Promise.all(
      jsonFiles.map(async (file) => {
        const schemaId = file.replace(/\.json$/, ''); // 从文件名提取 ID
        return this.getSchema(schemaId); // 加载 Schema
      })
    );

    for (const schema of loaded) { // 遍历加载结果
      if (schema) { // 非 null 的有效 Schema
        results.push({
          id: schema.id, // Schema ID
          name: schema.name, // 显示名称
          description: schema.description, // 描述（可选）
          artifactCount: schema.artifactTypes.length, // 产物类型数量
        });
      }
    }

    return results; // 返回摘要列表
  }

  /**
   * 校验 Schema 定义合法性
   *
   * 检查两类问题:
   * 1. 依赖目标不存在: dependencies 中引用了不在 artifactTypes 中的 ID
   * 2. 循环依赖: dependencies 图中存在环路
   *
   * @param definition - 待校验的 Schema 定义
   * @returns 校验结果，valid=true 表示合法
   */
  validateSchema(definition: WorkflowSchemaDefinition): { valid: boolean; issues: string[] } {
    const issues: string[] = []; // 问题列表
    const artifactIds = new Set(definition.artifactTypes.map(a => a.id)); // 所有产物 ID 集合

    // 1. 检查依赖目标是否都存在于 artifactTypes 中
    for (const [sourceId, depIds] of Object.entries(definition.dependencies)) { // 遍历依赖映射
      if (!artifactIds.has(sourceId)) { // 依赖源不在产物列表中
        issues.push(`依赖源 "${sourceId}" 不在 artifactTypes 中`); // 记录问题
      }
      for (const depId of depIds) { // 遍历依赖目标
        if (!artifactIds.has(depId)) { // 依赖目标不在产物列表中
          issues.push(`"${sourceId}" 依赖的 "${depId}" 不在 artifactTypes 中`); // 记录问题
        }
      }
    }

    // 2. 检查循环依赖（DFS 拓扑排序检测环路）
    const visited = new Set<string>(); // 已完全访问的节点
    const visiting = new Set<string>(); // 正在访问中的节点（灰色节点，用于检测环路）

    /**
     * DFS 检测环路
     * @param nodeId - 当前节点 ID
     * @returns true 表示检测到环路
     */
    const hasCycle = (nodeId: string): boolean => {
      if (visiting.has(nodeId)) return true; // 遇到灰色节点，存在环路
      if (visited.has(nodeId)) return false; // 已完全访问，无需重复检查

      visiting.add(nodeId); // 标记为正在访问
      const deps = definition.dependencies[nodeId] || []; // 获取该节点的依赖
      for (const depId of deps) { // 遍历依赖
        if (hasCycle(depId)) return true; // 递归检测，发现环路立即返回
      }
      visiting.delete(nodeId); // 移出灰色集合
      visited.add(nodeId); // 标记为已完全访问
      return false; // 无环路
    };

    for (const artifactId of artifactIds) { // 对每个产物 ID 执行 DFS
      if (hasCycle(artifactId)) { // 检测到环路
        issues.push(`检测到循环依赖（涉及 "${artifactId}"）`); // 记录问题
        break; // 只报告一次循环依赖即可
      }
    }

    log.debug(`工作流 Schema 校验: ${issues.length} 个问题`); // 调试日志
    return { valid: issues.length === 0, issues }; // 返回校验结果
  }

  /**
   * 按 ID 校验已保存的 Schema 合法性
   *
   * 从磁盘加载指定 Schema 后执行校验，检查依赖合法性和循环依赖。
   * 这是 validateSchema(definition) 的便捷封装，接受 schemaId 字符串。
   *
   * @param schemaId - 要校验的 Schema ID
   * @returns 校验结果，valid=true 表示合法；schema 未找到时返回 valid=false
   */
  async validateSchemaById(schemaId: string): Promise<{ valid: boolean; issues: string[] }> {
    const schema = await this.getSchema(schemaId); // 从磁盘加载 Schema
    if (!schema) { // Schema 不存在
      return { valid: false, issues: [`Schema "${schemaId}" 不存在`] }; // 返回错误
    }
    return this.validateSchema(schema); // 委托给已有的校验方法
  }

  /**
   * 复制（分叉）一个已有的工作流 Schema
   *
   * 读取源 Schema 的 JSON 文件，将 id 和 name 字段替换为目标值后，
   * 写入为新的 Schema 文件。新 Schema 继承源的所有配置（产物类型、依赖等）。
   *
   * @param sourceId - 源 Schema ID（必须已存在）
   * @param targetId - 目标 Schema ID（必须不存在）
   * @returns 新创建的 Schema 定义
   * @throws 源 Schema 不存在时抛出错误
   * @throws 目标 Schema ID 已存在时抛出错误
   */
  async forkSchema(sourceId: string, targetId: string): Promise<WorkflowSchemaDefinition> {
    // 1. 校验 ID 安全性（防止路径遍历攻击）
    sanitizeId(sourceId, 'Source Schema ID'); // 校验源 ID
    sanitizeId(targetId, 'Target Schema ID'); // 校验目标 ID

    // 2. 读取源 Schema JSON 文件
    const sourceFilePath = path.join(this.schemasDir, `${sourceId}.json`); // 源文件路径
    const sourceRaw = await readJSON<Record<string, unknown>>(sourceFilePath); // 读取源文件
    if (sourceRaw === null) { // 源文件不存在
      throw new Error(`源工作流 Schema "${sourceId}" 不存在，无法分叉`); // 抛出错误
    }
    log.debug(`forkSchema: 源 Schema "${sourceId}" 读取成功`); // 调试日志

    // 3. 检查目标 ID 是否已被占用
    const targetFilePath = path.join(this.schemasDir, `${targetId}.json`); // 目标文件路径
    if (await fileExists(targetFilePath)) { // 目标文件已存在
      throw new Error(`目标 Schema ID "${targetId}" 已存在，请使用其他 ID`); // 抛出冲突错误
    }

    // 4. 修改 id 和 name 字段为目标值
    const forkedRaw = { ...sourceRaw }; // 浅拷贝源 JSON
    forkedRaw['id'] = targetId; // 替换 ID 字段
    forkedRaw['name'] = targetId; // 替换 name 字段（使用 targetId 作为名称）
    forkedRaw['description'] = `从 "${sourceId}" 分叉而来`; // 标注来源描述

    // 5. 用 Zod 校验分叉后的 Schema 合法性
    const parsed = WorkflowSchemaDefinitionSchema.safeParse(forkedRaw); // Zod 结构校验
    if (!parsed.success) { // 校验失败
      throw new Error(`分叉后的 Schema 格式错误: ${parsed.error.message}`); // 抛出错误
    }

    // 6. 写入目标文件
    await ensureDir(this.schemasDir); // 确保 schemas 目录存在
    await writeJSON(targetFilePath, parsed.data); // 原子写入新文件
    log.info(`forkSchema: Schema "${sourceId}" 已分叉为 "${targetId}"`); // 信息日志

    return parsed.data; // 返回新创建的 Schema
  }

  /**
   * 获取默认工作流 Schema
   *
   * 返回硬编码的默认工作流: proposal -> design -> tasks -> implementation。
   * 当项目未配置自定义 Schema 时使用此默认流程。
   *
   * @returns 默认工作流 Schema 定义
   */
  getDefaultSchema(): WorkflowSchemaDefinition {
    return {
      id: 'default', // 默认 Schema ID
      name: '默认工作流', // 显示名称
      description: '标准四阶段工作流: 提案 → 设计 → 任务分解 → 实现', // 描述
      artifactTypes: [
        { id: 'proposal', name: '提案', required: true }, // 提案阶段
        { id: 'design', name: '设计', required: true }, // 设计阶段
        { id: 'tasks', name: '任务分解', required: true }, // 任务分解阶段
        { id: 'implementation', name: '实现', required: true }, // 实现阶段
      ],
      dependencies: { // 线性依赖链
        design: ['proposal'], // 设计依赖提案
        tasks: ['design'], // 任务分解依赖设计
        implementation: ['tasks'], // 实现依赖任务分解
      },
    };
  }
}
