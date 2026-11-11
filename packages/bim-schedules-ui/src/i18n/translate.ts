/**
 * The schedule surfaces' side of the bilingual UI: the translator a host's
 * `<I18nProvider>` feeds, and the English-only one a bare test gets.
 *
 * Same shape as the editor's `editor/i18n/translate.ts` (`@permitzip/bim-editor`)
 * and for the same reason: this package does not own an i18next instance — it is
 * rendered inside the editor, which takes one from its host — so a component
 * reads `useSchedulesTranslate()` and the Turkish travels with the package as
 * `schedulesResources` (`locales/tr/schedules.json`, the `schedules` namespace in
 * `MUTINY_NAMESPACES`).
 *
 * English is the source of truth: every call site writes
 * `t('grid.columns', 'Columns', { ns: 'schedules' })`, and a key with no Turkish
 * yet shows that English, never the key name.
 *
 * Two repairs, both consequences of taking the instance from the host: without a
 * provider, react-i18next hands back the English second argument *verbatim*, so a
 * `{{placeholder}}` would reach the screen; and a key the instance does not know
 * can come back empty. Both are fixed on the way out.
 */
import { useMemo } from "react";
import { useT } from "@permitzip/bim-ui";

/** The namespace this package's Turkish lives in (`locales/tr/schedules.json`). */
export const SCHEDULES_NAMESPACE = "schedules";

/** What a translated word may be told besides its English: `{{placeholder}}` values, and the namespace it belongs to. */
export interface TranslateValues {
  /** The namespace the key lives in (`MUTINY_NAMESPACES`), named at the call site. */
  readonly ns?: string;
  readonly [name: string]: string | number | undefined;
}

/** One translated word: the key, the English it falls back to, and any values. */
export type Translate = (key: string, english: string, values?: TranslateValues) => string;

/** The translator a test or a host with no language gets: the English at the call site, placeholders filled. */
export const englishOnly: Translate = (_key, english, values) => withValues(english, values);

/**
 * The schedule surfaces' translator, bound to their own namespace.
 *
 * Exported for the host (`@permitzip/bim-schedules-ui`) so a screen outside the
 * editor can draw these words in the same language.
 */
export function useSchedulesTranslate(): Translate {
  const t = useT(SCHEDULES_NAMESPACE);
  return useMemo<Translate>(
    () => (key, english, values) => {
      const translated = values === undefined ? t(key, english) : t(key, english, values);
      return withValues(typeof translated === "string" && translated !== "" ? translated : english, values);
    },
    [t],
  );
}

/**
 * `{{name}}` filled from `values`, for text that reached us un-interpolated: an
 * `englishOnly` translator (a host with no language, a test) returns the English
 * verbatim, `{{placeholders}}` and all. Anything with no value is left exactly as
 * it is, so a broken placeholder stays visible in review rather than emptying.
 */
export function withValues(text: string, values: TranslateValues | undefined): string {
  if (values === undefined || !text.includes("{{")) return text;
  return text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/gu, (placeholder: string, name: string) => {
    const value = name === "ns" ? undefined : values[name];
    return value === undefined ? placeholder : String(value);
  });
}
