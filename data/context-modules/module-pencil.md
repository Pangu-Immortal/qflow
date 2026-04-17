<!-- qflow 上下文模块: pencil -->
<!-- 通过 qflow_context_load 加载 -->
<!-- 功能：Pencil MCP .pen 设计文件操控完整语法参考，涵盖工作流、DSL、Schema、禁止清单 -->

## 一、强制工作流程（每次操作 .pen 文件必须遵守）

```
1. open_document(绝对路径)              <- 打开/切换目标文件（必须绝对路径）
2. get_editor_state({include_schema:true})  <- 首次 true，确认文件已激活
3. get_variables(filePath)              <- 读取变量/Token
4. batch_get(patterns/nodeIds)          <- 读取节点、理解结构
5. get_guidelines()                     <- 首次加载可用指南列表
6. get_guidelines({category,name})      <- 按任务加载具体指南
7. batch_design(operations)             <- 执行修改（每次最多 25 操作）
8. get_screenshot(nodeId)               <- 截图验证视觉效果
9. snapshot_layout(parentId)            <- 检查布局问题（重叠/裁剪）
```

**铁律：**
- 文件未打开就操作 -> 报错 `Failed to access file`
- batch_get/batch_design 的 filePath 参数**不可靠** -> **必须先 open_document 切换**
- 新建/修改帧必须先设 `placeholder:true`，完成后 `placeholder:false`
- 任何设计任务开始前必须先写完设计规格文档和 prompt，再动手操作 Pencil

---

## 二、14 个 MCP 工具速查

### batch_design — 批量设计操作（核心写入工具）

**DSL 语法：**

```javascript
// I(parentId, {nodeProps}) — 插入新节点（不支持 index 第三参数）
node1=I("parentId", {type:"frame", name:"Card", width:300, height:200, fill:"#FFFFFF"})
// U(nodeId, {propsToUpdate}) — 更新已有节点属性
U("nodeId", {fill:"#FF0000", width:200})
// D(nodeId) — 删除节点及子树
D("nodeId")
// R(nodeId, {newNodeProps}) — 替换节点（删旧建新）
newNode=R("oldNodeId", {type:"text", content:"replaced"})
// M(nodeId, newParentId) — 移动节点（可选 index，须 <= children.length-1）
M("nodeId", "newParentId", 0)
// C(nodeId, parentId, {overrides}) — 复制节点
copy1=C("nodeId", "parentId", {name:"copy"})
// G(frameId, "stock"|"ai", query) — 设置图片填充
G("frameId", "ai", "minimalist purple gradient background")
```

**关键规则：**
- 绑定名仅在当前 operations 字符串内有效，不同调用间不共享
- `"document"` 是预定义绑定，代表文档根
- 组件实例后代寻址用 `/` 路径：`U(card+"/titleText", {content:"new"})`
- **每次 batch_design 只能有 1 条 G() 操作**
- I() **不支持** index 第三参数 -> 先 I() 再 M()
- 操作失败会回滚同批所有操作
- 不要在同批内 U() 刚 C() 复制的节点后代

### batch_get — 批量读取节点
- patterns: 搜索模式（name regex、reusable bool、type enum）
- nodeIds: 直接指定节点 ID 列表
- parentId: 限制搜索范围；readDepth: 子节点深度（默认1，>3 慎用）
- resolveInstances: 展开 ref 实例为完整结构
- **patterns.type 枚举：** `frame|group|rectangle|ellipse|line|polygon|path|text|connection|note|icon_font|image|ref`

### get_editor_state — 获取编辑器状态
- `include_schema`: 首次必须 true（加载完整 Schema），后续可 false

### open_document — 打开/创建文档
- 只接受 `"new"` 或绝对路径

### get_screenshot — 节点截图
- 截图后**必须**分析返回图片，检查文字可读性、颜色对比度、对齐

### export_nodes — 导出节点为图片
- format: `png`(默认)/`jpeg`/`webp`/`pdf`；scale 默认 2；PDF 合并多页

