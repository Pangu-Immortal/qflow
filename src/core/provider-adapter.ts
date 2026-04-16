/**
 * Provider Adapter - 多 AI 服务商适配器模式（v10.0）
 *
 * 定义统一的 ProviderAdapter 接口，每个服务商实现该接口。
 * OpenAI 兼容格式作为基类，Anthropic/Google/Azure/Perplexity 各自派生。
 * 注册表 Map<string, ProviderAdapter> 管理所有适配器。
 *
 * 函数/类列表:
 * - ChatMessage          聊天消息结构
 * - CallOptions          调用选项（含 reasoningEffort）
 * - ReasoningEffort      推理努力程度类型
 * - ProviderConfig       服务商配置
 * - ProviderAdapter      适配器接口
 * - OpenAICompatibleAdapter   OpenAI 兼容基类（复用于 Groq/OpenRouter/xAI/Ollama）
 * - AnthropicAdapter     Anthropic Messages API 适配器
 * - GoogleAdapter        Google Gemini API 适配器
 * - AzureAdapter         Azure OpenAI 适配器
 * - PerplexityAdapter    Perplexity 适配器（继承 OpenAI + search_recency_filter）
 * - VertexAdapter        v13.0 P-2: Google Vertex AI 适配器（继承 GoogleAdapter）
 * - buildPromptFromMessages() v18.0: 将消息列表拼接为单一提示文本
 * - parseCliOutput()     v18.0: 解析 CLI 输出为 ProviderResponse 格式
 * - CLIProviderAdapter   v18.0: CLI 适配器抽象基类（通过 execFile 调用本地 CLI）
 * - ClaudeCLIAdapter     v18.0: Claude CLI 适配器（command='claude'）
 * - GrokCLIAdapter       v18.0: Grok CLI 适配器（command='grok'）
 * - MistralCLIAdapter    v18.0: Mistral CLI 适配器（command='mistral'）
 * - CodexAdapter         v13.0 P-3 / v18.0 重构: OpenAI Codex CLI 适配器（继承 CLIProviderAdapter）
 * - GeminiCLIAdapter     v13.0 P-4 / v18.0 重构: Google Gemini CLI 适配器（继承 CLIProviderAdapter）
 * - registerProvider()   注册适配器到全局注册表
 * - getProvider()        从注册表获取适配器
 * - listProviders()      列出所有已注册的适配器名称
 * - registerBuiltinProviders() 注册所有内置适配器
 */

import { execFile } from 'child_process'; // 子进程执行
import { promisify } from 'util'; // Promise 化工具
import { log } from '../utils/logger.js'; // 日志工具
import { AI_REQUEST_TIMEOUT, ANTHROPIC_API_VERSION } from '../shared/constants.js'; // v16.0 P-4: 全局超时常量; v21.0: Anthropic API 版本常量
import { CLI_SPAWN_TIMEOUT, CLI_MAX_BUFFER } from '../shared/constants.js'; // v18.0: CLI 超时和缓冲区常量

/** promisify 版 execFile */
const execFileAsync = promisify(execFile);

/** 聊天消息结构 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'; // 消息角色
  content: string; // 消息内容
}

/** 推理努力程度（仅 OpenAI 兼容 Provider 支持） */
export type ReasoningEffort = 'xhigh' | 'high' | 'medium' | 'low';

/** 调用选项 */
export interface CallOptions {
  model: string;        // 模型名称
  temperature?: number; // 温度参数
  maxTokens?: number;   // 最大 token 数
  timeout?: number;     // 超时时间（毫秒）
  reasoningEffort?: ReasoningEffort; // 推理努力程度（仅 OpenAI 兼容 Provider 生效，Anthropic/Google 静默忽略）
  role?: string; // v16.0 P-8: 调用角色（'main' | 'research' | 'fallback'），Perplexity 用于启用 search_recency_filter
}

/** 服务商配置 */
export interface ProviderConfig {
  apiKey: string;                      // API 密钥
  baseUrl: string;                     // API 基础地址
  model: string;                       // 模型名称
  headers?: Record<string, string>;    // 自定义请求头
}

