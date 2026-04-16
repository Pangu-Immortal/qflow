/**
 * 报告生成器 - 进度报告和复杂度报告
 *
 * 基于 TaskManager 数据生成两种报告：
 * 1. 进度报告：状态统计、标签分组、阻塞分析
 * 2. 复杂度报告：评分分布、高复杂度任务、拆解建议
 *
 * 函数列表:
 * - generateProgressReport()    生成进度报告
 * - generateComplexityReport()  生成复杂度报告
 */

import { TaskManager } from './task-manager.js'; // 任务管理器
import { log } from '../utils/logger.js'; // 日志工具
import type { Task } from '../schemas/task.js'; // 任务类型

/** 进度报告结构 */
export interface ProgressReport {
  totalTasks: number; // 任务总数
  statusBreakdown: Record<string, number>; // 各状态任务数
  completionRate: number; // 完成率（百分比）
  tagBreakdown: Record<string, number>; // 各标签任务数
  blockedTasks: Array<{ id: string; title: string; blockedBy: string[] }>; // 阻塞任务详情
  recentDone: Array<{ id: string; title: string; completedAt?: string }>; // 最近完成的任务
  priorityDistribution: Record<number, number>; // 优先级分布
}

/** 复杂度报告结构 */
export interface ComplexityReport {
  totalScored: number; // 已评分任务数
  averageScore: number; // 平均复杂度
  distribution: Record<string, number>; // 复杂度分布（低/中/高）
  highComplexity: Array<{ id: string; title: string; score: number; expansionPrompt?: string }>; // 高复杂度任务
  suggestExpand: Array<{ id: string; title: string; score: number; suggestedSubtasks: number }>; // 建议拆解的任务
}

/**
 * 报告生成器类
 *
 * 每个实例绑定一个项目根目录，通过 TaskManager 访问任务数据。
 */
export class ReportGenerator {
  /** 任务管理器实例 */
  private readonly tm: TaskManager;

  /**
   * @param projectRoot - 项目根目录路径
   */
  constructor(projectRoot: string) {
    this.tm = new TaskManager(projectRoot); // 创建任务管理器
  }

  /**
   * 生成进度报告
   *
   * 统计各维度数据：状态、标签、阻塞、优先级、完成率。
   *
   * @returns 进度报告对象
   */
  async generateProgressReport(): Promise<ProgressReport> {
    const tasks = await this.tm.getAllTasks(); // 获取全部任务
    log.info(`生成进度报告: 共 ${tasks.length} 个任务`); // 信息日志

    // 状态统计
    const statusBreakdown: Record<string, number> = {}; // 状态 → 计数
    for (const t of tasks) { // 遍历任务
      statusBreakdown[t.status] = (statusBreakdown[t.status] || 0) + 1; // 计数 +1
    }

    // 完成率
    const doneCount = statusBreakdown['done'] || 0; // 已完成数
    const completionRate = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0; // 百分比

    // 标签统计
    const tagBreakdown: Record<string, number> = {}; // 标签 → 计数
    for (const t of tasks) { // 遍历任务
      for (const tag of t.tags) { // 遍历标签
        tagBreakdown[tag] = (tagBreakdown[tag] || 0) + 1; // 计数 +1
      }
    }

    // 阻塞分析
    const blockedTasks = tasks
      .filter(t => t.status === 'blocked') // 过滤阻塞任务
      .map(t => ({
        id: t.id,
        title: t.title,
        blockedBy: t.dependencies.filter(depId => { // 找出未完成的依赖
          const dep = tasks.find(d => d.id === depId); // 查找依赖任务
          return dep && dep.status !== 'done'; // 未完成的依赖
        }),
      }));

    // 最近完成
    const recentDone = tasks
      .filter(t => t.status === 'done') // 过滤已完成任务
      .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')) // 按完成时间倒序
      .slice(0, 10) // 最近 10 个
      .map(t => ({ id: t.id, title: t.title, completedAt: t.completedAt }));

    // 优先级分布
    const priorityDistribution: Record<number, number> = {}; // 优先级 → 计数
    for (const t of tasks) { // 遍历任务
      priorityDistribution[t.priority] = (priorityDistribution[t.priority] || 0) + 1; // 计数 +1
    }

    return {
      totalTasks: tasks.length,
      statusBreakdown,
      completionRate,
      tagBreakdown,
      blockedTasks,
      recentDone,
      priorityDistribution,
    };
  }

  /**
   * 生成复杂度报告
   *
   * 分析任务复杂度评分，生成分布、高复杂度识别和拆解建议。
   *
   * @returns 复杂度报告对象
   */
  async generateComplexityReport(): Promise<ComplexityReport> {
    const tasks = await this.tm.getAllTasks(); // 获取全部任务
    log.info(`生成复杂度报告: 共 ${tasks.length} 个任务`); // 信息日志

    // 过滤已评分的任务
    const scored = tasks.filter(t => t.complexityScore !== undefined && t.complexityScore > 0); // 已评分任务
    const totalScored = scored.length; // 已评分数

    // 平均分
    const averageScore = totalScored > 0
      ? Math.round((scored.reduce((sum, t) => sum + (t.complexityScore || 0), 0) / totalScored) * 10) / 10 // 保留一位小数
      : 0;

    // 复杂度分布：低(1-3) / 中(4-6) / 高(7-10)
    const distribution: Record<string, number> = { low: 0, medium: 0, high: 0 }; // 分布统计
    for (const t of scored) { // 遍历已评分任务
      const s = t.complexityScore || 0;
      if (s <= 3) distribution['low']++; // 低复杂度
      else if (s <= 6) distribution['medium']++; // 中等复杂度
      else distribution['high']++; // 高复杂度
    }

    // 高复杂度任务（≥7）
    const highComplexity = scored
      .filter(t => (t.complexityScore || 0) >= 7) // 过滤高复杂度
      .sort((a, b) => (b.complexityScore || 0) - (a.complexityScore || 0)) // 按复杂度降序
      .map(t => ({
        id: t.id,
        title: t.title,
        score: t.complexityScore || 0,
        expansionPrompt: t.expansionPrompt,
      }));

    // 建议拆解的任务（高复杂度且无子任务）
    const suggestExpand = highComplexity
      .filter(t => { // 过滤无子任务的高复杂度任务
        const task = tasks.find(tt => tt.id === t.id); // 查找原始任务
        return task && task.subtasks.length === 0; // 无子任务
      })
      .map(t => ({
        id: t.id,
        title: t.title,
        score: t.score,
        suggestedSubtasks: Math.ceil(t.score / 2), // 建议子任务数 = 复杂度 / 2 向上取整
      }));

    return {
      totalScored,
      averageScore,
      distribution,
      highComplexity,
      suggestExpand,
    };
  }
}
