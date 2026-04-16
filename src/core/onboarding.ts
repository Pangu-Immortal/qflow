/**
 * 新手引导引擎 - 5 阶段交互式教程
 *
 * 引导新用户按顺序体验 qflow 核心功能：
 *   init → task → expand → spec → autopilot
 *
 * 状态持久化到 .qflow/onboarding.json，支持断点续做和重置。
 *
 * 函数列表（OnboardingEngine 类）:
 * - init()                    初始化引导状态，创建 onboarding.json
 * - loadState()               加载已有引导状态
 * - saveState()               持久化当前状态到磁盘
 * - getStep()                 获取当前未完成的步骤
 * - completeStep()            完成当前步骤并推进到下一阶段
 * - getProgress()             获取整体进度摘要
 * - reset()                   重置引导状态（从头开始）
 * - enhancedOnboarding()      v20.0 扫描项目结构生成个性化引导计划
 * - generateOnboardingReport() v20.0 生成 Markdown 格式引导报告
 */

import path from 'node:path'; // 路径处理工具
import * as fs from 'fs/promises'; // 文件系统 Promise API（用于增强引导检测）
import { readJSON, writeJSON, ensureDir } from '../utils/file-io.js'; // 文件读写工具
import { QFLOW_DIR } from '../shared/tool-utils.js'; // .qflow 目录常量
import { log } from '../utils/logger.js'; // 日志工具

// ─── 接口定义 ───────────────────────────────────────────────

/** 单个引导步骤 */
export interface OnboardingStep {
  phase: number;           // 阶段编号 1-5
  name: string;            // 阶段名称
  description: string;     // 阶段描述
  instruction: string;     // 用户指引文本
  mcpTool: string;         // 推荐使用的 MCP 工具
  completed: boolean;      // 是否已完成
  completedAt?: string;    // 完成时间（ISO 8601）
}

/** 引导全局状态 */
export interface OnboardingState {
  currentPhase: number;    // 当前阶段（1-5，全部完成时为 6）
  steps: OnboardingStep[]; // 所有步骤列表
  startedAt: string;       // 引导开始时间
  completedAt?: string;    // 全部完成时间
}

// ─── 常量 ─────────────────────────────────────────────────

/** 引导状态文件名 */
const ONBOARDING_FILE = 'onboarding.json'; // 存储在 .qflow/ 下

/** 总阶段数 */
const TOTAL_PHASES = 5; // 固定 5 个阶段

/** 内置的 5 个引导阶段定义 */
const DEFAULT_STEPS: Omit<OnboardingStep, 'completed' | 'completedAt'>[] = [
  {
    phase: 1, // 第一阶段：项目初始化
    name: '项目初始化',
    description: '初始化 qflow 项目配置，创建 .qflow 目录结构',
    instruction: '使用 qflow_project_init 初始化项目',
    mcpTool: 'qflow_project_init',
  },
  {
    phase: 2, // 第二阶段：创建任务
    name: '创建任务',
    description: '创建第一个任务，体验任务管理基本流程',
    instruction: '使用 qflow_task_create 创建第一个任务',
    mcpTool: 'qflow_task_create',
  },
  {
    phase: 3, // 第三阶段：任务拆解
    name: '任务拆解',
    description: '将复杂任务拆解为可执行的子任务',
    instruction: '使用 qflow_task_expand 将任务拆解为子任务',
    mcpTool: 'qflow_task_expand',
  },
  {
    phase: 4, // 第四阶段：Spec 管理
    name: 'Spec 管理',
    description: '创建 Spec 文档，定义技术规范和设计决策',
    instruction: '使用 qflow_spec_init 创建第一个 Spec 文档',
    mcpTool: 'qflow_spec_init',
  },
  {
    phase: 5, // 第五阶段：自动驾驶
    name: '自动驾驶',
    description: '体验 Autopilot 自动执行任务的能力',
    instruction: '使用 qflow_autopilot 体验自动执行',
    mcpTool: 'qflow_autopilot_start',
  },
];

// ─── 引擎类 ───────────────────────────────────────────────

/**
 * 新手引导引擎
 *
 * 管理 5 阶段教程的生命周期：初始化、推进、查询、重置。
 * 每个实例绑定一个项目根目录，状态持久化到 .qflow/onboarding.json。
 */
export class OnboardingEngine {
  /** 项目根目录绝对路径 */
  private readonly projectRoot: string;

