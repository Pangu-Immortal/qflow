/**
 * 日志工具 - 带颜色和前缀的控制台输出
 *
 * 使用 chalk 库实现彩色输出，所有日志带 [qflow] 前缀。
 * debug 级别仅在环境变量 QFLOW_DEBUG=true 时输出。
 *
 * 函数列表：
 * - log.info()     信息日志（蓝色 ℹ）
 * - log.warn()     警告日志（黄色 ⚠）
 * - log.error()    错误日志（红色 ✗）
 * - log.success()  成功日志（绿色 ✓）
 * - log.debug()    调试日志（灰色 ●，需 QFLOW_DEBUG=true）
 */

import chalk from 'chalk'; // ESM default import，终端颜色库

/** 日志前缀 */
const PREFIX = '[qflow]'; // 统一前缀标识

/**
 * 日志工具对象
 *
 * 每个方法对应一个日志级别，自动添加前缀、图标和颜色。
 */
export const log = {
  /**
   * 输出信息日志（蓝色）
   * @param msg - 日志内容
   */
  info(msg: string): void {
    console.log(`${chalk.blue(PREFIX)} ${chalk.blue('ℹ')} ${msg}`); // 蓝色前缀 + 信息图标
  },

  /**
   * 输出警告日志（黄色）
   * @param msg - 日志内容
   */
  warn(msg: string): void {
    console.warn(`${chalk.yellow(PREFIX)} ${chalk.yellow('⚠')} ${msg}`); // 黄色前缀 + 警告图标
  },

  /**
   * 输出错误日志（红色）
   * @param msg - 日志内容
   */
  error(msg: string): void {
    console.error(`${chalk.red(PREFIX)} ${chalk.red('✗')} ${msg}`); // 红色前缀 + 错误图标
  },

  /**
   * 输出成功日志（绿色）
   * @param msg - 日志内容
   */
  success(msg: string): void {
    console.log(`${chalk.green(PREFIX)} ${chalk.green('✓')} ${msg}`); // 绿色前缀 + 成功图标
  },

  /**
   * 输出调试日志（灰色，仅 QFLOW_DEBUG=true 时生效）
   * @param msg - 日志内容
   */
  debug(msg: string): void {
    if (process.env.QFLOW_DEBUG !== 'true') return; // 非调试模式直接跳过
    console.log(`${chalk.gray(PREFIX)} ${chalk.gray('●')} ${msg}`); // 灰色前缀 + 调试图标
  },
};
