/**
 * Constitution Schema - 项目治理原则 Zod 校验
 *
 * 定义 Constitution（治理文件）的数据结构，包括原则和约束的字段校验。
 * 持久化到 {projectRoot}/.qflow/constitution.json
 *
 * 函数列表:
 * - ConstitutionPrincipleSchema  单个原则的 Zod 校验 Schema
 * - ConstitutionSchema           完整 Constitution 的 Zod 校验 Schema
 * - ConstitutionPrinciple        单个原则的 TypeScript 类型
 * - Constitution                 完整 Constitution 的 TypeScript 类型
 */
import { z } from 'zod'; // Zod 运行时校验库

/** 单个治理原则的 Zod 校验 Schema */
export const ConstitutionPrincipleSchema = z.object({
  id: z.string(),                                          // 原则唯一 ID，格式 CP-001
  content: z.string().min(1),                              // 原则内容（不可为空）
  category: z.enum([                                       // 原则分类
    'architecture',   // 架构原则
    'quality',        // 质量原则
    'security',       // 安全原则
    'process',        // 流程原则
    'naming',         // 命名原则
    'testing',        // 测试原则
    'documentation',  // 文档原则
    'custom',         // 自定义原则
  ]),
  severity: z.enum(['must', 'should', 'may']),             // 严重性：必须/应该/可以
  immutable: z.boolean().default(true),                    // 是否不可变（默认不可移除）
  createdAt: z.string(),                                   // 创建时间 ISO 字符串
});

/** 完整 Constitution 文件的 Zod 校验 Schema */
export const ConstitutionSchema = z.object({
  version: z.string().default('1.0'),                      // 文件版本号
  projectName: z.string(),                                  // 项目名称
  principles: z.array(ConstitutionPrincipleSchema).default([]), // 原则列表
  createdAt: z.string(),                                   // 初始化时间 ISO 字符串
  updatedAt: z.string(),                                   // 最后更新时间 ISO 字符串
});

/** 单个治理原则的 TypeScript 类型 */
export type ConstitutionPrinciple = z.infer<typeof ConstitutionPrincipleSchema>;
/** 完整 Constitution 的 TypeScript 类型 */
export type Constitution = z.infer<typeof ConstitutionSchema>;
