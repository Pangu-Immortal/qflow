/**
 * AI 驱动复杂度评分（1-10）
 *
 * 功能：分析任务的技术深度/依赖数量/不确定性/代码影响范围，给出复杂度评分
 * 支持三种模式：
 *   - AI 模式：通过 Prompt 模板 + callAIWithSchema 获取 AI 评分
 *   - 启发式模式：无 AI 时基于简单规则计算评分
 *   - 智能模式：先尝试 AI，失败自动降级到启发式
 *
 * 函数列表：
 *   - buildScoringPrompt(task): 构建 AI 评分提示词
 *   - heuristicScore(task): 无 AI 时的多维度启发式评分（基于任务类型/关键词库/依赖数/子任务/跨域标签）
 *   - aiScore(task): 调用 AI 进行复杂度评分
 *   - smartScore(task): 先尝试 AI 评分，失败降级到启发式评分
 *
 * 导出类型：
 *   - ComplexityResultSchema: Zod schema，用于校验 AI 返回结果
 *   - ComplexityResult: 复杂度评分结果类型
 */

import { z } from 'zod';
import type { Task } from '../schemas/task.js';
import { callAIWithSchema } from '../core/ai-provider.js'; // AI 调用接口
import { loadPromptTemplate, renderPrompt, selectVariant } from '../shared/prompt-templates.js'; // Prompt 模板系统
import { log } from '../utils/logger.js'; // 日志工具

// 复杂度评分结果的 Zod Schema，用于校验 AI 返回的 JSON
export const ComplexityResultSchema = z.object({
  score: z.number().min(1).max(10),          // 综合评分 1-10
  reasoning: z.string(),                      // 评分理由
  expansionPrompt: z.string(),                // 拆解子任务的提示词
  suggestedSubtasks: z.number().min(0).max(20), // 建议拆分的子任务数
});

// 复杂度评分结果类型
export type ComplexityResult = z.infer<typeof ComplexityResultSchema>;

// AI 评分提示词模板（占位符将被实际任务信息替换）
const SCORING_PROMPT = `分析以下任务的复杂度，从以下维度评分（1-10）：
- 技术深度：需要的专业知识程度
- 依赖数量：涉及的外部模块/服务
- 不确定性：需求是否清晰、方案是否明确
- 代码影响范围：需要修改的文件数量和范围

任务标题：{title}
任务描述：{description}
依赖任务数：{depCount}
标签：{tags}

请返回 JSON 格式：
{
  "score": <1-10的综合评分>,
  "reasoning": "<评分理由，2-3句话>",
  "expansionPrompt": "<如果需要拆解，用什么提示词让AI生成子任务>",
  "suggestedSubtasks": <建议拆分为几个子任务，0表示不需要拆分>
}`;

// 构建 AI 评分提示词，将任务信息填入模板
export function buildScoringPrompt(task: Task): string {
  return SCORING_PROMPT
    .replace('{title}', task.title)                          // 填入任务标题
    .replace('{description}', task.description)              // 填入任务描述
    .replace('{depCount}', String(task.dependencies.length)) // 填入依赖数
    .replace('{tags}', task.tags.join(', ') || '无');         // 填入标签列表
}

// ====== 关键词复杂度库（三级分层） ======

// 高复杂度关键词，每命中 +2 分，最多触发 1 次
const HIGH_COMPLEXITY_KEYWORDS = [
  '安全', '加密', '并发', '分布式', '微服务', '性能优化',
  '缓存策略', '数据迁移', '实时', 'websocket', 'oauth', 'jwt',
  'security', 'encryption', 'concurrency', 'distributed', 'microservice',
  'migration', 'realtime', 'real-time',
]; // 涉及架构/安全/高并发等技术深水区

// 中复杂度关键词，每命中 +1 分，最多触发 2 次
const MEDIUM_COMPLEXITY_KEYWORDS = [
  'api', '数据库', 'database', '认证', '权限', '测试', '重构',
  '集成', '部署', 'ci/cd', 'docker', 'redis', 'authentication',
  'authorization', 'refactor', 'integration', 'deploy', 'kubernetes',
]; // 涉及后端服务/DevOps/中间件等常规技术栈

// 低复杂度关键词，每命中 +0.5 分，最多触发 2 次
const LOW_COMPLEXITY_KEYWORDS = [
  '配置', '文档', '样式', 'ui', '日志', '监控', '通知', '邮件',
  'config', 'documentation', 'style', 'logging', 'monitor', 'notification',
  'email', 'readme', 'changelog',
]; // 涉及配置/文档/样式等低风险操作

// ====== 任务类型基础分映射 ======
const TASK_TYPE_BASE_SCORES: Record<string, number> = {
  research: 2,       // 调研类：复杂度较低
  design: 3,         // 设计类：中等复杂度
  development: 4,    // 开发类：较高复杂度
  testing: 3,        // 测试类：中等复杂度
  documentation: 2,  // 文档类：复杂度较低
  review: 2,         // 评审类：复杂度较低
};

