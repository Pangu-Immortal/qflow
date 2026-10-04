---
title: Timing & Assembly
description: Construct absolute program time, then present media and project optional semantic time explicitly.
---

Qflow has one program-time axis: `Timeline`. It is only `{ id, frameRate, frameCount }`.
It contains no clips, words, Tracks or central event registry.

For spoken work, four independent facts meet around that axis:

1. Normalize accepted media into `SynchronizedMedia` plus a finite local temporal domain.
2. Align a Script Segment on that local domain, producing `NarrativeAlignment`.
3. Construct Timeline from a DAG of named Instants, Windows and Extents with one required `end`.
4. Project each Alignment through its equal-length Window; present ordinary media through independent Visual and Audio sources.

This separation is useful: moving a passage changes absolute relationships without changing its media or local
word evidence; reframing picture does not change audio; a pure animation needs Timeline but no media
or Script.

```svml
<import as="pipeline" from="@qflow/media-pipeline@1"/>
<import as="whisperx" from="@qflow/whisperx@1"/>
<import as="semantic" from="@qflow/narrative-temporal@1"/>
<import as="time" from="@qflow/timeline-author@1"/>
<import as="media" from="@qflow/media@1"/>
<import as="visual" from="@qflow/visual-track@1"/>
<import as="audio" from="@qflow/audio-track@1"/>
```

## Normalize local media

The Clock fixes the frame rate shared by the final Timeline and every local domain placed on it:

```svml
<time:Clock id="clock" frame-rate="30"/>
<pipeline:Normalize id="opening-media" source={opening-video.video}
  video="primary-moving" audio="default" span-authority="video" clock={clock}/>
<pipeline:Normalize id="answer-media" source={answer-video.video}
  video="primary-moving" audio="default" span-authority="video" clock={clock}/>
```

Normalization establishes media facts. It contains no Script meaning or program placement.

## Align meaning on each local domain

```svml
<whisperx:Alignment id="opening-alignment" narrative={story}
  segment={story.segment.opening} media={opening-media.media}
  domain={opening-media.domain} language="en"/>
<whisperx:Alignment id="answer-alignment" narrative={story}
  segment={story.segment.answer} media={answer-media.media}
  domain={answer-media.domain} language="en"/>
```

Each output is only a `NarrativeAlignment`: Segment and word boundaries measured on that local
domain. It does not contain media and does not choose a Timeline position. A Segment with no Tokens
omits `language`; its boundaries are the local domain boundaries and no acoustic request is needed.

## Construct the absolute Timeline

Timeline authoring is an acyclic construction graph. `end` is required; every named Instant or
Window is naturally published as an ordinary graph value:

```svml
<time:Timeline id="speech" clock={clock} end="answer.end">
  <time:Window id="opening" from="start" for={opening-media.extent}/>
  <time:Window id="answer" from="opening.end" for={answer-media.extent}/>
</time:Timeline>
```

Each `for={...extent}` uses a resolved unpositioned duration. Generated speech may therefore
determine Timeline length during ordinary graph evaluation. Use `from="opening.end+2s"` for a gap,
`from="opening.end-12f"` for overlap, or `latest(a.end,b.end)` for parallel branches. A pure animation
can simply declare `<time:Timeline id="animation" clock={clock} end="8s"/>`. The Timeline retains no
media or source-domain identity.

## Project meaning independently

Project semantic evidence by pairing each Alignment with its complete local domain and equal-length
absolute Window:

```svml
<semantic:Projection id="story-time" narrative={story} timeline={speech.timeline}>
  <semantic:Map alignment={opening-alignment.alignment}
    domain={opening-media.domain} window={speech.opening}/>
  <semantic:Map alignment={answer-alignment.alignment}
    domain={answer-media.domain} window={speech.answer}/>
  <semantic:Window id="proof" selection={story.selection.proof}/>
  <semantic:Instant id="claim" moment={story.moment.claim}/>
</semantic:Projection>
```

The requested outputs `story-time.proof` and `story-time.claim` are ordinary absolute Window and
Instant values. Semantic time is one
optional projection source; direct seconds, frames and named Timeline values remain equally valid.

## Present picture and audio

```svml
<visual:Track id="picture" timeline={speech.timeline}>
  <visual:Clip id="opening" media={opening-media.media} during={speech.opening}
    frame={speech-frame} z="10" fit="cover"/>
  <visual:Clip id="answer" media={answer-media.media} during={speech.answer}
    frame={speech-frame} z="10" fit="cover"/>
</visual:Track>

<audio:Track id="mix" timeline={speech.timeline}>
  <audio:Clip id="opening" source={opening-media.media} during={speech.opening}/>
  <audio:Clip id="answer" source={answer-media.media} during={speech.answer}/>
</audio:Track>
```

There is no separate Performance, Sound or generic Presentation protocol. Visual and Audio Clips are
peer occurrences. The same normalized media can feed both, but selecting its picture never makes its audio
audible automatically.

```text
SynchronizedMedia + Window ──────────────────────────────→ Visual / Audio occurrence

NarrativeAlignment + LocalDomain + Window ──────────────→ absolute Instants / Windows

Instant / Window / TemporalExtent DAG ───────────────────→ Timeline
```

Components ultimately consume Timeline plus absolute Instants or Windows. A domain projection
publishes those values upstream; general component Surfaces do not accept Script objects or carry
the projector.
