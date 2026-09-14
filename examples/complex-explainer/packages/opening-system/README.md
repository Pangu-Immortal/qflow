# Opening system

Project components and Performance Styles for an explanation-led video. They share the film's Timeline and Canvas but own independent visual behavior. Connect each `.track` to Film explicitly. They produce no audio.

- **Title**: opening clock and a two-level headline in a pink window card. Existing presenter footage continues beneath it at its original brightness. Its outer Window ends on the authored “开始” Moment in this production. `seconds` is the promise printed on the title, not the estimated duration of the film.
- **Timer**: a persistent topic plaque, pennant and dot-matrix timer. Its Window's first frame starts the countdown; zero is followed by coral overtime counting upward. `title`, `subtitle`, `seconds`, `flag-color`, `x`, `y`, `width`, `flag-amplitude`, `flag-speed`, `entrance-frames` and `z` are author choices. It does not infer pauses from speech or stop when a Take is absent.
- **Flag**: an independent low-angle pixel flag. It uses the same deterministic pixel texture treatment as Timer, with its own Window, placement, dimensions and color. No relationship to the opposition boards is inferred. The current Source places it below captions during the first-road explanation. `flag-amplitude` and `flag-speed` keep the folds slow and the logo readable.
- **Stage**: independent images or normalized videos in a clear foreground viewport, with the same material enlarged, blurred and dimmed behind it. Each Item has its own projected Window. Foreground and background share exact video sampling. An image is held during its Window. Later declared Items paint above earlier ones if they overlap. Empty intervals stay empty. `fit="contain"` preserves the supplied screenshot; `cover` fills and crops. `x`, `y`, `width`, `height` are fractions of Canvas dimensions. `blur` is specified at a reference width of 1080 and scales with Canvas width. `brightness`, `zoom`, `radius` and `z` finish the treatment.

The visual components accept the shared temporal Window forms: `during`, `at` plus `for`, `until` plus `for`, and `start`/`end` with semantic references. Stage Items use the same forms. The Surface projects those values; drawing code consumes the resolved Windows. Literal time is useful for a rapid montage, while the complete montage can follow a Segment end.

```svml
<import as="gfx" from="@explainer/opening-system@1"/>
<gfx:Title id="opening-title" timeline={program.timeline} canvas={canvas} font={display-font}
  start="program.start" end="moment.cue" moment={story.moment.begin}
  title="Qflow" subtitle="一分钟了解" seconds="60"/>
<gfx:Timer id="series-timer" timeline={program.timeline} canvas={canvas} font={display-font} logo={flag-logo}
  start="moment.cue" end="program.end" moment={story.moment.begin} title="Qflow"/>
<gfx:Stage id="coverage" timeline={program.timeline} canvas={canvas} during={story.selection.example}>
  <gfx:Item id="demo" video={prepared-demo.media} during={story.selection.example}/>
</gfx:Stage>
```

`video` accepts SynchronizedMedia after normalization, not a raw video Blob. `source-start-frame` optionally selects its starting source frame; native playback preserves source frame rate. A requested Window longer than the remaining video produces an actionable error rather than hidden looping. A Stage only contributes picture: include wanted audio separately.

The current 1.5-second four-image montage uses 5 / 4 / 5 / 31 frames at 30fps, boundaries 0 / 5 / 9 / 14 / 45. The supplied images live in the production's assets, not in this package. The exact font is also supplied by Source.

`src/activation.js` owns Manifest, Surface and finite graph wiring. `src/render.js` owns visuals and frame-seekable browser programs. The package uses Qflow's public authoring and domain APIs; it changes no framework, Studio or Core code. `src/studio.js` contributes the public Studio Companion facet. Defaults live once in `src/definition.js`, shared by Surface decoding and the Inspector. Title, Timer and Veil expose their own text, position and appearance choices. Stage has a parent for shared framing and slow-push settings, with independently timed media Items in its attached lane. Pullback, PortraitInset and Reframe expose the referenced Style/Frame parameters through Performance Uses. The Inspector uses Studio’s standard controls and writes existing author attributes; no Studio or Core component dispatch is added.

The actual montage and semantic title/timer bindings live in `authors/main.svml`. Earlier component studies are archived privately.

The pennant and floor flag use a small Canvas raster with stepped diagonal folds and discrete shaded bands. `src/flag-cloth.js` retains its filename, but the current renderer uses no 3D engine or cloth simulation. Frame time determines the low-cadence movement, and nearest-neighbor scaling preserves the pixels. The supplied logo remains readable; amplitude and speed are author choices. The pennant paints in front of its backplate. Brand artwork is supplied by Source.

The current Title uses the shared pink window treatment described below; earlier luminous corner studies remain historical outputs.

Stage `push-rate` is the foreground scale increase per second, default zero. For example, `push-rate="0.025"` increases scale by 2.5% per second while the viewport stays fixed. Each Item starts at native scale; its own original Window determines animation age even when the Stage clips that Window. The production enables this on the four-image montage; short flashes therefore move slightly, while a longer hold develops a visible slow push.


## Texture Veil

`gfx:Veil` contributes an independent patterned overlay. Source places it above the background picture and below the text, diagram, presenter window and chrome it wants to keep clear. It neither reads sibling tracks nor edits their media. Use the shared temporal attributes, `timeline`, `canvas`, and `z` (default 20). It needs no font or asset.

`pattern` selects `mesh`, `dots`, or `hatch`; `cell` sets motif size at 1080px Canvas width; `amount` sets motif opacity. `tint` and `shade` describe the translucent color wash independently. `fade-frames` shapes its short entrance/exit; zero gives an immediate boundary. The pattern remains stationary during the hold. The defaults are a starting treatment, not a requirement to apply the overlay to every picture.

Earlier texture studies are retained in private production history. The active Source shows the selected treatment.

### Opening pullback as a Performance Use

`<gfx:Pullback id="opening-pullback" scale="1.5"/>` defines a project-owned Performance Style. Apply it with `<performance:Use start="0f" end="1s" style={opening-pullback}/>` after the broad full-frame Use. Its original Use Window drives a quartic ease-out from 1.5× to 1×, centered at 50%/35%; Timeline footage keeps its source clock. At the end it meets ordinary full-frame geometry. Titles and other contributions stay independent. This changes framing, not playback speed or generated material.

## Portrait inset
`<gfx:PortraitInset id="host-small" frame={host-inset}/>` is a project Performance Style for a circular presenter viewport with a closer inner crop. It uses Timeline media/source spans, clips each interval, and presents the current visual source at its placed playback time. The external Frame controls position and size; this work uses 330px. An inner 1.23× magnification, anchored at 50%/28%, increases face presence independently from viewport size. Its vivid-pink rim, dark outline and solid offset shadow match the supplied pink interface reference. This is independent from full-frame and Reframe Uses.

The spoken opening Title is currently a pale-pink window card with a dark outline, a vivid-pink headline and a solid lower-right shadow. Timer plaque/readout follow the same palette while preserving the animated pixel flag and existing time behavior.

`performance-media.js` owns prepared Timeline media projection and sampling shared by Pullback, Reframe and PortraitInset. The private `@explainer/visual-language` dependency owns the current pink palette; each Style owns its framing behavior.
