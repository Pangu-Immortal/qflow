# `@qflow/seedance`

Exact Seedance author model module. It owns the request schema and exactly three invocation Surfaces;
it does not contain service credentials, HTTP code, queues, runtime routing or usage-specific Prompt assembly.

The three model invocation shapes are deliberately separate:

- `TextVideo`: Prompt only; this is the only shape that exposes Web Search.
- `FrameVideo`: required first frame and optional last frame.
- `ReferenceVideo`: one or more image, video or audio references within the model's port limits.

All three preserve the remote result as one atomic `GeneratedVideoSet`, then expose its first ordered
member as an ordinary `BlobArtifact`. Their prompt ports consume ordinary `Text`, so a Script projection,
generic Text Template or third-party author module can feed them without becoming part of Seedance.

`standard`, `fast`, `mini` and `2.5` select model variants independently of the invocation shape. Duration is
the author's literal, in whole seconds inside the model's declared range; measure the spoken line first
with `qflow measure` and write the number here. Nothing in the graph computes it, so a Build plan is
complete before it starts.

## Visual reference metadata

Declare whether each image or video contains a person/avatar reference, including an AI-generated
human likeness. This describes the supplied material, independently of the prompt's requested action:

```xml
<seedance:ReferenceVideo id="dance" model="mini" prompt={direction} duration="8">
  <seedance:Reference image={presenter.image} person-reference="true"/>
  <seedance:Reference video={motion.video} person-reference="true"/>
  <seedance:Reference image={room.image} person-reference="false"/>
</seedance:ReferenceVideo>
```

`person-reference` is optional, accepts literal `true` or `false`, and applies to image/video, not
voice audio. Omission carries no classification; it is distinct from explicitly declaring false.
Inspect the actual reference when deciding the value. For `FrameVideo`, use
`first-frame-person-reference` and `last-frame-person-reference` beside their respective frame
inputs. A last-frame classification requires a last-frame input.

The model's media ports carry this as `fields.personReference`. Providers interpret it through their
service's media handling; it is not a prompt sentence or a Core-level identity. QflowHub sends it as
`is_person_reference` when uploading the file, then uses the returned URL in the ordinary video
request. A project Provider maps it according to its own API.

Video references can carry motion or camera behavior while image references carry the target
appearance. Request duration and reference-clip duration are different limits. Check the selected
Endpoint's reference duration and media limits when choosing an excerpt; the author's output duration
alone does not validate the input clip.
