# Project sound Style: explicit crossfade

This ordinary project package demonstrates `soundStyle(fragment, bindings)`. It publishes one
`Crossfade` Style with explicit outgoing and incoming Segment inputs. It uses public
`@qflow/qflow/*` imports and returns ordinary AudioTrack data. Copy it into a video's `packages/`,
select the installed Qflow version as its development dependency, build it and declare it in the
project's ordinary package configuration.

```svml
<import as="sound" from="@qflow/sound@1"/>
<import as="mix" from="@example/sound-styles@1"/>
<sound:Style id="normal"/>
<mix:Crossfade id="handoff"
  outgoing={story.segment.first} incoming={story.segment.second}/>
<sound:Track id="voice" timeline={program.timeline}>
  <sound:Use style={normal}/>
  <sound:Use style={handoff}
    start-source={story.segment.second} start="segment.start"
    end-source={story.segment.first} end="segment.end"/>
</sound:Track>
```

The Window describes an actual overlap, even though its endpoints are reversed in Script order.
The two Style inputs declare roles; temporal endpoints do not infer them. Outgoing gain decreases
from 1 to 0 and incoming gain increases from 0 to 1 across that Window. Playback stays at each
Take's existing source position. A known source with no audio contributes nothing; an unknown source
is an error. Both roles must name distinct Segments.

Linear crossfade is this family's chosen behavior, not a universal acoustic rule. A different
project family can use another envelope or more sources without changing Timeline or the renderer.
For intentional simultaneous speech, a family can return both explicit `sourceSound` results at
unity gain. Independently included Sound Tracks can also coexist.

The implementation is in [render.ts](src/render.ts); [activation.ts](src/activation.ts) declares the
Surface, typed inputs, fragment and Producer. Build with `pnpm --filter @example/sound-styles build`
inside this repository after public declarations are available.
