import { builtinLanguages, chooseLanguage, formatMessage, readLanguagePack } from "../localization.js";
import type { LanguagePack, Message, MessageValues } from "../localization.js";
import { bindDropdown } from "./dropdown.js";
import { icon } from "./icons.js";
export type { Message } from "../localization.js";

type Attribute = "title" | "aria-label" | "placeholder" | "alt";
const attributes: readonly Attribute[] = ["title", "aria-label", "placeholder", "alt"];
const storageKey = "qflow-studio.language";
let languages = builtinLanguages;
let language = chooseLanguage(languages, navigator.languages);

export async function initializeI18n(): Promise<void> {
  const response = await fetch("/__studio/locales");
  if (!response.ok) throw new Error(`Could not load Studio languages (${response.status}).`);
  languages = (await response.json() as unknown[]).map(readLanguagePack);
  let saved: string | null = null;
  try { saved = localStorage.getItem(storageKey); } catch { /* Browser storage may be disabled. */ }
  language = chooseLanguage(languages, [...(saved ? [saved] : []), ...navigator.languages]);
  document.documentElement.lang = language.locale;
}

export function t(message: Message, values: MessageValues = {}): string {
  return formatMessage(language, message, values);
}
function escape(value: string): string {
  return value.replace(/[&<>"']/gu, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
export function uiLabel(message: Message): string {
  return `<span data-ui-text="${message}" dir="${language.direction}">${escape(t(message))}</span>`;
}
export function uiAttribute(attribute: Attribute, message: Message): string {
  return `${attribute}="${escape(t(message))}" data-ui-${attribute}="${message}"`;
}
export function uiText(node: Element, message: Message, values: MessageValues = {}): void {
  node.setAttribute("data-ui-text", message);
  node.setAttribute("data-ui-values", JSON.stringify(values));
  node.setAttribute("dir", language.direction);
  node.textContent = t(message, values);
}
/** Use when a node changes from UI text into a user-provided name or an empty value. */
export function userText(node: Element, value: string): void {
  node.removeAttribute("data-ui-text");
  node.removeAttribute("data-ui-values");
  node.setAttribute("dir", "auto");
  node.textContent = value;
}
export function uiAttr(node: Element, attribute: Attribute, message: Message, values: MessageValues = {}): void {
  node.setAttribute(`data-ui-${attribute}`, message);
  node.setAttribute(`data-ui-${attribute}-values`, JSON.stringify(values));
  node.setAttribute(attribute, t(message, values));
}
export function uiDate(node: Element, timestamp: number): void {
  node.setAttribute("data-ui-date", String(timestamp));
  node.textContent = new Intl.DateTimeFormat(language.locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

function selectLanguage(pack: LanguagePack): void {
  language = pack;
  try { localStorage.setItem(storageKey, pack.locale); } catch { /* Tab-local choice still applies. */ }
  document.documentElement.lang = pack.locale;
  // Update explicitly marked chrome in place, without rebuilding editors or the player.
  for (const node of Array.from(document.querySelectorAll("[data-ui-text]"))) {
    uiText(node, node.getAttribute("data-ui-text") as Message, JSON.parse(node.getAttribute("data-ui-values") ?? "{}") as MessageValues);
  }
  for (const attribute of attributes) {
    for (const node of Array.from(document.querySelectorAll(`[data-ui-${attribute}]`))) {
      uiAttr(node, attribute, node.getAttribute(`data-ui-${attribute}`) as Message, JSON.parse(node.getAttribute(`data-ui-${attribute}-values`) ?? "{}") as MessageValues);
    }
  }
  for (const node of Array.from(document.querySelectorAll("[data-ui-date]"))) uiDate(node, Number(node.getAttribute("data-ui-date")));
}

export function languageMenu(): HTMLElement {
  const control = document.createElement("div");
  control.className = "parameter-select language-select";
  const trigger = document.createElement("button");
  trigger.type = "button"; trigger.className = "parameter-select-trigger language-toggle";
  trigger.dataset.language = "";
  trigger.innerHTML = icon("globe");
  uiAttr(trigger, "title", "app.language"); uiAttr(trigger, "aria-label", "app.language");
  trigger.setAttribute("aria-haspopup", "listbox"); trigger.setAttribute("aria-expanded", "false");
  const menu = document.createElement("div");
  menu.className = "parameter-select-menu"; menu.id = "studio-languages"; menu.hidden = true;
  menu.setAttribute("role", "listbox"); uiAttr(menu, "aria-label", "app.language");
  trigger.setAttribute("aria-controls", menu.id);
  const options = languages.map(pack => {
    const item = document.createElement("button");
    item.type = "button"; item.className = "parameter-select-option";
    item.lang = pack.locale; item.dir = pack.direction;
    item.textContent = pack.name;
    item.dataset.locale = pack.locale;
    item.setAttribute("role", "option");
    item.addEventListener("click", () => {
      selectLanguage(pack); renderSelection(); close(true);
    });
    return item;
  });
  const renderSelection = (): void => {
    for (const item of options) {
      const selected = item.dataset.locale === language.locale;
      item.classList.toggle("active", selected); item.setAttribute("aria-selected", String(selected));
    }
  };
  menu.append(...options); control.append(trigger, menu);
  const { close } = bindDropdown(control, trigger, menu, options);
  renderSelection();
  return control;
}
