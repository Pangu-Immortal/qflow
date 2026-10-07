
import type { BlobRef, ResourceId } from "@qflow/protocol";
import type { CompositableSurfaceRef } from "@qflow/media";
import { VISUAL_IR_V1 } from "@qflow/composition";

export type HtmlFrameDomain = {
  readonly frameRate: {
    readonly numerator: number;
    readonly denominator: number;
  };
  /** Legal frame indices are exactly [0, frameCount). */
  readonly frameCount: number;
};

export type HtmlCanvas = {
  readonly width: number;
  readonly height: number;
};

export type HtmlArtifactUsage =
  | { readonly kind: "always" }
  | {
      readonly kind: "frames";
      /** Ordered, disjoint absolute half-open spans where this Artifact can be observed. */
      readonly spans: readonly HtmlFrameSpan[];
    };

/** One byte dependency and the compiler's conservative proof of when it can be observed. */
export type HtmlArtifact = {
  readonly artifact: BlobRef;
  readonly usage: HtmlArtifactUsage;
};

export type HtmlFrameSource = HtmlFrameSpan & {
  /** Document-local DOM identity of the compiled source occurrence. */
  readonly id: string;
  /** Artifact resource whose exact decoded frames feed this occurrence. */
  readonly resource: ResourceId;
  readonly sourceFrame: { readonly numerator: number; readonly denominator: number };
  readonly sourceRate: { readonly numerator: number; readonly denominator: number };
  readonly sourceFrameRate: { readonly numerator: number; readonly denominator: number };
};

/** Portable, frame-addressed HTML visual program. */
export type HtmlProgram = HtmlFrameDomain & {
  readonly visualIr: typeof VISUAL_IR_V1;
  readonly canvas: HtmlCanvas;
  /** Every byte resource referenced by the HTML template, with its conservative temporal usage. */
  readonly artifacts: readonly HtmlArtifact[];
  /** Typed Surface dependencies that a Runtime must verify before rasterization. */
  readonly surfaces: readonly CompositableSurfaceRef[];
  /** Exact source-frame functions emitted alongside HTML; execution never parses them back out of markup. */
  readonly frameSources: readonly HtmlFrameSource[];
  /** Media URLs remain qflow-resource:// placeholders until a Runtime materializes them. */
  readonly html: string;
};

/** A half-open interval on the document frame clock, also used for local worker partitions. */
export type HtmlFrameSpan = {
  readonly startFrame: number;
  readonly endFrameExclusive: number;
};

export type ResourceUrlResolver = (artifact: BlobRef) => string;
