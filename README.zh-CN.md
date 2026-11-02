<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/public/qflow-logo-light.svg">
    <img alt="Qflow" src="./docs/public/qflow-logo-dark.svg" width="400" height="122">
  </picture>
</p>

<h3 align="center">让 AI Agent 复刻任何爆款视频</h3>
<p align="center">SVML · 声明式视频工作流，锚定在词上，而不是秒上。</p>

<p align="center">
  <a href="./README.md"><strong>English</strong></a>
</p>

## 这是什么

Qflow 为 AI 编码 Agent（Claude Code、Codex 等）提供一套制作视频的语言和系统。
给它一条参考视频，Agent 就能把它变成一份完整、可编辑的工作流——画面、字幕、
B-roll、动效，全部锚定在词上。一条命令重跑整条片子，或者跑出上百个变体。

生成模型是可选的：字幕、代码渲染的画面和本地媒体，不调用任何生成服务也能
编译出一条成片。

## 安装

```bash
npx skills add Pangu-Immortal/qflow -g
```

需要 Node.js 22.15+。首次使用时 Agent 会检查 Qflow 可执行程序并按需协助安装。
视频项目可以放在任意位置；CLI 与 Agent Skill 共享同一套 SVML 源文件。

## 使用

把要复刻的视频交给 `/qflow` skill，或者直接描述你想要的视频：

```text
/qflow 复刻这条视频：/path/to/video.mp4，把排行榜内容换成我的产品。
/qflow 做一条把我产品排在 S 级的排行榜视频。
```

终端里同样一份源文件可以直接驱动 CLI：

```bash
qflow plan <run.svrun> --runtime <profile.json>   # 检查这个 Run 会做什么
qflow build <run.svrun> --runtime <profile.json>  # 端到端执行
qflow studio --run <run.svrun>                    # 边改边实时预览
```

### 产出位置

成片等交付物统一导出到**项目根目录的 `output/`**——这是给人和下游工具的唯一交付位置。
`qflow get` 会精确写到 `--to` 指向的路径，所以请在项目根目录执行：

```bash
qflow get <build-id> --output final.video --to output/final.mp4
```

中间 Build 数据在 `.qflow/results/`，不作为交付物。被取代的旧导出放入 `output/archive/`。

凭据不进仓库：runtime profile 只引用凭据存储（如环境变量存储），
从不内嵌密钥。

## 示例

| 示例 | 展示什么 |
| --- | --- |
| [排行榜 / UGC](examples/ranking-football/README.md) | 词级同步排行榜、卡拉OK字幕、B-roll |
| [播客](examples/podcast/README.md) | 分屏访谈、说话人感知字幕 |
| [街头采访](examples/interview/README.md) | 头部跟踪字幕、表情揭晓板 |
| [复杂讲解片](examples/complex-explainer/README.md) | 多场景产品讲解、语音参考 |

## 文档

- [快速开始](docs/zh/quickstart.md)
- [开发指南](docs/zh/guide/develop.md) —— 架构、包、规范、测试
- [Skill 参考](skills/qflow/SKILL.md) —— 完整 Agent Skill

## 许可

Apache-2.0 附加条件 —— 见 [LICENSE](./LICENSE)。
