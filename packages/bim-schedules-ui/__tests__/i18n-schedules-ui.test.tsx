/**
 * The schedule surfaces (`@permitzip/bim-schedules-ui`) in two languages.
 *
 * Three things are proven, and each has a hole it closes:
 *
 *   1. **The words are keyed** — `captionsIn()` reads every `.ts`/`.tsx` under
 *      `src` (the same scanner the editor's guard uses, over this package's tree)
 *      and pulls out each `t('<key>', '<English>'` call. A component that went
 *      back to a literal fails here even though `tr/schedules.json` still has the
 *      key, and `SITES` pins how many places hold each caption so one of them
 *      cannot quietly revert.
 *   2. **The Turkish says the right thing** — the English comes from the source,
 *      the Turkish from the locale file, and they must differ. §5's field names
 *      and roll-up options are pinned one by one (toplam/azami/asgari/yok).
 *   3. **Real components draw it** — the builder and the columns sheet render, in
 *      both languages.
 */
import fs from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { MutinyThemeProvider } from "@permitzip/bim-ui";
import type { ReactElement } from "react";
import { ScheduleBuilder } from "../src/ScheduleBuilder";
import { ScheduleColumnsSheet } from "../src/ScheduleColumnsSheet";
import { createMockCatalog, createMockFormulaEngine, createMockLibraryProvider } from "../src/mock/catalog";
import { ROLL_UP_RULES, rollUpLabel, scheduleFieldLabel } from "../src/i18n/words";
import { buildGridModel } from "../src/rowset-grid";
import { createScheduleUnits } from "../src/units";
import type { RowSet } from "../src/contracts";
import { englishOnly, type Translate } from "../src/i18n/translate";
import { captionsIn } from "../../bim-editor/__tests__/helpers/editor-source-captions";
import { translateFor, Wrap } from "./helpers/schedules-i18n";

const TR = translateFor("tr");
const EN = translateFor("en");

const SURFACES_SRC = path.join(__dirname, "..", "src");

/** A schedule grid's rows, with the column headings the model server sent. */
function rowSetWith(headings: readonly string[]): RowSet {
  return {
    rowCount: 1,
    rowKeys: ["p1"],
    elementIds: ["e1"],
    columns: headings.map((heading, i) => ({ id: `c${i}`, heading, kind: "field" as const, valueType: "text" as const, writer: { scope: "element" as const } })),
    values: new Map(headings.map((_, i) => [`c${i}`, { type: "text" as const, values: ["x"] }])),
    children: new Map(),
  } as unknown as RowSet;
}

// ---------------------------------------------------------------------------
// §5 — the field names and the roll-up options
// ---------------------------------------------------------------------------

test("schedule field labels are Turkish", () => {
  const headings = [
    ["MARK", "İşaret"],
    ["Type", "Tip"],
    ["Level", "Kat"],
    ["Room", "Oda"],
    ["Description", "Açıklama"],
    ["Width", "Genişlik"],
    ["Fire rating", "Yangın dayanımı"],
    ["Gas input", "Gaz girişi"],
    ["Storage", "Depolama"],
    ["Supply load", "Besleme yükü"],
    ["Drainage load", "Tahliye yükü"],
  ] as const;
  for (const [english, turkish] of headings) {
    expect({ english, turkish: scheduleFieldLabel(english, TR) }).toEqual({ english, turkish });
  }
});

test("a field's unit symbol is never translated", () => {
  expect(scheduleFieldLabel("GAS INPUT (MBH)", TR)).toBe("Gaz girişi (MBH)");
  expect(scheduleFieldLabel("ESTIMATE (VA)", TR)).toBe("Tahmin (VA)");
  // §7: unit symbols stay exactly as they are.
  expect(scheduleFieldLabel("GAS INPUT (MBH)", TR)).toContain("MBH");
});

test("a label the table has never heard of is drawn as it arrived", () => {
  expect(scheduleFieldLabel("Hood static pressure", TR)).toBe("Hood static pressure");
  // The English is the label itself, so an unknown field is never mangled or emptied.
  expect(scheduleFieldLabel("MARK", EN)).toBe("MARK");
});

