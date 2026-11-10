/**
 * The server's side of the bilingual UI: which language a request is answered
 * in, and the translator that draws the page in it.
 *
 * English is the source of truth and stays in the code, as the `defaultValue`
 * of every `t('key', 'English')` call in `pages.tsx`; the Turkish lives in
 * `locales/tr/web.json`, the `web` namespace of `packages/bim-ui`. A missing
 * Turkish key therefore shows the English text, never the key name.
 */
import type { TFunction } from "i18next";
import { createI18n, isMutinyLanguage, type MutinyLanguage } from "@permitzip/bim-ui";
import trWeb from "../locales/tr/web.json";

/**
 * Where this browser's language choice is kept. The same name the editor writes
 * to `localStorage` (`LANGUAGE_STORAGE_KEY` in packages/bim-ui) and the one the
 * language toggle sets as a cookie, so one name describes the choice on both
 * sides.
 */
export const COOKIE_NAME = "mutiny.lang";

/** The namespace this app's Turkish lives in (`locales/tr/web.json`). */
const WEB = "web";

/** What the server knows about a request's language before it draws a page. */
export interface RequestLanguageInput {
  /** The request's cookies, already decoded, by name. */
  readonly cookies: Record<string, string>;
  /** The signed-in person, whose own setting travels with them. */
  readonly user?: { readonly language?: string };
  /**
   * One request header, asked with the lower-case name Node uses
   * (`'accept-language'`), answering `undefined` when it is absent.
   */
  readonly header: (name: string) => string | undefined;
}

/** A tag like `tr`, `tr-TR` (or `TR-tr`) is Turkish; a tag like `en-GB` is English. */
function languageOfTag(tag: string): MutinyLanguage | undefined {
  const normalized = tag.trim().toLowerCase();
  if (normalized === "tr" || normalized.startsWith("tr-")) return "tr";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return undefined;
}

/**
 * The best language an `Accept-Language` header names, or `undefined` when it
 * names none this app speaks.
 *
 * The header is a ranked list (`tr-TR,tr;q=0.9,en;q=0.8`), so it is read in the
 * order the browser ranked it and the first language MutinyBIM speaks wins: a
 * person whose browser prefers French but accepts Turkish gets Turkish, and
 * `q=0` (an explicit refusal) never wins.
 */
function fromAcceptLanguage(header: string | undefined): MutinyLanguage | undefined {
  if (header === undefined) return undefined;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag = "", ...parameters] = part.trim().split(";");
      const quality = parameters.map((parameter) => parameter.trim()).find((parameter) => parameter.startsWith("q="));
      const weight = quality === undefined ? 1 : Number.parseFloat(quality.slice(2));
      return { tag, weight: Number.isFinite(weight) ? weight : 0 };
    })
    .filter((entry) => entry.tag !== "" && entry.weight > 0)
    .sort((left, right) => right.weight - left.weight);
  for (const { tag } of ranked) {
    const language = languageOfTag(tag);
    if (language !== undefined) return language;
  }
  return undefined;
}

/**
 * The language to answer one request in: the language cookie, then the
 * account's own setting, then `Accept-Language`, then English.
 *
 * The cookie is this browser's explicit choice, made by pressing the language
 * toggle a moment ago, so it wins; the account is the preference that travels
 * with the person; `Accept-Language` is only the machine's guess. A value that
 * is not a language this app speaks (`tr-TR`, a half-written cookie, a
 * hand-edited one) is ignored rather than trusted, and nothing here throws: a
 * damaged preference must not cost the person their page.
 */
export function resolveRequestLanguage(request: RequestLanguageInput): MutinyLanguage {
  const cookie = request.cookies[COOKIE_NAME];
  if (isMutinyLanguage(cookie)) return cookie;
  const account = request.user?.language;
  if (isMutinyLanguage(account)) return account;
  return fromAcceptLanguage(request.header("accept-language")) ?? "en";
}

/**
 * One translator per language, kept for the process: an i18next instance costs
 * a parse of the Turkish file, and a page render asks for it many times over.
 * The translator is bound to this app's namespace, so every call site writes
 * `t('section.name', 'English')` and the Turkish comes from `web.json`.
 */
const translators = new Map<MutinyLanguage, TFunction>();

/**
 * The translator for one request's language. Turkish falls back to the English
 * `defaultValue` at the call site for any key `web.json` does not carry yet.
 */
export function tFor(language: MutinyLanguage): TFunction {
  const cached = translators.get(language);
  if (cached !== undefined) return cached;
  const i18n = createI18n({ language, resources: { tr: { [WEB]: trWeb } } });
  const translate = i18n.getFixedT(language, WEB) as TFunction;
  translators.set(language, translate);
  return translate;
}
