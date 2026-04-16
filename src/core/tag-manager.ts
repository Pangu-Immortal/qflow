/**
 * 标签管理器 - 批量标签操作、统计和工作区CRUD管理
 *
 * 基于 TaskManager 实现标签的批量操作：添加、移除、统计、过滤。
 * v18.0 新增: 工作区CRUD（基于 activeTag + tasks-{tag}.json 模式）
 *
 * 函数列表:
 * - batchAddTags()           批量添加标签
 * - batchRemoveTags()        批量移除标签
 * - getTagStats()            标签统计
 * - filterByTags()           按标签过滤任务
 * - renameTag()              批量重命名标签
 * - deleteTag()              从所有任务中删除标签
 * - copyTag()                复制标签到新标签名（保留原标签）
 * - createTagWorkspace()     创建标签工作区（v18.0）
 * - deleteTagWorkspace()     删除标签工作区（v18.0）
 * - listTagWorkspaces()      列出所有标签工作区（v18.0）
 * - renameTagWorkspace()     重命名标签工作区（v18.0）
 * - useTag()                 切换并持久化 activeTag 到配置文件（v20.0 P2-7）
 * - getActiveTag()           读取配置文件中的 activeTag（v20.0 P2-8）
 * - isolateTagWorkspace()     确保工作区完全隔离（v21.0 P3-6）
 * - switchWorkspace()         切换工作区上下文（v21.0 P3-7）
 * - mergeWorkspace()          合并两个工作区（v21.0 P3-8）
 * - getWorkspaceStatus()      获取工作区统计信息（v21.0 P3-9）
 */

import { TaskManager } from './task-manager.js'; // 任务管理器
import { log } from '../utils/logger.js'; // 日志工具
import type { Task } from '../schemas/task.js'; // 任务类型
import { execFile } from 'node:child_process'; // P7-P2-5: 安全的子进程执行
import { promisify } from 'node:util'; // 异步化工具
import { promises as fs } from 'node:fs'; // 文件系统异步API
import path from 'node:path'; // 路径处理
import { GIT_TIMEOUT, MAX_TAG_WORKSPACES } from '../shared/constants.js'; // v15.0 R-5 + v18.0 全局常量
import { QFLOW_DIR } from '../shared/tool-utils.js'; // .qflow 目录常量
import { readJSON, writeJSON, ensureDir, fileExists } from '../utils/file-io.js'; // 文件读写工具
import { loadConfig, saveConfig } from './config-manager.js'; // v20.0 P2-7/P2-8: 配置读写

/** execFile 的 Promise 版本（P7-P2-5: 使用 execFile 而非 exec 防止命令注入） */
const execFileAsync = promisify(execFile);

/** 标签过滤模式（支持大小写） */
export type TagFilterMode = 'AND' | 'OR' | 'and' | 'or'; // AND/and: 全部匹配 / OR/or: 任一匹配

/** 标签统计结果 */
export interface TagStats {
  tag: string; // 标签名称
  count: number; // 关联任务数
}

/** v18.0: 标签工作区信息 */
export interface TagWorkspace {
  name: string; // 工作区名称
  taskCount: number; // 任务数量
  createdAt: string; // 创建时间（ISO 8601）
  filePath: string; // 对应的 tasks-{tag}.json 文件路径
}

/**
 * 标签管理器类
 *
 * 每个实例绑定一个 TaskManager 实例，通过它操作任务的标签字段。
 */
export class TagManager {
  /** 任务管理器实例 */
  private readonly taskManager: TaskManager;

  /** 项目根目录（v18.0: 工作区CRUD需要直接操作文件系统） */
  private readonly projectRoot: string;

  /**
   * @param projectRootOrManager - 项目根目录路径或 TaskManager 实例
   */
  constructor(projectRootOrManager: string | TaskManager) {
    if (typeof projectRootOrManager === 'string') {
      this.projectRoot = projectRootOrManager; // 保存项目根路径
      this.taskManager = new TaskManager(projectRootOrManager); // 字符串时自动创建 TaskManager
    } else {
      this.taskManager = projectRootOrManager; // TaskManager 实例直接使用
      this.projectRoot = ''; // TaskManager 模式下不需要 projectRoot（工作区CRUD需要传字符串）
    }
  }

