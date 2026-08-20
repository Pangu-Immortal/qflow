# Talking-film graph check

This fixture compiles the complete author graph: Script, generated-media requests, Speech Track,
WhisperX alignment, display-only Gemini Caption planning, Media Track, Caption, Text, Film and
explicit HyperFrames rendering. `check` and `plan` do not invoke Seedance, WhisperX, Gemini or
HyperFrames.

```bash
cd examples/talking-film-graph-check
qflow check main.svml
qflow check build.svrun
qflow plan build.svrun
```

The Gemini planner receives readable indivisible display atoms and resolved Style runs only. Its
generic `CaptionPlan` joins the continuous `SemanticTrack` in `@qflow/caption`; neither
the planner nor the Vertex Provider has text-rewriting or timing authority.
`@qflow/caption-fine` alone owns Recipe interpretation and the concrete visual renderer.
