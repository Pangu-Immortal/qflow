/**
 * SpecManager - Spec 管理器聚合层（v16.0 重构）
 *
 * 本文件是 4 个子模块的聚合层，保持与旧版完全相同的公共 API：
 *
 *   - SpecCrud (spec-crud.ts)
 *       initSpec, getSpec, listSpecs, getStatus, loadProjectContext
 *
 *   - SpecWorkflow (spec-workflow.ts)
 *       propose, apply, archive, bulkArchive, continueSpec,
 *       fastForward, listActions, separateDesign
 *
 *   - SpecVerify (spec-verify.ts)
 *       verify, validateArtifactChain
 *
 *   - SpecAI (spec-ai.ts)
 *       generateFromCodebase, specProposeFull, getInstructions,
 *       initExploreSpec, listExploreSpecs, promoteExploreSpec,
 *       getDependencyGraph, getArtifactDAGStatus
 *
 * 数据目录:
 *   - specs:   {projectRoot}/.qflow/specs/{specId}/spec.json + spec.md
 *   - changes: {projectRoot}/.qflow/changes/{pending|applied|archived}/{changeId}.json
 *
 * 依赖注入说明：
 *   - SM-6: callAI 已去除（v25.0 去 AI 化）
 *   - SM-7: TaskManager 在构造函数中实例化后注入 SpecVerify
 *   - SM-8: loadConfig 通过 config-manager.js 动态 import 一次性获取后注入 SpecCrud
 */

import { SpecCrud } from './spec-crud.js'; // CRUD 子模块
import { SpecWorkflow } from './spec-workflow.js'; // 工作流子模块
import { SpecVerify } from './spec-verify.js'; // 验证子模块
import { SpecAI } from './spec-ai.js'; // AI 子模块
import { TaskManager } from './task-manager.js'; // 任务管理器
import { type Spec } from '../schemas/spec.js'; // Spec 类型（透传给外部调用者）
import { type DeltaChange, type ChangeItem } from '../schemas/change.js'; // 变更类型（透传给外部调用者）
import { log } from '../utils/logger.js'; // 日志工具

/**
 * SpecManager 聚合类
 *
 * 组合 SpecCrud + SpecWorkflow + SpecVerify + SpecAI 四个子模块，
 * 对外暴露与旧版完全一致的公共 API，不修改任何外部调用方。
 */
export class SpecManager {
  /** CRUD 子模块 */
  private readonly crud: SpecCrud;

  /** 工作流子模块 */
  private readonly workflow: SpecWorkflow;

  /** 验证子模块 */
  private readonly verify_: SpecVerify;

  /** AI 子模块（懒初始化，首次调用时创建） */
  private ai_?: SpecAI;

  /** 项目根目录 */
  private readonly projectRoot: string;

  /**
   * @param projectRoot - 项目根目录绝对路径
   */
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot; // 保存项目根路径

    // SM-8: 构造函数暂不注入 loadConfig，由 SpecCrud 内部动态 import（向后兼容）
    // 若需要消除动态 import，可在此处通过 import() 加载后传入
    this.crud = new SpecCrud(projectRoot); // 初始化 CRUD 子模块

    this.workflow = new SpecWorkflow(projectRoot, this.crud); // 初始化工作流子模块，注入 crud

    // SM-7: TaskManager 在此实例化后注入 SpecVerify，不再在 verify() 内部 new TaskManager()
    const tm = new TaskManager(projectRoot);
    this.verify_ = new SpecVerify(projectRoot, this.crud, tm); // 初始化验证子模块，注入 crud + tm

