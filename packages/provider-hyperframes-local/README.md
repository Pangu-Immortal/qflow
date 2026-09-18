# @qflow/provider-hyperframes-local

Trusted local Provider for `@qflow/render-hyperframes@1#render-visual` and `#render-frames`. It stages the
Resource dependencies declared by a `HyperframesDocument`, renders a silent MP4 with the
HyperFrames engine, probes the bytes, and returns a verified `RenderedVisual`. Before capturing a typed
Surface it decodes the exact bytes and checks declared dimensions, still/frame timing, SDR/sRGB and
opaque/straight-alpha facts. These checks validate the typed rendering input; they do not create
content identity or hidden output metadata.

`render-frames` uses the same staging, source-frame mapping, readiness and opaque PNG capture as
video export, returning the PNGs before encoding. It accepts a compiled document or a materialized
HTML project. For selected frames it merges only their required source-frame windows; continuous
windows decode sequentially. A complete batch shares one staged project and browser lifetime.
The existing browser selection, explicit preparation, worker settings and cancellation apply.
`maxRenderedBytes` bounds the total returned PNG bytes, or the encoded MP4 for a video request.
`render-frames` has its own capability binding; it does not inherit a `render-visual` binding.
For immediate CLI invocation, the host calls the handler directly: Build admission reservations do
not coordinate separate CLI processes. Worker limits still bound browsers inside each invocation.

Normalized transparent videos displayed by Media or project components use the ordinary video path.
The engine decodes them to PNG frames with alpha, then Chrome blends them with lower layers and
the authored Canvas background. Final frames use fast PNG encoding after Chrome has composited
the image onto an opaque canvas (black beneath the authored background). This trades intermediate
compression effort for speed without JPEG frame compression. Source alpha, CSS filters, canvas and
WebGL remain part of the browser composition. The returned MP4 contains the completed composition.

Runtime configuration separates work size from shared capacity:

- `defaultConcurrency` limits whole render requests admitted by the Endpoint's Runtime capacity resource.
- Optional `browserCapacity` limits Chrome slots shared by all render Needs in the same `pool`.
  Each Need reserves its fixed count or automatic ceiling atomically with the whole-request slot.
  An explicit count larger than this budget reports a configuration error. Auto fits its ceiling
  to the shared budget before admission.
  Both reservations last for the whole Need, including preparation and final encoding. Closing one
  Chrome early does not release part of that reservation. Without `browserCapacity`, admission uses
  the whole-request limit alone.
- `workers` controls independent Chrome processes inside one admitted render. Explicit counts are
  honored, capped only by selected frame count. `auto` starts below its ceiling, then compares useful
  capture batches before adding another browser. Insufficient benefit or falling throughput retires
  surplus browsers between batches. Completed frames are retained; there is no calibration render.
- Optional `maxWorkers` sets the automatic ceiling. Without it, the Provider leaves two CPU slots
  and half the machine/container memory for other work, budgeting about 1.5 GiB per Chrome process.
  Auto also caps the reservation to the number of roughly one-second batches in the selected range.

The Runtime Profile configures these controls through the Provider because they are deployment policy.
The automatic ceiling is fixed at activation, and range sizing is identical in admission and execution.
Actual concurrency adapts inside that reservation; it is not a machine-wide history or performance database. It never
renders program audio; `@qflow/provider-media-local` separately prepares `TimelineAudio` and muxes
the final media.

For a Runtime Profile, place `pool` on the Endpoint entry and these Provider settings inside
`config`. This is an illustrative entry to merge into the Profile's existing `endpoints`:

```json
"hyperframes.local": {
  "use": "@qflow/provider-hyperframes-local",
  "pool": "local-render",
  "config": {
    "workers": 4,
    "defaultConcurrency": 2,
    "browserCapacity": 6
  }
}
```

This configuration admits one 4-worker request at a time under its 6-browser budget even though
the whole-request limit is 2. Two 4-worker requests would need 8 browser slots. Choose budgets from
the actual machine and shared workloads; the example is not an automatic tuning recommendation.
New Builds use the edited Provider configuration; active Builds retain their selected configuration.
Restart Studio if its existing session needs to load the edited Profile.

`browserGpu` picks Chrome's rasterizer and defaults to `hardware`. Set `software` without a usable
GPU, or `auto` to let the engine decide. Capture uses screenshots and independent browser processes;
the CLI's automatic worker and drawElement policies do not override the count. The opaque screenshot
adapter uses the engine's public session, video injector and page seek protocol plus Chrome CDP.
It waits for seek completion, dynamic images/fonts and the page compositor before capturing PNGs.
Image readiness includes CSS class and pseudo-element images, CSS masks and SVG images. A failed
image decode reports its URL instead of producing a successful frame with missing media. Failed
declared fonts also fail capture instead of silently leaving fallback glyphs in the output.
The pinned engine couples its PNG session setup to transparent export, so this adapter initializes
an opaque session and chooses PNG separately at capture. It does not patch engine methods or files.

The Runtime Adapter declares one managed browser program. Prepare it explicitly:

```sh
qflow programs prepare --runtime ./qflow.runtime.json --endpoint hyperframes.local
```

