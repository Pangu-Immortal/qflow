/**
 * shared/helpers.ts - 公共辅助函数
 *
 * - shouldRegister: 工具注册过滤（检查工具名是否在允许列表中）
 *
 * v23.0: 移除 wrapCallAI，AI 调用不再由工具层发起
 */

/**
 * 工具注册辅助：检查工具名是否在允许列表中（无列表时全部允许）
 * @param name 工具名称
 * @param allowedTools 允许的工具名集合（undefined 时全部允许）
 */
export const shouldRegister = (name: string, allowedTools?: Set<string>): boolean =>
  !allowedTools || allowedTools.has(name);
