/**
 * ConstitutionManager - 项目治理原则管理
 *
 * 管理不可变的项目级治理原则，约束所有 Spec/Plan/Task 生成。
 * 持久化到 {projectRoot}/.qflow/constitution.json
 *
 * 函数列表:
 * - init()           初始化 Constitution（已存在时会覆盖重置）
 * - get()            获取治理原则列表（文件不存在时自动初始化）
 * - set()            添加一个新原则（自动生成 ID）
 * - remove()         移除非不可变原则（不可变原则会抛出异常）
 * - validate()       同步快速校验（仅做基础关键词匹配，需外部传入原则）
 * - validateAsync()  异步完整校验（自动读取文件中的原则进行匹配）
 */

import path from 'node:path';                                               // 路径工具
import {                                                                      // Schema 类型
  ConstitutionSchema,
  ConstitutionPrincipleSchema,
  type Constitution,
  type ConstitutionPrinciple,
} from '../schemas/constitution.js';
import { readJSON, writeJSON, ensureDir } from '../utils/file-io.js';        // 文件读写工具
import { log } from '../utils/logger.js';                                    // 日志工具
import { QFLOW_DIR } from '../shared/tool-utils.js';                        // .qflow 目录名常量
import { CONSTITUTION_MAX_PRINCIPLES } from '../shared/constants.js';       // 最大原则数常量

/** Constitution 持久化文件名 */
const CONSTITUTION_FILE = 'constitution.json';

/**
 * ConstitutionManager 类 - 项目治理原则管理器
 *
 * 在 .qflow/constitution.json 中持久化存储治理原则，
 * 支持初始化、读取、添加、移除和内容校验操作。
 */
export class ConstitutionManager {
  private projectRoot: string; // 项目根目录路径