  /**
   * 批量添加标签
   *
   * 给指定的多个任务添加标签，自动去重。
   *
   * @param taskIds - 任务 ID 列表
   * @param tags    - 要添加的标签列表
   * @returns 实际被更新的任务 ID 列表
   */
  async batchAddTags(taskIds: string[], tags: string[]): Promise<string[]> {
    if (tags.length === 0) return []; // 无标签可添加
    if (taskIds.length === 0) return []; // 无任务可操作

    const data = await this.taskManager.load(); // 加载全部任务数据
    const updated: string[] = []; // 记录实际更新的任务 ID
    const now = new Date().toISOString(); // 当前时间戳

    for (const taskId of taskIds) { // 遍历每个目标任务
      const task = data.tasks.find((t) => t.id === taskId); // 查找任务
      if (!task) { // 任务不存在
        log.warn(`批量添加标签: 任务 ${taskId} 不存在，跳过`); // 警告日志
        continue; // 跳过
      }

      const existingTags = new Set(task.tags); // 现有标签集合
      let changed = false; // 是否有变更

      for (const tag of tags) { // 遍历要添加的标签
        if (!existingTags.has(tag)) { // 标签不存在
          task.tags.push(tag); // 添加标签
          changed = true; // 标记变更
        }
      }

      if (changed) { // 有实际变更
        task.updatedAt = now; // 刷新更新时间
        updated.push(taskId); // 记录更新
      }
    }

    if (updated.length > 0) { // 有任务被更新
      await this.taskManager.save(data); // 持久化
    }

    log.info(`批量添加标签: 更新了 ${updated.length}/${taskIds.length} 个任务，标签: [${tags.join(', ')}]`); // 信息日志
    return updated; // 返回更新列表
  }

  /**
   * 批量移除标签
   *
   * 从指定的多个任务中移除标签。
   *
   * @param taskIds - 任务 ID 列表
   * @param tags    - 要移除的标签列表
   * @returns 实际被更新的任务 ID 列表
   */
  async batchRemoveTags(taskIds: string[], tags: string[]): Promise<string[]> {
    if (tags.length === 0) return []; // 无标签可移除
    if (taskIds.length === 0) return []; // 无任务可操作

    const data = await this.taskManager.load(); // 加载全部任务数据
    const updated: string[] = []; // 记录实际更新的任务 ID
    const now = new Date().toISOString(); // 当前时间戳
    const tagsToRemove = new Set(tags); // 待移除标签集合

    for (const taskId of taskIds) { // 遍历每个目标任务
      const task = data.tasks.find((t) => t.id === taskId); // 查找任务
      if (!task) { // 任务不存在
        log.warn(`批量移除标签: 任务 ${taskId} 不存在，跳过`); // 警告日志
        continue; // 跳过
      }

      const before = task.tags.length; // 移除前的标签数
      task.tags = task.tags.filter((t) => !tagsToRemove.has(t)); // 过滤掉要移除的标签

      if (task.tags.length !== before) { // 标签数有变化
        task.updatedAt = now; // 刷新更新时间
        updated.push(taskId); // 记录更新
      }
    }

    if (updated.length > 0) { // 有任务被更新
      await this.taskManager.save(data); // 持久化
    }

    log.info(`批量移除标签: 更新了 ${updated.length}/${taskIds.length} 个任务，标签: [${tags.join(', ')}]`); // 信息日志
    return updated; // 返回更新列表
  }

  /**
   * 标签统计
   *
   * 遍历所有任务，统计每个标签关联的任务数量。
   *
   * @returns 标签统计列表，按计数降序排列
   */
  async getTagStats(): Promise<Map<string, number>> {
    const allTasks = await this.taskManager.getAllTasks(); // 获取全部任务
    const statsMap = new Map<string, number>(); // 标签 → 计数映射

    for (const task of allTasks) { // 遍历每个任务
      for (const tag of task.tags) { // 遍历任务的每个标签
        statsMap.set(tag, (statsMap.get(tag) ?? 0) + 1); // 计数 +1
      }
    }

    log.debug(`标签统计: 共 ${statsMap.size} 个标签`); // 调试日志
    return statsMap; // 返回 Map<tag, count>
  }

