/**
 * AgentOrchestrator - 多 Agent 编排框架（原型）
 *
 * 定义 Coordinator/Specialist/Verifier 角色，支持任务分派和状态查询。
 * v18.0 前瞻性原型，为后续多 Agent 协作奠定基础。
 * v19.0 Phase 5: 新增 Persona 系统和 Party Mode 多角色协作会话。
 * v20.0 P4-5/P4-6/P4-7: 新增 partyDebate 多角色辩论和 partyConsensus 共识提取。
 *
 * 函数列表:
 * - defineAgent()        定义一个 Agent 角色
 * - assignTask()         为 Agent 分配任务
 * - listAgents()         列出所有已定义的 Agent
 * - getAgent()           获取指定 Agent 详情
 * - save()               持久化 Agent 到磁盘
 * - load()               从磁盘加载 Agent
 * - listPersonas()       列出所有内置 Persona
 * - getPersona()         获取指定 Persona
 * - createPartySession() 创建 Party 多角色协作会话
 * - getPartySession()    获取 Party 会话详情
 * - addPartyMessage()    向 Party 会话添加消息
 * - partyDebate()        v20.0 P4-5/P4-6: 多角色辩论，模拟每个参与者发表观点
 * - partyConsensus()     v20.0 P4-7: 从 Party 辩论中提取共识与分歧点
 */

import { log } from '../utils/logger.js'; // 日志工具
import path from 'node:path';                               // v19.0: 路径工具（持久化）
import { readJSON, writeJSON } from '../utils/file-io.js'; // v19.0: 文件读写工具（持久化）
import type { PartySession } from '../schemas/persona.js'; // v19.0: Party 会话类型
import { QFLOW_DIR } from '../shared/tool-utils.js';       // v23.1: .qflow 目录常量，消除魔术字符串

/** Agent 角色类型 */
export type AgentRole = 'coordinator' | 'specialist' | 'verifier';

/** Agent 状态 */
export type AgentStatus = 'idle' | 'working' | 'blocked' | 'completed';

/** Agent 定义 */
export interface AgentDefinition {
  id: string;           // Agent 唯一标识
  name: string;         // Agent 显示名称
  role: AgentRole;      // 角色类型
  status: AgentStatus;  // 当前状态
  description: string;  // 职责描述
  assignedTasks: string[]; // 已分配的任务 ID 列表
  createdAt: string;    // 创建时间
}

/** v19.0: 内置 Persona 定义类型 */
interface BuiltinPersona {
  id: string;           // 角色ID，如 PM/ARCH/DEV
  name: string;         // 中文显示名称
  role: string;         // 英文角色描述
  expertise: string[];  // 专业领域列表
  systemPrompt: string; // 角色系统提示词
  reviewFocus: string[]; // 评审关注点
}

/**
 * AgentOrchestrator 类 - 多 Agent 编排器
 *
 * 在内存中管理 Agent 定义和任务分派，不持久化（原型阶段）。
 * v19.0 新增：内置 Persona 角色库 + Party 多角色协作会话。
 */
export class AgentOrchestrator {
  /** Agent 注册表 */
  private agents = new Map<string, AgentDefinition>(); // Agent 存储

  // ─── v19.0: Persona 系统 ─────────────────────────────

