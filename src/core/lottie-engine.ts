/**
 * Lottie 动画生成引擎 - 从模板生成自定义 Lottie JSON 动画
 *
 * 支持 34 种预置模板，可自定义颜色、尺寸、帧率、缓动。
 * 模板存放在 data/lottie-templates/ 目录。
 *
 * 函数列表:
 * - listTemplates()     列出所有可用模板
 * - generateAnimation() 从模板生成动画 JSON
 * - getTemplateInfo()   获取模板详情
 */

import path from 'node:path'; // 路径拼接工具
import { promises as fs } from 'node:fs'; // 异步文件操作
import { fileURLToPath } from 'node:url'; // ESM 中获取文件路径
import { log } from '../utils/logger.js'; // 日志工具

// ============================================================================
// 类型定义
// ============================================================================

/** 模板元信息 */
export interface LottieTemplate {
  id: string;            // 模板 ID，如 'spinner-circular'
  name: string;          // 中文名称
  description: string;   // 说明
  loop: boolean;         // 是否循环
  defaultFrames: number; // 建议帧数
  category: string;      // 分类：导航反馈/交互动效/页面过渡/状态指示/图标变形/高级效果
}

/** 生成参数 */
export interface LottieGenerateOptions {
  templateId: string;    // 模板 ID
  color?: string;        // 主色 hex，如 '#6C5CE7'
  width?: number;        // 画布宽度，默认 200
  height?: number;       // 画布高度，默认 200
  fps?: number;          // 帧率，默认 30
  outputPath?: string;   // 输出路径（可选）
}

/** Lottie JSON 顶层结构（关键字段） */
interface LottieJson {
  v: string;             // Lottie 版本
  nm: string;            // 动画名称
  fr: number;            // 帧率
  ip: number;            // 起始帧
  op: number;            // 结束帧
  w: number;             // 画布宽度
  h: number;             // 画布高度
  layers: LottieLayer[]; // 图层列表
  [key: string]: unknown; // 其他字段
}

/** Lottie 图层（递归结构） */
interface LottieLayer {
  nm?: string;           // 图层名称
  shapes?: LottieShape[]; // 形状列表
  [key: string]: unknown; // 其他字段
}

/** Lottie 形状元素 */
interface LottieShape {
  ty?: string;           // 类型：fl(填充)/st(描边)/gr(分组) 等
  c?: LottieColorProp;   // 颜色属性
  it?: LottieShape[];    // 分组子元素
  [key: string]: unknown; // 其他字段
}

/** Lottie 颜色属性 */
interface LottieColorProp {
  k: number[] | LottieKeyframe[]; // 静态颜色 [r,g,b,a] 或关键帧数组
  [key: string]: unknown;
}

/** Lottie 关键帧 */
interface LottieKeyframe {
  s?: number[];          // 起始值
  e?: number[];          // 结束值
  [key: string]: unknown;
}

// ============================================================================
// 模板分类索引（从 Skill 文档提取的硬编码映射）
// ============================================================================

/** 模板分类映射：模板 ID → 分类名 */
const TEMPLATE_CATEGORY_MAP: Record<string, string> = {
  // 导航反馈
  'spinner-circular': '导航反馈',
  'spinner-dots': '导航反馈',
  'success-checkmark': '导航反馈',
  'error-cross': '导航反馈',
  'warning-triangle': '导航反馈',
  'pull-refresh': '导航反馈',
  // 交互动效
  'heart-like': '交互动效',
  'star-rating': '交互动效',
  'toggle-switch': '交互动效',
  'tab-bounce': '交互动效',
  'button-press': '交互动效',
  'swipe-hint': '交互动效',
  // 页面过渡
  'fade-in': '页面过渡',
  'slide-up': '页面过渡',
  'scale-pop': '页面过渡',
  'skeleton-shimmer': '页面过渡',
  'page-flip': '页面过渡',
  'modal-backdrop': '页面过渡',
  // 状态指示
  'progress-bar': '状态指示',
  'progress-circle': '状态指示',
  'upload-arrow': '状态指示',
  'download-arrow': '状态指示',
  'sync-rotate': '状态指示',
  'empty-state': '状态指示',
  // 图标变形
  'play-pause': '图标变形',
  'hamburger-close': '图标变形',
  'arrow-direction': '图标变形',
  'search-expand': '图标变形',
  'bell-shake': '图标变形',
  'typing-dots': '图标变形',
  // 高级效果
  'confetti-simple': '高级效果',
  'ripple-wave': '高级效果',
  'pulse-glow': '高级效果',
  'count-number': '高级效果',
};

