/**
 * 动态指令装配器 - 运行时组装 AI 调用指令
 *
 * 根据任务上下文自动组装 Context（项目信息）+ Rules（约束规则）+ Templates（Prompt 模板），
 * 输出完整的 AI 调用指令字符串。
 *
 * 函数列表:
 * - assembleContext()   加载项目上下文 + 任务上下文 + 活跃 Spec 摘要
 * - assembleRules()     根据 AI 角色加载对应规则
 * - assembleTemplates() 根据操作类型选择 Prompt 模板
 * - assemble()          组合 Context+Rules+Templates 输出完整指令
 */

import path from 'node:path'; // 路径拼接工具
import { promises as fs } from 'node:fs'; // 异步文件操作
import { log } from '../utils/logger.js'; // 日志工具
import { QFLOW_DIR } from '../shared/tool-utils.js'; // .qflow 目录常量
import { fileExists } from '../utils/file-io.js'; // 文件存在检查
import { MAX_CONTEXT_LENGTH, MAX_RULES_LENGTH, MAX_TEMPLATE_LENGTH } from '../shared/constants.js'; // 长度限制常量

/** 指令装配选项 */
export interface AssembleOptions {
  taskId?: string;       // 任务 ID（用于加载任务上下文）
  role?: string;         // AI 角色（main/research/fallback）
  action?: string;       // 操作类型（expand/research/generate/verify）
  includeSpecs?: boolean; // 是否包含活跃 Spec 摘要
}

/** 装配结果 */
export interface AssembleResult {
  context: string;   // 项目+任务上下文
  rules: string;     // 约束规则
  templates: string; // Prompt 模板
  full: string;      // 完整指令（三者拼接）
  stats: {           // 统计信息
    contextLength: number;  // 上下文字符数
    rulesLength: number;    // 规则字符数
    templateLength: number; // 模板字符数
    totalLength: number;    // 总字符数
    truncated: boolean;     // 是否发生截断
  };
}

/**
 * 动态指令装配器类
 *
 * 每个实例绑定一个项目根目录，从该项目的 .qflow 目录加载上下文和规则。
 */
export class InstructionAssembler {
  /** 项目根目录 */
  private readonly projectRoot: string;

