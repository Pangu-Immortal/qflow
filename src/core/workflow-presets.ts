/**
 * Agile 工作流预设 - 4 阶段 × 子步骤
 *
 * 将 Analysis→Planning→Solutioning→Implementation 四阶段封装为预设工作流。
 * 每个阶段包含多个子步骤，可逐步引导用户完成完整的敏捷开发流程。
 *
 * 函数列表:
 * - listAgileWorkflows()       列出所有预设工作流（v21.0 P3-13）
 * - getWorkflowByPhase()       获取指定阶段工作流（v21.0 P3-12）
 * - executeWorkflowStep()      执行工作流步骤（v21.0 P3-14）
 */

import { log } from '../utils/logger.js'; // 日志工具

/** 工作流步骤定义 */
export interface WorkflowStep {
  index: number;        // 步骤序号（从 0 开始）
  title: string;        // 步骤标题
  description: string;  // 步骤描述
  tool: string;         // 推荐执行的 MCP 工具名
  required: boolean;    // 是否必选步骤
}

/** 工作流阶段定义 */
export interface AgileWorkflow {
  id: string;           // 工作流唯一 ID
  phase: string;        // 阶段名称
  title: string;        // 阶段标题
  description: string;  // 阶段描述
  steps: WorkflowStep[]; // 步骤列表
}

/** 工作流执行结果 */
export interface WorkflowStepResult {
  workflowId: string;   // 工作流 ID
  stepIndex: number;    // 执行的步骤序号
  step: WorkflowStep;   // 步骤详情
  nextStep: WorkflowStep | null; // 下一步骤（null 表示当前阶段结束）
  progress: string;     // 进度百分比（如 "25%"）
}

/**
 * v21.0 P3-11: AGILE_WORKFLOWS 预设定义（4 阶段 × 子步骤）
 *
 * 阶段：Analysis → Planning → Solutioning → Implementation
 */
export const AGILE_WORKFLOWS: AgileWorkflow[] = [
  {
    id: 'agile-analysis',
    phase: 'analysis',
    title: '需求分析阶段',
    description: '理解需求、拆解目标、识别约束和风险',
    steps: [
      { index: 0, title: '需求收集', description: '从 PRD 或用户描述中提取需求', tool: 'qflow_parse_prd', required: true },
      { index: 1, title: '复杂度评估', description: '评估各需求的技术复杂度', tool: 'qflow_complexity_score', required: true },
      { index: 2, title: '风险识别', description: '识别潜在技术风险和依赖', tool: 'qflow_research', required: false },
      { index: 3, title: '需求优先级排序', description: '按价值和复杂度排列优先级', tool: 'qflow_task_batch_update', required: true },
    ],
  },
  {
    id: 'agile-planning',
    phase: 'planning',
    title: '规划阶段',
    description: '创建任务、建立依赖、分配资源',
    steps: [
      { index: 0, title: '任务创建', description: '将需求拆解为可执行的任务', tool: 'qflow_task_create', required: true },
      { index: 1, title: '任务拆解', description: '将复杂任务拆解为子任务', tool: 'qflow_task_expand', required: true },
      { index: 2, title: '依赖建立', description: '设置任务间的依赖关系', tool: 'qflow_add_dependency', required: true },
      { index: 3, title: '依赖验证', description: '验证依赖图无环形依赖', tool: 'qflow_task_deps_validate', required: true },
      { index: 4, title: '关键路径分析', description: '识别项目瓶颈路径', tool: 'qflow_deps_critical_path', required: false },
    ],
  },
  {
    id: 'agile-solutioning',
    phase: 'solutioning',
    title: '方案设计阶段',
    description: '创建 Spec 文档、设计架构、审查方案',
    steps: [
      { index: 0, title: 'Spec 创建', description: '为关键模块创建规格文档', tool: 'qflow_spec_init', required: true },
      { index: 1, title: '方案研究', description: '研究技术方案和最佳实践', tool: 'qflow_research', required: false },
      { index: 2, title: 'Spec 验证', description: '验证 Spec 完整性和正确性', tool: 'qflow_spec_verify', required: true },
      { index: 3, title: '方案审查', description: '执行对抗性审查发现潜在问题', tool: 'qflow_parallel_review', required: false },
    ],
  },
  {
    id: 'agile-implementation',
    phase: 'implementation',
    title: '实现阶段',
    description: '执行任务、跟踪进度、验收交付',
    steps: [
      { index: 0, title: '任务启动', description: '获取下一任务并启动执行', tool: 'qflow_task_start', required: true },
      { index: 1, title: '进度跟踪', description: '更新任务状态和进度', tool: 'qflow_task_set_status', required: true },
      { index: 2, title: '进度报告', description: '生成项目进度报告', tool: 'qflow_report_progress', required: true },
      { index: 3, title: '验收审查', description: '执行验收标准核查', tool: 'qflow_acceptance_audit', required: false },
      { index: 4, title: '会话交接', description: '生成交接摘要', tool: 'qflow_session_handoff', required: false },
    ],
  },
];

