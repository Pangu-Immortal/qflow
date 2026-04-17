/**
 * TDD Autopilot 引擎 (v17.0)
 *
 * 实现测试驱动开发的自动化循环：test → write → implement → verify → commit。
 * 引擎负责状态管理、命令执行、阶段流转和持久化，AI 辅助阶段（write/implement）
 * 仅返回指令文本，由宿主 LLM 完成代码生成。
 *
 * 函数列表：
 * - TddEngine.constructor    : 初始化引擎，设置项目根目录和空闲状态
 * - TddEngine.loadState      : 从 .qflow/tdd-state.json 加载持久化状态
 * - TddEngine.saveState      : 将当前状态写入 .qflow/tdd-state.json
 * - TddEngine.tddStep        : 执行单个 TDD 阶段（test/write/implement/verify/commit）
 * - TddEngine.tddLoop        : 执行完整 TDD 循环，支持多轮迭代直到验证通过或达到上限
 * - TddEngine.getState       : 获取当前引擎状态的只读快照
 * - TddEngine.reset          : 重置引擎状态为空闲
 * - runCommand               : 内部工具函数，执行 shell 命令并捕获输出
 */

import {
  TDD_MAX_ITERATIONS,
  TDD_TEST_TIMEOUT,
  TDD_VERIFY_TIMEOUT,
  TDD_PHASES,
} from '../shared/constants.js';
import { log } from '../utils/logger.js';
import { readJSONSafe, writeJSON, ensureDir } from '../utils/file-io.js';
import { QFLOW_DIR } from '../shared/tool-utils.js';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';


// ─── 类型定义 ────────────────────────────────────────────────

/** TDD 阶段类型，从常量数组推导 */
export type TddPhase = (typeof TDD_PHASES)[number];

/** TDD 预设接口 (v18.0) */
export interface TddPreset {
  name: string;             // 预设名称
  description: string;      // 预设描述
  phases: string[];         // 自定义阶段序列
  commands: Record<string, string>; // 每阶段默认命令
}

/** 内置 TDD 预设 (v18.0) */
export const TDD_PRESETS: Record<string, TddPreset> = {
  default: { name: 'default', description: '标准TDD循环', phases: ['test', 'write', 'implement', 'verify', 'commit'], commands: {} },
  'test-coverage': { name: 'test-coverage', description: '覆盖率驱动', phases: ['test', 'coverage', 'implement', 'verify', 'commit'], commands: { coverage: 'npm run test:coverage' } },
  linting: { name: 'linting', description: 'Lint修复循环', phases: ['lint', 'fix', 'verify', 'commit'], commands: { lint: 'npm run lint', fix: 'npm run lint:fix' } },
  duplication: { name: 'duplication', description: '重复代码消除', phases: ['detect', 'refactor', 'verify', 'commit'], commands: { detect: 'npx jscpd src/' } },
  entropy: { name: 'entropy', description: '代码熵降低', phases: ['analyze', 'simplify', 'verify', 'commit'], commands: { analyze: 'npx complexity-report src/' } },
};

/** TDD 配置接口 */
export interface TddConfig {
  testCommand: string;      // 测试命令，如 "npm test"
  taskId: string;           // 关联任务 ID
  maxIterations?: number;   // 最大迭代次数，默认 TDD_MAX_ITERATIONS
  autoCommit?: boolean;     // 是否自动提交，默认 false
  presetName?: string;      // v18.0: 预设名称，使用预设的阶段序列
}

/** 单步执行结果 */
export interface TddStepResult {
  phase: TddPhase;          // 当前阶段
  success: boolean;         // 是否成功
  output: string;           // 输出内容
  duration: number;         // 耗时毫秒
}

/** TDD 运行状态 */
export interface TddState {
  taskId: string;           // 关联任务 ID
  currentPhase: TddPhase;  // 当前阶段
  iteration: number;        // 当前迭代次数
  maxIterations: number;    // 最大迭代次数
  results: TddStepResult[]; // 历史步骤结果
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed'; // 运行状态
  startedAt: string | null; // 启动时间
  completedAt: string | null; // 完成时间
}

// ─── Zod Schema（用于 readJSONSafe 校验） ────────────────────

const TddStepResultSchema = z.object({
  phase: z.enum(TDD_PHASES),                    // 阶段枚举校验
  success: z.boolean(),                          // 布尔值校验
  output: z.string(),                            // 字符串校验
  duration: z.number(),                          // 数值校验
});

