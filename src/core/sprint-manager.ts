/**
 * SprintManager - Sprint 敏捷迭代管理器
 *
 * 管理 Sprint 的完整生命周期：创建、启动、添加故事、更新状态、结束。
 * 持久化到 {projectRoot}/.qflow/sprints/{id}.json
 *
 * 函数列表:
 * - create(name, goal)                          创建 Sprint（ID格式: SPR-001）
 * - get(sprintId)                               获取 Sprint 详情
 * - list()                                      列出所有 Sprint
 * - addStory(sprintId, title, desc, points)     添加用户故事
 * - updateStoryStatus(sprintId, storyId, status) 更新故事状态
 * - startSprint(sprintId)                       启动 Sprint（设为 active）
 * - completeSprint(sprintId, retrospective)     结束 Sprint（设为 completed）
 * - getRetro(sprintId)                          获取回顾总结
 */
import path from 'node:path';                                           // 路径工具
import { promises as fs } from 'node:fs';                              // 文件系统异步 API
import { readJSON, writeJSON, ensureDir } from '../utils/file-io.js';  // 文件 IO 工具
import { log } from '../utils/logger.js';                              // 日志工具
import { QFLOW_DIR } from '../shared/tool-utils.js';                   // .qflow 目录常量
import { SprintSchema, StorySchema, type Sprint, type Story } from '../schemas/sprint.js'; // Sprint/Story 类型

/**
 * SprintManager 类 - Sprint 敏捷迭代管理器
 *
 * 以文件系统为持久化后端，每个 Sprint 存储为独立 JSON 文件。
 * Sprint ID 格式为 SPR-001，Story ID 格式为 STY-{时间戳}。
 */
export class SprintManager {
  private projectRoot: string; // 项目根目录路径

