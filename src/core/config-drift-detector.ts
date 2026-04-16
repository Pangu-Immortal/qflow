/**
 * 配置漂移检测器 - 检测 qflow 配置与磁盘实际状态的不一致
 *
 * 扫描 qflow 配置中声明的 Schema 文件，检查它们是否实际存在于磁盘上。
 * 当发现配置声明与磁盘实际文件不匹配时，返回警告列表。
 *
 * 典型使用场景:
 * - 手动删除了 Schema 文件但配置中仍引用
 * - 配置文件被外部工具修改导致与实际文件不同步
 * - 项目迁移后路径失效
 *
 * 函数列表:
 * - detect()  执行漂移检测，返回所有不一致的警告
 */

import path from 'node:path'; // 路径拼接工具
import { promises as fs } from 'node:fs'; // 异步文件操作
import { loadConfig } from './config-manager.js'; // 配置加载器
import { fileExists } from '../utils/file-io.js'; // 文件存在性检查
import { QFLOW_DIR } from '../shared/tool-utils.js'; // .qflow 目录常量
import { log } from '../utils/logger.js'; // 日志工具

/** schemas 子目录名称 */
const SCHEMAS_DIR = 'schemas'; // Schema 文件存放目录

/**
 * 漂移警告接口
 *
 * 表示配置与磁盘之间的一处不一致。
 */
export interface DriftWarning {
  type: string;    // 警告类型（如 'missing_schema', 'orphan_schema'）
  message: string; // 可读的警告描述
  path: string;    // 相关文件的磁盘路径
}

/**
 * 配置漂移检测器
 *
 * 绑定一个项目根目录，检测该项目的 qflow 配置与磁盘文件的一致性。
 */
export class ConfigDriftDetector {
  /** 项目根目录绝对路径 */
  private readonly projectRoot: string;

  /**
   * @param projectRoot - 项目根目录绝对路径
   */
  constructor(projectRoot: string) {
    this.projectRoot = projectRoot; // 保存项目根路径
  }

  /**
   * 执行配置漂移检测
   *
   * 检测流程:
   * 1. 加载 qflow 配置文件
   * 2. 扫描 schemas 目录下的实际文件列表
   * 3. 对比声明的 Schema 与实际文件，找出不一致
   *
   * @returns 漂移警告列表，空列表表示配置与磁盘一致
   */
  async detect(): Promise<DriftWarning[]> {
    const warnings: DriftWarning[] = []; // 警告收集列表
    log.debug(`ConfigDriftDetector: 开始检测项目 ${this.projectRoot}`); // 调试日志

    // 1. 加载项目配置
    let config; // 配置对象
    try {
      config = await loadConfig(this.projectRoot); // 从磁盘加载配置
      log.debug(`ConfigDriftDetector: 配置加载成功，项目名=${config.projectName}`); // 调试日志
    } catch (err) { // 配置加载失败
      const configPath = path.join(this.projectRoot, QFLOW_DIR, 'qflow.config.json'); // 配置文件路径
      warnings.push({
        type: 'config_error', // 配置错误类型
        message: `无法加载 qflow 配置: ${err instanceof Error ? err.message : String(err)}`, // 错误描述
        path: configPath, // 关联路径
      });
      log.warn(`ConfigDriftDetector: 配置加载失败 - ${err}`); // 警告日志
      return warnings; // 配置都读不了，直接返回
    }

    // 2. 扫描 schemas 目录下的实际文件
    const schemasDir = path.join(this.projectRoot, QFLOW_DIR, SCHEMAS_DIR); // schemas 目录路径
    let diskSchemaFiles: string[] = []; // 磁盘上的 Schema 文件列表

    if (await fileExists(schemasDir)) { // schemas 目录存在
      try {
        const entries = await fs.readdir(schemasDir); // 读取目录内容
        diskSchemaFiles = entries.filter(e => e.endsWith('.json')); // 仅保留 JSON 文件
        log.debug(`ConfigDriftDetector: 磁盘 Schema 文件数=${diskSchemaFiles.length}`); // 调试日志
      } catch (err) { // 读取目录失败
        warnings.push({
          type: 'dir_read_error', // 目录读取错误
          message: `无法读取 schemas 目录: ${err instanceof Error ? err.message : String(err)}`, // 错误描述
          path: schemasDir, // 关联路径
        });
        log.warn(`ConfigDriftDetector: schemas 目录读取失败 - ${err}`); // 警告日志
        return warnings; // 目录不可读，直接返回
      }
    } else { // schemas 目录不存在
      log.debug('ConfigDriftDetector: schemas 目录不存在，跳过 Schema 文件检查'); // 调试日志
    }

    // 3. 检查配置中声明的上下文模块对应的文件是否存在
    if (config.contextModules && config.contextModules.length > 0) { // 有声明上下文模块
      for (const moduleName of config.contextModules) { // 遍历每个模块名
        const modulePath = path.join(this.projectRoot, QFLOW_DIR, 'context', `${moduleName}.md`); // 模块文件路径
        if (!(await fileExists(modulePath))) { // 文件不存在
          warnings.push({
            type: 'missing_context_module', // 缺失上下文模块
            message: `配置声明的上下文模块 "${moduleName}" 对应文件不存在`, // 描述
            path: modulePath, // 关联路径
          });
          log.warn(`ConfigDriftDetector: 上下文模块文件缺失 - ${modulePath}`); // 警告日志
        }
      }
    }

    // 4. 检查磁盘上的 Schema 文件是否能正常解析
    for (const schemaFile of diskSchemaFiles) { // 遍历磁盘上的每个 Schema 文件
      const schemaPath = path.join(schemasDir, schemaFile); // 文件完整路径
      try {
        const content = await fs.readFile(schemaPath, 'utf-8'); // 读取文件内容
        JSON.parse(content); // 尝试解析 JSON
      } catch (err) { // 解析失败
        warnings.push({
          type: 'invalid_schema_file', // 无效 Schema 文件
          message: `Schema 文件 "${schemaFile}" JSON 解析失败: ${err instanceof Error ? err.message : String(err)}`, // 描述
          path: schemaPath, // 关联路径
        });
        log.warn(`ConfigDriftDetector: Schema 文件解析失败 - ${schemaPath}`); // 警告日志
      }
    }

    // 5. 检查 .qflow 目录本身是否存在
    const qflowDir = path.join(this.projectRoot, QFLOW_DIR); // .qflow 目录路径
    if (!(await fileExists(qflowDir))) { // .qflow 目录不存在
      warnings.push({
        type: 'missing_qflow_dir', // 缺失 .qflow 目录
        message: `.qflow 目录不存在于项目根目录`, // 描述
        path: qflowDir, // 关联路径
      });
      log.warn(`ConfigDriftDetector: .qflow 目录缺失 - ${qflowDir}`); // 警告日志
    }

    log.info(`ConfigDriftDetector: 检测完成，发现 ${warnings.length} 个漂移警告`); // 信息日志
    return warnings; // 返回所有警告
  }
}
