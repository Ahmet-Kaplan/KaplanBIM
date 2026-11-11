/**
 * The `web` namespace in the browser: the words the hosted app's own code shows.
 *
 * The editor page already wraps the editor in `<I18nProvider>` (`./editor-language`),
 * which gives the editor and the schedule surfaces their Turkish. This module adds
 * the app's own namespace to that provider, and gives a translator to the one part
 * of the app that has no React tree at all — the settings page's plain script.
 *
 * English stays in the code as the `defaultValue` of every `t('key', 'English')`
 * call; the Turkish lives in `../locales/tr/web.json`, the same file the
 * server-rendered pages read (`src/i18n.ts`), so a string the bar shows and a
 * string a page shows are translated in one place.
 */
import type { Resource, TFunction } from "i18next";
import { createI18n, isMutinyLanguage, type MutinyLanguage } from "@permitzip/bim-ui";
import trWeb from "../locales/tr/web.json";

/** The namespace this app's Turkish lives in (`locales/tr/web.json`). */
export const WEB_NAMESPACE = "web";

/**
 * The Turkish this app ships, in the shape `<I18nProvider>` takes.
 *
 * The namespace is written at each call site of a translator that arrives as a
 * parameter (`{ ns: 'web' }`) because `npm run i18n:review` binds a call to its
 * namespace by the literal in the call; a component binds it once with
 * `useT('web')`.
 */
export const webResources: Resource = { tr: { [WEB_NAMESPACE]: trWeb } };

/**
 * The page's language, as the browser can see it.
 *
 * The server answers the page with `<html lang="…">` (`src/ui.tsx`), and a value
 * MutinyBIM does not speak is English — the same fallback
 * `editorPageLanguage()` makes for the editor's page data. Never throws: a damaged
 * value must not cost the person the settings page.
 */
export function pageLanguage(): MutinyLanguage {
  const attribute = typeof document === "undefined" ? undefined : document.documentElement.lang;
  return isMutinyLanguage(attribute) ? attribute : "en";
}

/**
 * A translator for the browser code that is not inside the React tree: the
 * settings script draws into a server-rendered page, so there is no
 * `<I18nProvider>` above it to take one from — and the editor page's host reads
 * one when it is asked for a hint, which can happen on any render.
 *
 * Kept per language rather than built per call: an i18next instance is not free,
 * and both languages are known at build time (`webResources`).
 */
const translators = new Map<MutinyLanguage, TFunction>();

export function pageTranslator(language: MutinyLanguage): TFunction {
  const kept = translators.get(language);
  if (kept !== undefined) return kept;
  const translator = createI18n({ language, resources: webResources }).getFixedT(language, WEB_NAMESPACE);
  translators.set(language, translator);
  return translator;
}
