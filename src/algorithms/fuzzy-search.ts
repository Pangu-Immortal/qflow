/**
 * 模糊搜索 - 零依赖 bigram 相似度算法（Dice 系数）
 *
 * 无需引入 fuse.js 等外部依赖，使用 bigram（2-char pairs）+ 包含匹配
 * 双重打分机制实现轻量级模糊搜索。
 *
 * 函数列表：
 *   - bigramSimilarity(a, b): 计算两个字符串的 Dice 系数（0-1）
 *   - containsScore(query, text): 计算包含匹配加分（0/0.3/0.5）
 *   - fuzzySearch(items, query, options): 泛型模糊搜索，返回排序后的匹配结果
 */

import { FUZZY_DEFAULT_THRESHOLD, FUZZY_DEFAULT_LIMIT } from '../shared/constants.js';

/**
 * 生成字符串的 bigram 集合（2-char pairs）
 * @param str - 输入字符串（自动小写化）
 * @returns bigram 数组
 */
function getBigrams(str: string): string[] {
  const s = str.toLowerCase(); // 小写化
  const bigrams: string[] = []; // bigram 列表
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.push(s.slice(i, i + 2)); // 截取 2 字符对
  }
  return bigrams;
}

/**
 * 计算两个字符串的 bigram 相似度（Dice 系数）
 *
 * Dice coefficient = 2 * |intersection| / (|A| + |B|)
 * 值域 0-1，1 表示完全相同，0 表示无交集。
 *
 * @param a - 字符串 A
 * @param b - 字符串 B
 * @returns Dice 系数（0-1）
 */
export function bigramSimilarity(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) { // 字符串太短无法生成 bigram
    return a.toLowerCase() === b.toLowerCase() ? 1 : 0; // 退化为精确匹配
  }
  const bigramsA = getBigrams(a); // A 的 bigram 集合
  const bigramsB = getBigrams(b); // B 的 bigram 集合
  const setB = new Set(bigramsB); // B 的集合用于快速查找
  let intersection = 0; // 交集计数
  for (const bg of bigramsA) {
    if (setB.has(bg)) { // bigram 在 B 中存在
      intersection++; // 交集 +1
      setB.delete(bg); // 避免重复计数
    }
  }
  return (2 * intersection) / (bigramsA.length + bigramsB.length); // Dice 系数公式
}

/**
 * 计算包含匹配加分
 *
 * 当 text 以 query 开头时加 0.5 分，包含 query 时加 0.3 分，否则 0 分。
 *
 * @param query - 搜索词
 * @param text  - 目标文本
 * @returns 加分值（0/0.3/0.5）
 */
export function containsScore(query: string, text: string): number {
  const lowerQuery = query.toLowerCase(); // 搜索词小写化
  const lowerText = text.toLowerCase(); // 目标文本小写化
  if (lowerText.startsWith(lowerQuery)) return 0.5; // 前缀匹配加 0.5
  if (lowerText.includes(lowerQuery)) return 0.3; // 包含匹配加 0.3
  return 0; // 无匹配
}

/** 模糊搜索选项 */
export interface FuzzySearchOptions<T> {
  getText: (item: T) => string; // 从元素中提取搜索文本的函数
  threshold?: number; // 最低分阈值（默认 FUZZY_DEFAULT_THRESHOLD）
  limit?: number; // 结果上限（默认 FUZZY_DEFAULT_LIMIT）
}

/** 模糊搜索结果 */
export interface FuzzySearchResult<T> {
  item: T; // 原始元素
  score: number; // 综合得分
}

/**
 * 泛型模糊搜索
 *
 * 对每个元素计算 bigramSimilarity + containsScore，
 * 按阈值过滤后按得分降序排列，返回前 limit 条结果。
 *
 * @param items   - 待搜索的元素列表
 * @param query   - 搜索关键词
 * @param options - 搜索选项（getText/threshold/limit）
 * @returns 排序后的匹配结果数组
 */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  options: FuzzySearchOptions<T>,
): FuzzySearchResult<T>[] {
  const threshold = options.threshold ?? FUZZY_DEFAULT_THRESHOLD; // 阈值
  const limit = options.limit ?? FUZZY_DEFAULT_LIMIT; // 结果上限

  const results: FuzzySearchResult<T>[] = []; // 结果收集

  for (const item of items) { // 遍历所有元素
    const text = options.getText(item); // 提取搜索文本
    const similarity = bigramSimilarity(query, text); // bigram 相似度
    const bonus = containsScore(query, text); // 包含匹配加分
    const score = similarity + bonus; // 综合得分

    if (score >= threshold) { // 超过阈值
      results.push({ item, score }); // 加入结果
    }
  }

  results.sort((a, b) => b.score - a.score); // 按得分降序排列

  return results.slice(0, limit); // 截取前 limit 条
}
