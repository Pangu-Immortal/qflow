/**
 * PlanGenerator - 实现计划生成器
 *
 * 从 Spec 生成实现计划（技术方案 + 数据模型 + API Contract + 快速启动指南）。
 * 持久化到 {projectRoot}/.qflow/plans/{specId}.json
 *
 * 函数列表:
 * - generate()              从 Spec 生成完整实现计划
 * - parseArtifacts()        从 Spec 内容解析产物列表（私有）
 * - parseDataModels()       从 Spec 内容解析数据模型（私有）
 * - parseApiContracts()     从 Spec 内容解析 API 契约（私有）
 * - generateQuickstartContent() 生成快速启动指南内容（私有）
 * - extractTechStack()      从 Spec 提取技术栈（私有）
 * - getPlan()               获取已生成的计划
 * - listPlans()             列出所有计划
 * - generateDataModel()     从 Spec 生成数据模型（独立方法）
 * - generateApiContract()   从 Spec 生成 API 契约（独立方法）
 * - generateQuickstart()    生成快速启动指南（独立方法）
 * - selectTrack()           根据复杂度分数选择规划轨道（quick/standard/enterprise）
 */
import path from 'node:path'; // 路径拼接工具
import { PlanSchema, type Plan, type PlanArtifact, type DataModel, type ApiContract } from '../schemas/plan.js'; // Plan schema 和类型
import { readJSON, writeJSON, ensureDir } from '../utils/file-io.js'; // 文件工具
import { log } from '../utils/logger.js'; // 日志工具
import { QFLOW_DIR } from '../shared/tool-utils.js'; // .qflow 目录常量
import { PLAN_MAX_ARTIFACTS, SCALE_QUICK_THRESHOLD, SCALE_ENTERPRISE_THRESHOLD } from '../shared/constants.js'; // 最大产物数常量及轨道阈值
import type { Spec } from '../schemas/spec.js'; // Spec 类型
import type { SpecCrud } from './spec-crud.js'; // SpecCrud 类型
import { TaskManager } from './task-manager.js'; // 任务管理器

/**
 * PlanGenerator 类 - 从 Spec 生成完整实现计划
 *
 * 通过构造函数注入 SpecCrud，解耦 Spec 数据读取与计划生成逻辑。
 * v25.0: AI 基础设施已移除，使用模板生成。
 */
export class PlanGenerator {
  private projectRoot: string; // 项目根目录
  private crud: SpecCrud; // Spec CRUD 引用

  constructor(
    projectRoot: string,
    crud: SpecCrud,
  ) {
    this.projectRoot = projectRoot; // 保存根目录
    this.crud = crud; // 保存 CRUD 实例
  }

  /** 计划目录路径（.qflow/plans/） */
  private plansDir(): string {
    return path.join(this.projectRoot, QFLOW_DIR, 'plans'); // 返回 plans 目录
  }

  /** 计划文件路径（.qflow/plans/{specId}.json） */
  private planPath(specId: string): string {
    return path.join(this.plansDir(), `${specId}.json`); // 返回 plan JSON 路径
  }

  /**
   * 从 Spec 生成完整实现计划
   *
   * @param specId - 关联 Spec ID
   * @returns 生成的 Plan 对象
   */
  async generate(specId: string): Promise<Plan> {
    const spec = await this.crud.getSpec(specId); // 读取 Spec
    if (!spec) throw new Error(`Spec "${specId}" 不存在`); // Spec 不存在报错

    const now = new Date().toISOString(); // 当前时间
    const planId = `PL-${specId}`; // 计划 ID 格式

    // 从 Spec 内容解析各部分
    const artifacts = this.parseArtifacts(spec); // 解析产物列表
    const dataModels = this.parseDataModels(spec); // 解析数据模型
    const apiContracts = this.parseApiContracts(spec); // 解析 API 契约
    const quickstart = this.generateQuickstartContent(spec); // 生成快速启动指南

    const plan: Plan = PlanSchema.parse({
      id: planId, // 计划 ID
      specId, // 关联 Spec
      title: `${spec.name} 实现计划`, // 计划标题
      overview: `基于 Spec "${spec.name}" 的实现计划。类型: ${spec.type}`, // 技术概述
      artifacts, // 产物列表
      dataModels, // 数据模型
      apiContracts, // API 契约
      quickstart, // 快速启动指南
      techStack: this.extractTechStack(spec), // 技术栈
      estimatedTasks: artifacts.length, // 预估任务数等于产物数
      createdAt: now, // 创建时间
      updatedAt: now, // 更新时间
    });

    await ensureDir(this.plansDir()); // 确保 plans 目录存在
    await writeJSON(this.planPath(specId), plan); // 写入 plan.json
    log.info(`PlanGenerator: 已生成计划 ${planId} (${artifacts.length} 产物, ${dataModels.length} 模型, ${apiContracts.length} 契约)`); // 日志
    return plan;
  }

