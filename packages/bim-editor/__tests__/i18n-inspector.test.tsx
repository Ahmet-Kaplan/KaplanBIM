/**
 * The Inspector (the Properties panel's parameter form) in two languages — the
 * half of the tree the negative-space guard cannot see.
 *
 * `i18n-negative-space.test.ts` proves that no English caption in
 * `src/editor/inspector` sits outside a translator (30 sites in three files to
 * zero). It cannot see three things this file does:
 *
 *   1. **The Turkish says the right thing.** §2.1 keeps *parça* for a part, §2.2
 *      *tip* and *tipi düzenle* for a type and Edit type, §2.3 keeps *işaret* for
 *      Mark and *kat* for a level; §7 leaves `ft` and any other unit symbol alone.
 *   2. **Every keyed caption actually has Turkish.** A `t('inspector.…')` call with
 *      no entry in `locales/tr/editor.json` shows English on a Turkish screen and
 *      no guard would say so.
 *   3. **A number typed wrong is said in the language being drawn.**
 *      `parseDisplayText` and `planParameterEdit` take a translator, so
 *      "Width must be a number in ft." is Turkish on a Turkish screen; English is
 *      character for character what it was, because the default is `englishOnly`.
 *
 * **Deferred, and why.** The section legends ("Identity", "Electrical",
 * "Mechanical") are the facet registry's own labels — kernel data, drawn through
 * `groupParametersByFacet` — like the organization tree's `DEFAULT_GROUPS`. They
 * belong to the facet registry's translation, not to this panel's frame.
 */
import { editorSourceCaptions } from "./helpers/editor-source-captions";
import { translateFor } from "./helpers/editor-i18n";
import { editorResources } from "../src/editor/i18n/resources";
import { parseDisplayText, planParameterEdit, type InspectorParameter } from "../src/editor/inspector/parameter-model";

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
  // §2.1/§2.3: a part is a *parça*; its Mark is its *işaret*.
  { key: "inspector.part", english: "Part", turkish: "Parça" },
  { key: "inspector.thisPart", english: "This part", turkish: "Bu parça" },
  { key: "inspector.mark", english: "Mark", turkish: "İşaret" },
  // §2.3: a level is a *kat*.
  { key: "inspector.heightAboveLevel", english: "Height above level (ft)", turkish: "Kat üstü yükseklik (ft)" },
  { key: "inspector.heightIsFeet", english: "Height above the level must be a number of feet.", turkish: "Kat üstü yükseklik bir fit sayısı olmalı." },
  // §2.2/§5: a type is a *tip*, and Edit type is the glossary's own *tipi düzenle*.
  { key: "inspector.editType", english: "Edit type", turkish: "Tipi düzenle" },
  { key: "inspector.editTypeNamed", english: "Edit type: {{name}}", turkish: "Tipi düzenle: {{name}}" },
  { key: "inspector.typeValues", english: "Type values", turkish: "Tip değerleri" },
  { key: "inspector.saveType", english: "Save type", turkish: "Tipi kaydet" },
  { key: "inspector.noTypeValues", english: "This type has no type values.", turkish: "Bu tipin tip değeri yok." },
  { key: "inspector.noTypeValuesWhy", english: "This type has no type values to change", turkish: "Bu tipin değiştirilecek tip değeri yok" },
  // §3: Save changes is a singular command; Cancel is §3's *İptal*.
  { key: "inspector.saveChanges", english: "Save changes", turkish: "Değişiklikleri kaydet" },
  { key: "inspector.cancel", english: "Cancel", turkish: "İptal" },
  { key: "inspector.delete", english: "Delete…", turkish: "Sil…" },
  // §8: the status vocabulary the rest of the editor speaks.
  { key: "inspector.saving", english: "Saving…", turkish: "Kaydediliyor…" },
  { key: "inspector.saved", english: "Saved", turkish: "Kaydedildi" },
  { key: "inspector.notSavedYet", english: "Not saved yet: press Save changes.", turkish: "Henüz kaydedilmedi: Değişiklikleri kaydet'e basın." },
  { key: "inspector.nothingChanged", english: "Nothing changed yet", turkish: "Henüz bir şey değişmedi" },
  // §2.3: a feeder is a *besleme* and a circuit a *devre* — §4.1's own commands.
  { key: "inspector.fedFromWhere", english: "From its feeder. Change it with Feed panel.", turkish: "Besleyicisinden. Panoyu besle ile değiştirin." },
  { key: "inspector.circuitWhere", english: "From its circuit. Change it with Add to circuit or the panel schedule.", turkish: "Devresinden. Devreye ekle ya da pano çizelgesiyle değiştirin." },
  { key: "inspector.fedFromPrints", english: "Schedules print the feeder.", turkish: "Çizelgeler besleyiciyi basar." },
  { key: "inspector.circuitPrints", english: "Schedules and tags print the circuit.", turkish: "Çizelgeler ve etiketler devreyi basar." },
  { key: "inspector.clearTyped", english: "Clear typed text", turkish: "Yazılan metni temizle" },
  { key: "inspector.typedMismatch", english: "The typed {{label}} still says “{{typed}}”. {{prints}}", turkish: "Yazılan {{label}} hâlâ “{{typed}}” diyor. {{prints}}" },
  // §0.7: a sentence addresses the reader politely in the plural.
  { key: "inspector.addedOnSave", english: "Added to this part’s type when you save a value.", turkish: "Bir değer kaydettiğinizde bu parçanın tipine eklenir." },
  { key: "inspector.choose", english: "Choose", turkish: "Seçin" },
  // §7: `ft` is a symbol and travels as one.
  { key: "inspector.mustBeNumberIn", english: "{{label}} must be a number in {{unit}}.", turkish: "{{label}} {{unit}} cinsinden bir sayı olmalı." },
];

