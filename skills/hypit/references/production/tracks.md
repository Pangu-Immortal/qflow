# Choose and compose contributions

Read this to decide how content enters picture or sound. [System](system.md) explains the model;
[media preparation](media.md), [timing](timing.md) and [spatial layout](spatial.md) own shared inputs.
A new shared behavior belongs in a [project component](component-design.md).

## Choose by relationship

| Relationship | Starting point | Output |
| --- | --- | --- |
| Place an image, normalized video or surface | [Visual Clip](visual-clips.md) | `.visual` |
| Place speech, music, narration, ambience or effects | [Audio Clip](audio-clips.md) | `.audio` |
| Coordinate continuing sources, transitions, ducking or richer layout | [Project component](track-authoring.md) | declared `.visual` and/or `.audio` |
| Present authored display words at resolved Cue times | [Caption](caption-presentation.md) | package-owned VisualTrack |
| Supply independent writing | [Typography/Text](fonts-and-text.md) | package-owned VisualTrack |
| Coordinate new layout, state or motion | [Project component](track-authoring.md) | declared VisualTrack and/or AudioTrack |

This is not a closed catalogue. A board, effect or whole scene is a component whose behavior owns
its inputs and outputs. Images, text and video may share one scene when their behavior is shared.

## Reuse one normalized source without binding picture and sound

Normalization can establish synchronized visual and audio streams on one local domain. Timeline may
use its Extent, while Visual and Audio Clips independently pair the same media with an absolute
Window:

```text
normalized media + Window + visual sampling -> Visual Clip -> VisualTrack
normalized media + Window + audio sampling  -> Audio Clip  -> AudioTrack
```

This makes the common A-roll case concise without giving Timeline hidden media contents. Picture may
be covered or reframed while speech continues; audio-only and picture-only material need no dummy
peer. Do not route one voice through two selected audio contributions.

## Let events and behavior determine organization

A picture can occupy a projected Selection, a sound can follow a Moment, and a board can retain its
answer after a reveal. All ultimately consume absolute Timeline Instants or Windows. Semantic meaning
arrives through an explicit projection relation, not through a special kind of Track.

An outer Window describes component lifetime. Separate meaningful internal events keep their own
triggers; persistent state may continue after one event. Shared movement or state can justify one
component. Independent contributions may remain peers while consuming the same Moment.

## Assemble only what the film needs

Film receives Canvas, Timeline and each selected visual/audio output. Timeline establishes the finite
extent; components establish appearances and paint order. Including picture never includes sibling
sound automatically. Film child order does not move a picture to the front: every Present owns its
absolute stacking and internal tree.

[Rendering](rendering.md#assemble-the-picture-and-sound) shows Film assembly and delivery.
[Review](review.md) judges the selected picture, performance boundaries and complete mix.
