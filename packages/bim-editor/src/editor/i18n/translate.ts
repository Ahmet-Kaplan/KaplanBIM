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
 */
export const englishOnly: Translate = (_key, english) => english;

/**
 * The editor's translator, bound to its own namespace.
 *
 * A translation that comes back empty is treated as missing: i18next answers `''`
 * for a key when the instance it reaches has nothing loaded (a host with no
 * `<I18nProvider>`), and a blank caption is worse than the English one.
 */
export function useEditorTranslate(): Translate {
  const t = useT(EDITOR_NAMESPACE);
  return useMemo<Translate>(
    () => (key, english, values) => {
      const translated = values === undefined ? t(key, english) : t(key, english, values);
      return typeof translated === "string" && translated !== "" ? translated : english;
    },
    [t],
  );
}
