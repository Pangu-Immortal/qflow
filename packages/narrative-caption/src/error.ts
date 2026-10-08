export class NarrativeCaptionTimingError extends Error {
  readonly code: "CAPTION_BINDING" | "CAPTION_PROJECTION" | "CAPTION_UNIT_WINDOW";

  constructor(code: NarrativeCaptionTimingError["code"], message: string) {
    super(message);
    this.name = "NarrativeCaptionTimingError";
    this.code = code;
  }
}
