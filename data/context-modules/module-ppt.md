<!-- qflow 上下文模块: ppt-reference -->
<!-- 通过 qflow_context_load 加载 -->
<!-- 功能：PPT 生成参考文档，涵盖 17 种视觉风格、4 维度自定义、python-pptx 代码模式 -->
<!-- 注意：此模块为参考文档，实际 PPT 生成请使用 /ppt-generate Skill -->

## 一、风格系统（17 预设 + 4 维度自定义）

### 1.1 风格预设一览

| 预设 ID | 中文名 | 维度组合 | 最佳场景 |
|---------|--------|----------|----------|
| `blueprint` | 蓝图技术风 | grid + cool + technical + balanced | 架构设计、技术方案 |
| `chalkboard` | 黑板教学风 | organic + warm + handwritten + balanced | 教育、培训 |
| `corporate` | 企业商务风 | clean + professional + geometric + balanced | 投资路演、季度汇报 |
| `minimal` | 极简风 | clean + neutral + geometric + minimal | 高管简报 |
| `sketch-notes` | 手绘笔记风 | organic + warm + handwritten + balanced | 教育分享、读书笔记 |
| `hand-drawn-edu` | 手绘教学风 | organic + macaron + handwritten + balanced | 教学图解 |
| `watercolor` | 水彩风 | organic + warm + humanist + minimal | 生活方式、旅行 |
| `dark-atmospheric` | 暗黑氛围风 | clean + dark + editorial + balanced | 娱乐、游戏 |
| `notion` | Notion 产品风 | clean + neutral + geometric + dense | 产品演示、SaaS |
| `bold-editorial` | 大胆杂志风 | clean + vibrant + editorial + balanced | 产品发布、营销 |
| `editorial-infographic` | 信息图表风 | clean + cool + editorial + dense | 技术科普、研究报告 |
| `fantasy-animation` | 奇幻动画风 | organic + vibrant + handwritten + minimal | 故事叙述 |
| `intuition-machine` | 学术直觉风 | clean + cool + technical + dense | 学术报告、论文答辩 |
| `pixel-art` | 像素艺术风 | pixel + vibrant + technical + balanced | 游戏、开发者 |
| `scientific` | 科学论文风 | clean + cool + technical + dense | 生物、医学 |
| `vector-illustration` | 矢量插画风 | clean + vibrant + humanist + balanced | 创意设计 |
| `vintage` | 复古怀旧风 | paper + warm + editorial + balanced | 历史、文化 |

### 1.2 四维度自定义

| 维度 | 可选值 | 说明 |
|------|--------|------|
| **Texture（质感）** | `clean` · `grid` · `organic` · `pixel` · `paper` | 背景视觉处理 |
| **Mood（色调）** | `professional` · `warm` · `cool` · `vibrant` · `dark` · `neutral` · `macaron` | 色彩温度和调性 |
| **Typography（字体）** | `geometric` · `humanist` · `handwritten` · `editorial` · `technical` | 标题和正文排版 |
| **Density（密度）** | `minimal` · `balanced` · `dense` | 每页信息密度 |

### 1.3 内容信号→自动匹配风格

| 内容信号 | 推荐预设 |
|----------|----------|
| 教程、学习、教育、指南 | `sketch-notes` |
| 手绘、信息图、流程图 | `hand-drawn-edu` |
| 课堂、教学、黑板 | `chalkboard` |
| 架构、系统、数据、技术方案 | `blueprint` |
| 创意、儿童、卡通 | `vector-illustration` |
| 简报、学术、研究、双语 | `intuition-machine` |
| 高管、极简 | `minimal` |
| SaaS、产品、数据看板 | `notion` |
| 投资、季度、商务 | `corporate` |
| 发布、营销、演讲、杂志 | `bold-editorial` |
| 娱乐、音乐、游戏、暗黑 | `dark-atmospheric` |
| 科普、新闻 | `editorial-infographic` |
| 故事、奇幻、动画 | `fantasy-animation` |
| 游戏开发、复古、像素 | `pixel-art` |
| 生物、化学、医学 | `scientific` |
| 历史、文化遗产 | `vintage` |
| 生活方式、健康、旅行 | `watercolor` |
| 年终总结、述职报告 | `corporate` |
| 默认 | `blueprint` |

---

## 二、受众适配策略

| 受众类型 | 信息密度 | 用语风格 | 每页要点 |
|----------|----------|----------|----------|
| **beginners** | 低 | 通俗、多类比 | 1-2 |
| **intermediate** | 中 | 适度术语 | 2-3 |
| **experts** | 高 | 领域术语、数据驱动 | 3-5 |
| **executives** | 极低 | 结论先行 | 1 |
| **general** | 中 | 通用表达 | 2-3 |

---

## 三、幻灯片数量指南

| 内容长度 | 推荐页数 |
|----------|----------|
| < 1000 字 | 5-10 页 |
| 1000-3000 字 | 10-18 页 |
| 3000-5000 字 | 15-25 页 |
| > 5000 字 | 20-30 页（建议拆分） |

---

## 四、9 步结构化工作流

