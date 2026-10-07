import { narrativeTypes } from "@qflow/qflow/narrative";
import { narrativeTemporalProducers, narrativeTemporalTypes } from "@qflow/qflow/narrative-temporal";
import { mediaTypes } from "@qflow/qflow/media";
import { sealGraphFragment } from "@qflow/qflow/author";
import { speechEvidenceProducers } from "@qflow/qflow/speech-evidence";
import { speechAlignmentProducers } from "@qflow/narrative-speech-alignment";
import { temporalTypes } from "@qflow/qflow/temporal";

import { whisperXProducers, whisperXTypes } from "./manifest.js";

const input = (name: string) => ({ kind: "fragment-input" as const, name });
const operation = (id: string) => ({ kind: "fragment-operation" as const, operation: id });

export const whisperXAlignmentFragment = sealGraphFragment({
  inputs: [{ name: "narrative", type: narrativeTypes.narrative }, { name: "segment", type: narrativeTypes.segmentRef },
    { name: "media", type: mediaTypes.synchronized }, { name: "domain", type: temporalTypes.localDomain },
    { name: "language", type: whisperXTypes.language }],
  operations: [
    { id: "prepare-evidence-audio", producer: speechEvidenceProducers.projectAudio,
      inputs: { media: input("media"), domain: input("domain") }, result: { kind: "need", name: "evidenceAudio" } },
    { id: "request-whisperx", producer: whisperXProducers.request,
      inputs: { evidence: operation("prepare-evidence-audio"), language: input("language") }, result: { kind: "need", name: "alignment" } },
    { id: "align-narrative", producer: speechAlignmentProducers.alignNarrative,
      inputs: { narrative: input("narrative"), segment: input("segment"),
        domain: input("domain"), evidence: operation("request-whisperx") },
      result: { kind: "output", name: "alignment" } },
  ],
  exports: [{ name: "alignment", type: narrativeTemporalTypes.narrativeAlignment, root: operation("align-narrative") }],
});

export const whisperXBoundaryAlignmentFragment = sealGraphFragment({
  inputs: [{ name: "narrative", type: narrativeTypes.narrative }, { name: "segment", type: narrativeTypes.segmentRef },
    { name: "domain", type: temporalTypes.localDomain }],
  operations: [
    { id: "materialize-boundaries", producer: narrativeTemporalProducers.materializeSegmentBoundaries,
      inputs: { narrative: input("narrative"), segment: input("segment"), domain: input("domain") },
      result: { kind: "output", name: "alignment" } },
  ],
  exports: [{ name: "alignment", type: narrativeTemporalTypes.narrativeAlignment, root: operation("materialize-boundaries") }],
});
