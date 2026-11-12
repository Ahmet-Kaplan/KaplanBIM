/**
 * The checklist tree in two languages — the half the negative-space guard cannot
 * see.
 *
 * `i18n-negative-space.test.ts` proves that no English caption in
 * `src/editor/checklist` sits outside a translator (**119** sites in four files,
 * zero). It cannot see three things this file does:
 *
 *   1. **The Turkish says the right thing.** §8's status and refusal vocabulary is
 *      pinned word by word (*doğrulandı*, *karşılanmadı*, *bekliyor*), and the
 *      coordination words §5.11 fixed (*clash* = **çakışma**, *finding* = **bulgu**)
 *      are the ones a merge conflict uses.
 *   2. **Every keyed caption actually has Turkish.** A `t('checklist.…')` call with
 *      no entry in `locales/tr/editor.json` shows English on a Turkish screen.
 *   3. **A sentence is one key.** "Couldn’t accept it. Try again." was built from a
 *      verb and a noun (`Couldn’t ${what}.`); that order is English's, so every
 *      action now carries a whole sentence instead.
 */
import { editorSourceCaptions } from "./helpers/editor-source-captions";
import { translateFor } from "./helpers/editor-i18n";
import { editorResources } from "../src/editor/i18n/resources";
import { fulfilmentLabel, statusLabel, valueLabel } from "../src/editor/checklist/checklist-model";
import type { Requirement } from "@permitzip/bim-kernel";

const TR = translateFor("tr");
const EN = translateFor("en");

/** The editor's Turkish, flattened to the dotted keys the call sites use. */
function flatten(node: unknown, prefix = ""): Record<string, string> {
  if (typeof node === "string") return { [prefix]: node };
  if (typeof node !== "object" || node === null) return {};
  return Object.entries(node as Record<string, unknown>).reduce<Record<string, string>>(
    (out, [key, value]) => Object.assign(out, flatten(value, prefix === "" ? key : `${prefix}.${key}`)),
    {},
  );
}

const TURKISH = flatten((editorResources.tr as Record<string, unknown> | undefined)?.editor);
const IN_SOURCE = [...editorSourceCaptions().keys()].filter((key) => key.startsWith("checklist."));

interface Caption {
  readonly key: string;
  readonly english: string;
  readonly turkish: string;
}

