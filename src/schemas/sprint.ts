/**
 * Sprint Schema 定义
 *
 * 定义 Sprint 和 Story 的数据结构，用于 Sprint 敏捷迭代管理。
 * Story 是 Sprint 中的用户故事，Sprint 是包含多个 Story 的迭代周期。
 *
 * 函数列表:
 * - StorySchema  用户故事 Schema
 * - SprintSchema Sprint 迭代 Schema
 */
import { z } from 'zod'; // Zod 数据校验库

/** 用户故事 Schema */
export const StorySchema = z.object({
  id: z.string(),                                                                                       // 故事唯一 ID
  title: z.string(),                                                                                    // 故事标题
  description: z.string().default(''),                                                                  // 故事描述（可选）
  status: z.enum(['backlog', 'todo', 'in_progress', 'done', 'blocked']).default('backlog'),            // 故事状态
  points: z.number().default(0),                                                                        // 故事点数（工作量估算）
  assignee: z.string().optional(),                                                                      // 负责人（可选）
  taskIds: z.array(z.string()).default([]),                                                             // 关联的任务 ID 列表
  createdAt: z.string(),                                                                                // 创建时间（ISO 字符串）
});

/** Sprint 迭代 Schema */
export const SprintSchema = z.object({
  id: z.string(),                                                                                       // Sprint 唯一 ID（格式: SPR-001）
  name: z.string(),                                                                                     // Sprint 名称
  goal: z.string().default(''),                                                                         // Sprint 目标描述
  status: z.enum(['planning', 'active', 'review', 'completed']).default('planning'),                   // Sprint 状态
  stories: z.array(StorySchema).default([]),                                                           // Sprint 包含的用户故事列表
  startDate: z.string().optional(),                                                                     // Sprint 开始日期（可选）
  endDate: z.string().optional(),                                                                       // Sprint 结束日期（可选）
  retrospective: z.string().optional(),                                                                 // Sprint 回顾总结（可选）
  createdAt: z.string(),                                                                                // 创建时间（ISO 字符串）
});

/** 用户故事类型 */
export type Story = z.infer<typeof StorySchema>;

/** Sprint 迭代类型 */
export type Sprint = z.infer<typeof SprintSchema>;
