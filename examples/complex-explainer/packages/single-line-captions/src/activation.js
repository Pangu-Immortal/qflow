import { captionFineStudioTrackCompanions } from "@qflow/caption-fine-studio";
import { createStudioTrackCompanionHostFacet } from "@qflow/qflow/studio-adapter";
import {
  createMarkupSurfaceHostFacet,
  sealGraphFragment,
  canonicalize,
} from "@qflow/qflow/author-kit";
import {
  captionFineManifest,
  captionFineModuleRef,
  captionFineProducers,
  captionFineMarkupSurfaces,
  decodeFineCaptionTrackSurface,
  scheduleFineCaption,
  assertFineCaptionSchedule,
} from "@qflow/caption-fine";
const module = { name: "@explainer/single-line-captions", version: "1" },
  producer = { module, name: "schedule" };
const manifest = {
  format: "qflow.module@1",
  ...module,
  dependencies: [
    ...captionFineManifest.dependencies,
    { module: captionFineModuleRef },
  ],
  types: [],
  capabilities: [],
  producers: [
    {
      ...captionFineManifest.producers.find(
        (p) => p.name === captionFineProducers.schedule.name,
      ),
      name: producer.name,
    },
  ],
};
const inline = (r) => r.value.value;
export function singleLineSchedule(caption, program, document) {
  const schedule = scheduleFineCaption(caption, program, document);
  const cues = [...schedule.cues].sort(
    (a, b) => a.visibleStartFrame - b.visibleStartFrame,
  );
  // This production has one shared subtitle row. A new cue takes that row.
  // Only visibility is clipped; accepted semantic word times remain intact.
  const result = {
    ...schedule,
    cues: cues
      .map((cue, i) => {
        const next = cues[i + 1]?.visibleStartFrame ?? Infinity;
        return {
          ...cue,
          visibility: cue.visibility
            .map((s) => ({
              ...s,
              endFrameExclusive: Math.min(s.endFrameExclusive, next),
            }))
            .filter((s) => s.startFrame < s.endFrameExclusive),
        };
      })
      .filter((c) => c.visibility.length),
  };
  assertFineCaptionSchedule(result);
  return result;
}
const handler = (ctx) => {
  const result = decodeFineCaptionTrackSurface(ctx),
    ids = new Map();
  const fragments = result.fragments.map((f) => {
    if (
      !f.operations.some(
        (op) =>
          op.producer.module.name === captionFineModuleRef.name &&
          op.producer.name === captionFineProducers.schedule.name,
      )
    )
      return f;
    const replacement = sealGraphFragment({
      inputs: f.inputs,
      operations: f.operations.map((op) =>
        op.producer.module.name === captionFineModuleRef.name &&
        op.producer.name === captionFineProducers.schedule.name
          ? { ...op, producer }
          : op,
      ),
      exports: f.exports,
    });
    ids.set(f.id, replacement.id);
    return replacement;
  });
  return {
    ...result,
    fragments,
    components: result.components.map((c) => ({
      ...c,
      fragment: ids.get(c.fragment) ?? c.fragment,
    })),
  };
};
export const qflowPackage = {
  format: "qflow.node-package@1",
  modules: [{ manifest }],
  components: [
    {
      producers: [
        {
          producer,
          handler: ({ inputs: i }) => ({
            outputs: {
              schedule: {
                kind: "inline",
                value: canonicalize(
                  singleLineSchedule(
                    inline(i.caption),
                    inline(i.program),
                    inline(i.document),
                  ),
                ),
              },
            },
            needs: {},
          }),
        },
      ],
    },
  ],
  hostFacets: [
    createStudioTrackCompanionHostFacet(
      captionFineStudioTrackCompanions.map((companion) => ({
        ...companion,
        output: { ...companion.output, modules: [module] },
      })),
    ),
    createMarkupSurfaceHostFacet({
      module,
      declaration: captionFineMarkupSurfaces.find((s) => s.name === "track"),
      handler,
    }),
  ],
};
export default qflowPackage;
