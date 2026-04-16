/**
 * PRD 解析器 - Markdown PRD -> 任务树
 *
 * 解析 PRD（产品需求文档）的 Markdown 内容，
 * 自动生成结构化任务列表。
 *
 * 解析规则:
 *   - ## 标题   -> 顶级任务
 *   - ### 子标题 -> 子任务
 *   - - 列表项  -> 子任务的描述或更细粒度子任务
 *   - 正文段落  -> 任务描述
 *
 * 函数列表:
 * - parsePrd()        解析 PRD 内容为任务列表
 * - prdToTasks()      解析 PRD 并创建任务（通过 TaskManager）
 */

import { TaskManager } from './task-manager.js'; // 任务管理器
import { log } from '../utils/logger.js'; // 日志工具
import type { Task } from '../schemas/task.js'; // 任务类型

/** 解析后的子任务结构 */
export interface ParsedSubtask {
  title: string; // 子任务标题
  description: string; // 子任务描述
  listItems: string[]; // 列表项（更细粒度的描述）
}

/** 解析后的顶级任务结构 */
export interface ParsedTask {
  title: string; // 任务标题
  description: string; // 任务描述
  subtasks: ParsedSubtask[]; // 子任务列表
}

/** PRD 解析结果 */
export interface ParsedPrd {
  title: string; // PRD 标题（来自 # 一级标题）
  description: string; // PRD 描述（一级标题后的正文）
  tasks: ParsedTask[]; // 顶级任务列表
}

/**
 * 解析 PRD 内容为结构化数据
 *
 * 按 Markdown 标题层级拆分为任务树结构。
 *
 * @param content - PRD 的 Markdown 内容
 * @returns 解析后的 PRD 结构
 */