  /** 内置 Persona 定义列表（12 个专业角色） */
  private static readonly BUILTIN_PERSONAS: BuiltinPersona[] = [
    {
      id: 'PM',
      name: '产品经理',
      role: 'Product Manager',
      expertise: ['需求分析', '用户故事', '优先级排序'],
      systemPrompt: '你是产品经理，关注用户价值和业务目标',
      reviewFocus: ['需求完整性', '用户体验'],
    },
    {
      id: 'ARCH',
      name: '架构师',
      role: 'Software Architect',
      expertise: ['系统设计', '技术选型', '性能优化'],
      systemPrompt: '你是架构师，关注系统可扩展性和技术债',
      reviewFocus: ['架构合理性', '可扩展性'],
    },
    {
      id: 'DEV',
      name: '开发工程师',
      role: 'Developer',
      expertise: ['编码实现', '代码审查', '单元测试'],
      systemPrompt: '你是开发工程师，关注代码质量和可维护性',
      reviewFocus: ['代码质量', '可维护性'],
    },
    {
      id: 'QA',
      name: '测试工程师',
      role: 'QA Engineer',
      expertise: ['测试策略', 'Bug 追踪', '自动化测试'],
      systemPrompt: '你是测试工程师，关注功能完整性和边界情况',
      reviewFocus: ['测试覆盖', '边界情况'],
    },
    {
      id: 'UX',
      name: 'UX 设计师',
      role: 'UX Designer',
      expertise: ['交互设计', '用户研究', '可用性'],
      systemPrompt: '你是UX设计师，关注用户体验和交互流畅性',
      reviewFocus: ['交互流畅', '视觉一致'],
    },
    {
      id: 'SEC',
      name: '安全工程师',
      role: 'Security Engineer',
      expertise: ['安全审计', '渗透测试', '合规'],
      systemPrompt: '你是安全工程师，关注安全漏洞和数据保护',
      reviewFocus: ['安全漏洞', '数据保护'],
    },
    {
      id: 'DBA',
      name: '数据库工程师',
      role: 'Database Engineer',
      expertise: ['数据建模', '查询优化', '数据迁移'],
      systemPrompt: '你是DBA，关注数据完整性和查询性能',
      reviewFocus: ['数据模型', '查询性能'],
    },
    {
      id: 'DEVOPS',
      name: 'DevOps 工程师',
      role: 'DevOps Engineer',
      expertise: ['CI/CD', '容器化', '监控'],
      systemPrompt: '你是DevOps工程师，关注部署效率和系统稳定性',
      reviewFocus: ['部署流程', '监控告警'],
    },
    {
      id: 'FE',
      name: '前端工程师',
      role: 'Frontend Developer',
      expertise: ['UI 开发', '响应式设计', '性能优化'],
      systemPrompt: '你是前端工程师，关注页面性能和用户体验',
      reviewFocus: ['页面性能', '浏览器兼容'],
    },
    {
      id: 'BE',
      name: '后端工程师',
      role: 'Backend Developer',
      expertise: ['API 设计', '微服务', '并发处理'],
      systemPrompt: '你是后端工程师，关注API设计和系统性能',
      reviewFocus: ['API 规范', '并发安全'],
    },
    {
      id: 'MOBILE',
      name: '移动端工程师',
      role: 'Mobile Developer',
      expertise: ['iOS/Android', '跨平台', '移动性能'],
      systemPrompt: '你是移动端工程师，关注移动端体验和性能',
      reviewFocus: ['移动适配', '内存管理'],
    },
    {
      id: 'DATA',
      name: '数据工程师',
      role: 'Data Engineer',
      expertise: ['数据管道', 'ETL', '数据仓库'],
      systemPrompt: '你是数据工程师，关注数据质量和管道可靠性',
      reviewFocus: ['数据质量', '管道可靠'],
    },
  ];

  /** v19.0: Party 会话存储（内存） */
  private partySessions = new Map<string, PartySession>(); // 会话 ID -> 会话对象

  /**
   * 定义一个新的 Agent
   *
   * @param id          - Agent ID
   * @param name        - Agent 名称
   * @param role        - 角色：coordinator/specialist/verifier
   * @param description - 职责描述
   * @returns 创建的 Agent 定义
   */
  defineAgent(id: string, name: string, role: AgentRole, description: string): AgentDefinition {
    if (this.agents.has(id)) { // 检查重复
      throw new Error(`Agent "${id}" 已存在`); // 抛出异常
    }
    const agent: AgentDefinition = {
      id,
      name,
      role,
      status: 'idle', // 初始状态为空闲
      description,
      assignedTasks: [], // 初始无任务
      createdAt: new Date().toISOString(), // 记录创建时间
    };
    this.agents.set(id, agent); // 注册 Agent
    log.info(`AgentOrchestrator: 已定义 Agent "${name}" (${role})`); // 日志
    return agent;
  }

  /**
   * 为 Agent 分配任务
   *
   * @param agentId - Agent ID
   * @param taskId  - 任务 ID
   * @returns 更新后的 Agent 定义
   */
  assignTask(agentId: string, taskId: string): AgentDefinition {
    const agent = this.agents.get(agentId); // 查找 Agent
    if (!agent) throw new Error(`Agent "${agentId}" 不存在`); // 不存在时抛出
    if (!agent.assignedTasks.includes(taskId)) { // 避免重复分配
      agent.assignedTasks.push(taskId); // 添加任务
    }
    agent.status = 'working'; // 更新状态为工作中
    log.info(`AgentOrchestrator: 已为 Agent "${agent.name}" 分配任务 ${taskId}`); // 日志
    return agent;
  }

