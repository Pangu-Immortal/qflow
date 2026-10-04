export class NarrativeCaptionTimingError extends Error {
  readonly code: "CAPTION_BINDING" | "CAPTION_TOKEN_ORDER";

  constructor(code: NarrativeCaptionTimingError["code"], message: string) {
    super(message);
    this.name = "NarrativeCaptionTimingError";
    this.code = code;
  }
}