const TddStateSchema = z.object({
  taskId: z.string(),                            // 任务 ID
  currentPhase: z.enum(TDD_PHASES),              // 当前阶段
  iteration: z.number(),                         // 迭代次数
  maxIterations: z.number(),                     // 最大迭代次数
  results: z.array(TddStepResultSchema),         // 历史结果数组
  status: z.enum(['idle', 'running', 'paused', 'completed', 'failed']), // 状态枚举
  startedAt: z.string().nullable(),              // 可空时间戳
  completedAt: z.string().nullable(),            // 可空时间戳
});

// ─── 内部工具 ────────────────────────────────────────────────

const execFileAsync = promisify(execFile); // 将 execFile 转为 Promise 版本

/** 状态文件名常量 */
const STATE_FILE = 'tdd-state.json'; // 持久化文件名

/**
 * 执行 shell 命令并捕获输出
 * @param cmd - 完整命令字符串
 * @param timeoutMs - 超时毫秒数
 * @returns stdout + stderr 合并输出
 */
async function runCommand(cmd: string, timeoutMs: number): Promise<{ ok: boolean; output: string }> {
  const parts = cmd.split(/\s+/);               // 按空白分割命令和参数
  const bin = parts[0];                          // 可执行文件
  const args = parts.slice(1);                   // 参数列表
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      timeout: timeoutMs,                        // 设置超时
      maxBuffer: 1024 * 1024 * 5,                // 最大缓冲 5MB
      shell: true,                               // 使用 shell 执行（支持管道等）
    });
    const output = (stdout || '') + (stderr ? `\n[stderr] ${stderr}` : ''); // 合并输出
    return { ok: true, output: output.trim() };  // 返回成功结果
  } catch (err: unknown) {
    const e = err as { message?: string; stdout?: string; stderr?: string; killed?: boolean }; // 类型断言
    const killed = e.killed ?? false;            // 是否被超时杀死
    const msg = killed ? `命令超时(${timeoutMs}ms): ${cmd}` : (e.message ?? '未知错误'); // 构造错误消息
    const output = (e.stdout || '') + (e.stderr ? `\n[stderr] ${e.stderr}` : '') + `\n[error] ${msg}`; // 合并错误输出
    return { ok: false, output: output.trim() }; // 返回失败结果
  }
}

// ─── 默认空闲状态工厂 ───────────────────────────────────────

/** 创建默认空闲状态 */
function createIdleState(): TddState {
  return {
    taskId: '',                                  // 空任务 ID
    currentPhase: 'test',                        // 默认从 test 阶段开始
    iteration: 0,                                // 迭代次数归零
    maxIterations: TDD_MAX_ITERATIONS,           // 使用全局默认值
    results: [],                                 // 清空历史结果
    status: 'idle',                              // 空闲状态
    startedAt: null,                             // 无启动时间
    completedAt: null,                           // 无完成时间
  };
}

// ─── TDD 引擎主类 ────────────────────────────────────────────

