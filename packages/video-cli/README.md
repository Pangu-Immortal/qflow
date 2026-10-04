# `@qflow/video-cli`

Official video command application. It selects the Markup compiler Host and supplies one editable
starter Runtime Profile. Execution Endpoints are selected by Profile `use` entries; Source imports
activate author packages. Immediate tools own their temporary input/output resource storage.

Every Frontend, Surface, deterministic Producer and Validator is activated from Source imports.
Installing a new author package therefore does not require a video CLI or Core release. Source
imports never grant network, credential or process authority. A data-only package can also export a
reusable Source directly, for example
`<import as="ugc" source="@qflow/gpt-image-kits/phone-ugc-v1"/>`; resolving that Source does not
activate package code.

`qflow version` reports the Distribution version, physical root and launcher independently of a
project or Runtime. `qflow version --check` also reads the package's `latest` tag at
`https://registry.npmjs.org/`; `--registry <url>` explicitly selects another registry. `--json`
returns `qflow.cli-version@1`. A failed check retains local facts, leaves the remote version unknown
and exits nonzero. A different version is not automatically newer: the launcher may be a newer
checkout or the mirror may lag. The command links release notes and never installs or updates.
Skill installers own their separate installed copies; this command does not scan Agent directories.
`qflow --version` remains a local version-only query.

Commands below serve independent authoring decisions. Start with the current project's material;
local inspection and estimation need no generation account:

```bash
cd path/to/project
qflow check main.svml
qflow measure main.svml --segment hook --language en
```

