/**
 * 审批管理器 - 变更审批策略和投票管理
 *
 * 管理审批流程的创建、投票、判定和自动审批规则。
 * 数据目录:
 *   - {projectRoot}/.qflow/approvals/{approvalId}.json
 *   - {projectRoot}/.qflow/approval-rules/{ruleId}.json
 *
 * 函数列表:
 * - createApproval()    创建审批流程
 * - vote()              投票
 * - checkApproval()     检查审批是否通过
 * - createAutoRule()    创建自动审批规则
 * - listApprovals()     列出所有审批
 * - listAutoRules()     列出自动审批规则
 */

import path from 'node:path'; // 路径拼接工具
import { promises as fs } from 'node:fs'; // 异步文件操作
import { readJSONSafe, writeJSON, ensureDir, fileExists, withFileLock, readJSONUnlocked, writeJSONUnlocked } from '../utils/file-io.js'; // 文件读写工具（含事务锁）
import { log } from '../utils/logger.js'; // 日志工具
import { ApprovalSchema, AutoApprovalRuleSchema } from '../schemas/approval.js'; // 审批 Zod Schema
import { uniqueId, sanitizeId, QFLOW_DIR } from '../shared/tool-utils.js'; // 全局唯一 ID 生成工具 + .qflow 目录常量

/** 审批数据目录 */
const APPROVALS_DIR = 'approvals'; // 审批文件目录

/** 自动审批规则目录 */
const RULES_DIR = 'approval-rules'; // 规则文件目录

/** 审批策略类型 */
export type ApprovalStrategy = 'unanimous' | 'majority' | 'any'; // 全票 / 多数 / 任一

/** 审批状态 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'; // 待定 / 通过 / 拒绝

/** 单次投票记录 */
export interface Vote {
  voter: string; // 投票人
  decision: 'approve' | 'reject'; // 投票决定
  reason: string; // 投票理由
  votedAt: string; // 投票时间
}

/** 审批流程 */
export interface Approval {
  id: string; // 审批唯一 ID，格式: AP{timestamp}
  changeId: string; // 关联的变更 ID
  strategy: ApprovalStrategy; // 审批策略
  requiredVoters: string[]; // 必须投票的人员列表
  votes: Vote[]; // 投票记录列表
  status: ApprovalStatus; // 当前状态
  title?: string; // 审批标题
  targetType?: string; // 审批目标类型
  createdAt: string; // 创建时间
  updatedAt: string; // 更新时间
  resolvedAt: string | null; // 审批完成时间
}

/** 自动审批规则条件 */
export interface AutoRuleCondition {
  field: string; // 匹配字段（如 'tags', 'priority', 'category'）
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'eq'; // 匹配操作符（eq 为 equals 别名）
  value: string | number; // 匹配值
}

/** 自动审批规则 */
export interface AutoApprovalRule {
  id: string; // 规则唯一 ID，格式: AR{timestamp}
  name: string; // 规则名称
  description: string; // 规则描述
  conditions: AutoRuleCondition[]; // 匹配条件列表（AND 关系）
  enabled: boolean; // 是否启用
  createdAt: string; // 创建时间
}

/**
 * 审批管理器类
 *
 * 每个实例绑定一个项目根目录，操作该项目的审批数据和规则。
 */
export class ApprovalManager {
  /** 项目根目录绝对路径 */
  private readonly projectRoot: string;

  /** 审批目录路径 */
  private readonly approvalsDir: string;

  /** 规则目录路径 */
  private readonly rulesDir: string;

