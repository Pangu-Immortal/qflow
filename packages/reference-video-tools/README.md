# `@qflow/reference-video-tools`

Direct tools for understanding a reference video and inspecting or previewing a Qflow project.

The package does not own a production workflow. It has no route/revision/variant state machine, no
checkpoint or recovery cursor, no content-addressed evidence directory, and no aggregate approval
state. Calling a command performs that command. It does not silently advance another process.

The useful outputs are ordinary content:

- prepared reference media, shots and transcript under `.qflow/reference-video-tools/`;
- reference observations and explicit comparison/review logs;
- requested stills, clips and package previews;
- direct JSON reports about vocabulary, package loading, Script Cues, graph tracing and realized
  browser layout.

These files can be opened, named, copied or removed directly. A repeated comparison or review is a
new explicit observation; it is not suppressed by comparing file hashes.

## Commands

```bash
qflow-reference-video-tools list_svml_packages
qflow-reference-video-tools prepare_reference --video-path ./reference.mp4 --observer agent
qflow-reference-video-tools observe_reference --reference-id <reference-id>
qflow-reference-video-tools record_observation --reference-id <reference-id> --key <key> --text-file ./answer.md
qflow-reference-video-tools inspect_svml_vocabulary --package @qflow/media-track --tag Track
qflow-reference-video-tools validate_local_author_packages --run ./build.svrun
qflow-reference-video-tools validate_script_cues --run ./build.svrun
qflow-reference-video-tools preview_check ./build.svrun
qflow-reference-video-tools layout_check --run ./build.svrun
qflow-reference-video-tools render_element ./build.svrun --element title --segment intro --out ./title.mp4
qflow-reference-video-tools compare_reconstruction --reference-id <reference-id> --run ./build.svrun --segment intro --video ./title.mp4 --element title
qflow-reference-video-tools review_element --run ./build.svrun --element title --segment intro --video ./title.mp4 --intent-file ./title-intent.md
qflow-reference-video-tools reconstruction_check ./build.svrun --reference-id <reference-id>
qflow-reference-video-tools authoring_check ./build.svrun
```

Every command prints one JSON result. Commands also accept `--input '{...}'` when structured input is
more convenient. Batch forms read JSON arrays from files for observations, comparisons, renders,
reviews and layout decisions.

## Reference preparation

`prepare_reference` accepts a local path or a supported video URL. It extracts bounded shot clips,
representative frames, a storyboard, speech audio and a word-timed transcript. The returned reference
id contains the source filename, byte length and modification time so it is inspectable without a
lookup table.

`--observer gemini` uses QflowHub or Vertex according to the configured provider. `--observer agent`
calls no visual provider; it returns observation tasks with local pictures and transcript context for
the calling agent to answer through `record_observation`.

Prepared stages are reused until the caller explicitly asks for `--redo ...` or `--reobserve`. This
is ordinary working data for one reference, not Build history.

## Inspection and review

`inspect_svml_vocabulary` reports the public Surfaces of packages the caller names.
`inspect_visual_schema` reports the actual Composition schema accepted from drawing Producers.
`validate_local_author_packages`, `validate_script_cues`, `preview_check`, `layout_check`,
`reconstruction_check` and `authoring_check` are independent reports. None approves or unlocks
another command.

`layout_check` always measures the current realized DOM. Its report contains advisory candidates such
as overflow, overlap and vertical offset. `layout_accept` attaches a human reason to a structural
finding id; it does not fingerprint the project or cache a previous measurement.

`render_element` draws one element directly from the Run using local preview media. A comparison reads
that render against the requested reference stretch. A review reads it against an explicit intent.
Their JSONL logs contain the actual question, paths and prose answer so later inspection does not
depend on a separate state database.

## Environment

Reference observation uses `QFLOW_GEMINI_PROVIDER=auto|qflowhub|vertex`. QflowHub first reads the
`qflowhub.oauth` session written by `qflow auth login` from the OS credential store, then falls back to
`QFLOWHUB_API_KEY`; `QFLOWHUB_BASE_URL` remains optional. Vertex reads `GOOGLE_CLOUD_PROJECT`,
`GOOGLE_APPLICATION_CREDENTIALS_JSON` and optional `GOOGLE_CLOUD_LOCATION`. Gemini defaults to
`gemini-3.7-flash-openai`.

Transcript preparation uses the selected local WhisperX service. Start services through the normal
Runtime configuration with `qflow runtime up`. `QFLOW_REFERENCE_CONCURRENCY` and
`QFLOW_REFERENCE_LAUNCH_GAP_MS` only control observation request pacing.
