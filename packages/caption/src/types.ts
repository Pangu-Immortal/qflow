import type { CanonicalValue } from "@qflow/protocol";

/** One author-visible word surface. Punctuation owned by the surface is preserved. */
export type CaptionDisplayWord = {
  /** Authored display separator from the preceding word; ignored at a displayed line start. */
  readonly separatorBefore: "" | " ";
  readonly id: string;
  readonly unitId: string;
  readonly text: string;
  readonly attributes: readonly CaptionWordAttribute[];
};

export type CaptionWordAttributeValue = string | number | boolean;

export type CaptionWordAttribute = {
  readonly name: string;
  readonly value: CaptionWordAttributeValue;
};

/** The smallest author-declared N:M display unit. It owns no source-domain identity. */
export type CaptionUnit = {
  readonly id: string;
  readonly groupId?: string;
  readonly role?: string;
  readonly wordIds: readonly string[];
};

export type CaptionCueBreak = {
  readonly afterUnitId: string;
};

/** Complete display truth. It contains neither semantic identities nor measured time. */
export type CaptionDocument = {
  readonly id: string;
  readonly units: readonly CaptionUnit[];
  readonly words: readonly CaptionDisplayWord[];
  readonly cueBreaks: readonly CaptionCueBreak[];
};

export type CaptionStyleIntent = {
  readonly id: string;
  /** null selects no rendering; later Uses can select a visible Style again. */
  readonly rendering: {
    readonly family: string;
    readonly parameters: CanonicalValue;
  } | null;
};

/** Ordered, resolved Uses owned by a Caption Track, not a separate author element. */
export type CaptionUse = {
  readonly window: import("@qflow/temporal").TemporalWindow;
  readonly styleId: string;
  readonly role?: string;
};
export type CaptionProgram = {
  readonly id: string;
  readonly documentId: string;
  readonly styles: readonly CaptionStyleIntent[];
  readonly uses: readonly CaptionUse[];
};

export type CaptionTimingUnit = {
  readonly unitId: string;
  readonly startFrame: number;
  readonly endFrameExclusive: number;
};

export type CaptionTiming = {
  /** Absolute Timeline on which every unit boundary is resolved. */
  readonly timelineId: string;
  readonly documentId: string;
  /** Complete, source-neutral timing for the selected CaptionDocument. */
  readonly units: readonly CaptionTimingUnit[];
};