export function parsePrd(content: string): ParsedPrd {
  const lines = content.split('\n'); // 按行分割
  const result: ParsedPrd = { // 初始化结果
    title: '', // 待填充
    description: '', // 待填充
    tasks: [], // 待填充
  };

  let currentTask: ParsedTask | null = null; // 当前顶级任务
  let currentSubtask: ParsedSubtask | null = null; // 当前子任务
  let prdDescLines: string[] = []; // PRD 描述行收集器
  let taskDescLines: string[] = []; // 任务描述行收集器
  let subtaskDescLines: string[] = []; // 子任务描述行收集器
  let inPrdHeader = true; // 是否在 PRD 头部区域（# 标题之后、## 之前）

  for (const line of lines) { // 遍历每一行
    const trimmed = line.trim(); // 去除首尾空白

    // 匹配一级标题: # 标题
    if (/^#\s+/.test(trimmed) && !trimmed.startsWith('##')) { // 一级标题
      result.title = trimmed.replace(/^#\s+/, '').trim(); // 提取标题文本
      inPrdHeader = true; // 进入头部区域
      continue; // 下一行
    }

    // 匹配二级标题: ## 标题 -> 顶级任务
    if (/^##\s+/.test(trimmed) && !trimmed.startsWith('###')) { // 二级标题
      // 保存前一个子任务的描述
      if (currentSubtask) { // 有未结束的子任务
        currentSubtask.description = subtaskDescLines.join('\n').trim(); // 保存描述
        subtaskDescLines = []; // 重置
      }

      // 保存前一个任务的描述
      if (currentTask) { // 有未结束的任务
        if (taskDescLines.length > 0 && !currentTask.description) { // 描述还未填充
          currentTask.description = taskDescLines.join('\n').trim(); // 保存描述
        }
        result.tasks.push(currentTask); // 追加到结果
        taskDescLines = []; // 重置
      }

      // 保存 PRD 描述
      if (inPrdHeader) { // 在头部区域
        result.description = prdDescLines.join('\n').trim(); // 保存 PRD 描述
        inPrdHeader = false; // 离开头部区域
      }

      currentTask = { // 创建新顶级任务
        title: trimmed.replace(/^##\s+/, '').trim(), // 提取标题
        description: '', // 待填充
        subtasks: [], // 子任务列表
      };
      currentSubtask = null; // 重置子任务
      continue; // 下一行
    }

    // 匹配三级标题: ### 子标题 -> 子任务
    if (/^###\s+/.test(trimmed)) { // 三级标题
      if (!currentTask) continue; // 无顶级任务，跳过

      // 保存前一个子任务的描述
      if (currentSubtask) { // 有未结束的子任务
        currentSubtask.description = subtaskDescLines.join('\n').trim(); // 保存描述
        subtaskDescLines = []; // 重置
      }

      // 保存当前任务描述
      if (taskDescLines.length > 0 && !currentTask.description) { // 描述还未填充
        currentTask.description = taskDescLines.join('\n').trim(); // 保存描述
        taskDescLines = []; // 重置
      }

      currentSubtask = { // 创建新子任务
        title: trimmed.replace(/^###\s+/, '').trim(), // 提取标题
        description: '', // 待填充
        listItems: [], // 列表项
      };
      currentTask.subtasks.push(currentSubtask); // 追加到当前任务
      continue; // 下一行
    }

    // 匹配列表项: - 内容
    if (/^[-*]\s+/.test(trimmed)) { // 列表项
      const itemText = trimmed.replace(/^[-*]\s+/, '').trim(); // 提取列表文本

      if (currentSubtask) { // 在子任务内
        currentSubtask.listItems.push(itemText); // 追加到子任务列表项
      } else if (currentTask) { // 在任务内但无子任务
        taskDescLines.push(trimmed); // 作为任务描述的一部分
      }
      continue; // 下一行
    }

    // 正文段落处理
    if (inPrdHeader) { // 在 PRD 头部
      prdDescLines.push(line); // 收集 PRD 描述
    } else if (currentSubtask) { // 在子任务内
      subtaskDescLines.push(line); // 收集子任务描述
    } else if (currentTask) { // 在任务内
      taskDescLines.push(line); // 收集任务描述
    }
  }

  // 处理最后一个子任务
  if (currentSubtask) { // 有未结束的子任务
    currentSubtask.description = subtaskDescLines.join('\n').trim(); // 保存描述
  }

  // 处理最后一个任务
  if (currentTask) { // 有未结束的任务
    if (taskDescLines.length > 0 && !currentTask.description) { // 描述还未填充
      currentTask.description = taskDescLines.join('\n').trim(); // 保存描述
    }
    result.tasks.push(currentTask); // 追加到结果
  }

  // 处理 PRD 描述（如果只有头部没有 ## 任务）
  if (inPrdHeader && prdDescLines.length > 0) { // 仍在头部
    result.description = prdDescLines.join('\n').trim(); // 保存描述
  }

  log.info(`PRD 解析完成: "${result.title}"，共 ${result.tasks.length} 个顶级任务`); // 信息日志
  return result; // 返回解析结果
}

/**
 * 解析 PRD 并创建任务
 *
 * 调用 parsePrd 解析 PRD 内容，然后通过 TaskManager 批量创建任务。
 * 顺序依赖：后一个顶级任务依赖前一个。
 *
 * @param content     - PRD 的 Markdown 内容
 * @param taskManager - 任务管理器实例
 * @param tags        - 要给所有任务添加的标签（可选）
 * @returns 创建的所有任务列表
 */
export async function prdToTasks(
  content: string,
  taskManager: TaskManager,
  tags?: string[],
): Promise<Task[]> {
  const prd = parsePrd(content); // 解析 PRD
  const createdTasks: Task[] = []; // 已创建的任务列表
  let prevTaskId: string | null = null; // 前一个顶级任务的 ID（用于顺序依赖）

  for (const parsedTask of prd.tasks) { // 遍历每个顶级任务
    // 构建任务描述
    const description = parsedTask.description || parsedTask.title; // 描述为空时使用标题

    // 创建顶级任务，依赖前一个顶级任务
    const deps = prevTaskId ? [prevTaskId] : []; // 顺序依赖
    const task = await taskManager.createTask( // 创建任务
      parsedTask.title, // 标题
      description, // 描述
      { deps, tags: tags ?? [] }, // 依赖和标签
    );
    createdTasks.push(task); // 记录已创建
    prevTaskId = task.id; // 更新前一个任务 ID

    // 创建子任务
    for (const parsedSub of parsedTask.subtasks) { // 遍历子任务
      const subDesc = [parsedSub.description]; // 子任务描述
      if (parsedSub.listItems.length > 0) { // 有列表项
        subDesc.push(''); // 空行分隔
        subDesc.push(...parsedSub.listItems.map((item) => `- ${item}`)); // 追加列表项
      }

      const subTask = await taskManager.createTask( // 创建子任务
        parsedSub.title, // 标题
        subDesc.join('\n').trim(), // 拼接描述
        { parentId: task.id, tags: tags ?? [] }, // 父任务和标签
      );
      createdTasks.push(subTask); // 记录已创建
    }
  }

  log.info(`PRD → 任务: 共创建 ${createdTasks.length} 个任务（${prd.tasks.length} 个顶级 + ${createdTasks.length - prd.tasks.length} 个子任务）`); // 信息日志
  return createdTasks; // 返回所有创建的任务
}
