/**
 * AI 调用层 - Provider fallback chain
 *
 * 提供统一的 AI 调用接口，支持多服务商 Provider 适配器。
 * 配置来源优先级: qflow.config.json > ~/.claude/settings.json
 * 内置指数退避重试（2 次，2s/4s）和 Zod schema 校验。
 * 支持多角色模型路由（main/research/fallback）。
 * v16.0: 通过 provider-adapter 注册表委托所有 AI 请求，不再内联 fetch。
 *
 * 函数列表:
 * - loadAIConfig()      加载 AI 配置（apiKey, baseUrl, model, provider, researchModel, fallbackModel）
 * - loadRoleConfig()    加载角色专属模型配置
 * - callAI()            调用 AI 获取文本响应（支持 role 路由 + projectContext 注入）
 * - callAIWithSchema()  调用 AI 并用 Zod 校验 JSON 响应
 */

import path from 'node:path'; // 路径拼接工具
import os from 'node:os'; // 操作系统信息
import { z } from 'zod'; // Zod 校验库
import { readJSON } from '../utils/file-io.js'; // JSON 读取工具
import { log } from '../utils/logger.js'; // 日志工具
import { QFLOW_DIR } from '../shared/tool-utils.js'; // .qflow 目录常量
import { DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, AI_REQUEST_TIMEOUT, MAX_RETRIES, RETRY_BASE_DELAY } from '../shared/constants.js'; // v15.0 R-3: 全局常量
import { tokenTracker } from './token-tracker.js'; // v10.0: Token 追踪器
import { registerBuiltinProviders, getProvider, listProviders } from './provider-adapter.js'; // v10.0: Provider 适配器

// v16.0 P-1: 模块加载时立即注册所有内置 Provider，确保 getProvider() 可用
registerBuiltinProviders();

export { listProviders } from './provider-adapter.js'; // v10.0: 重新导出 listProviders 供外部工具使用

/**
 * AI 响应结构
 */
export interface AIResponse {
  content: string; // AI 生成的文本内容
  model: string;   // 实际使用的模型名称
  tokens: number;  // 消耗的 token 数
}

/** settings.json 中可能的结构（部分字段） */
interface ClaudeSettings {
  apiKey?: string;    // 顶层 API 密钥（旧格式兼容）
  baseUrl?: string;   // 自定义 API 地址
  model?: string;     // 模型名称
  env?: {             // Claude Code 环境变量配置区
    ANTHROPIC_AUTH_TOKEN?: string;  // Claude Code 自身的 API Key
    ANTHROPIC_BASE_URL?: string;    // Claude Code 自身的 API 地址
    ANTHROPIC_MODEL?: string;       // Claude Code 自身的模型名
    [key: string]: unknown;
  };
  [key: string]: unknown; // 其他未知字段
}

/** AI 请求错误（含重试控制标记） */
interface AiRequestError extends Error {
  noRetry?: boolean; // 是否禁止重试
}

/** qflow 配置中 ai 字段的结构 */
interface QflowAIConfig {
  provider?: string;       // 服务商
  model?: string;          // 模型名称
  baseUrl?: string;        // API 地址
  apiKey?: string;         // API 密钥
  researchModel?: string;  // v16.0 P-2: 研究角色专用模型名
  fallbackModel?: string;  // v16.0 P-2: 降级专用模型名
}

/** qflow 配置文件的最小结构 */
interface QflowConfigPartial {
  ai?: QflowAIConfig; // AI 配置字段
  projectRoot?: string; // 项目根路径
}

/** 模型角色配置 */
export interface ModelRoleConfig {
  model: string;       // 模型名称
  baseUrl?: string;    // API 地址（可选，继承默认）
  apiKey?: string;     // API 密钥（可选，继承默认）
}

/** OpenAI 兼容 API 的响应体结构（用于降级处理） */
interface OpenAILikeResponse {
  choices?: Array<{ message?: { content?: string } }>; // 选项列表
  usage?: { total_tokens?: number }; // token 用量
  model?: string; // 模型名称
}

