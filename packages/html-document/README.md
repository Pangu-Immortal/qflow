# @qflow/html-document

Build a browser-playable document from a Composition and Timeline:

```xml
<import as="page" from="@qflow/html-document@1"/>
<page:Document id="preview" composition={main.composition} timeline={animation.timeline}/>
```

Select the document in the Run:

```xml
<?svml using="@qflow/markup/run@1"?>
<svrun version="1">
  <author source="./main.svml"/>
  <target output="preview.document"/>
</svrun>
```

The `HtmlDocument` result contains a compiled `HtmlProgram` and its audio plan.
The Result repository preserves referenced fonts, images, video and audio using
ordinary resource bindings. Upstream material requirements are handled by the Run.

Hosts turn the result into HTML by supplying material URLs:

```ts
import { materializeHtmlDocument } from "@qflow/html-document";

const html = materializeHtmlDocument(document, artifact => materialUrl(artifact), {
  autoplay: true,
  loop: true,
  muted: true,
  responsive: true,
});
```

The URL resolver can return relative paths, HTTP URLs or data URLs. It must
provide every resource referenced by the document. Autoplay, looping, muting
and responsive canvas sizing default to `true`.

The generated page displays the composition inside the iframe's viewport:

```html
<iframe title="Preview" src="./preview.html"></iframe>
```

Hosts can also assign the generated HTML to `iframe.srcdoc`. The host page
provides any playback controls and uses the document's JavaScript API.

The page exposes `window.__qflowDocument` with `ready`, `play()`, `pause()`,
`seekFrame(frame)`, `setMuted(value)`, and read-only `frame` and `playing` values.
`ready` resolves when the initial frame and its materials are prepared.
Frame indices are integers in `[0, document.program.frameCount)`.
Audible playback follows the browser's user-activation policy.

An embedding parent can send playback commands through `postMessage`:

```ts
iframe.contentWindow.postMessage({
  type: "qflow.html-document.command@1",
  action: "seek",
  frame: 90,
}, "*");
```

Actions are `play`, `pause`, `seek` with `frame`, `mute` with `muted`, and `state`.
The document accepts commands from its embedding parent and serializes them.
It sends `qflow.html-document.state@1` messages containing `frame`, `frameCount`,
`frameRate` and `playing`, at up to ten updates per second during playback and
immediately after state changes. Command errors use `qflow.html-document.error@1`.
The parent checks that `event.source === iframe.contentWindow` before using a message.
