/**
 * Persona Schema 定义 - 专业角色模板
 *
 * 定义 Agent 专业角色（Persona）和多角色协作会话（Party Session）的数据结构。
 * 用于 v19.0 Phase 5 Agent Personas + Party Mode 功能。
 *
 * 函数列表:
 * - PersonaSchema         - 角色 Zod Schema 定义
 * - PartySessionSchema    - Party 会话 Zod Schema 定义
 * - Persona               - 角色类型推导
 * - PartySession          - Party 会话类型推导
 */

import { z } from 'zod'; // Zod 数据验证库

/** 角色 Schema - 定义专业角色的数据结构 */
export const PersonaSchema = z.object({
  id: z.string(),                           // 角色ID，如 PM, ARCH, DEV, QA, UX 等
  name: z.string(),                          // 显示名称，如「产品经理」
  role: z.string(),                          // 角色英文描述，如 Product Manager
  expertise: z.array(z.string()).default([]), // 专业领域列表
  systemPrompt: z.string().default(''),      // 角色系统提示词，用于 AI 调用时注入角色上下文
  reviewFocus: z.array(z.string()).default([]), // 评审关注点列表
  createdAt: z.string(),                     // 创建时间 ISO 字符串
});

/** Party 会话 Schema - 定义多角色协作会话的数据结构 */
export const PartySessionSchema = z.object({
  id: z.string(),                            // 会话ID，格式 PARTY-001
  name: z.string(),                          // 会话名称
  participants: z.array(z.string()).default([]), // 参与的 Persona ID 列表
  topic: z.string().default(''),             // 讨论主题
  messages: z.array(z.object({              // 消息列表
    personaId: z.string(),                  // 发言的 Persona ID
    content: z.string(),                    // 消息内容
    timestamp: z.string(),                  // 发言时间 ISO 字符串
  })).default([]),
  status: z.enum(['active', 'completed']).default('active'), // 会话状态
  createdAt: z.string(),                    // 创建时间 ISO 字符串
});

/** 角色类型（从 Schema 推导） */
export type Persona = z.infer<typeof PersonaSchema>;

/** Party 会话类型（从 Schema 推导） */
export type PartySession = z.infer<typeof PartySessionSchema>;
