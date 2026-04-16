/**
 * Token 计数估算工具
 *
 * 按字符类型估算 Token 数量：
 * - 中文字符（\u4e00-\u9fff）：每个字符约 1.5 token
 * - 其他字符（英文、数字、符号等）：每 4 个字符约 1 token
 *
 * 函数列表：
 * - estimateTokens()  估算文本的 Token 数量
 * - formatTokens()    将 Token 数格式化为可读字符串（如 "1.2k"）
 */

/**
 * 中文字符 Unicode 范围正则（CJK 统一汉字基本区）
 */
const CJK_REGEX = /[\u4e00-\u9fff]/; // 匹配单个中文字符

/**
 * 估算文本的 Token 数量
 *
 * 遍历每个字符，中文字符计 1.5 token，其他字符累计后每 4 个计 1 token。
 *
 * @param text - 输入文本
 * @returns 估算的 Token 数量（取整）
 */
export function estimateTokens(text: string): number {
  let cjkCount = 0;   // 中文字符计数
  let otherCount = 0;  // 非中文字符计数

  for (const char of text) {                    // 遍历每个字符（支持 Unicode 代理对）
    if (CJK_REGEX.test(char)) {
      cjkCount++;                               // 中文字符 +1
    } else {
      otherCount++;                             // 非中文字符 +1
    }
  }

  const cjkTokens = cjkCount * 1.5;            // 中文：每字符 1.5 token
  const otherTokens = otherCount / 4;           // 其他：每 4 字符 1 token

  return Math.ceil(cjkTokens + otherTokens);    // 向上取整返回
}

/**
 * 将 Token 数量格式化为人类可读字符串
 *
 * - < 1000：直接显示数字，如 "856"
 * - >= 1000：显示为 "1.2k" 格式
 * - >= 1000000：显示为 "1.2M" 格式
 *
 * @param count - Token 数量
 * @returns 格式化后的字符串
 */
export function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`; // 百万级别
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;     // 千级别
  }
  return `${count}`;                              // 小于千直接显示
}