    // SpecAI 在首次调用时懒初始化，见 getAI()
    log.debug(`SpecManager 已初始化（聚合层）: ${projectRoot}`); // 调试日志
  }

  /**
   * 获取 SpecAI 子模块实例（懒初始化）
   */
  private async getAI(): Promise<SpecAI> {
    if (!this.ai_) { // 首次调用时初始化
      this.ai_ = new SpecAI(this.projectRoot, this.crud); // v25.0: 无需 callAI 参数
      log.debug('SpecAI 子模块已初始化（懒加载）'); // 调试日志
    }
    return this.ai_; // 返回实例
  }

  // =========================================================================
  // 代理方法：SpecCrud
  // =========================================================================

  /** 创建新 Spec - 代理到 SpecCrud.initSpec() */
  async initSpec(name: string, type: Spec['type'], description: string, schemaId?: string): Promise<Spec> {
    return this.crud.initSpec(name, type, description, schemaId);
  }

  /** 按 ID 获取 Spec - 代理到 SpecCrud.getSpec() */
  async getSpec(specId: string): Promise<Spec | null> {
    return this.crud.getSpec(specId);
  }

  /** 列出所有 Spec - 代理到 SpecCrud.listSpecs() */
  async listSpecs(): Promise<Spec[]> {
    return this.crud.listSpecs();
  }

  /** 获取状态统计 - 代理到 SpecCrud.getStatus() */
  async getStatus(): Promise<{ specs: number; pendingChanges: number; appliedChanges: number }> {
    return this.crud.getStatus();
  }

  /** 加载项目上下文 - 代理到 SpecCrud.loadProjectContext() */
  async loadProjectContext(): Promise<string | null> {
    return this.crud.loadProjectContext();
  }

  // =========================================================================
  // 代理方法：SpecWorkflow
  // =========================================================================

  /** 提议变更 - 代理到 SpecWorkflow.propose() */
  async propose(specId: string, changes: ChangeItem[], rationale: string): Promise<DeltaChange & { delta: Array<{ type: string; section: string; diff: string }> }> {
    return this.workflow.propose(specId, changes, rationale);
  }

  /** 应用变更 - 代理到 SpecWorkflow.apply() */
  async apply(changeId: string): Promise<{ spec: Spec; applied: DeltaChange }> {
    return this.workflow.apply(changeId);
  }

  /** 归档变更 - 代理到 SpecWorkflow.archive() */
  async archive(changeId: string): Promise<void> {
    return this.workflow.archive(changeId);
  }

  /** 批量归档 - 代理到 SpecWorkflow.bulkArchive() */
  async bulkArchive(changeIds?: string[]): Promise<{ archived: number; details: string[]; conflicts?: Array<{ changeA: string; changeB: string; section: string }> }> {
    return this.workflow.bulkArchive(changeIds);
  }

  /** 增量创建产物 - 代理到 SpecWorkflow.continueSpec() */
  async continueSpec(specId: string): Promise<{
    specId: string;
    nextArtifact: string;
    artifactName: string;
    order: number;
    created: boolean;
    message: string;
  } | null> {
    return this.workflow.continueSpec(specId);
  }

  /** 快速推进 Spec 状态 - 代理到 SpecWorkflow.fastForward() */
  async fastForward(specId: string): Promise<{ advanced: string[]; skipped: string[]; note: string }> {
    return this.workflow.fastForward(specId);
  }

  /** 列出 Actions - 代理到 SpecWorkflow.listActions() */
  async listActions(specId: string): Promise<Array<{ name: string; description: string; status: 'pending' | 'done' }>> {
    return this.workflow.listActions(specId);
  }

  /** 分离 Design 段 - 代理到 SpecWorkflow.separateDesign() */
  async separateDesign(specId: string): Promise<{ separated: boolean; designPath: string; designLength: number }> {
    return this.workflow.separateDesign(specId);
  }

  // =========================================================================
  // 代理方法：SpecVerify
  // =========================================================================

  /** 校验 Spec - 代理到 SpecVerify.verify() */
  async verify(specId: string): Promise<{
    completeness: number;
    correctness: number;
    consistency: number;
    implementation: number;
    requirementStrength: number;
    fileExistence: number;
    overallScore: number;
    valid: boolean;
    criticalCount: number;
    warningCount: number;
    suggestionCount: number;
    issues: Array<{
      severity: 'critical' | 'warning' | 'suggestion';
      dimension: 'completeness' | 'correctness' | 'consistency' | 'requirementStrength' | 'fileExistence';
      message: string;
    }>;
  }> {
    return this.verify_.verify(specId);
  }

  /** 验证产物链顺序 - 代理到 SpecVerify.validateArtifactChain() */
  async validateArtifactChain(): Promise<{ valid: boolean; issues: string[] }> {
    return this.verify_.validateArtifactChain();
  }

  // =========================================================================
  // 代理方法：SpecAI（懒初始化）
  // =========================================================================

  /** 从代码生成 Spec - 代理到 SpecAI.generateFromCodebase() */
  async generateFromCodebase(name: string, type: Spec['type'], filePaths: string[]): Promise<Spec> {
    const ai = await this.getAI();
    return ai.generateFromCodebase(name, type, filePaths);
  }

  /** 一站式创建完整 Spec - 代理到 SpecAI.specProposeFull() */
  async specProposeFull(name: string, type: Spec['type'], description: string): Promise<{
    specId: string;
    proposalPath: string;
    specPath: string;
    designPath: string;
  }> {
    const ai = await this.getAI();
    return ai.specProposeFull(name, type, description);
  }

  /** 获取 Spec 指令 - 代理到 SpecAI.getInstructions() */
  async getInstructions(specId: string): Promise<string> {
    const ai = await this.getAI();
    return ai.getInstructions(specId);
  }

  /** 创建探索性 Spec - 代理到 SpecAI.initExploreSpec() */
  async initExploreSpec(name: string, type: Spec['type'], description: string): Promise<Spec & { explore: true }> {
    const ai = await this.getAI();
    return ai.initExploreSpec(name, type, description);
  }

  /** 列出探索性 Spec - 代理到 SpecAI.listExploreSpecs() */
  async listExploreSpecs(): Promise<Spec[]> {
    const ai = await this.getAI();
    return ai.listExploreSpecs();
  }

  /** 提升探索性 Spec - 代理到 SpecAI.promoteExploreSpec() */
  async promoteExploreSpec(exploreSpecId: string): Promise<any> {
    const ai = await this.getAI();
    return ai.promoteExploreSpec(exploreSpecId);
  }

  /** 获取依赖图 - 代理到 SpecAI.getDependencyGraph() */
  async getDependencyGraph(): Promise<{ mermaid: string; specCount: number; edgeCount: number }> {
    const ai = await this.getAI();
    return ai.getDependencyGraph();
  }

  /** 获取 DAG 状态 - 代理到 SpecAI.getArtifactDAGStatus() */
  async getArtifactDAGStatus(): Promise<{
    totalSpecs: number;
    specsWithRequires: number;
    readyCount: number;
    blockedCount: number;
    blockedSpecs: Array<{
      specId: string;
      specName: string;
      missingDeps: Array<{
        specId: string;
        status: string;
      }>;
    }>;
    mermaid: string;
  }> {
    const ai = await this.getAI();
    return ai.getArtifactDAGStatus();
  }
}
