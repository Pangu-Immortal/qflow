/**
 * 评审管理器 - Spec/Change/Task 的评审流程
 *
 * 管理评审请求的创建、评论、解决。
 * 数据目录: {projectRoot}/.qflow/reviews/{reviewId}.json
 *
 * 函数列表:
 * - createReview()  创建评审请求
 * - addComment()    添加评审评论
 * - resolveReview() 完成评审（approve/reject/close）
 * - getReview()     获取评审详情
 * - listReviews()   列出所有评审
 * - uxChecklist()   结构化 UX 评审（可访问性/响应式/加载状态/错误状态/导航）
 */

import path from 'node:path'; // 路径拼接工具
import { promises as fs } from 'node:fs'; // 异步文件操作
import { readJSONSafe, writeJSON, ensureDir, fileExists, withFileLock, readJSONUnlocked, writeJSONUnlocked } from '../utils/file-io.js'; // 文件读写工具（含事务锁）
import { log } from '../utils/logger.js'; // 日志工具
import { uniqueId, sanitizeId, QFLOW_DIR } from '../shared/tool-utils.js'; // 全局唯一 ID 生成工具 + .qflow 目录常量
import { TaskManager } from './task-manager.js'; // 任务管理器（用于校验 task 存在性）
import { SpecManager } from './spec-manager.js'; // Spec 管理器（用于校验 spec 存在性）
import { ReviewSchema } from '../schemas/review.js'; // 评审 Zod Schema

/** reviews 子目录 */
const REVIEWS_DIR = 'reviews'; // 评审数据目录

/** 评审目标类型 */
export type ReviewTargetType = 'spec' | 'change' | 'task'; // 支持三种目标类型

/** 评审状态 */
export type ReviewStatus = 'open' | 'approved' | 'rejected' | 'closed'; // 四种评审状态

/** 评审评论 */
export interface ReviewComment {
  id: string; // 评论唯一 ID，格式: RC{timestamp}
  author: string; // 评论作者
  content: string; // 评论内容
  type?: 'comment' | 'suggestion' | 'issue' | 'praise'; // 评论类型
  createdAt: string; // 创建时间
}

/** 评审请求 */
export interface Review {
  id: string; // 评审唯一 ID，格式: R{timestamp}
  targetType: ReviewTargetType; // 评审目标类型
  targetId: string; // 评审目标 ID（Spec ID / Change ID / Task ID）
  title: string; // 评审标题
  description: string; // 评审描述
  status: ReviewStatus; // 当前状态
  comments: ReviewComment[]; // 评论列表
  reviewer: string; // 指定的评审人
  createdAt: string; // 创建时间
  updatedAt: string; // 更新时间
  resolvedAt: string | null; // 解决时间（未解决时为 null）
}

/**
 * 评审管理器类
 *
 * 每个实例绑定一个项目根目录，操作该项目的评审数据。
 */
export class ReviewManager {
  /** 项目根目录绝对路径 */
  private readonly projectRoot: string;

  /** 评审目录路径 */
  private readonly reviewsDir: string;

  /** 任务管理器实例 */
  private readonly taskManager: TaskManager;

  /** Spec 管理器实例 */
  private readonly specManager: SpecManager;

