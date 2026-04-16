#!/usr/bin/env node
/**
 * qflow CLI 入口
 * 命令行工具，提供任务管理、Spec 管理、项目初始化等功能
 */
import { Command } from 'commander';
import { TaskManager } from './core/task-manager.js';
import { SpecManager } from './core/spec-manager.js';
import { loadConfig, getDefaultConfig, saveConfig } from './core/config-manager.js';
import { selectNextTask } from './algorithms/next-task.js';
import { validateDependencies } from './algorithms/dependency-validator.js';
import { heuristicScore } from './algorithms/complexity-scorer.js';
import { log } from './utils/logger.js';
import { ensureDir, writeJSON, fileExists } from './utils/file-io.js';
import path from 'node:path';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module'; // 动态读取 package.json

import { TagManager } from './core/tag-manager.js';
import { ReportGenerator } from './core/report-generator.js';

const require = createRequire(import.meta.url); // 构造 CommonJS require
const pkg = require('../package.json') as { version: string }; // 读取版本号

/** task add 命令选项类型 */
interface TaskAddOpts {
  desc?: string;       // 任务描述
  priority?: string;   // 优先级 1-10
  deps?: string;       // 依赖任务ID，逗号分隔
  tags?: string;       // 标签，逗号分隔
  parent?: string;     // 父任务ID
  aiScore?: boolean;   // 是否使用 AI 评分
}

/** task list 命令选项类型 */
interface TaskListOpts {
  status?: string;     // 按状态过滤
  tags?: string;       // 按标签过滤
}

/** task expand 命令选项类型 */
interface TaskExpandOpts {
  num?: string;        // 子任务数量
}

/** spec init 命令选项类型 */
interface SpecInitOpts {
  type?: 'architecture' | 'api' | 'ui' | 'data' | 'algorithm'; // Spec 类型（枚举）
  desc?: string;       // 描述
}

const program = new Command();

program
  .name('qflow')
  .description('Claude Code 自动化工具链')
  .version(pkg.version) // 从 package.json 动态读取版本号
  .option('--json', 'JSON 格式输出（机器可读）', false) // v7.0 全局 JSON 输出标志
  .option('--compact', '精简单行输出模式', false); // P7-P2-3: 全局 compact 输出标志

// ==================== init 命令 ====================
program
  .command('init [projectRoot]')
  .description('初始化项目 qflow 配置')
  .option('-n, --name <name>', '项目名称')
  .action(async (projectRoot?: string, opts?: { name?: string }) => {
    const root = path.resolve(projectRoot || process.cwd());
    const qflowDir = path.join(root, '.qflow');

    if (await fileExists(path.join(qflowDir, 'qflow.config.json'))) {
      log.warn('项目已初始化，跳过');
      return;
    }

    // 创建目录结构
    await ensureDir(qflowDir);
    await ensureDir(path.join(qflowDir, 'specs'));
    await ensureDir(path.join(qflowDir, 'changes', 'pending'));
    await ensureDir(path.join(qflowDir, 'changes', 'applied'));
    await ensureDir(path.join(qflowDir, 'changes', 'archived'));

    // 写入默认配置
    const config = getDefaultConfig(root, opts?.name || path.basename(root));
    await saveConfig(root, config);

    // 写入空 tasks.json
    await writeJSON(path.join(qflowDir, 'tasks.json'), { version: 1, tasks: [], lastId: 0 });

    log.success(`项目初始化完成: ${qflowDir}`);

    // 安装 slash 命令
    await installSlashCommands();
  });

// ==================== task 命令组 ====================
const taskCmd = program.command('task').description('任务管理');

taskCmd
  .command('add <title>')
  .description('创建新任务')
  .option('-d, --desc <description>', '任务描述', '')
  .option('-p, --priority <n>', '优先级 1-10', '5')
  .option('--deps <ids>', '依赖任务ID，逗号分隔')
  .option('--tags <tags>', '标签，逗号分隔')
  .option('--parent <id>', '父任务ID')
  .option('--ai-score', '使用 AI 评分复杂度')
  .action(async (title: string, opts: TaskAddOpts) => { // 使用强类型替代 any
    const root = await findProjectRoot();
    if (!root) return;
    const tm = new TaskManager(root);
    const task = await tm.createTask(title, opts.desc || title, {
      priority: parseInt(opts.priority ?? '5') || 5,
      deps: opts.deps ? opts.deps.split(',') : [],
      tags: opts.tags ? opts.tags.split(',') : [],
      parentId: opts.parent,
    });

    // 启发式评分
    const score = heuristicScore(task);
    task.complexityScore = score.score;
    task.expansionPrompt = score.expansionPrompt;
    const data = await tm.load();
    const idx = data.tasks.findIndex(t => t.id === task.id);
    if (idx >= 0) data.tasks[idx] = task;
    await tm.save(data);

    log.success(`任务已创建: ${task.id} - ${task.title}`);
    log.info(`复杂度评分: ${score.score}/10 | ${score.reasoning}`);
    if (score.suggestedSubtasks > 0) {
      log.info(`建议拆分为 ${score.suggestedSubtasks} 个子任务，使用 qflow task expand ${task.id}`);
    }
  });

