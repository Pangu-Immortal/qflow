<div align="center">

![qflow Visitor Count](https://count.getloli.com/get/@qflow?theme=rule34)

<h1>qflow</h1>

<p><strong>装上就能用的 AI 项目管理工具 — 不需要任何 API Key</strong></p>

<p>
  <b>如果这个项目对你有帮助，请 <a href="https://github.com/Pangu-Immortal/qflow/stargazers">&#11088; Star</a> 支持一下！</b>
</p>

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io)
[![Tools](https://img.shields.io/badge/MCP%20Tools-51-orange.svg)]()
[![Dependencies](https://img.shields.io/badge/Dependencies-4-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org)

[English](README-en.md)

</div>

---

## 💡 一句话介绍

qflow 是一个纯 MCP 工具层，让你的 AI 编辑器（Claude Code / Cursor / Windsurf / Codex）秒变项目经理。51 个工具、17 个上下文模块、34 种 Lottie 动画模板，只有 4 个运行时依赖，装上就用，不需要配置任何 API Key。

---

## ✨ 装上后你能做什么

不是功能列表，是你明天就能用的真实场景：

🗂️ **对 AI 说"帮我拆解这个需求"**
→ qflow 自动创建任务树，设置依赖关系，评估每个任务的复杂度（1-10 分）

📋 **对 AI 说"下一步做什么"**
→ qflow 分析依赖图谱和优先级，推荐最优任务，告诉你为什么

📝 **对 AI 说"写一个技术方案"**
→ qflow 管理 Spec 全生命周期——创建、变更提议、SHA-256 冲突检测、归档

📄 **对 AI 说"把这个 PRD 转成任务"**
→ qflow 解析 Markdown PRD，一键生成结构化任务树，自动建立依赖

🔄 **对 AI 说"进入自动驾驶"**
→ qflow 启动 Autopilot 引擎，令牌桶限流，自动推进任务链

🔍 **对 AI 说"帮我做个代码评审"**
→ qflow 召唤 12 个 Agent 角色（PM / 架构师 / QA / 安全 / DBA / DevOps），多视角对抗性评审

🎨 **对 AI 说"生成一个加载动画"**
→ qflow 从 34 种模板中选择，输出标准 Lottie JSON，直接用于 Android / iOS / Web

🏃 **对 AI 说"开始 Sprint"**
→ qflow 管理 Scrum 全流程——创建 Sprint、添加故事、完成回顾

🧪 **对 AI 说"用 TDD 方式开发"**
→ qflow 驱动红-绿-重构循环，自动跟踪每一步状态

🧠 **对 AI 说"加载 iOS 设计规范"**
→ qflow 按需注入 SwiftUI 约束知识，6 个平台的设计系统随时可用

---

## 🚀 30 秒安装

```bash
git clone https://github.com/Pangu-Immortal/qflow.git
cd qflow
bash setup.sh
```

重启编辑器，完成。

**不需要配置 API Key。** qflow 是纯工具层，你的 AI 编辑器提供智能。所有 51 个工具开箱即用。

---

## 🛠️ 支持的编辑器

**Claude Code** · **Cursor** · **Windsurf** · **Codex CLI** · 任何 MCP 兼容工具

---

## 📦 51 个工具一览

### 🗂️ 任务管理（15 个工具）

创建、拆解、依赖图谱（Kahn 环检测 + 关键路径）、7 态状态机、优先级排序、批量操作、标签工作区隔离、PRD 一键转任务树。

### 📝 Spec 驱动开发（8 个工具）

初始化、提议变更、SHA-256 冲突检测、确定性合并、3 维验证（完整性 / 正确性 / 一致性）、AI 内容生成、Living Spec 同步、归档。

### 🎯 工程质量（10 个工具）

5 维复杂度评分、12 角色多视角评审、对抗性辩论、TDD 红-绿-重构循环、Scrum Sprint 全流程、自动驾驶引擎（5 种预设）、治理宪章。

### 🧠 上下文模块（17 个）

9 个工程模块（核心规范 / 分析模式 / 开发模式 / UI 约束 / 上下文守卫 / 思维分层 / 铁律 / README 规范 / 逆向分析）+ 8 个设计系统模块（Web / App / iOS / Android / Game / Pencil / PPT / UI-Web）。按需加载，Token 感知，自动压缩。

### 🎨 Lottie 动画引擎

34 种模板，6 大分类（加载 / 反馈 / 交互 / 过渡 / 数据 / 空状态）。告诉 AI 你想要什么动画，qflow 输出标准 Lottie JSON。支持自定义颜色、尺寸、帧率。

### ⚙️ 其他工具

模板管理、插件系统、DAG 工作流编排、持久化记忆、会话交接、系统诊断、编辑器规则安装、运行时模型切换。

---

## 📊 与竞品对比

| 维度 | **qflow** | Task Master AI | OpenSpec |
|------|-----------|----------------|----------|
| MCP 工具数 | **51** | 44 | 0（仅 CLI） |
| 运行时依赖 | **4 个** | 61 个 | 9 个 |
| 许可证 | **MIT（纯开源）** | MIT + Commons Clause | MIT |
| 需要 API Key | **不需要** | 需要 | 不需要 |
| Spec 管理 | **完整生命周期** | 无 | 有 |
| 设计系统上下文 | **6 个平台** | 无 | 无 |
| Lottie 动画引擎 | **34 种模板** | 无 | 无 |
| 多 Agent 评审 | **12 个角色** | 无 | 无 |

---

## ❓ 常见问题

**qflow 需要 API Key 吗？**
不需要。qflow 是纯 MCP 工具层，智能由你的 AI 编辑器（Claude Code / Cursor / Windsurf）提供。所有 51 个工具开箱即用，零配置。

**qflow 和 Task Master AI 有什么区别？**
Task Master 专注任务管理（44 工具）。qflow 是 All-in-one 方案（51 工具），额外提供 Spec 管理、12 角色评审、6 平台设计系统、Lottie 引擎、TDD、Sprint。而且 qflow 只有 4 个依赖（vs 61 个），纯 MIT 许可。

**支持哪些编辑器？**
任何 MCP 兼容工具：Claude Code、Cursor、Windsurf、Codex CLI、VS Code（通过 MCP）等。也可以直接用 CLI（`qflow task add`、`qflow task list`）。

**数据存在哪里？**
本地 `.qflow/` 目录，纯文件存储，无需外部数据库。所有数据在你的机器上，不会上传。

**qflow 是免费的吗？**
完全免费。MIT 协议开源，个人和商业使用均可。

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Pangu-Immortal/qflow&type=Date)](https://star-history.com/#Pangu-Immortal/qflow&Date)

---

## 📄 许可证

[MIT](LICENSE) — 个人和商业使用均免费。
