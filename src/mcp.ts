#!/usr/bin/env node
/**
 * qflow v25.0 MCP 服务器入口
 *
 * 通过 StdioServerTransport 与 Claude Code 通信。
 * 按 Tier 分层注册工具，使用表驱动 MODE_TIER_MAP 声明式映射。
 * 支持 QFLOW_TOOLS 环境变量：预设模式名或逗号分隔的工具名列表。
 * v25.0: 去 AI 化，所有工具为纯数据工具，默认加载全部 51 个。
 *
 * 环境变量:
 *   - QFLOW_MODE: 工具层级（minimal/core/standard/all/autopilot/review/extra），默认 all
 *   - QFLOW_TOOLS: 预设模式名或逗号分隔的工具名列表（可选）
 */
import { createRequire } from 'node:module'; // 动态读取 package.json
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from 'zod'; // Zod 校验
import { ModeSchema, type Mode } from './schemas/config.js'; // 模式枚举 Schema

const require = createRequire(import.meta.url); // 创建 CJS require 函数
const pkg = require('../package.json') as { version: string }; // 读取 package.json 版本号
import { registerCoreTools } from "./tools/tier-core.js";
import { registerStandardTools } from "./tools/tier-standard.js";
import { registerAllTools } from "./tools/tier-all.js";
import { log } from "./utils/logger.js"; // 日志工具（替代 console.error）

/** Tier 名称到注册函数的映射（v23.0: 精简为三级） */
const TIER_REGISTRY: Record<string, (server: McpServer, allowed?: Set<string>) => void> = {
  core: registerCoreTools,        // 核心工具（10 个，始终注册）
  standard: registerStandardTools, // 标准工具（20 个）
  all: registerAllTools,           // 全量工具（16 个额外）v24.0: +qflow_lottie
};

/** 模式到 Tier 层级的声明式映射表（v23.0: 精简为三级） */
const MODE_TIER_MAP: Record<Mode, string[]> = {
  minimal:   ['core'],                          // 最小模式：仅核心 10 工具
  core:      ['core'],                          // 核心模式：10 工具
  standard:  ['core', 'standard'],              // 标准模式（默认）：30 工具
  all:       ['core', 'standard', 'all'],       // 全量模式：46 工具（v24.0: core 10 + standard 20 + all 16）
  autopilot: ['core', 'standard', 'all'],       // 自动驾驶模式（等同 all）
  review:    ['core', 'standard', 'all'],       // 评审模式（等同 all）
  extra:     ['core', 'standard'],              // 扩展模式（等同 standard）
};

// 创建 MCP 服务器实例
const server = new McpServer({
  name: "qflow",
  version: pkg.version, // 从 package.json 动态读取版本号
});

// 获取当前模式（安全解析，无效值降级为 'standard'）
const rawMode = process.env.QFLOW_MODE || 'all'; // 原始环境变量（v25.0: 默认全量模式）
const modeResult = ModeSchema.safeParse(rawMode); // Zod safeParse 校验
const mode: Mode = modeResult.success ? modeResult.data : 'all'; // 无效值降级为全量模式

// 解析 QFLOW_TOOLS 环境变量
let allowedTools: Set<string> | undefined; // 允许的工具名集合
let effectiveTiers: string[] = MODE_TIER_MAP[mode] || MODE_TIER_MAP.all; // 实际生效的 tier 列表（默认按 mode 决定）
const customTools = process.env.QFLOW_TOOLS; // 读取环境变量
if (customTools) {
  // 检查是否为预设模式名
  const presetResult = ModeSchema.safeParse(customTools); // 尝试解析为模式名
  if (presetResult.success) {
    // QFLOW_TOOLS 是预设模式名，覆盖 QFLOW_MODE 的 tier 选择
    effectiveTiers = MODE_TIER_MAP[presetResult.data]; // 获取对应 tier 列表，覆盖 effectiveTiers
    for (const tierName of effectiveTiers) { // 遍历 tier 列表
      const registerFn = TIER_REGISTRY[tierName]; // 获取注册函数
      if (registerFn) registerFn(server, undefined); // 无过滤注册
    }
  } else {
    // QFLOW_TOOLS 是逗号分隔的自定义工具列表
    allowedTools = new Set(customTools.split(',').map(s => s.trim()).filter(Boolean)); // 解析为集合
    // 注册所有 tier（由 allowedTools 过滤实际工具）
    for (const tierName of Object.keys(TIER_REGISTRY)) {
      const registerFn = TIER_REGISTRY[tierName];
      if (registerFn) registerFn(server, allowedTools);
    }
  }
} else {
  // 无 QFLOW_TOOLS，按 mode 注册对应 tier
  for (const tierName of effectiveTiers) { // 遍历注册
    const registerFn = TIER_REGISTRY[tierName]; // 获取注册函数
    if (registerFn) registerFn(server, allowedTools); // 注册工具
  }
}

// v23.1: 全部 7 个废弃模块已重新接入（Clarification/Onboarding → standard, Agile/Plugin/Workflow/DriftDetector/WatchEngine → all）

// 启动 stdio 传输
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  log.error(`[qflow] MCP 服务器启动失败: ${error}`);
  process.exit(1);
});