/** AI API 响应体 Zod Schema（模块级定义，避免每次调用时重新构造） */
const AIResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string() }), // 每个 choice 必须有 message.content
  })).min(1), // 至少有一个 choice
  model: z.string().optional(), // 模型名（可选）
  usage: z.object({ total_tokens: z.number() }).optional(), // token 统计（可选）
});

/** 多角色模型配置 */
export interface ModelRoles {
  main?: ModelRoleConfig;      // 主模型（默认）
  research?: ModelRoleConfig;  // 研究模型（用于复杂分析）
  fallback?: ModelRoleConfig;  // 降级模型（主模型失败时使用）
}

/** AI 调用角色类型 */
export type AIRole = 'main' | 'research' | 'fallback';

/** 默认 API 基础地址 */
const DEFAULT_BASE_URL = 'https://api.openai.com/v1'; // OpenAI 兼容默认地址

/** 默认模型 */
const DEFAULT_MODEL = 'claude-sonnet-4-20250514'; // 合理默认模型，避免空值导致调用失败

/** settings.json 路径 */
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json'); // ~/.claude/settings.json

/**
 * 加载 AI 配置
 *
 * 优先级:
 * 1. 环境变量 QFLOW_PROJECT_ROOT 指向的 qflow.config.json 中的 ai 字段
 * 2. ~/.claude/settings.json 中的 apiKey/baseUrl
 *
 * @returns AI 配置对象
 * @throws 找不到 API key 时抛出错误
 */
export async function loadAIConfig(): Promise<{ apiKey: string; baseUrl: string; model: string; provider: string; researchModel?: string; fallbackModel?: string }> {
  log.debug('加载 AI 配置...'); // 调试日志

  // 优先级最高：环境变量
  const envKey = process.env.QFLOW_API_KEY;
  if (envKey) {
    log.debug('从环境变量加载 AI 配置'); // 调试日志
    return {
      apiKey: envKey, // 环境变量 API 密钥
      baseUrl: process.env.QFLOW_BASE_URL || DEFAULT_BASE_URL, // 环境变量基础地址
      model: process.env.QFLOW_MODEL || DEFAULT_MODEL, // 环境变量模型名
      provider: process.env.QFLOW_PROVIDER || 'openai', // v16.0 P-2: 环境变量 provider
    };
  }

  // 尝试从 qflow.config.json 读取
  const projectRoot = process.env.QFLOW_PROJECT_ROOT; // 项目根路径环境变量
  if (projectRoot) { // 有项目路径
    const configPath = path.join(projectRoot, QFLOW_DIR, 'qflow.config.json'); // 配置文件路径
    const qflowConfig = await readJSON<QflowConfigPartial>(configPath); // 读取配置
    if (qflowConfig?.ai?.apiKey) { // 有 API key
      log.debug('从 qflow.config.json 加载 AI 配置'); // 调试日志
      return {
        apiKey: qflowConfig.ai.apiKey, // API 密钥
        baseUrl: qflowConfig.ai.baseUrl ?? DEFAULT_BASE_URL, // 基础地址，兜底默认
        model: qflowConfig.ai.model ?? DEFAULT_MODEL, // 模型名，兜底默认
        provider: qflowConfig.ai.provider ?? 'openai', // v16.0 P-2: provider 字段，默认 openai
        researchModel: qflowConfig.ai.researchModel, // v16.0 P-2: 研究模型（可选）
        fallbackModel: qflowConfig.ai.fallbackModel, // v16.0 P-2: 降级模型（可选）
      };
    }
  }

  // fallback 1: 从 ~/.claude/settings.json 顶层读取（旧格式兼容）
  const settings = await readJSON<ClaudeSettings>(SETTINGS_PATH); // 读取 settings
  if (settings?.apiKey) { // 有顶层 API key
    log.debug('从 ~/.claude/settings.json (apiKey) 加载 AI 配置'); // 调试日志
    return {
      apiKey: settings.apiKey, // API 密钥
      baseUrl: settings.baseUrl ?? DEFAULT_BASE_URL, // 基础地址
      model: settings.model ?? DEFAULT_MODEL, // 模型名
      provider: 'openai', // v16.0 P-2: settings.json 无 provider 字段，默认 openai
    };
  }

  // fallback 2: 自动复用 Claude Code 的 ANTHROPIC_AUTH_TOKEN（零配置方案）
  // Claude Code 将 API key 存储在 ~/.claude/settings.json 的 env.ANTHROPIC_AUTH_TOKEN 字段中
  // 自动读取此 key，让用户无需任何额外配置即可使用 qflow 的 AI 功能
  if (settings?.env?.ANTHROPIC_AUTH_TOKEN) {
    log.debug('自动复用 Claude Code 的 ANTHROPIC_AUTH_TOKEN（零配置）'); // 调试日志
    return {
      apiKey: settings.env.ANTHROPIC_AUTH_TOKEN, // 复用 Claude Code 的 key
      baseUrl: settings.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com/v1', // Claude API 默认地址
      model: settings.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL, // 模型名
      provider: 'anthropic', // Claude Code 使用 Anthropic API
    };
  }

  // 都没找到，抛出明确错误（含解决步骤）
  throw new Error(
    'AI API Key 未配置。qflow 的 AI 功能（任务拆解、Spec 生成、研究）需要 API Key。\n' +
    '其他 47 个工具无需 Key 即可正常使用。\n\n' +
    '配置方式（任选其一）：\n' +
    '  方式 A（推荐）: 如果你已安装 Claude Code，qflow 会自动读取其 API Key，无需额外配置\n' +
    '  方式 B: 设置环境变量 QFLOW_API_KEY=你的key QFLOW_BASE_URL=API地址 QFLOW_MODEL=模型名\n' +
    '  方式 C: 在 .qflow/qflow.config.json 的 ai.apiKey 字段中配置\n' +
    '  方式 D: 使用 Ollama 等本地模型（QFLOW_PROVIDER=ollama QFLOW_BASE_URL=http://localhost:11434/v1）',
  );
}

