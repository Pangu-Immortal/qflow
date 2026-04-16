/**
 * 依赖环检测与清理 - Kahn 拓扑排序 + 3阶段清理
 *
 * 功能：检测任务依赖图中的循环依赖，并提供自动清理能力
 * 算法流程：
 *   1. 构建邻接表 + 入度表
 *   2. BFS 处理入度为0的节点（Kahn 拓扑排序）
 *   3. 未访问节点在环中，DFS 提取环路径
 * 清理流程：移除环引用 → 重算 blockedBy → 更新 blocked→pending
 *
 * 函数列表：
 *   - validateDependencies(tasks): 检测依赖环，返回环路径和修复建议
 *   - cleanupCycles(tasks, cycles): 3阶段清理，移除环引用并更新任务状态
 *   - extractCycles(inCycle, tasks): 内部函数，DFS 提取环路径
 */

import type { Task } from '../schemas/task.js';

// 依赖验证结果
export interface ValidationResult {
  valid: boolean;       // 是否无环
  cycles: string[][];   // 环路径列表，每个环为一组任务 ID
  suggestions: string[]; // 修复建议文本
}

// 检测任务列表中的依赖环，返回验证结果
export function validateDependencies(tasks: Task[]): ValidationResult {
  const taskMap = new Map(tasks.map(t => [t.id, t])); // 任务 ID → 任务对象
  const adjList = new Map<string, string[]>();  // 邻接表：task → 依赖它的 tasks
  const inDegree = new Map<string, number>();   // 入度表：task → 入度

  // 初始化所有节点
  for (const t of tasks) {
    adjList.set(t.id, []);
    inDegree.set(t.id, 0);
  }

  // 构建图: 如果 A depends on B，则边 B → A（B 完成后 A 才能执行）
  for (const t of tasks) {
    for (const dep of t.dependencies) {
      if (taskMap.has(dep)) { // 只处理存在的依赖
        adjList.get(dep)!.push(t.id); // dep 指向 t
        inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1); // t 的入度 +1
      }
    }
  }

  // Kahn BFS：从入度为0的节点开始逐层剥离
  const queue: string[] = [];
  const visited = new Set<string>();
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id); // 入度为0的节点入队
  }
  while (queue.length > 0) {
    const node = queue.shift()!; // 取出队首
    visited.add(node); // 标记已访问
    for (const neighbor of (adjList.get(node) || [])) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1; // 邻居入度 -1
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor); // 入度归零则入队
    }
  }

  // 未被访问的节点处于环中
  const inCycle = tasks.filter(t => !visited.has(t.id)).map(t => t.id);
  if (inCycle.length === 0) return { valid: true, cycles: [], suggestions: [] }; // 无环

  // DFS 提取具体的环路径
  const cycles = extractCycles(inCycle, tasks);
  const suggestions = cycles.map((cycle, i) => // 为每个环生成修复建议
    `环 ${i + 1}: ${cycle.join(' → ')} → ${cycle[0]}. 建议移除 ${cycle[cycle.length - 1]} → ${cycle[0]} 的依赖`
  );

  return { valid: false, cycles, suggestions };
}

// 从环中节点出发，DFS 提取完整的环路径
function extractCycles(inCycle: string[], tasks: Task[]): string[][] {
  const cycleSet = new Set(inCycle); // 环中节点集合
  const taskMap = new Map(tasks.map(t => [t.id, t])); // 任务查找表
  const cycles: string[][] = []; // 收集到的环路径
  const globalVisited = new Set<string>(); // 全局已访问标记

  for (const start of inCycle) {
    if (globalVisited.has(start)) continue; // 跳过已处理的节点
    const path: string[] = []; // 当前 DFS 路径
    const pathSet = new Set<string>(); // 路径节点集合（快速查重）

    // DFS 搜索环路径，找到则返回 true
    function dfs(node: string): boolean {
      if (pathSet.has(node)) { // 再次遇到路径中的节点 → 找到环
        const cycleStart = path.indexOf(node); // 环的起始位置
        cycles.push(path.slice(cycleStart)); // 截取环路径
        return true;
      }
      if (globalVisited.has(node)) return false; // 已处理过，跳过
      path.push(node); // 加入路径
      pathSet.add(node);
      const task = taskMap.get(node);
      if (task) {
        for (const dep of task.dependencies) {
          if (cycleSet.has(dep) && dfs(dep)) return true; // 只沿环中节点搜索
        }
      }
      path.pop(); // 回溯
      pathSet.delete(node);
      globalVisited.add(node); // 标记已处理
      return false;
    }
    dfs(start);
  }
  return cycles;
}

// 环清理结果
export interface CleanupResult {
  removedEdges: Array<{ from: string; to: string }>; // 被移除的依赖边
  statusChanges: Array<{ taskId: string; from: string; to: string }>; // 状态变更记录
}

