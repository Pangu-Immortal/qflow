/**
 * LoopEngine - 自治循环引擎
 *
 * 实现自治 Agent 循环（plan→code→test→commit），支持预设模式，状态持久化。
 * 状态文件: {projectRoot}/.qflow/loop-state.json
 *
 * 函数列表:
 * - start()         初始化循环状态
 * - step()          执行单步
 * - run()           全自动循环
 * - stop()          停止循环
 * - getStatus()     获取循环状态
 * - listPresets()   列出预设（静态方法）
 * - implementAll()  一键执行全部任务
 * - reset()         重置循环状态
 */
import path from 'node:path'; // 路径处理工具
import { readJSON, writeJSON, ensureDir } from '../utils/file-io.js'; // 文件 IO 工具
import { log } from '../utils/logger.js'; // 日志工具
import { QFLOW_DIR } from '../shared/tool-utils.js'; // .qflow 目录常量
import { LOOP_MAX_ITERATIONS, LOOP_COOLDOWN_MS } from '../shared/constants.js'; // 循环上限常量
import { execFile } from 'node:child_process'; // v20.0: git commit 用
import { promisify } from 'node:util'; // v20.0: promisify

const execFileAsync = promisify(execFile); // v20.0: 异步 execFile

/** v20.0 P0-2: AI 调用回调类型 */
export type CallAIFn = (prompt: string, context?: string) => Promise<string>;

/** 循环阶段类型 */
export type LoopPhase = 'plan' | 'code' | 'test' | 'review' | 'commit' | 'idle';

/** 循环运行状态类型 */
export type LoopStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

/** 循环预设接口 */
export interface LoopPreset {
  name: string;           // 预设名称
  description: string;    // 预设描述
  phases: LoopPhase[];    // 阶段序列
  maxIterations: number;  // 最大迭代次数
  autoCommit: boolean;    // 是否自动提交
}

/** 循环步骤执行结果 */
export interface LoopStepResult {
  phase: LoopPhase;    // 当前执行阶段
  success: boolean;    // 是否执行成功
  output: string;      // 执行输出内容
  duration: number;    // 执行耗时（毫秒）
}

/** 循环持久化状态 */
export interface LoopState {
  taskId: string;              // 关联的任务 ID
  currentPhase: LoopPhase;     // 当前所处阶段
  iteration: number;           // 当前完成的迭代次数
  maxIterations: number;       // 最大允许迭代次数
  status: LoopStatus;          // 循环运行状态
  presetName: string;          // 使用的预设名称
  results: LoopStepResult[];   // 所有步骤执行结果列表
  startedAt: string;           // 循环启动时间（ISO 字符串）
  completedAt: string | null;  // 循环完成时间（ISO 字符串或 null）
}

/** 循环启动配置 */
export interface LoopConfig {
  taskId: string;           // 关联的任务 ID
  presetName?: string;      // 预设名称（默认 default）
  maxIterations?: number;   // 最大迭代次数（覆盖预设默认值）
  testCommand?: string;     // 测试命令（预留字段）
}

/** 5 种内置循环预设定义 */
export const LOOP_PRESETS: LoopPreset[] = [
  {
    name: 'default',
    description: '标准开发循环：计划→编码→测试→提交', // 标准四阶段循环
    phases: ['plan', 'code', 'test', 'commit'],
    maxIterations: 10, // 默认最多 10 次迭代
    autoCommit: true,  // 自动提交代码
  },
  {
    name: 'rapid',
    description: '快速迭代：编码→测试→提交（跳过计划阶段）', // 跳过计划，适合快速修复
    phases: ['code', 'test', 'commit'],
    maxIterations: 20, // 允许更多次迭代
    autoCommit: true,  // 自动提交代码
  },
  {
    name: 'careful',
    description: '谨慎开发：计划→编码→测试→审查→提交', // 增加审查阶段
    phases: ['plan', 'code', 'test', 'review', 'commit'],
    maxIterations: 5,   // 限制迭代次数
    autoCommit: false,  // 手动审查后提交
  },
  {
    name: 'review',
    description: '审查优先：编码→审查→测试→提交', // 编码后立即审查
    phases: ['code', 'review', 'test', 'commit'],
    maxIterations: 10,  // 默认 10 次迭代
    autoCommit: false,  // 手动审查提交
  },
  {
    name: 'custom',
    description: '自定义循环：所有阶段可选', // 包含所有阶段的完整循环
    phases: ['plan', 'code', 'test', 'review', 'commit'],
    maxIterations: 50,  // 最多 50 次迭代
    autoCommit: false,  // 手动控制提交
  },
];

