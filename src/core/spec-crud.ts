/**
 * SpecCrud - Spec 基础 CRUD 操作子模块
 *
 * 职责：Spec 的增删查和状态统计
 * 子模块函数列表:
 * - initSpec()          创建新 Spec（含 JSON 元数据和 Markdown 正文）
 * - getSpec()           按 ID 获取 Spec
 * - listSpecs()         列出所有 Spec
 * - getStatus()         获取 Spec 系统状态统计
 * - loadProjectContext() 加载 .qflow/project.md 项目上下文
 *
 * 依赖注入：
 * - loadConfig?: (root: string) => Promise<any>  从外部注入配置加载函数（SM-8: 消除动态 import）
 */

import path from 'node:path'; // 路径拼接工具
import { promises as fs } from 'node:fs'; // 异步文件操作
import { type Spec, SpecSchema } from '../schemas/spec.js'; // Spec schema 和类型
import { readJSON, writeJSON, ensureDir, fileExists, withFileLock } from '../utils/file-io.js'; // 文件工具 + 文件锁
import { log } from '../utils/logger.js'; // 日志工具
import { uniqueId, QFLOW_DIR, sanitizeId } from '../shared/tool-utils.js'; // 工具函数
import { SPEC_ID_PAD_WIDTH } from '../shared/constants.js'; // v16.0 Q-2: Spec ID 补零宽度常量
import { WorkflowSchemaManager } from './workflow-schema-manager.js'; // 工作流 Schema 管理器（v11.0）

/**
 * 将字符串转为 kebab-case 格式
 * @param str - 输入字符串
 * @returns kebab-case 格式的字符串
 */
export function toKebabCase(str: string): string {
  return str
    .toLowerCase() // 转小写
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-') // 非字母数字和中文替换为连字符
    .replace(/^-|-$/g, ''); // 去除首尾连字符
}

/**
 * SpecCrud 类 - 处理 Spec 的基础 CRUD 和状态统计
 *
 * 每个实例绑定一个项目根目录，操作该项目的 specs 和 changes 目录。
 */
export class SpecCrud {
  /** specs 目录路径 */
  readonly specsDir: string;

  /** changes 目录路径 */
  readonly changesDir: string;

  /**
   * @param projectRoot - 项目根目录绝对路径
   * @param loadConfig  - 可选的配置加载函数（SM-8: 依赖注入，避免动态 import）
   */
  constructor(
    readonly projectRoot: string,
    private loadConfig?: (root: string) => Promise<any>, // 配置加载函数（可注入）
  ) {
    this.specsDir = path.join(projectRoot, QFLOW_DIR, 'specs'); // specs 目录
    this.changesDir = path.join(projectRoot, QFLOW_DIR, 'changes'); // changes 目录
  }