  /**
   * @param projectRoot - 项目根目录绝对路径
   */
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot; // 保存项目根路径
    this.reviewsDir = path.join(projectRoot, QFLOW_DIR, REVIEWS_DIR); // 拼接评审目录路径
    this.taskManager = new TaskManager(projectRoot); // 创建任务管理器实例
    this.specManager = new SpecManager(projectRoot); // 创建 Spec 管理器实例
  }

  /**
   * 校验评审目标是否存在
   *
   * @param targetType - 目标类型
   * @param targetId   - 目标 ID
   * @throws 目标不存在时抛出错误
   */
  private async validateTarget(targetType: ReviewTargetType, targetId: string): Promise<void> {
    switch (targetType) { // 按类型分别校验
      case 'task': { // 校验任务存在性
        const task = await this.taskManager.getTask(targetId); // 查找任务
        if (!task) throw new Error(`任务 ${targetId} 不存在`); // 不存在则报错
        break;
      }
      case 'spec': { // 校验 Spec 存在性
        const spec = await this.specManager.getSpec(targetId); // 查找 Spec
        if (!spec) throw new Error(`Spec ${targetId} 不存在`); // 不存在则报错
        break;
      }
      case 'change': { // Change 存在性校验较复杂，这里做基本路径检查
        const safeTargetId = sanitizeId(targetId); // 防止路径遍历攻击
        const changePath = path.join(this.projectRoot, QFLOW_DIR, 'changes', 'pending', `${safeTargetId}.json`); // pending 路径
        const appliedPath = path.join(this.projectRoot, QFLOW_DIR, 'changes', 'applied', `${safeTargetId}.json`); // applied 路径
        const existsInPending = await fileExists(changePath); // 检查 pending
        const existsInApplied = await fileExists(appliedPath); // 检查 applied
        if (!existsInPending && !existsInApplied) { // 都不存在
          throw new Error(`变更 ${targetId} 不存在`); // 抛出错误
        }
        break;
      }
      default: // 未知类型
        throw new Error(`不支持的评审目标类型: ${targetType}`); // 抛出错误
    }
  }

  /**
   * 创建评审请求
   *
   * @param targetType  - 评审目标类型
   * @param targetId    - 评审目标 ID
   * @param title       - 评审标题
   * @param description - 评审描述
   * @param reviewer    - 指定的评审人
   * @returns 新创建的评审对象
   */
  async createReview(
    targetType: ReviewTargetType,
    targetId: string,
    title: string,
    description: string,
    reviewer: string,
  ): Promise<Review> {
    await this.validateTarget(targetType, targetId); // 校验目标存在性

    const reviewId = uniqueId('R'); // 生成全局唯一评审 ID（防止碰撞）
    const now = new Date().toISOString(); // 当前时间戳

    const review: Review = { // 构造评审对象
      id: reviewId, // 唯一标识
      targetType, // 目标类型
      targetId, // 目标 ID
      title, // 标题
      description, // 描述
      status: 'open', // 初始状态：开放
      comments: [], // 评论列表（初始为空）
      reviewer, // 评审人
      createdAt: now, // 创建时间
      updatedAt: now, // 更新时间
      resolvedAt: null, // 未解决
    };

    await ensureDir(this.reviewsDir); // 确保目录存在
    await writeJSON(path.join(this.reviewsDir, `${reviewId}.json`), review); // 写入文件
    log.info(`评审已创建: ${reviewId} → ${targetType}:${targetId}`); // 信息日志
    return review; // 返回新评审
  }

  /**
   * 添加评审评论
   *
   * @param reviewId - 评审 ID
   * @param author   - 评论作者
   * @param content  - 评论内容
   * @param type     - 评论类型（可选，默认 comment）
   * @returns 新创建的评论对象
   */
  async addComment(reviewId: string, author: string, content: string, type?: 'comment' | 'suggestion' | 'issue' | 'praise'): Promise<ReviewComment> {
    const safeId = sanitizeId(reviewId); // 防止路径遍历攻击
    const filePath = path.join(this.reviewsDir, `${safeId}.json`); // 评审文件路径

    // 使用 withFileLock 保护整个读-改-写事务，消除并发添加评论的 TOCTOU 竞态窗口
    return await withFileLock(filePath, async () => {
      // 在持锁期间直接读取（使用无锁版本，避免与外层锁死锁）
      const rawData = await readJSONUnlocked<unknown>(filePath); // 读取原始数据
      const parseResult = ReviewSchema.safeParse(rawData); // 用 Schema 校验
      const review = parseResult.success ? parseResult.data : null; // 校验通过则取数据

      if (!review) throw new Error(`评审 ${reviewId} 不存在`); // 校验存在
      if (review.status !== 'open') throw new Error(`评审 ${reviewId} 已关闭，无法添加评论`); // 校验状态

      const commentId = uniqueId('RC'); // 生成全局唯一评论 ID（防止碰撞）
      const comment: ReviewComment = { // 构造评论对象
        id: commentId, // 唯一标识
        author, // 作者
        content, // 内容
        type: type || 'comment', // 默认为普通评论
        createdAt: new Date().toISOString(), // 创建时间
      };

      review.comments.push(comment); // 追加评论
      review.updatedAt = new Date().toISOString(); // 刷新更新时间
      await writeJSONUnlocked(filePath, review); // 无锁写入（外层 withFileLock 已持锁）
      log.info(`评论已添加: ${commentId} → 评审 ${reviewId}`); // 信息日志
      return comment; // 返回新评论
    });
  }

  /**
   * 完成评审（approve/reject/close）
   *
   * @param reviewId   - 评审 ID
   * @param resolution - 解决方式
   * @returns 更新后的评审对象
   */
  async resolveReview(reviewId: string, resolution: 'approved' | 'rejected' | 'closed'): Promise<Review> {
    const review = await this.getReview(reviewId); // 获取评审
    if (!review) throw new Error(`评审 ${reviewId} 不存在`); // 校验存在
    if (review.status !== 'open') throw new Error(`评审 ${reviewId} 已关闭，无法再次解决`); // 校验状态

    const now = new Date().toISOString(); // 当前时间
    review.status = resolution; // 更新状态
    review.resolvedAt = now; // 记录解决时间
    review.updatedAt = now; // 刷新更新时间

    await writeJSON(path.join(this.reviewsDir, `${sanitizeId(reviewId)}.json`), review); // 持久化
    log.info(`评审 ${reviewId} 已解决: ${resolution}`); // 信息日志
    return review; // 返回更新后的评审
  }

  /**
   * 获取评审详情
   *
   * @param reviewId - 评审 ID
   * @returns 评审对象，未找到返回 null
   */
  async getReview(reviewId: string): Promise<Review | null> {
    const safeId = sanitizeId(reviewId); // 防止路径遍历攻击
    const filePath = path.join(this.reviewsDir, `${safeId}.json`); // 拼接文件路径
    const raw = await readJSONSafe(filePath, ReviewSchema); // 读取并校验 JSON
    return raw; // 返回评审对象或 null
  }

  /**
   * 列出所有评审
   *
   * @param filter - 可选过滤条件
   * @returns 评审列表
   */
  async listReviews(filter?: { status?: ReviewStatus; targetType?: ReviewTargetType }): Promise<Review[]> {
    if (!(await fileExists(this.reviewsDir))) return []; // 目录不存在返回空

    const entries = await fs.readdir(this.reviewsDir); // 读取目录内容
    const reviews: Review[] = []; // 结果列表

    for (const entry of entries) { // 遍历每个文件
      if (!entry.endsWith('.json')) continue; // 跳过非 JSON 文件
      const review = await readJSONSafe(path.join(this.reviewsDir, entry), ReviewSchema); // 读取并校验评审
      if (!review) continue; // 读取失败跳过

      // 应用过滤条件
      if (filter?.status && review.status !== filter.status) continue; // 状态不匹配
      if (filter?.targetType && review.targetType !== filter.targetType) continue; // 类型不匹配

      reviews.push(review); // 追加到结果
    }

    return reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // 按创建时间降序
  }

  // ─── v19.0 Phase 6: 就绪度检查 + 对抗性评审 + 边界场景 ─────────────────────

  /**
   * 就绪度检查 - 评估 Spec 是否具备实现条件
   *
   * 计分规则（每项 20 分，满分 100）：
   * 1. Spec 存在 (+20)
   * 2. Spec 有 3 个以上章节 (+20)
   * 3. 有关联任务 (+20)
   * 4. 所有任务都有描述 (+20)
   * 5. 无阻塞任务 (+20)
   *
   * @param specId - Spec ID
   * @returns 评分结果（PASS/CONCERNS/FAIL + score + details）
   */
  async readinessGate(specId: string): Promise<{
    result: 'PASS' | 'CONCERNS' | 'FAIL'; // 评估结果
    score: number;                          // 0-100 分
    details: string[];                      // 各项得分明细
  }> {
    let score = 0; // 初始分数为 0
    const details: string[] = []; // 明细列表

    // 检查 1: Spec 是否存在
    const spec = await this.specManager.getSpec(specId); // 查找 Spec
    if (spec) {
      score += 20; // Spec 存在 +20
      details.push('✅ Spec 存在 (+20)'); // 记录明细
    } else {
      details.push('❌ Spec 不存在 (+0)'); // 记录失败
      return { result: 'FAIL', score: 0, details }; // Spec 不存在直接 FAIL
    }

    // 检查 2: Spec 是否有 3 个以上章节
    const sectionCount = (spec.content.match(/^## /gm) || []).length; // 统计二级标题数量
    if (sectionCount >= 3) {
      score += 20; // 章节充足 +20
      details.push(`✅ Spec 有 ${sectionCount} 个章节 (+20)`); // 记录明细
    } else {
      details.push(`❌ Spec 只有 ${sectionCount} 个章节，需要至少 3 个 (+0)`); // 记录不足
    }

    // 检查 3: 是否有关联任务
    const allTasks = await this.taskManager.getAllTasks(); // 获取全部任务
    const relatedTasks = allTasks.filter(t =>
      t.tags?.includes(specId) || // 标签包含 Spec ID
      t.description?.includes(specId) // 描述包含 Spec ID
    );
    if (relatedTasks.length > 0) {
      score += 20; // 有关联任务 +20
      details.push(`✅ 有 ${relatedTasks.length} 个关联任务 (+20)`); // 记录明细
    } else {
      details.push('❌ 无关联任务 (+0)'); // 记录无任务
    }

    // 检查 4: 所有任务都有描述
    const tasksWithDesc = relatedTasks.filter(t => t.description && t.description.trim().length > 0); // 过滤有描述的任务
    if (relatedTasks.length > 0 && tasksWithDesc.length === relatedTasks.length) {
      score += 20; // 所有任务有描述 +20
      details.push('✅ 所有关联任务都有描述 (+20)'); // 记录明细
    } else if (relatedTasks.length === 0) {
      details.push('⚠️ 无关联任务，跳过描述检查 (+0)'); // 无任务跳过
    } else {
      details.push(`❌ 有 ${relatedTasks.length - tasksWithDesc.length} 个任务缺少描述 (+0)`); // 记录缺失
    }

    // 检查 5: 无阻塞任务
    const blockedTasks = relatedTasks.filter(t => t.status === 'blocked'); // 过滤阻塞任务
    if (blockedTasks.length === 0) {
      score += 20; // 无阻塞 +20
      details.push('✅ 无阻塞任务 (+20)'); // 记录明细
    } else {
      details.push(`❌ 有 ${blockedTasks.length} 个阻塞任务 (+0)`); // 记录阻塞
    }

    // 判定结果
    const result: 'PASS' | 'CONCERNS' | 'FAIL' =
      score >= 80 ? 'PASS' :    // 80+ 通过
      score >= 50 ? 'CONCERNS' : // 50-79 有疑虑
      'FAIL';                    // <50 失败

    log.info(`就绪度检查 ${specId}: ${result} (${score}/100)`); // 日志
    return { result, score, details }; // 返回评估结果
  }

  /**
   * 对抗性评审 - 模拟安全/性能/边界攻击场景
   *
   * 扫描内容中的安全风险词（password/secret/token/injection 等）
   * 和性能风险词（unbounded/no limit/infinite 等），返回 findings 列表。
   *
   * @param specId  - Spec ID（用于日志关联）
   * @param content - 需要评审的内容文本
   * @returns findings 列表（每项包含类型、严重性、消息）
   */
  async adversarialReview(specId: string, content: string): Promise<{
    findings: Array<{
      type: 'security' | 'performance' | 'reliability'; // 发现类型
      severity: 'high' | 'medium' | 'low';              // 严重性
      message: string;                                   // 发现描述
    }>;
    summary: string; // 总体摘要
  }> {
    const findings: Array<{
      type: 'security' | 'performance' | 'reliability';
      severity: 'high' | 'medium' | 'low';
      message: string;
    }> = [];

    const lowerContent = content.toLowerCase(); // 转小写便于匹配

    // 安全风险扫描（高危关键词）
    const securityHighRisk = ['password', 'secret', 'token', 'injection', 'sql injection', 'xss', 'csrf']; // 高危安全词
    for (const keyword of securityHighRisk) {
      if (lowerContent.includes(keyword)) { // 发现关键词
        findings.push({
          type: 'security',    // 安全类型
          severity: 'high',    // 高危
          message: `发现安全风险关键词「${keyword}」，请确认是否有安全防护措施`, // 描述
        });
      }
    }

    // 安全风险扫描（中危关键词）
    const securityMedRisk = ['api key', 'credential', 'auth', 'plaintext', 'unencrypted']; // 中危安全词
    for (const keyword of securityMedRisk) {
      if (lowerContent.includes(keyword)) { // 发现关键词
        findings.push({
          type: 'security',    // 安全类型
          severity: 'medium',  // 中危
          message: `发现安全相关词「${keyword}」，建议确认数据处理规范`, // 描述
        });
      }
    }

    // 性能风险扫描
    const perfRisk = ['unbounded', 'no limit', 'infinite', 'loop forever', 'no timeout', 'unlimited']; // 性能风险词
    for (const keyword of perfRisk) {
      if (lowerContent.includes(keyword)) { // 发现关键词
        findings.push({
          type: 'performance', // 性能类型
          severity: 'medium',  // 中危
          message: `发现性能风险词「${keyword}」，建议添加边界限制`, // 描述
        });
      }
    }

    // 可靠性风险扫描
    const reliabilityRisk = ['no retry', 'no fallback', 'ignore error', 'swallow exception', 'silent fail']; // 可靠性风险词
    for (const keyword of reliabilityRisk) {
      if (lowerContent.includes(keyword)) { // 发现关键词
        findings.push({
          type: 'reliability', // 可靠性类型
          severity: 'medium',  // 中危
          message: `发现可靠性风险词「${keyword}」，建议添加错误处理机制`, // 描述
        });
      }
    }

    // 生成摘要
    const highCount = findings.filter(f => f.severity === 'high').length; // 高危数量
    const medCount = findings.filter(f => f.severity === 'medium').length; // 中危数量
    const summary = findings.length === 0
      ? '对抗性评审通过，未发现明显风险'  // 无发现
      : `发现 ${findings.length} 个风险点（高危: ${highCount}，中危: ${medCount}）`; // 汇总

    log.info(`对抗性评审 ${specId}: ${summary}`); // 日志
    return { findings, summary }; // 返回评审结果
  }

  /**
   * 边界场景发现 - 扫描内容中的潜在边界问题
   *
   * 检测空值/边界/并发/超时等高风险模式，返回边界场景列表。
   *
   * @param specId  - Spec ID（用于日志关联）
   * @param content - 需要分析的内容文本
   * @returns edge cases 列表
   */
  async edgeCaseHunter(specId: string, content: string): Promise<{
    edgeCases: Array<{
      category: string; // 类别
      description: string; // 描述
      suggestion: string; // 建议
    }>;
    count: number; // 总发现数量
  }> {
    const edgeCases: Array<{
      category: string;
      description: string;
      suggestion: string;
    }> = [];

    const lowerContent = content.toLowerCase(); // 转小写便于匹配

    // 空值/null 边界检查
    if (!lowerContent.includes('null check') && !lowerContent.includes('empty check') &&
        (lowerContent.includes('null') || lowerContent.includes('undefined') || lowerContent.includes('empty'))) {
      edgeCases.push({
        category: '空值边界',        // 类别
        description: '内容涉及 null/undefined/empty，但未明确说明空值处理策略', // 描述
        suggestion: '建议明确定义 null/empty 输入时的行为（拒绝/默认值/透传）', // 建议
      });
    }

    // 并发安全检查
    if (lowerContent.includes('concurrent') || lowerContent.includes('parallel') ||
        lowerContent.includes('thread') || lowerContent.includes('async') ||
        lowerContent.includes('并发') || lowerContent.includes('多线程')) {
      if (!lowerContent.includes('lock') && !lowerContent.includes('mutex') &&
          !lowerContent.includes('atomic') && !lowerContent.includes('synchronized')) {
        edgeCases.push({
          category: '并发安全',          // 类别
          description: '内容涉及并发/异步操作，但未说明并发控制策略', // 描述
          suggestion: '建议明确说明互斥锁、原子操作或乐观锁策略', // 建议
        });
      }
    }

    // 超时处理检查
    if (lowerContent.includes('network') || lowerContent.includes('http') ||
        lowerContent.includes('request') || lowerContent.includes('call') ||
        lowerContent.includes('接口') || lowerContent.includes('请求')) {
      if (!lowerContent.includes('timeout') && !lowerContent.includes('超时')) {
        edgeCases.push({
          category: '超时处理',        // 类别
          description: '内容涉及网络请求/外部调用，但未说明超时策略', // 描述
          suggestion: '建议设置合理的超时时间并定义超时后的降级行为', // 建议
        });
      }
    }

    // 大数据量边界检查
    if (lowerContent.includes('list') || lowerContent.includes('array') ||
        lowerContent.includes('query') || lowerContent.includes('列表') ||
        lowerContent.includes('查询')) {
      if (!lowerContent.includes('pagination') && !lowerContent.includes('page') &&
          !lowerContent.includes('limit') && !lowerContent.includes('分页')) {
        edgeCases.push({
          category: '数据量边界',      // 类别
          description: '内容涉及列表/查询操作，但未说明分页或数量限制策略', // 描述
          suggestion: '建议添加分页机制或明确最大返回数量限制', // 建议
        });
      }
    }

    // 错误重试边界检查
    if (lowerContent.includes('retry') || lowerContent.includes('重试')) {
      if (!lowerContent.includes('max retry') && !lowerContent.includes('backoff') &&
          !lowerContent.includes('最大重试')) {
        edgeCases.push({
          category: '重试边界',        // 类别
          description: '内容涉及重试逻辑，但未明确最大重试次数或退避策略', // 描述
          suggestion: '建议明确最大重试次数（如 3 次）和指数退避策略', // 建议
        });
      }
    }

    log.info(`边界场景发现 ${specId}: 发现 ${edgeCases.length} 个边界场景`); // 日志
    return { edgeCases, count: edgeCases.length }; // 返回边界场景列表
  }

  // ─── v20.0 P2-13: UX 清单评审 ─────────────────────────────

  /** UX 清单单项结果 */
  // (内联类型，返回值中使用)

  /**
   * 结构化 UX 评审 - 扫描内容中的常见 UX 问题
   *
   * 检查五个维度：可访问性、响应式、加载状态、错误状态、导航，
   * 每个维度 20 分，满分 100。返回评分、清单明细和改进建议。
   *
   * @param content - 待评审的内容文本（Spec/PRD/代码等）
   * @returns { score, checklist, suggestions }
   */
  uxChecklist(content: string): {
    score: number; // 0-100 总分
    checklist: Array<{ category: string; passed: boolean; details: string }>; // 各维度结果
    suggestions: string[]; // 改进建议列表
  } {
    const lowerContent = content.toLowerCase(); // 转小写便于匹配
    const checklist: Array<{ category: string; passed: boolean; details: string }> = []; // 清单列表
    const suggestions: string[] = []; // 建议列表
    let score = 0; // 初始总分

    // ── 维度 1: 可访问性（Accessibility）──
    const a11yKeywords = ['alt text', 'alt=', 'aria-label', 'aria label', 'color contrast', 'keyboard nav', 'keyboard navigation', 'screen reader', 'wcag', 'a11y', '无障碍']; // 可访问性关键词
    const a11yHits = a11yKeywords.filter(kw => lowerContent.includes(kw)); // 命中的关键词
    const a11yPassed = a11yHits.length >= 2; // 至少命中 2 个才算通过
    if (a11yPassed) {
      score += 20; // 通过 +20
      checklist.push({ category: '可访问性', passed: true, details: `命中关键词: ${a11yHits.join(', ')}` }); // 记录明细
    } else {
      checklist.push({ category: '可访问性', passed: false, details: a11yHits.length > 0 ? `仅命中 ${a11yHits.join(', ')}，覆盖不足` : '未提及任何可访问性措施' }); // 记录失败
      suggestions.push('建议添加 alt text、aria-label、色彩对比度、键盘导航等可访问性说明'); // 建议
    }

    // ── 维度 2: 响应式（Responsiveness）──
    const respKeywords = ['mobile', 'responsive', 'breakpoint', 'media query', '@media', '自适应', '响应式', 'viewport', 'flex', 'grid layout']; // 响应式关键词
    const respHits = respKeywords.filter(kw => lowerContent.includes(kw)); // 命中的关键词
    const respPassed = respHits.length >= 2; // 至少命中 2 个
    if (respPassed) {
      score += 20; // 通过 +20
      checklist.push({ category: '响应式', passed: true, details: `命中关键词: ${respHits.join(', ')}` }); // 记录明细
    } else {
      checklist.push({ category: '响应式', passed: false, details: respHits.length > 0 ? `仅命中 ${respHits.join(', ')}，覆盖不足` : '未提及任何响应式设计' }); // 记录失败
      suggestions.push('建议添加移动端适配、断点策略、响应式布局等说明'); // 建议
    }

    // ── 维度 3: 加载状态（Loading States）──
    const loadKeywords = ['loading', 'spinner', 'skeleton', 'placeholder', '加载中', '骨架屏', 'progress', 'shimmer', 'lazy load']; // 加载状态关键词
    const loadHits = loadKeywords.filter(kw => lowerContent.includes(kw)); // 命中的关键词
    const loadPassed = loadHits.length >= 1; // 至少命中 1 个
    if (loadPassed) {
      score += 20; // 通过 +20
      checklist.push({ category: '加载状态', passed: true, details: `命中关键词: ${loadHits.join(', ')}` }); // 记录明细
    } else {
      checklist.push({ category: '加载状态', passed: false, details: '未提及任何加载状态处理' }); // 记录失败
      suggestions.push('建议添加 loading/spinner/skeleton 等加载状态说明'); // 建议
    }

    // ── 维度 4: 错误状态（Error States）──
    const errKeywords = ['error handling', 'error state', 'fallback', 'empty state', '错误处理', '空状态', 'error message', 'retry', '重试', 'toast', 'snackbar', '异常']; // 错误状态关键词
    const errHits = errKeywords.filter(kw => lowerContent.includes(kw)); // 命中的关键词
    const errPassed = errHits.length >= 1; // 至少命中 1 个
    if (errPassed) {
      score += 20; // 通过 +20
      checklist.push({ category: '错误状态', passed: true, details: `命中关键词: ${errHits.join(', ')}` }); // 记录明细
    } else {
      checklist.push({ category: '错误状态', passed: false, details: '未提及任何错误状态处理' }); // 记录失败
      suggestions.push('建议添加错误处理、空状态、fallback 降级等说明'); // 建议
    }

    // ── 维度 5: 导航（Navigation）──
    const navKeywords = ['breadcrumb', 'back button', 'navigation', 'nav bar', 'navbar', 'tab bar', 'tabbar', '面包屑', '返回按钮', '导航', 'sidebar', 'menu', 'router']; // 导航关键词
    const navHits = navKeywords.filter(kw => lowerContent.includes(kw)); // 命中的关键词
    const navPassed = navHits.length >= 1; // 至少命中 1 个
    if (navPassed) {
      score += 20; // 通过 +20
      checklist.push({ category: '导航', passed: true, details: `命中关键词: ${navHits.join(', ')}` }); // 记录明细
    } else {
      checklist.push({ category: '导航', passed: false, details: '未提及任何导航设计' }); // 记录失败
      suggestions.push('建议添加面包屑、返回按钮、导航栏等导航设计说明'); // 建议
    }

    log.info(`UX 清单评审: ${score}/100, 通过 ${checklist.filter(c => c.passed).length}/5 项`); // 日志
    return { score, checklist, suggestions }; // 返回评审结果
  }

  // ─── v20.0 P4-1/P4-2: 基于风险的测试策略生成 ──────────────────────────────

  /**
   * v20.0 P4-1/P4-2: 基于风险的测试策略生成
   * 评估 5 个维度（数据完整性/安全性/并发安全/集成稳定性/性能影响），返回结构化风险评估和测试建议
   * @param specId - Spec ID
   * @returns 风险评估结果和测试策略
   */
  async riskBasedTestStrategy(specId: string): Promise<{
    specId: string; // Spec ID
    overallRisk: 'low' | 'medium' | 'high' | 'critical'; // 总体风险等级
    dimensions: Array<{
      name: string; // 维度名称
      risk: 'low' | 'medium' | 'high' | 'critical'; // 维度风险等级
      score: number; // 1-10 风险评分
      rationale: string; // 评分依据
      testSuggestions: string[]; // 测试建议列表
    }>;
    prioritizedTests: string[]; // 按优先级排序的测试列表
    estimatedEffort: string; // 预估工作量
  }> {
    // 5 维评估维度
    const dimensionNames = ['数据完整性', '安全性', '并发安全', '集成稳定性', '性能影响'];

    // 读取 spec 内容（如果存在）
    let specContent = ''; // 初始化 spec 内容为空字符串
    try {
      const specDir = path.join(this.projectRoot, '.qflow', 'specs', specId); // 拼接 spec 目录路径
      const specFile = path.join(specDir, 'spec.md'); // 拼接 spec 文件路径
      specContent = await fs.readFile(specFile, 'utf-8'); // 读取 spec 文件内容
    } catch {
      specContent = `Spec ${specId} 内容未找到`; // 读取失败时使用默认内容
    }

    // 各维度关键词映射表（用于启发式风险评估）
    const keywords: Record<string, string[]> = {
      '数据完整性': ['database', 'migration', 'schema', 'transaction', '数据库', '迁移'], // 数据完整性相关词
      '安全性': ['auth', 'token', 'password', 'encrypt', 'session', '认证', '加密'],     // 安全性相关词
      '并发安全': ['concurrent', 'lock', 'mutex', 'thread', 'async', '并发', '锁'],       // 并发安全相关词
      '集成稳定性': ['api', 'webhook', 'external', 'integration', '接口', '集成'],        // 集成稳定性相关词
      '性能影响': ['cache', 'index', 'query', 'batch', 'performance', '缓存', '性能'],    // 性能影响相关词
    };

    // 评估每个维度
    const dimensions = dimensionNames.map((name) => {
      const kws = keywords[name] || []; // 获取该维度的关键词列表
      const contentLower = specContent.toLowerCase(); // 转小写便于匹配
      const hits = kws.filter(k => contentLower.includes(k)).length; // 统计命中关键词数量
      const score = Math.min(10, Math.max(1, hits * 2 + 1)); // 计算风险评分（1-10）

      // 根据评分确定风险等级
      const risk = score >= 8 ? 'critical' as const
        : score >= 6 ? 'high' as const
        : score >= 4 ? 'medium' as const
        : 'low' as const;

      // 根据风险评分生成测试建议列表
      const testSuggestions = [
        `${name} 单元测试`,                              // 基础单元测试
        `${name} 边界条件测试`,                          // 边界条件测试
        score >= 6 ? `${name} 压力测试` : `${name} 基本验证`, // 高风险时追加压力测试
      ];

      return {
        name,  // 维度名称
        risk,  // 风险等级
        score, // 风险评分
        rationale: hits > 0 ? `检测到 ${hits} 个相关关键词` : '未检测到明显风险指标', // 评分依据
        testSuggestions, // 测试建议
      };
    });

    // 计算所有维度的平均分，确定总体风险等级
    const avgScore = dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length;
    const overallRisk = avgScore >= 8 ? 'critical' as const
      : avgScore >= 6 ? 'high' as const
      : avgScore >= 4 ? 'medium' as const
      : 'low' as const;

    // 按风险评分降序排列各维度，生成优先测试列表
    const sorted = [...dimensions].sort((a, b) => b.score - a.score); // 降序排列
    const prioritizedTests = sorted.flatMap(d => d.testSuggestions.slice(0, 2)); // 每个维度取前 2 条建议

    // 根据平均风险评分估算工作量
    const estimatedEffort = avgScore >= 6 ? '3-5 天' : avgScore >= 4 ? '1-2 天' : '0.5-1 天';

    log.info(`风险测试策略 ${specId}: 总体风险 ${overallRisk}（均分 ${avgScore.toFixed(1)}）`); // 日志输出
    return {
      specId,          // Spec ID
      overallRisk,     // 总体风险等级
      dimensions,      // 各维度评估结果
      prioritizedTests, // 优先测试列表
      estimatedEffort, // 预估工作量
    };
  }

  /** v21.0 P2-1: 验收标准核查 */
  async acceptanceAudit(taskId: string): Promise<{taskId: string; criteria: Array<{criterion: string; status: 'pass'|'fail'|'unknown'; reason: string}>; passRate: number; verdict: 'PASS'|'FAIL'|'PARTIAL'}> {
    const task = await this.taskManager.getTask(taskId); // 获取任务
    if (!task) throw new Error(`任务 ${taskId} 不存在`); // 任务不存在则抛错

    const rawCriteria = task.description || ''; // v22.1: 直接使用 description 字段（Task 无 acceptanceCriteria 字段）
    const lines = typeof rawCriteria === 'string'
      ? rawCriteria.split('\n').filter((l: string) => l.trim().length > 0) // 按行分割
      : Array.isArray(rawCriteria) ? rawCriteria : [String(rawCriteria)]; // 数组或字符串

    if (lines.length === 0) { // 无验收标准
      return { taskId, criteria: [], passRate: 0, verdict: 'FAIL' as const };
    }

    // 关键词检查逻辑
    const doneKeywords = ['完成', '实现', '通过', '已', 'done', 'pass', 'complete', 'implement']; // 完成关键词
    const criteria = lines.map((line: string) => {
      const l = line.toLowerCase(); // 转小写
      const hasDone = doneKeywords.some(k => l.includes(k)); // 检查是否包含完成关键词
      return {
        criterion: line.trim(), // 标准内容
        status: hasDone ? 'pass' as const : 'unknown' as const, // 状态
        reason: hasDone ? '包含完成指示词' : '无法自动判定，需人工确认', // 原因
      };
    });

    const passCount = criteria.filter(c => c.status === 'pass').length; // 通过数
    const passRate = criteria.length > 0 ? passCount / criteria.length : 0; // 通过率
    const verdict = passRate >= 0.8 ? 'PASS' as const : passRate >= 0.5 ? 'PARTIAL' as const : 'FAIL' as const; // 判定

    return { taskId, criteria, passRate, verdict };
  }

  /** v21.0 P2-2: 三层并行审查合并 */
  async parallelReview(taskId: string): Promise<{
    taskId: string;
    layers: {
      adversarial: Awaited<ReturnType<ReviewManager['adversarialReview']>>; // 对抗性审查结果类型
      edgeCase: Awaited<ReturnType<ReviewManager['edgeCaseHunter']>>;       // 边界场景发现结果类型
      acceptance: Awaited<ReturnType<ReviewManager['acceptanceAudit']>>;   // 验收标准核查结果类型
    };
    summary: {totalFindings: number; criticalCount: number; verdict: string};
  }> {
    const task = await this.taskManager.getTask(taskId); // 获取任务
    if (!task) throw new Error(`任务 ${taskId} 不存在`);

    const content = task.description || ''; // 审查内容

    // 三层并行执行
    const [adversarial, edgeCase, acceptance] = await Promise.all([
      this.adversarialReview(taskId, content), // 对抗性审查
      this.edgeCaseHunter(taskId, content),   // 边界场景发现
      this.acceptanceAudit(taskId),           // 验收标准核查
    ]);

    const totalFindings = (adversarial.findings?.length || 0) + (edgeCase.edgeCases?.length || 0); // 总发现数
    const criticalCount = (adversarial.findings || []).filter((f: {type: string; severity: string; message: string}) => f.severity === 'critical').length; // 严重数
    const acceptVerdict = acceptance.verdict; // 验收判定
    const verdict = criticalCount > 0 ? 'BLOCK' : acceptVerdict === 'FAIL' ? 'CONCERNS' : 'PASS'; // 综合判定

    return {
      taskId,
      layers: { adversarial, edgeCase, acceptance }, // 三层结果
      summary: { totalFindings, criticalCount, verdict }, // 汇总
    };
  }

  /** v21.0 P2-3: 可点击 path:line 审查轨迹 */
  generateReviewTrace(review: {id?: string; targetId?: string; comments?: Array<{author: string; content: string; type?: string}>}): {reviewId: string; trace: Array<{step: number; action: string; detail: string; path?: string}>; markdown: string} {
    const reviewId = review.id || 'unknown'; // 评审 ID
    const trace: Array<{step: number; action: string; detail: string; path?: string}> = []; // 轨迹列表
    let step = 0; // 步骤计数

    // 添加评审创建步骤
    trace.push({ step: ++step, action: 'review_created', detail: `评审 ${reviewId} 创建`, path: `.qflow/reviews/${reviewId}.json` });

    // 添加评论步骤
    const comments = review.comments || [];
    for (const c of comments) {
      trace.push({
        step: ++step,
        action: c.type === 'issue' ? 'issue_raised' : c.type === 'suggestion' ? 'suggestion_made' : 'comment_added',
        detail: `[${c.author}] ${c.content.slice(0, 80)}${c.content.length > 80 ? '...' : ''}`, // 截断长评论
        path: `.qflow/reviews/${reviewId}.json:${step}`, // 可点击路径
      });
    }

    // 生成 Markdown 格式
    const mdLines = ['## 审查轨迹', '', `评审 ID: ${reviewId}`, '', '| 步骤 | 操作 | 详情 | 位置 |', '|------|------|------|------|'];
    for (const t of trace) {
      mdLines.push(`| ${t.step} | ${t.action} | ${t.detail} | ${t.path || '-'} |`);
    }

    return { reviewId, trace, markdown: mdLines.join('\n') };
  }

  /** v21.0 P2-4: 推理精化方法通用接口 */
  elicitate(method: typeof ELICITATION_METHODS[number], content: string): {method: string; questions: string[]; insights: string[]; recommendations: string[]} {
    // 每种方法的提示模板
    const templates: Record<string, {questionPrefix: string; insightPrefix: string}> = {
      'pre-mortem': { questionPrefix: '假设已失败，', insightPrefix: '潜在失败原因：' },
      'first-principles': { questionPrefix: '最基本的事实是什么？', insightPrefix: '基本原理：' },
      'inversion': { questionPrefix: '如何确保失败？', insightPrefix: '反面视角：' },
      'red-team': { questionPrefix: '攻击者会如何利用？', insightPrefix: '安全风险：' },
      'scenario-planning': { questionPrefix: '在最坏情况下会怎样？', insightPrefix: '情景推演：' },
      'assumption-mapping': { questionPrefix: '隐含的假设是什么？', insightPrefix: '假设验证：' },
      'five-whys': { questionPrefix: '为什么会这样？', insightPrefix: '根因追溯：' },
      'constraint-relaxation': { questionPrefix: '如果没有限制会怎样？', insightPrefix: '本质需求：' },
    };

    const tmpl = templates[method] || templates['first-principles']; // 获取模板
    const contentWords = content.split(/\s+/).filter(w => w.length > 1); // 内容分词
    const keyTerms = contentWords.slice(0, 5).join('、'); // 取前 5 个关键词

    // 生成问题列表（基于方法特点）
    const questions = [
      `${tmpl.questionPrefix}关于"${keyTerms}"`, // 主问题
      `${tmpl.questionPrefix}有哪些未考虑的因素？`, // 补充问题
      `从${method}角度看，最大的风险是什么？`, // 风险问题
    ];

    // 生成洞察（基于内容分析）
    const insights = [
      `${tmpl.insightPrefix}内容涉及 ${contentWords.length} 个关键概念`, // 概念数
      `${tmpl.insightPrefix}建议从 ${method} 角度深入分析`, // 建议
    ];

    // 生成建议
    const recommendations = [
      `使用 ${method} 方法对 "${keyTerms}" 进行深度分析`, // 分析建议
      `结合其他方法（如 ${ELICITATION_METHODS.filter(m => m !== method).slice(0, 2).join('、')}）交叉验证`, // 交叉验证
    ];

    return { method, questions, insights, recommendations };
  }

  /** v21.0 P2-6: 根因分析 RCA 金字塔报告 */
  async rootCauseAnalysis(commitHash?: string): Promise<{commitHash: string; pyramid: {symptom: string; directCause: string; rootCauses: string[]; systemicFactors: string[]}; recommendations: string[]; severity: 'low'|'medium'|'high'|'critical'}> {
    const hash = commitHash || 'HEAD'; // 默认 HEAD

    // 尝试读取 git log 信息
    let commitMsg = `commit ${hash}`; // 默认消息
    try {
      const { execFile } = await import('node:child_process'); // 动态导入
      const { promisify } = await import('node:util');
      const execFileAsync = promisify(execFile);
      const result = await execFileAsync('git', ['log', '-1', '--pretty=format:%s', hash], { cwd: this.projectRoot, timeout: 5000 }); // 获取 commit 消息
      commitMsg = result.stdout.trim() || commitMsg; // 使用实际消息
    } catch { /* git 不可用时使用默认值 */ }

    // 分析 commit 消息中的关键词
    const bugKeywords = ['fix', 'bug', '修复', '修正', 'hotfix', 'patch', 'error', 'crash']; // bug 相关关键词
    const isBugFix = bugKeywords.some(k => commitMsg.toLowerCase().includes(k)); // 是否为 bug 修复

    // 构建 RCA 金字塔
    const pyramid = {
      symptom: isBugFix ? `Bug 修复: ${commitMsg}` : `变更: ${commitMsg}`, // 症状层
      directCause: isBugFix ? '代码实现与预期行为不一致' : '功能需求变更', // 直接原因
      rootCauses: isBugFix
        ? ['缺少边界条件检查', '测试覆盖不足', '需求理解偏差'] // bug 根因
        : ['需求变更', '技术债积累', '架构适配'], // 变更根因
      systemicFactors: ['代码审查流程待加强', '自动化测试覆盖率待提升', '文档同步机制待完善'], // 系统性因素
    };

    // 推荐措施
    const recommendations = [
      '增加相关场景的自动化测试用例', // 测试建议
      '加强代码审查中的边界条件检查', // 审查建议
      '更新相关 Spec 文档', // 文档建议
    ];

    // 严重程度判定
    const severity = commitMsg.toLowerCase().includes('crash') || commitMsg.toLowerCase().includes('崩溃') ? 'critical' as const
      : isBugFix ? 'medium' as const
      : 'low' as const;

    return { commitHash: hash, pyramid, recommendations, severity };
  }

  /** v21.0 P2-7: 三层故障诊断路由 */
  faultDiagnose(errorContext: string): {layer: typeof FAULT_LAYERS[number]; confidence: number; diagnosis: string; suggestedFix: string; relatedTools: string[]} {
    const ctx = errorContext.toLowerCase(); // 转小写

    // intent 层检测关键词
    const intentKeywords = ['需求', '理解', '预期', 'requirement', 'expected', 'should', 'intent', '功能', '用户'];
    // spec 层检测关键词
    const specKeywords = ['spec', '规格', '设计', '架构', 'schema', '接口', 'api', '文档', 'contract'];
    // code 层检测关键词
    const codeKeywords = ['error', 'bug', '异常', 'exception', 'crash', 'null', 'undefined', '编译', 'runtime', 'type'];

    // 计算各层匹配度
    const intentScore = intentKeywords.filter(k => ctx.includes(k)).length; // intent 层匹配数
    const specScore = specKeywords.filter(k => ctx.includes(k)).length;     // spec 层匹配数
    const codeScore = codeKeywords.filter(k => ctx.includes(k)).length;     // code 层匹配数

    // 选择最高匹配层
    const scores = [
      { layer: 'intent' as const, score: intentScore },
      { layer: 'spec' as const, score: specScore },
      { layer: 'code' as const, score: codeScore },
    ];
    scores.sort((a, b) => b.score - a.score); // 降序排列

    const best = scores[0]; // 最佳匹配
    const total = intentScore + specScore + codeScore; // 总匹配数
    const confidence = total > 0 ? best.score / total : 0.33; // 置信度

    // 各层诊断和修复建议
    const layerInfo: Record<string, {diagnosis: string; suggestedFix: string; relatedTools: string[]}> = {
      intent: {
        diagnosis: '需求理解偏差导致实现与预期不符', // intent 层诊断
        suggestedFix: '重新与利益相关者确认需求，使用 elicitate 方法深入分析', // 修复建议
        relatedTools: ['qflow_elicitate', 'qflow_research', 'qflow_clarification_start'], // 相关工具
      },
      spec: {
        diagnosis: '规格文档缺陷导致实现偏离', // spec 层诊断
        suggestedFix: '审查并修正 Spec 文档，使用 adversarial_review 检查规格质量', // 修复建议
        relatedTools: ['qflow_spec_verify', 'qflow_adversarial_review', 'qflow_readiness_gate'], // 相关工具
      },
      code: {
        diagnosis: '代码实现存在 bug 或技术缺陷', // code 层诊断
        suggestedFix: '定位具体代码问题，添加测试用例，使用 edge_case_hunter 查找边界场景', // 修复建议
        relatedTools: ['qflow_edge_case_hunter', 'qflow_risk_test_strategy', 'qflow_root_cause_analysis'], // 相关工具
      },
    };

    const info = layerInfo[best.layer]; // 获取对应层信息
    return {
      layer: best.layer,
      confidence: Math.round(confidence * 100) / 100, // 保留两位小数
      ...info,
    };
  }

}

/** v21.0 P2-5: 8 种推理精化方法 */
export const ELICITATION_METHODS = [
  'pre-mortem',           // 事前尸检：假设已失败，反推原因
  'first-principles',     // 第一性原理：从基本事实推导
  'inversion',           // 逆向思维：从反面思考问题
  'red-team',            // 红队对抗：模拟攻击者视角
  'scenario-planning',   // 情景规划：多场景推演
  'assumption-mapping',  // 假设映射：列出并验证所有假设
  'five-whys',           // 五个为什么：逐层追问根因
  'constraint-relaxation' // 约束松弛：移除约束看本质
] as const;

/** v21.0 P2-8: 三层故障诊断层级 */
export const FAULT_LAYERS = ['intent', 'spec', 'code'] as const;