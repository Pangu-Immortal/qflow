<!-- qflow 上下文模块: design-web -->
<!-- 通过 qflow_context_load 加载 -->
<!-- 功能: Web 设计风格系统，涵盖响应式断点、色彩/排版/间距/圆角/阴影 Token、组件模式、页面模板、动效规范、Vue+Vant 集成 -->

## Web 设计风格系统

> 适用于 Vue + Vant + TypeScript 的 Web 项目设计规范
> 覆盖 SaaS Dashboard、Landing Page、Admin Panel、H5 移动页面

---

### 一、Web 设计风格参考

| 风格 | 特征 | 适用场景 |
|------|------|---------|
| **Bento Grid** | 不规则网格+大圆角+丰富留白 | 产品官网、Portfolio |
| **Neo-Brutalism** | 粗边框+鲜艳色块+黑色阴影 | 创意/独立品牌 |
| **Soft UI** | 柔和渐变+微阴影+玻璃态 | SaaS/工具类 |
| **Dark Immersive** | 深色背景+渐变高光+动态效果 | AI/科技/加密 |
| **Clean Corporate** | 白色基底+蓝色主色+规整网格 | 企业/B2B/Admin |
| **Organic/Natural** | 自然色调+手绘元素+不规则形状 | 生活/健康/环保 |

---

### 二、响应式断点

| 断点 | 宽度 | 布局 | 列数 | 内边距 |
|------|------|------|------|--------|
| xs (手机) | < 576px | 单列 | 1 | 16px |
| sm (大手机) | 576-767px | 单列/双列 | 1-2 | 20px |
| md (平板) | 768-991px | 多列 | 2-3 | 24px |
| lg (桌面) | 992-1199px | 多列 | 3-4 | 32px |
| xl (大桌面) | 1200-1399px | 多列 | 4-6 | 40px |
| xxl (超宽) | >= 1400px | 多列居中 | 4-6 | auto(居中) |

**最大内容宽度：** 1200px（标准）/ 1440px（宽版）

---

### 三、色彩系统

#### 3.1 语义色彩 Token

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `--bg-page` | #F7F8FA | #0F1117 | 页面背景 |
| `--bg-card` | #FFFFFF | #1A1D26 | 卡片背景 |
| `--bg-elevated` | #FFFFFF | #252830 | 弹窗/下拉背景 |
| `--bg-sidebar` | #F0F2F5 | #141720 | 侧边栏背景 |
| `--color-primary` | #4F46E5 | #6366F1 | 主色（Indigo 推荐） |
| `--color-primary-hover` | #4338CA | #818CF8 | 主色悬停 |
| `--color-primary-bg` | #EEF2FF | #1E1B4B | 主色浅背景 |
| `--text-primary` | #111827 | #F9FAFB | 主文本 |
| `--text-secondary` | #6B7280 | #9CA3AF | 辅助文本 |
| `--text-placeholder` | #9CA3AF | #4B5563 | 占位文本 |
| `--border-default` | #E5E7EB | #374151 | 默认边框 |
| `--border-light` | #F3F4F6 | #1F2937 | 轻边框 |
| `--color-success` | #10B981 | #34D399 | 成功 |
| `--color-warning` | #F59E0B | #FBBF24 | 警告 |
| `--color-error` | #EF4444 | #F87171 | 错误 |
| `--color-info` | #3B82F6 | #60A5FA | 信息 |

#### 3.2 品牌色推荐

| 行业 | 推荐主色 | Hex |
|------|---------|-----|
| 科技/SaaS | Indigo | #4F46E5 |
| 金融 | Deep Blue | #1E40AF |
| 健康/医疗 | Teal | #0D9488 |
| 教育 | Purple | #7C3AED |
| 电商 | Orange | #EA580C |
| 社交 | Blue | #2563EB |
| 创意 | Pink/Fuchsia | #D946EF |

---

### 四、排版系统

#### 4.1 字号阶梯

| Token | 尺寸 | 行高 | 字重 | 用途 |
|-------|------|------|------|------|
| `--font-hero` | 48-64px | 1.1 | 800 | 首屏大标题 |
| `--font-h1` | 36-40px | 1.2 | 700 | 页面标题 |
| `--font-h2` | 28-32px | 1.25 | 700 | 区块标题 |
| `--font-h3` | 22-24px | 1.3 | 600 | 卡片标题 |
| `--font-h4` | 18-20px | 1.4 | 600 | 小标题 |
| `--font-body` | 14-16px | 1.6 | 400 | 正文 |
| `--font-sm` | 12-13px | 1.5 | 400 | 辅助文本 |
| `--font-xs` | 10-11px | 1.4 | 400 | 角标/极小文本 |

