# 为 Qflow 做贡献

[English](./CONTRIBUTING.md)

欢迎提交 Pull Request。文档、示例和翻译与代码同样重要。

视频组件通常保存在视频项目自己的 `packages/` 目录中。需要跨项目共享时，由所有者通过自己的 npm scope 或私有 registry 发布，再由各项目的包管理器安装版本化发行包。希望将能力纳入官方发行时，可以通过 issue 说明它解决的共同制作需求。

## 开始之前

可以认领一个[已有的 issue](https://github.com/qflow-ai/qflow/issues)，也可以新开一个说明你想做的事。凡是会改动协议类型、包边界或 Provider 契约的改动，请先在 issue 里说明思路。

## 环境准备

需要 Node.js 22.15+ 和 pnpm 10.33，版本由根目录的 `packageManager` 字段指定。

```bash
corepack enable
pnpm install --frozen-lockfile
```

运行真实 Build 还需要 Python 3.10–3.13、uv、ffmpeg 和 Chromium，各自的用途见[开发指南](https://qflow.ai/zh/guide/develop/)。

使用本地渲染的 Profile，首次渲染前执行
`qflow programs up --runtime <profile> --endpoint <render-instance>`；也可以执行
`qflow runtime up --runtime <profile>`，准备整个 Profile 并启动 Worker。
这一步显式准备 Chrome，不依赖 pnpm 放行依赖安装脚本。
`qflow doctor --runtime <profile>` 只诊断，不安装。
浏览器路径配置见[本地渲染器 README](packages/provider-html-local/README.md)。

## 进行改动

| 改动范围 | 文档 |
| --- | --- |
| 新增 Author 包 | [添加 Author 包](https://qflow.ai/zh/guide/author-packages/) |
| 新增 Provider | [添加 Provider](https://qflow.ai/zh/guide/providers/) |
| 组件内部 | [组件解剖](https://qflow.ai/zh/guide/component-anatomy/) |
| Studio 界面翻译 | [Studio 本地化](packages/studio/LOCALIZATION.md) |
| 编译、Run 与 Build | [Runtime](https://qflow.ai/zh/guide/runtime/) |
| 命名、模块边界、wire 数据 | [代码规范](https://qflow.ai/zh/guide/conventions/) |
| 测试与依赖环境的测试套件 | [测试](https://qflow.ai/zh/guide/testing/) |

中英文档分别位于 `docs/` 和 `docs/zh/`，改动一侧的页面时，请一并改动对应的另一侧。

## 自查

每个 Pull Request 的 CI 都会运行下面这些命令，提交前先在本地跑一遍：

```bash
pnpm check         # TypeScript 类型检查
pnpm test          # 包与服务适配器测试
```

## 打包 Distribution

### 0.3.1 的 SDK 导入迁移

已有视频项目的准确导入映射、依赖调整与验证方法见
[Agent 迁移指南](migrations/0.3.1.md)。

视频领域 SDK 改为独立安装的包。组件代码使用 `@qflow/qflow/composition` 等旧根子路径时，
需要改为从 `@qflow/composition` 导入，并在组件自己的 `dependencies` 中声明该包。
Timeline、Temporal、Spatial、Media、Narrative、Caption、Generation、HTML Program、证据与
投影包同理。使用子路径 API 时，以所属包实际导出为准，例如 `@qflow/temporal/markup`、
`@qflow/temporal/studio`。通用宿主 API 继续由 `@qflow/qflow/*` 提供。
SVML 的逻辑 Module 引用仍保持 `@1`，这里改变的是 npm 归属和 TypeScript 导入路径。

根发行号定为 `0.3.1`，但上述 SDK 导入迁移与 `0.3.0` 并非源码兼容。
需要一起更新根和受影响的组件依赖，然后由项目的普通包管理器更新 lockfile。
已有领域包的新架构版本使用 `0.2.x`，避免旧 `^0.1.1` 依赖静默选择它们；
原先内嵌的领域包从 `0.1.0` 开始，未变化的包保留原版本。

### 构建与发布

运行 `npm run pack:distribution`，构建公共类型并将发布 tarball 写入 `dist/release/`。
脚本在临时目录中使用 npm 选定的文件，从英文 README 生成 npm 页面版本：使用公开图片地址，
保留两个 GIF，并将完整视频示例改为链接。仓库的两份 README 保持原样。
`dist/release/README.md` 可用于检查打包后的文案。

准备好 FFmpeg 和 FFprobe 后，运行
`npm run check:distribution -- dist/release/qflow-qflow-<version>.tgz`。它在仓库外安装该包，
编译包内的聊天示例组件，准备字体和本地渲染器，渲染、导出并解码视频。检查使用独立的
Qflow 状态目录，关闭 Puppeteer 隐式下载，先验证缺少浏览器的诊断，再在独立缓存中
显式准备浏览器。结束时停止自己的 Runtime Worker，失败时保留临时项目。
`npm package execution` 工作流在 PR 上执行这项检查，发布流程复用它；发布的就是已经
安装并执行过的同一份 tarball。

正式发布请走现有的 GitHub 工作流。把下一个稳定 npm 版本写入 `package.json` 并提交到
`main`，然后先在 `main` 上运行 **Actions → Publish npm → Run workflow**，填写该版本且不要勾选
**Publish to npm**。这会在不改动 npm 的情况下，对完整且不可变的候选版本运行 Linux/Windows
检查，并将其保留为可下载构件。这个准确提交通过后，再打开 **Releases → Draft a new release**，
选择该提交，打上标签 `v<version>`（例如 `v0.1.8`），写好发布说明后发布 Release。带标签的提交
必须包含此工作流。`Publish npm` 会核对标签与版本一致、且该提交属于 main 的历史，运行
Linux/Windows 检查，构建并检查打包后的 CLI，预检发布计划中的每个包在 npm 上的状态，
按依赖优先、根 Distribution 最后的顺序以 `latest` 发布，并把 tarball 附加到这次 Release。
只有全部检查、包安装与 Registry 预检成功后，才会发生任何 npm 写入。检查与打包使用触发时的
提交，即使随后 main 继续前进。此路径只支持稳定版，不支持预发布。

**Actions → Publish npm → Run workflow** 在 `main` 上仍然可用：填写已提交的版本，不勾选
**Publish to npm** 时只运行检查并提供可下载构件；勾选后则手动发布 npm。补完一次失败的 Release
发布时，先修好外部问题再重跑该 Release 的工作流。检查或包预检失败不会消耗 npm 版本。如果候选
版本没有任何包进入 npm，可以撤回 Release 与标签，修复代码但保留原定版本，再重新验证完整候选。
如果独立包已经发布了一部分，重跑同一个不可变候选即可：匹配的版本会被跳过，发布按依赖顺序继续。
只有根 Distribution 版本已经存在于 npm 后，根包代码变更才必须使用新的 patch 版本；资源上传失败等
外部步骤仍可在原版本上重跑。已经附在 Release 上的文件会保留。
push main、只 push 标签、或保存草稿 Release 都不会发布 npm。工作流不修改版本，也不创建标签。
可见的 Release 可以早于 npm 发布成功；对外宣布该 npm 版本可用前，先看这次 Actions 的结果。

独立包更新可在工作流的 **packages** 输入中填写空格分隔的准确包名，例如 `@qflow/studio`。
完整候选仍需安装检查，但只预检和发布所选包；现有根依赖范围仍适用时，不需要为此发布根包。
本地对应命令是 `node scripts/publish-release-candidate.mjs dist/release/release-plan.json --package=@qflow/studio`。
发行依赖使用明确的兼容范围，例如 `workspace:^0.3.0`；打包只去掉 workspace 前缀，
不会自动把兼容下限抬高到当前源码版本。

npm 包的 Trusted Publisher 应配置 GitHub Actions：组织 `qflow-ai`、仓库 `qflow`、工作流
`publish-npm.yml`，允许直接 `npm publish`，环境名称留空。发布 job 使用 OIDC，不需要保存 npm Token。
已发布的版本不能覆盖；`0.1.2` 等 npm 版本与逻辑接口 `@1` 分开管理。

发布说明应写明变化的用户行为，以及受影响的安装。npm Distribution 与已安装的 Skill 分开更新：
一次发布若两者都变，请同时链到相关 Skill 变更并说明两条更新路径。已保存的视频项目及其现有素材
独立于这两种安装。发布后，先核对工作流结果和 npm 上的已发布版本，再告诉用户更新可用。

## 提交 Pull Request

分支名与提交信息使用同一套前缀：分支用 `feat/`、`fix/`、`docs/`，提交信息用 `feat:`、`fix:`、`docs:`。

## Issue 与 PR 分析

维护者可在 Actions 的 **Repository analysis** 工作流中指定 Issue 或 PR，请求 AI 初步分析。
建议只显示在该次运行的报告里，Issue 与 PR 的管理仍由维护者操作。
输入与分析范围详见[维护指南](.github/ISSUE_AUTOMATION_DESIGN.md)。

## 获取帮助

在 [Discord](https://discord.gg/85hnyQnxpn) 或 [Telegram](https://t.me/qflowai) 提问。