test("roll-up options are Turkish", () => {
  const options = [
    ["sum", "Toplam"],
    ["max", "Azami"],
    ["min", "Asgari"],
    ["none", "Yok"],
  ] as const;
  for (const [rule, turkish] of options) {
    expect({ rule, label: rollUpLabel(rule, TR) }).toEqual({ rule, label: turkish });
  }
  // Every rule the contracts can carry has a word, so no rule falls through as a token.
  for (const rule of ROLL_UP_RULES) expect(rollUpLabel(rule, TR)).not.toBe(rule);
});

test("roll-up options are unchanged in English", () => {
  expect(ROLL_UP_RULES.map((rule) => rollUpLabel(rule, EN))).toEqual(["Sum", "Max", "Min", "None", "Count", "Average", "List"]);
  // A rule nobody named stays the token rather than an empty cell.
  expect(rollUpLabel("median", TR)).toBe("median");
});

test("a placeholder survives the translator a bare test gets", () => {
  // `englishOnly` returns the English verbatim; without the repair a `{{n}}` would reach the screen.
  expect(englishOnly("grid.savedMany", "Saved {{n}} changes.", { n: 3 })).toBe("Saved 3 changes.");
});

// ---------------------------------------------------------------------------
// The source, read the way `npm run i18n:review` reads it
// ---------------------------------------------------------------------------

/** One caption as §5 and the surfaces write it. */
interface Caption {
  readonly key: string;
  readonly english: string;
  readonly turkish: string;
}

const CAPTIONS: readonly Caption[] = [
  { key: "grid.columns", english: "Columns", turkish: "Sütunlar" },
  { key: "grid.fields", english: "Fields", turkish: "Alanlar" },
  { key: "grid.arrange", english: "Arrange", turkish: "Düzenle" },
  { key: "grid.showInModel", english: "Show in model", turkish: "Modelde göster" },
  { key: "grid.moreActions", english: "More schedule actions", turkish: "Diğer çizelge eylemleri" },
  { key: "grid.notHere", english: "Not available in this view.", turkish: "Bu görünümde kullanılamaz." },
  { key: "grid.placeOnSheet", english: "Place on sheet", turkish: "Paftaya yerleştir" },
  { key: "grid.duplicate", english: "Duplicate", turkish: "Çoğalt" },
  { key: "grid.saveAsTemplate", english: "Save as template", turkish: "Şablon olarak kaydet" },
  { key: "grid.exportCsv", english: "Export CSV", turkish: "CSV olarak aktar" },
  { key: "grid.printPreview", english: "Print preview", turkish: "Yazdırma önizlemesi" },
  { key: "grid.emptyTitle", english: "Nothing to list yet", turkish: "Henüz listelenecek bir şey yok" },
  { key: "grid.changeTypeTitle", english: "Change every part of this type?", turkish: "Bu tipin her parçası değişsin mi?" },
  { key: "builder.whatToList", english: "What to list", turkish: "Neyi listeler" },
  { key: "builder.columns", english: "Columns", turkish: "Sütunlar" },
  { key: "builder.calculations", english: "Calculations", turkish: "Hesaplar" },
  { key: "builder.filters", english: "Filters", turkish: "Filtreler" },
  { key: "builder.sortGroupTotals", english: "Sort, group and totals", turkish: "Sırala, grupla ve topla" },
  { key: "builder.presentation", english: "Presentation and paper", turkish: "Sunum ve kâğıt" },
  { key: "builder.save", english: "Save schedule", turkish: "Çizelgeyi kaydet" },
  { key: "builder.cancel", english: "Cancel", turkish: "Vazgeç" },
  { key: "builder.total", english: "Total", turkish: "Toplam" },
  { key: "builder.grandTotals", english: "Grand totals at the bottom", turkish: "Altta genel toplamlar" },
  { key: "builder.textHasNoTotal", english: "{{name}} is text, so it has no total.", turkish: "{{name}} metin, toplamı olmaz." },
  { key: "builder.subListsNotTotalled", english: "Sub-lists aren't totalled; total a column inside them instead.", turkish: "Alt listeler toplanmaz; onun yerine içlerindeki bir sütunu toplayın." },
  { key: "columns.title", english: "Columns · {{name}}", turkish: "Sütunlar · {{name}}" },
  { key: "columns.addColumn", english: "Add a column", turkish: "Sütun ekle" },
  { key: "columns.total", english: "Total", turkish: "Toplam" },
  { key: "columns.grandTotals", english: "Grand totals at the bottom", turkish: "Altta genel toplamlar" },
  { key: "columns.listsItemsNoTotal", english: "This column lists items, so it has no total.", turkish: "Bu sütun eleman listeler, toplamı olmaz." },
  { key: "columns.onlyNumbersAdd", english: "Only numbers add up.", turkish: "Yalnızca sayılar toplanır." },
  { key: "library.newField", english: "New field", turkish: "Yeni alan" },
  { key: "library.includeRetired", english: "Include retired items", turkish: "Kullanımdan kaldırılmış öğeleri de kat" },
  { key: "newField.addTo", english: "Add to {{scope}}", turkish: "{{scope}} içine ekle" },
  { key: "save.title", english: "Save to firm library", turkish: "Firma kitaplığına kaydet" },
  { key: "save.publish", english: "Publish", turkish: "Yayınla" },
];