taskCmd
  .command('list')
  .description('列出所有任务')
  .option('-s, --status <status>', '按状态过滤')
  .option('--tags <tags>', '按标签过滤')
  .action(async (opts: TaskListOpts) => { // 使用强类型替代 any
    const root = await findProjectRoot();
    if (!root) return;
    const tm = new TaskManager(root);
    const filter: { status?: 'pending' | 'active' | 'done' | 'blocked' | 'cancelled' | 'review' | 'deferred'; tags?: string[] } = {}; // 精确过滤条件类型
    if (opts.status) filter.status = opts.status as typeof filter.status; // CLI 输入强转为合法状态枚举
    if (opts.tags) filter.tags = opts.tags.split(',');
    const tasks = await tm.listTasks(filter);

    if (isJsonMode()) { console.log(JSON.stringify(tasks)); return; } // JSON 模式直接输出原始数据

    if (tasks.length === 0) {
      log.info('暂无任务');
      return;
    }

    // P7-P2-3: compact 模式输出单行格式 ID STATUS TITLE
    if (isCompactMode()) {
      for (const t of tasks) {
        console.log(`${t.id} ${t.status.toUpperCase()} ${t.title}`); // 精简单行格式
      }
      console.log(`# ${tasks.length} tasks`); // 简短统计
      return;
    }

    const statusIcon: Record<string, string> = {
      pending: '⬜', active: '🔵', done: '✅', blocked: '🔴', cancelled: '⚫'
    };
    for (const t of tasks) {
      const icon = statusIcon[t.status] || '⬜';
      const deps = t.dependencies.length > 0 ? ` [deps: ${t.dependencies.join(',')}]` : '';
      const score = t.complexityScore ? ` (C:${t.complexityScore})` : '';
      console.log(`  ${icon} ${t.id} [P${t.priority}]${score} ${t.title}${deps}`);
    }
    console.log(`\n  共 ${tasks.length} 个任务`);
  });

taskCmd
  .command('next')
  .description('获取下一个推荐任务')
  .action(async () => {
    const root = await findProjectRoot();
    if (!root) return;
    const tm = new TaskManager(root);
    const tasks = await tm.getAllTasks();
    const next = selectNextTask(tasks);

    if (isJsonMode()) { console.log(JSON.stringify(next || { message: '没有可执行的任务' })); return; } // JSON 模式直接输出推荐任务

    if (!next) {
      log.info('没有可执行的任务');
      return;
    }

    log.success(`推荐任务: ${next.id} - ${next.title}`);
    log.info(`优先级: ${next.priority} | 状态: ${next.status} | 依赖: ${next.dependencies.join(',') || '无'}`);
    if (next.description) log.info(`描述: ${next.description}`);
  });

taskCmd
  .command('done <id>')
  .description('完成任务')
  .action(async (id: string) => {
    const root = await findProjectRoot();
    if (!root) return;
    const tm = new TaskManager(root);
    const result = await tm.setStatus(id, 'done');

    log.success(`任务 ${id} 已完成`);
    if (result.unblocked.length > 0) {
      log.info(`已解除阻塞: ${result.unblocked.join(', ')}`);
    }

    // 自动推荐下一任务
    const tasks = await tm.getAllTasks();
    const next = selectNextTask(tasks);
    if (next) {
      log.info(`\n推荐下一任务: ${next.id} - ${next.title}`);
    } else {
      log.info('所有任务已完成！');
    }
  });