#### 4.2 字体栈

```css
/* 西文优先 */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

/* 中文优先 */
font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;

/* 等宽（代码） */
font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
```

---

### 五、间距系统（4px 基数）

| Token | 值 | 用途 |
|-------|-----|------|
| `--space-1` | 4px | 极小间距 |
| `--space-2` | 8px | 紧凑间距 |
| `--space-3` | 12px | 组件内间距 |
| `--space-4` | 16px | 标准间距 |
| `--space-5` | 20px | 区块内间距 |
| `--space-6` | 24px | 区块间距 |
| `--space-8` | 32px | 大区块间距 |
| `--space-10` | 40px | Section 间距 |
| `--space-12` | 48px | 大 Section 间距 |
| `--space-16` | 64px | 页面级间距 |
| `--space-20` | 80px | Hero 区间距 |
| `--space-24` | 96px | 大 Hero 区间距 |

---

### 六、圆角系统

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | 4px | 小按钮、Tag |
| `--radius-md` | 8px | 输入框、小卡片 |
| `--radius-lg` | 12px | 标准卡片 |
| `--radius-xl` | 16px | 大卡片、弹窗 |
| `--radius-2xl` | 24px | Hero 区容器 |
| `--radius-full` | 9999px | 圆形/胶囊 |

---

### 七、阴影系统

| 层级 | CSS | 用途 |
|------|-----|------|
| none | none | 平面元素 |
| sm | `0 1px 2px rgba(0,0,0,0.05)` | 微浮起 |
| md | `0 4px 6px -1px rgba(0,0,0,0.1)` | 卡片 |
| lg | `0 10px 15px -3px rgba(0,0,0,0.1)` | 弹窗 |
| xl | `0 20px 25px -5px rgba(0,0,0,0.1)` | 模态 |
| inner | `inset 0 2px 4px rgba(0,0,0,0.06)` | 输入框 |

---

### 八、组件设计模式

#### 8.1 顶部导航栏（Header）

```
+----------------------------------------------------+
| [Logo]  首页  产品  定价  文档  博客    [登录] [注册]|  <- 高度 64px
+----------------------------------------------------+
```
- 高度：56-64px
- 背景：实色/毛玻璃（backdrop-filter: blur(12px)）
- sticky top + z-index: 100
- 移动端折叠为汉堡菜单

#### 8.2 侧边栏（Sidebar）— Dashboard/Admin

```
+----------+----------------------------------+
| [Logo]   |  Header / Breadcrumb             |
|          |                                   |
| 导航组1  |  Content Area                     |
|  |- 项目1|                                   |
|  |- 项目2|                                   |
|  +- 项目3|                                   |
|          |                                   |
| 导航组2  |                                   |
|  |- 项目4|                                   |
|  +- 项目5|                                   |
|          |                                   |
| [设置]   |                                   |
| [头像]   |                                   |
+----------+----------------------------------+
```
- 宽度：240px（展开）/ 64px（折叠）/ 隐藏（移动端）
- 背景：`--bg-sidebar`
- 选中态：`--color-primary-bg` + `--color-primary` 文字

#### 8.3 表格（Table）

```
+--------+----------+----------+---------+
| □ 名称  | 状态      | 日期      | 操作    |  <- 表头：bg-sidebar
+--------+----------+----------+---------+
| □ 项目A | ●运行中   | 04-16    | [编辑]  |  <- 行高 56px
| □ 项目B | ○已停止   | 04-15    | [编辑]  |
+--------+----------+----------+---------+
  共 100 条                     < 1 2 3 ... >
```
- 行高：48-56px
- 表头：font-weight 600 + 浅背景
- 斑马纹：可选（每隔一行微灰背景）
- 悬停行高亮：`--bg-card` -> `--bg-sidebar`
- 操作列：右对齐

#### 8.4 表单（Form）

| 元素 | 规范 |
|------|------|
| Label | font_sm + font-weight 500 + 上方 |
| Input | 高度 40px + border + radius_md + padding 12px |
| Error | 红色 font_xs + 下方 4px |
| 按钮组 | 右对齐，主按钮在右 |
| 列间距 | 24px |
| 行间距 | 16-20px |

#### 8.5 卡片（Card）

```css
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  padding: 24px;
  transition: box-shadow 0.2s, transform 0.2s;
}
.card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}
```

#### 8.6 面包屑（Breadcrumb）