/**
 * How many call sites each shared caption has today: a word written in a heading
 * *and* a button, or in two pickers, would pass a presence check while one of
 * them went back to a literal. A new site is a deliberate bump here.
 */
const SITES: Readonly<Record<string, number>> = {
  "library.region": 2,
  "library.tryAgain": 2,
  "library.readOnly": 2,
  "save.giveName": 2,
  "builder.fixFormulaFirst": 2,
  "builder.chooseWhatFirst": 2,
  "builder.add": 2,
  "columns.pickField": 2,
  "grid.cellOne": 2,
  "grid.cellMany": 2,
  "grid.notHere": 2,
};

const fill = (template: string, values: Readonly<Record<string, string | number>> | undefined): string =>
  values === undefined ? template : template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(values[name]));

const VALUES: Readonly<Record<string, { readonly tr?: Record<string, string | number>; readonly en?: Record<string, string | number> }>> = {
  "builder.textHasNoTotal": { tr: { name: "Genişlik" }, en: { name: "Width" } },
  "columns.title": { tr: { name: "Pompa çizelgesi" }, en: { name: "Pump schedule" } },
  "newField.addTo": { tr: { scope: "Firma" }, en: { scope: "Firm" } },
};

test("every schedule caption is still keyed in the source, with its English", () => {
  const source = captionsIn(SURFACES_SRC);
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english });
  }
});

test("a schedule caption is still keyed at every place it is written", () => {
  const source = captionsIn(SURFACES_SRC);
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, sites: source.get(caption.key)?.sites }).toEqual({ key: caption.key, sites: SITES[caption.key] ?? 1 });
  }
});

/**
 * The other half of the guard: a caption that is in the source but has no Turkish
 * row is English on a Turkish screen, and the table above cannot name a key nobody
 * wrote yet. Reading the locale file itself is what closes that.
 */
test("every schedule caption in the source has its Turkish in schedules.json", () => {
  const locale = flatten(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "locales", "tr", "schedules.json"), "utf8")) as Record<string, unknown>);
  const inSource = [...captionsIn(SURFACES_SRC).keys()].filter((key) => ["grid.", "builder.", "columns.", "library.", "newField.", "save.", "rollUp.", "field."].some((prefix) => key.startsWith(prefix)));
  expect(inSource.length).toBeGreaterThan(100);
  expect(inSource.filter((key) => (locale[key] ?? "").trim() === "")).toEqual([]);
});

/** `{ grid: { columns: "Sütunlar" } }` → `"grid.columns"`. */
function flatten(source: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string") out[prefix === "" ? key : `${prefix}.${key}`] = value;
    else if (typeof value === "object" && value !== null) Object.assign(out, flatten(value as Record<string, unknown>, prefix === "" ? key : `${prefix}.${key}`));
  }
  return out;
}

test("no schedule caption stays English in tr", () => {
  for (const caption of CAPTIONS) {
    const values = VALUES[caption.key];
    const turkish: Translate = TR;
    const english: Translate = EN;
    expect({ key: caption.key, text: turkish(caption.key, caption.english, { ...values?.tr, ns: "schedules" }) }).toEqual({
      key: caption.key,
      text: fill(caption.turkish, values?.tr),
    });
    expect(english(caption.key, caption.english, { ...values?.en, ns: "schedules" })).toBe(fill(caption.english, values?.en));
  }
});

