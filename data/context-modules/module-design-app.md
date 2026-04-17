<!-- qflow 上下文模块: design-app -->
<!-- 通过 qflow_context_load 加载 -->
<!-- 功能: App 设计风格系统，涵盖 iOS HIG + Material Design 3 色彩/排版/间距/圆角/阴影 Token、暗色模式、组件模式、动效曲线、平台差异 -->

## App 设计风格系统

> 适用于 iOS (SwiftUI) + Android (Jetpack Compose) 的 App UI 设计规范
> 在 Pencil (.pen) 设计稿和代码实现中同时适用

---

### 一、App 设计风格参考

| 风格 | 特征 | 适用场景 |
|------|------|---------|
| **Glassmorphism** | 毛玻璃+透明度+模糊背景 | 音乐/天气/壁纸类 App |
| **Neumorphism 2.0** | 柔和凸起+凹陷+微阴影 | 计算器/工具类（慎用，可达性差） |
| **Aurora UI** | 大面积渐变+流动色彩+深色背景 | 金融/加密/科技 App |
| **Bento Grid** | 网格卡片布局+圆角+间距 | 仪表盘/健康/智能家居 |
| **Minimalist Material** | Material You + 动态取色 + 大圆角 | 通用 Android App |
| **Clean iOS** | 大标题+系统模糊+SF Symbols | 通用 iOS App |

---

### 二、色彩系统

#### 2.1 语义色彩 Token

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `color_bg` | #F5F5F7 | #0A0A0B | 页面背景 |
| `color_surface` | #FFFFFF | #1C1C1E | 卡片/容器背景 |
| `color_elevated` | #FFFFFF | #2C2C2E | 浮层/弹窗背景 |
| `color_primary` | 品牌主色 | 品牌主色(可调亮) | 按钮/关键操作 |
| `color_secondary` | 品牌辅色 | 品牌辅色 | 次要操作/标签 |
| `color_text_primary` | #1C1C1E | #F5F5F7 | 主文本 |
| `color_text_secondary` | #8E8E93 | #98989D | 辅助文本 |
| `color_text_tertiary` | #C7C7CC | #48484A | 占位/禁用文本 |
| `color_border` | #E5E5EA | #38383A | 分割线/边框 |
| `color_success` | #34C759 | #30D158 | 成功状态 |
| `color_warning` | #FF9500 | #FF9F0A | 警告状态 |
| `color_error` | #FF3B30 | #FF453A | 错误状态 |

#### 2.2 色彩规则

- 背景色层级：bg < surface < elevated（从暗到亮/从亮到暗）
- 文本色与背景对比度 >= 4.5:1（WCAG AA）
- 主色不超过 2 种（主色+辅色），状态色 3 种（成功/警告/错误）
- 渐变方向统一：主方向从上到下（180度）或从左上到右下（135度）
- 透明度用 hex 后缀表示，不用 opacity 属性

#### 2.3 暗色模式注意事项

- 暗色背景不要用纯黑 #000000 -> 用 #0A0A0B 或 #121212
- 暗色模式下主色可以适当调亮 10-20%
- 阴影在暗色模式下效果很弱 -> 用更明显的 border 或 elevation 替代
- 图片/插图需要降低亮度或加暗色 overlay

---

### 三、排版系统

#### 3.1 字号阶梯

| Token | 尺寸 | 行高 | 字重 | 用途 |
|-------|------|------|------|------|
| `font_3xl` | 28-32sp | 1.2 | 700 | 大标题/Hero |
| `font_2xl` | 24sp | 1.25 | 700 | 页面标题 |
| `font_xl` | 20sp | 1.3 | 600 | 区块标题 |
| `font_lg` | 16-17sp | 1.4 | 600 | 卡片标题 |
| `font_base` | 14-15sp | 1.5 | 400 | 正文 |
| `font_sm` | 12-13sp | 1.4 | 400 | 辅助文本/标签 |
| `font_xs` | 10-11sp | 1.3 | 400 | 极小文本/角标 |

#### 3.2 排版规则

- iOS 用系统字体（SF Pro），Android 用 Roboto 或 Noto Sans CJK
- Pencil 设计稿统一用 Inter（Pencil 只支持 Inter 渲染）
- 标题不超过 2 行，正文建议 maxLines
- 中文内容 letterSpacing 不要太大（0-0.3sp）
- 数字建议用等宽数字（tabularFigures）

---

### 四、间距系统（4px 基数）

#### 4.1 间距阶梯

| Token | 值 | 用途 |
|-------|-----|------|
| `spacing_xs` | 4dp | 图标与文字间距、极小间隔 |
| `spacing_sm` | 8dp | 相关元素间距、卡片内紧凑间距 |
| `spacing_md` | 12dp | 列表项间距、组件内间距 |
| `spacing_base` | 16dp | 卡片内边距、区块间距 |
| `spacing_lg` | 24dp | 区块之间、页面内边距 |
| `spacing_xl` | 32dp | 大区块间距 |
| `spacing_xxl` | 48dp | 页面顶部/底部安全区 |