/** AI 响应结构（与 ai-provider.ts 中的 AIResponse 对齐） */
export interface ProviderResponse {
  content: string;       // AI 生成的文本内容
  model: string;         // 实际使用的模型名称
  promptTokens: number;  // 输入 token 数
  completionTokens: number; // 输出 token 数
  totalTokens: number;   // 总 token 数
}

/** 适配器接口 - 所有服务商必须实现 */
export interface ProviderAdapter {
  name: string; // 服务商名称
  /** 调用聊天 API */
  callChat(messages: ChatMessage[], options: CallOptions, config: ProviderConfig): Promise<ProviderResponse>;
}

// ==================== 全局注册表 ====================

/** 适配器注册表 */
const registry = new Map<string, ProviderAdapter>();

/** 注册适配器 */
export function registerProvider(name: string, adapter: ProviderAdapter): void {
  registry.set(name, adapter); // 写入注册表
  log.debug(`Provider 已注册: ${name}`); // 调试日志
}

/** 获取适配器 */
export function getProvider(name: string): ProviderAdapter | undefined {
  return registry.get(name); // 从注册表读取
}

/** 列出所有已注册的适配器名称 */
export function listProviders(): string[] {
  return [...registry.keys()]; // 返回键列表
}

// ==================== OpenAI 兼容基类 ====================

/** OpenAI 兼容 API 响应体结构 */
interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>; // 选项列表
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }; // token 用量
  model?: string; // 模型名称
}

/**
 * OpenAI 兼容适配器基类
 *
 * 覆盖 OpenAI/Groq/OpenRouter/xAI/Ollama 格式。
 * POST /v1/chat/completions with Bearer token。
 */
export class OpenAICompatibleAdapter implements ProviderAdapter {
  name = 'openai'; // 服务商名称

  async callChat(messages: ChatMessage[], options: CallOptions, config: ProviderConfig): Promise<ProviderResponse> {
    const url = `${config.baseUrl}/chat/completions`; // API 端点
    const controller = new AbortController(); // 中止控制器
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || AI_REQUEST_TIMEOUT); // v16.0 P-4: 超时从全局常量取

