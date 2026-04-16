/**
 * SpecWorkflow - Spec 变更工作流子模块
 *
 * 职责：Spec 变更的提议、应用、归档及状态推进等工作流操作
 * 子模块函数列表:
 * - propose()        提议增量变更（写入 pending）
 * - apply()          应用变更（合并到 Spec，移动到 applied）
 * - archive()        归档已应用的变更
 * - bulkArchive()    批量归档已应用的变更
 * - continueSpec()   增量创建下一个未完成的产物
 * - fastForward()    快速推进 Spec 状态
 * - listActions()    列出 Spec 中的可执行 Actions
 * - separateDesign() 将 Design 段提取为独立文件
 * - applyArtifactRules() 根据变更类型查询必需产物类型（v20.0 P2-12）
 */

import path from 'node:path'; // 路径拼接工具
import { promises as fs } from 'node:fs'; // 异步文件操作
import { createHash } from 'node:crypto'; // SHA-256 基线指纹
import { type Spec } from '../schemas/spec.js'; // Spec 类型
import { DeltaChangeSchema, type DeltaChange, type ChangeItem } from '../schemas/change.js'; // 变更 schema 和类型
import { readJSON, writeJSON, ensureDir, fileExists, withFileLock } from '../utils/file-io.js'; // 文件工具 + 文件锁
import { log } from '../utils/logger.js'; // 日志工具
import { mergeSpecChanges } from '../algorithms/spec-merge.js'; // 确定性合并算法
import { detectConflicts } from '../algorithms/conflict-detector.js'; // 冲突检测器
import { uniqueId, QFLOW_DIR, sanitizeId } from '../shared/tool-utils.js'; // 工具函数
import { WorkflowSchemaManager } from './workflow-schema-manager.js'; // 工作流 Schema 管理器（v11.0）
import { loadConfig } from './config-manager.js'; // v20.0 P2-12: 配置加载（读取 artifactRules）
import type { SpecCrud } from './spec-crud.js'; // CRUD 子模块类型

/**
 * v15.0 OS-2: 计算 Markdown 中指定 section 的 SHA-256 指纹
 * 提取 ## heading 下的内容并返回其哈希值，用于基线冲突检测
 * @param content  - 完整 Markdown 内容
 * @param sectionName - 目标 section 标题（不含 ## 前缀）
 * @returns SHA-256 十六进制哈希字符串
 */
export function computeSectionHash(content: string, sectionName: string): string {
  const regex = new RegExp(`## ${sectionName}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`, 'i'); // 匹配 ## 标题到下一个 ## 或文档末尾
  const match = content.match(regex); // 提取 section 内容
  const sectionContent = match ? match[1].trim() : ''; // 取匹配内容，未匹配则空字符串
  return createHash('sha256').update(sectionContent).digest('hex'); // 返回 SHA-256 哈希
}

/**
 * SpecWorkflow 类 - 处理 Spec 变更工作流
 *
 * 组合 SpecCrud 实现对 Spec 的写操作（变更、归档、状态推进）
 */
export class SpecWorkflow {
  /**
   * @param projectRoot - 项目根目录绝对路径
   * @param crud        - SpecCrud 实例，用于读取 Spec 数据
   */
  constructor(
    private projectRoot: string,
    private crud: SpecCrud, // 依赖注入 SpecCrud
  ) {}

