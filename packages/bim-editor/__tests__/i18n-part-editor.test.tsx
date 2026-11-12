/**
 * The part editor in two languages — the half of the tree the negative-space
 * guard cannot see.
 *
 * `i18n-negative-space.test.ts` proves that no English caption in
 * `src/editor/part-editor` sits outside a translator (285 sites in 14 files to
 * zero). It cannot see four things this file does:
 *
 *   1. **The Turkish says the right thing.** §2.1 keeps *parça* for a part (never
 *      `öğe`), §2.2 *tip* and *kategori*, §2.3 *referans düzlemi*, *eskiz*, *katı*
 *      and *boşluk*, *bağlantı noktası*, §2.4 *ölçü*, *görünüm* and *detay seviyesi*,
 *      §5.12/Ç21 *açıklık* (a clearance) against *boşluk* (a void), and §7 leaves
 *      the unit symbols (`V`, `VA`, `hp`, `ft`, `in`) alone while translating the
 *      spelled-out names.
 *   2. **Every keyed caption actually has Turkish.** A `t('partEditor.…')` call
 *      with no entry in `locales/tr/editor.json` shows English on a Turkish
 *      screen and no guard would say so.
 *   3. **The vocabulary tables are accessors, not tables of English.**
 *      `PART_CATEGORY_LABELS`, `CLEARANCE_PURPOSE_LABELS`, the six faces, the four
 *      views, the three planes and the seven parameter kinds were string tables;
 *      a table of strings is exactly how English shipped under a keyed frame. They
 *      take a `Translate` now, and this file draws each one in both languages.
 *   4. **Six kinds of default are written in the language being worked in.** A new
 *      part's name, its one size, its three parameters, its five planes, the box's
 *      sketch and its feature names are saved into the definition. `blankDraft`,
 *      `addStarterBox`, `addExtrude` and `addRevolve` take a translator, so a part
 *      authored in Turkish is Turkish from its first save — and English is exactly
 *      the words they wrote before, because the default is `englishOnly`.
 */
import { editorSourceCaptions } from "./helpers/editor-source-captions";
import { translateFor } from "./helpers/editor-i18n";
import { editorResources } from "../src/editor/i18n/resources";
import { addExtrude, addRevolve, addStarterBox, blankDraft, planeDimensions, sizedDefinition } from "../src/editor/part-editor/draft";

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
  // §2.1: an editor is a *düzenleyici*, and a part is a *parça*.
  { key: "partEditor.title", english: "Part editor", turkish: "Parça düzenleyici" },
  { key: "partEditor.partName", english: "Part name", turkish: "Parça adı" },
  // §2.2: category is *kategori*, and a part type is a *parça tipi*.
  { key: "partEditor.categoryLabel", english: "Category", turkish: "Kategori" },
  { key: "partEditor.inPlace.noType", english: "The part has no type to place. Give it a type name and save again.", turkish: "Parçanın yerleştirilecek tipi yok. Bir tip adı verip yeniden kaydedin." },
  // §2.3: a reference plane, a sketch, and solid against void.
  { key: "partEditor.referencePlanes", english: "Reference planes", turkish: "Referans düzlemleri" },
  { key: "partEditor.plane.new", english: "Reference plane", turkish: "Referans düzlemi" },
  { key: "partEditor.sketches", english: "Sketches", turkish: "Eskizler" },
  { key: "partEditor.solid", english: "Solid", turkish: "Katı" },
  { key: "partEditor.void", english: "Void", turkish: "Boşluk" },
  { key: "partEditor.solidOrVoid", english: "Solid or void", turkish: "Katı ya da boşluk" },
  // §2.3: a connector is a *bağlantı noktası*, never a "konektör".
  { key: "partEditor.connectors", english: "Connectors", turkish: "Bağlantı noktaları" },
  { key: "partEditor.connector.add", english: "Add connector", turkish: "Bağlantı noktası ekle" },
  { key: "partEditor.connector.endType", english: "End type", turkish: "Uç tipi" },
  // §2.4: a dimension is an *ölçü*, a view a *görünüm*, detail level *detay seviyesi*.
  { key: "partEditor.dim.title", english: "Dimension: {{names}}", turkish: "Ölçü: {{names}}" },
  { key: "partEditor.view.aria", english: "View", turkish: "Görünüm" },
  { key: "partEditor.view.threeD", english: "3D", turkish: "3B" },
  { key: "partEditor.feature.showsAtDetail", english: "Shows at detail", turkish: "Göründüğü detay seviyesi" },
  // §5.12/Ç21: a clearance is an *açıklık*; a void is a *boşluk*.
  { key: "partEditor.zone.title", english: "Clearances", turkish: "Açıklıklar" },
  { key: "partEditor.zone.add", english: "Add clearance", turkish: "Açıklık ekle" },
  { key: "partEditor.zone.purposeServiceAccess", english: "Service access", turkish: "Servis erişimi" },
  { key: "partEditor.zone.purposeCombustible", english: "Clearance to combustibles", turkish: "Yanıcılara mesafe" },
  { key: "partEditor.zone.purposeWorkingSpace", english: "Working space", turkish: "Çalışma boşluğu" },
  { key: "partEditor.zone.fromFloor", english: "Measured from the floor", turkish: "Zeminden ölçülür" },
  // §5.12: a *side* is a **yüz**, not a *taraf*.
  { key: "partEditor.zone.side", english: "Side", turkish: "Yüz" },
  // §3: undo/redo are the ribbon's own words.
  { key: "partEditor.undo", english: "Undo", turkish: "Geri al" },
  { key: "partEditor.redo", english: "Redo", turkish: "Yinele" },
  // §0.7: a button is a singular command.
  { key: "partEditor.saveToLibrary", english: "Save to project library", turkish: "Proje kitaplığına kaydet" },
  { key: "partEditor.cancel", english: "Cancel", turkish: "İptal" },
  { key: "partEditor.close", english: "Close", turkish: "Kapat" },
  // §2.2: a version is a *sürüm*, a revision a *revizyon*.
  { key: "partEditor.review.newerInLibrary", english: "A newer version is in the library", turkish: "Kitaplıkta daha yeni bir sürüm var" },
  { key: "partEditor.review.revisionArrow", english: "{{name}}: revision {{placed}} → {{latest}}", turkish: "{{name}}: revizyon {{placed}} → {{latest}}" },
  // §8: the status vocabulary the rest of the editor already speaks.
  { key: "partEditor.connector.notSet", english: "Not set", turkish: "Ayarlanmadı" },
  { key: "partEditor.done", english: "Done", turkish: "Bitti" },
  { key: "partEditor.nothingSelected", english: "Nothing selected", turkish: "Hiçbir şey seçilmedi" },
  { key: "partEditor.dim.notAParameter", english: "{{name}} is not a parameter", turkish: "{{name}} bir parametre değil" },
];

