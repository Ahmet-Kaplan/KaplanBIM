/**
 * The editor's two languages in a test.
 *
 * The editor does not own its i18next instance: a host wraps it in
 * `<I18nProvider>` (see `demo/entry.tsx`) and the Turkish strings travel with
 * the editor as `editorResources`. A test that renders anything reading `t()`
 * therefore has to do the same, or the words come back English.
 *
 * `translateFor` is the same translator the surface hands the ribbon builders
 * (a `Translate`: key, the English shown when no Turkish is loaded, and the
 * values for `{{placeholders}}`), so a test can build a ribbon in either
 * language without rendering anything.
 */
import type { ReactNode } from "react";
import { I18nProvider, createI18n, type MutinyLanguage } from "@permitzip/bim-ui";
import { editorResources } from "../../src/editor/i18n/resources";
import { EDITOR_NAMESPACE, type Translate } from "../../src/editor/i18n/translate";

/** The translator the editor's ribbon builders take, in `language`. */
export function translateFor(language: MutinyLanguage): Translate {
  const i18n = createI18n({ language, resources: editorResources });
  const fixed = i18n.getFixedT(language, EDITOR_NAMESPACE);
  return (key, english, values) => (values === undefined ? fixed(key, english) : fixed(key, english, values)) as string;
}

/** The provider a host gives the editor, in `language`. */
export function Wrap({ language, children }: { readonly language: MutinyLanguage; readonly children: ReactNode }) {
  return (
    <I18nProvider language={language} resources={editorResources}>
      {children}
    </I18nProvider>
  );
}
