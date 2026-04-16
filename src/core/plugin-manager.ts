/**
 * PluginManager - qflow 插件管理器
 *
 * 管理 qflow 插件的安装、卸载、启用/禁用和搜索。
 * 持久化到 {projectRoot}/.qflow/plugins/{name}.json
 *
 * 函数列表:
 * - install(manifest)      安装插件（写入 .qflow/plugins/{name}.json）
 * - remove(name)           卸载插件（删除文件）
 * - list()                 列出所有已安装插件
 * - get(name)              获取插件详情
 * - search(query)          按名称搜索插件（includes 匹配）
 * - enable(name)           启用插件
 * - disable(name)          禁用插件
 */
import path from 'node:path';                                           // 路径工具
import { promises as fs } from 'node:fs';                              // 文件系统异步 API
import { readJSON, writeJSON, ensureDir } from '../utils/file-io.js';  // 文件 IO 工具
import { log } from '../utils/logger.js';                              // 日志工具
import { QFLOW_DIR } from '../shared/tool-utils.js';                   // .qflow 目录常量
import { PluginManifestSchema, type PluginManifest } from '../schemas/plugin.js'; // 插件类型

/**
 * PluginManager 类 - 插件管理器
 *
 * 以文件系统为持久化后端，每个插件存储为独立 JSON 文件。
 * 插件文件名为 {name}.json，name 为插件唯一标识。
 */
export class PluginManager {
  private projectRoot: string; // 项目根目录路径

  /**
   * 构造函数
   * @param projectRoot 项目根目录绝对路径
   */
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot; // 保存项目根目录
  }

  /** 插件存储目录路径（.qflow/plugins/） */
  private pluginsDir(): string {
    return path.join(this.projectRoot, QFLOW_DIR, 'plugins'); // 返回 plugins 目录
  }

  /** 获取指定插件文件路径 */
  private pluginPath(name: string): string {
    return path.join(this.pluginsDir(), `${name}.json`); // 返回 plugin JSON 路径
  }

  /**
   * 安装插件
   * @param manifest 插件清单数据（包含 name/version/description 等）
   */
  async install(manifest: Omit<PluginManifest, 'installedAt'> & { installedAt?: string }): Promise<PluginManifest> {
    await ensureDir(this.pluginsDir()); // 确保目录存在

    const plugin: PluginManifest = PluginManifestSchema.parse({
      ...manifest,                                // 展开传入的清单数据
      installedAt: manifest.installedAt ?? new Date().toISOString(), // 记录安装时间
    });

    await writeJSON(this.pluginPath(plugin.name), plugin as unknown as Record<string, unknown>); // 持久化
    log.info(`PluginManager: 安装插件 "${plugin.name}" v${plugin.version}`); // 记录日志
    return plugin;
  }

  /**
   * 卸载插件
   * @param name 插件名称
   */
  async remove(name: string): Promise<void> {
    const pluginFile = this.pluginPath(name); // 插件文件路径
    try {
      await fs.unlink(pluginFile); // 删除插件文件
      log.info(`PluginManager: 卸载插件 "${name}"`); // 记录日志
    } catch {
      throw new Error(`插件 "${name}" 未安装`); // 文件不存在时报错
    }
  }

  /**
   * 列出所有已安装插件
   */
  async list(): Promise<PluginManifest[]> {
    await ensureDir(this.pluginsDir()); // 确保目录存在
    const files = await fs.readdir(this.pluginsDir()).catch(() => [] as string[]); // 读取目录文件列表
    const plugins: PluginManifest[] = []; // 结果列表

    for (const file of files.filter(f => f.endsWith('.json'))) { // 过滤 JSON 文件
      const raw = await readJSON<PluginManifest>(path.join(this.pluginsDir(), file)); // 读取文件
      if (raw) {
        try {
          plugins.push(PluginManifestSchema.parse(raw)); // 校验并加入列表
        } catch (e) {
          log.warn('插件 manifest 校验失败: ' + (e instanceof Error ? e.message : String(e))); // v22.0 P1-2: 静默 catch 修复
        }
      }
    }

    return plugins.sort((a, b) => a.name.localeCompare(b.name)); // 按名称排序
  }

  /**
   * 获取插件详情
   * @param name 插件名称
   */
  async get(name: string): Promise<PluginManifest | null> {
    const raw = await readJSON<PluginManifest>(this.pluginPath(name)); // 从磁盘读取
    if (!raw) return null; // 不存在返回 null
    return PluginManifestSchema.parse(raw); // 用 Schema 校验并返回
  }

  /**
   * 按名称搜索插件（简单 includes 匹配）
   * @param query 搜索关键词
   */
  async search(query: string): Promise<PluginManifest[]> {
    const all = await this.list(); // 获取所有插件
    const lower = query.toLowerCase(); // 转小写方便比较
    return all.filter(p =>
      p.name.toLowerCase().includes(lower) ||       // 名称匹配
      p.description.toLowerCase().includes(lower)   // 描述匹配
    );
  }

  /**
   * 启用插件
   * @param name 插件名称
   */
  async enable(name: string): Promise<PluginManifest> {
    return this.setEnabled(name, true); // 设置为启用状态
  }

  /**
   * 禁用插件
   * @param name 插件名称
   */
  async disable(name: string): Promise<PluginManifest> {
    return this.setEnabled(name, false); // 设置为禁用状态
  }

  /**
   * 设置插件启用/禁用状态（内部方法）
   * @param name 插件名称
   * @param enabled 是否启用
   */
  private async setEnabled(name: string, enabled: boolean): Promise<PluginManifest> {
    const plugin = await this.get(name); // 读取插件
    if (!plugin) throw new Error(`插件 "${name}" 未安装`); // 不存在则报错

    plugin.enabled = enabled; // 更新启用状态
    await writeJSON(this.pluginPath(name), plugin as unknown as Record<string, unknown>); // 保存
    log.info(`PluginManager: 插件 "${name}" 已${enabled ? '启用' : '禁用'}`); // 记录日志
    return plugin;
  }
}
