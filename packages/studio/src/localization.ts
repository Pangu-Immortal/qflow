import english from "../locales/en.json" with { type: "json" };
import chinese from "../locales/zh-CN.json" with { type: "json" };

export type Message = keyof typeof english.messages;
export type MessageValue = string | ({ readonly other: string } & Partial<Record<Intl.LDMLPluralRule, string>>);
export type LanguagePack = {
  readonly locale: string;
  /** Native language name, displayed without translation. */
  readonly name: string;
  readonly direction: "ltr" | "rtl";
  readonly messages: Readonly<Record<string, MessageValue>>;
};
export const defaultLanguage: LanguagePack = english as LanguagePack;
export const builtinLanguages: readonly LanguagePack[] = [defaultLanguage, chinese as LanguagePack];
export type MessageValues = Readonly<Record<string, string | number>>;
const plurals = new Set(["zero", "one", "two", "few", "many", "other"]);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const variants = (message: MessageValue): readonly string[] => typeof message === "string" ? [message] : Object.values(message);
const variables = (text: string): string[] => [...new Set([...text.matchAll(/\{(\w+)\}/gu)].map(match => match[1]!))].sort();

/** Read data, never executable translation code. Partial translations remain useful. */
export function readLanguagePack(value: unknown): LanguagePack {
  if (!record(value) || typeof value.locale !== "string" || typeof value.name !== "string" || !value.name.trim()
    || (value.direction !== "ltr" && value.direction !== "rtl") || !record(value.messages)) {
    throw new Error("A Studio language pack needs locale, name, direction (ltr/rtl) and messages.");
  }
  const locale = Intl.getCanonicalLocales(value.locale)[0];
  if (!locale) throw new Error("A Studio language pack needs a BCP 47 locale.");
  const messages: Record<string, MessageValue> = {};
  for (const [id, message] of Object.entries(value.messages)) {
    if (typeof message !== "string" && (!record(message) || typeof message.other !== "string"
      || Object.entries(message).some(([form, text]) => !plurals.has(form) || typeof text !== "string"))) {
      throw new Error(`${id}: expected text or plural forms with an 'other' form.`);
    }
    const translated = message as MessageValue;
    const original = Object.hasOwn(defaultLanguage.messages, id) ? defaultLanguage.messages[id] : undefined;
    if (original !== undefined) {
      const expected = variables(variants(original)[0]!).join(",");
      for (const text of variants(translated)) {
        if (variables(text).join(",") !== expected) throw new Error(`${id}: preserve the named variables {${expected.split(",").join("}, {")}}.`);
      }
      if (typeof translated !== "string" && !variables(variants(original)[0]!).includes("count")) {
        throw new Error(`${id}: plural forms require a count variable.`);
      }
    }
    messages[id] = translated;
  }
  return { locale, name: value.name, direction: value.direction, messages };
}

export function languageCoverage(pack: LanguagePack): { missing: string[]; unknown: string[] } {
  return {
    missing: Object.keys(defaultLanguage.messages).filter(id => !Object.hasOwn(pack.messages, id)),
    unknown: Object.keys(pack.messages).filter(id => !Object.hasOwn(defaultLanguage.messages, id)),
  };
}

export function chooseLanguage(packs: readonly LanguagePack[], preferences: readonly string[]): LanguagePack {
  for (const preference of preferences) {
    let locale: string;
    try { locale = Intl.getCanonicalLocales(preference)[0]!; } catch { continue; }
    const exact = packs.find(pack => pack.locale === locale);
    if (exact) return exact;
    // Match regional/script variants without a list of special language cases.
    const requested = new Intl.Locale(locale).maximize();
    const related = packs.find(pack => {
      const candidate = new Intl.Locale(pack.locale).maximize();
      return candidate.language === requested.language && candidate.script === requested.script;
    });
    if (related) return related;
  }
  return packs.find(pack => pack.locale === defaultLanguage.locale) ?? defaultLanguage;
}

export function formatMessage(pack: LanguagePack, id: Message, values: MessageValues = {}): string {
  const translated = pack.messages[id];
  const message = translated ?? defaultLanguage.messages[id]!;
  const locale = translated === undefined ? defaultLanguage.locale : pack.locale;
  const template = typeof message === "string" ? message
    : message[new Intl.PluralRules(locale).select(Number(values.count))] ?? message.other;
  return template.replace(/\{(\w+)\}/gu, (match, key: string) => {
    const value = values[key];
    return typeof value === "number" ? new Intl.NumberFormat(pack.locale).format(value) : value ?? match;
  });
}
