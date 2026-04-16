/**
 * 任务管理器 - 任务 CRUD + tasks.json 持久化
 *
 * 管理 qflow 的任务生命周期，支持嵌套子任务、依赖关系解锁、
 * 级联删除等功能。数据文件: {projectRoot}/.qflow/tasks.json
 *
 * 类方法列表:
 * - load()             加载或创建空 tasks.json
 * - save()             持久化任务数据
 * - createTask()       创建新任务（支持子任务）
 * - getTask()          按 ID 查找任务
 * - updateTask()       更新任务字段
 * - deleteTask()       删除任务（可级联删除子任务）
 * - setStatus()        设置任务状态（自动解锁依赖任务）
 * - validateStatusTransition() [private] 校验状态转换合法性
 * - applyStatusChange()        [private] 应用状态变更 + 时间戳
 * - unlockDownstream()          [private] 解锁下游被阻塞的任务
 * - syncParentStatus()          [private] 父子状态联动
 * - triggerOnTaskDoneHook()     [private] 触发 onTaskDone 钩子
 * - listTasks()        按条件过滤任务列表
 * - getAllTasks()      获取全部任务
 * - addDependency()   动态添加依赖关系
 * - removeDependency() 动态移除依赖关系
 * - fixDependencies()  自动修复断裂依赖引用
 * - moveTask()         跨父级移动任务
 * - clearSubtasks()    清除任务的所有子任务
 * - removeSubtask()    从父任务中移除指定子任务关联
 * - saveResearch()     保存任务关联的研究资料
 * - getResearch()      读取任务关联的研究资料
 * - getTaskTree()      递归获取任务树结构
 * - chainUpdate()      链式更新指定任务及其下游依赖链
 * - writeProgressFile() 写入进度文件到 .qflow/progress.txt（任务完成时自动调用）
 * - batchRewriteFrom() 从指定 ID 起批量重写后续任务描述
 * - generateBranchName() 根据任务信息生成 Git 分支名
 * - setTaskMetadata()   设置任务的单个 metadata 键值对（原子写入）
 * - getTaskMetadata()   读取任务的 metadata（支持按 key 读取或返回全部）
 * - filterByReady()     返回所有依赖已满足的就绪任务，附带 reason 字段（P1-1）
 * - filterByBlocking()  返回所有阻塞其他任务的瓶颈任务，附带 blockedTasks 字段（P1-2）
 * - generateTaskFiles() 导出任务文件，支持 .md 和 .txt 双格式（P1-4）
 * - startTask()         启动任务并返回完整执行上下文（P1-6）
 * - deferWork()         将工作描述追加到 .qflow/deferred-work.md（v21.0 P1-11）
 * - listDeferredWork()  读取 .qflow/deferred-work.md 的所有行（v21.0 P1-12）
 */

import path from 'node:path'; // 路径拼接工具
import { promises as fsPromises } from 'node:fs'; // v21.0 P1-11: 异步文件操作（追加 deferred-work.md）
import { TasksFileSchema, type Task, type TasksFile } from '../schemas/task.js'; // 任务 schema 和类型
import { readJSON, writeJSON, readJSONUnlocked, writeJSONUnlocked, withFileLock, ensureDir, fileExists } from '../utils/file-io.js'; // 文件读写工具（含无锁版本 + 文件锁）
import { selectNextTask } from '../algorithms/next-task.js'; // 下一任务推荐算法
import { log } from '../utils/logger.js'; // 日志工具
import { validateTransition, getValidTransitions } from './state-machine.js'; // 状态机校验工具
import { QFLOW_DIR, sanitizeId } from '../shared/tool-utils.js'; // .qflow 目录常量 + ID 清洗工具
import { MEMORY_CACHE_TTL, DEFAULT_PRIORITY, HOOK_TIMEOUT, SCOPE_STRENGTH_MIN, SCOPE_STRENGTH_MAX, SCOPE_STRENGTH_DEFAULT, MAX_LOOP_DEPTH, UNDO_LOG_MAX, ARCHIVE_BATCH_SIZE, OVERDUE_SCAN_LIMIT } from '../shared/constants.js'; // v15.0 R-5: 全局常量 + v22.0 新增常量
import { callAI } from './ai-provider.js'; // v22.0 P1-11: AI 重写支持

/** 任务树节点结构 - 用于递归展示任务及其所有子任务 */
export interface TaskTreeNode {
  task: Task; // 当前任务对象
  children: TaskTreeNode[]; // 子任务树节点列表（递归结构）
}

/** 研究数据结构 - 用于保存和读取任务关联的研究资料 */
export interface ResearchData {
  taskId: string; // 关联的任务 ID
  content: string; // 研究内容
  source: string; // 来源说明
  savedAt: string; // 保存时间（ISO 8601 格式）
}

/** v22.0 P3-1: Undo 操作记录 */
interface UndoEntry {
  timestamp: string;
  operation: string;
  taskIds: string[];
  previousStates: Array<{ id: string; status: string }>;
}

/** v22.0 P3-11: 审计日志条目 */
interface AuditLogEntry {
  timestamp: string;
  taskId: string;
  field: string;
  oldValue: string;
  newValue: string;
  source: string;
}

/** 任务文件名 */
const TASKS_FILENAME = 'tasks.json'; // 固定文件名

/**
 * 任务管理器类
 *
 * 每个实例绑定一个项目根目录，操作该项目的 tasks.json。
 * 支持 Tag-as-Workspace 隔离：通过 activeTag 切换不同的任务文件。
 */
export class TaskManager {
  /** 项目根目录绝对路径 */
  private readonly projectRoot: string;

  /** tasks.json 的绝对路径（可随 activeTag 切换） */
  private filePath: string;

  /** 当前激活的工作区标签，'default' 对应原始 tasks.json */
  private activeTag: string = 'default';

  /** 内存缓存 - 避免同实例内重复读盘 */
  private cache: TasksFile | null = null;

  /** 缓存写入时间戳 */
  private cacheTime = 0;

  /** 缓存有效期（v15.0 R-5: 从全局常量取） */
  private readonly CACHE_TTL = MEMORY_CACHE_TTL;

  /** 清除内存缓存，强制下次 load() 从磁盘读取 */
  clearCache(): void {
    this.cache = null;
    this.cacheTime = 0;
  }

  /**
   * @param projectRoot - 项目根目录绝对路径
   * @param options     - 可选参数：activeTag 指定初始工作区标签
   */
  constructor(projectRoot: string, options?: { activeTag?: string }) {
    this.projectRoot = projectRoot; // 保存项目根路径
    if (options?.activeTag) { // 如果指定了初始标签
      this.activeTag = sanitizeId(options.activeTag, 'activeTag'); // 清洗标签名
    }
    this.filePath = this.computeTasksFilePath(this.activeTag); // 根据标签计算文件路径
  }

  /**
   * 根据标签名计算 tasks 文件路径
   *
   * 'default' → {projectRoot}/.qflow/tasks.json（向后兼容）
   * 其他     → {projectRoot}/.qflow/tasks-{sanitizedTag}.json
   *
   * @param tag - 标签名（已清洗）
   * @returns tasks 文件的绝对路径
   */
  private computeTasksFilePath(tag: string): string {
    if (tag === 'default') {
      return path.join(this.projectRoot, QFLOW_DIR, TASKS_FILENAME); // 默认路径
    }
    return path.join(this.projectRoot, QFLOW_DIR, `tasks-${tag}.json`); // 标签隔离路径
  }

  /**
   * 切换到指定工作区标签
   *
   * 切换后自动清除缓存，重新计算文件路径。
   * 如果目标标签的任务文件不存在，自动创建空文件。
   *
   * @param tagName - 目标标签名
   */
  async useTag(tagName: string): Promise<void> {
    const safeTag = sanitizeId(tagName, 'tagName'); // 清洗标签名
    this.activeTag = safeTag; // 更新当前标签
    this.filePath = this.computeTasksFilePath(safeTag); // 重新计算文件路径
    this.clearCache(); // 清除缓存，强制重新加载
    const exists = await fileExists(this.filePath); // 检查文件是否存在
    if (!exists) { // 文件不存在时创建空任务文件
      await ensureDir(path.join(this.projectRoot, QFLOW_DIR)); // 确保目录存在
      await writeJSON(this.filePath, { version: 1, tasks: [], lastId: 0 }); // 写入空结构
      log.info(`已创建工作区标签 "${safeTag}" 的任务文件: ${this.filePath}`); // 日志
    }
  }

  /**
   * 获取当前激活的工作区标签
   * @returns 当前标签名
   */
  getActiveTag(): string {
    return this.activeTag; // 返回当前标签
  }

  /**
   * 复制一个标签的任务数据到另一个标签
   *
   * 将 fromTag 的 tasks.json 内容完整复制到 toTag 对应的文件。
   *
   * @param fromTag - 源标签名
   * @param toTag   - 目标标签名
   */
  async copyTag(fromTag: string, toTag: string): Promise<void> {
    const safeFrom = sanitizeId(fromTag, 'fromTag'); // 清洗源标签名
    const safeTo = sanitizeId(toTag, 'toTag'); // 清洗目标标签名
    const fromFile = this.computeTasksFilePath(safeFrom); // 源文件路径
    const toFile = this.computeTasksFilePath(safeTo); // 目标文件路径
    const data = await readJSON<TasksFile>(fromFile); // 读取源文件
    if (data) { // 源文件存在
      await ensureDir(path.join(this.projectRoot, QFLOW_DIR)); // 确保目录存在
      await writeJSON(toFile, data); // 写入目标文件
      log.info(`已将标签 "${safeFrom}" 的任务复制到 "${safeTo}"`); // 日志
    } else {
      throw new Error(`源标签 "${safeFrom}" 的任务文件不存在`); // 源文件不存在则报错
    }
  }

  /**
   * 跨标签移动任务
   *
   * 从源标签的任务文件中移除指定任务，添加到目标标签的任务文件中。
   * 自动处理父子关系清理和依赖引用清理。
   *
   * @param taskId  - 要移动的任务 ID
   * @param fromTag - 源标签名
   * @param toTag   - 目标标签名
   * @param withDependencies - v16.0 C-2: 是否连带移动依赖任务（默认 false）
   */
  async crossTagMove(taskId: string, fromTag: string, toTag: string, withDependencies = false): Promise<void> {
    const safeFrom = sanitizeId(fromTag, 'fromTag'); // 清洗源标签名
    const safeTo = sanitizeId(toTag, 'toTag'); // 清洗目标标签名
    const fromFile = this.computeTasksFilePath(safeFrom); // 源文件路径
    const toFile = this.computeTasksFilePath(safeTo); // 目标文件路径

    // v16.0 S-2: 嵌套 withFileLock 保护两个文件的原子操作
    // 外层锁源文件，内层锁目标文件，锁顺序固定避免死锁
    await withFileLock(fromFile, async () => {
      // 1. 无锁读取源标签任务数据
      const fromData = await readJSONUnlocked<TasksFile>(fromFile); // 无锁读取源文件
      if (!fromData) throw new Error(`源标签 "${safeFrom}" 的任务文件不存在`); // 校验

      // 2. 查找并移除任务
      const taskIdx = fromData.tasks.findIndex(t => t.id === taskId); // 查找任务索引
      if (taskIdx === -1) throw new Error(`任务 ${taskId} 在标签 "${safeFrom}" 中不存在`); // 校验
      const task = fromData.tasks[taskIdx]; // 取出任务

      // v16.0 C-2: 收集需要连带移动的依赖任务
      const tasksToMove: Task[] = [task]; // 要移动的任务列表（至少包含主任务）
      if (withDependencies && task.dependencies.length > 0) {
        for (const depId of task.dependencies) {
          const depIdx = fromData.tasks.findIndex(t => t.id === depId); // 查找依赖任务
          if (depIdx !== -1) {
            tasksToMove.push(fromData.tasks[depIdx]); // 加入移动列表
            log.debug(`crossTagMove: 连带移动依赖任务 ${depId}`); // 调试日志
          }
        }
      }

      // 从源中移除所有要移动的任务
      const moveIds = new Set(tasksToMove.map(t => t.id)); // 移动任务 ID 集合
      fromData.tasks = fromData.tasks.filter(t => !moveIds.has(t.id)); // 批量删除

      // 清理源数据中的父子关系
      if (task.parentId) { // 有父任务
        const parent = fromData.tasks.find(t => t.id === task.parentId); // 查找父任务
        if (parent) { // 父任务存在
          parent.subtasks = parent.subtasks.filter(id => !moveIds.has(id)); // 从父任务的子任务列表中移除
          parent.updatedAt = new Date().toISOString(); // 刷新时间
        }
      }

      // 清理源数据中其他任务对移动任务的依赖引用
      for (const t of fromData.tasks) {
        const before = t.dependencies.length; // 清理前的依赖数
        t.dependencies = t.dependencies.filter(depId => !moveIds.has(depId)); // 移除对移动任务的依赖
        if (t.dependencies.length !== before) { // 依赖数有变化
          t.updatedAt = new Date().toISOString(); // 刷新时间
        }
      }

      await withFileLock(toFile, async () => {
        // 3. 无锁读取或创建目标标签任务数据
        let toData = await readJSONUnlocked<TasksFile>(toFile); // 无锁读取目标文件
        if (!toData) { // 目标文件不存在
          toData = { version: 1, tasks: [], lastId: 0 }; // 创建空结构
        }

        // 4. 将任务添加到目标
        for (const t of tasksToMove) {
          t.parentId = undefined; // 清除父任务引用
          // v16.0 C-2: withDependencies 时保留依赖内部引用，仅清除外部引用
          t.dependencies = withDependencies
            ? t.dependencies.filter(depId => moveIds.has(depId)) // 只保留同批移动的依赖
            : []; // 不连带时清除所有依赖
          t.subtasks = t.subtasks.filter(id => moveIds.has(id)); // 只保留同批移动的子任务
          t.updatedAt = new Date().toISOString(); // 刷新时间
          toData.tasks.push(t); // 添加到目标
        }

        // 5. 无锁保存两个文件
        await writeJSONUnlocked(fromFile, fromData); // 保存源文件
        await writeJSONUnlocked(toFile, toData); // 保存目标文件
      });
    });
    const movedCount = withDependencies ? '（含依赖）' : ''; // 日志后缀
    log.info(`任务 ${taskId} 已从标签 "${safeFrom}" 移动到 "${safeTo}"${movedCount}`); // 日志
  }

