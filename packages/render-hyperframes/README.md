# `@qflow/render-hyperframes`

The Surface accepts `timeline={program.timeline}` and projects its complete ProgramSpace.
Its Fragment receives that range as `space`; rendering works with partial, overlapping or absent
semantic coverage through the same frame and audio pipeline.

Explicit author and capability boundary for final HyperFrames video rendering.

`@qflow/render-hyperframes@1#render-frames` captures an existing programme's selected frames.
`hyperframesFramesRequest({ document, frames })` accepts a `HyperframesDocument` and strictly
increasing original-frame indices. `{ project: { html, assets }, frames }` accepts already
materialized HTML with its URL-addressed assets. The `Frames` result is a PNG `BlobRef[]` in request
order; the request already owns the frame identities. Canvas and clock stay in the input.
This capability requests picture capture only. File names, contact sheets and pagination belong to
the caller. `qflow snapshot` invokes it immediately through a selected Profile; there is no Build
or video encoding in that observation path.

The package owns `<render:Video composition={...}/>` and lowers it to ordinary Operations that:

1. obtain the `ProgramSpace` from the Timeline input and compile the referenced `Composition` into a `HyperframesDocument`;
2. request a silent, frame-exact `RenderedVisual`;
3. compile every peer `AudioTrack` into one `AudioProgramPlan`;
4. request an exact 48 kHz `TimelineAudio`;
5. request one `MuxedMedia` from those two independently verified Products;
6. expose the verified mux Artifact unchanged as a domain-neutral `BlobArtifact`.

The package is not a renderer and contains no queue, credentials or deployment choice. A local
HyperFrames process, a hosted endpoint or another conforming execution package may register a
Provider for the exact visual capability. Media Providers independently realize audio rendering and
mux. None parses SVML or decides which Composition to render. Every result is bound to the same
ProgramSpace and exact frame/sample domain before it can become a final video Record.

The output does not carry copied duration or lineage metadata. It is an ordinary Resource-backed
Blob and can therefore be connected directly to any later component that accepts Blob bytes. A
consumer that needs stream or duration facts must request explicit media inspection.

Core therefore sees three real byte-operation Needs, not one opaque mega-render. Frame workers,
contiguous or interleaved chunks, retries and image-sequence assembly remain inside the selected
visual Endpoint; clip decoding/mixing remains inside the audio Endpoint; container encoding remains
inside the mux Endpoint. A single Provider package may implement all three locally, or a Runtime may
bind them to separate compatible Endpoints. The author still sees one `<render:Video>` result.

Film is not a dependency of this author meaning. Any package that produces the common Composition
contract can feed the render Surface. Conversely, targeting Composition never demands this package;
rendering exists only when the author declares and the Build targets the video output.

`@qflow/provider-hyperframes-local` is the first concrete visual implementation. It stages the
document's exact `BlobRef` dependencies, partitions the requested frame domain across
configured Chrome workers, emits a silent MP4 and rejects output unless ffprobe proves one H.264
stream with the declared canvas, rational frame rate and frame count.

Select a contiguous interval using zero-based, half-open frame bounds:

```xml
<render:Video id="preview" composition={main.composition} timeline={speech.timeline}
  start-frame="240" end-frame-exclusive="360"/>
```

At 30 fps this renders seconds 8–12, with 120 output frames. Write both bounds, or omit both to
render the whole programme. The HTML and animation clock remain unchanged. Visual and audio Needs
receive the same range; mux consumes their selected outputs. `workers` belongs in the local
Provider's Runtime configuration.

In TypeScript, `hyperframesVisualRequest(document, { range })` constructs the visual request;
`createRenderHyperframesFragment(true)` accepts a `MediaFrameRange` input and connects it to visual
and audio requests. Provider support checks establish range support for other deployments. Selection limits
final rendering work; it does not prune upstream generation dependencies.
