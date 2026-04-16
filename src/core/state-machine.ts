/**
 * 任务状态转换矩阵 - 严格限制合法状态转换
 *
 * 合法转换规则：
 * - pending   → active, blocked, cancelled, deferred
 * - active    → done, blocked, cancelled, pending (退回), review
 * - blocked   → pending, cancelled
 * - done      → active (重新打开)
 * - cancelled → pending (恢复)
 * - review    → active (返回进行), done (直接完成), cancelled
 * - deferred  → pending (恢复待处理), cancelled
 *
 * 函数列表：
 * - validateTransition(from, to): 校验转换是否合法
 * - getValidTransitions(from): 获取某状态可转换到的所有目标状态
 */

import type { TaskStatus } from '../schemas/task.js'; // 任务状态类型

/** 合法状态转换矩阵 */
const VALID_TRANSITIONS: Map<TaskStatus, Set<TaskStatus>> = new Map([
  ['pending', new Set(['active', 'blocked', 'cancelled', 'deferred'] as TaskStatus[])],       // 待处理 → 激活/阻塞/取消/延期
  ['active', new Set(['done', 'blocked', 'cancelled', 'pending', 'review'] as TaskStatus[])], // 进行中 → 完成/阻塞/取消/退回/评审
  ['blocked', new Set(['pending', 'cancelled'] as TaskStatus[])],                              // 阻塞 → 恢复待处理/取消
  ['done', new Set(['active'] as TaskStatus[])],                                               // 已完成 → 允许重新打开
  ['cancelled', new Set(['pending'] as TaskStatus[])],                                         // 已取消 → 允许恢复
  ['review', new Set(['active', 'done', 'cancelled'] as TaskStatus[])],                        // 评审 → 返回进行/直接完成/取消
  ['deferred', new Set(['pending', 'cancelled'] as TaskStatus[])],                             // 延期 → 恢复待处理/取消
]);

/**
 * 校验状态转换是否合法
 *
 * @param from - 当前状态
 * @param to   - 目标状态
 * @returns 转换是否合法
 */
export function validateTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return false; // 相同状态不算转换
  const allowed = VALID_TRANSITIONS.get(from); // 查找当前状态的合法目标
  return allowed ? allowed.has(to) : false; // 目标是否在合法集合中
}

/**
 * 获取某状态可转换到的所有目标状态
 *
 * @param from - 当前状态
 * @returns 合法目标状态列表
 */
export function getValidTransitions(from: TaskStatus): TaskStatus[] {
  const allowed = VALID_TRANSITIONS.get(from); // 查找合法目标集合
  return allowed ? [...allowed] : []; // 转为数组返回，无则返回空数组
}