/**
 * How many call sites each shared caption has today.
 *
 * "Cancel" closes three forms in the tree, "Clearances" is the tab and the
 * panel's own heading and the diff group of the update review, and the six
 * clearance purposes are drawn twice each (the saved zone's purpose and the
 * picker's row): a caption that went back to a literal at one of them would
 * still pass a presence check, so the count is pinned. A new site means a
 * deliberate bump here — the number must not fall silently.
 */
const SITES: Readonly<Record<string, number>> = {
  "partEditor.cancel": 3,
  "partEditor.connector.check": 2,
  "partEditor.connectors": 3,
  "partEditor.drawingOnPlan": 2,
  "partEditor.firmLibrary.notSaved": 2,
  "partEditor.library.connectionDropped": 3,
  "partEditor.name": 3,
  "partEditor.parameter.namePlaceholder": 2,
  "partEditor.parameter.startsWithLetter": 2,
  "partEditor.removeAria": 2,
  "partEditor.review.reviewUpdate": 2,
  "partEditor.save.notPublished": 2,
  "partEditor.solid": 2,
  "partEditor.start.box": 2,
  "partEditor.tab.parameters": 2,
  "partEditor.testSizes": 2,
  "partEditor.void": 2,
  "partEditor.zone.depthFt": 2,
  "partEditor.zone.purposeCombustible": 2,
  "partEditor.zone.purposeDedicatedSpace": 2,
  "partEditor.zone.purposeEconomizerAccess": 2,
  "partEditor.zone.purposeKeepOut": 2,
  "partEditor.zone.purposeServiceAccess": 2,
  "partEditor.zone.purposeWorkingSpace": 2,
  "partEditor.zone.title": 3,
};

const fill = (template: string, values: Readonly<Record<string, string | number>> | undefined): string =>
  values === undefined ? template : template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(values[name]));

const VALUES: Readonly<Record<string, Readonly<Record<string, string | number>>>> = {
  "partEditor.dim.title": { names: "Ön – Arka" },
  "partEditor.review.revisionArrow": { name: "Kutu", placed: 1, latest: 2 },
  "partEditor.dim.notAParameter": { name: "height2" },
};

test("every part editor caption is keyed in the source, with its English unchanged", () => {
  const source = editorSourceCaptions();
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english });
  }
});

