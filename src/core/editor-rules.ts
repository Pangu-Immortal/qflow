/**
 * 编辑器规则管理器（v11.0）
 *
 * 为主流编辑器安装 qflow 工作规则文件。
 * 支持 13 种编辑器: Cursor / VS Code / Windsurf / Roo / Cline / Kiro / Zed / Kilo / Trae / Gemini / OpenCode / Codex / JetBrains。
 *
 * 函数列表:
 * - listSupportedEditors() 列出支持的编辑器
 * - installEditorRules()   安装规则文件到项目根目录
 * - getEditorRulesContent() 获取规则文件内容
 */

import { promises as fs } from 'node:fs'; // 异步文件操作
import path from 'node:path'; // 路径拼接
import { ensureDir, fileExists } from '../utils/file-io.js'; // 文件工具
import { log } from '../utils/logger.js'; // 日志工具

/** 编辑器类型（v11.0: 支持 13 种编辑器） */
export type EditorType =
  | 'cursor'     // Cursor
  | 'vscode'     // VS Code
  | 'windsurf'   // Windsurf
  | 'roo'        // Roo
  | 'cline'      // Cline
  | 'kiro'       // Kiro
  | 'zed'        // Zed
  | 'kilo'       // Kilo
  | 'trae'       // Trae
  | 'gemini'     // Gemini
  | 'opencode'   // OpenCode
  | 'codex'      // Codex
  | 'jetbrains'; // JetBrains

/** 编辑器规则配置 */
interface EditorRuleConfig {
  name: string;       // 编辑器名称
  fileName: string;   // 规则文件名
  dirName?: string;   // 规则目录名（可选）
}

/** 编辑器配置映射（v11.0: 13 种编辑器） */
const EDITOR_CONFIGS: Record<EditorType, EditorRuleConfig> = {
  cursor: { name: 'Cursor', fileName: '.cursorrules' }, // Cursor 规则文件
  vscode: { name: 'VS Code', fileName: 'rules.md', dirName: '.vscode' }, // VS Code 在 .vscode/ 目录下
  windsurf: { name: 'Windsurf', fileName: '.windsurfrules' }, // Windsurf 规则文件
  roo: { name: 'Roo', fileName: '.roorules' }, // Roo 规则文件
  cline: { name: 'Cline', fileName: '.clinerules' }, // Cline 规则文件
  kiro: { name: 'Kiro', fileName: '.kirorules', dirName: '.kiro' }, // Kiro 在 .kiro/ 目录下
  zed: { name: 'Zed', fileName: 'rules.md', dirName: '.zed' }, // Zed 在 .zed/ 目录下
  kilo: { name: 'Kilo', fileName: '.kilorules' }, // Kilo 规则文件
  trae: { name: 'Trae', fileName: '.traerules' }, // Trae 规则文件
  gemini: { name: 'Gemini', fileName: '.gemini', dirName: '.gemini' }, // Gemini 在 .gemini/ 目录下
  opencode: { name: 'OpenCode', fileName: '.opencoderules' }, // OpenCode 规则文件
  codex: { name: 'Codex', fileName: 'AGENTS.md' }, // Codex 使用 AGENTS.md
  jetbrains: { name: 'JetBrains', fileName: 'qflow.md', dirName: '.junie' }, // JetBrains 在 .junie/ 目录下
};

/**
 * 列出支持的编辑器
 * @returns 编辑器名称列表
 */
export function listSupportedEditors(): Array<{ id: EditorType; name: string; fileName: string }> {
  return Object.entries(EDITOR_CONFIGS).map(([id, config]) => ({
    id: id as EditorType,
    name: config.name,
    fileName: config.dirName ? `${config.dirName}/${config.fileName}` : config.fileName,
  }));
}

/**
 * 获取 qflow 规则文件内容
 * @returns 通用的 qflow 工作规则 Markdown 内容
 */
