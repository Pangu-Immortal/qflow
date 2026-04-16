/**
 * Plan Schema - 实现计划 Zod 校验
 *
 * 函数列表:
 * - PlanArtifactSchema    单个产物
 * - DataModelFieldSchema  数据模型字段
 * - DataModelSchema       数据模型
 * - ApiEndpointSchema     API 端点
 * - ApiContractSchema     API 契约
 * - PlanSchema            完整计划
 */
import { z } from 'zod';

export const PlanArtifactSchema = z.object({
  name: z.string(), // 产物名称
  type: z.enum(['file', 'module', 'config', 'test', 'doc']), // 产物类型
  path: z.string().optional(), // 文件路径
  description: z.string(), // 描述
  dependencies: z.array(z.string()).default([]), // 依赖其他产物
  parallel: z.boolean().default(false), // 是否可并行 [P] 标记
});

export const DataModelFieldSchema = z.object({
  name: z.string(), // 字段名
  type: z.string(), // 字段类型
  required: z.boolean().default(true), // 是否必填
  description: z.string().optional(), // 描述
});

export const DataModelSchema = z.object({
  name: z.string(), // 模型名称
  fields: z.array(DataModelFieldSchema), // 字段列表
  relationships: z.array(z.string()).default([]), // 关系描述
});

export const ApiEndpointSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']), // HTTP 方法
  path: z.string(), // 路径
  description: z.string(), // 描述
  requestBody: z.string().optional(), // 请求体描述
  responseBody: z.string().optional(), // 响应体描述
  auth: z.boolean().default(false), // 是否需要认证
});

export const ApiContractSchema = z.object({
  name: z.string(), // 契约名称
  baseUrl: z.string().optional(), // 基础 URL
  endpoints: z.array(ApiEndpointSchema), // 端点列表
});

export const PlanSchema = z.object({
  id: z.string(), // 计划 ID
  specId: z.string(), // 关联 Spec ID
  title: z.string(), // 计划标题
  overview: z.string(), // 技术方案概述
  artifacts: z.array(PlanArtifactSchema).default([]), // 产物列表
  dataModels: z.array(DataModelSchema).default([]), // 数据模型
  apiContracts: z.array(ApiContractSchema).default([]), // API 契约
  quickstart: z.string().default(''), // 快速启动指南
  techStack: z.array(z.string()).default([]), // 技术栈
  estimatedTasks: z.number().default(0), // 预估任务数
  createdAt: z.string(), // 创建时间
  updatedAt: z.string(), // 更新时间
});

export type PlanArtifact = z.infer<typeof PlanArtifactSchema>;
export type DataModel = z.infer<typeof DataModelSchema>;
export type ApiContract = z.infer<typeof ApiContractSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type ApiEndpoint = z.infer<typeof ApiEndpointSchema>;
export type DataModelField = z.infer<typeof DataModelFieldSchema>;
