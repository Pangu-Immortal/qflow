# `@qflow/studio-companion`

The stable companion-package ABI understood by Qflow Studio. It carries only
presentation, lineage, inspector and interaction DTOs plus helpers that do not
encode the official video UI policy. Domain computation and manifests do not depend on it;
package activation can combine domain facets with a separate Companion implementation.

External packages peer-depend on both `@qflow/qflow` and `@qflow/studio-companion`, use the public imports
below, then ship compiled JavaScript. The active Distribution supplies both packages when Studio loads the
component.

## A minimal project Track Companion

Suppose `@studio/score-strip@1` already owns a `track` Surface that emits a public VisualTrack and
accepts a literal string `label` attribute. The Companion can reuse generic terminal entities while
adding package-specific presentation and one Inspector field:

```ts
import { compositionTypes } from "@qflow/qflow/composition";
import type { StudioTrackCompanion } from "@qflow/studio-companion";

export const companions: readonly StudioTrackCompanion[] = [{
  id: "score-strip",
  role: "track",
  output: {
    type: compositionTypes.visualTrack,
    surface: "track",
    modules: [{ name: "@studio/score-strip", version: "1" }],
  },
  family: "score-strip",
  label: "Score strip",
  icon: "ranking",
  tone: "orange",
  lane: { heightPx: 64 },
  poster: { source: "surface-preview" },
  bindings: [{ name: "label", writable: true }],
  inspector: [{
    binding: "label",
    label: "Label",
    domain: "how",
    section: { id: "content", label: "Content" },
    control: "text",
  }],
}];
```

The names and lane height are this example's choices. Use the real Module ABI, Surface name,
nominal output Type and authored input names of the component. A Companion does not create a new
author attribute. Omitting `project` uses generic terminal entities; `poster` adds the declared
Surface preview when one exists, without changing the component's rendered video.

Each lane occupies one timeline row. Entities overlap in ascending `stackOrder`,
with later projected entities above earlier ones when orders tie. Studio keeps
overlapping entities mounted and raises the selected entity within its lane;
selection does not change the rendered composition or write stacking back to Source.
Expose `presentId` or `renderIds` for visual entities so picture selection can
address the same entity shown in the timeline. Attached lanes represent distinct
Companion projections, not extra rows allocated to avoid temporal overlap.

An entity's timeline interval describes the operation being edited; its rendered
parts may remain visible afterward. Associate every relevant phase through
`renderIds` (for example, an entrance and the settled object). Studio picks the
currently visible part in rendered stacking order and selects the same entity,
without extending its editable interval. Give the parent the board or background
parts and its children their own parts when they should be independently selectable.
The component decides this granularity. A composite can remain one selectable entity.

Merge the facet into the package's existing activation. In this example `authorContribution`
exports its existing modules, deterministic component and Markup facets:

```ts
import { createStudioTrackCompanionFacet } from "@qflow/studio-companion";
import authorContribution from "./author-activation.js";
import { companions } from "./studio.js";

export default {
  ...authorContribution,
  facets: [
    ...(authorContribution.facets ?? []),
    createStudioTrackCompanionFacet(companions),
  ],
};
```

Point the package's existing `qflow.activation` at that combined export and include the compiled
Companion file in the package. Keep the real modules, Producers and Surface facets; a Companion-only
replacement would remove the component itself. Use the active Distribution's adapter ABI, as
described in the [Studio README](../studio/README.md), rather than a `workspace:*` dependency in an
external project.

Studio loads facets from packages selected by the Source closure alongside the Distribution's
explicit official Companion selection. It qualifies this local id as
`@studio/score-strip#score-strip`. There is no extra Studio Profile, plugin scan or Core registration.
Restart the Studio process after changing activation or package code.

## Project domain entities and material

A terminal VisualTrack is enough for generic display. When it loses meaningful domain structure,
publish a deterministic schedule/program output from the same Surface and name its port in
`requiredValues`. Inside `project(context)`, retrieve it with `requiredSurfaceValue(context, "schedule")`.
The port must exist in the Surface's public output mappings; inventing a port name in a Companion
does not make an internal Producer value observable. `requiredReferencedValue(context, input, type)`
instead follows one exact typed author reference, such as a CaptionDocument.

