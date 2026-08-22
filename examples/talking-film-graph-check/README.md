# Talking-film graph check

This fixture compiles the complete author graph: Script, generated-media requests, Speech Track,
WhisperX alignment, Script-owned CaptionDocument, Media Track, Caption, Text, Film and
explicit HyperFrames rendering. `check` and `plan` do not invoke Seedance, WhisperX or
HyperFrames.

```bash
cd examples/talking-film-graph-check
qflow check main.svml
qflow check build.svrun
qflow plan build.svrun
```

`@qflow/caption` projects complete Caption Alignment Units from the Script document and joins them
to the continuous `SemanticTrack`; no model call participates in caption authoring or timing.
`@qflow/caption-fine` owns Recipe interpretation and the concrete visual renderer.
