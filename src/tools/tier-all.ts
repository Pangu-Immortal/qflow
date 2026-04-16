/**
 * Tier All - 18 个精简 MCP 工具（QFLOW_MODE=all 激活）
 *
 * 合并工具（8 个）：
 *   qflow_review       - 合并原 21 个 review/approval/quality 工具
 *   qflow_autopilot    - 合并原 15 个 autopilot+loop 工具
 *   qflow_sprint       - 合并原 5 个 sprint 工具
 *   qflow_workspace    - 合并原 4 个 workspace 工具
 *   qflow_constitution - 合并原 4 个 constitution 工具
 *   qflow_template     - 合并原 3 个 template 工具
 *   qflow_memory       - 合并原 flush+load
 *   qflow_tdd          - 合并原 5 个 tdd 工具
 *
 * 从 core 降级（4 个）：
 *   qflow_use_tag / qflow_profile_switch / qflow_tool_search / qflow_spec_sync
 *
 * 独立保留（3 个）：
 *   qflow_editor_rules / qflow_models_switch / qflow_diagnostics
 */
import { createRequire } from 'node:module'; // ESM 中加载 CommonJS 模块
const require = createRequire(import.meta.url); // 创建 require 函数
const pkg = require('../../package.json') as { version: string }; // 读取版本号
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SpecManager } from "../core/spec-manager.js";
import { TaskManager } from "../core/task-manager.js";
import { TagManager } from "../core/tag-manager.js";
import { ReviewManager } from "../core/review-manager.js";
import { ApprovalManager } from "../core/approval-manager.js"; // R9: 移除未使用的 AutoRuleCondition
import { AutopilotEngine } from "../core/autopilot-engine.js";
import { TddEngine, TDD_PRESETS } from "../core/tdd-engine.js";
import { TemplateManager } from "../core/template-manager.js";
import { loadModules, getStatus as getContextStatus } from "../core/context-loader.js";
import { log } from "../utils/logger.js"; // 日志工具
import { loadConfig, applyProfile } from "../core/config-manager.js";
import { fileExists, ensureDir } from "../utils/file-io.js";
import { resolveRoot, errResp, jsonResp, assertPathWithinRoot, searchTools, getAllToolMetas, registerToolMeta } from "../shared/tool-utils.js";
import { estimateTokens, formatTokens } from "../utils/token-counter.js";
import { selectNextTask } from "../algorithms/next-task.js";
import { installEditorRules, listSupportedEditors } from "../core/editor-rules.js";
import { MAX_ENGINE_CACHE } from "../shared/constants.js";
import { shouldRegister as _shouldRegister, wrapCallAI } from "../shared/helpers.js"; // 公共辅助函数
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { ConfigDriftDetector } from '../core/config-drift-detector.js'; // 配置漂移检测
import { WatchEngine } from '../core/watch-engine.js'; // 文件监控引擎
import { listAgileWorkflows, getWorkflowByPhase, executeWorkflowStep } from '../core/workflow-presets.js'; // 敏捷工作流预设
import { PluginManager } from '../core/plugin-manager.js'; // 插件管理器
import { WorkflowOrchestrator } from '../core/workflow-orchestrator.js'; // DAG 工作流编排器

/** WatchEngine 模块级单例（延迟启动，由 qflow_diagnostics watch_start 触发） */
const watchEngine = new WatchEngine();