    try {
      const response = await fetch(url, { // 发送请求
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`, // Bearer token 认证
          ...config.headers, // 自定义请求头
        },
        body: JSON.stringify({
          model: options.model || config.model, // 模型名
          messages, // 消息列表
          temperature: options.temperature ?? 0.7, // 温度
          max_tokens: options.maxTokens ?? 4096, // 最大 token
          ...(options.reasoningEffort ? { reasoning_effort: options.reasoningEffort } : {}), // 推理努力程度（仅 OpenAI 兼容 Provider）
        }),
        signal: controller.signal, // 绑定中止信号
      });

      if (!response.ok) { // HTTP 错误
        const errText = await response.text();
        throw new Error(`${this.name} API 返回 ${response.status}: ${errText}`);
      }

      const data = await response.json() as OpenAIResponse; // 解析响应
      const content = data.choices?.[0]?.message?.content ?? ''; // 提取内容
      const promptTokens = data.usage?.prompt_tokens ?? 0; // 输入 token
      const completionTokens = data.usage?.completion_tokens ?? 0; // 输出 token
      const totalTokens = data.usage?.total_tokens ?? (promptTokens + completionTokens); // 总 token

      return {
        content,
        model: data.model ?? config.model,
        promptTokens,
        completionTokens,
        totalTokens,
      };
    } finally {
      clearTimeout(timeoutId); // 清理定时器
    }
  }
}

// ==================== Anthropic 适配器 ====================

/** Anthropic Messages API 响应体结构 */
interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>; // 内容块列表
  model?: string; // 模型名称
  usage?: { input_tokens?: number; output_tokens?: number }; // token 用量
}

/**
 * Anthropic 适配器
 *
 * POST /v1/messages with x-api-key header。
 * 将 system 消息从 messages 中提取到 system 参数。
 */
export class AnthropicAdapter implements ProviderAdapter {
  name = 'anthropic';

  async callChat(messages: ChatMessage[], options: CallOptions, config: ProviderConfig): Promise<ProviderResponse> {
    const systemMessages = messages.filter(m => m.role === 'system'); // 提取 system 消息
    const nonSystemMessages = messages.filter(m => m.role !== 'system'); // 非 system 消息
    const systemPrompt = systemMessages.map(m => m.content).join('\n'); // 拼接 system 提示

    const url = `${config.baseUrl}/messages`; // Anthropic API 端点
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || AI_REQUEST_TIMEOUT); // v16.0 P-4: 超时从全局常量取

    try {
      const body: Record<string, unknown> = { // 请求体
        model: options.model || config.model,
        messages: nonSystemMessages.map(m => ({ role: m.role, content: m.content })),
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
      };
      if (systemPrompt) body.system = systemPrompt; // system 作为独立参数

      // v21.0 P1-9: 支持 reasoningEffort（Anthropic 的 extended_thinking 参数）
      if (options.reasoningEffort) {
        // Anthropic 使用 thinking 参数启用扩展推理，budget_tokens 根据 effort 级别调节
        const budgetMap: Record<string, number> = {
          low: 1024,    // 低推理深度：1K token 预算
          medium: 4096, // 中推理深度：4K token 预算
          high: 16000,  // 高推理深度：16K token 预算（xhigh 同）
          xhigh: 16000, // 极高推理深度：16K token 预算
        };
        const budgetTokens = budgetMap[options.reasoningEffort] ?? 4096; // 默认 medium
        body.thinking = { type: 'enabled', budget_tokens: budgetTokens }; // 启用扩展推理
        // 启用 extended_thinking 时 temperature 必须为 1
        body.temperature = 1;
        log.debug(`Anthropic extended_thinking 已启用: effort=${options.reasoningEffort}, budget=${budgetTokens}`); // 调试日志
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey, // Anthropic 使用 x-api-key
          'anthropic-version': ANTHROPIC_API_VERSION, // API 版本
          ...config.headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API 返回 ${response.status}: ${errText}`);
      }

      const data = await response.json() as AnthropicResponse;
      const content = data.content?.find(c => c.type === 'text')?.text ?? ''; // 提取文本内容
      const promptTokens = data.usage?.input_tokens ?? 0;
      const completionTokens = data.usage?.output_tokens ?? 0;

      return {
        content,
        model: data.model ?? config.model,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ==================== Google Gemini 适配器 ====================

/** Google Gemini API 响应体结构 */
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; // 候选列表
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number }; // token 用量
  modelVersion?: string; // 模型版本
}

/**
 * Google Gemini 适配器
 *
 * POST /v1beta/models/{model}:generateContent with ?key= query param。
 * 消息格式转换为 contents[{parts[{text}]}]。
 */
export class GoogleAdapter implements ProviderAdapter {
  name = 'google';

  async callChat(messages: ChatMessage[], options: CallOptions, config: ProviderConfig): Promise<ProviderResponse> {
    const model = options.model || config.model;
    const url = `${config.baseUrl}/models/${model}:generateContent?key=${config.apiKey}`; // Gemini API 端点
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || AI_REQUEST_TIMEOUT); // v16.0 P-4: 超时从全局常量取

