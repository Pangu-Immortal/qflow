/**
 * 下一任务选择算法 - 三阶段筛选
 *
 * 功能：从任务列表中选出下一个应执行的任务
 * 算法流程：
 *   1. 过滤可执行：status=pending 且所有依赖 done
 *   2. 优先子任务：有 parentId 的优先（父任务 active 的子任务最优先）
 *   3. 三键排序：priority DESC → deps.length ASC → id ASC（按数字部分排序）
 *
 * 函数列表：
 *   - selectNextTask(tasks): 主入口，返回下一个应执行的任务或 null
 *   - compareTaskIds(a, b): 辅助函数，按数字部分比较任务 ID（T1 < T2 < T1.1 < T1.2）
 */

import type { Task } from '../schemas/task.js';

// 从任务列表中选出下一个应执行的任务，无可执行任务时返回 null
export function selectNextTask(tasks: Task[]): Task | null {
  // 阶段1: 过滤可执行任务（status=pending 且所有依赖都已完成）
  const doneTasks = new Set(tasks.filter(t => t.status === 'done').map(t => t.id)); // 已完成任务 ID 集合
  const executable = tasks.filter(t => {
    if (t.status !== 'pending') return false; // 只选 pending 状态
    return t.dependencies.every(dep => doneTasks.has(dep)); // 所有依赖必须已完成
  });

  if (executable.length === 0) return null; // 无可执行任务

  // 阶段2: 标记子任务优先级信息
  const activeTasks = new Set(tasks.filter(t => t.status === 'active').map(t => t.id)); // 进行中任务 ID 集合
  const withPriority = executable.map(t => ({
    task: t,
    isActiveChild: t.parentId ? activeTasks.has(t.parentId) : false, // 父任务是否 active
    isChild: !!t.parentId, // 是否为子任务
  }));

  // 阶段3: 三键排序
  withPriority.sort((a, b) => {
    // active 父任务的子任务最优先
    if (a.isActiveChild !== b.isActiveChild) return a.isActiveChild ? -1 : 1;
    // 子任务次优先
    if (a.isChild !== b.isChild) return a.isChild ? -1 : 1;
    // priority DESC（数值大的优先）
    if (a.task.priority !== b.task.priority) return b.task.priority - a.task.priority;
    // deps count ASC（依赖少的优先）
    if (a.task.dependencies.length !== b.task.dependencies.length)
      return a.task.dependencies.length - b.task.dependencies.length;
    // ID ASC（数字排序）
    return compareTaskIds(a.task.id, b.task.id);
  });

  return withPriority[0].task; // 返回排序后的第一个任务
}

// 辅助：比较 task ID（T1 < T2 < T1.1 < T1.2），按数字段逐级比较
function compareTaskIds(a: string, b: string): number {
  const partsA = a.replace('T', '').split('.').map(Number); // "T1.2" → [1, 2]
  const partsB = b.replace('T', '').split('.').map(Number); // "T3" → [3]
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const na = partsA[i] ?? 0; // 缺失段视为 0
    const nb = partsB[i] ?? 0;
    if (na !== nb) return na - nb; // 数值小的排前面
  }
  return 0; // 完全相同
}
