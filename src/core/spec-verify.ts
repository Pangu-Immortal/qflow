/**
 * SpecVerify - Spec 验证子模块
 *
 * 职责：Spec 多维度验证和产物链顺序校验
 * 子模块函数列表:
 * - verify()               五维校验 Spec（完整性/正确性/一致性/实现匹配度/需求强度）
 * - validateArtifactChain() 验证 Spec 产物链顺序（含 Schema 驱动）
 *
 * 依赖注入：
 * - tm: TaskManager  从外部注入任务管理器（SM-7: 消除 new TaskManager() 内部实例化）
 */

import path from 'node:path'; // 路径拼接工具
import { log } from '../utils/logger.js'; // 日志工具
import { sanitizeId, assertPathWithinRoot } from '../shared/tool-utils.js'; // 工具函数
import { fileExists } from '../utils/file-io.js'; // 文件工具
import { SPEC_MIN_CONTENT_LENGTH, SPEC_LONG_CONTENT_THRESHOLD } from '../shared/constants.js'; // v16.0 Q-2: 硬编码值常量化
import { WorkflowSchemaManager } from './workflow-schema-manager.js'; // 工作流 Schema 管理器
import type { TaskManager } from './task-manager.js'; // 任务管理器类型（SM-7: 通过构造函数注入）
import type { SpecCrud } from './spec-crud.js'; // CRUD 子模块类型

/**
 * SpecVerify 类 - 处理 Spec 的多维度验证
 *
 * 通过构造函数注入 SpecCrud 和 TaskManager，避免内部硬编码依赖。
 */
export class SpecVerify {
  /**
   * @param projectRoot - 项目根目录绝对路径
   * @param crud        - SpecCrud 实例，用于读取 Spec 数据
   * @param tm          - TaskManager 实例（SM-7: 依赖注入，不再 new TaskManager() 内部实例化）
   */
  constructor(
    private projectRoot: string,
    private crud: SpecCrud, // 依赖注入 SpecCrud
    private tm: TaskManager, // 依赖注入 TaskManager（SM-7）
  ) {}

