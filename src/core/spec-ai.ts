/**
 * SpecAI - Spec AI 能力和探索性 Spec 子模块
 *
 * 职责：AI 生成 Spec、探索性 Spec 管理、依赖图可视化等高级功能
 * 子模块函数列表:
 * - generateFromCodebase()  从现有代码自动生成 Spec（使用 AI）
 * - specProposeFull()       一站式创建完整 Spec（含 proposal/design/tasks）
 * - getInstructions()       获取 Spec 的指令内容
 * - initExploreSpec()       创建探索性 Spec（不影响主库）
 * - listExploreSpecs()      列出所有探索性 Spec
 * - promoteExploreSpec()    将探索性 Spec 提升为正式 Spec
 * - getDependencyGraph()    获取跨 Spec 依赖图（Mermaid 格式）
 * - getArtifactDAGStatus()  获取 Spec 依赖 DAG 状态
 * - fastForward()           为 Spec 各 section 快速生成规划产物（v20.0 P2-10）
 *
 * 依赖注入：
 * - callAI: CallAIFn  从外部注入 AI 调用函数（v23.0: 所有方法已改为模板路径，callAI 不再被调用）
 */

import path from 'node:path'; // 路径拼接工具
import { promises as fs } from 'node:fs'; // 异步文件操作
import { type Spec, SpecSchema } from '../schemas/spec.js'; // Spec schema 和类型
import { readJSON, writeJSON, ensureDir, fileExists, withFileLock } from '../utils/file-io.js'; // 文件工具 + 文件锁
import { log } from '../utils/logger.js'; // 日志工具
import { uniqueId, QFLOW_DIR, sanitizeId, assertPathWithinRoot } from '../shared/tool-utils.js'; // 工具函数
import { GEN_FROM_CODE_MAX_FILES, GEN_FROM_CODE_MAX_CHARS, MERMAID_LABEL_MAX_LENGTH } from '../shared/constants.js'; // v16.0 Q-3: 硬编码值常量化（v23.0: 移除 AI_GEN_SPEC_MAX_TOKENS）
import type { SpecCrud } from './spec-crud.js'; // CRUD 子模块类型

/**
 * AI 调用函数类型定义（SM-6: 通过构造函数注入，消除动态 import）
 */
export type CallAIFn = (prompt: string, options?: { systemPrompt?: string; maxTokens?: number }) => Promise<{ content: string }>;

/**
 * SpecAI 类 - 处理 Spec 的 AI 生成和探索性 Spec 管理
 *
 * 通过构造函数注入 SpecCrud 和 callAI 函数，实现对 AI 提供者的解耦。
 */
export class SpecAI {
  /**
   * @param projectRoot - 项目根目录绝对路径
   * @param crud        - SpecCrud 实例，用于读取/创建 Spec 数据
   * @param callAI      - AI 调用函数（SM-6: 依赖注入，不再动态 import ai-provider.js）
   */
  constructor(
    private projectRoot: string,
    private crud: SpecCrud, // 依赖注入 SpecCrud
    private callAI: CallAIFn, // 依赖注入 AI 调用函数（SM-6）
  ) {}

  /**
   * 获取 Spec 的指令内容
   *
   * 读取 Spec 的 Markdown 正文，附加关联信息作为上下文。
   *
   * @param specId - Spec ID
   * @returns 拼接后的指令文本
   */
  async getInstructions(specId: string): Promise<string> {
    sanitizeId(specId, 'Spec ID'); // 防止路径遍历攻击
    const spec = await this.crud.getSpec(specId); // 加载 Spec
    if (!spec) throw new Error(`Spec ${specId} 不存在`); // 校验存在

    const mdPath = path.join(this.crud.specsDir, specId, 'spec.md'); // Markdown 文件路径
    let mdContent = spec.content; // 默认用 JSON 中的 content
    if (await fileExists(mdPath)) { // Markdown 文件存在
      mdContent = await fs.readFile(mdPath, 'utf-8'); // 优先使用 Markdown 文件内容
    }

    // 拼接指令文本
    const lines: string[] = [
      `# ${spec.name}`, // 标题
      `类型: ${spec.type} | 状态: ${spec.status} | 版本: v${spec.version}`, // 元信息
      '', // 空行
      mdContent, // 正文内容
    ];

    if (spec.dependencies.length > 0) { // 有依赖
      lines.push('', `## 依赖`, spec.dependencies.map((d) => `- ${d}`).join('\n')); // 追加依赖列表
    }
    if (spec.targetFiles.length > 0) { // 有关联文件
      lines.push('', `## 关联文件`, spec.targetFiles.map((f) => `- ${f}`).join('\n')); // 追加文件列表
    }

    return lines.join('\n'); // 合并返回
  }