/**
 * 休眠指定毫秒数（用于重试间隔）
 * @param ms - 毫秒数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms)); // Promise 封装 setTimeout
}

// v15.0 Q-5: responseLanguage 模块级缓存，避免每次 callAI 都重复读取配置文件
let _cachedResponseLanguage: string | null = null; // 缓存的语言配置值（null 表示未配置或未加载）
let _responseLangCacheTime = 0; // 缓存写入时的时间戳（ms）
const LANG_CACHE_TTL = 60_000; // 60 秒缓存有效期

/**
 * 获取缓存的 responseLanguage（未命中返回 undefined 表示需要重新加载）
 * @returns 缓存值，或 undefined（缓存已过期）
 */
function getCachedResponseLanguage(): string | null | undefined {
  if (Date.now() - _responseLangCacheTime < LANG_CACHE_TTL) return _cachedResponseLanguage; // 命中缓存
  return undefined; // 缓存已过期，需重新加载
}

/**
 * 加载角色专属模型配置
 *
 * 从 qflow.config.json 的 models 字段读取角色配置。
 *
 * @param role - 模型角色
 * @returns 角色配置，未配置返回 null
 */
async function loadRoleConfig(role: AIRole): Promise<ModelRoleConfig | null> {
  const projectRoot = process.env.QFLOW_PROJECT_ROOT; // 项目根路径
  if (!projectRoot) return null; // 无项目路径

  try {
    const configPath = path.join(projectRoot, QFLOW_DIR, 'qflow.config.json'); // 配置文件路径
    const config = await readJSON<{ models?: ModelRoles }>(configPath); // 读取配置
    if (!config?.models) return null; // 无模型配置

    return config.models[role] || null; // 返回对应角色配置
  } catch (e) {
    log.debug(`角色配置加载失败 (${role}): ${(e as Error).message}`); // 记录配置读取失败原因
    return null; // 读取失败返回 null
  }
}

/**
 * 调用 AI 获取文本响应
 *
 * v16.0 P-3: 通过 provider-adapter 注册表委托请求，不再内联 fetch。
 * 失败时指数退避重试 2 次（2s、4s）。
 * v16.0 P-6: research 角色优先使用 config.researchModel；主模型失败时尝试 config.fallbackModel。
 *
 * @param prompt  - 用户提示词
 * @param options - 可选参数: systemPrompt, temperature, maxTokens, role, projectContext
 * @returns AI 响应对象
 */