export function registerAllTools(server: McpServer, allowedTools?: Set<string>): void {
  // 工具注册辅助：检查工具名是否在允许列表中（无列表时全部允许）
  const shouldRegister = (name: string): boolean => _shouldRegister(name, allowedTools);

  // ─── 注册 All 层工具元数据到全局注册表 ─────────────────────
  const allMeta: [string, string][] = [
    ['qflow_review', '合并评审工具：create/comment/resolve/list/get/approve/reject/check/readiness/analyze'],
    ['qflow_autopilot', '合并自动驾驶工具：config/start/pause/resume/status/stop/step/commit/loop_start/loop_stop/loop_status'],
    ['qflow_sprint', '合并 Sprint 工具：create/get/add_story/update_story/complete'],
    ['qflow_workspace', '合并工作区工具：isolate/switch/merge/status'],
    ['qflow_constitution', '合并治理原则工具：init/get/set/validate'],
    ['qflow_template', '合并模板工具：create/apply/list'],
    ['qflow_memory', '合并记忆工具：flush/load'],
    ['qflow_tdd', '合并 TDD 工具：preset/step/loop/status/reset'],
    ['qflow_use_tag', '切换到指定的工作区标签'],
    ['qflow_profile_switch', '切换到指定的 Profile 预设'],
    ['qflow_tool_search', '搜索已注册的 MCP 工具'],
    ['qflow_spec_sync', '将 Spec 内容同步到目标文件'],
    ['qflow_editor_rules', '编辑器规则安装与查询'],
    ['qflow_models_switch', '运行时切换指定角色的模型'],
    ['qflow_diagnostics', '全系统健康检查'],
    ['qflow_agile', '敏捷工作流预设：list/get/step'],
    ['qflow_plugin', '插件管理：install/remove/list/get/search/enable/disable'],
    ['qflow_workflow', 'DAG 工作流管理：start/advance/status/list'],
  ];
  for (const [name, desc] of allMeta) registerToolMeta(name, desc, 'all'); // 注册元数据

  // ==================== Autopilot 引擎缓存 ====================
  const engineCache = new Map<string, AutopilotEngine>(); // root → engine 缓存映射
  function getEngine(root: string): AutopilotEngine {
    let engine = engineCache.get(root); // 尝试从缓存获取
    if (!engine) {
      if (engineCache.size >= MAX_ENGINE_CACHE) {
        const oldest = engineCache.keys().next().value!; // LRU 淘汰
        engineCache.delete(oldest);
      }
      engine = new AutopilotEngine(root); // 创建新引擎
      engineCache.set(root, engine);
    }
    return engine;
  }

  // ==================== 1. qflow_review ====================
  if (shouldRegister("qflow_review")) server.tool(
    "qflow_review",
    "合并评审工具。action: create(创建评审)/comment(添加评论)/resolve(完成评审)/list(列出评审)/get(获取详情)/approve(创建审批)/reject(投票拒绝)/check(检查审批)/readiness(就绪度检查)/analyze(分析工具,需指定type)。",
    {
      action: z.enum(["create", "comment", "resolve", "list", "get", "approve", "reject", "check", "readiness", "analyze"]).describe("操作类型"),
      type: z.enum(["adversarial", "edge_case", "ux", "risk", "acceptance", "root_cause", "fault"]).optional().describe("分析类型（仅 analyze 时使用）"),
      // 通用参数
      reviewId: z.string().optional().describe("评审 ID"),
      specId: z.string().optional().describe("Spec ID"),
      taskId: z.string().optional().describe("任务 ID"),
      content: z.string().optional().describe("内容文本"),
      title: z.string().optional().describe("标题"),
      description: z.string().optional().describe("描述"),
      targetType: z.enum(['spec', 'change', 'task', 'workflow']).optional().describe("目标类型"),
      targetId: z.string().optional().describe("目标 ID"),
      author: z.string().optional().describe("作者/评论者"),
      reviewer: z.string().optional().describe("指定评审人"),
      commentType: z.enum(['comment', 'suggestion', 'issue']).optional().describe("评论类型"),
      decision: z.enum(['approved', 'rejected', 'closed']).optional().describe("评审决定"),
      status: z.enum(['open', 'approved', 'rejected', 'closed', 'pending']).optional().describe("状态过滤"),
      // 审批参数
      approvalId: z.string().optional().describe("审批 ID"),
      strategy: z.enum(['unanimous', 'majority', 'any']).optional().describe("审批策略"),
      requiredVoters: z.array(z.string()).optional().describe("必须投票的人"),
      voter: z.string().optional().describe("投票人"),
      voteDecision: z.enum(['approve', 'reject']).optional().describe("投票决定"),
      reason: z.string().optional().describe("投票理由"),
      // 分析参数
      commitHash: z.string().optional().describe("Git commit hash"),
      errorContext: z.string().optional().describe("错误上下文描述"),
      method: z.enum(['pre-mortem', 'first-principles', 'inversion', 'red-team', 'scenario-planning', 'assumption-mapping', 'five-whys', 'constraint-relaxation']).optional().describe("推理方法"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async (params) => {
      const { action, projectRoot } = params;
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");

      const rm = new ReviewManager(root); // 评审管理器
      const am = new ApprovalManager(root); // 审批管理器

      switch (action) {
        case "create": {
          if (!params.targetType || !params.targetId || !params.title) return errResp("create 需要 targetType/targetId/title");
          const review = await rm.createReview(params.targetType as 'spec' | 'change' | 'task', params.targetId, params.title, params.description || '', params.reviewer || '');
          return jsonResp({ review });
        }
        case "comment": {
          if (!params.reviewId || !params.content || !params.author) return errResp("comment 需要 reviewId/content/author");
          const comment = await rm.addComment(params.reviewId, params.author, params.content, params.commentType);
          return jsonResp({ comment });
        }
        case "resolve": {
          if (!params.reviewId || !params.decision) return errResp("resolve 需要 reviewId/decision");
          const review = await rm.resolveReview(params.reviewId, params.decision as 'approved' | 'rejected' | 'closed');
          return jsonResp({ review });
        }
        case "list": {
          const reviews = await rm.listReviews(params.status && params.status !== 'pending' ? { status: params.status as 'open' | 'approved' | 'rejected' | 'closed' } : undefined);
          return jsonResp({ reviews, count: reviews.length });
        }
        case "get": {
          if (!params.reviewId) return errResp("get 需要 reviewId");
          const review = await rm.getReview(params.reviewId);
          if (!review) return errResp(`评审 ${params.reviewId} 不存在`);
          return jsonResp({ review });
        }
        case "approve": {
          if (!params.targetType || !params.targetId || !params.title) return errResp("approve 需要 targetType/targetId/title");
          const approval = await am.createApproval(params.targetId, params.strategy || 'majority', params.requiredVoters || [], params.title, params.targetType);
          return jsonResp({ approval });
        }
        case "reject": {
          if (!params.approvalId || !params.voter) return errResp("reject 需要 approvalId/voter");
          const result = await am.vote(params.approvalId, params.voter, params.voteDecision || 'reject', params.reason || '');
          return jsonResp(result);
        }
        case "check": {
          if (!params.approvalId) return errResp("check 需要 approvalId");
          const result = await am.checkApproval(params.approvalId);
          return jsonResp(result);
        }
        case "readiness": {
          if (!params.specId) return errResp("readiness 需要 specId");
          const result = await rm.readinessGate(params.specId);
          return jsonResp(result);
        }
        case "analyze": {
          if (!params.type) return errResp("analyze 需要 type 参数");
          switch (params.type) {
            case "adversarial": {
              if (!params.specId || !params.content) return errResp("adversarial 需要 specId/content");
              return jsonResp(await rm.adversarialReview(params.specId, params.content));
            }
            case "edge_case": {
              if (!params.specId || !params.content) return errResp("edge_case 需要 specId/content");
              return jsonResp(await rm.edgeCaseHunter(params.specId, params.content));
            }
            case "ux": {
              if (!params.content) return errResp("ux 需要 content");
              return jsonResp(await rm.uxChecklist(params.content));
            }
            case "risk": {
              if (!params.specId) return errResp("risk 需要 specId");
              return jsonResp(await rm.riskBasedTestStrategy(params.specId));
            }
            case "acceptance": {
              if (!params.taskId) return errResp("acceptance 需要 taskId");
              return jsonResp(await rm.acceptanceAudit(params.taskId));
            }
            case "root_cause": {
              return jsonResp(await rm.rootCauseAnalysis(params.commitHash));
            }
            case "fault": {
              if (!params.errorContext) return errResp("fault 需要 errorContext");
              return jsonResp(rm.faultDiagnose(params.errorContext));
            }
            default:
              return errResp(`未知的 analyze type: ${params.type}`);
          }
        }
        default:
          return errResp(`未知的 action: ${action}`);
      }
    }
  );

  // ==================== 2. qflow_autopilot ====================
  if (shouldRegister("qflow_autopilot")) server.tool(
    "qflow_autopilot",
    "合并自动驾驶工具。action: config(配置)/start(启动)/pause(暂停)/resume(恢复)/status(状态)/stop(停止)/step(单步)/commit(提交)/loop_start(启动循环)/loop_stop(停止循环)/loop_status(循环状态)。",
    {
      action: z.enum(["config", "start", "pause", "resume", "status", "stop", "step", "commit", "loop_start", "loop_stop", "loop_status"]).describe("操作类型"),
      // config 参数
      maxTasksPerRun: z.number().int().min(1).max(100).optional().describe("单次运行最大任务数"),
      intervalMs: z.number().int().min(1).max(60000).optional().describe("任务执行间隔（毫秒）"),
      maxConcurrentErrors: z.number().int().min(1).max(10).optional().describe("最大并发错误数"),
      loopMode: z.boolean().optional().describe("循环模式"),
      preset: z.enum(['default', 'test-coverage', 'linting', 'duplication', 'entropy', 'custom']).optional().describe("循环预设"),
      verbose: z.boolean().optional().describe("详细日志模式"),
      filterTags: z.array(z.string()).optional().describe("按标签过滤任务"),
      filterPriority: z.number().int().min(1).max(10).optional().describe("最低优先级过滤"),
      // commit 参数
      message: z.string().optional().describe("Git 提交信息"),
      files: z.array(z.string()).optional().describe("文件路径列表"),
      // loop_start 参数
      taskId: z.string().optional().describe("任务 ID"),
      presetName: z.string().optional().describe("预设名称"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async (params) => {
      const { action, projectRoot } = params;
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");

      switch (action) {
        case "config": {
          const engine = getEngine(root);
          const config = {
            ...(params.maxTasksPerRun !== undefined && { maxTasksPerRun: params.maxTasksPerRun }),
            ...(params.intervalMs !== undefined && { intervalMs: params.intervalMs }),
            ...(params.maxConcurrentErrors !== undefined && { maxConcurrentErrors: params.maxConcurrentErrors }),
            ...(params.loopMode !== undefined && { loopMode: params.loopMode }),
            ...(params.preset !== undefined && { preset: params.preset }),
            ...(params.verbose !== undefined && { verbose: params.verbose }),
            ...(params.filterTags || params.filterPriority ? {
              taskFilter: {
                ...(params.filterTags && { tags: params.filterTags }),
                ...(params.filterPriority !== undefined && { priority: params.filterPriority }),
              }
            } : {}),
          };
          await engine.configure(config);
          const state = await engine.getStatus();
          return jsonResp({ configured: true, state });
        }
        case "start": {
          const engine = getEngine(root);
          const result = await engine.start();
          return jsonResp(result);
        }
        case "pause": {
          const engine = getEngine(root);
          await engine.pause();
          const state = await engine.getStatus();
          return jsonResp({ paused: true, state });
        }
        case "resume": {
          const engine = getEngine(root);
          const result = await engine.resume();
          return jsonResp(result);
        }
        case "status": {
          const engine = getEngine(root);
          const state = await engine.getStatus();
          return jsonResp(state);
        }
        case "stop": {
          const engine = getEngine(root);
          await engine.stop();
          return jsonResp({ stopped: true });
        }
        case "step": {
          const engine = getEngine(root);
          const result = await engine.step();
          return jsonResp(result);
        }
        case "commit": {
          if (!params.message) return errResp("commit 需要 message 参数");
          const engine = getEngine(root);
          try {
            const result = await engine.commitChanges(params.message, params.files);
            return jsonResp({ committed: true, message: params.message, files: params.files || 'all', ...result });
          } catch (e) {
            return errResp(`git commit 失败: ${(e as Error).message}`);
          }
        }
        case "loop_start": {
          if (!params.taskId) return errResp("loop_start 需要 taskId");
          const { LoopEngine } = await import('../core/loop-engine.js');
          const engine = new LoopEngine(root, wrapCallAI);
          const state = await engine.start({ taskId: params.taskId, presetName: params.presetName });
          return jsonResp(state as unknown as Record<string, unknown>);
        }
        case "loop_stop": {
          const { LoopEngine } = await import('../core/loop-engine.js');
          const engine = new LoopEngine(root, wrapCallAI);
          const loopStatus = await engine.getStatus();
          if (!loopStatus) return { content: [{ type: 'text' as const, text: '无运行中的循环' }] };
          const state = await engine.stop();
          return jsonResp(state as unknown as Record<string, unknown>);
        }
        case "loop_status": {
          const { LoopEngine } = await import('../core/loop-engine.js');
          const engine = new LoopEngine(root, wrapCallAI);
          const loopStatus = await engine.getStatus();
          return loopStatus
            ? jsonResp(loopStatus as unknown as Record<string, unknown>)
            : { content: [{ type: 'text' as const, text: '无循环状态' }] };
        }
        default:
          return errResp(`未知的 action: ${action}`);
      }
    }
  );

  // ==================== 3. qflow_sprint ====================
  if (shouldRegister("qflow_sprint")) server.tool(
    "qflow_sprint",
    "合并 Sprint 工具。action: create(创建)/get(获取详情)/add_story(添加故事)/update_story(更新故事状态)/complete(结束Sprint)。",
    {
      action: z.enum(["create", "get", "add_story", "update_story", "complete"]).describe("操作类型"),
      sprintId: z.string().optional().describe("Sprint ID"),
      name: z.string().optional().describe("Sprint 名称"),
      goal: z.string().optional().describe("Sprint 目标描述"),
      title: z.string().optional().describe("故事标题"),
      description: z.string().optional().describe("故事描述"),
      points: z.number().optional().describe("故事点数"),
      storyId: z.string().optional().describe("故事 ID"),
      status: z.enum(['backlog', 'todo', 'in_progress', 'done', 'blocked']).optional().describe("故事状态"),
      retrospective: z.string().optional().describe("Sprint 回顾总结"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async (params) => {
      const { action, projectRoot } = params;
      const root = await resolveRoot(projectRoot);
      if (!root) return errResp("未找到 .qflow 项目");

      const { SprintManager } = await import('../core/sprint-manager.js'); // 动态导入
      const sm = new SprintManager(root);

      switch (action) {
        case "create": {
          if (!params.name) return errResp("create 需要 name");
          const sprint = await sm.create(params.name, params.goal ?? '');
          return jsonResp(sprint as unknown as Record<string, unknown>);
        }
        case "get": {
          if (!params.sprintId) return errResp("get 需要 sprintId");
          const sprint = await sm.get(params.sprintId);
          if (!sprint) return errResp(`Sprint "${params.sprintId}" 不存在`);
          return jsonResp(sprint as unknown as Record<string, unknown>);
        }
        case "add_story": {
          if (!params.sprintId || !params.title) return errResp("add_story 需要 sprintId/title");
          const story = await sm.addStory(params.sprintId, params.title, params.description ?? '', params.points ?? 0);
          return jsonResp(story as unknown as Record<string, unknown>);
        }
        case "update_story": {
          if (!params.sprintId || !params.storyId || !params.status) return errResp("update_story 需要 sprintId/storyId/status");
          const story = await sm.updateStoryStatus(params.sprintId, params.storyId, params.status);
          return jsonResp(story as unknown as Record<string, unknown>);
        }
        case "complete": {
          if (!params.sprintId) return errResp("complete 需要 sprintId");
          const sprint = await sm.completeSprint(params.sprintId, params.retrospective ?? '');
          return jsonResp(sprint as unknown as Record<string, unknown>);
        }
        default:
          return errResp(`未知的 action: ${action}`);
      }
    }
  );

  // ==================== 4. qflow_workspace ====================
  if (shouldRegister("qflow_workspace")) server.tool(
    "qflow_workspace",
    "合并工作区工具。action: isolate(隔离工作区)/switch(切换工作区)/merge(合并工作区)/status(工作区状态)。",
    {
      action: z.enum(["isolate", "switch", "merge", "status"]).describe("操作类型"),
      tagName: z.string().optional().describe("工作区标签名"),
      source: z.string().optional().describe("源工作区名称（merge 时使用）"),
      target: z.string().optional().describe("目标工作区名称（merge 时使用）"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async (params) => {
      const { action, projectRoot } = params;
      const root = await resolveRoot(projectRoot);
      if (!root) return errResp("未找到 .qflow 项目");

      const tagMgr = new TagManager(root);

      switch (action) {
        case "isolate": {
          if (!params.tagName) return errResp("isolate 需要 tagName");
          try {
            const result = await tagMgr.isolateTagWorkspace(params.tagName);
            return jsonResp(result);
          } catch (e) { return errResp((e as Error).message); }
        }
        case "switch": {
          if (params.tagName === undefined) return errResp("switch 需要 tagName");
          try {
            const result = await tagMgr.switchWorkspace(params.tagName);
            return jsonResp(result);
          } catch (e) { return errResp((e as Error).message); }
        }
        case "merge": {
          if (!params.source || !params.target) return errResp("merge 需要 source/target");
          try {
            const result = await tagMgr.mergeWorkspace(params.source, params.target);
            return jsonResp(result);
          } catch (e) { return errResp((e as Error).message); }
        }
        case "status": {
          if (!params.tagName) return errResp("status 需要 tagName");
          try {
            const result = await tagMgr.getWorkspaceStatus(params.tagName);
            return jsonResp(result);
          } catch (e) { return errResp((e as Error).message); }
        }
        default:
          return errResp(`未知的 action: ${action}`);
      }
    }
  );

  // ==================== 5. qflow_constitution ====================
  if (shouldRegister("qflow_constitution")) server.tool(
    "qflow_constitution",
    "合并治理原则工具。action: init(初始化)/get(获取列表)/set(添加原则)/validate(验证内容)。",
    {
      action: z.enum(["init", "get", "set", "validate"]).describe("操作类型"),
      content: z.string().optional().describe("原则内容（set 时必填）或要验证的内容（validate 时必填）"),
      category: z.string().optional().describe("分类: architecture/quality/security/process/naming/testing/documentation/custom"),
      severity: z.string().optional().describe("严重性: must/should/may"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async (params) => {
      const { action, projectRoot } = params;
      const root = await resolveRoot(projectRoot);
      if (!root) return errResp("未找到 .qflow 项目");

      const { ConstitutionManager } = await import('../core/constitution.js'); // 动态导入
      const cm = new ConstitutionManager(root);

      switch (action) {
        case "init": {
          const constitution = await cm.init();
          return jsonResp(constitution as unknown as Record<string, unknown>); // R7: 统一响应格式
        }
        case "get": {
          const constitution = await cm.get();
          return jsonResp(constitution as unknown as Record<string, unknown>); // R7: 统一响应格式
        }
        case "set": {
          if (!params.content || !params.category || !params.severity) return errResp("set 需要 content/category/severity");
          const constitution = await cm.set({
            content: params.content,
            category: params.category as 'architecture' | 'quality' | 'security' | 'process' | 'naming' | 'testing' | 'documentation' | 'custom', // R8: 精确类型
            severity: params.severity as 'must' | 'should' | 'may', // R8: 精确类型
            immutable: true,
          });
          return jsonResp(constitution as unknown as Record<string, unknown>); // R7: 统一响应格式
        }
        case "validate": {
          if (!params.content) return errResp("validate 需要 content");
          const result = await cm.validateAsync(params.content);
          return jsonResp({ valid: result.valid, violations: result.violations });
        }
        default:
          return errResp(`未知的 action: ${action}`);
      }
    }
  );

  // ==================== 6. qflow_template ====================
  if (shouldRegister("qflow_template")) server.tool(
    "qflow_template",
    "合并模板工具。action: create(创建模板)/apply(应用模板)/list(列出模板)。",
    {
      action: z.enum(["create", "apply", "list"]).describe("操作类型"),
      name: z.string().optional().describe("模板名称"),
      type: z.enum(['task', 'spec', 'workflow']).optional().describe("模板类型"),
      content: z.string().optional().describe("模板内容（支持 {{var}} 占位符）"),
      description: z.string().optional().describe("模板描述"),
      variables: z.array(z.object({
        name: z.string(),
        description: z.string().optional(),
        defaultValue: z.string().optional(),
        required: z.boolean().optional(),
      })).optional().describe("变量定义"),
      tags: z.array(z.string()).optional().describe("模板标签"),
      templateId: z.string().optional().describe("模板 ID（apply 时必填）"),
      variableValues: z.record(z.string(), z.string()).optional().describe("变量值映射（apply 时使用）"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async (params) => {
      const { action, projectRoot } = params;
      const root = await resolveRoot(projectRoot);
      if (!root) return errResp("未找到 .qflow 项目");

      const tplMgr = new TemplateManager(root);

      switch (action) {
        case "create": {
          if (!params.name || !params.type || !params.content) return errResp("create 需要 name/type/content");
          const normalizedVars = (params.variables || []).map(v => ({
            name: v.name,
            description: v.description || '',
            required: v.required ?? true,
            ...(v.defaultValue !== undefined && { defaultValue: v.defaultValue }),
          }));
          const template = await tplMgr.createTemplate(params.name, params.type, params.description || '', params.content, normalizedVars);
          return jsonResp({ template });
        }
        case "apply": {
          if (!params.templateId) return errResp("apply 需要 templateId");
          const result = await tplMgr.applyTemplate(params.templateId, params.variableValues || {});
          return jsonResp({ content: result });
        }
        case "list": {
          const templates = await tplMgr.listTemplates(params.type ? { type: params.type } : undefined);
          return jsonResp({ templates, count: templates.length });
        }
        default:
          return errResp(`未知的 action: ${action}`);
      }
    }
  );

  // ==================== 7. qflow_memory ====================
  if (shouldRegister("qflow_memory")) server.tool(
    "qflow_memory",
    "合并记忆工具。action: flush(写入MEMORY.md)/load(读取MEMORY.md)。",
    {
      action: z.enum(["flush", "load"]).describe("操作类型"),
      items: z.array(z.object({
        category: z.string().describe("分类：decisions/todos/blockers/paths"),
        content: z.string().describe("内容"),
      })).optional().describe("要持久化的信息列表（flush 时使用）"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async (params) => {
      const { action, projectRoot } = params;
      const root = await resolveRoot(projectRoot);
      const memoryPath = root
        ? path.join(root, 'MEMORY.md')
        : path.join(os.homedir(), '.claude', 'projects', 'memory', 'MEMORY.md');

      switch (action) {
        case "flush": {
          if (!params.items || params.items.length === 0) return errResp("flush 需要 items 参数");
          const timestamp = new Date().toISOString().slice(0, 19);
          let append = `\n\n## qflow Memory Flush [${timestamp}]\n\n`;
          for (const item of params.items) {
            append += `### ${item.category}\n${item.content}\n\n`;
          }
          await ensureDir(path.dirname(memoryPath));
          const { withFileLock } = await import('../utils/file-io.js');
          await withFileLock(memoryPath, async () => {
            let existing = '';
            try { existing = await fs.readFile(memoryPath, 'utf-8'); } catch (e) { log.debug(`MEMORY.md 不存在，将新建: ${(e as Error).message}`); }
            await fs.writeFile(memoryPath, existing + append, 'utf-8');
          });
          return jsonResp({ flushed: params.items.length, path: memoryPath });
        }
        case "load": {
          try {
            const content = await fs.readFile(memoryPath, 'utf-8');
            return jsonResp({ path: memoryPath, tokens: formatTokens(estimateTokens(content)), content });
          } catch (e) {
            log.debug(`MEMORY.md 读取失败: ${(e as Error).message}`);
            return jsonResp({ path: memoryPath, content: null, note: "MEMORY.md 不存在" });
          }
        }
        default:
          return errResp(`未知的 action: ${action}`);
      }
    }
  );

  // ==================== 8. qflow_tdd ====================
  if (shouldRegister("qflow_tdd")) server.tool(
    "qflow_tdd",
    "合并 TDD 工具。action: preset(查询预设)/step(单步执行)/loop(完整循环)/status(状态)/reset(重置)。",
    {
      action: z.enum(["preset", "step", "loop", "status", "reset"]).describe("操作类型"),
      // preset 参数
      presetAction: z.enum(['list', 'get']).optional().describe("预设操作: list/get"),
      presetName: z.string().optional().describe("预设名称"),
      // step/loop 参数
      testCommand: z.string().optional().describe("测试命令"),
      taskId: z.string().optional().describe("关联任务 ID"),
      autoCommit: z.boolean().optional().describe("是否自动 git commit"),
      maxIterations: z.number().int().min(1).max(20).optional().describe("最大迭代次数（loop 用）"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async (params) => {
      const { action } = params;

      // preset 不需要 projectRoot
      if (action === 'preset') {
        const presetAct = params.presetAction || 'list';
        if (presetAct === 'list') {
          const presets = TddEngine.listPresets();
          return jsonResp({ presets, count: presets.length });
        }
        if (!params.presetName) return errResp("preset get 需要 presetName");
        const preset = TDD_PRESETS[params.presetName];
        if (!preset) return errResp(`预设 '${params.presetName}' 不存在，可用: ${Object.keys(TDD_PRESETS).join(', ')}`);
        return jsonResp({ preset });
      }

      const root = await resolveRoot(params.projectRoot);
      if (!root) return errResp("未找到 .qflow 项目");

      switch (action) {
        case "step": {
          if (!params.testCommand || !params.taskId) return errResp("step 需要 testCommand/taskId");
          try {
            const engine = new TddEngine(root, wrapCallAI);
            await engine.loadState();
            const result = await engine.tddStep({ testCommand: params.testCommand, taskId: params.taskId, autoCommit: params.autoCommit });
            return jsonResp({ ...result, state: engine.getState() });
          } catch (err) { return errResp((err as Error).message); }
        }
        case "loop": {
          if (!params.testCommand || !params.taskId) return errResp("loop 需要 testCommand/taskId");
          try {
            const engine = new TddEngine(root, wrapCallAI);
            const result = await engine.tddLoop({ testCommand: params.testCommand, taskId: params.taskId, maxIterations: params.maxIterations, autoCommit: params.autoCommit });
            return jsonResp(result);
          } catch (err) { return errResp((err as Error).message); }
        }
        case "status": {
          try {
            const engine = new TddEngine(root, wrapCallAI);
            const state = await engine.loadState();
            return jsonResp(state);
          } catch (err) { return errResp((err as Error).message); }
        }
        case "reset": {
          try {
            const engine = new TddEngine(root, wrapCallAI);
            await engine.reset();
            return jsonResp({ reset: true, message: "TDD 状态已重置" });
          } catch (err) { return errResp((err as Error).message); }
        }
        default:
          return errResp(`未知的 action: ${action}`);
      }
    }
  );

  // ==================== 9. qflow_use_tag（从 core 降级）====================
  if (shouldRegister("qflow_use_tag")) server.tool(
    "qflow_use_tag",
    "切换到指定的工作区标签。每个标签对应独立的任务文件，实现任务隔离。'default' 对应原始 tasks.json。",
    {
      tagName: z.string().describe("工作区标签名。'default' 对应原始 tasks.json，其他名称创建隔离的任务空间"),
      projectRoot: z.string().optional().describe("项目根目录路径"),
    },
    async ({ tagName, projectRoot }) => {
      const root = await resolveRoot(projectRoot);
      if (!root) return errResp("未找到 .qflow 项目");
      const tm = new TaskManager(root);
      await tm.useTag(tagName);
      const tasks = await tm.getAllTasks();
      return jsonResp({
        activeTag: tm.getActiveTag(),
        taskCount: tasks.length,
        message: `已切换到工作区标签 "${tm.getActiveTag()}"`,
      });
    }
  );

  // ==================== 10. qflow_profile_switch（从 core 降级）====================
  if (shouldRegister("qflow_profile_switch")) server.tool(
    "qflow_profile_switch",
    "切换到指定的 Profile 预设（自动应用 mode 和 contextModules）。",
    {
      profileName: z.string().describe("Profile 名称"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async ({ profileName, projectRoot }) => {
      const root = await resolveRoot(projectRoot);
      if (!root) return errResp("未找到 .qflow 项目");
      try {
        const config = await applyProfile(root, profileName);
        return jsonResp({
          profileName,
          mode: config.mode,
          contextModules: config.contextModules,
          message: `已切换到 Profile "${profileName}"`,
        });
      } catch (e) { return errResp((e as Error).message); }
    }
  );

  // ==================== 11. qflow_tool_search（从 core 降级）====================
  if (shouldRegister("qflow_tool_search")) server.tool(
    "qflow_tool_search",
    "搜索已注册的 MCP 工具和斜杠命令。支持按名称/描述模糊匹配，按层级过滤。",
    {
      query: z.string().describe("搜索关键词"),
      tier: z.enum(['core', 'standard', 'extra', 'all', 'autopilot', 'review']).optional().describe("按层级过滤"),
    },
    { readOnlyHint: true },
    async ({ query, tier }) => {
      const results = searchTools(query, tier);
      const allTools = getAllToolMetas();

      const { SlashCommandRegistry } = await import('../core/slash-commands.js');
      const registry = new SlashCommandRegistry();
      const lowerQuery = query.toLowerCase();
      const slashMatches = registry.list().filter(cmd =>
        cmd.name.includes(lowerQuery) || cmd.description.toLowerCase().includes(lowerQuery) || cmd.mcpTool.toLowerCase().includes(lowerQuery)
      ).map(cmd => ({ name: `/${cmd.name}`, description: cmd.description, mcpTool: cmd.mcpTool, aliases: cmd.aliases }));

      return jsonResp({
        query, tier: tier ?? 'all', matches: results, matchCount: results.length,
        slashCommands: slashMatches, slashMatchCount: slashMatches.length,
        totalRegistered: allTools.length,
      });
    }
  );

  // ==================== 12. qflow_spec_sync（保留）====================
  if (shouldRegister("qflow_spec_sync")) server.tool(
    "qflow_spec_sync",
    "将 Spec 内容同步到目标文件。deterministic 模式直接写入，agent 模式通过 AI 分析差异。",
    {
      specId: z.string().describe("Spec ID"),
      targetFile: z.string().describe("目标文件路径"),
      mode: z.enum(['deterministic', 'agent']).optional().describe("同步模式"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async ({ specId, targetFile, mode, projectRoot }) => {
      const root = await resolveRoot(projectRoot);
      if (!root) return errResp("未找到 .qflow 项目");

      const sm = new SpecManager(root);
      const spec = await sm.getSpec(specId);
      if (!spec) return errResp(`Spec ${specId} 不存在`);

      const syncMode = mode || 'deterministic';
      const target = assertPathWithinRoot(root, targetFile);

      if (syncMode === 'deterministic') {
        await ensureDir(path.dirname(target));
        await fs.writeFile(target, spec.content, 'utf-8');
        return jsonResp({ synced: true, mode: syncMode, target, specId });
      }

      let existing = '';
      try { existing = await fs.readFile(target, 'utf-8'); } catch (e) { log.debug(`sync 目标文件不存在，将新建: ${(e as Error).message}`); }
      return jsonResp({
        synced: false, mode: 'agent', specContent: spec.content,
        existingContent: existing, target,
        note: '请分析 spec 和现有文件的差异，手动合并',
      });
    }
  );

  // ==================== 13. qflow_editor_rules（独立保留）====================
  if (shouldRegister("qflow_editor_rules")) server.tool(
    "qflow_editor_rules",
    "安装或查询编辑器工作规则。支持 13 种编辑器。install 安装规则文件（未指定 editor 时自动检测），list 列出支持的编辑器。",
    {
      action: z.enum(['install', 'list']).describe("操作类型: install 安装规则 / list 列出支持的编辑器"),
      editor: z.enum(['cursor', 'vscode', 'windsurf', 'roo', 'cline', 'kiro', 'zed', 'kilo', 'trae', 'gemini', 'opencode', 'codex', 'jetbrains']).optional().describe("编辑器类型"),
      force: z.boolean().optional().describe("是否强制覆盖已有规则文件"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async ({ action, editor, force, projectRoot }) => {
      if (action === 'list') {
        const editors = listSupportedEditors();
        return jsonResp({ editors, count: editors.length });
      }
      const root = await resolveRoot(projectRoot);
      if (!root) return errResp("未找到 .qflow 项目");
      try {
        const result = await installEditorRules(root, editor, force || false);
        return jsonResp(result);
      } catch (e) { return errResp((e as Error).message); }
    }
  );

  // ==================== 14. qflow_models_switch（从 standard 搬入）====================
  if (shouldRegister("qflow_models_switch")) server.tool(
    "qflow_models_switch",
    "运行时切换指定角色的模型。支持 main/research/fallback 等角色。",
    {
      role: z.string().describe("角色名: main/research/fallback"),
      modelId: z.string().describe("模型 ID"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async ({ role, modelId, projectRoot }) => {
      const root = await resolveRoot(projectRoot);
      if (!root) return errResp("未找到 .qflow 项目");
      const { switchModelRuntime } = await import('../core/provider-adapter.js');
      const result = await switchModelRuntime(root, role, modelId);
      return jsonResp(result);
    }
  );

  // ==================== 15. qflow_diagnostics（独立保留 + 漂移检测 + 文件监控）====================
  if (shouldRegister("qflow_diagnostics")) server.tool(
    "qflow_diagnostics",
    "全系统健康检查：status=完整诊断，drift=配置漂移检测，watch_start=启动文件监控，watch_stop=停止监控，watch_events=获取监控事件。",
    {
      action: z.enum(['status', 'drift', 'watch_start', 'watch_stop', 'watch_events']).optional().default('status').describe("诊断操作"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    { readOnlyHint: true },
    async ({ action, projectRoot }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录

      switch (action) {
        // ── status: 原有完整诊断逻辑 + 末尾追加漂移检测 ──
        case 'status': {
          const diagnostics: Record<string, unknown> = {
            version: pkg.version,
            mode: process.env.QFLOW_MODE || 'standard',
            timestamp: new Date().toISOString(),
          };

          // 上下文模块状态
          diagnostics.context = await getContextStatus();

          // MCP 状态
          diagnostics.mcp = { status: 'running', server: 'qflow' };

          // 项目状态
          if (root) {
            const tm = new TaskManager(root);
            const tasks = await tm.getAllTasks();
            diagnostics.tasks = {
              total: tasks.length,
              pending: tasks.filter(t => t.status === 'pending').length,
              active: tasks.filter(t => t.status === 'active').length,
              done: tasks.filter(t => t.status === 'done').length,
              blocked: tasks.filter(t => t.status === 'blocked').length,
            };

            const specMgr = new SpecManager(root);
            diagnostics.specs = await specMgr.getStatus();

            try {
              const config = await loadConfig(root);
              diagnostics.config = { projectName: config.projectName, mode: config.mode };
            } catch (e) { log.debug(`配置加载失败，诊断跳过: ${(e as Error).message}`); }
          } else {
            diagnostics.project = null;
            diagnostics.note = "未在 qflow 项目中，部分诊断跳过";
          }

          // AI Provider 状态
          const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
          diagnostics.aiProvider = { settingsExists: await fileExists(settingsPath) };

          // Slash 命令状态
          const commandsDir = path.join(os.homedir(), '.claude', 'commands');
          try {
            const files = await fs.readdir(commandsDir);
            const qfCommands = files.filter(f => f.startsWith('qf-') && f.endsWith('.md'));
            diagnostics.slashCommands = { installed: qfCommands.length, commands: qfCommands };
          } catch (e) {
            log.debug(`slash 命令目录读取失败: ${(e as Error).message}`);
            diagnostics.slashCommands = { installed: 0, commands: [] };
          }

          // MCPB 安装信息
          try {
            const mcpbConfigPath = path.join(os.homedir(), '.claude.json');
            const mcpbExists = await fileExists(mcpbConfigPath);
            diagnostics.mcpb = {
              configExists: mcpbExists, configPath: mcpbConfigPath,
              note: mcpbExists ? 'MCPB 配置已检测到' : '未检测到 MCPB 配置（~/.claude.json）',
            };
          } catch (e) {
            log.debug(`MCPB 检测失败: ${(e as Error).message}`);
            diagnostics.mcpb = { configExists: false, note: '检测失败' };
          }

          // 追加配置漂移检测结果
          if (root) {
            try {
              const detector = new ConfigDriftDetector(root); // 创建漂移检测器
              const driftWarnings = await detector.detect(); // 执行检测
              diagnostics.drift = { warnings: driftWarnings, count: driftWarnings.length };
            } catch (e) { log.debug(`漂移检测失败: ${(e as Error).message}`); }
          }

          return jsonResp(diagnostics);
        }

        // ── drift: 单独返回配置漂移检测结果 ──
        case 'drift': {
          if (!root) return errResp("drift 需要有效的 qflow 项目");
          const detector = new ConfigDriftDetector(root); // 创建漂移检测器
          const warnings = await detector.detect(); // 执行检测
          return jsonResp({ warnings, count: warnings.length });
        }

        // ── watch_start: 启动文件监控 ──
        case 'watch_start': {
          if (!root) return errResp("watch_start 需要有效的 qflow 项目");
          watchEngine.start(root); // 启动监控
          log.info(`WatchEngine 已启动，监控目录: ${root}`);
          return jsonResp({ status: 'started', root });
        }

        // ── watch_stop: 停止文件监控 ──
        case 'watch_stop': {
          watchEngine.stop(); // 停止监控
          log.info('WatchEngine 已停止');
          return jsonResp({ status: 'stopped' });
        }

        // ── watch_events: 获取监控事件列表 ──
        case 'watch_events': {
          const events = watchEngine.getEvents(); // 获取事件列表
          return jsonResp({ events, count: events.length });
        }

        default:
          return errResp(`未知的诊断操作: ${action}`);
      }
    }
  );

  // ==================== 16. qflow_agile（敏捷工作流预设）====================
  if (shouldRegister("qflow_agile")) server.tool(
    "qflow_agile",
    "敏捷工作流预设：list=列出所有阶段，get=获取指定阶段，step=执行步骤",
    {
      action: z.enum(['list', 'get', 'step']).describe("操作类型"),
      phase: z.string().optional().describe("阶段名称（get/step 时必填）"),
      stepIndex: z.number().optional().describe("步骤序号（step 时必填，从 0 开始）"),
    },
    { readOnlyHint: true },
    async ({ action, phase, stepIndex }) => {
      switch (action) {
        // ── list: 列出所有敏捷工作流 ──
        case 'list': {
          const workflows = listAgileWorkflows(); // 获取全部工作流摘要
          return jsonResp({ workflows, count: workflows.length });
        }
        // ── get: 获取指定阶段的工作流详情 ──
        case 'get': {
          if (!phase) return errResp("get 需要 phase 参数");
          const workflow = getWorkflowByPhase(phase); // 按阶段名查找
          if (!workflow) return errResp(`未找到阶段: ${phase}`);
          return jsonResp({ workflow });
        }
        // ── step: 执行指定工作流的某一步骤 ──
        case 'step': {
          if (!phase) return errResp("step 需要 phase 参数");
          if (stepIndex === undefined || stepIndex === null) return errResp("step 需要 stepIndex 参数");
          const workflow = getWorkflowByPhase(phase); // 先查找工作流
          if (!workflow) return errResp(`未找到阶段: ${phase}`);
          const result = executeWorkflowStep(workflow.id, stepIndex); // 执行步骤
          return jsonResp({ result });
        }
        default:
          return errResp(`未知的 agile 操作: ${action}`);
      }
    }
  );

  // ==================== 17. qflow_plugin（插件管理）====================
  if (shouldRegister("qflow_plugin")) server.tool(
    "qflow_plugin",
    "插件管理：install=安装插件，remove=卸载，list=列表，get=详情，search=搜索，enable=启用，disable=禁用",
    {
      action: z.enum(['install', 'remove', 'list', 'get', 'search', 'enable', 'disable']).describe("操作类型"),
      projectRoot: z.string().optional().describe("项目根目录"),
      name: z.string().optional().describe("插件名称"),
      version: z.string().optional().describe("插件版本（install 时可选）"),
      description: z.string().optional().describe("插件描述（install 时可选）"),
      query: z.string().optional().describe("搜索关键词（search 时必填）"),
    },
    async ({ action, projectRoot, name, version, description, query }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");

      const pm = new PluginManager(root); // 创建插件管理器

      switch (action) {
        // ── install: 安装插件 ──
        case 'install': {
          if (!name) return errResp("install 需要 name 参数");
          const manifest = await pm.install({
            name,
            version: version || '1.0.0',
            description: description || '',
            author: '',       // 作者（可后续更新）
            tools: [],        // 工具列表（安装后注册）
            hooks: [],        // 钩子列表
            enabled: true,    // 默认启用
          }); // 安装插件
          log.info(`插件已安装: ${name}@${manifest.version}`);
          return jsonResp({ plugin: manifest });
        }
        // ── remove: 卸载插件 ──
        case 'remove': {
          if (!name) return errResp("remove 需要 name 参数");
          await pm.remove(name); // 卸载插件
          log.info(`插件已卸载: ${name}`);
          return jsonResp({ removed: name });
        }
        // ── list: 列出所有已安装插件 ──
        case 'list': {
          const plugins = await pm.list(); // 获取插件列表
          return jsonResp({ plugins, count: plugins.length });
        }
        // ── get: 获取插件详情 ──
        case 'get': {
          if (!name) return errResp("get 需要 name 参数");
          const plugin = await pm.get(name); // 按名称查找
          if (!plugin) return errResp(`插件 ${name} 不存在`);
          return jsonResp({ plugin });
        }
        // ── search: 搜索插件 ──
        case 'search': {
          if (!query) return errResp("search 需要 query 参数");
          const results = await pm.search(query); // 按关键词搜索
          return jsonResp({ results, count: results.length });
        }
        // ── enable: 启用插件 ──
        case 'enable': {
          if (!name) return errResp("enable 需要 name 参数");
          const plugin = await pm.enable(name); // 启用插件
          log.info(`插件已启用: ${name}`);
          return jsonResp({ plugin });
        }
        // ── disable: 禁用插件 ──
        case 'disable': {
          if (!name) return errResp("disable 需要 name 参数");
          const plugin = await pm.disable(name); // 禁用插件
          log.info(`插件已禁用: ${name}`);
          return jsonResp({ plugin });
        }
        default:
          return errResp(`未知的 plugin 操作: ${action}`);
      }
    }
  );

  // ==================== 18. qflow_workflow（DAG 工作流管理）====================
  if (shouldRegister("qflow_workflow")) server.tool(
    "qflow_workflow",
    "DAG 工作流管理：start=启动工作流，advance=推进工作流，status=查看状态，list=列出所有工作流",
    {
      action: z.enum(['start', 'advance', 'status', 'list']).describe("操作类型"),
      projectRoot: z.string().optional().describe("项目根目录"),
      workflowId: z.string().optional().describe("工作流 ID"),
    },
    async ({ action, projectRoot, workflowId }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");

      const orchestrator = new WorkflowOrchestrator(root); // 创建工作流编排器

      switch (action) {
        // ── start: 启动工作流 ──
        case 'start': {
          if (!workflowId) return errResp("start 需要 workflowId 参数");
          const workflow = await orchestrator.startWorkflow(workflowId); // 启动工作流
          log.info(`工作流已启动: ${workflowId}`);
          return jsonResp({ workflow });
        }
        // ── advance: 推进工作流到下一阶段 ──
        case 'advance': {
          if (!workflowId) return errResp("advance 需要 workflowId 参数");
          const result = await orchestrator.advanceWorkflow(workflowId); // 推进工作流
          log.info(`工作流已推进: ${workflowId}, 完成: ${result.completed}`);
          return jsonResp(result);
        }
        // ── status: 查看工作流状态 ──
        case 'status': {
          if (!workflowId) return errResp("status 需要 workflowId 参数");
          const status = await orchestrator.getWorkflowStatus(workflowId); // 获取状态
          return jsonResp(status);
        }
        // ── list: 列出所有工作流 ──
        case 'list': {
          const workflows = await orchestrator.listWorkflows(); // 获取全部工作流
          return jsonResp({ workflows, count: workflows.length });
        }
        default:
          return errResp(`未知的 workflow 操作: ${action}`);
      }
    }
  );
}