  /**
   * 从 Spec 内容解析产物列表（私有方法）
   */
  private parseArtifacts(spec: Spec): PlanArtifact[] {
    const artifacts: PlanArtifact[] = []; // 结果列表

    // 从 targetFiles 生成产物
    if (spec.targetFiles && spec.targetFiles.length > 0) {
      for (const file of spec.targetFiles.slice(0, PLAN_MAX_ARTIFACTS)) { // 限制最大数量
        artifacts.push({
          name: path.basename(file), // 文件名作为产物名
          type: (file.endsWith('.test.ts') || file.endsWith('.spec.ts')) ? 'test' : 'file', // 测试文件标记为 test
          path: file, // 文件路径
          description: `实现 ${path.basename(file)}`, // 描述
          dependencies: [], // 无初始依赖
          parallel: false, // 默认非并行
        });
      }
    }

    // targetFiles 为空时生成默认产物
    if (artifacts.length === 0) {
      artifacts.push({
        name: `${spec.name} 核心模块`, // 默认核心产物
        type: 'module', // 模块类型
        description: `${spec.name} 的核心实现`, // 描述
        dependencies: [], // 无依赖
        parallel: false, // 非并行
      });
      artifacts.push({
        name: `${spec.name} 测试`, // 默认测试产物
        type: 'test', // 测试类型
        description: `${spec.name} 的测试用例`, // 描述
        dependencies: [`${spec.name} 核心模块`], // 依赖核心模块
        parallel: false, // 非并行
      });
    }

    return artifacts;
  }

