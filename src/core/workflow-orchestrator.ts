/**
 * 工作流执行引擎 - DAG 工作流自动推进
 *
 * 实现工作流的启动、推进和状态查询。
 * 当任务完成时自动检查所属阶段是否完成，完成则推进到下一阶段。
 *
 * 函数列表:
 * - startWorkflow()    启动工作流（无依赖阶段自动变 active）
 * - advanceWorkflow()  推进工作流（检查阶段完成情况）
 * - getWorkflowStatus() 获取工作流详细状态
 * - listWorkflows()    列出所有工作流
 */

import path from 'node:path'; // 路径拼接工具
import { type Workflow, type WorkflowStage, WorkflowSchema } from '../schemas/workflow.js'; // 工作流 schema 和类型
import { TaskManager } from './task-manager.js'; // 任务管理器
import { readJSON, writeJSON, ensureDir, fileExists } from '../utils/file-io.js'; // 文件读写工具
import { log } from '../utils/logger.js'; // 日志工具
import { QFLOW_DIR } from '../shared/tool-utils.js'; // .qflow 目录常量

/**
 * 工作流编排器类
 *
 * 负责 DAG 工作流的生命周期管理：启动、推进、状态查询。
 * 每个实例绑定一个项目根目录。
 */
export class WorkflowOrchestrator {
  /** 项目根目录绝对路径 */
  private readonly projectRoot: string;

  /** 工作流存储目录绝对路径 */
  private readonly workflowsDir: string;

