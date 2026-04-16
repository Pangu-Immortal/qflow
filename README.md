# qflow

AI-powered project management MCP server for **Claude Code**, **Cursor**, **Windsurf**, **Codex** and any MCP-compatible AI coding tool.

> Turn your AI assistant into a project manager: task tracking, spec-driven development, dependency graphs, multi-agent orchestration, and automated quality gates — all through 50 MCP tools.

## Features

- **Task Management** — 7-state machine (pending/active/done/blocked/review/deferred/cancelled), dependency DAG with cycle detection, automatic next-task recommendation
- **Spec-Driven Development** — Propose → Apply → Archive lifecycle with SHA-256 conflict detection and Living Spec propagation
- **Complexity Scoring** — 5-dimension heuristic scoring (1–10) with scale-adaptive planning tracks (Quick / Standard / Enterprise)
- **Multi-Agent Orchestration** — 12 built-in personas (PM, Architect, QA, Security, DBA, DevOps…) for multi-perspective review and debate
- **Autopilot Engine** — Token-bucket rate-limited autonomous task execution with 5 loop presets
- **Quality Gates** — Adversarial review, edge case hunting, readiness checks, and 3-layer fault diagnosis
- **Context Management** — Modular context loading with token-aware compression to maximize LLM context efficiency
- **PRD Parser** — Convert Markdown PRDs into structured task trees automatically

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
# Step 1 — Install dependencies
npm install

# Step 2 — Build
npm run build

# Step 3 — Configure your AI editor (see MCP Configuration below)
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

---

## MCP Configuration

Add qflow to your editor's MCP config. Replace `/absolute/path/to/qflow` with the actual path.

### Claude Code (`~/.claude.json`)

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

### Cursor (`.cursor/mcp.json` in your project)

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

### Windsurf (`~/.codeium/windsurf/mcp_config.json`)

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

### QFLOW_MODE Options

| Mode | Tools | Description |
|------|-------|-------------|
| `minimal` | 10 | Core tools only — task basics |
| `core` | 10 | Same as minimal |
| `standard` | 32 | **Default** — full task + spec + context management |
| `all` | 52 | Everything — review, autopilot, TDD, sprints, plugins |

---

## AI Provider Configuration

> **This is the most important configuration step.** qflow uses AI for task expansion, spec generation, research, and complexity scoring. Without a key, these features fall back to heuristics and templates automatically — the tool still works, just with reduced intelligence.

### Option A — Environment Variables

Set these before launching your AI editor:

```bash
export QFLOW_API_KEY="sk-..."                        # Your API key
export QFLOW_BASE_URL="https://api.openai.com/v1"    # OpenAI-compatible endpoint
export QFLOW_MODEL="gpt-4o"                          # Model name
export QFLOW_PROVIDER="openai"                       # Provider name (see list below)
```

### Option B — Project Config File

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

| Provider | `QFLOW_PROVIDER` value | Notes |
|----------|------------------------|-------|
| OpenAI | `openai` | GPT-4o, o3, o1 series |
| Anthropic | `anthropic` | Claude 3.5/3.7, extended thinking |
| Google Gemini | `google` | Gemini 1.5/2.0 Flash/Pro |
| Azure OpenAI | `azure` | Azure-hosted GPT models |
| Perplexity | `perplexity` | Search-augmented responses |
| Google Vertex AI | `vertex` | Enterprise Gemini via Vertex |
| Groq | `groq` | Fast inference, OpenAI-compatible |
| OpenRouter | `openrouter` | Multi-model routing |
| xAI (Grok) | `xai` | Grok models |
| Ollama | `ollama` | Local models (no key needed) |
| Codex CLI | `codex` | OpenAI Codex CLI adapter |
| Gemini CLI | `gemini-cli` | Google Gemini CLI adapter |
| Any OpenAI-compatible | `openai` | Set custom `baseUrl` |

### Graceful Degradation

When no API key is configured:
- `qflow_complexity_score` — uses heuristic scoring (keyword + structure analysis)
- `qflow_task_expand` — falls back to phase-based templates (Analysis → Implementation → Testing → Optimization → Deployment)
- `qflow_spec_generate` / `qflow_research` — returns a template with placeholders
- All other tools work normally (no AI dependency)

---

## Tool Tiers

