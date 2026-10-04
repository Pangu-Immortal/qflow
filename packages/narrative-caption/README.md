# Narrative Caption

`@qflow/narrative-caption` is the explicit adapter between source-neutral Caption content and
Narrative time. It owns `NarrativeCaptionBinding` and projects that relation through one explicit
`NarrativeProjection` to ordinary absolute `CaptionTiming`.

Script may emit a CaptionDocument and its binding from the same parse; the author does not repeat
display text or unit-to-Token correspondence. Caption renderers consume only CaptionDocument and
CaptionTiming and therefore do not depend on Narrative or speech.

```svml
<narrative-caption:Timing id="story-captions"
  document={story.caption}
  binding={story.caption-binding}
  projection={speech.projection}/>
```
