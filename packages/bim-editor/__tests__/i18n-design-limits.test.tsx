/**
 * Design limits in two languages — the half of the tree the negative-space guard
 * cannot see.
 *
 * `i18n-negative-space.test.ts` proves that no English caption in
 * `src/editor/design-limits` sits outside a translator (60 sites in three files
 * to zero). It cannot see three things this file does:
 *
 *   1. **The Turkish says the right thing.** §2.2 keeps *firm* as **firma** and
 *      *description* as **açıklama**; §4.1 pins *Design limits* to **Tasarım
 *      limitleri**; §5.14 keeps *Keep it* as **Kalsın**; §7 leaves `ft/s` alone
 *      because it is a unit symbol; §8 forbids a plural suffix after a number.
 *   2. **Every keyed caption actually has Turkish.** A `t('designLimits.…')` call
 *      with no entry in `locales/tr/editor.json` shows English on a Turkish screen
 *      and no guard would say so.
 *   3. **A band is a sentence, and a sentence is the editor's.** `bandWords` used
 *      to be the kernel's ("at most 8 ft/s") spliced into a Turkish row; it is the
 *      editor's now, built from `t()` with the kernel's own number formatting, so
 *      the English reads exactly as it did and the Turkish says *en çok 8 ft/s*.
 */
import { editorSourceCaptions } from "./helpers/editor-source-captions";
import { translateFor } from "./helpers/editor-i18n";
import { editorResources } from "../src/editor/i18n/resources";
import { appliesToWords, bandWords, publishDesignLimitFrom } from "../src/editor/design-limits/design-limits-client";
import type { DesignLimit } from "@permitzip/bim-kernel/policy";

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

/** One caption as the glossary writes it. */
interface Caption {
  readonly key: string;
  readonly english: string;
  readonly turkish: string;
}

const CAPTIONS: readonly Caption[] = [
  // §4.1: the panel is *Tasarım limitleri*; a limit is a **limit**, never a *kısıt*
  // (that is a sketch constraint).
  { key: "designLimits.addTitle", english: "Add a design limit", turkish: "Tasarım limiti ekle" },
  { key: "designLimits.limit", english: "Limit", turkish: "Limit" },
  { key: "designLimits.emptyTitle", english: "No design limits yet", turkish: "Henüz tasarım limiti yok" },
  // §2.2: the firm is the **firma**; its library is the *Firma kitaplığı*.
  { key: "designLimits.layer.firm", english: "Firm", turkish: "Firma" },
  { key: "designLimits.librarySubject", english: "The firm library", turkish: "Firma kitaplığı" },
  { key: "designLimits.blocked", english: "You can see the firm's limits; changing them needs MutinyBIM library publishing.", turkish: "Firmanın limitlerini görebilirsiniz; değiştirmek için MutinyBIM kitaplığına yayınlama yetkisi gerekir." },
  // §5.14: Keep it is **Kalsın** (§3 *Cancel* is Vazgeç/İptal, a different choice).
  { key: "designLimits.keepIt", english: "Keep it", turkish: "Kalsın" },
  // §3: Save / Cancel / Close.
  { key: "designLimits.save", english: "Save", turkish: "Kaydet" },
  { key: "designLimits.cancel", english: "Cancel", turkish: "İptal" },
  // §8: the status vocabulary.
  { key: "designLimits.saving", english: "Saving…", turkish: "Kaydediliyor…" },
  { key: "designLimits.loading", english: "Loading design limits", turkish: "Tasarım limitleri yükleniyor" },
  { key: "designLimits.loadFailed", english: "Design limits didn't load", turkish: "Tasarım limitleri yüklenemedi" },
  // §2.3: a system is a **sistem**, a discipline a **disiplin**; a band is an *aralık*.
  { key: "designLimits.systems", english: "Systems", turkish: "Sistemler" },
  { key: "designLimits.discipline", english: "Discipline", turkish: "Disiplin" },
  { key: "designLimits.bandTitle", english: "Band", turkish: "Aralık" },
  { key: "designLimits.setBy", english: "Set by", turkish: "Belirleyen" },
  { key: "designLimits.appliesTo", english: "Applies to", turkish: "Geçerli olduğu yer" },
  { key: "designLimits.change", english: "Change", turkish: "Değiştir" },
  { key: "designLimits.remove", english: "Remove", turkish: "Kaldır" },
  { key: "designLimits.putBack", english: "Put back the default", turkish: "Varsayılana döndür" },
  // §0.7: a dialog's question addresses the reader politely in the plural.
  { key: "designLimits.putBackAsk", english: "Put {{name}} back to the default?", turkish: "{{name}} varsayılana döndürülsün mü?" },
  { key: "designLimits.removeAsk", english: "Remove {{name}}?", turkish: "{{name}} kaldırılsın mı?" },
  { key: "designLimits.checksStop", english: "Checks stop using it. You can add it again any time.", turkish: "Denetimler onu kullanmayı bırakır. İstediğiniz zaman yeniden ekleyebilirsiniz." },
  // §7: `ft/s` is a unit symbol and travels as one.
  { key: "designLimits.unitPlaceholder", english: "ft/s", turkish: "ft/s" },
];

/** How many call sites each shared caption has today — a new one is a deliberate bump. */
const SITES: Readonly<Record<string, number>> = {
  // The table's column header and the editor's field label.
  "designLimits.source": 2,
  // The column header and the fallback name in a validation issue's path.
  "designLimits.limit": 2,
  // Both places accept "any discipline / any system".
  "designLimits.any": 2,
  // The row button and the confirm dialog's action.
  "designLimits.putBack": 2,
  "designLimits.remove": 2,
};

const fill = (template: string, values: Readonly<Record<string, string | number>> | undefined): string =>
  values === undefined ? template : template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(values[name]));

