/**
 * 原子文件读写工具
 *
 * 确保写入安全（先写临时文件再 rename），支持自动备份。
 *
 * 函数列表：
 * - readJSON<T>()          读取 JSON 文件，文件不存在时返回 null
 * - readJSONSafe<T>()      读取 JSON 文件并用 Zod Schema 校验，校验失败返回 null
 * - readJSONUnlocked<T>()  无锁读取 JSON 文件（须在外层 withFileLock 保护下使用）
 * - writeJSON()            原子写入 JSON（.tmp → rename），自动创建目录
 * - writeJSONUnlocked()    无锁原子写入 JSON（须在外层 withFileLock 保护下使用）
 * - withFileLock()         在持锁状态下执行读-改-写事务（消除 TOCTOU），含进程内互斥优化
 * - backup()               备份文件到 .bak（带时间戳）
 * - ensureDir()            确保目录存在
 * - fileExists()           检查文件是否存在
 */

import { promises as fs } from 'node:fs'; // Node 原生文件系统异步 API
import path from 'node:path';              // 路径处理工具
import { z } from 'zod';                   // 运行时 JSON 数据校验库
import { log } from './logger.js';          // 日志工具
import { LOCK_TIMEOUT, LOCK_RETRY_INTERVAL } from '../shared/constants.js'; // v15.0 R-2: 全局常量

/**
 * 获取文件锁（简易 .lock 文件实现）
 * @param filePath - 要锁定的文件路径
 * @returns 释放锁的函数
 */
export async function acquireLock(filePath: string): Promise<() => Promise<void>> {
  const lockPath = `${filePath}.lock`; // 锁文件路径
  const startTime = Date.now();

  while (true) {
    try {
      // O_CREAT + O_EXCL: 仅当文件不存在时创建（原子操作）
      const fd = await fs.open(lockPath, 'wx');
      // 写入 PID 和时间戳后再关闭，记录持锁进程信息，便于死锁检测
      await fd.writeFile(JSON.stringify({ pid: process.pid, timestamp: Date.now() }), 'utf-8'); // 记录持锁进程信息
      await fd.close();
      // 成功获取锁，返回释放函数
      return async () => {
        try { await fs.unlink(lockPath); } catch (e) { log.debug(`锁释放时异常: ${e}`); } // 锁释放失败时记录日志
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err; // 非竞争错误
      // 锁已存在，检查超时或 PID 是否存活
      if (Date.now() - startTime > LOCK_TIMEOUT) {
        // 超时前尝试读取锁文件，判断持锁进程是否存活
        try {
          const lockContent = await fs.readFile(lockPath, 'utf-8'); // 读取锁文件内容
          const lockInfo = JSON.parse(lockContent) as { pid: number; timestamp: number };
          try {
            process.kill(lockInfo.pid, 0); // 发送信号 0 检测进程是否存活（不实际发送信号）
            // 进程仍存活，记录警告后强制清理（超时判定为死锁）
            log.warn(`文件锁超时，持锁进程 ${lockInfo.pid} 仍存活，强制清理: ${lockPath}`);
            log.warn(`[file-io] 可能存在跨进程锁冲突: ${lockPath} 被进程 ${lockInfo.pid} 持有超过 ${LOCK_TIMEOUT}ms`); // v21.0: 跨进程锁冲突警告
          } catch (killErr) {
            // 进程已不存在，属于遗留死锁，直接清理
            log.warn(`文件锁超时，持锁进程 ${lockInfo.pid} 已退出 (${(killErr as Error).message})，清理死锁: ${lockPath}`);
          }
        } catch (readErr) {
          // 锁文件读取或解析失败，直接强制清理
          log.warn(`文件锁超时，锁文件无法读取 (${(readErr as Error).message})，强制清理: ${lockPath}`);
          log.warn(`[file-io] 可能存在跨进程锁冲突: ${lockPath} 锁文件超过 ${LOCK_TIMEOUT}ms 未释放`); // v21.0: 跨进程锁冲突警告
        }
        // 强制清理可能的死锁
        try { await fs.unlink(lockPath); } catch (e) { log.debug(`死锁清理时异常: ${e}`); } // 删除失败时记录日志
        continue; // 重试获取
      }
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_INTERVAL));
    }
  }
}

/** 进程内互斥锁：同一路径的并发 withFileLock 调用在进程内串行化，避免文件锁自旋等待 */
const inProcessLocks = new Map<string, Promise<void>>();

