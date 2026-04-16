/**
 * ResearchSession - 研究会话持久化 Schema
 *
 * 定义研究会话的数据模型，支持多轮对话式研究的持久化存储。
 * 存储路径: {projectRoot}/.qflow/research/sessions/{id}.json
 *
 * Schema 列表：
 *   - ResearchMessageSchema: 单条研究消息（角色 + 内容 + 时间戳）
 *   - ResearchSessionSchema: 完整研究会话（消息列表 + 元数据）
 *
 * 类型导出：
 *   - ResearchSession: 研究会话类型
 *   - ResearchMessage: 研究消息类型
 */

import { z } from 'zod';

/** 研究消息 Schema - 单条对话消息 */
export const ResearchMessageSchema = z.object({
  role: z.enum(['user', 'assistant']), // 消息角色：用户或助手
  content: z.string(), // 消息内容
  timestamp: z.number(), // 消息时间戳（毫秒）
});

/** 研究会话 Schema - 完整会话数据 */
export const ResearchSessionSchema = z.object({
  id: z.string(), // 会话唯一标识
  taskId: z.string().optional(), // 关联任务 ID（可选）
  title: z.string(), // 会话标题
  messages: z.array(ResearchMessageSchema), // 消息列表
  createdAt: z.number(), // 创建时间戳（毫秒）
  updatedAt: z.number(), // 最后更新时间戳（毫秒）
  status: z.enum(['active', 'archived']).default('active'), // 会话状态
  tags: z.array(z.string()).default([]), // 标签列表
});

/** 研究会话类型 */
export type ResearchSession = z.infer<typeof ResearchSessionSchema>;
/** 研究消息类型 */
export type ResearchMessage = z.infer<typeof ResearchMessageSchema>;
