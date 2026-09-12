# `@qflow/timeline-author`

Declare one complete Timeline and place prepared Takes within it. Spoken work, mixed spoken/MG
work and pure authored animation use the same declaration. The separate
[Timeline value package](../timeline/README.md) owns the data and projections; this author package
owns the markup and deterministic assembly.

```svml
<import as="time" from="@qflow/timeline-author@1"/>
<time:Clock id="clock" frame-rate="30"/>
<time:Timeline id="program" clock={clock} end="content.end+2s">
  <time:Take source={opening.take} at="2s"/>
  <time:Take source={explanation.take} at="previous.end+3s"/>
  <time:Take source={closing.take} at="previous.end-12f"/>
</time:Timeline>
```

The first Take begins at two seconds. The second starts three seconds after the preceding Take ends.
The third overlaps its predecessor by twelve frames. The complete Timeline ends two seconds after
all Takes have ended. Durations come from prepared material, so authoring these relations does not
require knowing generated lengths beforehand or serializing generation.

| Declaration | Meaning |
| --- | --- |
| `clock={clock}` | Required frame-rate input, also usable by upstream normalization. |
| Take `source={clip.take}` | Complete normalized, semantically prepared local Take. A wordless Take is valid real media. |
| First omitted `at` | `0f`. |
| Later omitted `at` | `previous.end`. |
| `at="20s"` | Absolute start. |
| `at="previous.end+2s"` | Start relative to the preceding Take declaration's end. Negative offsets permit overlap. |
| Omitted `end` | `content.end`, the maximum end across all placed Takes. |
| `end="content.end+2s"` | Reserve a trailing interval after all Takes finish. |
| `end="30s"` | Fixed complete extent, including every placed Take. |

Positions and offsets accept seconds, milliseconds and frames, and must resolve to exact frame
boundaries on the Clock. Negative placements, a missing predecessor, or a fixed end shorter than
placed content produce an error. A positive predecessor offset does not promise globally empty
time if another long Take remains active. Placement is translation at native speed; trimming or
retiming material belongs before its semantic preparation.

For ordinary sequential assembly, omit all Take `at` attributes and Timeline `end`. For wholly
authored animation, supply the extent and no Takes:

```svml
<time:Timeline id="animation" clock={clock} end="30s"/>
```

This produces no blank video or fabricated Script. Empty content cannot supply an implicit positive
extent. Program boundaries remain available for MG, media, titles and sound.

| Output | Use |
| --- | --- |
| `.timeline` | Complete time range and placed material/evidence, consumed through `timeline={program.timeline}`. |

[Performance](../performance/README.md) presents footage already
held by the Timeline. It can show it full-frame, in an inset or as a cutout; project components can
own coordinated video and graphics. Sampling a new presentation Window preserves each Take's source
position. Overlap supplies multiple sources, not an automatic dissolve. Independent Media Items
still receive their own assets and may coexist. Caption reads the authored words and placed timing.

[Sound](../sound/README.md) presents existing Timeline audio through ordered Uses.
[Audio Track](../audio-track/README.md) handles independent music and effects. Include the wanted
presentation outputs explicitly in Film. Timeline itself exports only `.timeline`; holding material
does not add a picture or sound contribution.

Timeline placement is authored with `at` and `end`. Studio shows placed Takes and the complete range
as reference information. Use-window and Script-marker controls edit presentation timing and semantic
anchors respectively; they do not move Takes or change the Timeline extent.
