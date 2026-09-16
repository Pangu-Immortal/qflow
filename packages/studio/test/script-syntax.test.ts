import assert from "node:assert/strict";
import test from "node:test";
import { tokenizeSvml } from "../src/ui/syntax.js";

test("Studio distinguishes delimited Script markers from properties, escapes and generation references", () => {
  const source = '<script id="s"><line>@{a}hello{emphasis}@{/a} <New @{beat!}York|> <3D|three @{d!}D> \\@\\{literal\\}</line></script><prompt>@image1</prompt>';
  const tokens = tokenizeSvml(source);
  assert.deepEqual(tokens.filter(token => token.kind === "marker").map(token => [token.id, source.slice(token.start, token.end)]), [
    ["a", "@{a}"], ["a", "@{/a}"], ["beat", "@{beat!}"], ["d", "@{d!}"],
  ]);
  assert.equal(tokens.filter(token => token.kind === "attr").some(token => source.slice(token.start, token.end) === "{emphasis}"), true);
  for (let index = 1; index < tokens.length; index++) assert.ok(tokens[index]!.start >= tokens[index - 1]!.end);
});