/** 模板中文名称映射 */
const TEMPLATE_NAME_MAP: Record<string, string> = {
  'spinner-circular': '圆形加载',
  'spinner-dots': '点状加载',
  'success-checkmark': '成功对勾',
  'error-cross': '错误叉号',
  'warning-triangle': '警告三角',
  'pull-refresh': '下拉刷新',
  'heart-like': '心跳点赞',
  'star-rating': '星级评分',
  'toggle-switch': '开关切换',
  'tab-bounce': '标签弹跳',
  'button-press': '按钮按压',
  'swipe-hint': '滑动提示',
  'fade-in': '淡入效果',
  'slide-up': '上滑进入',
  'scale-pop': '缩放弹出',
  'skeleton-shimmer': '骨架屏微光',
  'page-flip': '翻页效果',
  'modal-backdrop': '弹窗背景',
  'progress-bar': '进度条',
  'progress-circle': '环形进度',
  'upload-arrow': '上传箭头',
  'download-arrow': '下载箭头',
  'sync-rotate': '同步旋转',
  'empty-state': '空状态',
  'play-pause': '播放暂停',
  'hamburger-close': '汉堡关闭',
  'arrow-direction': '箭头方向',
  'search-expand': '搜索展开',
  'bell-shake': '铃铛摇晃',
  'typing-dots': '打字气泡',
  'confetti-simple': '简易彩纸',
  'ripple-wave': '涟漪波纹',
  'pulse-glow': '脉冲发光',
  'count-number': '数字滚动',
};

/** 模板描述映射 */
const TEMPLATE_DESC_MAP: Record<string, string> = {
  'spinner-circular': '圆形旋转加载指示器，适用于页面/数据加载',
  'spinner-dots': '多点循环跳动加载指示器',
  'success-checkmark': '操作成功后的对勾确认动画',
  'error-cross': '操作失败后的叉号提示动画',
  'warning-triangle': '警告状态的三角感叹号动画',
  'pull-refresh': '下拉刷新箭头旋转动画',
  'heart-like': '心形点赞/收藏动效',
  'star-rating': '星级评分点亮动效',
  'toggle-switch': '开关状态切换动效',
  'tab-bounce': '标签页切换弹跳动效',
  'button-press': '按钮按压反馈动效',
  'swipe-hint': '滑动操作引导动效',
  'fade-in': '元素淡入过渡动画',
  'slide-up': '元素从底部滑入动画',
  'scale-pop': '元素缩放弹出动画',
  'skeleton-shimmer': '骨架屏加载微光扫描动画',
  'page-flip': '页面翻转过渡动画',
  'modal-backdrop': '弹窗遮罩淡入动画',
  'progress-bar': '水平进度条填充动画',
  'progress-circle': '环形进度填充动画',
  'upload-arrow': '上传箭头循环动画',
  'download-arrow': '下载箭头循环动画',
  'sync-rotate': '同步状态旋转动画',
  'empty-state': '空数据状态占位动画',
  'play-pause': '播放/暂停图标变形动画',
  'hamburger-close': '汉堡菜单/关闭图标变形动画',
  'arrow-direction': '箭头方向切换变形动画',
  'search-expand': '搜索图标展开变形动画',
  'bell-shake': '通知铃铛摇晃动画',
  'typing-dots': '正在输入的跳动点动画',
  'confetti-simple': '简易彩纸撒落庆祝动画',
  'ripple-wave': '涟漪扩散波纹动画',
  'pulse-glow': '脉冲发光呼吸动画',
  'count-number': '数字滚动计数动画',
};

// ============================================================================
// 内部工具函数
// ============================================================================

/**
 * 获取 Lottie 模板目录的绝对路径
 *
 * 基于编译后文件位置推算: dist/core/lottie-engine.js → 向上两级到 qflow 根目录
 * 再进入 data/lottie-templates/
 *
 * @returns 模板目录的绝对路径
 */
export function getTemplatesDir(): string {
  const currentFile = fileURLToPath(import.meta.url); // 当前文件绝对路径
  return path.resolve(path.dirname(currentFile), '..', '..', 'data', 'lottie-templates'); // 向上两级到项目根目录
}

/**
 * 将 hex 颜色值转换为 Lottie 归一化 RGB 数组
 *
 * Lottie 使用 0~1 范围的浮点数表示颜色通道
 * 例: '#6C5CE7' → [0.42, 0.36, 0.91]
 *
 * @param hex - 十六进制颜色字符串，如 '#6C5CE7'
 * @returns 归一化 RGB 三元组 [r, g, b]
 */
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255; // 红色通道
  const g = parseInt(hex.slice(3, 5), 16) / 255; // 绿色通道
  const b = parseInt(hex.slice(5, 7), 16) / 255; // 蓝色通道
  return [
    Math.round(r * 100) / 100, // 保留两位小数
    Math.round(g * 100) / 100,
    Math.round(b * 100) / 100,
  ];
}