#### 4.2 间距规则

- 页面水平内边距：16dp（标准）或 20dp（宽松）
- 卡片内边距：12-16dp
- 卡片之间：12dp（紧凑）或 16dp（标准）
- 区块标题与内容：8-12dp
- 列表项垂直间距：8-12dp
- 底部 TabBar 预留：至少 56dp + 安全区

---

### 五、圆角系统

| Token | 值 | 用途 |
|-------|-----|------|
| `radius_xs` | 4dp | 小按钮、标签、进度条 |
| `radius_sm` | 8dp | 输入框、小卡片 |
| `radius_md` | 12dp | 标准卡片、弹窗 |
| `radius_lg` | 16dp | 大卡片、底部弹窗 |
| `radius_xl` | 20-24dp | 按钮、特殊容器 |
| `radius_full` | 9999dp | 圆形头像、胶囊按钮 |

**规则：** 嵌套圆角 = 外层圆角 - 内边距（防止视觉不协调）

---

### 六、阴影系统

#### Light 模式

| 层级 | offset | blur | spread | color | 用途 |
|------|--------|------|--------|-------|------|
| 无 | - | - | - | - | 平面元素 |
| sm | (0,1) | 3 | 0 | #0000001A | 轻微浮起 |
| md | (0,4) | 12 | 0 | #00000026 | 卡片、按钮 |
| lg | (0,8) | 24 | 0 | #00000033 | 弹窗、浮层 |
| xl | (0,16) | 48 | 0 | #00000040 | 模态弹窗 |

#### Dark 模式

- 用 1px border（#FFFFFF0D ~ #FFFFFF1A）替代轻阴影
- 用 background_blur + 半透明背景替代中阴影
- 保留 lg/xl 阴影但加深颜色（#00000066）

---

### 七、组件设计模式

#### 7.1 导航栏（Navigation Bar）

```
+-----------------------------------------+
| <- 返回      页面标题        [操作按钮]  |  <- 高度 44-56dp
+-----------------------------------------+
```
- iOS: 大标题模式（largeTitle 向上滚动折叠）
- Android: TopAppBar（Medium/Large/CenterAligned）
- 背景：实色或毛玻璃 background_blur

#### 7.2 标签栏（Tab Bar）

```
+-------+-------+-------+-------+-------+
| 首页  | 发现  | 创建  | 消息  | 我的  |  <- 高度 56dp + 安全区
+-------+-------+-------+-------+-------+
```
- 最多 5 个 Tab
- 选中态：主色图标+主色文字 / 填充图标
- 未选中态：灰色图标+灰色文字 / 线框图标
- 图标尺寸：24dp，文字：10-11sp

#### 7.3 卡片（Card）

```
+----------------------------------+
|  [图片区域 - 16:9 / 1:1]        |  <- cornerRadius: 12-16dp
|                                  |
+----------------------------------+
|  标题文本                        |  <- padding: 12-16dp
|  描述文本（最多2行）             |
|  [操作区域]                      |
+----------------------------------+
```
- 图片卡片：图片在上，文本在下
- 横向卡片：图片在左（正方形），文本在右
- 操作卡片：无图片，标题+描述+按钮

#### 7.4 列表项（List Item）

```
+--+----------------------------+--+
|O | 主文本                      | >|  <- 最小高度 56dp
|  | 副文本                      |  |
+--+----------------------------+--+
```
- 左侧：图标(24dp)/头像(40dp)/缩略图(48dp)
- 右侧：箭头/开关/文本/徽章
- 分割线：indent 从文本对齐位置开始

#### 7.5 按钮

| 类型 | 样式 | 用途 |
|------|------|------|
| Primary | 品牌色填充 + 白色文字 + 大圆角 | 主操作 CTA |
| Secondary | 边框 + 品牌色文字 | 次要操作 |
| Tertiary | 无背景 + 品牌色文字 | 低优先级操作 |
| Destructive | 红色填充/边框 | 删除/危险操作 |
| Disabled | 灰色低透明度 | 不可操作状态 |

- 最小尺寸：高度 44dp(iOS)/48dp(Android)，宽度 120dp
- 文字大小：14-16sp，字重 600
- 圆角：全圆角(radius_full) 或 中圆角(radius_xl)

#### 7.6 弹窗（Dialog / Bottom Sheet）

**Center Dialog：**
- 宽度：280-320dp（居中）
- 圆角：radius_lg (16dp)
- 背景：color_elevated + shadow_xl
- 遮罩：#00000066

