# Sound Studio Companion

Sound contributes one Track with content and a bottom Uses band through the public Companion interface:

- The content lane shows placed audio Takes with waveforms. Each Take retains its actual interval, including gaps and overlaps. Picture-only Takes contribute no sound item.
- The Uses label band shows each authored Style application. Later declarations appear over earlier ones; selection raises an item for editing without changing that priority. Silent and fully covered Uses remain selectable.

One Sound label spans the waveform content and Uses band. Selecting a Take shows its Segment and placed frame range.
Selecting a Use shows its Style and resolved frame range, alongside the ordinary Style's authored
`gain` and `end-gain` parameters. Gain is displayed as a percentage: 100% writes the linear value 1.
The end gain defaults to the start gain. The parameter Companion exposes this dependent default;
the first edit inserts an explicit attribute into the Style.

The fields live in When and How. Shared Style edits affect all Uses selecting that Style.
Temporal gestures follow the existing Selection/Moment/clock projection and exact source endpoint
rules. Project Styles expose their own parameters through `createStudioCompanionHostFacet({ parameters })`,
matching their own Module and Surface. The Track opts `style` into this owner with `companion: true`.

`Sound Track.program` exports the already-computed ordered Use set before presentation coverage
is resolved. `Sound Track.audio` exports the effective audio arrangement. The Companion reads the
former to preserve editing choices even when they currently produce no sound; rendering consumes
the latter. Studio does not reconstruct the rule set from audible output or inspect Sound internals.