  /**
   * 创建探索性 Spec（不影响主库）
   *
   * 在 .qflow/specs-explore/ 目录下创建草稿 Spec，
   * 允许自由修改而不影响正式 Spec 库。
   *
   * @param name        - Spec 名称
   * @param type        - Spec 类型
   * @param description - Spec 描述
   * @returns 探索性 Spec 对象（含 explore 标记）
   */
  async initExploreSpec(name: string, type: Spec['type'], description: string): Promise<Spec & { explore: true }> {
    const exploreDir = path.join(this.projectRoot, QFLOW_DIR, 'specs-explore'); // 探索目录
    await ensureDir(exploreDir); // 确保目录存在

    const id = `EX-${uniqueId('S')}`; // 探索性 Spec ID 前缀 EX-
    const now = new Date().toISOString(); // 当前时间戳

    const spec: Spec & { explore: true } = { // 构造探索性 Spec
      id,
      name: `[探索] ${name}`,
      type,
      status: 'draft',
      content: description,
      dependencies: [],
      targetFiles: [],
      taskIds: [],
      requires: [], // v12.0: DAG 依赖声明（初始为空）
      rigor: 'full', // v12.0: 验证严格度（默认 full）
      designSeparated: false, // v13.0 E-4: Design 段未分离
      createdAt: now,
      updatedAt: now,
      version: 1,
      explore: true, // 探索标记
    };

    const specDir = path.join(exploreDir, id); // 探索 Spec 目录
    await ensureDir(specDir);
    await writeJSON(path.join(specDir, 'spec.json'), spec); // 写入 JSON
    await withFileLock(path.join(specDir, 'spec.md'), async () => { // v14.0 L-5: 探索性 Spec 的 Markdown 写入加锁
      await fs.writeFile(path.join(specDir, 'spec.md'), description, 'utf-8'); // 写入 Markdown
    });
    log.info(`探索性 Spec 已创建: ${id} - ${name}`); // 信息日志
    return spec;
  }

  /**
   * 列出所有探索性 Spec
   *
   * @returns 探索性 Spec 列表
   */
  async listExploreSpecs(): Promise<Spec[]> {
    const exploreDir = path.join(this.projectRoot, QFLOW_DIR, 'specs-explore');
    if (!(await fileExists(exploreDir))) return []; // 目录不存在返回空列表

    const entries = await fs.readdir(exploreDir, { withFileTypes: true }); // 读取目录内容
    const specs: Spec[] = []; // 结果列表

    for (const entry of entries) { // 遍历每个条目
      if (!entry.isDirectory()) continue; // 跳过非目录
      const specPath = path.join(exploreDir, entry.name, 'spec.json'); // spec.json 路径
      const raw = await readJSON<unknown>(specPath); // 读取文件
      if (!raw) continue; // 文件不存在或读取失败
      const parsed = SpecSchema.safeParse(raw); // Zod 校验
      if (parsed.success) specs.push(parsed.data); // 校验通过则追加
    }

    return specs; // 返回列表
  }

  /**
   * 将探索性 Spec 提升为正式 Spec（v15.0 OS-6）
   *
   * 把 .qflow/specs-explore/{exploreSpecId}/ 目录整体移动到
   * .qflow/specs/{exploreSpecId}/，使探索性 Spec 进入正式库。
   * 移动后通过 getSpec() 重新加载验证数据完整性。
   *
   * @param exploreSpecId - 探索性 Spec 的 ID（不含 explore 前缀）
   * @returns 提升后的正式 Spec 对象
   * @throws 探索性 Spec 不存在时抛出错误
   * @throws 目标 Spec ID 在正式库中已存在时抛出错误
   */
  async promoteExploreSpec(exploreSpecId: string): Promise<any> {
    const exploreDir = path.join(this.projectRoot, QFLOW_DIR, 'specs-explore', exploreSpecId); // 探索性 Spec 目录路径（.qflow/specs-explore/{id}）
    const targetDir = path.join(this.crud.specsDir, exploreSpecId); // 目标正式 Spec 目录路径（.qflow/specs/{id}）
    if (!await fileExists(exploreDir)) throw new Error(`探索性 Spec ${exploreSpecId} 不存在`); // 校验源目录存在
    if (await fileExists(targetDir)) throw new Error(`Spec ${exploreSpecId} 已存在于正式库`); // 校验目标不冲突
    await fs.rename(exploreDir, targetDir); // 原子移动目录（同文件系统内为原子操作）
    const spec = await this.crud.getSpec(exploreSpecId); // 重新加载已提升的 Spec 验证数据完整性
    log.info(`探索性 Spec ${exploreSpecId} 已提升为正式 Spec`); // 记录提升操作日志
    return spec; // 返回提升后的 Spec 对象
  }

