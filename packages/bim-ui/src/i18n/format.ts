import type { MutinyLanguage } from "./index";

/**
 * Locale-aware formatting for numbers, quantities and dates.
 *
 * The rule (glossary §7): the *format* follows the language, the *unit symbol*
 * does not. `kVA`, `CFM`, `fpm`, `mm`, `m²` and `Pa` are the same characters in
 * every language; only the number in front of them changes.
 *
 * There are no hardcoded separator strings here. Every character produced below
 * comes from `Intl` for the language's locale, so a third language needs one
 * entry in `LOCALES` and nothing else.
 */

/** The locale each MutinyBIM language formats with. */
const LOCALES: Record<MutinyLanguage, string> = {
  en: "en-US",
  tr: "tr-TR",
};

function localeFor(language: MutinyLanguage): string {
  return LOCALES[language];
}

/**
 * A number in the language's notation: `12.345,67` in Turkish, `12,345.67` in
 * English. Any `Intl.NumberFormatOptions` passes through, so callers can set
 * precision without this kit guessing one.
 */
export function formatNumber(value: number, language: MutinyLanguage, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(localeFor(language), options).format(value);
}

/**
 * A measured value: the localized number, one space, then the unit symbol
 * exactly as the caller wrote it. `formatQuantity(12.5, "kVA", "tr")` is
 * `12,5 kVA` — never `12,5 kVA` with a translated or lowercased unit.
 */
export function formatQuantity(value: number, unit: string, language: MutinyLanguage): string {
  return `${formatNumber(value, language)} ${unit}`;
}

/**
 * A date in the language's notation. `options` passes straight to
 * `Intl.DateTimeFormat`, so the caller picks the shape (a short date on a
 * schedule row, a long one in a report) and this kit only picks the locale.
 */
export function formatDate(value: Date | number, language: MutinyLanguage, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(localeFor(language), options).format(value);
}

/** The number separators a language uses, as `bim-units`' `DisplayProfile` wants them. */
export interface MutinySeparators {
  /** The character between a whole number and its fraction. */
  readonly decimal: string;
  /** The character between groups of integer digits. */
  readonly thousands: string;
}

/**
 * The language's decimal and thousands characters, read from `Intl` rather than
 * written down here: `12.345,67` and `12,345.67` come out of the locale, so a
 * third language needs no new literals.
 *
 * The sample is `1234.5`: a non-integer, so the locale emits a `decimal` part,
 * and large enough that it also emits a `group` part.
 */
export function separatorsFor(language: MutinyLanguage): MutinySeparators {
  const locale = localeFor(language);
  const parts = new Intl.NumberFormat(locale).formatToParts(1234.5);
  const separator = (type: "decimal" | "group"): string => {
    const part = parts.find((candidate) => candidate.type === type);
    if (part === undefined) throw new Error(`[bim-ui i18n] locale ${locale} formats no ${type} separator`);
    return part.value;
  };
  return { decimal: separator("decimal"), thousands: separator("group") };
}
