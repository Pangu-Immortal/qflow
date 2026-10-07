import assert from "node:assert/strict";
import test from "node:test";
import { fixtureResource } from "../../../test/fixture-resource.js";

import {
  assertImageComposeRequest,
  assertImageTransformRequest,
  imageComposeRequest,
  imageComposeSources,
  imageOperationsCapabilities,
  imageTransformOutputMediaType,
  imageTransformRequest,
} from "@qflow/image-operations";

const image = {
  kind: "blob" as const,
  resource: fixtureResource("image-operations-source"),
  size: 12,
  mediaType: "image/png",
};

test("Transform and Compose are separate capabilities in one Image Operations module", () => {
  const transform = imageTransformRequest(image, [{ kind: "encode", format: "webp", quality: 90 }]);
  const compose = imageComposeRequest({
    canvas: { widthPx: 100, heightPx: 200 },
    background: "#00000000",
    layers: [{
      source: image,
      frame: { xPx: 0, yPx: 0, widthPx: 100, heightPx: 200 },
      fit: "contain", interpolation: "lanczos", opacity: 1,
    }],
  });
  assert.equal(imageOperationsCapabilities.transform.name, "transform-image");
  assert.equal(imageOperationsCapabilities.compose.name, "compose-image");
  assert.equal(imageTransformOutputMediaType(transform), "image/webp");
  assert.deepEqual(imageComposeSources(compose), [image]);
});

test("each capability validates only the request meaning it promises", () => {
  assert.throws(() => assertImageTransformRequest({ canvas: {} } as never), /source/u);
  assert.throws(() => assertImageComposeRequest({ source: image } as never), /Canvas|canvas/u);
});
