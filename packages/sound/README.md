# Sound

Sound presents audio already placed on a Timeline. Audio Track takes independent material such as
music and effects. Sound obtains existing sources and playback positions from Timeline and chooses
how they are heard. Visual Performance and Caption remain independent presentations.

```svml
<import as="sound" from="@qflow/sound@1"/>
<sound:Style id="normal"/>
<sound:Style id="fade-in" gain="0" end-gain="1"/>
<sound:Style id="silent" gain="0"/>
<sound:Track id="voice" timeline={program.timeline}>
  <sound:Use style={normal}/>
  <sound:Use at="0f" for="2s" style={fade-in}/>
  <sound:Use during={story.selection.demonstration} style={silent}/>
</sound:Track>
```

Include `voice.audio` in Film to hear this presentation. Timeline exports `.timeline`, retaining
the material for consumers; Sound selects and presents its audio explicitly.

Sound also exports `.program`: the ordered Use windows and their audio presentations before
coverage is resolved. The Studio Companion consumes this value to keep silent and covered Uses
available for editing. `.audio` remains the effective arrangement for Film.

## Two separate choices

The last declared matching Use selects the complete presentation locally. No selector means the
whole Timeline. No matching Use contributes no sound; an empty winning Style remains silent.
Later Uses can restore sound inside an earlier silent interval. Separate Sound Tracks can coexist.

Within the ordinary Style, the last Timeline-declared active source with audio wins. Declaration
order is independent of start-time order. A video-only Take supplies no sound candidate; a recorded
silent audio source is still a source. Gaps and zero-Take Timelines have no sound to present. When a
later source ends, an earlier still-active source resumes at its current source position.

`gain` and `end-gain` are linear amplitude multipliers from 0 to 64. `gain` defaults to 1 and
`end-gain` defaults to `gain`. They describe a linear ramp over the original Use Window. Equal values
produce constant gain; zero produces silence. Changing the Window changes the ramp duration.
The interval's right endpoint describes the gain reached at the boundary, while sample coverage is
half-open. Matching adjacent Style endpoints is an authoring choice.

## Time and continuity

Use accepts shared `during`, `at` + `for`, `until` + `for`, and `start` + `end`, including independently
bound `start-source` / `end-source`. A source role and a time endpoint are distinct inputs.

A Use starting at program second 7 does not restart a Take placed at second 5: its sound is already
at source second 2. A partially overridden Use keeps its original gain-ramp progress. Resolution
intersects audible subranges and preserves original Clip targets, sampling and envelopes. The same
holds for a partial audio render. Sound does not move Takes, change words or retime semantic anchors.

## Write a project Style

The public TypeScript entry is `@qflow/qflow/sound`.
`soundStyle(fragment, bindings)` creates an authored Style. Its fragment takes `timeline` and
`window`, plus explicitly bound family inputs, and exports `audio: AudioTrack`. Bound references
become ordinary graph edges at each Use. The fragment may produce an empty Track, one source or
multiple sources; the renderer consumes the resulting ordinary AudioTrack.

`ordinarySound(timeline, window, { gain, endGain })` supplies ordinary last-source presentation.
`sourceSound(timeline, window, segment, { gain, endGain })` selects one explicit Narrative Segment,
retaining its existing source and target positions. A known Segment without audio returns an empty
Track; a foreign or unknown Segment is an error. Neither helper invents sound outside source coverage.
A family can publish richer program-sample `gainEnvelope` points through the common AudioClip data.

The [project crossfade example](../../examples/semantic-composition/packages/sound-styles/README.md)
binds `outgoing` and `incoming` independently. Its two gains move in opposite directions across the
Use Window. There is no transition-mode registry or automatic source pairing. Other families can
own different curves or source combinations through the same fragment interface.

## Rendering boundary

[Composition](../composition/README.md) owns generic AudioClip presentation fields: optional
`gainEnvelope` points and `audibility` subranges, both on the complete 48 kHz program clock. Sound
resolves Uses into those values. The media pipeline preserves them; the execution package applies
them per sample after source playback and existing fades, before render-range cropping.

The [Sound Companion](../sound-studio/README.md) presents placed audio content and authored Uses.
Studio playback consumes the same gain envelopes, audible regions and fades through its generic
AudioTrack player.
