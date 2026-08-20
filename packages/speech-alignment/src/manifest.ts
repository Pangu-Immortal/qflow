import { mediaDependency, mediaTypes } from "@qflow/media";
import { narrativeDependency, narrativeTypes } from "@qflow/narrative";
import { speechDependency, speechTypes } from "@qflow/speech";
import { speechEvidenceDependency, speechEvidenceTypes } from "@qflow/speech-evidence";
import type { ModuleManifest, ProducerRef } from "@qflow/protocol";

export const speechAlignmentModuleRef = { name: "@qflow/speech-alignment", version: "1" } as const;
export const speechAlignmentProducers = {
  alignTake: { module: speechAlignmentModuleRef, name: "align-semantic-take" },
} satisfies Record<string, ProducerRef>;

export const speechAlignmentManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: speechAlignmentModuleRef.name,
  version: speechAlignmentModuleRef.version,
  dependencies: [
    mediaDependency,
    narrativeDependency,
    speechDependency,
    speechEvidenceDependency,
  ],
  types: [],
  capabilities: [],
  producers: [
    {
      name: speechAlignmentProducers.alignTake.name,
      inputs: [
        { name: "narrative", type: narrativeTypes.narrative },
        { name: "segment", type: narrativeTypes.excerpt },
        { name: "media", type: mediaTypes.synchronized },
        { name: "evidence", type: speechEvidenceTypes.alignedTranscript },
      ],
      outputs: [{ name: "take", type: speechTypes.semanticTake }],
      needs: [],
    },
  ],
};
