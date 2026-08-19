import { narrativeDependency, narrativeTypes } from "@qflow/narrative";
import { speechDependency, speechTypes } from "@qflow/speech";
import { speechEvidenceDependency, speechEvidenceTypes } from "@qflow/speech-evidence";
import { semanticMapDependency, semanticMapTypes } from "@qflow/semantic-map";
import type { ModuleManifest, ProducerRef } from "@qflow/protocol";

export const speechAlignmentModuleRef = { name: "@qflow/speech-alignment", version: "1" } as const;
export const speechAlignmentProducers = {
  locate: { module: speechAlignmentModuleRef, name: "locate-speech" },
} satisfies Record<string, ProducerRef>;

export const speechAlignmentManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: speechAlignmentModuleRef.name,
  version: speechAlignmentModuleRef.version,
  dependencies: [
    narrativeDependency,
    speechDependency,
    speechEvidenceDependency,
    semanticMapDependency,
  ],
  types: [],
  capabilities: [],
  producers: [{
    name: speechAlignmentProducers.locate.name,
    inputs: [
      { name: "narrative", type: narrativeTypes.narrative },
      { name: "audio", type: speechTypes.audioBasis },
      { name: "evidence", type: speechEvidenceTypes.alignedTranscript },
    ],
    outputs: [{ name: "map", type: semanticMapTypes.complete }],
    needs: [],
  }],
};