### snapshot_layout — 布局分析
- problemsOnly: 仅返回有布局问题的节点（重叠/裁剪）

### search_all_unique_properties — 搜索唯一属性值
- **可搜索属性（仅限）：** `fillColor|textColor|strokeColor|strokeThickness|cornerRadius|padding|gap|fontSize|fontFamily|fontWeight`

### find_empty_space_on_canvas — 查找画布空白区域
- direction: `top|right|bottom|left`；可指定参考 nodeId

### get_variables / set_variables — 变量读写
- set_variables 的 replace=true 不会删除未列出的变量
- 变量名定义不带 `$`，引用时带 `$`

### get_guidelines — 加载设计指南和风格

**可用指南（guide）：** Code | Design System | Landing Page | Mobile App | Slides | Table | Tailwind | Web App

**可用风格（style）：** `Aerial Gravitas` | `Artisan Editorial` | `Cinematic Alternating` | `Editorial Scientific` | `Illustrated Warm` | `Inline Friendly` | `Monumental Editorial` | `Product Demo` | `Soft Bento` | `Spatial Plus`

> 风格需传 params：colorPalette, roundness, elevation, headings, body, captions, data（先无参调用获取可选值）

### replace_all_matching_properties — 严禁使用
**T110 事故：2142 处变量引用被摧毁。永久禁用。** 替代方案：batch_get + 逐个 U()

### 设计库（.lib.pen）
- 库文件后缀 `.lib.pen`，标记为库后不可逆
- 通过 imports 导入：`"imports": {"alias": "./path.lib.pen"}`
- 不能跨文件引用组件，必须先导入库

---

## 三、.pen 文件格式规范（Schema v2.10）

### 3.1 文档根结构

```typescript
interface Document {
  version: "2.10";
  themes?: { [axisName: string]: string[] };  // 第一个值是默认值
  imports?: { [alias: string]: string };       // 相对路径到 .pen/.lib.pen
  variables?: { [name: string]: VariableDefinition };
  children: Child[];
}
```

### 3.2 节点类型（14 种）

| type | 说明 | 可有子节点 | 关键独有属性 |
|------|------|:--------:|---------|
| `frame` | 矩形容器 | 是 | cornerRadius, clip, layout, slot, placeholder |
| `group` | 分组容器 | 是 | width/height 只能用 SizingBehavior |
| `rectangle` | 矩形 | 否 | cornerRadius |
| `ellipse` | 椭圆/弧/环 | 否 | innerRadius(0-1), startAngle, sweepAngle |
| `line` | 线条 | 否 | **不支持 x2/y2，用 path 替代** |
| `path` | SVG 路径 | 否 | geometry(SVG d), fillRule, **必须设 width/height** |
| `polygon` | 正多边形 | 否 | polygonCount, cornerRadius |
| `text` | 文本 | 否 | content, textGrowth, fontFamily, fontSize, fontWeight 等 |
| `icon_font` | 图标字体 | 否 | iconFontName, iconFontFamily, **必须设 width+height** |
| `note` | 注释便签 | 否 | content（可作为 AI prompt） |
| `prompt` | AI 提示 | 否 | content, model |
| `context` | 上下文注释 | 否 | content |
| `ref` | 组件实例 | 否 | ref(组件ID), descendants(覆写映射) |
| `connection` | 连接线 | 否 | （搜索过滤用） |

### 3.3 基础属性（所有节点共有）

| 属性 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识，**不可含 `/`** |
| name | string | 显示名称 |
| x, y | number | 相对父坐标（flexbox 下被忽略） |
| rotation | NumberOrVariable | 逆时针角度 |
| opacity | NumberOrVariable | 0-1 |
| enabled | BooleanOrVariable | 是否可见 |
| layoutPosition | `"auto"` / `"absolute"` | 布局定位模式 |
| reusable | boolean | 标记为可复用组件 |

**类型系统：**
```typescript
type NumberOrVariable = number | string;    // string 为 "$变量名"
type ColorOrVariable = string;              // "#RRGGBB" | "#RRGGBBAA" | "$变量名"
type SizingBehavior = string;               // "fit_content" | "fit_content(100)" | "fill_container" | "fill_container(200)"
```