export async function callAI(
  prompt: string,
  options?: { systemPrompt?: string; temperature?: number; maxTokens?: number; role?: AIRole; projectContext?: string },
): Promise<AIResponse> {
  const config = { ...(await loadAIConfig()) }; // 加载配置（展开为可变副本）

  // 多角色模型路由：根据 role 选择对应模型配置
  const role = options?.role || 'main'; // 默认使用主模型

  // v16.0 P-6: research 角色优先使用 config.researchModel（来自 ai.researchModel 字段）
  if (role === 'research' && config.researchModel) {
    config.model = config.researchModel; // 覆盖为研究专用模型
    log.debug(`v16.0 P-6: research 角色使用 ai.researchModel: ${config.model}`); // 调试日志
  } else {
    // 原有角色路由：从 models.{role} 配置中读取
    const roleConfig = await loadRoleConfig(role); // 加载角色配置
    if (roleConfig) { // 有角色专属配置
      if (roleConfig.model) config.model = roleConfig.model; // 覆盖模型
      if (roleConfig.baseUrl) config.baseUrl = roleConfig.baseUrl; // 覆盖地址
      if (roleConfig.apiKey) config.apiKey = roleConfig.apiKey; // 覆盖密钥
      log.debug(`使用 ${role} 角色模型: ${config.model}`); // 调试日志
    }
  }

  const messages: Array<{ role: string; content: string }> = []; // 消息列表
  if (options?.systemPrompt) { // 有系统提示词
    messages.push({ role: 'system', content: options.systemPrompt }); // 添加系统消息
  }

  // Phase 3 S-7: projectContext 注入 - 将项目上下文作为 system prompt 的一部分
  if (options?.projectContext) { // 传入了项目上下文
    const contextNote = `[项目上下文]\n${options.projectContext}`; // 格式化上下文
    const sysMsg = messages.find(m => m.role === 'system'); // 查找已有系统消息
    if (sysMsg) {
      sysMsg.content = `${contextNote}\n\n${sysMsg.content}`; // 注入到已有系统消息开头
    } else {
      messages.unshift({ role: 'system', content: contextNote }); // 插入新系统消息
    }
    log.debug('Phase 3 S-7: 已注入 projectContext 到 system prompt'); // 调试日志
  }

  messages.push({ role: 'user', content: prompt }); // 添加用户消息

  // v10.0: 响应语言注入（v15.0 Q-5: 使用模块级缓存避免重复读取配置文件）
  try {
    const projRoot = process.env.QFLOW_PROJECT_ROOT;
    if (projRoot) {
      const cached = getCachedResponseLanguage(); // 先查缓存
      let responseLanguage: string | null = null;

      if (cached !== undefined) { // 缓存命中（包括 null 表示"已确认无配置"）
        responseLanguage = cached; // 直接使用缓存值
        log.debug('responseLanguage 使用缓存值'); // 调试日志
      } else { // 缓存未命中或已过期，重新读取
        const cfgPath = path.join(projRoot, QFLOW_DIR, 'qflow.config.json');
        const cfg = await readJSON<{ responseLanguage?: string }>(cfgPath);
        responseLanguage = cfg?.responseLanguage ?? null; // 读取配置值（无则为 null）
        _cachedResponseLanguage = responseLanguage; // 写入缓存（null 也缓存，避免重复读取空配置）
        _responseLangCacheTime = Date.now(); // 更新缓存时间戳
        log.debug(`responseLanguage 已刷新缓存: ${responseLanguage ?? '(未配置)'}`); // 调试日志
      }

      if (responseLanguage) { // 有语言配置
        const langNote = `请使用 ${responseLanguage} 语言回复。`;
        // 查找 system 消息并追加，或新建一条
        const sysMsg = messages.find(m => m.role === 'system');
        if (sysMsg) {
          sysMsg.content += `\n\n${langNote}`; // 追加到已有系统提示末尾
        } else {
          messages.unshift({ role: 'system', content: langNote }); // 插入新系统消息到消息列表头部
        }
      }
    }
  } catch (e) {
    log.debug(`responseLanguage 加载失败: ${(e as Error).message}`); // 忽略配置读取失败，不影响主流程
  }

  // 模型空值防御：经过所有配置源和角色路由后，model 仍为空则立即报错
  if (!config.model) {
    throw new Error('未配置 AI 模型。请通过 qflow_models_switch 或 qflow.config.json 设置 ai.model');
  }

  // v16.0 P-3: 通过 provider-adapter 注册表获取适配器，委托 callChat()
  const providerName = config.provider || 'openai'; // 服务商名称，默认 openai
  const adapter = getProvider(providerName); // 从注册表获取适配器
  if (!adapter) {
    throw new Error(`未找到 Provider 适配器: "${providerName}"，已注册: [${listProviders().join(', ')}]`);
  }
  log.debug(`v16.0 P-3: 使用 Provider 适配器: ${providerName}, model=${config.model}`); // 调试日志

  // 构建适配器调用选项
  const callOptions = {
    model: config.model, // 模型名
    temperature: options?.temperature ?? DEFAULT_TEMPERATURE, // 温度参数
    maxTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS, // 最大 token 数
    timeout: AI_REQUEST_TIMEOUT, // 超时时间
    role, // v16.0 P-8: 传递角色给适配器（Perplexity 用于启用 search_recency_filter）
  };

  // 构建 ProviderConfig
  const providerConfig = {
    apiKey: config.apiKey, // API 密钥
    baseUrl: config.baseUrl, // API 地址
    model: config.model, // 模型名
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) { // v15.0 R-3: 重试次数从常量取
    try {
      log.debug(`AI 调用 (尝试 ${attempt + 1}/${MAX_RETRIES + 1}): provider=${providerName}, model=${config.model}`); // 调试日志

      // v16.0 P-3: 委托给 provider adapter 执行实际请求
      const adapterResponse = await adapter.callChat(
        messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, // 类型断言适配 ChatMessage 类型
        callOptions,
        providerConfig,
      );

      const content = adapterResponse.content; // 提取内容
      const tokens = adapterResponse.totalTokens; // 总 token 数

      // v10.0: Token 追踪（v16.0: 现在有完整的 promptTokens/completionTokens）
      tokenTracker.record({
        timestamp: new Date().toISOString(),
        model: adapterResponse.model,
        role: role,
        promptTokens: adapterResponse.promptTokens, // v16.0: 完整 token 追踪
        completionTokens: adapterResponse.completionTokens, // v16.0: 完整 token 追踪
        totalTokens: tokens,
      });

      log.debug(`AI 响应成功: ${tokens} tokens (prompt=${adapterResponse.promptTokens}, completion=${adapterResponse.completionTokens})`); // 调试日志
      return { content, model: adapterResponse.model, tokens }; // 返回结果

    } catch (err) { // 捕获错误
      const noRetry = (err as AiRequestError)?.noRetry === true; // 检查是否禁止重试
      if (!noRetry && attempt < MAX_RETRIES) { // v15.0 R-3: 还可以重试且非 4xx 错误
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt); // v15.0 R-3: 指数退避从常量取
        log.warn(`AI 调用失败 (尝试 ${attempt + 1})，${delay / 1000}s 后重试: ${(err as Error).message}`); // 警告
        await sleep(delay); // 等待
      } else { // 重试耗尽
        // v21.0 P0-5: 短路判断——若当前 role 已经是 'fallback' 则直接抛出，防止无限递归
        if (role === 'fallback') {
          log.error(`fallback 模型调用最终失败，终止递归降级: ${(err as Error).message}`);
          throw err; // 直接抛出，不再递归
        }
        // v16.0 P-6: 主模型失败时，优先使用 config.fallbackModel（ai.fallbackModel 字段），再尝试 models.fallback
        // v21.0 P0-5: 此处 role 已经过上方短路判断，确保不是 'fallback'
        // 先尝试 config.fallbackModel（ai 字段中的简化配置）
        if (config.fallbackModel) {
          log.warn(`${role} 模型最终失败，切换到 ai.fallbackModel: ${config.fallbackModel}`);
          const fallbackCallOptions = { ...callOptions, model: config.fallbackModel }; // 更新选项中的模型名
          const fallbackProviderConfig = { ...providerConfig, model: config.fallbackModel }; // 更新 provider 配置
          try {
            const fbResponse = await adapter.callChat(
              messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
              fallbackCallOptions,
              fallbackProviderConfig,
            );
            tokenTracker.record({
              timestamp: new Date().toISOString(),
              model: fbResponse.model,
              role: 'fallback',
              promptTokens: fbResponse.promptTokens,
              completionTokens: fbResponse.completionTokens,
              totalTokens: fbResponse.totalTokens,
            });
            log.debug(`fallbackModel 响应成功: ${fbResponse.totalTokens} tokens`); // 调试日志
            return { content: fbResponse.content, model: fbResponse.model, tokens: fbResponse.totalTokens };
          } catch (fbErr) {
            log.warn(`ai.fallbackModel (${config.fallbackModel}) 也失败: ${(fbErr as Error).message}`); // 降级失败日志
          }
        }
        // 再尝试 models.fallback 角色配置（原有逻辑）
        const fallbackRoleConfig = await loadRoleConfig('fallback');
        if (fallbackRoleConfig) {
          log.warn(`${role} 模型最终失败，切换到 models.fallback 模型: ${fallbackRoleConfig.model}`);
          return callAI(prompt, { ...options, role: 'fallback' });
        }
        log.error(`AI 调用最终失败: ${(err as Error).message}`); // 错误日志
        throw err; // 抛出最终错误
      }
    }
  }

  throw new Error('AI 调用失败: 超出最大重试次数'); // 理论上不会到达，TypeScript 要求
}

