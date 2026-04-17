#!/bin/bash
# setup.sh - qflow 一键安装脚本
# 功能: 检查环境 → 安装依赖 → 编译 → 自动注册 MCP Server (Claude Code / Cursor / Windsurf)
# 用法: bash setup.sh

set -e

# ==================== 彩色输出工具 ====================
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[qflow]${NC} $1"; }
success() { echo -e "${GREEN}[qflow] ✓${NC} $1"; }
warn()    { echo -e "${YELLOW}[qflow] ⚠${NC} $1"; }
error()   { echo -e "${RED}[qflow] ✗${NC} $1"; exit 1; }

# ==================== 1. 检查 Node.js >= 18 ====================
info "Checking Node.js version..."

if ! command -v node &>/dev/null; then
  error "Node.js is not installed. Please install Node.js >= 18 from https://nodejs.org"
fi

NODE_VERSION=$(node -e "process.stdout.write(process.versions.node)")
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

if [ "$NODE_MAJOR" -lt 18 ]; then
  error "Node.js >= 18 is required. Current version: $NODE_VERSION. Please upgrade: https://nodejs.org"
fi

success "Node.js $NODE_VERSION detected"

# ==================== 2. 检查 npm ====================
info "Checking npm..."

if ! command -v npm &>/dev/null; then
  error "npm is not found. Please install Node.js with npm from https://nodejs.org"
fi

NPM_VERSION=$(npm --version)
success "npm $NPM_VERSION detected"

# ==================== 3. 安装依赖 ====================
info "Installing dependencies..."
npm install || error "npm install failed. Check your internet connection and try again."
success "Dependencies installed"

# ==================== 4. 编译 TypeScript ====================
info "Building TypeScript..."
npm run build || error "Build failed. Run 'npm run build' manually to see the error details."
success "Build completed"

# ==================== 5. 计算 MCP Server 路径 ====================
MCP_PATH="$(pwd)/dist/mcp.js"

if [ ! -f "$MCP_PATH" ]; then
  error "Build output not found at $MCP_PATH. Build may have failed silently."
fi

success "MCP server path: $MCP_PATH"

# ==================== 6. JSON 操作工具函数 ====================
# 优先使用 jq，若不可用则降级到 Node.js 内联脚本

HAS_JQ=false
if command -v jq &>/dev/null; then
  HAS_JQ=true
fi

# 用 Node.js 向 JSON 文件的指定路径注入 qflow MCP 配置
# 参数: $1=JSON文件路径  $2=mcpServers key路径(如 "mcpServers" 或 "mcpServers")
inject_mcp_config_node() {
  local CONFIG_FILE="$1"
  local MCP_JS_PATH="$2"

  node -e "
const fs = require('fs');
const path = require('path');
const configFile = '$CONFIG_FILE';
const mcpPath = '$MCP_JS_PATH';

let config = {};
try {
  if (fs.existsSync(configFile)) {
    config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  }
} catch (e) {
  config = {};
}

if (!config.mcpServers) config.mcpServers = {};
config.mcpServers.qflow = {
  command: 'node',
  args: [mcpPath],
  env: { QFLOW_MODE: 'all' }
};

const dir = path.dirname(configFile);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');
console.log('OK');
" 2>&1
}

# ==================== 7. 注册 Claude Code MCP ====================
CLAUDE_JSON="$HOME/.claude.json"
info "Registering qflow in Claude Code ($CLAUDE_JSON)..."

if $HAS_JQ; then
  # 使用 jq 合并（保留已有配置）
  TEMP_FILE=$(mktemp)
  NEW_ENTRY="{\"command\":\"node\",\"args\":[\"$MCP_PATH\"],\"env\":{\"QFLOW_MODE\":\"all\"}}"

  if [ -f "$CLAUDE_JSON" ]; then
    jq --argjson entry "$NEW_ENTRY" '.mcpServers.qflow = $entry' "$CLAUDE_JSON" > "$TEMP_FILE" \
      && mv "$TEMP_FILE" "$CLAUDE_JSON" \
      && success "Claude Code: qflow registered in $CLAUDE_JSON" \
      || { warn "jq write failed, falling back to Node.js"; inject_mcp_config_node "$CLAUDE_JSON" "$MCP_PATH" > /dev/null && success "Claude Code: qflow registered (Node.js fallback)"; }
  else
    echo "{\"mcpServers\":{\"qflow\":$NEW_ENTRY}}" | jq . > "$CLAUDE_JSON" \
      && success "Claude Code: $CLAUDE_JSON created with qflow" \
      || { warn "jq create failed, falling back to Node.js"; inject_mcp_config_node "$CLAUDE_JSON" "$MCP_PATH" > /dev/null && success "Claude Code: qflow registered (Node.js fallback)"; }
  fi
