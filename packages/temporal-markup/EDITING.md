# Author-directed time editing

Studio edits the declaration that produced an absolute time value; it does not ask the consuming
component to reverse an arbitrary projection.

## Direct absolute construction

| Author form | Move | Leading edge | Trailing edge |
| --- | --- | --- | --- |
| `from="2s" for="8f"` | Rewrite `from`; retain `for`. | Rewrite `from`. | Rewrite `for`. |
| `until="3s" for="8f"` | Rewrite `until`; retain `for`. | Rewrite `for`. | Rewrite `until`. |
| `from="1s" until="3s"` | Shift both values. | Rewrite `from`. | Rewrite `until`. |
| `during="timeline"` | No local write. | No local write. | No local write. |
| `during={named-window}` | Follow the referenced value. | Edit its producer. | Edit its producer. |

`from` and `until` may also reference completed Instants. Those references remain fixed at the
consumer; editing follows the Instant's producer. A resolved value does not grant the consumer an
inverse operation over its source domain.

Frames and milliseconds are integral. Seconds may be rational decimals. Timeline conversion uses
exact arithmetic and whole frame boundaries. Unedited values retain their authored unit.

## Domain-produced values

A domain package owns its own declared inverse. `@qflow/narrative-temporal`, for example, knows that
one Instant came from a Moment or a particular Selection boundary. Music analysis could instead
trace an Instant to a beat. Both publish the same `TemporalInstant`, but their editing rules remain
with their projection declarations.

Studio can recover this relationship from the producer graph and the projection package's metadata;
the general visual/audio/text consumer needs no `semantic`, `beat`, or projector input. If several
components consume the same named value, editing its declaration updates all of them after ordinary
recompilation.

This division is intentional:

- `@qflow/temporal-markup` owns absolute literal/reference construction;
- a domain package owns projection and domain-specific writeback;
- `@qflow/temporal` validates resolved absolute values;
- the component owns only what the value means for its behavior.

There is no automatic inverse, hidden compatibility fallback, or central registry of temporal
lineage. Unsupported edits remain unavailable instead of mutating a guessed source.