Use the instance name from the Profile. `runtime up` also prepares it and starts the Runtime Worker.
The Provider's `package.json` declares its recommended Chrome Headless Shell version in
`qflow.renderBrowser.version`, alongside the engine dependency used to test that release. The
installer consumes that declaration; it does not have a browser version constant or fetch a
"latest" channel. `config.browserVersion` explicitly selects another exact four-part version.
Changing the recommendation belongs to a Provider release and requires real rendering tests; a
Puppeteer recommendation alone is not a HyperFrames compatibility guarantee.

The default cache is `~/.cache/hyperframes/chrome`; `config.browserCacheDirectory` selects another
location. Only the selected version is used, regardless of other cached or system browsers.
Projects sharing this cache use the existing ManagedProgram preparation lock/logs under
`.qflow-render-program`. Readiness comes from the executable and its reported version, not a receipt.
Explicit preparation reuses a healthy installation or repairs only the selected managed version.
A failed download reports failure without selecting another version or browser.

`config.browserDownloadBaseUrl` selects a Chrome for Testing archive mirror for explicit preparation.
It is an absolute HTTP(S) base URL, without credentials, a query or a fragment. The browser library
appends the selected version, platform and archive name; the mirror must serve that same layout.
For example, a base of `https://mirror.example/chrome-for-testing` serves archives beneath
`<base>/<version>/<platform>/chrome-headless-shell-<platform>.zip`. Choose a source maintained by
the user or organization; this Provider does not keep a mirror list or choose one by region.
Omitting the setting uses the browser library's official Chrome for Testing source. A configured
source replaces it: failed transfers or invalid archives fail preparation without trying the official
source or another mirror. Normal HTTP redirects supplied by the selected server are handled by the
download library. Preparation displays the complete archive URL, version and destination before
download. An npm registry setting does not redirect this binary download.

The download source only determines where missing installation bytes come from. It does not change
the executable selection, and changing it does not invalidate a healthy cached version. No source
receipt is stored. To install into an empty location, explicitly choose `browserCacheDirectory`.

`config.chromePath` selects a user-managed Chrome/Chromium executable. It cannot be combined with
`browserVersion` or `browserDownloadBaseUrl`; invalid combinations fail instead of assigning precedence. Relative paths resolve
from the Runtime data root, as does `browserCacheDirectory`. The Profile's `dataRoot` itself resolves
relative to the Profile file. This mode never downloads or repairs a browser. Its version remains
under the user's control, including system-browser auto-updates. `HYPERFRAMES_BROWSER_PATH` and
`PRODUCER_HEADLESS_SHELL_PATH` do not select browsers in this Provider; configure `chromePath`.
On platforms without a supported managed download, explicitly select an installed browser.

`doctor` displays the selected path and its source, and only inspects it. Build preflight, rendering
and previews never install a browser. `programs prepare`, `programs up` and `runtime up` display the selected managed
version, installation location and download URL before running preparation. The probe runs `--version` and checks
FFmpeg/FFprobe; it does not promise GPU or page compatibility. Capture receives that same selected
path as the engine's `chromePath`, including its GPU probe. New Builds read current Endpoint
configuration and project implementation; active Builds keep their selected configuration. A
Distribution update or change to the Worker's inherited environment requires an explicit Worker
restart when active work permits. Ordinary Profile edits do not require restarting every process.

The Provider's `qflow.dependencyInstallEnv` disables Puppeteer's browser download while preparing its
engine/producer npm dependencies. The repository `.puppeteerrc.cjs` does the same for checkout installs.
No browser postinstall allowlist is required. The former `hyperframesCliPath` option is removed.

The same executor is exported for callers with an already compiled document:

```ts
import { renderHyperframesVisual } from "@qflow/provider-hyperframes-local";

const visual = await renderHyperframesVisual(
  { document, range: { startFrame: 240, endFrameExclusive: 360 } },
  { resources, workers: 4, onProgress: (event) => console.log(event) },
);
```

Omit `range` for the complete document. Ranges are zero-based and half-open on the original
programme clock. At 30 fps, `[240, 360)` returns 120 frames covering seconds 8–12.
`onProgress` reports resource staging, source decoding, the requested range, per-worker frame counts, browser PIDs,
encoding, storage and elapsed time to direct executor callers. The Provider reduces parallel worker
events to a single phase and aggregate count through `context.reportProgress`. CLI status and follow
display that activity without `--verbose`. Counter writes are coalesced to about once per second;
phase changes and completed counts are reported promptly. Local activity belongs to the running
Command, not a remote Operation or a repeatedly rewritten Result manifest.
`processTimeoutMs` defaults to 30 minutes and starts one deadline before resource preparation. It
covers resource reads, Surface validation, rendering and output storage. `signal` can end the same
execution earlier. ResourceStore I/O and Surface probes receive the cancellation signal; a custom
ResourceStore must implement the port's cancellation behavior, including streaming reads and writes.

