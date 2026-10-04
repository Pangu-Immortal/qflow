# Construct the program Timeline

Read this when deciding complete duration, placing unknown-length prepared media, or sharing absolute
Instants and Windows. [Media preparation](media.md) produces neutral local domains and Extents;
[timing](timing.md) explains absolute values and semantic projection; [Visual](visual-clips.md)
and [Audio](audio-clips.md) explain presentation.

The production Timeline is a small absolute value: identity, frame rate and finite frame count. It
contains no Takes, media, words, anchor registry or Tracks. Its author declaration is a small acyclic
Instant/Window construction graph with one required `end`.

```svml
<import as="time" from="@qflow/timeline-author@1"/>
<time:Clock id="clock" frame-rate="30"/>
<time:Timeline id="program" clock={clock}
  end="latest(answer.end,outro.end)">
  <time:Window id="opening" from="start" for={opening-media.extent}/>
  <time:Window id="answer" from="opening.end" for={answer-media.extent}/>
  <time:Instant id="claim" at="answer.end-12f"/>
  <time:Window id="outro" from="claim" for="3s"/>
</time:Timeline>
```

Every named declaration is naturally published: `program.opening` is a Window,
`program.opening.start` and `.end` are its boundary Instants, and `program.claim` is an Instant.
`program.window`, `.start` and `.end` describe the complete Timeline. There is no `export` attribute
and no nested Place declaration.

A Window supplies exactly two of `from`, `until` and `for`. `for` accepts an exact `f`, `ms` or `s`
duration, or a typed Extent such as `opening-media.extent`. Point expressions may use `start`, the
resolved `end`, literal positions, named Instants, a named Window's `.start`/`.end`, exact `+`/`-`
literal offsets, `earliest(...)` and `latest(...)`.

Forward references are valid because dependencies, not source order, determine evaluation. A final
Window may depend on `end`; if `end` also depends on that Window, the real graph cycle is rejected.
Unknown references, values outside the final range, empty Windows and a non-positive end are errors.

The graph may have several roots, branches and leaves. It needs no single content root or last clip.
Use `latest(...)` when several branches can determine final extent. A pure animation can be:

```svml
<time:Timeline id="animation" clock={clock} end="30s"/>
```

## Unknown material length is an ordinary dependency

Generated speech or video need not reveal its length while Source is written. Normalization later
publishes a finite `TemporalExtent`; a Window consumes it, and dependent boundaries wait through
ordinary graph evaluation. No phase state machine, callback or second Source run is needed. If a
generation request depends on Timeline end while that same end depends on the generated result, the
author has created a real cycle and should change that relationship.

After Timeline finalization, a domain projector may combine one complete local domain with one
equal-length Window. This is exact native-speed translation, consumed immediately by that projector;
it does not produce a durable Placement value. Trim, retime, loop, hold, frame-rate conversion and
piecewise speed belong to explicit material preparation or medium-specific sampling, not implicit
Timeline arithmetic.

## Keep meaning, media and presentation separate

A `NarrativeAlignment` says where one Segment's boundaries lie on a local domain. A semantic
Projection combines explicit `NarrativeAlignment + local domain + equal-length Window` relations to
locate Script Selections and Moments on this Timeline. Once the absolute values are published, that
construction relation disappears. Visual and Audio receive ordinary normalized media plus explicit
absolute Windows:

```text
NarrativeAlignment + LocalDomain + Window -> absolute Instants/Windows
SynchronizedMedia + Window                -> visual / audio occurrence
Timeline                                  -> finite absolute range only
```

Replaying media creates another media occurrence; it does not silently duplicate one semantic event.
If the same words genuinely occur twice, author distinct Script identities. Musical beats, subtitle
timing and future domains may build peer projection adapters without adding event kinds to Timeline.

Put a shared Instant or Window in Timeline when it determines extent or several consumers deliberately
reuse it. Write a one-off component time directly on that component. This prevents Timeline from
becoming a central schedule of every clip and effect.

The project document `TIMELINE.md` remains the production team's human record of reference evidence
and creative meaning; it is not the runtime Timeline value. Reference timestamps describe observed
material, while the Source declaration constructs the new work.
