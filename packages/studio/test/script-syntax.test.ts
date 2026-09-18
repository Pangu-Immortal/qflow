import assert from "node:assert/strict";
import test from "node:test";
import { tokenizeSvml } from "../src/ui/syntax.js";
import { parseScript } from "@qflow/script";

test("Studio distinguishes Segments and Role Cues by context across writing systems", () => {
  const body = '<one><host>Hello. <진행자>안녕하세요. <主持人>你好。</one><pause/><two>Goodbye.</two>';
  parseScript("highlight", body);
  const source = `<script id="s">${body}</script>`;
  const tokens = tokenizeSvml(source);
  assert.deepEqual(tokens.filter(token => token.kind === "role")
    .map(token => source.slice(token.start, token.end)), ["host", "진행자", "主持人"]);
  assert.deepEqual(tokens.filter(token => token.kind === "tag")
    .map(token => source.slice(token.start, token.end)), ["script", "one", "one", "pause", "two", "two", "script"]);
});

test("Studio distinguishes delimited Script markers from properties, escapes and generation references", () => {
  const source = '<script id="s"><line>@{a}hello{emphasis}@{/a} <New @{beat!}York|> <3D|three @{d!}D> \\@\\{literal\\}</line></script><prompt>@image1</prompt>';
  const tokens = tokenizeSvml(source);
  assert.deepEqual(tokens.filter(token => token.kind === "marker").map(token => [token.id, source.slice(token.start, token.end)]), [
    ["a", "@{a}"], ["a", "@{/a}"], ["beat", "@{beat!}"], ["d", "@{d!}"],
  ]);
  assert.equal(tokens.filter(token => token.kind === "attr").some(token => source.slice(token.start, token.end) === "{emphasis}"), true);
  for (let index = 1; index < tokens.length; index++) assert.ok(tokens[index]!.start >= tokens[index - 1]!.end);
});