  /**
   * 加载任务文件
   *
   * 文件不存在时创建空的 tasks.json 并返回。
   *
   * @returns 校验后的任务文件数据
   */
  async load(): Promise<TasksFile> {
    // 缓存命中检查：1 秒内的重复读取直接返回缓存
    if (this.cache && Date.now() - this.cacheTime < this.CACHE_TTL) {
      log.debug('任务文件缓存命中，跳过磁盘读取'); // 调试日志
      return this.cache;
    }
    log.debug(`加载任务文件: ${this.filePath}`); // 调试日志
    const raw = await readJSON<unknown>(this.filePath); // 读取文件

    if (raw === null) { // 文件不存在
      log.info('任务文件不存在，创建空文件'); // 提示信息
      const empty: TasksFile = { version: 1, tasks: [], lastId: 0 }; // 空任务文件结构
      await this.save(empty); // 写入磁盘（save 内部会更新缓存）
      return empty; // 返回空结构
    }

    const parsed = TasksFileSchema.safeParse(raw); // Zod 校验
    if (!parsed.success) { // 校验失败
      log.error(`任务文件格式错误: ${parsed.error.message}`); // 错误日志
      throw new Error(`tasks.json 校验失败: ${parsed.error.message}`); // 抛出异常
    }

    log.debug(`任务加载成功: 共 ${parsed.data.tasks.length} 个任务`); // 调试日志
    this.cache = parsed.data; // 更新内存缓存
    this.cacheTime = Date.now(); // 记录缓存时间
    return parsed.data; // 返回校验后的数据
  }

  /**
   * 持久化任务数据到磁盘
   *
   * @param data - 要保存的任务文件数据
   */
  async save(data: TasksFile): Promise<void> {
    await ensureDir(path.join(this.projectRoot, QFLOW_DIR)); // 确保目录存在
    await writeJSON(this.filePath, data); // 原子写入
    this.cache = data; // 写入后更新缓存
    this.cacheTime = Date.now(); // 刷新缓存时间
    log.debug(`任务文件已保存: ${data.tasks.length} 个任务`); // 调试日志
  }

  /**
   * 无锁加载任务文件（须在 withFileLock 保护下调用）
   *
   * v16.0 S-1: 配合 withFileLock 使用，避免嵌套锁死锁。
   * 绕过内存缓存直接读盘，确保在锁内读到最新数据。
   *
   * @returns 校验后的任务文件数据
   */
  private async loadUnlocked(): Promise<TasksFile> {
    log.debug(`[loadUnlocked] 无锁加载任务文件: ${this.filePath}`); // 调试日志
    const raw = await readJSONUnlocked<unknown>(this.filePath); // 无锁读取（外层 withFileLock 保护）

    if (raw === null) { // 文件不存在
      log.info('[loadUnlocked] 任务文件不存在，创建空文件'); // 提示信息
      const empty: TasksFile = { version: 1, tasks: [], lastId: 0 }; // 空任务文件结构
      await this.saveUnlocked(empty); // 无锁写入
      return empty; // 返回空结构
    }

    const parsed = TasksFileSchema.safeParse(raw); // Zod 校验
    if (!parsed.success) { // 校验失败
      log.error(`[loadUnlocked] 任务文件格式错误: ${parsed.error.message}`); // 错误日志
      throw new Error(`tasks.json 校验失败: ${parsed.error.message}`); // 抛出异常
    }

    log.debug(`[loadUnlocked] 任务加载成功: 共 ${parsed.data.tasks.length} 个任务`); // 调试日志
    return parsed.data; // 返回校验后的数据
  }

  /**
   * 无锁持久化任务数据到磁盘（须在 withFileLock 保护下调用）
   *
   * v16.0 S-1: 配合 withFileLock 使用，避免 writeJSON 再次获取锁导致死锁。
   * 写入后更新内存缓存，保证后续 load() 读到最新数据。
   *
   * @param data - 要保存的任务文件数据
   */
  private async saveUnlocked(data: TasksFile): Promise<void> {
    await ensureDir(path.join(this.projectRoot, QFLOW_DIR)); // 确保目录存在
    await writeJSONUnlocked(this.filePath, data); // 无锁原子写入（外层 withFileLock 保护）
    this.cache = data; // 写后更新缓存，保证后续 load() 一致性
    this.cacheTime = Date.now(); // 刷新缓存时间
    log.debug(`[saveUnlocked] 任务文件已保存: ${data.tasks.length} 个任务`); // 调试日志
  }

  /**
   * 创建新任务
   *
   * ID 生成规则:
   * - 有 parentId 时: T{parentNum}.{parentSubtaskCount+1}（如 T1.3）
   * - 无 parentId 时: T{lastId+1}（如 T5）
   *
   * @param title       - 任务标题
   * @param description - 任务描述
   * @param opts        - 可选参数：优先级、依赖、标签、父任务 ID
   * @returns 新创建的任务对象
   */
  async createTask(
    title: string,
    description: string,
    opts?: { priority?: number; deps?: string[]; tags?: string[]; parentId?: string; assignee?: string },
  ): Promise<Task> {
    return await withFileLock(this.filePath, async () => { // v16.0 S-2: withFileLock 原子操作
      const data = await this.loadUnlocked(); // 无锁加载（外层已持锁）
      const now = new Date().toISOString(); // 当前时间戳

      let taskId: string; // 待生成的任务 ID

      if (opts?.parentId) { // 有父任务，生成子任务 ID
        const parent = data.tasks.find((t) => t.id === opts.parentId); // 查找父任务
        if (!parent) { // 父任务不存在
          throw new Error(`父任务 ${opts.parentId} 不存在`); // 抛出错误
        }
        const siblings = data.tasks.filter((t) => t.parentId === opts.parentId); // 已有子任务列表
        const maxSubId = siblings.reduce((max, t) => { // 取已有子任务 ID 中的最大序号
          const parts = t.id.split('.'); // 按 . 分割 ID
          const subNum = parseInt(parts[parts.length - 1]) || 0; // 取末尾数字
          return Math.max(max, subNum); // 保留最大值
        }, 0);
        taskId = `${opts.parentId}.${maxSubId + 1}`; // 最大序号 + 1，避免删除子任务后 ID 碰撞
        parent.subtasks.push(taskId); // 在父任务中记录子任务
        parent.updatedAt = now; // 更新父任务时间
      } else { // 无父任务，生成顶级任务 ID
        data.lastId += 1; // 递增全局 ID 计数器
        taskId = `T${data.lastId}`; // 拼接顶级任务 ID
      }

      const task: Task = { // 构造任务对象
        id: taskId, // 唯一标识
        title, // 标题
        description, // 描述
        status: 'pending', // 初始状态：待处理
        priority: opts?.priority ?? DEFAULT_PRIORITY, // v15.0 R-5: 优先级从常量取
        dependencies: opts?.deps ?? [], // 依赖列表
        subtasks: [], // 子任务列表（初始为空）
        parentId: opts?.parentId, // 父任务 ID（可选）
        tags: opts?.tags ?? [], // 标签列表
        assignee: opts?.assignee, // v17.0 TM-3: 团队模式任务分配人
        createdAt: now, // 创建时间
        updatedAt: now, // 更新时间
      };

      // H1.4: 自动检查依赖状态，未满足则设为 blocked
      if (task.dependencies.length > 0) {
        const doneIds = new Set(data.tasks.filter(t => t.status === 'done').map(t => t.id)); // 收集所有已完成任务 ID
        const allDepsDone = task.dependencies.every(dep => doneIds.has(dep)); // 检查依赖是否全部完成
        if (!allDepsDone) {
          task.status = 'blocked'; // 依赖未满足，自动阻塞
          log.debug(`任务 ${taskId} 依赖未满足，自动设为 blocked`);
        }
      }

      data.tasks.push(task); // 追加到任务列表
      await this.saveUnlocked(data); // 无锁保存（外层已持锁）
      log.info(`任务已创建: ${taskId} - ${title}`); // 信息日志
      return task; // 返回新任务
    });
  }

  /**
   * 按 ID 查找任务
   *
   * @param taskId - 任务 ID
   * @returns 匹配的任务，未找到返回 null
   */
  async getTask(taskId: string): Promise<Task | null> {
    const data = await this.load(); // 加载数据
    return data.tasks.find((t) => t.id === taskId) ?? null; // 查找并返回
  }

