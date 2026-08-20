# Cross-platform environment

## Where you are

This skill lives inside the Qflow repository. Find the root from the skill's own location — the
directory containing `package.json` and `packages/` — and work from there. Repository paths written in
these files, `.agents/skills/qflow/scripts/…`, `packages/…`, `examples/…`, are relative to that root
and to nothing else.

Several commands resolve against the **working directory** rather than against the Source they are
given: `list_svml_packages` reads `node_modules/@qflow` from the cwd and refuses when it is empty, and
`preview-check.mjs` resolves `tsx` the same way. Running them from the repository root is not a
convention, it is the condition under which they work.

## Requirements

Node.js 22+, pnpm 10.33.x via Corepack, Python 3.10–3.13 only for local
WhisperX/OpenCV, `uv` for locked Python environments, and `ffmpeg`/`ffprobe` for local media.

macOS/Linux or Windows PowerShell:

```text
node .agents/skills/qflow/scripts/check-environment.mjs
```

If the probe reports `corepack missing` (some newer Node.js distributions do not bundle it), install
a compatible release from either shell:

```text
npm install --global corepack@0.34.5
```

Then install and validate the workspace:

```text
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
npm link
pnpm check
pnpm test
```

For managed local programs:

```text
uv python install 3.13
uv sync --project services/whisperx --frozen
uv sync --project services/image-opencv --frozen
uv run --project services/whisperx --frozen qflow-whisperx-prepare
qflow runtime use qflow.runtime.json
qflow doctor
qflow runtime up
qflow runtime status
```

Use `runtime up` for normal Build preparation: it owns the detached durable Worker and prepares the external
programs declared by the Runtime Profile. `programs up/status/down` is only the narrow external-
program view and does not manage the Worker. See `runtime.md` for the Build lifecycle.

The repository owns skill discovery: `.agents/skills` is canonical, with repository-root
`.codex/skills` and `.claude/skills` links. This is checkout layout, not a skill setup operation.
