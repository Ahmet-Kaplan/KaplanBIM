import i18next, { type i18n as I18nInstance, type Resource } from "i18next";
import trCommon from "../../locales/tr/common.json";

/**
 * The languages MutinyBIM speaks. English is the source of truth: the text lives
 * in the code as the i18next `defaultValue`, and Turkish lives in
 * `locales/tr/<namespace>.json` next to the code that shows it.
 */
export type MutinyLanguage = "en" | "tr";

export const MUTINY_LANGUAGES: readonly MutinyLanguage[] = ["en", "tr"];

/** The type guard every persisted or requested language goes through. */
export function isMutinyLanguage(value: unknown): value is MutinyLanguage {
  return value === "en" || value === "tr";
}

/**
 * The namespaces the UI kit knows. Packages add their own file under
 * `locales/tr/<namespace>.json`; `common` is the one bundled here.
 */
export const MUTINY_NAMESPACES = ["common", "editor", "schedules", "web", "domain"] as const;

export type MutinyNamespace = (typeof MUTINY_NAMESPACES)[number];

export interface CreateI18nOptions {
  /** The language to start in. English by default. */
  readonly language?: MutinyLanguage;
  /** Extra namespaces and overrides, merged over the bundled Turkish strings. */
  readonly resources?: Resource;
}

/**
 * The Turkish strings MutinyBIM ships with. English is never stored: a missing
 * Turkish key falls back to the call site's English `defaultValue`, so the key
 * name itself is never shown.
 */
function bundledResources(): Resource {
  return { tr: { common: trCommon } };
}

/** Two levels deep (language → namespace → key) is all i18next resources use here. */
function mergeResources(base: Resource, extra: Resource | undefined): Resource {
  const merged: Resource = {};
  for (const source of [base, extra ?? {}]) {
    for (const [language, namespaces] of Object.entries(source)) {
      const target = (merged[language] ??= {});
      for (const [namespace, keys] of Object.entries(namespaces ?? {})) {
        const existing = target[namespace];
        target[namespace] = typeof existing === "object" && existing !== null && typeof keys === "object" && keys !== null ? { ...existing, ...keys } : keys;
      }
    }
  }
  return merged;
}

function isProduction(): boolean {
  return typeof process !== "undefined" && process.env?.NODE_ENV === "production";
}

/**
 * Names a gap in the Turkish files, and says nothing in a production build (a
 * missing key is already showing its English text there).
 *
 * i18next only calls this while it is saving missing keys, and this kit never
 * saves them (`saveMissing: false`), so a missing key stays silent in practice:
 * the English `defaultValue` is what the screen shows either way.
 */
function warnMissingKey(languages: string | readonly string[], namespace: string, key: string, fallbackValue?: string): void {
  if (isProduction()) return;
  const names = typeof languages === "string" ? [languages] : languages;
  console.warn(`[bim-ui i18n] no ${names.join(", ")} translation for ${namespace}:${key}; add it to locales/tr/${namespace}.json`, { fallbackValue });
}

/**
 * A fresh i18next instance for one host (a React tree, a server request).
 *
 * English is the fallback: `fallbackLng: 'en'` plus the call site's `defaultValue`
 * mean a missing Turkish key shows the English text, never `some.key`.
 */
export function createI18n(options: CreateI18nOptions = {}): I18nInstance {
  const instance = i18next.createInstance();
  // Synchronous for the resources passed here: `t` works on the next line.
  void instance.init({
    fallbackLng: "en",
    lng: options.language ?? "en",
    defaultNS: "common",
    ns: [...MUTINY_NAMESPACES],
    interpolation: { escapeValue: false },
    returnNull: false,
    resources: mergeResources(bundledResources(), options.resources),
    saveMissing: false,
    missingKeyHandler: (languages, namespace, key, fallbackValue) => warnMissingKey(languages, namespace, key, fallbackValue),
  });
  return instance;
}