taskCmd
  .command('expand <id>')
  .description('拆解任务为子任务')
  .option('-n, --num <n>', '子任务数量', '3')
  .action(async (id: string, opts: TaskExpandOpts) => { // 使用强类型替代 any
    const root = await findProjectRoot();
    if (!root) return;
    const tm = new TaskManager(root);
    const task = await tm.getTask(id);
    if (!task) {
      log.error(`任务 ${id} 不存在`);
      return;
    }

    const numSubs = parseInt(opts.num ?? '3') || 3; // 默认拆分为3个子任务
    log.info(`为任务 ${id} 生成 ${numSubs} 个子任务...`);

    // 基于描述生成子任务（简单拆分）
    const subtaskTitles = generateSubtaskTitles(task.title, task.description, numSubs);
    const created: string[] = [];
    let prevId: string | undefined;

    for (let i = 0; i < subtaskTitles.length; i++) {
      const sub = await tm.createTask(subtaskTitles[i], `${task.title} - 子任务 ${i + 1}`, {
        priority: task.priority,
        tags: task.tags,
        parentId: task.id,
        deps: prevId ? [prevId] : task.dependencies,
      });
      created.push(sub.id);
      prevId = sub.id;
    }

    log.success(`已生成 ${created.length} 个子任务: ${created.join(', ')}`);
  });

taskCmd
  .command('deps-validate')
  .description('验证任务依赖图')
  .action(async () => {
    const root = await findProjectRoot();
    if (!root) return;
    const tm = new TaskManager(root);
    const tasks = await tm.getAllTasks();
    const result = validateDependencies(tasks);

    if (result.valid) {
      log.success('依赖图验证通过，无环形依赖');
    } else {
      log.error(`检测到 ${result.cycles.length} 个环形依赖`);
      for (const suggestion of result.suggestions) {
        log.warn(suggestion);
      }
    }
  });

// ==================== spec 命令组 ====================
const specCmd = program.command('spec').description('Spec 文档管理');

specCmd
  .command('init <name>')
  .description('初始化 Spec')
  .option('-t, --type <type>', 'Spec 类型', 'architecture')
  .option('-d, --desc <description>', '描述', '')
  .action(async (name: string, opts: SpecInitOpts) => { // 使用强类型替代 any
    const root = await findProjectRoot();
    if (!root) return;
    const sm = new SpecManager(root);
    const spec = await sm.initSpec(name, opts.type ?? 'architecture', opts.desc || name); // 带默认值防御
    log.success(`Spec 已创建: ${spec.id}`);
  });

specCmd
  .command('status')
  .description('查看 Spec 状态')
  .action(async () => {
    const root = await findProjectRoot();
    if (!root) return;
    const sm = new SpecManager(root);
    const status = await sm.getStatus();
    log.info(`Specs: ${status.specs} | 待处理变更: ${status.pendingChanges} | 已应用: ${status.appliedChanges}`);

    const specs = await sm.listSpecs();
    for (const s of specs) {
      console.log(`  ${s.status === 'done' ? '✅' : '⬜'} ${s.id} [${s.type}] ${s.name}`);
    }
  });

specCmd
  .command('verify <specId>')
  .description('验证 Spec 完整性')
  .action(async (specId: string) => {
    const root = await findProjectRoot();
    if (!root) return;
    const sm = new SpecManager(root);
    const result = await sm.verify(specId);
    log.info(`完整性: ${result.completeness}% | 正确性: ${result.correctness}% | 一致性: ${result.consistency}%`);
  });

// ==================== install/uninstall ====================

// ==================== tag 命令组（v4.0 新增）====================
const tagCmd = program.command('tag').description('标签管理');

tagCmd
  .command('add <taskIds> <tags>')
  .description('为任务添加标签（逗号分隔）')
  .action(async (taskIds: string, tags: string) => {
    const root = await findProjectRoot();
    if (!root) return;
    const tagMgr = new TagManager(root);
    const result = await tagMgr.batchAddTags(taskIds.split(','), tags.split(','));
    log.success(`标签已添加，更新了 ${result.length} 个任务`);
  });

tagCmd
  .command('remove <taskIds> <tags>')
  .description('从任务移除标签（逗号分隔）')
  .action(async (taskIds: string, tags: string) => {
    const root = await findProjectRoot();
    if (!root) return;
    const tagMgr = new TagManager(root);
    const result = await tagMgr.batchRemoveTags(taskIds.split(','), tags.split(','));
    log.success(`标签已移除，更新了 ${result.length} 个任务`);
  });

