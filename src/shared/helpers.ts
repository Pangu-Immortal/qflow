/**
 * shared/helpers.ts - 提取自各 tier-*.ts 的公共辅助函数
 *
 * - shouldRegister: 工具注册过滤（检查工具名是否在允许列表中）
 * - wrapCallAI: 包装 callAI 为 CallAIFn 类型，适配 LoopEngine/TddEngine 的 DI 接口
 */
import { callAI } from "../core/ai-provider.js"; // AI 调用函数
import type { CallAIFn } from "../core/loop-engine.js"; // 回调类型

/**
 * 工具注册辅助：检查工具名是否在允许列表中（无列表时全部允许）
 * @param name 工具名称
 * @param allowedTools 允许的工具名集合（undefined 时全部允许）
 */
export const shouldRegister = (name: string, allowedTools?: Set<string>): boolean =>
  !allowedTools || allowedTools.has(name);

/**
 * 包装 callAI 为 CallAIFn 类型，适配 LoopEngine/TddEngine 的 DI 接口
 * @param prompt 提示词
 * @param context 系统提示词（可选）
 */
export const wrapCallAI: CallAIFn = (prompt: string, context?: string) =>
  callAI(prompt, { systemPrompt: context }).then(r => r.content);
