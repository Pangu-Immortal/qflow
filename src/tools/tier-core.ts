/**
 * Tier Core - 10 个核心 MCP 工具（始终可用）
 * qflow_project_init / qflow_task_create / qflow_task_next / qflow_task_set_status
 * qflow_task_list / qflow_task_expand / qflow_context_load / qflow_session_handoff
 * qflow_what_next / qflow_parse_prd
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TaskManager } from "../core/task-manager.js";
import type { Task } from "../schemas/task.js"; // 任务类型（用于 filter 强类型）
import { loadModules } from "../core/context-loader.js";
import { selectNextTask } from "../algorithms/next-task.js";
import { ensureDir, writeJSON, fileExists } from "../utils/file-io.js";
import { log } from "../utils/logger.js"; // 日志工具
import { getDefaultConfig, saveConfig } from "../core/config-manager.js";
import { resolveRoot, errResp, jsonResp, registerToolMeta } from "../shared/tool-utils.js";
import { shouldRegister as _shouldRegister } from "../shared/helpers.js"; // 工具注册过滤
import { heuristicScore } from "../algorithms/complexity-scorer.js"; // 复杂度评分（task_create 使用）
import { bigramSimilarity } from "../algorithms/fuzzy-search.js"; // 模糊搜索（task_list 使用）
// [重构] 已移除 callAI 和 prompt-templates 导入，task_expand 改为纯模板拆解 + hint 提示宿主 LLM
import { parsePrd } from "../core/prd-parser.js"; // PRD 解析器（parse_prd 使用）
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { fileURLToPath } from 'node:url'; // ESM 环境下动态解析当前文件路径

export function registerCoreTools(server: McpServer, allowedTools?: Set<string>): void {
  // 工具注册辅助：检查工具名是否在允许列表中（无列表时全部允许）
  const shouldRegister = (name: string): boolean => _shouldRegister(name, allowedTools);

  // 批量注册 Core 层工具元数据到全局注册表
  const coreMeta: [string, string][] = [
    ['qflow_project_init', '初始化项目 qflow 配置（含 onboard 引导信息）'],
    ['qflow_task_create', '创建新任务，自动评分复杂度'],
    ['qflow_task_next', '获取下一个推荐执行的任务'],
    ['qflow_task_set_status', '设置任务状态'],
    ['qflow_task_list', '列出所有任务（支持模糊搜索）'],
    ['qflow_task_expand', '将任务拆解为子任务'],
    ['qflow_context_load', '按需加载上下文模块'],
    ['qflow_session_handoff', '生成会话交接摘要'],
    ['qflow_what_next', '项目状态感知智能导航'],
    ['qflow_parse_prd', '解析 PRD 文档生成任务'],
  ];
  for (const [name, desc] of coreMeta) registerToolMeta(name, desc, 'core'); // 注册元数据

  // 1. qflow_project_init - 初始化项目（合并 onboard 引导信息）
  if (shouldRegister("qflow_project_init")) server.tool(
    "qflow_project_init",
    "初始化项目的 qflow 配置。创建 .qflow/ 目录结构，包含配置文件和空任务列表。同时返回 onboardInfo 引导信息。",
    {
      projectRoot: z.string().describe("项目根目录路径"),
      projectName: z.string().optional().describe("项目名称"),
    },
    async ({ projectRoot, projectName }) => {
      const root = path.resolve(projectRoot);
      const qflowDir = path.join(root, '.qflow');

      // ── onboard 信息收集（无论是否已初始化都返回） ──
      const qflowExists = await fileExists(path.join(root, '.qflow')); // 检查 .qflow 目录
      const qflowConfigExists = await fileExists(path.join(root, '.qflow', 'qflow.config.json')); // 检查配置文件

      // 扫描常见项目标记文件，检测项目类型
      const markers: Record<string, { file: string; type: string; label: string }> = {
        'package.json': { file: 'package.json', type: 'nodejs', label: 'Node.js' },
        'Cargo.toml': { file: 'Cargo.toml', type: 'rust', label: 'Rust' },
        'go.mod': { file: 'go.mod', type: 'go', label: 'Go' },
        'pyproject.toml': { file: 'pyproject.toml', type: 'python', label: 'Python (pyproject)' },
        'setup.py': { file: 'setup.py', type: 'python', label: 'Python (setup.py)' },
        'requirements.txt': { file: 'requirements.txt', type: 'python', label: 'Python (requirements)' },
        'build.gradle': { file: 'build.gradle', type: 'android', label: 'Android (Gradle)' },
        'build.gradle.kts': { file: 'build.gradle.kts', type: 'android', label: 'Android (Gradle KTS)' },
        'Podfile': { file: 'Podfile', type: 'ios', label: 'iOS (CocoaPods)' },
        'Package.swift': { file: 'Package.swift', type: 'swift', label: 'Swift Package' },
        'pom.xml': { file: 'pom.xml', type: 'java', label: 'Java (Maven)' },
        'CMakeLists.txt': { file: 'CMakeLists.txt', type: 'cpp', label: 'C/C++ (CMake)' },
        'Makefile': { file: 'Makefile', type: 'make', label: 'Make' },
        'Dockerfile': { file: 'Dockerfile', type: 'docker', label: 'Docker' },
        'docker-compose.yml': { file: 'docker-compose.yml', type: 'docker-compose', label: 'Docker Compose' },
        'tsconfig.json': { file: 'tsconfig.json', type: 'typescript', label: 'TypeScript' },
      };

      const detectedLabels: string[] = []; // 检测到的项目类型标签列表
      for (const [, marker] of Object.entries(markers)) {
        if (await fileExists(path.join(root, marker.file))) {
          detectedLabels.push(marker.label);
        }
      }

      const isGitRepo = await fileExists(path.join(root, '.git')); // 是否 Git 仓库
      const hasSrcDir = await fileExists(path.join(root, 'src')); // 是否有 src 目录

      // 构建推荐的首步操作
      const recommendedSteps: string[] = [];
      if (!qflowExists) {
        recommendedSteps.push('1. 初始化项目: 调用 qflow_project_init 创建 .qflow/ 目录');
      } else if (!qflowConfigExists) {
        recommendedSteps.push('1. 项目已有 .qflow/ 但缺少配置文件，建议重新初始化');
      } else {
        recommendedSteps.push('1. 项目已初始化，可直接使用 qflow 工具');
      }
      recommendedSteps.push('2. 创建 Spec 文档: 调用 qflow_spec_init 描述项目需求或架构');
      recommendedSteps.push('3. 创建任务: 调用 qflow_task_create 或 qflow_parse_prd 从文档生成任务');
      recommendedSteps.push('4. 获取下一任务: 调用 qflow_task_next 获取推荐执行的任务');
      if (!isGitRepo) {
        recommendedSteps.push('5. 建议: 当前目录非 Git 仓库，推荐执行 git init');
      }

      const onboardInfo = {
        projectRoot: root,
        isInitialized: qflowExists && qflowConfigExists,
        isGitRepo,
        hasSrcDir,
        detectedProjectTypes: detectedLabels,
        recommendedSteps,
      };

      // ── 已初始化时直接返回 ──
      if (await fileExists(path.join(qflowDir, 'qflow.config.json'))) {
        return jsonResp({ status: "already_initialized", path: qflowDir, onboardInfo });
      }

      // ── 执行初始化 ──
      await ensureDir(qflowDir);
      await ensureDir(path.join(qflowDir, 'specs'));
      await ensureDir(path.join(qflowDir, 'changes', 'pending'));
      await ensureDir(path.join(qflowDir, 'changes', 'applied'));
      await ensureDir(path.join(qflowDir, 'changes', 'archived'));

      const config = getDefaultConfig(root, projectName || path.basename(root));
      await saveConfig(root, config);
      await writeJSON(path.join(qflowDir, 'tasks.json'), { version: 1, tasks: [], lastId: 0 });

      // Phase 3 S-8: 创建 project.md 项目上下文模板
      const projectMdPath = path.join(qflowDir, 'project.md'); // 项目上下文文件路径
      if (!(await fileExists(projectMdPath))) { // 文件不存在时创建
        const projectMdContent = [
          `# ${projectName || path.basename(root)} - 项目上下文`,
          '',
          '> 本文件为项目级上下文，会自动注入到 Spec 创建和 AI 调用中。',
          '> 请在此描述项目的核心信息，帮助 AI 更好地理解项目背景。',
          '',
          '## 项目简介',
          '',
          '[请简要描述项目的目标和用途]',
          '',
          '## 技术栈',
          '',
          '- 语言: ',
          '- 框架: ',
          '- 数据库: ',
          '- 其他: ',
          '',
          '## 核心约束',
          '',
          '- [请列出技术约束、业务约束等]',
          '',
          '## 团队规范',
          '',
          '- [请列出代码风格、提交规范等]',
          '',
        ].join('\n'); // 拼接模板内容
        await fs.writeFile(projectMdPath, projectMdContent, 'utf-8'); // 写入 project.md
        log.info('Phase 3 S-8: project.md 模板已创建'); // 日志
      }

      // 安装 slash 命令（动态解析模板路径，兼容任意安装位置）
      const commandsDir = path.join(os.homedir(), '.claude', 'commands');
      const currentToolFile = fileURLToPath(import.meta.url); // dist/tools/tier-core.js
      const qflowRoot = path.resolve(path.dirname(currentToolFile), '..', '..'); // 向上两级到项目根
      const srcTemplatesDir = path.join(qflowRoot, 'src', 'templates'); // 优先 src/templates
      const distTemplatesDir = path.join(qflowRoot, 'dist', 'templates'); // 备选 dist/templates
      const actualTemplatesDir = await fileExists(srcTemplatesDir) ? srcTemplatesDir : distTemplatesDir; // 动态选择
      await ensureDir(commandsDir);
      try {
        const files = await fs.readdir(actualTemplatesDir);
        for (const file of files) {
          if (file.endsWith('.md')) {
            await fs.copyFile(path.join(actualTemplatesDir, file), path.join(commandsDir, file));
          }
        }
      } catch (e) { log.debug(`模板目录读取失败，跳过命令安装: ${(e as Error).message}`); }

      return jsonResp({
        status: "initialized",
        path: qflowDir,
        config: config,
        onboardInfo,
      });
    }
  );

  // 2. qflow_task_create - 创建新任务（从 standard 搬入）
  if (shouldRegister("qflow_task_create")) server.tool(
    "qflow_task_create",
    "创建新任务，自动评分复杂度。若复杂度 >= autoExpand 阈值，建议拆解子任务。",
    {
      title: z.string().describe("任务标题"),
      description: z.string().describe("任务描述"),
      priority: z.number().min(1).max(10).optional().describe("优先级 1-10"),
      deps: z.array(z.string()).optional().describe("依赖任务ID列表"),
      tags: z.array(z.string()).optional().describe("标签列表"),
      parentId: z.string().optional().describe("父任务ID"),
      implementationGuide: z.string().optional().describe("实现指导（Markdown 格式，帮助开发者理解如何实现）"),
      useResearch: z.boolean().optional().describe("启用 AI 研究增强"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async ({ title, description, priority, deps, tags, parentId, implementationGuide, useResearch, projectRoot }) => {
      const root = await resolveRoot(projectRoot);
      if (!root) return errResp("未找到 .qflow 项目");

      // 研究增强 - 在描述中标注
      const finalDescription = useResearch
        ? `[研究增强] ${description}\n\n> 此任务已启用 AI 研究增强，建议在实施前进行深度分析。`
        : description;

      const tm = new TaskManager(root);
      const task = await tm.createTask(title, finalDescription, {
        priority: priority || 5,
        deps: deps || [],
        tags: tags || [],
        parentId,
      });

      // 启发式评分
      const score = heuristicScore(task);
      task.complexityScore = score.score;
      task.expansionPrompt = score.expansionPrompt;
      if (implementationGuide) task.implementationGuide = implementationGuide; // 设置实现指导
      const data = await tm.load();
      const idx = data.tasks.findIndex(t => t.id === task.id);
      if (idx >= 0) data.tasks[idx] = task;
      await tm.save(data);

      // 读取 autoExpand 配置，复杂度达标时提示拆解
      let autoExpandHint: string | undefined; // 自动拆解提示
      try {
        const { loadConfig } = await import('../core/config-manager.js'); // 动态导入配置管理器
        const config = await loadConfig(root); // 加载项目配置
        if (config.autoExpand && score.score >= config.autoExpand) { // 评分 >= 阈值
          autoExpandHint = `复杂度 ${score.score} >= autoExpand 阈值 ${config.autoExpand}，建议使用 qflow_task_expand 拆解此任务`; // 拆解提示
        }
      } catch (e) { log.debug(`配置加载失败，autoExpand 检查跳过: ${(e as Error).message}`); } // 配置加载失败时静默跳过

      return jsonResp({ task, complexity: score, autoExpandHint });
    }
  );

  // 3. qflow_task_next - 获取下一推荐任务
  if (shouldRegister("qflow_task_next")) server.tool(
    "qflow_task_next",
    "获取下一个推荐执行的任务。基于优先级、依赖状态和子任务关系自动选择最优任务。",
    { projectRoot: z.string().optional().describe("项目根目录路径") },
    { readOnlyHint: true },
    async ({ projectRoot }) => {
      const root = await resolveRoot(projectRoot);
      if (!root) return errResp("未找到 .qflow 项目");

      const tm = new TaskManager(root);
      const tasks = await tm.getAllTasks();
      const next = selectNextTask(tasks);

      const stats = {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        active: tasks.filter(t => t.status === 'active').length,
        done: tasks.filter(t => t.status === 'done').length,
        blocked: tasks.filter(t => t.status === 'blocked').length,
        review: tasks.filter(t => t.status === 'review').length,
        deferred: tasks.filter(t => t.status === 'deferred').length,
      };

      return jsonResp({ nextTask: next, stats });
    }
  );

  // 4. qflow_task_set_status - 设置任务状态（done 触发链式反应）
  if (shouldRegister("qflow_task_set_status")) server.tool(
    "qflow_task_set_status",
    "设置任务状态。当设为 done 时自动：解除阻塞的下游任务、推荐下一任务。返回更新结果和推荐的下一任务。",
    {
      taskId: z.string().describe("任务ID，如 T1 或 T1.3"),
      status: z.enum(['pending', 'active', 'done', 'blocked', 'cancelled', 'review', 'deferred']).describe("目标状态"),
      projectRoot: z.string().optional().describe("项目根目录路径"),
    },
    async ({ taskId, status, projectRoot }) => {
      const root = await resolveRoot(projectRoot);
      if (!root) return errResp("未找到 .qflow 项目");

      const tm = new TaskManager(root);
      const result = await tm.setStatus(taskId, status);

      // done 触发链式反应：自动推荐下一任务
      let nextTask = null;
      if (status === 'done') {
        const tasks = await tm.getAllTasks();
        nextTask = selectNextTask(tasks);
      }

      return jsonResp({
        updated: result.task,
        unblocked: result.unblocked,
        nextTask,
      });
    }
  );

  // 5. qflow_task_list - 列出任务（支持模糊搜索）
  if (shouldRegister("qflow_task_list")) server.tool(
    "qflow_task_list",
    "列出所有任务,支持按状态、标签过滤和模糊搜索。返回任务列表和统计信息。",
    {
      status: z.enum(['pending', 'active', 'done', 'blocked', 'cancelled', 'review', 'deferred']).optional().describe("按状态过滤"),
      tags: z.array(z.string()).optional().describe("按标签过滤"),
      query: z.string().optional().describe("模糊搜索关键词（匹配任务标题和描述）"),
      ready: z.boolean().optional().describe("仅返回可立即执行的任务（pending + 所有依赖 done），附带 reason 字段"),
      blocking: z.boolean().optional().describe("仅返回阻塞下游的瓶颈任务（有下游依赖且未 done），附带 blockedTasks 字段"),
      projectRoot: z.string().optional().describe("项目根目录路径"),
    },
    { readOnlyHint: true },
    async ({ status, tags, query, ready, blocking, projectRoot }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp("未找到 .qflow 项目");

      const tm = new TaskManager(root); // 创建任务管理器

      // ready=true 时直接调用 filterByReady()，返回带 reason 的增强结果
      if (ready) {
        const readyItems = await tm.filterByReady(); // 获取就绪任务（带 reason 字段）
        return jsonResp({
          tasks: readyItems, // 每项含 { task, reason }
          count: readyItems.length, // 就绪任务数量
          mode: 'ready', // 当前过滤模式
        });
      }

      // blocking=true 时直接调用 filterByBlocking()，返回带 blockedTasks 的增强结果
      if (blocking) {
        const blockingItems = await tm.filterByBlocking(); // 获取阻塞任务（带 blockedTasks 字段）
        return jsonResp({
          tasks: blockingItems, // 每项含 { task, blockedTasks }
          count: blockingItems.length, // 阻塞任务数量
          mode: 'blocking', // 当前过滤模式
        });
      }

      // 普通过滤模式：按状态/标签过滤
      const filter: { status?: Task['status']; tags?: string[] } = {}; // 强类型过滤条件
      if (status) filter.status = status; // 按状态过滤
      if (tags) filter.tags = tags; // 按标签过滤
      const tasks = await tm.listTasks(filter); // 执行过滤

      // 模糊搜索：当 query 参数存在时，使用 bigramSimilarity 过滤任务
      if (query) {
        const scored = tasks.map(t => {
          const text = `${t.title} ${t.description}`; // 拼接标题+描述作为搜索目标
          const score = bigramSimilarity(query, text); // 计算相似度
          return { task: t, score };
        }).filter(item => item.score > 0.2) // 保留 score > 0.2 的结果
          .sort((a, b) => b.score - a.score); // 按 score 降序排列

        return jsonResp({
          tasks: scored.map(item => item.task), // 返回任务列表
          scores: scored.map(item => ({ id: item.task.id, score: item.score })), // 返回评分
          count: scored.length,
          mode: 'fuzzy',
          query,
        });
      }

      return jsonResp({ tasks, count: tasks.length }); // 返回任务列表和数量
    }
  );

  // 6. qflow_task_expand - 拆解任务为子任务（从 standard 搬入）
  if (shouldRegister("qflow_task_expand")) server.tool(
    "qflow_task_expand",
    "将任务拆解为子任务（5 阶段模板），返回 hint 供宿主 LLM 进一步细化。",
    {
      taskId: z.string().describe("要拆解的任务ID"),
      numSubtasks: z.number().min(2).max(10).optional().describe("子任务数量，默认3"),
      research: z.boolean().optional().describe("是否在拆解前先进行 AI 研究（2 步调用）"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async ({ taskId, numSubtasks, research, projectRoot }) => {
      const root = await resolveRoot(projectRoot);
      if (!root) return errResp("未找到 .qflow 项目");

      const tm = new TaskManager(root);
      const task = await tm.getTask(taskId);
      if (!task) return errResp(`任务 ${taskId} 不存在`);

      const num = numSubtasks || 3; // 子任务数量，默认 3

      // 使用 5 阶段固定模板拆解任务（不再调用 AI）
      const phases = ['分析与设计', '核心实现', '集成与测试', '优化与文档', '验收与部署']; // 5 阶段模板
      const created = []; // 已创建子任务列表
      let prevId: string | undefined; // 前一个子任务 ID（用于链式依赖）

      log.debug(`模板拆解任务 ${taskId}: ${num} 个子任务`); // 调试日志

      for (let i = 0; i < num; i++) {
        const subTitle = `${task.title} - ${phases[i % phases.length]}`; // 阶段标题
        const subDesc = `${task.description}\n\n子任务 ${i + 1}/${num}: ${phases[i % phases.length]}`; // 阶段描述

        const sub = await tm.createTask(
          subTitle, // 子任务标题
          subDesc, // 子任务描述
          {
            priority: task.priority, // 继承父任务优先级
            tags: task.tags, // 继承父任务标签
            parentId: task.id, // 设置父任务 ID
            deps: prevId ? [prevId] : task.dependencies, // 链式依赖
          }
        );
        created.push(sub); // 记录已创建子任务
        prevId = sub.id; // 更新前一个子任务 ID
      }

      return jsonResp({
        parentTask: task, // 父任务信息
        subtasks: created, // 已创建子任务列表
        source: 'template', // 标注子任务来源为模板
        hint: `已用模板创建 ${created.length} 个子任务。你可以根据任务描述进一步细化：\n任务: ${task.title}\n描述: ${task.description || '无'}`, // 提示宿主 LLM 进一步处理
      });
    }
  );

  // 7. qflow_context_load - 加载上下文模块
  if (shouldRegister("qflow_context_load")) server.tool(
    "qflow_context_load",
    "按需加载 CLAUDE.md 上下文模块。可用模块：core, phase1, phase2, ui-constraints, context-guard, thinking-tiers, iron-rules, readme-spec, reverse。返回模块内容和 token 消耗。",
    {
      modules: z.array(z.string()).describe("要加载的模块名列表"),
    },
    { readOnlyHint: true },
    async ({ modules }) => {
      const result = await loadModules(modules);
      return jsonResp({
        loaded: result.loaded,
        totalTokens: result.totalTokens,
        content: result.content,
      });
    }
  );

  // 8. qflow_session_handoff - 会话交接摘要
  if (shouldRegister("qflow_session_handoff")) server.tool(
    "qflow_session_handoff",
    "生成会话交接摘要（包含当前进度、待办事项、关键决策）",
    {
      projectRoot: z.string().optional().describe("项目根目录（默认当前项目）"),
    },
    { readOnlyHint: true },
    async ({ projectRoot }) => {
      const root = await resolveRoot(projectRoot);
      if (!root) return errResp("未找到 .qflow 项目");

      const tm = new TaskManager(root);
      const tasks = await tm.getAllTasks();

      const done = tasks.filter(t => t.status === 'done'); // 已完成任务
      const active = tasks.filter(t => t.status === 'active'); // 进行中任务
      const blocked = tasks.filter(t => t.status === 'blocked'); // 阻塞任务
      const pending = tasks.filter(t => t.status === 'pending'); // 待处理任务

      // R5: 使用 selectNextTask 智能排序推荐下一步任务
      const nextByAlgo = selectNextTask(tasks); // 算法推荐的最优下一任务
      const pendingSorted = [nextByAlgo, ...pending.filter(t => t.id !== nextByAlgo?.id)].filter(Boolean).slice(0, 3); // 智能排序前 3

      const handoff = {
        generatedAt: new Date().toISOString(), // 生成时间
        summary: {
          total: tasks.length, // 总任务数
          done: done.length, // 已完成数
          active: active.length, // 进行中数
          blocked: blocked.length, // 阻塞数
          pending: pending.length, // 待处理数
          completionRate: tasks.length > 0 ? Math.round(done.length / tasks.length * 100) : 0, // 完成率
        },
        activeTasks: active.map(t => ({ id: t.id, title: t.title })), // 进行中任务摘要
        blockedTasks: blocked.map(t => ({ id: t.id, title: t.title, dependencies: t.dependencies })), // 阻塞任务摘要
        nextRecommended: pendingSorted.map(t => ({ id: t!.id, title: t!.title, priority: t!.priority })), // 智能推荐下一步
      };
      return jsonResp(handoff);
    }
  );

  // 9. qflow_what_next - 项目状态感知智能导航
  if (shouldRegister('qflow_what_next')) server.tool(
    'qflow_what_next',
    '项目状态感知智能导航。自动检测项目阶段（init/planning/implementing/reviewing/done），推荐下一步操作。',
    {
      projectRoot: z.string().optional().describe('项目根目录'),
    },
    { readOnlyHint: true },
    async ({ projectRoot }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录
      if (!root) return errResp('未找到 .qflow 项目');
      const { whatNext } = await import('../core/config-manager.js'); // 动态导入避免循环依赖
      const result = await whatNext(root); // 获取推荐操作
      return jsonResp(result); // 返回阶段和推荐列表
    }
  );

  // 10. qflow_parse_prd - 解析 PRD 文档（从 extra-research 搬入）
  if (shouldRegister("qflow_parse_prd")) server.tool(
    "qflow_parse_prd",
    "解析 PRD（产品需求文档）的 Markdown 内容，自动生成结构化任务列表。## 标题→任务，### 子标题→子任务。",
    {
      content: z.string().describe("PRD Markdown 内容"),
      autoCreate: z.boolean().optional().describe("是否自动创建任务，默认 false（仅预览）"),
      projectRoot: z.string().optional().describe("项目根目录"),
    },
    async ({ content, autoCreate, projectRoot }) => {
      const root = await resolveRoot(projectRoot); // 解析项目根目录

      const parsed = parsePrd(content); // 解析 PRD 内容

      if (autoCreate && !root) return errResp("autoCreate=true 时必须在 .qflow 项目中执行（未找到项目根目录）"); // R3: 明确报错
      if (autoCreate && root) { // 自动创建任务
        const tm = new TaskManager(root); // 创建任务管理器
        const created: string[] = []; // 已创建任务 ID
        let prevId: string | undefined;
        for (const item of parsed.tasks) { // 遍历解析出的顶级任务
          const task = await tm.createTask(item.title, item.description || item.title, {
            priority: 5,
            tags: [],
            deps: prevId ? [prevId] : [],
          });
          created.push(task.id);
          // 创建子任务
          for (const sub of item.subtasks || []) {
            const subtask = await tm.createTask(sub.title, sub.description || sub.title, {
              priority: 5,
              parentId: task.id,
            });
            created.push(subtask.id);
          }
          prevId = task.id;
        }
        return jsonResp({ parsed, created, createdCount: created.length });
      }

      return jsonResp({ parsed, preview: true }); // 仅预览
    }
  );

}
