/**
 * WatchEngine - 文件监控引擎 (v18.0)
 *
 * 基于 fs.watch + 防抖 + 环形缓冲区，实时监控 .qflow/ 目录变更。
 * 用于检测 tasks.json 等文件的外部修改，触发状态刷新。
 *
 * 函数列表：
 * - WatchEngine.start       : 启动文件监控，监听 .qflow/ 目录
 * - WatchEngine.stop        : 停止监控，释放资源
 * - WatchEngine.getEvents   : 获取指定 ID 之后的事件列表
 * - WatchEngine.isRunning   : 检查监控是否运行中
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { WATCH_DEBOUNCE_MS, WATCH_MAX_EVENTS } from '../shared/constants.js';
import { QFLOW_DIR } from '../shared/tool-utils.js';
import { log } from '../utils/logger.js';

/** 文件变更事件 */
export interface WatchEvent {
  id: number;              // 自增事件 ID
  timestamp: number;       // 事件时间戳（毫秒）
  type: 'change' | 'rename'; // 事件类型
  filename: string;        // 触发变更的文件名
}

/** 文件监控引擎 */
export class WatchEngine {
  private watcher: fs.FSWatcher | null = null;   // fs.watch 实例
  private events: WatchEvent[] = [];              // 环形缓冲区
  private eventId = 0;                            // 自增事件 ID 计数器
  private debounceTimer: ReturnType<typeof setTimeout> | null = null; // 防抖定时器
  private projectRoot: string = '';               // 项目根目录
  private pendingEvents: Array<{ type: string; filename: string }> = []; // 防抖期间暂存的原始事件

  /**
   * 启动文件监控
   * 监听 .qflow/ 目录下的所有文件变更，使用防抖合并高频事件
   * @param projectRoot - 项目根目录绝对路径
   */
  start(projectRoot: string): void {
    if (this.watcher) {                           // 防止重复启动
      log.warn('WatchEngine 已在运行中，忽略重复启动');
      return;
    }

    this.projectRoot = projectRoot;               // 保存项目根目录
    const watchDir = path.join(projectRoot, QFLOW_DIR); // 监控目标目录

    try {
      this.watcher = fs.watch(watchDir, { recursive: true }, (eventType, filename) => {
        const type = eventType === 'rename' ? 'rename' : 'change'; // 标准化事件类型
        const fname = filename || 'unknown';      // 文件名兜底
        this.pendingEvents.push({ type, filename: fname }); // 暂存到待处理队列

        // 防抖：在 WATCH_DEBOUNCE_MS 内合并多个事件
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);       // 重置定时器
        }
        this.debounceTimer = setTimeout(() => {
          this.flushPendingEvents();              // 批量写入环形缓冲区
          this.debounceTimer = null;              // 清空定时器引用
        }, WATCH_DEBOUNCE_MS);
      });

      this.watcher.on('error', (err) => {
        log.error(`WatchEngine 错误: ${err.message}`); // 记录错误
      });

      log.info(`WatchEngine 已启动: 监控 ${watchDir}`);
    } catch (err) {
      log.error(`WatchEngine 启动失败: ${(err as Error).message}`);
      this.watcher = null;                        // 确保失败后状态干净
    }

    // v19.0 技术债修复：进程退出时自动清理文件监控资源，防止进程退出后 watcher 泄漏
    const cleanup = () => { this.stop(); };       // 统一清理函数
    process.once('exit', cleanup);                // 进程正常退出时清理
    process.once('SIGINT', cleanup);              // Ctrl+C 中断时清理
    process.once('SIGTERM', cleanup);             // kill 信号时清理
  }

  /**
   * 停止文件监控
   * 关闭 watcher、清除定时器、刷新待处理事件
   */
  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);           // 清除防抖定时器
      this.debounceTimer = null;
    }
    if (this.watcher) {
      this.watcher.close();                       // 关闭文件监控器
      this.watcher = null;
    }
    this.flushPendingEvents();                    // 刷新剩余待处理事件
    log.info('WatchEngine 已停止');
  }

  /**
   * 获取事件列表
   * @param since - 可选，返回该 ID 之后的事件；不传则返回全部事件
   * @returns 符合条件的事件数组
   */
  getEvents(since?: number): WatchEvent[] {
    if (since === undefined) {
      return [...this.events];                    // 返回全部事件的副本
    }
    return this.events.filter(e => e.id > since); // 返回 ID 大于 since 的事件
  }

  /**
   * 检查监控是否运行中
   * @returns true 表示正在监控
   */
  isRunning(): boolean {
    return this.watcher !== null;                 // watcher 非空即运行中
  }

  /**
   * 将待处理事件批量写入环形缓冲区
   * 超出 WATCH_MAX_EVENTS 时淘汰最早的事件
   */
  private flushPendingEvents(): void {
    for (const raw of this.pendingEvents) {       // 逐个处理暂存事件
      this.eventId++;                             // 递增事件 ID
      const event: WatchEvent = {
        id: this.eventId,                         // 唯一 ID
        timestamp: Date.now(),                    // 当前时间戳
        type: raw.type as 'change' | 'rename',   // 事件类型
        filename: raw.filename,                   // 文件名
      };
      this.events.push(event);                    // 追加到缓冲区
    }
    this.pendingEvents = [];                      // 清空暂存队列

    // 环形缓冲区溢出处理：保留最新的 WATCH_MAX_EVENTS 条
    if (this.events.length > WATCH_MAX_EVENTS) {
      this.events = this.events.slice(this.events.length - WATCH_MAX_EVENTS);
    }
  }
}
