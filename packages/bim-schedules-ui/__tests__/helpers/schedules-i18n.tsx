/**
 * The schedule surfaces in two languages.
 *
 * The Turkish here is what `locales/tr/schedules.json` holds, read through the
 * package's own translator (`useSchedulesTranslate`), while the English is the
 * default each call site passes — the two must differ, or it is English with a
 * Turkish key.
 */
import type { ReactNode } from "react";
import { I18nProvider, createI18n, type MutinyLanguage } from "@permitzip/bim-ui";
import { schedulesResources } from "../../src/i18n/resources";
import { SCHEDULES_NAMESPACE, type Translate } from "../../src/i18n/translate";

/** The translator the schedule surfaces take, in `language`. */
export function translateFor(language: MutinyLanguage): Translate {
  const i18n = createI18n({ language, resources: schedulesResources });
  const fixed = i18n.getFixedT(language, SCHEDULES_NAMESPACE);
  return (key, english, values) => (values === undefined ? fixed(key, english) : fixed(key, english, values)) as string;
}

/** The provider a host gives the schedule surfaces, in `language`. */
export function Wrap({ language, children }: { readonly language: MutinyLanguage; readonly children: ReactNode }) {
  return (
    <I18nProvider language={language} resources={schedulesResources}>
      {children}
    </I18nProvider>
  );
}