```
输入 → 分析 → 确认风格 → 生成大纲 → [审查大纲] → 内容研究 → 图表 → 备注 → 渲染导出
```

1. **分析输入**：分析内容信号匹配风格，检测语言、估算页数、识别受众
2. **确认参数**：向用户确认风格、受众、页数、是否审查大纲/内容
3. **生成大纲**：输出 slides_data 列表（type/title/points/chart_type/notes 等）
4. **审查大纲**（条件执行）
5. **内容研究**：为每页补充数据、论据、案例
6. **图表创建**：bar/pie/line/area/scatter
7. **演讲备注**：每页 2-4 句
8. **渲染导出**：PPTX + PDF + 图片序列
9. **输出总结**

**页面类型：** `title`（封面）| `section`（章节分隔）| `content`（内容页）| `chart`（图表）| `quote`（引用）| `comparison`（对比）| `timeline`（时间线）

---

## 五、配色映射表

| 预设 | 主色 | 辅色 | 背景色 | 文字色 | 强调色 |
|------|------|------|--------|--------|--------|
| `blueprint` | #1a5276 | #2e86c1 | #f0f3f5 | #2c3e50 | #e74c3c |
| `corporate` | #1b2a4a | #2c5f8a | #ffffff | #333333 | #c0392b |
| `minimal` | #333333 | #666666 | #ffffff | #333333 | #000000 |
| `dark-atmospheric` | #e0e0e0 | #bb86fc | #121212 | #e0e0e0 | #cf6679 |
| `notion` | #37352f | #6b6b6b | #ffffff | #37352f | #2eaadc |
| `bold-editorial` | #ff3366 | #6c5ce7 | #ffffff | #2d3436 | #fdcb6e |
| `scientific` | #0d47a1 | #1565c0 | #fafafa | #212121 | #ff6f00 |
| `watercolor` | #6d4c41 | #8d6e63 | #fdf6ec | #4e342e | #26a69a |
| `vintage` | #5d4037 | #795548 | #f5f0e8 | #3e2723 | #bf360c |
| `sketch-notes` | #2c3e50 | #e67e22 | #fefcf5 | #2c3e50 | #e74c3c |
| `chalkboard` | #ffffff | #ffd54f | #2d3436 | #ffffff | #ff7675 |
| `pixel-art` | #00e676 | #7c4dff | #212121 | #ffffff | #ff1744 |
| `hand-drawn-edu` | #5c6bc0 | #26a69a | #faf3e0 | #37474f | #ef5350 |
| `editorial-infographic` | #1565c0 | #00897b | #fafafa | #263238 | #ff6f00 |
| `fantasy-animation` | #7b1fa2 | #ff6f00 | #fff8e1 | #4a148c | #00bfa5 |
| `intuition-machine` | #1a237e | #0097a7 | #eceff1 | #263238 | #ff5722 |
| `vector-illustration` | #e91e63 | #00bcd4 | #ffffff | #333333 | #ffc107 |

### 字体映射

| Typography 维度 | macOS 字体 | Windows 字体 |
|----------------|-----------|-------------|
| `geometric` | Helvetica Neue / 苹方 | Segoe UI / 微软雅黑 |
| `humanist` | Avenir / 苹方 | Calibri / 微软雅黑 |
| `handwritten` | Bradley Hand / 手写体 | Segoe Script / 华文行楷 |
| `editorial` | Georgia / 宋体 | Cambria / 宋体 |
| `technical` | SF Mono / 等宽苹方 | Consolas / 等线 |

---

## 六、python-pptx 核心代码模板

