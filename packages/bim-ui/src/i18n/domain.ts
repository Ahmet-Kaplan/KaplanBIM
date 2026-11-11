"use client";

/**
 * Domain labels in Turkish: the words that are *data*, not interface text.
 *
 * A discipline ("Electrical"), a quantity kind ("Airflow"), a BIM concept
 * ("Sheet") are declared in the packs (`ADDON_UI`, `disciplines.ts`) and in
 * `bim-units` (`KINDS`), and the design decision (spec §7/Ç-B) is that those
 * English identifiers **do not change** — a pack file stays exactly as upstream
 * wrote it, and the translation happens where the label is drawn. One map, keyed
 * by the English label, serves all ~600 of them:
 *
 *     <span>{translateDomainLabel(discipline.label, t)}</span>
 *
 * Three rules make that safe at a call site:
 *
 *   1. **Keyed case- and punctuation-insensitively.** `Fire protection`,
 *      `fire-protection` and `FIRE  PROTECTION` are one entry (`fire_protection`),
 *      because the packs spell the same term differently and a lookup that missed
 *      on a hyphen would silently leave English on a Turkish screen.
 *   2. **An unknown label is the English label.** Not a key, not an empty string:
 *      a pack added tomorrow shows its own words until someone translates them
 *      (spec Review Focus 6 — an unknown label is expected, not an error).
 *   3. **The label is the `defaultValue`.** English is the source of truth at the
 *      call site, exactly as everywhere else in this kit, so `locales/tr/domain.json`
 *      holds only Turkish.
 *
 * The Turkish file is `locales/tr/domain.json` and follows `docs/i18n/glossary.md`:
 * §1 for disciplines, §5 for quantity kinds and schedule fields, §2 for concepts.
 * Where the glossary binds two meanings to one English word (`Panel` → *pano*
 * electrical / *panel* UI, `Section` → *kesit* drawing / *bölüm* form) the map
 * carries the term-shaped reading, and the other reading is keyed by its own
 * longer English phrase; a bare label cannot say which it meant.
 */
import { useCallback } from "react";
import { useT } from "./use-t";

/** The namespace this map lives in (`locales/tr/domain.json`). */
export const DOMAIN_NAMESPACE = "domain";

/**
 * A translator already bound to the domain namespace — `useT('domain')`, or an
 * i18next `TFunction` from `getFixedT(language, 'domain')`.
 *
 * Two arguments only, so the many hosts that thread their own `Translate`
 * (`packages/bim-editor/src/editor/i18n/translate.ts`) can pass an adapter rather
 * than this kit taking a dependency on how they spell their options.
 */
export type DomainTranslator = (key: string, english: string) => string | null | undefined;

/**
 * The map key for one English label: lowercased, and every run of spaces or
 * punctuation folded to a single `_`.
 *
 * `\p{L}`/`\p{N}` rather than `\w`, so a label that already carries Turkish
 * letters (`Sıhhi tesisat`) or a symbol (`K-factor`, `R/D`, `2 "`) is keyed
 * without throwing and without two runs of the same name folding together.
 *
 * A key is also what i18next must accept: it contains no `.` and no `:`, which
 * are i18next's key and namespace separators, so a label can never be read as a
 * path into the resource object.
 */
export function normalizeDomainKey(label: string): string {
  return label
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
}

/**
 * One domain label in the language being drawn, or the English label itself when
 * this map has not translated it.
 *
 * An answer that is empty, or that is the key rather than a word, counts as "not
 * translated": that is what i18next hands back for a key it has never seen, and a
 * key name on a Turkish screen is worse than English.
 */
export function translateDomainLabel(label: string, t: DomainTranslator): string {
  const key = normalizeDomainKey(label);
  // An empty label has no key: answering "" would blank a cell, and asking the
  // translator for "" is not a lookup anyone can serve.
  if (key === "") return label;
  const translated = t(key, label);
  if (typeof translated !== "string" || translated === "" || translated === key) return label;
  return translated;
}

/**
 * `translateDomainLabel` bound to this kit's domain namespace, for a component:
 *
 *     const domain = useDomainLabel();
 *     <h2>{domain(discipline.label)}</h2>
 *
 * The namespace is named here, not at the call site, because a domain label is
 * always the same kind of word and a caller remembering `{ ns: 'domain' }` at 600
 * call sites is how one of them gets forgotten.
 */
export function useDomainLabel(): (label: string) => string {
  const t = useT(DOMAIN_NAMESPACE);
  return useCallback((label: string) => translateDomainLabel(label, t), [t]);
}
