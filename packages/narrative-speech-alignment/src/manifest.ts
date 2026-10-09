import { narrativeDependency, narrativeTypes } from "@qflow/narrative";
import { narrativeTemporalDependency, narrativeTemporalTypes } from "@qflow/narrative-temporal";
import { speechEvidenceDependency, speechEvidenceTypes } from "@qflow/speech-evidence";
import { temporalDependency, temporalTypes } from "@qflow/temporal";
import type { ModuleManifest, ProducerRef } from "@qflow/qflow/protocol";

export const speechAlignmentModuleRef = { name: "@qflow/narrative-speech-alignment", version: "1" } as const;
export const speechAlignmentProducers = {
  alignNarrative: { module: speechAlignmentModuleRef, name: "align-narrative" },
} satisfies Record<string, ProducerRef>;

export const speechAlignmentManifest: ModuleManifest = {
  format: "qflow.module@1", name: speechAlignmentModuleRef.name, version: speechAlignmentModuleRef.version,
  dependencies: [narrativeDependency, narrativeTemporalDependency, speechEvidenceDependency, temporalDependency],
  types: [], capabilities: [], producers: [{
    name: speechAlignmentProducers.alignNarrative.name,
    inputs: [{ name: "narrative", type: narrativeTypes.narrative }, { name: "segment", type: narrativeTypes.segmentRef },
      { name: "domain", type: temporalTypes.localDomain },
      { name: "evidence", type: speechEvidenceTypes.alignedTranscript }],
    outputs: [{ name: "alignment", type: narrativeTemporalTypes.narrativeAlignment }],
    needs: [],
  }],
};
export const speechAlignmentDependency = { module: speechAlignmentModuleRef } as const;