  /**
   * 按标签过滤任务
   *
   * @param tags - 标签列表
   * @param mode - 过滤模式: AND（全部匹配）/ OR（任一匹配），默认 OR
   * @returns 匹配的任务列表
   */
  async filterByTags(tags: string[], mode: TagFilterMode = 'OR'): Promise<Task[]> {
    if (tags.length === 0) return []; // 无标签则返回空

    const allTasks = await this.taskManager.getAllTasks(); // 获取全部任务
    const tagSet = new Set(tags); // 目标标签集合

    const filtered = allTasks.filter((task) => { // 过滤任务
      if (mode === 'AND' || mode === 'and') { // AND 模式：任务必须包含所有指定标签
        return tags.every((tag) => task.tags.includes(tag)); // 全部匹配
      } else { // OR 模式：任务包含任一指定标签即可
        return task.tags.some((tag) => tagSet.has(tag)); // 任一匹配
      }
    });

    log.debug(`标签过滤 [${mode}]: 标签=[${tags.join(', ')}]，匹配 ${filtered.length} 个任务`); // 调试日志
    return filtered; // 返回过滤结果
  }

  /**
   * 批量重命名标签
   *
   * 在内存中修改所有受影响任务的标签，最后一次性写入磁盘（批量单次写入）。
   *
   * @param oldName - 旧标签名
   * @param newName - 新标签名
   * @returns 受影响的任务 ID 列表
   */
  async renameTag(oldName: string, newName: string): Promise<string[]> {
    const data = await this.taskManager.load(); // 加载全部任务数据（含元数据）
    const affected: string[] = []; // 受影响任务列表
    const now = new Date().toISOString(); // 当前时间戳

    for (const task of data.tasks) { // 遍历所有任务（直接操作内存对象）
      const idx = task.tags.indexOf(oldName); // 查找旧标签
      if (idx !== -1) { // 找到了
        task.tags[idx] = newName; // 替换为新标签
        task.tags = [...new Set(task.tags)]; // 去重，确保无重复标签
        task.updatedAt = now; // 刷新更新时间
        affected.push(task.id); // 记录受影响任务
      }
    }

    if (affected.length > 0) { // 有任务被修改时才写入
      await this.taskManager.save(data); // 批量单次写入磁盘
    }

    log.info(`标签重命名 "${oldName}" → "${newName}"，影响 ${affected.length} 个任务`); // 日志
    return affected; // 返回受影响任务
  }

  /**
   * 从所有任务中删除标签
   *
   * 在内存中修改所有受影响任务的标签，最后一次性写入磁盘（批量单次写入）。
   *
   * @param tagName - 要删除的标签名
   * @returns 受影响的任务 ID 列表
   */
  async deleteTag(tagName: string): Promise<string[]> {
    const data = await this.taskManager.load(); // 加载全部任务数据（含元数据）
    const affected: string[] = []; // 受影响任务列表
    const now = new Date().toISOString(); // 当前时间戳

    for (const task of data.tasks) { // 遍历所有任务（直接操作内存对象）
      const idx = task.tags.indexOf(tagName); // 查找标签
      if (idx !== -1) { // 找到了
        task.tags.splice(idx, 1); // 移除标签
        task.updatedAt = now; // 刷新更新时间
        affected.push(task.id); // 记录受影响任务
      }
    }

    if (affected.length > 0) { // 有任务被修改时才写入
      await this.taskManager.save(data); // 批量单次写入磁盘
    }

    log.info(`标签删除 "${tagName}"，影响 ${affected.length} 个任务`); // 日志
    return affected; // 返回受影响任务
  }

  /**
   * 按标签组导出任务上下文（P2: Tagged Task Lists 多上下文隔离）
   *
   * 导出指定标签关联的所有任务为独立的 JSON 快照。
   *
   * @param tags - 要导出的标签列表
   * @param mode - 过滤模式，默认 OR
   * @returns 导出的任务快照
   */
  async exportContext(tags: string[], mode: TagFilterMode = 'OR'): Promise<{ tags: string[]; mode: string; tasks: Task[]; exportedAt: string }> {
    const tasks = await this.filterByTags(tags, mode); // 按标签过滤任务
    log.info(`导出上下文: 标签=[${tags.join(', ')}]，模式=${mode}，任务数=${tasks.length}`); // 信息日志
    return {
      tags, // 导出标签
      mode: String(mode), // 过滤模式
      tasks, // 匹配的任务列表
      exportedAt: new Date().toISOString(), // 导出时间
    };
  }

