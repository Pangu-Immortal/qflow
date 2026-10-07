# `@qflow/media`

Author-facing media declarations for the neutral `@qflow/media` contract module.

`<media:Image>`, `<media:Audio>`, `<media:Video>` and `<media:Font>` request bytes through the Host-owned source-asset
capability. Image, Audio and Video emit one Resource-backed `Blob`; Font wraps the same immutable
bytes with exact weight/style metadata as a one-source `FontArtifactRef`. A logical font face may
also contain several exact Unicode-range sources when another package, such as
`@qflow/fontsource`, adapts a sharded installed font. `FontStackRef` is the generic ordered value
for one primary face followed by exact glyph fallbacks. Media declarations do not open files themselves,
inspect media, call a Provider or promote declared audio to speech. The consuming author package
decides whether an audio artifact is a voice reference, soundtrack, evidence source or something
else, whether a video is a generation reference or another input, and which visual component uses
an exact Font.

The same module owns the deliberately narrow `SynchronizedMedia` contract used after technical
normalization. It contains one common `frameRate`/`frameCount`, an optional visual Artifact with its
intrinsic pixel extent, and an optional audio Artifact. Source stream indexes, selection authority,
normalization ledgers and repeated codec/rate constants are not downstream media fields.

## Normalized media stays neutral

Normalization also publishes a complete `LocalTemporalDomain` and `TemporalExtent`. A Timeline may
use the Extent to determine its end, and a semantic projector may use the Domain with an equal-length
Window to publish absolute anchors. Neither operation changes the media's identity or wraps it in an
A-roll-specific value.

Visual and Audio Clips each accept the same ordinary `SynchronizedMedia` with an explicit
absolute Window. They independently select the stream they need. A media value is therefore equally
usable as foreground performance, B-roll, music, an effect or a model input; its earlier contribution
to Timeline construction is not observable downstream.

## Font files

`Font` takes an explicit source path and the selected face's real weight and style:

```svml
<media:Font id="caption-font" src="./assets/fonts/creator-bold.otf" weight="700" style="normal"/>
```

The source can be a project font, a user-supplied file, or an npm package resource such as
`package:@company/brand-fonts/files/brand.woff2`. The Host stages its bytes as an ordinary resource;
the render machine does not need that font installed.
Project-relative assets make the Source portable. The supported filename extensions are `.ttf`,
`.otf`, `.woff` and `.woff2`. The Surface has no selector for a face within a `.ttc`/`.otc` collection;
use the intended standalone face. Weight/style metadata describes that face, not a synthetic transform.

Caption Fine and Typography Styles can consume this value as their primary `font` or an explicit
Fallback face. `@qflow/fontsource` adapts only packages the project explicitly installs; Media
does not carry a font catalog or limit which package and project-owned files an author may supply.

A face split across Unicode ranges uses `Source` children. A stack is a separate, generic value:

```svml
<media:Font id="latin" src="package:@company/type/files/latin.woff2" weight="600" style="normal"/>
<media:Font id="han" weight="600" style="normal">
  <media:Source src="./assets/fonts/han-1.woff2" unicode-range="U+4E00-9FFF"/>
</media:Font>
<media:FontStack id="caption" primary={latin}>
  <media:Fallback font={han}/>
</media:FontStack>
```