  /**
   * 创建新 Spec
   *
   * ID 格式: S{四位数}-{name kebab case}，如 S0001-auth-api。
   * 写入 specs/{id}/spec.json（元数据）和 specs/{id}/spec.md（正文内容）。
   *
   * @param name        - Spec 名称
   * @param type        - Spec 类型（architecture/api/ui/data/algorithm）
   * @param description - Spec 描述，作为初始正文内容
   * @param schemaId    - 可选的工作流 Schema ID，关联自定义工作流
   * @returns 新创建的 Spec 对象
   */
  async initSpec(name: string, type: Spec['type'], description: string, schemaId?: string): Promise<Spec> {
    const existingSpecs = await this.listSpecs(); // 获取已有 Spec 列表
    let maxNum = 0; // 已有 Spec 中的最大编号
    for (const s of existingSpecs) {
      const match = s.id.match(/^S(\d+)-/); // 提取编号（兼容 3 位和 4 位格式）
      if (match) maxNum = Math.max(maxNum, parseInt(match[1])); // 取最大编号
    }
    const nextNum = maxNum + 1; // 最大编号 + 1，避免删除后 ID 碰撞
    if (nextNum > 9999) {
      throw new Error('Spec ID 已超出最大限制 9999'); // v21.0: 溢出保护，防止超过 4 位编号上限
    }
    const numStr = String(nextNum).padStart(SPEC_ID_PAD_WIDTH, '0'); // v16.0 Q-2: 使用常量控制补零宽度
    const kebab = toKebabCase(name); // 名称转 kebab-case
    const id = `S${numStr}-${kebab}`; // 拼接 Spec ID

    // v11.0: 构建最终描述内容
    let resolvedDescription = description; // 最终使用的描述内容

    // v11.0 P1-8: 空描述时生成结构化 4 段式 Markdown 模板
    if (!resolvedDescription.trim()) {
      resolvedDescription = [
        '## Purpose',
        '[描述此 Spec 的目标和背景]',
        '',
        '## Out of Scope',
        '<!-- 明确列出不在本 Spec 范围内的内容，防止范围蔓延 -->',
        '',
        '## Requirements',
        '[使用 RFC 2119 关键词定义需求]',
        '- MUST: ',
        '- SHOULD: ',
        '- MAY: ',
        '',
        '## Design',
        '[技术设计方案]',
        '',
        '## Scenarios',
        '[验收场景]',
        '- GIVEN: ',
        '- WHEN: ',
        '- THEN: ',
      ].join('\n'); // 生成结构化模板
    }

    // v11.0 P1-10: 检查 per-artifact 模板目录（按 Spec 类型查找自定义模板）
    try {
      const artifactTemplatePath = path.join(this.projectRoot, QFLOW_DIR, 'templates', 'spec', `${type}.md`); // 按 Spec 类型查找模板
      if (await fileExists(artifactTemplatePath)) {
        const templateContent = await fs.readFile(artifactTemplatePath, 'utf-8'); // 读取自定义模板
        if (templateContent.trim()) {
          resolvedDescription = templateContent; // 使用自定义模板替代默认内容
          log.info(`使用自定义 Spec 模板: ${artifactTemplatePath}`); // 记录使用情况
        }
      }
    } catch (e) {
      log.debug(`Spec 模板查找失败: ${(e as Error).message}`); // 模板不存在时静默跳过
    }

    // v11.0 P1-9: 注入全局 specContext（SM-8: 优先使用注入的 loadConfig，回退到动态 import）
    try {
      let loadConfigFn = this.loadConfig; // 优先使用构造函数注入的配置加载函数
      if (!loadConfigFn) {
        // 回退到动态 import（保持向后兼容）
        const mod = await import('./config-manager.js');
        loadConfigFn = mod.loadConfig;
      }
      const config = await loadConfigFn(this.projectRoot); // 加载项目配置
      if (config?.specContext) { // v12.0 S-5: 消除 as any，直接使用类型安全的 specContext 字段访问
        resolvedDescription = `> ${config.specContext}\n\n${resolvedDescription}`; // 在描述开头注入全局上下文
        log.info('已注入 Spec 全局上下文（specContext）'); // 记录注入
      }
    } catch (e) {
      log.debug(`specContext 注入跳过: ${(e as Error).message}`); // 配置加载失败时静默跳过
    }

    // v11.0: 如果指定了 schemaId，校验其存在性并加载模板
    if (schemaId) {
      const wsm = new WorkflowSchemaManager(this.projectRoot); // 创建工作流 Schema 管理器
      const schema = await wsm.getSchema(schemaId); // 加载指定的工作流 Schema
      if (!schema) {
        log.warn(`工作流 Schema "${schemaId}" 不存在，将忽略 schemaId`); // 警告但不阻塞
        schemaId = undefined; // 清除无效的 schemaId
      } else {
        log.info(`Spec 关联工作流 Schema: ${schemaId} (${schema.name})`); // 记录关联信息
        // 如果 description 为空且 Schema 的产物类型有模板，使用模板内容
        if (!description.trim() && schema.artifactTypes.length > 0) {
          const templateParts = schema.artifactTypes.map(at => `## ${at.name}\n\n### 概述\n\n请补充 ${at.name} 的详细说明。\n\n### 实现要点\n\n- [ ] 请列出关键实现步骤\n\n### 验收标准\n\n- [ ] 请列出验收条件`); // 按产物类型生成结构化模板章节
          resolvedDescription = templateParts.join('\n\n'); // 拼接模板内容
        }
        // 注入项目级上下文
        if (schema.context) {
          resolvedDescription = `> 项目上下文: ${schema.context}\n\n${resolvedDescription}`; // 在描述开头插入上下文
        }
      }
    }

    const now = new Date().toISOString(); // 当前时间戳
    const spec: Spec = { // 构造 Spec 对象
      id, // 唯一标识
      name, // 名称
      type, // 类型
      status: 'draft', // 初始状态：草稿
      content: resolvedDescription, // 正文内容（可能经过模板增强）
      dependencies: [], // 依赖列表
      targetFiles: [], // 关联文件
      taskIds: [], // 关联任务
      requires: [], // v12.0: DAG 依赖声明（初始为空）
      rigor: 'full', // v12.0: 验证严格度（默认 full）
      designSeparated: false, // v13.0 E-4: Design 段未分离
      createdAt: now, // 创建时间
      updatedAt: now, // 更新时间
      version: 1, // 初始版本号
      ...(schemaId ? { workflowSchemaId: schemaId } : {}), // v11.0: 可选的工作流 Schema ID
    };

    const specDir = path.join(this.specsDir, id); // Spec 目录路径
    await ensureDir(specDir); // 确保目录存在
    await writeJSON(path.join(specDir, 'spec.json'), spec); // 写入 JSON 元数据
    await withFileLock(path.join(specDir, 'spec.md'), async () => { // v14.0 L-2: Markdown 写入加锁
      await fs.writeFile(path.join(specDir, 'spec.md'), resolvedDescription, 'utf-8'); // 写入 Markdown 正文（使用最终描述）
    });
    log.info(`Spec 已创建: ${id} - ${name}`); // 信息日志
    return spec; // 返回新 Spec
  }

