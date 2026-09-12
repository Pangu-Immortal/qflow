# `@qflow/audio-track-studio`

Qflow Studio Companion for `@qflow/audio-track`. The domain package does not depend on this package.

Each Item has a title and waveform body. An explicit author `id` supplies its
title; otherwise the Companion displays the exact `source` reference. Display
names do not replace the Item's identity or writeback endpoint. This is the same
rule as Media Items. For example, `id="soundtrack" source={music.media}` shows
`soundtrack`; omitting the id shows `music.media`. Here `.media` is the source
output port, not an Audio-specific name suffix.

When groups placement, source trim, playback rates and fades. How contains gain.
Gain displays as a percentage (0–6400%) and writes back as a scalar; duration controls preserve their authored `f`, `ms` or `s` unit.
Omitted gain and fade defaults remain editable; the first edit writes an explicit
attribute. Playback uses the standard parameter controls and saves when editing ends. Stretch also
asks for minimum and maximum rate multipliers (1 means original speed). Switching
to once/loop removes these bounds in the same edit. The Surface retains final
validation of positive, ordered rates. No arbitrary bounds are supplied for the author.

The Companion declares a schema-described `attributes` group. Studio provides
record alternatives, completion hints and grouped source serialization without knowing
any Audio mode names.

Selecting an overlapping Item raises it in the editing lane while all sounds
continue to mix. Timing gestures use the same temporal projection bindings as
Media Track.
