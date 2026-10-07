# @qflow/html-video

`@qflow/html-video` is the author-facing video assembly that selects Qflow's HTML
visual path:

```xml
<html:Video id="video" composition="main" />
```

The package contributes only the `html` author Surface and its orchestration
Fragment. It:

1. compiles the selected Composition and Timeline with `@qflow/html-program`;
2. requests a `TimelineVisual` through `rasterize-visual`;
3. prepares Timeline audio through the media path;
4. muxes the two frame-exact products into the Film artifact.

It does not own the `HtmlProgram` ABI, browser execution, frame capture, source
decoding, or the rasterization Capabilities. Consequently a local Provider,
Studio snapshot, or another executor never depends on this author package.

The name describes the selected representation and product assembly, not an
implementation command. There is intentionally no `<render:Video>` compatibility
alias: `render` confuses the desired video with one possible execution method.
