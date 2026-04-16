/**
 * 斜杠命令注册表 - 将 /xxx 斜杠命令映射到 MCP 工具名
 *
 * 提供 20 个内置命令的注册、解析和执行功能。
 * 支持别名、默认参数、自定义命令扩展。
 *
 * 类方法列表:
 * - constructor()       注册全部 20 个内置命令
 * - register()          注册自定义命令
 * - execute()           解析并执行斜杠命令字符串
 * - list()              列出所有已注册命令
 * - get()               按名称或别名查找命令
 */

import { log } from '../utils/logger.js'; // 日志工具

/** 斜杠命令定义 */
export interface SlashCommand {
  name: string;                            // 命令名（不含 /），如 "next"
  description: string;                     // 命令描述
  mcpTool: string;                         // 映射的 MCP 工具名
  defaultArgs?: Record<string, unknown>;   // 默认参数
  aliases?: string[];                      // 别名列表
}

/** 斜杠命令执行结果 */
export interface SlashCommandResult {
  command: string;                         // 原始命令
  mcpTool: string;                         // 映射的 MCP 工具名
  args: Record<string, unknown>;           // 解析后的参数
}

/** 任务 ID 正则：以 T 开头后跟数字，支持子任务如 T1.3 */
const TASK_ID_REGEX = /^T\d+(\.\d+)*$/;

/**
 * 斜杠命令注册表
 *
 * 管理所有斜杠命令的注册与解析，将用户输入的 /xxx 命令
 * 映射到对应的 MCP 工具调用。
 */
export class SlashCommandRegistry {
  private commands: Map<string, SlashCommand>; // 命令名 → 命令定义

  constructor() {
    this.commands = new Map(); // 初始化空映射
    this.registerBuiltinCommands(); // 注册内置命令
    log.debug(`斜杠命令注册表初始化，共 ${this.commands.size} 个命令`); // 输出注册数量
  }

  /**
   * 注册自定义命令
   * @param cmd 命令定义
   */
  register(cmd: SlashCommand): void {
    if (this.commands.has(cmd.name)) { // 检查命令名是否已存在
      log.warn(`斜杠命令 /${cmd.name} 已存在，将被覆盖`); // 覆盖警告
    }
    this.commands.set(cmd.name, cmd); // 写入主映射
    log.debug(`注册斜杠命令: /${cmd.name} → ${cmd.mcpTool}`); // 调试日志
  }

  /**
   * 解析并执行斜杠命令字符串
   *
   * 支持格式:
   *   /done T1
   *   /expand T2 --research
   *   /block T3 --status=blocked
   *
   * @param input 用户输入的完整命令字符串
   * @returns 解析结果，命令未找到时返回 null
   */
  execute(input: string): SlashCommandResult | null {
    const trimmed = input.trim(); // 去除首尾空白
    if (!trimmed) return null; // 空输入直接返回

    const stripped = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed; // 去除前导 /
    const tokens = stripped.split(/\s+/); // 按空白分割
    const cmdName = tokens[0]?.toLowerCase(); // 第一个 token 为命令名（小写）
    if (!cmdName) return null; // 无命令名

    const cmd = this.get(cmdName); // 按名称或别名查找
    if (!cmd) { // 命令未注册
      log.warn(`未知斜杠命令: /${cmdName}`); // 警告日志
      return null; // 返回 null
    }

    const args: Record<string, unknown> = { ...cmd.defaultArgs }; // 复制默认参数
    const restTokens = tokens.slice(1); // 剩余 token 为参数

    for (const token of restTokens) { // 遍历参数 token
      if (TASK_ID_REGEX.test(token)) { // 匹配任务 ID 格式
        args.taskId = token; // 设置 taskId
      } else if (token === '--research') { // --research 标志
        args.research = true; // 设置 research 为 true
      } else if (token.startsWith('--status=')) { // --status=xxx 格式
        args.status = token.slice('--status='.length); // 提取状态值
      } else if (token.startsWith('--')) { // 其他 --key=value 格式
        const eqIdx = token.indexOf('='); // 查找等号位置
        if (eqIdx > 2) { // 有等号且 key 非空
          const key = token.slice(2, eqIdx); // 提取 key
          args[key] = token.slice(eqIdx + 1); // 提取 value
        } else { // 纯布尔标志 --flag
          args[token.slice(2)] = true; // 设为 true
        }
      }
    }

    log.debug(`执行斜杠命令: /${cmd.name} → ${cmd.mcpTool}，参数: ${JSON.stringify(args)}`); // 调试日志

    return { // 返回解析结果
      command: `/${cmd.name}`, // 标准化命令名
      mcpTool: cmd.mcpTool,   // MCP 工具名
      args,                    // 合并后的参数
    };
  }

  /**
   * 列出所有已注册命令
   * @returns 命令定义数组
   */
  list(): SlashCommand[] {
    return Array.from(this.commands.values()); // Map 转数组
  }