  /**
   * 构造函数
   * @param projectRoot - 项目根目录绝对路径
   */
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot; // 保存项目根目录
  }

  /**
   * 获取 constitution.json 的完整路径
   * @returns 文件绝对路径
   */
  private filePath(): string {
    return path.join(this.projectRoot, QFLOW_DIR, CONSTITUTION_FILE); // 拼接文件路径
  }

  /**
   * 初始化 Constitution 文件
   *
   * 创建空的 Constitution，如果文件已存在将被覆盖重置。
   * @param projectName - 可选项目名称，不传时使用目录名
   * @returns 初始化的 Constitution 对象
   */
  async init(projectName?: string): Promise<Constitution> {
    const name = projectName ?? path.basename(this.projectRoot); // 使用传入名或目录名
    const now = new Date().toISOString();                         // 当前 ISO 时间戳
    const constitution: Constitution = ConstitutionSchema.parse({ // 通过 Zod 校验构建对象
      version: '1.0',
      projectName: name,
      principles: [],  // 初始无原则
      createdAt: now,
      updatedAt: now,
    });
    await ensureDir(path.join(this.projectRoot, QFLOW_DIR));      // 确保 .qflow 目录存在
    await writeJSON(this.filePath(), constitution);                // 持久化到磁盘
    log.info(`ConstitutionManager: 已初始化 Constitution (project=${name})`); // 日志
    return constitution;
  }

  /**
   * 获取当前 Constitution（文件不存在时自动初始化）
   *
   * @returns Constitution 对象
   * @throws 如果文件存在但格式非法
   */
  async get(): Promise<Constitution> {
    const raw = await readJSON<unknown>(this.filePath()); // 读取原始 JSON
    if (raw === null) {
      return this.init(); // 文件不存在时自动初始化
    }
    const parsed = ConstitutionSchema.safeParse(raw);     // Zod 安全校验
    if (!parsed.success) {
      throw new Error(`constitution.json 校验失败: ${parsed.error.message}`); // 格式非法抛出
    }
    return parsed.data; // 返回校验通过的数据
  }

  /**
   * 添加一个新的治理原则
   *
   * 自动生成 ID（格式: CP-001），数量达到上限时抛出异常。
   * @param principle - 原则属性（不含 id 和 createdAt，会自动生成）
   * @returns 更新后的 Constitution 对象
   * @throws 原则数量达到 CONSTITUTION_MAX_PRINCIPLES 上限时
   */
  async set(principle: Omit<ConstitutionPrinciple, 'id' | 'createdAt'>): Promise<Constitution> {
    const constitution = await this.get(); // 先读取当前状态
    if (constitution.principles.length >= CONSTITUTION_MAX_PRINCIPLES) {
      throw new Error(`原则数量已达上限 (${CONSTITUTION_MAX_PRINCIPLES})`); // 超限抛出
    }
    const id = `CP-${String(constitution.principles.length + 1).padStart(3, '0')}`; // 生成 ID: CP-001
    const newPrinciple: ConstitutionPrinciple = ConstitutionPrincipleSchema.parse({ // Zod 校验新原则
      ...principle,
      id,
      createdAt: new Date().toISOString(), // 自动设置创建时间
    });
    constitution.principles.push(newPrinciple);              // 追加到列表
    constitution.updatedAt = new Date().toISOString();       // 更新 updatedAt
    await writeJSON(this.filePath(), constitution);           // 持久化
    log.info(`ConstitutionManager: 已添加原则 ${id}: ${principle.content.substring(0, 50)}`); // 日志（截断内容）
    return constitution;
  }

  /**
   * 移除一个治理原则（仅允许移除非不可变原则）
   *
   * @param principleId - 要移除的原则 ID（如 "CP-001"）
   * @returns 更新后的 Constitution 对象
   * @throws 原则不存在或原则为不可变时
   */
  async remove(principleId: string): Promise<Constitution> {
    const constitution = await this.get();                   // 先读取当前状态
    const idx = constitution.principles.findIndex(p => p.id === principleId); // 查找索引
    if (idx === -1) throw new Error(`原则 "${principleId}" 不存在`); // 不存在抛出
    const principle = constitution.principles[idx];          // 获取原则对象
    if (principle.immutable) throw new Error(`原则 "${principleId}" 是不可变的，无法移除`); // 不可变抛出
    constitution.principles.splice(idx, 1);                  // 从列表中删除
    constitution.updatedAt = new Date().toISOString();       // 更新 updatedAt
    await writeJSON(this.filePath(), constitution);           // 持久化
    log.info(`ConstitutionManager: 已移除原则 ${principleId}`); // 日志
    return constitution;
  }

  /**
   * 同步快速校验（基础关键词匹配）
   *
   * 注意：此方法不读取文件，只做模式匹配，适合外部已加载原则时使用。
   * 如需完整校验请使用 validateAsync()。
   *
   * @param content - 待校验的内容字符串
   * @returns 校验结果（valid 为 true 表示无违规）
   */
  validate(content: string): { valid: boolean; violations: Array<{ principleId: string; content: string; severity: string }> } {
    // 同步方法：不读文件，直接返回通过（调用方若需完整校验应使用 validateAsync）
    return { valid: true, violations: [] }; // 同步版本仅返回通过（无法异步读文件）
  }

  /**
   * 异步完整校验（读取文件中的原则进行关键词匹配）
   *
   * 支持中文"禁止X"格式和英文"must not X"格式的规则匹配。
   *
   * @param content - 待校验的内容字符串
   * @returns 校验结果，包含 valid 标志和违规列表
   */
  async validateAsync(content: string): Promise<{ valid: boolean; violations: Array<{ principleId: string; content: string; severity: string }> }> {
    const constitution = await this.get();                   // 读取所有原则
    const violations: Array<{ principleId: string; content: string; severity: string }> = []; // 违规列表
    const lowerContent = content.toLowerCase();              // 内容小写化便于不区分大小写匹配

    for (const principle of constitution.principles) {
      // 中文格式匹配：提取"禁止X"中的 X 关键词，检查内容是否包含
      const keywords = principle.content.match(/禁止\s*(.+?)(?:[,，。.;；]|$)/g);
      if (keywords) {
        for (const kw of keywords) {
          const forbidden = kw.replace(/^禁止\s*/, '').replace(/[,，。.;；]$/, '').trim(); // 提取禁止的内容
          if (forbidden && lowerContent.includes(forbidden.toLowerCase())) { // 不区分大小写匹配
            violations.push({
              principleId: principle.id,                     // 违反的原则 ID
              content: principle.content,                    // 原则内容
              severity: principle.severity,                  // 严重性
            });
          }
        }
      }
      // 英文格式匹配：提取 "must not X" / "shall not X" 中的 X 关键词
      const mustNotMatch = principle.content.match(/must not\s+(.+?)(?:[,.]|$)/gi);
      if (mustNotMatch) {
        for (const mn of mustNotMatch) {
          const forbidden = mn.replace(/^must not\s+/i, '').replace(/[,.]$/, '').trim(); // 提取禁止内容
          if (forbidden && lowerContent.includes(forbidden.toLowerCase())) { // 匹配检查
            violations.push({
              principleId: principle.id,                     // 违反的原则 ID
              content: principle.content,                    // 原则内容
              severity: principle.severity,                  // 严重性
            });
          }
        }
      }
    }

    return { valid: violations.length === 0, violations }; // 无违规则 valid=true
  }
}
