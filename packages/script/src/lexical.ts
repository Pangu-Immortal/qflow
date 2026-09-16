export type LexicalUnit = {
  readonly text: string;
  readonly index: number;
};

const CHARACTER_UNIT = String.raw`[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]`;
// A Latin name beside Han prose ends at the script boundary, even without an authored space.
const WORD_CHARACTER = String.raw`(?:(?!${CHARACTER_UNIT})[\p{L}\p{M}\p{N}])`;
const LEXICAL_UNIT = new RegExp([
  String.raw`(?:\p{N}{1,3}(?:[,，]\p{N}{3})+|\p{N}+)(?:[.．]\p{N}+)?(?:-\p{N}+(?:[.．]\p{N}+)?)*(?!\p{N}|-[\p{L}\p{M}])`,
  String.raw`${CHARACTER_UNIT}\p{M}*`,
  String.raw`${WORD_CHARACTER}+(?:['’.-]${WORD_CHARACTER}+)*`,
].join("|"), "gu");

const OPENING_PUNCTUATION = new Set([
  "(", "[", "{", "（", "【", "《", "「", "『", "〔", "〈", "“", "‘",
  "$", "¥", "￥", "€", "£",
]);

const QUOTE_PUNCTUATION = new Set(["\"", "'", "`", "’", "ʼ"]);
const UNICODE_OPENING_PUNCTUATION = /[\p{Ps}\p{Pi}]/u;

/**
 * ASCII quotation marks have no Unicode opening/closing category. In a gap between
 * lexical units, whitespace before the mark is the useful authoring signal:
 * `said "hello` opens a quote, while `hello" world` closes one. A quote before the
 * first unit is opening by definition; contractions stay inside one lexical unit.
 */
function isOpeningPunctuation(
  character: string,
  gap: string,
  position: number,
  hasPreviousSurface: boolean,
): boolean {
  if (OPENING_PUNCTUATION.has(character) || UNICODE_OPENING_PUNCTUATION.test(character)) return true;
  if (!QUOTE_PUNCTUATION.has(character)) return false;
  if (!hasPreviousSurface) return true;
  const before = [...gap.slice(0, position)].at(-1);
  return before !== undefined && /\s/u.test(before);
}

export function lexicalUnits(value: string): readonly LexicalUnit[] {
  return [...value.matchAll(LEXICAL_UNIT)].map((match) => ({
    text: match[0],
    index: match.index,
  }));
}

export function lexicalCount(value: string): number {
  return lexicalUnits(value).length;
}

/** Source positions for markers; unlike timing units, these include attached punctuation. */
export function lexicalEditRanges(value: string): readonly { start: number; end: number }[] {
  const units = lexicalUnits(value);
  return units.map((unit, index) => {
    const previousEnd = index === 0 ? 0 : units[index - 1]!.index + units[index - 1]!.text.length;
    const nextStart = units[index + 1]?.index ?? value.length;
    const leading = value.slice(previousEnd, unit.index);
    let start = unit.index;
    for (const [position, character] of [...leading.matchAll(/./gu)].map((match) => [match.index, match[0]] as const)) {
      if (isOpeningPunctuation(character, leading, position, index > 0)) { start = previousEnd + position; break; }
    }
    let end = unit.index + unit.text.length;
    const trailing = value.slice(end, nextStart);
    for (const match of trailing.matchAll(/./gu)) {
      if (/\s/u.test(match[0]) || isOpeningPunctuation(match[0], trailing, match.index, true)) break;
      end += match[0].length;
    }
    return { start, end };
  });
}

/** Normalize source formatting without inventing or removing language-specific separators. */
export function cleanProjection(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

/** Structural markers split atoms but must not invent prose whitespace when those atoms rejoin. */
export function joinProjection(parts: readonly string[]): string {
  return cleanProjection(parts.join(""));
}

export type DisplaySurface = {
  readonly text: string;
  readonly separatorBefore: "" | " ";
};

/** Keep the authored display spelling while assigning punctuation to lexical surfaces. */
export function displaySurfaces(value: string): readonly DisplaySurface[] {
  const prose = cleanProjection(value);
  const units = lexicalUnits(prose);
  const surfaces: Array<{ text: string; separatorBefore: "" | " " }> = [];
  let cursor = 0;
  for (const unit of units) {
    const gap = prose.slice(cursor, unit.index);
    let openingAt = gap.length;
    for (const match of gap.matchAll(/./gu)) {
      if (!/\s/u.test(match[0]) && isOpeningPunctuation(match[0], gap, match.index, surfaces.length > 0)) {
        openingAt = match.index;
        break;
      }
    }
    const closing = gap.slice(0, openingAt);
    const previous = surfaces.at(-1);
    if (previous) previous.text += closing.trimEnd();
    const prefix = (previous ? "" : closing.trimStart()) + gap.slice(openingAt);
    surfaces.push({ text: prefix + unit.text, separatorBefore: previous && /\s$/u.test(closing) ? " " : "" });
    cursor = unit.index + unit.text.length;
  }
  const last = surfaces.at(-1);
  if (last) last.text += prose.slice(cursor);
  return surfaces;
}

export function displayWordSurfaces(value: string): readonly string[] {
  return displaySurfaces(value).map(surface => surface.text);
}

/** Split punctuation before the first lexical unit, retaining every authored separator. */
export function splitDisplayPrefix(value: string): { previous: string; current: string } {
  const first = lexicalUnits(value)[0];
  if (!first) return { previous: value, current: "" };
  const leading = value.slice(0, first.index);
  for (const match of leading.matchAll(/./gu)) {
    if (!/\s/u.test(match[0]) && isOpeningPunctuation(match[0], leading, match.index, false)) {
      return { previous: leading.slice(0, match.index), current: value.slice(match.index) };
    }
  }
  return { previous: leading, current: value.slice(first.index) };
}

/** Closing punctuation before a lexical unit belongs to the previous display unit when one exists. */
export function splitLeadingClosingPunctuation(value: string): {
  readonly previous: string;
  readonly current: string;
} {
  const prose = cleanProjection(value);
  const first = lexicalUnits(prose)[0];
  if (first === undefined) return { previous: prose.replace(/\s+/gu, ""), current: "" };
  const leading = prose.slice(0, first.index);
  const punctuation = [...leading]
    .map((character, position) => ({ character, position }))
    .filter(({ character }) => !/\s/u.test(character));
  const previous = punctuation
    .filter(({ character, position }) => !isOpeningPunctuation(character, leading, position, false))
    .map(({ character }) => character)
    .join("");
  const opening = punctuation
    .filter(({ character, position }) => isOpeningPunctuation(character, leading, position, false))
    .map(({ character }) => character)
    .join("");
  return { previous, current: `${opening}${prose.slice(first.index)}` };
}