// ---------------------------------------------------------------------------
// Rendered surfaces
// ---------------------------------------------------------------------------

const renderIn = (language: "tr" | "en", ui: ReactElement) =>
  render(<Wrap language={language}>{ui}</Wrap>, { wrapper: MutinyThemeProvider });

function builder(language: "tr" | "en") {
  renderIn(
    language,
    <ScheduleBuilder open onOpenChange={() => undefined} catalog={createMockCatalog()} formulaEngine={createMockFormulaEngine()} library={createMockLibraryProvider()} onSave={jest.fn()} />,
  );
  return screen.getByRole("dialog");
}

test("the schedule builder's headings are Turkish", () => {
  const sheet = builder("tr");
  for (const heading of ["Neyi listeler", "Sütunlar", "Hesaplar", "Filtreler", "Sırala, grupla ve topla", "Sunum ve kâğıt"]) {
    expect(within(sheet).getByRole("heading", { name: heading })).toBeTruthy();
  }
  expect(within(sheet).getByRole("button", { name: "Çizelgeyi kaydet" })).toBeTruthy();
  expect(within(sheet).queryByRole("heading", { name: "What to list" })).toBeNull();
});

test("the schedule builder is unchanged in English", () => {
  const sheet = builder("en");
  expect(within(sheet).getByRole("heading", { name: "What to list" })).toBeTruthy();
  expect(within(sheet).getByRole("button", { name: "Save schedule" })).toBeTruthy();
});

test("the columns sheet reads Turkish", () => {
  const render1 = renderIn(
    "tr",
    <ScheduleColumnsSheet
      open
      onOpenChange={() => undefined}
      definition={{
        name: "Pompa çizelgesi",
        source: { kind: "classes", classes: ["mep.mechanical_equipment"], includeSubclasses: true },
        columns: [{ id: "mark", kind: "field", path: "mark" }],
        filters: [],
        sort: [],
        groups: [],
        grandTotals: false,
        itemize: true,
        presentation: { kind: "list" },
        display: { textSizeMm: 2.5, emptyText: "" },
      }}
      fields={createMockCatalog().fieldsFor(["mep.mechanical_equipment"])}
      onStep={() => null}
    />,
  );
  const sheet = screen.getByRole("dialog");
  expect(within(sheet).getByText(/Sütunlar · Pompa çizelgesi/u)).toBeTruthy();
  expect(within(sheet).getByText("Sütun ekle")).toBeTruthy();
  expect(within(sheet).getByText(/Altta genel toplamlar/u)).toBeTruthy();
  render1.unmount();

  renderIn(
    "en",
    <ScheduleColumnsSheet
      open
      onOpenChange={() => undefined}
      definition={{
        name: "Pump schedule",
        source: { kind: "classes", classes: ["mep.mechanical_equipment"], includeSubclasses: true },
        columns: [{ id: "mark", kind: "field", path: "mark" }],
        filters: [],
        sort: [],
        groups: [],
        grandTotals: false,
        itemize: true,
        presentation: { kind: "list" },
        display: { textSizeMm: 2.5, emptyText: "" },
      }}
      fields={createMockCatalog().fieldsFor(["mep.mechanical_equipment"])}
      onStep={() => null}
    />,
  );
  const english = screen.getByRole("dialog");
  expect(within(english).getByText(/Columns · Pump schedule/u)).toBeTruthy();
  expect(within(english).getByText("Add a column")).toBeTruthy();
});

test("the grid builds its column headings as words, not as whichever string the model sent", () => {
  // The headings come from the model's own column headings (`MARK`, `GAS INPUT (MBH)`), so the grid is where they are read as words.
  const grid = fs.readFileSync(path.join(SURFACES_SRC, "rowset-grid.ts"), "utf8");
  expect(grid).toContain("scheduleFieldLabel(c.heading, t)");
  expect(buildGridModel({ rowSet: rowSetWith(["MARK", "GAS INPUT (MBH)"]), units: createScheduleUnits(), expanded: new Set(), overlays: new Map(), presence: [], explanations: new Map(), widths: new Map(), t: TR }).columns.map((c) => c.heading)).toEqual([
    "İşaret",
    "Gaz girişi (MBH)",
  ]);
});