tagCmd
  .command('list')
  .description('列出所有标签及统计')
  .action(async () => {
    const root = await findProjectRoot();
    if (!root) return;
    const tagMgr = new TagManager(root);
    const stats = await tagMgr.getTagStats();
    if (stats.size === 0) {
      log.info('暂无标签');
      return;
    }
    for (const [tag, count] of stats) {
      console.log(`  🏷️  ${tag}: ${count} 个任务`);
    }
    console.log(`\n  共 ${stats.size} 个标签`);
  });

tagCmd
  .command('filter <tags>')
  .description('按标签搜索任务')
  .option('-m, --mode <mode>', '匹配模式 and/or', 'or')
  .action(async (tags: string, opts: { mode?: string }) => {
    const root = await findProjectRoot();
    if (!root) return;
    const tagMgr = new TagManager(root);
    const tasks = await tagMgr.filterByTags(tags.split(','), (opts.mode || 'or') as 'and' | 'or');
    if (tasks.length === 0) {
      log.info('无匹配任务');
      return;
    }
    for (const t of tasks) {
      console.log(`  ${t.id} [P${t.priority}] ${t.title} [${t.tags.join(',')}]`);
    }
    console.log(`\n  匹配 ${tasks.length} 个任务`);
  });

// ==================== report 命令组（v4.0 新增）====================
const reportCmd = program.command('report').description('报告生成');

reportCmd
  .command('progress')
  .description('生成进度报告')
  .action(async () => {
    const root = await findProjectRoot();
    if (!root) return;
    const reporter = new ReportGenerator(root);
    const report = await reporter.generateProgressReport();
    if (isJsonMode()) { console.log(JSON.stringify(report)); return; } // JSON 模式直接输出进度报告
    console.log(`\n  📊 进度报告`);
    console.log(`  总任务数: ${report.totalTasks}`);
    console.log(`  完成率: ${report.completionRate}%`);
    console.log(`  状态分布:`);
    for (const [status, count] of Object.entries(report.statusBreakdown)) {
      console.log(`    ${status}: ${count}`);
    }
    if (report.blockedTasks.length > 0) {
      console.log(`  阻塞任务 (${report.blockedTasks.length}):`);
      for (const bt of report.blockedTasks) {
        console.log(`    🔴 ${bt.id} ${bt.title} [blocked by: ${bt.blockedBy.join(',')}]`);
      }
    }
  });

reportCmd
  .command('complexity')
  .description('生成复杂度报告')
  .action(async () => {
    const root = await findProjectRoot();
    if (!root) return;
    const reporter = new ReportGenerator(root);
    const report = await reporter.generateComplexityReport();
    if (isJsonMode()) { console.log(JSON.stringify(report)); return; } // JSON 模式直接输出复杂度报告
    console.log(`\n  🧠 复杂度报告`);
    console.log(`  已评分: ${report.totalScored} | 平均: ${report.averageScore}`);
    console.log(`  分布: 低=${report.distribution.low} 中=${report.distribution.medium} 高=${report.distribution.high}`);
    if (report.suggestExpand.length > 0) {
      console.log(`  建议拆解:`);
      for (const se of report.suggestExpand) {
        console.log(`    ⚠️  ${se.id} (C:${se.score}) → 建议拆为 ${se.suggestedSubtasks} 个子任务`);
      }
    }
  });

program
  .command('install')
  .description('安装 qflow 到 Claude Code')
  .action(async () => {
    await installMCP();
    await installSlashCommands();
    log.success('qflow 安装完成');
  });

program
  .command('uninstall')
  .description('从 Claude Code 卸载 qflow')
  .action(async () => {
    await uninstallMCP();
    await uninstallSlashCommands();
    log.success('qflow 已卸载');
  });

// ==================== 辅助函数 ====================

/** 检查是否启用 JSON 输出模式 */
function isJsonMode(): boolean {
  return program.opts().json === true; // 读取全局 --json 标志
}

/** 检查是否启用 compact 精简输出模式（P7-P2-3） */
function isCompactMode(): boolean {
  return program.opts().compact === true; // 读取全局 --compact 标志
}

