加载上下文守卫完整版模块。

请调用 MCP 工具 `qflow_context_load`，参数：
```json
{
  "modules": ["context-guard"]
}
```

加载后你将获得上下文守卫机制的完整规则，包括预检、记忆 Flush、压缩、重置四阶段防线。