export class TddEngine {
  private readonly projectRoot: string;          // 项目根目录绝对路径
  private state: TddState;                       // 当前运行状态

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;              // 保存项目根目录
    this.state = createIdleState();              // 初始化为空闲状态
    log.info(`TDD 引擎初始化: ${projectRoot}`); // 记录初始化日志
  }

  /** 状态文件的绝对路径 */
  private get stateFilePath(): string {
    return path.join(this.projectRoot, QFLOW_DIR, STATE_FILE); // 拼接 .qflow/tdd-state.json
  }

  /**
   * 从磁盘加载持久化状态
   * 文件不存在或校验失败时返回默认空闲状态
   */
  async loadState(): Promise<TddState> {
    log.info('加载 TDD 状态文件...');            // 记录加载动作
    const loaded = await readJSONSafe(this.stateFilePath, TddStateSchema); // 读取并校验
    if (loaded) {                                // 文件存在且校验通过
      this.state = loaded;                       // 更新内存状态
      log.info(`TDD 状态已加载: 任务=${loaded.taskId}, 阶段=${loaded.currentPhase}, 迭代=${loaded.iteration}`);
    } else {
      this.state = createIdleState();            // 回退到默认状态
      log.warn('TDD 状态文件不存在或校验失败，使用默认空闲状态');
    }
    return this.state;                           // 返回当前状态
  }

  /**
   * 将当前状态持久化到磁盘
   * 自动确保 .qflow 目录存在
   */
  private async saveState(): Promise<void> {
    const dir = path.dirname(this.stateFilePath); // 获取目录路径
    await ensureDir(dir);                        // 确保目录存在
    await writeJSON(this.stateFilePath, this.state); // 原子写入状态文件
    log.info(`TDD 状态已保存: 阶段=${this.state.currentPhase}, 迭代=${this.state.iteration}`);
  }

  /**
   * 执行单个 TDD 阶段
   * - test/verify: 运行测试命令，捕获输出
   * - write/implement: 返回 AI 辅助指令文本（由上层对接 AI）
   * - commit: 若 autoCommit 为 true，执行 git add + commit
   */
  async tddStep(config: TddConfig): Promise<TddStepResult> {
    const phase = this.state.currentPhase;       // 获取当前阶段
    const startTime = Date.now();                // 记录开始时间
    log.info(`TDD 步骤开始: 阶段=${phase}, 任务=${config.taskId}, 迭代=${this.state.iteration}`);

    let success = false;                         // 默认失败
    let output = '';                             // 输出内容

    // 首次调用时标记为运行中
    if (this.state.status === 'idle') {
      this.state.status = 'running';             // 从空闲切换到运行中
      this.state.taskId = config.taskId;         // 绑定任务 ID
      this.state.startedAt = new Date().toISOString(); // 记录启动时间
    }

    try {
      switch (phase) {
        case 'test': {                           // 测试阶段：运行测试命令
          log.info(`执行测试命令: ${config.testCommand}`);
          const result = await runCommand(config.testCommand, TDD_TEST_TIMEOUT); // 执行命令
          success = result.ok;                   // 命令退出码决定成功与否
          output = result.output;                // 捕获输出
          break;
        }
        case 'write': {                          // write 阶段：返回指令文本，由宿主 LLM 完成
          output = `[AI 指令] 请为任务 ${config.taskId} 编写失败的测试用例。`
            + ` 测试命令: ${config.testCommand}。`
            + ` 当前迭代: ${this.state.iteration}/${this.state.maxIterations}。`
            + ` 要求: 测试应覆盖目标功能的核心路径，确保在实现前测试失败(红灯)。`;
          success = true;                        // 指令阶段始终成功（由上层判断）
          break;
        }
        case 'implement': {                      // implement 阶段：返回指令文本，由宿主 LLM 完成
          output = `[AI 指令] 请为任务 ${config.taskId} 编写最小实现代码使测试通过。`
            + ` 测试命令: ${config.testCommand}。`
            + ` 当前迭代: ${this.state.iteration}/${this.state.maxIterations}。`
            + ` 要求: 仅编写使当前失败测试通过的最少代码，遵循 YAGNI 原则。`;
          success = true;                        // 指令阶段始终成功
          break;
        }
        case 'verify': {                         // 验证阶段：再次运行测试确认通过
          log.info(`执行验证命令: ${config.testCommand}`);
          const result = await runCommand(config.testCommand, TDD_VERIFY_TIMEOUT); // 使用验证超时
          success = result.ok;                   // 全部测试通过才算成功
          output = result.output;                // 捕获输出
          break;
        }
        case 'commit': {                         // 提交阶段：可选自动 git 提交
          if (config.autoCommit) {               // 仅在启用自动提交时执行
            log.info('执行自动 git 提交...');
            const addResult = await runCommand('git add -A', TDD_TEST_TIMEOUT); // 暂存所有变更
            if (!addResult.ok) {                 // git add 失败
              success = false;                   // 标记失败
              output = `git add 失败: ${addResult.output}`; // 记录错误
              break;
            }
            const commitMsg = `TDD: ${config.taskId} iteration ${this.state.iteration}`; // 提交消息
            const commitResult = await runCommand(`git commit -m "${commitMsg}"`, TDD_TEST_TIMEOUT); // 执行提交
            success = commitResult.ok;           // 提交结果
            output = commitResult.output;        // 提交输出
          } else {
            output = '自动提交已禁用，跳过 commit 阶段'; // 未启用自动提交
            success = true;                      // 跳过视为成功
          }
          break;
        }
        default: {                               // 防御性分支：不应到达
          output = `未知阶段: ${phase as string}`; // 记录异常阶段
          success = false;                       // 标记失败
        }
      }
    } catch (err: unknown) {                     // 捕获所有未预期异常
      const msg = err instanceof Error ? err.message : String(err); // 提取错误消息
      output = `阶段 ${phase} 异常: ${msg}`;     // 构造错误输出
      success = false;                           // 标记失败
      log.error(`TDD 步骤异常: ${msg}`);         // 记录错误日志
    }

    const duration = Date.now() - startTime;     // 计算耗时
    const stepResult: TddStepResult = { phase, success, output, duration }; // 构造步骤结果
    this.state.results.push(stepResult);         // 追加到历史记录
    log.info(`TDD 步骤结束: 阶段=${phase}, 成功=${success}, 耗时=${duration}ms`);

    await this.saveState();                      // 持久化状态
    return stepResult;                           // 返回步骤结果
  }

  /**
   * 执行完整 TDD 循环
   * 按 test → write → implement → verify → commit 顺序流转
   * verify 成功后进入 commit 并结束；verify 失败则递增迭代重新开始
   * 达到 maxIterations 上限时标记失败并停止
   */
  async tddLoop(config: TddConfig): Promise<{
    iterations: number;
    finalStatus: string;
    results: TddStepResult[];
  }> {
    const max = config.maxIterations ?? TDD_MAX_ITERATIONS; // 取配置值或默认值
    this.state.taskId = config.taskId;           // 绑定任务 ID
    this.state.maxIterations = max;              // 设置最大迭代
    this.state.iteration = 1;                    // 从第 1 轮开始
    this.state.status = 'running';               // 标记运行中
    this.state.startedAt = new Date().toISOString(); // 记录启动时间
    this.state.completedAt = null;               // 清空完成时间
    this.state.results = [];                     // 清空历史结果
    this.state.currentPhase = 'test';            // 从 test 阶段开始

    // v18.0: 预设感知 — 如果指定了预设，使用预设的阶段序列
    const preset = config.presetName ? TDD_PRESETS[config.presetName] : undefined; // 获取预设
    const phases = preset ? preset.phases : [...TDD_PHASES]; // 使用预设阶段或默认阶段
    log.info(`TDD 循环启动: 任务=${config.taskId}, 最大迭代=${max}, 预设=${config.presetName || 'default'}, 阶段=${phases.join('→')}`);
    await this.saveState();                      // 持久化初始状态

    while (this.state.iteration <= max) {        // 迭代循环
      log.info(`--- TDD 迭代 ${this.state.iteration}/${max} ---`);

      let verifySuccess = false;                 // 本轮验证结果
      for (const phase of phases) {              // 按阶段序列逐步执行
        this.state.currentPhase = phase as TddPhase; // 设置当前阶段
        const stepResult = await this.tddStep(config); // 执行阶段

        if (phase === 'verify') {                // 验证阶段特殊处理
          verifySuccess = stepResult.success;    // 记录验证结果
        }
      }

      if (verifySuccess) {                       // 验证通过
        this.state.status = 'completed';         // 标记循环完成
        this.state.completedAt = new Date().toISOString(); // 记录完成时间
        log.info(`TDD 循环成功: 迭代=${this.state.iteration}, 任务=${config.taskId}`);
        await this.saveState();                  // 持久化最终状态
        break;                                   // 退出循环
      }

      // verify 失败，递增迭代
      log.warn(`TDD 验证失败，准备第 ${this.state.iteration + 1} 轮迭代`);
      this.state.iteration++;                    // 递增迭代计数
      await this.saveState();                    // 持久化中间状态
    }

    // 超过最大迭代仍未通过
    if (this.state.status !== 'completed') {     // 未成功完成
      this.state.status = 'failed';              // 标记失败
      this.state.completedAt = new Date().toISOString(); // 记录结束时间
      log.error(`TDD 循环失败: 达到最大迭代次数 ${max}`);
      await this.saveState();                    // 持久化失败状态
    }

    return {                                     // 返回循环摘要
      iterations: this.state.iteration,          // 实际迭代次数
      finalStatus: this.state.status,            // 最终状态
      results: [...this.state.results],          // 历史结果副本
    };
  }

  /** 获取当前状态的只读快照 */
  getState(): TddState {
    return { ...this.state, results: [...this.state.results] }; // 浅拷贝防止外部修改
  }

  /** 重置引擎状态为空闲，并持久化 */
  async reset(): Promise<void> {
    log.info('TDD 引擎重置为空闲状态');          // 记录重置动作
    this.state = createIdleState();              // 恢复默认状态
    await this.saveState();                      // 持久化空闲状态
  }

  /** v18.0: 列出所有可用预设名称和描述 */
  static listPresets(): Array<{ name: string; description: string; phases: string[] }> {
    return Object.values(TDD_PRESETS).map(p => ({
      name: p.name,                              // 预设名称
      description: p.description,                // 预设描述
      phases: [...p.phases],                     // 阶段序列副本
    }));
  }
}