async function findProjectRoot(): Promise<string | null> {
  // 向上查找 .qflow 目录
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (await fileExists(path.join(dir, '.qflow', 'qflow.config.json'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  log.error('未找到 .qflow 项目，请先运行 qflow init');
  return null;
}

function generateSubtaskTitles(title: string, desc: string, num: number): string[] {
  // 简单拆分策略：基于标题生成序号子任务
  const titles: string[] = [];
  const phases = ['分析与设计', '核心实现', '集成与测试', '优化与文档', '验收与部署'];
  for (let i = 0; i < num; i++) {
    const phase = phases[i % phases.length];
    titles.push(`${title} - ${phase}`);
  }
  return titles;
}

async function installMCP(): Promise<void> {
  const claudeJsonPath = path.join(os.homedir(), '.claude.json');
  let config: Record<string, unknown> = {}; // 默认空配置，强类型替代 any
  try {
    const content = await fs.readFile(claudeJsonPath, 'utf-8'); // 读取已有配置
    config = JSON.parse(content); // 解析 JSON
  } catch (e) {
    log.info(`~/.claude.json 不存在或解析失败 (${(e as Error).message})，将创建新文件`); // 新电脑或文件损坏场景
  }

  if (!config.mcpServers) config.mcpServers = {}; // 确保 mcpServers 存在
  const servers = config.mcpServers as Record<string, unknown>; // 类型断言为可索引对象
  servers.qflow = {
    command: 'node',
    args: [path.join(os.homedir(), '.claude', 'tools', 'qflow', 'dist', 'mcp.js')],
  };

  await fs.writeFile(claudeJsonPath, JSON.stringify(config, null, 2));
  log.success('MCP 服务器已注册到 ~/.claude.json');
}

async function uninstallMCP(): Promise<void> {
  const claudeJsonPath = path.join(os.homedir(), '.claude.json');
  try {
    const content = await fs.readFile(claudeJsonPath, 'utf-8');
    const config = JSON.parse(content);
    if (config.mcpServers?.qflow) {
      delete config.mcpServers.qflow;
      await fs.writeFile(claudeJsonPath, JSON.stringify(config, null, 2));
      log.success('MCP 服务器已从 ~/.claude.json 移除');
    }
  } catch (e) {
    log.info(`~/.claude.json 不存在或解析失败 (${(e as Error).message})，无需卸载 MCP`); // 文件不存在时静默跳过
  }
}

async function installSlashCommands(): Promise<void> {
  const commandsDir = path.join(os.homedir(), '.claude', 'commands');
  const currentFile = fileURLToPath(import.meta.url); // 当前文件路径（dist/cli.js）
  const projectRoot = path.resolve(path.dirname(currentFile), '..'); // 向上一级到项目根
  const templatesDir = path.join(projectRoot, 'src', 'templates'); // 优先 src/templates
  const distTemplatesDir = path.join(projectRoot, 'dist', 'templates'); // 备选 dist/templates（仅部署 dist/ 时）
  const actualTemplatesDir = await fileExists(templatesDir) ? templatesDir : distTemplatesDir; // 动态选择
  await ensureDir(commandsDir);

  try {
    const files = await fs.readdir(actualTemplatesDir);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const src = path.join(actualTemplatesDir, file);
        const dst = path.join(commandsDir, file);
        await fs.copyFile(src, dst);
      }
    }
    log.success(`Slash 命令已安装到 ${commandsDir}`);
  } catch (e) {
    log.warn(`Slash 命令安装跳过: ${e}`);
  }
}

async function uninstallSlashCommands(): Promise<void> {
  const commandsDir = path.join(os.homedir(), '.claude', 'commands');
  try {
    const files = await fs.readdir(commandsDir);
    for (const file of files) {
      if (file.startsWith('qf-') && file.endsWith('.md')) {
        await fs.unlink(path.join(commandsDir, file));
      }
    }
    log.success('Slash 命令已移除');
  } catch (e) {
    log.warn(`Slash 命令移除跳过: ${e}`);
  }
}

// ==================== generate 命令（v10.0 新增）====================
program
  .command('generate [projectRoot]')
  .description('导出任务为独立 .md 文件')
  .option('-o, --output <dir>', '输出目录', '.qflow/generated')
  .action(async (projectRoot?: string, opts?: { output?: string }) => {
    const root = projectRoot ? path.resolve(projectRoot) : await findProjectRoot();
    if (!root) return;
    const tm = new TaskManager(root);
    const outputDir = path.resolve(root, opts?.output || '.qflow/generated'); // 输出目录
    const result = await tm.generateTaskFiles(outputDir);
    log.success(`已导出 ${result.count} 个任务文件到 ${outputDir}`);
    for (const f of result.files) {
      console.log(`  📄 ${f}`);
    }
  });

// 解析并执行命令
program.parse();
