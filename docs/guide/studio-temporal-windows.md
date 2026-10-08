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
| `from="2s" for="8f"` | `from`; duration remains eight frames | `from` or `for` |
| `until="3s" for="8f"` | `until`; duration remains eight frames | `for` or `until` |
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
  <semantic:Window id="proof" selection={story.selection.proof}/>
  <semantic:Instant id="reveal" moment={story.moment.reveal}/>
</semantic:Projection>

<visual:Clip during={story-time.proof} .../>
<deck:Card at={story-time.reveal} .../>
```

The Narrative projection declaration retains the Selection or Moment relation required by its
Companion. Editing that declaration may move Script anchors, and every consumer follows after recompilation.
The consumers themselves receive only completed absolute values. A future beat projector can offer
different editing rules while publishing the same Temporal types.

If a producer declares no inverse, the resolved value remains usable but Studio does not guess a
write target. This keeps shared meaning, local clock values and component behavior separate.

Unedited expressions retain their units: `2s` remains two seconds when frame rate changes, whereas
`60f` remains sixty frames. A changed clock value is written on a whole frame boundary for the
current Timeline.

[Studio](../quickstart/preview.md) explains the editing interface. The
[Companion guide](./studio-companion-architecture.md) explains package-owned entities and controls.
