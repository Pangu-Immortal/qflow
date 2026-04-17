<!-- qflow 上下文模块: ui-web -->
<!-- 通过 qflow_context_load 加载 -->
<!-- 功能: Web 和小程序 UI 开发铁律，Vue3 + Vant4 + 小程序硬约束 -->

## Web & 小程序 UI 铁律

### 通用规则
- 先写布局骨架（确认结构->填充组件->调细节），禁止一次性输出完整页面
- 按钮最小触摸区域：48x48px，文字水平+垂直居中
- 组件间距只允许：4/8/12/16/24/32 px
- 圆角只允许：0/4/8/12/16/9999(全圆) px
- 内边距：按钮水平12-16/垂直8-12，卡片16，页面16-24
- 禁止 `position:absolute` 做页面布局（仅浮层/弹窗可用）
- 每页最多 1 个主操作按钮(Primary)
- 字体大小：标题20-24/正文14-16/辅助12-13/最小不低于11 px
- 行高：正文1.5倍，标题1.2-1.3倍

### Web（Vue 3 + Vant 4）硬约束
- 按钮必须用 `<van-button>`，**禁止 `<button>` 或 `<div @click>`**
- 表单必须用 `<van-form>` + `<van-field>`
- 弹窗用 `<van-popup>` / `<van-dialog>` / `<van-action-sheet>`
- 列表用 `<van-list>` + `<van-cell>`
- 布局用 flex/grid，**禁止 float**
- 导航用 `<van-nav-bar>` + `<van-tabbar>`

### 小程序（Vant Weapp）硬约束
- 所有组件必须用 `<van-xxx>` 前缀组件
- 页面配置必须在 `.json` 中声明 `usingComponents`
- 样式单位用 rpx（750rpx = 屏幕宽度）
