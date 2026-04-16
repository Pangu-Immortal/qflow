/**
 * Review Schema - 评审数据模型
 *
 * 定义评审请求和评论的数据结构：
 * - ReviewSchema: 评审请求
 * - ReviewCommentSchema: 评审评论
 */

import { z } from 'zod';

// 评审状态枚举
export const ReviewStatusSchema = z.enum([
  'open',       // 开放中
  'approved',   // 已通过
  'rejected',   // 已拒绝
  'closed',     // 已关闭
]);

// 评审评论
export const ReviewCommentSchema = z.object({
  id: z.string(),                          // 评论 ID
  author: z.string(),                      // 评论者
  content: z.string(),                     // 评论内容
  type: z.enum(['comment', 'suggestion', 'issue', 'praise']).optional(), // 类型（可选）
  createdAt: z.string().datetime(),        // 创建时间
});

// 评审请求
export const ReviewSchema = z.object({
  id: z.string(),                          // 评审 ID
  targetType: z.enum(['spec', 'change', 'task']), // 评审目标类型
  targetId: z.string(),                    // 评审目标 ID
  title: z.string(),                       // 评审标题
  description: z.string(),                 // 评审描述
  status: ReviewStatusSchema,              // 评审状态
  comments: z.array(ReviewCommentSchema).default([]), // 评论列表
  reviewer: z.string(),                    // 指定评审人
  createdAt: z.string().datetime(),        // 创建时间
  updatedAt: z.string().datetime(),        // 更新时间
  resolvedAt: z.string().nullable(),       // 完成时间（可为 null）
});

// 导出推导类型
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;
export type ReviewComment = z.infer<typeof ReviewCommentSchema>;
export type Review = z.infer<typeof ReviewSchema>;
