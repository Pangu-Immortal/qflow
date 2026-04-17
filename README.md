<div align="center">

![qflow Visitor Count](https://count.getloli.com/get/@qflow?theme=rule34)

<h1>qflow</h1>

<p>AI-Powered Project Management MCP Server</p>

<p>
  <b>If this project helps you, please <a href="https://github.com/Pangu-Immortal/qflow/stargazers">&#11088; Star</a> this repo!</b>
</p>

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io)
[![Tools](https://img.shields.io/badge/MCP%20Tools-51-orange.svg)]()
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Ready-success.svg)](https://claude.ai)
[![Cursor](https://img.shields.io/badge/Cursor-Ready-success.svg)](https://cursor.sh)
[![Windsurf](https://img.shields.io/badge/Windsurf-Ready-success.svg)](https://codeium.com/windsurf)

[English](README.md) | [简体中文](README-zh.md)

</div>

---

> **qflow is an open-source MCP server for AI-powered project management, task tracking, and spec-driven development -- designed for Claude Code, Cursor, Windsurf, and any MCP-compatible AI coding tool.**

qflow turns your AI coding assistant into a full project manager. With 51 MCP tools spanning task management, dependency graphs, multi-agent orchestration, complexity scoring, Lottie animation generation, and automated quality gates, qflow brings structured engineering workflow to AI-assisted development. 17 context modules cover design systems, UI constraints, and engineering workflows. No external database required -- everything runs locally via file-based state.

---

## Features

- **51 MCP Tools in 3 Tiers** -- Granular control over which tools load. Start with 10 core tools, scale to 51 for enterprise workflows.
- **17 Context Modules** -- On-demand loading of design systems (Web/App/iOS/Android/Game), UI constraints, Pencil design tool reference, PPT generation guide, and engineering workflows. Token-aware with auto-compression.
- **Lottie Animation Engine** -- Generate customizable Lottie JSON animations from 34 preset templates (loading spinners, success checkmarks, heart-like, skeleton shimmer, etc.) with color/size/fps customization.
- **7-State Task Machine** -- Tasks flow through `pending > active > done > blocked > review > deferred > cancelled` with automatic dependency unblocking and next-task recommendation.
- **Spec-Driven Development** -- Propose, apply, and archive specification changes with SHA-256 conflict detection and living spec propagation.
- **5-Dimension Complexity Scoring** -- Heuristic scoring (1-10) with scale-adaptive planning tracks: Quick, Standard, and Enterprise.
- **12 Built-in Agent Personas** -- PM, Architect, QA, Security, DBA, DevOps and more for multi-perspective review and adversarial debate.
- **Autopilot Engine** -- Token-bucket rate-limited autonomous task execution with 5 loop presets for hands-free project progression.
- **PRD-to-Tasks Parser** -- Convert Markdown PRDs into structured task trees with a single command. Auto-creates tasks with dependencies.
- **16 AI Provider Support** -- OpenAI, Anthropic, Google Gemini, Azure, Groq, Ollama, and more. Works without any API key via graceful degradation.

---

## Context Modules

qflow provides 17 on-demand context modules for AI -- the most comprehensive context modules for AI available in any MCP server. Modules are token-aware, support unloading and compression, and inject domain-specific knowledge into your AI coding assistant's context window.

| Group | Module | Description |
|-------|--------|-------------|
| **Engineering** | `core` | Project conventions, naming rules, and workflow constraints |
| | `phase1` | Code analysis and architecture understanding (read-only mode) |
| | `phase2` | Development execution with multi-agent orchestration |
| | `ui-constraints` | Cross-platform UI dimension and spacing constraints |
| | `context-guard` | Auto-compression at 70%/85%/90% context thresholds |
| | `thinking-tiers` | Tiered reasoning depth control (quick/standard/deep) |
| | `iron-rules` | Immutable engineering rules that override all other context |
| | `readme-spec` | README and documentation generation guidelines |
| | `reverse` | Reverse engineering workflow (APK, mini-app, protocol) |
| **Design (v24.0)** | `design-web` | Web design system: color, typography, grid, components |
| | `design-app` | App design system: iOS HIG + Material Design 3 |
| | `ui-web` | Vue + Vant + mini-app UI hard constraints |
| | `ui-ios` | SwiftUI layout, spacing, and component rules |
| | `ui-android` | Jetpack Compose layout, spacing, and component rules |
| | `ui-game` | Cocos Creator + Unity UGUI/UI Toolkit rules |
| | `pencil` | Pencil design tool reference and .pen file operations |
| | `ppt` | PPT generation guide with 17 visual styles |

Load modules with `qflow_context_load`, check token usage with `qflow_context_status`, and free tokens with `qflow_context_compress`. Design system context loading covers 6 platforms (Web, iOS, Android, Game, Pencil, PPT), making qflow the only open-source MCP server with built-in design system awareness for AI project management.

---

## Lottie Animation Engine

qflow includes a built-in Lottie animation generator MCP tool (`qflow_lottie`) with 34 preset templates across 6 categories. Generate customizable Lottie JSON animations directly from your AI coding assistant -- no design tool required.

| Category | Templates | Examples |
|----------|-----------|---------|
| **Loading** | 8 templates | Spinner, pulse dot, orbital, progress bar, skeleton shimmer, wave, bounce, circular |
| **Feedback** | 6 templates | Success checkmark, error cross, warning triangle, info badge, confetti, thumbs up |
| **Interaction** | 6 templates | Heart like, star favorite, toggle switch, swipe hint, pull-to-refresh, tap ripple |
| **Transition** | 6 templates | Fade in/out, slide up, scale bounce, flip card, morph shape, page turn |
| **Data** | 4 templates | Chart grow, counter roll, pie chart fill, progress ring |
| **Empty State** | 4 templates | No data, no network, no search result, maintenance |

**Usage example** -- generate a Lottie animation in 3 lines of conversation:

```
You: "Generate a success checkmark animation in green, 120x120px"
AI:  → calls qflow_lottie(template: "success-checkmark", color: "#22C55E", width: 120, height: 120)
     → Returns Lottie JSON file ready for Android Compose / iOS SwiftUI / Web
```

All templates support custom **color**, **size (width/height)**, and **frame rate (fps)**. Output is standard Lottie JSON compatible with `lottie-android`, `lottie-ios`, and `lottie-web`.

---

## Comparison with Alternatives

How does qflow compare to other AI project management tools? This is the most comprehensive comparison of MCP tools for developers -- covering task management, spec-driven development, design system loading, and Lottie animation generation.

> **Note:** Data verified against actual source code as of April 2026. Task Master tool count from `mcp-server/src/tools/tool-registry.js`, OpenSpec from `package.json` + CLI commands.

### Core Architecture

| Dimension | **qflow** | Task Master AI | OpenSpec |
|-----------|-----------|----------------|----------|
| Architecture | **MCP Server + CLI** | MCP Server + CLI | CLI only (not an MCP server) |
| MCP Tools | **51** | 44 | 0 |
| Tool Tiers (token control) | **3 tiers (10/32/51)** | 3 tiers (7/14/44) | N/A |
| Runtime Dependencies | **4 packages** | 61 packages | 9 packages |
| License | **MIT (pure)** | MIT + Commons Clause | MIT (pure) |
| Language | TypeScript | JavaScript/TypeScript | TypeScript |

### Task & Project Management

| Dimension | **qflow** | Task Master AI | OpenSpec |
|-----------|-----------|----------------|----------|
| Task State Machine | **7 states** (pending/active/done/blocked/review/deferred/cancelled) | 6 states (pending/done/in-progress/review/deferred/cancelled) | 2 states (checkbox) |
| Dependency DAG | **Yes + Kahn cycle detection + auto-fix** | Yes (add/remove/validate/fix) | Artifact-level only |
| Critical Path Analysis | **Yes** | No | No |
| Complexity Scoring | **5-dimension heuristic + AI** | AI-powered (analyze + report) | No |
| PRD-to-Tasks Parser | **Yes (auto-create task tree)** | Yes (parse_prd) | No |
| Sprint Management | **Yes (Scrum lifecycle)** | No | No |
| TDD Loop Engine | **Yes (red-green-refactor)** | No | No |
| Tag-based Workspaces | **Yes (isolate/switch/merge)** | Yes (multi-context tags) | No |

### Spec & Quality

| Dimension | **qflow** | Task Master AI | OpenSpec |
|-----------|-----------|----------------|----------|
| Spec-Driven Development | **Full lifecycle (init/propose/apply/verify/archive)** | No | **Yes (core feature)** |
| SHA-256 Conflict Detection | **Yes** | No | No |
| Living Spec Propagation | **Yes** | No | Yes (delta specs) |
| Multi-Agent Review | **12 personas (PM/Architect/QA/Security/DBA/DevOps...)** | No | No |
| Adversarial Debate | **Yes (multi-perspective)** | No | No |
| Constitution Governance | **Yes (must/should/may rules)** | No | No |

### AI & Automation

| Dimension | **qflow** | Task Master AI | OpenSpec |
|-----------|-----------|----------------|----------|
| AI Provider Support | **16 providers** | 17+ providers | Model-agnostic (0 API calls) |
| Works Without API Key | **Yes (heuristic fallback for all features)** | No (API key required) | Yes (no AI calls) |
| Autopilot Engine | **Yes (5 presets, token-bucket rate-limited)** | Yes (8 autopilot tools) | No |
| Research with Sources | **Yes** | Yes | No |
| Graceful Degradation | **Every AI call has template fallback** | No fallback | N/A |

### Design & Creative Tools (qflow exclusive)

| Dimension | **qflow** | Task Master AI | OpenSpec |
|-----------|-----------|----------------|----------|
| Context Modules | **17 modules (on-demand, token-aware)** | No | No |
| Design System Loading | **6 platforms (Web/App/iOS/Android/Game/Pencil)** | No | No |
| Lottie Animation Engine | **34 templates, custom color/size/fps** | No | No |
| PPT Generation Reference | **Yes (17 visual styles)** | No | No |

### Editor & Platform Support

| Dimension | **qflow** | Task Master AI | OpenSpec |
|-----------|-----------|----------------|----------|
| Claude Code | **Yes** | Yes | Yes |
| Cursor | **Yes** | Yes | Yes |
| Windsurf | **Yes** | Yes | Yes |
| VS Code / Copilot | Via MCP | Yes | Yes |
| Other Editors | Any MCP-compatible | 15+ (Cline, Roo, Zed, Kiro...) | 28 (broadest) |
| One-Line Install Script | **Yes (setup.sh)** | Yes (npx) | Yes (npx) |

### Why Choose qflow?

- **All-in-one**: Task management + spec management + design system + animation generation in a single tool. Task Master focuses only on tasks; OpenSpec only on specs.
- **Minimal footprint**: 4 runtime dependencies vs Task Master's 61. Less supply chain risk, faster install.
- **Works offline**: Every AI feature has a non-AI fallback. Task Master requires an API key for core features.
- **Pure MIT license**: No Commons Clause restrictions. Free for any commercial use.
- **Multi-agent review**: 12 built-in personas for adversarial review. No other tool offers this.
- **Design-aware**: 17 context modules covering 6 UI platforms. Load design system rules on demand without wasting tokens.

---

## Quick Start

### One-Line Install

```bash
git clone https://github.com/Pangu-Immortal/qflow.git
cd qflow
bash setup.sh
```

`setup.sh` will:
1. Verify Node.js >= 18
2. Run `npm install` and `npm run build`
3. Auto-register qflow as an MCP server in Claude Code (`~/.claude.json`), Cursor (`.cursor/mcp.json`), and Windsurf (`~/.codeium/windsurf/mcp_config.json`)

### Manual Install

```bash
# Step 1 -- Install dependencies
npm install

# Step 2 -- Build
npm run build

# Step 3 -- Configure your AI editor (see MCP Configuration below)
```

### Initialize a Project

After setup, open your AI editor and say:

```
Initialize qflow for this project
```

Or use the CLI:

```bash
node dist/cli.js init /path/to/your/project
```

This creates a `.qflow/` directory with project config and task storage.

### MCP Configuration

Add qflow to your editor's MCP config. Replace `/absolute/path/to/qflow` with the actual path.

**Claude Code** (`~/.claude.json`):

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

**Cursor** (`.cursor/mcp.json` in your project):

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

**Windsurf** (`~/.codeium/windsurf/mcp_config.json`):

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

## AI Provider Configuration

> **This is the most important configuration step.** qflow uses AI for task expansion, spec generation, research, and complexity scoring. Without a key, these features fall back to heuristics and templates automatically -- the tool still works, just with reduced intelligence.

### Option A -- Environment Variables

Set these before launching your AI editor:

```bash
export QFLOW_API_KEY="sk-..."                        # Your API key
export QFLOW_BASE_URL="https://api.openai.com/v1"    # OpenAI-compatible endpoint
export QFLOW_MODEL="gpt-4o"                          # Model name
export QFLOW_PROVIDER="openai"                       # Provider name (see table below)
```

### Option B -- Project Config File

Create or edit `.qflow/qflow.config.json` in your project:

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

> **Security:** Never commit `.qflow/qflow.config.json` with a real API key. Add it to `.gitignore`.

### Supported Providers

qflow supports **16 providers** via OpenAI-compatible adapters:

| Provider | `QFLOW_PROVIDER` Value | Notes |
|----------|------------------------|-------|
| OpenAI | `openai` | GPT-4o, o3, o1 series |
| Anthropic | `anthropic` | Claude 3.5/3.7/4, extended thinking |
| Google Gemini | `google` | Gemini 1.5/2.0/2.5 Flash/Pro |
| Azure OpenAI | `azure` | Azure-hosted GPT models |
| Perplexity | `perplexity` | Search-augmented responses |
| Google Vertex AI | `vertex` | Enterprise Gemini via Vertex |
| Groq | `groq` | Fast inference, OpenAI-compatible |
| OpenRouter | `openrouter` | Multi-model routing |
| xAI (Grok) | `xai` | Grok models |
| Ollama | `ollama` | Local models (no key needed) |
| Codex CLI | `codex` | OpenAI Codex CLI adapter |
| Gemini CLI | `gemini-cli` | Google Gemini CLI adapter |
| DeepSeek | `deepseek` | DeepSeek models |
| Mistral | `mistral` | Mistral models |
| Together AI | `together` | Open-source model hosting |
| Any OpenAI-compatible | `openai` | Set custom `baseUrl` |

### Graceful Degradation (No API Key Required)

When no API key is configured, qflow still works:

| Feature | With API Key | Without API Key |
|---------|-------------|-----------------|
| `qflow_complexity_score` | AI-powered multi-dimension scoring | Heuristic scoring (keyword + structure analysis) |
| `qflow_task_expand` | AI generates contextual subtasks | Phase-based templates (Analysis > Implementation > Testing > Optimization > Deployment) |
| `qflow_spec_generate` | AI generates spec content | Template with placeholders |
| `qflow_research` | AI-powered research with sources | Template with placeholders |
| All other 46 tools | Full functionality | Full functionality (no AI dependency) |

---

## Tool Tiers

qflow uses a tiered tool system so you only load what you need:

| Mode | Tools Loaded | Included Tiers | Best For |
|------|-------------|----------------|----------|
| `minimal` / `core` | 10 | core | Minimal footprint, task basics only |
| `standard` | 32 | core + standard | **Recommended default** -- full task + spec + context workflow |
| `all` | 51 | core + standard + all | Power users: review, autopilot, TDD, sprints, plugins |

Set the mode via `QFLOW_MODE` environment variable or pass `QFLOW_TOOLS` for fine-grained control.

---

## Complete Tool Reference

### Tier: Core (10 tools -- always loaded)

| Tool | Description |
|------|-------------|
| `qflow_project_init` | Initialize project `.qflow/` directory, detect tech stack, install slash commands |
| `qflow_task_create` | Create task with auto heuristic complexity scoring (1-10) |
| `qflow_task_next` | Get recommended next task based on priority, dependencies, and state |
| `qflow_task_set_status` | Set task status; done triggers dependency unblocking and next-task recommendation |
| `qflow_task_list` | List/filter tasks by status, tags, or fuzzy query; supports `ready` and `blocking` modes |
| `qflow_task_expand` | Break a task into subtasks using AI (falls back to phase templates) |
| `qflow_context_load` | Load named context modules (core, phase1, phase2, ui-constraints, etc.) |
| `qflow_session_handoff` | Generate session handoff summary with progress, active tasks, and next recommendations |
| `qflow_what_next` | Project-state-aware smart navigation (detects phase: init/planning/implementing/reviewing/done) |
| `qflow_parse_prd` | Convert Markdown PRD into structured task tree; `autoCreate=true` writes tasks directly |

### Tier: Standard (22 tools -- loaded in `standard` and `all` modes)

| Tool | Description |
|------|-------------|
| `qflow_task_get` | Fetch full task details by ID |
| `qflow_task_update` | Update task fields (title, description, priority, deps, tags, implementationGuide, metadata) |
| `qflow_task_delete` | Delete task; `cascade=true` removes subtasks and cleans dependency refs |
| `qflow_task_tree` | Recursively get task and all subtasks as a tree structure |
| `qflow_task_batch` | Batch create/update/query/rewrite operations |
| `qflow_task_deps` | Manage task dependencies: add, remove, validate, get critical path |
| `qflow_context_status` | Show loaded context modules with per-module token breakdown |
| `qflow_context_compress` | Compress context: `aggressive` unloads modules, `moderate` returns suggestions |
| `qflow_spec_status` | Overview of all specs: count, pending changes, applied changes |
| `qflow_spec_init` | Create a new Spec document (types: architecture/api/ui/data/algorithm) |
| `qflow_spec_apply` | Apply pending Spec changes with deterministic merge (RENAMED > REMOVED > MODIFIED > ADDED) |
| `qflow_spec_verify` | 3-dimension verification: completeness, correctness, consistency |
| `qflow_spec_propose` | Propose Spec changes with SHA-256 conflict detection |
| `qflow_spec_generate` | AI-generate Spec content from description and project context |
| `qflow_complexity_score` | Score task/description complexity (1-10) with breakdown and expansion advice |
| `qflow_plan_generate` | Generate implementation plan from Spec (tech design + data model + API contract) |
| `qflow_tag_manage` | Manage task tags: add, remove, list, stats, filter by tag |
| `qflow_scope_navigate` | Navigate project scope: list modules, get details, find related tasks |
| `qflow_report` | Generate progress and complexity reports |
| `qflow_research` | AI-powered research with context injection and source tracking |
| `qflow_clarification` | Requirements Q&A: ask questions, record answers, list unanswered items |
| `qflow_onboarding` | Interactive onboarding guide: init, step, complete, progress, reset, report |

### Tier: All (18 tools -- loaded only in `all` mode)

| Tool | Description |
|------|-------------|
| `qflow_review` | Unified review: create/comment/resolve reviews, adversarial analysis, edge case hunting, UX checklist, risk assessment, root cause analysis, fault diagnosis |
| `qflow_autopilot` | Autonomous task execution: config, start, pause, resume, stop, step; 5 loop presets |
| `qflow_sprint` | Scrum sprint management: create sprint, add/update stories, complete sprint with retrospective |
| `qflow_workspace` | Workspace isolation by tag: isolate, switch, merge, status |
| `qflow_constitution` | Project governance principles: init, get, set (must/should/may), validate content |
| `qflow_template` | Template management: create (with `{{var}}` placeholders), apply, list |
| `qflow_memory` | Persistent memory: flush decisions/TODOs/blockers to MEMORY.md, load from MEMORY.md |
| `qflow_tdd` | TDD red-green-refactor loop: preset, step, loop (max iterations), status, reset |
| `qflow_use_tag` | Switch active workspace tag (each tag = isolated tasks.json) |
| `qflow_profile_switch` | Switch config profile (auto-applies mode + contextModules) |
| `qflow_tool_search` | Search registered MCP tools and slash commands by keyword or tier |
| `qflow_spec_sync` | Sync Spec content to target file (deterministic write or agent-guided diff) |
| `qflow_editor_rules` | Install editor rule files for 13 editors (Cursor, VSCode, Windsurf, Roo, Kiro, Zed, etc.) |
| `qflow_models_switch` | Switch AI model at runtime without restarting the MCP server |
| `qflow_diagnostics` | Full system health check: status, drift detection, file watcher (start/stop/events) |
| `qflow_agile` | Agile workflow presets: list phases, get phase details, execute step |
| `qflow_plugin` | Plugin lifecycle: install, remove, list, get, search, enable, disable |
| `qflow_workflow` | DAG workflow orchestration: start, advance, status, list workflows |
| `qflow_lottie` | Lottie animation generator: list 34 templates, generate with custom color/size/fps, get template info |

> **Total: 51 tools** across 3 tiers (core: 10, standard: 22, all: 19).

---

## CLI Reference

```bash
# -- Project -------------------------------------------------------
qflow init [projectRoot]              # Initialize .qflow/ directory
qflow install                         # Register MCP + install slash commands
qflow uninstall                       # Unregister MCP + remove slash commands
qflow generate [projectRoot]          # Export tasks to .md files

# -- Task Management -----------------------------------------------
qflow task add "Title" -d "Desc" -p 8 --deps T1,T2 --tags backend,auth
qflow task list [-s status] [--tags tag1,tag2]
qflow task next                       # Get recommended next task
qflow task done <id>                  # Mark done + auto-recommend next
qflow task expand <id> [-n 5]         # Split into N subtasks
qflow task deps-validate              # Check dependency graph for cycles

# -- Spec Management -----------------------------------------------
qflow spec init <name> [-t architecture|api|ui|data|algorithm] [-d "desc"]
qflow spec status                     # Overview: spec count + change stats
qflow spec verify <specId>            # Completeness / correctness / consistency

# -- Tag Management ------------------------------------------------
qflow tag add <taskIds> <tags>        # Add comma-separated tags to tasks
qflow tag remove <taskIds> <tags>     # Remove tags from tasks
qflow tag list                        # List all tags with task counts
qflow tag filter <tags> [-m and|or]   # Filter tasks by tag

# -- Reports -------------------------------------------------------
qflow report progress                 # Completion rate + status breakdown
qflow report complexity               # Complexity distribution + expand suggestions

# -- Global Flags --------------------------------------------------
--json        Machine-readable JSON output
--compact     Single-line compact output
```

---

## Core Concepts

### Task Lifecycle

```
pending --> active --> done
     \--> blocked   (waiting for dependency)
     \--> review    (QA checkpoint)
     \--> deferred  (parked for later)
     \--> cancelled
```

Tasks auto-unblock when dependencies complete. Parent tasks auto-complete when all children finish.

### Spec-Driven Development

```
spec init --> propose changes --> apply (SHA-256 conflict detection) --> archive
```

Each change is tracked with a SHA-256 fingerprint. Concurrent edits are detected and flagged before merge.

### Dependency Patterns

```
Linear:   T1 --> T2 --> T3          (sequential)
Fan-out:  T1 --> {T2, T3, T4}      (parallel)
Fan-in:   {T1, T2, T3} --> T4      (converge)
```

Cycle detection via Kahn's topological sort with automatic fix (break last edge).

---

## Architecture

```
qflow/
├── src/
│   ├── mcp.ts                      # MCP server entry, tier-based tool registration
│   ├── cli.ts                      # CLI entry (commander)
│   ├── core/                       # Domain logic (35+ modules)
│   │   ├── task-manager.ts         # Task CRUD, state machine, deps
│   │   ├── spec-workflow.ts        # Spec propose/apply/archive
│   │   ├── review-manager.ts       # Multi-perspective review
│   │   ├── autopilot-engine.ts     # Autonomous execution engine
│   │   ├── ai-provider.ts         # Multi-provider AI adapter
│   │   ├── provider-adapter.ts    # 16 provider adapters
│   │   ├── clarification-engine.ts# Requirements clarification Q&A
│   │   ├── onboarding.ts          # Interactive onboarding guide
│   │   ├── plugin-manager.ts      # Plugin install/enable/disable
│   │   ├── workflow-orchestrator.ts# DAG workflow execution
│   │   ├── sprint-manager.ts      # Scrum sprint management
│   │   ├── tdd-engine.ts          # TDD red-green-refactor loop
│   │   └── ...
│   ├── algorithms/                 # Complexity scoring, DAG validation, fuzzy search
│   ├── tools/                      # MCP tool registration
│   │   ├── tier-core.ts            # 10 core tools
│   │   ├── tier-standard.ts        # 22 standard tools
│   │   └── tier-all.ts             # 19 advanced tools
│   ├── schemas/                    # Zod data models
│   ├── shared/                     # Constants, helpers, prompt templates
│   └── templates/                  # Slash command .md templates
├── data/
│   ├── context-modules/            # 17 loadable context modules
│   ├── lottie-templates/           # 34 Lottie animation templates
│   └── prompts/                    # AI prompt templates (JSON)
└── package.json
```

**Design Principles:**

- **File-as-Database** -- All state in `.qflow/*.json`, no external DB needed
- **Zod Everywhere** -- Runtime schema validation on all data boundaries
- **AI-Optional** -- Every AI call has a template fallback; works without API keys
- **Graceful Degradation** -- Non-critical failures logged as warnings, never crash
- **Tier Isolation** -- Tools load on demand; `minimal` mode uses only 10 tools
- **4 Runtime Dependencies** -- `@modelcontextprotocol/sdk`, `zod`, `commander`, `chalk`

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `QFLOW_MODE` | Tool tier: `minimal` / `core` / `standard` / `all` | `standard` |
| `QFLOW_TOOLS` | Override with preset name or comma-separated tool list | -- |
| `QFLOW_API_KEY` | AI provider API key | -- |
| `QFLOW_BASE_URL` | AI provider base URL | `https://api.openai.com/v1` |
| `QFLOW_MODEL` | AI model name | `gpt-4o` |
| `QFLOW_PROVIDER` | Provider name (openai / anthropic / google / azure / groq / ollama / ...) | `openai` |
| `QFLOW_PROJECT_ROOT` | Override project root directory detection | auto-detected |

---

## FAQ

### What is qflow?

qflow is an open-source MCP (Model Context Protocol) server that adds structured AI project management capabilities to AI coding assistants. It provides 51 MCP tools for task management, spec-driven development, complexity scoring AI, multi-agent code review, and autonomous task execution -- all running locally with file-based project management and no database required.

### What is MCP (Model Context Protocol)?

MCP is an open protocol (Model Context Protocol) that lets AI assistants (like Claude Code, Cursor, Windsurf) connect to external tools and data sources. qflow implements an MCP server, so any MCP-compatible AI coding assistant can use qflow's 51 project management tools natively.

### Does qflow require an AI API key?

**No.** qflow works without any API key. AI-enhanced features (task expansion, spec generation, research, complexity scoring) gracefully fall back to heuristic algorithms and templates. All 46 non-AI tools work at full capability regardless.

### Which AI coding tools are supported?

qflow works with any MCP-compatible AI tool, including:
- **Claude Code** (Anthropic)
- **Cursor** (Anysphere)
- **Windsurf** (Codeium)
- **Codex CLI** (OpenAI)
- Any editor or tool that supports the Model Context Protocol

### How does qflow compare to Task Master AI?

Both are MCP servers for AI-assisted development. Task Master (44 tools) focuses on task management; qflow (51 tools) is an all-in-one solution adding spec-driven development, multi-agent review (12 personas), design system loading (6 platforms), Lottie animation engine, TDD loop, and sprint management. Key differences: qflow works without an API key (heuristic fallback), has only 4 runtime dependencies (vs Task Master's 61), and uses a pure MIT license (Task Master uses MIT + Commons Clause). See the [Comparison table](#comparison-with-alternatives) for a 30+ dimension breakdown.

### Can I use qflow without Claude Code?

Yes. qflow is an MCP server, not a Claude Code plugin. It works with Cursor, Windsurf, Codex CLI, and any MCP-compatible tool. You can also use the CLI directly (`qflow task add`, `qflow task list`, etc.) without any AI editor.

### How do tool tiers work?

qflow loads MCP tools based on the `QFLOW_MODE` environment variable. `core` loads 10 essential tools, `standard` (default) loads 32, and `all` loads all 51. This keeps your AI coding assistant's tool list clean and reduces token usage when you only need basic task management features.

### Is qflow free to use?

Yes. qflow is open source under the MIT license. It is free for personal and commercial use. The only potential cost is your own AI API key if you want AI-enhanced features for AI project management, but this is entirely optional.

### How many runtime dependencies does qflow have?

Only 4: `@modelcontextprotocol/sdk`, `zod`, `commander`, and `chalk`. qflow is designed to be lightweight with minimal supply chain risk.

### Can qflow manage large projects?

Yes. qflow supports dependency DAGs with cycle detection (Kahn's topological sort), critical path analysis, fan-out/fan-in patterns, sprint management, and workspace isolation by tag. The complexity scoring AI adapts planning tracks (Quick / Standard / Enterprise) based on project scale. Task dependency management is built into every workflow.

### How to generate Lottie animations with qflow?

Use the `qflow_lottie` MCP tool. It provides 34 preset templates across 6 categories (loading, feedback, interaction, transition, data, empty state). Simply tell your AI assistant what animation you need -- for example, "generate a success checkmark animation in blue" -- and qflow returns a standard Lottie JSON file compatible with Android, iOS, and Web. This Lottie animation generator MCP tool supports custom color, size, and frame rate.

### What context modules does qflow provide?

qflow ships 17 context modules for AI organized into two groups: 9 engineering modules (core, phase1, phase2, ui-constraints, context-guard, thinking-tiers, iron-rules, readme-spec, reverse) and 8 design system modules added in v24.0 (design-web, design-app, ui-web, ui-ios, ui-android, ui-game, pencil, ppt). Modules load on demand via `qflow_context_load` and are token-aware with auto-compression.

### How to use qflow without an API key?

Simply skip the `QFLOW_API_KEY` configuration. qflow is AI provider agnostic and works without any API key via graceful degradation. AI-enhanced features (task expansion, spec generation, research, complexity scoring) fall back to heuristic algorithms and templates. All 47 non-AI tools work at full capability. This makes qflow ideal for offline or air-gapped environments.

### What is the difference between qflow and Jira?

qflow is a file-based project management tool designed for AI coding assistants, while Jira is a web-based project tracker for human teams. qflow runs locally with no database required, integrates directly into Claude Code, Cursor, and Windsurf via the Model Context Protocol, and provides AI-powered features like PRD to tasks converter, autonomous task execution, and complexity scoring. Jira requires a hosted server, manual ticket creation, and has no native AI coding integration.

### How to manage task dependencies in qflow?

Use the `qflow_task_deps` tool for task dependency management: add dependencies between tasks, remove them, validate the dependency graph for cycles, and find the critical path. qflow uses Kahn's topological sort for cycle detection and automatically unblocks downstream tasks when dependencies complete. Dependencies support linear, fan-out, and fan-in patterns.

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Pangu-Immortal/qflow&type=Date)](https://star-history.com/#Pangu-Immortal/qflow&Date)

---

## Credits

Concepts and patterns inspired by:
- [Task Master AI](https://github.com/eyaltoledano/claude-task-master) -- Task management patterns
- [OpenSpec](https://github.com/eyaltoledano/openspec) -- Spec-driven development lifecycle
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) -- Model Context Protocol TypeScript SDK

---

## License

[MIT](LICENSE) -- Free for personal and commercial use.
