/**
 * Token 消耗统计追踪器（v10.0 + v13.0 P-5/P-6 持久化增强）
 *
 * 单例模式，记录每次 AI 调用的 token 消耗。
 * 支持按 model/role 聚合统计，最大保留 1000 条记录（轮转淘汰旧记录）。
 * v13.0: 新增 flush(projectRoot) 持久化到磁盘 + loadFromDisk(projectRoot) 恢复 + beforeExit 自动 flush。
 *
 * 函数/类列表:
 * - TokenRecord       单条 token 记录结构
 * - TokenStats        统计结果结构
 * - TokenTracker      追踪器类（单例）
 * - tokenTracker      全局单例导出
 */

import { log } from '../utils/logger.js'; // 日志工具
import { promises as fs } from 'node:fs'; // 文件系统
import path from 'node:path'; // 路径工具
import { writeJSON } from '../utils/file-io.js'; // v14.0 L-1: 原子写入工具

/** 单条 token 消耗记录 */
export interface TokenRecord {
  timestamp: string;       // ISO 8601 时间戳
  model: string;           // 模型名称
  role: string;            // AI 调用角色（main/research/fallback）
  promptTokens: number;    // 输入 token 数
  completionTokens: number; // 输出 token 数
  totalTokens: number;     // 总 token 数
  tier?: string;           // v16.0 C-7: 调用来源 tier（core/standard/extra/all）
}

/** Token 统计结果 */
export interface TokenStats {
  totalTokens: number;                    // 总 token 消耗
  callCount: number;                      // 调用次数
  byModel: Record<string, number>;        // 按模型聚合
  byRole: Record<string, number>;         // 按角色聚合
  avgTokensPerCall: number;               // 平均每次调用 token 数
  firstCallAt: string | null;             // 首次调用时间
  lastCallAt: string | null;              // 最近调用时间
}

/** 记录上限 */
const MAX_RECORDS = 1000; // 超过后轮转淘汰旧记录
/** 轮转保留数 */
const ROTATE_KEEP = 500; // 轮转时保留最近 500 条

/**
 * Token 消耗追踪器
 *
 * 记录每次 AI 调用的 token 消耗，支持按 model/role 聚合统计。
 */
class TokenTracker {
  /** 记录列表 */
  private records: TokenRecord[] = [];

  /**
   * 记录一次 AI 调用的 token 消耗
   * @param entry - token 记录
   */
  record(entry: TokenRecord): void {
    this.records.push(entry); // 追加记录
    if (this.records.length > MAX_RECORDS) { // 超过上限
      this.records = this.records.slice(-ROTATE_KEEP); // 轮转淘汰旧记录
      log.debug(`Token 记录轮转: 保留最近 ${ROTATE_KEEP} 条`);
    }
  }

  /**
   * 获取 token 统计信息
   * @returns 聚合统计结果
   */
  getStats(): TokenStats {
    const byModel: Record<string, number> = {}; // 按模型聚合
    const byRole: Record<string, number> = {}; // 按角色聚合
    let total = 0; // 总 token

    for (const r of this.records) { // 遍历所有记录
      total += r.totalTokens; // 累加总量
      byModel[r.model] = (byModel[r.model] || 0) + r.totalTokens; // 按模型累加
      byRole[r.role] = (byRole[r.role] || 0) + r.totalTokens; // 按角色累加
    }

    return {
      totalTokens: total,
      callCount: this.records.length,
      byModel,
      byRole,
      avgTokensPerCall: this.records.length > 0 ? Math.round(total / this.records.length) : 0,
      firstCallAt: this.records.length > 0 ? this.records[0].timestamp : null,
      lastCallAt: this.records.length > 0 ? this.records[this.records.length - 1].timestamp : null,
    };
  }

  /**
   * 重置所有记录
   */
  reset(): void {
    this.records = []; // 清空记录
    log.debug('Token 记录已重置');
  }

  /**
   * 获取原始记录列表（用于测试）
   * @returns 记录列表的浅拷贝
   */
  getRecords(): TokenRecord[] {
    return [...this.records]; // 返回浅拷贝，避免外部修改
  }

  /**
   * v16.0 C-7: 按 tier 分组统计 token 消耗
   * @returns 每个 tier 的 token 总量和调用次数
   */
  getStatsByTier(): Record<string, { totalTokens: number; callCount: number }> {
    const byTier: Record<string, { totalTokens: number; callCount: number }> = {}; // 结果映射
    for (const r of this.records) {
      const tier = r.tier || 'unknown'; // 未设置 tier 的归入 unknown
      if (!byTier[tier]) byTier[tier] = { totalTokens: 0, callCount: 0 }; // 初始化
      byTier[tier].totalTokens += r.totalTokens; // 累加 token
      byTier[tier].callCount += 1; // 累加调用次数
    }
    return byTier; // 返回分组统计
  }

