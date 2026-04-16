/**
 * ClarificationEngine - 需求澄清引擎
 *
 * 管理 Spec 相关的澄清问题生命周期：提问、回答、查询。
 * 澄清数据持久化到 {projectRoot}/.qflow/clarifications/{specId}.json
 *
 * 函数列表:
 * - addQuestion(specId, question, context)       添加澄清问题
 * - answerQuestion(specId, questionId, answer)   回答澄清问题
 * - listQuestions(specId, status?)               列出问题（支持按状态过滤）
 * - getUnanswered(specId)                        获取所有未回答问题
 */
import path from 'node:path';                                           // 路径工具
import { readJSON, writeJSON, ensureDir } from '../utils/file-io.js';  // 文件 IO 工具
import { log } from '../utils/logger.js';                              // 日志工具
import { QFLOW_DIR } from '../shared/tool-utils.js';                   // .qflow 目录常量

/** 澄清问题状态类型 */
export type QuestionStatus = 'pending' | 'answered'; // pending=待回答, answered=已回答

/** 单个澄清问题数据结构 */
export interface ClarificationQuestion {
  id: string;              // 问题唯一 ID（格式: CLQ-{时间戳}）
  specId: string;          // 关联的 Spec ID
  question: string;        // 问题内容
  context: string;         // 问题背景上下文
  status: QuestionStatus;  // 问题状态
  answer: string | null;   // 回答内容（null 表示未回答）
  createdAt: string;       // 创建时间（ISO 字符串）
  answeredAt: string | null; // 回答时间（ISO 字符串，未回答为 null）
}

/** 澄清数据文件结构（每个 specId 对应一个文件） */
interface ClarificationData {
  specId: string;                         // 关联 Spec ID
  questions: ClarificationQuestion[];     // 问题列表
}

/**
 * ClarificationEngine 类 - 需求澄清引擎
 *
 * 以 JSON 文件持久化澄清数据，每个 Spec 对应一个独立文件。
 * 问题 ID 格式为 CLQ-{时间戳}，保证时序唯一性。
 */
export class ClarificationEngine {
  private projectRoot: string; // 项目根目录路径

  /**
   * 构造函数
   * @param projectRoot 项目根目录绝对路径
   */
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot; // 保存项目根目录
  }

  /** 澄清数据存储目录（.qflow/clarifications/） */
  private clarificationsDir(): string {
    return path.join(this.projectRoot, QFLOW_DIR, 'clarifications'); // 返回 clarifications 目录
  }

  /** 指定 Spec 的澄清文件路径 */
  private clarificationPath(specId: string): string {
    return path.join(this.clarificationsDir(), `${specId}.json`); // 返回 clarification JSON 路径
  }

  /**
   * 读取指定 Spec 的澄清数据（不存在时初始化空结构）
   */
  private async loadData(specId: string): Promise<ClarificationData> {
    const raw = await readJSON<ClarificationData>(this.clarificationPath(specId)); // 从磁盘读取
    if (raw) return raw; // 存在则直接返回
    return { specId, questions: [] }; // 不存在则返回空结构
  }

  /**
   * 保存澄清数据到磁盘
   */
  private async saveData(data: ClarificationData): Promise<void> {
    await ensureDir(this.clarificationsDir()); // 确保目录存在
    await writeJSON(this.clarificationPath(data.specId), data as unknown as Record<string, unknown>); // 原子写入
  }

  /**
   * 添加澄清问题
   * @param specId 关联 Spec ID
   * @param question 问题内容
   * @param context 问题背景上下文
   */
  async addQuestion(specId: string, question: string, context: string = ''): Promise<ClarificationQuestion> {
    const data = await this.loadData(specId); // 读取现有数据

    const q: ClarificationQuestion = {
      id: `CLQ-${Date.now()}`,             // 生成唯一 ID（时间戳保证唯一性）
      specId,                              // 关联 Spec ID
      question,                            // 问题内容
      context,                             // 背景上下文
      status: 'pending',                   // 初始状态为待回答
      answer: null,                        // 初始无回答
      createdAt: new Date().toISOString(), // 记录创建时间
      answeredAt: null,                    // 初始无回答时间
    };

    data.questions.push(q); // 追加到问题列表
    await this.saveData(data); // 持久化
    log.info(`ClarificationEngine: Spec ${specId} 新增问题 ${q.id}`); // 记录日志
    return q;
  }

  /**
   * 回答澄清问题
   * @param specId 关联 Spec ID
   * @param questionId 问题 ID
   * @param answer 回答内容
   */
  async answerQuestion(specId: string, questionId: string, answer: string): Promise<ClarificationQuestion> {
    const data = await this.loadData(specId); // 读取现有数据

    const q = data.questions.find(q => q.id === questionId); // 查找问题
    if (!q) throw new Error(`问题 "${questionId}" 在 Spec "${specId}" 中不存在`); // 不存在报错

    q.status = 'answered';                      // 更新状态为已回答
    q.answer = answer;                          // 设置回答内容
    q.answeredAt = new Date().toISOString();    // 记录回答时间
    await this.saveData(data); // 持久化
    log.info(`ClarificationEngine: 问题 ${questionId} 已回答`); // 记录日志
    return q;
  }

  /**
   * 列出问题（支持按状态过滤）
   * @param specId 关联 Spec ID
   * @param status 过滤状态（不传则返回全部）
   */
  async listQuestions(specId: string, status?: QuestionStatus): Promise<ClarificationQuestion[]> {
    const data = await this.loadData(specId); // 读取数据
    if (!status) return data.questions; // 不过滤则返回全部
    return data.questions.filter(q => q.status === status); // 按状态过滤
  }

  /**
   * 获取所有未回答问题
   * @param specId 关联 Spec ID
   */
  async getUnanswered(specId: string): Promise<ClarificationQuestion[]> {
    return this.listQuestions(specId, 'pending'); // 过滤状态为 pending 的问题
  }
}
