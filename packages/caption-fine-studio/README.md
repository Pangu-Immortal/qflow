# Caption Fine Studio Companion

One Caption Track contains Cue blocks and a bottom Uses band declared through the public ABI.
Each Cue has a numbered title such as `#15` and complete subtitle text in its body.
Cue ids remain the underlying identities; the number is a display label. Cues retain their measured
times, including content currently hidden by a Use. Their read-only Range describes the content, independently of its visual treatment.

The Uses band shows each authored Window once, with its Style name. A whole-Timeline Use remains one
block across Segment changes and gaps. Hidden and overridden Uses stay selectable. The Companion
reads the Track's `content`, `schedule` and `program` exports; it never reconstructs author windows
from the rendered words.

Use entities retain the actual child Source range and standard Temporal lineage. Timeline gestures
therefore use the same writeback rules as Performance and Sound. Selecting a Use exposes its
referenced Style's font and Recipe fields. Shared Styles remain shared; changing a time window
changes presentation without editing Script Cue breaks.

Studio owns Track bands, block chrome, overlap selection and generic Inspector controls. This Companion owns
Caption facts, field grouping and Source bindings. Content, Uses and their renderer stay independent
of central Studio domain logic.

Fine Style parameters are a separate `parameters` Companion matched to the Fine Style Surface.
The Use band opts its `style` reference into the selected object's Companion. Custom Styles can
provide their own field table through their project package. Supported omitted defaults appear
in the Inspector and are inserted into the owning Recipe only when edited.
