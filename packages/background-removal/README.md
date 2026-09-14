# @qflow/background-removal

Declares one external image capability: turn an input image into an image with its background removed.
Use it for a product, portrait or graphic that will be composited over another picture.

```xml
<import as="remove" from="@qflow/background-removal@1"/>
<remove:Background id="cutout" source={portrait.image}/>
```

`source` accepts an image BlobArtifact, including an ordinary image file declaration or a generated
image Output. `{cutout.image}` publishes one image BlobArtifact with transparency. Keep its actual
dimensions when placing it in Media Track, or use Image Compose when a flattened still is wanted.

The package declares the visual operation; a project Provider implements the capability
`@qflow/background-removal@1#remove-background`, accepting `{ source: BlobRef }` and returning one
image BlobRef with transparency. The Provider owns its service's request mapping and task lifecycle.
A service-specific author Model is unnecessary when the operation has this same meaning.

For a moving portrait, [Volcengine Matting](../volcengine-matting/README.md) provides
`<matte:Portrait source={performance.video}/>` through QflowHub. Normalize its processed video
before using it in a track.

This capability handles still images. Moving-person background removal requires a video-capable
operation and a result that preserves the changing silhouette and frame correspondence. Removing
one portrait's background does not remove the background of a subsequently generated performance.