/**
 * LoopEngine 自治循环引擎
 *
 * 管理 Agent 循环的生命周期：启动、单步执行、全量运行、暂停、重置。
 * 状态持久化到 {projectRoot}/.qflow/loop-state.json。
 */
export class LoopEngine {
  private projectRoot: string;            // 项目根目录路径
  private state: LoopState | null = null; // 内存中的循环状态缓存
  private callAI: CallAIFn | null = null; // v20.0 P0-2: AI 调用回调（DI 注入）

  /**
   * 构造函数
   * @param projectRoot 项目根目录绝对路径
   * @param callAI      可选的 AI 调用回调（DI 注入，用于 plan/code/test/review 阶段）
   */
  constructor(projectRoot: string, callAI?: CallAIFn) {
    this.projectRoot = projectRoot; // 保存项目根目录
    this.callAI = callAI ?? null;   // v20.0 P0-2: 保存 AI 回调
    void LOOP_COOLDOWN_MS;          // 引用常量，防止 unused import 警告
    // v21.0 P0-2: 未注入 callAI 时输出明确警告，提示 AI 阶段将降级为占位文本
    if (!this.callAI) {
      log.warn('[LoopEngine] callAI 未注入，AI 阶段将返回占位文本');
    }
  }

  /** 获取状态文件的绝对路径 */
  private statePath(): string {
    return path.join(this.projectRoot, QFLOW_DIR, 'loop-state.json'); // .qflow/loop-state.json
  }

  /**
   * 初始化并启动循环状态
   */
  async start(config: LoopConfig): Promise<LoopState> {
    const preset = LOOP_PRESETS.find(p => p.name === (config.presetName || 'default')) || LOOP_PRESETS[0]; // 查找指定预设

    this.state = {
      taskId: config.taskId,                                         // 设置任务 ID
      currentPhase: preset.phases[0],                                // 从第一个阶段开始
      iteration: 0,                                                  // 初始迭代次数为 0
      maxIterations: config.maxIterations ?? preset.maxIterations,   // 优先使用配置中的值
      status: 'running',                                             // 设置为运行中状态
      presetName: preset.name,                                       // 记录使用的预设名
      results: [],                                                   // 初始化空结果列表
      startedAt: new Date().toISOString(),                           // 记录启动时间
      completedAt: null,                                             // 尚未完成
    };

    await this.saveState(); // 持久化状态到磁盘
    log.info(`LoopEngine: 启动循环 (task=${config.taskId}, preset=${preset.name}, maxIter=${this.state.maxIterations})`);
    return this.state;
  }