### 3.4 填充系统（Fill）

```javascript
// 纯色简写
"fill": "#FF5C00"          // 或 "#FF5C0080" 带透明度
// 变量引用
"fill": "$color_primary"
// 渐变
"fill": {
  "type": "gradient", "gradientType": "linear",  // linear|radial|angular
  "rotation": 180,  // 0=上, 90=左, 180=下
  "colors": [{"color":"#FF5C00","position":0}, {"color":"#FF8A4C","position":1}]
}
// 图片（URL 必须相对路径）
"fill": {"type":"image", "url":"./images/xxx.png", "mode":"fill"}
// 多重填充（数组，底到顶叠加）
"fill": ["#FF000080", {"type":"gradient", ...}]
```

**透明度 hex 速查：** 100%=FF, 90%=E6, 80%=CC, 70%=B3, 60%=99, 50%=80, 40%=66, 30%=4D, 20%=33, 10%=1A

**严禁格式：** `{type:"variable"}` 不存在 | `{type:"linear"}` 错误需用 gradient+gradientType | fill 不支持 opacity 字段用 hex 后缀

### 3.5 描边系统（Stroke）

```javascript
"stroke": {
  "fill": "$color_border",     // Fill 类型
  "thickness": 1,               // number 或 {top, right, bottom, left}
  "align": "inside",            // "inside"|"center"|"outside"
  "dashPattern": [5, 3]         // 虚线模式
}
```

**严禁：** stroke 不能是字符串、没有 type/color 属性、没有 strokeWidth 顶层属性

### 3.6 特效系统（Effect）

```javascript
// 外阴影（必须用 offset:{x,y} 格式）
{"type":"shadow", "shadowType":"outer", "offset":{"x":0,"y":4}, "blur":24, "spread":0, "color":"#00000040"}
// 内阴影
{"type":"shadow", "shadowType":"inner", "offset":{"x":0,"y":1}, "blur":3, "color":"#00000015"}
// 模糊 / 背景模糊（毛玻璃）
{"type":"blur", "radius":10}
{"type":"background_blur", "radius":20}
```

### 3.7 布局系统（Flexbox）

```javascript
"layout": "vertical",              // "none"|"vertical"|"horizontal"
"gap": 12,                         // NumberOrVariable
"padding": 16,                     // 单值 | [horizontal,vertical] | [top,right,bottom,left]
"justifyContent": "space_between", // start|center|end|space_between|space_around
"alignItems": "center",            // start|center|end
"clip": true                       // 裁剪溢出（仅 frame）
```

**SizingBehavior：** `fit_content` | `fit_content(100)` | `fill_container` | `fill_container(200)`

**铁律：**
- `x/y` 在 flexbox 下完全被忽略 -> 只有 `layout:"none"` 或 `layoutPosition:"absolute"` 时坐标才生效
- `fill_container` 在 `layout:"none"` 父中无效
- Group width/height **只能**用 SizingBehavior
- **不支持 flexWrap** -> 嵌套行 frame 替代
- padding 2-tuple: `[horizontal, vertical]`；4-tuple: `[top, right, bottom, left]`
- 不能父 fit_content + 全子 fill_container（循环依赖）
- 子元素偏移用嵌套 frame+padding，没有 margin

### 3.8 文本节点

```javascript
{
  "type": "text",
  "content": "Text Content",       // 是 content 不是 text！
  "textGrowth": "fixed-width",     // 必须在 width/height 之前设！
  "width": "fill_container",
  "fontFamily": "Inter",
  "fontSize": 14,
  "fontWeight": "600",             // 必须字符串！"100"-"900"
  "fill": "$color_text_primary",   // 必须设！否则不可见
  "textAlign": "center",           // left|center|right|justify
  "textAlignVertical": "middle",   // top|middle|bottom
  "lineHeight": 1.5
}
```

