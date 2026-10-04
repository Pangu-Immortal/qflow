# Place sound through Audio Track

Read this for normalized speech, music, ambience and effects. [Sound direction](../playbooks/craft/sound-mix.md)
owns the mix judgment; this page owns the plain author relation.

## The ordinary relation is one Clip occurrence

```text
Audio Clip = normalized audio source + absolute Window + sampling + mix
Audio Track = additive set of Audio Clips
```

```svml
<audio:Track id="mix" timeline={program.timeline}>
  <audio:Clip id="voice" source={speaker-media.media} during={program.speaker}/>
  <audio:Clip id="music" source={music-media.media} during="timeline"
    gain="0.18" fade-in="12f" fade-out="18f">
    <audio:Map target-at="end" source-at="end" rate="1"
      wrap-from="start" wrap-until="end"/>
  </audio:Clip>
  <audio:Clip id="reveal-hit" source={hit-media.media}
    from={story-time.reveal} for="600ms" gain="0.45" fade-out="3f"/>
</audio:Track>
```

Speech, music, ambience and effects are equal Clips. `during` consumes an absolute Window or the
complete Timeline. The alternate form supplies exactly two of `from`, `until` and `for`. Semantic,
beat or other coordinates must first be projected to ordinary Instants or Windows by their owner.

Timeline contribution and audio placement are separate relations. A source that supplied unknown
duration earlier leaves no marker here; the Clip explicitly chooses whether its sound is heard.
Using the same normalized source in two Clips creates two independent occurrences.

## Sampling and mix stay explicit

Omission means bounded partial identity: target start maps to source start at native rate and excess
Window time is silent. `Map` children express other relations with target/source bounds, paired
anchors and an exact positive rate. `wrap-from`/`wrap-until` makes a source interval periodic. A Map
without rate, anchors or wrap fits its source interval into its target interval while preserving
pitch; optional `min-rate`/`max-rate` bounds make an unsafe fit fail. Multiple non-overlapping Maps
form one piecewise relation and gaps stay silent.

`gain` is a linear multiplier; fade lengths default to zero and remain measured against the whole
Clip Window even when source-time has several pieces. Overlapping Clips mix as peers. Audio Track
does not extract streams, normalize files, infer ducking, choose a bus or apply a last-source-wins
rule.

## Relationships spanning Clips are components

Audio Track has no generic Presentation, Style or Use. Ducking, crossfades, speaker handoffs and
other behavior spanning several Clips belong to a project or reusable author component. It may
calculate envelopes or publish its own terminal `AudioTrack`; Core and Film still see an ordinary
audio contribution.

Audio Track emits `.audio` and `.program`. Film includes `.audio` explicitly. Using synchronized
media in [Visual Track](visual-clips.md) does not make its sound audible, and using its audio does not
reveal its picture. Avoid routing the same voice through two selected audio contributions.
