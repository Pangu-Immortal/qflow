# `@qflow/narrative`

External components use `@qflow/qflow/narrative` from their `@qflow/qflow` development dependency. The package
owns the types and helpers below; Source imports retain the `@qflow/narrative@1` Module identity.


Public, provider-neutral values for complete authored content and its semantic references.

A `Narrative` owns speech Tokens, Segments, Turns, semantic Anchors, Selections and Moments. It owns
no Caption document, media or Timeline. Script may publish a peer `story.caption` Record and one
explicit Narrative-to-Caption binding from the same parse, but neither is embedded in Narrative.
A third-party author package can produce the same values without importing the Script parser.

## Query content through semantic references

- `narrativeAnchorTokenBoundary(narrative, anchorId)` resolves a boundary in authored token order.
- `narrativeSelectionTokenRange(narrative, selection)` returns the half-open authored token range.
- `narrativeTokensForSelection(narrative, selection)` returns those Tokens in authored order.

These pure queries use existing Anchors and Tokens, with no stored secondary index. An exported
Selection retains its Narrative identity; content lookup checks that identity. Structural anchors
remain distinct even when they resolve to the same token boundary, and an empty Segment can select
no Tokens. Authored order is independent of gaps, overlap or placement order in a Timeline.

`@qflow/narrative-caption` combines an explicit binding with these content queries to select complete
subtitle units or project them into absolute Caption timing. Timeline projection uses the same
semantic references to locate events in physical time. Neither operation substitutes for the other. Token lookup returns Tokens, not reconstructed
source prose: comments and source-preserving edits remain the author language's concern. Caption
Caption Display Words separately carry `separatorBefore` (`""` or `" "`) so consumers can reconstruct
the authored display spelling without guessing from Token boundaries or importing an author parser.