const CAPTIONS: readonly Caption[] = [
  // §3 and §8: a dialog's own two buttons.
  { key: "checklist.cancel", english: "Cancel", turkish: "İptal" },
  { key: "checklist.retry", english: "Retry", turkish: "Yeniden dene" },
  // §5.11: a conflict between two sources is a çakışma; a finding is a bulgu.
  { key: "checklist.merges.oneConflict", english: "1 conflict with Main to resolve on the branch first", turkish: "Önce dalda çözülecek 1 çakışma (Main ile)" },
  { key: "checklist.merges.conflicts", english: "{{count}} conflicts with Main to resolve on the branch first", turkish: "Önce dalda çözülecek {{count}} çakışma (Main ile)" },
  // §2.3/§2.4: the rail's own words, and Manage › Responsibilities.
  { key: "checklist.merges.heading", english: "Merges waiting for you", turkish: "Sizi bekleyen birleştirmeler" },
  { key: "checklist.merges.empty", english: "No merges are waiting for you.", turkish: "Sizi bekleyen birleştirme yok." },
  // §8: the override form requires a reason, and says what the reason is for.
  { key: "checklist.override.reason", english: "Reason (required)", turkish: "Gerekçe (zorunlu)" },
  {
    key: "checklist.override.why",
    english: "Say why you are overriding it; the reason travels with the model and is offered to its code study.",
    turkish: "Neden geçersiz kıldığınızı yazın; gerekçe modelle birlikte gider ve kod çalışmasına sunulur.",
  },
  // §0.7: a sentence addresses the reader politely in the plural.
  { key: "checklist.override.value", english: "Enter the value that should apply here.", turkish: "Burada geçerli olması gereken değeri girin." },
  { key: "checklist.decision.record", english: "Record decision", turkish: "Kararı kaydet" },
  { key: "checklist.confidence.high", english: "High", turkish: "Yüksek" },
  { key: "checklist.confidence.medium", english: "Medium", turkish: "Orta" },
  { key: "checklist.confidence.low", english: "Low", turkish: "Düşük" },
  // §8: verifying is doğrulama; the Code Map keeps its product name.
  { key: "checklist.verify.action", english: "Verify", turkish: "Doğrula" },
  { key: "checklist.openCodeMap", english: "Open in Code Map", turkish: "Kod Haritası’nda aç" },
  // §8: a number is followed by a singular noun.
  { key: "checklist.openCount", english: "{{count}} open", turkish: "{{count}} açık" },
  { key: "checklist.andMore", english: "and {{count}} more", turkish: "ve {{count}} tane daha" },
  // One sentence, one key: the number changes its grammar, so both shapes are ours.
  {
    key: "checklist.merges.acceptFailed",
    english: "Couldn’t accept it. Try again.",
    turkish: "Kabul edilemedi. Yeniden deneyin.",
  },
  {
    key: "checklist.merges.declinedIt",
    english: "Declined {{part}} on {{branch}}. The proposer sees why.",
    turkish: "{{part}} {{branch}} üzerinde reddedildi. Öneren nedenini görür.",
  },
  {
    key: "checklist.sensitivity.cannotList",
    english: "Couldn’t list what {{what}} drives: {{reason}}",
    turkish: "{{what}} neleri belirliyor listelenemedi: {{reason}}",
  },
  {
    key: "checklist.sensitivity.moreOne",
    english: "and {{count}} more input drives at least one requirement",
    turkish: "ve {{count}} girdi daha en az bir gerekliliği belirliyor",
  },
];

const VALUES: Readonly<Record<string, Readonly<Record<string, string | number>>>> = {
  "checklist.merges.conflicts": { count: 3 },
  "checklist.openCount": { count: 4 },
  "checklist.andMore": { count: 2 },
  "checklist.merges.declinedIt": { part: "Mekanik", branch: "lobi-2" },
  "checklist.sensitivity.cannotList": { what: "Kullanım", reason: "grafik okunamadı" },
  "checklist.sensitivity.moreOne": { count: 1 },
};

const fill = (template: string, values: Readonly<Record<string, string | number>> | undefined): string =>
  values === undefined ? template : template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(values[name]));

test("every checklist caption is still keyed in the source, with its English unchanged", () => {
  const source = editorSourceCaptions();
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english });
  }
});

test("every checklist caption has Turkish, and it says what the glossary pins", () => {
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, turkish: TURKISH[caption.key] }).toEqual({ key: caption.key, turkish: caption.turkish });
  }
});

test("every checklist key in the source has a Turkish value — no caption falls back to English", () => {
  expect(IN_SOURCE.length).toBeGreaterThan(60);
  expect(IN_SOURCE.filter((key) => (TURKISH[key] ?? "").trim() === "")).toEqual([]);
});

test("no checklist key is translated without a call site", () => {
  const written = new Set(IN_SOURCE);
  expect(Object.keys(TURKISH).filter((key) => key.startsWith("checklist.")).filter((key) => !written.has(key))).toEqual([]);
});

test("the Turkish placeholder in a checklist caption matches the English one", () => {
  const placeholders = (text: string): string[] => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/gu)].map((match) => match[1] ?? "").sort();
  const source = editorSourceCaptions();
  const wrong = [...source.entries()]
    .filter(([key]) => key.startsWith("checklist."))
    .map(([key, caption]) => ({ key, english: placeholders(caption.english), turkish: placeholders(TURKISH[key] ?? "") }))
    .filter((row) => row.english.join(",") !== row.turkish.join(","));
  expect(wrong).toEqual([]);
});