Browser launch, source extraction, capture and encoding run in one disposable child process per
render. After successful capture closes its resources, the child sends its completion message,
flushes that message and disconnects IPC so it can exit normally. The owner awaits exit and drains
diagnostics before returning. Normal completion does not enumerate or forcibly terminate processes.
On failure, cleanup may be incomplete: the child reports the error and keeps IPC open while the owner
discovers and terminates the remaining process tree, before it can become orphaned.
The capture child also installs synchronous exit cleanup before loading the engine. Early
`process.exit()`, uncaught exceptions, and catchable `SIGINT`/`SIGTERM` exits stop descendants
while their owner still exists, even if browser initialization never returned a session.
Successful resource closure removes this exit handler. No historical browser PID list is retained.

Uncatchable termination (`SIGKILL`, native crashes, or OS termination on Windows) cannot run that
cleanup. The owner reports the termination and cannot confirm descendant cleanup; it never searches
by an already-exited root PID. If an orphan keeps the output pipes open, the owner closes its pipe
ends after five seconds so the failed invocation can settle. Guaranteed cleanup after an OS hard
kill requires containment supplied by that deployment (for example a process job or container);
this local Node implementation does not provide that guarantee.

At cancellation the child receives a stop request and has up to five seconds to clean up. A child
that remains after cancellation or its completion message is forcibly terminated along with its discovered
process tree, including Chrome's separate process groups. Cleanup problems are reported through the
existing diagnostic callback; they do not discard a render already reported as completed. If process
enumeration fails, the owner still terminates the direct child but cannot confirm descendant cleanup.
This also covers engine calls that do not accept a signal. The deadline initiates shutdown; the call
may spend additional time closing resources. Completed Outputs in the Build remain available for a
new Run and Build.

Deployments may additionally set `initializationTimeoutMs` or `frameTimeoutMs` when they have a
measured stage deadline. Initialization here means initializing an already created browser session;
Chrome launch precedes it. Stage deadlines are otherwise unset, allowing a busy machine to spend
more of the shared render budget on a slow initialization or frame.
An explicit stage-timeout error names the worker and stage/frame, aborts sibling workers and awaits
cleanup. A completed worker closes its Chrome immediately.

One call stages the HTML and every declared asset once. Typed Surface inspection reads the completed
staged file directly, without retaining its chunks, assembling another whole-file buffer, or writing
a second temporary copy. The caller keeps that file until inspection and capture have settled.
Typed Surface validation includes a complete
decoded-frame count, even for a short render interval. The renderer then finds source-frame windows
needed by that interval, merges overlapping windows, and extracts them one source/window at a time.
Decoded PNGs are shared by all workers in this call. Each worker initializes its own page, then takes
short contiguous frame batches from the render's in-memory queue. A free worker can continue with
another batch instead of waiting for a worker assigned a more expensive passage. Batches span at
most about one second and preserve the original absolute frame times. Output numbering starts at
zero; final H.264 encoding runs once after all workers finish. This division is internal to one
render call; it does not create or resume Builds. Extra workers help only while aggregate throughput
improves. Staging, validation, source extraction and final encoding still contribute their own cost.

Each call has its own temporary directory, local server port and Chrome processes. Separate renders
do not share staged files or decoded PNGs. Exact compiler sampling markers retain loops, holds and
fractional playback rates. There is no SVML rewrite, intermediate cut MP4 or repeat normalization.
Already compiled video documents need the current compiler's frame markers.

`ffmpegPath` selects both source decoding and final H.264 encoding; `ffprobePath` selects source,
output and typed Surface inspection. Bare commands resolve through PATH. The capture child passes
these selected executables to the engine's public binary overrides; inherited
`HYPERFRAMES_FFMPEG_PATH` / `HYPERFRAMES_FFPROBE_PATH` cannot select a different decoding toolchain.
`nodePath` selects the managed
browser installer's Node executable. Capture uses the current Node process's executable.
The requested frame range travels in the Model's Need; browser paths stay in the Provider.

```ts
import { createLocalHyperframesProvider } from "@qflow/provider-hyperframes-local";

const provider = createLocalHyperframesProvider({
  pool: "local-render",
  workers: 4,
  defaultConcurrency: 2,
  browserCapacity: 6,
});
```

Two instances in `local-render`, configured with 4 and 2 workers and identical capacity limits, can
render together. With `browserCapacity: 4`, the second waits. Coordination applies to Builds sharing
the same Runtime Execution Store; the pool name alone does not coordinate separate stores or machines.
Direct `renderHyperframesVisual()` calls do not enter Runtime's shared admission system.

The current package executes trusted official code in a local process. It is not a sandbox for
untrusted documents or community renderer implementations.

Provider calls forward renderer diagnostics through `context.reportDiagnostic`. The initial record
states the frame count, worker policy/ceiling, capture path, quality, GPU mode and selected encoder.
Phase timings, concurrency changes and per-worker seek/preparation/PNG totals are recorded once
per phase, decision or finished worker. Disposable capture-process
stdout/stderr are streamed as diagnostics and drained before the call returns; existing output limits
still apply. Phase changes cover preparation, decoding, browser startup, capture, encoding and storage.
`qflow logs <build-id>` retains those records after temporary rendering files have been removed.