  /**
   * 列出所有已定义的 Agent
   *
   * @returns Agent 定义数组
   */
  listAgents(): AgentDefinition[] {
    return Array.from(this.agents.values()); // 转为数组返回
  }

  /**
   * 获取指定 Agent 详情
   *
   * @param agentId - Agent ID
   * @returns Agent 定义或 null
   */
  getAgent(agentId: string): AgentDefinition | null {
    return this.agents.get(agentId) ?? null; // 返回 Agent 或 null
  }

  /**
   * 将所有 Agent 定义持久化到磁盘
   *
   * v19.0 技术债修复：补全 AgentOrchestrator 持久化能力。
   * 将内存中的 Agent 列表写入 {projectRoot}/.qflow/agents.json。
   *
   * @param projectRoot - 项目根目录绝对路径
   */
  async save(projectRoot: string): Promise<void> {
    const filePath = path.join(projectRoot, QFLOW_DIR, 'agents.json'); // 持久化文件路径
    const data = Array.from(this.agents.values()); // 转为数组（Map -> Array）
    await writeJSON(filePath, data); // 原子写入
    log.info(`AgentOrchestrator: 已保存 ${data.length} 个 Agent 到磁盘`); // 日志
  }

  /**
   * 从磁盘加载 Agent 定义到内存
   *
   * v19.0 技术债修复：补全 AgentOrchestrator 加载能力。
   * 从 {projectRoot}/.qflow/agents.json 读取并恢复 agents Map。
   *
   * @param projectRoot - 项目根目录绝对路径
   */
  async load(projectRoot: string): Promise<void> {
    const filePath = path.join(projectRoot, QFLOW_DIR, 'agents.json'); // 持久化文件路径
    const data = await readJSON<AgentDefinition[]>(filePath); // 读取 JSON 文件
    if (data) {
      this.agents.clear(); // 清空当前内存数据
      for (const agent of data) {
        this.agents.set(agent.id, agent); // 逐个恢复到 Map
      }
      log.info(`AgentOrchestrator: 已从磁盘加载 ${data.length} 个 Agent`); // 日志
    }
  }

  // ─── v19.0: Persona 系统方法 ─────────────────────────────

  /**
   * 列出所有内置 Persona
   *
   * @returns 内置 Persona 数组（12 个专业角色）
   */
  listPersonas(): BuiltinPersona[] {
    return AgentOrchestrator.BUILTIN_PERSONAS; // 返回完整内置角色列表
  }

  /**
   * 获取指定 Persona
   *
   * @param personaId - Persona ID，如 PM/ARCH/DEV
   * @returns Persona 对象或 null（不存在时）
   */
  getPersona(personaId: string): BuiltinPersona | null {
    return AgentOrchestrator.BUILTIN_PERSONAS.find(p => p.id === personaId) ?? null; // 线性查找
  }

  /**
   * 创建 Party 多角色协作会话
   *
   * @param name           - 会话名称
   * @param participantIds - 参与的 Persona ID 列表（至少 2 个有效 ID）
   * @param topic          - 讨论主题
   * @returns 新创建的 Party 会话对象
   * @throws 有效参与者少于 2 个时抛出错误
   */
  createPartySession(name: string, participantIds: string[], topic: string): PartySession {
    // 过滤无效 Persona ID（必须是内置角色之一）
    const validIds = participantIds.filter(id =>
      AgentOrchestrator.BUILTIN_PERSONAS.some(p => p.id === id) // 检查 ID 是否在内置列表中
    );
    if (validIds.length < 2) { // 至少需要 2 个有效参与者
      throw new Error('Party 会话至少需要 2 个有效参与者'); // 校验失败抛出
    }

    const session: PartySession = {
      id: `PARTY-${Date.now().toString(36)}-${String(Math.random()).slice(2, 6)}`, // v20.0 P0-12: 时间戳+随机数防冲突
      name,                          // 会话名称
      participants: validIds,        // 有效参与者 ID 列表
      topic,                         // 讨论主题
      messages: [],                  // 初始消息列表为空
      status: 'active',              // 初始状态为活跃
      createdAt: new Date().toISOString(), // 创建时间
    };

    this.partySessions.set(session.id, session); // 存入内存
    log.info(`AgentOrchestrator: 创建 Party 会话 "${name}" (${validIds.join(',')})`); // 日志
    return session;
  }

