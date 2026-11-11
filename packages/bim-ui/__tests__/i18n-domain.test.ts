/**
 * Domain labels: the words that are *data*, not interface text — a discipline
 * ("Electrical"), a quantity kind ("Airflow"), a BIM concept ("Sheet").
 *
 * They live in the packs (`ADDON_UI`, `disciplines.ts`) and in `bim-units`
 * (`KINDS`), and the design decision (spec §7/Ç-B) is that those English
 * identifiers **do not change**: a pack file stays exactly as upstream wrote it,
 * and the translation happens at render, through one map.
 *
 * So the map is keyed by the English label, normalised: lowercased, and every
 * run of spaces or punctuation folded to `_`. `Fire protection`, `fire-protection`
 * and `FIRE  PROTECTION` are one entry; a label the map has never seen comes out
 * as the English it went in as — never a key, never an empty string (Review Focus
 * 6: an unknown label is expected for a new pack, not an error).
 */
import fs from "node:fs";
import path from "node:path";
import trDomain from "../locales/tr/domain.json";
import { createI18n } from "../src/i18n";
import { DOMAIN_NAMESPACE, normalizeDomainKey, translateDomainLabel } from "../src/i18n/domain";
import { readTrLocaleFiles } from "./locale-files";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const DOMAIN: Readonly<Record<string, string>> = trDomain as Record<string, string>;

/** The kit's own translator for the domain namespace, exactly as a host gets it. */
const i18n = createI18n({ language: "tr" });
const t = i18n.getFixedT("tr", DOMAIN_NAMESPACE);

/** Every file the domain corpus comes from, read as source rather than imported: `bim-ui` may not depend on the packs. */
function read(relative: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relative), "utf8");
}

/** The `label: "…"` strings in one source file. */
function labelsIn(relative: string): string[] {
  return [...read(relative).matchAll(/\blabel:\s*"((?:[^"\\]|\\.){1,80})"/gu)].map((match) => match[1] ?? "");
}

/** Every quantity kind's label, from the one list `bim-units` declares them in. */
function quantityKindLabels(): string[] {
  return [...read("packages/bim-units/src/kinds.ts").matchAll(/\bkind\("([a-z_0-9]+)", "((?:[^"\\]|\\.){1,80})"/gu)].map((match) => match[2] ?? "");
}

/** The kernel's shared disciplines and every pack's own. */
function disciplineFiles(): string[] {
  const packs = fs
    .readdirSync(path.join(REPO_ROOT, "packages"))
    .filter((name) => name.startsWith("bim-pack-"))
    .map((name) => `packages/${name}/src/disciplines.ts`)
    .filter((relative) => fs.existsSync(path.join(REPO_ROOT, relative)));
  return ["packages/bim-kernel/src/disciplines/types.ts", ...packs];
}

// ---------------------------------------------------------------------------
// The map answers in Turkish
// ---------------------------------------------------------------------------

test("a known discipline label is Turkish (glossary §1)", () => {
  expect(translateDomainLabel("Electrical", t)).toBe("Elektrik");
  expect(translateDomainLabel("Mechanical", t)).toBe("Mekanik");
  // §1: "Structural" is *Statik*, not "Yapısal"; "Civil" is *Altyapı*.
  expect(translateDomainLabel("Structural", t)).toBe("Statik");
  expect(translateDomainLabel("Civil", t)).toBe("Altyapı");
  expect(translateDomainLabel("Fire protection", t)).toBe("Yangın koruma");
  expect(translateDomainLabel("Plumbing", t)).toBe("Sıhhi tesisat");
  // §0.3: an acronym is not translated.
  expect(translateDomainLabel("MEP", t)).toBe("MEP");
});

test("a quantity kind label is Turkish (glossary §5)", () => {
  expect(translateDomainLabel("Airflow", t)).toBe("Hava debisi");
  expect(translateDomainLabel("Length", t)).toBe("Uzunluk");
  expect(translateDomainLabel("Heating or cooling capacity", t)).toBe("Isıtma/soğutma kapasitesi");
  expect(translateDomainLabel("Water supply fixture units", t)).toBe("Su tesisatı yük birimi (WSFU)");
});

test("a BIM concept is Turkish (glossary §2)", () => {
  expect(translateDomainLabel("Sheet", t)).toBe("Pafta");
  expect(translateDomainLabel("Space", t)).toBe("Mekan");
  expect(translateDomainLabel("Schedule", t)).toBe("Çizelge");
  expect(translateDomainLabel("Level", t)).toBe("Kat");
});