// 任务类型检测关键词（用于从标题/描述推断类型）
const TASK_TYPE_DETECTION: Record<string, string[]> = {
  research: ['调研', '研究', '分析', '评估', 'research', 'analyze', 'evaluate', 'investigate'],
  design: ['设计', '架构', '方案', 'design', 'architecture', 'blueprint', 'schema'],
  development: ['开发', '实现', '编码', '构建', '重构', 'develop', 'implement', 'build', 'code', 'refactor', 'feature'],
  testing: ['测试', '验证', '质检', 'test', 'verify', 'qa', 'e2e', 'unit test'],
  documentation: ['文档', '说明', '注释', 'document', 'readme', 'changelog', 'wiki'],
};

// ====== 跨域标签域分类 ======
const TAG_DOMAINS: Record<string, string[]> = {
  frontend: ['frontend', 'ui', 'ux', 'css', 'vue', 'react', 'angular', 'web', '前端', '界面', '样式'],
  backend: ['backend', 'api', 'server', 'database', 'db', '后端', '服务端', '接口'],
  devops: ['devops', 'ci', 'cd', 'ci/cd', 'docker', 'k8s', 'kubernetes', 'deploy', '部署', '运维'],
  testing: ['test', 'testing', 'qa', 'e2e', 'unit', '测试', '质检'],
  design: ['design', 'figma', 'sketch', 'prototype', '设计', '原型', 'ui/ux'],
};

/**
 * 增强启发式评分 - 多维度综合评估任务复杂度
 *
 * 评分维度：
 *   1. 任务类型基础分（2-4 分）
 *   2. 关键词复杂度（三级关键词库匹配）
 *   3. 依赖深度（依赖数量加权）
 *   4. 子任务加成（有子任务 +1）
 *   5. 跨域标签加成（跨 2+ 领域 +1）
 *
 * @param task - 要评分的任务
 * @returns 包含评分、推理过程、拆解建议的结果
 */
export function heuristicScore(task: Task): ComplexityResult {
  const reasoningParts: string[] = []; // 评分理由碎片，用于拼接最终推理过程
  const text = `${task.title} ${task.description}`.toLowerCase(); // 合并标题+描述为搜索文本

  // === 1. 任务类型基础分 ===
  let baseScore = 3; // 默认基础分
  let detectedType = '未识别'; // 检测到的任务类型

  if (task.category && TASK_TYPE_BASE_SCORES[task.category]) { // 优先使用 category 字段
    baseScore = TASK_TYPE_BASE_SCORES[task.category]; // 直接取对应基础分
    detectedType = task.category; // 记录类型
  } else { // category 缺失时从标题/描述推断
    for (const [type, keywords] of Object.entries(TASK_TYPE_DETECTION)) { // 遍历类型检测词典
      if (keywords.some(kw => text.includes(kw))) { // 命中任一关键词
        baseScore = TASK_TYPE_BASE_SCORES[type]; // 取对应基础分
        detectedType = type; // 记录类型
        break; // 首个匹配即停
      }
    }
  }
  reasoningParts.push(`基础分${baseScore}(${detectedType}类型)`); // 记录理由

  // === 2. 关键词复杂度评分 ===
  let keywordScore = 0; // 关键词加分
  const matchedKeywords: string[] = []; // 命中的关键词列表

  // 高复杂度：+2 每个，最多 1 次
  let highHits = 0; // 高级命中计数
  for (const kw of HIGH_COMPLEXITY_KEYWORDS) { // 遍历高复杂度词库
    if (highHits >= 1) break; // 达到上限则停止
    if (text.includes(kw)) { // 命中
      keywordScore += 2; // +2 分
      matchedKeywords.push(kw); // 记录关键词
      highHits++; // 计数 +1
    }
  }

  // 中复杂度：+1 每个，最多 2 次
  let mediumHits = 0; // 中级命中计数
  for (const kw of MEDIUM_COMPLEXITY_KEYWORDS) { // 遍历中复杂度词库
    if (mediumHits >= 2) break; // 达到上限则停止
    if (text.includes(kw)) { // 命中
      keywordScore += 1; // +1 分
      matchedKeywords.push(kw); // 记录关键词
      mediumHits++; // 计数 +1
    }
  }

  // 低复杂度：+0.5 每个，最多 2 次
  let lowHits = 0; // 低级命中计数
  for (const kw of LOW_COMPLEXITY_KEYWORDS) { // 遍历低复杂度词库
    if (lowHits >= 2) break; // 达到上限则停止
    if (text.includes(kw)) { // 命中
      keywordScore += 0.5; // +0.5 分
      matchedKeywords.push(kw); // 记录关键词
      lowHits++; // 计数 +1
    }
  }

  if (keywordScore > 0) { // 有关键词命中
    reasoningParts.push(`关键词${keywordScore}(${matchedKeywords.join('+')})`); // 记录理由
  }

  // === 3. 依赖深度评分 ===
  let depScore = 0; // 依赖加分
  const depCount = task.dependencies.length; // 依赖数量
  if (depCount > 0 && depCount <= 2) depScore = 1;  // 少量依赖 +1
  if (depCount > 2 && depCount <= 5) depScore = 2;  // 中等依赖 +2
  if (depCount > 5) depScore = 3;                    // 大量依赖 +3
  if (depScore > 0) { // 有依赖
    reasoningParts.push(`依赖${depScore}(${depCount}个依赖)`); // 记录理由
  }

  // === 4. 子任务加成 ===
  let subtaskScore = 0; // 子任务加分
  if (task.subtasks.length > 0) { // 有子任务
    subtaskScore = 1; // +1 分
    reasoningParts.push(`子任务+1(${task.subtasks.length}个子任务)`); // 记录理由
  }

  // === 5. 跨域标签加成 ===
  let crossDomainScore = 0; // 跨域加分
  const tagText = task.tags.map(t => t.toLowerCase()); // 标签全部转小写
  const matchedDomains = new Set<string>(); // 命中的域集合（去重）
  for (const [domain, domainKeywords] of Object.entries(TAG_DOMAINS)) { // 遍历域分类
    if (tagText.some(tag => domainKeywords.some(dk => tag.includes(dk)))) { // 标签命中任一域关键词
      matchedDomains.add(domain); // 记录域
    }
  }
  if (matchedDomains.size >= 2) { // 跨 2+ 域
    crossDomainScore = 1; // +1 分
    reasoningParts.push(`跨域+1(${Array.from(matchedDomains).join('+')})`); // 记录理由
  }

  // === 汇总并 clamp 到 1-10 ===
  const rawScore = baseScore + keywordScore + depScore + subtaskScore + crossDomainScore; // 原始总分
  const score = Math.max(1, Math.min(10, Math.round(rawScore))); // 四舍五入后限制在 1-10

  // 拼接完整推理
  const reasoning = `启发式评分：${reasoningParts.join(' + ')} = ${score}`; // 最终推理文本

  return {
    score, // 综合评分
    reasoning, // 评分推理过程
    expansionPrompt: score >= 7 ? `将任务"${task.title}"拆解为${Math.ceil(score / 2)}个可独立执行的子任务` : '', // 高复杂度才建议拆解
    suggestedSubtasks: score >= 7 ? Math.ceil(score / 2) : 0, // 高复杂度才建议子任务数
  };
}

