/**
 * Workflow Schema - 工作流数据模型定义
 *
 * DAG 工作流，由多个阶段组成，每个阶段包含任务列表和依赖关系。
 * - WorkflowStageSchema: 单个工作流阶段（包含任务列表和依赖）
 * - WorkflowSchema: 完整工作流结构（包含阶段列表和状态）
 */

import { z } from 'zod';

// 工作流阶段
export const WorkflowStageSchema = z.object({
  name: z.string(),                               // 阶段名称
  taskIds: z.array(z.string()),                    // 包含的任务 ID
  dependsOn: z.array(z.string()).optional(),       // 依赖的阶段名称
  status: z.enum(['pending', 'active', 'done', 'blocked']).default('pending'), // 阶段状态
});

// 完整工作流
export const WorkflowSchema = z.object({
  id: z.string(),                                  // 工作流 ID（如 W-1710000000）
  name: z.string(),                                // 工作流名称
  stages: z.array(WorkflowStageSchema),            // 阶段列表
  status: z.enum(['defined', 'running', 'completed', 'aborted']).default('defined'), // 工作流状态
  createdAt: z.string().datetime(),                // 创建时间
  updatedAt: z.string().datetime().optional(),     // 更新时间
});

// 导出推导类型
export type WorkflowStage = z.infer<typeof WorkflowStageSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