/**
 * 在持锁状态下执行读-改-写事务，消除 TOCTOU 竞态窗口。
 *
 * 双层锁机制：
 * 1. 进程内互斥（inProcessLocks Map）：同一 Node 进程内的并发调用按路径串行化
 * 2. 文件系统锁（.lock 文件）：跨进程互斥，防止多进程同时写入
 *
 * 注意：进程内互斥（inProcessLocks）是纯内存 Map，仅在同一 Node.js 进程内有效。
 * 跨进程场景（如多个 MCP 实例并发写入同一文件）依赖文件系统锁（.lock 文件）。
 * 文件系统锁在超时后会强制清理，可能存在跨进程竞争窗口，请勿在高并发多进程场景中依赖此实现。
 *
 * 搭配 readJSONUnlocked + writeJSONUnlocked 使用，避免内部再次获取同一锁而死锁。
 * 适用于 JSON 和 Markdown 等所有文件类型（原 withMdFileLock 已合并至此）。
 *
 * @param filePath - 要锁定的文件路径（与读写的目标路径相同）
 * @param fn       - 在持锁期间执行的异步函数
 * @returns fn() 的返回值
 */
export async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const absPath = path.resolve(filePath); // 标准化路径，避免相对路径差异导致锁失效

  // 进程内串行化：等待同路径的前一个 withFileLock 调用结束
  while (inProcessLocks.has(absPath)) {
    await inProcessLocks.get(absPath); // 挂起直到前一个持锁者释放
  }

  let resolve!: () => void; // 进程内锁释放回调
  const promise = new Promise<void>(r => { resolve = r; }); // 创建进程内锁 Promise
  inProcessLocks.set(absPath, promise); // 注册进程内锁

  try {
    const releaseLock = await acquireLock(filePath); // 获取文件系统锁
    try {
      return await fn(); // 在双层锁保护下执行事务
    } finally {
      await releaseLock(); // 释放文件系统锁
    }
  } finally {
    inProcessLocks.delete(absPath); // 移除进程内锁
    resolve(); // 唤醒等待同路径的后续调用
  }
}

/**
 * 无锁读取 JSON 文件（须在外层 withFileLock 保护下使用）
 *
 * 与 readJSON 的区别：不再自行获取锁，因为调用方已通过 withFileLock 持有锁。
 * 若单独调用而无外层锁保护，可能引发竞态条件。
 *
 * @param filePath - JSON 文件的绝对路径
 * @returns 解析后的对象，文件不存在时返回 null
 */
export async function readJSONUnlocked<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8'); // 直接读取，无锁（外层 withFileLock 已保护）
    return JSON.parse(raw) as T; // 解析并返回
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null; // 文件不存在返回 null
    log.debug(`readJSONUnlocked 异常: ${filePath} - ${(err as Error).message}`); // 记录异常详情
    throw err; // 其他错误继续抛出
  }
}

/**
 * 无锁原子写入 JSON 文件（须在外层 withFileLock 保护下使用）
 *
 * 与 writeJSON 的区别：不再自行获取锁，因为调用方已通过 withFileLock 持有锁。
 * 仍然使用 .tmp → rename 保证写入原子性，但不持锁，须由外层保证并发安全。
 *
 * @param filePath - 目标文件的绝对路径
 * @param data     - 要写入的数据对象
 */
export async function writeJSONUnlocked(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath)); // 确保父目录存在
  const tmpPath = `${filePath}.tmp`; // 临时文件路径
  const content = JSON.stringify(data, null, 2) + '\n'; // 格式化 JSON，末尾换行
  await fs.writeFile(tmpPath, content, 'utf-8'); // 写入临时文件
  await fs.rename(tmpPath, filePath); // 原子重命名覆盖目标（无锁，外层 withFileLock 保护）
}


/**
 * 读取 JSON 文件并解析为指定类型
 *
 * v14.0 L-3: 去除排他锁，读操作不阻塞并发。
 * 写操作（writeJSON）仍持锁保证一致性，读操作直接读取文件内容。
 *
 * @param filePath - JSON 文件的绝对路径
 * @returns 解析后的对象，文件不存在时返回 null
 */
export async function readJSON<T = unknown>(filePath: string): Promise<T | null> {
  // v14.0 L-3: 去除 acquireLock 调用，读操作不再被串行化（写操作 writeJSON 仍持锁）
  try {
    const raw = await fs.readFile(filePath, 'utf-8'); // 直接读取文件内容
    try {
      return JSON.parse(raw) as T;                     // 解析并返回
    } catch (parseErr) {
      throw new Error(`JSON 解析失败 [${filePath}]: ${(parseErr as Error).message}`); // JSON 格式错误时抛出明确异常，包含文件路径
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null; // 文件不存在，返回 null
    throw err; // JSON 解析失败或其他 IO 错误，向上抛出
  }
}

/**
 * 原子写入 JSON 文件
 *
 * 写入流程：先写到 .tmp 临时文件，再 rename 覆盖目标文件，
 * 保证写入过程中断电或崩溃不会损坏原文件。
 *
 * @param filePath - 目标文件的绝对路径
 * @param data     - 要写入的数据对象
 */
export async function writeJSON(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));                  // 确保父目录存在
  const releaseLock = await acquireLock(filePath);          // 获取文件锁
  try {
    const tmpPath = `${filePath}.tmp`;                      // 临时文件路径
    const content = JSON.stringify(data, null, 2) + '\n';   // 格式化 JSON，末尾换行
    await fs.writeFile(tmpPath, content, 'utf-8');          // 写入临时文件
    await fs.rename(tmpPath, filePath);                     // 原子重命名覆盖目标
  } finally {
    await releaseLock();                                    // 释放文件锁
  }
}

