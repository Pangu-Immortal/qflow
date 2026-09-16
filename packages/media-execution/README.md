# `@qflow/media-execution`

Shared FFmpeg execution body for Qflow media Providers.

Timeline-audio requests accept an optional `range: { startFrame, endFrameExclusive }` on the
original programme clock. Only overlapping clips are read. Loop phase, tempo, gain and fades
are evaluated in their original clip coordinates before trimming and rebasing the selected mix.
The output remains 48 kHz stereo PCM. At rational frame rates, its sample count is rounded from
the selected frame count; reconciling that zero-based clock can trim or pad one boundary sample.

`@qflow/media-pipeline` owns provider-neutral Needs, plans and result contracts. This package
owns the byte-level implementations of the eight current operations:

- inspect every media stream;
- normalize selected audio/video streams;
- transform synchronized media with ordered trim and pitch-preserving retime operations;
- extract one selected audio stream as an ordinary 48 kHz stereo WAV Artifact;
- extract a first, last, indexed or time-selected frame as PNG;
- project canonical 16 kHz mono speech-evidence audio;
- render an exact sample-domain audio program;
- mux rendered visual and audio products.

The local Provider calls these functions with its Artifact I/O and FFmpeg launch environment. Other
deployments can reuse the same functions to preserve stream selection, timing, codec and validation behavior.

This is not an author package, Provider, queue or Core extension. It performs no endpoint selection,
credential lookup or SVML parsing.

`verifyCompositableSurfaceFile({ surface, path, ... })` inspects a file already staged by an execution
owner. That owner must keep it unchanged until the call settles, including cancellation; inspection
neither copies nor removes it. `verifyCompositableSurfaceBytes({ surface, bytes, ... })` remains a
convenience wrapper for callers that have bytes, creates its own temporary file, and removes that
file only after probing has settled. Both use the same decoded Surface checks and return no extra
result facts. Filesystem paths belong to this Node execution boundary, not to Surface or Blob refs.

Audio gain envelopes and audible subranges are evaluated per sample after tempo/looping and Clip
fades, before the requested range is cropped. Original source and envelope progress therefore survive
local silence and range rendering. This is generic AudioProgramPlan execution, independent of author
component or Style names.
