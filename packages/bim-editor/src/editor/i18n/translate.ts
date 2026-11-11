/**
 * The editor's side of the bilingual UI: the translator the surface hands its
 * ribbon, and the English-only one a host without a language gets.
 *
 * The editor does not own an i18next instance — the host wraps it in
 * `<I18nProvider>` (see `demo/entry.tsx`) and the Turkish strings travel with
 * the package as `editorResources`. So a builder takes a `Translate` rather than
 * reaching for a hook, which also keeps `buildingModelRibbon` a pure function
 * that a test can call in either language.
 *
 * English is the source of truth: every call site writes
 * `t('ribbon.tab.views', 'Views', { ns: 'editor' })`, and a key with no Turkish
 * yet shows that English, never the key name.
 *
 * The namespace is repeated at each call because this translator is threaded
 * through the ribbon builders rather than read from a hook in the component that
 * shows the words: `npm run i18n:review` binds a `t()` call to a namespace by the
 * literal in the call itself (`ns: 'editor'`) or by a `useT('editor')` above it in
 * the same file, and a builder has neither. The same shape the web app uses for
 * its `web` strings, for the same reason.
 */
import { useMemo } from "react";
import { useT } from "@permitzip/bim-ui";
import { useTranslation } from "react-i18next";

/** The namespace this package's Turkish lives in (`locales/tr/editor.json`). */
export const EDITOR_NAMESPACE = "editor";

/** What a translated word may be told besides its English: `{{placeholder}}` values, and the namespace it belongs to. */
export interface TranslateValues {
  /** The namespace the key lives in (`MUTINY_NAMESPACES`), named at the call site (see the note above). */
  readonly ns?: string;
  readonly [name: string]: string | number | undefined;
}

/** One translated word: the key, the English it falls back to, and any values. */
export type Translate = (key: string, english: string, values?: TranslateValues) => string;

/**
 * The ribbon a host gives no translator for. Not a degraded mode: the editor's
 * providers come from the host, so a host that has not wired a language yet (or
 * a test) reads the English the call sites already carry.
 *
 * It fills `{{placeholders}}` rather than returning the English verbatim. That is
 * the same repair `useEditorTranslate()` makes, and it is here so a builder that
 * *defaults* to this translator (the built-in list checks, `calcTemplateBlocked`,
 * `newFieldItem`) cannot put a raw `{{name}}` on a screen when a caller forgets to
 * pass the real one — the shape both `withValues` and the schedules package use.
 */
export const englishOnly: Translate = (_key, english, values) => withValues(english, values);

/**
 * The editor's translator, bound to its own namespace.
 *
 * Two things it repairs on the way out, both consequences of the editor taking
 * its instance from the host:
 *
 * - **No instance at all.** Without a `<I18nProvider>`, react-i18next hands back
 *   its `notReadyT`, which returns the English second argument verbatim. That is
 *   the right text but *not* interpolated, so `More {{name}} tools` would reach a
 *   screen reader with a raw placeholder. `withValues` fills the holes here.
 * - **An empty answer.** A key the instance knows nothing about can come back
 *   `''`; a blank caption is worse than the English one.
 */
export function useEditorTranslate(): Translate {
  const t = useT(EDITOR_NAMESPACE);
  return useMemo<Translate>(
    () => (key, english, values) => {
      const translated = values === undefined ? t(key, english) : t(key, english, values);
      return withValues(typeof translated === "string" && translated !== "" ? translated : english, values);
    },
    [t],
  );
}

/**
 * The language the editor is being drawn in (`tr`, `en`, or `undefined` when the
 * host gave no instance), for the few words whose spelling depends on it — a
 * caption lowercased into a sentence, where Turkish `İ`/`I` differ from English.
 */
export function useEditorLanguage(): string | undefined {
  const { i18n } = useTranslation(EDITOR_NAMESPACE);
  return i18n?.resolvedLanguage ?? i18n?.language;
}

/**
 * `{{name}}` filled from `values`, for text that reached us un-interpolated.
 * Anything we were not given a value for is left exactly as it is, so a broken
 * placeholder is still visible in review rather than silently emptied.
 *
 * Exported for the few places that take a `Translate` whose default is
 * `englishOnly` (the status bar's `edits`): that default returns the English
 * argument verbatim, `{{placeholders}}` and all, so it needs the same repair
 * `useEditorTranslate()` gives the words it hands back.
 */
export function withValues(text: string, values: TranslateValues | undefined): string {
  if (values === undefined || !text.includes("{{")) return text;
  return text.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/gu, (placeholder: string, name: string) => {
    const value = name === "ns" ? undefined : values[name];
    return value === undefined ? placeholder : String(value);
  });
}
