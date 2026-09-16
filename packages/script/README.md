# `@qflow/script`

Official raw Script Surface for the Markup Frontend. It parses prose-first named Segment blocks,
newline-independent Role Cues, Dual Text, Selection and Moment syntax, and lowers them to a
canonical authored Narrative value with exactly `2M + 2N + 2` semantic anchor identities: both
ends of every Token and Segment, plus the Script Program's own start and end.

The package is an ordinary statically declared Surface module. Core does not import it and does not
know that Script, Segment or Narrative exist.

```svml
<script id="story">
  @{answer}

  <opening>
    <ALICE> I will make the first point.
    <BOB> Then I will answer.
  </opening>

  <pause/>
  @{/answer}
</script>
```

`<opening>` opens a Segment named `opening`; `</opening>` closes that exact Segment. While the
parser is inside a Segment, a valid bare tag such as `<ALICE>` is a Role Cue. This is parser state,
not indentation: the compact spelling
`<opening><ALICE>I speak first.<BOB>I answer.</opening>` has the same semantic value.

A Role Cue is optional. Text before the first Role Cue is a roleless Turn, and Role state is reset
when every Segment closes; a Role can never leak into the following Segment.

An empty Segment such as `<empty></empty>` (or `<empty/>`) is valid. `empty` is an ordinary
author-chosen name, not a reserved keyword. It retains the Segment identity and both boundary anchors
while contributing no Tokens or spoken text. This supports wordless passages in the same semantic
model: the associated normalized media, not the empty tag, determines the SemanticTake's duration.

The package exports its Manifest, `parseScript`, semantic/source-map projection helpers, a
semantic-preserving formatter and the raw `decodeScriptSurface` handler. Source ranges and parser
state remain private to Script; its authored Narrative Record uses the Frontend-neutral type from
`@qflow/narrative`, so third-party author surfaces can feed the same WhisperX, locator and caption
components without importing Script internals.

The Surface exports one full Narrative plus narrow, immutable views:

- `script.segment.<id>` is a narrow `NarrativeExcerpt` used to associate a generated Take with one Segment;
- `script.segment.<id>.dialogue` is ordinary `Text`: display-independent dialogue, including optional
  Role cues and right-side Dual Text pronunciation, for a speech-video model;
- `script.segment.<id>.speech` is ordinary pronunciation-only `Text` for duration estimation or TTS;
- `script.caption` is one complete `CaptionDocument`: ordered display Words, N:M Alignment Units,
  and authored Cue Breaks, empty when the Script has no visible Caption words;
- `script.selection.<id>` is a reusable explicit Selection;
- `script.moment.<id>` is a reusable explicit Moment.

`@qflow/caption` projects `script.selection.<id>` or a Role onto complete Caption Alignment Units;
it then joins those units to a Timeline for frame timing. Seedance consumes dialogue `Text`,
Estimate and TTS consume speech `Text`, and semantic preparation consumes the Segment excerpt. None imports
Script's parser AST. Another authoring package may produce the same ordinary Text, Narrative and
CaptionDocument contracts.

### Script vocabulary

- **Segment**: a named structural passage, written `<opening>...</opening>`.
- **Role Cue**: a speaker turn, written as a bare tag such as `<ALICE>` inside a Segment. The next
  Role Cue or the Segment close ends that turn.
- **Dual Text**: one authored speech span with separate display and spoken projections, written
  `<display text | spoken text>`. In `<display text|>`, omitted speech inherits the displayed prose.
- **Selection marker**: a named semantic range, written `@{name} ... @{/name}`.
- **Moment marker**: a named semantic point, written `@{name!}`.
- **CaptionDocument**: the Script-owned caption truth; it contains **Display Words**,
  **Alignment Units** and **Cue Breaks**. It contains no seconds or frames.
- **Token attribute**: a flat postfix display-word annotation such as `really{emphasis}` or
  `really{emphasis,importance=2,tone=warm}`. Values may be strings, finite numbers or booleans. It
  becomes `CaptionDisplayWord.attributes`; it is not a Selection and does not carry timing.

