import { blobTypes } from "@qflow/qflow/blob";
import { sealGenerationMediaBinding, sealGenerationRequestDraft } from "@qflow/qflow/generation";
import type { GenerationMediaPort } from "@qflow/qflow/generation";
import { canonicalize } from "@qflow/qflow/protocol";
import type { StructuredSurfaceHandler } from "@qflow/qflow/markup";
import { createExactModelPrimaryGenerationFragment, exactModelMediaInputNames } from "@qflow/qflow/generation/model";
import { portraitMattingEndpoint as endpoint } from "./index.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export const decodePortraitMattingSurface: StructuredSurfaceHandler = ({ element, resolveReference }) => {
  const { id, source, format } = element.attributes;
  for (const name of Object.keys(element.attributes)) {
    assert(["id", "source", "format"].includes(name), `${element.name} does not accept ${name}`);
  }
  assert(typeof id === "string" && id.trim().length > 0, `${element.name} requires id`);
  assert(!element.children.some((item) => item.kind === "element" || item.value.trim()), `${element.name} must be empty`);
  assert(typeof source === "object" && source.kind === "reference", `${element.name}.source must be a video reference`);
  const resolved = resolveReference(source.path);
  assert(resolved !== undefined && resolved.type.name === blobTypes.blob.name
    && resolved.type.module.name === blobTypes.blob.module.name
    && resolved.type.module.version === blobTypes.blob.module.version, `${element.name}.source must be a Blob`);
  if (resolved.record !== undefined) {
    assert(resolved.record.value.kind === "blob" && resolved.record.value.mediaType.startsWith("video/"),
      `${element.name}.source must be video media`);
  }
  assert(format === undefined || typeof format === "string", `${element.name}.format must be literal`);
  const draft = sealGenerationRequestDraft(endpoint.ports, { format: [format ?? "WEBM"] });
  const binding = sealGenerationMediaBinding(endpoint.ports.ports.find((port) => port.name === "source")! as GenerationMediaPort,
    { role: "video" });
  const names = exactModelMediaInputNames("source");
  const fragment = createExactModelPrimaryGenerationFragment(endpoint, [{ name: "source", port: "source" }], []);
  return {
    records: [
      { id: `${id}.draft`, type: endpoint.draftType, value: { kind: "inline", value: canonicalize(draft) }, range: element.range },
      { id: `${id}.source-binding`, type: endpoint.mediaBindings.source!.type,
        value: { kind: "inline", value: canonicalize(binding) }, range: element.range },
    ],
    fragments: [fragment],
    components: [{ id, fragment: fragment.id, inputs: {
      draft: { kind: "record", id: `${id}.draft` },
      [names.binding]: { kind: "record", id: `${id}.source-binding` },
      [names.artifact]: resolved.ref,
    }, outputs: { video: `${id}.video` }, range: element.range }],
  };
};
