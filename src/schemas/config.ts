/**
 * Config Schema - qflow.config.json 配置文件数据模型定义
 *
 * 定义 qflow 项目配置文件的数据结构，包括：
 * - ModeSchema: 运行模式枚举（core/standard/all/autopilot/review/extra）
 * - AiProviderSchema: AI 服务商枚举
 * - AiConfigSchema: AI 相关配置
 * - ModelRoleConfigSchema: 单角色模型配置（model/baseUrl/apiKey）
 * - ModelRolesSchema: 多角色模型配置（main/research/fallback）
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

// AI 服务商枚举（v10.0: 扩展为 10 个服务商）
export const AiProviderSchema = z.enum([
  'anthropic',   // Anthropic Claude
  'openai',      // OpenAI GPT
  'google',      // Google Gemini
  'perplexity',  // Perplexity（支持 Web 搜索）
  'groq',        // Groq（高速推理）
  'ollama',      // Ollama（本地模型）
  'openrouter',  // OpenRouter（聚合路由）
  'xai',         // xAI Grok
  'azure',       // Azure OpenAI
  'vertex',      // v13.0 P-1: Google Vertex AI
  'codex',       // v13.0 P-1: OpenAI Codex CLI
  'gemini-cli',  // v13.0 P-1: Google Gemini CLI
  'claude-cli',  // v18.0: Claude CLI 适配器
  'grok-cli',    // v18.0: Grok CLI 适配器
  'mistral-cli', // v18.0: Mistral CLI 适配器
  'custom',      // 自定义接口
]);

// AI 相关配置
export const AiConfigSchema = z.object({
  provider: AiProviderSchema,            // AI 服务商
  model: z.string().optional(),          // 模型名称
  baseUrl: z.string().url().optional(),  // 自定义 API 地址
  apiKey: z.string().optional(),         // API 密钥
  researchModel: z.string().optional(),  // v16.0 P-5: 研究角色专用模型名（优先于 models.research.model）
  fallbackModel: z.string().optional(),  // v16.0 P-5: 降级专用模型名（主模型失败时使用）
  reasoningEffort: z.enum(['low', 'medium', 'high']).optional().describe("AI 推理深度（v21.0 P1-10: low=快速/medium=标准/high=深度）"), // v21.0 P1-10: 新增推理深度字段
});

// 单角色模型配置
export const ModelRoleConfigSchema = z.object({
  model: z.string().describe('模型名称'),                       // 模型名称
  baseUrl: z.string().url().optional().describe('API 地址'),    // API 地址（可选，继承默认）
  apiKey: z.string().optional().describe('API 密钥'),           // API 密钥（可选，继承默认）
});

// 多角色模型配置（main/research/fallback 三角色路由）
export const ModelRolesSchema = z.object({
  main: ModelRoleConfigSchema.optional().describe('主模型（默认）'),         // 主模型
  research: ModelRoleConfigSchema.optional().describe('研究模型（复杂分析）'), // 研究模型
  fallback: ModelRoleConfigSchema.optional().describe('降级模型（备选）'),    // 降级模型
});

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
  ai: AiConfigSchema,                                           // AI 配置
  models: ModelRolesSchema.optional(),                          // 多角色模型路由配置（可选）
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
export type AiProvider = z.infer<typeof AiProviderSchema>;
export type AiConfig = z.infer<typeof AiConfigSchema>;
export type ModelRoleConfig = z.infer<typeof ModelRoleConfigSchema>;
export type ModelRoles = z.infer<typeof ModelRolesSchema>;
export type Hooks = z.infer<typeof HooksSchema>;
export type QflowConfig = z.infer<typeof QflowConfigSchema>;
