# How a Qflow production fits together

Read this for the relationships among material, meaning, time, space, presentation and execution.
[Production navigation](index.md) routes each current question to its detailed owner.

The work has one finite Timeline and one Canvas. Neither is a container for the work's content.
Attach events to their meaning; introduce component boundaries where content shares useful layout,
state or motion. Semantic coverage need not fill time, and components need not partition Canvas.

## Materials acquire roles through use

A supplied file, generated Output and reused Result can supply the same material Type. Normalization
selects streams and establishes a finite local temporal domain. A model reference, performed passage,
independent illustration and soundtrack are uses of material, not separate file classes.

For performance-led work, Script names meaningful passages and events. `NarrativeAlignment` locates
one Segment's boundaries on a local domain; it carries no picture or sound. `SynchronizedMedia`
carries factual streams and no Script meaning. They may describe the same recording through separate
graph edges.

A-roll names the performance carrying a passage. Its picture may fill the frame, move, disappear or
be absent; its sound may continue independently. That role does not choose a component type. A later
replay may use the same bytes through another media occurrence without duplicating the semantic event.
[Media preparation](media.md) owns these relations.

## Timeline is the absolute execution coordinate

Timeline is `{ id, frameRate, frameCount }`: one finite frame domain. Its author DAG resolves one
exclusive `end` and naturally publishes its named Instants and Windows as sibling graph values.
Timeline contains no Takes, media, semantic anchors, Track list or presentation rules.

A local media Extent can determine a Window even when its length was unknown before generation.
After finalization, a domain projector may map its complete local domain through an equal-length
Timeline Window at native speed. It immediately emits absolute values instead of publishing a durable
mapping object. Gaps, overlap and ranges with no material are valid. A wholly authored animation uses
the same Timeline.

Meaning arrives through explicit adapters. A Narrative Projection combines declared
`NarrativeAlignment + LocalTemporalDomain + Window` relations and resolves Script Selections or Moments to absolute
Instants/Windows. Future beat, subtitle or motion domains can build peer adapters without adding event
kinds to Timeline. Components consume the resulting absolute values; they do not reverse-search
numeric coordinates for meaning. [Timeline](timeline.md) owns construction and [Timing](timing.md)
owns projection and event expressions.

## Contribution does not classify media

Timeline may consume a normalized source's Extent, and a semantic projector may consume its local
domain. Those operations do not wrap or reclassify the media. Afterwards Visual and Audio each declare
an independent occurrence from ordinary normalized media and an exact absolute Window.

```text
SynchronizedMedia + Window -> Visual Clip
SynchronizedMedia + Window -> Audio Clip

NarrativeAlignment + LocalDomain + Window -> absolute Narrative time
```

Visual and Audio Clips explicitly receive the sources they need. Timeline never supplies an
implicit “all footage” query. Selecting picture does not select sound, and vice versa. Downstream
consumers cannot tell whether a source previously helped construct Timeline.

## Canvas is the picture coordinate

Canvas supplies dimensions and coordinates. A Frame locates a destination; fitting maps source extent
into it. Components own internal layout and motion. A presenter and diagram can share a scene while an
independent title remains a peer.

Canvas is not an asset store or central layer tree. Each visual contribution publishes Presents with
their own lifetimes, paint order and internal trees. Time authority and visual scope are independent:
one scene may follow several semantic events, and several components may share one Moment.
[Spatial layout](spatial.md) owns geometry; [component design](component-design.md) owns visual scope.

## Visual and Audio Tracks own ordinary occurrences

Both base Tracks use the same small author algebra: a Track contains peer Clips. Each Clip combines
one explicit source, one absolute destination Window and medium-owned sampling/treatment. Picture and
sound retain separate physical Types and laws; there is no universal Track Type in Core.

Behavior spanning Clips—continuing presenter identity, crossfades, ducking, replacement or richer
layout—belongs to a project or reusable component. It may publish ordinary VisualTrack and/or
AudioTrack outputs without adding effect kinds to the base Track grammar. [Tracks](tracks.md) routes
these choices.

Keep three times distinct: Timeline time locates the contribution, source time identifies the media
sample, and local animation time determines presentation state. A source whose Window begins at second five is at
source second two at program second seven only when an authored sampling relation says so. Every Clip
declares its playback policy; Timeline placement never implies source sampling.

Caption is a peer relation: a document owns displayed text, CaptionTiming owns resolved unit Windows,
and a Caption family owns visual scheduling. Semantic speech is one possible timing source, not a
Timeline requirement.

## Components express relationships worth preserving

A component owns shared behavior. Its inputs connect real dependencies and useful directing choices:
assets, important events, placement or treatment. Decorative geometry and fixed local design may
remain internal. A one-off scene is ordinary production work; cross-project reuse is separate.

Critical internal events retain separate semantic relations when they answer different words.
Interpolation and local motion can follow those events without exposing every number as a control.
[Component design](component-design.md#let-meaning-drive-the-behavior) explains the boundary;
[Track authoring](track-authoring.md) explains implementation.

Film explicitly selects peer VisualTrack and AudioTrack outputs and combines them with Timeline and
Canvas into Composition. Including picture never includes sibling sound. Source nesting, component
scope, paint order and graph dependency are different relations and need not share boundaries.

## Source, Run, Runtime and Studio

Author Source connects material requests, timing relations, components and deliverables. Recipes
provide authored treatment. A Run selects public Outputs as Targets and may reuse exact file or Result
Candidates. Reuse the narrowest completed value whose facts remain true: generated media,
NarrativeAlignment and downstream presentation can be retained or recomputed independently.

A Build executes selected graph work; Result retains completed public Outputs. External work is a
Need implemented by Providers and Endpoints chosen in a Runtime Profile. None of that execution
machinery enters Timeline, media presentation or component domain values.

Studio inspects the same graph. Package Companions follow actual producer and input edges to expose
recognizable entities and author controls. They do not reverse-engineer pixels, query a global anchor
table or transfer edit authority from Script or Style to a numeric Timeline coordinate.
[Authoring](authoring.md), [Runs](runs.md), [Builds](builds.md) and [Studio](studio.md) own those workflows.
