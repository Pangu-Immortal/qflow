# qflow

AI-powered project management MCP server for **Claude Code**, **Cursor**, **Windsurf**, **Codex** and any MCP-compatible AI coding tool.

> Turn your AI assistant into a project manager: task tracking, spec-driven development, dependency graphs, multi-agent orchestration, and automated quality gates — all through MCP tools.

## Features

- **Task Management** — Create, expand, prioritize, and track tasks with a 7-state machine, dependency DAG, and automatic next-task recommendation
- **Spec-Driven Development** — Propose → Apply → Archive lifecycle with SHA-256 conflict detection and Living Spec propagation
- **Complexity Scoring** — 5-dimension heuristic scoring (1-10) with scale-adaptive planning (Quick / Standard / Enterprise tracks)
- **Multi-Agent Orchestration** — 12 built-in personas (PM, Architect, QA, Security, DBA, DevOps...) for multi-perspective review and debate
- **Autopilot Engine** — Token-bucket rate-limited autonomous task execution with 5 loop presets
- **Quality Gates** — Adversarial review, edge case hunting, readiness checks, and 3-layer fault diagnosis
- **Context Management** — Modular context loading with token-aware compression to maximize LLM context efficiency
- **PRD Parser** — Convert Markdown PRDs into task trees automatically

## Quick Start

### 1. Install

```bash
git clone https://github.com/Pangu-Immortal/qflow.git
cd qflow
npm install
npm run build
```

### 2. Register as MCP Server

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "qflow": {
      "command": "node",
      "args": ["/path/to/qflow/dist/mcp.js"],
      "env": {
        "QFLOW_MODE": "standard"
      }
    }
  }
}
```

For **Cursor**, add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "qflow": {
      "command": "node",
      "args": ["/path/to/qflow/dist/mcp.js"],
      "env": {
        "QFLOW_MODE": "standard"
      }
    }
  }
}
```

### 3. Initialize a Project

In your AI tool, say:

```
Initialize qflow for this project
```

Or use the CLI:

```bash
node dist/cli.js init /path/to/your/project
```

This creates a `.qflow/` directory with project config and task storage.

## Tool Tiers

qflow uses tiered tool loading to control token consumption:

| Mode | Tools | Use Case |
|------|-------|----------|
| `minimal` | 7 | Lightweight — task basics only |
| `core` | 15 | Default — task CRUD + context |
| `standard` | 30 | Full — specs, deps, scoring |
| `all` | 45 | Everything — review, autopilot, sprints |

Set via `QFLOW_MODE` env var. Default is `standard`.

## Core Concepts

### Task Lifecycle

```
pending → active → done
     ↘ blocked (waiting for deps)
     ↘ review (QA checkpoint)
     ↘ deferred (parked)
     ↘ cancelled
```

Tasks auto-unblock when dependencies complete. Parent tasks auto-complete when all children finish.

### Spec-Driven Development

```
spec init → propose changes → apply (with conflict detection) → archive
```

Each change is tracked with SHA-256 fingerprints. Concurrent edits are detected and flagged before merge.

### Dependency Patterns

```
Linear:   M1 → M2 → M3        (sequential)
Fan-out:  M1 → {M2, M3, M4}   (parallel)
Fan-in:   {M1, M2, M3} → M4   (converge)
```

Cycle detection via Kahn's topological sort with automatic fix (break last edge).

## Architecture

```
qflow/
├── src/
│   ├── mcp.ts                 # MCP server entry
│   ├── cli.ts                 # CLI entry
│   ├── core/                  # Domain logic (35+ modules)
│   │   ├── task-manager.ts    # Task CRUD, state machine, deps
│   │   ├── spec-workflow.ts   # Spec propose/apply/archive
│   │   ├── review-manager.ts  # Multi-perspective review
│   │   ├── autopilot-engine.ts# Autonomous execution
│   │   └── ...
│   ├── algorithms/            # Complexity scoring, DAG validation
│   ├── tools/                 # MCP tool registration (3 tiers)
│   ├── schemas/               # Zod data models
│   └── shared/                # Constants, helpers
├── data/
│   ├── context-modules/       # Loadable context modules
│   └── prompts/               # AI prompt templates
└── package.json
```

**Design Principles:**
- **File-as-Database** — All state in `.qflow/*.json`, no external DB needed
- **Zod Everywhere** — Runtime schema validation on all data boundaries
- **AI-Optional** — Every AI call has a template fallback; works without API keys
- **Graceful Degradation** — Non-critical failures logged as warnings, never crash

## Key MCP Tools

| Tool | Description |
|------|-------------|
| `qflow_project_init` | Initialize project with tech stack detection |
| `qflow_task_create` | Create task with auto complexity scoring |
| `qflow_task_next` | Get recommended next task (smart sorting) |
| `qflow_task_expand` | Break task into subtasks with AI |
| `qflow_task_list` | List/filter tasks (status, tags, ready, blocking) |
| `qflow_parse_prd` | Convert Markdown PRD → task tree |
| `qflow_spec_propose` | Propose spec changes with conflict detection |
| `qflow_complexity_score` | Score task complexity (1-10) |
| `qflow_research` | AI-powered research with context injection |
| `qflow_report` | Progress and complexity reports |
| `qflow_what_next` | Smart recommendation based on project state |

[Full tool list →](docs/TOOLS.md)

## CLI Usage

```bash
# Task management
qflow task add "Implement login" -d "OAuth2 + JWT" -p 8
qflow task list
qflow task next
qflow task done T1

# Spec management
qflow spec init "API Design" -t api
qflow spec status

# Reports
qflow report progress
qflow report complexity
```

## Requirements

- Node.js >= 18.0.0
- TypeScript ^5.0.0

## Dependencies

Only 4 runtime dependencies:

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP protocol |
| `zod` | Schema validation |
| `commander` | CLI parsing |
| `chalk` | Terminal colors |

## Credits

Concepts inspired by:
- [Task Master AI](https://github.com/eyaltoledano/claude-task-master) — Task management patterns
- [OpenSpec](https://github.com/eyaltoledano/openspec) — Spec-driven development lifecycle
- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) — Model Context Protocol

## License

MIT