/**
 * v21.0 P3-13: 列出所有预设 Agile 工作流
 *
 * @returns 工作流列表（含阶段名、标题、步骤数）
 */
export function listAgileWorkflows(): Array<{ id: string; phase: string; title: string; description: string; stepCount: number }> {
  const result = AGILE_WORKFLOWS.map(wf => ({
    id: wf.id, // 工作流 ID
    phase: wf.phase, // 阶段名
    title: wf.title, // 标题
    description: wf.description, // 描述
    stepCount: wf.steps.length, // 步骤数
  }));
  log.debug(`listAgileWorkflows: 返回 ${result.length} 个工作流`); // 调试日志
  return result; // 返回列表
}

/**
 * v21.0 P3-12: 获取指定阶段的工作流
 *
 * @param phase - 阶段名称（analysis/planning/solutioning/implementation）
 * @returns 匹配的工作流，未找到返回 null
 */
export function getWorkflowByPhase(phase: string): AgileWorkflow | null {
  const workflow = AGILE_WORKFLOWS.find(wf => wf.phase === phase); // 按阶段查找
  if (!workflow) {
    log.warn(`getWorkflowByPhase: 未找到阶段 "${phase}" 的工作流`); // 警告日志
    return null; // 未找到
  }
  log.debug(`getWorkflowByPhase: 返回 "${phase}" 工作流 (${workflow.steps.length} 步)`); // 调试日志
  return workflow; // 返回工作流
}

/**
 * v21.0 P3-14: 执行工作流步骤
 *
 * 返回指定步骤的详情和下一步推荐。不实际执行工具调用，
 * 仅返回步骤信息供 Claude 或用户决定是否调用对应工具。
 *
 * @param workflowId - 工作流 ID
 * @param stepIndex  - 步骤序号
 * @returns 步骤执行结果
 */
export function executeWorkflowStep(workflowId: string, stepIndex: number): WorkflowStepResult {
  const workflow = AGILE_WORKFLOWS.find(wf => wf.id === workflowId); // 查找工作流
  if (!workflow) {
    throw new Error(`工作流 "${workflowId}" 不存在，可选: ${AGILE_WORKFLOWS.map(w => w.id).join(', ')}`); // 工作流不存在
  }

  if (stepIndex < 0 || stepIndex >= workflow.steps.length) {
    throw new Error(`步骤序号 ${stepIndex} 超出范围 [0, ${workflow.steps.length - 1}]`); // 序号越界
  }

  const step = workflow.steps[stepIndex]; // 当前步骤
  const nextStep = stepIndex + 1 < workflow.steps.length
    ? workflow.steps[stepIndex + 1] // 下一步骤
    : null; // 当前阶段结束
  const progress = `${Math.round(((stepIndex + 1) / workflow.steps.length) * 100)}%`; // 进度百分比

  log.info(`executeWorkflowStep: ${workflow.title} - 步骤 ${stepIndex + 1}/${workflow.steps.length} "${step.title}"`); // 日志
  return { workflowId, stepIndex, step, nextStep, progress }; // 返回执行结果
}