  /**
   * 导入任务上下文快照（P2: Tagged Task Lists 多上下文隔离）
   *
   * 将导出的任务快照中的标签批量应用到指定任务。
   *
   * @param contextTags - 要应用的标签列表
   * @param taskIds     - 目标任务 ID 列表
   * @returns 实际更新的任务 ID 列表
   */
  async importContext(contextTags: string[], taskIds: string[]): Promise<string[]> {
    log.info(`导入上下文: 标签=[${contextTags.join(', ')}]，目标任务数=${taskIds.length}`); // 信息日志
    return this.batchAddTags(taskIds, contextTags); // 复用 batchAddTags 逻辑
  }

  /**
   * 从当前 Git 分支名创建标签（P7-P2-5）
   *
   * 读取当前 Git 分支名，清理为合法标签名，调用 batchAddTags 为所有活跃任务添加该标签。
   * 使用 execFile（非 exec）防止命令注入攻击。
   *
   * @param projectRoot - 项目根目录（用于 git 命令的 cwd）
   * @returns 创建的标签名
   */
  async createTagFromBranch(projectRoot: string): Promise<string> {
    let branchName: string; // 原始分支名
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: projectRoot, // 在项目根目录执行
        timeout: GIT_TIMEOUT, // v15.0 R-5: Git 超时从常量取
      });
      branchName = stdout.trim(); // 去除首尾空白
    } catch (err) {
      const msg = (err as Error).message; // 错误信息
      log.error(`Git 分支名获取失败: ${msg}`); // 错误日志
      throw new Error(`无法获取 Git 分支名: ${msg}`); // 抛出异常
    }

    if (!branchName || branchName === 'HEAD') { // 分离 HEAD 状态
      throw new Error('当前处于 detached HEAD 状态，无法获取分支名'); // 拒绝操作
    }

    // 清理分支名为合法标签名：将非字母数字字符替换为连字符，去除首尾连字符
    const tagName = branchName
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff-]/g, '-') // 替换特殊字符为连字符
      .replace(/^-+|-+$/g, '') // 去除首尾连字符
      .toLowerCase(); // 转小写

    if (!tagName) { // 清理后为空
      throw new Error(`分支名 "${branchName}" 无法转换为合法标签名`); // 拒绝操作
    }

    log.info(`Git 分支 "${branchName}" → 标签 "${tagName}"`); // 信息日志
    return tagName; // 返回创建的标签名
  }

  /**
   * 复制标签到新标签名
   *
   * 找到所有包含 sourceTag 的任务，给它们添加 targetTag（不删除 sourceTag）。
   * 在内存中批量修改，最后一次性写入磁盘。
   *
   * @param sourceTag - 源标签名
   * @param targetTag - 目标标签名
   * @returns 被复制的任务数量
   */
  async copyTag(sourceTag: string, targetTag: string): Promise<{ copiedCount: number }> {
    if (sourceTag === targetTag) { // 源标签和目标标签相同
      return { copiedCount: 0 }; // 无需操作
    }

    const data = await this.taskManager.load(); // 加载全部任务数据
    let copiedCount = 0; // 实际复制计数
    const now = new Date().toISOString(); // 当前时间戳

    for (const task of data.tasks) { // 遍历所有任务
      if (task.tags.includes(sourceTag)) { // 包含源标签
        if (!task.tags.includes(targetTag)) { // 尚未有目标标签
          task.tags.push(targetTag); // 添加目标标签
          task.updatedAt = now; // 刷新更新时间
          copiedCount++; // 计数
        }
      }
    }

    if (copiedCount > 0) { // 有任务被修改才写盘
      await this.taskManager.save(data); // 批量单次写入磁盘
    }

    log.info(`标签复制 "${sourceTag}" → "${targetTag}"，复制到 ${copiedCount} 个任务`); // 信息日志
    return { copiedCount }; // 返回复制数量
  }

  // ==================== v18.0: 工作区CRUD ====================

  /** 校验工作区名称格式：仅允许字母数字和连字符，最多50字符 */
  private validateWorkspaceName(name: string): void {
    if (!name || name.length === 0) { // 名称为空
      throw new Error('工作区名称不能为空'); // 拒绝
    }
    if (name.length > 50) { // 超过长度限制
      throw new Error(`工作区名称不能超过50个字符，当前: ${name.length}`); // 拒绝
    }
    if (!/^[a-zA-Z0-9-]+$/.test(name)) { // 包含非法字符
      throw new Error(`工作区名称只允许字母、数字和连字符，收到: "${name}"`); // 拒绝
    }
    if (name === 'default') { // 保留名称
      throw new Error('不能使用 "default" 作为工作区名称（已被保留）'); // 拒绝
    }
  }

  /** 获取工作区文件路径 */
  private getWorkspaceFilePath(name: string): string {
    return path.join(this.projectRoot, QFLOW_DIR, `tasks-${name}.json`); // 计算文件路径
  }

  /**
   * 创建标签工作区
   *
   * 创建一个新的 tasks-{tagName}.json 文件作为独立工作区。
   *
   * @param tagName - 工作区名称（字母数字+连字符，最多50字符）
   * @returns 创建的工作区信息
   */
  async createTagWorkspace(tagName: string): Promise<TagWorkspace> {
    if (!this.projectRoot) throw new Error('TagManager 必须通过项目路径创建才能操作工作区'); // 安全检查
    this.validateWorkspaceName(tagName); // 校验名称格式

    // 检查是否超过最大工作区数量
    const existing = await this.listTagWorkspaces(); // 获取现有工作区列表
    if (existing.length >= MAX_TAG_WORKSPACES) { // 达到上限
      throw new Error(`工作区数量已达上限 ${MAX_TAG_WORKSPACES}`); // 拒绝创建
    }

    // 检查是否重名
    const filePath = this.getWorkspaceFilePath(tagName); // 计算文件路径
    if (await fileExists(filePath)) { // 文件已存在
      throw new Error(`工作区 "${tagName}" 已存在`); // 拒绝重复创建
    }

    // 创建空任务文件
    await ensureDir(path.join(this.projectRoot, QFLOW_DIR)); // 确保目录存在
    const now = new Date().toISOString(); // 当前时间
    await writeJSON(filePath, { version: 1, tasks: [], lastId: 0, createdAt: now }); // 写入空结构

    log.info(`创建工作区 "${tagName}": ${filePath}`); // 日志
    return { name: tagName, taskCount: 0, createdAt: now, filePath }; // 返回工作区信息
  }

  /**
   * 删除标签工作区
   *
   * 删除对应的 tasks-{tagName}.json 文件。
   *
   * @param tagName - 要删除的工作区名称
   */
  async deleteTagWorkspace(tagName: string): Promise<void> {
    if (!this.projectRoot) throw new Error('TagManager 必须通过项目路径创建才能操作工作区'); // 安全检查
    this.validateWorkspaceName(tagName); // 校验名称格式

    const filePath = this.getWorkspaceFilePath(tagName); // 计算文件路径
    if (!(await fileExists(filePath))) { // 文件不存在
      throw new Error(`工作区 "${tagName}" 不存在`); // 拒绝
    }

    await fs.unlink(filePath); // 删除文件
    log.info(`删除工作区 "${tagName}": ${filePath}`); // 日志
  }

  /**
   * 列出所有标签工作区
   *
   * 扫描 .qflow/ 目录下所有 tasks-*.json 文件，解析为工作区列表。
   *
   * @returns 工作区列表
   */
  async listTagWorkspaces(): Promise<TagWorkspace[]> {
    if (!this.projectRoot) throw new Error('TagManager 必须通过项目路径创建才能操作工作区'); // 安全检查

    const qflowDir = path.join(this.projectRoot, QFLOW_DIR); // .qflow 目录
    if (!(await fileExists(qflowDir))) return []; // 目录不存在则返回空

    const entries = await fs.readdir(qflowDir); // 读取目录内容
    const workspaces: TagWorkspace[] = []; // 结果列表

    for (const entry of entries) { // 遍历文件
      const match = entry.match(/^tasks-(.+)\.json$/); // 匹配 tasks-{name}.json 模式
      if (!match) continue; // 不匹配则跳过

      const name = match[1]; // 提取工作区名称
      const filePath = path.join(qflowDir, entry); // 文件绝对路径
      try {
        const data = await readJSON<{ tasks?: unknown[]; createdAt?: string }>(filePath); // 读取文件
        const taskCount = Array.isArray(data?.tasks) ? data.tasks.length : 0; // 任务数量
        const stat = await fs.stat(filePath); // 获取文件状态
        workspaces.push({
          name, // 工作区名称
          taskCount, // 任务数量
          createdAt: data?.createdAt || stat.birthtime.toISOString(), // 创建时间（优先从文件内容读取）
          filePath, // 文件路径
        });
      } catch (err) {
        log.warn(`读取工作区文件失败: ${filePath}: ${(err as Error).message}`); // 警告日志
      }
    }

    log.debug(`列出工作区: 共 ${workspaces.length} 个`); // 调试日志
    return workspaces; // 返回列表
  }

  /**
   * 重命名标签工作区
   *
   * 将 tasks-{oldName}.json 重命名为 tasks-{newName}.json。
   *
   * @param oldName - 旧工作区名称
   * @param newName - 新工作区名称
   * @returns 更新后的工作区信息
   */
  async renameTagWorkspace(oldName: string, newName: string): Promise<TagWorkspace> {
    if (!this.projectRoot) throw new Error('TagManager 必须通过项目路径创建才能操作工作区'); // 安全检查
    this.validateWorkspaceName(oldName); // 校验旧名称
    this.validateWorkspaceName(newName); // 校验新名称

    if (oldName === newName) throw new Error('新旧名称不能相同'); // 相同名称拒绝

    const oldPath = this.getWorkspaceFilePath(oldName); // 旧文件路径
    const newPath = this.getWorkspaceFilePath(newName); // 新文件路径

    if (!(await fileExists(oldPath))) { // 旧文件不存在
      throw new Error(`工作区 "${oldName}" 不存在`); // 拒绝
    }
    if (await fileExists(newPath)) { // 新文件已存在
      throw new Error(`工作区 "${newName}" 已存在`); // 拒绝
    }

    await fs.rename(oldPath, newPath); // 重命名文件
    log.info(`重命名工作区 "${oldName}" → "${newName}"`); // 日志

    // 读取文件获取任务数量
    const data = await readJSON<{ tasks?: unknown[]; createdAt?: string }>(newPath); // 读取重命名后的文件
    const taskCount = Array.isArray(data?.tasks) ? data.tasks.length : 0; // 任务数量
    const stat = await fs.stat(newPath); // 文件状态
    return {
      name: newName, // 新名称
      taskCount, // 任务数量
      createdAt: data?.createdAt || stat.birthtime.toISOString(), // 创建时间
      filePath: newPath, // 新文件路径
    };
  }

  // ==================== v20.0: activeTag 持久化 ====================

  /**
   * 切换激活的工作区标签并持久化到配置文件（v20.0 P2-7）
   *
   * 读取 qflow.config.json，设置 activeTag 字段后写回。
   * 传入空字符串时清除 activeTag（设为 undefined）。
   *
   * @param tagName - 目标标签名，空字符串表示清除
   */
  async useTag(tagName: string): Promise<void> {
    if (!this.projectRoot) throw new Error('TagManager 必须通过项目路径创建才能操作 activeTag'); // 安全检查
    const config = await loadConfig(this.projectRoot); // 读取当前配置
    if (tagName === '') { // 空字符串表示清除
      delete (config as Record<string, unknown>).activeTag; // 移除 activeTag 字段
      log.info('useTag: 已清除 activeTag'); // 日志
    } else {
      config.activeTag = tagName; // 设置新的 activeTag
      log.info(`useTag: activeTag 已切换为 "${tagName}"`); // 日志
    }
    await saveConfig(this.projectRoot, config); // 写回配置文件
  }

  /**
   * 获取当前激活的工作区标签（v20.0 P2-8）
   *
   * 从 qflow.config.json 读取 activeTag 字段。
   * 未设置时返回 null。
   *
   * @returns 当前 activeTag 值，未设置时返回 null
   */
  async getActiveTag(): Promise<string | null> {
    if (!this.projectRoot) throw new Error('TagManager 必须通过项目路径创建才能操作 activeTag'); // 安全检查
    const config = await loadConfig(this.projectRoot); // 读取当前配置
    return config.activeTag ?? null; // 返回 activeTag，未设置时返回 null
  }

  // ==================== v21.0 P3: 工作区完全隔离 ====================

  /**
   * v21.0 P3-6: 隔离工作区 — 确保 tag 拥有独立的 tasks 文件和 specs 目录
   *
   * @param tagName - 工作区标签名
   * @returns 隔离状态信息
   */
  async isolateTagWorkspace(tagName: string): Promise<{ name: string; tasksFile: string; specsDir: string; created: boolean }> {
    if (!this.projectRoot) throw new Error('TagManager 必须通过项目路径创建才能操作工作区'); // 安全检查
    this.validateWorkspaceName(tagName); // 校验名称格式

    const tasksFile = this.getWorkspaceFilePath(tagName); // tasks-{tag}.json 路径
    const specsDir = path.join(this.projectRoot, QFLOW_DIR, `specs-${tagName}`); // specs-{tag}/ 目录路径
    let created = false; // 是否有新建操作

    // 确保 tasks 文件存在
    if (!(await fileExists(tasksFile))) {
      await ensureDir(path.join(this.projectRoot, QFLOW_DIR)); // 确保 .qflow 目录存在
      const now = new Date().toISOString(); // 当前时间
      await writeJSON(tasksFile, { version: 1, tasks: [], lastId: 0, createdAt: now }); // 创建空任务文件
      created = true; // 标记已创建
      log.info(`isolateTagWorkspace: 创建 tasks 文件 ${tasksFile}`); // 日志
    }

    // 确保 specs 目录存在
    if (!(await fileExists(specsDir))) {
      await ensureDir(specsDir); // 创建目录
      created = true; // 标记已创建
      log.info(`isolateTagWorkspace: 创建 specs 目录 ${specsDir}`); // 日志
    }

    log.info(`isolateTagWorkspace: 工作区 "${tagName}" 已隔离 (created=${created})`); // 记录隔离结果
    return { name: tagName, tasksFile, specsDir, created }; // 返回隔离状态
  }

  /**
   * v21.0 P3-7: 切换当前工作区上下文
   *
   * 设置 activeTag 并确保目标工作区文件存在（自动调用 isolateTagWorkspace）。
   *
   * @param tagName - 目标工作区名称，空字符串表示切换回默认工作区
   * @returns 切换结果
   */
  async switchWorkspace(tagName: string): Promise<{ activeTag: string | null; taskCount: number }> {
    if (!this.projectRoot) throw new Error('TagManager 必须通过项目路径创建才能操作工作区'); // 安全检查

    if (tagName === '' || tagName === 'default') {
      // 切换回默认工作区
      await this.useTag(''); // 清除 activeTag
      const tasks = await this.taskManager.getAllTasks(); // 读取默认任务列表
      log.info('switchWorkspace: 已切换到默认工作区'); // 日志
      return { activeTag: null, taskCount: tasks.length }; // 返回默认工作区状态
    }

    this.validateWorkspaceName(tagName); // 校验名称格式
    await this.isolateTagWorkspace(tagName); // 确保工作区文件存在
    await this.useTag(tagName); // 持久化 activeTag

    // 读取目标工作区的任务数量
    const tasksFile = this.getWorkspaceFilePath(tagName); // 任务文件路径
    const data = await readJSON<{ tasks?: unknown[] }>(tasksFile); // 读取任务文件
    const taskCount = Array.isArray(data?.tasks) ? data.tasks.length : 0; // 任务数量

    log.info(`switchWorkspace: 已切换到工作区 "${tagName}" (${taskCount} 个任务)`); // 日志
    return { activeTag: tagName, taskCount }; // 返回切换结果
  }

  /**
   * v21.0 P3-8: 合并两个工作区
   *
   * 将 source 工作区的所有任务追加到 target 工作区。
   * 源工作区任务的 ID 会重新生成以避免冲突。
   *
   * @param source - 源工作区名称
   * @param target - 目标工作区名称（'default' 表示主任务文件）
   * @returns 合并结果
   */
  async mergeWorkspace(source: string, target: string): Promise<{ mergedCount: number; source: string; target: string }> {
    if (!this.projectRoot) throw new Error('TagManager 必须通过项目路径创建才能操作工作区'); // 安全检查
    if (source === target) throw new Error('源工作区和目标工作区不能相同'); // 防止自我合并

    // 解析源文件路径
    this.validateWorkspaceName(source); // 校验源名称
    const sourceFile = this.getWorkspaceFilePath(source); // 源任务文件路径
    if (!(await fileExists(sourceFile))) throw new Error(`源工作区 "${source}" 不存在`); // 源不存在

    // 解析目标文件路径
    const targetFile = target === 'default'
      ? path.join(this.projectRoot, QFLOW_DIR, 'tasks.json') // 默认任务文件
      : this.getWorkspaceFilePath(target); // 目标工作区任务文件

    if (target !== 'default') {
      this.validateWorkspaceName(target); // 校验目标名称
      if (!(await fileExists(targetFile))) throw new Error(`目标工作区 "${target}" 不存在`); // 目标不存在
    }

    // 读取源和目标任务数据
    const sourceData = await readJSON<{ tasks: Array<Record<string, unknown>>; lastId: number }>(sourceFile); // 源数据
    const targetData = await readJSON<{ tasks: Array<Record<string, unknown>>; lastId: number }>(targetFile); // 目标数据

    if (!sourceData?.tasks || sourceData.tasks.length === 0) {
      return { mergedCount: 0, source, target }; // 源无任务，无需合并
    }

    // 追加源任务到目标（重新分配 ID）
    let lastId = targetData?.lastId ?? 0; // 目标当前最大 ID
    const targetTasks = targetData?.tasks ?? []; // 目标任务列表
    const now = new Date().toISOString(); // 当前时间

    for (const task of sourceData.tasks) {
      lastId++; // 递增 ID
      task.id = `T${lastId}`; // 重新分配 ID
      task.updatedAt = now; // 更新时间
      targetTasks.push(task); // 追加到目标
    }

    // 写回目标文件
    await writeJSON(targetFile, { ...targetData, tasks: targetTasks, lastId }); // 持久化
    log.info(`mergeWorkspace: 从 "${source}" 合并 ${sourceData.tasks.length} 个任务到 "${target}"`); // 日志
    return { mergedCount: sourceData.tasks.length, source, target }; // 返回合并结果
  }

  /**
   * v21.0 P3-9: 获取工作区统计信息
   *
   * 返回指定工作区的任务数量和状态分布。
   *
   * @param tagName - 工作区名称（'default' 表示主任务文件）
   * @returns 工作区统计
   */
  async getWorkspaceStatus(tagName: string): Promise<{ name: string; taskCount: number; statusDistribution: Record<string, number>; hasSpecsDir: boolean }> {
    if (!this.projectRoot) throw new Error('TagManager 必须通过项目路径创建才能操作工作区'); // 安全检查

    // 解析任务文件路径
    const tasksFile = tagName === 'default'
      ? path.join(this.projectRoot, QFLOW_DIR, 'tasks.json') // 默认任务文件
      : this.getWorkspaceFilePath(tagName); // 工作区任务文件

    if (tagName !== 'default') this.validateWorkspaceName(tagName); // 校验名称

    if (!(await fileExists(tasksFile))) {
      return { name: tagName, taskCount: 0, statusDistribution: {}, hasSpecsDir: false }; // 文件不存在
    }

    // 读取任务数据
    const data = await readJSON<{ tasks?: Array<{ status?: string }> }>(tasksFile); // 读取文件
    const tasks = data?.tasks ?? []; // 任务列表

    // 统计状态分布
    const statusDistribution: Record<string, number> = {}; // 状态 → 数量映射
    for (const task of tasks) {
      const status = task.status ?? 'unknown'; // 状态字段
      statusDistribution[status] = (statusDistribution[status] ?? 0) + 1; // 计数
    }

    // 检查 specs 目录是否存在
    const specsDir = tagName === 'default'
      ? path.join(this.projectRoot, QFLOW_DIR, 'specs') // 默认 specs 目录
      : path.join(this.projectRoot, QFLOW_DIR, `specs-${tagName}`); // 工作区 specs 目录
    const hasSpecsDir = await fileExists(specsDir); // 目录是否存在

    log.info(`getWorkspaceStatus: 工作区 "${tagName}" 有 ${tasks.length} 个任务`); // 日志
    return { name: tagName, taskCount: tasks.length, statusDistribution, hasSpecsDir }; // 返回统计
  }
}