/**
 * 递归替换 Lottie 形状中所有填充(fl)和描边(st)的颜色值
 *
 * 遍历形状数组，找到 ty='fl' 或 ty='st' 的元素，
 * 将其 c.k 字段的 RGB 分量替换为新颜色。
 * 支持静态颜色和关键帧动画颜色。
 *
 * @param shapes - Lottie 形状数组
 * @param newColor - 归一化 RGB 三元组
 */
function replaceShapeColors(shapes: LottieShape[], newColor: [number, number, number]): void {
  for (const shape of shapes) { // 遍历每个形状元素
    // 处理分组(gr)：递归进入子元素
    if (shape.ty === 'gr' && Array.isArray(shape.it)) {
      replaceShapeColors(shape.it, newColor); // 递归处理分组内元素
      continue;
    }

    // 处理填充(fl)和描边(st)：替换颜色
    if ((shape.ty === 'fl' || shape.ty === 'st') && shape.c) {
      const colorProp = shape.c; // 颜色属性对象
      if (Array.isArray(colorProp.k)) {
        if (typeof colorProp.k[0] === 'number') {
          // 静态颜色：k 是 [r, g, b, a] 数组
          const staticColor = colorProp.k as number[];
          staticColor[0] = newColor[0]; // 替换红色通道
          staticColor[1] = newColor[1]; // 替换绿色通道
          staticColor[2] = newColor[2]; // 替换蓝色通道
          // alpha 通道保持不变
        } else {
          // 关键帧动画颜色：k 是关键帧对象数组
          const keyframes = colorProp.k as LottieKeyframe[];
          for (const kf of keyframes) { // 遍历每个关键帧
            if (Array.isArray(kf.s) && kf.s.length >= 3) {
              kf.s[0] = newColor[0]; // 替换起始颜色 R
              kf.s[1] = newColor[1]; // 替换起始颜色 G
              kf.s[2] = newColor[2]; // 替换起始颜色 B
            }
            if (Array.isArray(kf.e) && kf.e.length >= 3) {
              kf.e[0] = newColor[0]; // 替换结束颜色 R
              kf.e[1] = newColor[1]; // 替换结束颜色 G
              kf.e[2] = newColor[2]; // 替换结束颜色 B
            }
          }
        }
      }
    }
  }
}

/**
 * 递归替换 Lottie JSON 中所有图层的颜色
 *
 * 遍历顶层 layers 数组，对每个图层的 shapes 调用颜色替换
 *
 * @param lottieJson - Lottie JSON 对象
 * @param newColor - 归一化 RGB 三元组
 */
function replaceAllColors(lottieJson: LottieJson, newColor: [number, number, number]): void {
  if (!Array.isArray(lottieJson.layers)) return; // 无图层则跳过

  for (const layer of lottieJson.layers) { // 遍历每个图层
    if (Array.isArray(layer.shapes)) { // 有形状数据
      replaceShapeColors(layer.shapes, newColor); // 替换形状中的颜色
    }
  }
  log.debug(`已替换所有颜色为 [${newColor.join(', ')}]`); // 调试日志
}

// ============================================================================
// 公开 API
// ============================================================================

/**
 * 列出所有可用的 Lottie 模板
 *
 * 扫描 data/lottie-templates/ 目录下的所有 JSON 文件，
 * 读取每个文件的 nm 字段作为模板名称，结合硬编码索引返回元信息。
 *
 * @returns 模板列表
 */
export async function listTemplates(): Promise<LottieTemplate[]> {
  const templatesDir = getTemplatesDir(); // 获取模板目录路径
  log.info(`扫描模板目录: ${templatesDir}`); // 信息日志

  const files = await fs.readdir(templatesDir); // 读取目录文件列表
  const jsonFiles = files.filter((f) => f.endsWith('.json')); // 过滤出 JSON 文件
  log.info(`发现 ${jsonFiles.length} 个模板文件`); // 信息日志

  const templates: LottieTemplate[] = []; // 结果数组

  for (const file of jsonFiles) { // 遍历每个 JSON 文件
    const id = file.replace('.json', ''); // 文件名去掉扩展名作为模板 ID
    const filePath = path.join(templatesDir, file); // 完整文件路径

    try {
      const content = await fs.readFile(filePath, 'utf-8'); // 读取文件内容
      const json = JSON.parse(content) as LottieJson; // 解析为 JSON

      templates.push({
        id,                                                          // 模板 ID
        name: TEMPLATE_NAME_MAP[id] || json.nm || id,                // 优先使用中文名映射，其次 nm 字段
        description: TEMPLATE_DESC_MAP[id] || `Lottie 动画: ${id}`,  // 优先使用描述映射
        loop: true,                                                   // 默认循环（大多数模板设计为循环）
        defaultFrames: json.op - json.ip,                            // 结束帧 - 起始帧 = 总帧数
        category: TEMPLATE_CATEGORY_MAP[id] || '未分类',              // 从分类映射获取
      });

      log.debug(`已加载模板: ${id} (${json.nm})`); // 调试日志
    } catch (err) {
      log.warn(`读取模板 ${file} 失败: ${(err as Error).message}`); // 警告日志，跳过损坏文件
    }
  }

  log.info(`成功加载 ${templates.length} 个模板`); // 信息日志
  return templates; // 返回模板列表
}

