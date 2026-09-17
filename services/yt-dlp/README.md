# Pinned yt-dlp

This project owns the locked downloader and its EJS solver dependencies. Prepare it explicitly with
`qflow media prepare-fetch`; `qflow media fetch` only uses the resulting executable and never runs uv.
The preparation command reports the executable path under the machine Host state. Use that exact
path for `--version`, `--help` or deliberately chosen site-specific options. On Windows it is an
`.exe` inside the virtual environment's `Scripts` directory.

For a contributor-managed environment, run `uv sync --project services/yt-dlp --frozen` explicitly,
then invoke `.venv/bin/yt-dlp` (Windows: `.venv\Scripts\yt-dlp.exe`) from that project.
Direct invocation accepts upstream options and config; the Qflow fetch wrapper instead ignores
user config/plugins, disables updates and remote components, and uses its calling Node executable
for JavaScript challenges. The locked extras supply the solver before fetching begins.

`ffmpeg` on PATH merges separate video and audio streams; the CLI also requires `ffprobe` for the
saved-file report. These tools are supplied by the operator's package manager, never installed by
fetch. Site support follows the selected yt-dlp extractors. A source requiring authentication or
additional options can use an explicit direct invocation and then supply the local file to Qflow.
