/**
 * 冲突检测器 - 7 类变更冲突检测
 *
 * 在 apply 变更之前进行预验证，检测以下 7 类冲突：
 * 1. concurrent_modify  - 同 section 并发修改
 * 2. delete_referenced  - 删除被引用 section
 * 3. rename_conflict    - 重命名冲突（新名称已存在）
 * 4. add_duplicate      - 添加已存在 section
 * 5. modify_deleted     - 修改已删除 section
 * 6. circular_reference - 循环引用（RENAMED 链成环）
 * 7. parallel_change    - 不同 pending 变更对同一 section 的并发修改
 *
 * 函数列表：
 *   - detectConflicts(currentContent, changes, pendingChanges?): 主入口，执行 7 类冲突检测
 *   - findReferences(content, sectionName): 辅助函数，查找 section 被引用的位置
 *   - detectRenameChainCycle(changes): 辅助函数，检测 RENAMED 链是否成环
 */

import type { ChangeItem } from '../schemas/change.js'; // 变更条目类型
import { parseMarkdown, getAllSectionTitles } from './markdown-parser.js'; // Markdown 解析工具

/** 冲突类型枚举 */
export type ConflictType =
  | 'concurrent_modify'    // 同 section 并发修改
  | 'delete_referenced'    // 删除被引用 section
  | 'rename_conflict'      // 重命名冲突
  | 'add_duplicate'        // 添加已存在 section
  | 'modify_deleted'       // 修改已删除 section
  | 'circular_reference'   // 循环引用
  | 'parallel_change';     // 不同 pending 变更对同一 section 的并发修改

/** 单条冲突信息 */
export interface ConflictItem {
  type: ConflictType;           // 冲突类型
  section: string;              // 涉及的 section 名称
  description: string;          // 冲突描述
  severity: 'error' | 'warning'; // 严重程度
}

/** 冲突检测结果 */
export interface ConflictResult {
  hasConflicts: boolean;        // 是否存在冲突
  conflicts: ConflictItem[];    // 冲突列表
}

/**
 * 主入口：执行 7 类冲突检测
 *
 * @param currentContent  - 当前文档内容（Markdown 文本）
 * @param changes         - 待应用的变更列表
 * @param pendingChanges  - 其他待处理变更（用于检测并发冲突），可选
 * @returns 冲突检测结果
 */
export function detectConflicts(
  currentContent: string,
  changes: ChangeItem[],
  pendingChanges?: ChangeItem[],
): ConflictResult {
  const conflicts: ConflictItem[] = []; // 冲突收集列表
  const sections = parseMarkdown(currentContent); // 解析当前文档结构
  const existingTitles = getAllSectionTitles(sections); // 获取所有已存在的 section 标题

  // 1. concurrent_modify: 检查 pendingChanges 中是否有对同一 section 的修改
  if (pendingChanges && pendingChanges.length > 0) {
    const pendingSections = new Map<string, string[]>(); // section -> 变更类型列表
    for (const pc of pendingChanges) { // 收集 pending 中涉及的 section
      const types = pendingSections.get(pc.section) ?? [];
      types.push(pc.type);
      pendingSections.set(pc.section, types);
    }
    for (const change of changes) { // 检查当前变更是否与 pending 冲突
      if (pendingSections.has(change.section)) { // 同 section 有 pending 变更
        const pendingTypes = pendingSections.get(change.section)!;
        conflicts.push({
          type: 'concurrent_modify',
          section: change.section,
          description: `section "${change.section}" 同时有 pending 变更 [${pendingTypes.join(', ')}] 和当前变更 [${change.type}]`,
          severity: 'error', // 并发修改是严重冲突
        });
      }
    }
  }

  // 2. delete_referenced: 被删除的 section 是否被其他 section 引用
  const removedSections = changes.filter((c) => c.type === 'REMOVED').map((c) => c.section); // 待删除的 section 列表
  for (const removedName of removedSections) {
    const references = findReferences(currentContent, removedName); // 查找引用
    if (references.length > 0) { // 存在引用
      conflicts.push({
        type: 'delete_referenced',
        section: removedName,
        description: `section "${removedName}" 被以下位置引用: ${references.join(', ')}，删除将导致引用失效`,
        severity: 'warning', // 删除被引用 section 是警告级别
      });
    }
  }

  // 3. rename_conflict: RENAMED 的新名称是否已存在
  for (const change of changes) {
    if (change.type === 'RENAMED' && change.after) { // 重命名操作
      if (existingTitles.has(change.after)) { // 新名称已存在
        conflicts.push({
          type: 'rename_conflict',
          section: change.section,
          description: `重命名 "${change.before}" -> "${change.after}" 冲突：目标名称 "${change.after}" 已存在`,
          severity: 'error', // 重名冲突是严重错误
        });
      }
    }
  }

  // 4. add_duplicate: ADDED 的 section 名称是否已存在
  for (const change of changes) {
    if (change.type === 'ADDED') { // 新增操作
      if (existingTitles.has(change.section)) { // 名称已存在
        conflicts.push({
          type: 'add_duplicate',
          section: change.section,
          description: `section "${change.section}" 已存在，无法重复添加`,
          severity: 'error', // 重复添加是严重错误
        });
      }
    }
  }

  // 5. modify_deleted: MODIFIED 的 section 是否在 pendingChanges 中被 REMOVED
  if (pendingChanges && pendingChanges.length > 0) {
    const pendingRemoved = new Set( // 收集 pending 中被删除的 section
      pendingChanges.filter((c) => c.type === 'REMOVED').map((c) => c.section),
    );
    for (const change of changes) {
      if (change.type === 'MODIFIED' && pendingRemoved.has(change.section)) { // 修改已被删除的 section
        conflicts.push({
          type: 'modify_deleted',
          section: change.section,
          description: `section "${change.section}" 在其他 pending 变更中已被删除，无法修改`,
          severity: 'error', // 修改已删除的 section 是严重错误
        });
      }
    }
  }

  // 6. circular_reference: 检测 RENAMED 链是否成环
  const cyclicConflicts = detectRenameChainCycle(changes); // 检测循环引用
  conflicts.push(...cyclicConflicts); // 合并结果

  // 7. parallel_change: 检测不同 pending 变更对同一 section 的并发修改
  if (pendingChanges && pendingChanges.length > 0) {
    const currentSections = new Set<string>(); // 收集当前变更涉及的所有 section
    for (const change of changes) {
      currentSections.add(change.section); // 记录每个 section
    }
    for (const pc of pendingChanges) { // 遍历 pending 变更
      if (currentSections.has(pc.section)) { // 发现同 section 被并发修改
        // 避免与 concurrent_modify 重复报告：parallel_change 关注的是宏观的并行变更冲突
        const alreadyReported = conflicts.some(
          c => c.type === 'concurrent_modify' && c.section === pc.section // 检查是否已被 concurrent_modify 报告
        );
        if (!alreadyReported) { // 仅当未被 concurrent_modify 覆盖时报告
          conflicts.push({
            type: 'parallel_change',
            section: pc.section,
            description: `section "${pc.section}" 在当前变更和其他 pending 变更中被并行修改，可能导致内容覆盖`,
            severity: 'warning', // 并行变更是警告级别（不一定冲突，但需要关注）
          });
        }
      }
    }
  }

  return {
    hasConflicts: conflicts.length > 0, // 是否存在冲突
    conflicts,
  };
}

