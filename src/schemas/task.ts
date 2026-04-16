/**
 * Task Schema - 任务数据模型定义
 *
 * 定义 qflow 任务系统的核心数据结构，包括：
 * - TaskStatusSchema: 任务状态枚举
 * - TaskSchema: 单个任务的完整结构（支持子任务嵌套）
 * - TasksFileSchema: 任务文件的顶层结构（含版本号和任务列表）
 */

import { z } from 'zod';

// 任务状态枚举
export const TaskStatusSchema = z.enum([
  'pending',    // 待处理
  'active',     // 进行中
  'done',       // 已完成
  'blocked',    // 被阻塞
  'cancelled',  // 已取消
  'review',     // 评审中（v4.0 新增）
  'deferred',   // 已延期（v4.0 新增）
]);

// 任务 ID 格式：T1 或 T1.3（子任务）
const taskIdPattern = /^T\d+(\.\d+)*$/;

// 单个任务
export const TaskSchema = z.object({
  id: z.string().regex(taskIdPattern, '任务 ID 格式须为 "T1" 或 "T1.3"'), // 任务唯一标识
  title: z.string().min(1, '标题不能为空'),                                // 任务标题
  description: z.string(),                                                // 任务描述
  status: TaskStatusSchema,                                               // 当前状态
  priority: z.number().int().min(1).max(10),                              // 优先级 1-10
  complexityScore: z.number().int().min(1).max(10).optional(),            // 复杂度评分 1-10
  expansionPrompt: z.string().optional(),                                 // 自动展开提示词
  dependencies: z.array(z.string()),                                      // 依赖的任务 ID 列表
  subtasks: z.array(z.string()),                                          // 子任务 ID 列表
  parentId: z.string().optional(),                                        // 父任务 ID
  tags: z.array(z.string()),                                              // 标签列表
  testStrategy: z.string().optional(),                                    // 测试策略
  // === 吸收 Task Master AI 的 TaskImplementationMetadata ===
  effort: z.number().optional(),                                          // 预估工作量（人时）
  actualEffort: z.number().optional(),                                    // 实际工作量（人时）
  category: z.enum(['research', 'design', 'development', 'testing', 'documentation', 'review']).optional(), // 任务类别
  relevantFiles: z.array(z.object({                                       // 相关文件列表
    path: z.string(),                                                     // 文件路径
    description: z.string().optional(),                                   // 文件描述
    action: z.enum(['create', 'modify', 'delete', 'review']).optional(),  // 预期操作
  })).optional(),
  acceptanceCriteria: z.array(z.string()).optional(),                     // 验收标准
  complexityReasoning: z.string().optional(),                             // 复杂度评估理由
  metadata: z.record(z.string(), z.unknown()).optional(),                  // 用户自定义元数据（透传不丢失）
  details: z.string().optional(),                                          // v10.0: 时间戳笔记（追加模式，永不覆盖）
  assignee: z.string().optional(),                                          // v17.0 TM-2: 团队模式任务分配人
  implementationGuide: z.string().optional(),                              // v12.0: 实现指导（rich-text Markdown，帮助开发者理解如何实现）
  dueDate: z.string().datetime().optional(),                               // v22.0 P2-2: 截止日期（ISO 8601 格式）
  createdAt: z.string().datetime(),                                       // 创建时间
  updatedAt: z.string().datetime(),                                       // 更新时间
  completedAt: z.string().datetime().optional(),                          // 完成时间
});

// 任务文件顶层结构
export const TasksFileSchema = z.object({
  version: z.literal(1),                // 文件格式版本，当前固定为 1
  tasks: z.array(TaskSchema),           // 任务列表
  lastId: z.number().int().nonnegative(), // 最后分配的 ID 序号
});

// 导出推导类型
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type TasksFile = z.infer<typeof TasksFileSchema>;

/** v12.0: AI-Safe 任务 Schema（排除 metadata 字段，防止 AI 覆盖外部集成数据如 GitHub/Jira ID） */
export const TaskAISchema = TaskSchema.omit({ metadata: true });
export type TaskAI = z.infer<typeof TaskAISchema>;
