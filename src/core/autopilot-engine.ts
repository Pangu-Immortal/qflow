/**
 * 自动驾驶引擎 - AI 自动执行任务链
 *
 * 管理自动驾驶的完整生命周期：配置->启动->执行->暂停/恢复->停止。
 * 支持速率限制、错误恢复、循环模式。
 *
 * 状态文件: {projectRoot}/.qflow/autopilot-state.json
 * 日志文件: {projectRoot}/.qflow/autopilot-log.json
 *
 * 函数列表:
 * - configure()  配置自动驾驶参数
 * - start()      启动自动执行
 * - pause()      暂停执行
 * - resume()     恢复执行
 * - stop()       停止执行
 * - getStatus()  获取运行状态
 * - getLog()     获取执行日志
 * - loop()       切换循环模式
 * - commitChanges() 安全执行 git commit（使用 execFile 防注入）
 */

import path from 'node:path'; // 路径拼接工具
import { z } from 'zod'; // 运行时数据校验库
import { TaskManager } from './task-manager.js'; // 任务管理器
import { selectNextTask } from '../algorithms/next-task.js'; // 下一任务选择算法
import { readJSONSafe, writeJSON, ensureDir, fileExists } from '../utils/file-io.js'; // 文件读写工具
import { log } from '../utils/logger.js'; // 日志工具
import type { Task } from '../schemas/task.js'; // 任务类型
import { AutopilotStateSchema, AutopilotLogEntrySchema } from '../schemas/autopilot.js'; // 自动驾驶 Zod Schema
import { QFLOW_DIR } from '../shared/tool-utils.js'; // .qflow 目录常量
import { MAX_LOG_ENTRIES, GIT_TIMEOUT } from '../shared/constants.js'; // v15.0 R-4: 全局常量

/** 自动驾驶状态文件名 */
const STATE_FILENAME = 'autopilot-state.json'; // 状态持久化文件

/** 自动驾驶日志文件名 */
const LOG_FILENAME = 'autopilot-log.json'; // 日志持久化文件

/** 运行状态枚举 */
export type AutopilotStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'error'; // 五种运行状态

/** 预设名称类型 */
export type AutopilotPreset = 'default' | 'test-coverage' | 'linting' | 'duplication' | 'entropy' | 'custom'; // 六种预设模式

/** 任务过滤条件接口 */
export interface TaskFilter {
  tags?: string[]; // 按标签过滤（匹配任一即可）
  statusFilter?: string[]; // 按状态过滤
}

/** 循环预设常量定义 */
export const AUTOPILOT_PRESETS: Record<string, { maxTasksPerRun?: number; loopMode?: boolean; filter?: TaskFilter }> = {
  'default':        { maxTasksPerRun: 50, loopMode: true }, // 默认：50 任务循环
  'test-coverage':  { maxTasksPerRun: 20, loopMode: true, filter: { tags: ['test', 'testing'] } }, // 测试覆盖：过滤测试相关标签
  'linting':        { maxTasksPerRun: 30, loopMode: true, filter: { tags: ['lint', 'style', 'format'] } }, // 代码风格：过滤 lint/style/format 标签
  'duplication':    { maxTasksPerRun: 15, loopMode: true, filter: { tags: ['refactor', 'dedup'] } }, // 去重：过滤重构/去重标签
  'entropy':        { maxTasksPerRun: 10, loopMode: true, filter: { tags: ['cleanup', 'tech-debt'] } }, // 熵值清理：过滤清理/技术债标签
};

/** 自动驾驶配置 */
export interface AutopilotConfig {
  maxTasksPerRun: number; // 单次运行最大任务数
  maxConcurrentErrors: number; // 连续错误暂停阈值
  intervalMs: number; // 任务间隔（毫秒），用于速率限制
  loopMode: boolean; // 是否开启循环模式
  tokensPerInterval: number; // 令牌桶每间隔补充的令牌数
  maxTokens: number; // 令牌桶最大容量
  preset?: AutopilotPreset; // 循环预设名称（可选）
  verbose?: boolean; // 详细日志模式（可选，默认 false）
}