  /**
   * @param projectRoot - 项目根目录绝对路径
   */
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot; // 保存项目根路径
  }

  /**
   * 加载项目上下文
   *
   * 读取 .qflow/project.md + 任务详情 + 活跃 Spec 摘要。
   * 超过 MAX_CONTEXT_LENGTH 时截断。
   *
   * @param taskId       - 可选的任务 ID
   * @param includeSpecs - 是否包含 Spec 摘要
   * @returns 上下文字符串
   */
  async assembleContext(taskId?: string, includeSpecs?: boolean): Promise<string> {
    const parts: string[] = []; // 上下文片段列表
    let truncated = false; // 截断标记

    // 1. 加载 project.md
    const projectMdPath = path.join(this.projectRoot, QFLOW_DIR, 'project.md'); // 项目上下文文件
    try {
      if (await fileExists(projectMdPath)) { // 文件存在
        const content = await fs.readFile(projectMdPath, 'utf-8'); // 读取内容
        if (content.trim()) {
          parts.push(`[项目上下文]\n${content.trim()}`); // 添加项目上下文
          log.debug(`指令装配: 加载 project.md (${content.length} 字符)`); // 调试日志
        }
      }
    } catch (e) {
      log.debug(`指令装配: project.md 加载失败: ${(e as Error).message}`); // 静默跳过
    }

    // 2. 加载任务上下文
    if (taskId) {
      try {
        const { TaskManager } = await import('./task-manager.js'); // 动态导入避免循环依赖
        const tm = new TaskManager(this.projectRoot); // 创建任务管理器
        const task = await tm.getTask(taskId); // 获取任务
        if (task) {
          const taskContext = [
            `[当前任务] ${task.id}: ${task.title}`,
            task.description ? `描述: ${task.description}` : '',
            task.details ? `笔记: ${task.details}` : '',
            task.tags.length > 0 ? `标签: ${task.tags.join(', ')}` : '',
          ].filter(Boolean).join('\n'); // 拼接任务上下文
          parts.push(taskContext); // 添加任务上下文
          log.debug(`指令装配: 加载任务 ${taskId} 上下文`); // 调试日志
        }
      } catch (e) {
        log.debug(`指令装配: 任务 ${taskId} 加载失败: ${(e as Error).message}`); // 静默跳过
      }
    }

    // 3. 加载活跃 Spec 摘要
    if (includeSpecs) {
      try {
        const { SpecCrud } = await import('./spec-crud.js'); // 动态导入
        const specCrud = new SpecCrud(this.projectRoot); // 创建 Spec CRUD
        const specs = await specCrud.listSpecs(); // 获取所有 Spec
        const activeSpecs = specs.filter(s => s.status !== 'done'); // 过滤非完成 Spec
        if (activeSpecs.length > 0) {
          const specSummary = activeSpecs.map(s => `- ${s.id}: ${s.name} (${s.type}, ${s.status})`).join('\n'); // 摘要
          parts.push(`[活跃 Spec]\n${specSummary}`); // 添加 Spec 摘要
          log.debug(`指令装配: 加载 ${activeSpecs.length} 个活跃 Spec`); // 调试日志
        }
      } catch (e) {
        log.debug(`指令装配: Spec 加载失败: ${(e as Error).message}`); // 静默跳过
      }
    }

    let result = parts.join('\n\n'); // 拼接所有片段
    if (result.length > MAX_CONTEXT_LENGTH) { // 超过长度限制
      result = result.slice(0, MAX_CONTEXT_LENGTH) + '\n...(上下文已截断)'; // 截断
      truncated = true; // 标记截断
      log.debug(`指令装配: 上下文截断至 ${MAX_CONTEXT_LENGTH} 字符`); // 调试日志
    }

    return result; // 返回上下文
  }

  /**
   * 根据 AI 角色加载对应规则
   *
   * main=通用规则, research=研究规则, fallback=简化规则。
   * 优先从 .qflow/rules/{role}.md 加载自定义规则，不存在则使用内置默认。
   *
   * @param role - AI 角色，默认 'main'
   * @returns 规则字符串
   */
  async assembleRules(role: string = 'main'): Promise<string> {
    // 尝试加载自定义规则文件
    const customRulePath = path.join(this.projectRoot, QFLOW_DIR, 'rules', `${role}.md`); // 自定义规则路径
    try {
      if (await fileExists(customRulePath)) { // 自定义规则存在
        const content = await fs.readFile(customRulePath, 'utf-8'); // 读取内容
        if (content.trim()) {
          log.debug(`指令装配: 加载自定义规则 ${role}.md`); // 调试日志
          return content.trim().slice(0, MAX_RULES_LENGTH); // 截断并返回
        }
      }
    } catch (e) {
      log.debug(`指令装配: 自定义规则加载失败: ${(e as Error).message}`); // 静默跳过
    }

    // 内置默认规则
    const defaultRules: Record<string, string> = {
      main: [
        '## 通用规则',
        '- 输出必须为结构化 JSON 格式',
        '- 保持简洁，避免冗余',
        '- 遵循项目现有代码风格',
        '- 所有 ID 必须经过安全校验',
      ].join('\n'),
      research: [
        '## 研究规则',
        '- 深入分析，提供多角度视角',
        '- 引用具体的技术方案和最佳实践',
        '- 评估可行性和风险',
        '- 输出结构化的研究报告',
      ].join('\n'),
      fallback: [
        '## 简化规则',
        '- 输出简洁明了',
        '- 优先保证正确性',
        '- 减少复杂推理',
      ].join('\n'),
    };

    return defaultRules[role] || defaultRules['main']; // 返回对应角色规则
  }

  /**
   * 根据操作类型选择 Prompt 模板
   *
   * 支持: expand/research/generate/verify 四种操作。
   * 优先从 .qflow/templates/{action}.md 加载自定义模板。
   *
   * @param action - 操作类型
   * @returns 模板字符串
   */
  async assembleTemplates(action: string = 'generate'): Promise<string> {
    // 尝试加载自定义模板
    const customTemplatePath = path.join(this.projectRoot, QFLOW_DIR, 'templates', `${action}.md`); // 自定义模板路径
    try {
      if (await fileExists(customTemplatePath)) { // 自定义模板存在
        const content = await fs.readFile(customTemplatePath, 'utf-8'); // 读取内容
        if (content.trim()) {
          log.debug(`指令装配: 加载自定义模板 ${action}.md`); // 调试日志
          return content.trim().slice(0, MAX_TEMPLATE_LENGTH); // 截断并返回
        }
      }
    } catch (e) {
      log.debug(`指令装配: 自定义模板加载失败: ${(e as Error).message}`); // 静默跳过
    }

    // 内置默认模板
    const defaultTemplates: Record<string, string> = {
      expand: '请将以下任务拆解为 3-5 个子任务，每个子任务包含 title、description、priority、tags 字段。',
      research: '请对以下主题进行深入研究分析，输出结构化的研究报告，包含：背景、现状、方案对比、推荐方案、风险评估。',
      generate: '请根据以下上下文生成代码/文档，确保符合项目规范和最佳实践。',
      verify: '请验证以下内容的完整性、正确性和一致性，输出验证报告。',
    };

    return defaultTemplates[action] || defaultTemplates['generate']; // 返回对应模板
  }

  /**
   * 组合 Context+Rules+Templates 输出完整指令
   *
   * @param opts - 装配选项
   * @returns 装配结果（含完整指令和统计信息）
   */
  async assemble(opts: AssembleOptions = {}): Promise<AssembleResult> {
    const context = await this.assembleContext(opts.taskId, opts.includeSpecs); // 加载上下文
    const rules = await this.assembleRules(opts.role); // 加载规则
    const templates = await this.assembleTemplates(opts.action); // 加载模板

    const totalLength = context.length + rules.length + templates.length; // 总长度
    const maxTotal = MAX_CONTEXT_LENGTH + MAX_RULES_LENGTH + MAX_TEMPLATE_LENGTH; // 最大总长度
    const truncated = totalLength > maxTotal; // 是否截断

    // 拼接完整指令
    const fullParts: string[] = []; // 完整指令片段
    if (context) fullParts.push(context); // 添加上下文
    if (rules) fullParts.push(rules); // 添加规则
    if (templates) fullParts.push(templates); // 添加模板
    const full = fullParts.join('\n\n---\n\n'); // 用分隔线拼接

    log.debug(`指令装配: context=${context.length}, rules=${rules.length}, templates=${templates.length}, total=${full.length}`); // 调试日志

    return {
      context, // 上下文
      rules, // 规则
      templates, // 模板
      full, // 完整指令
      stats: {
        contextLength: context.length, // 上下文字符数
        rulesLength: rules.length, // 规则字符数
        templateLength: templates.length, // 模板字符数
        totalLength: full.length, // 总字符数
        truncated, // 是否截断
      },
    };
  }
}