/**
 * 查找文档中对指定 section 的引用
 *
 * 检测两种引用模式：
 * - [[sectionName]] wiki 链接
 * - [任意文本](#sectionName) Markdown 锚点链接
 *
 * @param content     - 文档内容
 * @param sectionName - 目标 section 名称
 * @returns 引用所在行的描述列表
 */
function findReferences(content: string, sectionName: string): string[] {
  const references: string[] = []; // 引用列表
  const lines = content.split('\n'); // 按行分割
  const escaped = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // 转义正则特殊字符

  // 模式1: [[sectionName]] wiki 链接
  const wikiPattern = new RegExp(`\\[\\[${escaped}\\]\\]`); // wiki 链接正则
  // 模式2: [文本](#sectionName) 或 [文本](sectionName) Markdown 链接
  const linkPattern = new RegExp(`\\[.*?\\]\\(#?${escaped}\\)`); // Markdown 链接正则

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 跳过标题行（标题行本身不算引用）
    if (line.match(/^#{1,6}\s+/)) continue;
    if (wikiPattern.test(line) || linkPattern.test(line)) { // 匹配到引用
      references.push(`第 ${i + 1} 行`); // 记录行号（1-based 展示）
    }
  }

  return references;
}

/**
 * 检测 RENAMED 变更链是否成环
 *
 * 构建 before -> after 的有向图，检测是否存在环。
 * 例如: A->B, B->C, C->A 形成环。
 *
 * @param changes - 变更列表
 * @returns 环形冲突列表
 */
function detectRenameChainCycle(changes: ChangeItem[]): ConflictItem[] {
  const conflicts: ConflictItem[] = []; // 冲突列表
  const renameMap = new Map<string, string>(); // before -> after 映射

  // 构建重命名映射
  for (const change of changes) {
    if (change.type === 'RENAMED' && change.before && change.after) {
      renameMap.set(change.before, change.after); // 记录映射关系
    }
  }

  if (renameMap.size === 0) return conflicts; // 无重命名操作

  // 对每个起点执行环检测（快慢指针法简化版：遍历链长度不超过总数）
  const visited = new Set<string>(); // 已检测过的起点
  for (const [start] of renameMap) {
    if (visited.has(start)) continue; // 已检测过则跳过

    const chain: string[] = []; // 当前链
    const chainSet = new Set<string>(); // 链中节点集合
    let current: string | undefined = start; // 当前节点

    while (current && !chainSet.has(current)) { // 沿链遍历直到无后继或成环
      chain.push(current);
      chainSet.add(current);
      visited.add(current); // 标记已访问
      current = renameMap.get(current); // 跳转到下一个
    }

    if (current && chainSet.has(current)) { // 检测到环
      conflicts.push({
        type: 'circular_reference',
        section: current,
        description: `检测到重命名循环引用: ${chain.join(' -> ')} -> ${current}`,
        severity: 'error', // 循环引用是严重错误
      });
    }
  }

  return conflicts;
}
