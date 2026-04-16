/**
 * 自定义工作流 Schema 定义
 *
 * 允许用户在 .qflow/schemas/ 目录下定义工作流配置，
 * 替代硬编码的 proposal->design->tasks->implementation 顺序。
 *
 * 函数列表:
 * - WorkflowSchemaDefinitionSchema  工作流 Schema Zod 定义
 * - WorkflowArtifactTypeSchema      产物类型 Zod 定义
 */

import { z } from 'zod';

/** 产物类型定义（自定义工作流中的单个步骤/产物） */
export const WorkflowArtifactTypeSchema = z.object({
  id: z.string(),                          // 产物 ID，如 'proposal', 'design', 'tasks', 'impl'
  name: z.string(),                        // 显示名称
  required: z.boolean().default(true),     // 是否必需
  template: z.string().optional(),         // Markdown 模板路径（相对于项目根目录）
  generates: z.string().optional(),        // v15.0 OS-4: 产物生成描述
  instruction: z.string().optional(),      // v15.0 OS-4: per-artifact Prompt 模板
  description: z.string().optional(),      // v15.0 OS-4: 产物类型描述
});

/** 工作流 Schema 定义（完整的自定义工作流配置） */
export const WorkflowSchemaDefinitionSchema = z.object({
  id: z.string(),                          // Schema ID，如 'rapid', 'research-first', 'with-review'
  name: z.string(),                        // 显示名称
  description: z.string().optional(),      // 描述说明
  artifactTypes: z.array(WorkflowArtifactTypeSchema), // 产物类型列表（定义工作流包含哪些步骤）
  dependencies: z.record(z.string(), z.array(z.string())).default({}), // 产物间依赖映射，如 { 'design': ['proposal'], 'tasks': ['design'] }
  rules: z.record(z.string(), z.string()).optional(),  // 产物级规则提示，如 { 'proposal': 'Focus on user stories' }
  context: z.string().optional(),          // 项目级上下文注入（附加到每个产物的指令中）
});

/** 工作流 Schema 定义的 TypeScript 类型 */
export type WorkflowSchemaDefinition = z.infer<typeof WorkflowSchemaDefinitionSchema>;

/** 产物类型的 TypeScript 类型 */
export type WorkflowArtifactType = z.infer<typeof WorkflowArtifactTypeSchema>;