  /**
   * 获取 Party 会话
   *
   * @param sessionId - 会话 ID
   * @returns 会话对象或 null（不存在时）
   */
  getPartySession(sessionId: string): PartySession | null {
    return this.partySessions.get(sessionId) ?? null; // 返回会话或 null
  }

  /**
   * v20.0 P0-10: 持久化 Party 会话到磁盘
   *
   * 将内存中的 Party 会话列表写入 {projectRoot}/.qflow/party-sessions.json。
   *
   * @param projectRoot - 项目根目录绝对路径
   */
  async savePartySessions(projectRoot: string): Promise<void> {
    const filePath = path.join(projectRoot, QFLOW_DIR, 'party-sessions.json'); // 持久化路径
    const data = Array.from(this.partySessions.values()); // Map → Array
    await writeJSON(filePath, data); // 原子写入
    log.info(`AgentOrchestrator: 已保存 ${data.length} 个 Party 会话到磁盘`); // 日志
  }

  /**
   * v20.0 P0-11: 从磁盘加载 Party 会话
   *
   * 从 {projectRoot}/.qflow/party-sessions.json 读取并恢复 partySessions Map。
   *
   * @param projectRoot - 项目根目录绝对路径
   */
  async loadPartySessions(projectRoot: string): Promise<void> {
    const filePath = path.join(projectRoot, QFLOW_DIR, 'party-sessions.json'); // 持久化路径
    const data = await readJSON<PartySession[]>(filePath); // 读取 JSON
    if (data) {
      this.partySessions.clear(); // 清空当前内存数据
      for (const session of data) {
        this.partySessions.set(session.id, session); // 逐个恢复到 Map
      }
      log.info(`AgentOrchestrator: 已从磁盘加载 ${data.length} 个 Party 会话`); // 日志
    }
  }

  /**
   * 向 Party 会话添加消息
   *
   * @param sessionId - 会话 ID
   * @param personaId - 发言 Persona ID
   * @param content   - 消息内容
   * @returns 更新后的会话对象
   * @throws 会话不存在或 Persona 不在会话中时抛出
   */
  addPartyMessage(sessionId: string, personaId: string, content: string): PartySession {
    const session = this.partySessions.get(sessionId); // 查找会话
    if (!session) throw new Error(`Party 会话 ${sessionId} 不存在`); // 会话不存在报错
    if (!session.participants.includes(personaId)) { // 检查 Persona 是否在会话中
      throw new Error(`Persona ${personaId} 不在会话 ${sessionId} 中`); // 不在会话中报错
    }

    session.messages.push({ // 追加消息
      personaId,                          // 发言角色 ID
      content,                            // 消息内容
      timestamp: new Date().toISOString(), // 发言时间
    });

    log.info(`AgentOrchestrator: Party ${sessionId} 收到 ${personaId} 的消息`); // 日志
    return session; // 返回更新后的会话
  }