    // 转换消息格式：system 作为 systemInstruction，其他作为 contents
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const body: Record<string, unknown> = {
      contents: nonSystemMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user', // Gemini 用 'model' 代替 'assistant'
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 4096,
      },
    };
    if (systemMessages.length > 0) {
      body.systemInstruction = { parts: [{ text: systemMessages.map(m => m.content).join('\n') }] };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...config.headers },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google Gemini API 返回 ${response.status}: ${errText}`);
      }

      const data = await response.json() as GeminiResponse;
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const promptTokens = data.usageMetadata?.promptTokenCount ?? 0;
      const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
      const totalTokens = data.usageMetadata?.totalTokenCount ?? (promptTokens + completionTokens);

      return { content, model, promptTokens, completionTokens, totalTokens };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ==================== Azure OpenAI 适配器 ====================

/**
 * Azure OpenAI 适配器
 *
 * 继承 OpenAI 格式，但 URL 格式不同：
 * {baseUrl}/openai/deployments/{model}/chat/completions?api-version=2024-02-01
 * 认证使用 api-key header 而非 Bearer token。
 */
export class AzureAdapter implements ProviderAdapter {
  name = 'azure';

  async callChat(messages: ChatMessage[], options: CallOptions, config: ProviderConfig): Promise<ProviderResponse> {
    const model = options.model || config.model;
    const url = `${config.baseUrl}/openai/deployments/${model}/chat/completions?api-version=2024-02-01`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || AI_REQUEST_TIMEOUT); // v16.0 P-4: 超时从全局常量取

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.apiKey, // Azure 使用 api-key header
          ...config.headers,
        },
        body: JSON.stringify({
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 4096,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Azure OpenAI API 返回 ${response.status}: ${errText}`);
      }

      const data = await response.json() as OpenAIResponse; // Azure 响应格式同 OpenAI
      const content = data.choices?.[0]?.message?.content ?? '';
      const promptTokens = data.usage?.prompt_tokens ?? 0;
      const completionTokens = data.usage?.completion_tokens ?? 0;
      const totalTokens = data.usage?.total_tokens ?? (promptTokens + completionTokens);

      return { content, model: data.model ?? model, promptTokens, completionTokens, totalTokens };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ==================== Perplexity 适配器 ====================

/**
 * Perplexity 适配器
 *
 * 继承 OpenAI 兼容格式，额外支持 search_recency_filter 参数。
 * 自动启用 web 搜索能力。
 * v16.0 P-8: research 角色时自动启用 search_recency_filter='month'，增强时效性搜索。
 */
export class PerplexityAdapter extends OpenAICompatibleAdapter {
  override name = 'perplexity';

