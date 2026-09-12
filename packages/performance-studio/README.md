# Performance Studio Companion

The Companion contributes one Performance Track with a content area and an internal Uses band:

- **Performance** shows the Timeline's placed picture Takes, with source thumbnails. These are available contents, independent of which Use presents or hides them. Audio-only Takes have no picture item.
- **Uses** shows each authored Style application as a named interval in the bottom label band. Declaration order sets overlap order; selecting an item raises it for editing without changing the authored priority. Covered and empty applications remain available.

`performance:Track.program` exports the ordered windows and unresolved visuals. The Companion reads that value instead of reconstructing author rules from the final visibility masks. The Timeline supplies the content lane. Typed temporal values identify each Use's exact author element even when its id was omitted.

One Performance label spans the content and Uses band; selection targets a picture Take or a Use.
A Take shows its Segment and placed frame range. A Use shows its resolved range and Style reference.
These are small read-only facts within When and How, alongside the editable fields in the same domains.
The displayed range uses an exclusive end frame.

Selecting a Use exposes its ordinary Style's referenced Frame and Media appearance Recipe. Frame edits write to SVML; appearance edits write to SVS. A shared Style or Recipe remains shared. Temporal gestures follow the same Selection/Moment/clock projection and source-writeback path as other components.

Project Styles receive the same Use interval and title. Their parameters are contributed through `createStudioCompanionHostFacet({ parameters })`, matching
the Style's own Module and Surface. The Track opts its `style` reference into this declaration.
Ordinary Style fields live in their own parameter Companion. See the project
[performance Styles](../../examples/semantic-composition/packages/performance-styles/README.md) for an example.

The internal `bands`, field bindings and content chrome are public Studio Companion declarations. Uses are entities in the same Track; independent child Tracks still use `attachments`. Studio does not recognize Performance names or scene-specific layouts. Caption and Sound can describe their own content and applications through the same interface.

Use picture selection follows exact rendered Present ids supplied by Performance. Take content uses
its Segment identity rather than array position, so reordering Takes preserves selection identity.