  /**
   * v13.0 P-5: 持久化记录到磁盘
   * 写入 .qflow/token-stats.json
   * @param projectRoot - 项目根目录
   */
  async flush(projectRoot: string): Promise<void> {
    if (this.records.length === 0) return; // 无记录则跳过
    const filePath = path.join(projectRoot, '.qflow', 'token-stats.json'); // 持久化路径
    try {
      // 读取已有记录（如果存在）
      let existing: TokenRecord[] = []; // 磁盘上的已有记录
      try {
        const raw = await fs.readFile(filePath, 'utf-8'); // 读取文件
        const parsed = JSON.parse(raw); // 解析 JSON
        if (Array.isArray(parsed.records)) existing = parsed.records; // 提取记录列表
      } catch (e) { log.debug('Token 文件读取失败: ' + (e instanceof Error ? e.message : String(e))); } // v22.0 P1-6

      // 合并去重（按 timestamp 去重）
      const seen = new Set(existing.map(r => r.timestamp)); // 已有时间戳集合
      const merged = [...existing]; // 从已有记录开始
      for (const r of this.records) {
        if (!seen.has(r.timestamp)) { // 未重复
          merged.push(r); // 追加新记录
          seen.add(r.timestamp); // 标记
        }
      }

      // 限制总量（保留最近 MAX_RECORDS 条）
      const trimmed = merged.length > MAX_RECORDS ? merged.slice(-MAX_RECORDS) : merged; // 裁剪

      // v14.0 L-1: 使用 writeJSON 保证原子写入 + 加锁，替代原 fs.writeFile
      await writeJSON(filePath, { version: 1, records: trimmed, updatedAt: new Date().toISOString() });
      log.debug(`Token 记录已持久化: ${trimmed.length} 条 → ${filePath}`);
    } catch (e) {
      log.debug(`Token 持久化失败: ${(e as Error).message}`); // 错误不抛出，仅记录日志
    }
  }

  /**
   * v13.0 P-5: 从磁盘加载历史记录
   * @param projectRoot - 项目根目录
   */
  async loadFromDisk(projectRoot: string): Promise<number> {
    const filePath = path.join(projectRoot, '.qflow', 'token-stats.json'); // 持久化路径
    try {
      const raw = await fs.readFile(filePath, 'utf-8'); // 读取文件
      const parsed = JSON.parse(raw); // 解析 JSON
      if (Array.isArray(parsed.records)) {
        const loaded = parsed.records as TokenRecord[]; // 类型断言
        // 合并到内存（避免重复）
        const seen = new Set(this.records.map(r => r.timestamp)); // 内存中已有时间戳
        let count = 0; // 新加载计数
        for (const r of loaded) {
          if (!seen.has(r.timestamp)) { // 未重复
            this.records.push(r); // 追加
            count++; // 计数
          }
        }
        log.debug(`Token 历史加载: ${count} 条新记录（磁盘共 ${loaded.length} 条）`);
        return count; // 返回新加载数
      }
    } catch (e) { log.debug('Token 历史读取失败: ' + (e instanceof Error ? e.message : String(e))); } // v22.0 P1-7
    return 0; // 无记录加载
  }

  /** v13.0 P-6: 获取当前绑定的 projectRoot（用于 beforeExit flush） */
  private _boundRoot: string | null = null; // 绑定的项目根目录

  /**
   * v13.0 P-6: 绑定项目根目录（用于 beforeExit 自动 flush）
   * @param projectRoot - 项目根目录
   */
  bindProjectRoot(projectRoot: string): void {
    this._boundRoot = projectRoot; // 绑定
    log.debug(`TokenTracker 已绑定项目: ${projectRoot}`);
  }

  /** v13.0 P-6: 获取绑定的项目根目录 */
  getBoundRoot(): string | null {
    return this._boundRoot; // 返回绑定的根目录
  }
}

/** 全局单例 */
export const tokenTracker = new TokenTracker();

/** v13.0 P-6: 进程退出前自动 flush（v15.0 R-12: 改用 process.once 避免 listener 泄露） */
process.once('beforeExit', async () => {
  const root = tokenTracker.getBoundRoot(); // 获取绑定的项目根目录
  if (root && tokenTracker.getRecords().length > 0) { // 有绑定且有记录
    try {
      await tokenTracker.flush(root); // 自动持久化
    } catch (e) {
      log.debug(`beforeExit flush 失败: ${(e as Error).message}`); // 错误不中断退出
    }
  }
});