Within Dual Text, an unescaped `@` belongs to the source of spoken text: the right side when supplied,
or the shared left side in `<display text|>`. Write `\@` if an at-sign must be shown. An empty display side, such as `< | spoken words>`, keeps the speech
tokens and omits them from Caption. `||` is an authored Caption Cue Break and must occur between
complete Alignment Units.

`<组件化|>` is shorthand for `<组件化|组件化>`, using the same exported Caption Alignment Unit.
It groups the displayed expression without merging its individual speech Tokens or time anchors.
For example, `把<动效|><组件化|>。|| 之后<直接复用|>。` authors groups inside two Cues.
Use groups where the expression should be treated together; ordinary prose needs no extra markup.
Caption Styles choose whether to highlight, reveal or keep the text steady.

In a shared side, markers and display attributes do not enter either text projection. Its speech
Tokens retain offsets into the actually written left-hand text, so Studio can move an anchor inside
`<组@{beat!}件化|>` without expanding the shorthand. Attributes still annotate the preceding display
word, not the whole group. Whitespace-only speech is omitted; a group with no spoken text on either
side is invalid. This adds no new public value type or protocol version.

## Segments, turns and Cues are different boundaries

A Segment names a structural production passage. It can contain several Role turns and be performed
by one Take with several edited shots. A Role Cue changes who speaks; it neither creates a character
asset nor requires another generated Take. `||` changes Caption grouping between complete Alignment
Units; it does not split the Segment, cut the picture or end a Selection.

```svml
<script id="story">
  <exchange>
    <HOST> I use it || every day, || since <2012 | twenty twelve>.
    <GUEST> Even @{proof} on holiday @{/proof}?
    <HOST> @{answer!} Especially then.
  </exchange>
</script>
```

Dual Text preserves display spelling while supplying an explicit pronunciation. Its N:M Alignment
Unit is indivisible for Caption timing and authored Cue Breaks. Roles are lexical speaking cues;
the Source's model references and action direction bind them to the intended performers.

English words and numbers normally form lexical units; Han characters form individual units, as do
Hiragana and Katakana characters. A Latin name adjacent to Han text remains separate from the
following characters. Display punctuation attaches to neighboring words without adding timing units.
These units support precise timing and highlighting. A Caption Cue can hold a whole phrase of them;
`||` chooses its handoff independently of character counts or visual line wrapping.

## Display spelling and separators

Script preserves the normalized display spelling independently of speech tokenization. Ordinary
whitespace runs become one space; leading/trailing whitespace in a Turn and padding at the edges
of a Dual Text side are omitted. No language-specific rule removes a Chinese space or inserts a
space between numeric and Korean/Latin tokens. `是的 就是这样`, `3개월`, `3 개월`, `3D` and `3 D`
therefore remain distinct as authored. Source newlines are prose formatting, not Caption Cue breaks.
Use `||` for Cues and a family's layout controls for visual rows.

Each `CaptionDisplayWord.separatorBefore` is `""` or `" "`, relative to the preceding displayed word
in its Turn. Together with `text`, it carries the display spelling to consumers; it is not a speech
Token and has no timing. A renderer suppresses the leading separator at a displayed line/Cue start.
Shared groups retain internal separators and individual speech anchors: `<New York|>` is one
Alignment Unit with a space inside, while `<3D|>` has none. Grouping is a creative choice, not a
workaround for preserving spelling.

## Selection and Moment affinity

Every marker starts with `@{` and ends with `}`. The complete marker is zero-width in speech and
display; surrounding prose whitespace remains prose. All control sigils belong inside the braces:
`@{beat!}` is a Moment, whereas `@{part}!` opens a Selection followed by a literal exclamation mark.
Names match `[a-z][a-z0-9_-]{0,63}`; whitespace and nesting inside a marker are invalid.
A marker cannot split a speech Token. `hello{emphasis}` is a postfix display attribute; `@{part}`
is consumed as one marker and cannot be mistaken for that attribute. Write a literal `@{part}` as
`\@\{part\}`.