  /**
   * 从现有代码自动生成 Spec（v10.0）
   *
   * 读取指定文件内容，通过 AI 分析生成 Spec 文档。
   * 限制: 最多 5 个文件，每个文件最多 2000 字符。
   * SM-6: callAI 通过构造函数注入，不再动态 import ai-provider.js
   *
   * @param name      - Spec 名称
   * @param type      - Spec 类型
   * @param filePaths - 文件路径列表（相对于项目根目录）
   * @returns 新生成的 Spec
   */
  async generateFromCodebase(name: string, type: Spec['type'], filePaths: string[]): Promise<Spec> {
    const limitedPaths = filePaths.slice(0, GEN_FROM_CODE_MAX_FILES); // 最多读取文件数（v16.0 Q-3: 使用常量）
    const fileContents: string[] = []; // 文件内容列表

    for (const fp of limitedPaths) { // 逐个读取
      let fullPath: string;
      try {
        fullPath = assertPathWithinRoot(this.projectRoot, fp); // v12.0 S-3: 路径边界校验，防止路径穿越
      } catch (e) {
        fileContents.push(`### ${fp}\n（路径不安全: ${(e as Error).message}）`); // 路径穿越告警
        log.warn(`生成 Spec: 路径穿越拒绝 ${fp}: ${(e as Error).message}`);
        continue; // 跳过不安全路径
      }
      try {
        const content = await fs.readFile(fullPath, 'utf-8'); // 读取文件
        const trimmed = content.slice(0, GEN_FROM_CODE_MAX_CHARS); // 截断到最大字符数（v16.0 Q-3: 使用常量）
        fileContents.push(`### ${fp}\n\`\`\`\n${trimmed}\n\`\`\``); // 格式化
      } catch (e) {
        fileContents.push(`### ${fp}\n（读取失败: ${(e as Error).message}）`);
        log.warn(`生成 Spec: 文件读取失败 ${fp}: ${(e as Error).message}`);
      }
    }

    // v23.0: 移除 AI 调用，直接使用模板生成，由宿主 LLM 细化
    log.info(`generateFromCodebase: 使用模板生成 Spec "${name}"（AI 调用已移除）`); // 日志
    const description = `<!-- 由 qflow 模板生成，建议由 AI 助手细化 -->\n# ${name}\n\n## 概述\n\n基于以下文件生成:\n\n${limitedPaths.map(p => `- ${p}`).join('\n')}\n\n## 源代码摘要\n\n${fileContents.join('\n\n')}\n\n## 架构分析\n\n请补充从上述文件提炼的架构设计要点。\n\n## 接口定义\n\n请补充关键接口、函数签名及参数说明。\n\n## 实现建议\n\n- [ ] 请列出建议的实现步骤\n- [ ] 请标注高风险修改区域\n\n## 验收标准\n\n- [ ] 请列出功能验收条件`;

    return this.crud.initSpec(name, type, description); // 创建 Spec
  }

  /**
   * 获取跨 Spec 依赖图（v10.0）
   *
   * 生成 Mermaid 格式的依赖关系流程图。
   *
   * @returns Mermaid 流程图字符串
   */
  async getDependencyGraph(): Promise<{ mermaid: string; specCount: number; edgeCount: number }> {
    const specs = await this.crud.listSpecs(); // 获取所有 Spec
    const lines: string[] = ['graph TD']; // Mermaid 流程图头
    let edgeCount = 0; // 边数

    // 添加节点
    for (const spec of specs) {
      const label = `${spec.id}[${spec.name}]`; // 节点标签
      lines.push(`  ${label}`);
    }

    // 添加边
    for (const spec of specs) {
      for (const depId of spec.dependencies) {
        lines.push(`  ${depId} --> ${spec.id}`); // 依赖指向
        edgeCount++;
      }
    }

    // 空图处理
    if (specs.length === 0) {
      lines.push('  empty[无 Spec]');
    }

    const mermaid = lines.join('\n'); // 拼接 Mermaid 字符串
    log.debug(`Spec 依赖图: ${specs.length} 个 Spec, ${edgeCount} 条边`);
    return { mermaid, specCount: specs.length, edgeCount };
  }