/**
 * 从模板生成自定义 Lottie 动画 JSON
 *
 * 读取指定模板文件，根据选项替换颜色、尺寸、帧率，
 * 可选写入到指定路径。
 *
 * @param options - 生成选项
 * @returns 生成的 Lottie JSON 对象
 */
export async function generateAnimation(options: LottieGenerateOptions): Promise<LottieJson> {
  const { templateId, color, width, height, fps, outputPath } = options; // 解构选项
  const templatesDir = getTemplatesDir(); // 获取模板目录
  const filePath = path.join(templatesDir, `${templateId}.json`); // 拼接模板文件路径

  log.info(`生成动画: 模板=${templateId}, 颜色=${color || '默认'}, 尺寸=${width || 200}x${height || 200}`); // 信息日志

  // 读取并解析模板 JSON
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8'); // 读取模板文件
  } catch {
    throw new Error(`模板 '${templateId}' 不存在，请检查模板 ID`); // 模板不存在时抛出错误
  }

  const lottieJson = JSON.parse(content) as LottieJson; // 解析为对象
  log.debug(`模板原始参数: ${lottieJson.w}x${lottieJson.h}, ${lottieJson.fr}fps, ${lottieJson.op - lottieJson.ip}帧`);

  // 替换颜色（如果指定）
  if (color) {
    // 校验 hex 格式
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      throw new Error(`颜色格式无效: '${color}'，请使用 '#RRGGBB' 格式`); // 格式校验
    }
    const normalizedColor = hexToRgb(color); // 转换为归一化 RGB
    log.info(`替换颜色: ${color} → [${normalizedColor.join(', ')}]`); // 信息日志
    replaceAllColors(lottieJson, normalizedColor); // 执行颜色替换
  }

  // 替换画布尺寸（如果指定）
  if (width !== undefined) {
    lottieJson.w = width; // 更新宽度
    log.debug(`画布宽度设为 ${width}`);
  }
  if (height !== undefined) {
    lottieJson.h = height; // 更新高度
    log.debug(`画布高度设为 ${height}`);
  }

  // 替换帧率（如果指定）
  if (fps !== undefined) {
    lottieJson.fr = fps; // 更新帧率
    log.debug(`帧率设为 ${fps}`);
  }

  // 输出到文件（如果指定路径）
  if (outputPath) {
    const outputDir = path.dirname(outputPath); // 输出文件所在目录
    await fs.mkdir(outputDir, { recursive: true }); // 确保目录存在
    await fs.writeFile(outputPath, JSON.stringify(lottieJson, null, 2), 'utf-8'); // 格式化写入
    log.info(`动画已写入: ${outputPath}`); // 信息日志
  }

  log.info(`动画生成完成: ${templateId}`); // 完成日志
  return lottieJson; // 返回 JSON 对象
}

/**
 * 获取指定模板的详细信息
 *
 * 读取模板 JSON 文件，提取元信息返回。
 *
 * @param templateId - 模板 ID，如 'spinner-circular'
 * @returns 模板元信息
 */
export async function getTemplateInfo(templateId: string): Promise<LottieTemplate> {
  const templatesDir = getTemplatesDir(); // 获取模板目录
  const filePath = path.join(templatesDir, `${templateId}.json`); // 拼接路径

  log.info(`获取模板信息: ${templateId}`); // 信息日志

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8'); // 读取模板文件
  } catch {
    throw new Error(`模板 '${templateId}' 不存在，请检查模板 ID`); // 不存在时报错
  }

  const json = JSON.parse(content) as LottieJson; // 解析 JSON

  const template: LottieTemplate = {
    id: templateId,                                                  // 模板 ID
    name: TEMPLATE_NAME_MAP[templateId] || json.nm || templateId,    // 中文名称
    description: TEMPLATE_DESC_MAP[templateId] || `Lottie 动画: ${templateId}`, // 描述
    loop: true,                                                       // 循环标记
    defaultFrames: json.op - json.ip,                                // 默认帧数
    category: TEMPLATE_CATEGORY_MAP[templateId] || '未分类',          // 分类
  };

  log.info(`模板信息: ${template.name} [${template.category}] ${template.defaultFrames}帧`); // 信息日志
  return template; // 返回模板元信息
}