  /**
   * 从 Spec 内容解析数据模型（私有方法）
   */
  private parseDataModels(spec: Spec): DataModel[] {
    const models: DataModel[] = []; // 结果列表
    const content = spec.content || ''; // Spec 正文内容

    // 匹配 ## Data Model 或 ## 数据模型 章节
    const modelSection = content.match(/##\s*(Data Model|数据模型)[^\n]*\n([\s\S]*?)(?=\n##|$)/i); // 正则匹配章节
    if (modelSection) {
      const sectionContent = modelSection[2]; // 章节内容
      // 按 ### 子标题分割为多个模型
      const subModels = sectionContent.split(/###\s+/); // 子标题分割
      for (const sub of subModels) {
        if (!sub.trim()) continue; // 跳过空内容
        const lines = sub.split('\n'); // 按行分割
        const modelName = lines[0]?.trim(); // 第一行为模型名
        if (!modelName) continue; // 无名称跳过
        const fields = lines.slice(1)
          .filter((l: string) => l.match(/^[-*]\s+/)) // 仅处理列表项
          .map((l: string) => ({
            name: l.replace(/^[-*]\s+/, '').split(':')[0]?.trim() || 'field', // 字段名
            type: l.split(':')[1]?.trim() || 'string', // 字段类型
            required: true as const, // 默认必填
          }));
        if (fields.length > 0) {
          models.push({ name: modelName, fields, relationships: [] }); // 收集模型
        }
      }
    }

    // 未解析到任何模型时生成默认模型
    if (models.length === 0) {
      models.push({
        name: spec.name, // 模型名与 Spec 同名
        fields: [
          { name: 'id', type: 'string', required: true }, // 主键字段
          { name: 'createdAt', type: 'datetime', required: true }, // 创建时间
          { name: 'updatedAt', type: 'datetime', required: true }, // 更新时间
        ],
        relationships: [], // 无关系
      });
    }

    return models;
  }

  /**
   * 从 Spec 内容解析 API 契约（私有方法）
   * 仅 api 类型的 Spec 生成契约
   */
  private parseApiContracts(spec: Spec): ApiContract[] {
    if (spec.type !== 'api') return []; // 非 API 类型不生成

    const contracts: ApiContract[] = []; // 结果列表

    // 生成默认 CRUD RESTful 契约
    contracts.push({
      name: `${spec.name} API`, // 契约名称
      endpoints: [
        { method: 'GET', path: `/${spec.name.toLowerCase()}`, description: `获取 ${spec.name} 列表`, auth: false }, // 列表
        { method: 'POST', path: `/${spec.name.toLowerCase()}`, description: `创建 ${spec.name}`, auth: true }, // 创建
        { method: 'GET', path: `/${spec.name.toLowerCase()}/:id`, description: `获取 ${spec.name} 详情`, auth: false }, // 详情
        { method: 'PUT', path: `/${spec.name.toLowerCase()}/:id`, description: `更新 ${spec.name}`, auth: true }, // 更新
        { method: 'DELETE', path: `/${spec.name.toLowerCase()}/:id`, description: `删除 ${spec.name}`, auth: true }, // 删除
      ],
    });

    return contracts;
  }

  /**
   * 生成快速启动指南内容（私有方法）
   */
  private generateQuickstartContent(spec: Spec): string {
    const techStack = this.extractTechStack(spec); // v22.0 P1-10: 动态提取技术栈
    const stackList = techStack.map(t => `- ${t}`).join('\n'); // 格式化技术栈列表
    const isPython = techStack.some(t => ['python', 'django', 'flask', 'fastapi'].includes(t)); // 检测 Python 项目
    const installCmd = isPython ? 'pip install -r requirements.txt' : 'npm install'; // 安装命令
    const devCmd = isPython ? 'python main.py' : 'npm run dev'; // 开发命令
    const testCmd = isPython ? 'pytest' : 'npm test'; // 测试命令
    return [
      `# ${spec.name} 快速启动指南`,
      '',
      '## 技术栈',
      stackList,
      '',
      '## 前提条件',
      isPython ? '- Python >= 3.10' : '- Node.js >= 18',
      '',
      '## 安装',
      '```bash',
      installCmd,
      '```',
      '',
      '## 开发',
      '```bash',
      devCmd,
      '```',
      '',
      '## 测试',
      '```bash',
      testCmd,
      '```',
      '',
    ].join('\n'); // 拼接动态内容
  }

  /**
   * 从 Spec 内容提取技术栈关键词（私有方法）
   */
  private extractTechStack(spec: Spec): string[] {
    const stack: string[] = []; // 结果列表
    const content = (spec.content || '').toLowerCase(); // 内容转小写便于匹配

    const techs = [ // 技术关键词列表
      'typescript', 'javascript', 'python', 'rust', 'go',
      'react', 'vue', 'angular', 'svelte',
      'node.js', 'deno', 'bun',
      'postgresql', 'mysql', 'mongodb', 'redis',
      'docker', 'kubernetes', 'aws', 'gcp', 'azure',
    ];

    for (const tech of techs) {
      if (content.includes(tech)) stack.push(tech); // 匹配则加入栈
    }

    if (stack.length === 0) stack.push('typescript'); // 默认使用 TypeScript

    return stack;
  }

  /**
   * 获取已生成的计划
   *
   * @param specId - 关联 Spec ID
   * @returns Plan 对象，不存在时返回 null
   */
  async getPlan(specId: string): Promise<Plan | null> {
    const raw = await readJSON<unknown>(this.planPath(specId)); // 读取 JSON
    if (!raw) return null; // 文件不存在
    const parsed = PlanSchema.safeParse(raw); // Zod 校验
    return parsed.success ? parsed.data : null; // 校验通过则返回
  }

  /**
   * 列出所有已生成的计划
   *
   * @returns Plan 数组
   */
  async listPlans(): Promise<Plan[]> {
    const plans: Plan[] = []; // 结果列表
    try {
      const { readdir } = await import('node:fs/promises'); // 动态导入 readdir
      const dir = this.plansDir(); // 计划目录
      const files = await readdir(dir).catch(() => []); // 读取文件列表，目录不存在时返回空
      for (const file of files) {
        if (file.endsWith('.json')) { // 仅处理 JSON 文件
          const specId = file.replace('.json', ''); // 提取 Spec ID
          const plan = await this.getPlan(specId); // 读取计划
          if (plan) plans.push(plan); // 非空则收集
        }
      }
    } catch (e) { log.debug('计划目录不存在: ' + (e instanceof Error ? e.message : String(e))); } // v22.0 P1-9
    return plans;
  }

  /**
   * 从 Spec 生成数据模型（对外独立方法）
   *
   * @param specId - Spec ID
   * @returns 数据模型数组
   */
  async generateDataModel(specId: string): Promise<DataModel[]> {
    const spec = await this.crud.getSpec(specId); // 读取 Spec
    if (!spec) throw new Error(`Spec "${specId}" 不存在`); // 不存在报错
    return this.parseDataModels(spec); // 解析并返回
  }

  /**
   * 从 Spec 生成 API 契约（对外独立方法）
   *
   * @param specId - Spec ID
   * @returns API 契约数组
   */
  async generateApiContract(specId: string): Promise<ApiContract[]> {
    const spec = await this.crud.getSpec(specId); // 读取 Spec
    if (!spec) throw new Error(`Spec "${specId}" 不存在`); // 不存在报错
    return this.parseApiContracts(spec); // 解析并返回
  }

  /**
   * 生成快速启动指南（对外独立方法）
   *
   * @param specId - Spec ID
   * @returns 快速启动 Markdown 字符串
   */
  async generateQuickstart(specId: string): Promise<string> {
    const spec = await this.crud.getSpec(specId); // 读取 Spec
    if (!spec) throw new Error(`Spec "${specId}" 不存在`); // 不存在报错
    return this.generateQuickstartContent(spec); // 生成并返回
  }

  /**
   * 根据复杂度分数选择规划轨道（Scale-Adaptive Planning）
   *
   * @param complexityScore - 复杂度分数（1-10）
   * @returns 'quick' | 'standard' | 'enterprise'
   */
  selectTrack(complexityScore: number): 'quick' | 'standard' | 'enterprise' {
    if (complexityScore <= SCALE_QUICK_THRESHOLD) return 'quick'; // 低复杂度走快速轨道
    if (complexityScore >= SCALE_ENTERPRISE_THRESHOLD) return 'enterprise'; // 高复杂度走企业轨道
    return 'standard'; // 中等复杂度走标准轨道
  }

  /** P3-3: 快速轨道 — 简化生成（跳过 risk/mitigation） */
  async generateQuick(taskId: string): Promise<{ plan: string; track: 'quick' }> {
    const tm = new TaskManager(this.projectRoot); // 创建任务管理器
    const task = await tm.getTask(taskId); // 获取任务
    if (!task) throw new Error(`任务 ${taskId} 不存在`); // 任务不存在
    const plan = `# 快速计划: ${task.title}\n\n## 步骤\n1. 直接实现\n2. 基础测试\n3. 提交\n`; // 简化计划
    return { plan, track: 'quick' };
  }

  /** P3-4: 企业轨道 — 完整生成（含 risk/mitigation/rollback） */
  async generateEnterprise(taskId: string): Promise<{ plan: string; track: 'enterprise' }> {
    const tm = new TaskManager(this.projectRoot); // 创建任务管理器
    const task = await tm.getTask(taskId); // 获取任务
    if (!task) throw new Error(`任务 ${taskId} 不存在`); // 任务不存在
    const plan = [
      `# 企业计划: ${task.title}`,
      '',
      '## 影响分析',
      `- 优先级: ${task.priority}`,
      `- 依赖: ${task.dependencies.join(', ') || '无'}`,
      '',
      '## 实施步骤',
      '1. 设计评审',
      '2. 原型实现',
      '3. 单元测试',
      '4. 集成测试',
      '5. 代码审查',
      '6. 灰度发布',
      '',
      '## 风险评估',
      '- 回归风险: 中',
      '- 性能影响: 低',
      '',
      '## 回滚方案',
      '- Git revert + 数据库迁移回退',
    ].join('\n'); // 完整计划
    return { plan, track: 'enterprise' };
  }
}