**textGrowth 规则：**
| 值 | width | height | 换行 |
|----|-------|--------|------|
| `"auto"`（默认） | 禁止设 | 禁止设 | 不换行 |
| `"fixed-width"` | **必须设** | 自动 | 按宽度换行 |
| `"fixed-width-height"` | **必须设** | **必须设** | 可溢出 |

**富文本：** `"content": [{"content":"Bold ","fontWeight":"700"}, {"content":"Normal"}]`

### 3.9 图标字体（icon_font）

```javascript
{
  "type": "icon_font",
  "iconFontName": "house",
  "iconFontFamily": "lucide",    // lucide|feather|Material Symbols Outlined/Rounded/Sharp|phosphor
  "width": 24, "height": 24,    // 必须设！
  "fill": "$color_text_primary",
  "weight": 400
}
```

**常用图标名（lucide/feather）：** home, settings, user, search, plus, x, edit, trash-2, check, arrow-right, chevron-down, menu, bell, mail, calendar, folder, file, heart, star, download, upload, share, copy, eye, lock

### 3.10 变量系统

```javascript
// 定义
"variables": {
  "color_primary": {"type":"color", "value":"#2CC8B8"},
  "spacing_md": {"type":"number", "value":16}
}
// 主题化变量
"color_bg": {
  "type":"color",
  "value": [
    {"value":"#F0F5F4", "theme":{"mode":"light"}},
    {"value":"#070D0D", "theme":{"mode":"dark"}}
  ]
}
// 主题轴
"themes": {"mode": ["dark", "light"]}  // 第一个值是默认值
// 引用
"fill": "$color_primary"
```

**规则：** 定义不带 $，引用带 $。类型：color|number|string|boolean。

### 3.11 组件系统（Component + Ref）

```javascript
// 创建组件
{type:"frame", id:"BtnPrimary", reusable:true, name:"PrimaryButton", ...}
// 实例化
{type:"ref", ref:"BtnPrimary", x:100, y:200}
// 覆写后代
{
  type:"ref", ref:"BtnPrimary",
  descendants: {
    "labelText": {content:"Submit"},
    "iconRef/innerIcon": {fill:"#FFFFFF"},       // 深层路径
    "contentSlot": {type:"frame", layout:"vertical", children:[...]},
    "optionalIcon": {enabled:false}
  }
}
```

**batch_design 操作实例后代：**
```javascript
card=I("parent", {type:"ref", ref:"CardComp"})
U(card+"/titleText", {content:"New Title"})
```

### 3.12 插槽系统（Slots）

```javascript
// 定义插槽（组件内空 frame）
{type:"frame", id:"contentSlot", slot:["RecommendedComp1", "RecommendedComp2"]}
// 隐藏不需要的插槽
U(instance+"/slotId", {enabled:false})
```

---

## 四、混合模式（BlendMode）

`normal` | `darken` | `multiply` | `linearBurn` | `colorBurn` | `light` | `screen` | `linearDodge` | `colorDodge` | `overlay` | `softLight` | `hardLight` | `difference` | `exclusion` | `hue` | `saturation` | `color` | `luminosity`

---

## 五、G() 图片生成规则

- 每次 batch_design **只放 1 条 G()**
- prompt 10 词以内更稳定
- G() 图片带方形背景，不可能透明 -> 禁止用于透明 icon
- **没有 image 节点类型**，图片是 frame/rectangle 的 fill 属性

---

## 六、placeholder 工作流

```javascript
I(document, {type:"frame", name:"Screen", placeholder:true, width:390, height:844})
// ... 完成所有修改 ...
U("frameId", {placeholder:false})
```

新建/修改/复制帧必须 placeholder:true，完成后立即 false。

---

## 七、严禁清单（40 条）