  /**
   * @param projectRoot - 项目根目录绝对路径
   */
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot; // 保存项目根路径
    this.workflowsDir = path.join(projectRoot, QFLOW_DIR, 'workflows'); // 拼接工作流存储目录
  }

  /**
   * 加载工作流
   *
   * 从磁盘读取并通过 Zod 校验工作流数据。
   *
   * @param workflowId - 工作流 ID
   * @returns 校验后的工作流对象，不存在或校验失败返回 null
   */
  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    const wfPath = path.join(this.workflowsDir, `${workflowId}.json`); // 拼接工作流文件路径
    const raw = await readJSON<unknown>(wfPath); // 读取文件
    if (!raw) return null; // 文件不存在
    const parsed = WorkflowSchema.safeParse(raw); // Zod 校验
    return parsed.success ? parsed.data : null; // 校验成功返回数据，失败返回 null
  }

  /**
   * 保存工作流到磁盘
   *
   * @param workflow - 工作流对象
   */
  async saveWorkflow(workflow: Workflow): Promise<void> {
    await ensureDir(this.workflowsDir); // 确保目录存在
    await writeJSON(path.join(this.workflowsDir, `${workflow.id}.json`), workflow); // 原子写入
  }

  /**
   * 启动工作流 - 无依赖阶段自动变 active
   *
   * 仅 'defined' 状态的工作流可以启动。
   * 启动后，没有依赖的阶段自动激活，其任务也随之激活。
   *
   * @param workflowId - 工作流 ID
   * @returns 启动后的工作流对象
   * @throws 工作流不存在或状态不允许启动时抛出错误
   */
  async startWorkflow(workflowId: string): Promise<Workflow> {
    const workflow = await this.getWorkflow(workflowId); // 加载工作流
    if (!workflow) throw new Error(`工作流 ${workflowId} 不存在`); // 不存在则报错
    if (workflow.status !== 'defined') throw new Error(`工作流 ${workflowId} 状态为 ${workflow.status}，无法启动`); // 状态校验

    workflow.status = 'running'; // 更新为运行中
    workflow.updatedAt = new Date().toISOString(); // 刷新时间戳

    // 无依赖的阶段自动激活，有依赖的标记为 blocked
    for (const stage of workflow.stages) {
      if (!stage.dependsOn || stage.dependsOn.length === 0) {
        stage.status = 'active'; // 无依赖，直接激活
        log.info(`工作流阶段 "${stage.name}" 已激活（无依赖）`);
      } else {
        stage.status = 'blocked'; // 有依赖，标记阻塞
      }
    }

    // 激活阶段中的任务
    const tm = new TaskManager(this.projectRoot); // 创建任务管理器
    for (const stage of workflow.stages) {
      if (stage.status === 'active') { // 仅处理已激活的阶段
        for (const taskId of stage.taskIds) {
          try {
            await tm.setStatus(taskId, 'active'); // 激活任务
          } catch (e) {
            log.warn(`激活任务 ${taskId} 失败: ${(e as Error).message}`); // 激活失败不中断流程
          }
        }
      }
    }

    await this.saveWorkflow(workflow); // 持久化
    log.info(`工作流 ${workflowId} 已启动`);
    return workflow; // 返回更新后的工作流
  }

  /**
   * 推进工作流 - 检查阶段完成情况并自动推进
   *
   * 1. 检查 active 阶段中的任务是否全部完成
   * 2. 完成的阶段标记为 done
   * 3. 检查 blocked 阶段的依赖是否全部满足
   * 4. 依赖满足的阶段自动激活，其任务也随之激活
   * 5. 所有阶段完成时，工作流标记为 completed
   *
   * @param workflowId - 工作流 ID
   * @returns 工作流对象、新激活的阶段名称列表、是否全部完成
   */
  async advanceWorkflow(workflowId: string): Promise<{ workflow: Workflow; advanced: string[]; completed: boolean }> {
    const workflow = await this.getWorkflow(workflowId); // 加载工作流
    if (!workflow) throw new Error(`工作流 ${workflowId} 不存在`); // 不存在则报错
    if (workflow.status !== 'running') return { workflow, advanced: [], completed: false }; // 非运行中不推进

    const tm = new TaskManager(this.projectRoot); // 创建任务管理器
    const allTasks = await tm.getAllTasks(); // 获取全部任务
    const taskMap = new Map(allTasks.map(t => [t.id, t])); // 构建任务 ID -> 任务对象映射
    const advanced: string[] = []; // 新激活的阶段名称列表

    // 检查 active 阶段是否完成
    for (const stage of workflow.stages) {
      if (stage.status === 'active') { // 仅检查激活中的阶段
        const tasks = stage.taskIds.map(id => taskMap.get(id)).filter(Boolean); // 获取阶段内的任务对象
        const allDone = tasks.every(t => t!.status === 'done' || t!.status === 'cancelled'); // 判断是否全部完成/取消
        if (allDone && tasks.length > 0) {
          stage.status = 'done'; // 标记阶段完成
          log.info(`工作流阶段 "${stage.name}" 已完成`);
        }
      }
    }

    // 检查 blocked 阶段是否可以激活
    for (const stage of workflow.stages) {
      if (stage.status === 'blocked' && stage.dependsOn) { // 仅检查被阻塞且有依赖的阶段
        const depsReady = stage.dependsOn.every(depName => { // 检查所有依赖阶段是否已完成
          const depStage = workflow.stages.find(s => s.name === depName); // 查找依赖阶段
          return depStage && depStage.status === 'done'; // 依赖阶段必须为 done
        });
        if (depsReady) { // 所有依赖满足
          stage.status = 'active'; // 激活阶段
          advanced.push(stage.name); // 记录新激活的阶段
          log.info(`工作流阶段 "${stage.name}" 依赖已满足，已激活`);
          // 激活阶段中的任务
          for (const taskId of stage.taskIds) {
            try {
              const task = taskMap.get(taskId); // 获取任务对象
              if (task && (task.status === 'pending' || task.status === 'blocked')) { // 仅激活待处理或被阻塞的任务
                await tm.setStatus(taskId, 'active'); // 激活任务
              }
            } catch (e) {
              log.warn(`激活任务 ${taskId} 失败: ${(e as Error).message}`); // 激活失败不中断流程
            }
          }
        }
      }
    }

    // 检查工作流是否全部完成
    const allStagesDone = workflow.stages.every(s => s.status === 'done'); // 所有阶段都为 done
    if (allStagesDone) {
      workflow.status = 'completed'; // 标记工作流完成
      log.info(`工作流 ${workflowId} 全部完成`);
    }

    workflow.updatedAt = new Date().toISOString(); // 刷新时间戳
    await this.saveWorkflow(workflow); // 持久化
    return { workflow, advanced, completed: allStagesDone }; // 返回推进结果
  }

  /**
   * 获取工作流详细状态
   *
   * 返回工作流信息和每个阶段的任务完成进度。
   *
   * @param workflowId - 工作流 ID
   * @returns 工作流对象和阶段详情列表
   */
  async getWorkflowStatus(workflowId: string): Promise<{
    workflow: Workflow;
    stageDetails: Array<{ name: string; status: string; total: number; done: number; progress: number }>;
  }> {
    const workflow = await this.getWorkflow(workflowId); // 加载工作流
    if (!workflow) throw new Error(`工作流 ${workflowId} 不存在`); // 不存在则报错

    const tm = new TaskManager(this.projectRoot); // 创建任务管理器
    const allTasks = await tm.getAllTasks(); // 获取全部任务
    const taskMap = new Map(allTasks.map(t => [t.id, t])); // 构建任务映射

    const stageDetails = workflow.stages.map(stage => { // 遍历每个阶段
      const tasks = stage.taskIds.map(id => taskMap.get(id)).filter(Boolean); // 获取阶段内的任务
      const done = tasks.filter(t => t!.status === 'done').length; // 统计已完成数
      return {
        name: stage.name, // 阶段名称
        status: stage.status, // 阶段状态
        total: tasks.length, // 任务总数
        done, // 已完成数
        progress: tasks.length > 0 ? Math.round(done / tasks.length * 100) : 0, // 完成百分比
      };
    });

    return { workflow, stageDetails }; // 返回详细状态
  }

  /**
   * 列出所有工作流
   *
   * 扫描工作流目录下的所有 JSON 文件并加载。
   *
   * @returns 工作流列表
   */
  async listWorkflows(): Promise<Workflow[]> {
    if (!(await fileExists(this.workflowsDir))) return []; // 目录不存在返回空
    const { promises: fsp } = await import('node:fs'); // 动态导入文件系统
    const entries = await fsp.readdir(this.workflowsDir); // 读取目录内容
    const workflows: Workflow[] = []; // 结果列表
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue; // 仅处理 JSON 文件
      const id = entry.replace('.json', ''); // 从文件名提取 ID
      const wf = await this.getWorkflow(id); // 加载工作流
      if (wf) workflows.push(wf); // 加载成功则添加到结果
    }
    return workflows; // 返回列表
  }
}