  /**
   * 按名称或别名查找命令
   * @param name 命令名或别名
   * @returns 命令定义，未找到返回 undefined
   */
  get(name: string): SlashCommand | undefined {
    const lower = name.toLowerCase(); // 统一小写
    const direct = this.commands.get(lower); // 直接查找
    if (direct) return direct; // 命中主名称

    // 遍历所有命令检查别名
    for (const cmd of this.commands.values()) {
      if (cmd.aliases?.some(a => a.toLowerCase() === lower)) { // 别名匹配
        return cmd; // 返回匹配的命令
      }
    }
    return undefined; // 未找到
  }

  /**
   * 注册全部 20 个内置斜杠命令
   * 每个命令映射到对应的 qflow MCP 工具
   */
  private registerBuiltinCommands(): void {
    const builtins: SlashCommand[] = [
      { // 1. 获取下一个推荐任务
        name: 'next',
        description: '获取下一个推荐任务',
        mcpTool: 'qflow_task_next',
        aliases: ['n'],
      },
      { // 2. 标记任务完成
        name: 'done',
        description: '标记任务完成',
        mcpTool: 'qflow_task_set_status',
        defaultArgs: { status: 'done' },
        aliases: ['d', 'finish'],
      },
      { // 3. 开始任务
        name: 'start',
        description: '开始任务',
        mcpTool: 'qflow_task_set_status',
        defaultArgs: { status: 'active' },
        aliases: ['s', 'begin'],
      },
      { // 4. 标记任务阻塞
        name: 'block',
        description: '标记任务阻塞',
        mcpTool: 'qflow_task_set_status',
        defaultArgs: { status: 'blocked' },
        aliases: ['b'],
      },
      { // 5. 拆解任务为子任务
        name: 'expand',
        description: '拆解任务为子任务',
        mcpTool: 'qflow_task_expand',
        aliases: ['ex', 'split'],
      },
      { // 6. 列出所有任务
        name: 'list',
        description: '列出所有任务',
        mcpTool: 'qflow_task_list',
        aliases: ['ls', 'l'],
      },
      { // 7. 获取任务详情
        name: 'get',
        description: '获取任务详情',
        mcpTool: 'qflow_task_get',
        aliases: ['g', 'show'],
      },
      { // 8. 创建新任务
        name: 'create',
        description: '创建新任务',
        mcpTool: 'qflow_task_create',
        aliases: ['c', 'new', 'add'],
      },
      { // 9. 更新任务
        name: 'update',
        description: '更新任务',
        mcpTool: 'qflow_task_update',
        aliases: ['u', 'edit'],
      },
      { // 10. 删除任务
        name: 'delete',
        description: '删除任务',
        mcpTool: 'qflow_task_delete',
        aliases: ['del', 'rm', 'remove'],
      },
      { // 11. 查看 Spec 状态
        name: 'spec',
        description: '查看 Spec 状态',
        mcpTool: 'qflow_spec_status',
        aliases: ['sp'],
      },
      { // 12. 提出 Spec 变更
        name: 'propose',
        description: '提出 Spec 变更',
        mcpTool: 'qflow_spec_propose',
        aliases: ['prop'],
      },
      { // 13. 应用 Spec 变更
        name: 'apply',
        description: '应用 Spec 变更',
        mcpTool: 'qflow_spec_apply',
        aliases: ['ap'],
      },
      { // 14. 验证 Spec
        name: 'verify',
        description: '验证 Spec',
        mcpTool: 'qflow_spec_verify',
        aliases: ['v', 'check'],
      },
      { // 15. 执行研究查询
        name: 'research',
        description: '执行研究查询',
        mcpTool: 'qflow_research',
        aliases: ['r', 'explore'],
      },
      { // 16. 查看项目进度
        name: 'progress',
        description: '查看项目进度',
        mcpTool: 'qflow_report_progress',
        aliases: ['p', 'report'],
      },
      { // 17. 可视化依赖图
        name: 'deps',
        description: '可视化依赖图',
        mcpTool: 'qflow_deps_visualize',
        aliases: ['dep', 'graph'],
      },
      { // 18. 生成会话交接摘要
        name: 'handoff',
        description: '生成会话交接摘要',
        mcpTool: 'qflow_session_handoff',
        aliases: ['ho', 'summary'],
      },
      { // 19. 加载上下文模块
        name: 'context',
        description: '加载上下文模块',
        mcpTool: 'qflow_context_load',
        aliases: ['ctx', 'load'],
      },
      { // 20. 执行 TDD 步骤
        name: 'tdd',
        description: '执行 TDD 步骤',
        mcpTool: 'qflow_tdd_step',
        aliases: ['test'],
      },
    ];

    for (const cmd of builtins) { // 逐个注册内置命令
      this.commands.set(cmd.name, cmd); // 写入映射
    }
  }
}
