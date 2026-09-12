# Project-authored Performance Styles

This package demonstrates two ordinary project families: a viewport moving between Frames and a
crossfade between explicitly selected Segments. Both export the common PerformanceStyle, so they
work alongside the ordinary fixed Style inside one Performance Track.

```svml
<import as="performance" from="@qflow/performance@1"/>
<import as="styles" from="@example/performance-styles@1"/>
<performance:Style id="full" frame={layout.full} appearance={recipes.media.presenter}/>
<performance:Style id="side" frame={layout.side} appearance={recipes.media.presenter}/>
<styles:Move id="full-to-side" from={layout.full} to={layout.side}/>
<styles:Crossfade id="mix" outgoing={story.segment.previous}
  incoming={story.segment.next} frame={layout.side}/>
<performance:Track id="presenter" timeline={program.timeline} canvas={canvas}>
  <performance:Use style={full}/>
  <performance:Use moment={story.moment.explain}
    start="moment.cue" end="program.end" style={side}/>
  <performance:Use at={story.moment.explain} for="2s" style={full-to-side}/>
  <performance:Use start-source={story.segment.next} start="segment.start"
    end-source={story.segment.previous} end="segment.end" style={mix}/>
</performance:Track>
```

The two-second movement overrides the beginning of the already declared side treatment. Changing
its duration requires no reference to a Use id. Shared endpoint Frames keep the fixed and moving
layouts aligned. All timing belongs to Uses; each Style is independently reusable.

Crossfade requires known outgoing/incoming Segment identities. A known audio-only source supplies
transparent picture, giving a fade in or out; an unknown reference reports the actual error. This
example uses isolated additive blending of weighted pictures. `projectTimelineMedia` preserves the
original source positions; animation progress comes from the original Use Window.

Read `activation.ts` for the complete author Surface, bound fragment and Producer wiring, and
`render.ts` for the browser program. A project can add its own parameters or additional events without
changing Performance. Compile with `npm run build`; install the package in the video project's
ordinary package dependencies. The rendering test exercises these same functions with actual video.

The package also includes `src/studio.ts`. Move exposes its `from` and `to` Frame coordinates;
Crossfade exposes its Frame and read-only source references. These parameter Companions match the
project's own Style Surfaces and are composed into any consuming Performance Use. The Track
Companion and Studio require no knowledge of these Style names.