/** 自动驾驶持久化状态 */
export interface AutopilotState {
  status: AutopilotStatus; // 当前运行状态
  config: AutopilotConfig; // 配置参数
  tasksCompleted: number; // 已完成任务计数
  consecutiveErrors: number; // 连续错误计数
  lastTaskId: string | null; // 最后执行的任务 ID
  lastError: string | null; // 最后一次错误信息
  startedAt: string | null; // 启动时间戳
  pausedAt: string | null; // 暂停时间戳
  stoppedAt: string | null; // 停止时间戳
}

/** 执行日志条目 */
export interface AutopilotLogEntry {
  timestamp: string; // 日志时间戳
  action: 'start' | 'pause' | 'resume' | 'stop' | 'task_begin' | 'task_done' | 'task_error' | 'loop_restart' | 'rate_limit'; // 动作类型
  taskId?: string; // 关联任务 ID（可选）
  message: string; // 日志消息
}

/** 默认配置 */
const DEFAULT_CONFIG: AutopilotConfig = {
  maxTasksPerRun: 50, // 默认单次最多执行 50 个任务
  maxConcurrentErrors: 3, // 默认连续 3 次错误后暂停
  intervalMs: 1000, // 默认间隔 1 秒
  loopMode: false, // 默认不循环
  tokensPerInterval: 1, // 每间隔补充 1 个令牌
  maxTokens: 5, // 最多积攒 5 个令牌
};

/** 默认状态 */
const DEFAULT_STATE: AutopilotState = {
  status: 'idle', // 初始空闲
  config: { ...DEFAULT_CONFIG }, // 拷贝默认配置
  tasksCompleted: 0, // 已完成 0 个
  consecutiveErrors: 0, // 连续错误 0 次
  lastTaskId: null, // 无最后任务
  lastError: null, // 无最后错误
  startedAt: null, // 未启动
  pausedAt: null, // 未暂停
  stoppedAt: null, // 未停止
};

/**
 * 自动驾驶引擎类
 *
 * 每个实例绑定一个项目根目录，操作该项目的自动驾驶状态和日志。
 */
export class AutopilotEngine {
  /** 项目根目录绝对路径 */
  private readonly projectRoot: string;

  /** 状态文件路径 */
  private readonly statePath: string;

  /** 日志文件路径 */
  private readonly logPath: string;

  /** 任务管理器实例 */
  private readonly taskManager: TaskManager;

  /** 令牌桶当前令牌数 */
  private tokenBucket: number;

  /** 令牌桶上次补充时间 */
  private lastTokenRefill: number;

