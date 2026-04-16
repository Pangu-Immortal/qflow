/**
 * Spec Schema - 规格文档数据模型定义
 *
 * 定义 qflow 规格文档系统的数据结构，包括：
 * - SpecTypeSchema: 规格类型枚举（架构/API/UI/数据/算法/安全/性能）
 * - SpecStatusSchema: 规格状态枚举
 * - SpecSchema: 单个规格文档的完整结构
 */

import { z } from 'zod';

// 规格类型枚举
export const SpecTypeSchema = z.enum([
  'architecture', // 架构设计
  'api',          // API 接口
  'ui',           // UI 界面
  'data',         // 数据模型
  'algorithm',    // 算法逻辑
  'security',     // v15.0 Q-1: 安全规格
  'performance',  // v15.0 Q-1: 性能规格
]);

// 规格状态枚举
export const SpecStatusSchema = z.enum([
  'draft',   // 草稿
  'ready',   // 就绪
  'blocked', // 被阻塞
  'done',    // 已完成
]);

// 产物类型枚举（v10.0: Spec 产物链）
export const ArtifactTypeSchema = z.enum([
  'proposal',        // 提案
  'design',          // 设计
  'tasks',           // 任务分解
  'implementation',  // 实现
]);

// 单个规格文档
export const SpecSchema = z.object({
  id: z.string().min(1, 'Spec ID 不能为空'),   // 规格唯一标识，如 "S001-auth-api"
  name: z.string().min(1, '名称不能为空'),      // 规格名称
  type: SpecTypeSchema,                        // 规格类型
  status: SpecStatusSchema,                    // 当前状态
  content: z.string(),                         // Markdown 格式的正文内容
  dependencies: z.array(z.string()),           // 依赖的 Spec ID 列表
  targetFiles: z.array(z.string()),            // 关联的代码文件路径
  taskIds: z.array(z.string()),                // 关联的任务 ID 列表
  version: z.number().int().positive(),        // 文档版本号
  artifactType: ArtifactTypeSchema.optional(), // v10.0: 产物类型
  artifactOrder: z.number().int().nonnegative().optional(), // v10.0: 产物链顺序
  workflowSchemaId: z.string().optional(),     // v11.0: 关联的自定义工作流 Schema ID
  requires: z.array(z.string()).default([]),   // v12.0: DAG 依赖声明（依赖的 specId 列表，显式声明 Spec 间依赖关系）
  rigor: z.enum(['lite', 'full']).default('full'), // v12.0: 验证严格度（lite 跳过 RFC 2119 和 implementationMatch 维度）
  designSeparated: z.boolean().default(false), // v13.0 E-4: Design 段是否已分离为独立文件
  createdAt: z.string().datetime(),            // 创建时间
  updatedAt: z.string().datetime(),            // 更新时间
});


// GIVEN/WHEN/THEN 场景结构（P2: 场景验证）
export const ScenarioSchema = z.object({
  given: z.string().describe('初始条件'),  // 前置条件
  when: z.string().describe('触发动作'),   // 触发操作
  then: z.string().describe('预期结果'),   // 预期输出
});

// 场景类型
export type Scenario = z.infer<typeof ScenarioSchema>;

// 验证问题严重级别枚举（V-1: 三级严重度）
export const VerifyIssueSeveritySchema = z.enum(['critical', 'warning', 'suggestion']);
export type VerifyIssueSeverity = z.infer<typeof VerifyIssueSeveritySchema>;

// 导出推导类型
export type ArtifactType = z.infer<typeof ArtifactTypeSchema>;
export type SpecType = z.infer<typeof SpecTypeSchema>;
export type SpecStatus = z.infer<typeof SpecStatusSchema>;
export type Spec = z.infer<typeof SpecSchema>;