`project` returns `StudioEntityDraft[]`. Each entity has an id, authored identity, display title and
ordered layers, `startFrame`, `endFrameExclusive` and `stackOrder`. Useful optional fields include:

| Field/helper | Purpose |
| --- | --- |
| `selectionGroup` | Link disjoint displayed intervals of one author entity; selection highlights them together without changing their independent timing |
| `presentation` | Name the entity's role and choose `standard`, `group`, `point` or `compact` chrome (a single-line primary label) |
| `textLayer(text)` | Put explicit domain text in the timeline body |
| `previewLayer(artifactPreview(kind, resource), layout)` | Show a declared image/video/audio Resource with a finite layout; Studio resolves transport |
| `renderIds` | Relate an entity to its actual rendered elements |
| `parameterReferences` | Select exact per-entity authored references, such as the Style really used by this Cue |
| `temporal` | Carry the executed Instant/Window lineage and its edit authority |
| `lane` and Companion `attachments` | Put child entities on a declared additional lane, with its own bindings and Inspector |
| `childEntities` / `authoredChildFor` | Resolve children from public identity and exact Spec Types rather than source order guesses |
| `authoredItemTitle` | Prefer an explicit author id, then a source reference from the attributes chosen by the Companion; presentation leaves editing identity unchanged |

Use the program's frame space and half-open intervals. Persistent visibility and its activation are
different facts: a board item can remain visible until the board ends while its reveal occupies only
a short child interval. Expose that distinction rather than making a long rectangle imply a long
entrance animation. Qualify child ids across Track instances; never use an array index as authored
identity merely because it currently lines up.