| Mode | Tools | Included Tiers | Use Case |
|------|-------|----------------|----------|
| `minimal` / `core` | 10 | core | Minimal footprint, task basics only |
| `standard` | 32 | core + standard | **Recommended default** — full workflow |
| `all` | 52 | core + standard + all | Power users: review, autopilot, TDD, sprints |

---

## Core Concepts

### Task Lifecycle

```
pending → active → done
     ↘ blocked   (waiting for dependency)
     ↘ review    (QA checkpoint)
     ↘ deferred  (parked for later)
     ↘ cancelled
```

Tasks auto-unblock when dependencies complete. Parent tasks auto-complete when all children finish.

### Spec-Driven Development

```
spec init → propose changes → apply (SHA-256 conflict detection) → archive
```

Each change is tracked with a SHA-256 fingerprint. Concurrent edits are detected and flagged before merge.

### Dependency Patterns

```
Linear:   T1 → T2 → T3          (sequential)
Fan-out:  T1 → {T2, T3, T4}     (parallel)
Fan-in:   {T1, T2, T3} → T4     (converge)
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
│   │   ├── ai-provider.ts          # Multi-provider AI adapter
│   │   ├── provider-adapter.ts     # 16 provider adapters
│   │   ├── clarification-engine.ts # Requirements clarification Q&A
│   │   ├── onboarding.ts           # Interactive onboarding guide
│   │   ├── plugin-manager.ts       # Plugin install/enable/disable
│   │   ├── workflow-orchestrator.ts# DAG workflow execution
│   │   ├── workflow-presets.ts     # Agile workflow phase presets
│   │   ├── sprint-manager.ts       # Scrum sprint management
│   │   ├── tdd-engine.ts           # TDD red-green-refactor loop
│   │   ├── config-drift-detector.ts# Config drift detection
│   │   ├── watch-engine.ts         # File system watcher
│   │   └── ...
│   ├── algorithms/                 # Complexity scoring, DAG validation, fuzzy search
│   ├── tools/                      # MCP tool registration
│   │   ├── tier-core.ts            # 10 core tools
│   │   ├── tier-standard.ts        # 22 standard tools
│   │   └── tier-all.ts             # 20 advanced tools
│   ├── schemas/                    # Zod data models
│   ├── shared/                     # Constants, helpers, prompt templates
│   └── templates/                  # Slash command .md templates
├── data/
│   ├── context-modules/            # Loadable context modules
│   └── prompts/                    # AI prompt templates (JSON)
└── package.json
```

**Design Principles:**
- **File-as-Database** — All state in `.qflow/*.json`, no external DB needed
- **Zod Everywhere** — Runtime schema validation on all data boundaries
- **AI-Optional** — Every AI call has a template fallback; works without API keys
- **Graceful Degradation** — Non-critical failures logged as warnings, never crash
- **Tier Isolation** — Tools load on demand; `minimal` mode uses only 10 tools

---

## MCP Tools Reference

### Tier: Core (10 tools)

| Tool | Description |
|------|-------------|
| `qflow_project_init` | Initialize project `.qflow/` directory, detect tech stack, install slash commands |
| `qflow_task_create` | Create task with auto heuristic complexity scoring (1–10) |
| `qflow_task_next` | Get recommended next task based on priority, deps, and state |
| `qflow_task_set_status` | Set task status; done triggers dependency unblocking and next-task recommendation |
| `qflow_task_list` | List/filter tasks by status, tags, or fuzzy query; supports `ready` and `blocking` modes |
| `qflow_task_expand` | Break a task into subtasks using AI (falls back to phase templates) |
| `qflow_context_load` | Load named context modules (core, phase1, phase2, ui-constraints, etc.) |
| `qflow_session_handoff` | Generate session handoff summary with progress, active tasks, and next recommendations |
| `qflow_what_next` | Project-state-aware smart navigation (detects phase: init/planning/implementing/reviewing/done) |
| `qflow_parse_prd` | Convert Markdown PRD into structured task tree; `autoCreate=true` writes tasks directly |