| # | 严禁 | 正确 |
|---|------|------|
| 1 | `replace_all_matching_properties` | batch_get+U() |
| 2 | 多条 G() 同批 | 单条 G() |
| 3 | I() 带 index | I()+M() |
| 4 | fill `{type:"variable"}` | `"$name"` |
| 5 | stroke 字符串 | 对象格式 |
| 6 | shadow 直接 x/y | offset:{x,y} |
| 7 | `type:"linear"` | gradient+gradientType |
| 8 | fill opacity 字段 | hex 后缀 |
| 9 | text 属性名 | content |
| 10 | 无 textGrowth 设 w/h | 先 textGrowth |
| 11 | line x2/y2 | path+geometry |
| 12 | flexWrap | 嵌套行 |
| 13 | ID 含 / | 用 - 或 _ |
| 14 | fontWeight 数字 | 字符串"600" |
| 15 | M() index 过大 | <= children-1 |
| 16 | path 无 w/h | 匹配 geometry |
| 17 | 不先 open_document | 先打开 |
| 18 | strokeWidth 属性 | stroke.thickness |
| 19 | icon_font content | iconFontName |
| 20 | fill_container 无 layout 父 | 父需 layout |
| 21 | ellipse cornerRadius | 用 rectangle |
| 22 | type:"image" 节点 | frame+fill |
| 23 | R() reusable 内部 | D()+I() |
| 24 | U() null 值 | 设 0 |
| 25 | 不备份改 .pen | cp .bak |
| 26 | 变量名带 $ | 定义无$引用有$ |
| 27 | 相对 filePath | 绝对路径 |
| 28 | filePath 和活跃文件不同 | open_document |
| 29 | U() 刚 C() 的后代 | descendants 覆写 |
| 30 | text 不设 fill | 始终设 fill |
| 31 | icon_font 无 w/h | 始终设 |
| 32 | w/h 设为 0 | 有意义值 |
| 33 | textColor/fillColor | fill |
| 34 | 行直接放内容无 Cell | Row->Cell->Content |
| 35 | 绝对定位折线图 | flexbox 柱状图 |
| 36 | 实例无位置无 layout 父 | 设 x+y 或在 layout 中 |
| 37 | 多层 descendants 嵌套 | 扁平路径 key |
| 38 | 默认值写入覆写 | 只写非默认 |
| 39 | kill 不排除活跃 PID | 排除当前 |
| 40 | G() 用于透明 icon | 矢量手绘 |

---

## 八、设计模式最佳实践

### Mobile App 屏幕结构

```
StatusBar (62px, Inter/SF Pro 15px 600)
Content (fill_container, vertical, padding [0,16,gap,16])
BottomNavBar (pill: 62px高, cornerRadius:36, border:1px)
  TabItem: fill_container, cornerRadius:26, vertical gap:4
  Active:实心填充  Inactive:透明  Icon:18px  Label:10px uppercase
```

### Dark/Light 模式

```javascript
"themes": {"mode": ["dark", "light"]}
// 帧：{theme:{mode:"dark"}}  /  {theme:{mode:"light"}}
```

### 表格结构
Table(vertical)->Row(horizontal)->Cell(frame)->Content

### 文本尺寸策略
父定义: textGrowth:"fixed-width" + fill_container；文本定义: auto（默认），不设 w/h

### 图标叠加渐变

```javascript
bg=I(parent, {type:"rectangle", width:56, height:56, cornerRadius:28, fill:{type:"gradient",...}})
icon=I(parent, {type:"icon_font", iconFontFamily:"lucide", iconFontName:"home", width:24, height:24, fill:"#FFFFFF", layoutPosition:"absolute", x:16, y:16})
```

---

## 九、速查表

- **颜色：** `#RGB` | `#RRGGBB` | `#RRGGBBAA`
- **渐变方向：** 0=上, 90=左, 180=下, 270=右
- **padding：** 1值=全边, 2值=[horizontal,vertical], 4值=[T,R,B,L]
- **cornerRadius 4-tuple：** [topLeft, topRight, bottomRight, bottomLeft]
- **frame 默认：** layout=horizontal, size=fit_content, clip=false
- **group 默认：** layout=none, size=SizingBehavior only
- **动画：** Pencil 当前不支持动画/关键帧/过渡，用 `/lottie-generate` 或代码实现
- **Design-to-Code：** 支持 React/Vue/Svelte/HTML+CSS/Tailwind v4/Flutter/SwiftUI/Compose/RN