  /**
   * @param projectRoot - 项目根目录绝对路径
   */
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot; // 保存项目根路径
    this.statePath = path.join(projectRoot, QFLOW_DIR, STATE_FILENAME); // 拼接状态文件路径
    this.logPath = path.join(projectRoot, QFLOW_DIR, LOG_FILENAME); // 拼接日志文件路径
    this.taskManager = new TaskManager(projectRoot); // 创建任务管理器
    this.tokenBucket = DEFAULT_CONFIG.maxTokens; // 初始令牌桶满
    this.lastTokenRefill = Date.now(); // 记录初始化时间
  }

  /**
   * 加载自动驾驶状态
   *
   * 文件不存在时返回默认状态。
   *
   * @returns 当前自动驾驶状态
   */
  private async loadState(): Promise<AutopilotState> {
    const raw = await readJSONSafe(this.statePath, AutopilotStateSchema); // 读取并校验状态文件
    if (raw === null) return { ...DEFAULT_STATE, config: { ...DEFAULT_CONFIG } }; // 不存在则返回默认
    return raw; // 返回已有状态
  }

  /**
   * 持久化自动驾驶状态
   *
   * @param state - 要保存的状态
   */
  private async saveState(state: AutopilotState): Promise<void> {
    await ensureDir(path.join(this.projectRoot, QFLOW_DIR)); // 确保目录存在
    await writeJSON(this.statePath, state); // 原子写入状态文件
  }

  /**
   * 加载执行日志
   *
   * @returns 日志条目列表
   */
  private async loadLog(): Promise<AutopilotLogEntry[]> {
    const raw = await readJSONSafe(this.logPath, z.array(AutopilotLogEntrySchema)); // 读取并校验日志文件
    if (raw === null) return []; // 不存在则返回空数组
    return raw; // 返回日志列表
  }

  /**
   * 追加日志条目并持久化
   *
   * @param entry - 日志条目（不含 timestamp，自动填充）
   */
  /** 日志轮转上限（v15.0 R-4: 从全局常量取） */
  private static readonly MAX_LOG_ENTRIES = MAX_LOG_ENTRIES;

  private async appendLog(entry: Omit<AutopilotLogEntry, 'timestamp'>): Promise<void> {
    let logs = await this.loadLog(); // 加载现有日志
    const fullEntry: AutopilotLogEntry = { // 构造完整日志条目
      ...entry, // 展开传入字段
      timestamp: new Date().toISOString(), // 自动填充时间戳
    };
    logs.push(fullEntry); // 追加到日志列表

    // P3: 日志轮转 — 超过上限时截断旧日志
    if (logs.length > AutopilotEngine.MAX_LOG_ENTRIES) {
      const trimCount = logs.length - AutopilotEngine.MAX_LOG_ENTRIES; // 需要截断的条数
      logs = logs.slice(trimCount); // 保留最新的 MAX_LOG_ENTRIES 条
      log.debug(`[autopilot] 日志轮转: 截断了 ${trimCount} 条旧日志`); // 轮转日志
    }

    await ensureDir(path.join(this.projectRoot, QFLOW_DIR)); // 确保目录存在
    await writeJSON(this.logPath, logs); // 持久化日志
    log.debug(`[autopilot] ${entry.action}: ${entry.message}`); // 输出调试日志
  }

  /**
   * 令牌桶速率限制检查
   *
   * 简化版令牌桶算法：按时间间隔补充令牌，消耗令牌执行任务。
   *
   * @param config - 自动驾驶配置
   * @returns true 表示允许执行，false 表示需要等待
   */
  private checkRateLimit(config: AutopilotConfig): boolean {
    const now = Date.now(); // 当前时间
    const elapsed = now - this.lastTokenRefill; // 距上次补充的毫秒数
    const refills = Math.floor(elapsed / config.intervalMs); // 可补充次数

    if (refills > 0) { // 需要补充令牌
      this.tokenBucket = Math.min( // 补充但不超过上限
        this.tokenBucket + refills * config.tokensPerInterval,
        config.maxTokens,
      );
      this.lastTokenRefill = now; // 更新补充时间
    }

    if (this.tokenBucket >= 1) { // 有可用令牌
      this.tokenBucket -= 1; // 消耗一个令牌
      return true; // 允许执行
    }

    return false; // 无可用令牌，需要等待
  }

  /**
   * 等待令牌可用
   *
   * @param config - 自动驾驶配置
   */
  private async waitForToken(config: AutopilotConfig): Promise<void> {
    while (!this.checkRateLimit(config)) { // 循环检查令牌
      await this.appendLog({ action: 'rate_limit', message: `速率限制，等待 ${config.intervalMs}ms` }); // 记录限流日志
      await new Promise((resolve) => setTimeout(resolve, config.intervalMs)); // 等待一个间隔
    }
  }

  /**
   * 配置自动驾驶参数
   *
   * 合并传入的部分配置到现有配置中。
   *
   * @param config - 部分配置参数
   * @returns 更新后的完整配置
   */
  async configure(config: Partial<AutopilotConfig>): Promise<AutopilotConfig> {
    const state = await this.loadState(); // 加载当前状态

    // P5: 如果指定了预设，先应用预设的默认值
    if (config.preset && config.preset !== 'custom') {
      const presetDef = AUTOPILOT_PRESETS[config.preset]; // 查找预设定义
      if (presetDef) {
        if (presetDef.maxTasksPerRun !== undefined) state.config.maxTasksPerRun = presetDef.maxTasksPerRun; // 应用预设的最大任务数
        if (presetDef.loopMode !== undefined) state.config.loopMode = presetDef.loopMode; // 应用预设的循环模式
        if (state.config.verbose) { // 详细模式日志
          log.info(`[verbose] 应用预设 "${config.preset}": maxTasksPerRun=${presetDef.maxTasksPerRun}, loopMode=${presetDef.loopMode}, filter=${JSON.stringify(presetDef.filter)}`);
        }
      }
    }

    state.config = { ...state.config, ...config }; // 合并用户显式传入的配置（覆盖预设默认值）
    await this.saveState(state); // 持久化
    log.info(`自动驾驶配置已更新: ${JSON.stringify(state.config)}`); // 信息日志
    return state.config; // 返回更新后的配置
  }

  /**
   * 启动自动执行
   *
   * 读取下一任务并激活，记录日志和状态。
   * 不会阻塞——只执行一步，适合被外部循环调用。
   *
   * @returns 激活的任务，无可执行任务时返回 null
   */
  async start(): Promise<Task | null> {
    const state = await this.loadState(); // 加载状态

    if (state.status === 'running') { // 已在运行
      log.warn('自动驾驶已在运行中'); // 警告
      return null; // 不重复启动
    }

    if (state.status !== 'idle' && state.status !== 'paused' && state.status !== 'stopped') { // 非法状态
      throw new Error(`无法从 ${state.status} 状态启动自动驾驶`); // 抛出错误
    }

    state.status = 'running'; // 切换为运行中
    state.startedAt = new Date().toISOString(); // 记录启动时间
    state.consecutiveErrors = 0; // 重置连续错误计数
    state.pausedAt = null; // 清除暂停时间
    state.stoppedAt = null; // 清除停止时间

    // P5-P1-4: 详细模式 — 输出启动状态变更
    if (state.config.verbose) {
      log.info(`[verbose] 状态变更: ${state.status === 'running' ? 'idle' : state.status} → running, 预设=${state.config.preset ?? 'none'}`);
    }

    await this.saveState(state); // 持久化
    await this.appendLog({ action: 'start', message: '自动驾驶已启动' }); // 记录日志

    // v13.0 A-3: 写入 progress.txt 初始统计摘要
    try {
      const progressPath = path.join(this.projectRoot, QFLOW_DIR, 'progress.txt'); // 进度文件路径
      const allTasks = await this.taskManager.getAllTasks(); // 获取全部任务
      const doneCount = allTasks.filter(t => t.status === 'done').length; // 已完成数
      const progressContent = `[${new Date().toISOString()}] Autopilot 已启动\n已完成: ${doneCount}/${allTasks.length}\n错误数: 0\n状态: running\n`; // 进度内容
      await import('node:fs').then(fs => fs.promises.writeFile(progressPath, progressContent, 'utf-8')); // 写入文件
    } catch (e) {
      log.debug(`[autopilot] progress.txt 写入失败（非致命）: ${(e as Error).message}`); // 非致命错误
    }

    return this.executeNext(state); // 执行下一任务
  }

  /**
   * 执行下一个任务（内部方法）
   *
   * @param state - 当前状态
   * @returns 激活的任务或 null
   */
  private async executeNext(state: AutopilotState): Promise<Task | null> {
    if (state.status !== 'running') return null; // 非运行状态则跳过

    // 检查是否超过单次运行上限
    if (state.tasksCompleted >= state.config.maxTasksPerRun) { // 达到上限
      log.info(`已达到单次运行上限 ${state.config.maxTasksPerRun} 个任务`); // 信息日志

      if (state.config.loopMode) { // 循环模式
        state.tasksCompleted = 0; // 重置计数
        await this.appendLog({ action: 'loop_restart', message: '循环模式：重置任务计数，重新扫描' }); // 记录日志
      } else { // 非循环模式
        state.status = 'stopped'; // 停止
        state.stoppedAt = new Date().toISOString(); // 记录停止时间
        await this.saveState(state); // 持久化
        await this.appendLog({ action: 'stop', message: '达到单次运行上限，自动停止' }); // 记录日志
        return null; // 返回 null
      }
    }

    // 速率限制
    await this.waitForToken(state.config); // 等待令牌

    // 获取所有任务并选择下一个
    let allTasks = await this.taskManager.getAllTasks(); // 加载全部任务

    // P5-P1-3: 预设过滤 — 根据预设的 filter 条件筛选候选任务
    const presetName = state.config.preset; // 当前预设名称
    if (presetName && presetName !== 'custom') {
      const presetDef = AUTOPILOT_PRESETS[presetName]; // 获取预设定义
      if (presetDef?.filter) {
        const filterTags = presetDef.filter.tags; // 预设标签过滤条件
        const filterStatus = presetDef.filter.statusFilter; // 预设状态过滤条件

        if (filterTags && filterTags.length > 0) { // 存在标签过滤
          allTasks = allTasks.filter((t) => // 保留至少匹配一个标签的任务
            t.tags?.some((tag) => filterTags.includes(tag)),
          );
          if (state.config.verbose) { // 详细模式日志
            log.info(`[verbose] 预设 "${presetName}" 标签过滤: ${filterTags.join(',')} → 剩余 ${allTasks.length} 个候选任务`);
          }
        }

        if (filterStatus && filterStatus.length > 0) { // 存在状态过滤
          allTasks = allTasks.filter((t) => filterStatus.includes(t.status)); // 保留匹配状态的任务
          if (state.config.verbose) { // 详细模式日志
            log.info(`[verbose] 预设 "${presetName}" 状态过滤: ${filterStatus.join(',')} → 剩余 ${allTasks.length} 个候选任务`);
          }
        }
      }
    }

    const nextTask = selectNextTask(allTasks); // 选择下一任务

    // P5-P1-4: 详细模式 — 输出任务选择推理
    if (state.config.verbose) {
      if (nextTask) {
        log.info(`[verbose] 任务选择: 从 ${allTasks.length} 个候选中选中 ${nextTask.id} (${nextTask.title}), 优先级=${nextTask.priority ?? 'N/A'}, 状态=${nextTask.status}`);
      } else {
        log.info(`[verbose] 任务选择: 无可执行任务 (候选池 ${allTasks.length} 个)`);
      }
    }

    if (nextTask === null) { // 无可执行任务
      if (state.config.loopMode) { // 循环模式下检查是否还有非终态任务
        const hasNonTerminal = allTasks.some( // 是否存在非终态任务
          (t) => t.status !== 'done' && t.status !== 'cancelled',
        );
        if (hasNonTerminal) { // 有非终态任务但暂时无法执行
          log.info('循环模式：当前无可执行任务，等待依赖解锁'); // 信息日志
          return null; // 等待下次调用
        }
      }

      state.status = 'idle'; // 所有任务已处理，回到空闲
      await this.saveState(state); // 持久化
      await this.appendLog({ action: 'stop', message: '所有任务已处理，自动驾驶进入空闲' }); // 记录日志
      return null; // 返回 null
    }

    // 激活任务
    try {
      await this.appendLog({ // 记录任务开始
        action: 'task_begin',
        taskId: nextTask.id,
        message: `开始执行任务: ${nextTask.id} - ${nextTask.title}`,
      });

      const { task } = await this.taskManager.setStatus(nextTask.id, 'active'); // 将任务设为 active

      state.lastTaskId = task.id; // 更新最后任务 ID
      state.consecutiveErrors = 0; // 重置连续错误
      state.tasksCompleted += 1; // 递增完成计数
      await this.saveState(state); // 持久化

      await this.appendLog({ // v13.0 F-3: 修正日志动作标识（原为 task_done 与实际语义不符）
        action: 'task_begin',
        taskId: task.id,
        message: `任务 ${task.id} 已激活为 active`,
      });

      return task; // 返回激活的任务

    } catch (err) { // 执行出错
      const errorMsg = (err as Error).message; // 提取错误信息
      state.consecutiveErrors += 1; // 递增连续错误计数
      state.lastError = errorMsg; // 记录错误信息

      await this.appendLog({ // 记录任务错误
        action: 'task_error',
        taskId: nextTask.id,
        message: `任务 ${nextTask.id} 执行失败: ${errorMsg}`,
      });

      // 连续错误达到阈值，自动暂停
      if (state.consecutiveErrors >= state.config.maxConcurrentErrors) { // 超过阈值
        state.status = 'error'; // 切换为错误状态
        state.pausedAt = new Date().toISOString(); // 记录时间
        await this.saveState(state); // 持久化
        await this.appendLog({ // 记录自动暂停
          action: 'pause',
          message: `连续 ${state.consecutiveErrors} 次错误，自动暂停`,
        });
        log.error(`自动驾驶因连续 ${state.consecutiveErrors} 次错误自动暂停`); // 错误日志
      } else {
        await this.saveState(state); // 仅持久化状态
      }

      return null; // 返回 null
    }
  }

  /**
   * 暂停执行
   *
   * 将状态切换为 paused，记录暂停时间和日志。
   */
  async pause(): Promise<void> {
    const state = await this.loadState(); // 加载状态
    if (state.status !== 'running') { // 非运行状态
      throw new Error(`当前状态为 ${state.status}，无法暂停`); // 抛出错误
    }

    state.status = 'paused'; // 切换为暂停
    state.pausedAt = new Date().toISOString(); // 记录暂停时间
    await this.saveState(state); // 持久化
    await this.appendLog({ action: 'pause', message: '手动暂停自动驾驶' }); // 记录日志
    log.info('自动驾驶已暂停'); // 信息日志
  }

  /**
   * 恢复执行
   *
   * 从 paused 或 error 状态恢复到 running。
   *
   * @returns 恢复后执行的下一任务或 null
   */
  async resume(): Promise<Task | null> {
    const state = await this.loadState(); // 加载状态
    if (state.status !== 'paused' && state.status !== 'error') { // 非暂停/错误状态
      throw new Error(`当前状态为 ${state.status}，无法恢复`); // 抛出错误
    }

    state.status = 'running'; // 切换为运行中
    state.consecutiveErrors = 0; // 重置连续错误
    state.pausedAt = null; // 清除暂停时间
    await this.saveState(state); // 持久化
    await this.appendLog({ action: 'resume', message: '自动驾驶已恢复' }); // 记录日志
    log.info('自动驾驶已恢复'); // 信息日志

    return this.executeNext(state); // 执行下一任务
  }

  /**
   * 停止执行
   *
   * 将状态切换为 stopped，记录停止时间和日志。
   */
  async stop(): Promise<void> {
    const state = await this.loadState(); // 加载状态
    if (state.status === 'idle' || state.status === 'stopped') { // 已停止或空闲
      log.warn('自动驾驶未在运行中'); // 警告
      return; // 无需操作
    }

    state.status = 'stopped'; // 切换为停止
    state.stoppedAt = new Date().toISOString(); // 记录停止时间
    await this.saveState(state); // 持久化
    await this.appendLog({ action: 'stop', message: '手动停止自动驾驶' }); // 记录日志
    log.info('自动驾驶已停止'); // 信息日志
  }

  /**
   * 获取运行状态
   *
   * @returns 当前自动驾驶完整状态
   */
  async getStatus(): Promise<AutopilotState> {
    return this.loadState(); // 直接返回持久化的状态
  }

  /**
   * 获取执行日志
   *
   * @param limit - 返回的最大条目数，默认 100
   * @returns 最近的日志条目列表
   */
  async getLog(limit = 100): Promise<AutopilotLogEntry[]> {
    const logs = await this.loadLog(); // 加载全部日志
    return logs.slice(-limit); // 返回最后 limit 条
  }

  /**
   * 切换循环模式
   *
   * 循环模式下，所有任务完成后会重新扫描 pending 任务。
   *
   * @param enabled - 是否开启循环模式
   * @returns 更新后的循环模式状态
   */
  async loop(enabled: boolean): Promise<boolean> {
    const state = await this.loadState(); // 加载状态
    state.config.loopMode = enabled; // 更新循环模式
    await this.saveState(state); // 持久化
    log.info(`循环模式已${enabled ? '开启' : '关闭'}`); // 信息日志
    return state.config.loopMode; // 返回当前状态
  }

  /**
   * 单步执行
   *
   * 选择并执行下一个任务，完成后自动暂停。
   * 适合调试和逐步推进。
   *
   * @returns 执行结果，包含选中的任务和执行状态
   */
  async step(): Promise<{ task: Task | null; status: string }> {
    const state = await this.loadState(); // 加载状态

    // 获取下一任务
    const allTasks = await this.taskManager.getAllTasks(); // 获取全部任务
    const nextTask = selectNextTask(allTasks); // 选择下一任务

    if (!nextTask) { // 无可执行任务
      log.info('单步执行: 无可执行任务'); // 信息日志
      return { task: null, status: 'no_task' }; // 返回空
    }

    // v13.0 A-2: 依赖环路检测 — 检查候选任务是否与已激活任务形成循环依赖
    const activeTasks = allTasks.filter(t => t.status === 'active'); // 当前所有 active 任务
    const activeIds = new Set(activeTasks.map(t => t.id)); // active 任务 ID 集合
    if (nextTask.dependencies.some(depId => activeIds.has(depId))) { // 依赖了某个 active 任务
      const depActive = activeTasks.find(t => nextTask.dependencies.includes(t.id)); // 找到具体的 active 依赖
      if (depActive && depActive.dependencies.includes(nextTask.id)) { // 该 active 任务也依赖本任务 → 互锁
        log.warn(`[autopilot] 检测到循环依赖死锁: ${nextTask.id} ↔ ${depActive.id}，跳过`); // 记录警告
        return { task: null, status: 'cycle_deadlock' }; // 返回环路死锁状态
      }
    }

    // 激活任务
    await this.taskManager.setStatus(nextTask.id, 'active'); // 设为活跃
    log.info(`单步执行: 已激活任务 ${nextTask.id} - ${nextTask.title}`); // 信息日志

    // 记录日志
    await this.appendLog({
      action: 'task_begin',
      taskId: nextTask.id,
      message: `单步执行: ${nextTask.title}`,
    });

    // 更新状态 — 单步执行后自动暂停（P3-3 修复）
    state.lastTaskId = nextTask.id; // 记录当前任务
    state.tasksCompleted++; // 任务计数 +1
    state.status = 'paused'; // 单步执行后自动暂停
    state.pausedAt = new Date().toISOString(); // 记录暂停时间
    await this.saveState(state); // 持久化

    return { task: nextTask, status: 'paused' }; // 返回结果（状态为 paused）
  }

  /**
   * v13.0 A-5: 获取运行统计摘要
   *
   * 返回自动驾驶的运行统计数据，包括已完成数、总数、错误数、耗时、平均耗时。
   *
   * @returns 运行统计摘要对象
   */
  async getProgressSummary(): Promise<{
    completed: number;
    total: number;
    errors: number;
    elapsed: string;
    avgTimePerTask: string;
    status: AutopilotStatus;
  }> {
    const state = await this.loadState(); // 加载状态
    const allTasks = await this.taskManager.getAllTasks(); // 获取全部任务
    const total = allTasks.length; // 总任务数
    const completed = allTasks.filter(t => t.status === 'done').length; // 已完成任务数

    // 计算耗时
    let elapsedMs = 0; // 总耗时毫秒
    if (state.startedAt) { // 有启动时间
      const endTime = state.stoppedAt || state.pausedAt || new Date().toISOString(); // 结束时间取停止/暂停/当前
      elapsedMs = new Date(endTime).getTime() - new Date(state.startedAt).getTime(); // 时间差
    }
    const elapsedSec = Math.round(elapsedMs / 1000); // 转秒
    const avgMs = state.tasksCompleted > 0 ? Math.round(elapsedMs / state.tasksCompleted) : 0; // 平均每任务耗时

    return {
      completed, // 已完成任务数
      total, // 总任务数
      errors: state.consecutiveErrors, // 连续错误数
      elapsed: `${elapsedSec}s`, // 总耗时（秒）
      avgTimePerTask: `${avgMs}ms`, // 平均每任务耗时（毫秒）
      status: state.status, // 当前状态
    };
  }

  /**
   * 安全执行 git add + git commit
   *
   * 使用 execFile（非 exec/shell）防止命令注入攻击。
   * 先 git add 指定文件（或全部），再 git commit。
   *
   * @param message - 提交信息
   * @param files   - 可选的文件路径列表，为空时 add 全部（git add -A）
   * @returns git commit 的 stdout 和 stderr
   */
  async commitChanges(message: string, files?: string[]): Promise<{ stdout: string; stderr: string }> {
    const { execFile } = await import('node:child_process'); // 动态导入子进程模块
    const { promisify } = await import('node:util'); // 动态导入 promisify
    const execFileAsync = promisify(execFile); // 包装为 Promise

    const cwd = this.projectRoot; // 工作目录为项目根路径
    const timeout = GIT_TIMEOUT; // v15.0 R-4: Git 超时从常量取

    // 1. git add：指定文件或全部
    if (files && files.length > 0) { // 指定了文件列表
      await execFileAsync('git', ['add', '--', ...files], { cwd, timeout }); // 安全 add 指定文件
      log.info(`[autopilot] git add: ${files.length} 个文件`); // 信息日志
    } else { // 未指定文件，add 全部
      await execFileAsync('git', ['add', '-A'], { cwd, timeout }); // add 全部变更
      log.info('[autopilot] git add -A'); // 信息日志
    }

    // 2. git commit：使用 -m 参数传递消息（execFile 参数列表形式，不经过 shell）
    const { stdout, stderr } = await execFileAsync('git', ['commit', '-m', message], { cwd, timeout }); // 安全 commit
    log.info(`[autopilot] git commit: ${message}`); // 信息日志
    return { stdout, stderr }; // 返回执行结果
  }
}