A marker selects the adjacent semantic anchor; it does not write a timecode. Inside a spoken
passage, its affinity normally chooses a neighboring word boundary:

| Marker | Boundary |
| --- | --- |
| `@{name}` | Selection opens at the next word's start: right affinity. |
| `@{~name}` | Selection opens at the previous word's end: left affinity. |
| `@{/name}` | Selection closes at the previous word's end: left affinity. |
| `@{/name~}` | Selection closes at the next word's start: right affinity. |
| `@{name!}` | Moment at the next word's start: right affinity. |
| `@{~name!}` | Moment at the previous word's end: left affinity. |

At structural edges, the parser retains the corresponding Segment or program boundary rather than
inventing a neighboring word. Selection and Moment ids share one namespace. Selections can overlap,
cross and span Segments; unlike tags, they do not need to nest.

To join two visual Selections without exposing their inter-word pause, match affinity on both sides:

```text
@{coffee} my coffee @{/coffee} @{~smoothie} my smoothie @{/smoothie}
@{coffee} my coffee @{/coffee~} @{smoothie} my smoothie @{/smoothie}
```

These are alternative spellings, not two occurrences to put in the same Script. In the first,
“coffee” ends both the first Window and the gap's left boundary, so the smoothie Selection owns the
pause. In the second, the next “my” starts both touching boundaries, so the coffee Selection owns it.
Plain `@{/coffee} @{smoothie}` leaves the gap between previous word end and next word start outside both.
The media consumer still decides playback and visual coverage inside those projected Windows.

## Marker writeback

`adjustScriptSelection` and `adjustScriptMoment` accept explicit anchor identities. A Selection's
two endpoints are moved together; unrelated markers and all source prose remain untouched. Names
terminate at `}`, so writeback never inserts a separating space or normalizes surrounding prose.
A no-op adjustment returns the original source. Script owns legal insertion sites: Tokens and
postfix attributes stay together, Dual Text markers follow the actual speech side, and coincident
markers written together have deterministic order. Empty self-closing Segments expand only when a
requested boundary needs an interior insertion site.

Writeback reparses the result to retain the requested bindings and unchanged speech, display and
Narrative/Caption content. Source offsets remain parser-private; no formatting history is stored.

## Explicit migration from 0.1

The 0.2 parser rejects bare `@name` markers. Preview migration from the repository or installed
Distribution root, then explicitly write the reviewed result:

```sh
node packages/script/bin/migrate-0.2.mjs /path/to/film.svml
node packages/script/bin/migrate-0.2.mjs /path/to/film.svml --write
```

Use `--body` for a file containing a raw Script body rather than outer SVML. The tool converts
markers only inside Script bodies, leaves comments and escapes intact, and does not touch provider
prompt references such as `@image1`. It neither installs anything nor runs during a build.

Review authored whitespace after migration: spaces previously discarded by Chinese/punctuation
normalization now appear. The tool preserves source spaces rather than guessing the author's intent.
Regenerate affected Narrative, caption and Build results with the new reader/writer together;
protocol identities remain `@1`. Existing rendered media is not modified by source migration.

## Complete authored content and narrow exports

The root `story` Record contains the complete Narrative: speech structure, semantic references and
its CaptionDocument. `story.caption`, `story.selection.<id>`, Segment excerpts and dialogue/speech
Text outputs remain explicit narrow exports derived from that content. Caption rendering can read
the document and Timeline. Timed Uses change its presentation; their semantic references are
projected through the same Timeline as other components. Word attributes remain in the document
for families that give those words structural visual roles.

For content lookup, use the Narrative package's `narrativeTokensForSelection` or
`narrativeSelectionTokenRange`. These query authored order; Timeline separately locates the same
anchors in the assembled video. No timestamps or display Styles enter the Script value.