  override async callChat(messages: ChatMessage[], options: CallOptions, config: ProviderConfig): Promise<ProviderResponse> {
    // Perplexity 使用 OpenAI 兼容格式，但 baseUrl 默认为 https://api.perplexity.ai
    const perplexityConfig = { ...config };
    if (!perplexityConfig.baseUrl || perplexityConfig.baseUrl === 'https://api.openai.com/v1') {
      perplexityConfig.baseUrl = 'https://api.perplexity.ai'; // 自动修正默认 URL
    }

    // v16.0 P-8: research 角色时启用 search_recency_filter，增强时效性
    if (options.role === 'research') {
      // 需要在请求体中注入 search_recency_filter，通过覆写 config.headers 传递自定义字段
      // 由于基类直接构造 JSON body，这里通过子类直接实现完整请求
      const url = `${perplexityConfig.baseUrl}/chat/completions`; // API 端点
      const controller = new AbortController(); // 中止控制器
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || AI_REQUEST_TIMEOUT); // 超时控制

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${perplexityConfig.apiKey}`, // Bearer token 认证
            ...perplexityConfig.headers,
          },
          body: JSON.stringify({
            model: options.model || perplexityConfig.model, // 模型名
            messages, // 消息列表
            temperature: options.temperature ?? 0.7, // 温度
            max_tokens: options.maxTokens ?? 4096, // 最大 token
            search_recency_filter: 'month', // v16.0 P-8: research 角色启用月内时效过滤
          }),
          signal: controller.signal, // 绑定中止信号
        });

        if (!response.ok) { // HTTP 错误
          const errText = await response.text();
          throw new Error(`${this.name} API 返回 ${response.status}: ${errText}`);
        }

        const data = await response.json() as OpenAIResponse; // 解析响应
        const content = data.choices?.[0]?.message?.content ?? ''; // 提取内容
        const promptTokens = data.usage?.prompt_tokens ?? 0; // 输入 token
        const completionTokens = data.usage?.completion_tokens ?? 0; // 输出 token
        const totalTokens = data.usage?.total_tokens ?? (promptTokens + completionTokens); // 总 token

        log.debug('Perplexity research 模式：已启用 search_recency_filter=month'); // 调试日志

        return {
          content,
          model: data.model ?? perplexityConfig.model,
          promptTokens,
          completionTokens,
          totalTokens,
        };
      } finally {
        clearTimeout(timeoutId); // 清理定时器
      }
    }

    return super.callChat(messages, options, perplexityConfig); // 非 research 角色复用 OpenAI 兼容逻辑
  }
}

// ==================== Google Vertex AI 适配器 (v13.0 P-2) ====================

/**
 * Google Vertex AI 适配器
 *
 * 继承 Google Gemini 格式，但 URL 格式不同：
 * {baseUrl}/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent
 * 认证使用 Bearer token（通常由 gcloud auth 获取）。
 * 配置说明：baseUrl 应设为完整的 Vertex endpoint，如
 * https://{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{region}/publishers/google
 */
export class VertexAdapter extends GoogleAdapter {
  override name = 'vertex'; // 服务商名称

  override async callChat(messages: ChatMessage[], options: CallOptions, config: ProviderConfig): Promise<ProviderResponse> {
    const model = options.model || config.model; // 模型名称
    // Vertex AI 使用 Bearer token 认证，URL 格式：{baseUrl}/models/{model}:generateContent
    const url = `${config.baseUrl}/models/${model}:generateContent`; // Vertex 端点
    const controller = new AbortController(); // 中止控制器
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || AI_REQUEST_TIMEOUT); // v16.0 P-4: 超时从全局常量取

    // 转换消息格式（与 Google Gemini 相同）
    const systemMessages = messages.filter(m => m.role === 'system'); // system 消息
    const nonSystemMessages = messages.filter(m => m.role !== 'system'); // 非 system 消息

    const body: Record<string, unknown> = {
      contents: nonSystemMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user', // Gemini 格式
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: options.temperature ?? 0.7, // 温度
        maxOutputTokens: options.maxTokens ?? 4096, // 最大输出 token
      },
    };
    if (systemMessages.length > 0) {
      body.systemInstruction = { parts: [{ text: systemMessages.map(m => m.content).join('\n') }] }; // system 指令
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`, // Vertex 使用 Bearer token
          ...config.headers,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) { // HTTP 错误
        const errText = await response.text();
        throw new Error(`Vertex AI API 返回 ${response.status}: ${errText}`);
      }

      const data = await response.json() as GeminiResponse; // Vertex 与 Gemini 响应格式兼容
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''; // 提取文本
      const promptTokens = data.usageMetadata?.promptTokenCount ?? 0; // 输入 token
      const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0; // 输出 token
      const totalTokens = data.usageMetadata?.totalTokenCount ?? (promptTokens + completionTokens); // 总 token

      return { content, model, promptTokens, completionTokens, totalTokens };
    } finally {
      clearTimeout(timeoutId); // 清理定时器
    }
  }
}

// ==================== CLI Provider 通用工具函数 (v18.0) ====================

/** 将 ChatMessage[] 拼接为单一提示文本 */
export function buildPromptFromMessages(messages: ChatMessage[]): string {
  return messages.map(m => m.content).join('\n'); // 用换行拼接所有消息内容
}

/** 解析 CLI 标准输出为 ProviderResponse 格式 */
export function parseCliOutput(stdout: string): { content: string; promptTokens: number; completionTokens: number; totalTokens: number } {
  const content = stdout.trim(); // 去除首尾空白
  const estimatedTokens = Math.ceil(content.length / 4); // 按字符数/4 估算 token
  return {
    content,
    promptTokens: 0, // CLI 模式无法获取输入 token 数
    completionTokens: estimatedTokens, // 估算输出 token
    totalTokens: estimatedTokens, // 总 token 等于输出 token
  };
}

