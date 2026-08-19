<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./docs/public/qflow-logo-light.png">
    <img alt="Qflow" src="./docs/public/qflow-logo-dark.png" width="400" height="78">
  </picture>
</p>

<p align="center">
  <strong>Clone any viral video with AI agents.</strong>
  <br>
  <em>1 command, 100 variants, 100M views.</em>
</p>

<p align="center">
  <a href="https://qflow.ai/"><strong>Website</strong></a>
  &nbsp;&bull;&nbsp;
  <a href="https://narratage.qflow.ai/"><strong>Docs</strong></a>
  &nbsp;&bull;&nbsp;
  <a href="https://discord.gg/85hnyQnxpn"><strong>Discord</strong></a>
  &nbsp;&bull;&nbsp;
  <a href="./README.zh-CN.md"><strong>简体中文</strong></a>
</p>

<p align="center">
  <a href="https://github.com/qflow-ai/qflow/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/qflow-ai/qflow?style=flat-square&color=FFD700&logo=github&logoColor=white&label=Stars"></a>
  <a href="./package.json"><img alt="Node 22+" src="https://img.shields.io/badge/Node.js-22+-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white"></a>
  <a href="./package.json"><img alt="pnpm 10.33" src="https://img.shields.io/badge/pnpm-10.33-F69220?style=flat-square&logo=pnpm&logoColor=white"></a>
  <a href="./package.json"><img alt="TypeScript 5.9" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/License-Apache--2.0%20with%20conditions-E3B341?style=flat-square"></a>
</p>

<p align="center">
  <a href="https://qflow.ai/"><img alt="Visit our website" src="https://img.shields.io/badge/Visit%20our%20website-000000?style=for-the-badge&logo=googlechrome&logoColor=white"></a>
  <a href="https://discord.gg/85hnyQnxpn"><img alt="Join our Discord" src="https://img.shields.io/badge/Join%20our%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white"></a>
  <a href="https://t.me/qflow"><img alt="Join our Telegram" src="https://img.shields.io/badge/Join%20our%20Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white"></a>
  <a href="https://x.com/qflowai"><img alt="Follow @qflowai on X" src="https://img.shields.io/badge/Follow%20%40qflowai-000000?style=for-the-badge&logo=x&logoColor=white"></a>
</p>

## Qflow

Clone any viral video with AI agents. Not just a script, the whole workflow: swap the face, the words, the B-roll, ship 100 variants in one run, and get your 100M views.

Qflow gives AI agents (Claude Code, Codex...) a language and system to create video. Drop in a video, and your agent clones it as a complete workflow: footage, captions, B-roll and effects, all anchored to words instead of seconds.

**To be clear:** cloning a video is the fastest way in, not the only one. You can start from our templates, or just describe the video you want and your agent writes the workflow from scratch. Generation models are optional too: a workflow can compile captions, motion graphics and code-rendered visuals into a finished video without calling a single model, so a video can cost exactly $0.

## Install

Requires Node.js 22+ and pnpm 10.33.x.

```bash
git clone https://github.com/qflow-ai/qflow.git
cd qflow
corepack enable
pnpm install --frozen-lockfile
npm link
```

For finished video builds, install `ffmpeg` and `ffprobe`. Some optional providers may also require Python, `uv`, or API credentials.

## Use the Qflow skill

The `/qflow` skill is available to coding agents from the cloned repository. Ask your agent to set up the environment and create the workflow for you:

```text
/qflow Clone this viral video into a reusable workflow, show me a preview, and guide me through producing variants.
```

Or start without a reference video:

```text
/qflow Create a video workflow from my description, using templates and $0 code-rendered visuals wherever possible.
```

Your agent can check the environment, request only the credentials the chosen workflow needs, preview the result, and run the build.

## License

Qflow is released under the [Qflow Open Source License](./LICENSE). The videos and other outputs you create belong to you; third-party models and services may have their own terms.