  /** 内存中的引导状态（懒加载） */
  private state: OnboardingState | null = null;

  /**
   * 构造函数
   * @param projectRoot - 项目根目录路径
   */
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot; // 绑定项目根目录
  }

  // ─── 私有工具方法 ─────────────────────────────────────

  /** 获取 onboarding.json 的完整路径 */
  private get statePath(): string {
    return path.join(this.projectRoot, QFLOW_DIR, ONBOARDING_FILE); // 拼接完整路径
  }

  /**
   * 持久化当前状态到磁盘
   * 写入前确保 .qflow 目录存在
   */
  private async saveState(): Promise<void> {
    if (!this.state) return; // 无状态时跳过
    const dir = path.join(this.projectRoot, QFLOW_DIR); // .qflow 目录路径
    await ensureDir(dir); // 确保目录存在
    await writeJSON(this.statePath, this.state); // 原子写入 JSON
    log.debug(`引导状态已保存: ${this.statePath}`); // 记录调试日志
  }

  // ─── 公开 API ─────────────────────────────────────────

  /**
   * 初始化引导状态
   *
   * 创建包含 5 个阶段的全新引导状态并写入磁盘。
   * 如果已存在状态文件，会被覆盖（等同于 reset）。
   *
   * @returns 新创建的引导状态
   */
  async init(): Promise<OnboardingState> {
    log.info('初始化新手引导教程...'); // 记录操作日志

    const steps: OnboardingStep[] = DEFAULT_STEPS.map((step) => ({
      ...step, // 展开阶段定义
      completed: false, // 初始状态：未完成
    }));

    this.state = {
      currentPhase: 1, // 从第一阶段开始
      steps, // 绑定步骤列表
      startedAt: new Date().toISOString(), // 记录开始时间
    };

    await this.saveState(); // 持久化到磁盘
    log.success(`新手引导已初始化，共 ${TOTAL_PHASES} 个阶段`); // 记录成功日志
    return this.state; // 返回初始状态
  }

  /**
   * 加载已有的引导状态
   *
   * 从 .qflow/onboarding.json 读取状态。
   * 文件不存在或格式错误时返回 null。
   *
   * @returns 引导状态，或 null（未初始化）
   */
  async loadState(): Promise<OnboardingState | null> {
    const raw = await readJSON<OnboardingState>(this.statePath); // 读取 JSON（无 schema 校验）
    const data = raw ?? null; // 不存在时返回 null
    if (data) {
      this.state = data; // 缓存到内存
      log.debug(`引导状态已加载，当前阶段: ${data.currentPhase}`); // 记录调试日志
    }
    return data; // 返回读取结果（可能为 null）
  }

  /**
   * 获取当前未完成的步骤
   *
   * 遍历步骤列表，返回第一个未完成的步骤。
   * 全部完成时返回 null。
   *
   * @returns 当前步骤，或 null（全部完成）
   */
  async getStep(): Promise<OnboardingStep | null> {
    if (!this.state) { // 内存无状态时尝试从磁盘加载
      await this.loadState();
    }
    if (!this.state) return null; // 未初始化，返回 null

    const current = this.state.steps.find((s) => !s.completed); // 查找第一个未完成步骤
    return current ?? null; // 全部完成时返回 null
  }

  /**
   * 完成当前步骤并推进到下一阶段
   *
   * 标记当前步骤为已完成，更新 currentPhase。
   * 如果是最后一个步骤，标记整个引导为已完成。
   *
   * @returns 包含已完成步骤、下一步骤和是否全部完成的结果
   * @throws 无可完成步骤时抛出错误
   */
  async completeStep(): Promise<{
    completed: OnboardingStep; // 刚完成的步骤
    next: OnboardingStep | null; // 下一个步骤（全部完成时为 null）
    allDone: boolean; // 是否全部完成
  }> {
    if (!this.state) { // 内存无状态时尝试加载
      await this.loadState();
    }
    if (!this.state) { // 仍然无状态，说明未初始化
      throw new Error('引导未初始化，请先调用 init()');
    }

    const currentStep = this.state.steps.find((s) => !s.completed); // 查找当前未完成步骤
    if (!currentStep) { // 所有步骤已完成
      throw new Error('所有引导步骤已完成，无需再次推进');
    }

    currentStep.completed = true; // 标记为已完成
    currentStep.completedAt = new Date().toISOString(); // 记录完成时间
    log.success(`阶段 ${currentStep.phase} "${currentStep.name}" 已完成`); // 记录成功日志

    const nextStep = this.state.steps.find((s) => !s.completed); // 查找下一个未完成步骤
    const allDone = !nextStep; // 判断是否全部完成

    if (allDone) { // 全部完成
      this.state.completedAt = new Date().toISOString(); // 记录全部完成时间
      this.state.currentPhase = TOTAL_PHASES + 1; // 阶段号设为 6（超出范围表示已完成）
      log.success('恭喜！新手引导全部完成'); // 记录完成日志
    } else { // 还有后续步骤
      this.state.currentPhase = nextStep!.phase; // 更新当前阶段号
      log.info(`进入阶段 ${nextStep!.phase}: ${nextStep!.name}`); // 记录推进日志
    }

    await this.saveState(); // 持久化更新后的状态

    return {
      completed: currentStep, // 返回刚完成的步骤
      next: nextStep ?? null, // 返回下一步骤
      allDone, // 返回是否全部完成
    };
  }

  /**
   * 获取进度摘要
   *
   * 统计已完成步骤数、总步骤数和完成百分比。
   *
   * @returns 进度摘要对象
   */
  async getProgress(): Promise<{
    current: number; // 已完成步骤数
    total: number; // 总步骤数
    percentage: number; // 完成百分比（0-100）
    steps: OnboardingStep[]; // 所有步骤详情
  }> {
    if (!this.state) { // 内存无状态时尝试加载
      await this.loadState();
    }
    if (!this.state) { // 未初始化时返回零进度
      return { current: 0, total: TOTAL_PHASES, percentage: 0, steps: [] };
    }

    const completedCount = this.state.steps.filter((s) => s.completed).length; // 统计已完成数
    const percentage = Math.round((completedCount / TOTAL_PHASES) * 100); // 计算百分比（四舍五入）

    return {
      current: this.state.currentPhase, // 当前阶段号
      total: TOTAL_PHASES, // 总数
      percentage, // 百分比
      steps: this.state.steps, // 步骤详情
    };
  }

  /**
   * 重置引导状态
   *
   * 清除内存状态并重新初始化，等同于从头开始。
   */
  async reset(): Promise<void> {
    log.info('重置新手引导...'); // 记录操作日志
    this.state = null; // 清除内存状态
    await this.init(); // 重新初始化（会覆盖磁盘文件）
    log.success('新手引导已重置'); // 记录成功日志
  }

  /**
   * v20.0 P4-3: 增强版新人引导
   * 扫描项目结构并生成个性化引导计划（基于已有文件/配置/工具检测）
   * @returns 增强引导状态，包含项目分析和定制步骤
   */
  async enhancedOnboarding(): Promise<{
    projectAnalysis: {
      hasGit: boolean;
      hasPackageJson: boolean;
      hasQflowConfig: boolean;
      detectedLanguages: string[];
      fileCount: number;
    };
    customSteps: Array<{
      id: string;
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    recommendations: string[];
  }> {
    const analysis = {
      hasGit: false,
      hasPackageJson: false,
      hasQflowConfig: false,
      detectedLanguages: [] as string[],
      fileCount: 0,
    };

    // 检测项目特征：.git 目录
    try {
      await fs.access(path.join(this.projectRoot, '.git'));
      analysis.hasGit = true; // 存在 .git 目录，说明已初始化 Git
    } catch { /* 非 git 仓库，跳过 */ }

    // 检测 package.json 是否存在（Node.js/TypeScript 项目标志）
    try {
      await fs.access(path.join(this.projectRoot, 'package.json'));
      analysis.hasPackageJson = true; // 存在 package.json
      analysis.detectedLanguages.push('TypeScript/JavaScript'); // 记录检测到的语言
    } catch { /* 无 package.json，跳过 */ }

    // 检测 .qflow 配置目录是否存在
    try {
      await fs.access(path.join(this.projectRoot, '.qflow'));
      analysis.hasQflowConfig = true; // 已初始化 qflow 项目
    } catch { /* 无 qflow 配置，跳过 */ }

    // 扫描根目录文件扩展名以检测编程语言
    try {
      const entries = await fs.readdir(this.projectRoot, { withFileTypes: true }); // 读取目录条目
      analysis.fileCount = entries.filter(e => e.isFile()).length; // 统计文件数量
      const exts = new Set(entries.filter(e => e.isFile()).map(e => path.extname(e.name))); // 收集所有扩展名
      if (exts.has('.py')) analysis.detectedLanguages.push('Python'); // 检测 Python
      if (exts.has('.go')) analysis.detectedLanguages.push('Go'); // 检测 Go
      if (exts.has('.rs')) analysis.detectedLanguages.push('Rust'); // 检测 Rust
      if (exts.has('.java') || exts.has('.kt')) analysis.detectedLanguages.push('Java/Kotlin'); // 检测 Java/Kotlin
    } catch { /* 无法读取目录，跳过 */ }

    // 根据分析结果生成定制引导步骤
    const customSteps: Array<{ id: string; title: string; description: string; priority: 'high' | 'medium' | 'low' }> = [];

    if (!analysis.hasQflowConfig) { // 未初始化 qflow，最高优先级引导
      customSteps.push({ id: 'init-qflow', title: '初始化 qflow 项目', description: '运行 qflow_project_init 创建 .qflow 目录', priority: 'high' });
    }
    if (!analysis.hasGit) { // 未初始化 Git，建议版本控制
      customSteps.push({ id: 'init-git', title: '初始化 Git 仓库', description: '建议使用版本控制管理项目', priority: 'high' });
    }
    customSteps.push({ id: 'create-tasks', title: '创建首批任务', description: '使用 qflow_task_create 分解项目目标', priority: 'medium' }); // 通用步骤
    customSteps.push({ id: 'setup-ai', title: '配置 AI Provider', description: '选择并配置 AI 模型提供商', priority: 'medium' }); // AI 配置
    customSteps.push({ id: 'explore-tools', title: '探索 qflow 工具', description: '查看可用的 MCP 工具列表', priority: 'low' }); // 低优先级探索

    // 生成个性化建议列表
    const recommendations: string[] = [];
    if (analysis.hasQflowConfig) recommendations.push('项目已配置 qflow，可直接开始使用'); // 已有配置
    if (analysis.detectedLanguages.length > 0) recommendations.push(`检测到语言: ${analysis.detectedLanguages.join(', ')}`); // 语言提示
    if (analysis.fileCount > 100) recommendations.push('大型项目，建议使用 Scale-Adaptive Planning'); // 大型项目提示
    recommendations.push('建议先创建 Spec 定义项目架构'); // 通用建议

    return { projectAnalysis: analysis, customSteps, recommendations };
  }

  /**
   * v20.0 P4-4: 生成引导报告
   * 将当前引导进度和项目分析生成 Markdown 报告
   * @returns Markdown 格式报告字符串
   */
  async generateOnboardingReport(): Promise<string> {
    const progress = await this.getProgress(); // 获取当前引导进度
    const enhanced = await this.enhancedOnboarding(); // 执行增强扫描分析

    // 计算已完成步骤数（getProgress 返回的 current 是阶段号，需要从 steps 统计完成数）
    const completedCount = progress.steps.filter(s => s.completed).length; // 已完成步骤数
    const currentStepObj = progress.steps.find(s => !s.completed); // 当前未完成步骤

    const lines: string[] = [
      '# qflow 项目引导报告',
      '',
      '## 项目分析',
      `- Git: ${enhanced.projectAnalysis.hasGit ? '✅' : '❌'}`, // Git 状态
      `- package.json: ${enhanced.projectAnalysis.hasPackageJson ? '✅' : '❌'}`, // package.json 状态
      `- qflow 配置: ${enhanced.projectAnalysis.hasQflowConfig ? '✅' : '❌'}`, // qflow 配置状态
      `- 检测语言: ${enhanced.projectAnalysis.detectedLanguages.join(', ') || '无'}`, // 检测到的语言
      `- 文件数: ${enhanced.projectAnalysis.fileCount}`, // 根目录文件数量
      '',
      '## 引导进度',
      `- 完成: ${completedCount}/${progress.total} (${progress.percentage}%)`, // 进度统计
      `- 当前步骤: ${currentStepObj ? currentStepObj.name : '无（已全部完成）'}`, // 当前步骤名称
      '',
      '## 推荐步骤',
      ...enhanced.customSteps.map(s => `- [${s.priority.toUpperCase()}] ${s.title}: ${s.description}`), // 定制步骤列表
      '',
      '## 建议',
      ...enhanced.recommendations.map(r => `- ${r}`), // 建议列表
    ];

    return lines.join('\n'); // 拼接为完整 Markdown 字符串
  }
}
