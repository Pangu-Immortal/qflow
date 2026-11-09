<div align="center">

![萌萌计数器](https://count.getloli.com/get/@qflow?theme=rule34)

</div>

<p align="center">
  <b>如果觉得有帮助，请点击 <a href="https://github.com/Pangu-Immortal/qflow/stargazers">Star</a> 支持一下，关注不迷路！</b>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/public/qflow-logo-light.svg">
    <img alt="Qflow" src="./docs/public/qflow-logo-dark.svg" width="400" height="122">
  </picture>
</p>

<h3 align="center">Clone any viral video with AI agents</h3>
<p align="center">SVML · declarative video workflows anchored on words, not seconds.</p>

<p align="center">
  <a href="./README.zh-CN.md"><strong>简体中文</strong></a>
</p>

## What it is

Qflow gives AI coding agents (Claude Code, Codex, ...) a language and system to author video.
Drop in a reference video and your agent turns it into a complete, editable workflow — footage,
captions, B-roll, motion graphics — all anchored to words instead of seconds. One command reruns
the whole film, or a hundred variants of it.

Generation models are optional: a workflow can compile captions, code-rendered visuals and local
media into a finished video without calling any generation service.

## Install

```bash
npx skills add Pangu-Immortal/qflow -g
```

Requires Node.js 22.15+. Your agent checks for the Qflow executable on first use and helps prepare
it. Video projects live anywhere; the CLI and the agent skill share the same SVML sources.

## Use

Give the `/qflow` skill a video to clone, or describe the video you want:

```text
/qflow Clone this video: /path/to/video.mp4, and replace the ranking content with my product.
/qflow Make a ranking video that puts my product in S tier.
```

From a terminal, the same sources drive the CLI directly:

```bash
qflow plan <run.svrun> --runtime <profile.json>   # check what a Run will do
qflow build <run.svrun> --runtime <profile.json>  # execute it end to end
qflow studio --run <run.svrun>                    # live preview while you edit
```

### Output location

Finished deliverables are exported to the project root `output/` directory — the single
delivery location for people and downstream tools. `qflow get` writes exactly where `--to`
points, so run it from the project root:

```bash
qflow get <build-id> --output final.video --to output/final.mp4
```

Intermediate Build data lives in `.qflow/results/` and is never a delivery artifact.
Archived or superseded exports go under `output/archive/`.

Credentials stay out of the repository: runtime profiles reference credential stores
(such as the environment-variable store) and never embed secrets.

## Examples

| Example | What it shows |
| --- | --- |
| [Ranking / UGC](examples/ranking-football/README.md) | Word-synced ranking board, karaoke captions, B-roll |
| [Podcast](examples/podcast/README.md) | Split-screen interview, speaker-aware captions |
| [Street interview](examples/interview/README.md) | Head-tracked captions, emoji reveal board |
| [Complex explainer](examples/complex-explainer/README.md) | Multi-scene product explainer, voice references |

## Docs

- [Quickstart](docs/quickstart.md)
- [Guide](docs/guide/develop.md) — architecture, packages, conventions, testing
- [Skill reference](skills/qflow/SKILL.md) — the full agent skill

## License

Apache-2.0 with additional conditions — see [LICENSE](./LICENSE).
---

## Star 趋势

[![Star History Chart](https://api.star-history.com/svg?repos=Pangu-Immortal/qflow&type=Date)](https://star-history.com/#Pangu-Immortal/qflow&Date)

## 联系与交流

<p align="center">
  <a href="https://mengqihome.cn"><img src="https://img.shields.io/badge/官网-mengqihome.cn-00e5a0?style=flat-square" alt="官网"></a>
  <a href="https://github.com/Pangu-Immortal"><img src="https://img.shields.io/badge/GitHub-Pangu--Immortal-181717?style=flat-square&logo=github" alt="GitHub"></a>
  <a href="https://t.me/+MH0wU421vyQwYzBl"><img src="https://img.shields.io/badge/Telegram-交流群-26A5E4?style=flat-square&logo=telegram" alt="Telegram"></a>
  <img src="https://img.shields.io/github/stars/Pangu-Immortal/qflow?style=flat-square&logo=github&label=Stars" alt="Stars">
</p>

<p align="center">
  <b>微信公众号</b><br>
  <img src="https://mengqihome.cn/assets/wechat-qr.jpg" width="140" alt="微信公众号二维码"><br>
  扫码关注 · 案例复盘与方法论
</p>

**更多入口**：[GitHub 主页](https://github.com/Pangu-Immortal) · [Telegram 群](https://t.me/+MH0wU421vyQwYzBl) · [官网](https://mengqihome.cn)

## 许可

本项目采用 [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0) 授权：**允许非商业目的的使用、修改与分发；禁止任何商业性使用**。商业授权请联系 [yugu88@126.com](mailto:yugu88@126.com)。

<!-- managed-block:v2 -->
