/**
 * Template Schema - 模板数据模型
 *
 * 定义 Spec/Task/Workflow 模板的数据结构：
 * - TemplateSchema: 模板定义
 * - TemplateVariableSchema: 模板变量
 */

import { z } from 'zod';

// 模板变量
export const TemplateVariableSchema = z.object({
  name: z.string(),                        // 变量名
  description: z.string(),                 // 变量描述
  defaultValue: z.string().optional(),     // 默认值
  required: z.boolean(),                   // 是否必填
});

// 模板定义
export const TemplateSchema = z.object({
  id: z.string(),                          // 模板 ID
  name: z.string(),                        // 模板名称
  type: z.enum(['task', 'spec', 'workflow']), // 模板类型
  description: z.string(),                 // 模板描述
  content: z.string(),                     // 模板内容（支持 {{variable}} 占位符）
  variables: z.array(TemplateVariableSchema).default([]), // 变量定义
  createdAt: z.string().datetime(),        // 创建时间
  updatedAt: z.string().datetime(),        // 更新时间
});

// 导出推导类型
export type TemplateVariable = z.infer<typeof TemplateVariableSchema>;
export type Template = z.infer<typeof TemplateSchema>;
