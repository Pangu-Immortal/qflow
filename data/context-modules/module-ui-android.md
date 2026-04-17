<!-- qflow 上下文模块: ui-android -->
<!-- 通过 qflow_context_load 加载 -->

## Android UI 铁律（Jetpack Compose）

### 通用规则
- 先写布局骨架（确认结构→填充组件→调细节），禁止一次性输出完整页面
- 按钮最小触摸区域：48x48dp，文字水平+垂直居中
- 组件间距只允许：4/8/12/16/24/32 dp，禁止其他数值
- 圆角只允许：0/4/8/12/16/9999(全圆) dp
- 内边距：按钮水平12-16/垂直8-12，卡片16，页面16-24
- 每页最多 1 个主操作按钮(Primary)，其余用次级样式
- 字体大小：标题20-24/正文14-16/辅助12-13/最小不低于11 sp
- 行高：正文1.5倍，标题1.2-1.3倍
- 参照 ~/.claude/ui-templates/ 下 Android 模板风格

### Compose 硬约束
- 按钮必须用 `Button()` / `OutlinedButton()` / `TextButton()`，**禁止 Box+clickable 自造按钮**
- 文字居中用 `contentAlignment = Alignment.Center` 或 `textAlign = TextAlign.Center + fillMaxWidth`
- 间距用 `Modifier.padding()`，值域 4/8/12/16/24/32.dp
- 圆角 `RoundedCornerShape(12.dp)`，除非明确要求其他值
- 颜色必须用 `MaterialTheme.colorScheme.xxx`，**禁止硬编码 Color(0xFFxxxxxx)**
- 列表用 `LazyColumn` / `LazyRow`，**禁止 Column+forEach**