// ---------------------------------------------------------------------------
// An unknown label is not an error
// ---------------------------------------------------------------------------

test("an unknown label returns the English label unchanged", () => {
  const unknown = "K-10 Sandwich prep refrigerator";
  expect(translateDomainLabel(unknown, t)).toBe(unknown);

  // Never a key, never empty: the three ways a lookup goes wrong.
  const answered = translateDomainLabel(unknown, t);
  expect(answered).not.toBe(normalizeDomainKey(unknown));
  expect(answered).not.toBe("");
  expect(answered.trim()).not.toBe("");

  // A translator that answers with the key itself (what i18next does for a key it
  // has never seen) or with an empty string is also "not translated".
  expect(translateDomainLabel(unknown, (key) => key)).toBe(unknown);
  expect(translateDomainLabel("Airflow", () => "")).toBe("Airflow");
  expect(translateDomainLabel("Airflow", () => null)).toBe("Airflow");
  expect(translateDomainLabel("Airflow", () => undefined)).toBe("Airflow");
});

test("labels are keyed case- and punctuation-insensitively", () => {
  for (const spelling of ["Fire protection", "fire protection", "fire-protection", "Fire_Protection", "FIRE  PROTECTION", " Fire protection. "]) {
    expect({ spelling, turkish: translateDomainLabel(spelling, t) }).toEqual({ spelling, turkish: "Yangın koruma" });
  }
  // A hyphen, a space and a slash are the same key: the three the packs mix.
  for (const spelling of ["K-factor", "K factor", "k factor", "K/Factor"]) {
    expect({ spelling, turkish: translateDomainLabel(spelling, t) }).toEqual({ spelling, turkish: "K faktörü" });
  }
  // The stored keys are already normalised, so a lookup can never miss by spelling.
  const notNormalised = Object.keys(DOMAIN).filter((key) => normalizeDomainKey(key) !== key);
  expect(notNormalised).toEqual([]);
});

test("a non-ASCII or empty label does not throw", () => {
  for (const label of ["Şıhhi tesisat", "Mekân ölçüsü ½", "Duct — çap (Ø)", "МЕП", "", "   ", "🛠", "...", "a".repeat(2000)]) {
    expect(() => translateDomainLabel(label, t)).not.toThrow();
  }
  // An empty label has no key to look up: answering with "" would blank a cell.
  expect(translateDomainLabel("", t)).toBe("");
  expect(translateDomainLabel("   ", t)).toBe("   ");
});

// ---------------------------------------------------------------------------
// The corpus the map has to hold
// ---------------------------------------------------------------------------

test("the guard found the domain corpus it is meant to guard", () => {
  // Without this, a renamed file or a changed `kind(` spelling would leave the
  // checks below scanning nothing and reporting green.
  expect(Object.keys(DOMAIN).length).toBeGreaterThan(300);
  expect(quantityKindLabels().length).toBeGreaterThanOrEqual(50);
  const disciplines = disciplineFiles().flatMap(labelsIn);
  expect(disciplines).toContain("Electrical");
  expect(disciplines).toContain("Architecture");
});

test("the domain namespace is walked by the locale guards", () => {
  // `i18n-parity.test.ts` and `i18n-glossary.test.ts` walk every
  // `locales/tr/*.json`; this file is the kit's second namespace, so a defect in
  // it has to be in the corpus those guards read.
  expect(readTrLocaleFiles().map((file) => file.id)).toContain("packages/bim-ui/locales/tr/domain.json");
});

test("createI18n bundles the domain namespace, so a host gets it for free", () => {
  // Every other package's Turkish travels with its own resource object; `domain`
  // is the kit's, like `common`, or a host would have to know about it.
  expect(i18n.t("electrical", { ns: DOMAIN_NAMESPACE, defaultValue: "Electrical" })).toBe("Elektrik");
});

test("every glossary §1 discipline label is translated", () => {
  const untranslated = disciplineFiles()
    .flatMap(labelsIn)
    .filter((label) => !(normalizeDomainKey(label) in DOMAIN));
  expect(untranslated).toEqual([]);
});

test("every quantity kind label is translated", () => {
  const untranslated = quantityKindLabels().filter((label) => !(normalizeDomainKey(label) in DOMAIN));
  expect(untranslated).toEqual([]);
});