  /**
   * 执行单步循环（按顺序推进阶段）
   */
  async step(): Promise<LoopStepResult> {
    if (!this.state || this.state.status !== 'running') {
      throw new Error('循环未启动或已停止'); // 状态检查
    }

    const preset = LOOP_PRESETS.find(p => p.name === this.state!.presetName) || LOOP_PRESETS[0]; // 查找预设
    const phaseIndex = this.state.results.length % preset.phases.length; // 计算当前阶段索引
    const phase = preset.phases[phaseIndex];   // 获取当前阶段名称
    this.state.currentPhase = phase;           // 更新当前阶段

    const startTime = Date.now(); // 记录开始时间

    // v20.0 P0-3/4/5/6: 每个阶段实装真实调用
    let success = true; // 默认成功
    let output = ''; // 输出内容

    try {
      switch (phase) {
        case 'plan': { // v20.0 P0-3: plan 阶段调用 callAI 生成计划
          if (this.callAI) {
            log.info('[LoopEngine] calling AI for plan...'); // v21.0 P0-3: 阶段前日志
            const prompt = `为任务 ${this.state!.taskId} 生成实现计划。当前迭代: ${this.state!.iteration + 1}/${this.state!.maxIterations}。请输出：1. 实现步骤 2. 涉及文件 3. 风险点。`;
            output = await this.callAI(prompt, `preset=${this.state!.presetName}`); // 调用 AI
            log.info(`LoopEngine: plan 阶段 AI 调用成功 (task=${this.state!.taskId})`);
          } else {
            output = `[plan] 任务 ${this.state!.taskId} 计划阶段：请分析需求并生成实现计划。（未注入 callAI，返回指令文本）`; // 降级到指令文本
          }
          break;
        }
        case 'code': { // v20.0 P0-4: code 阶段调用 callAI 生成代码
          if (this.callAI) {
            log.info('[LoopEngine] calling AI for code...'); // v21.0 P0-3: 阶段前日志
            const planOutput = this.state!.results.filter(r => r.phase === 'plan').pop()?.output || ''; // 获取最近的计划输出
            const prompt = `根据以下计划为任务 ${this.state!.taskId} 生成实现代码。\n\n计划:\n${planOutput.slice(0, 2000)}\n\n请输出完整的代码实现。`;
            output = await this.callAI(prompt, `task=${this.state!.taskId}`); // 调用 AI
            log.info(`LoopEngine: code 阶段 AI 调用成功 (task=${this.state!.taskId})`);
          } else {
            output = `[code] 任务 ${this.state!.taskId} 编码阶段：请根据计划编写代码。（未注入 callAI，返回指令文本）`;
          }
          break;
        }
        case 'test': { // v20.0 P0-5: test 阶段调用 callAI 生成测试
          if (this.callAI) {
            log.info('[LoopEngine] calling AI for test...'); // v21.0 P0-3: 阶段前日志
            const prompt = `为任务 ${this.state!.taskId} 的实现代码生成测试用例。迭代: ${this.state!.iteration + 1}。请输出可执行的测试代码。`;
            output = await this.callAI(prompt, `task=${this.state!.taskId}`); // 调用 AI
            log.info(`LoopEngine: test 阶段 AI 调用成功 (task=${this.state!.taskId})`);
          } else {
            output = `[test] 任务 ${this.state!.taskId} 测试阶段：请编写并运行测试。（未注入 callAI，返回指令文本）`;
          }
          break;
        }
        case 'review': { // v20.0 P0-5: review 阶段调用 callAI 审查
          if (this.callAI) {
            log.info('[LoopEngine] calling AI for review...'); // v21.0 P0-3: 阶段前日志
            const codeOutput = this.state!.results.filter(r => r.phase === 'code').pop()?.output || ''; // 获取最近的代码输出
            const prompt = `审查任务 ${this.state!.taskId} 的代码实现。\n\n代码:\n${codeOutput.slice(0, 2000)}\n\n请检查：1. 代码质量 2. 安全性 3. 性能 4. 可维护性。`;
            output = await this.callAI(prompt, `review task=${this.state!.taskId}`); // 调用 AI
            log.info(`LoopEngine: review 阶段 AI 调用成功 (task=${this.state!.taskId})`);
          } else {
            output = `[review] 任务 ${this.state!.taskId} 审查阶段：请审查代码质量。（未注入 callAI，返回指令文本）`;
          }
          break;
        }
        case 'commit': { // v20.0 P0-6: commit 阶段执行 git commit
          try {
            await execFileAsync('git', ['add', '-A'], { cwd: this.projectRoot, timeout: 10000 }); // git add
            const commitMsg = `loop: ${this.state!.taskId} iteration ${this.state!.iteration + 1}`; // 提交消息
            const { stdout } = await execFileAsync('git', ['commit', '-m', commitMsg, '--allow-empty'], { cwd: this.projectRoot, timeout: 10000 }); // git commit
            output = `[commit] ${stdout.trim()}`; // 提交输出
            log.info(`LoopEngine: commit 成功 (task=${this.state!.taskId})`);
          } catch (err) {
            const msg = (err as Error).message || '未知错误'; // 错误消息
            output = `[commit] git commit 失败: ${msg}`; // 记录失败
            success = false; // 标记失败
            log.warn(`LoopEngine: commit 失败: ${msg}`);
          }
          break;
        }
        default: { // idle 或未知阶段
          output = `[${phase}] 无操作`; // 无操作
        }
      }
    } catch (err) { // 捕获 callAI 等异常
      const msg = (err as Error).message || '未知错误'; // 错误消息
      output = `[${phase}] 阶段执行异常: ${msg}`; // 记录异常
      success = false; // 标记失败
      log.error(`LoopEngine: 阶段 ${phase} 异常: ${msg}`);
    }

    const result: LoopStepResult = {
      phase,                                                          // 当前执行阶段
      success,                                                        // v20.0: 真实执行结果
      output,                                                         // v20.0: 真实执行输出
      duration: Date.now() - startTime,                               // 计算耗时
    };

    this.state.results.push(result); // 追加到历史列表

    // 判断是否完成一个完整的循环迭代
    if ((this.state.results.length % preset.phases.length) === 0) {
      this.state.iteration++; // 迭代计数加 1
      log.info(`LoopEngine: 完成第 ${this.state.iteration} 次迭代 (task=${this.state.taskId})`);

      if (this.state.iteration >= this.state.maxIterations) {
        this.state.status = 'completed';                    // 标记为已完成
        this.state.completedAt = new Date().toISOString();  // 记录完成时间
        log.info(`LoopEngine: 循环完成 (task=${this.state.taskId}, iterations=${this.state.iteration})`);
      }
    }

    await this.saveState(); // 持久化状态
    return result;
  }

