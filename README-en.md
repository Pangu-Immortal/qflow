<div align="center">

![qflow Visitor Count](https://count.getloli.com/get/@qflow?theme=rule34)

<h1>qflow</h1>

<p><strong>AI Project Management That Works Out of the Box — No API Key Required</strong></p>

<p>
  <b>If this project helps you, please <a href="https://github.com/Pangu-Immortal/qflow/stargazers">&#11088; Star</a> this repo!</b>
</p>

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io)
[![Tools](https://img.shields.io/badge/MCP%20Tools-50-orange.svg)]()
[![Dependencies](https://img.shields.io/badge/Dependencies-4-brightgreen.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org)

[简体中文](README.md)

</div>

---

## 💡 What is qflow?

qflow is a pure MCP tool layer that turns your AI editor (Claude Code / Cursor / Windsurf / Codex) into a full project manager. 50 tools, 17 context modules, 34 Lottie animation templates, only 4 runtime dependencies. Install and go — no API key configuration needed.

MCP (Model Context Protocol) is an open protocol that lets AI editors connect to external tools.

---

## ✨ What You Can Do After Installing

Not a feature list — real scenarios you can use tomorrow:

🗂️ **Tell your AI "break down this requirement"**
→ qflow auto-creates a task tree with dependencies and complexity scores (1-10)

📋 **Tell your AI "what should I work on next?"**
→ qflow analyzes the dependency graph and priorities, recommends the optimal task

📝 **Tell your AI "write a technical spec"**
→ qflow manages the full Spec lifecycle — create, propose changes, SHA-256 conflict detection, archive

📄 **Tell your AI "convert this PRD to tasks"**
→ qflow parses Markdown PRDs into structured task trees with auto-created dependencies

🔄 **Tell your AI "enter autopilot mode"**
→ qflow starts the Autopilot engine with token-bucket rate limiting, auto-advancing the task chain

🔍 **Tell your AI "do a code review"**
→ qflow summons 12 agent personas (PM / Architect / QA / Security / DBA / DevOps) for adversarial review

🎨 **Tell your AI "generate a loading animation"**
→ qflow picks from 34 templates, outputs standard Lottie JSON for Android / iOS / Web

🏃 **Tell your AI "start a Sprint"**
→ qflow manages full Scrum workflow — create Sprint, add stories, complete with retrospective

🧪 **Tell your AI "develop with TDD"**
→ qflow drives the red-green-refactor loop, auto-tracking each step

🧠 **Tell your AI "load iOS design system"**
→ qflow injects SwiftUI constraints on demand — 6 platform design systems ready to go

---

## 🚀 30-Second Install

> Prerequisites: [Node.js](https://nodejs.org) >= 18

```bash
git clone https://github.com/Pangu-Immortal/qflow.git
cd qflow
bash setup.sh
```

Restart your editor. Done.

**No API key needed.** qflow is a pure tool layer — your AI editor provides the intelligence. All 50 tools work out of the box.

> Tip: Add `.qflow/` to your project's `.gitignore` to keep task data out of Git.

---

## 🛠️ Supported Editors

**Claude Code** · **Cursor** · **Windsurf** · **Codex CLI** · Any MCP-compatible tool

---

## 📦 50 Tools at a Glance

### 🗂️ Task Management (15 tools)

Create, decompose, dependency DAG (Kahn cycle detection + critical path), 7-state machine, priority sorting, batch operations, tag-based workspace isolation, PRD-to-task-tree converter.

### 📝 Spec-Driven Development (8 tools)

Init, propose changes, SHA-256 conflict detection, deterministic merge, 3-dimension verification (completeness / correctness / consistency), AI content generation, Living Spec sync, archive.

### 🎯 Engineering Quality (10 tools)

5-dimension complexity scoring, 12-persona multi-perspective review, adversarial debate, TDD red-green-refactor loop, Scrum Sprint lifecycle, Autopilot engine (5 presets), constitution governance.

### 🧠 Context Modules (17)

9 engineering modules (core / analysis / development / UI constraints / context guard / thinking tiers / iron rules / README spec / reverse engineering) + 8 design system modules (Web / App / iOS / Android / Game / Pencil / PPT / UI-Web). On-demand loading, token-aware, auto-compression.

### 🎨 Lottie Animation Engine

34 templates across 6 categories (loading / feedback / interaction / transition / data / empty state). Tell your AI what animation you need — qflow outputs standard Lottie JSON. Custom color, size, and FPS supported.

### ⚙️ Other Tools

Template management, plugin system, DAG workflow orchestration, persistent memory, session handoff, system diagnostics, editor rule installation.

---

## 📊 How qflow Compares

> **qflow is the only All-in-one solution available today** — task management + Spec-driven development + multi-persona review + design systems + animation engine, all in one tool. Task Master only handles tasks. OpenSpec only handles Specs.

| Dimension | **qflow** | Task Master AI | OpenSpec |
|-----------|-----------|----------------|----------|
| MCP Tools | **50** | 44 | 0 (CLI only) |
| Runtime Dependencies | **4** | 61 | 9 |
| License | **MIT (pure)** | MIT + Commons Clause | MIT |
| Requires API Key | **No** | Yes | No |
| Spec Management | **Full lifecycle** | No | Yes |
| Design System Context | **6 platforms** | No | No |
| Lottie Animation Engine | **34 templates** | No | No |
| Multi-Agent Review | **12 personas** | No | No |

---

## 🔧 Tool Tiers

qflow loads tools in tiers so you only pay for what you use:

| Mode | Tools | Best For |
|------|-------|----------|
| `core` | 10 | Minimal footprint, task basics only |
| `standard` (default) | 32 | Full task + spec + context workflow |
| `all` | 50 | Power users: review, autopilot, TDD, sprints, plugins |

Set via `QFLOW_MODE` environment variable.

---

## ⚙️ Configuration

<details>
<summary>MCP Config Examples (Claude Code / Cursor / Windsurf)</summary>

**Claude Code** (`~/.claude.json`):

```json
{
  "mcpServers": {
    "qflow": {
      "command": "node",
      "args": ["/absolute/path/to/qflow/dist/mcp.js"],
      "env": { "QFLOW_MODE": "standard" }
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "qflow": {
      "command": "node",
      "args": ["/absolute/path/to/qflow/dist/mcp.js"],
      "env": { "QFLOW_MODE": "standard" }
    }
  }
}
```

**Windsurf** (`~/.codeium/windsurf/mcp_config.json`):

```json
{
  "mcpServers": {
    "qflow": {
      "command": "node",
      "args": ["/absolute/path/to/qflow/dist/mcp.js"],
      "env": { "QFLOW_MODE": "standard" }
    }
  }
}
```

</details>

<details>
<summary>Environment Variables</summary>

| Variable | Description | Default |
|----------|-------------|---------|
| `QFLOW_MODE` | Tool tier: `core` / `standard` / `all` | `standard` |
| `QFLOW_TOOLS` | Override with comma-separated tool list | — |
| `QFLOW_PROJECT_ROOT` | Override project root detection | auto |
| `QFLOW_DEBUG` | Enable debug logging | — |

</details>

---

## ❓ FAQ

**Does qflow require an API key?**
No. qflow is a pure MCP tool layer — intelligence comes from your AI editor (Claude Code / Cursor / Windsurf). All 50 tools work out of the box with zero configuration.

**How does qflow compare to Task Master AI?**
Task Master focuses on task management (44 tools). qflow is an all-in-one solution (50 tools) that adds Spec management, 12-persona review, 6-platform design systems, Lottie engine, TDD, and Sprint management. qflow has only 4 dependencies (vs 61), and uses a pure MIT license.

**Which editors are supported?**
Any MCP-compatible tool: Claude Code, Cursor, Windsurf, Codex CLI, VS Code (via MCP), and more. You can also use the CLI directly (`qflow task add`, `qflow task list`).

**Where is data stored?**
Locally in the `.qflow/` directory — pure file-based storage, no external database. All data stays on your machine.

**Is qflow free?**
Completely free. MIT licensed for personal and commercial use.

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Pangu-Immortal/qflow&type=Date)](https://star-history.com/#Pangu-Immortal/qflow&Date)

---

## 📄 License

[MIT](LICENSE) — Free for personal and commercial use.