// ==================== CLI Provider 抽象基类 (v18.0) ====================

/**
 * CLI Provider 适配器抽象基类
 *
 * 通过 child_process.execFile 调用本地 CLI 工具（claude/grok/mistral/codex/gemini）。
 * 子类只需实现 command 和 buildArgs 即可。
 */
export abstract class CLIProviderAdapter implements ProviderAdapter {
  abstract name: string; // 服务商名称
  abstract command: string; // CLI 命令名
  abstract buildArgs(prompt: string): string[]; // 构建命令行参数

  async callChat(messages: ChatMessage[], _options: CallOptions, config: ProviderConfig): Promise<ProviderResponse> {
    const prompt = buildPromptFromMessages(messages); // 拼接消息为提示文本
    const args = this.buildArgs(prompt); // 构建参数列表

    try {
      const { stdout } = await execFileAsync(this.command, args, {
        timeout: CLI_SPAWN_TIMEOUT, // 超时限制
        maxBuffer: CLI_MAX_BUFFER, // 最大缓冲区
      });
      const parsed = parseCliOutput(stdout); // 解析输出
      return {
        content: parsed.content,
        model: config.model || this.command, // 模型名默认为命令名
        promptTokens: parsed.promptTokens,
        completionTokens: parsed.completionTokens,
        totalTokens: parsed.totalTokens,
      };
    } catch (err) {
      throw new Error(`${this.name} CLI 执行失败: ${(err as Error).message}`); // 错误包装
    }
  }
}

// ==================== Claude CLI 适配器 (v18.0) ====================

/**
 * Claude CLI 适配器
 *
 * 通过 `claude --print <prompt>` 调用本地 Claude CLI。
 */
export class ClaudeCLIAdapter extends CLIProviderAdapter {
  name = 'claude-cli'; // 服务商名称
  command = 'claude'; // CLI 命令
  buildArgs(prompt: string): string[] {
    return ['--print', prompt]; // claude --print "<prompt>"
  }
}

// ==================== Grok CLI 适配器 (v18.0) ====================

/**
 * Grok CLI 适配器
 *
 * 通过 `grok chat --message <prompt>` 调用本地 Grok CLI。
 */
export class GrokCLIAdapter extends CLIProviderAdapter {
  name = 'grok-cli'; // 服务商名称
  command = 'grok'; // CLI 命令
  buildArgs(prompt: string): string[] {
    return ['chat', '--message', prompt]; // grok chat --message "<prompt>"
  }
}

// ==================== Mistral CLI 适配器 (v18.0) ====================

/**
 * Mistral CLI 适配器
 *
 * 通过 `mistral chat --message <prompt>` 调用本地 Mistral CLI。
 */
export class MistralCLIAdapter extends CLIProviderAdapter {
  name = 'mistral-cli'; // 服务商名称
  command = 'mistral'; // CLI 命令
  buildArgs(prompt: string): string[] {
    return ['chat', '--message', prompt]; // mistral chat --message "<prompt>"
  }
}

// ==================== OpenAI Codex CLI 适配器 (v13.0 P-3, v18.0 重构) ====================

/**
 * OpenAI Codex CLI 适配器
 *
 * v18.0 重构：继承 CLIProviderAdapter 基类，通过 `codex --print <prompt>` 调用。
 */
export class CodexAdapter extends CLIProviderAdapter {
  name = 'codex'; // 服务商名称
  command = 'codex'; // CLI 命令
  buildArgs(prompt: string): string[] {
    return ['--print', prompt]; // codex --print "<prompt>"
  }
}

// ==================== Google Gemini CLI 适配器 (v13.0 P-4, v18.0 重构) ====================

/**
 * Google Gemini CLI 适配器
 *
 * v18.0 重构：继承 CLIProviderAdapter 基类，通过 `gemini chat --message <prompt>` 调用。
 */
export class GeminiCLIAdapter extends CLIProviderAdapter {
  name = 'gemini-cli'; // 服务商名称
  command = 'gemini'; // CLI 命令
  buildArgs(prompt: string): string[] {
    return ['chat', '--message', prompt]; // gemini chat --message "<prompt>"
  }
}