  /**
   * 更新任务字段
   *
   * 只更新传入的字段，自动刷新 updatedAt。
   *
   * @param taskId  - 任务 ID
   * @param updates - 要更新的字段
   * @returns 更新后的任务对象
   */
  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    return await withFileLock(this.filePath, async () => { // v16.0 S-2: withFileLock 原子操作
      const data = await this.loadUnlocked(); // 无锁加载（外层已持锁）
      const idx = data.tasks.findIndex((t) => t.id === taskId); // 查找索引
      if (idx === -1) { // 未找到
        throw new Error(`任务 ${taskId} 不存在`); // 抛出错误
      }

      const task = data.tasks[idx]; // 取出任务引用
      const { id: _id, createdAt: _ca, metadata: metadataUpdate, ...safeUpdates } = updates; // 过滤不可变字段，单独提取 metadata
      if (updates.status) {
        delete safeUpdates.status; // 状态变更必须走 setStatus
      }
      Object.assign(task, safeUpdates, { updatedAt: new Date().toISOString() }); // 合并安全更新，刷新时间
      // TM-4: metadata 使用合并语义（不覆盖已有字段），保留外部集成数据（如 GitHub/Jira ID）
      if (metadataUpdate !== undefined) {
        task.metadata = Object.assign(task.metadata ?? {}, metadataUpdate); // 深合并 metadata，旧字段保留
      }
      data.tasks[idx] = task; // 回写（虽然 Object.assign 是原地操作，但语义更清晰）
      await this.saveUnlocked(data); // 无锁保存（外层已持锁）
      log.debug(`任务 ${taskId} 已更新`); // 调试日志
      return task; // 返回更新后的任务
    });
  }

  /**
   * 删除任务
   *
   * cascade=true 时同时删除所有子任务。
   * 删除后自动清理其他任务 dependencies 中对该 ID 的引用。
   *
   * @param taskId  - 任务 ID
   * @param cascade - 是否级联删除子任务，默认 false
   * @returns 被删除的 ID 列表和被更新的 ID 列表
   */
  async deleteTask(taskId: string, cascade = false): Promise<{ deleted: string[]; updated: string[] }> {
    return await withFileLock(this.filePath, async () => { // v16.0 S-2: withFileLock 原子操作
      const data = await this.loadUnlocked(); // 无锁加载（外层已持锁）
      const target = data.tasks.find((t) => t.id === taskId); // 查找目标任务
      if (!target) { // 未找到
        throw new Error(`任务 ${taskId} 不存在`); // 抛出错误
      }

      const toDelete = new Set<string>([taskId]); // 待删除 ID 集合

      if (cascade) { // 级联删除子任务
        const collectChildren = (parentId: string): void => { // 递归收集所有子孙任务
          for (const t of data.tasks) {
            if (t.parentId === parentId) { // 找到子任务
              toDelete.add(t.id); // 加入待删除集合
              collectChildren(t.id); // 递归收集下一层
            }
          }
        };
        collectChildren(taskId); // 从目标任务开始收集
      }

      const updated: string[] = []; // 被更新的任务 ID 列表

      // 从父任务的 subtasks 中移除被删除的 ID
      if (target.parentId) { // 有父任务
        const parent = data.tasks.find((t) => t.id === target.parentId); // 查找父任务
        if (parent) { // 父任务存在
          parent.subtasks = parent.subtasks.filter((id) => !toDelete.has(id)); // 移除被删子任务
          parent.updatedAt = new Date().toISOString(); // 刷新时间
          updated.push(parent.id); // 记录被更新
        }
      }

      // 清理其他任务 dependencies 中对被删任务的引用
      for (const t of data.tasks) {
        if (toDelete.has(t.id)) continue; // 跳过待删除的任务
        const before = t.dependencies.length; // 清理前的依赖数
        t.dependencies = t.dependencies.filter((depId) => !toDelete.has(depId)); // 移除对被删任务的依赖
        if (t.dependencies.length !== before) { // 依赖数有变化
          t.updatedAt = new Date().toISOString(); // 刷新时间
          if (!updated.includes(t.id)) updated.push(t.id); // 记录被更新
        }
      }

      data.tasks = data.tasks.filter((t) => !toDelete.has(t.id)); // 从列表中移除被删任务
      await this.saveUnlocked(data); // 无锁保存（外层已持锁）

      const deletedArr = [...toDelete]; // 转为数组
      log.info(`已删除任务: ${deletedArr.join(', ')}`); // 信息日志
      return { deleted: deletedArr, updated }; // 返回结果
    });
  }

  /**
   * 校验状态转换是否合法
   *
   * 包含三项校验：
   * 1. 状态机合法性（H1.3）
   * 2. 子任务是否全部完成（H3）
   * 3. 质量门禁验收标准（J2）
   *
   * @param task   - 待校验的任务对象
   * @param status - 目标状态
   * @param data   - 任务文件数据（用于查找子任务）
   */
  private validateStatusTransition(task: Task, status: Task['status'], data: TasksFile): void {
    // H1.3: 状态转换校验
    if (!validateTransition(task.status, status)) { // 调用状态机校验函数
      const valid = getValidTransitions(task.status); // 获取合法目标状态
      throw new Error(
        `非法状态转换: ${task.status} → ${status}。` +
        `当前状态 "${task.status}" 只能转换为: ${valid.join(', ') || '无'}`
      );
    }

    // H3: done 前检查子任务是否全部完成
    if (status === 'done' && task.subtasks.length > 0) { // 有子任务且目标为完成
      const incompleteSubs = data.tasks.filter(
        t => task.subtasks.includes(t.id) && t.status !== 'done' && t.status !== 'cancelled'
      ); // 查找未完成的子任务
      if (incompleteSubs.length > 0) { // 存在未完成子任务
        throw new Error(
          `任务 ${task.id} 有 ${incompleteSubs.length} 个未完成子任务: ${incompleteSubs.map(t => t.id).join(', ')}，不能标记为 done`
        );
      }
    }

    // J2: 质量门禁 - 有 acceptanceCriteria 的任务需验证
    if (status === 'done' && task.acceptanceCriteria && task.acceptanceCriteria.length > 0) { // 有验收标准
      const verified = task.metadata?.verified === true; // 通过 qflow_task_verify 标记
      if (!verified) { // 未验证通过
        throw new Error(
          `任务 ${task.id} 有 ${task.acceptanceCriteria.length} 条验收标准未验证。` +
          `请先使用 qflow_task_verify 工具标记验证通过，再标记 done`
        );
      }
    }
  }

  /**
   * 应用状态变更到任务对象
   *
   * 更新 status、updatedAt，done 时额外填充 completedAt。
   *
   * @param task   - 待更新的任务对象（原地修改）
   * @param status - 目标状态
   * @param now    - 当前时间戳（ISO 8601 格式）
   */
  private applyStatusChange(task: Task, status: Task['status'], now: string): void {
    task.status = status; // 更新状态
    task.updatedAt = now; // 刷新更新时间

    if (status === 'done') { // 完成状态
      task.completedAt = now; // 记录完成时间
    }
  }

  /**
   * 解锁下游任务
   *
   * 当任务完成或取消时，扫描所有 blocked/pending 任务，
   * 如果其依赖全部完成/取消，则从 blocked 转为 pending。
   *
   * @param task      - 刚变更状态的任务
   * @param status    - 新状态
   * @param data      - 任务文件数据
   * @param now       - 当前时间戳
   * @param unblocked - 被解锁的任务 ID 列表（原地追加）
   */
  private unlockDownstream(task: Task, status: Task['status'], data: TasksFile, now: string, unblocked: string[]): void {
    if (status !== 'done' && status !== 'cancelled') return; // 仅 done/cancelled 触发解锁（H2）

    const doneIds = new Set(data.tasks.filter((t) => t.status === 'done' || t.status === 'cancelled').map((t) => t.id)); // 所有已完成/已取消任务 ID
    doneIds.add(task.id); // 加上当前刚完成的

    for (const t of data.tasks) { // 遍历所有任务
      if (t.status !== 'blocked' && t.status !== 'pending') continue; // 仅检查可能被解锁的状态
      if (t.dependencies.length === 0) continue; // 无依赖，跳过
      const allDepsDone = t.dependencies.every((depId) => doneIds.has(depId)); // 检查依赖是否全完成
      if (allDepsDone && t.status === 'blocked') { // 所有依赖完成且当前被阻塞
        t.status = 'pending'; // 解锁为待处理
        t.updatedAt = now; // 刷新时间
        unblocked.push(t.id); // 记录被解锁
      }
    }
  }

  /**
   * 父子状态联动
   *
   * H1.5: 子任务全部完成/取消时，自动将 active 状态的父任务标记为 done。
   *
   * @param task      - 刚变更状态的子任务
   * @param status    - 新状态
   * @param data      - 任务文件数据
   * @param now       - 当前时间戳
   * @param unblocked - 状态变更记录列表（原地追加）
   */
  private syncParentStatus(task: Task, status: Task['status'], data: TasksFile, now: string, unblocked: string[]): void {
    if (status !== 'done' && status !== 'cancelled') return; // 仅 done/cancelled 触发
    if (!task.parentId) return; // 无父任务，跳过

    const parent = data.tasks.find(t => t.id === task.parentId); // 查找父任务
    if (!parent || parent.status !== 'active') return; // 父任务不存在或非进行中，跳过

    const siblings = data.tasks.filter(t => t.parentId === task.parentId); // 获取所有兄弟任务
    const allDone = siblings.every(t => t.status === 'done' || t.status === 'cancelled'); // 检查是否全部完成/取消
    if (allDone) { // 所有兄弟（含自身）均已完成/取消
      parent.status = 'done'; // 自动完成父任务
      parent.completedAt = now; // 记录完成时间
      parent.updatedAt = now; // 刷新时间
      unblocked.push(parent.id); // 记录状态变更
      log.info(`父任务 ${parent.id} 的所有子任务已完成，自动标记为 done`); // 日志
    }
  }

  /**
   * 触发 onTaskDone 钩子
   *
   * F6: 任务完成时异步执行配置的钩子命令，失败不阻塞主流程。
   * 使用 execFile 而非 exec，避免 shell 注入风险。
   *
   * @param taskId - 完成的任务 ID
   * @param status - 新状态（仅 done 时触发）
   */
  private async triggerOnTaskDoneHook(taskId: string, status: Task['status']): Promise<void> {
    if (status !== 'done') return; // 仅 done 触发钩子

    try {
      const { loadConfig } = await import('./config-manager.js'); // 动态导入配置管理器
      const config = await loadConfig(this.projectRoot); // 加载项目配置
      if (config.hooks?.onTaskDone) { // 检查是否配置了钩子命令
        const safeTaskId = sanitizeId(taskId); // 清洗 taskId 防止命令注入
        const { execFile } = await import('node:child_process'); // 动态导入子进程模块（execFile 不经过 shell，更安全）
        const { promisify } = await import('node:util'); // 导入 promisify 工具
        const execFileAsync = promisify(execFile); // 包装为 Promise
        try {
          await execFileAsync(config.hooks.onTaskDone, [safeTaskId], { cwd: this.projectRoot, timeout: HOOK_TIMEOUT }); // v15.0 R-5: 钩子超时从常量取
          log.info(`钩子执行成功: ${config.hooks.onTaskDone} [${safeTaskId}]`); // 记录执行成功
        } catch (hookErr) {
          log.warn(`钩子执行失败: ${(hookErr as Error).message}`); // 钩子失败不阻塞
        }
      }
    } catch (e) {
      log.warn(`Hook onTaskDone 加载失败: ${(e as Error).message}`); // 配置加载失败不阻塞主流程
    }
  }

  /**
   * 设置任务状态
   *
   * 设为 'done' 时自动填充 completedAt。
   * 完成后扫描所有 blocked/pending 任务，如果其依赖全部完成，
   * 则将其从 blocked 转为 pending（自动解锁）。
   *
   * 内部流程（6 步）：
   * 1. validateStatusTransition - 校验状态转换合法性
   * 2. applyStatusChange        - 应用状态变更 + 时间戳
   * 3. unlockDownstream          - 解锁下游被阻塞的任务
   * 4. syncParentStatus          - 父子状态联动
   * 5. triggerOnTaskDoneHook     - 触发 onTaskDone 钩子（异步非阻塞）
   * 6. writeProgressFile         - 写入进度文件（异步非阻塞）
   *
   * @param taskId - 任务 ID
   * @param status - 新状态
   * @returns 更新后的任务和被解锁的任务 ID 列表
   */
  async setStatus(taskId: string, status: Task['status']): Promise<{ task: Task; unblocked: string[] }> {
    // v16.0 S-2: withFileLock 原子操作，hook 和 progressFile 在锁外执行避免持锁过久
    const result = await withFileLock(this.filePath, async () => {
      const data = await this.loadUnlocked(); // 无锁加载（外层已持锁）
      const idx = data.tasks.findIndex((t) => t.id === taskId); // 查找索引
      if (idx === -1) { // 未找到
        throw new Error(`任务 ${taskId} 不存在`); // 抛出错误
      }

      const now = new Date().toISOString(); // 当前时间
      const task = data.tasks[idx]; // 取出任务
      const oldStatus = task.status; // v22.0 P3-4: 记录变更前状态（用于 undo + 审计）

      // v22.0 P3-4: 写入 undo 日志（在状态变更前记录）
      await this.writeUndoLog({ timestamp: now, operation: 'setStatus', taskIds: [taskId], previousStates: [{ id: task.id, status: task.status }] }).catch(e => log.debug('writeUndoLog 失败: ' + (e instanceof Error ? e.message : e)));

      // 第 1 步：校验状态转换合法性（H1.3 / H3 / J2）
      this.validateStatusTransition(task, status, data);

      // 第 2 步：应用状态变更 + 时间戳
      this.applyStatusChange(task, status, now);

      // 第 3 步：解锁下游被阻塞的任务
      const unblocked: string[] = []; // 被解锁的任务 ID 列表
      this.unlockDownstream(task, status, data, now, unblocked);

      // 第 4 步：父子状态联动（H1.5）
      this.syncParentStatus(task, status, data, now, unblocked);

      await this.saveUnlocked(data); // 无锁保存（外层已持锁）

      // v22.0 P3-13: 审计日志
      await this.writeAuditLog({ timestamp: now, taskId, field: 'status', oldValue: oldStatus, newValue: status, source: 'setStatus' }).catch(e => log.debug('writeAuditLog 失败: ' + (e instanceof Error ? e.message : e)));

      log.info(`任务 ${taskId} 状态 → ${status}${unblocked.length > 0 ? `，解锁: ${unblocked.join(', ')}` : ''}`); // 日志

      return { task, unblocked }; // 返回结果
    });

    // 第 5 步：触发 onTaskDone 钩子（F6，异步非阻塞，锁外执行）
    await this.triggerOnTaskDoneHook(taskId, status);

    // 第 6 步：任务完成时自动写入进度文件（异步非阻塞，锁外执行）
    if (status === 'done') {
      this.writeProgressFile().catch(err => {
        log.warn(`写入 progress.txt 失败: ${(err as Error).message}`); // 进度文件写入失败不阻塞主流程
      });
    }

    return result; // 返回结果
  }

  /**
   * 写入进度文件到 .qflow/progress.txt
   *
   * 包含当前日期时间、任务总数、各状态计数和完成百分比。
   * 在任务状态变为 done 时自动调用。
   */
  async writeProgressFile(): Promise<void> {
    const data = await this.load(); // 加载任务数据
    const tasks = data.tasks; // 全部任务
    const total = tasks.length; // 总任务数
    const done = tasks.filter(t => t.status === 'done').length; // 已完成数
    const active = tasks.filter(t => t.status === 'active').length; // 进行中数
    const pending = tasks.filter(t => t.status === 'pending').length; // 待处理数
    const blocked = tasks.filter(t => t.status === 'blocked').length; // 阻塞数
    const cancelled = tasks.filter(t => t.status === 'cancelled').length; // 已取消数
    const review = tasks.filter(t => t.status === 'review').length; // 评审中数
    const deferred = tasks.filter(t => t.status === 'deferred').length; // 延期数
    const percentage = total > 0 ? Math.round((done / total) * 100) : 0; // 完成百分比

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19); // 格式化时间（YYYY-MM-DD HH:mm:ss）
    const content = [
      `qflow 项目进度报告`,
      `==================`,
      `更新时间: ${now}`,
      ``,
      `任务统计:`,
      `  总计:   ${total}`,
      `  已完成: ${done}`,
      `  进行中: ${active}`,
      `  待处理: ${pending}`,
      `  阻塞:   ${blocked}`,
      `  评审中: ${review}`,
      `  延期:   ${deferred}`,
      `  已取消: ${cancelled}`,
      ``,
      `完成进度: ${percentage}% (${done}/${total})`,
    ].join('\n'); // 拼接进度报告

    const progressPath = path.join(this.projectRoot, '.qflow', 'progress.txt'); // 进度文件路径
    await ensureDir(path.dirname(progressPath)); // 确保目录存在
    const { writeFile } = await import('node:fs/promises'); // 动态导入写文件函数
    await writeFile(progressPath, content, 'utf-8'); // 写入文件
    log.debug(`进度文件已更新: ${progressPath} (${percentage}%)`); // 调试日志
  }

  /**
   * 按条件过滤任务列表
   *
   * 支持按状态、标签、父任务 ID、就绪状态、阻塞状态过滤，条件间为 AND 关系。
   * - ready: pending 且所有依赖均 done
   * - blocking: 有下游依赖且自身未 done（瓶颈任务）
   *
   * @param filter - 过滤条件（可选）
   * @returns 匹配的任务列表
   */
  async listTasks(filter?: {
    status?: Task['status'];
    tags?: string[];
    parentId?: string;
    ready?: boolean;     // P2: pending + 所有依赖 done
    blocking?: boolean;  // P2: 有下游依赖且自身未 done（瓶颈）
    assignee?: string;   // v17.0 TM-4: 按分配人过滤
  }): Promise<Task[]> {
    const data = await this.load(); // 加载数据
    let tasks = data.tasks; // 全量任务

    if (filter?.status) { // 按状态过滤
      tasks = tasks.filter((t) => t.status === filter.status);
    }
    if (filter?.tags && filter.tags.length > 0) { // 按标签过滤（任务至少包含一个指定标签）
      tasks = tasks.filter((t) => filter.tags!.some((tag) => t.tags.includes(tag)));
    }
    if (filter?.parentId !== undefined) { // 按父任务 ID 过滤
      tasks = tasks.filter((t) => t.parentId === filter.parentId);
    }
    if (filter?.assignee) { // v17.0 TM-4: 按分配人过滤
      tasks = tasks.filter((t) => t.assignee === filter.assignee);
    }
    if (filter?.ready || filter?.blocking) { // 预构建已完成任务 ID 集合，O(n) 替代 O(n²) 的 .find()
      const doneSet = new Set(data.tasks.filter(t => t.status === 'done').map(t => t.id));
      if (filter?.ready) { // P2: 过滤就绪任务（pending + 所有依赖 done）
        tasks = tasks.filter(t =>
          t.status === 'pending' &&
          t.dependencies.every(depId => doneSet.has(depId)) // O(1) 查找替代 O(n)
        );
      }
      if (filter?.blocking) { // P2: 过滤阻塞瓶颈任务（有下游依赖且自身未 done）
        const blockingIds = new Set<string>(); // 阻塞任务 ID 集合
        for (const t of data.tasks) { // 遍历所有任务
          for (const depId of t.dependencies) { // 遍历每个依赖
            if (!doneSet.has(depId)) blockingIds.add(depId); // 未完成的依赖即为阻塞源，O(1) 查找
          }
        }
        tasks = tasks.filter(t => blockingIds.has(t.id)); // 保留阻塞任务
      }
    }

    return tasks; // 返回过滤结果
  }

  /**
   * 获取全部任务
   *
   * @returns 所有任务列表
   */
  async getAllTasks(): Promise<Task[]> {
    const data = await this.load(); // 加载数据
    return data.tasks; // 返回全量
  }

  /**
   * 过滤就绪任务 — 返回所有依赖已全部满足的待执行任务（P1-1 增强版）
   *
   * 就绪条件：任务自身状态为 pending 或 active，且其所有依赖任务状态均为 done。
   * 无依赖的 pending/active 任务也视为就绪。只读方法，无需文件锁。
   *
   * @returns 满足就绪条件的任务列表，每项附带 reason 字段说明就绪原因
   */
  async filterByReady(): Promise<{ task: Task; reason: string }[]> {
    const data = await this.load(); // 加载任务数据
    const doneSet = new Set(data.tasks.filter(t => t.status === 'done').map(t => t.id)); // 构建已完成任务 ID 集合，O(n)
    const result: { task: Task; reason: string }[] = []; // 带 reason 的结果列表

    for (const t of data.tasks) { // 遍历全部任务
      if (t.status !== 'pending' && t.status !== 'active') continue; // 只处理 pending/active 状态
      if (!t.dependencies.every(depId => doneSet.has(depId))) continue; // 所有依赖必须已完成

      // 根据依赖情况生成 reason 字段
      const reason = t.dependencies.length === 0
        ? '无依赖，可直接执行' // 无依赖任务
        : `所有依赖已完成（${t.dependencies.join(', ')}）`; // 依赖全部 done

      result.push({ task: t, reason }); // 追加结果
    }

    log.debug(`filterByReady: 找到 ${result.length} 个就绪任务`); // 调试日志
    return result; // 返回带 reason 的就绪任务列表
  }

  /**
   * 过滤阻塞任务 — 返回所有正在阻塞其他任务的瓶颈任务（P1-2 增强版）
   *
   * 阻塞条件：任务被其他任务的 dependencies 引用，且自身状态不为 done。
   * 即该任务未完成导致下游任务无法解锁。只读方法，无需文件锁。
   *
   * @returns 正在阻塞下游的瓶颈任务列表，每项附带 blockedTasks 字段列出被阻塞的任务 ID
   */
  async filterByBlocking(): Promise<{ task: Task; blockedTasks: string[] }[]> {
    const data = await this.load(); // 加载任务数据
    const doneSet = new Set(data.tasks.filter(t => t.status === 'done').map(t => t.id)); // 已完成任务 ID 集合

    // 构建 blockingId → 被阻塞任务 ID 列表的映射
    const blockedByMap = new Map<string, string[]>(); // key: 阻塞源 ID, value: 被其阻塞的任务 ID 列表
    for (const t of data.tasks) { // 遍历所有任务
      for (const depId of t.dependencies) { // 遍历每个任务的依赖
        if (!doneSet.has(depId)) { // 未完成的依赖即为阻塞源
          if (!blockedByMap.has(depId)) blockedByMap.set(depId, []); // 初始化列表
          blockedByMap.get(depId)!.push(t.id); // 记录被阻塞的任务 ID
        }
      }
    }

    // 从全量任务中筛选阻塞源，附带 blockedTasks 列表
    const result: { task: Task; blockedTasks: string[] }[] = [];
    for (const t of data.tasks) { // 遍历所有任务
      if (blockedByMap.has(t.id)) { // 该任务是阻塞源
        result.push({ task: t, blockedTasks: blockedByMap.get(t.id)! }); // 附带被阻塞任务列表
      }
    }

    log.debug(`filterByBlocking: 找到 ${result.length} 个阻塞任务`); // 调试日志
    return result; // 返回带 blockedTasks 的阻塞任务列表
  }

  /**
   * 按 metadata 键值对查询任务（P2: 增强 metadata 工具支持）
   *
   * @param key   - metadata 键名
   * @param value - metadata 值（可选，不传则匹配所有含该 key 的任务）
   * @returns 匹配的任务列表
   */
  async getTasksByMetadata(key: string, value?: string): Promise<Task[]> {
    const data = await this.load(); // 加载数据
    return data.tasks.filter(t => {
      if (!t.metadata || !(key in t.metadata)) return false; // 无 metadata 或无此 key
      if (value === undefined) return true; // 仅检查 key 存在
      return String(t.metadata[key]) === value; // 值匹配
    });
  }

  /**
   * 设置任务的单个 metadata 键值对（v20.0 P2-2）
   *
   * 使用 withFileLock 保证原子写入。若任务无 metadata 字段则自动创建。
   * 仅设置指定 key，不影响其他已有 metadata 键。
   *
   * @param taskId - 任务 ID
   * @param key    - metadata 键名
   * @param value  - metadata 值（任意类型）
   * @returns 更新后的完整 metadata 对象
   */
  async setTaskMetadata(taskId: string, key: string, value: unknown): Promise<Record<string, unknown>> {
    return await withFileLock(this.filePath, async () => { // v20.0 P2-2: withFileLock 原子操作
      const data = await this.loadUnlocked(); // 无锁加载（外层已持锁）
      const idx = data.tasks.findIndex((t) => t.id === taskId); // 查找任务索引
      if (idx === -1) { // 未找到
        throw new Error(`任务 ${taskId} 不存在`); // 抛出错误
      }
      const task = data.tasks[idx]; // 取出任务引用
      if (!task.metadata) { // metadata 字段不存在则初始化
        task.metadata = {};
      }
      task.metadata[key] = value; // 设置指定键值
      task.updatedAt = new Date().toISOString(); // 刷新更新时间戳
      await this.saveUnlocked(data); // 无锁保存（外层已持锁）
      log.debug(`任务 ${taskId} metadata["${key}"] 已设置`); // 调试日志
      return task.metadata; // 返回更新后的完整 metadata
    });
  }

  /**
   * 读取任务的 metadata（v20.0 P2-3）
   *
   * 只读操作，无需文件锁。若指定 key 则返回对应值，否则返回完整 metadata 对象。
   *
   * @param taskId - 任务 ID
   * @param key    - metadata 键名（可选，不传则返回全部 metadata）
   * @returns 指定 key 的值或完整 metadata 对象；任务无 metadata 时返回空对象
   */
  async getTaskMetadata(taskId: string, key?: string): Promise<unknown> {
    const data = await this.load(); // 加载数据（带缓存）
    const task = data.tasks.find((t) => t.id === taskId); // 查找任务
    if (!task) { // 未找到
      throw new Error(`任务 ${taskId} 不存在`); // 抛出错误
    }
    const metadata = task.metadata ?? {}; // 无 metadata 时返回空对象
    if (key !== undefined) { // 指定了 key，返回对应值
      return metadata[key]; // 可能为 undefined（key 不存在）
    }
    return metadata; // 返回完整 metadata 对象
  }

  /**
   * 动态添加依赖关系
   * @param taskId - 任务 ID
   * @param depId - 依赖的任务 ID
   */
  async addDependency(taskId: string, depId: string): Promise<void> {
    await withFileLock(this.filePath, async () => { // v16.0 S-2: withFileLock 原子操作
      const data = await this.loadUnlocked(); // 无锁加载（外层已持锁）
      const task = data.tasks.find(t => t.id === taskId); // 获取任务
      if (!task) throw new Error(`任务 ${taskId} 不存在`); // 校验存在
      const dep = data.tasks.find(t => t.id === depId); // 获取依赖任务
      if (!dep) throw new Error(`依赖任务 ${depId} 不存在`); // 校验存在
      if (task.dependencies.includes(depId)) return; // 已存在则跳过
      task.dependencies.push(depId); // 添加依赖
      task.updatedAt = new Date().toISOString(); // 刷新更新时间
      await this.saveUnlocked(data); // 无锁保存（外层已持锁）
      log.info(`已为任务 ${taskId} 添加依赖 ${depId}`); // 日志
    });
  }

  /**
   * 动态移除依赖关系
   * @param taskId - 任务 ID
   * @param depId - 要移除的依赖 ID
   */
  async removeDependency(taskId: string, depId: string): Promise<void> {
    await withFileLock(this.filePath, async () => { // v16.0 S-2: withFileLock 原子操作
      const data = await this.loadUnlocked(); // 无锁加载（外层已持锁）
      const task = data.tasks.find(t => t.id === taskId); // 获取任务
      if (!task) throw new Error(`任务 ${taskId} 不存在`); // 校验存在
      const idx = task.dependencies.indexOf(depId); // 查找依赖索引
      if (idx === -1) return; // 不存在则跳过
      task.dependencies.splice(idx, 1); // 移除依赖
      task.updatedAt = new Date().toISOString(); // 刷新更新时间
      await this.saveUnlocked(data); // 无锁保存（外层已持锁）
      log.info(`已从任务 ${taskId} 移除依赖 ${depId}`); // 日志
    });
  }

  /**
   * 自动修复断裂依赖引用（引用了不存在的任务）
   * @returns 修复报告
   */
  async fixDependencies(): Promise<{ fixed: number; details: string[] }> {
    return await withFileLock(this.filePath, async () => { // v16.0 S-2: withFileLock 原子操作
      const data = await this.loadUnlocked(); // 无锁加载（外层已持锁）
      const taskIds = new Set(data.tasks.map(t => t.id)); // 构建 ID 集合
      let fixed = 0; // 修复计数
      const details: string[] = []; // 修复详情

      for (const task of data.tasks) { // 遍历所有任务
        const brokenDeps = task.dependencies.filter(d => !taskIds.has(d)); // 查找断裂依赖
        if (brokenDeps.length > 0) { // 有断裂依赖
          task.dependencies = task.dependencies.filter(d => taskIds.has(d)); // 过滤掉断裂的
          task.updatedAt = new Date().toISOString(); // 刷新时间
          fixed += brokenDeps.length; // 累加计数
          details.push(`${task.id}: 移除断裂依赖 [${brokenDeps.join(', ')}]`); // 记录详情
        }
      }

      if (fixed > 0) { // 有修复才写盘
        await this.saveUnlocked(data); // 无锁保存（外层已持锁）
      }

      log.info(`依赖修复完成: 修复 ${fixed} 处断裂引用`); // 日志
      return { fixed, details }; // 返回报告
    });
  }

  /**
   * 跨父级移动任务
   * @param taskId - 要移动的任务 ID
   * @param newParentId - 新父任务 ID，undefined 表示移到顶级
   */
  async moveTask(taskId: string, newParentId?: string): Promise<void> {
    await withFileLock(this.filePath, async () => { // v16.0 S-2: withFileLock 原子操作
      const data = await this.loadUnlocked(); // 无锁加载（外层已持锁）
      const task = data.tasks.find(t => t.id === taskId); // 获取任务
      if (!task) throw new Error(`任务 ${taskId} 不存在`); // 校验存在

      // 从旧父任务中移除
      if (task.parentId) { // 有旧父任务
        const oldParent = data.tasks.find(t => t.id === task.parentId); // 获取旧父
        if (oldParent) { // 旧父存在
          oldParent.subtasks = oldParent.subtasks.filter(id => id !== taskId); // 移除子任务引用
          oldParent.updatedAt = new Date().toISOString(); // 刷新时间
        }
      }

      // 设置新父任务
      if (newParentId) { // 有新父任务
        const newParent = data.tasks.find(t => t.id === newParentId); // 获取新父
        if (!newParent) throw new Error(`目标父任务 ${newParentId} 不存在`); // 校验存在
        if (!newParent.subtasks.includes(taskId)) { // 不在子任务列表中
          newParent.subtasks.push(taskId); // 添加
          newParent.updatedAt = new Date().toISOString(); // 刷新时间
        }
        task.parentId = newParentId; // 更新父 ID
      } else {
        task.parentId = undefined; // 移到顶级
      }

      task.updatedAt = new Date().toISOString(); // 刷新时间
      await this.saveUnlocked(data); // 无锁保存（外层已持锁）
      log.info(`任务 ${taskId} 已移动到 ${newParentId || '顶级'}`); // 日志
    });
  }

  /**
   * 清除任务的所有子任务
   * @param taskId - 父任务 ID
   * @returns 被清除的子任务 ID 列表
   */
  async clearSubtasks(taskId: string): Promise<string[]> {
    return await withFileLock(this.filePath, async () => { // v16.0 S-2: withFileLock 原子操作
      const data = await this.loadUnlocked(); // 无锁加载（外层已持锁）
      const task = data.tasks.find(t => t.id === taskId); // 获取任务
      if (!task) throw new Error(`任务 ${taskId} 不存在`); // 校验存在

      const cleared = [...task.subtasks]; // 记录被清除的子任务 ID
      // 递归收集所有后代子任务
      const toDelete = new Set<string>(); // 待删除 ID 集合
      const collectDescendants = (parentId: string): void => { // 递归收集
        for (const t of data.tasks) {
          if (t.parentId === parentId) { // 找到子任务
            toDelete.add(t.id); // 加入待删除集合
            collectDescendants(t.id); // 递归收集下一层
          }
        }
      };
      for (const subId of cleared) { // 遍历直接子任务
        toDelete.add(subId); // 加入待删除
        collectDescendants(subId); // 收集其后代
      }

      // 清理其他任务 dependencies 中对被删任务的引用
      for (const t of data.tasks) {
        if (toDelete.has(t.id)) continue; // 跳过待删除的任务
        const before = t.dependencies.length; // 清理前的依赖数
        t.dependencies = t.dependencies.filter(depId => !toDelete.has(depId)); // 移除对被删任务的依赖
        if (t.dependencies.length !== before) { // 依赖数有变化
          t.updatedAt = new Date().toISOString(); // 刷新时间
        }
      }

      data.tasks = data.tasks.filter(t => !toDelete.has(t.id)); // 从列表中移除被删任务
      task.subtasks = []; // 清空子任务列表
      task.updatedAt = new Date().toISOString(); // 刷新时间
      await this.saveUnlocked(data); // 无锁保存（外层已持锁）
      log.info(`已清除任务 ${taskId} 的 ${cleared.length} 个子任务`); // 日志
      return cleared; // 返回被清除的 ID 列表
    });
  }

  /**
   * 从父任务中移除指定子任务的关联关系
   *
   * 仅解除父子关联，不删除子任务本身。
   *
   * @param parentId  - 父任务 ID
   * @param subtaskId - 要移除的子任务 ID
   * @returns 移除结果对象
   */
  async removeSubtask(parentId: string, subtaskId: string): Promise<{ removed: true; parentId: string; subtaskId: string }> {
    return await withFileLock(this.filePath, async () => { // v16.0 S-2: withFileLock 原子操作
      const data = await this.loadUnlocked(); // 无锁加载（外层已持锁）
      const parent = data.tasks.find(t => t.id === parentId); // 查找父任务
      if (!parent) { // 父任务不存在
        throw new Error(`父任务 ${parentId} 不存在`); // 抛出错误
      }
      const subtask = data.tasks.find(t => t.id === subtaskId); // 查找子任务
      if (!subtask) { // 子任务不存在
        throw new Error(`子任务 ${subtaskId} 不存在`); // 抛出错误
      }

      const idx = parent.subtasks.indexOf(subtaskId); // 查找子任务在父任务列表中的索引
      if (idx === -1) { // 子任务不在父任务的 subtasks 中
        log.warn(`子任务 ${subtaskId} 不在父任务 ${parentId} 的 subtasks 列表中`); // 警告日志
      } else {
        parent.subtasks.splice(idx, 1); // 从父任务的 subtasks 数组中移除
        parent.updatedAt = new Date().toISOString(); // 刷新父任务更新时间
      }

      subtask.parentId = undefined; // 清除子任务的父 ID 引用
      subtask.updatedAt = new Date().toISOString(); // 刷新子任务更新时间

      await this.saveUnlocked(data); // 无锁保存（外层已持锁）
      log.info(`已从父任务 ${parentId} 中移除子任务 ${subtaskId}`); // 信息日志
      return { removed: true, parentId, subtaskId }; // 返回移除结果
    });
  }

  /**
   * 保存任务关联的研究资料到独立 JSON 文件
   *
   * 文件存储路径: {projectRoot}/.qflow/research/{taskId}.json
   *
   * @param taskId  - 关联的任务 ID
   * @param content - 研究内容
   * @param source  - 来源说明
   * @returns 保存后的研究数据对象
   */
  async saveResearch(taskId: string, content: string, source: string): Promise<ResearchData> {
    const safeTaskId = sanitizeId(taskId); // 清洗 taskId 防止路径遍历
    const researchDir = path.join(this.projectRoot, QFLOW_DIR, 'research'); // 拼接研究资料目录路径
    await ensureDir(researchDir); // 确保目录存在

    const researchData: ResearchData = { // 构造研究数据对象
      taskId: safeTaskId, // 关联任务 ID（已清洗）
      content, // 研究内容
      source, // 来源说明
      savedAt: new Date().toISOString(), // 保存时间戳
    };

    const filePath = path.join(researchDir, `${safeTaskId}.json`); // 拼接研究文件路径（使用清洗后的 ID）
    await writeJSON(filePath, researchData); // 写入文件
    log.info(`任务 ${taskId} 的研究资料已保存: ${filePath}`); // 信息日志
    return researchData; // 返回保存的数据
  }

  /**
   * 读取任务关联的研究资料
   *
   * @param taskId - 任务 ID
   * @returns 研究数据对象，文件不存在时返回 null
   */
  async getResearch(taskId: string): Promise<ResearchData | null> {
    const safeTaskId = sanitizeId(taskId); // 清洗 taskId 防止路径遍历
    const filePath = path.join(this.projectRoot, QFLOW_DIR, 'research', `${safeTaskId}.json`); // 拼接研究文件路径（使用清洗后的 ID）
    const data = await readJSON<ResearchData>(filePath); // 读取文件内容
    if (data === null) { // 文件不存在
      log.warn(`任务 ${taskId} 的研究资料不存在`); // 警告日志
      return null; // 返回 null
    }
    log.debug(`已加载任务 ${taskId} 的研究资料`); // 调试日志
    return data; // 返回解析后的数据
  }

  // ─── v18.0: 研究会话持久化方法 ─────────────────────────────

  /**
   * 保存研究会话
   *
   * 文件存储路径: {projectRoot}/.qflow/research/sessions/{id}.json
   *
   * @param session - 研究会话对象
   * @returns 保存后的研究会话
   */
  async saveResearchSession(session: import('../schemas/research.js').ResearchSession): Promise<import('../schemas/research.js').ResearchSession> {
    const sessionsDir = path.join(this.projectRoot, QFLOW_DIR, 'research', 'sessions'); // 会话目录
    await ensureDir(sessionsDir); // 确保目录存在
    const filePath = path.join(sessionsDir, `${sanitizeId(session.id)}.json`); // 会话文件路径
    await writeJSON(filePath, session); // 写入文件
    log.info(`研究会话已保存: ${session.id} (${session.title})`); // 日志
    return session;
  }

  /**
   * 列出所有研究会话
   *
   * 扫描 sessions 目录，返回所有会话列表。
   *
   * @returns 研究会话数组
   */
  async listResearchSessions(): Promise<import('../schemas/research.js').ResearchSession[]> {
    const sessionsDir = path.join(this.projectRoot, QFLOW_DIR, 'research', 'sessions'); // 会话目录
    const sessions: import('../schemas/research.js').ResearchSession[] = []; // 结果列表
    try {
      const { promises: nodeFs } = await import('node:fs'); // 动态导入
      const files = await nodeFs.readdir(sessionsDir); // 读取目录
      for (const file of files) {
        if (!file.endsWith('.json')) continue; // 跳过非 JSON 文件
        const data = await readJSON<import('../schemas/research.js').ResearchSession>(path.join(sessionsDir, file)); // 读取会话
        if (data) sessions.push(data); // 加入结果
      }
    } catch {
      log.debug('研究会话目录不存在或为空'); // 目录不存在时静默处理
    }
    return sessions;
  }

  /**
   * 继续研究会话 - 追加新消息
   *
   * @param sessionId   - 会话 ID
   * @param newMessages - 新消息列表
   * @returns 更新后的研究会话
   */
  async continueResearchSession(
    sessionId: string,
    newMessages: import('../schemas/research.js').ResearchMessage[],
  ): Promise<import('../schemas/research.js').ResearchSession> {
    const sessionsDir = path.join(this.projectRoot, QFLOW_DIR, 'research', 'sessions'); // 会话目录
    const filePath = path.join(sessionsDir, `${sanitizeId(sessionId)}.json`); // 会话文件路径
    const session = await readJSON<import('../schemas/research.js').ResearchSession>(filePath); // 读取现有会话
    if (!session) throw new Error(`研究会话 ${sessionId} 不存在`); // 会话不存在

    session.messages.push(...newMessages); // 追加消息
    session.updatedAt = Date.now(); // 更新时间戳
    await writeJSON(filePath, session); // 写回文件
    log.info(`研究会话 ${sessionId} 已追加 ${newMessages.length} 条消息`); // 日志
    return session;
  }

  /**
   * 获取任务树 - 递归加载任务及其所有子任务形成树结构
   *
   * @param taskId - 根任务 ID
   * @returns 任务树节点（包含 task 和递归的 children）
   */
  async getTaskTree(taskId: string): Promise<TaskTreeNode> {
    const data = await this.load(); // 加载任务数据
    const task = data.tasks.find(t => t.id === taskId); // 查找目标任务
    if (!task) { // 任务不存在
      throw new Error(`任务 ${taskId} 不存在`); // 抛出错误
    }

    /**
     * 递归构建子任务树
     *
     * @param parentTask - 当前父任务
     * @param depth      - 当前递归深度（防止无限递归）
     * @returns 子任务树节点数组
     */
    const buildChildren = (parentTask: Task, depth = 0): TaskTreeNode[] => {
      if (depth >= MAX_LOOP_DEPTH) { // 超过最大递归深度，截断并警告
        log.warn(`getTaskTree: 递归深度已达上限 ${MAX_LOOP_DEPTH}，任务 ${parentTask.id} 的子树被截断`);
        return []; // 返回空数组，防止无限递归
      }
      return parentTask.subtasks.map(subId => { // 遍历所有子任务 ID
        const subTask = data.tasks.find(t => t.id === subId); // 查找子任务
        if (!subTask) { // 子任务不存在（数据不一致）
          log.warn(`子任务 ${subId} 在 tasks 列表中未找到，跳过`); // 警告日志
          return null; // 返回 null 占位
        }
        return { // 构造树节点
          task: subTask, // 子任务对象
          children: buildChildren(subTask, depth + 1), // 递归构建下一层，深度 +1
        };
      }).filter((node): node is TaskTreeNode => node !== null); // 过滤掉 null 节点
    };

    log.debug(`已构建任务 ${taskId} 的任务树`); // 调试日志
    return { // 返回根节点
      task, // 根任务对象
      children: buildChildren(task), // 递归构建所有子任务
    };
  }

  /**
   * 追加时间戳笔记到任务 details 字段（v10.0）
   *
   * 以时间戳格式追加，永不覆盖现有内容。
   *
   * @param taskId - 任务 ID
   * @param note   - 笔记内容
   * @returns 更新后的任务对象
   */
  async appendToDetails(taskId: string, note: string): Promise<Task> {
    const safeId = sanitizeId(taskId); // 安全清洗
    return await withFileLock(this.filePath, async () => { // v16.0 S-2: withFileLock 原子操作
      const data = await this.loadUnlocked(); // 无锁加载（外层已持锁）
      const task = data.tasks.find(t => t.id === safeId); // 查找任务
      if (!task) throw new Error(`任务 ${safeId} 不存在`); // 校验存在

      const timestamp = new Date().toISOString(); // 当前时间戳
      const entry = `[${timestamp}] ${note}`; // 格式化条目
      task.details = task.details ? `${task.details}\n${entry}` : entry; // 追加或创建
      task.updatedAt = new Date().toISOString(); // 刷新更新时间
      await this.saveUnlocked(data); // 无锁保存（外层已持锁）
      log.info(`任务 ${safeId} 已追加笔记`); // 信息日志
      return task; // 返回更新后的任务
    });
  }

  /**
   * 导出所有任务为独立文件（P1-4 增强版：支持 .md 和 .txt 双格式）
   *
   * @param outputDir - 输出目录路径，默认导出到 .qflow/exports/
   * @param format    - 导出格式：'md'（Markdown）或 'txt'（纯文本），默认 'md'
   * @returns 生成的文件列表和数量
   */
  async generateTaskFiles(
    outputDir: string,
    format: 'md' | 'txt' = 'md' // 默认使用 Markdown 格式
  ): Promise<{ files: string[]; count: number; format: string }> {
    const { ensureDir: mkDir } = await import('../utils/file-io.js'); // 导入目录创建工具
    const { promises: fsPromises } = await import('node:fs'); // 导入文件操作
    await mkDir(outputDir); // 确保输出目录存在

    const data = await this.load(); // 加载所有任务
    const files: string[] = []; // 生成的文件列表

    for (const task of data.tasks) { // 遍历所有任务
      const fileName = `${task.id}.${format}`; // 文件名（根据 format 决定扩展名）
      const filePath = path.join(outputDir, fileName); // 完整路径

      let content: string; // 文件内容

      if (format === 'md') {
        // Markdown 格式：带标题、加粗字段名、超链接
        const lines: string[] = [
          `# ${task.id}: ${task.title}`, // 一级标题
          '',
          `**状态**: ${task.status} | **优先级**: ${task.priority} | **复杂度**: ${task.complexityScore ?? 'N/A'}`, // 元信息
          '',
          '## 描述', // 描述节
          task.description,
          '',
        ];

        if (task.details) { // 有笔记
          lines.push('## 笔记', task.details, '');
        }
        if (task.dependencies.length > 0) { // 有依赖
          lines.push('## 依赖', ...task.dependencies.map(d => `- [${d}](./${d}.md)`), '');
        }
        if (task.subtasks.length > 0) { // 有子任务
          lines.push('## 子任务', ...task.subtasks.map(s => `- [${s}](./${s}.md)`), '');
        }
        if (task.tags.length > 0) { // 有标签
          lines.push(`**标签**: ${task.tags.join(', ')}`, '');
        }
        lines.push(`---`, `创建: ${task.createdAt} | 更新: ${task.updatedAt}`); // 时间戳分隔线
        content = lines.join('\n'); // 拼接内容
      } else {
        // 纯文本格式：无标记语法，适合机器处理
        const lines: string[] = [
          `ID: ${task.id}`, // 任务 ID
          `标题: ${task.title}`, // 任务标题
          `状态: ${task.status}`, // 状态
          `优先级: ${task.priority}`, // 优先级
          `复杂度: ${task.complexityScore ?? 'N/A'}`, // 复杂度
          ``,
          `描述:`, // 描述节
          task.description,
          ``,
        ];

        if (task.details) { // 有笔记
          lines.push(`笔记:`, task.details, ``);
        }
        if (task.dependencies.length > 0) { // 有依赖
          lines.push(`依赖: ${task.dependencies.join(', ')}`, ``);
        }
        if (task.subtasks.length > 0) { // 有子任务
          lines.push(`子任务: ${task.subtasks.join(', ')}`, ``);
        }
        if (task.tags.length > 0) { // 有标签
          lines.push(`标签: ${task.tags.join(', ')}`, ``);
        }
        lines.push(`创建: ${task.createdAt}`, `更新: ${task.updatedAt}`); // 时间戳
        content = lines.join('\n'); // 拼接内容
      }

      await fsPromises.writeFile(filePath, content, 'utf-8'); // 写入文件
      files.push(fileName); // 记录文件名
    }

    log.info(`已导出 ${files.length} 个任务文件（${format} 格式）到 ${outputDir}`); // 日志
    return { files, count: files.length, format }; // 返回文件列表、数量和格式
  }

  /**
   * 批量更新指定任务 ID 之后的依赖链
   *
   * 从 fromId 开始，沿依赖链向下传播更新（如状态、标签等）。
   * 适用于需要级联更新的场景。
   *
   * @param fromId  - 起始任务 ID
   * @param updates - 要传播的更新字段
   * @returns 受影响的任务列表
   */
  async chainUpdate(fromId: string, updates: Partial<Pick<Task, 'status' | 'tags' | 'priority'>>): Promise<Task[]> {
    return await withFileLock(this.filePath, async () => { // v16.0 S-2: withFileLock 原子操作
      const data = await this.loadUnlocked(); // 无锁加载（外层已持锁）
      const affected: Task[] = []; // 受影响的任务列表
      const visited = new Set<string>(); // 防止循环依赖导致死循环
      const now = new Date().toISOString(); // 当前时间戳

      // BFS 遍历依赖链
      const queue: string[] = [fromId]; // 从起始任务开始
      while (queue.length > 0) {
        const currentId = queue.shift()!; // 取队首
        if (visited.has(currentId)) continue; // 已访问跳过
        visited.add(currentId); // 标记已访问

        const task = data.tasks.find(t => t.id === currentId); // 查找任务
        if (!task) continue; // 不存在跳过

        // 应用更新
        let changed = false; // 是否有变更
        if (updates.status !== undefined && task.status !== updates.status) {
          task.status = updates.status; // 更新状态
          changed = true;
        }
        if (updates.priority !== undefined && task.priority !== updates.priority) {
          task.priority = updates.priority; // 更新优先级
          changed = true;
        }
        if (updates.tags !== undefined) {
          const newTags = [...new Set([...task.tags, ...updates.tags])]; // 合并标签并去重
          if (newTags.length !== task.tags.length) {
            task.tags = newTags;
            changed = true;
          }
        }

        if (changed) {
          task.updatedAt = now; // 刷新更新时间
          affected.push(task); // 记录受影响任务
        }

        // 将依赖此任务的下游任务加入队列
        for (const t of data.tasks) {
          if (t.dependencies.includes(currentId) && !visited.has(t.id)) {
            queue.push(t.id); // 加入队列
          }
        }
        // 将子任务也加入队列
        for (const subId of task.subtasks) {
          if (!visited.has(subId)) {
            queue.push(subId); // 加入队列
          }
        }
      }

      if (affected.length > 0) {
        await this.saveUnlocked(data); // 无锁保存（外层已持锁）
      }

      log.info(`链式更新从 ${fromId} 开始，影响 ${affected.length} 个任务`);
      return affected;
    });
  }

  /**
   * 从指定 ID 起批量重写后续任务描述
   *
   * 收集所有 ID > startId 的任务（按 ID 排序），对每个任务用模板或 prompt 重写 description。
   * v21.0 P1-14: 新增 scope 参数，可限定重写范围（按标签/状态/优先级过滤）。
   * 当前为模板模式，预留 AI 接口供后续扩展。
   *
   * @param startId - 起始任务 ID（不含此 ID，仅处理其后的任务）
   * @param prompt  - 可选的重写指导提示词
   * @param scope   - 可选的范围过滤（v21.0 P1-14: tags/status/priority 条件，同时满足才重写）
   * @returns 被重写的任务 ID 列表和跳过的任务 ID 列表
   */
  async batchRewriteFrom(
    startId: string,
    prompt?: string,
    scope?: { tags?: string[]; status?: string; priority?: number }, // v21.0 P1-14: 范围过滤参数
  ): Promise<{ rewritten: string[]; skipped: string[] }> {
    return await withFileLock(this.filePath, async () => { // v16.0 S-2: withFileLock 原子操作
      const data = await this.loadUnlocked(); // 无锁加载（外层已持锁）
      const now = new Date().toISOString(); // 当前时间戳

      // 按 ID 排序，收集所有 ID > startId 的任务
      // v22.1: 数值 ID 排序（T10 > T2），避免字典序 T10 < T2 的错误
      const extractNum = (id: string): number => parseInt(id.replace(/\D/g, '')) || 0;
      const sortedTasks = [...data.tasks].sort((a, b) => extractNum(a.id) - extractNum(b.id));
      const startNum = extractNum(startId);
      const candidates = sortedTasks.filter(t => extractNum(t.id) > startNum);

      const rewritten: string[] = []; // 已重写的任务 ID
      const skipped: string[] = []; // 跳过的任务 ID

      for (const task of candidates) { // 遍历候选任务
        if (task.status === 'done' || task.status === 'cancelled') { // 已完成或已取消的跳过
          skipped.push(task.id); // 记录跳过
          continue;
        }

        // v21.0 P1-14: scope 过滤 - 不满足条件的任务跳过
        if (scope) {
          // 标签过滤：任务必须包含 scope.tags 中的所有标签
          if (scope.tags && scope.tags.length > 0) {
            const hasAllTags = scope.tags.every(tag => task.tags.includes(tag)); // 必须包含所有指定标签
            if (!hasAllTags) {
              skipped.push(task.id); // 不匹配标签，跳过
              continue;
            }
          }
          // 状态过滤：任务状态必须与 scope.status 匹配
          if (scope.status !== undefined && task.status !== scope.status) {
            skipped.push(task.id); // 状态不匹配，跳过
            continue;
          }
          // 优先级过滤：任务优先级必须大于等于 scope.priority
          if (scope.priority !== undefined && task.priority < scope.priority) {
            skipped.push(task.id); // 优先级不足，跳过
            continue;
          }
        }

        // v22.0 P1-11: AI 实装 — 优先使用 AI 重写，降级到模板
        const original = task.description;
        try {
          const aiPrompt = prompt
            ? `请根据以下指导重写任务描述:\n指导: ${prompt}\n原始描述: ${original}\n只输出重写后的描述，不要其他内容。`
            : `请优化以下任务描述，使其更清晰具体:\n${original}\n只输出优化后的描述，不要其他内容。`;
          const result = await callAI(aiPrompt, { maxTokens: 500 });
          task.description = result.content.trim();
          log.info(`任务 ${task.id} AI 重写成功`);
        } catch {
          const prefix = prompt ? `[根据指导重写] ${prompt}\n\n` : '[待 AI 重写] ';
          task.description = `${prefix}原始描述: ${original}`;
          log.warn(`任务 ${task.id} AI 重写失败，降级到模板`);
        }
        task.updatedAt = now; // 刷新更新时间
        rewritten.push(task.id); // 记录已重写
      }

      if (rewritten.length > 0) { // 有任务被重写才写盘
        await this.saveUnlocked(data); // 无锁保存（外层已持锁）
      }

      log.info(`批量重写从 ${startId} 开始: 重写 ${rewritten.length} 个，跳过 ${skipped.length} 个${scope ? `（scope过滤已启用）` : ''}`); // 信息日志
      return { rewritten, skipped }; // 返回结果
    });
  }

  /**
   * 根据任务信息生成 Git 分支名（v15.0 TM-6）
   *
   * 规则：qflow/task-{N}-{slug}，slug 由标题转换而来。
   * 移除中文字符，非字母数字转连字符，截断至 40 字符。
   *
   * @param task - 任务对象
   * @returns 格式化的 Git 分支名
   */
  generateBranchName(task: Task): string {
    const slug = task.title
      .toLowerCase() // 转小写
      .replace(/[\u4e00-\u9fff]/g, '') // 移除中文字符
      .replace(/[^a-z0-9]+/g, '-') // 非字母数字转连字符
      .replace(/^-|-$/g, '') // 移除首尾连字符
      .substring(0, 40); // 截断至 40 字符
    return `qflow/${task.id.toLowerCase().replace('t', 'task-')}-${slug}`; // 拼接分支名
  }

  /**
   * 动态调节任务范围（v17.0 SC-2）
   *
   * direction='up' 时扩展任务（增加子任务/提升复杂度）
   * direction='down' 时简化任务（合并子任务/降低复杂度）
   * strength 控制调节力度（1-5）
   *
   * @param taskId    - 任务 ID
   * @param direction - 调节方向：'up' 扩展 / 'down' 简化
   * @param strength  - 调节力度 1-5，默认 SCOPE_STRENGTH_DEFAULT
   * @returns 调节结果
   */
  async scopeAdjust(taskId: string, direction: 'up' | 'down', strength: number = SCOPE_STRENGTH_DEFAULT): Promise<{
    taskId: string;
    direction: string;
    strength: number;
    previousPriority: number;
    newPriority: number;
    previousComplexity: number | undefined;
    newComplexity: number | undefined;
    subtasksAffected: number;
    history: string;
  }> {
    const safeId = sanitizeId(taskId, 'taskId'); // 安全清洗 ID
    const clampedStrength = Math.max(SCOPE_STRENGTH_MIN, Math.min(SCOPE_STRENGTH_MAX, Math.round(strength))); // 限制强度范围

    return await withFileLock(this.filePath, async () => {
      const data = await readJSONUnlocked<TasksFile>(this.filePath); // 无锁读取（已在锁内）
      if (!data) throw new Error('任务文件不存在'); // 校验文件存在
      const task = data.tasks.find(t => t.id === safeId); // 查找任务
      if (!task) throw new Error(`任务 ${safeId} 不存在`); // 校验任务存在

      const previousPriority = task.priority; // 记录原优先级
      const previousComplexity = task.complexityScore; // 记录原复杂度
      let subtasksAffected = 0; // 受影响的子任务数

      if (direction === 'up') {
        // 扩展：提升复杂度，降低优先级数值（更紧急）
        task.complexityScore = Math.min(10, (task.complexityScore || 5) + clampedStrength); // 复杂度上调
        task.priority = Math.max(1, task.priority - Math.ceil(clampedStrength / 2)); // 优先级提升
        // 子任务也提升复杂度
        for (const subId of task.subtasks) {
          const sub = data.tasks.find(t => t.id === subId); // 查找子任务
          if (sub) {
            sub.complexityScore = Math.min(10, (sub.complexityScore || 5) + Math.ceil(clampedStrength / 2)); // 子任务复杂度上调
            sub.updatedAt = new Date().toISOString(); // 更新时间戳
            subtasksAffected++; // 计数
          }
        }
      } else {
        // 简化：降低复杂度，提升优先级数值（更宽松）
        task.complexityScore = Math.max(1, (task.complexityScore || 5) - clampedStrength); // 复杂度下调
        task.priority = Math.min(10, task.priority + Math.ceil(clampedStrength / 2)); // 优先级降低
        // 子任务也降低复杂度
        for (const subId of task.subtasks) {
          const sub = data.tasks.find(t => t.id === subId); // 查找子任务
          if (sub) {
            sub.complexityScore = Math.max(1, (sub.complexityScore || 5) - Math.ceil(clampedStrength / 2)); // 子任务复杂度下调
            sub.updatedAt = new Date().toISOString(); // 更新时间戳
            subtasksAffected++; // 计数
          }
        }
      }

      // 记录调节历史到 details
      const timestamp = new Date().toISOString(); // 当前时间戳
      const historyEntry = `[${timestamp}] scopeAdjust: direction=${direction}, strength=${clampedStrength}, priority ${previousPriority}→${task.priority}, complexity ${previousComplexity ?? 'N/A'}→${task.complexityScore}`; // 历史记录
      task.details = task.details ? `${task.details}\n${historyEntry}` : historyEntry; // 追加到笔记
      task.updatedAt = timestamp; // 更新时间戳

      await writeJSONUnlocked(this.filePath, data); // 无锁写入（已在锁内）
      this.cache = data; // 更新缓存
      this.cacheTime = Date.now(); // 更新缓存时间

      log.info(`scopeAdjust: ${safeId} ${direction} strength=${clampedStrength}, priority ${previousPriority}→${task.priority}, complexity ${previousComplexity}→${task.complexityScore}`); // 日志

      return {
        taskId: safeId,
        direction,
        strength: clampedStrength,
        previousPriority,
        newPriority: task.priority,
        previousComplexity,
        newComplexity: task.complexityScore,
        subtasksAffected,
        history: historyEntry,
      };
    });
  }
  /**
   * v19.0: 从 Plan 智能拆解为任务列表
   *
   * 读取 Plan 的 artifacts 列表，为每个产物创建任务，
   * 标记 parallel=true 的产物为可并行执行（标题前缀 [P]）。
   *
   * @param specId - 关联 Spec ID（对应 .qflow/plans/{specId}.json）
   * @returns 创建的任务列表
   */
  async planToTasks(specId: string): Promise<Task[]> {
    const planPath = path.join(this.projectRoot, '.qflow', 'plans', `${specId}.json`); // 计划文件路径
    const raw = await readJSON<any>(planPath); // 读取计划 JSON
    if (!raw || !raw.artifacts) throw new Error(`Plan for Spec "${specId}" 不存在`); // 计划不存在或无产物

    const tasks: Task[] = []; // 结果任务列表
    const artifacts = raw.artifacts as Array<{ // 产物列表类型定义
      name: string;
      type: string;
      path?: string;
      description: string;
      parallel?: boolean;
      dependencies?: string[];
    }>;

    for (let i = 0; i < artifacts.length; i++) { // 遍历每个产物
      const artifact = artifacts[i]; // 当前产物
      const title = artifact.parallel ? `[P] ${artifact.name}` : artifact.name; // 并行产物加 [P] 前缀
      const task = await this.createTask(title, artifact.description, {
        tags: [specId, artifact.type], // 用 specId 和类型作为标签
      });
      tasks.push(task); // 收集创建的任务
    }

    // 设置依赖关系：非并行任务依赖前一个任务
    for (let i = 1; i < tasks.length; i++) {
      const artifact = artifacts[i]; // 当前产物
      if (!artifact.parallel) { // 仅非并行产物需要依赖
        await this.addDependency(tasks[i].id, tasks[i - 1].id); // 添加依赖关系
      }
    }

    log.info(`planToTasks: 从 Plan ${specId} 创建了 ${tasks.length} 个任务`); // 日志
    return tasks;
  }

  /** P3-13: 丰富任务实现指导（添加文件/模式/验收建议） */
  async enrichTaskGuidance(taskId: string): Promise<{ taskId: string; enriched: boolean; fields: string[] }> {
    const task = await this.getTask(taskId); // 获取任务
    if (!task) throw new Error(`任务 ${taskId} 不存在`); // 任务不存在
    const fields: string[] = []; // 记录丰富的字段
    const updates: Partial<Task> = {}; // 更新内容

    // 补充验收标准（如果缺失）
    if (!task.acceptanceCriteria || task.acceptanceCriteria.length === 0) {
      updates.acceptanceCriteria = [`${task.title} 功能正常工作`, '无回归错误', '代码审查通过']; // 默认验收标准
      fields.push('acceptanceCriteria');
    }

    // 补充实现指导（如果缺失）
    if (!task.implementationGuide) {
      updates.implementationGuide = `## 实现指导\n\n### 任务: ${task.title}\n- 优先级: ${task.priority}\n- 状态: ${task.status}\n- 依赖: ${task.dependencies.join(', ') || '无'}\n\n### 建议步骤\n1. 阅读相关代码\n2. 实现功能\n3. 编写测试\n4. 提交代码`; // 默认指导
      fields.push('implementationGuide');
    }

    // 补充测试策略（如果缺失）
    if (!task.testStrategy) {
      updates.testStrategy = `单元测试 + 集成测试覆盖 ${task.title}`; // 默认测试策略
      fields.push('testStrategy');
    }

    if (fields.length > 0) {
      await this.updateTask(taskId, updates); // 更新任务
    }

    return { taskId, enriched: fields.length > 0, fields }; // 返回结果
  }

  /**
   * 启动任务并返回完整执行上下文（P1-6）
   *
   * 功能：
   * 1. 获取任务详情
   * 2. 将任务状态设置为 active
   * 3. 获取依赖任务的摘要列表
   * 4. 如果任务 metadata 中有关联的 specId，尝试获取 spec 实现指令
   * 5. 返回完整的执行上下文对象（task + dependencies + specInstructions + suggestedFiles + prompt）
   *
   * @param taskId - 要启动的任务 ID
   * @returns 完整的执行上下文对象
   */
  async startTask(taskId: string): Promise<{
    task: Task; // 启动后的任务对象（状态已改为 active）
    dependencies: Array<{ id: string; title: string; status: Task['status'] }>; // 依赖任务摘要列表（使用 Task['status'] 确保类型精确）
    specInstructions?: string; // 关联 spec 的实现指令（如有）
    suggestedFiles?: string[]; // 建议修改的文件列表（来自 task.relevantFiles）
    prompt: string; // 为 AI 生成的执行提示词，包含任务上下文
  }> {
    const safeId = sanitizeId(taskId); // 安全清洗任务 ID
    log.info(`startTask: 开始启动任务 ${safeId}`); // 信息日志

    // 1. 获取任务详情
    const task = await this.getTask(safeId); // 查找任务
    if (!task) throw new Error(`任务 ${safeId} 不存在`); // 任务不存在时抛出错误

    // 2. 将任务状态设置为 active
    await this.setStatus(safeId, 'active'); // 更新状态（内部会自动解锁下游任务）
    const activeTask = await this.getTask(safeId); // 重新获取最新任务对象（状态已更新）
    log.debug(`startTask: 任务 ${safeId} 状态已设为 active`); // 调试日志

    // 3. 获取依赖任务摘要
    const allTasks = await this.getAllTasks(); // 获取所有任务（用于查找依赖）
    type DepSummary = { id: string; title: string; status: Task['status'] }; // 依赖摘要类型
    const dependencies = task.dependencies
      .map((depId): DepSummary | null => { // 遍历每个依赖 ID，明确返回类型
        const dep = allTasks.find(t => t.id === depId); // 查找依赖任务
        if (!dep) return null; // 依赖任务不存在时返回 null
        return { id: dep.id, title: dep.title, status: dep.status }; // 返回摘要信息
      })
      .filter((d): d is DepSummary => d !== null); // 使用精确类型谓词过滤 null 值
    log.debug(`startTask: 找到 ${dependencies.length} 个依赖任务摘要`); // 调试日志

    // 4. 尝试获取关联 spec 的实现指令
    let specInstructions: string | undefined; // spec 实现指令（可选）
    const specId = task.metadata?.specId as string | undefined; // 从 metadata 读取关联的 specId
    if (specId) { // 如果有关联的 specId
      try {
        const { SpecManager } = await import('./spec-manager.js'); // 动态导入 SpecManager（避免循环依赖）
        const specMgr = new SpecManager(this.projectRoot); // 创建 SpecManager 实例
        specInstructions = await specMgr.getInstructions(specId); // 获取 spec 实现指令
        log.debug(`startTask: 已获取 specId=${specId} 的实现指令`); // 调试日志
      } catch (e) {
        log.warn(`startTask: 获取 spec 指令失败（specId=${specId}）: ${(e as Error).message}`); // 警告日志（不阻断流程）
      }
    }

    // 5. 收集建议修改的文件列表
    const suggestedFiles = task.relevantFiles?.map(f => f.path).filter(Boolean) as string[] | undefined; // 从 relevantFiles 提取文件路径（字段名在 TaskSchema 中为 relevantFiles）

    // 6. 生成 AI 执行提示词（包含完整任务上下文）
    const depSummary = dependencies.length > 0
      ? dependencies.map(d => `  - ${d.id}: ${d.title}（${d.status}）`).join('\n') // 依赖摘要
      : '  （无依赖）'; // 无依赖时的占位文本

    const fileHints = suggestedFiles && suggestedFiles.length > 0
      ? `\n\n相关文件:\n${suggestedFiles.map(f => `  - ${f}`).join('\n')}` // 文件提示
      : ''; // 无文件提示时为空

    const specHint = specInstructions
      ? `\n\n关联 Spec 指令:\n${specInstructions.slice(0, 500)}${specInstructions.length > 500 ? '...' : ''}` // spec 指令（截取前 500 字符）
      : ''; // 无 spec 指令时为空

    const prompt = [
      `# 任务上下文: ${activeTask!.id} - ${activeTask!.title}`,
      ``,
      `## 任务信息`,
      `- 状态: ${activeTask!.status}`,
      `- 优先级: ${activeTask!.priority}`,
      `- 复杂度: ${activeTask!.complexityScore ?? 'N/A'}`,
      ``,
      `## 任务描述`,
      activeTask!.description,
      ``,
      `## 依赖任务`,
      depSummary,
      fileHints, // 文件提示（可能为空）
      specHint,  // spec 指令提示（可能为空）
      ``,
      `## 执行建议`,
      `1. 阅读上述描述和依赖任务的完成情况`,
      `2. 参考关联文件（如有）`,
      `3. 实现功能后将状态设为 done 或 review`,
    ].filter(line => line !== undefined).join('\n'); // 拼接提示词

    log.info(`startTask: 任务 ${safeId} 上下文已准备就绪`); // 信息日志
    return {
      task: activeTask!, // 启动后的任务对象
      dependencies, // 依赖任务摘要
      specInstructions, // spec 实现指令（可能为 undefined）
      suggestedFiles: suggestedFiles && suggestedFiles.length > 0 ? suggestedFiles : undefined, // 建议文件列表（可能为 undefined）
      prompt, // 完整的 AI 执行提示词
    };
  }

  // ─── v21.0 P1-11/P1-12: 延迟工作记录 ─────────────────────────────

  /**
   * 将工作描述追加到 .qflow/deferred-work.md（v21.0 P1-11）
   *
   * 每行格式：`[YYYY-MM-DD HH:mm] description`
   * 文件不存在时自动创建。
   *
   * @param description - 要延迟的工作描述
   */
  async deferWork(description: string): Promise<void> {
    const deferredPath = path.join(this.projectRoot, '.qflow', 'deferred-work.md'); // 延迟工作文件路径
    const now = new Date(); // 当前时间
    // 格式化时间戳为 [YYYY-MM-DD HH:mm]
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`; // 格式化时间
    const line = `[${timestamp}] ${description}\n`; // 拼接一行记录

    try {
      await fsPromises.appendFile(deferredPath, line, 'utf-8'); // 追加到文件（不存在时自动创建）
      log.info(`deferWork: 已追加延迟工作: "${description}"`); // 信息日志
    } catch (err) {
      log.warn(`deferWork: 追加延迟工作失败: ${(err as Error).message}`); // 警告日志
      throw err; // 向上抛出，让调用方知晓
    }
  }

  /**
   * 读取 .qflow/deferred-work.md 的所有行（v21.0 P1-12）
   *
   * 文件不存在时返回空数组。
   *
   * @returns 每行内容的字符串数组（过滤空行）
   */
  async listDeferredWork(): Promise<string[]> {
    const deferredPath = path.join(this.projectRoot, '.qflow', 'deferred-work.md'); // 延迟工作文件路径
    try {
      const content = await fsPromises.readFile(deferredPath, 'utf-8'); // 读取文件内容
      const lines = content.split('\n').filter(line => line.trim().length > 0); // 按行分割并过滤空行
      log.debug(`listDeferredWork: 读取到 ${lines.length} 条延迟工作记录`); // 调试日志
      return lines; // 返回行数组
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') { // 文件不存在
        return []; // 返回空数组
      }
      throw err; // 其他错误向上抛出
    }
  }

  // ─── v22.0: 过期任务 / 截止日期 / 子任务进度 ─────────────────────

  /** v22.0 P2-3: 获取所有过期任务（dueDate < now 且非 done/cancelled） */
  async getOverdueTasks(): Promise<Task[]> {
    const data = await this.load();
    const now = new Date().toISOString();
    return data.tasks
      .filter(t => t.dueDate && t.dueDate < now && t.status !== 'done' && t.status !== 'cancelled')
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
      .slice(0, OVERDUE_SCAN_LIMIT);
  }

  /** v22.0 P2-4: 设置任务截止日期 */
  async setDueDate(taskId: string, dueDate: string): Promise<Task> {
    return await withFileLock(this.filePath, async () => {
      const data = await this.loadUnlocked();
      const task = data.tasks.find(t => t.id === taskId);
      if (!task) throw new Error(`任务 ${taskId} 不存在`);
      // v22.1: ISO 8601 格式校验，防止非法日期导致 load() 时 Zod 校验崩溃
      if (isNaN(Date.parse(dueDate))) {
        throw new Error(`无效的日期格式: "${dueDate}"，请使用 ISO 8601 格式（如 2026-03-25T00:00:00.000Z）`);
      }
      task.dueDate = dueDate;
      task.updatedAt = new Date().toISOString();
      await this.saveUnlocked(data);
      log.info(`任务 ${taskId} 截止日期设置为 ${dueDate}`);
      return task;
    });
  }

  /** v22.0 P2-10: 计算子任务进度 */
  async subtaskProgress(taskId: string): Promise<{ total: number; done: number; percentage: number }> {
    const data = await this.load();
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) throw new Error(`任务 ${taskId} 不存在`);
    if (task.subtasks.length === 0) return { total: 0, done: 0, percentage: 100 };
    const subtasks = data.tasks.filter(t => task.subtasks.includes(t.id));
    const done = subtasks.filter(t => t.status === 'done').length;
    const total = subtasks.length;
    return { total, done, percentage: total > 0 ? Math.round((done / total) * 100) : 100 };
  }

  // ─── v22.0: 归档系统 ──────────────────────────────────────────

  /** v22.0 P2-16: 归档已完成/已取消任务 */
  async archiveDoneTasks(olderThanDays?: number): Promise<{ archived: string[]; remaining: number }> {
    return await withFileLock(this.filePath, async () => {
      const data = await this.loadUnlocked();
      const now = new Date();
      const cutoff = olderThanDays
        ? new Date(now.getTime() - olderThanDays * 86400000).toISOString()
        : null;
      const toArchive = data.tasks.filter(t => {
        if (t.status !== 'done' && t.status !== 'cancelled') return false;
        if (cutoff && t.updatedAt > cutoff) return false;
        return true;
      }).slice(0, ARCHIVE_BATCH_SIZE);
      if (toArchive.length === 0) return { archived: [], remaining: data.tasks.length };
      const archiveDir = path.join(this.projectRoot, '.qflow', 'archive');
      await ensureDir(archiveDir);
      const archiveFile = path.join(archiveDir, `tasks-${Date.now()}.json`);
      await writeJSON(archiveFile, { archivedAt: now.toISOString(), tasks: toArchive });
      const archivedIds = new Set(toArchive.map(t => t.id));
      data.tasks = data.tasks.filter(t => !archivedIds.has(t.id));
      await this.saveUnlocked(data);
      log.info(`归档 ${toArchive.length} 个任务到 ${archiveFile}`);
      return { archived: toArchive.map(t => t.id), remaining: data.tasks.length };
    });
  }

  /** v22.0 P2-17: 列出归档任务 */
  async listArchivedTasks(): Promise<{ files: string[]; totalTasks: number }> {
    const archiveDir = path.join(this.projectRoot, '.qflow', 'archive');
    try {
      const files = (await fsPromises.readdir(archiveDir)).filter(f => f.startsWith('tasks-') && f.endsWith('.json'));
      let totalTasks = 0;
      for (const file of files) {
        const data = await readJSON<{ tasks: unknown[] }>(path.join(archiveDir, file));
        if (data?.tasks) totalTasks += data.tasks.length;
      }
      return { files, totalTasks };
    } catch {
      return { files: [], totalTasks: 0 };
    }
  }

  // ─── v22.0: Undo 系统 ─────────────────────────────────────────

  /** v22.0 P3-2: 写入 undo 日志（环形缓冲） */
  private async writeUndoLog(entry: UndoEntry): Promise<void> {
    const undoPath = path.join(this.projectRoot, '.qflow', 'undo-log.json');
    let entries: UndoEntry[] = [];
    try {
      const raw = await readJSON<{ entries: UndoEntry[] }>(undoPath);
      if (raw?.entries) entries = raw.entries;
    } catch { /* 文件不存在 */ }
    entries.push(entry);
    if (entries.length > UNDO_LOG_MAX) entries = entries.slice(-UNDO_LOG_MAX);
    await writeJSON(undoPath, { entries });
  }

  /** v22.0 P3-3: 读取 undo 日志 */
  private async readUndoLog(): Promise<UndoEntry[]> {
    const undoPath = path.join(this.projectRoot, '.qflow', 'undo-log.json');
    try {
      const raw = await readJSON<{ entries: UndoEntry[] }>(undoPath);
      return raw?.entries || [];
    } catch { return []; }
  }

  /** v22.0 P3-6: 回滚最近一次操作 */
  async undoLastOperation(): Promise<{ undone: boolean; operation?: string; taskIds?: string[] }> {
    // v22.1: 整体原子化操作，消除 TOCTOU 竞态
    return await withFileLock(this.filePath, async () => {
      const entries = await this.readUndoLog();
      if (entries.length === 0) return { undone: false };
      const last = entries[entries.length - 1];
      const data = await this.loadUnlocked();
      for (const prev of last.previousStates) {
        const task = data.tasks.find(t => t.id === prev.id);
        if (task) {
          task.status = prev.status as Task['status'];
          task.updatedAt = new Date().toISOString();
        }
      }
      await this.saveUnlocked(data);
      // Remove the last entry from undo log
      const undoPath = path.join(this.projectRoot, '.qflow', 'undo-log.json');
      entries.pop();
      await writeJSON(undoPath, { entries });
      log.info(`Undo 操作: ${last.operation}，影响 ${last.taskIds.length} 个任务`);
      return { undone: true, operation: last.operation, taskIds: last.taskIds };
    });
  }

  /** v22.0 P3-7: 获取 undo 历史 */
  async getUndoHistory(limit?: number): Promise<UndoEntry[]> {
    const entries = await this.readUndoLog();
    return limit ? entries.slice(-limit) : entries;
  }

  // ─── v22.0: 审计日志 ──────────────────────────────────────────

  /** v22.0 P3-12: 写入审计日志 */
  private async writeAuditLog(entry: AuditLogEntry): Promise<void> {
    const auditPath = path.join(this.projectRoot, '.qflow', 'audit-log.jsonl');
    await ensureDir(path.dirname(auditPath));
    // v22.1: 添加文件锁防止并发 JSONL 追加损坏
    await withFileLock(auditPath, async () => {
      await fsPromises.appendFile(auditPath, JSON.stringify(entry) + '\n');
    });
  }

  /** v22.0 P3-14: 获取任务变更历史 */
  async getTaskHistory(taskId: string): Promise<AuditLogEntry[]> {
    const auditPath = path.join(this.projectRoot, '.qflow', 'audit-log.jsonl');
    try {
      const content = await fsPromises.readFile(auditPath, 'utf-8');
      return content
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line) as AuditLogEntry)
        .filter(e => e.taskId === taskId);
    } catch { return []; }
  }

  // ─── v22.0: 负责人工作量统计 ──────────────────────────────────

  /** v22.0 P3-17: 按负责人统计活跃任务数 */
  async assigneeWorkload(): Promise<Record<string, { active: number; pending: number; total: number }>> {
    const data = await this.load();
    const workload: Record<string, { active: number; pending: number; total: number }> = {};
    for (const task of data.tasks) {
      const assignee = task.assignee || 'unassigned';
      if (!workload[assignee]) workload[assignee] = { active: 0, pending: 0, total: 0 };
      workload[assignee].total++;
      if (task.status === 'active') workload[assignee].active++;
      if (task.status === 'pending') workload[assignee].pending++;
    }
    return workload;
  }

}