**Bottom Sheet：**
- 宽度：100%
- 顶部圆角：radius_lg (16dp)
- 拖拽手柄：40x4dp 居中
- 最大高度：屏幕 90%

#### 7.7 空状态

- 居中插图/图标（120-160dp）
- 标题（font_xl，color_text_primary）
- 描述（font_base，color_text_secondary）
- 操作按钮（可选）
- 整体居中偏上（距顶 40%）

---

### 八、动效规范

#### 8.1 时间 Token

| Token | 值 | 场景 |
|-------|-----|------|
| duration_micro | 100ms | 按压反馈、微交互 |
| duration_fast | 150ms | hover、focus、按钮态 |
| duration_standard | 300ms | 页面转场、弹窗、fadeIn |
| duration_slow | 500ms | 复杂展开/折叠 |
| duration_emphasis | 800ms | 强调动画、引导 |

#### 8.2 缓动曲线

| 曲线 | 用途 |
|------|------|
| ease-out (0.0, 0.0, 0.2, 1.0) | 元素进入（弹窗打开、页面进入） |
| ease-in (0.4, 0.0, 1.0, 1.0) | 元素退出（弹窗关闭、页面退出） |
| ease-in-out (0.4, 0.0, 0.2, 1.0) | 页面转场、状态切换 |
| linear | 进度条、循环动画 |
| spring(damping=0.75) | 弹性反馈（按钮、拖拽） |

#### 8.3 常见动效模式

| 动效 | 属性 | 参数 | 用途 |
|------|------|------|------|
| 页面转场 | translateX + opacity | 300ms ease-in-out | 导航前进/后退 |
| 弹窗打开 | translateY + opacity | 300ms ease-out | 底部弹窗向上滑入 |
| 弹窗关闭 | translateY + opacity | 200ms ease-in | 向下滑出 |
| 按钮按压 | scale(0.95-0.97) | 100-150ms | 触觉反馈 |
| 列表加载 | opacity + translateY | 300ms ease-out, 50ms stagger | 逐项渐入 |
| 骨架屏 | shimmer gradient | 1500ms linear loop | 加载占位 |
| 下拉刷新 | scale + rotation | Material 标准 | 刷新指示器 |
| Tab 切换 | color + scale | 200ms ease-out | 选中/未选中态 |

---

### 九、图标设计规范

#### 9.1 系统图标

- iOS: SF Symbols（系统内建，配合 font weight 使用）
- Android: Material Symbols（Rounded 推荐）
- Pencil: Lucide Icons（默认图标库）

#### 9.2 自定义图标

- 尺寸：24x24dp（标准）、20x20dp（小）、32x32dp（大）
- 笔触：1.5-2px 统一粗细
- 圆角：与 App 圆角体系一致
- 颜色：单色，跟随 fill 属性变色
- 格式：SVG（矢量）-> Android VectorDrawable / iOS SF Symbol Template

#### 9.3 应用图标

- Android: 自适应图标（前景 108dp + 背景 108dp，安全区 72dp）
- iOS: 1024x1024px 方图，系统自动加圆角
- 风格：简洁、可识别、避免文字、品牌色为主

---

### 十、页面结构模板

#### 10.1 列表页

```
NavigationBar
|- SearchBar (可选)
|- FilterTabs (可选)
|- LazyColumn
|   |- SectionHeader
|   |- ListItem x N
|   |- ...
|   +- LoadMoreIndicator
+- FloatingActionButton (可选)
```

#### 10.2 详情页

```
CollapsingToolbar (图片/视频)
|- Header (标题、副标题、元信息)
|- ActionBar (点赞、分享、收藏)
|- ContentSection x N
|   |- SectionTitle
|   +- SectionContent
|- RelatedSection
+- BottomBar (操作按钮)
```

#### 10.3 设置页

```
NavigationBar (设置)
|- UserProfileCard
|- SettingsGroup
|   |- SettingsItem (开关/箭头/值)
|   +- ...
|- SettingsGroup
|   +- ...
+- AppInfo (版本号、退出登录)
```

---

### 十一、平台差异速查

| 特性 | iOS (HIG) | Android (M3) |
|------|-----------|-------------|
| 导航 | NavigationStack + sheet | NavHost + Scaffold |
| 返回 | 滑动返回手势 | 系统返回键 |
| 标签栏位置 | 底部 | 底部(推荐)/顶部 |
| 标准圆角 | 12-16pt | 12-16dp |
| 主色来源 | 设计师定义 | 动态取色(Material You) |
| 字体 | SF Pro | Roboto / Noto Sans |
| 图标 | SF Symbols | Material Symbols |
| 弹窗样式 | 居中 Alert | 居中 AlertDialog |
| 底部弹窗 | Sheet | ModalBottomSheet |
| 状态栏 | 系统自适应 | 透明+深色/浅色图标 |
| 安全区 | safeAreaInsets | WindowInsets |
