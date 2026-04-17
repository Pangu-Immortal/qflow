/**
 * Config Schema - qflow.config.json 配置文件数据模型定义
 *
 * 定义 qflow 项目配置文件的数据结构，包括：
 * - ModeSchema: 运行模式枚举（core/standard/all/autopilot/review/extra）
 * - HooksSchema: 生命周期钩子配置
 * - QflowConfigSchema: 完整配置文件结构
 */

import { z } from 'zod';

// 运行模式枚举
export const ModeSchema = z.enum([
  'minimal',   // 最小模式（仅核心工具）
  'core',      // 仅核心功能
  'standard',  // 标准功能集（默认）
  'all',       // 全部功能
  'autopilot', // 自动驾驶模式
  'review',    // 评审模式
  'extra',     // 扩展模式
]);

// 生命周期钩子配置
export const HooksSchema = z.object({
  onTaskDone: z.string().optional(),   // 任务完成时触发的命令
  onSpecApply: z.string().optional(),  // 规格应用时触发的命令
});

// v18.0: Profile 配置 Schema
export const ProfileSchema = z.object({
  name: z.string().describe('Profile 名称'), // Profile 唯一标识
  description: z.string().optional().describe('Profile 描述'), // 可选描述
  mode: ModeSchema.describe('运行模式'), // 对应的运行模式
  enabledTools: z.array(z.string()).optional().describe('启用的工具列表'), // 白名单
  disabledTools: z.array(z.string()).optional().describe('禁用的工具列表'), // 黑名单
  contextModules: z.array(z.string()).optional().describe('上下文模块列表'), // 自动加载的模块
});

/** Profile 类型 */
export type Profile = z.infer<typeof ProfileSchema>;

// 完整配置文件
export const QflowConfigSchema = z.object({
  version: z.number().int().positive().default(1),              // 配置版本号，默认 1
  projectName: z.string().min(1, '项目名称不能为空'),             // 项目名称
  projectRoot: z.string().min(1, '项目根路径不能为空'),           // 项目根目录绝对路径
  mode: ModeSchema.default('standard'),                         // 运行模式，默认 standard
  autoExpand: z.number().int().nonnegative().default(7),        // 自动展开阈值，默认 7
  contextModules: z.array(z.string()).default(['core']),         // 上下文模块列表，默认 ["core"]
  hooks: HooksSchema.default({}),                               // 生命周期钩子
  responseLanguage: z.string().optional(),                       // v10.0: 响应语言（如 'zh-CN', 'en-US'）
  specContext: z.string().optional(),                             // v11.0: Spec 全局上下文（创建 Spec 时自动注入）
  teamMode: z.enum(['solo', 'team']).default('solo'),             // v17.0 TM-1: 团队模式（solo=单人/team=多人协作）
  mcpbConfig: z.object({                                           // v17.0 EN-3: MCPB 配置
    installed: z.boolean().default(false),                          // 是否已安装 MCPB
    version: z.string().optional(),                                 // MCPB 版本号
    configPath: z.string().optional(),                              // MCPB 配置文件路径
  }).optional(),
  profiles: z.array(ProfileSchema).optional(),                      // v18.0: Profile 预设列表
  activeTag: z.string().optional(),                                  // v20.0 P2-9: 当前激活的工作区标签（持久化到配置文件）
  artifactRules: z.record(z.string(), z.array(z.string())).optional().default({}), // v20.0 P2-11: 变更类型→必需产物类型映射（如 { ADDED: ['test', 'doc'] }）
});

// 导出推导类型
export type Mode = z.infer<typeof ModeSchema>;
export type Hooks = z.infer<typeof HooksSchema>;
export type QflowConfig = z.infer<typeof QflowConfigSchema>;
