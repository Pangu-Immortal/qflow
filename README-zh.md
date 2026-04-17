<div align="center">

![qflow Visitor Count](https://count.getloli.com/get/@qflow?theme=rule34)

<h1>qflow — AI 驱动的项目管理 MCP 服务器</h1>

<p>为 Claude Code、Cursor、Windsurf 打造的智能项目管理工具</p>

<p>
  <b>如果这个项目对你有帮助，请 <a href="https://github.com/Pangu-Immortal/qflow/stargazers">&#11088; Star</a> 支持一下！</b>
</p>

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io)
[![Tools](https://img.shields.io/badge/MCP%20Tools-51-orange.svg)]()
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Ready-success.svg)](https://claude.ai)
[![Cursor](https://img.shields.io/badge/Cursor-Ready-success.svg)](https://cursor.sh)
[![Windsurf](https://img.shields.io/badge/Windsurf-Ready-success.svg)](https://codeium.com/windsurf)

[English](README.md) | **简体中文**

</div>

---

> **qflow 是一款开源的 MCP（模型上下文协议）服务器，专为 AI 驱动的项目管理、任务跟踪和 Spec 驱动开发而设计，完美适配 Claude Code、Cursor、Windsurf 及所有兼容 MCP 协议的 AI 编码工具。**

qflow 将你的 AI 编码助手升级为全功能项目经理。它提供 51 个 MCP 工具，涵盖任务管理、依赖图谱、多 Agent 协作、复杂度评分、Lottie 动画生成和自动化质量门禁，为 AI 辅助开发带来结构化的工程工作流。17 个上下文模块覆盖设计系统、UI 约束和工程规范。无需外部数据库——所有数据基于本地文件存储。

### 关键词

qflow 是一款**免费开源的 AI 项目管理工具**和 **MCP 工具服务器**，为 AI 辅助开发提供完整的**任务管理**与**需求管理**能力。作为 **Claude Code 插件**、**Cursor 插件**和 **Windsurf 插件**，qflow 让你的 **AI 编码助手**具备结构化的**项目管理**能力。它是目前功能最全面的开源 **TypeScript MCP Server**，支持 **Spec 驱动开发**、**Lottie 动画生成**、**设计系统上下文加载**和 **AI 工程化**工作流。无论你是在寻找**免费的 MCP 工具**、**AI 辅助开发框架**，还是**开源项目管理方案**，qflow 都是理想选择。

---

## 特性

- **51 个 MCP 工具，3 级分层加载** —— 精细控制工具加载策略。从 10 个核心工具起步，按需扩展到 51 个，满足企业级工作流需求。
- **17 个上下文模块** —— 按需加载设计系统（Web/App/iOS/Android/Game）、UI 约束、Pencil 设计工具参考、PPT 生成指南和工程规范。支持 Token 感知与自动压缩。
- **Lottie 动画引擎** —— 从 34 种预置模板生成可自定义的 Lottie JSON 动画（加载旋转、成功对勾、心跳点赞、骨架屏微光等），支持颜色、尺寸、帧率自定义。
- **7 态任务状态机** —— 任务在 `pending > active > done > blocked > review > deferred > cancelled` 之间流转，自动解锁依赖并推荐下一个任务。
- **Spec 驱动开发** —— 提议、应用、归档 Spec 变更，内置 SHA-256 冲突检测和实时 Spec 同步。
- **5 维复杂度评分** —— 启发式评分（1-10），自适应三档规划方案：Quick（快速）、Standard（标准）、Enterprise（企业）。
- **12 个内置 Agent 角色** —— PM、架构师、QA、安全、DBA、DevOps 等，支持多视角审查和对抗性辩论。
- **自动驾驶引擎** —— 基于令牌桶限流的自主任务执行，内置 5 种循环预设，实现全自动项目推进。
- **PRD 转任务树** —— 一条命令将 Markdown PRD 转为结构化任务树，自动创建任务及依赖关系。
- **16 种 AI 供应商支持** —— 支持 OpenAI、Anthropic、Google Gemini、Azure、Groq、Ollama 等。无需 API Key 也能正常使用（智能降级）。

---

## 上下文模块系统

qflow 内置 17 个可按需加载的上下文模块，为 AI 助手提供专业领域知识。每个模块都经过 Token 优化，支持智能压缩。

### 工程基础模块

| 模块名 | 说明 | 适用场景 |
|--------|------|----------|
| `core` | 核心规范——项目约定、命名规则、工作流基础 | 所有项目，始终推荐加载 |
| `phase1` | 阶段一：代码分析与工程理解（只读模式） | 新接手项目、代码审查、架构分析 |
| `phase2` | 阶段二：开发模式——需求拆解、Agent 并行执行 | 新功能开发、重构、多文件修改 |
| `iron-rules` | 铁律约束——编码硬性规则、质量红线 | 团队协作、代码规范强制执行 |
| `thinking-tiers` | 思维分层——按任务复杂度匹配思考深度 | 复杂决策、架构设计 |
| `readme-spec` | README 规范——文档结构、SEO 最佳实践 | 开源项目文档编写 |
| `context-guard` | 上下文守卫——三阶段防线防止信息丢失 | 长对话、大型任务 |
| `reverse` | 逆向分析——APK/小程序反编译规范 | 逆向工程、竞品分析 |

### 设计系统模块

| 模块名 | 说明 | 适用场景 |
|--------|------|----------|
| `design-web` | Web 设计风格系统——响应式布局、色彩、排版 | Web/H5/SaaS/Dashboard 设计 |
| `design-app` | App 设计风格系统——iOS HIG + Material Design 3 | 移动端 App 设计 |
| `ui-web` | Web UI 开发铁律——Vue3 + Vant4 硬约束 | Web/小程序前端开发 |
| `ui-ios` | iOS UI 开发铁律——SwiftUI 硬约束 | iOS 原生开发 |
| `ui-android` | Android UI 开发铁律——Jetpack Compose 硬约束 | Android 原生开发 |
| `ui-game` | 游戏 UI 开发铁律——Cocos Creator + Unity 约束 | 游戏引擎 UI 开发 |
| `pencil` | Pencil 设计工具参考——.pen 文件操控语法 | UI 设计稿编辑 |
| `ppt` | PPT 生成指南——17 种风格、4 维度自定义 | 演示文稿生成 |

---

## Lottie 动画引擎

qflow 内置 Lottie 动画生成引擎，提供 6 大分类 34 种模板，一句话即可生成高质量 Lottie JSON 动画。

### 模板总览

| 分类 | 模板 | 说明 |
|------|------|------|
| **导航反馈** | `spinner-circular` | 圆形加载 |
| | `spinner-dots` | 点状加载 |
| | `success-checkmark` | 成功对勾 |
| | `error-cross` | 错误叉号 |
| | `warning-triangle` | 警告三角 |
| | `pull-refresh` | 下拉刷新 |
| **交互动效** | `heart-like` | 心跳点赞 |
| | `star-rating` | 星级评分 |
| | `toggle-switch` | 开关切换 |
| | `tab-bounce` | 标签弹跳 |
| | `button-press` | 按钮按压 |
| | `swipe-hint` | 滑动提示 |
| **页面过渡** | `fade-in` | 淡入效果 |
| | `slide-up` | 上滑进入 |
| | `scale-pop` | 缩放弹出 |
| | `skeleton-shimmer` | 骨架屏微光 |
| | `page-flip` | 翻页效果 |
| | `modal-backdrop` | 弹窗背景 |
| **状态指示** | `progress-bar` | 进度条 |
| | `progress-circle` | 环形进度 |
| | `upload-arrow` | 上传箭头 |
| | `download-arrow` | 下载箭头 |
| | `sync-rotate` | 同步旋转 |
| | `empty-state` | 空状态 |
| **图标变形** | `play-pause` | 播放暂停 |
| | `hamburger-close` | 汉堡关闭 |
| | `arrow-direction` | 箭头方向 |
| | `search-expand` | 搜索展开 |
| | `bell-shake` | 铃铛摇动 |
| | `typing-dots` | 打字指示 |
| **高级效果** | `confetti-simple` | 简单撒花 |
| | `ripple-wave` | 涟漪波纹 |
| | `pulse-glow` | 脉冲发光 |
| | `count-number` | 数字计数 |

### 使用方式

只需告诉你的 AI 助手想要什么动画：

```
告诉你的 AI 助手：「生成一个紫色加载动画」
qflow 自动选择 spinner-circular 模板，输出 Lottie JSON
```

也可以精确控制参数：

```
「用 heart-like 模板生成一个 300x300、红色、60fps 的点赞动画」
```

qflow 会自动生成完整的 Lottie JSON 文件，可直接用于 Android（lottie-compose）、iOS（lottie-ios）和 Web（lottie-web）。

---

## 与竞品对比

qflow 与其他 AI 项目管理工具的全面对比。数据基于 2026 年 4 月实际源码验证（Task Master 工具数来自 `tool-registry.js`，OpenSpec 来自 CLI 命令统计）。

### 核心架构

| 维度 | **qflow** | Task Master AI | OpenSpec |
|------|-----------|----------------|----------|
| 架构 | **MCP Server + CLI** | MCP Server + CLI | 仅 CLI（非 MCP 服务器） |
| MCP 工具数 | **51** | 44 | 0 |
| 工具分层（Token 控制） | **3 层（10/32/51）** | 3 层（7/14/44） | 不适用 |
| 运行时依赖 | **4 个包** | 61 个包 | 9 个包 |
| 许可证 | **MIT（纯开源）** | MIT + Commons Clause（限制商用） | MIT（纯开源） |
| 语言 | TypeScript | JavaScript/TypeScript | TypeScript |

### 任务与项目管理

| 维度 | **qflow** | Task Master AI | OpenSpec |
|------|-----------|----------------|----------|
| 任务状态机 | **7 种**（pending/active/done/blocked/review/deferred/cancelled） | 6 种（pending/done/in-progress/review/deferred/cancelled） | 2 种（勾选框） |
| 依赖 DAG | **支持 + Kahn 环检测 + 自动修复** | 支持（增删/验证/修复） | 仅工件级别 |
| 关键路径分析 | **支持** | 不支持 | 不支持 |
| 复杂度评分 | **5 维度启发式 + AI** | AI 驱动（分析+报告） | 不支持 |
| PRD→任务树 | **支持（自动创建）** | 支持（parse_prd） | 不支持 |
| Sprint 管理 | **支持（Scrum 全流程）** | 不支持 | 不支持 |
| TDD 循环引擎 | **支持（红-绿-重构）** | 不支持 | 不支持 |
| 标签工作区隔离 | **支持（隔离/切换/合并）** | 支持（多上下文标签） | 不支持 |

### Spec 与质量保障

| 维度 | **qflow** | Task Master AI | OpenSpec |
|------|-----------|----------------|----------|
| Spec 驱动开发 | **完整生命周期（init/propose/apply/verify/archive）** | 不支持 | **支持（核心功能）** |
| SHA-256 冲突检测 | **支持** | 不支持 | 不支持 |
| Living Spec 传播 | **支持** | 不支持 | 支持（delta specs） |
| 多 Agent 评审 | **12 个角色（PM/架构师/QA/安全/DBA/DevOps...）** | 不支持 | 不支持 |
| 对抗性辩论 | **支持（多视角）** | 不支持 | 不支持 |
| 治理宪章 | **支持（must/should/may 规则）** | 不支持 | 不支持 |

### AI 与自动化

| 维度 | **qflow** | Task Master AI | OpenSpec |
|------|-----------|----------------|----------|
| AI 供应商支持 | **16 种** | 17+ 种 | 模型无关（0 次 API 调用） |
| 无 API Key 可用 | **支持（所有功能均有启发式降级）** | 不支持（需要 API Key） | 支持（无 AI 调用） |
| 自动驾驶引擎 | **支持（5 种预设，令牌桶限速）** | 支持（8 个 autopilot 工具） | 不支持 |
| 研究与引用 | **支持** | 支持 | 不支持 |
| 优雅降级 | **每个 AI 调用均有模板兜底** | 无兜底 | 不适用 |

### 设计与创意工具（qflow 独有）

| 维度 | **qflow** | Task Master AI | OpenSpec |
|------|-----------|----------------|----------|
| 上下文模块 | **17 个（按需加载，Token 感知）** | 无 | 无 |
| 设计系统加载 | **6 个平台（Web/App/iOS/Android/Game/Pencil）** | 无 | 无 |
| Lottie 动画引擎 | **34 种模板，自定义颜色/尺寸/帧率** | 无 | 无 |
| PPT 生成参考 | **支持（17 种视觉风格）** | 无 | 无 |

### 编辑器与平台支持

| 维度 | **qflow** | Task Master AI | OpenSpec |
|------|-----------|----------------|----------|
| Claude Code | **支持** | 支持 | 支持 |
| Cursor | **支持** | 支持 | 支持 |
| Windsurf | **支持** | 支持 | 支持 |
| VS Code / Copilot | 通过 MCP | 支持 | 支持 |
| 其他编辑器 | 任何 MCP 兼容工具 | 15+（Cline, Roo, Zed, Kiro...） | 28（覆盖最广） |
| 一键安装脚本 | **支持（setup.sh）** | 支持（npx） | 支持（npx） |

### 为什么选择 qflow？

- **All-in-one**：任务管理 + Spec 管理 + 设计系统 + 动画生成，一个工具搞定。Task Master 只管任务，OpenSpec 只管 Spec。
- **极简依赖**：4 个运行时依赖 vs Task Master 的 61 个。更少的供应链风险，更快的安装速度。
- **离线可用**：每个 AI 功能都有非 AI 兜底方案。Task Master 核心功能需要 API Key。
- **纯 MIT 许可**：无 Commons Clause 限制，可自由商用。
- **多 Agent 评审**：内置 12 个角色进行对抗性评审，其他工具均不具备。
- **设计感知**：17 个上下文模块覆盖 6 个 UI 平台，按需加载设计规范，不浪费 Token。

---

## 快速上手（3 步即可运行）

### 第 1 步：安装

```bash
git clone https://github.com/Pangu-Immortal/qflow.git
cd qflow
bash setup.sh
```

`setup.sh` 会自动完成：
1. 检查 Node.js >= 18
2. 执行 `npm install && npm run build`
3. 注册 qflow 为 MCP 服务器（Claude Code + Cursor + Windsurf）

> **重要提示：** 安装完成后，请**重启你的 AI 编辑器**，qflow 才会出现在工具列表中。

<details>
<summary>手动安装（不使用 setup.sh）</summary>

```bash
npm install && npm run build
node dist/cli.js install   # 注册 MCP 到 Claude Code + Cursor + Windsurf
```
</details>

### 第 2 步：API Key 配置（三选一）

qflow 的 AI 增强功能（任务拆解、Spec 生成、研究、复杂度评分）需要 API Key。**51 个工具中有 47 个无需任何 Key 即可使用。**

| 模式 | 配置步骤 | 适用场景 |
|------|---------|---------|
| **A. 自动模式（推荐）** | 无需任何配置 | Claude Code 用户 |
| **B. 自有 API Key** | 设置环境变量或编辑配置 | Cursor / Windsurf / 自定义供应商 |
| **C. 不配置 Key** | 无需任何配置 | 仅使用任务管理（无 AI 功能） |

#### 模式 A：零配置（Claude Code 用户）

**如果你已经在使用 Claude Code，安装完就能用。** qflow 会自动读取你 Claude Code 的 API Key（`~/.claude/settings.json`），无需任何额外配置。

#### 模式 B：使用自有 API Key

在 MCP 配置中设置环境变量：

```json
{
  "mcpServers": {
    "qflow": {
      "command": "node",
      "args": ["/absolute/path/to/qflow/dist/mcp.js"],
      "env": {
        "QFLOW_MODE": "standard",
        "QFLOW_API_KEY": "sk-你的密钥",
        "QFLOW_BASE_URL": "https://api.openai.com/v1",
        "QFLOW_MODEL": "gpt-4o",
        "QFLOW_PROVIDER": "openai"
      }
    }
  }
}
```

或在项目中创建 `.qflow/qflow.config.json`（此文件已自动加入 .gitignore）：

```json
{
  "ai": {
    "provider": "openai",
    "apiKey": "sk-你的密钥",
    "model": "gpt-4o",
    "baseUrl": "https://api.openai.com/v1"
  }
}
```

> **安全提示：** `.qflow/` 目录默认在 `.gitignore` 中，不会被提交到 Git。MCP 配置中的环境变量仅存储在你的本地机器上，永远不会上传。**绝不要**将 API Key 硬编码到代码中或提交到版本库。

#### 模式 C：不配置 Key（优雅降级）

完全跳过 API Key 配置。qflow 的 47 个工具依然提供完整功能：

| 功能 | 有 API Key | 无 API Key |
|------|-----------|-----------|
| 任务增删改查、依赖管理、状态机 | 完整 | 完整 |
| Spec 提议、应用、验证、归档 | 完整 | 完整 |
| Sprint、TDD、自动驾驶、评审 | 完整 | 完整 |
| `qflow_task_expand` 任务拆解 | AI 智能拆解 | 阶段模板拆解 |
| `qflow_spec_generate` Spec 生成 | AI 内容生成 | 占位模板 |
| `qflow_research` 研究 | AI 研究+引用 | 占位模板 |
| `qflow_complexity_score` 评分 | AI 5维度评分 | 启发式关键词分析 |

### 第 3 步：初始化你的项目

打开你的 AI 编辑器，输入：

```
为这个项目初始化 qflow
```

或使用 CLI：

```bash
node dist/cli.js init /path/to/your/project
```

这将创建 `.qflow/` 目录，包含项目配置和任务存储。立即可用！

**试一下：**
```
创建一个任务：实现 JWT 用户认证
```

### MCP 配置

将 qflow 添加到编辑器的 MCP 配置中。请将 `/absolute/path/to/qflow` 替换为实际路径。

**Claude Code**（`~/.claude.json`）：

```json
{
  "mcpServers": {
    "qflow": {
      "command": "node",
      "args": ["/absolute/path/to/qflow/dist/mcp.js"],
      "env": {
        "QFLOW_MODE": "standard"
      }
    }
  }
}
```

**Cursor**（项目目录下 `.cursor/mcp.json`）：

```json
{
  "mcpServers": {
    "qflow": {
      "command": "node",
      "args": ["/absolute/path/to/qflow/dist/mcp.js"],
      "env": {
        "QFLOW_MODE": "standard"
      }
    }
  }
}
```

**Windsurf**（`~/.codeium/windsurf/mcp_config.json`）：

```json
{
  "mcpServers": {
    "qflow": {
      "command": "node",
      "args": ["/absolute/path/to/qflow/dist/mcp.js"],
      "env": {
        "QFLOW_MODE": "standard"
      }
    }
  }
}
```

---

## AI 供应商配置

> **这是最重要的配置步骤。** qflow 使用 AI 进行任务拆解、Spec 生成、研究分析和复杂度评分。未配置 API Key 时，这些功能会自动降级为启发式算法和模板——工具仍然可用，只是智能程度有所降低。

### 方式 A —— 环境变量

在启动 AI 编辑器前设置：

```bash
export QFLOW_API_KEY="sk-..."                        # 你的 API Key
export QFLOW_BASE_URL="https://api.openai.com/v1"    # OpenAI 兼容端点
export QFLOW_MODEL="gpt-4o"                          # 模型名称
export QFLOW_PROVIDER="openai"                       # 供应商名称（见下表）
```

### 方式 B —— 项目配置文件

在项目中创建或编辑 `.qflow/qflow.config.json`：

```json
{
  "ai": {
    "provider": "openai",
    "apiKey": "sk-...",
    "model": "gpt-4o",
    "baseUrl": "https://api.openai.com/v1",
    "researchModel": "o3-mini",
    "fallbackModel": "gpt-4o-mini"
  }
}
```

> **安全提示：** 切勿将含有真实 API Key 的 `.qflow/qflow.config.json` 提交到 Git。请添加到 `.gitignore`。

### 支持的供应商

qflow 通过 OpenAI 兼容适配器支持 **16 种供应商**：

| 供应商 | `QFLOW_PROVIDER` 值 | 说明 |
|--------|---------------------|------|
| OpenAI | `openai` | GPT-4o、o3、o1 系列 |
| Anthropic | `anthropic` | Claude 3.5/3.7/4，支持扩展思考 |
| Google Gemini | `google` | Gemini 1.5/2.0/2.5 Flash/Pro |
| Azure OpenAI | `azure` | Azure 托管的 GPT 模型 |
| Perplexity | `perplexity` | 搜索增强响应 |
| Google Vertex AI | `vertex` | 企业级 Gemini（通过 Vertex） |
| Groq | `groq` | 快速推理，OpenAI 兼容 |
| OpenRouter | `openrouter` | 多模型路由 |
| xAI (Grok) | `xai` | Grok 模型 |
| Ollama | `ollama` | 本地模型（无需 Key） |
| Codex CLI | `codex` | OpenAI Codex CLI 适配器 |
| Gemini CLI | `gemini-cli` | Google Gemini CLI 适配器 |
| DeepSeek | `deepseek` | DeepSeek 模型 |
| Mistral | `mistral` | Mistral 模型 |
| Together AI | `together` | 开源模型托管 |
| 任意 OpenAI 兼容 | `openai` | 设置自定义 `baseUrl` |

### 智能降级（无需 API Key）

未配置 API Key 时，qflow 仍可正常工作：

| 功能 | 有 API Key | 无 API Key |
|------|-----------|------------|
| `qflow_complexity_score` | AI 驱动的多维度评分 | 启发式评分（关键词 + 结构分析） |
| `qflow_task_expand` | AI 生成上下文相关的子任务 | 基于阶段的模板（分析 > 实现 > 测试 > 优化 > 部署） |
| `qflow_spec_generate` | AI 生成 Spec 内容 | 带占位符的模板 |
| `qflow_research` | AI 驱动的研究分析 | 带占位符的模板 |
| 其余 46 个工具 | 完整功能 | 完整功能（不依赖 AI） |

---

## 工具分层

qflow 采用分层工具系统，按需加载：

| 模式 | 加载工具数 | 包含层级 | 适用场景 |
|------|-----------|----------|----------|
| `minimal` / `core` | 10 | core | 最小占用，仅任务基础功能 |
| `standard` | 32 | core + standard | **推荐默认值**——完整的任务 + Spec + 上下文工作流 |
| `all` | 50 | core + standard + all | 高级用户：审查、自动驾驶、TDD、Sprint、插件 |

通过 `QFLOW_MODE` 环境变量设置模式，或使用 `QFLOW_TOOLS` 进行精细控制。

---

## 完整工具参考

### 层级：Core（10 个工具——始终加载）

| 工具 | 说明 |
|------|------|
| `qflow_project_init` | 初始化项目 `.qflow/` 目录，检测技术栈，安装斜杠命令 |
| `qflow_task_create` | 创建任务并自动进行启发式复杂度评分（1-10） |
| `qflow_task_next` | 基于优先级、依赖和状态推荐下一个任务 |
| `qflow_task_set_status` | 设置任务状态；完成时自动解锁依赖并推荐下一个任务 |
| `qflow_task_list` | 列出/筛选任务，按状态、标签或模糊查询；支持 `ready` 和 `blocking` 模式 |
| `qflow_task_expand` | 使用 AI 将任务拆解为子任务（降级为阶段模板） |
| `qflow_context_load` | 加载指定上下文模块（core、phase1、phase2、ui-constraints 等） |
| `qflow_session_handoff` | 生成会话交接摘要，包含进度、活跃任务和下一步建议 |
| `qflow_what_next` | 项目状态感知的智能导航（检测阶段：init/planning/implementing/reviewing/done） |
| `qflow_parse_prd` | 将 Markdown PRD 转为结构化任务树；`autoCreate=true` 直接写入任务 |

### 层级：Standard（22 个工具——`standard` 和 `all` 模式加载）

| 工具 | 说明 |
|------|------|
| `qflow_task_get` | 按 ID 获取任务完整详情 |
| `qflow_task_update` | 更新任务字段（标题、描述、优先级、依赖、标签、实现指南、元数据） |
| `qflow_task_delete` | 删除任务；`cascade=true` 删除子任务并清理依赖引用 |
| `qflow_task_tree` | 递归获取任务及所有子任务的树形结构 |
| `qflow_task_batch` | 批量创建/更新/查询/重写操作 |
| `qflow_task_deps` | 管理任务依赖：添加、删除、验证、获取关键路径 |
| `qflow_context_status` | 显示已加载的上下文模块及各模块 Token 占用 |
| `qflow_context_compress` | 压缩上下文：`aggressive` 卸载模块，`moderate` 返回建议 |
| `qflow_spec_status` | Spec 概览：数量、待应用变更、已应用变更 |
| `qflow_spec_init` | 创建新 Spec 文档（类型：architecture/api/ui/data/algorithm） |
| `qflow_spec_apply` | 应用待定 Spec 变更，确定性合并（RENAMED > REMOVED > MODIFIED > ADDED） |
| `qflow_spec_verify` | 3 维度验证：完整性、正确性、一致性 |
| `qflow_spec_propose` | 提议 Spec 变更，内置 SHA-256 冲突检测 |
| `qflow_spec_generate` | AI 生成 Spec 内容（基于描述和项目上下文） |
| `qflow_complexity_score` | 任务/描述复杂度评分（1-10），含维度分解和拆解建议 |
| `qflow_plan_generate` | 从 Spec 生成实现计划（技术设计 + 数据模型 + API 契约） |
| `qflow_tag_manage` | 管理任务标签：添加、删除、列表、统计、按标签筛选 |
| `qflow_scope_navigate` | 导航项目范围：列出模块、查看详情、查找关联任务 |
| `qflow_report` | 生成进度报告和复杂度报告 |
| `qflow_research` | AI 驱动的研究分析，支持上下文注入和来源追踪 |
| `qflow_clarification` | 需求 Q&A：提问、记录答案、列出未回答项 |
| `qflow_onboarding` | 交互式引导：初始化、步骤、完成、进度、重置、报告 |

### 层级：All（18 个工具——仅 `all` 模式加载）

| 工具 | 说明 |
|------|------|
| `qflow_review` | 统一审查：创建/评论/解决审查、对抗性分析、边界用例挖掘、UX 清单、风险评估、根因分析、故障诊断 |
| `qflow_autopilot` | 自主任务执行：配置、启动、暂停、恢复、停止、单步；5 种循环预设 |
| `qflow_sprint` | Scrum Sprint 管理：创建 Sprint、添加/更新故事、完成 Sprint 并回顾 |
| `qflow_workspace` | 按标签隔离工作区：隔离、切换、合并、状态 |
| `qflow_constitution` | 项目治理原则：初始化、获取、设置（must/should/may）、验证内容 |
| `qflow_template` | 模板管理：创建（含 `{{var}}` 占位符）、应用、列表 |
| `qflow_memory` | 持久化记忆：将决策/TODO/阻塞项写入 MEMORY.md，从 MEMORY.md 加载 |
| `qflow_tdd` | TDD 红-绿-重构循环：预设、步骤、循环（最大迭代次数）、状态、重置 |
| `qflow_use_tag` | 切换活跃工作区标签（每个标签 = 独立的 tasks.json） |
| `qflow_profile_switch` | 切换配置档案（自动应用 mode + contextModules） |
| `qflow_tool_search` | 按关键词或层级搜索已注册的 MCP 工具和斜杠命令 |
| `qflow_spec_sync` | 同步 Spec 内容到目标文件（确定性写入或 Agent 引导的 diff） |
| `qflow_editor_rules` | 为 13 种编辑器安装规则文件（Cursor、VSCode、Windsurf、Roo、Kiro、Zed 等） |
| `qflow_models_switch` | 运行时切换 AI 模型，无需重启 MCP 服务器 |
| `qflow_diagnostics` | 全面系统健康检查：状态、漂移检测、文件监听（启动/停止/事件） |
| `qflow_agile` | 敏捷工作流预设：列出阶段、获取阶段详情、执行步骤 |
| `qflow_plugin` | 插件生命周期：安装、卸载、列表、详情、搜索、启用、禁用 |
| `qflow_workflow` | DAG（有向无环图）工作流编排：启动、推进、状态、列出工作流 |
| `qflow_lottie` | Lottie 动画生成器：列出 34 种模板、自定义颜色/尺寸/帧率生成、获取模板详情 |

> **总计：51 个工具**，分布在 3 个层级（core: 10, standard: 22, all: 19）。

---

## CLI 参考

```bash
# -- 项目 ---------------------------------------------------------
qflow init [projectRoot]              # 初始化 .qflow/ 目录
qflow install                         # 注册 MCP + 安装斜杠命令
qflow uninstall                       # 注销 MCP + 移除斜杠命令
qflow generate [projectRoot]          # 导出任务为 .md 文件

# -- 任务管理 -------------------------------------------------------
qflow task add "Title" -d "Desc" -p 8 --deps T1,T2 --tags backend,auth
qflow task list [-s status] [--tags tag1,tag2]
qflow task next                       # 获取推荐的下一个任务
qflow task done <id>                  # 标记完成 + 自动推荐下一个
qflow task expand <id> [-n 5]         # 拆分为 N 个子任务
qflow task deps-validate              # 检查依赖图是否有环

# -- Spec 管理 -----------------------------------------------------
qflow spec init <name> [-t architecture|api|ui|data|algorithm] [-d "desc"]
qflow spec status                     # 概览：Spec 数量 + 变更统计
qflow spec verify <specId>            # 完整性 / 正确性 / 一致性

# -- 标签管理 -------------------------------------------------------
qflow tag add <taskIds> <tags>        # 为任务添加逗号分隔的标签
qflow tag remove <taskIds> <tags>     # 从任务移除标签
qflow tag list                        # 列出所有标签及任务计数
qflow tag filter <tags> [-m and|or]   # 按标签筛选任务

# -- 报告 -----------------------------------------------------------
qflow report progress                 # 完成率 + 状态分布
qflow report complexity               # 复杂度分布 + 拆解建议

# -- 全局参数 -------------------------------------------------------
--json        机器可读的 JSON 输出
--compact     单行紧凑输出
```

---

## 核心概念

### 任务生命周期

```
pending --> active --> done
     \--> blocked   (等待依赖完成)
     \--> review    (QA 检查点)
     \--> deferred  (暂时搁置)
     \--> cancelled
```

依赖完成时自动解锁下游任务。所有子任务完成时，父任务自动标记为完成。

### Spec 驱动开发

```
spec init --> propose changes --> apply (SHA-256 冲突检测) --> archive
```

每次变更都使用 SHA-256 指纹追踪。并发编辑会在合并前被检测并标记。

### 依赖模式

```
线性:   T1 --> T2 --> T3          (顺序执行)
扇出:   T1 --> {T2, T3, T4}      (并行执行)
扇入:   {T1, T2, T3} --> T4      (汇聚)
```

基于 Kahn 拓扑排序的环检测，自动修复（断开最后一条边）。

---

## 架构

```
qflow/
├── src/
│   ├── mcp.ts                      # MCP 服务器入口，分层工具注册
│   ├── cli.ts                      # CLI 入口（commander）
│   ├── core/                       # 领域逻辑（35+ 模块）
│   │   ├── task-manager.ts         # 任务 CRUD、状态机、依赖
│   │   ├── spec-workflow.ts        # Spec 提议/应用/归档
│   │   ├── review-manager.ts       # 多视角审查
│   │   ├── autopilot-engine.ts     # 自主执行引擎
│   │   ├── ai-provider.ts         # 多供应商 AI 适配器
│   │   ├── provider-adapter.ts    # 16 种供应商适配器
│   │   ├── clarification-engine.ts# 需求澄清 Q&A
│   │   ├── onboarding.ts          # 交互式引导
│   │   ├── plugin-manager.ts      # 插件安装/启用/禁用
│   │   ├── workflow-orchestrator.ts# DAG 工作流执行
│   │   ├── sprint-manager.ts      # Scrum Sprint 管理
│   │   ├── tdd-engine.ts          # TDD 红-绿-重构循环
│   │   └── ...
│   ├── algorithms/                 # 复杂度评分、DAG 验证、模糊搜索
│   ├── tools/                      # MCP 工具注册
│   │   ├── tier-core.ts            # 10 个核心工具
│   │   ├── tier-standard.ts        # 22 个标准工具
│   │   └── tier-all.ts             # 19 个高级工具
│   ├── schemas/                    # Zod 数据模型
│   ├── shared/                     # 常量、辅助函数、提示词模板
│   └── templates/                  # 斜杠命令 .md 模板
├── data/
│   ├── context-modules/            # 可加载的上下文模块
│   └── prompts/                    # AI 提示词模板（JSON）
└── package.json
```

**设计原则：**

- **文件即数据库** —— 所有状态存储在 `.qflow/*.json`，无需外部数据库
- **全面 Zod 校验** —— 所有数据边界都进行运行时 Schema 验证
- **AI 可选** —— 每个 AI 调用都有模板降级方案；无 API Key 也能工作
- **优雅降级** —— 非关键故障记录为警告，永不崩溃
- **分层隔离** —— 工具按需加载；`minimal` 模式仅使用 10 个工具
- **4 个运行时依赖** —— `@modelcontextprotocol/sdk`、`zod`、`commander`、`chalk`

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `QFLOW_MODE` | 工具层级：`minimal` / `core` / `standard` / `all` | `standard` |
| `QFLOW_TOOLS` | 覆盖为预设名称或逗号分隔的工具列表 | -- |
| `QFLOW_API_KEY` | AI 供应商 API Key | -- |
| `QFLOW_BASE_URL` | AI 供应商 Base URL | `https://api.openai.com/v1` |
| `QFLOW_MODEL` | AI 模型名称 | `gpt-4o` |
| `QFLOW_PROVIDER` | 供应商名称（openai / anthropic / google / azure / groq / ollama / ...） | `openai` |
| `QFLOW_PROJECT_ROOT` | 覆盖项目根目录自动检测 | 自动检测 |
| `QFLOW_DEBUG` | 启用调试日志（设为 `true` 开启） | -- |

---

## 常见问题（FAQ）

### 1. qflow 是什么？

qflow 是一款开源的 MCP（模型上下文协议）服务器，为 AI 编码助手添加结构化的项目管理能力。它提供 51 个工具，涵盖任务跟踪、Spec 驱动开发、复杂度评分、多 Agent 审查和自主任务执行——所有数据本地存储，基于文件系统。

### 2. MCP 是什么？MCP 工具怎么用？

MCP（Model Context Protocol，模型上下文协议）是一种开放协议，让 AI 助手（如 Claude Code、Cursor、Windsurf）能够连接外部工具和数据源。qflow 实现了 MCP 服务器，因此任何兼容 MCP 的 AI 工具都可以原生使用 qflow 的 51 个项目管理工具。你只需在编辑器的 MCP 配置中添加 qflow，AI 助手就能自动调用这些工具。

### 3. qflow 怎么安装？

三步即可：`git clone` 仓库、`cd qflow`、`bash setup.sh`。安装脚本会自动检查 Node.js 版本、安装依赖、构建项目，并为 Claude Code、Cursor 和 Windsurf 注册 MCP 服务器。详见上方[快速上手](#快速上手)章节。

### 4. qflow 和 Task Master AI 有什么区别？

两者都是 AI 辅助开发的 MCP 服务器。Task Master（44 个工具）专注任务管理；qflow（51 个工具）是 All-in-one 方案，额外提供 Spec 驱动开发、多 Agent 评审（12 个角色）、设计系统加载（6 个平台）、Lottie 动画引擎、TDD 循环和 Sprint 管理。核心差异：qflow 无需 API Key 即可运行（启发式降级）、仅 4 个运行时依赖（Task Master 有 61 个）、采用纯 MIT 许可（Task Master 使用 MIT + Commons Clause 限制商用）。详见[与竞品对比](#与竞品对比)的 30+ 维度完整对比。

### 5. qflow 和 Jira 有什么区别？

Jira 是传统的项目管理 SaaS 平台，需要浏览器操作、团队协作配置和付费订阅。qflow 是嵌入 AI 编码助手的本地工具，一切操作通过自然语言完成，无需离开编辑器。qflow 更适合个人开发者和 AI 辅助开发场景，而 Jira 适合大型团队的传统项目管理。

### 6. Claude Code 怎么做项目管理？

在 Claude Code 中安装 qflow 后，你可以直接用自然语言管理项目。例如：「初始化项目」「创建一个用户认证任务」「查看下一个应该做什么」「生成进度报告」。qflow 的 51 个 MCP 工具会被 Claude Code 自动识别和调用。

### 7. Cursor 怎么管理任务？

Cursor 支持 MCP 协议，安装 qflow 后可以在 Cursor 中直接使用所有项目管理功能。在 `.cursor/mcp.json` 中配置 qflow，然后通过对话让 Cursor 创建任务、跟踪进度、管理依赖。

### 8. qflow 需要 API Key 吗？

**不需要。** qflow 在没有 API Key 的情况下也能完整工作。AI 增强功能（任务拆解、Spec 生成、研究分析、复杂度评分）会智能降级为启发式算法和模板。其余 46 个非 AI 工具完全不受影响。

### 9. 免费的 AI 项目管理工具有哪些？

qflow 是目前功能最全面的免费开源 AI 项目管理工具。它基于 MIT 协议开源，个人和商业使用均免费。唯一可能的成本是 AI API Key（用于增强功能），但这完全是可选的。

### 10. Lottie 动画怎么生成？AI 能生成动画吗？

qflow 内置 Lottie 动画引擎，提供 34 种预置模板。只需告诉 AI 助手你想要什么动画（如「生成一个紫色加载动画」），qflow 就会自动选择合适的模板并生成 Lottie JSON 文件。支持自定义颜色、尺寸和帧率。生成的动画可直接用于 Android、iOS 和 Web 项目。

### 11. qflow 支持哪些 AI 模型？

qflow 支持 16 种 AI 供应商：OpenAI（GPT-4o、o3）、Anthropic（Claude 3.5/4）、Google Gemini、Azure、Groq、Ollama（本地模型）、DeepSeek、Mistral、Together AI、OpenRouter 等。任何兼容 OpenAI API 格式的供应商都可以通过自定义 `baseUrl` 接入。

### 12. qflow 上下文模块怎么用？

使用 `qflow_context_load` 工具加载指定模块。例如，开发 iOS 应用时加载 `ui-ios` 模块，AI 助手就会获得 SwiftUI 的完整约束知识。模块支持按需加载和自动压缩，不会浪费 Token。17 个模块覆盖工程基础和设计系统两大类。

### 13. qflow 是什么开源协议？

qflow 采用 MIT 协议开源，个人和商业使用均免费，可以自由修改和分发。

### 14. qflow 能离线使用吗？

可以。qflow 的核心功能（任务管理、依赖图谱、Spec 管理、状态机、报告等）完全本地运行，不依赖网络。只有 AI 增强功能（需要调用 AI API）需要网络连接，且这些功能会在无网络时自动降级为本地模板。如果使用 Ollama 等本地模型，连 AI 功能也可以离线使用。

### 15. qflow 运行时依赖有多少？

只有 4 个：`@modelcontextprotocol/sdk`、`zod`、`commander` 和 `chalk`。qflow 的设计目标是轻量化，最大限度降低供应链风险。

---

## Star 趋势

[![Star History Chart](https://api.star-history.com/svg?repos=Pangu-Immortal/qflow&type=Date)](https://star-history.com/#Pangu-Immortal/qflow&Date)

---

## 致谢

概念和模式受以下项目启发：
- [Task Master AI](https://github.com/eyaltoledano/claude-task-master) —— 任务管理模式
- [OpenSpec](https://github.com/eyaltoledano/openspec) —— Spec 驱动开发生命周期
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) —— 模型上下文协议 TypeScript SDK

---

## 许可证

[MIT](LICENSE) —— 个人和商业使用均免费。
