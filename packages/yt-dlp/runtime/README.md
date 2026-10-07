# Pinned yt-dlp

This project owns the locked downloader and its EJS solver dependencies. Prepare it explicitly with
`qflow download prepare`; `qflow download` only uses the resulting executable and never runs uv.
The preparation command reports the executable path under the machine Host state. Use that exact
path for `--version`, `--help` or deliberately chosen site-specific options. On Windows it is an
`.exe` inside the virtual environment's `Scripts` directory.

For a contributor-managed environment, run `uv sync --project packages/yt-dlp/runtime --frozen` explicitly,
then invoke `.venv/bin/yt-dlp` (Windows: `.venv\Scripts\yt-dlp.exe`) from that project.
Direct invocation accepts upstream options and config; the Qflow download command instead ignores
user config/plugins, disables updates and remote components, and uses its calling Node executable
for JavaScript challenges. The locked extras supply both that solver and yt-dlp's `curl-cffi`
browser-impersonation transport before fetching begins. This keeps the transport in the same pinned
Python environment as yt-dlp; it does not add site rules or TLS policy to Qflow.

`ffmpeg` on PATH merges separate video and audio streams; the CLI also requires `ffprobe` for the
saved-file report. These tools are supplied by the operator's package manager, never installed by
fetch. Site support follows the selected yt-dlp extractors. A source requiring authentication or
additional options can use an explicit direct invocation and then supply the local file to Qflow.
