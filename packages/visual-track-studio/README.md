# `@qflow/visual-track-studio`

Qflow Studio Companion for `@qflow/visual-track`.

Each Clip has a title and image or video body. An explicit author `id` supplies
its title; otherwise the Companion displays its `image`, `media` or `surface`
reference. Display names do not replace the Clip's identity or writeback
endpoint.

Visual and Audio Track share selection and temporal editing behavior. Visual
Track composes Clips by draw order; Audio Track mixes overlapping Clips.

The Inspector preserves the author model's orthogonal axes: Frame geometry,
direct `z`/fit, source-time and treatment Recipe fields are separate bindings.
Source-time is currently a read-only structural binding: Studio does not collapse an
arbitrary piecewise relation back into a closed playback-mode control.
`motion` is a typed Motion reference rather than a Recipe of named effects;
Pose editing can evolve without restoring an enter/sustain/exit catalogue.