/**
 * 调用 AI 并用 Zod schema 校验 JSON 响应
 *
 * 流程:
 * 1. 调用 callAI 获取文本
 * 2. 解析 JSON
 * 3. 用 Zod schema 校验
 * 4. 校验失败时重试一次（附带格式修正提示）
 *
 * @param prompt  - 用户提示词
 * @param schema  - Zod schema，用于校验响应 JSON
 * @param options - 可选参数: systemPrompt
 * @returns 校验后的类型化对象
 */
export async function callAIWithSchema<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  options?: { systemPrompt?: string },
): Promise<T> {
  const jsonPrompt = `${prompt}\n\n请严格以 JSON 格式回复，不要包含 markdown 代码块标记。`; // 附加 JSON 格式要求

  const response = await callAI(jsonPrompt, options); // 第一次调用
  const rawContent = response.content.trim(); // 去除首尾空白

  // 尝试解析和校验
  try {
    const cleaned = rawContent.replace(/^```json?\n?/i, '').replace(/\n?```$/i, ''); // 移除可能的代码块标记
    const parsed = JSON.parse(cleaned); // 解析 JSON
    return schema.parse(parsed); // Zod 校验并返回
  } catch (firstErr) { // 第一次失败
    log.warn(`AI JSON 响应校验失败，尝试修正: ${(firstErr as Error).message}，原始内容长度: ${rawContent.length}`); // P3: 增加重试上下文信息

    // 重试: 告诉 AI 格式错误并要求修正
    const retryPrompt =
      `上一次的回复格式有误:\n${rawContent}\n\n` +
      `错误: ${(firstErr as Error).message}\n\n` +
      `请修正后重新以纯 JSON 格式回复（不要 markdown 代码块）。`; // 修正提示

    const retryResponse = await callAI(retryPrompt, options); // 第二次调用
    const retryContent = retryResponse.content.trim(); // 去除空白

    try {
      const cleaned = retryContent.replace(/^```json?\n?/i, '').replace(/\n?```$/i, ''); // 移除代码块标记
      const parsed = JSON.parse(cleaned); // 解析 JSON
      return schema.parse(parsed); // Zod 校验并返回
    } catch (secondErr) { // 第二次也失败
      log.error(`AI JSON 响应二次校验失败: ${(secondErr as Error).message}，原始长度: ${retryContent.length}`); // P3: 增加上下文
      throw new Error(`AI 响应无法解析为有效 JSON 并通过 schema 校验（2次尝试）: ${(secondErr as Error).message}`); // 抛出最终错误
    }
  }
}