  /**
   * 获取 Spec 依赖 DAG 状态（v12.0: C-4）
   *
   * 遍历所有 Spec，检查 requires 字段声明的 DAG 依赖关系，
   * 统计就绪/阻塞状态，生成 Mermaid DAG 可视化图。
   *
   * @returns DAG 状态摘要，包含统计信息、阻塞详情和 Mermaid 图
   */
  async getArtifactDAGStatus(): Promise<{
    totalSpecs: number;           // Spec 总数
    specsWithRequires: number;    // 有 requires 声明的 Spec 数量
    readyCount: number;           // 依赖已满足（可继续）的 Spec 数量
    blockedCount: number;         // 依赖未满足（被阻塞）的 Spec 数量
    blockedSpecs: Array<{         // 阻塞的 Spec 详情列表
      specId: string;             // 被阻塞的 Spec ID
      specName: string;           // Spec 名称
      missingDeps: Array<{        // 未满足的依赖列表
        specId: string;           // 依赖的 Spec ID
        status: string;           // 当前状态（或 "不存在"）
      }>;
    }>;
    mermaid: string;              // Mermaid DAG 关系图
  }> {
    const specs = await this.crud.listSpecs(); // 获取所有 Spec
    const specMap = new Map(specs.map(s => [s.id, s])); // ID → Spec 映射

    let specsWithRequires = 0; // 有 requires 的 Spec 计数
    let readyCount = 0;        // 依赖满足的 Spec 计数
    let blockedCount = 0;      // 被阻塞的 Spec 计数
    const blockedSpecs: Array<{ specId: string; specName: string; missingDeps: Array<{ specId: string; status: string }> }> = []; // 阻塞详情

    for (const spec of specs) {
      if (!spec.requires || spec.requires.length === 0) continue; // 跳过无依赖的 Spec
      specsWithRequires++; // 计数有 requires 的 Spec

      const missingDeps: Array<{ specId: string; status: string }> = []; // 当前 Spec 的未满足依赖
      for (const reqId of spec.requires) {
        const reqSpec = specMap.get(reqId); // 查找依赖的 Spec
        if (!reqSpec) {
          missingDeps.push({ specId: reqId, status: '不存在' }); // 依赖不存在
        } else if (reqSpec.status !== 'ready' && reqSpec.status !== 'done') {
          missingDeps.push({ specId: reqId, status: reqSpec.status }); // 依赖未就绪
        }
      }

      if (missingDeps.length > 0) { // 存在未满足的依赖
        blockedCount++; // 阻塞计数加一
        blockedSpecs.push({
          specId: spec.id,       // 被阻塞的 Spec ID
          specName: spec.name,   // Spec 名称
          missingDeps,           // 未满足的依赖详情
        });
      } else {
        readyCount++; // 依赖全部满足
      }
    }

    // 构建 Mermaid DAG 关系图
    const lines: string[] = ['graph TD']; // Mermaid 图头

    // 状态样式映射
    const statusStyle: Record<string, string> = {
      draft: ':::draft',     // 草稿
      ready: ':::ready',     // 就绪
      blocked: ':::blocked', // 阻塞
      done: ':::done',       // 已完成
    };

    // 添加节点
    for (const spec of specs) {
      const style = statusStyle[spec.status] || ''; // 获取状态样式
      const label = spec.name.slice(0, MERMAID_LABEL_MAX_LENGTH); // 截断名称（v16.0 Q-3: 使用常量）
      lines.push(`  ${spec.id}["${spec.id}: ${label}"]${style}`); // 节点定义
    }

    // 添加 requires DAG 边
    for (const spec of specs) {
      if (!spec.requires) continue; // 跳过无依赖的
      for (const reqId of spec.requires) {
        lines.push(`  ${reqId} --> ${spec.id}`); // requires 依赖边
      }
    }

    // 添加样式定义
    lines.push('  classDef draft fill:#f9f9f9,stroke:#ccc');      // 草稿样式
    lines.push('  classDef ready fill:#c8e6c9,stroke:#388e3c');    // 就绪样式
    lines.push('  classDef blocked fill:#ffcdd2,stroke:#d32f2f');  // 阻塞样式
    lines.push('  classDef done fill:#bbdefb,stroke:#1976d2');     // 已完成样式

    const mermaid = lines.join('\n'); // 拼接 Mermaid 字符串

    log.info(`Spec DAG 状态: 共 ${specs.length} 个 Spec, ${specsWithRequires} 个有依赖, ${readyCount} 个就绪, ${blockedCount} 个阻塞`); // 状态日志
    return {
      totalSpecs: specs.length,    // 总数
      specsWithRequires,           // 有依赖的数量
      readyCount,                  // 就绪数量
      blockedCount,                // 阻塞数量
      blockedSpecs,                // 阻塞详情
      mermaid,                     // Mermaid 图
    };
  }

