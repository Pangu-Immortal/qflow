# `@qflow/ranking-studio`

Qflow Studio Companion for the Ranking module's Column, Tier and Top Three surfaces.

Each surface has separate visual and audio Companion declarations in this one
package. Film chooses `.visual` and `.audio` independently; selecting the visual
output does not connect its sound.

The root lane represents the board; `attachments` expose reveal or activation
events on a detail lane. Both use Studio's ordinary item selection and overlap
behavior. Their time ranges remain the authored event ranges.

Ranking's renderer assigns `subjectId` to each item's rendered phases. The
Companion associates those phases with the item's `renderIds`, so clicking an
entering or settled icon selects the same detail entity. The board and preset
items without a detail event remain associated with the root. Studio measures
the visible parts at the current frame; the Companion does not duplicate motion
geometry or infer identities from rendered ID strings.

The audio Companion presents a `Ranking Sounds` lane. Each emitted clip shows
its item and phase (`Appear` or `Move`) with a waveform. It joins the board's
exported `.events` to the rendered audio clips by exact event identity, so a
phase without a supplied sound contributes no audio item. `Move` is the motion
into the board, not an exit sound.

Selecting a sound exposes the event trigger as a read-only fact and the shared
Ranking Style's sound gains and fade-in length as editable fields. Gain is
displayed as a percentage; edits write the original linear gain to the Style's
recipe. These fields affect every matching event using that recipe. Event
timing comes from the Ranking animation; changing the visual event timing
updates its sound too. The visual Companion owns layout and motion controls,
while the audio Companion owns the sound controls.
