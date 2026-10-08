---
title: Timing edits in Studio
description: Edit the declaration that produced an absolute Instant or Window.
---

Components use absolute Instants and Windows. Studio follows the graph to the value's producer and
edits that declaration; it does not ask every visual, audio, caption or text component to understand
the source domain.

## Absolute declarations

| Author form | Moving it changes | Trimming it changes |
| --- | --- | --- |
| `from="2s" for="8f"` | `from`; duration remains eight frames | leading: `from` + `for`; trailing: `for` |
| `until="3s" for="8f"` | `until`; duration remains eight frames | leading: `for`; trailing: `until` + `for` |
| `from="1s" until="3s"` | both endpoints by the same delta | the selected endpoint |
| named Window declared with `from`/`until`/`for` | the named declaration | the selected relation |
| component `during={named-window}` | the named value's producer | the named value's producer |

An Instant reference behaves the same way: component `at={claim}` follows the declaration that
produced `claim`. Clock literals belong on named Timeline or standalone declarations, not on the
component surface.

## Domain-produced values

Narrative time is projected before it reaches the component:

```svml
<semantic:Projection id="story-time" narrative={story} timeline={film.timeline}>
  <semantic:Map alignment={speech.alignment} domain={speech-media.domain} window={film.speech}/>
</semantic:Projection>
<semantic:Window id="proof" projection={story-time} during={story.selection.proof}/>
<semantic:Instant id="reveal" projection={story-time} at={story.moment.reveal}/>

<visual:Clip during={proof} .../>
<deck:Card at={reveal} .../>
```

The Narrative projection declaration retains the Selection or Moment relation required by its
Companion. Editing that declaration may move Script anchors, and every consumer follows after recompilation.
The consumers themselves receive only completed absolute values. A future beat projector can offer
different editing rules while publishing the same Temporal types.

If a producer declares no inverse, the resolved value remains usable but Studio does not guess a
write target. This keeps shared meaning, local clock values and component behavior separate.

Each drag is solved as one complete constraint. A leading trim keeps the old end, a trailing trim
keeps the old start, and a move keeps the old duration. Studio follows the executed Temporal graph
to the exact author endpoints and commits every required source change together.

Named values constructed inside `<time:Timeline>` follow the same rule. Timeline Author retains the
child declaration that owns each literal offset or duration, so Studio can edit that exact
`Instant.at`, `Window.from`, `Window.until` or `Window.for` value. Bare references continue upstream;
an `earliest(...)` or `latest(...)` expression stays read-only when changing it would require choosing
one branch on the author's behalf.

Unedited expressions retain their units: `2s` remains two seconds when frame rate changes, whereas
`60f` remains sixty frames. A changed clock value is written on a whole frame boundary for the
current Timeline.

[Studio](../quickstart/preview.md) explains the editing interface. The
[Companion guide](./studio-companion-architecture.md) explains package-owned Items and controls.
