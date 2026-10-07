# @qflow/provider-html-local

Trusted local implementation of:

- `@qflow/html-program@1#rasterize-visual` → `TimelineVisual`;
- `@qflow/html-program@1#rasterize-frames` → ordered PNG BlobRefs.

The Provider consumes the typed `HtmlProgram` directly. It serves the staged
program to independent Puppeteer/Chrome processes, applies absolute integer
frames through `window.__qflowFrameProgram`, decodes compiler-declared source
video frames with FFmpeg, captures PNG pixels through Chrome DevTools Protocol,
and streams ordered frames into one H.264 encoder. It has no external HTML video
engine or producer dependency.

Filesystem staging is private to this local Provider. `@qflow/html-program`
retains only the portable program and its pure materialization function; it
does not expose a Node project/staging subpath for hypothetical executors.
Inspection of staged Compositable Surface files and probing the selected media
tools are private here for the same reason: they validate inputs used by this
executor and do not establish a shared media-execution ABI.

## Runtime boundary

The Endpoint facet is `rasterize`. Runtime configuration owns deployment policy:

- `workers`: fixed browser count or `auto`;
- `maxWorkers`: automatic ceiling;
- `defaultConcurrency`: whole requests admitted in this Endpoint pool;
- `browserCapacity`: Chrome slots reserved across admitted requests;
- `chromePath`, or exact `browserVersion` plus `browserCacheDirectory`;
- `ffmpegPath` and `ffprobePath`;
- optional process/stage deadlines and byte budgets.

The package recommendation is stored as `qflow.htmlBrowser.version`. Managed
Chrome defaults to `~/.cache/qflow/html-rasterizer/chrome`; its ManagedProgram
state is stored below `.qflow-html-browser-program`. Browser installation occurs
only through explicit Runtime preparation:

```sh
qflow programs prepare --runtime ./qflow.runtime.json --endpoint html.local
```

Inspection and execution never search environment variables or silently choose a
different system browser. `chromePath` selects a user-managed executable;
`browserVersion` selects one exact managed Chrome for Testing version. The two
selection modes are mutually exclusive.

## Frame selection and parallelism

A continuous request retains original absolute frame identities. A sparse request
accepts strictly increasing, non-contiguous frames. Workers are independent
browser processes and may start at any requested frame; they do not wait for an
earlier worker to traverse the program.

The compiler's typed `frameSources` plan determines exact source-video samples,
including reverse, hold, loop and rational-rate mappings. The Provider probes
needed sources, decodes bounded windows lazily, shares decoded frames only within
the current execution, and leases them under `maxDecodedSourceBytes`. Chrome does
not independently decode those same videos. Arbitrary author HTML is not parsed
to infer source-time semantics.

Completed PNGs enter a bounded ordered sink. FFmpeg is the necessary local
serialization point for one MP4 stream, not a scheduler or shared metadata
service. Capture of later frames can continue while earlier frames are encoded.
Sparse frame output writes only requested PNGs and is bounded by
`maxRenderedBytes`.

## Lifecycle and failure

Each request owns its temporary directory, localhost server, Chrome processes,
decoded-frame store and encoder. Nothing is shared across requests. Cancellation
or failure closes page sessions, source leases, processes and resource I/O.
Process-tree cleanup is best effort after abnormal exits; hard OS termination
requires containment supplied by the deployment.

The executor waits for page frame listeners, declared fonts, dynamic image
decodes and compositor settlement before accepting a screenshot. Readiness is
scoped to compiler-published capture roots when available; real global stylesheet
edits intentionally fall back to whole-document inspection.

## Direct use

```ts
import { rasterizeHtmlProgram } from "@qflow/provider-html-local";

const visual = await rasterizeHtmlProgram(
  { program, range: { startFrame: 240, endFrameExclusive: 360 } },
  { resources, workers: 4 },
);
```

Omit `range` for the complete program. Audio is not part of this result;
`@qflow/media-local` and the author assembly prepare audio and mux the
final artifact.
