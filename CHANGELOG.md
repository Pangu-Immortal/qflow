# Changelog

## [25.0.0] - 2026-04-17

### Breaking Changes
- Remove all independent AI API calling infrastructure (ai-provider, provider-adapter, token-tracker)
- No API Key required — qflow is now a pure MCP tool layer

### Removed
- 1,659 lines of AI infrastructure code (16 provider adapters)
- `qflow_models_switch` tool (dead after AI removal)
- All `CallAIFn` type definitions and DI parameters

### Changed
- Default `QFLOW_MODE` from `standard` to `all` (load all 50 tools)
- 7 AI-enhanced tools refactored to template/heuristic paths
- README rewritten as product page (Chinese default, English available)

## [24.0.0] - 2026-04-17

### Added
- 8 context modules from design/UI skills (design-web, design-app, ui-web, ui-ios, ui-android, ui-game, pencil, ppt)
- Lottie animation engine with 34 JSON templates + `qflow_lottie` MCP tool
- `installMCPCursor()` and `installMCPWindsurf()` for multi-editor registration

### Changed
- Context modules: 9 → 17
- MCP tools: 45 → 51

## [23.1.0] - 2026-04-16

### Fixed
- Logger stdout → stderr (MCP transport pollution)
- Hardcoded install path → dynamic `import.meta.url` resolution
- Template path → dynamic resolution with src/dist fallback
- Prompt template key mismatch (`variants` → `prompts`)

### Added
- 7 reactivated modules (onboarding, workflow, plugin, drift detector, clarification, watch engine, agile presets)
- 6 new CLI command groups
- `setup.sh` one-line installer

## [23.0.0] - 2026-04-16

### Added
- Initial release: 45 MCP tools across 3 tiers
- Task management with 7-state machine and dependency DAG
- Spec-driven development lifecycle
- 5-dimension complexity scoring
- 12 built-in agent personas for multi-perspective review
- Autopilot engine with 5 loop presets
- PRD-to-tasks parser
- File-based state (no external database)
