# Narrative Temporal

`@qflow/narrative-temporal` owns the public relation between Narrative boundary identities, finite
source-local domains and one absolute Timeline. It contains no speech, media, Caption or rendering
policy.

`NarrativeAlignment` locates Narrative boundaries on one `LocalTemporalDomain`.
`NarrativeProjection` maps one or more explicit `NarrativeAlignment + LocalTemporalDomain + Window`
relations onto one
Timeline. Narrative Selections, Moments and Segments can then project to ordinary absolute
`TemporalInstant` and `TemporalWindow` values before a general component consumes them.

```svml
<import as="semantic" from="@qflow/narrative-temporal@1"/>
<semantic:Projection id="story-time" narrative={story} timeline={program.timeline}>
  <semantic:Map alignment={opening.alignment} domain={opening.domain} window={program.opening}/>
  <semantic:Window id="proof" selection={story.selection.proof}/>
  <semantic:Instant id="claim" moment={story.moment.claim}/>
</semantic:Projection>
```

The relation may know every located Narrative boundary, but only requested child declarations become
public graph ports. `story-time.proof` is an ordinary `TemporalWindow`; `story-time.claim` is an
ordinary `TemporalInstant`. General visual, audio, caption and typography components consume those
values without receiving the Projection or learning Narrative source kinds. Selection/Segment/Moment
dispatch remain owned here. The completed Projection stores absolute boundaries and no reusable
local-to-absolute mapping identity.

Speech Alignment is one producer of `NarrativeAlignment`; manually authored, imported or adjusted
relations use the same Type without pretending to be speech. Timeline and common Temporal packages
do not enumerate Narrative event kinds.