  /**
   * 一站式创建完整 Spec（含 proposal.md + Design/Tasks section + 项目上下文注入）
   *
   * 流程:
   * 1. 调用 crud.initSpec() 创建基础 Spec
   * 2. 生成 proposal.md（含背景/目标/范围/约束模板）
   * 3. 给 spec.md 追加 Design + Tasks section
   * 4. 读取 project.md 注入上下文（如果存在）
   * 5. 返回所有文件路径
   *
   * @param name        - Spec 名称
   * @param type        - Spec 类型
   * @param description - Spec 描述
   * @returns 创建结果，包含 specId 和所有生成文件路径
   */
  async specProposeFull(name: string, type: Spec['type'], description: string): Promise<{
    specId: string;
    proposalPath: string;
    specPath: string;
    designPath: string;
  }> {
    // 步骤 1: 创建基础 Spec
    const spec = await this.crud.initSpec(name, type, description); // 创建 Spec
    const specDir = path.join(this.crud.specsDir, spec.id); // Spec 目录路径
    log.info(`specProposeFull: 步骤 1 - Spec 已创建: ${spec.id}`); // 进度日志

    // 步骤 2: 读取项目上下文（如果存在）
    const projectContext = await this.crud.loadProjectContext(); // 加载项目上下文
    const contextBlock = projectContext
      ? `## 项目上下文\n\n${projectContext}\n\n` // 有上下文时生成块
      : ''; // 无上下文时为空
    log.info(`specProposeFull: 步骤 2 - 项目上下文${projectContext ? '已加载' : '未找到'}`); // 进度日志

    // 步骤 3: 生成 proposal.md（背景/目标/范围/约束模板）
    const proposalContent = [
      `# Proposal: ${name}`,
      '',
      `> Spec ID: ${spec.id}`,
      `> 类型: ${type}`,
      `> 创建时间: ${spec.createdAt}`,
      '',
      contextBlock, // 注入项目上下文
      '## 背景',
      '',
      description || '[请补充背景说明]',
      '',
      '## 目标',
      '',
      '- [ ] [请列出本 Spec 要达成的目标]',
      '',
      '## 范围',
      '',
      '### 包含',
      '- [请列出包含的内容]',
      '',
      '### 不包含',
      '- [请列出明确排除的内容]',
      '',
      '## 约束',
      '',
      '- [请列出技术约束、时间约束等]',
      '',
    ].join('\n'); // 拼接 proposal 内容
    const proposalPath = path.join(specDir, 'proposal.md'); // proposal.md 路径
    await fs.writeFile(proposalPath, proposalContent, 'utf-8'); // 写入 proposal.md
    log.info(`specProposeFull: 步骤 3 - proposal.md 已生成`); // 进度日志

    // 步骤 4: 给 spec.md 追加 Design + Tasks section
    const specMdPath = path.join(specDir, 'spec.md'); // spec.md 路径
    let existingContent = ''; // 已有内容
    if (await fileExists(specMdPath)) { // 文件存在
      existingContent = await fs.readFile(specMdPath, 'utf-8'); // 读取已有内容
    }

    // 检查是否已有 Design 和 Tasks section，避免重复追加
    const hasDesign = /^## Design\b/m.test(existingContent); // 检查 Design section
    const hasTasks = /^## Tasks\b/m.test(existingContent); // 检查 Tasks section
    const appendSections: string[] = []; // 待追加的 section 列表
    if (!hasDesign) { // 缺少 Design section
      appendSections.push('', '## Design', '', '[技术设计方案 - 请补充]', '');
    }
    if (!hasTasks) { // 缺少 Tasks section
      appendSections.push('', '## Tasks', '', '- [ ] [任务分解 - 请补充]', '');
    }

    if (appendSections.length > 0) { // 有需要追加的 section
      const updatedContent = existingContent.trimEnd() + '\n' + appendSections.join('\n'); // 追加内容
      await fs.writeFile(specMdPath, updatedContent, 'utf-8'); // 写入更新后的 spec.md
      // 同步更新 spec.json 中的 content 字段
      spec.content = updatedContent; // 更新内存中的 content
      spec.updatedAt = new Date().toISOString(); // 更新时间戳
      await writeJSON(path.join(specDir, 'spec.json'), spec); // 持久化
    }
    log.info(`specProposeFull: 步骤 4 - spec.md 已追加 Design/Tasks section`); // 进度日志

    // 步骤 5: 生成 design.md 初始文件
    const designPath = path.join(specDir, 'design.md'); // design.md 路径
    const designContent = [
      `# ${name} - Design`,
      '',
      contextBlock, // 注入项目上下文
      '## 架构概述',
      '',
      '[请补充架构设计]',
      '',
      '## 技术选型',
      '',
      '[请补充技术选型决策]',
      '',
      '## 接口定义',
      '',
      '[请补充接口/API 定义]',
      '',
    ].join('\n'); // 拼接 design 内容
    await fs.writeFile(designPath, designContent, 'utf-8'); // 写入 design.md
    log.info(`specProposeFull: 步骤 5 - design.md 已生成`); // 进度日志

    log.info(`specProposeFull: 全流程结束，Spec ${spec.id} 已创建完整产物`); // 总结日志
    return {
      specId: spec.id, // Spec ID
      proposalPath, // proposal.md 绝对路径
      specPath: specMdPath, // spec.md 绝对路径
      designPath, // design.md 绝对路径
    };
  }
  /**
   * v19.0: AI 生成结构化 Spec（含用户故事、验收条件、[NEEDS CLARIFICATION] 标记）
   *
   * @param name        - Spec 名称
   * @param description - 自然语言描述
   * @returns 结构化 Spec 内容
   */
  async generateStructuredSpec(name: string, description: string): Promise<{
    spec: import('../schemas/spec.js').Spec;
    clarifications: string[];
  }> {
    // v23.0: 移除 AI prompt 构建，保留变量引用供模板使用

    // v23.0: 移除 AI 调用，直接使用模板生成结构化 Spec
    log.info(`generateStructuredSpec: 使用模板生成结构化 Spec "${name}"（AI 调用已移除）`); // 日志
    const specContent = [
      '<!-- 由 qflow 模板生成，建议由 AI 助手细化 -->',
      '## 概述',
      description,
      '',
      '## 用户故事',
      `- 作为用户，我希望 ${name}，以便提高效率`,
      '',
      '## 验收条件',
      `- GIVEN 系统正常运行 WHEN 使用 ${name} THEN 功能正常工作`,
      '',
      '## 技术约束',
      '- [NEEDS CLARIFICATION] 技术栈待确认',
      '',
      '## [NEEDS CLARIFICATION]',
      '- 具体实现方式待确认',
    ].join('\n'); // 模板内容

    // 创建 Spec
    const spec = await this.crud.initSpec(name, 'architecture', specContent); // 创建

    // 提取 [NEEDS CLARIFICATION] 标记
    const clarifications = this.extractClarifications(specContent); // 提取标记

    log.info(`generateStructuredSpec: 已生成结构化 Spec "${name}" (${clarifications.length} 个待澄清项)`); // 日志
    return { spec, clarifications };
  }

