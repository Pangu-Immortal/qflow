/**
 * Delta Change Schema - 增量变更数据模型定义
 *
 * 定义 qflow 增量变更追踪系统的数据结构，包括：
 * - ChangeTypeSchema: 变更类型枚举（新增/修改/删除/重命名）
 * - ChangeItemSchema: 单条变更记录
 * - DeltaChangeStatusSchema: 变更状态枚举
 * - DeltaChangeSchema: 一次增量变更的完整结构
 */

import { z } from 'zod';

// 变更类型枚举
export const ChangeTypeSchema = z.enum([
  'ADDED',    // 新增
  'MODIFIED', // 修改
  'REMOVED',  // 删除
  'RENAMED',  // 重命名
]);

// 单条变更记录
export const ChangeItemSchema = z.object({
  type: ChangeTypeSchema,              // 变更类型
  section: z.string().min(1),          // 变更所在的章节/区域
  before: z.string().optional(),       // 变更前内容
  after: z.string().optional(),        // 变更后内容
  rationale: z.string().min(1),        // 变更原因说明
  impact: z.enum(['breaking', 'minor', 'patch']).optional(), // v12.0: 影响级别（breaking=MUST/SHALL 变更, minor=一般变更, patch=微小修复）
  baseHash: z.string().optional(),     // v15.0 OS-1: 基线指纹哈希（用于变更冲突检测）
});

// 变更状态枚举
export const DeltaChangeStatusSchema = z.enum([
  'pending',  // 待应用
  'applied',  // 已应用
  'archived', // 已归档
]);

// 一次增量变更
export const DeltaChangeSchema = z.object({
  id: z.string().min(1, '变更 ID 不能为空'),  // 变更唯一标识
  specId: z.string().min(1),                  // 关联的 Spec ID
  changes: z.array(ChangeItemSchema).min(1),  // 变更条目列表（至少一条）
  status: DeltaChangeStatusSchema,            // 当前状态
  requirementId: z.string().optional(),       // v17.0 PL-1: 需求级别语义标记（追踪到具体需求条目）
  proposedAt: z.string().datetime(),          // 提议时间
  appliedAt: z.string().datetime().optional(),  // 应用时间
  archivedAt: z.string().datetime().optional(), // 归档时间
});

// 导出推导类型
export type ChangeType = z.infer<typeof ChangeTypeSchema>;
export type ChangeItem = z.infer<typeof ChangeItemSchema>;
export type DeltaChangeStatus = z.infer<typeof DeltaChangeStatusSchema>;
export type DeltaChange = z.infer<typeof DeltaChangeSchema>;