```python
# 功能：PPT 生成引擎 v2.0 — 支持 17 种风格预设 + 7 种页面类型
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.chart import XL_CHART_TYPE
from pptx.chart.data import CategoryChartData
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 风格配置示例（完整 17 预设见配色映射表）
STYLE_PRESETS: dict[str, dict] = {
    "blueprint": {
        "bg": RGBColor(0xF0, 0xF3, 0xF5),
        "primary": RGBColor(0x1A, 0x52, 0x76),
        "secondary": RGBColor(0x2E, 0x86, 0xC1),
        "text": RGBColor(0x2C, 0x3E, 0x50),
        "accent": RGBColor(0xE7, 0x4C, 0x3C),
        "title_size": Pt(36), "body_size": Pt(18), "title_bold": True,
    },
    # ... 其余 16 种预设同理
}


def create_presentation(
    title: str,
    slides_data: list[dict],
    output_path: str,
    style: str = "blueprint",
) -> None:
    """
    创建完整的 PPT 演示文稿
    参数: title=标题, slides_data=幻灯片数据, output_path=输出路径, style=风格预设名
    """
    prs = Presentation()
    prs.slide_width = Inches(13.333)   # 16:9 宽屏
    prs.slide_height = Inches(7.5)
    theme = STYLE_PRESETS.get(style, STYLE_PRESETS["blueprint"])
    logger.info(f"开始创建演示文稿: {title} | 风格: {style}")

    for i, slide_data in enumerate(slides_data):
        slide_type = slide_data.get("type", "content")
        logger.info(f"正在创建第 {i + 1} 页: {slide_data.get('title', '无标题')} [{slide_type}]")
        # 根据 slide_type 分发到对应渲染函数
        # title -> _add_title_slide, section -> _add_section_slide
        # content -> _add_content_slide, chart -> _add_chart_slide
        # quote -> _add_quote_slide, comparison -> _add_comparison_slide
        # timeline -> _add_timeline_slide

    prs.save(output_path)
    logger.info(f"演示文稿已保存: {output_path} ({len(slides_data)} 页)")


def _apply_bg(slide, theme: dict) -> None:
    """应用背景色"""
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = theme["bg"]


def _add_title_slide(prs, data: dict, theme: dict) -> None:
    """封面页：大标题 + 副标题"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])  # 空白布局
    _apply_bg(slide, theme)
    # 标题文本框
    txBox = slide.shapes.add_textbox(Inches(1), Inches(2.5), Inches(11), Inches(1.5))
    tf = txBox.text_frame; tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = data.get("title", "")
    p.font.size = Pt(44); p.font.color.rgb = theme["primary"]
    p.font.bold = theme.get("title_bold", True); p.alignment = PP_ALIGN.CENTER
    # 副标题
    if data.get("subtitle"):
        txBox2 = slide.shapes.add_textbox(Inches(2), Inches(4.2), Inches(9), Inches(1))
        tf2 = txBox2.text_frame; tf2.word_wrap = True
        p2 = tf2.paragraphs[0]
        p2.text = data["subtitle"]
        p2.font.size = Pt(22); p2.font.color.rgb = theme["secondary"]
        p2.alignment = PP_ALIGN.CENTER


def _add_content_slide(prs, data: dict, theme: dict) -> None:
    """内容页：标题 + 要点列表"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _apply_bg(slide, theme)
    # 标题
    txBox = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11), Inches(1))
    p = txBox.text_frame.paragraphs[0]
    p.text = data.get("title", "")
    p.font.size = theme["title_size"]; p.font.color.rgb = theme["primary"]
    p.font.bold = theme.get("title_bold", True)
    # 要点
    txBox2 = slide.shapes.add_textbox(Inches(1), Inches(1.8), Inches(11), Inches(5))
    tf2 = txBox2.text_frame; tf2.word_wrap = True
    for j, point in enumerate(data.get("points", [])):
        pp = tf2.paragraphs[0] if j == 0 else tf2.add_paragraph()
        pp.text = f"• {point}"
        pp.font.size = theme["body_size"]; pp.font.color.rgb = theme["text"]
        if j > 0: pp.space_before = Pt(12)
    # 备注
    if data.get("notes"):
        slide.notes_slide.notes_text_frame.text = data["notes"]


def _add_chart_slide(prs, data: dict, theme: dict) -> None:
    """图表页"""
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    _apply_bg(slide, theme)
    # 标题
    txBox = slide.shapes.add_textbox(Inches(0.5), Inches(0.3), Inches(11), Inches(0.8))
    p = txBox.text_frame.paragraphs[0]
    p.text = data.get("title", ""); p.font.size = Pt(28)
    p.font.bold = True; p.font.color.rgb = theme["primary"]
    # 图表数据
    chart_data = CategoryChartData()
    chart_data.categories = data.get("categories", [])
    for series_name, values in data.get("series", {}).items():
        chart_data.add_series(series_name, values)
    ct_map = {
        "bar": XL_CHART_TYPE.COLUMN_CLUSTERED, "pie": XL_CHART_TYPE.PIE,
        "line": XL_CHART_TYPE.LINE, "area": XL_CHART_TYPE.AREA,
        "scatter": XL_CHART_TYPE.XY_SCATTER,
    }
    ct = ct_map.get(data.get("chart_type", "bar"), XL_CHART_TYPE.COLUMN_CLUSTERED)
    slide.shapes.add_chart(ct, Inches(1), Inches(1.5), Inches(10), Inches(5.5), chart_data)
```

### 渲染导出命令

```bash
# PPTX → PDF（LibreOffice）
libreoffice --headless --convert-to pdf output.pptx
# PPTX → PDF（macOS Keynote）
osascript -e 'tell application "Keynote" to export front document to POSIX file "/path/output.pdf" as PDF'
# PDF → 图片序列
pdftoppm output.pdf slide -png -r 300
```

---

## 七、设计原则

1. **为阅读和分享设计**：每页独立可理解，无需口头补充
2. **视觉层次清晰**：标题 > 要点 > 辅助说明，字号递减
3. **信息密度适中**：根据受众类型控制每页内容量
4. **风格一致性**：整套 PPT 使用统一的配色、字体、间距
5. **逻辑流畅**：页面之间有清晰的叙事逻辑和过渡

---

## 八、协作模块

| 模块 | 职责 |
|------|------|
| ppt-outline | 根据主题自动生成幻灯片大纲结构 |
| ppt-research | 为每页补充要点和数据 |
| ppt-chart | 插入柱状图、饼图、折线图等 |
| ppt-notes | 为每页生成演讲者备注 |
| ppt-render | 导出为 PPTX、PDF、图片序列 |