  /**
   * 构造函数
   * @param projectRoot 项目根目录绝对路径
   */
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot; // 保存项目根目录
  }

  /** Sprint 存储目录路径（.qflow/sprints/） */
  private sprintsDir(): string {
    return path.join(this.projectRoot, QFLOW_DIR, 'sprints'); // 返回 sprints 目录
  }

  /** 获取指定 Sprint 文件路径 */
  private sprintPath(sprintId: string): string {
    return path.join(this.sprintsDir(), `${sprintId}.json`); // 返回 sprint JSON 路径
  }

  /**
   * 生成新的 Sprint ID（格式: SPR-001）
   */
  private async generateSprintId(): Promise<string> {
    const sprints = await this.list(); // 读取现有 Sprint 列表
    const count = sprints.length + 1; // 计数加 1
    return `SPR-${String(count).padStart(3, '0')}`; // 格式化为三位数字
  }

  /**
   * 生成新的 Story ID（格式: STY-{时间戳}）
   */
  private generateStoryId(): string {
    return `STY-${Date.now()}`; // 使用时间戳保证唯一性
  }

  /**
   * 创建新 Sprint
   * @param name Sprint 名称
   * @param goal Sprint 目标描述
   */
  async create(name: string, goal: string = ''): Promise<Sprint> {
    await ensureDir(this.sprintsDir()); // 确保目录存在
    const id = await this.generateSprintId(); // 生成唯一 ID

    const sprint: Sprint = SprintSchema.parse({
      id,                                  // Sprint ID
      name,                                // Sprint 名称
      goal,                                // Sprint 目标
      status: 'planning',                  // 初始状态为规划中
      stories: [],                         // 初始无故事
      createdAt: new Date().toISOString(), // 记录创建时间
    });

    await writeJSON(this.sprintPath(id), sprint as unknown as Record<string, unknown>); // 持久化到磁盘
    log.info(`SprintManager: 创建 Sprint ${id} "${name}"`); // 记录日志
    return sprint;
  }

  /**
   * 获取 Sprint 详情
   * @param sprintId Sprint ID
   */
  async get(sprintId: string): Promise<Sprint | null> {
    const raw = await readJSON<Sprint>(this.sprintPath(sprintId)); // 从磁盘读取
    if (!raw) return null; // 不存在返回 null
    return SprintSchema.parse(raw); // 用 Schema 校验并返回
  }

  /**
   * 列出所有 Sprint
   */
  async list(): Promise<Sprint[]> {
    await ensureDir(this.sprintsDir()); // 确保目录存在
    const files = await fs.readdir(this.sprintsDir()).catch(() => [] as string[]); // 读取目录文件列表
    const sprints: Sprint[] = []; // 结果列表

    for (const file of files.filter(f => f.endsWith('.json'))) { // 过滤 JSON 文件
      const raw = await readJSON<Sprint>(path.join(this.sprintsDir(), file)); // 读取文件
      if (raw) {
        try {
          sprints.push(SprintSchema.parse(raw)); // 校验并加入列表
        } catch (e) {
          log.warn('Sprint 文件校验失败: ' + (e instanceof Error ? e.message : String(e))); // v22.0 P1-1: 静默 catch 修复
        }
      }
    }

    return sprints.sort((a, b) => a.id.localeCompare(b.id)); // 按 ID 排序
  }

  /**
   * 向 Sprint 添加用户故事
   * @param sprintId Sprint ID
   * @param title 故事标题
   * @param description 故事描述
   * @param points 故事点数（工作量估算）
   */
  async addStory(sprintId: string, title: string, description: string = '', points: number = 0): Promise<Story> {
    const sprint = await this.get(sprintId); // 读取 Sprint
    if (!sprint) throw new Error(`Sprint "${sprintId}" 不存在`); // Sprint 不存在报错

    const story: Story = StorySchema.parse({
      id: this.generateStoryId(),          // 生成故事 ID
      title,                               // 故事标题
      description,                         // 故事描述
      status: 'backlog',                   // 初始状态为待办
      points,                              // 故事点数
      taskIds: [],                         // 初始无关联任务
      createdAt: new Date().toISOString(), // 创建时间
    });

    sprint.stories.push(story); // 追加到故事列表
    await writeJSON(this.sprintPath(sprintId), sprint as unknown as Record<string, unknown>); // 保存
    log.info(`SprintManager: Sprint ${sprintId} 添加 Story "${title}" (${points}pts)`); // 记录日志
    return story;
  }

  /**
   * 更新用户故事状态
   * @param sprintId Sprint ID
   * @param storyId 故事 ID
   * @param status 新状态
   */
  async updateStoryStatus(
    sprintId: string,
    storyId: string,
    status: Story['status']
  ): Promise<Story> {
    const sprint = await this.get(sprintId); // 读取 Sprint
    if (!sprint) throw new Error(`Sprint "${sprintId}" 不存在`); // Sprint 不存在报错

    const story = sprint.stories.find(s => s.id === storyId); // 查找故事
    if (!story) throw new Error(`Story "${storyId}" 在 Sprint "${sprintId}" 中不存在`); // 故事不存在报错

    story.status = status; // 更新状态
    await writeJSON(this.sprintPath(sprintId), sprint as unknown as Record<string, unknown>); // 保存
    log.info(`SprintManager: Story ${storyId} 状态更新为 ${status}`); // 记录日志
    return story;
  }

  /**
   * 启动 Sprint（状态设为 active）
   * @param sprintId Sprint ID
   */
  async startSprint(sprintId: string): Promise<Sprint> {
    const sprint = await this.get(sprintId); // 读取 Sprint
    if (!sprint) throw new Error(`Sprint "${sprintId}" 不存在`); // Sprint 不存在报错
    if (sprint.status !== 'planning') throw new Error(`Sprint "${sprintId}" 当前状态 ${sprint.status} 不允许启动`); // 状态检查

    sprint.status = 'active'; // 更新状态为进行中
    sprint.startDate = new Date().toISOString(); // 记录启动时间
    await writeJSON(this.sprintPath(sprintId), sprint as unknown as Record<string, unknown>); // 保存
    log.info(`SprintManager: Sprint ${sprintId} 已启动`); // 记录日志
    return sprint;
  }

  /**
   * 结束 Sprint（状态设为 completed）
   * @param sprintId Sprint ID
   * @param retrospective Sprint 回顾总结内容
   */
  async completeSprint(sprintId: string, retrospective: string = ''): Promise<Sprint> {
    const sprint = await this.get(sprintId); // 读取 Sprint
    if (!sprint) throw new Error(`Sprint "${sprintId}" 不存在`); // Sprint 不存在报错

    sprint.status = 'completed'; // 更新状态为已完成
    sprint.endDate = new Date().toISOString(); // 记录结束时间
    if (retrospective) sprint.retrospective = retrospective; // 保存回顾内容（可选）
    await writeJSON(this.sprintPath(sprintId), sprint as unknown as Record<string, unknown>); // 保存
    log.info(`SprintManager: Sprint ${sprintId} 已完成`); // 记录日志
    return sprint;
  }

  /**
   * 获取 Sprint 回顾总结
   * @param sprintId Sprint ID
   */
  async getRetro(sprintId: string): Promise<string | null> {
    const sprint = await this.get(sprintId); // 读取 Sprint
    if (!sprint) return null; // Sprint 不存在返回 null
    return sprint.retrospective ?? null; // 返回回顾内容（可能为 undefined）
  }
}