  /**
   * @param projectRoot - 项目根目录绝对路径
   */
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot; // 保存项目根路径
    this.approvalsDir = path.join(projectRoot, QFLOW_DIR, APPROVALS_DIR); // 拼接审批目录
    this.rulesDir = path.join(projectRoot, QFLOW_DIR, RULES_DIR); // 拼接规则目录
  }

  /**
   * 创建审批流程
   *
   * @param changeId       - 关联的变更 ID
   * @param strategy       - 审批策略
   * @param requiredVoters - 必须投票的人员列表
   * @param title          - 审批标题（可选）
   * @param targetType     - 审批目标类型（可选）
   * @returns 新创建的审批对象
   */
  async createApproval(
    changeId: string,
    strategy: ApprovalStrategy,
    requiredVoters: string[],
    title?: string,
    targetType?: string,
  ): Promise<Approval> {
    if (requiredVoters.length === 0) { // 必须有至少一个投票人
      throw new Error('requiredVoters 不能为空'); // 抛出错误
    }

    const approvalId = uniqueId('AP'); // 生成全局唯一审批 ID（防止碰撞）
    const now = new Date().toISOString(); // 当前时间戳

    const approval: Approval = { // 构造审批对象
      id: approvalId, // 唯一标识
      changeId, // 关联变更
      strategy, // 审批策略
      requiredVoters, // 必须投票人
      votes: [], // 投票记录（初始为空）
      status: 'pending', // 初始状态：待定
      title, // 审批标题
      targetType, // 审批目标类型
      createdAt: now, // 创建时间
      updatedAt: now, // 更新时间
      resolvedAt: null, // 未完成
    };

    await ensureDir(this.approvalsDir); // 确保目录存在
    await writeJSON(path.join(this.approvalsDir, `${approvalId}.json`), approval); // 写入文件
    log.info(`审批已创建: ${approvalId} → 变更 ${changeId}，策略: ${strategy}`); // 信息日志
    return approval; // 返回新审批
  }

  /**
   * 投票
   *
   * @param approvalId - 审批 ID
   * @param voter      - 投票人
   * @param decision   - 投票决定
   * @param reason     - 投票理由
   * @returns 更新后的审批对象
   */
  async vote(
    approvalId: string,
    voter: string,
    decision: 'approve' | 'reject',
    reason: string,
  ): Promise<Approval> {
    const safeId = sanitizeId(approvalId); // 防止路径遍历攻击
    const filePath = path.join(this.approvalsDir, `${safeId}.json`); // 审批文件路径

    // 使用 withFileLock 保护整个读-改-写事务，消除并发投票的 TOCTOU 竞态窗口
    return await withFileLock(filePath, async () => {
      // 在持锁期间直接读取（使用无锁版本，避免与外层锁死锁）
      const rawData = await readJSONUnlocked<unknown>(filePath); // 读取原始数据
      const parseResult = ApprovalSchema.safeParse(rawData); // 用 Schema 校验
      const approval = parseResult.success ? parseResult.data : null; // 校验通过则取数据

      if (!approval) throw new Error(`审批 ${approvalId} 不存在`); // 校验存在
      if (approval.status !== 'pending') throw new Error(`审批 ${approvalId} 已完成，无法投票`); // 校验状态

      // 检查投票人是否在必须投票列表中
      if (!approval.requiredVoters.includes(voter)) { // 不在列表中
        throw new Error(`${voter} 不在审批 ${approvalId} 的必须投票人列表中`); // 抛出错误
      }

      // 检查是否已投票（在同一锁内检查，避免并发重复投票）
      const existingVote = approval.votes.find((v) => v.voter === voter); // 查找已有投票
      if (existingVote) { // 已投过票
        throw new Error(`${voter} 已在审批 ${approvalId} 中投过票`); // 抛出错误
      }

      const vote: Vote = { // 构造投票记录
        voter, // 投票人
        decision, // 决定
        reason, // 理由
        votedAt: new Date().toISOString(), // 投票时间
      };

      approval.votes.push(vote); // 追加投票记录
      approval.updatedAt = new Date().toISOString(); // 刷新更新时间

      await writeJSONUnlocked(filePath, approval); // 无锁写入（外层 withFileLock 已持锁）
      log.info(`投票已记录: ${voter} → ${decision} → 审批 ${approvalId}`); // 信息日志
      return approval; // 返回更新后的审批
    });
  }

  /**
   * 评估单个条件是否匹配上下文
   *
   * @param condition - 自动审批规则条件
   * @param context   - 审批上下文键值对
   * @returns 条件是否匹配
   */
  private evaluateCondition(condition: AutoRuleCondition, context: Record<string, unknown>): boolean {
    const fieldValue = context[condition.field]; // 从上下文取出字段值
    if (fieldValue === undefined || fieldValue === null) return false; // 字段不存在则不匹配

    switch (condition.operator) { // 按操作符判定
      case 'equals':
      case 'eq': { // 等于（eq 为 equals 别名）
        return String(fieldValue) === String(condition.value); // 字符串相等比较
      }
      case 'contains': { // 包含
        return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase()); // 大小写不敏感包含
      }
      case 'gt': { // 大于
        return Number(fieldValue) > Number(condition.value); // 数值大于比较
      }
      case 'lt': { // 小于
        return Number(fieldValue) < Number(condition.value); // 数值小于比较
      }
      default: {
        log.warn(`未知的条件操作符: ${condition.operator}`); // 未知操作符警告
        return false; // 不匹配
      }
    }
  }

  /**
   * 评估所有自动审批规则是否触发
   *
   * 加载所有启用的规则，对每条规则的所有条件进行 AND 判定。
   * 任一规则的全部条件匹配即触发自动审批。
   *
   * @param context - 审批上下文键值对
   * @returns 触发的规则，若无触发返回 null
   */
  private async evaluateAutoRules(context: Record<string, unknown>): Promise<AutoApprovalRule | null> {
    const rules = await this.listAutoRules(true); // 仅加载启用的规则
    if (rules.length === 0) return null; // 无规则则跳过

    for (const rule of rules) { // 遍历每条规则
      const allMatch = rule.conditions.every(cond => this.evaluateCondition(cond, context)); // 所有条件 AND 判定
      if (allMatch) { // 全部条件匹配
        log.info(`自动审批规则触发: ${rule.id} - ${rule.name}，条件全部匹配`); // 记录触发日志
        return rule; // 返回触发的规则
      }
    }

    return null; // 无规则触发
  }

  /**
   * 检查审批是否通过
   *
   * 根据策略判定审批结果。同时评估自动审批规则：
   * 若任一规则的全部条件匹配审批上下文，则自动通过。
   * 更新状态并持久化。
   *
   * @param approvalId - 审批 ID
   * @param context    - 可选的审批上下文键值对（用于自动审批规则评估）
   * @returns 审批结果: { passed, approval, autoRuleTriggered? }
   */
  async checkApproval(
    approvalId: string,
    context?: Record<string, unknown>,
  ): Promise<{ passed: boolean; approval: Approval; autoRuleTriggered?: string }> {
    const approval = await this.getApproval(approvalId); // 获取审批
    if (!approval) throw new Error(`审批 ${approvalId} 不存在`); // 校验存在

    if (approval.status !== 'pending') { // 已完成的直接返回
      return { passed: approval.status === 'approved', approval }; // 返回已有结果
    }

    // ===== 自动审批规则评估 =====
    if (context && Object.keys(context).length > 0) { // 有上下文时才评估
      const triggeredRule = await this.evaluateAutoRules(context); // 评估所有启用规则
      if (triggeredRule) { // 有规则触发
        const now = new Date().toISOString(); // 当前时间
        approval.status = 'approved'; // 标记为自动通过
        approval.resolvedAt = now; // 记录完成时间
        approval.updatedAt = now; // 刷新更新时间
        await writeJSON(path.join(this.approvalsDir, `${sanitizeId(approvalId)}.json`), approval); // 持久化
        log.info(`审批 ${approvalId} 被自动审批规则 ${triggeredRule.id} (${triggeredRule.name}) 通过`); // 信息日志
        return { passed: true, approval, autoRuleTriggered: triggeredRule.id }; // 返回结果含触发规则 ID
      }
    }

    // ===== 投票策略判定 =====
    const approveCount = approval.votes.filter((v) => v.decision === 'approve').length; // 赞同票数
    const rejectCount = approval.votes.filter((v) => v.decision === 'reject').length; // 反对票数
    const totalRequired = approval.requiredVoters.length; // 必须投票总人数
    const totalVoted = approval.votes.length; // 已投票人数

    let passed = false; // 默认未通过
    let resolved = false; // 默认未判定

    switch (approval.strategy) { // 按策略判定
      case 'unanimous': { // 全票通过
        if (rejectCount > 0) { // 有反对票
          passed = false; // 未通过
          resolved = true; // 可以判定
        } else if (approveCount === totalRequired) { // 全部赞同
          passed = true; // 通过
          resolved = true; // 可以判定
        }
        break;
      }
      case 'majority': { // 多数通过
        if (totalVoted === totalRequired) { // 所有人都投了票
          passed = approveCount > rejectCount; // 赞同多于反对
          resolved = true; // 可以判定
        } else if (approveCount > totalRequired / 2) { // 赞同已过半
          passed = true; // 提前通过
          resolved = true; // 可以判定
        } else if (rejectCount >= totalRequired / 2) { // 反对已过半
          passed = false; // 提前拒绝
          resolved = true; // 可以判定
        }
        break;
      }
      case 'any': { // 任一通过
        if (approveCount > 0) { // 有赞同票
          passed = true; // 通过
          resolved = true; // 可以判定
        } else if (totalVoted === totalRequired) { // 全部投完但没有赞同
          passed = false; // 未通过
          resolved = true; // 可以判定
        }
        break;
      }
    }

    if (resolved) { // 可以判定结果
      const now = new Date().toISOString(); // 当前时间
      approval.status = passed ? 'approved' : 'rejected'; // 更新状态
      approval.resolvedAt = now; // 记录完成时间
      approval.updatedAt = now; // 刷新更新时间
      await writeJSON(path.join(this.approvalsDir, `${sanitizeId(approvalId)}.json`), approval); // 持久化
      log.info(`审批 ${approvalId} 已判定: ${approval.status}`); // 信息日志
    }

    return { passed, approval }; // 返回结果
  }

  /**
   * 创建自动审批规则
   *
   * @param name        - 规则名称
   * @param description - 规则描述
   * @param conditions  - 匹配条件列表
   * @returns 新创建的规则对象
   */
  async createAutoRule(
    name: string,
    description: string,
    conditions: AutoRuleCondition[],
  ): Promise<AutoApprovalRule> {
    if (conditions.length === 0) { // 必须有至少一个条件
      throw new Error('自动审批规则必须至少有一个条件'); // 抛出错误
    }

    const ruleId = uniqueId('AR'); // 生成全局唯一规则 ID（防止碰撞）
    const rule: AutoApprovalRule = { // 构造规则对象
      id: ruleId, // 唯一标识
      name, // 名称
      description, // 描述
      conditions, // 条件列表
      enabled: true, // 默认启用
      createdAt: new Date().toISOString(), // 创建时间
    };

    await ensureDir(this.rulesDir); // 确保目录存在
    await writeJSON(path.join(this.rulesDir, `${ruleId}.json`), rule); // 写入文件
    log.info(`自动审批规则已创建: ${ruleId} - ${name}`); // 信息日志
    return rule; // 返回新规则
  }

  /**
   * 获取审批详情
   *
   * @param approvalId - 审批 ID
   * @returns 审批对象，未找到返回 null
   */
  private async getApproval(approvalId: string): Promise<Approval | null> {
    const safeId = sanitizeId(approvalId); // 防止路径遍历攻击
    const filePath = path.join(this.approvalsDir, `${safeId}.json`); // 拼接文件路径
    return readJSONSafe(filePath, ApprovalSchema); // 读取并校验后返回
  }

  /**
   * 列出所有审批
   *
   * @param filter - 可选过滤条件
   * @returns 审批列表
   */
  async listApprovals(filter?: { status?: ApprovalStatus; changeId?: string }): Promise<Approval[]> {
    if (!(await fileExists(this.approvalsDir))) return []; // 目录不存在返回空

    const entries = await fs.readdir(this.approvalsDir); // 读取目录内容
    const approvals: Approval[] = []; // 结果列表

    for (const entry of entries) { // 遍历每个文件
      if (!entry.endsWith('.json')) continue; // 跳过非 JSON
      const approval = await readJSONSafe(path.join(this.approvalsDir, entry), ApprovalSchema); // 读取并校验审批
      if (!approval) continue; // 读取失败跳过

      if (filter?.status && approval.status !== filter.status) continue; // 状态不匹配
      if (filter?.changeId && approval.changeId !== filter.changeId) continue; // 变更 ID 不匹配

      approvals.push(approval); // 追加到结果
    }

    return approvals.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // 按创建时间降序
  }

  /**
   * 列出所有自动审批规则
   *
   * @param enabledOnly - 是否仅返回启用的规则，默认 false
   * @returns 规则列表
   */
  async listAutoRules(enabledOnly = false): Promise<AutoApprovalRule[]> {
    if (!(await fileExists(this.rulesDir))) return []; // 目录不存在返回空

    const entries = await fs.readdir(this.rulesDir); // 读取目录内容
    const rules: AutoApprovalRule[] = []; // 结果列表

    for (const entry of entries) { // 遍历每个文件
      if (!entry.endsWith('.json')) continue; // 跳过非 JSON
      const rule = await readJSONSafe(path.join(this.rulesDir, entry), AutoApprovalRuleSchema); // 读取并校验规则
      if (!rule) continue; // 读取失败跳过

      if (enabledOnly && !rule.enabled) continue; // 仅启用过滤

      rules.push(rule); // 追加到结果
    }

    return rules; // 返回规则列表
  }
}