  /**
   * v19.0: 提取内容中的 [NEEDS CLARIFICATION] 标记（私有方法）
   */
  private extractClarifications(content: string): string[] {
    const markers: string[] = []; // 结果列表
    const lines = content.split('\n'); // 按行分割
    for (const line of lines) {
      if (line.includes('[NEEDS CLARIFICATION]')) { // 包含标记
        const cleaned = line.replace(/^[-*\s]*/, '').replace('[NEEDS CLARIFICATION]', '').trim(); // 清理前缀和标记
        if (cleaned) markers.push(cleaned); // 非空则收集
      }
    }
    return markers;
  }

  /**
   * v19.0: 为 Spec 内容添加 [NEEDS CLARIFICATION] 标记
   * 扫描内容中的模糊表述并自动标记
   */
  addClarificationMarkers(content: string): { content: string; addedCount: number } {
    const vaguePatterns = [ // 模糊表述正则模式列表
      /可能需要/g, /待定/g, /TBD/gi, /TODO/gi,
      /或者/g, /大概/g, /也许/g, /某种/g,
      /probably/gi, /maybe/gi, /perhaps/gi, /might/gi,
    ];
    let addedCount = 0; // 添加标记计数
    let result = content; // 当前处理内容
    for (const pattern of vaguePatterns) {
      const lines = result.split('\n'); // 按行分割
      result = lines.map(line => {
        if (pattern.test(line) && !line.includes('[NEEDS CLARIFICATION]')) { // 匹配且未已标记
          addedCount++; // 计数加一
          return `${line} [NEEDS CLARIFICATION]`; // 追加标记
        }
        return line; // 已标记或不匹配则原样返回
      }).join('\n');
    }
    return { content: result, addedCount }; // 返回结果
  }