  /**
   * 按 ID 获取 Spec
   *
   * @param specId - Spec ID
   * @returns Spec 对象，未找到返回 null
   */
  async getSpec(specId: string): Promise<Spec | null> {
    sanitizeId(specId, 'Spec ID'); // 防止路径遍历攻击
    const specPath = path.join(this.specsDir, specId, 'spec.json'); // 拼接路径
    const raw = await readJSON<unknown>(specPath); // 读取 JSON
    if (raw === null) return null; // 文件不存在

    const parsed = SpecSchema.safeParse(raw); // Zod 校验
    if (!parsed.success) { // 校验失败
      log.warn(`Spec ${specId} 格式异常: ${parsed.error.message}`); // 警告日志
      return null; // 返回 null
    }
    return parsed.data; // 返回校验后的 Spec
  }

  /**
   * 列出所有 Spec
   *
   * 遍历 specs 目录下的子目录，逐个加载 spec.json。
   *
   * @returns 所有 Spec 对象的列表
   */
  async listSpecs(): Promise<Spec[]> {
    if (!(await fileExists(this.specsDir))) return []; // 目录不存在，返回空

    const entries = await fs.readdir(this.specsDir, { withFileTypes: true }); // 读取目录内容
    const dirs = entries.filter(e => e.isDirectory()); // 仅保留目录

    // P3: N+1→Promise.all 并行读取（O(n)顺序→O(1)并发延迟）
    const results = await Promise.all(
      dirs.map(entry => this.getSpec(entry.name)) // 并行加载所有 Spec
    );

    return results.filter((spec): spec is Spec => spec !== null); // 过滤 null
  }

  /**
   * 获取 Spec 系统状态统计
   *
   * @returns Spec 总数、pending 变更数、applied 变更数
   */
  async getStatus(): Promise<{ specs: number; pendingChanges: number; appliedChanges: number }> {
    const specs = await this.listSpecs(); // 获取所有 Spec

    // P7-P2-1: 统计 pending 变更数（支持 Folder 格式和旧版单文件格式）
    const countChanges = async (dir: string): Promise<number> => {
      if (!(await fileExists(dir))) return 0; // 目录不存在
      const entries = await fs.readdir(dir, { withFileTypes: true }); // 读取目录内容
      let count = 0;
      for (const entry of entries) {
        if (entry.isDirectory() && await fileExists(path.join(dir, entry.name, 'change.json'))) {
          count++; // Folder 格式：包含 change.json 的目录算一个变更
        } else if (entry.isFile() && entry.name.endsWith('.json')) {
          count++; // 旧版单文件格式
        }
      }
      return count;
    };

    const pendingChanges = await countChanges(path.join(this.changesDir, 'pending')); // pending 变更数
    const appliedChanges = await countChanges(path.join(this.changesDir, 'applied')); // applied 变更数

    return { specs: specs.length, pendingChanges, appliedChanges }; // 返回统计
  }

  /**
   * 加载项目上下文文件
   *
   * 读取 .qflow/project.md 内容作为项目级上下文，
   * 用于注入 Spec 创建和 AI 调用等场景。
   *
   * @returns project.md 内容字符串，文件不存在则返回 null
   */
  async loadProjectContext(): Promise<string | null> {
    const projectMdPath = path.join(this.projectRoot, QFLOW_DIR, 'project.md'); // 项目上下文文件路径
    try {
      if (await fileExists(projectMdPath)) { // 文件存在
        const content = await fs.readFile(projectMdPath, 'utf-8'); // 读取文件内容
        log.debug(`已加载项目上下文: ${projectMdPath} (${content.length} 字符)`); // 调试日志
        return content.trim() || null; // 空内容视为不存在
      }
      log.debug('项目上下文文件不存在: project.md'); // 调试日志
      return null; // 文件不存在
    } catch (e) {
      log.warn(`项目上下文加载失败: ${(e as Error).message}`); // 警告日志
      return null; // 读取失败返回 null
    }
  }

  /** v22.0 P2-8: 导出 Spec 为独立 Markdown 文件 */
  async exportSpecAsMarkdown(specId: string): Promise<string> {
    const spec = await this.getSpec(specId); // 获取 Spec 元数据
    if (!spec) throw new Error(`Spec ${specId} 不存在`);
    const mdPath = path.join(this.specsDir, specId, 'spec.md'); // Markdown 文件路径
    let content = '';
    try {
      const { promises: fsp } = await import('node:fs');
      content = await fsp.readFile(mdPath, 'utf-8'); // 读取 Spec 内容
    } catch {
      content = spec.content || '（无内容）'; // 降级到 JSON 中的 content 字段
    }
    const lines = [
      `# ${spec.name}`,
      '',
      `> **ID**: ${spec.id} | **类型**: ${spec.type} | **状态**: ${spec.status}`,
      `> **创建**: ${spec.createdAt} | **更新**: ${spec.updatedAt}`,
      '',
      `## 内容`,
      content,
    ];
    return lines.join('\n');
  }
}
