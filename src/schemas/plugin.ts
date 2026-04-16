/**
 * Plugin Schema 定义
 *
 * 定义 qflow 插件系统的数据结构。
 * 每个插件通过清单文件（manifest）描述其能力（工具、钩子等）。
 *
 * 函数列表:
 * - PluginManifestSchema  插件清单 Schema
 */
import { z } from 'zod'; // Zod 数据校验库

/** 插件清单 Schema */
export const PluginManifestSchema = z.object({
  name: z.string(),                  // 插件唯一名称（用于存储文件名）
  version: z.string(),               // 插件版本号（语义版本）
  description: z.string().default(''), // 插件描述说明
  author: z.string().default(''),    // 插件作者信息
  tools: z.array(z.string()).default([]),  // 插件提供的工具名称列表
  hooks: z.array(z.string()).default([]),  // 插件注册的钩子名称列表
  enabled: z.boolean().default(true),     // 是否启用（false 时禁用所有工具和钩子）
  installedAt: z.string(),               // 安装时间（ISO 字符串）
});

/** 插件清单类型 */
export type PluginManifest = z.infer<typeof PluginManifestSchema>;
