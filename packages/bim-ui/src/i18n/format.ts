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
 * Formatting is the hot path of a schedule grid, so a formatter is built once
 * per (locale, options) and reused: this module is called once per grid cell.
 * Options are small plain objects, so their JSON is a stable enough key.
 */
const numberFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function numberFormatter(locale: string, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options ?? {})}`;
  const cached = numberFormatters.get(key);
  if (cached !== undefined) return cached;
  const formatter = new Intl.NumberFormat(locale, options);
  numberFormatters.set(key, formatter);
  return formatter;
}

function dateFormatter(locale: string, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options ?? {})}`;
  const cached = dateFormatters.get(key);
  if (cached !== undefined) return cached;
  const formatter = new Intl.DateTimeFormat(locale, options);
  dateFormatters.set(key, formatter);
  return formatter;
}

/**
 * A number in the language's notation: `12.345,67` in Turkish, `12,345.67` in
 * English. Any `Intl.NumberFormatOptions` passes through, so callers can set
 * precision without this kit guessing one.
 */
export function formatNumber(value: number, language: MutinyLanguage, options?: Intl.NumberFormatOptions): string {
  return numberFormatter(localeFor(language), options).format(value);
}

/**
 * A measured value: the localized number, one space, then the unit symbol
 * exactly as the caller wrote it. `formatQuantity(12.5, "kVA", "tr")` is
 * `12,5 kVA` — not `12.5 kVA` (English separator) and not `12,5 kva`
 * (symbol lowercased): the number localizes, the symbol never does.
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
  return dateFormatter(localeFor(language), options).format(value);
}

/** The number separators a language uses, narrowed to what a display profile can express. */
export interface MutinySeparators {
  /** The character between a whole number and its fraction. */
  readonly decimal: "." | ",";
  /** The character between groups of integer digits. */
  readonly thousands: "," | "." | " " | "";
}

const DECIMALS: readonly MutinySeparators["decimal"][] = [".", ","];
const THOUSANDS: readonly MutinySeparators["thousands"][] = [",", ".", " ", ""];

/**
 * The language's decimal and thousands characters, read from `Intl` rather than
 * written down here: `12.345,67` and `12,345.67` come out of the locale, so a
 * third language needs no new literals.
 *
 * The sample is `1234.5`: a non-integer, so the locale emits a `decimal` part,
 * and large enough that it also emits a `group` part. A locale that separates
 * with a character a display profile cannot express (a no-break space, an
 * Arabic decimal separator) is refused by name rather than silently mistyped.
 */
export function separatorsFor(language: MutinyLanguage): MutinySeparators {
  const locale = localeFor(language);
  const parts = numberFormatter(locale).formatToParts(1234.5);
  const separator = <T extends string>(type: "decimal" | "group", allowed: readonly T[]): T => {
    const value = parts.find((candidate) => candidate.type === type)?.value;
    if (value === undefined) throw new Error(`[bim-ui i18n] locale ${locale} formats no ${type} separator`);
    const match = allowed.find((candidate) => candidate === value);
    if (match === undefined) throw new Error(`[bim-ui i18n] locale ${locale} separates with ${JSON.stringify(value)}, which a display profile cannot express`);
    return match;
  };
  return { decimal: separator("decimal", DECIMALS), thousands: separator("group", THOUSANDS) };
}