Read [Ranking's Companion](https://github.com/qflow-ai/qflow/blob/main/packages/ranking/src/studio.ts) for board/reveal lanes,
Caption Fine's `@qflow/caption-fine/studio` facet for Cue text and Style selection, and
[Visual Track's](../visual-track/src/studio.ts) for material and occupancy.

## Preserve executed temporal lineage

`StudioTrackCompanionContext.temporalBindings` exposes the executed Instant/Window records in the selected
Track closure, including projection expressions, source identity and direct consumer inputs.
`temporalLineageFor()` joins a domain entity to those edges through the identity of a value consumed
beside the projection. No match is read-only, one match is used, and several matches are an error rather
than a first-result guess. Endpoint authority is already part of that executed lineage: an author syntax
may declare a parameter inverse on the Spec it creates, while a domain projector declares its own source
and boundary. Common Studio never maps attribute names such as `from`, `for`, `until` or `during`. The generic terminal
fallback tries only the terminal object's exact `subjectId`/`authoredId`; renderer ids and marker ids
are not alternate guesses.

Track Companions match terminal outputs by complete `TypeRef` and their authoring origin by complete
`ModuleRef + Surface`; Film and temporal-domain Companions use the same versioned origin match. Short Type
and module names remain available for UI text and diagnostics but never decide which Companion is
allowed to interpret a value.

Trace references retain the exact author input name and resolved TypeRef. A Companion that needs a
CaptionDocument or another referenced domain value selects that declared edge; it never scans all
values for a familiar object shape. Child entities follow the same rule: when an optional Source id
was omitted, a Companion may name the exact domain Spec Type whose public `id` owns that child.
Studio then recovers the Source range from the typed observed Record, without ordinal matching.

A project companion contributes package-local Track Companion ids through
`createStudioTrackCompanionFacet()`. The Host qualifies them with the selected
physical package identity, so executable package code cannot impersonate an
official Companion. The Source closure selects project packages; Studio does not
scan `node_modules` for plugins or use Runtime Profiles to select Companions.

The same Studio Companion facet can contribute Film, temporal-domain and parameter Companions. A Film Companion
identifies its Timeline and terminal Tracks. The Timeline supplies only the program range. A
temporal-domain Companion owns source observation, requests the domain values it needs, projects
generic anchors plus point/span items onto that Timeline, and receives inverse point/span edits.
Script Studio uses this protocol for Narrative, but common Studio neither imports Narrative nor
reserves segment, word, Selection or Moment slots. Another package can contribute beat, shot or
motion-event domains through the same protocol.

For a domain item whose Spec is consumed beside a Window or Instant, call
`temporalLineageFor(context, item.id, "window")` using the actual projection input name. Attach the
returned lineage to that entity; the input may instead be `activation`, `outer` or another declared
port. Studio derives common timeline gestures from endpoint authority. No matching lineage means
no inferred domain edit; several matching edges require resolving the ambiguity in the component
projection. Visible frame coincidence is not a source relationship.

## Expose authored parameters deliberately

Inspector editing deliberately has two declarations:

- `bindings` names exact author endpoints, including explicit reference paths
  into authored elements or SVS Recipes. A binding is not visible by itself;
- `inspector` selects bindings and gives them a `where`, `when` or
  `how` domain, an optional package-owned page, a section and one of Studio's
  finite controls (`text`, `number`, `boolean`, `select`, `color`, `list` or
  `record`). A domain Recipe may declare a shared canonical-value schema; the
  companion chooses its presentation while Studio derives and validates the
  finite structured control without learning domain syntax.

This keeps source traversal, timeline inverses and editor presentation from
silently becoming one policy. Studio resolves the declarations against the
current Source closure. Visible read-only bindings render as text alongside editable fields.
A projected entity can also supply `inspector` values with an `id`, `label`, `domain`, `section`
and `value`, such as its resolved interval. These facts need no Source endpoint.
Only resolved fields with an `edit` endpoint accept `parameter.adjust`. Studio renders all DOM
and CSS itself; grouping does not grant edit authority.

Fields can declare `number` display scaling, supported suffixes, limits and step; `unit` alone is
only a label. Select options can carry separate scalar values, labels, descriptions and color/font
preview hints. Text may be multiline; colors may offer package-chosen swatches. See
[Inspector presentation and conversion](../studio/INSPECTOR.md) for examples and ownership.

Structured controls keep a local draft and commit one complete canonical value.
Their codec is the author language (`@qflow/recipe` for Recipe values), not a
Companion callback. Companions cannot inject DOM, CSS, parsing code or filesystem
mutations. Official companions also use explicit field tables: an undeclared
new domain property fails Companion loading instead of inheriting UI from its name.

`referenced` follows declared authored-element references; `recipe` names an explicit path through
authored references to one SVS Recipe and its admitted properties. These paths are independent of
the `inspector` field table. Keep shared values shared: editing a Recipe affects its consumers, while
an entity-specific `parameterReferences` override must identify the actual authored value it uses.

Verify the integration in an ordinary Run: the intended Module/Surface matches, the expected entity
is selected, its field reaches the correct Source or Recipe, and changing it recomputes the preview.
For domain handles, verify the exact point/span identity and its other consumers too. Read-only derived timing
is preferable to an invented inverse. The Companion explains the component; its Producers remain
responsible for identical video behavior in Studio, seeking and encoded rendering.

Compact chrome uses `display.title` as its complete single-line content: a Cue can put its subtitle
text there and a Use can put its Style name there. It has no separate thumbnail/body region or
inline duration. Time remains in the tooltip and Companion-selected Inspector facts. Tone and lane
height are independent declarations; compact does not recognize Caption or Use names.

Choose lane tones explicitly. The `blue-muted`, `green-muted`, `magenta-muted`
and `orange-muted` palette entries provide quieter rows within the same color
family. For example, content and its presentation Uses can share a hue while
the Uses take the muted tone. Studio does not derive tone from attachment depth
or the entity name.

### Internal bands and child Tracks

A Track can place independently timed entities in internal `bands`. These strips share its label
and meet without gaps. Use them for aspects of the same content, such as a bottom strip of
presentation rules. Keep `attachments` for independently represented child objects with their own
labels, such as a ranking board's reveals. These declarations affect Studio presentation only.

```ts
{
  lane: { heightPx: 60 },
  bands: [{
    id: "rules",
    placement: "after",
    heightPx: 15,
    display: "label",
    bindings: [{ name: "style" }],
    inspector: [{
      binding: "style", label: "Style", domain: "how", control: "text",
      section: { id: "presentation", label: "Presentation" },
    }],
  }],
}
```

The projection puts `band: "rules"` on the corresponding entity drafts. Other entities remain in
the main content area. A band can be `before` or `after` that area; declarations retain their order
within each placement. `display: "label"` fills the strip with entity titles, while `"content"`
retains the entity's normal chrome and body. An optional `tone` selects another palette entry;
omission inherits the Track tone. Heights are independent, so a label band can match the 15px
standard item header.

An entity selects either an internal `band` or a child `lane`. Bands retain their own intervals,
overlap ordering, selection, Inspector declarations and temporal writeback. A rule spanning three
content blocks stays one entity; Studio does not split it at content boundaries. Band entities stay
in the Track's `clips` collection, so ordinary selection and editing use the same identities.

### Parameters owned by referenced objects

A consumer opts a reference into its owner's parameter Companion:

```ts
bindings: [{ name: "style", companion: true }]
```

The package that authors the referenced object contributes through
`createStudioCompanionFacet({ parameters: [...] })`:

```ts
{
  id: "slide",
  match: { module: myModule, surface: "slide" },
  bindings: [{ name: "distance", writable: true, fallback: 0.25 }],
  inspector: [{
    binding: "distance", label: "Travel", domain: "where",
    section: { id: "path", label: "Path" }, control: "number",
    unit: "%", number: { scale: 100 },
  }],
}
```

Studio resolves the actual reference and matches its Module/Surface. It prefixes this object's
bindings and fields under the consumer reference; the example becomes `style.distance`.
Nested `referenced` and `recipe` bindings use the same composition. The Use retains its own
Window and time gestures. Several Uses referencing one Style edit the same source object.
A project Style can therefore publish controls without replacing the Visual, Audio or
Caption Track Companion. No parameter Companion means the reference remains visible with only
its consumer-declared fields.

A source or Recipe binding may declare a typed `fallback`, or a function of the authored
properties for a dependent default. For example, an Audio Style's end gain follows its start gain until
authored explicitly. The field displays the fallback; the first edit inserts the attribute/property
in its owning SVML/SVS file. Source recompilation remains the owner of current values.
Only expose omitted defaults whose insertion preserves valid author semantics; geometry inputs
whose legality depends on a different Frame form can remain tied to the authored form.

Fields without `page` remain visible alongside the selected named page within Where, When or How.
Read-only and editable fields can share a section. Each package chooses a small useful field set.

### Edit related attributes together

A source binding can expose several scalar attributes as one `record` field:

```ts
{ name: "layout", writable: true, attributes: ["mode", "columns"],
  fallback: { mode: "flow" },
  schema: { kind: "oneOf", variants: [
    { kind: "object", fields: { mode: { schema: { kind: "literal", value: "flow" } } } },
    { kind: "object", fields: {
      mode: { schema: { kind: "literal", value: "grid" } },
      columns: { schema: { kind: "number", integer: true, minimum: 1 } },
    } },
  ] } }
```

The synthetic binding name is editor vocabulary; it creates no `layout` Source attribute.
The field's `control: "record"` saves a complete, valid value when editing ends. Object alternatives with a shared, distinct
literal field provide a mode selector; selecting one prepares that alternative's fields.
Incomplete values stay in the editor with a completion hint until the required fields are filled.
Only the declared attributes are replaced together. Omitted members are removed, while unrelated
attributes, references and child content survive. Existing references within the group remain
read-only. Domain validation still owns valid author values; existing transactions reject an
invalid edit without leaving invalid Source behind. Source grouping is available on direct and
referenced element bindings and stays data-only across the editor boundary.
