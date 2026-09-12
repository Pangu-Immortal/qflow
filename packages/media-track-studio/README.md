# `@qflow/media-track-studio`

Qflow Studio Companion for `@qflow/media-track`.

Each Item has a title and image or video body. An explicit author `id` supplies
its title; otherwise the Companion displays its `image`, `media` or `surface`
reference. Display names do not replace the Item's identity or writeback
endpoint. Source-audio gain uses the same percentage display and scalar
writeback as Audio Track.

Media and Audio Track share selection and temporal editing behavior. Media
composes pictures by draw order; Audio Track mixes overlapping sounds.
