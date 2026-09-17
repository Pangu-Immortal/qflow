import type { CaptionDisplayWord } from "@qflow/narrative";

type Surface = Pick<CaptionDisplayWord, "text" | "separatorBefore">;

/** The first displayed word starts a line; all other gaps come from authored content. */
export function wordGaps(words: readonly Surface[]): readonly boolean[] {
  return words.map((word, index) => index > 0 && word.separatorBefore === " ");
}

/** A uniform run can use column-gap; a mixed run requires individual separators. */
export function uniformGap(gaps: readonly boolean[]): boolean | undefined {
  const boundaries = gaps.slice(1);
  if (boundaries.length === 0) return false;
  if (boundaries.every(gap => gap)) return true;
  return boundaries.some(gap => gap) ? undefined : false;
}