/** How many call sites each shared caption has today — a new one is a deliberate bump. */
const SITES: Readonly<Record<string, number>> = {
  // The form's heading and the type list's accessible name.
  "inspector.typeValues": 2,
  // The fallback name on a part with no type, written twice in one expression.
  "inspector.part": 2,
};

const fill = (template: string, values: Readonly<Record<string, string | number>> | undefined): string =>
  values === undefined ? template : template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(values[name]));

const VALUES: Readonly<Record<string, Readonly<Record<string, string | number>>>> = {
  "inspector.editTypeNamed": { name: "Standart" },
  "inspector.typedMismatch": { label: "Beslendiği yer", typed: "LP-1", prints: "Çizelgeler ve etiketler devreyi basar." },
  "inspector.mustBeNumberIn": { label: "Genişlik", unit: "ft" },
};

test("every inspector caption is keyed in the source, with its English unchanged", () => {
  const source = editorSourceCaptions();
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english });
  }
});

test("every inspector caption has Turkish, and it says what the glossary pins", () => {
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, turkish: TURKISH[caption.key] }).toEqual({ key: caption.key, turkish: caption.turkish });
  }
});

test("every inspector key in the source has a Turkish value — no caption falls back to English", () => {
  const source = editorSourceCaptions();
  const missing = [...source.keys()].filter((key) => key.startsWith("inspector.")).filter((key) => TURKISH[key] === undefined || TURKISH[key] === "");
  expect(missing).toEqual([]);
});

test("a caption is still keyed at every place it is written", () => {
  const source = editorSourceCaptions();
  for (const [key, sites] of Object.entries(SITES)) {
    expect({ key, sites: source.get(key)?.sites }).toEqual({ key, sites });
  }
});

test("no shared inspector caption is unpinned: every key written twice is in SITES", () => {
  const twice = [...editorSourceCaptions().entries()].filter(([key, caption]) => key.startsWith("inspector.") && caption.sites > 1);
  expect(twice.filter(([key]) => SITES[key] === undefined).map(([key, caption]) => `${key} (${caption.sites} sites)`)).toEqual([]);
});

test("the Turkish placeholder in an inspector caption matches the English one", () => {
  const placeholders = (text: string): string[] =>
    [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/gu)].map((match) => match[1] ?? "").sort();
  const source = editorSourceCaptions();
  const wrong = [...source.entries()]
    .filter(([key]) => key.startsWith("inspector."))
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

/** One quantity parameter, the way the inspector builds it from a part's type. */
const QUANTITY: InspectorParameter = {
  name: "width",
  key: "width",
  label: "Width",
  scope: "instance",
  valueType: "quantity",
  storedUnit: "mm",
  displayUnit: "ft",
  source: "part",
};

test("a number typed wrong is said in the language being drawn, and English is unchanged", () => {
  // The label is the part's own data — in English a part says "Width", in a
  // Turkish part it says "Genişlik" — so the words *around* it are what this checks.
  expect(parseDisplayText(QUANTITY, "wide")).toEqual({ problem: "Width must be a number in ft." });
  expect(parseDisplayText(QUANTITY, "wide", TR)).toEqual({ problem: "Width ft cinsinden bir sayı olmalı." });
  // A parameter whose unit is the unitless one says the shorter sentence.
  expect(parseDisplayText({ ...QUANTITY, displayUnit: "1" }, "wide", TR)).toEqual({ problem: "Width bir sayı olmalı." });
  expect(parseDisplayText({ ...QUANTITY, displayUnit: "1" }, "wide")).toEqual({ problem: "Width must be a number." });
  // Reading a good number is untouched by the language.
  expect(parseDisplayText(QUANTITY, "3.5", TR)).toEqual(parseDisplayText(QUANTITY, "3.5"));
});

test("a save's refusal is the language being drawn, and the values it sends are the same", () => {
  const type = {
    id: "type-1",
    typeName: "Standart",
    category: "mechanical_equipment",
    typeParams: [{ name: "width", label: "Genişlik", kind: "length", unit: "mm", min: 1 }],
    instanceParams: [],
    typeValues: {},
    connectors: [],
    geometry: [],
    symbol: [],
    tagFields: [],
    familyName: "Standart",
    source: { kind: "builtin", libraryVersion: "test" },
  } as unknown as Parameters<typeof planParameterEdit>[0];
  const part = { id: "p1", kind: "part", typeId: "type-1", mark: "1", values: {}, offsetMm: 0 } as unknown as Parameters<typeof planParameterEdit>[1];
  // A text that is not a number is refused in Turkish, not in English.
  expect(planParameterEdit(type, part, [QUANTITY], { width: "wide" }, "instance", TR)).toEqual({ problem: "Width ft cinsinden bir sayı olmalı." });
  // A good one is the same value either way.
  const sent = planParameterEdit(type, part, [QUANTITY], { width: "3" }, "instance", TR);
  expect('values' in sent ? Object.keys(sent.values) : []).toEqual(['width']);
});