When the work needs execution, the project selects a Runtime Profile. `qflow runtime init` creates
an editable starter; its Endpoint entries describe available routes, not choices made by the user.
Keep an existing chosen service, or configure the chosen local or hosted Provider and its capability
bindings. QflowHub is the recommended integrated hosted route in the official Distribution; other
services use project Provider packages. If the user chooses QflowHub,
`qflow auth login qflowhub.default` connects that account after choosing its CredentialStore.
The starter selects the [platform CredentialStore](../credential-store-platform/README.md#select-it):
macOS Keychain or Windows Credential Locker on those two platforms, and an owner-private file on
Linux, so the Profile it writes needs no edit on any of them. Name another Store in `credentials` and
in the Endpoint's credential reference — as the
[file CredentialStore](../credential-store-file/README.md#select-it-before-login) shows — to choose it
explicitly. This selection is configuration; execution never switches stores automatically.
`qflow doctor --endpoint <name>` checks a selected Endpoint;
`qflow runtime up --endpoint <name>` prepares that Endpoint and starts the Worker. Repeat the flag
for several chosen Endpoints; omitting it prepares the whole Profile. `qflow programs up --endpoint
<name>` prepares and starts a local helper independently of the Worker. `qflow programs prepare
--endpoint <name>` only prepares its selected resources, including for a service already running.

With the selected execution environment:

```bash
qflow plan build.svrun
qflow build build.svrun --follow
qflow status <build-id> --watch
qflow activity
qflow builds
qflow history <source-output-name> [--source ./main.svml]
qflow inspect <build-id> [--output <source-output-name>]
qflow get <build-id> --output final.video --to ./final.mp4
qflow cancel <build-id>
```

`transcribe` runs one immediate request through the selected Runtime Profile, with no Build,
Result or state. It names the Endpoint and its price page before it runs, and writes the transcript
to the chosen file. `measure` estimates a passage locally:

```bash
qflow transcribe reference.mp4 --to notes/reference.transcript.json --language en
qflow transcribe assets/recorded-voice.wav --to notes/voice.transcript.json --language en
qflow measure main.svml --segment hook --language en --pace normal --rounding round
```

`snapshot` follows the same immediate invocation model for picture inspection. Prefer it for
existing production states and motion sequences, keeping Studio for playback with sound and Builds
for encoded delivery:

```bash
qflow snapshot --studio http://localhost:5191 --at-frame 240,255,269 --to evidence/states
qflow snapshot --studio http://localhost:5191 --start-frame 240 --end-frame-exclusive 270 \
  --grid 4x3 --cell 480 --to evidence/motion
qflow snapshot ./picture/index.html --at-frame 240 --to evidence/detail
```

`--studio` reads Studio's current compiled document and its declared resources; a path or HTML URL
reads materialized HTML with inline scripts/styles and directly addressed media/fonts. The Profile's
`@qflow/render-hyperframes@1#render-frames` Endpoint returns PNGs in selected-frame order.
`--runtime` and `--workspace` select the environment just as for `transcribe`. The call streams
resources through a temporary `FileResourceStore`, writes full-size PNGs and optional grid pages,
then releases that temporary storage. `--to` names a new directory. `--json` reports paths and original
frame positions. Grid labels remain outside the picture. No Build, Worker receipt or video encoding
is created. Provider-owned browser preparation is unchanged.

`media frames --every-frame` and `media tiles --every-frame` decode every source frame in a selected
half-open seconds interval once. Native timestamps, including variable frame rate, are read from
decoder PTS and time base. `tiles --ranges <json> --every-frame` decodes each listed interval and
paginates its images. `--transcript` adds word context. This native path uses no FPS resampling.

For `transcribe`, set `--language` to an explicit lowercase two- or three-letter spoken language code,
such as `en`, `zh` or `ko`. The selected service owns which languages it can align. Chinese speech uses `zh`, including
Chinese speech containing English names. The request selects the recognition language and
language-specific aligner; ASR size remains a deployment choice. Caption font and Script's
simplified/traditional characters are independent authoring choices.

`transcribe` uses the Profile's `whisperx-alignment` Endpoint (after
extracting 16 kHz mono speech audio with ffmpeg). Direct invocation forwards the Provider's progress
and diagnostic callbacks; the CLI reports phase changes while waiting, with JSON progress on the
separate progress stream when supplied. Immediate invocation has no durable remote task receipt and
does not become resumable merely because it reports progress. `measure` counts a Segment's pronunciation units at a
delivery policy and prints estimated seconds, the resolved rate, padding and rounding. Choose the
literal `duration` from that estimate and the intended performance. `measure` opens no Profile and
spends nothing. It accepts `--pace slow|normal|fast` or `--rate <units/s>`; JSON includes the resolved
`rate` even when using a named pace. [Estimate](../estimate/README.md#units-and-delivery) explains
Chinese/English units and choosing a whole-passage density.

For `transcribe`, `--runtime <profile>` names the Profile; otherwise the project's `qflow runtime use`
selection is read. Anything the Author Graph declares as an output is a Build, however quickly it
comes back: pictures, clips and accepted voice references (`@qflow/mimo-speech`) carry the identity of the Source
that produced them, so they are declared in the Source and go through `plan` and `build`. To hear a
voice or learn a passage's real length before authoring the rest, build a Run whose target is that
speech output and reuse it as a Candidate.

Provider selection is checked before `transcribe` invokes the service. Multiple matching Endpoints
can remain in the Profile: `bindings` chooses one for the capability. An unsupported request reports
the selected binding and Provider-owned rejection reasons so the author can adjust the request or
choose a compatible Endpoint. It does not imply that an account needs payment or login.

Two more families are local, stateless and spend nothing. `qflow media` exposes the source at chosen
times and scales, and `qflow vocabulary`
prints what a Source may write:

```bash
qflow media probe reference.mp4
qflow media cut reference.mp4 --start 12 --end 19.5 --label-time --to notes/hook.mp4
qflow media cut assets/talk.mp4 --start 12 --end 19.5 --to assets/opening.mp4
qflow media cut assets/talk.mp4 --keep 12:15.5 --keep 16:19.5 --to assets/opening-edited.mp4
qflow media cut assets/narration.wav --keep 0.3:4.1 --keep 4.6:9.2 --to assets/narration-edited.wav
qflow media frames reference.mp4 --at 12.4,13.1 --label-time --to notes/hook-frames
qflow media tile reference.mp4 --start 12 --end 19.5 --to notes/hook-grid.jpg
qflow media tile reference.mp4 --at 12.4,13.1,14.8 --columns 3 --to notes/exact-grid.jpg
qflow media tile reference.mp4 --start 12 --end 14 --every 0.1 --transcript notes/reference.transcript.json --to notes/detail.jpg
qflow media tiles reference.mp4 --around "your next idea" --transcript notes/reference.transcript.json --every 0.1 --columns 3 --rows 2 --to notes/phrase
qflow media tiles reference.mp4 --ranges notes/ranges.json --to notes/grids
qflow media boundaries reference.mp4
qflow media fetch https://… --to reference/source.mp4
qflow vocabulary
qflow vocabulary @qflow/media-pipeline --tag StillVideo
qflow vocabulary --visual text
```

`probe` accepts audio-only files as well as video. `cut` keeps one interval using `--start` and
`--end`, or joins explicitly retained, ordered, non-overlapping intervals using repeated
`--keep start:end` in source seconds. The latter is useful for removing gaps inside one recorded
performance; it does not decide where Script Segments belong. Video retains its available picture
and sound together (MP4 is a useful output container); audio-only outputs PCM WAV. A silent source
video stays silent. The
`--json` reports the source intervals, their nominal positions on the new local clock, and the
measured output duration; actual frame and sample boundaries can differ slightly from the nominal
positions. It writes a new file and refuses to
overwrite an existing one. `--label-time` retains its single-video-interval role: it visibly
overlays source time on an inspection copy, not on the clean production media.

`transcribe` also accepts audio or video. Its transcript refers to the *input file's* clock. A
cut or joined file has a new clock; use the final recorded performance and its Script in the
Build's semantic preparation rather than treating source transcript timestamps as final timing.
`frames` writes one JPEG per requested time, selecting the first decoded frame at or after it.
Visible frame labels use that frame's actual timestamp, as do the labels below each `tile` cell.
Sampling is shared by `frames`, `tile` and `tiles`:

- `--at` names exact sample times; `--start` and `--end` choose a range in seconds.
- `--every` samples from the start at that interval, excluding the end. Times use millisecond precision.
- Grids can instead use `--frames` evenly spaced bin midpoints. Without a sampling option they provide
  a compact overview; choose the interval explicitly when inspecting fast motion.
- `--transcript` reads `qflow.transcript@1` from `qflow transcribe`. The transcript and input media must
  share the same clock. Labels show source time, active words with their start/end, and nearby words.
  Active spans use `[start, end)`; overlapping words are all shown. Missing times stay missing, and a
  frame without a timed word is identified without inferring silence. Text is rendered below the
  source picture using Sharp/Pango and the machine's fonts, including font fallback for multilingual text.
- `--around "a phrase"` with `--transcript` selects that phrase's word boundaries plus `--padding`
  seconds on either side (0.3 by default), clipped to the input duration. Matching uses whole consecutive
  words, ignoring case, whitespace and punctuation. Repeated matches list their times and require an
  explicit `--occurrence` (one-based), or a numeric range. This locates evidence; it does not interpret it.
- `tiles` accepts the same selection as `tile`, or `--ranges` with a JSON array of
  `{ start, end, id?, frames?, every? }`. A range's sampling choice overrides the command default.
  It paginates into `--columns` × `--rows` cells (3 × 3 by default); the final page may have fewer cells.
  `--cell` chooses picture width. `tile` keeps all requested samples in one image.

`--json` reports each frame's `requestedAt` and actual `at`, plus its active/context words when supplied.
Grid `samples` retain the requested times; `frames` contain the actual extracted-frame information.
It also reports every page path for `tiles`. The media layer reads existing timed text; transcription
and its Endpoint remain separate. `boundaries` reports adjacent-frame
change candidates and their measured scores; it does not suppress short changes or call them shots.
`prepare-fetch` explicitly prepares the locked downloader environment; `fetch` requires it and
turns a link into a file with the pinned yt-dlp; [the downloader package](../yt-dlp/README.md)
owns its dependencies, download choices and file handling. Commands that create files write only
what `--to` names and refuse to overwrite. `vocabulary` reads the installed
manifests: every package with its tags and models, or one package's Surfaces with their attributes,
children and example, or the value shapes a drawing Producer must emit.

Install the `@qflow/qflow` Distribution globally once. It resolves its own TypeScript loader and CLI, so it
neither invokes npm per command nor requires a project to contain Qflow's `package.json`.

`qflow capture screenshot <url-or-file> --to <image>` saves browser material, and
`qflow capture run <script.mjs> [-- arguments]` runs ordinary project interactions with a prepared
Puppeteer page and screenshot/recording helpers. `qflow capture --help` lists viewport, region,
readiness and browser options. `qflow capture install-browser` prepares the package's tested browser
revision; an already installed compatible browser can be selected explicitly. The independently maintained `@qflow/browser-capture` package owns
browser lifecycle and capture; Video CLI owns command presentation. This preparation tool outputs
ordinary project files and opens no Runtime Profile or Build. The package README owns the script API.

`--workspace` is only the Source Workspace containment boundary. `--asset-root` may additionally admit
explicit asset bytes without widening Source imports. `--package-root` is only the Host
override used to resolve installed packages. By default, a project with
`package.json` owns package resolution; a plain creative folder falls back to this Distribution's
installation. Keeping that separate from Source containment lets a video project live outside the
Distribution without weakening canonical-path source and asset boundaries. Runtime Profiles do not
contain either Workspace or package-installation overrides.

`check` is usable for an Author Source or a complete Run Source. `plan` and `build` require a Run
Source because an Author Graph without execution intent is not a Build. The live example executes
the deterministic CaptionDocument produced by Script alongside real local/remote Endpoints; the CLI never
fabricates a Target, Candidate or missing fact.

`build` compiles one immutable Build Definition and submits it to the configured Local Runtime with a
fresh, automatically assigned Build id. The id begins with its UTC creation time, so repository order is both
stable and visible; its random suffix prevents same-millisecond collisions and says nothing about content.
Source or Plan identity never reclaims an earlier Build; reuse
across Builds exists only through explicit Run Source Candidates. JSON Profiles resolve only adapters in their separately
selected `use` fields and contain no executable callback. The CLI imports no Provider. A TypeScript config
module remains trusted deployment code with normal Node authority. Neither form is discovered from
a source import.

Without `--follow`, `build` returns after durable submission and the detached Worker continues.
With `--follow`, the CLI observes Build activity and Operation facts until a Result outcome or
`--max-wait-ms`; Ctrl-C only detaches that observer. `status` reads durable verified state, and
`status --watch` reattaches the same kind of observer to an existing Build. The CLI
controls Builds, not individual Operations. Cancelling a Build atomically withdraws it before claim,
or marks running work for one best-effort Provider cancellation call after claim. It never selects
another Candidate. None of these commands creates or stores a ready-Command queue.

The Result saves every public Author Output completed on the demanded route, including structured
values such as semantic takes. Each Logical Output has exactly one public name in `publishedOutputs`;
there are no Record, Artifact or alias selectors. `inspect` shows those Outputs. `get` requires one
exact `--output` name and one explicit `--to` destination: a Scalar becomes a JSON file, a Resource
streams to one file, and a Composite becomes a self-contained directory with `value.json` plus every
referenced Resource. The destination must not already exist. This is Host egress only and never
changes Build identity or retention; large media does not need to be loaded into CLI memory.

`builds` and `history` browse project-owned Result manifests newest first. `--before <build-id>` moves
the cursor to older Results without a central history table. Presentation titles, notes and highlights
live in the Result manifest and may be edited without changing the Build id or the saved Outputs.
`history` always asks for one exact Output name; it never chooses a Result or writes reuse markup.
Use the returned Build id and Output name explicitly in a Run Source when reusing that value.

Human output is compact and organized around author-facing names. `--json` returns a stable, bounded
command view rather than Repository manifests or Runtime persistence objects. `--verbose` adds bounded
operational detail; physical state locations remain the job of `paths`, while `get --to` and
`runtime logs --verbose` expose the paths those commands explicitly operate on.

Historical Records, fixed files and generated previews are declared as ordinary Candidates in the
Run Source and selected by explicit Satisfaction edges. The Host verifies a referenced prior Build
only to extract the declared typed Record; it does not prove a semantic relationship with the current
output. Upstream work behind the selected Candidate is pruned by reverse reachability, while every
unbound reachable output follows the ordinary graph. This is a new Build identity and never resumes
or copies the prior Build's outstanding Commands.

`@qflow/package-loader-node` loads explicitly selected installed implementation packages and checks
their Module, Host-facet, Producer and Validator contributions. Frontends are ordinary
`qflow.source-frontend@1` Host facets, so the Loader does not
select a syntax; each Source Header selects among installed Frontends. Run Fragment libraries enter
only through the `qflow.run-fragment-host@1` facet. Source cannot
install a package or activate Provider/Runtime authority. Arbitrary untrusted community execution
remains absent until an isolated Worker and real permission boundary exist.