// ==================== P3-7: 运行时模型切换 ====================

/**
 * P3-7: 运行时动态切换指定角色的模型
 *
 * 读取项目配置，将 config.models[role] 设置为 modelId，再写回磁盘。
 * 支持 main / research / fallback 等任意角色名。
 *
 * @param projectRoot 项目根目录（必须包含 .qflow/）
 * @param role        角色名，如 'main' / 'research' / 'fallback'
 * @param modelId     目标模型 ID，如 'claude-sonnet-4-6'
 * @returns           操作结果 { role, modelId, switched }
 */
export async function switchModelRuntime(
  projectRoot: string,
  role: string,
  modelId: string,
): Promise<{ role: string; modelId: string; switched: boolean }> {
  const { loadConfig, saveConfig } = await import('./config-manager.js'); // 动态导入配置管理器
  const config = await loadConfig(projectRoot); // 加载当前项目配置
  if (!config.models) config.models = {}; // 初始化 models 字段（旧配置可能没有）
  // 使用宽松类型索引：ModelRoles 仅声明 main/research/fallback，但运行时支持任意角色名
  const models = config.models as Record<string, { model?: string; baseUrl?: string; apiKey?: string } | undefined>; // 宽松类型转换
  const existingRole = models[role] ?? {}; // 读取已有角色配置（保留 baseUrl/apiKey）
  models[role] = { ...existingRole, model: modelId }; // 覆写 model 字段，保留其他字段
  await saveConfig(projectRoot, config); // 持久化到 .qflow/config.json
  log.debug(`运行时模型切换: role=${role}, modelId=${modelId}`); // 调试日志
  return { role, modelId, switched: true }; // 返回操作结果
}

// ==================== 内置适配器注册 ====================

/** 注册所有内置适配器 */
export function registerBuiltinProviders(): void {
  const openai = new OpenAICompatibleAdapter(); // OpenAI 兼容基类实例
  registerProvider('openai', openai); // OpenAI

  // Groq/OpenRouter/xAI/Ollama 复用 OpenAI 格式，仅名称不同
  const groq = new OpenAICompatibleAdapter();
  groq.name = 'groq';
  registerProvider('groq', groq);

  const openrouter = new OpenAICompatibleAdapter();
  openrouter.name = 'openrouter';
  registerProvider('openrouter', openrouter);

  const xai = new OpenAICompatibleAdapter();
  xai.name = 'xai';
  registerProvider('xai', xai);

  const ollama = new OpenAICompatibleAdapter();
  ollama.name = 'ollama';
  registerProvider('ollama', ollama);

  registerProvider('anthropic', new AnthropicAdapter()); // Anthropic
  registerProvider('google', new GoogleAdapter()); // Google Gemini
  registerProvider('azure', new AzureAdapter()); // Azure OpenAI
  registerProvider('perplexity', new PerplexityAdapter()); // Perplexity
  registerProvider('vertex', new VertexAdapter()); // v13.0 P-2: Google Vertex AI
  registerProvider('codex', new CodexAdapter()); // v13.0 P-3: OpenAI Codex CLI（v18.0 重构为 CLIProviderAdapter）
  registerProvider('gemini-cli', new GeminiCLIAdapter()); // v13.0 P-4: Google Gemini CLI（v18.0 重构为 CLIProviderAdapter）
  registerProvider('claude-cli', new ClaudeCLIAdapter()); // v18.0: Claude CLI
  registerProvider('grok-cli', new GrokCLIAdapter()); // v18.0: Grok CLI
  registerProvider('mistral-cli', new MistralCLIAdapter()); // v18.0: Mistral CLI

  const custom = new OpenAICompatibleAdapter(); // 自定义默认走 OpenAI 格式
  custom.name = 'custom';
  registerProvider('custom', custom);

  log.debug(`已注册 ${registry.size} 个内置 Provider`); // 调试日志
}