// ─── v18.0: 依赖模式批量应用 ─────────────────────────────

/** 依赖模式应用结果 */
export interface DepsPatternResult {
  pattern: 'linear' | 'fan-out' | 'fan-in'; // 应用的模式
  edges: Array<{ from: string; to: string }>; // 新增的依赖边
  affectedIds: string[]; // 受影响的任务 ID 列表
}

/**
 * 批量应用依赖模式
 *
 * - linear:  T1→T2→T3→T4（每个依赖前一个，线性链）
 * - fan-out: T1→T2, T1→T3, T1→T4（第一个为中心，其余依赖它）
 * - fan-in:  T1→T4, T2→T4, T3→T4（最后一个依赖其余所有）
 *
 * @param tasks   - 完整任务列表（用于查找任务）
 * @param taskIds - 要应用模式的任务 ID 列表（顺序敏感）
 * @param pattern - 依赖模式
 * @returns 应用结果（新增的边和受影响的 ID）
 */
export function applyDepsPattern(
  tasks: Task[],
  taskIds: string[],
  pattern: 'linear' | 'fan-out' | 'fan-in',
): DepsPatternResult {
  const taskMap = new Map(tasks.map(t => [t.id, t])); // ID→任务映射
  const edges: Array<{ from: string; to: string }> = []; // 新增依赖边

  // 验证所有 ID 存在
  for (const id of taskIds) {
    if (!taskMap.has(id)) throw new Error(`任务 ${id} 不存在`); // 任务不存在
  }

  if (taskIds.length < 2) { // 至少需要 2 个任务
    return { pattern, edges: [], affectedIds: taskIds };
  }

  if (pattern === 'linear') {
    // 线性链：每个任务依赖前一个
    for (let i = 1; i < taskIds.length; i++) {
      const task = taskMap.get(taskIds[i])!; // 当前任务
      const depId = taskIds[i - 1]; // 前一个任务 ID
      if (!task.dependencies.includes(depId)) { // 避免重复
        task.dependencies.push(depId); // 添加依赖
        edges.push({ from: depId, to: taskIds[i] }); // 记录边
      }
    }
  } else if (pattern === 'fan-out') {
    // 扇出：第一个为中心，其余依赖它
    const hubId = taskIds[0]; // 中心任务 ID
    for (let i = 1; i < taskIds.length; i++) {
      const task = taskMap.get(taskIds[i])!; // 叶子任务
      if (!task.dependencies.includes(hubId)) { // 避免重复
        task.dependencies.push(hubId); // 添加对中心的依赖
        edges.push({ from: hubId, to: taskIds[i] }); // 记录边
      }
    }
  } else if (pattern === 'fan-in') {
    // 扇入：最后一个依赖其余所有
    const sinkId = taskIds[taskIds.length - 1]; // 汇聚任务 ID
    const sink = taskMap.get(sinkId)!; // 汇聚任务
    for (let i = 0; i < taskIds.length - 1; i++) {
      const depId = taskIds[i]; // 上游任务 ID
      if (!sink.dependencies.includes(depId)) { // 避免重复
        sink.dependencies.push(depId); // 添加依赖
        edges.push({ from: depId, to: sinkId }); // 记录边
      }
    }
  }

  return { pattern, edges, affectedIds: [...taskIds] }; // 返回结果
}

// 3阶段清理：移除环引用 → 重算依赖 → 更新状态（直接修改 tasks 数组）
export function cleanupCycles(tasks: Task[], cycles: string[][]): CleanupResult {
  const result: CleanupResult = { removedEdges: [], statusChanges: [] };

  // 阶段1: 移除环引用（每个环移除最后一条边，即打断环）
  for (const cycle of cycles) {
    if (cycle.length < 2) continue; // 单节点环不处理
    const from = cycle[cycle.length - 1]; // 环的最后一个节点
    const to = cycle[0]; // 环的第一个节点（形成闭环的边）
    const task = tasks.find(t => t.id === from);
    if (task) {
      const idx = task.dependencies.indexOf(to); // 查找依赖
      if (idx >= 0) {
        task.dependencies.splice(idx, 1); // 移除该依赖
        result.removedEdges.push({ from, to }); // 记录移除
      }
    }
  }

  // 阶段2+3: 重算状态 —— blocked 任务若所有依赖已完成，则转为 pending
  const doneTasks = new Set(tasks.filter(t => t.status === 'done').map(t => t.id));
  for (const task of tasks) {
    if (task.status === 'blocked') { // 只处理 blocked 状态
      const allDepsDone = task.dependencies.every(d => doneTasks.has(d)); // 检查所有依赖
      if (allDepsDone) {
        result.statusChanges.push({ taskId: task.id, from: 'blocked', to: 'pending' }); // 记录变更
        task.status = 'pending'; // 更新状态
      }
    }
  }

  return result;
}
