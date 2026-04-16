/**
 * Approval Schema - 审批数据模型
 *
 * 定义审批流程、投票和自动审批规则的数据结构：
 * - ApprovalSchema: 审批流程
 * - ApprovalVoteSchema: 投票记录
 * - AutoApprovalRuleSchema: 自动审批规则
 */

import { z } from 'zod';

// 审批状态枚举
export const ApprovalStatusSchema = z.enum([
  'pending',    // 等待审批
  'approved',   // 已通过
  'rejected',   // 已拒绝
]);

// 审批策略枚举
export const ApprovalStrategySchema = z.enum([
  'unanimous',  // 全票通过
  'majority',   // 多数通过
  'any',        // 任一通过
]);

// 投票记录
export const ApprovalVoteSchema = z.object({
  voter: z.string(),                       // 投票人
  decision: z.enum(['approve', 'reject']), // 投票决定
  reason: z.string(),                      // 投票理由（必填）
  votedAt: z.string(),                     // 投票时间
});

// 自动审批规则条件
export const AutoRuleConditionSchema = z.object({
  field: z.string(),                                              // 匹配字段（如 'tags', 'priority', 'category'）
  operator: z.enum(['equals', 'contains', 'gt', 'lt', 'eq']),   // 匹配操作符（eq 为 equals 别名）
  value: z.union([z.string(), z.number()]),                      // 匹配值（字符串或数字）
});

// 自动审批规则
export const AutoApprovalRuleSchema = z.object({
  id: z.string(),                                   // 规则 ID
  name: z.string(),                                 // 规则名称
  description: z.string(),                          // 规则描述（必填）
  conditions: z.array(AutoRuleConditionSchema),     // 匹配条件列表（AND 关系）
  enabled: z.boolean().default(true),               // 是否启用
  createdAt: z.string(),                            // 创建时间
});

// 审批流程
export const ApprovalSchema = z.object({
  id: z.string(),                                        // 审批 ID
  changeId: z.string(),                                  // 关联的变更 ID
  strategy: ApprovalStrategySchema,                      // 审批策略
  requiredVoters: z.array(z.string()).default([]),        // 必须投票的人
  votes: z.array(ApprovalVoteSchema).default([]),         // 已投票列表
  status: ApprovalStatusSchema,                          // 审批状态
  title: z.string().optional(),                          // 审批标题（可选）
  targetType: z.string().optional(),                     // 审批目标类型（可选字符串）
  createdAt: z.string(),                                 // 创建时间
  updatedAt: z.string(),                                 // 更新时间
  resolvedAt: z.string().nullable(),                     // 完成时间（可为 null，不可省略）
});

// 导出推导类型
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;
export type ApprovalStrategy = z.infer<typeof ApprovalStrategySchema>;
export type ApprovalVote = z.infer<typeof ApprovalVoteSchema>;
export type AutoRuleCondition = z.infer<typeof AutoRuleConditionSchema>;
export type AutoApprovalRule = z.infer<typeof AutoApprovalRuleSchema>;
export type Approval = z.infer<typeof ApprovalSchema>;