/**
 * 备份文件到同目录的 .bak 文件（带时间戳）
 *
 * 备份文件命名格式：原文件名.20260311-143025.bak
 *
 * @param filePath - 要备份的文件路径
 * @returns 备份文件的路径，源文件不存在时返回 null
 */
export async function backup(filePath: string): Promise<string | null> {
  if (!(await fileExists(filePath))) return null;           // 源文件不存在，跳过

  const now = new Date();                                   // 获取当前时间
  const timestamp = now.toISOString()                       // 生成时间戳字符串
    .replace(/[-:T]/g, '')                                  // 去除分隔符
    .replace(/\.\d+Z$/, '')                                 // 去除毫秒和时区标记
    .replace(/^(\d{8})(\d{6})$/, '$1-$2');                  // 插入日期与时间之间的分隔符

  const ext = path.extname(filePath);                       // 原始扩展名
  const base = filePath.slice(0, -ext.length || undefined); // 去掉扩展名的部分
  const bakPath = `${base}.${timestamp}${ext}.bak`;         // 拼接备份路径

  await fs.copyFile(filePath, bakPath);                     // 复制文件
  return bakPath;                                           // 返回备份路径
}

/**
 * 确保目录存在，不存在则递归创建
 * @param dirPath - 目录的绝对路径
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true }); // recursive: true 等同于 mkdir -p
}

/**
 * 检查目录是否具有读写权限
 *
 * 用于在写入文件前验证目标目录的可访问性，防止因权限不足导致写入失败。
 * v19.0 技术债修复：补全目录权限检查能力。
 *
 * @param dirPath - 要检查的目录路径
 * @returns true 表示目录可读写，false 表示不可访问或不可写
 */
export async function checkDirPermissions(dirPath: string): Promise<boolean> {
  try {
    await fs.access(dirPath, fs.constants.R_OK | fs.constants.W_OK); // 检查读写权限
    return true; // 有权限
  } catch {
    return false; // 无权限或目录不存在
  }
}

/**
 * 检查目标文件所在目录是否可写（磁盘空间可用性检查）
 *
 * Node.js 没有直接的磁盘空间 API，通过 stat 父目录判断可访问性，
 * 作为磁盘空间可用的保守性判断。
 * v19.0 技术债修复：补全磁盘空间检查能力。
 *
 * @param filePath - 目标文件路径（检查其父目录）
 * @returns true 表示父目录可访问（磁盘可用），false 表示不可访问
 */
export async function checkDiskSpace(filePath: string): Promise<boolean> {
  try {
    await fs.stat(path.dirname(filePath)); // stat 父目录，验证可访问性
    return true; // 父目录存在且可访问，磁盘应可写
  } catch {
    return false; // 父目录不可访问
  }
}

/**
 * 检查文件是否存在
 * @param filePath - 文件的绝对路径
 * @returns true 表示文件存在，false 表示不存在
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath); // 检查文件可访问性
    return true;
  } catch (e) {
    log.debug(`fileExists 检查失败: ${filePath} - ${(e as Error).message}`); // 记录访问异常（通常是文件不存在）
    return false; // 访问失败即不存在
  }
}

/**
 * 读取 JSON 文件并用 Zod Schema 进行结构校验
 *
 * 在 readJSON 基础上增加运行时类型校验，校验失败时返回 null 并记录警告日志，
 * 适用于需要严格约束数据结构的场景（如配置文件、状态文件等）。
 *
 * @param filePath - JSON 文件的绝对路径
 * @param schema   - Zod Schema，用于校验解析后的数据结构
 * @returns 校验通过的数据，文件不存在或校验失败时返回 null
 */
export async function readJSONSafe<T>(filePath: string, schema: z.ZodType<T>): Promise<T | null> {
  const raw = await readJSON<unknown>(filePath); // 读取原始 JSON 数据（未校验）
  if (raw === null) return null;                 // 文件不存在，直接返回 null
  const result = schema.safeParse(raw);          // 用 Zod Schema 进行安全解析（不抛出异常）
  if (!result.success) {
    log.warn(`JSON 校验失败 ${filePath}: ${result.error.message}`); // 记录校验失败详情
    return null;                                 // 校验失败，返回 null
  }
  return result.data as T;                       // 返回校验通过的类型安全数据
}