  /**
   * 校验 Spec 完整性/正确性/一致性（含问题列表和严重级别）
   *
   * 五维评分:
   * - 完整度: 检查内容非空、必要章节是否存在
   * - 正确性: Zod 校验通过、无占位符内容
   * - 一致性: 依赖 Spec 都存在、内部引用一致
   * - 实现匹配度: 目标文件存在、关联任务完成情况
   * - 需求强度: RFC 2119 关键词使用情况
   *
   * @param specId - Spec ID
   * @returns 五个维度的百分制评分、综合评分和问题列表
   */
  async verify(specId: string): Promise<{
    completeness: number;         // 完整性评分 0-100
    correctness: number;          // 正确性评分 0-100
    consistency: number;          // 一致性评分 0-100
    implementation: number;       // 实现匹配度评分 0-100
    requirementStrength: number;  // 需求强度评分 0-100
    fileExistence: number;        // v13.0 V-1: 文件存在性评分 0-100
    overallScore: number;         // 综合评分 0-100
    valid: boolean;               // 是否通过验证（仅当 criticalCount === 0 时为 true）
    criticalCount: number;        // critical 级别问题数
    warningCount: number;         // warning 级别问题数
    suggestionCount: number;      // suggestion 级别问题数
    issues: Array<{
      severity: 'critical' | 'warning' | 'suggestion'; // 严重级别（三级：critical/warning/suggestion）
      dimension: 'completeness' | 'correctness' | 'consistency' | 'requirementStrength' | 'fileExistence'; // 所属维度
      message: string;      // 问题描述
    }>;
  }> {
    sanitizeId(specId, 'Spec ID'); // 防止路径遍历攻击
    const spec = await this.crud.getSpec(specId); // 加载 Spec
    if (!spec) throw new Error(`Spec ${specId} 不存在`); // 校验存在

    const issues: Array<{
      severity: 'critical' | 'warning' | 'suggestion';
      dimension: 'completeness' | 'correctness' | 'consistency' | 'requirementStrength' | 'fileExistence';
      message: string;
    }> = []; // 问题列表

    // ========== 完整度检测 ==========
    let completenessScore = 100; // 初始满分
    const content = spec.content.trim(); // 去除首尾空白

    if (content.length === 0) { // 内容为空
      completenessScore = 0; // 直接零分
      issues.push({ severity: 'critical', dimension: 'completeness', message: 'Spec 内容为空' });
    } else {
      if (content.length < SPEC_MIN_CONTENT_LENGTH) { // 内容过短（v16.0 Q-2: 使用常量）
        completenessScore -= 30; // 扣 30 分
        issues.push({ severity: 'warning', dimension: 'completeness', message: `Spec 内容过短（${content.length} 字符），建议补充详细描述` });
      }
      // 检查常见章节标题是否存在
      const expectedSections = ['##', '###']; // 期望有子章节标记
      const hasSubSections = expectedSections.some((s) => content.includes(s)); // 是否含子章节
      if (!hasSubSections && content.length > SPEC_LONG_CONTENT_THRESHOLD) { // 长内容但无子章节（v16.0 Q-2: 使用常量）
        completenessScore -= 15; // 扣 15 分
        issues.push({ severity: 'suggestion', dimension: 'completeness', message: '内容较长但缺少章节结构（## / ###），建议增加章节划分' });
      }
      if (!spec.name || spec.name.trim().length === 0) { // 名称为空
        completenessScore -= 20; // 扣 20 分
        issues.push({ severity: 'critical', dimension: 'completeness', message: 'Spec 名称为空' });
      }
      if (spec.targetFiles.length === 0) { // 无关联文件
        completenessScore -= 10; // 扣 10 分
        issues.push({ severity: 'suggestion', dimension: 'completeness', message: '未关联任何目标文件（targetFiles 为空）' });
      }
    }
    completenessScore = Math.max(0, completenessScore); // 不低于 0

    // ========== 场景结构检测（P2: GIVEN/WHEN/THEN） ==========
    const givenPattern = /\b(GIVEN|Given|given)\b/; // GIVEN 关键词
    const whenPattern = /\b(WHEN|When|when)\b/; // WHEN 关键词
    const thenPattern = /\b(THEN|Then|then)\b/; // THEN 关键词
    const hasGiven = givenPattern.test(content); // 检测 GIVEN
    const hasWhen = whenPattern.test(content); // 检测 WHEN
    const hasThen = thenPattern.test(content); // 检测 THEN
    const scenarioCount = [hasGiven, hasWhen, hasThen].filter(Boolean).length; // 场景关键词命中数

    if (scenarioCount > 0 && scenarioCount < 3) { // 部分场景结构
      completenessScore -= 10; // 扣 10 分
      const missing = [
        !hasGiven ? 'GIVEN' : null,
        !hasWhen ? 'WHEN' : null,
        !hasThen ? 'THEN' : null,
      ].filter(Boolean).join(', '); // 缺失的关键词
      issues.push({
        severity: 'warning',
        dimension: 'completeness',
        message: `场景描述不完整，缺少 ${missing}（建议使用 GIVEN/WHEN/THEN 结构）`,
      });
    }
    completenessScore = Math.max(0, completenessScore); // 重新校正下限

    // ========== 正确性检测 ==========
    let correctnessScore = 100; // 初始满分（Zod 校验已在 getSpec 中通过）

    // 检查占位符内容
    const placeholderPatterns = ['TODO', 'FIXME', 'XXX', 'PLACEHOLDER', 'TBD', '待补充', '待完善']; // 占位符关键词
    for (const pattern of placeholderPatterns) { // 逐个检查
      if (content.toUpperCase().includes(pattern)) { // 发现占位符
        correctnessScore -= 10; // 每个扣 10 分
        issues.push({ severity: 'warning', dimension: 'correctness', message: `内容包含占位符标记: ${pattern}` });
      }
    }

    // 检查空章节（## 标题后紧接另一个 ## 或文件结尾）
    const emptySecRegex = /^##\s+.+\n(?=##\s|\s*$)/gm; // 空章节正则
    const emptySecMatches = content.match(emptySecRegex); // 匹配空章节
    if (emptySecMatches) { // 存在空章节
      correctnessScore -= emptySecMatches.length * 5; // 每个空章节扣 5 分
      issues.push({ severity: 'warning', dimension: 'correctness', message: `存在 ${emptySecMatches.length} 个空章节` });
    }
    correctnessScore = Math.max(0, correctnessScore); // 不低于 0

    // ========== 一致性检测 ==========
    let consistencyScore = 100; // 初始满分

    if (spec.dependencies.length > 0) { // 有依赖
      let missingCount = 0; // 缺失的依赖数
      for (const depId of spec.dependencies) { // 遍历每个依赖
        const dep = await this.crud.getSpec(depId); // 查找依赖 Spec
        if (!dep) { // 依赖不存在
          missingCount++; // 计数
          issues.push({ severity: 'critical', dimension: 'consistency', message: `依赖 Spec "${depId}" 不存在` });
        }
      }
      if (missingCount > 0) { // 有缺失依赖
        const missingRatio = missingCount / spec.dependencies.length; // 缺失比例
        consistencyScore = Math.round((1 - missingRatio) * 100); // 按比例扣分
      }
    }

    // 检查 taskIds 中是否有空值
    const emptyTaskIds = spec.taskIds.filter((t) => !t || t.trim().length === 0); // 空任务 ID
    if (emptyTaskIds.length > 0) { // 存在空值
      consistencyScore -= 10; // 扣 10 分
      issues.push({ severity: 'warning', dimension: 'consistency', message: `taskIds 中存在 ${emptyTaskIds.length} 个空值` });
    }
    // ========== v12.0 D-4: DAG requires[] 验证 ==========
    if (spec.requires && spec.requires.length > 0) { // 存在 DAG 依赖声明
      let missingReqCount = 0; // 缺失的依赖 Spec 数
      let notReadyCount = 0; // 未就绪的依赖 Spec 数
      for (const reqId of spec.requires) { // 遍历每个 requires 依赖
        const reqSpec = await this.crud.getSpec(reqId); // 查找依赖 Spec
        if (!reqSpec) { // 依赖不存在
          missingReqCount++;
          issues.push({ severity: 'critical', dimension: 'consistency', message: `DAG 依赖 Spec "${reqId}" 不存在（requires 声明）` });
        } else if (reqSpec.status !== 'ready' && reqSpec.status !== 'done') { // 依赖未就绪
          notReadyCount++;
          issues.push({ severity: 'warning', dimension: 'consistency', message: `DAG 依赖 Spec "${reqId}" 状态为 "${reqSpec.status}"，尚未就绪` });
        }
      }
      if (missingReqCount > 0) { // 有缺失依赖
        const missingRatio = missingReqCount / spec.requires.length; // 缺失比例
        consistencyScore -= Math.round(missingRatio * 30); // 按比例扣分（最多扣 30）
      }
      if (notReadyCount > 0) { // 有未就绪依赖
        consistencyScore -= notReadyCount * 5; // 每个未就绪依赖扣 5 分
      }
    }
    consistencyScore = Math.max(0, consistencyScore); // 不低于 0

    // ========== 实现匹配度检测（v12.0 D-5: rigor='lite' 时跳过） ==========
    let implementationScore = 100; // 初始满分

    if (spec.rigor === 'lite') { // v12.0 D-5: lite 模式跳过实现匹配度检测
      implementationScore = 100; // lite 模式直接满分
      issues.push({ severity: 'suggestion', dimension: 'consistency' as const, message: 'rigor=lite: 跳过实现匹配度检测' });
    } else {
    // 检查 targetFiles 是否存在于磁盘（仅 rigor='full' 模式）
    if (spec.targetFiles.length > 0) {
      let missingFileCount = 0; // 缺失文件计数
      for (const targetFile of spec.targetFiles) {
        let fullPath: string;
        try {
          fullPath = assertPathWithinRoot(this.projectRoot, targetFile); // v12.0 S-2: 路径边界校验，防止路径穿越
        } catch (e) {
          issues.push({ severity: 'critical', dimension: 'consistency' as const, message: `目标文件路径不安全: ${targetFile} - ${(e as Error).message}` }); // 路径穿越告警
          missingFileCount++;
          continue; // 跳过不安全路径
        }
        if (!(await fileExists(fullPath))) { // 文件不存在
          missingFileCount++;
          issues.push({ severity: 'warning', dimension: 'consistency' as const, message: `目标文件不存在: ${targetFile}` });
        }
      }
      if (missingFileCount > 0) {
        const missingRatio = missingFileCount / spec.targetFiles.length;
        implementationScore = Math.round((1 - missingRatio) * 100);
      }
    } else {
      implementationScore = 50; // 未指定目标文件，给一半分
      issues.push({ severity: 'suggestion', dimension: 'consistency' as const, message: '未指定目标文件，无法验证实现匹配度' });
    }

    // 检查 taskIds 关联的任务完成情况（SM-7: 使用注入的 tm 而非 new TaskManager()）
    if (spec.taskIds.length > 0) {
      try {
        let doneCount = 0; // 已完成任务数
        let totalValid = 0; // 有效任务数
        for (const taskId of spec.taskIds) {
          if (!taskId || taskId.trim().length === 0) continue; // 跳过空任务 ID
          const task = await this.tm.getTask(taskId); // 查询任务（使用注入的 TaskManager）
          if (task) {
            totalValid++; // 计入有效数
            if (task.status === 'done') doneCount++; // 统计已完成数
          }
        }
        if (totalValid > 0) {
          const completionRatio = doneCount / totalValid; // 任务完成比例
          // 任务完成度影响实现匹配度
          implementationScore = Math.round(implementationScore * (0.5 + 0.5 * completionRatio));
        }
      } catch (e) {
        log.debug(`实现匹配度检测 - 任务查询失败: ${(e as Error).message}`); // 调试日志
      }
    }
    implementationScore = Math.max(0, implementationScore); // 不低于 0
    } // v12.0 D-5: 结束 rigor='full' 的实现匹配度检测块

    // ========== RFC 2119 需求强度检测（v10.0: 第 5 维度，v12.0 D-5: rigor='lite' 时跳过） ==========
    let requirementStrengthScore = 100; // 初始满分

    if (spec.rigor === 'lite') { // v12.0 D-5: lite 模式跳过 RFC 2119 检测
      issues.push({ severity: 'suggestion', dimension: 'completeness', message: 'rigor=lite: 跳过 RFC 2119 需求强度检测' });
    } else {
    const rfcMandatory = /\b(SHALL|MUST|REQUIRED)\b/g; // 强制关键词
    const rfcRecommended = /\b(SHOULD|RECOMMENDED)\b/g; // 推荐关键词
    const rfcOptional = /\b(MAY|OPTIONAL)\b/g; // 可选关键词
    const rfcNegative = /\b(SHALL NOT|MUST NOT|SHOULD NOT)\b/g; // 否定关键词
    const mandatoryCount = (content.match(rfcMandatory) || []).length; // 强制关键词数
    const recommendedCount = (content.match(rfcRecommended) || []).length; // 推荐关键词数
    const optionalCount = (content.match(rfcOptional) || []).length; // 可选关键词数
    const negativeCount = (content.match(rfcNegative) || []).length; // 否定关键词数
    const totalRfc = mandatoryCount + recommendedCount + optionalCount + negativeCount; // RFC 总数

    if (content.length > SPEC_LONG_CONTENT_THRESHOLD && totalRfc === 0) { // 长文档无 RFC 关键词（v16.0 Q-2: 使用常量）
      requirementStrengthScore -= 40;
      issues.push({ severity: 'warning', dimension: 'completeness', message: '未使用 RFC 2119 关键词（MUST/SHALL/SHOULD/MAY），建议明确需求强度' });
    }
    if (mandatoryCount === 0 && totalRfc > 0) { // 有推荐但无强制
      requirementStrengthScore -= 20;
      issues.push({ severity: 'suggestion', dimension: 'completeness', message: '缺少强制性关键词（MUST/SHALL），需求强度不明确' });
    }
    requirementStrengthScore = Math.max(0, requirementStrengthScore); // 不低于 0
    } // v12.0 D-5: 结束 rigor='full' 的 RFC 2119 检测块

    // ========== v13.0 V-1: 文件存在性检测（独立维度） ==========
    let fileExistenceScore = 100; // 初始满分
    if (spec.targetFiles && spec.targetFiles.length > 0) { // 有关联文件
      let existCount = 0; // 存在的文件数
      for (const tf of spec.targetFiles) { // 遍历每个目标文件
        try {
          const fullPath = assertPathWithinRoot(this.projectRoot, tf); // 路径安全校验
          if (await fileExists(fullPath)) { // 文件存在
            existCount++; // 计数
          } else {
            issues.push({ severity: 'warning', dimension: 'fileExistence', message: `引用文件不存在: ${tf}` }); // 文件缺失警告
          }
        } catch (e) {
          issues.push({ severity: 'critical', dimension: 'fileExistence', message: `文件路径无效: ${tf} - ${(e as Error).message}` }); // 路径安全错误
        }
      }
      const ratio = existCount / spec.targetFiles.length; // 存在比例
      fileExistenceScore = Math.round(ratio * 100); // 按比例评分
    } else {
      fileExistenceScore = 50; // 未关联任何文件，给一半分
    }
    fileExistenceScore = Math.max(0, fileExistenceScore); // 不低于 0

    // ========== 综合评分（v13.0 V-2: 六维加权，v12.0 D-5: rigor='lite' 时调整权重） ==========
    const isLite = spec.rigor === 'lite'; // 是否为 lite 模式
    const overallScore = isLite
      ? Math.round( // lite 模式: 仅 3 维（跳过 implementation/requirementStrength/fileExistence）
          completenessScore * 0.4 + correctnessScore * 0.3 + consistencyScore * 0.3,
        )
      : Math.round( // v13.0 V-2: full 模式 6 维加权
          completenessScore * 0.20 + correctnessScore * 0.15 + consistencyScore * 0.20 +
          implementationScore * 0.15 + requirementStrengthScore * 0.15 + fileExistenceScore * 0.15,
        );

    log.debug( // 调试日志
      `Spec ${specId} 验证: 完整度=${completenessScore}, 正确性=${correctnessScore}, ` +
      `一致性=${consistencyScore}, 实现匹配=${implementationScore}, 需求强度=${requirementStrengthScore}, ` +
      `文件存在=${fileExistenceScore}, 综合=${overallScore}, 问题数=${issues.length}`,
    );
    // 统计三级问题数量
    const criticalCount = issues.filter(i => i.severity === 'critical').length; // critical 级别问题数
    const warningCount = issues.filter(i => i.severity === 'warning').length; // warning 级别问题数
    const suggestionCount = issues.filter(i => i.severity === 'suggestion').length; // suggestion 级别问题数
    const valid = criticalCount === 0; // 仅当无 critical 问题时通过验证

    return { completeness: completenessScore, correctness: correctnessScore, consistency: consistencyScore, implementation: implementationScore, requirementStrength: requirementStrengthScore, fileExistence: fileExistenceScore, overallScore, valid, criticalCount, warningCount, suggestionCount, issues }; // v13.0 V-1: 新增 fileExistence, V-4: 三级统计
  }

