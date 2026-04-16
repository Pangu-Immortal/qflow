/**
 * Delta Spec 确定性合并
 *
 * 功能：将增量变更列表按确定性顺序合并到原始 Markdown 文档中
 * 执行顺序：RENAMED → REMOVED → MODIFIED → ADDED
 * 每步都校验中间结果，任一步失败记录错误但继续执行（不全部回滚）
 *
 * 函数列表：
 *   - mergeSpecChanges(originalContent, changes): 主入口，执行确定性合并
 *   - escapeRegex(str): 辅助函数，转义正则特殊字符
 *   - findSectionBounds(content, sectionName): 辅助函数，定位 Markdown section 的行范围
 *   - findSectionBoundsEnhanced(content, sectionName): 增强版，使用 parseMarkdown 进行精准定位
 *   - removeSection(content, sectionName): 辅助函数，移除整个 section
 *   - replaceSection(content, sectionName, newContent): 辅助函数，替换 section 内容
 */

import type { ChangeItem } from '../schemas/change.js';
import { parseMarkdown, type MarkdownSection } from './markdown-parser.js'; // 结构化 Markdown 解析器

// 合并结果
export interface MergeResult {
  success: boolean;      // 是否全部成功（无错误）
  content: string;       // 合并后的文档内容
  appliedChanges: number; // 成功应用的变更数
  errors: string[];       // 错误信息列表
}

// 将增量变更列表合并到原始 Markdown 文档，返回合并结果
export function mergeSpecChanges(originalContent: string, changes: ChangeItem[]): MergeResult {
  let content = originalContent; // 工作副本
  const errors: string[] = []; // 错误收集
  let appliedCount = 0; // 成功计数

  // 按类型排序：RENAMED(0) → REMOVED(1) → MODIFIED(2) → ADDED(3)
  const order: Record<string, number> = { RENAMED: 0, REMOVED: 1, MODIFIED: 2, ADDED: 3 };
  const sorted = [...changes].sort((a, b) => (order[a.type] ?? 99) - (order[b.type] ?? 99));

  for (const change of sorted) {
    try {
      switch (change.type) {
        case 'RENAMED': { // 重命名 section 标题
          if (!change.before || !change.after) { // 校验必要字段
            errors.push(`RENAMED 需要 before 和 after: section=${change.section}`);
            continue;
          }
          // 匹配 Markdown 标题行（#~######），替换标题文本
          const sectionRegex = new RegExp(`(^|\\n)(#{1,6}\\s*)${escapeRegex(change.before)}`, 'g');
          const newContent = content.replace(sectionRegex, `$1$2${change.after}`);
          if (newContent === content) { // 替换未生效说明未找到
            errors.push(`RENAMED 未找到 section: ${change.before}`);
            continue;
          }
          content = newContent; // 应用替换
          appliedCount++;
          break;
        }
        case 'REMOVED': { // 移除整个 section（从标题到下一个同级标题）
          const removeResult = removeSection(content, change.section);
          if (!removeResult.found) { // 未找到目标 section
            errors.push(`REMOVED 未找到 section: ${change.section}`);
            continue;
          }
          content = removeResult.content; // 应用移除
          appliedCount++;
          break;
        }
        case 'MODIFIED': { // 替换 section 内容（保留标题行）
          if (!change.after) { // 校验必要字段
            errors.push(`MODIFIED 需要 after: section=${change.section}`);
            continue;
          }
          const modResult = replaceSection(content, change.section, change.after);
          if (!modResult.found) { // 未找到目标 section
            errors.push(`MODIFIED 未找到 section: ${change.section}`);
            continue;
          }
          content = modResult.content; // 应用替换
          appliedCount++;
          break;
        }
        case 'ADDED': { // 在末尾添加新 section
          if (!change.after) { // 校验必要字段
            errors.push(`ADDED 需要 after: section=${change.section}`);
            continue;
          }
          // 在文档末尾追加新的二级标题 section
          content = content.trimEnd() + '\n\n## ' + change.section + '\n\n' + change.after + '\n';
          appliedCount++;
          break;
        }
      }
    } catch (e) { // 捕获处理过程中的异常
      errors.push(`处理 ${change.type} section=${change.section} 时异常: ${e}`);
    }
  }

  return {
    success: errors.length === 0, // 无错误则为成功
    content,
    appliedChanges: appliedCount,
    errors,
  };
}

// 转义正则表达式特殊字符，避免 section 名称中的特殊字符干扰匹配
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


// 移除 Markdown 文档中的整个 section（标题行到下一个同级标题之间的所有内容）
function removeSection(content: string, sectionName: string): { found: boolean; content: string } {
  const bounds = findSectionBoundsEnhanced(content, sectionName);
  if (!bounds) return { found: false, content }; // 未找到
  const lines = content.split('\n');
  lines.splice(bounds.start, bounds.end - bounds.start); // 删除 section 行范围
  return { found: true, content: lines.join('\n') };
}

// 替换 Markdown 文档中 section 的内容（保留原标题行，替换正文部分）
function replaceSection(content: string, sectionName: string, newContent: string): { found: boolean; content: string } {
  const bounds = findSectionBoundsEnhanced(content, sectionName);
  if (!bounds) return { found: false, content }; // 未找到
  const lines = content.split('\n');
  const header = lines[bounds.start]; // 保留原标题行
  const replacement = [header, '', newContent.trim(), '']; // 标题 + 空行 + 新内容 + 空行
  lines.splice(bounds.start, bounds.end - bounds.start, ...replacement); // 替换行范围
  return { found: true, content: lines.join('\n') };
}

/**
 * 增强版 section 定位：使用 parseMarkdown 进行精准结构化定位
 *
 * 在结构化解析树中递归查找指定标题名的 section，返回行范围。
 * 作为 findSectionBounds 的增强替代，提供更精准的嵌套 section 识别能力。
 *
 * @param content     - Markdown 文档内容
 * @param sectionName - 目标 section 标题名
 * @returns 行范围对象（start/end/level），未找到返回 null
 */
export function findSectionBoundsEnhanced(content: string, sectionName: string): { start: number; end: number; level: number } | null {
  const sections = parseMarkdown(content); // 结构化解析
  const found = findInTree(sections, sectionName); // 在树中搜索
  if (!found) return null; // 未找到

  // 计算 section 的结束行号（包含所有子 section）
  const lines = content.split('\n');
  const endLine = computeSectionEnd(lines, found.line, found.level); // 计算结束行
  return { start: found.line, end: endLine, level: found.level };
}

/**
 * 在 MarkdownSection 树中递归查找指定标题名的 section
 *
 * @param sections    - MarkdownSection 数组
 * @param sectionName - 目标标题名
 * @returns 匹配的 MarkdownSection，未找到返回 null
 */
function findInTree(sections: MarkdownSection[], sectionName: string): MarkdownSection | null {
  for (const sec of sections) {
    if (sec.title === sectionName) return sec; // 标题匹配
    const found = findInTree(sec.children, sectionName); // 递归搜索子 section
    if (found) return found;
  }
  return null; // 未找到
}

/**
 * 计算 section 的结束行号（找到下一个同级或更高级标题）
 *
 * @param lines - 文档所有行
 * @param start - section 起始行号
 * @param level - section 标题级别
 * @returns 结束行号
 */
function computeSectionEnd(lines: string[], start: number, level: number): number {
  for (let i = start + 1; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+/); // 匹配标题行
    if (match && match[1].length <= level) return i; // 同级或更高级标题
  }
  return lines.length; // 默认到文件末尾
}
