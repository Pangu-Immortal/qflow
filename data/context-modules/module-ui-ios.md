<!-- qflow 上下文模块: ui-ios -->
<!-- 通过 qflow_context_load 加载 -->
<!-- 功能: iOS SwiftUI UI 开发铁律，间距/圆角/字号/触摸区域/颜色/导航/列表硬约束 -->

## iOS UI 铁律（SwiftUI）

### 通用规则
- 先写布局骨架（确认结构->填充组件->调细节），禁止一次性输出完整页面
- 按钮最小触摸区域：48x48pt，文字水平+垂直居中
- 组件间距只允许：4/8/12/16/24/32 pt
- 圆角只允许：0/4/8/12/16/9999(全圆)
- 内边距：按钮水平12-16/垂直8-12，卡片16，页面16-24
- 每页最多 1 个主操作按钮(Primary)
- 字体大小：标题20-24/正文14-16/辅助12-13/最小不低于11
- 行高：正文1.5倍，标题1.2-1.3倍

### SwiftUI 硬约束
- 按钮用 `Button` + `.buttonStyle(.borderedProminent/.bordered/.plain)`
- 间距用 `.padding()` 默认值或显式 8/16/32
- 列表用 `List` / `Form`，**禁止 ScrollView+VStack+ForEach 替代**
- 颜色用 `.primary` / `.secondary` / `.accentColor`，**禁止 Color(red:green:blue:)**
- 导航用 `NavigationStack` + `NavigationLink`