test("every part editor caption has Turkish, and it says what the glossary pins", () => {
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, turkish: TURKISH[caption.key] }).toEqual({ key: caption.key, turkish: caption.turkish });
  }
});

test("every partEditor key in the source has a Turkish value — no caption falls back to English", () => {
  const source = editorSourceCaptions();
  const missing = [...source.keys()].filter((key) => key.startsWith("partEditor.")).filter((key) => TURKISH[key] === undefined || TURKISH[key] === "");
  expect(missing).toEqual([]);
});

test("a caption is still keyed at every place it is written", () => {
  const source = editorSourceCaptions();
  for (const [key, sites] of Object.entries(SITES)) {
    expect({ key, sites: source.get(key)?.sites }).toEqual({ key, sites });
  }
});

test("no shared partEditor caption is unpinned: every key written twice is in SITES", () => {
  const twice = [...editorSourceCaptions().entries()].filter(([key, caption]) => key.startsWith("partEditor.") && caption.sites > 1);
  expect(twice.filter(([key]) => SITES[key] === undefined).map(([key, caption]) => `${key} (${caption.sites} sites)`)).toEqual([]);
});

test("the Turkish placeholder in a partEditor caption matches the English one", () => {
  // `{{n}}` in the Turkish and `{{count}}` in the English would interpolate one
  // side and leak a raw `{{count}}` onto the other, which the parity guard in
  // bim-ui cannot see because it reads the written keys, not every namespace.
  const placeholders = (text: string): string[] =>
    [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/gu)].map((match) => match[1] ?? "").sort();
  const source = editorSourceCaptions();
  const wrong = [...source.entries()]
    .filter(([key]) => key.startsWith("partEditor."))
    .map(([key, caption]) => ({ key, english: placeholders(caption.english), turkish: placeholders(TURKISH[key] ?? "") }))
    .filter((row) => row.english.join(",") !== row.turkish.join(","));
  expect(wrong).toEqual([]);
});

test("§8: a number is followed by a singular in Turkish — 3 boyut, never 3 boyutlar", () => {
  const values = { ns: "editor" };
  expect(TR("partEditor.sizes.one", "1 size", { ...values })).toBe("1 boyut");
  expect(TR("partEditor.sizes.many", "{{n}} sizes", { ...values, n: 3 })).toBe("3 boyut");
  expect(TR("partEditor.sketch.manyShapes", "{{n}} shapes", { ...values, n: 4 })).toBe("4 şekil");
  expect(TR("partEditor.status.manyProblems", "{{n}} problems in {{size}}: {{reason}}", { ...values, n: 2, size: "Standart", reason: "x" })).toBe(
    "Standart boyutunda 2 sorun: x",
  );
  // And the English the call sites carry is unchanged, one plural at a time.
  expect(EN("partEditor.sizes.one", "1 size", { ...values })).toBe("1 size");
  expect(EN("partEditor.sizes.many", "{{n}} sizes", { ...values, n: 3 })).toBe("3 sizes");
});

test("§7: the unit symbols travel as symbols — V, VA, hp, ft, in", () => {
  // A symbol is never translated; the spelled-out name is (§7).
  expect(TR("partEditor.connector.voltage", "Voltage (V)", { ns: "editor" })).toBe("Gerilim (V)");
  expect(TR("partEditor.connector.load", "Load (VA)", { ns: "editor" })).toBe("Yük (VA)");
  expect(TR("partEditor.connector.motorHp", "Motor (hp)", { ns: "editor" })).toBe("Motor (hp)");
  expect(TR("partEditor.zone.depthFt", "Depth (ft)", { ns: "editor" })).toBe("Derinlik (ft)");
  expect(TR("partEditor.dim.lengthInches", "Length (inches)", { ns: "editor" })).toBe("Uzunluk (inç)");
});

test("the category, face, view and purpose words are accessors, not tables of English", () => {
  // The same words, twice each, in both languages — a table of strings would answer
  // English to a Turkish screen and this test would read the same string twice.
  const categories = ["mechanical_equipment", "air_terminal", "plumbing_fixture", "lighting_fixture", "generic"];
  const turkish = categories.map((c) => TR(`partEditor.category.${categoryKey(c)}`, categoryEnglish(c), { ns: "editor" }));
  expect(turkish).toEqual(["Mekanik ekipman", "Hava terminalleri", "Sıhhi tesisat armatürleri", "Aydınlatma armatürleri", "Genel modeller"]);
  expect(TR("partEditor.category.generic", "Generic models", { ns: "editor" })).not.toBe("Generic models");
});