else
  # 降级到 Node.js 内联脚本
  RESULT=$(inject_mcp_config_node "$CLAUDE_JSON" "$MCP_PATH")
  if [ "$RESULT" = "OK" ]; then
    success "Claude Code: qflow registered in $CLAUDE_JSON"
  else
    warn "Claude Code registration failed: $RESULT"
  fi
fi

# ==================== 8. 注册 Cursor MCP ====================
CURSOR_MCP=".cursor/mcp.json"
info "Registering qflow in Cursor ($CURSOR_MCP)..."

if $HAS_JQ; then
  TEMP_FILE=$(mktemp)
  NEW_ENTRY="{\"command\":\"node\",\"args\":[\"$MCP_PATH\"],\"env\":{\"QFLOW_MODE\":\"all\"}}"

  if [ -f "$CURSOR_MCP" ]; then
    jq --argjson entry "$NEW_ENTRY" '.mcpServers.qflow = $entry' "$CURSOR_MCP" > "$TEMP_FILE" \
      && mv "$TEMP_FILE" "$CURSOR_MCP" \
      && success "Cursor: qflow registered in $CURSOR_MCP" \
      || { warn "jq write failed, falling back to Node.js"; inject_mcp_config_node "$CURSOR_MCP" "$MCP_PATH" > /dev/null && success "Cursor: qflow registered (Node.js fallback)"; }
  else
    mkdir -p "$(dirname "$CURSOR_MCP")"
    echo "{\"mcpServers\":{\"qflow\":$NEW_ENTRY}}" | jq . > "$CURSOR_MCP" \
      && success "Cursor: $CURSOR_MCP created with qflow" \
      || { warn "jq create failed, falling back to Node.js"; inject_mcp_config_node "$CURSOR_MCP" "$MCP_PATH" > /dev/null && success "Cursor: qflow registered (Node.js fallback)"; }
  fi
else
  RESULT=$(inject_mcp_config_node "$CURSOR_MCP" "$MCP_PATH")
  if [ "$RESULT" = "OK" ]; then
    success "Cursor: qflow registered in $CURSOR_MCP"
  else
    warn "Cursor registration failed: $RESULT"
  fi
fi

# ==================== 9. 注册 Windsurf MCP ====================
WINDSURF_MCP="$HOME/.codeium/windsurf/mcp_config.json"
info "Registering qflow in Windsurf ($WINDSURF_MCP)..."

if $HAS_JQ; then
  TEMP_FILE=$(mktemp)
  NEW_ENTRY="{\"command\":\"node\",\"args\":[\"$MCP_PATH\"],\"env\":{\"QFLOW_MODE\":\"all\"}}"

  if [ -f "$WINDSURF_MCP" ]; then
    jq --argjson entry "$NEW_ENTRY" '.mcpServers.qflow = $entry' "$WINDSURF_MCP" > "$TEMP_FILE" \
      && mv "$TEMP_FILE" "$WINDSURF_MCP" \
      && success "Windsurf: qflow registered in $WINDSURF_MCP" \
      || { warn "jq write failed, falling back to Node.js"; inject_mcp_config_node "$WINDSURF_MCP" "$MCP_PATH" > /dev/null && success "Windsurf: qflow registered (Node.js fallback)"; }
  else
    mkdir -p "$(dirname "$WINDSURF_MCP")"
    echo "{\"mcpServers\":{\"qflow\":$NEW_ENTRY}}" | jq . > "$WINDSURF_MCP" \
      && success "Windsurf: $WINDSURF_MCP created with qflow" \
      || { warn "jq create failed, falling back to Node.js"; inject_mcp_config_node "$WINDSURF_MCP" "$MCP_PATH" > /dev/null && success "Windsurf: qflow registered (Node.js fallback)"; }
  fi
else
  RESULT=$(inject_mcp_config_node "$WINDSURF_MCP" "$MCP_PATH")
  if [ "$RESULT" = "OK" ]; then
    success "Windsurf: qflow registered in $WINDSURF_MCP"
  else
    warn "Windsurf registration failed: $RESULT"
  fi
fi

# ==================== 10. 完成提示 ====================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  qflow v25.0 安装完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  MCP Server: ${BLUE}$MCP_PATH${NC}"
echo -e "  Default mode: ${BLUE}all${NC} (51 tools)"
echo ""
echo -e "${BLUE}开始使用:${NC}"
echo "  1. 重启你的编辑器 (Claude Code / Cursor / Windsurf)"
echo "  2. 在任意项目中告诉 AI: '用 qflow 初始化这个项目'"
echo "  3. 或运行: node dist/cli.js init /path/to/your/project"
echo ""
echo -e "  文档: ${BLUE}https://github.com/Pangu-Immortal/qflow${NC}"
echo ""
