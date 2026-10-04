# `@qflow/audio-track-studio`

Qflow Studio Companion for `@qflow/audio-track`. The domain package does not depend on this package.

Each Clip has a title and waveform body. An explicit author `id` supplies its
title; otherwise the Companion displays the exact `source` reference. Display
names do not replace the Clip's identity or writeback endpoint. This is the same
rule as Visual Clips. For example, `id="soundtrack" source={music.media}` shows
`soundtrack`; omitting the id shows `music.media`. Here `.media` is the source
output port, not an Audio-specific name suffix.

When contains the absolute Clip Window and its target-relative fades. How contains gain.
Gain displays as a percentage (0–6400%) and writes back as a scalar; duration controls preserve
their authored `f`, `ms` or `s` unit. Omitted gain and fade defaults remain editable; the first edit
writes an explicit attribute.

Source-time is a separate structural binding. It can be omitted for bounded partial identity or
authored as one or more `Map` relations, but the Companion does not pretend an arbitrary piecewise
function is one editable playback-mode dropdown. Final validation and lowering remain owned by
Audio Track.

Selecting an overlapping Clip raises it in the editing lane while all sounds
continue to mix. Timing gestures follow the same absolute temporal bindings as Visual Track.
