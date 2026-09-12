# `@qflow/timeline`

One Timeline describes the complete film time range and the prepared Takes placed within it.
Semantic anchors exist wherever those Takes supply them; no second kind of time axis is needed
for authored animation. The value stores `id`, `durationSec`, `frameRate`, optional `narrativeId`,
and `items` containing `take` and `startFrame`. A zero-Take Timeline has no Narrative identity.

Each Take retains its normalized local media and semantic evidence. Global positions are its
placement start plus local positions. Items can leave gaps or overlap; their declaration order is
preserved. Frame rates and Narrative ownership agree, identities remain unique, and every complete
Take fits inside the positive Program range. Assembly is owned by
[Timeline authoring](../timeline-author/README.md).

`projectTimelineSpace` supplies the lightweight `ProgramSpace` range used by rendering.
`semanticAnchorFrames`, `selectionFrameSpan`, `segmentFrameSpan`, `tokenFrameSpan` and `momentFrame`
locate evidence without copying another word table. Program boundaries are available even with zero
Takes. Selection endpoints retain their authored identities; projection/consumption determines
whether a requested physical Window is usable.

## Project prepared material

`projectTimelineMedia(timeline, window?)` returns every intersecting Take's `media`, `segmentId`,
global `span` and local `source` frame span. The default Window is the complete Timeline. Gaps
return no source; overlaps return all intersecting sources. Audio-only Takes remain represented.
Starting presentation inside a Take retains the matching source frame. This projection chooses no
layout, winning picture, held frame or transition.

`projectTimelineAudio` places original audio at each Take's position at native speed and gain.
Takes without audio contribute no clip; gaps are silent and overlapping Takes contribute simultaneous
clips. Film explicitly includes that audio contribution. These functions perform no media I/O,
transcription, rendering or generation.