test("a placeholder is never written with one brace", () => {
  expect(
    Object.entries(TURKISH)
      .filter(([key]) => key.startsWith("checklist."))
      .filter(([, value]) => /(^|[^{])\{[A-Za-z0-9_]+\}/u.test(value))
      .map(([key]) => key),
  ).toEqual([]);
});

test("the caption list in this file is filled the way a call site fills it", () => {
  for (const caption of CAPTIONS) {
    const values = VALUES[caption.key];
    expect({ key: caption.key, text: TR(caption.key, caption.english, { ...values, ns: "editor" }) }).toEqual({
      key: caption.key,
      text: fill(caption.turkish, values),
    });
    expect({ key: caption.key, text: EN(caption.key, caption.english, { ...values, ns: "editor" }) }).toEqual({
      key: caption.key,
      text: fill(caption.english, values),
    });
  }
});

// ---------------------------------------------------------------------------
// The status words: one table, in the language being read
// ---------------------------------------------------------------------------

/** A requirement as the graph holds it, with only the fields these labels read. */
const requirement = (patch: Partial<Record<string, unknown>>): Requirement => ({ status: "proposed", ruleVerification: "verified", fulfilment: { state: "met" }, ...patch }) as unknown as Requirement;

test("§8: a requirement's status is a Turkish word, and English reads as it always did", () => {
  expect(statusLabel(requirement({ status: "verified" }), EN)).toBe("Verified");
  expect(statusLabel(requirement({ status: "verified" }), TR)).toBe("Doğrulandı");
  expect(statusLabel(requirement({ status: "overridden" }), TR)).toBe("Geçersiz kılındı");
  expect(statusLabel(requirement({ status: "withdrawn" }), TR)).toBe("Geri çekildi");
  expect(statusLabel(requirement({ ruleVerification: "verified" }), TR)).toBe("Kod çalışmasında doğrulandı");
  expect(statusLabel(requirement({ ruleVerification: "invalidated" }), TR)).toBe("Kod çalışmasında elendi");
  expect(statusLabel(requirement({ ruleVerification: "unknown" }), TR)).toBe("Önerildi");
  expect(statusLabel(requirement({ ruleVerification: "verified" }), EN)).toBe("Verified in its code study");
});

test("§8: how the model meets a requirement is Turkish too", () => {
  expect(fulfilmentLabel(requirement({ fulfilment: { state: "met" } }), EN)).toBe("Met");
  expect(fulfilmentLabel(requirement({ fulfilment: { state: "met" } }), TR)).toBe("Karşılandı");
  expect(fulfilmentLabel(requirement({ fulfilment: { state: "not_met" } }), TR)).toBe("Karşılanmadı");
  expect(fulfilmentLabel(requirement({ fulfilment: { state: "open" } }), TR)).toBe("Henüz çizilmedi");
  expect(fulfilmentLabel(requirement({ fulfilment: { state: "unchecked" } }), TR)).toBe("Model denetimi yok; bir kişi onaylar");
  // A summary the graph wrote is data: it is shown as it is, in either language.
  expect(fulfilmentLabel(requirement({ fulfilment: { state: "met", summary: "2 of 2 exits" } }), TR)).toBe("2 of 2 exits");
});

test("§7 and §8: a value keeps its unit symbol and its comparison in words", () => {
  expect(valueLabel({ value: 90, unit: "min", compare: "at_most" }, EN)).toBe("at most 90 min");
  expect(valueLabel({ value: 90, unit: "min", compare: "at_most" }, TR)).toBe("en çok 90 min");
  expect(valueLabel({ value: 2, unit: "ea", compare: "at_least" }, TR)).toBe("en az 2 ea");
  expect(valueLabel({ value: 2, unit: "1", compare: undefined as never }, TR)).toBe("2");
  expect(valueLabel({ value: null, unit: "ft", compare: "at_least" }, TR)).toBe(null);
});
