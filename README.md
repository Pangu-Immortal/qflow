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
[![Tools](https://img.shields.io/badge/MCP%20Tools-50-orange.svg)]()
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Ready-success.svg)](https://claude.ai)
[![Cursor](https://img.shields.io/badge/Cursor-Ready-success.svg)](https://cursor.sh)
[![Windsurf](https://img.shields.io/badge/Windsurf-Ready-success.svg)](https://codeium.com/windsurf)

[English](README.md) | [简体中文](README-zh.md)

</div>

---

> **qflow is an open-source MCP server for AI-powered project management, task tracking, and spec-driven development -- designed for Claude Code, Cursor, Windsurf, and any MCP-compatible AI coding tool.**

qflow turns your AI coding assistant into a full project manager. With 50 MCP tools spanning task management, dependency graphs, multi-agent orchestration, complexity scoring, and automated quality gates, qflow brings structured engineering workflow to AI-assisted development. No external database required -- everything runs locally via file-based state.

---

## Features

- **50 MCP Tools in 3 Tiers** -- Granular control over which tools load. Start with 10 core tools, scale to 50 for enterprise workflows.
- **7-State Task Machine** -- Tasks flow through `pending > active > done > blocked > review > deferred > cancelled` with automatic dependency unblocking and next-task recommendation.
- **Spec-Driven Development** -- Propose, apply, and archive specification changes with SHA-256 conflict detection and living spec propagation.
- **5-Dimension Complexity Scoring** -- Heuristic scoring (1-10) with scale-adaptive planning tracks: Quick, Standard, and Enterprise.
- **12 Built-in Agent Personas** -- PM, Architect, QA, Security, DBA, DevOps and more for multi-perspective review and adversarial debate.
- **Autopilot Engine** -- Token-bucket rate-limited autonomous task execution with 5 loop presets for hands-free project progression.
- **PRD-to-Tasks Parser** -- Convert Markdown PRDs into structured task trees with a single command. Auto-creates tasks with dependencies.
- **16 AI Provider Support** -- OpenAI, Anthropic, Google Gemini, Azure, Groq, Ollama, and more. Works without any API key via graceful degradation.

---

## Comparison with Alternatives

How does qflow compare to other AI project management tools?

| Feature | **qflow** | Task Master AI | OpenSpec | Manual Management |
|---------|-----------|----------------|----------|-------------------|
| MCP Tools | **50** | ~20 | ~10 | 0 |
| Tool Tiers (load control) | **3 tiers** | None | None | N/A |
| Task State Machine | **7 states** | 3 states | None | Ad-hoc |
| Dependency DAG + Cycle Detection | **Yes** | Partial | No | Manual |
| Spec-Driven Development | **Full lifecycle** | No | Yes | Manual |
| Complexity Scoring | **5-dimension** | Basic | No | Gut feeling |
| Multi-Agent Personas | **12 personas** | No | No | No |
| Autopilot Engine | **5 presets** | No | No | No |
| AI Provider Support | **16 providers** | OpenAI only | OpenAI only | N/A |
| Works Without API Key | **Yes (heuristic fallback)** | No | No | N/A |
| PRD Parser | **Yes** | No | No | Manual |
| Sprint Management | **Yes** | No | No | Jira/Linear |
| TDD Loop | **Yes** | No | No | Manual |
| Runtime Dependencies | **4 packages** | 10+ | 5+ | N/A |
| File-Based (no DB) | **Yes** | Yes | Yes | Spreadsheets |
| Claude Code / Cursor / Windsurf | **All supported** | Claude only | Claude only | N/A |

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
| `all` | 50 | core + standard + all | Power users: review, autopilot, TDD, sprints, plugins |

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

> **Total: 50 tools** across 3 tiers (core: 10, standard: 22, all: 18).

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
│   │   └── tier-all.ts             # 18 advanced tools
│   ├── schemas/                    # Zod data models
│   ├── shared/                     # Constants, helpers, prompt templates
│   └── templates/                  # Slash command .md templates
├── data/
│   ├── context-modules/            # Loadable context modules
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

qflow is an open-source MCP (Model Context Protocol) server that adds structured project management capabilities to AI coding assistants. It provides 50 tools for task tracking, spec-driven development, complexity scoring, multi-agent review, and autonomous task execution -- all running locally with file-based state.

### What is MCP (Model Context Protocol)?

MCP is an open protocol that lets AI assistants (like Claude Code, Cursor, Windsurf) connect to external tools and data sources. qflow implements an MCP server, so any MCP-compatible AI tool can use qflow's 50 project management tools natively.

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

qflow offers more tools (50 vs ~20), more task states (7 vs 3), multi-agent personas (12 built-in), autopilot engine, TDD loop, sprint management, and support for 16 AI providers. qflow also works without an API key. See the [Comparison table](#comparison-with-alternatives) for a full breakdown.

### Can I use qflow without Claude Code?

Yes. qflow is an MCP server, not a Claude Code plugin. It works with Cursor, Windsurf, Codex CLI, and any MCP-compatible tool. You can also use the CLI directly (`qflow task add`, `qflow task list`, etc.) without any AI editor.

### How do tool tiers work?

qflow loads tools based on the `QFLOW_MODE` environment variable. `core` loads 10 essential tools, `standard` (default) loads 32, and `all` loads all 50. This keeps your AI assistant's tool list clean and reduces token usage when you only need basic features.

### Is qflow free to use?

Yes. qflow is open-source under the MIT license. It is free for personal and commercial use. The only potential cost is your own AI API key if you want AI-enhanced features, but this is entirely optional.

### How many runtime dependencies does qflow have?

Only 4: `@modelcontextprotocol/sdk`, `zod`, `commander`, and `chalk`. qflow is designed to be lightweight with minimal supply chain risk.

### Can qflow manage large projects?

Yes. qflow supports dependency DAGs with cycle detection (Kahn's topological sort), critical path analysis, fan-out/fan-in patterns, sprint management, and workspace isolation by tag. The complexity scoring system adapts planning tracks (Quick / Standard / Enterprise) based on project scale.

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
