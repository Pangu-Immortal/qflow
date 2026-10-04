import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { adjustScriptSelection, captionDocument, narrativeCaptionBinding, parseScript, serializeCaption, serializeSpeech } from "@qflow/script";

function displayed(body: string) {
  const parsed = parseScript("display", `<line>${body}</line>`);
  const document = captionDocument(parsed, "caption", "story");
  const binding = narrativeCaptionBinding(parsed, "caption", "story");
  return { parsed, document, binding, text: document.words.map(word => word.separatorBefore + word.text).join("") };
}

for (const text of [
  "是的 就是这样", "是的就是这样", "hello world", "3D", "3 D", "할 수 있습니다",
  "3개월 만에 완성했습니다", "3 개월 만에 완성했습니다", "2026년 9월 17일", "韓國어 표기",
  "韓國 어 표기", "안녕,세계", "안녕, 세계", 'He said "hello world".', "a ( b ) c",
]) test(`display projection preserves authored separation: ${text}`, () => {
  const { parsed, text: actual } = displayed(text);
  assert.equal(actual, text);
  assert.equal(serializeCaption(parsed), text);
});

test("markers, properties and Dual Text boundaries never invent or discard a separator", () => {
  for (const [source, expected] of [
    ["是的@{part}就是这样@{/part}", "是的就是这样"],
    ["是的 @{part}就是这样@{/part}", "是的 就是这样"],
    ["<是的 就是这样|>", "是的 就是这样"],
    ["<안녕|>하세요", "안녕하세요"],
    ["<안녕|> 하세요", "안녕 하세요"],
    ["<  안녕  |  안녕  >하세요", "안녕하세요"],
    ["是的{emphasis} 就是这样", "是的 就是这样"],
    ["<3D{emphasis}|three @{letter!}D> animation", "3D animation"],
    ["是的 <|别显示> 就是这样", "是的 就是这样"],
    ["是的<|别显示>就是这样", "是的就是这样"],
    ["hello{emphasis} . world", "hello . world"],
    ["<hello|> . world", "hello . world"],
    ["할\t수\n있습니다", "할 수 있습니다"],
  ]) {
    const { parsed, text } = displayed(source!);
    assert.equal(text, expected, source);
    assert.equal(serializeCaption(parsed), expected, source);
  }
});

test("shared groups keep punctuation, properties, internal anchors and speech correspondence", () => {
  const { parsed, document, binding, text } = displayed("<组@{beat!}件{emphasis}化|>");
  assert.equal(text, "组件化");
  assert.equal(serializeSpeech(parsed), "组件化");
  assert.equal(document.units.length, 1);
  assert.equal(binding.units[0]!.sourceTokenIds.length, 3);
  assert.equal(parsed.moments[0]!.anchorId, parsed.tokens[1]!.startAnchorId);
  assert.deepEqual(document.words[1]!.attributes, [{ name: "emphasis", value: true }]);
});

test("all marker control sigils are delimited and cannot absorb text or punctuation", () => {
  const parsed = displayed("@{a}one@{/a} @{~b}two@{/b~} @{right!}@{~left!}three").parsed;
  assert.equal(parsed.selections[0]!.startAnchorId, parsed.tokens[0]!.startAnchorId);
  assert.equal(parsed.selections[0]!.endAnchorId, parsed.tokens[0]!.endAnchorId);
  assert.equal(parsed.selections[1]!.startAnchorId, parsed.tokens[0]!.endAnchorId);
  assert.equal(parsed.selections[1]!.endAnchorId, parsed.tokens[2]!.startAnchorId);
  assert.equal(parsed.moments.find(m => m.id === "right")!.anchorId, parsed.tokens[2]!.startAnchorId);
  assert.equal(parsed.moments.find(m => m.id === "left")!.anchorId, parsed.tokens[1]!.endAnchorId);
  assert.equal(displayed("@{a}!yes@{/a}").text, "!yes");
  assert.equal(displayed(String.raw`\@\{part\}`).text, "@{part}");
  for (const source of ["@old hi", "@{old", "@{ name}hi", "@{~ /a}", "@{/a!}", "@{a~}", "hel@{beat!}lo", "<x|a{emphasis}>", "<x|<y|z>>"]) {
    assert.throws(() => displayed(source), /SCRIPT_/u, source);
  }
});

test("moving a Selection inside shared text preserves spelling, properties and unrelated markers", () => {
  const source = '<line>@{part}<3D{emphasis}|>@{/part} 是的 就是这样@{end!}</line>';
  const parsed = parseScript("edit", source);
  const next = adjustScriptSelection({ sourceName: "edit", source, parsed, adjustment: {
    id: "part", startAnchorId: parsed.tokens[1]!.startAnchorId, endAnchorId: parsed.tokens[1]!.endAnchorId,
  } });
  assert.equal(next, '<line><3@{part}D{emphasis}@{/part}|> 是的 就是这样@{end!}</line>');
  const after = parseScript("edit", next);
  assert.equal(serializeCaption(after), serializeCaption(parsed));
  assert.equal(serializeSpeech(after), serializeSpeech(parsed));
  assert.deepEqual(captionDocument(after, "c", "s"), captionDocument(parsed, "c", "s"));
});

test("explicit migration changes only Script markers and leaves the original file untouched by default", async () => {
  const directory = await mkdtemp(join(tmpdir(), "qflow-script-migrate-"));
  try {
    const path = join(directory, "film.svml");
    const source = '<prompt>@image1 stays</prompt>\n<script id="s">@whole<line>是的 @part <3D|>@/part @beat!好</line>@/whole~</script>';
    const expected = '<prompt>@image1 stays</prompt>\n<script id="s">@{whole}<line>是的 @{part} <3D|>@{/part} @{beat!}好</line>@{/whole~}</script>';
    await writeFile(path, source);
    const tool = fileURLToPath(new URL("../bin/migrate-0.2.mjs", import.meta.url));
    assert.equal(execFileSync(process.execPath, [tool, path], { encoding: "utf8" }), expected);
    assert.equal(await readFile(path, "utf8"), source);
    execFileSync(process.execPath, [tool, path, "--write"]);
    assert.equal(await readFile(path, "utf8"), expected);
    assert.equal(execFileSync(process.execPath, [tool, path], { encoding: "utf8" }), expected);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
