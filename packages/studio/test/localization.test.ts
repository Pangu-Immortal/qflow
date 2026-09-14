import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { builtinLanguages, chooseLanguage, defaultLanguage, formatMessage, languageCoverage, readLanguagePack } from "../src/localization.js";
import { loadLanguagePack, studioLanguages } from "../src/localization-node.js";

const japanese = { locale: "ja", name: "日本語", direction: "ltr", messages: { "app.studio": "スタジオ", "comments.placeholder": "どこを変更しますか？" } };

test("shipped languages use the same data format and cover every Studio message", () => {
  for (const pack of builtinLanguages) {
    assert.deepEqual(languageCoverage(readLanguagePack(pack)), { missing: [], unknown: [] });
  }
});
test("language choice handles regional variants and any explicitly loaded language", () => {
  const ja = readLanguagePack(japanese);
  const packs = [...builtinLanguages, ja];
  assert.equal(chooseLanguage(packs, ["ja-JP"]).locale, "ja");
  assert.equal(chooseLanguage(packs, ["zh"]).locale, "zh-CN");
  assert.equal(chooseLanguage(packs, ["de", "ja"]).locale, "ja");
  assert.equal(chooseLanguage(packs, ["de"]).locale, "en");
});
test("partial translations retain English wording and its plural rules", () => {
  const ja = readLanguagePack(japanese);
  assert.equal(formatMessage(ja, "app.studio"), "スタジオ");
  assert.equal(formatMessage(ja, "inspector.item-count", { count: 1 }), "1 item");
  assert.equal(formatMessage(ja, "inspector.item-count", { count: 2 }), "2 items");
  const ru = readLanguagePack({ locale: "ru", name: "Русский", direction: "ltr", messages: {
    "inspector.item-count": { one: "{count} элемент", few: "{count} элемента", many: "{count} элементов", other: "{count} элемента" },
  } });
  assert.equal(formatMessage(ru, "inspector.item-count", { count: 2 }), "2 элемента");
  assert.equal(formatMessage(ru, "inspector.item-count", { count: 5 }), "5 элементов");
  assert(languageCoverage(ja).missing.includes("player.play"));
});
test("a translated sentence may reorder variables but cannot silently rename them", () => {
  const valid = readLanguagePack({ ...japanese, messages: { "tasks.progress": "全 {total} 件のうち {completed} 件完了" } });
  assert.equal(formatMessage(valid, "tasks.progress", { total: 8, completed: 3 }), "全 8 件のうち 3 件完了");
  assert.throws(() => readLanguagePack({ ...japanese, messages: { "tasks.progress": "{done}/{total}" } }), /named variables/);
  assert.throws(() => readLanguagePack({ ...japanese, messages: { "inspector.item-count": { one: "{count}" } } }), /other/);
});
test("JSON files and installed package exports load without executing package code", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "qflow-locales-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "ja.json"), JSON.stringify(japanese));
  const pkg = join(root, "node_modules", "studio-ja");
  await mkdir(pkg, { recursive: true });
  await writeFile(join(pkg, "package.json"), JSON.stringify({ name: "studio-ja", exports: { "./locale.json": "./ja.json" }, main: "./never-execute.cjs" }));
  await writeFile(join(pkg, "never-execute.cjs"), 'throw new Error("Translation packages must not execute code");');
  await writeFile(join(pkg, "ja.json"), JSON.stringify(japanese));
  assert.deepEqual(await loadLanguagePack("./ja.json", root, root), await loadLanguagePack("studio-ja/locale.json", root, root));
  const packs = await studioLanguages(["studio-ja/locale.json"], root, root);
  assert.equal(packs.length, builtinLanguages.length + 1);
  assert.equal(packs[0]?.locale, defaultLanguage.locale);
});
