---
title: Timing edits in Studio
description: Choose what follows speech, what uses the clock, and what a timing edit changes.
---

A timing expression records an authoring decision. An explanation can follow a spoken phrase;
a flash can follow its answer; an independently paced animation can use the film clock. Studio
edits the decision expressed by that form.

[Script](../quickstart/script.md) gives phrases and events their Selection and Moment identities.
The Timeline places the prepared performances; components use those identities or clock positions
to receive an Instant or Window. A silent animation uses the same Timeline with an authored extent.

## Choose the relationship to edit

| Author form | Moving it changes | Trimming it changes |
| --- | --- | --- |
| `during={story.selection.proof}` | Both shared Script anchors by the same number of semantic stops; duration may change | The chosen Selection boundary |
| `at={story.moment.reveal}` for an event | The shared Moment anchor | No duration is declared |
| `at={story.selection.proof} boundary="start"` for an event | Only the Selection's start anchor | No duration is declared |
| `at={story.moment.reveal} for="8f"` | The Moment; duration stays eight frames | The trailing duration; the Moment stays fixed |
| `until={story.moment.reveal} for="8f"` | The Moment; duration stays eight frames | The leading duration; the Moment stays fixed |
| `at="2s" for="8f"` | The authored clock position | The trailing duration |
| `instant="moment.cue + 2f" moment={story.moment.reveal}` | The local offset; the Moment stays fixed | No duration is declared |
| `start="…" end="…"` | Both endpoint expressions by the same frame delta | Only the chosen endpoint expression |
| `during={story.segment.opening}` or `during="program"` | Follows the structural span; no timeline drag | No timeline trim |

The consuming Surface decides whether it needs an Instant or a Window and which forms it exposes.
For an event bound to a Selection's end, use `boundary="end"` with the same boundary-only behavior.

## Keep shared meaning and local offsets distinct

Moving `at={story.moment.reveal}` relocates the Moment in Script. Every consumer of that Moment
then follows the changed relationship. Moving `instant="moment.cue"` with the same bound Moment
instead changes a local offset, initially zero. It leaves the shared Script event in place.

Use `instant="moment.cue + 2f"` with `moment={story.moment.reveal}` for a deliberate lead or lag.
Arithmetic does not go inside a graph reference such as `{story.moment.reveal}`.

An event and its duration are independent choices. `at/for` offers a duration handle on the trailing
edge; `until/for` offers it on the leading edge. There is no opposite trim handle that secretly moves
a shared event and compensates by changing its duration.

## Preserve the chosen words and boundaries

Word starts, word ends and structural boundaries are distinct semantic anchors. A pause can belong
to the preceding or following phrase. Dragging uses semantic stops at distinct frame positions;
where supported, the Inspector lets you choose the exact anchor when several share one frame.
Script order and physical time can differ when Takes overlap or are reordered.

Marker edits preserve unrelated prose, spaces, punctuation, pronunciation and word attributes.
Caption Cues keep their Script-derived content and measured word times. Change their wording or
Cue boundaries in Script, and their appearance through the Caption Style and timed Uses.

Unedited expressions retain their units: `2s` keeps its duration across frame rates, while `60f`
keeps its frame count. A clock position or offset changed by a drag is written in whole frames
at the current frame rate.

## Editing a project component

A component's Companion connects its entities to their actual authored inputs and projected time.
The time form determines the edit target; the component name or a coincident frame does not.
Source observation and marker relocation belong to the Script Companion. Adding a new component
therefore does not require teaching Studio another interpretation of Script.

[Studio](../quickstart/preview.md) explains the editing interface. The
[Companion guide](./studio-companion-architecture.md) explains exposing entities and controls;
the package-owned [temporal editing reference](https://github.com/qflow-ai/qflow/blob/main/packages/temporal-markup/EDITING.md)
contains the exact implementation interfaces and supported operations.