  /**
   * v20.0 P4-5/P4-6: 多角色辩论 — 模拟 Party 中每个参与者角色进行辩论
   * 每个参与者基于其 persona 角色生成观点，通过 callAI 驱动
   * @param sessionId - Party 会话 ID
   * @param topic - 辩论主题
   * @param callAI - AI 调用回调（可选，无则返回模板观点）
   * @returns 辩论结果
   */
  async partyDebate(sessionId: string, topic: string, callAI?: (prompt: string) => Promise<{ content: string }>): Promise<{
    sessionId: string;
    topic: string;
    rounds: Array<{
      personaId: string;
      personaName: string;
      role: string;
      viewpoint: string;
    }>;
    summary: string;
  }> {
    const session = this.partySessions.get(sessionId); // 查找会话
    if (!session) throw new Error(`Party session ${sessionId} not found`); // 会话不存在报错

    const rounds: Array<{ personaId: string; personaName: string; role: string; viewpoint: string }> = []; // 辩论轮次结果列表

    for (const pid of session.participants) { // 遍历每个参与者
      const persona = this.getPersona(pid); // 获取 Persona 定义
      const personaName = persona?.name || pid; // 显示名称，降级到 ID
      const role = persona?.role || 'participant'; // 角色描述，降级到默认值

      let viewpoint: string; // 当前参与者的观点
      if (callAI) { // 有 AI 回调时走 AI 生成
        try {
          const prompt = `你是 ${personaName}（角色: ${role}）。请就以下主题发表你的观点：\n\n主题: ${topic}\n\n请从你的专业角度（${role}）给出简洁观点（100字以内）。`; // 构造角色提示词
          const result = await callAI(prompt); // 调用 AI 生成观点
          viewpoint = result.content; // 取 AI 返回内容
        } catch {
          viewpoint = `[${personaName}] 作为 ${role}，我认为 ${topic} 需要从${role}角度审慎考虑。`; // AI 调用失败时降级到模板观点
        }
      } else {
        viewpoint = `[${personaName}] 作为 ${role}，我认为 ${topic} 需要从${role}角度审慎考虑。`; // 无 AI 回调时使用模板观点
      }

      // 记录到 session（调用已有方法复用校验逻辑）
      this.addPartyMessage(sessionId, pid, viewpoint);
      rounds.push({ personaId: pid, personaName, role, viewpoint }); // 追加到辩论轮次列表
    }

    const summary = `辩论主题: ${topic}，共 ${rounds.length} 位参与者发言。`; // 生成辩论摘要
    log.info(`AgentOrchestrator: Party ${sessionId} 辩论结束，${rounds.length} 位参与者发言`); // 日志
    return { sessionId, topic, rounds, summary }; // 返回辩论结果
  }

  /**
   * v20.0 P4-7: 共识提取 — 从 Party 辩论中提取共识
   * @param sessionId - Party 会话 ID
   * @returns 共识结果
   */
  partyConsensus(sessionId: string): {
    sessionId: string;
    participantCount: number;
    messageCount: number;
    consensusPoints: string[];
    dissensionPoints: string[];
    recommendation: string;
  } {
    const session = this.partySessions.get(sessionId); // 查找会话
    if (!session) throw new Error(`Party session ${sessionId} not found`); // 会话不存在报错

    const messages = session.messages || []; // 取消息列表，防御性空值处理
    const participants = new Set(messages.map(m => m.personaId)); // 提取所有发言参与者 ID 集合

    // 统计每个词语被哪些参与者提及（词频 Map: word -> Set<personaId>）
    const wordFreq = new Map<string, Set<string>>();
    for (const msg of messages) { // 遍历所有消息
      const words = msg.content.split(/[\s,，。.!！?？]+/).filter(w => w.length > 2); // 分词并过滤短词
      for (const w of words) { // 遍历每个词
        if (!wordFreq.has(w)) wordFreq.set(w, new Set()); // 初始化词频集合
        wordFreq.get(w)!.add(msg.personaId); // 记录该词被哪个参与者提及
      }
    }

    const consensusPoints: string[] = []; // 共识点列表（多数参与者认同）
    const dissensionPoints: string[] = []; // 分歧点列表（仅个别参与者提及）

    for (const [word, speakers] of wordFreq) { // 遍历词频统计
      if (speakers.size >= Math.ceil(participants.size * 0.7)) { // 70% 以上参与者提及 → 共识
        consensusPoints.push(word);
      } else if (speakers.size === 1 && participants.size > 2) { // 仅一人提及且总人数 >2 → 分歧
        dissensionPoints.push(`${word} (仅 ${[...speakers][0]} 提及)`);
      }
    }

    // 根据共识点和分歧点数量给出建议
    const recommendation = consensusPoints.length > dissensionPoints.length
      ? '多数参与者达成共识，建议采纳主流观点' // 共识多于分歧
      : '存在较大分歧，建议进一步讨论或分阶段实施'; // 分歧多于共识

    log.info(`AgentOrchestrator: Party ${sessionId} 共识提取完成，共识点 ${consensusPoints.length} 个，分歧点 ${dissensionPoints.length} 个`); // 日志

    return {
      sessionId,
      participantCount: participants.size,        // 参与发言的角色数
      messageCount: messages.length,              // 消息总数
      consensusPoints: consensusPoints.slice(0, 10),  // 取前 10 个共识点
      dissensionPoints: dissensionPoints.slice(0, 10), // 取前 10 个分歧点
      recommendation,                             // 最终建议
    };
  }
}
