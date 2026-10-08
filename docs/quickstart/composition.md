---
title: Film & Rendering
description: Assemble peer visual and audio contributions, then render the selected program range.
---

Film is an ordinary author component. It combines explicitly selected VisualTrack and AudioTrack
outputs with one Canvas and one Timeline, producing a Composition. The renderer turns that
Composition into a video.

```svml
<import as="space" from="@qflow/spatial@1"/>
<import as="film" from="@qflow/film@1"/>
<import as="html" from="@qflow/html-video@1"/>
```

## Assemble the Film

```svml
<space:Canvas id="vertical" width="1080" height="1920"/>

<film:Film id="main" canvas={vertical.canvas} timeline={speech.timeline}
  appearance={recipes.film.vertical}>
  <film:Track source={picture.visual}/>
  <film:Track source={mix.audio}/>
  <film:Track source={cards.visual}/>
  <film:Track source={captions.visual}/>
  <film:Track source={meaning.visual}/>
</film:Film>
```

| Attribute | Required | Meaning |
|---|---|---|
| `id` | yes | Public composition identity |
| `canvas` | yes | The picture coordinate system |
| `timeline` | yes | The finite absolute program range |
| `appearance` | yes | Film Recipe, including the clear color |

Each `<film:Track>` accepts one VisualTrack or AudioTrack. Film does not discover sibling outputs.
If one normalized source should contribute both picture and sound, author one Visual Clip and one
Audio Clip from that media; both resulting Tracks must then be selected here.

Common outputs include:

| Source | Type | Role |
|---|---|---|
| `{picture.visual}` | VisualTrack | picture occurrences placed by Visual Track |
| `{mix.audio}` | AudioTrack | placed voices, music and effects from Audio Track |
| `{cards.visual}` | VisualTrack | independent image/video Clips |
| `{captions.visual}` | VisualTrack | a Caption family |
| `{scene.visual}` | VisualTrack | a project component |

The public output is `{main.composition}`.

## Visual order belongs to Presents

Film children select contributions; their source order does not define picture stacking. Each visual
component publishes timed Presents with an absolute `z`, commonly authored through `stack-order` in
its Recipe. Lower values paint behind higher values. Equal values use stable Track identity, then
Track-local Present `order` and Present identity; use distinct values whenever the relative paint
relation matters.

```svs
film.vertical { background: #09090B; }
media.speaker { stack-order: 10; fit: cover; }
media.card { stack-order: 40; fit: contain; }
caption.base { stack-order: 70; }
/* Fine Text writes z="90" on its Flow, Point or Path occurrence. */
```

Presents from different Tracks can interleave. A Present may also own an internal element tree or a
HTML visual when several pictures, graphics and text share layout or motion. Put content together
when its behavior belongs together; keep independently useful contributions as peers.

## Render the complete video

```svml
<html:Video id="final"
  composition={main.composition} timeline={speech.timeline}/>
```

The renderer compiles the visual contributions, captures requested frames, renders AudioTracks and
muxes them into the delivered file. `{final.video}` is an ordinary Resource-backed `Blob` and
the usual Run Target.

```svml
<?svml using="@qflow/markup/run@1"?>
<svrun version="1">
  <author source="./main.svml"/>
  <target output="final.video"/>
</svrun>
```

## Render a frame interval

```svml
<html:Video id="detail" composition={main.composition} timeline={speech.timeline}
  start-frame="240" end-frame-exclusive="360"/>
```

The bounds use the original Timeline and a half-open interval. At 30 fps this example renders
seconds 8–12. Animation and media sampling retain their original program positions even though the
encoded clip starts at zero. Range rendering limits final capture and encoding; upstream graph work
still follows the selected Run, so reuse accepted media and alignment Outputs explicitly.

## A film drawn entirely by components

Timeline does not require speech or media:

```svml
<import as="time" from="@qflow/timeline-author@1"/>

<time:Clock id="animation-clock" frame-rate="30"/>
<time:Timeline id="animation" clock={animation-clock} end="8s">
  <time:Instant id="question" at="0.5s"/>
  <time:Instant id="answer" at="2s"/>
</time:Timeline>

<chat:Scene id="conversation" timeline={animation.timeline} within={canvas.bounds}
  during={animation.window}>
  <chat:Message id="question" at={animation.question} sender="Maya" text="Ready?"/>
  <chat:Message id="answer" at={animation.answer} sender="Leo" text="Let's go."/>
</chat:Scene>

<film:Film id="main" canvas={canvas.canvas} timeline={animation.timeline}
  appearance={recipes.film.main}>
  <film:Track source={conversation.visual}/>
</film:Film>
<html:Video id="final" composition={main.composition} timeline={animation.timeline}/>
```

The component owns its reading rhythm through ordinary absolute time. With no selected AudioTrack,
the result is silent. In a spoken composition, a Narrative Projection can reveal Moments or
Selections as the same absolute Instant and Window inputs.

## Check before execution

```bash
qflow check main.svml
qflow plan build.svrun
```

`check` validates imports, types and graph edges without calling external services. `plan` compiles
the selected Run and shows the Operations it would demand. Inspect that plan before paid execution.

See [Timing & Assembly](./timing.md) for normalization, Timeline construction, media presentation and
semantic projection. See [Tracks](./tracks.md) for Visual and Audio authoring forms.
