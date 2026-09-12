# `@qflow/narrative`

External components use `@qflow/qflow/narrative` from their `@qflow/qflow` development dependency. The package
owns the types and helpers below; Source imports retain the `@qflow/narrative@1` Module identity.


Public, provider-neutral values for complete authored content and its semantic references.

A `Narrative` owns speech Tokens, Segments, Turns, semantic Anchors, Selections and Moments, plus
its `caption: CaptionDocument`. The document supplies display Words, speech/display correspondence
and Cue breaks. These are authored relationships; frame timing and visual Styles belong downstream.
Script exports the complete value as `story` and the same document as the narrow `story.caption`
Record. A third-party author package can produce the same values without importing the Script parser.

## Query content through semantic references

- `narrativeAnchorTokenBoundary(narrative, anchorId)` resolves a boundary in authored token order.
- `narrativeSelectionTokenRange(narrative, selection)` returns the half-open authored token range.
- `narrativeTokensForSelection(narrative, selection)` returns those Tokens in authored order.

These pure queries use existing Anchors and Tokens, with no stored secondary index. An exported
Selection retains its Narrative identity; content lookup checks that identity. Structural anchors
remain distinct even when they resolve to the same token boundary, and an empty Segment can select
no Tokens. Authored order is independent of gaps, overlap or placement order in a Timeline.

Caption uses this content query and the Narrative's display correspondence to select complete
subtitle units. Timeline projection uses the same semantic references to locate events in physical
time. Neither operation substitutes for the other. Token lookup returns Tokens, not reconstructed
source prose: whitespace, comments and source-preserving edits remain the author language's concern.
