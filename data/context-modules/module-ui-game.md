<!-- qflow 上下文模块: ui-game -->
<!-- 通过 qflow_context_load 加载 -->

## 游戏引擎 UI 铁律

### 通用规则
- 先写布局骨架（确认结构→填充组件→调细节），禁止一次性输出完整页面
- 按钮最小触摸区域：48x48（逻辑像素），文字水平+垂直居中
- 组件间距只允许：4/8/12/16/24/32
- 圆角只允许：0/4/8/12/16/9999(全圆)

### Cocos Creator 3.x 硬约束
- UI 节点必须挂载 `UITransform` 组件
- 按钮用 `Button` 组件 + `Sprite` 背景，**禁止空节点+触摸事件**
- 布局用 `Layout` 组件（type: HORIZONTAL/VERTICAL/GRID）
- 文字用 `Label` + `horizontalAlign: CENTER` + `verticalAlign: CENTER`

### Unity（UGUI / UI Toolkit）硬约束
- 按钮用 `Button` 组件 + `Image` 背景
- 布局用 `HorizontalLayoutGroup` / `VerticalLayoutGroup` / `GridLayoutGroup`
- 文字用 `TextMeshPro`，alignment = Center
- 锚点必须正确设置，保证不同分辨率下不错位