function getEditorRulesContent(): string {
  return `# qflow 工作规则

## 任务管理
- 使用 qflow MCP 工具管理任务生命周期
- 任务状态流转: pending → active → done
- 复杂任务（复杂度 >= 7）应先拆解为子任务
- 每次完成任务后调用 qflow_task_set_status 标记完成

## Spec 驱动开发
- 功能设计先写 Spec（qflow_spec_init）
- 变更通过 Delta 提议（qflow_spec_propose）→ 应用（qflow_spec_apply）
- 定期验证 Spec 质量（qflow_spec_verify）

## 上下文管理
- 使用 qflow_context_load 按需加载上下文模块
- 使用 qflow_session_handoff 生成会话交接摘要
- 上下文压缩时优先使用 moderate 策略

## 最佳实践
- 每个任务关联相关文件（relevantFiles）
- 使用标签（tags）组织任务分组
- 定期生成进度报告（qflow_report_progress）
- 研究成果持久化（qflow_save_research）
`;
}

/**
 * 自动检测项目中使用的编辑器
 *
 * 按优先级检查项目根目录下的编辑器标记目录：
 * cursor > vscode > windsurf。找到即返回对应编辑器类型。
 *
 * @param projectRoot - 项目根目录
 * @returns 检测到的编辑器类型，未检测到返回 null
 */
export async function detectEditor(projectRoot: string): Promise<EditorType | null> {
  // v13.0 D-1: 按优先级排序的编辑器检测规则（支持全部 13 种编辑器）
  const detectionRules: Array<{ path: string; isDir: boolean; editor: EditorType }> = [
    { path: '.cursor', isDir: true, editor: 'cursor' },           // Cursor
    { path: '.vscode', isDir: true, editor: 'vscode' },           // VS Code
    { path: '.windsurf', isDir: true, editor: 'windsurf' },       // Windsurf
    { path: '.roorules', isDir: false, editor: 'roo' },           // Roo
    { path: '.clinerules', isDir: false, editor: 'cline' },       // Cline
    { path: '.kiro', isDir: true, editor: 'kiro' },               // Kiro
    { path: '.zed', isDir: true, editor: 'zed' },                 // Zed
    { path: '.kilorules', isDir: false, editor: 'kilo' },         // Kilo
    { path: '.traerules', isDir: false, editor: 'trae' },         // Trae
    { path: '.gemini', isDir: true, editor: 'gemini' },           // Gemini CLI
    { path: '.opencoderules', isDir: false, editor: 'opencode' }, // OpenCode
    { path: 'AGENTS.md', isDir: false, editor: 'codex' },         // Codex CLI
    { path: '.junie', isDir: true, editor: 'jetbrains' },         // JetBrains Junie
  ];

  for (const rule of detectionRules) { // 按优先级遍历
    if (await fileExists(path.join(projectRoot, rule.path))) { // 检测到标记
      log.info(`自动检测到编辑器: ${rule.editor}（发现 ${rule.path}）`); // 信息日志
      return rule.editor; // 返回检测到的编辑器
    }
  }

  return null; // 未检测到任何编辑器
}

/**
 * 安装编辑器规则文件
 *
 * 当 editor 参数未提供时，自动检测项目中使用的编辑器。
 *
 * @param projectRoot - 项目根目录
 * @param editor      - 编辑器类型（可选，未提供时自动检测）
 * @param force       - 是否强制覆盖已有文件
 * @returns 安装结果
 */
export async function installEditorRules(
  projectRoot: string,
  editor?: EditorType,
  force = false,
): Promise<{ installed: boolean; path: string; message: string }> {
  // 未指定编辑器时自动检测
  if (!editor) {
    const detected = await detectEditor(projectRoot); // 自动检测编辑器
    if (!detected) { // 未检测到任何编辑器
      return { installed: false, path: '', message: '未指定编辑器且自动检测失败（未发现 .cursor/.vscode/.windsurf 目录），请手动指定 editor 参数' };
    }
    editor = detected; // 使用检测到的编辑器
  }

  const config = EDITOR_CONFIGS[editor]; // 获取编辑器配置
  if (!config) { // 不支持的编辑器
    return { installed: false, path: '', message: `不支持的编辑器: ${editor}` };
  }

  // 确定规则文件路径
  let rulePath: string;
  if (config.dirName) { // 有目录名（如 VS Code）
    const dirPath = path.join(projectRoot, config.dirName); // 目录路径
    await ensureDir(dirPath); // 确保目录存在
    rulePath = path.join(dirPath, config.fileName); // 完整路径
  } else {
    rulePath = path.join(projectRoot, config.fileName); // 根目录下的文件
  }

  // 检查是否已存在
  if (await fileExists(rulePath) && !force) { // 已存在且不强制覆盖
    return { installed: false, path: rulePath, message: `${config.name} 规则文件已存在: ${rulePath}，使用 force=true 覆盖` };
  }

  // 写入规则内容
  const content = getEditorRulesContent(); // 获取规则内容
  await fs.writeFile(rulePath, content, 'utf-8'); // 写入文件
  log.info(`${config.name} 规则文件已安装: ${rulePath}`); // 信息日志

  return { installed: true, path: rulePath, message: `${config.name} 规则文件已安装到 ${rulePath}` };
}

