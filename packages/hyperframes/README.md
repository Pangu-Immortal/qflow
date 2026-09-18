# @qflow/hyperframes

Deterministic reference lowering from the generic `Composition` contract to a portable
`HyperframesDocument`.

This package renders `qflow.visual-ir@1` structural elements and `qflow.browser-program@1`
local programs. Structural elements cover ordinary boxes, exact-font text and frame-sampled media.
A browser program carries HTML, CSS and frame-driven JavaScript for a component's own composition.
Track and Composition remain owned by `@qflow/composition`; the browser format is owned here.

This package understands only `VisualTrack`, `ProgramSpace` and canvas geometry. It
does not know Caption, Speech, B-roll, Seedance or any other author-domain component. It flattens
every Track's Presents, orders them by their own absolute stacking keys and emits frame-bound local
keyframes. An authoring Track never becomes an isolated render stacking surface.
Terminal text and SVG mask sources retain the same Present-relative frame animations as other
elements, including direct seeks into the middle of a Present.

It deliberately ignores `AudioTrack`. HyperFrames produces a silent visual fact; the media pipeline
compiles and renders program audio separately, then an explicit mux Provider joins the two. Changing
audio can therefore never be implemented by secretly changing HyperFrames HTML or its renderer.

Media remains resource-referenced in compiled HTML as `qflow-resource://` placeholders. The
document separately carries each dependency's complete `BlobRef` (Resource id, byte count and MIME), so
a Provider can verify and name staged bytes without guessing from the hash. A local or hosted
render Runtime calls `materializeHyperframesHtml()` with its own Artifact URL resolver before
handing the HTML to HyperFrames. That environment-specific materialization is not a new compiled
Record and does not change the compiled document.

For observation of already materialized HTML, `HyperframesHtmlProject` carries the HTML and the
BlobRefs addressed by its media/font URLs. `hyperframesHtmlDomain` reads the compiler's exact root
frame clock and canvas; `stageHyperframesHtmlProject` stages those resources. This input does not
reconstruct a Composition or invent typed Surface facts from HTML. A caller with the original
`HyperframesDocument`, such as Studio, should pass that document to preserve all declared dependencies,
including resources embedded in browser-program data. The document remains the complete typed input.
Staging assigns short local filenames; opaque Resource IDs are never interpreted as filesystem
paths or filenames, so their length and punctuation do not restrict the host filesystem.
`stageHyperframesProject` streams each asset into its staged file. Its `validateSurface(surface, path,
signal)` callback borrows that completed file during inspection; it receives neither a whole-file
byte copy nor ownership of the file. The staging caller keeps the directory alive until all work
has settled, including cancellation.

The document exposes its render domain directly rather than asking an Endpoint to scrape HTML:
exact rational `frameRate`, integer `frameCount`, and canvas dimensions are explicit document
content. The ProgramSpace relationship is an input edge of the Producer and is not copied into the
document as lineage metadata. Legal frame addresses are exactly `[0, frameCount)`. A local worker pool or a
hosted renderer may independently evaluate any legal frame or half-open chunk; partition size and
worker count are Runtime policy, not author intent and not Core graph nodes. The emitted root also
uses the rational HyperFrames `data-fps` form, so NTSC rates do not drift through a decimal guess.

Exact `FontArtifactRef` dependencies lower to generated `@font-face` declarations with font
synthesis disabled; a Unicode-range-sharded logical face emits one rule per exact source. Terminal
text without a non-empty exact Font stack is invalid rather than falling back to machine fonts.
`CompositableSurfaceRef` values lower as typed image/video surfaces carrying
their declared alpha, color-space and frame-domain metadata. The package never guesses either fact
from a user font name or filename extension. The document carries a deduplicated typed Surface set
beside its Artifact set so a staging Runtime can verify the exact bytes before rendering.

The ordinary test suite validates deterministic HTML, frame sampling markers and Artifact collection.
The local Provider owns the Chrome integration tests. Run its tests with `QFLOW_BROWSER_TESTS=1`
to exercise real multi-worker rendering, compare selected video frames with a full render, and check
straight-alpha composition. These tests use the engine capture API and require Chrome and FFmpeg.

## Local browser programs

`browserProgram({ html, css, setup, data }, artifacts)` builds a program payload. Place it on a
`kind: "program"` VisualElement inside a normal Present. `html` is a local fragment; `{{child-id}}`
places a direct typed child. Every child is placed once, including sampled video and exact-font text.
This keeps actual video available to the renderer's exact source-frame preparation.

CSS is scoped to the generated program root with `@scope`; `:scope` styles that root. The HTML can
contain arbitrary local structure, SVG, internal stacking, masks and backdrop filters.
CSS scope does not isolate HTML/SVG IDs. Use classes or data attributes for local queries; when an
SVG needs an ID for `url(#...)` or `href`, derive it from the unique `root.id` in `setup` and set both
the definition and its references there. Reusable instances must not repeat hard-coded SVG IDs.

The optional `setup` string is a JavaScript function body with `root` and `data` arguments. It returns a synchronous
`render(localFrame)` function, evaluated on initial load and active `hf-seek` events. Outside the
Present's lifetime, the dispatcher settles the boundary pose once instead of repeatedly updating
an invisible program. Active seeks always redraw, including the same frame after resources become
ready, and seeking back into the Present computes its requested pose directly. Prepare stable
objects in `setup`; express animation state as a function of frame and inputs so any worker can
begin at any frame. Async work belongs to
material preparation before rendering; browser resources belong in the program's declared artifacts.
Use `hyperframesResourceUri(artifact.resource)` in resource-bearing markup or CSS.
Returning a Promise from `render` reports an authoring error; frame capture never waits for an
unbounded asynchronous drawing task or races it.

Ordinary child sampling follows the Present clock. Reframing the parent leaves source playback
unchanged. `projectTimelineMedia` from `@qflow/qflow/timeline` gives a component selected prepared
clips with their exact program and source spans. Speech audio is an independently selected Track.

`program.format` is explicit: this backend reports an unsupported format rather than interpreting
another renderer's program. Core and the build graph do not contain browser-specific cases.
The `examples/semantic-composition` project demonstrates a complete package using this interface.