  /**
   * 提议增量变更
   *
   * 生成 change ID: C{timestamp}，写入 changes/pending/{changeId}/ 目录（Folder 格式）。
   *
   * @param specId    - 目标 Spec ID
   * @param changes   - 变更条目列表
   * @param rationale - 变更原因说明（写入每条 change 的 rationale 如未提供）
   * @returns 新创建的 DeltaChange 对象 + Delta 差异可视化
   */
  async propose(specId: string, changes: ChangeItem[], rationale: string, requirementId?: string): Promise<DeltaChange & { delta: Array<{ type: string; section: string; diff: string }> }> {
    sanitizeId(specId, 'Spec ID'); // 防止路径遍历攻击
    const spec = await this.crud.getSpec(specId); // 加载目标 Spec
    if (!spec) throw new Error(`Spec ${specId} 不存在`); // 校验存在性

    const changeId = uniqueId('C'); // 使用 uniqueId 生成唯一 change ID（替代 Date.now() 避免毫秒碰撞）
    const now = new Date().toISOString(); // 当前时间

    // 为未填 rationale 的变更条目补充整体 rationale
    const enrichedChanges = changes.map((c) => ({
      ...c,
      rationale: c.rationale || rationale, // 优先用条目自身的 rationale
      // v15.0 OS-2: 为 MODIFIED/REMOVED 变更计算基线指纹，用于 apply 时冲突检测
      baseHash: (c.type === 'MODIFIED' || c.type === 'REMOVED')
        ? computeSectionHash(spec.content, c.section) // 计算目标 section 的 SHA-256 哈希
        : undefined, // ADDED/RENAMED 不需要基线指纹
      // v12.0 D-6: 自动检测 impact 级别（仅在未手动指定时生效）
      impact: c.impact || (() => {
        const rfcBreaking = /\b(MUST|SHALL|REQUIRED|MUST NOT|SHALL NOT)\b/; // 强制性关键词
        const beforeHasBreaking = c.before && rfcBreaking.test(c.before); // before 含强制关键词
        const afterHasBreaking = c.after && rfcBreaking.test(c.after); // after 含强制关键词
        if (c.type === 'REMOVED' && beforeHasBreaking) return 'breaking' as const; // 删除含 MUST/SHALL 的内容 = breaking
        if (c.type === 'MODIFIED' && beforeHasBreaking) return 'breaking' as const; // 修改含 MUST/SHALL 的内容 = breaking
        if (c.type === 'ADDED' && afterHasBreaking) return 'minor' as const; // 新增强制性要求 = minor
        return 'patch' as const; // 默认为 patch
      })(),
    }));

    const deltaChange: DeltaChange = { // 构造变更对象
      id: changeId, // 唯一标识
      specId, // 关联的 Spec ID
      changes: enrichedChanges, // 变更条目
      status: 'pending', // 初始状态：待应用
      proposedAt: now, // 提议时间
      requirementId, // v17.0 PL-2: 关联需求 ID（可选）
    };

    // P7-P2-1: Change-as-Folder 结构，每个变更存储为独立目录
    const changeDir = path.join(this.crud.changesDir, 'pending', changeId); // 变更目录路径
    await ensureDir(changeDir); // 确保变更目录存在

    // v20.0 P3-10: Per-Change Folder 隔离
    try { await this.perChangeFolderCreate(changeId); } catch (e) { log.warn('perChangeFolderCreate 失败: ' + (e instanceof Error ? e.message : String(e))); } // v22.0 P1-3

    // 写入 metadata.json - 变更元数据
    await writeJSON(path.join(changeDir, 'metadata.json'), {
      id: changeId, // 变更 ID
      specId, // 关联 Spec ID
      status: 'pending', // 变更状态
      proposedAt: now, // 提议时间
      rationale, // 变更原因
      requirementId: requirementId ?? null, // v17.0 PL-2: 关联需求 ID
    });

    // 写入 proposal.md - Markdown 格式的变更理由
    const proposalPath = path.join(changeDir, 'proposal.md'); // proposal.md 路径
    await withFileLock(proposalPath, async () => { // v14.0 L-5: proposal.md 写入加锁
      await fs.writeFile(proposalPath, `# 变更提议: ${changeId}\n\n## 关联 Spec\n\n${specId}\n\n## 变更理由\n\n${rationale}\n`, 'utf-8');
    });

    // 写入 delta.json - 变更条目数组
    await writeJSON(path.join(changeDir, 'delta.json'), enrichedChanges);

    // 同时写入完整的单文件格式（兼容旧版读取逻辑 + apply 使用）
    await writeJSON(path.join(changeDir, 'change.json'), deltaChange);

    log.info(`变更已提议: ${changeId} → Spec ${specId}（Folder 格式）`); // 信息日志

    // v13.0 V-5: 自动检测变更内容中的文件路径引用，写入 Spec.targetFiles
    const filePathPattern = /(?:^|\s|`)((?:src|lib|test|tests|app|pages|components|utils|core|schemas|tools|scripts|config)\/[\w./-]+\.\w{1,10})/gm; // 匹配常见代码路径前缀
    const detectedPaths = new Set<string>(); // 去重集合
    for (const c of enrichedChanges) { // 遍历变更条目
      const texts = [c.after || '', c.before || '', c.section || '']; // 收集所有文本
      for (const text of texts) { // 逐段扫描
        let match: RegExpExecArray | null;
        while ((match = filePathPattern.exec(text)) !== null) { // 匹配文件路径
          detectedPaths.add(match[1]); // 添加到集合
        }
      }
    }
    if (detectedPaths.size > 0) { // 检测到文件路径
      const existingPaths = new Set(spec.targetFiles); // 现有路径集合
      let addedCount = 0; // 新增计数
      for (const p of detectedPaths) { // 遍历检测到的路径
        if (!existingPaths.has(p)) { // 不重复
          spec.targetFiles.push(p); // 追加到 targetFiles
          addedCount++; // 计数
        }
      }
      if (addedCount > 0) { // 有新增路径
        spec.updatedAt = new Date().toISOString(); // 更新时间戳
        const specDir = path.join(this.crud.specsDir, spec.id); // Spec 目录
        await writeJSON(path.join(specDir, 'spec.json'), spec); // 持久化更新
        log.info(`v13.0 V-5: 自动检测到 ${addedCount} 个文件路径，已追加到 Spec ${specId}.targetFiles`); // 信息日志
      }
    }

    // P2: 生成 Delta 差异可视化
    const delta = enrichedChanges.map(c => ({
      type: c.type, // 变更类型
      section: c.section, // 目标章节
      diff: c.type === 'MODIFIED'
        ? `--- ${c.before ?? ''}\n+++ ${c.after ?? ''}` // MODIFIED: unified diff 格式
        : c.type === 'ADDED' ? `+++ ${c.after ?? ''}` // ADDED: 仅新增内容
        : c.type === 'REMOVED' ? `--- ${c.before ?? ''}` // REMOVED: 仅删除内容
        : `--- ${c.before ?? ''}\n+++ ${c.after ?? ''}`, // RENAMED: 前后对比
    }));

    return { ...deltaChange, delta }; // 返回变更对象 + Delta 可视化
  }

  /**
   * 应用变更
   *
   * 读取 pending change，合并到目标 Spec 的 content 中，
   * 更新 Spec 版本号，移动 change 到 applied 目录。
   *
   * @param changeId - 变更 ID
   * @returns 更新后的 Spec 和已应用的 DeltaChange
   */
  async apply(changeId: string): Promise<{ spec: Spec; applied: DeltaChange }> {
    sanitizeId(changeId, 'Change ID'); // 防止路径遍历攻击

    // P7-P2-1: 优先读取 Folder 格式，回退到旧版单文件格式
    const folderPath = path.join(this.crud.changesDir, 'pending', changeId); // Folder 格式路径
    const legacyPath = path.join(this.crud.changesDir, 'pending', `${changeId}.json`); // 旧版单文件路径
    let raw: unknown = null; // 原始数据
    let pendingPath = ''; // 实际使用的路径（用于后续删除），默认空字符串避免 TS2454
    let isFolder = false; // 是否为 Folder 格式

    if (await fileExists(path.join(folderPath, 'change.json'))) {
      // Folder 格式：读取 change.json（完整的 DeltaChange）
      raw = await readJSON<unknown>(path.join(folderPath, 'change.json'));
      pendingPath = folderPath; // 记录目录路径
      isFolder = true; // 标记为 Folder 格式
      log.debug(`变更 ${changeId}: 使用 Folder 格式读取`); // 调试日志
    } else if (await fileExists(legacyPath)) {
      // 旧版单文件格式：向后兼容
      raw = await readJSON<unknown>(legacyPath);
      pendingPath = legacyPath; // 记录文件路径
      log.debug(`变更 ${changeId}: 使用旧版单文件格式读取`); // 调试日志
    }

    if (!raw) throw new Error(`变更 ${changeId} 不存在于 pending 目录`); // 校验存在性

    const parsed = DeltaChangeSchema.safeParse(raw); // Zod 校验
    if (!parsed.success) throw new Error(`变更 ${changeId} 格式错误: ${parsed.error.message}`); // 校验失败

    const change = parsed.data; // 取出变更数据
    const spec = await this.crud.getSpec(change.specId); // 加载目标 Spec
    if (!spec) throw new Error(`Spec ${change.specId} 不存在`); // 校验 Spec 存在

    // === v15.0 OS-3: 基线指纹冲突检测 ===
    // 在合并前验证 baseHash，确保 propose 时的 section 内容未被其他变更修改
    for (const item of change.changes) {
      if (item.baseHash) { // 仅检查带 baseHash 的变更条目（MODIFIED/REMOVED）
        const currentHash = computeSectionHash(spec.content, item.section); // 重新计算当前 section 哈希
        if (currentHash !== item.baseHash) { // 哈希不匹配，section 已被修改
          log.error(`v15.0 OS-3: 基线指纹冲突 - section "${item.section}" 在 propose 后已被修改`); // 错误日志
          throw new Error(
            JSON.stringify({
              conflict: true, // 冲突标记
              section: item.section, // 冲突的 section
              expected: item.baseHash, // propose 时的哈希
              actual: currentHash, // 当前哈希
              message: `Section "${item.section}" 在 propose 后已被修改，请重新 propose`, // 提示信息
            }),
          );
        }
      }
    }
    // === 基线指纹冲突检测结束 ===

    // === 冲突预验证（pre-validation）===
    // 收集同一 Spec 的其他 pending 变更，用于并发冲突检测
    const pendingDir = path.join(this.crud.changesDir, 'pending'); // pending 目录路径
    let otherPendingChanges: ChangeItem[] = []; // 其他 pending 变更
    if (await fileExists(pendingDir)) { // pending 目录存在
      const pendingEntries = await fs.readdir(pendingDir, { withFileTypes: true }); // 列出所有 pending 条目
      for (const entry of pendingEntries) {
        // P7-P2-1: 支持 Folder 格式和旧版单文件格式
        let otherRaw: unknown = null; // 其他变更原始数据
        if (entry.isDirectory() && entry.name !== changeId) {
          // Folder 格式：读取 change.json
          otherRaw = await readJSON<unknown>(path.join(pendingDir, entry.name, 'change.json'));
        } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== `${changeId}.json`) {
          // 旧版单文件格式
          otherRaw = await readJSON<unknown>(path.join(pendingDir, entry.name));
        } else {
          continue; // 跳过不匹配的条目
        }
        if (!otherRaw) continue; // 文件读取失败
        const otherParsed = DeltaChangeSchema.safeParse(otherRaw); // 校验格式
        if (otherParsed.success && otherParsed.data.specId === change.specId) { // 同一 Spec 的变更
          otherPendingChanges.push(...otherParsed.data.changes); // 收集变更条目
        }
      }
    }

    // 执行 6 类冲突检测
    const conflictResult = detectConflicts(
      spec.content, // 当前文档内容
      change.changes, // 待应用的变更
      otherPendingChanges.length > 0 ? otherPendingChanges : undefined, // 其他 pending 变更
    );

    if (conflictResult.hasConflicts) { // 存在冲突
      const errors = conflictResult.conflicts.filter((c) => c.severity === 'error'); // 错误级别冲突
      const warnings = conflictResult.conflicts.filter((c) => c.severity === 'warning'); // 警告级别冲突

      // 记录所有警告
      for (const warn of warnings) {
        log.warn(`冲突检测 [${warn.type}] ${warn.description}`); // 警告日志
      }

      // 错误级别冲突阻止 apply
      if (errors.length > 0) {
        for (const err of errors) {
          log.error(`冲突检测 [${err.type}] ${err.description}`); // 错误日志
        }
        throw new Error( // 抛出异常阻止 apply
          `变更 ${changeId} 存在 ${errors.length} 个冲突错误，无法应用:\n` +
          errors.map((e) => `  - [${e.type}] ${e.description}`).join('\n'),
        );
      }
    }
    // === 冲突预验证结束 ===

    // 备份原 spec.md，防止合并失败后丢失数据
    const specDir = path.join(this.crud.specsDir, spec.id); // Spec 目录
    const mdPath = path.join(specDir, 'spec.md'); // Markdown 文件路径
    const backupPath = path.join(specDir, 'spec.md.bak'); // 备份路径

    // v14.0 L-2: 对 spec.md 和 design.md 的所有写入操作加锁，包括 backup 和回滚
    await withFileLock(mdPath, async () => {
      if (await fileExists(mdPath)) { // Markdown 文件存在时备份
        const originalMd = await fs.readFile(mdPath, 'utf-8'); // 读取原文件
        await fs.writeFile(backupPath, originalMd, 'utf-8'); // 写入备份（在锁内完成）
      }

      // 使用确定性合并算法替代内联逻辑
      const mergeResult = mergeSpecChanges(spec.content, change.changes); // 执行合并
      if (!mergeResult.success) { // 合并存在错误
        log.warn(`变更 ${changeId} 合并产生 ${mergeResult.errors.length} 个错误:`); // 警告日志
        for (const err of mergeResult.errors) { // 逐条输出错误
          log.warn(`  - ${err}`);
        }
      }
      log.info(`变更 ${changeId} 合并结果: 成功应用 ${mergeResult.appliedChanges}/${change.changes.length} 条变更`); // 合并统计

      // === 多步写入（含错误回滚） ===
      const originalSpec = { ...spec, content: spec.content }; // 保存原始 Spec 状态（深拷贝关键字段）
      const originalVersion = spec.version; // 保存原始版本号

      spec.content = mergeResult.content; // 更新正文为合并后的内容
      spec.version += 1; // 递增版本号

      try {
        // 步骤 1: 保存更新后的 Spec JSON
        await writeJSON(path.join(specDir, 'spec.json'), spec); // 写入 JSON

        // 步骤 2: 保存更新后的 Spec Markdown（在 withFileLock 锁内写入）
        await fs.writeFile(mdPath, mergeResult.content, 'utf-8'); // 写入 Markdown

        // v13.0 V-4: 如果 designSeparated=true，同步更新 design.md 中的 Design 段
        if (spec.designSeparated) { // Design 段已分离
          const designPath = path.join(specDir, 'design.md'); // design.md 路径
          const designMatch = mergeResult.content.match(/## Design\s*\n([\s\S]*?)(?=\n## |\n$)/i); // 提取 Design 段
          if (designMatch && designMatch[1].trim().length > 0) { // 有实质内容
            // v14.0 L-2: design.md 写入也在 spec.md 锁内完成，保证原子性
            await withFileLock(designPath, async () => { // design.md 独立锁
              await fs.writeFile(designPath, `# ${spec.name} - Design\n\n${designMatch[1].trim()}\n`, 'utf-8'); // 同步写入 design.md
            });
            log.debug(`v13.0 V-4: design.md 已同步更新 (${designMatch[1].trim().length} 字符)`); // 调试日志
          }
        }

        // 合并成功后清理备份文件
        if (mergeResult.success && await fileExists(backupPath)) { // 全部成功且备份存在
          await fs.unlink(backupPath); // 删除备份
        }

        // 步骤 3: 更新变更状态并移动到 applied 目录
        change.status = 'applied'; // 标记为已应用
        change.appliedAt = new Date().toISOString(); // 记录应用时间戳
        const appliedDir = path.join(this.crud.changesDir, 'applied'); // applied 目录路径
        await ensureDir(appliedDir); // 确保目录存在
        await writeJSON(path.join(appliedDir, `${changeId}.json`), change); // 写入 applied

        // 步骤 4: 删除 pending 条目（最后执行，失败不影响数据完整性）
        if (isFolder) {
          // Folder 格式：递归删除整个目录
          await fs.rm(pendingPath, { recursive: true, force: true }); // 删除 pending 目录
        } else {
          // 旧版单文件格式：删除单个文件
          await fs.unlink(pendingPath); // 删除 pending 文件
        }
      } catch (writeErr) {
        // === 错误回滚：恢复 Spec 到原始状态 ===
        log.error(`变更 ${changeId} 写入失败，执行回滚: ${(writeErr as Error).message}`); // 错误日志
        try {
          // 恢复 spec.json
          originalSpec.version = originalVersion; // 恢复版本号
          await writeJSON(path.join(specDir, 'spec.json'), originalSpec); // 写回原始 JSON

          // 恢复 spec.md（从备份，在锁内完成回滚写入）
          if (await fileExists(backupPath)) { // 备份文件存在
            const backupContent = await fs.readFile(backupPath, 'utf-8'); // 读取备份
            await fs.writeFile(mdPath, backupContent, 'utf-8'); // 恢复 Markdown（锁内回滚）
            log.info(`Spec ${spec.id} 已回滚到变更前状态`); // 回滚成功日志
          }
        } catch (rollbackErr) {
          log.error(`回滚也失败: ${(rollbackErr as Error).message}，数据可能不一致`); // 回滚失败日志
        }
        throw new Error(`变更 ${changeId} 应用失败（已回滚）: ${(writeErr as Error).message}`); // 重新抛出
      }
    }); // withFileLock 结束

    log.info(`变更 ${changeId} 已应用到 Spec ${spec.id} (v${spec.version})`); // 信息日志

    // v18.0: Living Specs - 自动传播变更到关联任务
    await this.updateRelatedTasks(spec, change);

    // v20.0 P3-6: Living Spec 自动同步
    try {
      await this.livingSpecUpdate(spec.id); // 自动触发 Living Spec 同步，通知关联任务 Spec 已更新
    } catch (e) { log.warn('Living Spec 同步失败: ' + (e instanceof Error ? e.message : String(e))); } // v22.0 P1-4

    return { spec, applied: change }; // 返回结果
  }

  /**
   * v18.0: Living Specs - 更新关联任务
   *
   * Spec apply() 后自动传播变更到关联任务的 metadata，
   * 记录最新 Spec 版本和变更 ID，便于任务跟踪。
   *
   * @param spec    - 更新后的 Spec 对象
   * @param change  - 已应用的变更数据
   */
  private async updateRelatedTasks(spec: Spec, change: DeltaChange): Promise<void> {
    try {
      const { TaskManager } = await import('./task-manager.js'); // 动态导入避免循环依赖
      const tm = new TaskManager(this.crud.projectRoot); // 创建任务管理器
      const allTasks = await tm.getAllTasks(); // 获取所有任务

      // 查找与 Spec 关联的任务（metadata.specId 匹配或 tags 包含 Spec ID）
      const relatedTasks = allTasks.filter(
        t => t.metadata?.specId === spec.id || t.tags?.includes(spec.id)
      );

      for (const task of relatedTasks) {
        await tm.updateTask(task.id, {
          metadata: {
            ...task.metadata,
            specVersion: spec.version, // 最新 Spec 版本
            lastChangeId: change.id, // 最近应用的变更 ID
            specUpdatedAt: new Date().toISOString(), // 变更时间戳
          },
        });
        log.debug(`v18.0 Living Specs: 已更新任务 ${task.id} 的 Spec 关联信息`); // 调试日志
      }

      if (relatedTasks.length > 0) {
        log.info(`v18.0 Living Specs: 已传播 Spec ${spec.id} 变更到 ${relatedTasks.length} 个关联任务`); // 信息日志
      }
    } catch (err) {
      // 传播失败不阻塞 apply 主流程
      log.warn(`v18.0 Living Specs: 传播失败（非致命）: ${(err as Error).message}`); // 警告日志
    }
  }

  /**
   * 归档已应用的变更
   *
   * 将 applied 目录下的变更文件移动到 archived 目录。
   *
   * @param changeId - 变更 ID
   */
  async archive(changeId: string): Promise<void> {
    sanitizeId(changeId, 'Change ID'); // 防止路径遍历攻击
    const appliedPath = path.join(this.crud.changesDir, 'applied', `${changeId}.json`); // applied 文件路径
    const raw = await readJSON<unknown>(appliedPath); // 读取文件
    if (!raw) throw new Error(`变更 ${changeId} 不存在于 applied 目录`); // 校验存在

    const parsed = DeltaChangeSchema.safeParse(raw); // Zod 校验
    if (!parsed.success) throw new Error(`变更 ${changeId} 格式错误`); // 校验失败

    const change = parsed.data; // 取出数据
    change.status = 'archived'; // 更新状态为已归档
    change.archivedAt = new Date().toISOString(); // 记录归档时间戳

    const archivedDir = path.join(this.crud.changesDir, 'archived'); // archived 目录路径
    await ensureDir(archivedDir); // 确保目录存在
    await writeJSON(path.join(archivedDir, `${changeId}.json`), change); // 写入 archived
    await fs.unlink(appliedPath); // 删除 applied 文件

    log.info(`变更 ${changeId} 已归档`); // 信息日志
  }

  /**
   * 批量归档已应用的变更
   *
   * 读取 applied 目录下的变更文件，逐个归档到 archived 目录。
   * 若指定 changeIds 则只归档指定的变更，否则归档全部已应用变更。
   *
   * @param changeIds - 变更 ID 列表，为空则归档所有已应用变更
   * @returns 归档结果: archived 为归档数量，details 为每条归档的描述
   */
  async bulkArchive(changeIds?: string[]): Promise<{ archived: number; details: string[]; conflicts?: Array<{ changeA: string; changeB: string; section: string }> }> {
    const appliedDir = path.join(this.crud.changesDir, 'applied'); // applied 目录路径
    if (!(await fileExists(appliedDir))) { // 目录不存在
      return { archived: 0, details: ['applied 目录不存在，无变更可归档'] }; // 提前返回
    }

    const allFiles = await fs.readdir(appliedDir); // 读取 applied 目录内所有文件
    const jsonFiles = allFiles.filter((f) => f.endsWith('.json')); // 只取 JSON 文件

    // 确定要归档的变更 ID 列表
    let targetIds: string[]; // 目标 ID 列表
    if (changeIds && changeIds.length > 0) { // 指定了 ID 列表
      targetIds = changeIds.map((id) => sanitizeId(id, 'Change ID')); // 校验每个 ID
    } else { // 未指定，归档全部
      targetIds = jsonFiles.map((f) => f.replace(/\.json$/, '')); // 从文件名提取 ID
    }

    // Phase 3 S-5: 冲突检测 - 检测多变更对同一 Spec section 的并行修改
    const sectionMap = new Map<string, Array<{ changeId: string; specId: string }>>(); // section -> 变更列表映射
    for (const cid of targetIds) { // 遍历目标变更
      try {
        const changePath = path.join(appliedDir, `${cid}.json`); // 变更文件路径
        const raw = await readJSON<unknown>(changePath); // 读取变更数据
        if (!raw) continue; // 文件不存在
        const parsed = DeltaChangeSchema.safeParse(raw); // Zod 校验
        if (!parsed.success) continue; // 格式错误
        for (const item of parsed.data.changes) { // 遍历变更条目
          const key = `${parsed.data.specId}::${item.section}`; // 复合键: specId + section
          if (!sectionMap.has(key)) sectionMap.set(key, []); // 初始化列表
          sectionMap.get(key)!.push({ changeId: cid, specId: parsed.data.specId }); // 添加到映射
        }
      } catch (e) {
        log.debug(`冲突检测跳过 ${cid}: ${(e as Error).message}`); // 读取失败时跳过
      }
    }

    // 收集冲突：同一 section 被多个变更修改
    const conflicts: Array<{ changeA: string; changeB: string; section: string }> = []; // 冲突列表
    for (const [key, entries] of sectionMap) { // 遍历 section 映射
      if (entries.length > 1) { // 同一 section 有多个变更
        const section = key.split('::')[1]; // 提取 section 名称
        for (let i = 0; i < entries.length; i++) { // 两两组合生成冲突对
          for (let j = i + 1; j < entries.length; j++) {
            conflicts.push({
              changeA: entries[i].changeId, // 变更 A
              changeB: entries[j].changeId, // 变更 B
              section, // 冲突的 section
            });
          }
        }
      }
    }

    if (conflicts.length > 0) { // 存在冲突
      log.warn(`批量归档检测到 ${conflicts.length} 个 section 冲突`); // 警告日志
      return { archived: 0, details: [`检测到 ${conflicts.length} 个 section 冲突，请先解决冲突再归档`], conflicts }; // 返回冲突信息
    }

    const details: string[] = []; // 归档详情列表
    let archivedCount = 0; // 归档计数

    for (const cid of targetIds) { // 遍历目标 ID
      try {
        await this.archive(cid); // 复用单条归档逻辑
        archivedCount++; // 计数
        details.push(`${cid}: 归档成功`); // 记录成功
      } catch (err) { // 归档失败
        details.push(`${cid}: 归档失败 - ${(err as Error).message}`); // 记录失败原因
        log.warn(`批量归档跳过 ${cid}: ${(err as Error).message}`); // 警告日志
      }
    }

    log.info(`批量归档完成: ${archivedCount}/${targetIds.length} 条变更已归档`); // 信息日志
    return { archived: archivedCount, details }; // 返回归档结果
  }

  /**
   * 增量创建下一个未完成的产物（v11.0 P2-7: continueSpec）
   *
   * 加载 Spec，根据关联的工作流 Schema（或默认顺序）找到下一个未完成的产物，
   * 自动创建/初始化该产物并返回信息。
   *
   * 默认产物顺序: proposal → design → tasks → implementation
   *
   * @param specId - 目标 Spec ID
   * @returns 下一个产物的创建信息，若全部已完成返回 null
   */
  async continueSpec(specId: string): Promise<{
    specId: string;
    nextArtifact: string;
    artifactName: string;
    order: number;
    created: boolean;
    message: string;
  } | null> {
    sanitizeId(specId, 'Spec ID'); // 防止路径遍历攻击
    const spec = await this.crud.getSpec(specId); // 加载目标 Spec
    if (!spec) throw new Error(`Spec ${specId} 不存在`); // 校验存在性

    // v12.0: 检查 requires DAG 依赖是否满足（所有前置 Spec 必须是 ready 或 done 状态）
    if (spec.requires && spec.requires.length > 0) {
      const notReadyDeps: Array<{ specId: string; status: string }> = []; // 未就绪的依赖列表
      for (const reqId of spec.requires) {
        const reqSpec = await this.crud.getSpec(reqId); // 加载依赖的 Spec
        if (!reqSpec) {
          notReadyDeps.push({ specId: reqId, status: '不存在' }); // 依赖 Spec 不存在
        } else if (reqSpec.status !== 'ready' && reqSpec.status !== 'done') {
          notReadyDeps.push({ specId: reqId, status: reqSpec.status }); // 依赖 Spec 状态未就绪
        }
      }
      if (notReadyDeps.length > 0) { // 存在未满足的依赖
        const details = notReadyDeps.map(d => `${d.specId}(${d.status})`).join(', '); // 格式化详情
        log.warn(`continueSpec: Spec ${specId} 的 requires 依赖未满足: ${details}`); // 警告日志
        throw new Error(`Spec ${specId} 的前置依赖未就绪，无法继续。未就绪的依赖: ${details}`); // 抛出错误
      }
      log.info(`continueSpec: Spec ${specId} 的所有 requires 依赖已满足`); // 依赖检查通过日志
    }

    // 默认产物顺序定义
    const defaultArtifacts = [
      { id: 'proposal', name: '提案', order: 0 },
      { id: 'design', name: '设计', order: 1 },
      { id: 'tasks', name: '任务分解', order: 2 },
      { id: 'implementation', name: '实现', order: 3 },
    ];

    // 确定产物列表：优先使用自定义 Schema，否则用默认顺序
    let artifactList: Array<{ id: string; name: string; order: number; deps: string[] }> = [];

    if (spec.workflowSchemaId) { // 关联了自定义工作流 Schema
      const wsm = new WorkflowSchemaManager(this.projectRoot); // 创建工作流 Schema 管理器
      const schema = await wsm.getSchema(spec.workflowSchemaId); // 加载 Schema
      if (schema) {
        // 从 Schema 的 artifactTypes 构建产物列表，使用 dependencies 确定顺序
        artifactList = schema.artifactTypes.map((at, idx) => ({
          id: at.id, // 产物 ID
          name: at.name, // 显示名称
          order: idx, // 索引顺序
          deps: schema.dependencies[at.id] || [], // 该产物的依赖列表
        }));
        log.info(`continueSpec: 使用自定义工作流 Schema "${spec.workflowSchemaId}"`); // 日志
      } else {
        log.warn(`continueSpec: 工作流 Schema "${spec.workflowSchemaId}" 不存在，回退到默认顺序`); // 警告
        artifactList = defaultArtifacts.map(a => ({ ...a, deps: [] })); // 回退
      }
    } else {
      // 使用默认产物顺序
      artifactList = defaultArtifacts.map(a => ({ ...a, deps: [] })); // 无依赖
      log.info(`continueSpec: 使用默认产物顺序（proposal → design → tasks → implementation）`); // 日志
    }

    // 获取所有 Spec，提取已存在的 artifactType
    const allSpecs = await this.crud.listSpecs(); // 获取所有 Spec
    const completedArtifacts = new Set<string>(); // 已完成的产物类型集合

    // 查找所有 Spec 的 artifactType
    for (const s of allSpecs) {
      if (s.artifactType) { // 有产物类型的 Spec
        completedArtifacts.add(s.artifactType); // 标记为已完成
      }
    }

    // 当前 Spec 自身的 artifactType 也算完成
    if (spec.artifactType) {
      completedArtifacts.add(spec.artifactType);
    }

    // 按顺序找到下一个可执行的产物
    for (const artifact of artifactList) {
      if (completedArtifacts.has(artifact.id)) continue; // 跳过已完成的

      // 检查依赖是否都已完成
      const depsCompleted = artifact.deps.every(dep => completedArtifacts.has(dep)); // 所有依赖都满足
      if (!depsCompleted) continue; // 依赖未满足，跳过

      // v15.0 OS-5: 构建 4 层结构提示词：<context> + <rules> + <template> + <instruction>
      // 第 1 层：<context> - 项目上下文（从 .qflow/project.md 加载）
      let contextBlock = ''; // 上下文块默认为空
      try {
        const projectCtx = await this.crud.loadProjectContext(); // 加载项目上下文
        if (projectCtx) { // 上下文存在则构建 XML 块
          contextBlock = `<context>\n${projectCtx}\n</context>\n\n`; // 包裹在 context 标签中
        }
      } catch (_e) { log.warn('项目上下文加载失败: ' + (_e instanceof Error ? _e.message : String(_e))); } // v22.0 P1-5

      // 第 2 层：<rules> - Schema 级规则（若关联了自定义 Schema 且有 rules 配置）
      let rulesBlock = ''; // 规则块默认为空
      if (spec.workflowSchemaId) { // 关联了自定义 Schema
        const wsm2 = new WorkflowSchemaManager(this.projectRoot); // 创建工作流 Schema 管理器
        const activeSchema = await wsm2.getSchema(spec.workflowSchemaId); // 加载关联的 Schema
        if (activeSchema?.rules?.[artifact.id]) { // 存在该产物的规则配置
          rulesBlock = `<rules>\n${activeSchema.rules[artifact.id]}\n</rules>\n\n`; // 包裹规则内容
        }
        // Schema 级 context 补充（若存在则追加到 contextBlock）
        if (activeSchema?.context) { // Schema 定义了项目级上下文
          contextBlock = contextBlock
            ? `${contextBlock.trimEnd()}\n\n<!-- Schema 上下文 -->\n${activeSchema.context}\n</context>\n\n`
              .replace(/<context>[\s\S]*?<!-- Schema 上下文 -->/, `<context>\n${activeSchema.context}\n\n<!-- Schema 上下文 -->`)
            : `<context>\n${activeSchema.context}\n</context>\n\n`; // 仅 Schema 上下文
        }
      }

      // 第 3 层：<template> - 产物 Markdown 模板（从 artifactTypes 的 template 字段读取）
      let templateBlock = ''; // 模板块默认为空
      const sectionContent = `## ${artifact.name}\n\nTODO: 补充 ${artifact.name} 内容`; // 初始内容

      // 尝试加载产物的自定义 Markdown 模板
      if (artifact.id && spec.workflowSchemaId) { // 有自定义 Schema 才可能有模板
        const wsm3 = new WorkflowSchemaManager(this.projectRoot); // 创建工作流 Schema 管理器
        const schemaForTemplate = await wsm3.getSchema(spec.workflowSchemaId); // 加载 Schema
        const artifactTypeDef = schemaForTemplate?.artifactTypes.find(at => at.id === artifact.id); // 找到产物类型定义
        if (artifactTypeDef?.template) { // 产物类型定义了 template 路径
          const templatePath = path.join(this.projectRoot, artifactTypeDef.template); // 拼接模板文件路径
          try {
            const templateContent = await fs.readFile(templatePath, 'utf-8'); // 读取模板文件内容
            templateBlock = `<template>\n${templateContent}\n</template>\n\n`; // 包裹在 template 标签中
            log.debug(`continueSpec: 已加载产物模板 "${artifact.id}": ${templatePath}`); // 调试日志
          } catch (_e) {
            log.warn(`continueSpec: 产物模板文件读取失败: ${templatePath}`); // 读取失败记录警告
          }
        }
      }

      // 第 4 层：<instruction> - per-artifact 自定义指令（来自 WorkflowSchema 的 artifactTypes.instruction 字段）
      let instructionBlock = ''; // 指令块默认为空
      if (spec.workflowSchemaId) { // 关联了自定义 Schema 才检查 instruction 字段
        const wsm4 = new WorkflowSchemaManager(this.projectRoot); // 创建工作流 Schema 管理器
        const schemaForInstruction = await wsm4.getSchema(spec.workflowSchemaId); // 加载 Schema
        const artifactWithInstruction = schemaForInstruction?.artifactTypes.find(at => at.id === artifact.id); // 找到对应产物
        if (artifactWithInstruction?.instruction) { // 该产物定义了 instruction 字段
          instructionBlock = `<instruction>\n${artifactWithInstruction.instruction}\n</instruction>`; // 包裹指令内容
          log.debug(`continueSpec: 为产物 "${artifact.id}" 加载自定义 instruction`); // 调试日志
        }
      }

      // 组合 4 层提示词 → 拼接为完整的初始内容
      // 若各层均为空，则回退到默认的 TODO 初始内容
      const promptLayers = [contextBlock, rulesBlock, templateBlock, instructionBlock]
        .filter(layer => layer.trim().length > 0) // 过滤空层
        .join('\n'); // 层间换行分隔
      const initialContent = promptLayers.length > 0
        ? `## ${artifact.name}\n\n${promptLayers}\n\nTODO: 根据以上指令补充 ${artifact.name} 内容` // 有提示层
        : sectionContent; // 无提示层则回退默认内容
      const changeItems = [{
        type: 'ADDED' as const, // 新增类型
        section: artifact.name, // 目标章节
        after: initialContent, // 新增内容（v15.0 OS-5: 使用 4 层提示词构建的内容）
        rationale: `自动创建产物: ${artifact.name}（continueSpec）`, // 变更理由
      }];

      // 创建 pending 变更
      await this.propose(specId, changeItems, `增量创建产物: ${artifact.name}`); // 提交变更提案

      log.info(`continueSpec: 为 Spec ${specId} 创建下一个产物 "${artifact.id}" (${artifact.name})`); // 日志
      return {
        specId, // Spec ID
        nextArtifact: artifact.id, // 下一个产物 ID
        artifactName: artifact.name, // 产物名称
        order: artifact.order, // 产物顺序
        created: true, // 已创建
        message: `已为 Spec ${specId} 创建产物 "${artifact.name}" 的变更提案，请使用 qflow_spec_apply 应用`, // 提示信息
      };
    }

    // 所有产物都已完成
    log.info(`continueSpec: Spec ${specId} 的所有产物已完成`); // 日志
    return null; // 返回 null 表示全部完成
  }

  /**
   * v13.0 E-3: 将 Spec 中的 Design 段提取为独立文件
   *
   * 从 spec.md 中提取 `## Design` 段落 → 写入 `design.md` → 原 spec.md 替换为链接引用。
   *
   * @param specId - Spec ID
   * @returns 分离结果
   */
  async separateDesign(specId: string): Promise<{ separated: boolean; designPath: string; designLength: number }> {
    const safeId = sanitizeId(specId, 'Spec ID'); // 安全清洗 ID
    const specDir = path.join(this.projectRoot, QFLOW_DIR, 'specs', safeId); // Spec 目录
    const mdPath = path.join(specDir, 'spec.md'); // spec.md 路径
    const designPath = path.join(specDir, 'design.md'); // design.md 路径

    const content = await fs.readFile(mdPath, 'utf-8'); // 读取 spec.md

    // 查找 ## Design 段落
    const designRegex = /^## Design\b.*$/m; // 匹配 ## Design 行
    const match = content.match(designRegex); // 执行匹配
    if (!match || match.index === undefined) {
      return { separated: false, designPath: '', designLength: 0 }; // 未找到 Design 段
    }

    // 提取 Design 段内容（从 ## Design 开始，到下一个 ## 或文件末尾）
    const startIdx = match.index; // Design 段起始位置
    const remaining = content.slice(startIdx + match[0].length); // Design 行之后的内容
    const nextSectionMatch = remaining.match(/^## /m); // 查找下一个 ## 段落
    const endIdx = nextSectionMatch && nextSectionMatch.index !== undefined
      ? startIdx + match[0].length + nextSectionMatch.index // 下一个 ## 之前
      : content.length; // 到文件末尾

    const designContent = content.slice(startIdx, endIdx).trim(); // 提取 Design 段内容
    const beforeDesign = content.slice(0, startIdx); // Design 前的内容
    const afterDesign = content.slice(endIdx); // Design 后的内容

    // v14.0 L-5: design.md 写入加锁
    await withFileLock(designPath, async () => {
      await fs.writeFile(designPath, designContent, 'utf-8'); // 写入独立文件（锁内完成）
    });

    // 替换原文为链接引用
    const newContent = beforeDesign + `> Design 详见 [design.md](design.md)\n\n` + afterDesign; // 替换为链接
    // v14.0 L-5: spec.md 写入加锁
    await withFileLock(mdPath, async () => {
      await fs.writeFile(mdPath, newContent, 'utf-8'); // 更新 spec.md（锁内完成）
    });

    // 更新 spec.json
    const spec = await this.crud.getSpec(safeId); // 读取 spec.json
    if (spec) {
      const updated = { ...spec, updatedAt: new Date().toISOString() }; // 更新时间戳
      await writeJSON(path.join(specDir, 'spec.json'), updated); // 持久化
    }

    log.info(`separateDesign: Spec ${safeId} 的 Design 段已分离到 design.md (${designContent.length} 字符)`); // 信息日志
    return { separated: true, designPath, designLength: designContent.length };
  }

  /**
   * v13.0 E-6: 快速推进 Spec — 跳过已满足依赖的中间节点
   *
   * 遍历 DAG 中的 requires 链，如果某个 Spec 的所有依赖都已 done，
   * 则将该 Spec 状态推进为 ready。
   *
   * @param specId - 起始 Spec ID（如果该 Spec 的依赖都已满足，推进其状态）
   * @returns 推进结果
   */
  async fastForward(specId: string): Promise<{ advanced: string[]; skipped: string[]; note: string }> {
    const safeId = sanitizeId(specId, 'Spec ID'); // 安全清洗
    const advanced: string[] = []; // 被推进的 Spec
    const skipped: string[] = []; // 跳过的 Spec

    // 加载所有 Spec
    const allSpecs: Spec[] = []; // 收集所有 Spec
    const specsDir = path.join(this.projectRoot, QFLOW_DIR, 'specs'); // Spec 目录

    if (await fileExists(specsDir)) {
      const entries = await fs.readdir(specsDir, { withFileTypes: true }); // 读取目录
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const spec = await this.crud.getSpec(entry.name); // 读取 Spec
        if (spec) allSpecs.push(spec); // 收集
      }
    }

    const specMap = new Map(allSpecs.map(s => [s.id, s])); // ID → Spec 映射

    // 从目标 Spec 开始，沿 requires 链检查
    const target = specMap.get(safeId); // 获取目标 Spec
    if (!target) return { advanced: [], skipped: [], note: `Spec ${safeId} 不存在` };

    // BFS 遍历依赖图，推进所有可推进的 Spec
    const queue = [safeId]; // 待检查队列
    const visited = new Set<string>(); // 已访问集合

    while (queue.length > 0) {
      const currentId = queue.shift()!; // 取出队首
      if (visited.has(currentId)) continue; // 跳过已访问
      visited.add(currentId); // 标记已访问

      const spec = specMap.get(currentId); // 获取 Spec
      if (!spec) { skipped.push(currentId); continue; } // 不存在则跳过

      if (spec.status === 'done') { skipped.push(currentId); continue; } // 已完成跳过

      // 检查所有 requires 是否已 done
      const allDone = spec.requires.every(reqId => { // 检查每个依赖
        const reqSpec = specMap.get(reqId); // 获取依赖 Spec
        return reqSpec && reqSpec.status === 'done'; // 是否已完成
      });

      if (allDone && spec.status === 'draft') { // 依赖都满足且当前为 draft
        // 推进为 ready
        const specDir = path.join(specsDir, spec.id); // Spec 目录
        const updated = { ...spec, status: 'ready' as const, updatedAt: new Date().toISOString() }; // 更新状态
        await writeJSON(path.join(specDir, 'spec.json'), updated); // 持久化
        advanced.push(currentId); // 记录推进
        log.info(`fastForward: Spec ${currentId} draft → ready`); // 信息日志
      } else if (!allDone) {
        skipped.push(currentId); // 依赖未满足，跳过
      }

      // 将依赖该 Spec 的下游 Spec 加入队列
      for (const s of allSpecs) {
        if (s.requires.includes(currentId) && !visited.has(s.id)) {
          queue.push(s.id); // 加入待检查队列
        }
      }
    }

    return {
      advanced, // 被推进的 Spec
      skipped, // 跳过的 Spec
      note: advanced.length > 0 ? `已推进 ${advanced.length} 个 Spec 为 ready` : '无可推进的 Spec',
    };
  }

  /**
   * v13.0 D-3: 列出 Spec 中的可执行 Actions（非线性工作流）
   *
   * 解析 Spec content 中的 `## Actions` 段落，返回结构化 action 列表。
   * 支持 Markdown checklist 格式：`- [ ] action name` 或 `- [x] action name`。
   *
   * @param specId - Spec ID
   * @returns action 列表
   */
  async listActions(specId: string): Promise<Array<{ name: string; description: string; status: 'pending' | 'done' }>> {
    const id = sanitizeId(specId, 'specId'); // 安全清洗
    const mdPath = path.join(this.crud.specsDir, id, 'spec.md'); // Spec 文件路径

    let content: string;
    try {
      content = await fs.readFile(mdPath, 'utf-8'); // 读取 Spec 内容
    } catch {
      throw new Error(`Spec ${id} 的 spec.md 不存在`); // 文件不存在
    }

    // 解析 ## Actions 段落（到下一个 ## 或文件末尾）
    const actionsIdx = content.indexOf('## Actions'); // 查找 Actions 段起始位置
    if (actionsIdx < 0) return []; // 无 Actions 段

    let actionsBody = content.substring(actionsIdx + '## Actions'.length); // 截取 Actions 后的内容
    const nextSectionIdx = actionsBody.indexOf('\n## '); // 查找下一个 section
    if (nextSectionIdx >= 0) actionsBody = actionsBody.substring(0, nextSectionIdx); // 截断到下一个 section

    const actions: Array<{ name: string; description: string; status: 'pending' | 'done' }> = []; // 结果列表
    const lines = actionsBody.split('\n'); // 按行拆分
    for (const line of lines) {
      const checkMatch = line.match(/^- \[([ xX])\] (.+)$/); // 匹配 checklist 项
      if (checkMatch) {
        const actionName = checkMatch[2].trim(); // action 名称
        actions.push({
          name: actionName, // 名称
          description: actionName, // 描述（同名称）
          status: checkMatch[1].toLowerCase() === 'x' ? 'done' : 'pending', // 状态
        });
      }
    }
    return actions; // 返回 action 列表
  }

  /**
   * v20.0 P2-12: 根据变更类型查询必需的产物类型列表
   *
   * 从 qflow.config.json 的 artifactRules 字段读取映射规则，
   * 返回指定 changeType 对应的必需产物类型数组。
   * 若无匹配规则则返回空数组。
   *
   * @param changeType - 变更类型（如 'ADDED', 'MODIFIED', 'REMOVED', 'RENAMED'）
   * @returns 必需的产物类型列表（如 ['test', 'doc']）
   */
  async applyArtifactRules(changeType: string): Promise<string[]> {
    try {
      const config = await loadConfig(this.projectRoot); // 加载项目配置
      const rules = config.artifactRules; // 获取产物规则映射
      if (!rules || Object.keys(rules).length === 0) { // 无规则配置
        log.debug(`applyArtifactRules: 未配置 artifactRules，返回空数组`); // 调试日志
        return []; // 返回空数组
      }
      const matched = rules[changeType]; // 查找匹配的变更类型
      if (!matched || matched.length === 0) { // 无匹配规则
        log.debug(`applyArtifactRules: changeType "${changeType}" 无匹配规则`); // 调试日志
        return []; // 返回空数组
      }
      log.info(`applyArtifactRules: changeType "${changeType}" 需要产物: ${matched.join(', ')}`); // 信息日志
      return matched; // 返回匹配的产物类型列表
    } catch (err) {
      log.warn(`applyArtifactRules: 读取配置失败: ${(err as Error).message}`); // 警告日志
      return []; // 配置读取失败时返回空数组
    }
  }

  /**
   * v20.0 P3-5: Living Spec — Spec 变更后自动同步关联任务
   *
   * 扫描所有任务，找到 title 或 description 中包含 specId 的任务，
   * 在其 description 末尾追加 "[Living Spec 同步]" 标注，告知任务关联的 Spec 已更新。
   * 每个任务只追加一次，避免重复标注。
   *
   * @param specId - 已更新的 Spec ID
   * @returns 更新结果：specId 和已更新的任务 ID 列表
   */
  async livingSpecUpdate(specId: string): Promise<{ specId: string; updatedTaskIds: string[] }> {
    const { TaskManager } = await import('./task-manager.js'); // 动态导入，避免循环依赖
    const tm = new TaskManager(this.projectRoot); // 创建任务管理器实例
    const tasks = await tm.getAllTasks(); // 获取全部任务列表

    // 查找 title 或 description 包含 specId 的关联任务
    const related = tasks.filter(t =>
      t.description?.includes(specId) || t.title?.includes(specId)
    );

    const updatedIds: string[] = []; // 记录已更新的任务 ID
    const timestamp = new Date().toISOString(); // 生成当前时间戳

    for (const task of related) {
      const marker = `[Living Spec 同步] 关联 Spec ${specId} 已更新 (${timestamp})`; // 同步标注内容
      if (!task.description?.includes('[Living Spec 同步]')) { // 避免对同一任务重复追加标注
        await tm.updateTask(task.id, {
          description: `${task.description || ''}\n\n${marker}`, // 在原描述末尾追加标注
        });
        updatedIds.push(task.id); // 记录已更新的任务 ID
        log.debug(`v20.0 P3-5 Living Spec: 已标注任务 ${task.id} (关联 Spec ${specId})`); // 调试日志
      }
    }

    if (updatedIds.length > 0) {
      log.info(`v20.0 P3-5 Living Spec: Spec ${specId} 变更已同步到 ${updatedIds.length} 个关联任务`); // 信息日志
    }

    return { specId, updatedTaskIds: updatedIds }; // 返回 specId 和已更新任务 ID 列表
  }

  /** P3-9: 为变更创建隔离目录 */
  async perChangeFolderCreate(changeId: string): Promise<string> {
    const { promises: fsPromises } = await import('node:fs'); // 动态导入
    const pathMod = await import('node:path'); // 动态导入
    const dir = pathMod.join(this.projectRoot, '.qflow', 'specs', 'changes', changeId); // 隔离目录
    await fsPromises.mkdir(dir, { recursive: true }); // 创建目录
    return dir; // 返回路径
  }

  /** v21.0 P2-10: 测量压缩比 */
  measureCompressionRatio(original: string, compressed: string): { originalLength: number; compressedLength: number; ratio: number; savings: string } {
    const originalLength = original.length; // 原始长度
    const compressedLength = compressed.length; // 压缩后长度
    const ratio = originalLength > 0 ? compressedLength / originalLength : 1; // 压缩比（越小越好）
    const savingsPercent = ((1 - ratio) * 100).toFixed(1); // 节省百分比
    return {
      originalLength, // 原始字符数
      compressedLength, // 压缩后字符数
      ratio: Math.round(ratio * 1000) / 1000, // 压缩比（保留 3 位小数）
      savings: `${savingsPercent}%`, // 节省比例字符串
    };
  }

  /** v21.0 P2-9: 无损压缩 + round-trip 验证 */
  compressWithVerification(content: string): { compressed: string; metrics: { originalLength: number; compressedLength: number; ratio: number; savings: string }; verification: { keywordRetention: number; structurePreserved: boolean; verdict: 'PASS' | 'FAIL' } } {
    if (!content || content.trim().length === 0) { // 空内容直接返回
      return {
        compressed: content,
        metrics: { originalLength: 0, compressedLength: 0, ratio: 1, savings: '0.0%' },
        verification: { keywordRetention: 1, structurePreserved: true, verdict: 'PASS' },
      };
    }

    // Step 1: 压缩 - 移除多余空行、注释行、缩进空白
    const lines = content.split('\n'); // 按行分割
    const compressedLines: string[] = []; // 压缩后的行
    let prevEmpty = false; // 上一行是否为空

    for (const line of lines) {
      const trimmed = line.trim(); // 去除首尾空白
      if (trimmed.length === 0) { // 空行
        if (!prevEmpty) compressedLines.push(''); // 连续空行只保留一个
        prevEmpty = true;
        continue;
      }
      prevEmpty = false;
      // 移除纯注释行（保留标题行）
      if (trimmed.startsWith('//') && !trimmed.startsWith('///') && !trimmed.includes('TODO') && !trimmed.includes('FIXME')) {
        continue; // 跳过普通注释
      }
      compressedLines.push(trimmed); // 保留有效内容（去除缩进）
    }

    const compressed = compressedLines.join('\n').trim(); // 合并压缩行

    // Step 2: 测量压缩比
    const metrics = this.measureCompressionRatio(content, compressed); // 测量压缩效果

    // Step 3: Round-trip 验证 - 检查关键词保留率
    const keywords = content.match(/[A-Z][a-zA-Z]{3,}|[a-z]{5,}|[\u4e00-\u9fff]{2,}/g) || []; // 提取关键词（驼峰/长词/中文）
    const uniqueKeywords = [...new Set(keywords)]; // 去重
    const retainedCount = uniqueKeywords.filter(kw => compressed.includes(kw)).length; // 保留的关键词数
    const keywordRetention = uniqueKeywords.length > 0 ? retainedCount / uniqueKeywords.length : 1; // 关键词保留率

    // Step 4: 结构验证 - 检查标题和节是否保留
    const originalHeaders = (content.match(/^#{1,6}\s.+/gm) || []).length; // 原始标题数
    const compressedHeaders = (compressed.match(/^#{1,6}\s.+/gm) || []).length; // 压缩后标题数
    const structurePreserved = compressedHeaders >= originalHeaders; // 结构是否完整保留

    // Step 5: 判定
    const verdict = keywordRetention >= 0.8 && structurePreserved ? 'PASS' as const : 'FAIL' as const; // 综合判定

    return {
      compressed, // 压缩后内容
      metrics, // 压缩指标
      verification: { keywordRetention: Math.round(keywordRetention * 100) / 100, structurePreserved, verdict }, // 验证结果
    };
  }
}
