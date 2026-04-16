/**
 * Tier Standard - 20 个标准 MCP 工具（QFLOW_MODE=standard 激活）
 *
 * 从 core 降级 (3): task_get / context_status / spec_status
 * 原 standard 保留 (9): task_update / task_delete / task_tree / spec_init / spec_apply / spec_verify / context_compress / complexity_score / plan_generate
 * 合并工具 (8): task_batch / task_deps / tag_manage / scope_navigate / spec_propose / spec_generate / research / report
 *
 * 函数列表:
 *   - registerStandardTools(server, allowedTools?): 注册所有标准层工具到 MCP 服务器
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TaskManager } from "../core/task-manager.js";
import type { Task } from "../schemas/task.js"; // 任务类型
import { SpecManager } from "../core/spec-manager.js";
import { TagManager } from "../core/tag-manager.js";
import { validateDependencies, cleanupCycles } from "../algorithms/dependency-validator.js";
import { heuristicScore, buildScoringPrompt } from "../algorithms/complexity-scorer.js";
import { resolveRoot, errResp, jsonResp, assertPathWithinRoot, registerToolMeta } from "../shared/tool-utils.js";
import { shouldRegister as _shouldRegister } from "../shared/helpers.js"; // 工具注册过滤
import { callAI, callAIWithSchema } from "../core/ai-provider.js"; // AI 调用
import { ReportGenerator } from "../core/report-generator.js"; // 报告生成器
import { ClarificationEngine } from '../core/clarification-engine.js'; // 需求澄清引擎
import { OnboardingEngine } from '../core/onboarding.js'; // 新手引导引擎
import { log } from "../utils/logger.js"; // 日志工具
import path from "node:path";
import { promises as fs } from "node:fs";

export function registerStandardTools(server: McpServer, allowedTools?: Set<string>): void {
  // 工具注册辅助：检查工具名是否在允许列表中（无列表时全部允许）
  const shouldRegister = (name: string): boolean => _shouldRegister(name, allowedTools);

  // 批量注册 Standard 层工具元数据到全局注册表
  const standardMeta: [string, string][] = [
    ['qflow_task_get', '按 ID 获取任务详情'],
    ['qflow_context_status', '获取已加载上下文模块的状态'],
    ['qflow_spec_status', '获取所有 Spec 的状态统计'],
    ['qflow_task_update', '更新任务属性'],
    ['qflow_task_delete', '删除任务'],
    ['qflow_task_tree', '递归获取任务树结构'],
    ['qflow_spec_init', '初始化 Spec 文档'],
    ['qflow_spec_apply', '应用 Spec 变更'],
    ['qflow_spec_verify', '三维验证 Spec'],
    ['qflow_context_compress', '压缩上下文释放 token'],
    ['qflow_complexity_score', '复杂度评分'],
    ['qflow_plan_generate', '从 Spec 生成实现计划'],
    ['qflow_task_batch', '批量任务操作：创建/更新/状态/重写'],
    ['qflow_task_deps', '依赖管理：验证/添加/移除/修复/可视化/关键路径'],
    ['qflow_tag_manage', '标签管理：添加/移除/列表/过滤/重命名/删除/复制/从分支创建'],
    ['qflow_scope_navigate', '作用域导航：提升/降级/调节'],
    ['qflow_spec_propose', '提出 Spec 变更（支持 full 模式）'],
    ['qflow_spec_generate', '从代码库生成 Spec（支持 structured 模式）'],
    ['qflow_research', 'AI 研究查询'],
    ['qflow_report', '项目报告：进度/复杂度'],
    ['qflow_clarification', '需求澄清：ask/answer/list/unanswered'],
    ['qflow_onboarding', '新手引导：init/step/complete/progress/reset/report'],
  ];
  for (const [name, desc] of standardMeta) registerToolMeta(name, desc, 'standard'); // 注册元数据

  // ==================== 从 core 降级来的 3 个工具 ====================

  // 1. qflow_task_get - 按 ID 获取任务详情
  if (shouldRegister("qflow_task_get")) server.tool(
    "qflow_task_get",
    "按 ID 获取任务详情，包含所有字段（标题、描述、状态、优先级、依赖、标签、子任务、元数据等）。",
    {
      taskId: z.string().describe("任务 ID"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    { readOnlyHint: true },
    async ({ taskId, projectRoot }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");
      const tm = new TaskManager(root); // 创建任务管理器
      const task = await tm.getTask(taskId); // 按 ID 查找任务
      if (!task) return errResp(`任务 ${taskId} 不存在`); // 任务不存在
      return jsonResp({ task }); // 返回任务详情
    }
  );

  // 2. qflow_context_status - 获取已加载上下文模块的状态
  if (shouldRegister("qflow_context_status")) server.tool(
    "qflow_context_status",
    "获取已加载和可用上下文模块的状态，含逐模块 token 明细。",
    {},
    { readOnlyHint: true },
    async () => {
      const { getStatus } = await import('../core/context-loader.js'); // 动态导入
      const status = await getStatus(); // 获取状态
      return jsonResp(status); // 返回状态
    }
  );

  // 3. qflow_spec_status - 获取所有 Spec 的状态统计
  if (shouldRegister("qflow_spec_status")) server.tool(
    "qflow_spec_status",
    "获取所有 Spec 的状态概览，包括 Spec 总数、pending changes 和 applied changes 数量。",
    {
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    { readOnlyHint: true },
    async ({ projectRoot }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");
      const sm = new SpecManager(root); // 创建 Spec 管理器
      const status = await sm.getStatus(); // 获取状态统计
      return jsonResp(status); // 返回统计信息
    }
  );

  // ==================== 原 standard 保留的 9 个工具 ====================

  // 4. qflow_task_update - 更新任务属性
  if (shouldRegister("qflow_task_update")) server.tool(
    "qflow_task_update",
    "更新任务属性（标题、描述、优先级、依赖、标签等）。自动重新验证依赖图。",
    {
      taskId: z.string().describe("任务ID"),
      title: z.string().optional().describe("新标题"),
      description: z.string().optional().describe("新描述"),
      priority: z.number().min(1).max(10).optional().describe("新优先级"),
      dependencies: z.array(z.string()).optional().describe("新依赖列表"),
      tags: z.array(z.string()).optional().describe("新标签列表"),
      testStrategy: z.string().optional().describe("测试策略"),
      implementationGuide: z.string().optional().describe("实现指导（Markdown 格式）"),
      details: z.string().optional().describe("任务详细笔记"),
      useResearch: z.boolean().optional().describe("启用 AI 研究增强"),
      metadata: z.record(z.string(), z.unknown()).optional().describe("任务元数据（增量合并）"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async ({ taskId, projectRoot, details, useResearch, metadata, ...updates }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");
      const tm = new TaskManager(root); // 创建任务管理器

      // 追加详细笔记
      if (details) {
        await tm.appendToDetails(taskId, details); // 追加任务详细笔记
      }

      // 研究增强标注
      if (useResearch && updates.description) {
        updates.description = `[研究增强] ${updates.description}\n\n> 此任务已启用 AI 研究增强，建议在实施前进行深度分析。`;
      }

      const filtered: Partial<Task> = {}; // 过滤后的更新字段
      const taskKeys: (keyof Task)[] = ['title', 'description', 'priority', 'dependencies', 'tags', 'testStrategy', 'implementationGuide'];
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined && taskKeys.includes(k as keyof Task)) {
          (filtered[k as keyof Partial<Task>] as typeof v) = v; // 白名单校验
        }
      }

      // metadata 增量合并
      if (metadata) {
        const existing = await tm.getTask(taskId); // 读取当前任务
        filtered.metadata = { ...existing?.metadata, ...metadata }; // 浅合并
      }

      const task = await tm.updateTask(taskId, filtered); // 执行更新

      // 重新验证依赖
      const tasks = await tm.getAllTasks();
      const validation = validateDependencies(tasks);

      return jsonResp({ task, dependencyValidation: validation });
    }
  );

  // 5. qflow_task_delete - 删除任务
  if (shouldRegister("qflow_task_delete")) server.tool(
    "qflow_task_delete",
    "删除任务。cascade=true 时同时删除子任务，并清理其他任务中的依赖引用。",
    {
      taskId: z.string().describe("要删除的任务ID"),
      cascade: z.boolean().optional().describe("是否级联删除子任务"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    { destructiveHint: true },
    async ({ taskId, cascade, projectRoot }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");
      const tm = new TaskManager(root); // 创建任务管理器
      const result = await tm.deleteTask(taskId, cascade); // 删除任务
      return jsonResp(result);
    }
  );

  // 6. qflow_task_tree - 递归获取任务树结构
  if (shouldRegister("qflow_task_tree")) server.tool(
    "qflow_task_tree",
    "递归获取任务及其所有子任务的树结构",
    {
      taskId: z.string().describe("根任务 ID"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    { readOnlyHint: true },
    async ({ taskId, projectRoot }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");
      const tm = new TaskManager(root); // 创建任务管理器
      const tree = await tm.getTaskTree(taskId); // 递归获取任务树
      return jsonResp(tree);
    }
  );

  // 7. qflow_spec_init - 初始化 Spec 文档
  if (shouldRegister("qflow_spec_init")) server.tool(
    "qflow_spec_init",
    "初始化一个新的 Spec 文档，创建 spec.json 和 spec.md。可通过 schemaId 关联自定义工作流 Schema。",
    {
      name: z.string().describe("Spec 名称"),
      type: z.enum(['architecture', 'api', 'ui', 'data', 'algorithm']).describe("Spec 类型"),
      description: z.string().describe("Spec 描述"),
      schemaId: z.string().optional().describe("关联的工作流 Schema ID"),
      rigor: z.enum(['lite', 'full']).optional().describe("验证严格度（写入 Spec 元数据，影响后续 verify 行为）"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async ({ name, type, description, schemaId, rigor, projectRoot }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");
      const sm = new SpecManager(root); // 创建 Spec 管理器
      const spec = await sm.initSpec(name, type, description, schemaId); // 创建 Spec
      // R4: rigor 参数写入 spec 文件的 metadata 字段（直接操作 JSON）
      const effectiveRigor = rigor || 'full';
      if (rigor) {
        try {
          const specPath = path.join(root, '.qflow', 'specs', `${spec.id}.json`);
          const raw = JSON.parse(await fs.readFile(specPath, 'utf-8'));
          raw.metadata = { ...(raw.metadata || {}), rigor: effectiveRigor };
          await fs.writeFile(specPath, JSON.stringify(raw, null, 2));
        } catch (_) { /* 非关键操作，不阻断 */ }
      }
      return jsonResp({ spec, rigor: effectiveRigor });
    }
  );

  // 8. qflow_spec_apply - 应用 Spec 变更
  if (shouldRegister("qflow_spec_apply")) server.tool(
    "qflow_spec_apply",
    "应用待处理的 Spec 变更。确定性合并（RENAMED→REMOVED→MODIFIED→ADDED），原子写入。",
    {
      changeId: z.string().describe("变更ID"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async ({ changeId, projectRoot }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");
      const sm = new SpecManager(root); // 创建 Spec 管理器
      const result = await sm.apply(changeId); // 应用变更
      return jsonResp(result);
    }
  );

  // 9. qflow_spec_verify - 验证 Spec
  if (shouldRegister("qflow_spec_verify")) server.tool(
    "qflow_spec_verify",
    "对 Spec 执行三维验证：完整性（content非空）、正确性（格式正确）、一致性（依赖存在）。",
    {
      specId: z.string().describe("Spec ID"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    { readOnlyHint: true },
    async ({ specId, projectRoot }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");
      const sm = new SpecManager(root); // 创建 Spec 管理器
      const result = await sm.verify(specId); // 执行验证
      return jsonResp({
        ...result,
        summary: {
          valid: result.valid,
          criticalCount: result.criticalCount,
          warningCount: result.warningCount,
          suggestionCount: result.suggestionCount,
          totalIssues: result.issues.length,
        },
      });
    }
  );

  // 10. qflow_context_compress - 压缩上下文
  if (shouldRegister("qflow_context_compress")) server.tool(
    "qflow_context_compress",
    "压缩上下文，按策略保留关键信息。aggressive 策略实际卸载模块释放 token，moderate 仅返回建议。",
    {
      strategy: z.enum(['aggressive', 'moderate']).optional().describe("压缩策略"),
      preserveItems: z.array(z.string()).optional().describe("强制保留的模块名"),
    },
    async ({ strategy, preserveItems }) => {
      const { compressContext } = await import('../core/context-loader.js'); // 动态导入
      const result = await compressContext(strategy || 'moderate', preserveItems || []); // 压缩
      return jsonResp({
        strategy: result.strategy,
        tokensBefore: result.tokensBefore,
        tokensAfter: result.tokensAfter,
        freedTokens: result.freedTokens,
        unloaded: result.unloaded,
        suggestions: result.suggestions,
      });
    }
  );

  // 11. qflow_complexity_score - 复杂度评分
  if (shouldRegister("qflow_complexity_score")) server.tool(
    "qflow_complexity_score",
    "对任务或描述进行复杂度评分（1-10），返回评分理由和拆解建议。",
    {
      taskId: z.string().optional().describe("任务ID（从 tasks.json 读取）"),
      description: z.string().optional().describe("直接提供描述进行评分"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    { readOnlyHint: true },
    async ({ taskId, description, projectRoot }) => {
      if (taskId) {
        const root = await resolveRoot(projectRoot); // 解析项目根目录
        if (!root) return errResp("未找到 .qflow 项目");
        const tm = new TaskManager(root); // 创建任务管理器
        const task = await tm.getTask(taskId); // 获取任务
        if (!task) return errResp(`任务 ${taskId} 不存在`);
        return jsonResp({ taskId, complexity: heuristicScore(task), prompt: buildScoringPrompt(task) });
      }
      if (description) {
        const tmpTask = {
          id: 'T0', title: description.slice(0, 50), description,
          status: 'pending' as const, priority: 5, dependencies: [], subtasks: [],
          tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        return jsonResp({ complexity: heuristicScore(tmpTask) });
      }
      return errResp("请提供 taskId 或 description");
    }
  );

  // 12. qflow_plan_generate - 从 Spec 生成实现计划
  if (shouldRegister("qflow_plan_generate")) server.tool(
    'qflow_plan_generate',
    '从 Spec 生成实现计划（技术方案+数据模型+API契约+快速启动）',
    {
      projectRoot: z.string().optional().describe('项目根目录'),
      specId: z.string().describe('Spec ID'),
    },
    async ({ projectRoot: pr, specId }) => {
      const root = await resolveRoot(pr); // 解析根目录
      if (!root) return errResp('未找到 .qflow 项目');
      const { SpecCrud } = await import('../core/spec-crud.js'); // 动态导入
      const { PlanGenerator } = await import('../core/plan-generator.js'); // 动态导入
      const crud = new SpecCrud(root); // 创建 CRUD 实例
      const pg = new PlanGenerator(root, crud); // 创建计划生成器
      const plan = await pg.generate(specId); // 生成计划
      return jsonResp(plan);
    }
  );

  // ==================== 合并工具 8 个 ====================

  // 13. qflow_task_batch - 批量任务操作
  if (shouldRegister("qflow_task_batch")) server.tool(
    "qflow_task_batch",
    "批量任务操作：创建/更新/查询状态/重写",
    {
      action: z.enum(["create", "update", "status", "rewrite"]).describe("操作类型"),
      projectRoot: z.string().optional().describe("项目根目录"),
      tasks: z.array(z.object({
        title: z.string(), description: z.string().optional(), priority: z.number().int().min(1).max(10).optional(), tags: z.array(z.string()).optional(),
      })).optional().describe("任务数据(create)"),
      sequential: z.boolean().optional().describe("是否设置顺序依赖(create)，默认 false"),
      taskIds: z.array(z.string()).optional().describe("任务ID列表(update/status)"),
      updates: z.object({
        priority: z.number().int().min(1).max(10).optional(),
        tags: z.array(z.string()).optional(),
        category: z.enum(['research', 'design', 'development', 'testing', 'documentation', 'review']).optional(),
      }).optional().describe("更新字段(update)"),
      targetStatus: z.enum(['pending', 'active', 'done', 'blocked', 'cancelled', 'review', 'deferred']).optional().describe("目标状态(status)"),
      startId: z.string().optional().describe("起始任务 ID(rewrite)"),
      prompt: z.string().optional().describe("AI 重写指令(rewrite)"),
      scope: z.object({
        tags: z.array(z.string()).optional(),
        status: z.string().optional(),
        priority: z.number().int().min(1).max(10).optional(),
      }).optional().describe("范围过滤(rewrite)"),
    },
    async ({ action, projectRoot, tasks, sequential, taskIds, updates, targetStatus, startId, prompt, scope }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");
      const tm = new TaskManager(root); // 创建任务管理器

      switch (action) {
        case "create": {
          if (!tasks || tasks.length === 0) return errResp("create 操作必须提供 tasks 数组");
          const created: string[] = []; // 已创建的任务 ID
          let prevId: string | undefined; // 前一个任务 ID
          for (const t of tasks) {
            const task = await tm.createTask(t.title, t.description || t.title, {
              priority: t.priority,
              tags: t.tags,
              deps: sequential && prevId ? [prevId] : [], // 顺序依赖
            });
            created.push(task.id);
            prevId = task.id;
          }
          return jsonResp({ created, count: created.length });
        }
        case "update": {
          if (!taskIds || taskIds.length === 0) return errResp("update 操作必须提供 taskIds 数组");
          if (!updates) return errResp("update 操作必须提供 updates 对象");
          const results: Array<{ taskId: string; success: boolean; error?: string }> = [];
          for (const taskId of taskIds) {
            try {
              await tm.updateTask(taskId, updates);
              results.push({ taskId, success: true });
            } catch (e) {
              results.push({ taskId, success: false, error: (e as Error).message });
            }
          }
          return jsonResp({ results, successCount: results.filter(r => r.success).length });
        }
        case "status": {
          if (!taskIds || taskIds.length === 0) return errResp("status 操作必须提供 taskIds 数组");
          if (!targetStatus) return errResp("status 操作必须提供 targetStatus");
          const results: Array<{ taskId: string; success: boolean; error?: string }> = [];
          for (const taskId of taskIds) {
            try {
              await tm.setStatus(taskId, targetStatus); // 设置状态
              results.push({ taskId, success: true });
            } catch (e) {
              results.push({ taskId, success: false, error: (e as Error).message });
            }
          }
          return jsonResp({ results, successCount: results.filter(r => r.success).length, totalCount: taskIds.length });
        }
        case "rewrite": {
          if (!startId) return errResp("rewrite 操作必须提供 startId");
          try {
            const result = await tm.batchRewriteFrom(startId, prompt, scope); // 批量重写
            return jsonResp(result);
          } catch (e) {
            return errResp((e as Error).message);
          }
        }
        default:
          return errResp(`未知的 batch 操作: ${action}`); // R1: 兜底错误
      }
    }
  );

  // 14. qflow_task_deps - 依赖管理
  if (shouldRegister("qflow_task_deps")) server.tool(
    "qflow_task_deps",
    "依赖管理：验证/添加/移除/修复/可视化/关键路径分析",
    {
      action: z.enum(["validate", "add", "remove", "fix", "visualize", "critical_path"]).describe("操作类型"),
      projectRoot: z.string().optional().describe("项目根目录"),
      taskId: z.string().optional().describe("任务 ID(add/remove)"),
      depId: z.string().optional().describe("依赖任务 ID(add/remove)"),
      autoFix: z.boolean().optional().describe("是否自动修复环形依赖(validate)"),
    },
    async ({ action, projectRoot, taskId, depId, autoFix }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");
      const tm = new TaskManager(root); // 创建任务管理器

      switch (action) {
        case "validate": {
          const tasks = await tm.getAllTasks(); // 获取全部任务
          const result = validateDependencies(tasks); // 验证依赖
          if (autoFix && !result.valid) {
            const cleanup = cleanupCycles(tasks, result.cycles); // 修复环形依赖
            const data = await tm.load();
            data.tasks = tasks;
            await tm.save(data);
            return jsonResp({ validation: result, cleanup });
          }
          return jsonResp({ validation: result });
        }
        case "add": {
          if (!taskId || !depId) return errResp("add 操作必须提供 taskId 和 depId");
          try {
            await tm.addDependency(taskId, depId); // 添加依赖
            return jsonResp({ success: true, taskId, depId, message: `已为 ${taskId} 添加依赖 ${depId}` });
          } catch (e) {
            return errResp((e as Error).message);
          }
        }
        case "remove": {
          if (!taskId || !depId) return errResp("remove 操作必须提供 taskId 和 depId");
          try {
            await tm.removeDependency(taskId, depId); // 移除依赖
            return jsonResp({ success: true, taskId, depId, message: `已从 ${taskId} 移除依赖 ${depId}` });
          } catch (e) {
            return errResp((e as Error).message);
          }
        }
        case "fix": {
          const result = await tm.fixDependencies(); // 修复断裂依赖
          return jsonResp(result);
        }
        case "visualize": {
          const tasks = await tm.getAllTasks(); // 获取全部任务
          const lines: string[] = ['graph TD']; // Mermaid 图头
          const statusStyle: Record<string, string> = {
            pending: ':::pending', active: ':::active', done: ':::done',
            blocked: ':::blocked', cancelled: ':::cancelled',
            review: ':::review', deferred: ':::deferred',
          };
          for (const t of tasks) {
            const style = statusStyle[t.status] || '';
            lines.push(`  ${t.id}["${t.id}: ${t.title.slice(0, 30)}"]${style}`);
            for (const dep of t.dependencies) {
              lines.push(`  ${dep} --> ${t.id}`);
            }
          }
          lines.push('  classDef pending fill:#f9f9f9,stroke:#ccc');
          lines.push('  classDef active fill:#bbdefb,stroke:#1976d2');
          lines.push('  classDef done fill:#c8e6c9,stroke:#388e3c');
          lines.push('  classDef blocked fill:#ffcdd2,stroke:#d32f2f');
          lines.push('  classDef review fill:#fff9c4,stroke:#f9a825');
          return jsonResp({ mermaid: lines.join('\n'), taskCount: tasks.length });
        }
        case "critical_path": {
          const tasks = await tm.getAllTasks(); // 获取全部任务
          const taskMap = new Map(tasks.map(t => [t.id, t])); // ID→任务映射

          // DFS 计算最长路径（含环检测）
          const memo = new Map<string, string[]>();
          const visiting = new Set<string>();
          function longestPath(tid: string): string[] {
            if (memo.has(tid)) return memo.get(tid)!;
            if (visiting.has(tid)) return [tid]; // 环检测
            const task = taskMap.get(tid);
            if (!task) return [];
            visiting.add(tid);
            const downstream = tasks.filter(t => t.dependencies.includes(tid));
            if (downstream.length === 0) {
              visiting.delete(tid);
              memo.set(tid, [tid]);
              return [tid];
            }
            let longest: string[] = [];
            for (const dt of downstream) {
              const p = longestPath(dt.id);
              if (p.length > longest.length) longest = p;
            }
            visiting.delete(tid);
            const result = [tid, ...longest];
            memo.set(tid, result);
            return result;
          }
          const roots = tasks.filter(t => t.dependencies.length === 0);
          let criticalPath: string[] = [];
          for (const r of roots) {
            const p = longestPath(r.id);
            if (p.length > criticalPath.length) criticalPath = p;
          }
          const pathDetails = criticalPath.map(id => {
            const t = taskMap.get(id);
            return { id, title: t?.title || '', status: t?.status || '', priority: t?.priority || 0 };
          });
          return jsonResp({ criticalPath, length: criticalPath.length, details: pathDetails });
        }
        default:
          return errResp(`未知的 deps 操作: ${action}`); // R2: 兜底错误
      }
    }
  );

  // 15. qflow_tag_manage - 标签管理
  if (shouldRegister("qflow_tag_manage")) server.tool(
    "qflow_tag_manage",
    "标签管理：添加/移除/列表/过滤/重命名/删除/复制/从分支创建",
    {
      action: z.enum(["add", "remove", "list", "filter", "rename", "delete", "copy", "from_branch"]).describe("操作类型"),
      projectRoot: z.string().optional().describe("项目根目录"),
      taskIds: z.array(z.string()).optional().describe("任务 ID 列表(add/remove)"),
      tags: z.array(z.string()).optional().describe("标签列表(add/remove/filter)"),
      mode: z.enum(['and', 'or']).optional().describe("过滤模式(filter)，默认 or"),
      oldName: z.string().optional().describe("旧标签名(rename)"),
      newName: z.string().optional().describe("新标签名(rename)"),
      tagName: z.string().optional().describe("标签名(delete)"),
      sourceTag: z.string().optional().describe("源标签(copy)"),
      targetTag: z.string().optional().describe("目标标签(copy)"),
    },
    async ({ action, projectRoot, taskIds, tags, mode, oldName, newName, tagName, sourceTag, targetTag }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");
      const tagMgr = new TagManager(root); // 创建标签管理器

      switch (action) {
        case "add": {
          if (!taskIds || taskIds.length === 0) return errResp("add 操作必须提供 taskIds");
          if (!tags || tags.length === 0) return errResp("add 操作必须提供 tags");
          const result = await tagMgr.batchAddTags(taskIds, tags); // 批量添加标签
          return jsonResp(result);
        }
        case "remove": {
          if (!taskIds || taskIds.length === 0) return errResp("remove 操作必须提供 taskIds");
          if (!tags || tags.length === 0) return errResp("remove 操作必须提供 tags");
          const result = await tagMgr.batchRemoveTags(taskIds, tags); // 批量移除标签
          return jsonResp(result);
        }
        case "list": {
          const stats = await tagMgr.getTagStats(); // 获取标签统计
          return jsonResp({ tags: Object.fromEntries(stats), totalTags: stats.size });
        }
        case "filter": {
          if (!tags || tags.length === 0) return errResp("filter 操作必须提供 tags");
          const tasks = await tagMgr.filterByTags(tags, mode || 'or'); // 按标签过滤
          return jsonResp({ tasks, count: tasks.length });
        }
        case "rename": {
          if (!oldName || !newName) return errResp("rename 操作必须提供 oldName 和 newName");
          const affected = await tagMgr.renameTag(oldName, newName); // 重命名标签
          return jsonResp({ oldName, newName, affected, count: affected.length });
        }
        case "delete": {
          if (!tagName) return errResp("delete 操作必须提供 tagName");
          const affected = await tagMgr.deleteTag(tagName); // 删除标签
          return jsonResp({ tagName, affected, count: affected.length });
        }
        case "copy": {
          if (!sourceTag || !targetTag) return errResp("copy 操作必须提供 sourceTag 和 targetTag");
          try {
            const result = await tagMgr.copyTag(sourceTag, targetTag); // 复制标签
            return jsonResp({ sourceTag, targetTag, ...result });
          } catch (e) {
            return errResp((e as Error).message);
          }
        }
        case "from_branch": {
          try {
            const tagNameResult = await tagMgr.createTagFromBranch(root); // 从分支创建标签
            return jsonResp({ created: true, tagName: tagNameResult, note: `已从当前 Git 分支创建标签 "${tagNameResult}" 并应用到所有 active 任务` });
          } catch (e) {
            return errResp((e as Error).message);
          }
        }
      }
    }
  );

  // 16. qflow_scope_navigate - 作用域导航
  if (shouldRegister("qflow_scope_navigate")) server.tool(
    "qflow_scope_navigate",
    "作用域导航：up=子任务提升为顶层任务, down=顶层任务降级为子任务, adjust=动态调节任务范围",
    {
      direction: z.enum(["up", "down", "adjust"]).describe("导航方向"),
      taskId: z.string().describe("任务 ID"),
      parentId: z.string().optional().describe("目标父任务ID(down)"),
      strength: z.number().min(1).max(5).optional().describe("调节力度(adjust) 1-5，默认 3"),
      adjustDirection: z.enum(['up', 'down']).optional().describe("调节方向(adjust): up=扩展/down=简化"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async ({ direction, taskId, parentId, strength, adjustDirection, projectRoot }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");
      const tm = new TaskManager(root); // 创建任务管理器

      switch (direction) {
        case "up": {
          // 子任务提升为独立顶层任务
          const data = await tm.load(); // 加载全量数据
          const task = data.tasks.find(t => t.id === taskId);
          if (!task) return errResp(`任务 ${taskId} 不存在`);
          if (!task.parentId) return errResp(`任务 ${taskId} 已是顶层任务，无需提升`);

          const oldParentId = task.parentId;
          const parent = data.tasks.find(t => t.id === oldParentId);

          // 从父任务的 subtasks[] 中移除
          if (parent) {
            parent.subtasks = parent.subtasks.filter(id => id !== taskId);
            parent.updatedAt = new Date().toISOString();
          }
          // 移除 parentId
          task.parentId = undefined;
          task.updatedAt = new Date().toISOString();
          await tm.save(data);

          return jsonResp({ task, previousParentId: oldParentId, parentUpdated: !!parent });
        }
        case "down": {
          // 顶层任务降级为子任务
          if (!parentId) return errResp("down 操作必须提供 parentId");
          const data = await tm.load();
          const task = data.tasks.find(t => t.id === taskId);
          if (!task) return errResp(`任务 ${taskId} 不存在`);
          if (task.parentId) return errResp(`任务 ${taskId} 已有父任务 ${task.parentId}，非顶层任务`);

          const parent = data.tasks.find(t => t.id === parentId);
          if (!parent) return errResp(`父任务 ${parentId} 不存在`);

          // 计算新子任务 ID（R6: 含冲突检测）
          const siblings = data.tasks.filter(t => t.parentId === parentId);
          const maxSubId = siblings.reduce((max, t) => {
            const parts = t.id.split('.');
            const subNum = parseInt(parts[parts.length - 1]) || 0;
            return Math.max(max, subNum);
          }, 0);
          const newId = `${parentId}.${maxSubId + 1}`;
          // R6: 检查新 ID 是否已被占用
          if (data.tasks.some(t => t.id === newId)) return errResp(`生成的新 ID ${newId} 已存在，存在 ID 冲突`);
          const oldId = task.id;

          task.id = newId;
          task.parentId = parentId;
          task.updatedAt = new Date().toISOString();
          parent.subtasks.push(newId);
          parent.updatedAt = new Date().toISOString();

          // 更新依赖引用
          for (const t of data.tasks) {
            const depIdx = t.dependencies.indexOf(oldId);
            if (depIdx !== -1) {
              t.dependencies[depIdx] = newId;
              t.updatedAt = new Date().toISOString();
            }
          }
          // 同步子任务 parentId
          let childrenUpdated = 0;
          for (const t of data.tasks) {
            if (t.parentId === taskId) {
              t.parentId = newId;
              t.updatedAt = new Date().toISOString();
              childrenUpdated++;
            }
          }
          await tm.save(data);

          return jsonResp({ task, oldId, newId, parentId, childrenUpdated });
        }
        case "adjust": {
          // 动态调节任务范围
          if (!adjustDirection) return errResp("adjust 操作必须提供 adjustDirection");
          try {
            const result = await tm.scopeAdjust(taskId, adjustDirection, strength); // 执行范围调节
            return jsonResp(result);
          } catch (err) {
            return errResp((err as Error).message);
          }
        }
      }
    }
  );

  // 17. qflow_spec_propose - 提出 Spec 变更（支持 full 一站式模式）
  if (shouldRegister("qflow_spec_propose")) server.tool(
    "qflow_spec_propose",
    "提出 Spec 变更。默认 Delta 格式写入 changes/pending/。full=true 时一站式创建完整 Spec（含 proposal+design+tasks）。",
    {
      specId: z.string().optional().describe("Spec ID（非 full 模式必填）"),
      changes: z.array(z.object({
        type: z.enum(['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED']).describe("变更类型"),
        section: z.string().describe("目标 section"),
        before: z.string().optional().describe("变更前内容"),
        after: z.string().optional().describe("变更后内容"),
        rationale: z.string().describe("变更理由"),
      })).optional().describe("变更列表（非 full 模式必填）"),
      rationale: z.string().optional().describe("整体变更理由（非 full 模式必填）"),
      full: z.boolean().optional().describe("一站式创建完整 Spec"),
      name: z.string().optional().describe("Spec 名称(full 模式)"),
      type: z.enum(['architecture', 'api', 'ui', 'data', 'algorithm']).optional().describe("Spec 类型(full 模式)"),
      description: z.string().optional().describe("Spec 描述(full 模式)"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async ({ specId, changes, rationale, full, name, type, description, projectRoot }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");
      const sm = new SpecManager(root); // 创建 Spec 管理器

      if (full) {
        // 一站式创建完整 Spec
        if (!name || !type || !description) return errResp("full 模式必须提供 name、type 和 description");
        try {
          const result = await sm.specProposeFull(name, type, description); // 调用一站式创建
          return jsonResp(result);
        } catch (e) {
          return errResp((e as Error).message);
        }
      } else {
        // Delta 格式提出变更
        if (!specId) return errResp("非 full 模式必须提供 specId");
        if (!changes || !rationale) return errResp("非 full 模式必须提供 changes 和 rationale");
        const change = await sm.propose(specId, changes, rationale); // 提出变更
        return jsonResp({ change });
      }
    }
  );

  // 18. qflow_spec_generate - 从代码库生成 Spec（支持 structured 模式）
  if (shouldRegister("qflow_spec_generate")) server.tool(
    "qflow_spec_generate",
    "从代码库生成 Spec。默认分析文件提取架构信息，structured=true 时 AI 生成结构化 Spec（含用户故事和验收条件）。",
    {
      name: z.string().describe("Spec 名称"),
      type: z.enum(['architecture', 'api', 'ui', 'data', 'algorithm']).optional().describe("Spec 类型"),
      filePaths: z.array(z.string()).optional().describe("要分析的文件路径列表（非 structured 模式必填）"),
      structured: z.boolean().optional().describe("AI 生成结构化 Spec"),
      description: z.string().optional().describe("自然语言描述(structured 模式)"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async ({ name, type, filePaths, structured, description, projectRoot }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");

      if (structured) {
        // AI 生成结构化 Spec
        if (!description) return errResp("structured 模式必须提供 description");
        const { SpecCrud } = await import('../core/spec-crud.js'); // 动态导入
        const { SpecAI } = await import('../core/spec-ai.js'); // 动态导入
        const crud = new SpecCrud(root);
        const ai = new SpecAI(root, crud, callAI);
        const result = await ai.generateStructuredSpec(name, description); // 生成结构化 Spec
        return jsonResp({ specId: result.spec.id, clarifications: result.clarifications });
      } else {
        // 从代码库文件生成 Spec
        if (!type) return errResp("非 structured 模式必须提供 type");
        if (!filePaths || filePaths.length === 0) return errResp("非 structured 模式必须提供 filePaths");

        // 路径安全校验
        const safePaths: string[] = [];
        for (const fp of filePaths) {
          try {
            safePaths.push(assertPathWithinRoot(root, fp));
          } catch (e) {
            return errResp(`文件路径不安全: ${(e as Error).message}`);
          }
        }
        const sm = new SpecManager(root);
        try {
          const spec = await sm.generateFromCodebase(name, type, safePaths); // 从代码库生成
          return jsonResp({ spec });
        } catch (e) {
          return errResp((e as Error).message);
        }
      }
    }
  );

  // 19. qflow_research - AI 研究查询
  if (shouldRegister("qflow_research")) server.tool(
    "qflow_research",
    "通过 AI 执行开放式研究查询。分析技术方案、最佳实践、架构决策等。支持关联任务上下文、文件内容注入和详细度控制。",
    {
      query: z.string().describe("研究问题"),
      context: z.string().optional().describe("附加上下文信息"),
      taskId: z.string().optional().describe("关联任务 ID，自动注入任务标题和描述"),
      files: z.array(z.string()).optional().describe("注入代码文件路径列表（每个文件最多 4096 字符）"),
      detail: z.enum(['low', 'medium', 'high']).optional().describe("研究详细度: low=摘要/medium=标准/high=深度分析"),
    },
    { readOnlyHint: true },
    async ({ query, context, taskId, files, detail }) => {
      try {
        const contextParts: string[] = []; // 上下文片段

        // 注入关联任务信息
        if (taskId) {
          const root = await resolveRoot(undefined);
          if (root) {
            const tm = new TaskManager(root);
            const task = await tm.getTask(taskId);
            if (task) {
              contextParts.push(`关联任务 [${task.id}]: ${task.title}\n任务描述: ${task.description}`);
            }
          }
        }

        // 读取文件内容作为上下文
        if (files && files.length > 0) {
          const root = await resolveRoot(undefined);
          for (const filePath of files) {
            try {
              if (!root) {
                log.warn(`研究工具: 无法确定项目根目录，跳过文件 [${filePath}]`);
                contextParts.push(`文件 [${filePath}]: 无法确定项目根目录，拒绝读取文件`);
                continue;
              }
              const resolvedPath = assertPathWithinRoot(root, filePath); // 路径安全校验
              const content = await fs.readFile(resolvedPath, 'utf-8');
              const truncated = content.slice(0, 4096);
              const suffix = content.length > 4096 ? '\n...(已截断)' : '';
              contextParts.push(`文件 [${filePath}]:\n${truncated}${suffix}`);
              log.debug(`研究工具: 已注入文件 [${filePath}]（${content.length} 字符）`);
            } catch (err) {
              log.warn(`研究工具: 读取文件失败 [${filePath}]: ${err}`);
              contextParts.push(`文件 [${filePath}]: 读取失败（文件不存在或权限不足）`);
            }
          }
        }

        if (context) contextParts.push(context); // 附加用户上下文
        const fullContext = contextParts.length > 0 ? contextParts.join('\n\n') : '';

        // 根据详细度生成差异化 prompt
        const detailLevel = detail ?? 'medium';
        const detailInstruction = detailLevel === 'low'
          ? '请提供简短摘要，仅输出核心要点（每项不超过2句话），省略详细解释和次要信息。'
          : detailLevel === 'high'
            ? '请提供深度分析，每个分析要点需包含详细论证、代码示例（如适用）、权衡利弊、替代方案对比和实施建议，内容尽量完整详尽。'
            : '请提供结构化的分析结果，包括：要点总结、方案对比、建议、注意事项。';

        const prompt = fullContext
          ? `研究问题：${query}\n\n上下文：${fullContext}\n\n${detailInstruction}`
          : `研究问题：${query}\n\n${detailInstruction}`;

        const ResearchResultSchema = z.object({
          summary: z.string().describe("要点总结"),
          analysis: z.array(z.object({
            point: z.string(),
            detail: z.string(),
          })).describe("分析要点"),
          recommendations: z.array(z.string()).describe("建议"),
          caveats: z.array(z.string()).describe("注意事项"),
        });

        const result = await callAIWithSchema(prompt, ResearchResultSchema); // 调用 AI
        return jsonResp({ result, detail: detailLevel });
      } catch (e) {
        return jsonResp({
          result: null,
          error: (e as Error).message,
          note: "AI 研究失败，请检查 AI Provider 配置",
        });
      }
    }
  );

  // 20. qflow_report - 项目报告
  if (shouldRegister("qflow_report")) server.tool(
    "qflow_report",
    "项目报告：progress=进度报告（含状态统计、标签分组、阻塞分析），complexity=复杂度报告（含评分分布、高复杂度任务、拆解建议）",
    {
      action: z.enum(["progress", "complexity"]).describe("报告类型"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    { readOnlyHint: true },
    async ({ action, projectRoot }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");
      const reporter = new ReportGenerator(root); // 创建报告生成器

      switch (action) {
        case "progress": {
          const report = await reporter.generateProgressReport(); // 进度报告
          return jsonResp({ report });
        }
        case "complexity": {
          const report = await reporter.generateComplexityReport(); // 复杂度报告
          return jsonResp({ report });
        }
      }
    }
  );

  // 21. qflow_clarification - 需求澄清管理
  if (shouldRegister("qflow_clarification")) server.tool(
    "qflow_clarification",
    "需求澄清管理：ask=提出澄清问题，answer=回答问题，list=列出问题，unanswered=获取未回答问题",
    {
      action: z.enum(['ask', 'answer', 'list', 'unanswered']).describe("操作类型"),
      projectRoot: z.string().optional().describe("项目根目录"),
      specId: z.string().describe("关联 Spec ID"),
      question: z.string().optional().describe("澄清问题内容（ask 时必填）"),
      context: z.string().optional().describe("问题上下文（ask 时可选）"),
      questionId: z.string().optional().describe("问题 ID（answer 时必填）"),
      answer: z.string().optional().describe("回答内容（answer 时必填）"),
      status: z.enum(['pending', 'answered']).optional().describe("过滤状态（list 时可选）"),
    },
    async ({ action, projectRoot, specId, question, context, questionId, answer, status }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");
      const engine = new ClarificationEngine(root); // 创建澄清引擎实例

      switch (action) {
        case 'ask': {
          // 提出澄清问题，question 必填
          if (!question) return errResp("ask 操作需要 question 参数");
          const result = await engine.addQuestion(specId, question, context); // 添加问题
          log.info(`澄清工具: 新增问题 [${result.id}] -> Spec [${specId}]`);
          return jsonResp({ question: result });
        }
        case 'answer': {
          // 回答澄清问题，questionId 和 answer 必填
          if (!questionId) return errResp("answer 操作需要 questionId 参数");
          if (!answer) return errResp("answer 操作需要 answer 参数");
          const result = await engine.answerQuestion(specId, questionId, answer); // 回答问题
          log.info(`澄清工具: 回答问题 [${questionId}] -> Spec [${specId}]`);
          return jsonResp({ question: result });
        }
        case 'list': {
          // 列出问题，支持按状态过滤
          const questions = await engine.listQuestions(specId, status); // 获取问题列表
          log.info(`澄清工具: 列出问题 Spec [${specId}], 状态过滤=[${status ?? '全部'}], 共 ${questions.length} 条`);
          return jsonResp({ questions, total: questions.length });
        }
        case 'unanswered': {
          // 获取所有未回答问题
          const questions = await engine.getUnanswered(specId); // 获取未回答列表
          log.info(`澄清工具: 未回答问题 Spec [${specId}], 共 ${questions.length} 条`);
          return jsonResp({ questions, total: questions.length });
        }
      }
    }
  );

  // 22. qflow_onboarding - 新手引导教程
  if (shouldRegister("qflow_onboarding")) server.tool(
    "qflow_onboarding",
    "新手引导教程：init=初始化引导，step=获取当前步骤，complete=完成当前步骤，progress=查看进度，reset=重置引导，report=生成引导报告",
    {
      action: z.enum(['init', 'step', 'complete', 'progress', 'reset', 'report']).describe("操作类型"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async ({ action, projectRoot }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");
      const engine = new OnboardingEngine(root); // 创建引导引擎实例

      switch (action) {
        case 'init': {
          // 初始化引导状态
          const state = await engine.init(); // 创建 onboarding.json
          log.info(`引导工具: 初始化引导状态`);
          return jsonResp({ state });
        }
        case 'step': {
          // 获取当前未完成步骤
          const step = await engine.getStep(); // 获取当前步骤
          log.info(`引导工具: 获取当前步骤 -> ${step ? step.name : '全部完成'}`);
          return jsonResp({ step });
        }
        case 'complete': {
          // 完成当前步骤并推进
          const result = await engine.completeStep(); // 标记当前步骤完成
          log.info(`引导工具: 完成步骤, 已完成=${result.completed}, 全部完成=${result.allDone}`);
          return jsonResp(result);
        }
        case 'progress': {
          // 查看整体进度
          const progress = await engine.getProgress(); // 获取进度摘要
          log.info(`引导工具: 进度 ${progress.current}/${progress.total} (${progress.percentage}%)`);
          return jsonResp(progress);
        }
        case 'reset': {
          // 重置引导状态
          await engine.reset(); // 清除并重建 onboarding.json
          log.info(`引导工具: 引导状态已重置`);
          return jsonResp({ success: true, message: "引导状态已重置" });
        }
        case 'report': {
          // 生成引导报告
          const report = await engine.generateOnboardingReport(); // 生成 Markdown 报告
          log.info(`引导工具: 生成引导报告`);
          return jsonResp({ report });
        }
      }
    }
  );

}