  /**
   * 验证 Spec 产物链顺序（v10.0, v11.0 增强: Schema 驱动）
   *
   * 如果 Spec 关联了 workflowSchemaId，则从自定义 Schema 的 dependencies 读取依赖规则；
   * 否则回退到默认的硬编码顺序: proposal(0) → design(1) → tasks(2) → implementation(3)。
   *
   * @returns 验证结果
   */
  async validateArtifactChain(): Promise<{ valid: boolean; issues: string[] }> {
    const specs = await this.crud.listSpecs(); // 获取所有 Spec
    const issues: string[] = []; // 问题列表

    // v11.0: 收集所有关联的自定义 Schema，按 schemaId 缓存
    const wsm = new WorkflowSchemaManager(this.projectRoot); // 创建工作流 Schema 管理器
    const schemaCache = new Map<string, { dependencies: Record<string, string[]> }>(); // Schema 缓存

    for (const spec of specs) { // 遍历所有 Spec
      if (!spec.artifactType || spec.artifactOrder === undefined) continue; // 无产物类型则跳过

      // v11.0: 优先使用自定义 Schema 的依赖规则
      if (spec.workflowSchemaId) {
        // 尝试从缓存获取 Schema
        if (!schemaCache.has(spec.workflowSchemaId)) {
          const schema = await wsm.getSchema(spec.workflowSchemaId); // 加载自定义 Schema
          if (schema) {
            schemaCache.set(spec.workflowSchemaId, { dependencies: schema.dependencies }); // 缓存
          } else {
            issues.push(`Spec ${spec.id}: 关联的工作流 Schema "${spec.workflowSchemaId}" 不存在`); // Schema 不存在
            continue; // 跳过此 Spec 的后续校验
          }
        }

        const cachedSchema = schemaCache.get(spec.workflowSchemaId)!; // 从缓存获取
        const schemaDeps = cachedSchema.dependencies[spec.artifactType] || []; // 该产物类型的依赖列表

        // 检查依赖的 Spec 的 artifactType 是否在 Schema 依赖列表中
        for (const depId of spec.dependencies) {
          const dep = specs.find(s => s.id === depId); // 查找依赖 Spec
          if (dep?.artifactType && !schemaDeps.includes(dep.artifactType)) {
            issues.push(
              `Spec ${spec.id}(${spec.artifactType}) 依赖 ${depId}(${dep.artifactType})，` +
              `不符合工作流 Schema "${spec.workflowSchemaId}" 的依赖规则`
            );
          }
        }
        continue; // 已用自定义 Schema 校验，跳过默认逻辑
      }

      // 回退: 默认硬编码顺序映射
      const orderMap: Record<string, number> = { proposal: 0, design: 1, tasks: 2, implementation: 3 }; // 顺序映射

      // 检查 artifactOrder 是否与 artifactType 匹配
      const expectedOrder = orderMap[spec.artifactType]; // 期望顺序
      if (expectedOrder !== undefined && spec.artifactOrder !== expectedOrder) {
        issues.push(`Spec ${spec.id}: artifactType=${spec.artifactType} 期望 order=${expectedOrder}，实际 order=${spec.artifactOrder}`);
      }

      // 检查依赖的 Spec 的 artifactOrder 是否小于当前
      for (const depId of spec.dependencies) {
        const dep = specs.find(s => s.id === depId);
        if (dep?.artifactOrder !== undefined && spec.artifactOrder !== undefined) {
          if (dep.artifactOrder >= spec.artifactOrder) {
            issues.push(`Spec ${spec.id}(order=${spec.artifactOrder}) 依赖 ${depId}(order=${dep.artifactOrder})，反向依赖`);
          }
        }
      }
    }

    log.debug(`产物链验证: ${issues.length} 个问题`);
    return { valid: issues.length === 0, issues };
  }
}
