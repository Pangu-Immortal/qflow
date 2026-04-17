# 贡献指南

感谢你对 qflow 的关注！欢迎提交 Issue 和 Pull Request。

## 开发环境

```bash
# 克隆仓库
git clone https://github.com/Pangu-Immortal/qflow.git
cd qflow

# 安装依赖
npm install

# 编译
npm run build

# 本地运行
npm start
```

要求 Node.js >= 18。

## 提交 PR

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feat/your-feature`
3. 提交更改：`git commit -m "feat: 简要描述"`
4. 推送分支：`git push origin feat/your-feature`
5. 在 GitHub 上创建 Pull Request

### Commit 规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

- `feat:` 新功能
- `fix:` 修复 Bug
- `docs:` 文档变更
- `refactor:` 重构
- `chore:` 构建/工具变更

## 代码规范

- 使用 TypeScript，所有参数和返回值必须有精确类型声明（禁止 `any`）
- 简体中文注释，关键逻辑每行注释
- 工具输入参数使用 Zod schema 验证
- 文件头写功能和函数简介

## Issue 指南

- **Bug 报告**：使用 Bug Report 模板，提供环境信息和复现步骤
- **功能请求**：使用 Feature Request 模板，描述问题和建议方案

## 许可证

提交 PR 即表示你同意你的贡献以 [MIT License](./LICENSE) 发布。
