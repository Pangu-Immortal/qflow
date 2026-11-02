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
