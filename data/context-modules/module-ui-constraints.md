<!-- qflow 上下文模块: ui-constraints -->
<!-- 通过 /qf-context-ui 命令加载 -->

## UI 开发铁律（所有平台强制执行）

### 通用规则
- 所有 UI 必须先写布局骨架（确认结构→再填充组件→最后调细节），禁止一次性输出完整页面
- 按钮最小触摸区域：48x48dp/pt/px，文字必须水平+垂直居中
- 组件间距只允许：4/8/12/16/24/32，禁止其他数值
- 圆角只允许：0/4/8/12/16/9999(全圆)，禁止其他数值
- 内边距(padding)：按钮水平12-16/垂直8-12，卡片16，页面16-24
- 禁止 position:absolute 做页面布局（仅浮层/弹窗可用）
- 每页最多1个主操作按钮(Primary)，其余用次级样式
- 新 UI 必须参照 ~/.claude/ui-templates/ 下对应平台的代码模板风格
- 字体大小：标题20-24/正文14-16/辅助12-13/最小不低于11
- 行高：正文1.5倍，标题1.2-1.3倍

### Android (Jetpack Compose)
- 按钮必须用 Button()/OutlinedButton()/TextButton()，禁止 Box+clickable 自造按钮
- 文字居中用 contentAlignment = Alignment.Center 或 textAlign = TextAlign.Center + fillMaxWidth
- 间距用 Modifier.padding()，值域 4/8/12/16/24/32.dp
- 圆角 RoundedCornerShape(12.dp)，除非明确要求其他值
- 颜色必须用 MaterialTheme.colorScheme.xxx，禁止硬编码 Color(0xFFxxxxxx)
- 列表用 LazyColumn/LazyRow，禁止 Column+forEach

### iOS (SwiftUI)
- 按钮用 Button + .buttonStyle(.borderedProminent/.bordered/.plain)
- 间距用 .padding() 默认值或显式 8/16/32
- 列表用 List/Form，禁止 ScrollView+VStack+ForEach 替代
- 颜色用 .primary/.secondary/.accentColor，禁止 Color(red:green:blue:)
- 导航用 NavigationStack + NavigationLink

### Web (Vue 3 + Vant 4)
- 按钮必须用 <van-button>，禁止 <button> 或 <div @click>
- 表单必须用 <van-form>+<van-field>
- 弹窗用 <van-popup>/<van-dialog>/<van-action-sheet>
- 列表用 <van-list>+<van-cell>
- 布局用 flex/grid，禁止 float
- 导航用 <van-nav-bar>+<van-tabbar>

### 小程序 (Vant Weapp)
- 所有组件必须用 <van-xxx> 前缀组件
- 页面配置必须在 .json 中声明 usingComponents
- 样式单位用 rpx（750rpx = 屏幕宽度）

### Cocos Creator 3.x
- UI 节点必须挂载 UITransform 组件
- 按钮用 Button 组件 + Sprite 背景，禁止空节点+触摸事件
- 布局用 Layout 组件（type: HORIZONTAL/VERTICAL/GRID）
- 文字用 Label + horizontalAlign: CENTER + verticalAlign: CENTER

### Unity (UGUI/UI Toolkit)
- 按钮用 Button 组件 + Image 背景
- 布局用 HorizontalLayoutGroup/VerticalLayoutGroup/GridLayoutGroup
- 文字用 TextMeshPro，alignment = Center
- 锚点必须正确设置，保证不同分辨率下不错位