/**
 * v13.0 D-2: 按编辑器类型生成对应的 Skills 文件
 *
 * 将 qflow 工作规则生成到编辑器对应的 Skills 目录中。
 * 支持全部 13 种编辑器。
 *
 * @param projectRoot - 项目根目录
 * @param editor      - 编辑器类型（可选，未提供时自动检测）
 * @returns 生成结果
 */
export async function generateEditorSkills(
  projectRoot: string,
  editor?: EditorType,
): Promise<{ generated: boolean; path: string; editor: string; message: string }> {
  // 未指定编辑器时自动检测
  if (!editor) {
    const detected = await detectEditor(projectRoot); // 自动检测
    if (!detected) {
      return { generated: false, path: '', editor: 'unknown', message: '未指定编辑器且自动检测失败，请手动指定 editor 参数' };
    }
    editor = detected; // 使用检测到的编辑器
  }

  const config = EDITOR_CONFIGS[editor]; // 获取编辑器配置
  if (!config) return { generated: false, path: '', editor: editor, message: `不支持的编辑器: ${editor}` };

  // 确定 Skills 文件路径
  const skillsFileName = 'qflow-skills.md'; // Skills 文件名
  let skillsDir: string; // Skills 目录
  if (config.dirName) { // 有独立目录
    skillsDir = path.join(projectRoot, config.dirName); // 使用编辑器目录
  } else {
    skillsDir = projectRoot; // 根目录
  }
  await ensureDir(skillsDir); // 确保目录存在
  const skillsPath = path.join(skillsDir, skillsFileName); // 完整路径

  // 生成 Skills 内容（比 rules 更详细，包含工具推荐和工作流指引）
  const content = `# qflow Skills - ${config.name} 工作指引

## 核心工作流

### 1. 开始新任务
\`\`\`
qflow_task_next → 获取推荐任务
qflow_task_set_status(taskId, "active") → 激活任务
\`\`\`

### 2. Spec 驱动开发
\`\`\`
qflow_spec_init(name, type, description) → 创建 Spec
qflow_spec_propose(specId, changes) → 提议变更
qflow_spec_apply(changeId) → 应用变更
qflow_spec_verify(specId) → 验证质量
\`\`\`

### 3. 任务管理
\`\`\`
qflow_task_create(title, description) → 创建任务
qflow_task_expand(taskId) → 拆解子任务
qflow_task_set_status(taskId, "done") → 标记完成
qflow_report_progress → 生成进度报告
\`\`\`

### 4. 上下文管理
\`\`\`
qflow_context_load(["core"]) → 加载上下文
qflow_session_handoff → 会话交接
qflow_context_compress → 压缩上下文
\`\`\`

### 5. 研究与分析
\`\`\`
qflow_research(query) → AI 研究
qflow_save_research(taskId, content) → 持久化研究
qflow_complexity_score(taskId) → 评估复杂度
\`\`\`

## 最佳实践
- 复杂度 >= 7 的任务先拆解再执行
- 每次完成任务后检查进度报告
- 定期使用 qflow_spec_verify 验证 Spec 质量
- 使用标签组织任务分组
`;

  await fs.writeFile(skillsPath, content, 'utf-8'); // 写入 Skills 文件
  log.info(`${config.name} Skills 文件已生成: ${skillsPath}`);

  return { generated: true, path: skillsPath, editor: config.name, message: `${config.name} Skills 文件已生成到 ${skillsPath}` };
}