```
首页 / 产品管理 / 编辑产品
```
- 分隔符：`/` 或 `>`
- 当前页：font-weight 600 + 不可点击
- 其他层级：`--text-secondary` + 可点击

#### 8.7 状态标签（Tag/Badge）

| 状态 | 背景 | 文字 |
|------|------|------|
| 成功/已完成 | #ECFDF5 | #059669 |
| 警告/处理中 | #FFFBEB | #D97706 |
| 错误/已拒绝 | #FEF2F2 | #DC2626 |
| 信息/草稿 | #EFF6FF | #2563EB |
| 默认/未知 | #F3F4F6 | #6B7280 |

---

### 九、页面模板

#### 9.1 Landing Page 结构

```
Header (导航)
|- Hero Section (大标题 + 副标题 + CTA + 产品截图)
|- Social Proof (客户 logo、用户数、评分)
|- Features Section (3-4 个特性卡片，图标+标题+描述)
|- How It Works (3 步骤流程图)
|- Testimonials (用户评价轮播/网格)
|- Pricing (3 列价格卡片)
|- FAQ (手风琴)
|- CTA Section (行动号召)
+- Footer (链接组 + 社交 + 版权)
```

#### 9.2 Dashboard 结构

```
Sidebar + Header
|- Stats Cards (4 个关键指标)
|- Main Chart (折线图/面积图)
|- Secondary Section
|   |- Recent Activity List
|   +- Distribution Chart (饼图)
|- Data Table
+- Pagination
```

#### 9.3 Admin CRUD 页面

```
Header + Breadcrumb
|- Toolbar (搜索 + 筛选 + [新增按钮])
|- Data Table (可排序列 + 操作列)
|- Pagination
+- [新增/编辑] -> 侧边抽屉 or 独立页面
```

#### 9.4 H5 移动页面（Vant 组件库）

```
van-nav-bar (标题栏)
|- van-pull-refresh
|   |- van-swipe (轮播)
|   |- van-grid (宫格)
|   |- van-cell-group (列表)
|   +- van-list (瀑布流加载)
+- van-tabbar (底部标签)
```

---

### 十、动效规范

- 动效时长 150-300ms（比 App 更短，Web 用户期望更快响应）
- 使用 CSS transition 和 @keyframes，避免 JS 动画
- 减少大面积动效（影响性能感知）
- 首屏加载不要有阻塞性动画

#### 常见 Web 动效

| 动效 | CSS | 用途 |
|------|-----|------|
| 按钮悬停 | `transform: translateY(-1px); box-shadow: lg` | 按钮 :hover |
| 卡片悬停 | `transform: translateY(-2px); box-shadow: md->lg` | 卡片 :hover |
| 页面淡入 | `opacity: 0->1; transform: translateY(20px->0)` | 路由切换 |
| 骨架屏 | `background-position` 移动的线性渐变 | 加载中 |
| 侧边栏 | `width: 240px<->64px; transition: 300ms` | 展开/折叠 |
| 弹窗 | `opacity + scale(0.95->1)` | 模态框出现 |
| Toast | `translateY(-100%) -> 0` | 顶部通知 |

---

### 十一、Vue + Vant 设计约定

#### 全局样式变量（覆盖 Vant）

```scss
:root {
  // 覆盖 Vant 主题变量
  --van-primary-color: var(--color-primary);
  --van-text-color: var(--text-primary);
  --van-text-color-2: var(--text-secondary);
  --van-text-color-3: var(--text-placeholder);
  --van-background: var(--bg-page);
  --van-background-2: var(--bg-card);
  --van-border-color: var(--border-default);
  --van-font-size-md: 14px;
  --van-font-size-lg: 16px;
}
```

#### 组件使用规范

| Vant 组件 | 用途 | 关键 props |
|-----------|------|-----------|
| van-button | 操作按钮 | type="primary" size="large" round |
| van-cell | 列表项 | title + value + is-link + icon |
| van-field | 表单输入 | label + placeholder + rules |
| van-popup | 弹层 | position="bottom" round |
| van-toast | 轻提示 | type="success/fail/loading" |
| van-dialog | 确认弹窗 | title + message + confirmButtonColor |
| van-tab | 标签页 | animated swipeable |
| van-list | 无限滚动 | loading + finished + @load |
| van-pull-refresh | 下拉刷新 | @refresh |
| van-swipe | 轮播 | autoplay loop |
| van-skeleton | 骨架屏 | row + avatar + loading |
| van-empty | 空状态 | image="search/network/default" |
