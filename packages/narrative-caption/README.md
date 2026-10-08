# Narrative Caption

`@qflow/narrative-caption` is the explicit adapter between source-neutral Caption content and
Narrative time. It owns `NarrativeCaptionBinding` and projects that relation through one explicit
`NarrativeProjection` to complete, flat, absolute `CaptionTiming`. Binding joins by Unit and Token
identities rather than array position. Missing Units, Tokens or Boundaries fail with their complete
identity path; the adapter never drops content, pads a zero interval, shortens overlaps or forms Cues.

Script may emit a CaptionDocument and its binding from the same parse; the author does not repeat
display text or unit-to-Token correspondence. Caption renderers consume only CaptionDocument and
CaptionTiming and therefore do not depend on Narrative or speech.

```svml
<narrative-caption:Timing id="story-captions"
  document={story.caption}
  binding={story.caption-binding}
  projection={speech}/>
```