/**
 * 使用 AI 进行复杂度评分
 *
 * 流程：
 * 1. 加载 analyze-complexity.json Prompt 模板
 * 2. 根据上下文选择合适的变体
 * 3. 渲染模板变量
 * 4. 调用 callAIWithSchema 并用 ComplexityResultSchema 校验
 *
 * @param task - 要评分的任务
 * @returns AI 生成的复杂度评分结果
 * @throws AI 调用或校验失败时抛出错误
 */
export async function aiScore(task: Task): Promise<ComplexityResult> {
  log.debug(`开始 AI 复杂度评分: ${task.id} - ${task.title}`); // 调试日志

  // 加载 Prompt 模板
  const template = await loadPromptTemplate('analyze-complexity.json'); // 加载分析模板
  if (!template) { // 模板加载失败
    throw new Error('无法加载 analyze-complexity.json 模板'); // 抛出错误
  }

  // 构建模板变量
  const variables = { // 模板参数映射
    taskTitle: task.title, // 任务标题
    taskDescription: task.description, // 任务描述
    dependencies: task.dependencies.join(', ') || '无', // 依赖列表
    tags: task.tags.join(', ') || '无', // 标签列表
  };

  // 选择变体并渲染
  const variant = selectVariant(template, variables); // 根据条件选择变体
  const systemPrompt = renderPrompt(variant.system, variables); // 渲染系统提示词
  const userPrompt = renderPrompt(variant.user, variables); // 渲染用户提示词

  // 调用 AI 并校验结果
  const result = await callAIWithSchema<ComplexityResult>( // 调用 AI
    userPrompt, // 用户提示词
    ComplexityResultSchema, // Zod 校验 schema
    { systemPrompt }, // 系统提示词
  );

  log.debug(`AI 复杂度评分结果: score=${result.score}, subtasks=${result.suggestedSubtasks}`); // 调试日志
  return result; // 返回评分结果
}

/**
 * 智能评分：先尝试 AI 评分，失败自动降级到启发式评分
 *
 * @param task - 要评分的任务
 * @returns 复杂度评分结果（AI 或启发式）
 */
export async function smartScore(task: Task): Promise<ComplexityResult> {
  try {
    log.debug(`smartScore: 尝试 AI 评分 - ${task.id}`); // 调试日志
    const result = await aiScore(task); // 尝试 AI 评分
    return result; // AI 成功，直接返回
  } catch (err) { // AI 调用失败
    log.warn(`AI 评分失败，降级到启发式评分: ${(err as Error).message}`); // 警告日志
    return heuristicScore(task); // 降级到启发式评分
  }
}