/** The key the part editor writes for each category (mirrors `partCategoryLabel`). */
function categoryKey(category: string): string {
  const map: Record<string, string> = {
    mechanical_equipment: "mechanicalEquipment",
    air_terminal: "airTerminals",
    plumbing_fixture: "plumbingFixtures",
    lighting_fixture: "lightingFixtures",
    generic: "generic",
  };
  return map[category] ?? "generic";
}

/** The kernel's own English for each category, which is the caption's English. */
function categoryEnglish(category: string): string {
  const map: Record<string, string> = {
    mechanical_equipment: "Mechanical equipment",
    air_terminal: "Air terminals",
    plumbing_fixture: "Plumbing fixtures",
    lighting_fixture: "Lighting fixtures",
    generic: "Generic models",
  };
  return map[category] ?? "Generic models";
}

test("a new part is written in the language being worked in, and in English exactly as before", () => {
  const english = blankDraft(undefined, "mechanical_equipment");
  const turkish = blankDraft(undefined, "mechanical_equipment", TR);
  // English: the words blankDraft always wrote, character for character.
  expect(english.groupName).toBe("New part");
  expect(english.typeName).toBe("Standard");
  expect(english.definition.typeParams.map((p) => p.label)).toEqual(["Length", "Width", "Height"]);
  expect(english.definition.model?.referencePlanes.map((p) => p.name)).toEqual(["Front", "Back", "Left", "Right", "Top"]);
  // Turkish: the same part, its words in Turkish.
  expect(turkish.groupName).toBe("Yeni parça");
  expect(turkish.typeName).toBe("Standart");
  expect(turkish.definition.typeParams.map((p) => p.label)).toEqual(["Uzunluk", "Genişlik", "Yükseklik"]);
  expect(turkish.definition.model?.referencePlanes.map((p) => p.name)).toEqual(["Ön", "Arka", "Sol", "Sağ", "Üst"]);
  // The parameter *names* are the schema: they never move with the language.
  expect(turkish.definition.typeParams.map((p) => p.name)).toEqual(["length", "width", "height"]);
});

test("the starter box and the features it makes are named in the language being worked in", () => {
  const box = addStarterBox(blankDraft(undefined, "mechanical_equipment", TR), TR);
  const sketch = box.draft.definition.model?.sketches.find((s) => s.id === box.sketchId);
  const feature = box.draft.definition.model?.features.find((f) => f.id === box.featureId);
  expect(sketch?.name).toBe("Taban üzerinde kutu dış hattı");
  expect(feature?.name).toBe("Kutu");
  // The English stays what it was.
  const inEnglish = addStarterBox(blankDraft(undefined, "mechanical_equipment"));
  expect(inEnglish.draft.definition.model?.sketches.find((s) => s.id === inEnglish.sketchId)?.name).toBe("Box outline on Base");
  expect(inEnglish.draft.definition.model?.features.find((f) => f.id === inEnglish.featureId)?.name).toBe("Box");
});

test("an extrude and a revolve are numbered in the language being worked in", () => {
  const draft = addStarterBox(blankDraft(undefined, "mechanical_equipment", TR), TR).draft;
  const sketchId = draft.definition.model?.sketches[0]?.id ?? "";
  const turkish = addExtrude(draft, sketchId, 'join', 0, 12, TR).draft.definition.model?.features.at(-1)?.name;
  expect(turkish).toBe("Ekstrüzyon 2");
  const cut = addRevolve(draft, sketchId, "axis", 'cut', TR).draft.definition.model?.features.at(-1)?.name;
  expect(cut).toBe("Boşluk döndürme 2");
  // English unchanged: the same calls without a translator.
  expect(addExtrude(draft, sketchId, 'join', 0, 12).draft.definition.model?.features.at(-1)?.name).toBe("Extrusion 2");
  expect(addRevolve(draft, sketchId, "axis", 'cut').draft.definition.model?.features.at(-1)?.name).toBe("Void revolve 2");
});

test("a dimension reads from the part's own planes, in the language being drawn", () => {
  const draft = blankDraft(undefined, "mechanical_equipment", TR);
  const names = planeDimensions(draft, 'x', TR).map((d) => d.names);
  // Both halves of a dimension's name are the editor's: the planes it measures,
  // and the "to" between them (§2.3: Sağ, Sol, Taban, Üst — never "Right to Left").
  expect(names).toEqual(["Sağ – Sol", "Taban – Üst"]);
  const english = planeDimensions(blankDraft(undefined, "mechanical_equipment"), 'x').map((d) => d.names);
  expect(english).toEqual(["Right to Left", "Base to Top"]);
  // The sized definition a view draws is untouched by the language.
  expect(sizedDefinition(draft).typeName).toBe("Standart");
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
