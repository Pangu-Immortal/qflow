/**
 * Markdown 结构化解析器 - 将 Markdown 文档解析为层级化 Section 树
 *
 * 按 # ~ ###### 标题行分割文档，支持嵌套层级结构。
 * 可用于 Spec 文档的精准 section 定位、冲突检测和结构化操作。
 *
 * 函数列表：
 *   - parseMarkdown(content): 主入口，将 Markdown 文本解析为 MarkdownSection 树
 *   - findSection(sections, path): 根据标题路径查找 section
 *   - serializeSections(sections): 将 MarkdownSection[] 重新序列化为 Markdown 文本
 *   - getAllSectionTitles(sections): 递归收集所有 section 标题（辅助函数）
 */

/** Section 结构 */
export interface MarkdownSection {
  title: string;     // section 标题文本
  content: string;   // section 正文（不含标题行）
  level: number;     // 标题级别（1-6）
  line: number;      // 起始行号（0-based）
  children: MarkdownSection[]; // 子 section（更低级别标题）
}

/**
 * 主入口：将 Markdown 文本解析为 MarkdownSection 树
 *
 * 解析规则：
 * - 按 # ~ ###### 标题行识别 section 边界
 * - 同级或更高级标题开启新 section，更低级标题作为 children
 * - content 为标题行到下一个同级/更高级标题之间的纯文本（不含子 section）
 * - 文档开头无标题的内容会被忽略（不生成 section）
 *
 * @param content - Markdown 文本
 * @returns 顶层 MarkdownSection 数组
 */
export function parseMarkdown(content: string): MarkdownSection[] {
  const lines = content.split('\n'); // 按行分割
  const headings: Array<{ title: string; level: number; line: number }> = []; // 收集所有标题行

  // 第一遍扫描：提取所有标题行的位置和级别
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)/); // 匹配 Markdown 标题
    if (match) {
      headings.push({
        title: match[2].trim(), // 标题文本
        level: match[1].length, // 标题级别（# 的数量）
        line: i,                // 行号（0-based）
      });
    }
  }

  if (headings.length === 0) return []; // 无标题则返回空

  // 为每个标题提取其正文内容（标题行之后、下一个标题行之前的文本）
  const rawSections: Array<{ title: string; level: number; line: number; content: string }> = [];
  for (let i = 0; i < headings.length; i++) {
    const startLine = headings[i].line + 1; // 正文起始行（标题的下一行）
    const endLine = i + 1 < headings.length ? headings[i + 1].line : lines.length; // 正文结束行
    const bodyLines = lines.slice(startLine, endLine); // 提取正文行
    // 去掉首尾空行后拼接
    const content = trimEmptyLines(bodyLines.join('\n'));
    rawSections.push({
      title: headings[i].title,
      level: headings[i].level,
      line: headings[i].line,
      content,
    });
  }

  // 第二遍：构建嵌套树结构
  return buildTree(rawSections, 0, rawSections.length, 0);
}

/**
 * 递归构建 section 树
 *
 * @param sections - 扁平 section 列表
 * @param start    - 当前处理范围的起始索引
 * @param end      - 当前处理范围的结束索引（不含）
 * @param minLevel - 当前层级的最小标题级别（0 表示不限）
 * @returns 当前层级的 MarkdownSection 数组
 */
function buildTree(
  sections: Array<{ title: string; level: number; line: number; content: string }>,
  start: number,
  end: number,
  minLevel: number,
): MarkdownSection[] {
  const result: MarkdownSection[] = []; // 结果列表
  let i = start; // 当前索引

  while (i < end) {
    const sec = sections[i]; // 当前 section

    // 找到此 section 的子范围（下一个同级或更高级标题之前的所有更低级标题）
    let childEnd = i + 1; // 子范围结束索引
    while (childEnd < end && sections[childEnd].level > sec.level) {
      childEnd++; // 扩展子范围
    }

    // 提取子 section 的正文内容（不含子 section 的内容）
    // content 只保留标题行到第一个子标题之间的文本
    let ownContent = sec.content; // 默认是全部正文
    if (i + 1 < childEnd) {
      // 有子 section，截取到第一个子标题之前的内容
      const firstChildLine = sections[i + 1].line; // 第一个子标题的行号
      const lines = sec.content.split('\n'); // 正文按行分割
      // 计算正文相对于 section 起始行的偏移
      const contentStartLine = sec.line + 1; // 正文起始行
      const relativeChildLine = firstChildLine - contentStartLine; // 子标题相对正文的行号
      if (relativeChildLine > 0 && relativeChildLine <= lines.length) {
        ownContent = trimEmptyLines(lines.slice(0, relativeChildLine).join('\n'));
      } else {
        ownContent = ''; // 无独立正文
      }
    }

    // 递归构建子 section
    const children = i + 1 < childEnd
      ? buildTree(sections, i + 1, childEnd, sec.level + 1) // 递归处理子范围
      : []; // 无子 section

    result.push({
      title: sec.title,
      content: ownContent,
      level: sec.level,
      line: sec.line,
      children,
    });

    i = childEnd; // 跳到下一个同级 section
  }

  return result;
}

/**
 * 去除字符串首尾空行（保留中间空行）
 *
 * @param text - 输入文本
 * @returns 去除首尾空行后的文本
 */
function trimEmptyLines(text: string): string {
  return text.replace(/^\n+/, '').replace(/\n+$/, ''); // 去除首尾换行
}

/**
 * 根据标题路径查找 section
 *
 * 路径示例: ['架构设计', 'API 层'] 表示查找「架构设计」下的「API 层」子 section。
 *
 * @param sections - MarkdownSection 数组（parseMarkdown 的输出）
 * @param path     - 标题路径数组
 * @returns 匹配的 MarkdownSection，未找到返回 null
 */
export function findSection(sections: MarkdownSection[], path: string[]): MarkdownSection | null {
  if (path.length === 0) return null; // 空路径

  const [head, ...rest] = path; // 取第一层标题
  const found = sections.find((s) => s.title === head); // 在当前层级查找
  if (!found) return null; // 未找到

  if (rest.length === 0) return found; // 路径匹配完毕
  return findSection(found.children, rest); // 递归查找子路径
}

/**
 * 将 MarkdownSection[] 重新序列化为 Markdown 文本
 *
 * 按层级还原标题行和正文内容，递归处理子 section。
 *
 * @param sections - MarkdownSection 数组
 * @returns 序列化后的 Markdown 文本
 */
export function serializeSections(sections: MarkdownSection[]): string {
  const parts: string[] = []; // 结果片段

  for (const section of sections) {
    const hashes = '#'.repeat(section.level); // 生成标题前缀（# ~ ######）
    parts.push(`${hashes} ${section.title}`); // 标题行

    if (section.content.trim().length > 0) { // 有正文内容
      parts.push(''); // 标题后空行
      parts.push(section.content); // 正文
    }

    if (section.children.length > 0) { // 有子 section
      parts.push(''); // 子 section 前空行
      parts.push(serializeSections(section.children)); // 递归序列化子 section
    }

    parts.push(''); // section 间空行
  }

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'; // 合并并规范化空行
}

/**
 * 递归收集所有 section 标题（辅助函数，用于冲突检测）
 *
 * @param sections - MarkdownSection 数组
 * @returns 所有标题文本的集合
 */
export function getAllSectionTitles(sections: MarkdownSection[]): Set<string> {
  const titles = new Set<string>(); // 标题集合
  for (const section of sections) {
    titles.add(section.title); // 添加当前标题
    for (const title of getAllSectionTitles(section.children)) { // 递归收集子标题
      titles.add(title);
    }
  }
  return titles;
}