  /**
   * 全自动运行循环直到完成
   */
  async run(): Promise<LoopState> {
    if (!this.state || this.state.status !== 'running') {
      throw new Error('循环未启动');
    }

    while (this.state.status === 'running') { // 持续执行
      await this.step();

      if (this.state.iteration >= LOOP_MAX_ITERATIONS) {  // 全局安全保护
        this.state.status = 'completed';
        this.state.completedAt = new Date().toISOString();
        log.warn(`LoopEngine: 达到全局迭代上限 ${LOOP_MAX_ITERATIONS}，强制停止`);
        break;
      }
    }

    return this.state;
  }

  /**
   * 暂停/停止当前循环
   */
  async stop(): Promise<LoopState> {
    if (!this.state) throw new Error('循环未启动');
    this.state.status = 'paused';                                   // 设置为暂停状态
    this.state.completedAt = new Date().toISOString();              // 记录停止时间
    await this.saveState();
    log.info(`LoopEngine: 循环已停止 (task=${this.state.taskId}, iteration=${this.state.iteration})`);
    return this.state;
  }

  /**
   * 获取当前循环状态
   */
  async getStatus(): Promise<LoopState | null> {
    if (this.state) return { ...this.state }; // 内存缓存优先
    const raw = await readJSON<LoopState>(this.statePath()); // 从磁盘加载
    if (raw) this.state = raw;
    return raw;
  }

  /**
   * 列出所有内置循环预设（静态方法）
   */
  static listPresets(): Array<{ name: string; description: string; phases: LoopPhase[] }> {
    return LOOP_PRESETS.map(p => ({
      name: p.name,
      description: p.description,
      phases: p.phases,
    }));
  }

  /**
   * 一键批量执行多个任务的循环
   */
  async implementAll(taskIds: string[]): Promise<{ completed: string[]; failed: string[] }> {
    const completed: string[] = [];
    const failed: string[] = [];

    for (const taskId of taskIds) {
      try {
        await this.start({ taskId, presetName: 'rapid' }); // 使用快速预设
        await this.run();
        completed.push(taskId);
        log.info(`LoopEngine.implementAll: 任务 ${taskId} 循环完成`);
      } catch (err) {
        failed.push(taskId);
        log.warn(`LoopEngine.implementAll: 任务 ${taskId} 循环失败: ${(err as Error).message}`);
      }
    }

    return { completed, failed };
  }

  /**
   * 重置循环状态
   */
  async reset(): Promise<void> {
    this.state = null; // 清除内存缓存
    try {
      const { unlink } = await import('node:fs/promises');
      await unlink(this.statePath()).catch(() => {}); // 删除状态文件
    } catch (e) { log.warn('状态文件删除失败: ' + (e instanceof Error ? e.message : String(e))); } // v22.0 P1-8
    log.info('LoopEngine: 状态已重置');
  }

  /** 持久化状态到磁盘 */
  private async saveState(): Promise<void> {
    if (!this.state) return;
    await ensureDir(path.join(this.projectRoot, QFLOW_DIR)); // 确保目录存在
    await writeJSON(this.statePath(), this.state as unknown as Record<string, unknown>); // 原子写入
  }
}
