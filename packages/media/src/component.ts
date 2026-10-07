import type { AdmissionPackage } from "@qflow/admission";
import type { ProducerPackage } from "@qflow/producer";
import { verifyMediaInspection, verifyMediaStreamSelection, verifyMuxedMedia, verifyTimelineVisual, verifySynchronizedMedia, verifyTimelineAudio } from "./identity.js";
import { mediaLocalTemporalDomain } from "./domain.js";
import type { MediaDomainSpec, SynchronizedMedia } from "./types.js";
import { canonicalize } from "@qflow/protocol";
import { mediaProducers } from "./manifest.js";
import { mediaTypes } from "./manifest.js";
import { verifyMediaFrameRange } from "./frame-range.js";
function inline(value: { readonly kind: string; readonly value?: unknown }, subject: string): unknown { if (value.kind !== "inline") throw new Error(`${subject} must be inline`); return value.value; }
export const mediaComponent = {
  validators: [
    { type: mediaTypes.frameRange, handler: ({ value }) => verifyMediaFrameRange(inline(value, "MediaFrameRange")) },
    { type: mediaTypes.inspection, handler: ({ value }) => verifyMediaInspection(inline(value, "MediaInspection")) },
    { type: mediaTypes.streamSelection, handler: ({ value }) => verifyMediaStreamSelection(inline(value, "MediaStreamSelection")) },
    { type: mediaTypes.synchronized, handler: ({ value }) => verifySynchronizedMedia(inline(value, "SynchronizedMedia")) },
    { type: mediaTypes.timelineVisual, handler: ({ value }) => verifyTimelineVisual(inline(value, "TimelineVisual")) },
    { type: mediaTypes.timelineAudio, handler: ({ value }) => verifyTimelineAudio(inline(value, "TimelineAudio")) },
    { type: mediaTypes.muxed, handler: ({ value }) => verifyMuxedMedia(inline(value, "MuxedMedia")) },
  ],
  producers: [
    { producer: mediaProducers.localDomain, handler: ({ inputs }) => {
      const media = inline(inputs.media!.value, "SynchronizedMedia") as SynchronizedMedia;
      const spec = inline(inputs.spec!.value, "MediaDomainSpec") as MediaDomainSpec;
      return { outputs: { domain: { kind: "inline", value: canonicalize(mediaLocalTemporalDomain(spec.id, media)) } }, needs: {} };
    } },
  ],
} satisfies ProducerPackage & AdmissionPackage;
