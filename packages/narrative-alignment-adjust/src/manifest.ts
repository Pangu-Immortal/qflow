import { narrativeDependency } from "@qflow/narrative";
import type { ModuleManifest, ProducerRef, TypeRef } from "@qflow/protocol";
import { narrativeTemporalDependency, narrativeTemporalTypes } from "@qflow/narrative-temporal";
import { temporalDependency, temporalTypes } from "@qflow/temporal";

export const narrativeAlignmentAdjustModuleRef = { name: "@qflow/narrative-alignment-adjust", version: "1" } as const;

export const narrativeAlignmentAdjustTypes = {
  plan: { module: narrativeAlignmentAdjustModuleRef, name: "NarrativeAlignmentAdjustmentPlan" },
} satisfies Record<string, TypeRef>;

export const narrativeAlignmentAdjustProducers = {
  adjust: { module: narrativeAlignmentAdjustModuleRef, name: "adjust-narrative-alignment" },
} satisfies Record<string, ProducerRef>;

export const narrativeAlignmentAdjustMarkupSurfaces = [{
  name: "narrative-alignment",
  tag: "NarrativeAlignment",
  mode: "structured",
  outputs: [narrativeAlignmentAdjustTypes.plan, narrativeTemporalTypes.narrativeAlignment],
  vocabulary: {
    summary: "Applies explicit author corrections to measured NarrativeAlignment boundary frames.",
    attributes: [
      { name: "id", kind: "identifier", required: true,
        summary: "Names the corrected alignment." },
      { name: "source", kind: "reference", required: true, accepts: [narrativeTemporalTypes.narrativeAlignment],
        summary: "Selects the measured NarrativeAlignment being corrected." },
      { name: "domain", kind: "reference", required: true, accepts: [temporalTypes.localDomain],
        summary: "Selects the source-local domain that bounds the corrected frames." },
    ],
    ports: [{ name: "alignment", type: narrativeTemporalTypes.narrativeAlignment,
      summary: "The corrected NarrativeAlignment, addressed as `<id>.alignment`." }],
    example: `<adjust:NarrativeAlignment id="opening-corrected" source={opening.alignment} domain={opening.domain}>
  <adjust:Boundary at={story.moment.answer} frame="63"/>
</adjust:NarrativeAlignment>`,
    notes: [
      "Each Boundary names an author-declared Script Moment and gives its exact source-local frame.",
      "This is an explicit correction layer over measured evidence; it does not guess timing or modify media.",
      "Segment and Token records refer to canonical boundaries, so no duplicate coordinates need synchronizing.",
    ],
  },
}] as const;

export const narrativeAlignmentAdjustManifest: ModuleManifest = {
  format: "qflow.module@1",
  name: narrativeAlignmentAdjustModuleRef.name,
  version: narrativeAlignmentAdjustModuleRef.version,
  dependencies: [narrativeDependency, narrativeTemporalDependency, temporalDependency],
  types: [{ name: narrativeAlignmentAdjustTypes.plan.name }],
  capabilities: [],
  producers: [{
    name: narrativeAlignmentAdjustProducers.adjust.name,
    inputs: [
      { name: "source", type: narrativeTemporalTypes.narrativeAlignment },
      { name: "domain", type: temporalTypes.localDomain },
      { name: "plan", type: narrativeAlignmentAdjustTypes.plan },
    ],
    outputs: [{ name: "alignment", type: narrativeTemporalTypes.narrativeAlignment }],
    needs: [],
  }],
};