### Tier: Standard (22 tools)

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
| `qflow_spec_apply` | Apply pending Spec changes with deterministic merge (RENAMED→REMOVED→MODIFIED→ADDED) |
| `qflow_spec_verify` | 3-dimension verification: completeness, correctness, consistency |
| `qflow_spec_propose` | Propose Spec changes with SHA-256 conflict detection |
| `qflow_spec_generate` | AI-generate Spec content from description and project context |
| `qflow_complexity_score` | Score task/description complexity (1–10) with breakdown and expansion advice |
| `qflow_plan_generate` | Generate implementation plan from Spec (tech design + data model + API contract) |
| `qflow_tag_manage` | Manage task tags: add, remove, list, stats, filter by tag |
| `qflow_scope_navigate` | Navigate project scope: list modules, get details, find related tasks |
| `qflow_report` | Generate progress and complexity reports |
| `qflow_research` | AI-powered research with context injection and source tracking |
| `qflow_clarification` | Requirements Q&A: ask questions, record answers, list unanswered items |
| `qflow_onboarding` | Interactive onboarding guide: init, step, complete, progress, reset, report |

### Tier: All (20 tools)

| Tool | Description |
|------|-------------|
| `qflow_review` | Unified review tool: create/comment/resolve reviews, adversarial analysis, edge case hunting, UX checklist, risk assessment, root cause analysis, fault diagnosis |
| `qflow_autopilot` | Autonomous task execution: config, start, pause, resume, stop, step; supports 5 loop presets |
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

## CLI Usage

```bash
# ── Project ──────────────────────────────────────────────
qflow init [projectRoot]              # Initialize .qflow/ directory
qflow install                         # Register MCP + install slash commands
qflow uninstall                       # Unregister MCP + remove slash commands
qflow generate [projectRoot]          # Export tasks to .md files

# ── Task management ──────────────────────────────────────
qflow task add "Title" -d "Desc" -p 8 --deps T1,T2 --tags backend,auth
qflow task list [-s status] [--tags tag1,tag2]
qflow task next                       # Get recommended next task
qflow task done <id>                  # Mark done + auto-recommend next
qflow task expand <id> [-n 5]         # Split into N subtasks
qflow task deps-validate              # Check dependency graph for cycles

# ── Spec management ──────────────────────────────────────
qflow spec init <name> [-t architecture|api|ui|data|algorithm] [-d "desc"]
qflow spec status                     # Overview: spec count + change stats
qflow spec verify <specId>            # Completeness / correctness / consistency

# ── Tag management ───────────────────────────────────────
qflow tag add <taskIds> <tags>        # Add comma-separated tags to tasks
qflow tag remove <taskIds> <tags>     # Remove tags from tasks
qflow tag list                        # List all tags with task counts
qflow tag filter <tags> [-m and|or]   # Filter tasks by tag

# ── Reports ──────────────────────────────────────────────
qflow report progress                 # Completion rate + status breakdown
qflow report complexity               # Complexity distribution + expand suggestions

# ── Global flags ─────────────────────────────────────────
--json        Machine-readable JSON output
--compact     Single-line compact output
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `QFLOW_MODE` | Tool tier: `minimal` / `core` / `standard` / `all` | `standard` |
| `QFLOW_TOOLS` | Override with preset name or comma-separated tool list | — |
| `QFLOW_API_KEY` | AI provider API key | — |
| `QFLOW_BASE_URL` | AI provider base URL | `https://api.openai.com/v1` |
| `QFLOW_MODEL` | AI model name | `gpt-4o` |
| `QFLOW_PROVIDER` | Provider name (openai/anthropic/google/azure/perplexity/vertex/groq/…) | `openai` |
| `QFLOW_PROJECT_ROOT` | Override project root directory detection | auto-detected |

---

## Requirements

- **Node.js** >= 18.0.0
- **TypeScript** ^5.0.0 (dev dependency)

---

## Dependencies

Only 4 runtime dependencies:

| Package | Version | Purpose |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | ^1.28.0 | MCP protocol implementation |
| `zod` | ^4.3.6 | Runtime schema validation |
| `commander` | ^14.0.3 | CLI argument parsing |
| `chalk` | ^5.6.2 | Terminal color output |

---

## Credits

Concepts and patterns inspired by:
- [Task Master AI](https://github.com/eyaltoledano/claude-task-master) — Task management patterns
- [OpenSpec](https://github.com/eyaltoledano/openspec) — Spec-driven development lifecycle
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) — Model Context Protocol TypeScript SDK

---

## License

MIT