  /**
   * v20.0 P2-10: 快速生成 Spec 的所有规划产物（任务、测试大纲等）
   *
   * 读取 Spec 内容，遍历已有 section，为每个 section 生成关联的规划产物。
   * 优先使用 callAI 生成，AI 不可用时返回结构化模板。
   *
   * @param specId - 目标 Spec ID
   * @returns 生成的产物列表
   */
  async fastForward(specId: string): Promise<{
    specId: string;
    artifacts: Array<{ section: string; type: string; content: string }>;
    usedAI: boolean;
  }> {
    sanitizeId(specId, 'Spec ID'); // 防止路径遍历攻击
    const spec = await this.crud.getSpec(specId); // 加载 Spec
    if (!spec) throw new Error(`Spec ${specId} 不存在`); // 校验存在

    // 解析 Spec 内容中的所有 ## section 标题
    const sectionRegex = /^## (.+)$/gm; // 匹配 ## 标题行
    const sections: string[] = []; // 收集 section 名称
    let match: RegExpExecArray | null;
    while ((match = sectionRegex.exec(spec.content)) !== null) { // 逐个匹配
      sections.push(match[1].trim()); // 提取标题文本
    }

    if (sections.length === 0) { // 无 section 时用 Spec 名称作为唯一 section
      sections.push(spec.name);
    }

    const artifacts: Array<{ section: string; type: string; content: string }> = []; // 产物列表
    let usedAI = false; // 是否成功使用了 AI

    // v23.0: 移除 AI 调用，直接使用结构化模板生成规划产物
    for (const section of sections) {
      log.debug(`fastForward: 为 section "${section}" 生成模板产物（AI 调用已移除）`); // 调试日志

      artifacts.push({
        section, // 关联的 section
        type: 'tasks', // 产物类型：任务分解
        content: [
          `<!-- 由 qflow 模板生成，建议由 AI 助手细化 -->`,
          `## ${section} - 任务分解`,
          '',
          `- [ ] 分析 ${section} 的需求和约束`,
          `- [ ] 设计 ${section} 的实现方案`,
          `- [ ] 实现 ${section} 的核心逻辑`,
          `- [ ] 编写 ${section} 的单元测试`,
          `- [ ] 集成测试和验收`,
        ].join('\n'), // 模板内容
      });

      artifacts.push({
        section, // 关联的 section
        type: 'test-outline', // 产物类型：测试大纲
        content: [
          `## ${section} - 测试大纲`,
          '',
          `- GIVEN ${section} 已实现 WHEN 执行核心功能 THEN 输出符合预期`,
          `- GIVEN 异常输入 WHEN 触发边界条件 THEN 错误被正确处理`,
        ].join('\n'), // 模板内容
      });

      artifacts.push({
        section, // 关联的 section
        type: 'risks', // 产物类型：风险点
        content: [
          `## ${section} - 风险点`,
          '',
          `- [ ] 待评估：性能影响`,
          `- [ ] 待评估：兼容性风险`,
          `- [ ] 待评估：安全隐患`,
        ].join('\n'), // 模板内容
      });
    }

    log.info(`fastForward: Spec ${specId} 生成了 ${artifacts.length} 个规划产物（AI: ${usedAI}）`); // 信息日志
    return { specId, artifacts, usedAI }; // 返回结果
  }

}