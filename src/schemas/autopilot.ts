/**
 * Autopilot Schema - 自动驾驶配置和状态数据模型
 *
 * 定义自动驾驶系统的配置、状态和执行日志结构：
 * - AutopilotConfigSchema: 自动驾驶配置
 * - AutopilotStateSchema: 运行时状态
 * - AutopilotLogEntrySchema: 执行日志条目
 */

import { z } from 'zod';

// 自动驾驶运行状态枚举
export const AutopilotStatusSchema = z.enum([
  'idle',       // 空闲
  'running',    // 运行中
  'paused',     // 已暂停
  'stopped',    // 已停止
  'error',      // 错误
]);

// 预设名称枚举
export const AutopilotPresetSchema = z.enum([
  'default',        // 默认预设
  'test-coverage',  // 测试覆盖预设
  'linting',        // 代码风格检查预设
  'duplication',    // 重复代码消除预设
  'entropy',        // 熵值清理预设
  'custom',         // 自定义预设
]);

// 自动驾驶配置
export const AutopilotConfigSchema = z.object({
  maxTasksPerRun: z.number(),       // 单次运行最大任务数
  maxConcurrentErrors: z.number(),  // 连续错误暂停阈值
  intervalMs: z.number(),           // 任务间隔（毫秒），用于速率限制
  loopMode: z.boolean(),            // 是否开启循环模式
  tokensPerInterval: z.number(),    // 令牌桶每间隔补充的令牌数
  maxTokens: z.number(),            // 令牌桶最大容量
  preset: AutopilotPresetSchema.optional(), // 循环预设名称（可选）
  verbose: z.boolean().optional(),  // 详细日志模式（可选，默认 false）
});

// 自动驾驶运行时状态
export const AutopilotStateSchema = z.object({
  status: AutopilotStatusSchema,                                   // 当前状态
  config: AutopilotConfigSchema,                                   // 配置快照
  tasksCompleted: z.number(),                                      // 已完成任务计数
  consecutiveErrors: z.number(),                                   // 连续错误计数
  lastTaskId: z.string().nullable(),                               // 最后执行的任务 ID
  lastError: z.string().nullable(),                                // 最后一次错误信息
  startedAt: z.string().nullable(),                                // 启动时间戳
  pausedAt: z.string().nullable(),                                 // 暂停时间戳
  stoppedAt: z.string().nullable(),                                // 停止时间戳
});

// 执行日志条目
export const AutopilotLogEntrySchema = z.object({
  timestamp: z.string(),                                           // 时间戳
  action: z.enum(['start', 'pause', 'resume', 'stop', 'task_begin', 'task_done', 'task_error', 'loop_restart', 'rate_limit']), // 动作类型
  taskId: z.string().optional(),                                   // 关联任务 ID
  message: z.string(),                                             // 日志消息
});

// 导出推导类型
export type AutopilotStatus = z.infer<typeof AutopilotStatusSchema>;
export type AutopilotConfig = z.infer<typeof AutopilotConfigSchema>;
export type AutopilotState = z.infer<typeof AutopilotStateSchema>;
export type AutopilotLogEntry = z.infer<typeof AutopilotLogEntrySchema>;