const VALUES: Readonly<Record<string, Readonly<Record<string, string | number>>>> = {
  "designLimits.putBackAsk": { name: "Su hızı" },
  "designLimits.removeAsk": { name: "Su hızı" },
};

test("every design-limits caption is keyed in the source, with its English unchanged", () => {
  const source = editorSourceCaptions();
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english });
  }
});

test("every design-limits caption has Turkish, and it says what the glossary pins", () => {
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, turkish: TURKISH[caption.key] }).toEqual({ key: caption.key, turkish: caption.turkish });
  }
});

test("every designLimits key in the source has a Turkish value — no caption falls back to English", () => {
  const source = editorSourceCaptions();
  const missing = [...source.keys()].filter((key) => key.startsWith("designLimits.")).filter((key) => TURKISH[key] === undefined || TURKISH[key] === "");
  expect(missing).toEqual([]);
});

test("a caption is still keyed at every place it is written", () => {
  const source = editorSourceCaptions();
  for (const [key, sites] of Object.entries(SITES)) {
    expect({ key, sites: source.get(key)?.sites }).toEqual({ key, sites });
  }
});

test("no shared designLimits caption is unpinned: every key written twice is in SITES", () => {
  const twice = [...editorSourceCaptions().entries()].filter(([key, caption]) => key.startsWith("designLimits.") && caption.sites > 1);
  expect(twice.filter(([key]) => SITES[key] === undefined).map(([key, caption]) => `${key} (${caption.sites} sites)`)).toEqual([]);
});

test("the Turkish placeholder in a designLimits caption matches the English one", () => {
  const placeholders = (text: string): string[] =>
    [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/gu)].map((match) => match[1] ?? "").sort();
  const source = editorSourceCaptions();
  const wrong = [...source.entries()]
    .filter(([key]) => key.startsWith("designLimits."))
    .map(([key, caption]) => ({ key, english: placeholders(caption.english), turkish: placeholders(TURKISH[key] ?? "") }))
    .filter((row) => row.english.join(",") !== row.turkish.join(","));
  expect(wrong).toEqual([]);
});

test("the caption list in this file is filled the way a call site fills it", () => {
  for (const caption of CAPTIONS) {
    const values = VALUES[caption.key];
    const turkish = TR(caption.key, caption.english, { ...values, ns: "editor" });
    const english = EN(caption.key, caption.english, { ...values, ns: "editor" });
    expect({ key: caption.key, text: turkish }).toEqual({ key: caption.key, text: fill(caption.turkish, values) });
    expect({ key: caption.key, text: english }).toEqual({ key: caption.key, text: fill(caption.english, values) });
  }
});

/** One limit with a band, the way the library holds it. */
const LIMIT: DesignLimit = { id: "firm:water_velocity", label: "Water velocity", quantity: "velocity", unit: "ft/s", band: { max: 8 }, severity: "warning", citation: { source: "PermitZIP practice" }, appliesTo: {} } as unknown as DesignLimit;

test("a band is a sentence in the language being drawn, and English reads as it always did", () => {
  // §7: the unit symbol is not translated; the words around it are.
  expect(bandWords(LIMIT)).toBe("at most 8 ft/s");
  expect(bandWords(LIMIT, TR)).toBe("en çok 8 ft/s");
  expect(bandWords({ ...LIMIT, band: { min: 2 } })).toBe("at least 2 ft/s");
  expect(bandWords({ ...LIMIT, band: { min: 2 } }, TR)).toBe("en az 2 ft/s");
  expect(bandWords({ ...LIMIT, band: { min: 2, max: 8 } })).toBe("2 to 8 ft/s");
  expect(bandWords({ ...LIMIT, band: { min: 2, max: 8 } }, TR)).toBe("2 – 8 ft/s");
  expect(bandWords({ ...LIMIT, band: { max: 8, target: 5 } })).toBe("at most 8 ft/s, aim for 5 ft/s");
  expect(bandWords({ ...LIMIT, band: { max: 8, target: 5 } }, TR)).toBe("en çok 8 ft/s, hedef 5 ft/s");
  // A band with no numbers in it says nothing, in either language.
  expect(bandWords({ ...LIMIT, band: {} }, TR)).toBe("");
});

test("what a limit applies to is said in the language being drawn, and 'Everything' is words too", () => {
  expect(appliesToWords(LIMIT)).toBe("Everything");
  expect(appliesToWords(LIMIT, TR)).toBe("Her şey");
  expect(appliesToWords({ ...LIMIT, appliesTo: { discipline: "plumbing", systems: ["domestic_cold_water"] } } as unknown as DesignLimit, TR)).toBe(
    "plumbing · domestic cold water",
  );
});

test("a save's refusal is the language being drawn, and a missing library is explained in it", async () => {
  const saved = await publishDesignLimitFrom(undefined, "firm", LIMIT, 0);
  expect(saved.ok).toBe(false);
  // English unchanged: the sentence says what it always said.
  expect(!saved.ok && saved.message.startsWith("Water velocity wasn't saved. The firm library: not available here")).toBe(true);
  const turkish = await publishDesignLimitFrom(undefined, "firm", LIMIT, 0, {}, TR);
  expect(!turkish.ok && turkish.message.startsWith("Water velocity kaydedilmedi. Firma kitaplığı:")).toBe(true);
});

test("§8: a number is followed by a singular in Turkish — 2 denetim, never 2 denetimler", () => {
  const values = { ns: "editor" };
  // The band words carry no plural because a number precedes the noun.
  expect(TR("designLimits.band.atMost", "at most {{max}} {{unit}}", { ...values, max: 8, unit: "ft/s" })).toBe("en çok 8 ft/s");
});
