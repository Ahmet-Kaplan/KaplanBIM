/**
 * The hosted editor's language: the provider the editor page wraps around the
 * editor, and the one place the page's language is read out of the server's data.
 *
 * The server already answers the editor page in the person's language — the same
 * request language the page and its `<html lang>` use (§7/Ç-D) — and puts it in
 * `#mutinybim-page` page data. This module turns that value into the `<I18nProvider>`
 * the editor takes its words from, with the Turkish the editor package ships.
 *
 * Kept apart from `entry.tsx` so a test can check the wiring without starting a
 * model host: the entry reads page data, opens a socket and mounts the app.
 */
import type { ReactNode } from "react";
import { I18nProvider, isMutinyLanguage, mergeResources, type MutinyLanguage } from "@permitzip/bim-ui";
import { editorResources } from "@permitzip/bim-editor/editor/i18n/resources";
import { schedulesResources } from "@permitzip/bim-schedules-ui";
import { webResources } from "./web-i18n";

/**
 * The language the editor page opens in: what the server put in the page data,
 * or English when it is missing or is not a language MutinyBIM speaks. Never
 * throws — a damaged value must not cost the person their editor.
 */
export function editorPageLanguage(value: unknown): MutinyLanguage {
  return isMutinyLanguage(value) ? value : "en";
}

/**
 * The language provider the hosted editor gives the editor.
 *
 * `language` is the page's language and stays the host's to own (the change
 * handler below updates it); the Turkish arrives as three namespaces — the
 * editor's `editorResources`, the schedule surfaces' `schedulesResources` and this
 * app's own `webResources` — merged into the one object the provider takes. Passing
 * only the editor's is how 360 schedule strings once fell back to English in the
 * hosted app while their tests passed: the package's own test wraps the surfaces
 * itself. The same hole kept the app's own bar English under a Turkish editor, so
 * the app's namespace is merged here, beside the packages'.
 */
export function EditorLanguageProvider({
  language,
  onLanguageChange,
  children,
}: {
  readonly language: MutinyLanguage;
  readonly onLanguageChange?: (language: MutinyLanguage) => void;
  readonly children: ReactNode;
}) {
  return (
    <I18nProvider language={language} onLanguageChange={onLanguageChange} resources={mergeResources(editorResources, schedulesResources, webResources)}>
      {children}
    </I18nProvider>
  );
}
