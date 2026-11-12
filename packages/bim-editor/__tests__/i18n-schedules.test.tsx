/**
 * The editor's schedule and calculation surfaces in two languages.
 *
 * The words are proven at three levels, because each has a hole the others miss:
 *
 *   1. **The key is still in the source** — `editorSourceCaptions()` reads every
 *      `.ts`/`.tsx` under `src/editor` (comments stripped) and pulls out each
 *      `t('<key>', '<English>'` call, with how many places hold it. A caption that
 *      went back to a literal fails here even though `tr/editor.json` still has the
 *      key; `SITES` pins the count so one of several places cannot quietly revert.
 *   2. **The Turkish says the right thing** — the English comes from the source and
 *      the Turkish from the locale file; §5's roll-up options are pinned one by one
 *      (toplam/azami/asgari/yok) and so is the cost code header.
 *   3. **The Turkish that is written is the highest a reviewer needs** — a key in
 *      the locale with no call site is reported, so nothing is translated twice.
 */
import fs from "node:fs";
import path from "node:path";
import { editorSourceCaptions } from "./helpers/editor-source-captions";
import { englishOnly } from "../src/editor/i18n/translate";
import { builtinListBlocked, builtinListDefinition, builtinListLabel, builtinListStoredName } from "../src/editor/schedules/builtin-lists";
import { pipeLoadRowLabel, undrawnLoadHint } from "../src/editor/schedules/loads-list";
import { KernelCellPlanner, childRowsNotEditable, severalCommandsNotYet } from "../src/editor/schedules/schedule-planner";
import { translateFor } from "./helpers/editor-i18n";
import { createI18n } from "@permitzip/bim-ui";
import { PLACEMENT_PLANNED } from "@permitzip/bim-kernel";
import { schedulesResources } from "../../bim-schedules-ui/src/i18n/resources";
import { rollUpLabel, scheduleFieldLabel } from "../../bim-schedules-ui/src/i18n/words";

const TR = translateFor("tr");
const EN = translateFor("en");

/** The schedule surfaces' translator, for the words `@permitzip/bim-schedules-ui` owns. */
const SCHEDULES_TR = schedulesTranslateFor("tr");
const SCHEDULES_EN = schedulesTranslateFor("en");

/** The schedule surfaces' translator in `language`, built the way their own guard test builds one. */
function schedulesTranslateFor(language: "tr" | "en") {
  const i18n = createI18n({ language, resources: schedulesResources });
  const fixed = i18n.getFixedT(language, "schedules");
  return (key: string, english: string, values?: Readonly<Record<string, string | number | undefined>>): string =>
    (values === undefined ? fixed(key, english) : fixed(key, english, values)) as string;
}

/** One caption as the glossary writes it. */
interface Caption {
  readonly key: string;
  readonly english: string;
  readonly turkish: string;
}

// ---------------------------------------------------------------------------
// §5 — the roll-up options and the field names the surfaces read
// ---------------------------------------------------------------------------

test("roll-up options are Turkish", () => {
  const options = [
    ["sum", "Toplam"],
    ["max", "Azami"],
    ["min", "Asgari"],
    ["none", "Yok"],
  ] as const;
  for (const [rule, turkish] of options) {
    expect({ rule, label: rollUpLabel(rule, SCHEDULES_TR) }).toEqual({ rule, label: turkish });
  }
});

test("roll-up options are unchanged in English", () => {
  expect(["sum", "max", "min", "none"].map((rule) => rollUpLabel(rule, SCHEDULES_EN))).toEqual(["Sum", "Max", "Min", "None"]);
});

test("schedule field labels are Turkish", () => {
  expect(scheduleFieldLabel("MARK", SCHEDULES_TR)).toBe("İşaret");
  expect(scheduleFieldLabel("Gas input", SCHEDULES_TR)).toBe("Gaz girişi");
  expect(scheduleFieldLabel("Drainage load", SCHEDULES_TR)).toBe("Tahliye yükü");
  // §7: the unit is a symbol and stays as it is.
  expect(scheduleFieldLabel("GAS INPUT (MBH)", SCHEDULES_TR)).toBe("Gaz girişi (MBH)");
});

test("schedule field labels are unchanged in English", () => {
  // The model's own spelling is data: `MARK` stays `MARK`, never `Mark`.
  expect(scheduleFieldLabel("MARK", SCHEDULES_EN)).toBe("MARK");
  expect(scheduleFieldLabel("Gas input", SCHEDULES_EN)).toBe("Gas input");
});

// ---------------------------------------------------------------------------
// The captions this stage wrote, read back out of the source
// ---------------------------------------------------------------------------

const CAPTIONS: readonly Caption[] = [
  { key: "schedule.costCode", english: "Cost code", turkish: "Maliyet kodu" },
  { key: "schedule.stage", english: "Stage", turkish: "Aşama" },
  { key: "schedule.quantity", english: "Quantity", turkish: "Miktar" },
  { key: "schedule.unitPrice", english: "Unit price", turkish: "Birim fiyat" },
  { key: "schedule.amount", english: "Amount", turkish: "Tutar" },
  { key: "schedule.oneElement", english: "1 element", turkish: "1 eleman" },
  { key: "schedule.elements", english: "{{n}} elements", turkish: "{{n}} eleman" },
  { key: "schedule.showInSchedule", english: "Show in schedule", turkish: "Çizelgede göster" },
  { key: "schedule.listingThis", english: "Schedules listing this item", turkish: "Bu elemanı listeleyen çizelgeler" },
  { key: "schedule.connecting", english: "Connecting to the model server to load {{name}}…", turkish: "{{name}} yüklenmesi için model sunucusuna bağlanılıyor…" },
  { key: "schedule.loading", english: "Loading {{name}}…", turkish: "{{name}} yükleniyor…" },
  { key: "schedule.list.equipmentList", english: "Equipment list", turkish: "Ekipman listesi" },
  { key: "schedule.list.loads", english: "Loads", turkish: "Yükler" },
  { key: "schedule.list.spaceLoads", english: "Space loads", turkish: "Mekan yükleri" },
  { key: "schedule.newWindow.title", english: "New schedule", turkish: "Yeni çizelge" },
  { key: "schedule.newWindow.whatItLists", english: "What it lists", turkish: "Neyi listeler" },
  { key: "schedule.pipeLoad.put", english: "Put on the pipe end", turkish: "Boru ucuna koy" },
  { key: "schedule.end.start", english: "Start", turkish: "Başlangıç" },
  // The four the `tr` alias hid from both guards, and from every locale file.
  { key: "schedule.formOnlyTitle", english: "{{name}} is laid out by its form", turkish: "{{name}} kendi formuyla düzenlenir" },
  {
    key: "schedule.formOnlyOnSheet",
    english: "It is drawn on {{number}} · {{title}}; open that sheet to read it and change it (its template and rules are in its properties).",
    turkish: "{{number}} · {{title}} paftasında çizilir; okumak ve değiştirmek için o paftayı açın (şablonu ve kuralları özelliklerinde).",
  },
  {
    key: "schedule.formOnlyNotPlaced",
    english: "Put it on a sheet from its properties (Place on sheet), then open that sheet to read it.",
    turkish: "Özelliklerinden (Paftaya yerleştir) bir paftaya koyun, sonra okumak için o paftayı açın.",
  },
  { key: "schedule.openSheetNumber", english: "Open {{number}}", turkish: "{{number}} paftasını aç" },
  { key: "calc.calculation", english: "Calculation", turkish: "Hesap" },
  { key: "calc.governingCell", english: "Governing cell", turkish: "Belirleyici hücre" },
  { key: "calc.place", english: "Place", turkish: "Yerleştir" },
  { key: "calc.remove", english: "Remove", turkish: "Kaldır" },
  { key: "calc.insertTitle", english: "Insert a calculation on {{number}}", turkish: "{{number}} paftasına hesap ekle" },
  // The built-in lists' own headings (§5 field names): a list a person makes is
  // written in the language they are working in, the way a new part's defaults are.
  { key: "schedule.list.notPlacedYet", english: "Not placed yet", turkish: "Henüz yerleştirilmedi" },
  { key: "schedule.list.panelLoads", english: "Panel loads", turkish: "Pano yükleri" },
  { key: "schedule.list.heading.plannedLevel", english: "PLANNED LEVEL", turkish: "PLANLANAN KAT" },
  { key: "schedule.list.heading.connectionType", english: "CONNECTION TYPE", turkish: "BAĞLANTI TİPİ" },
  { key: "schedule.list.heading.cwWsfu", english: "CW WSFU", turkish: "SOĞUK SU WSFU" },
  { key: "schedule.list.heading.hwWsfu", english: "HW WSFU", turkish: "SICAK SU WSFU" },
  { key: "schedule.list.heading.totalWsfu", english: "TOTAL WSFU", turkish: "TOPLAM WSFU" },
  { key: "schedule.list.heading.hwDemand", english: "HW DEMAND", turkish: "SICAK SU TALEBİ" },
  { key: "schedule.list.heading.gasInput", english: "GAS INPUT", turkish: "GAZ GİRİŞİ" },
  { key: "schedule.list.heading.gasFlow", english: "GAS FLOW", turkish: "GAZ DEBİSİ" },
  { key: "schedule.list.heading.elecLoad", english: "ELEC LOAD", turkish: "ELEKTRİK YÜKÜ" },
  { key: "schedule.list.heading.estimate", english: "ESTIMATE {{unit}}", turkish: "TAHMİN {{unit}}" },
  { key: "schedule.list.heading.devicesSoFar", english: "DEVICES SO FAR {{unit}}", turkish: "ŞİMDİYE KADARKİ CİHAZLAR {{unit}}" },
  { key: "schedule.list.heading.counted", english: "COUNTED {{unit}}", turkish: "SAYILAN {{unit}}" },
  { key: "schedule.list.heading.estimateVsDevices", english: "ESTIMATE VS DEVICES", turkish: "TAHMİN / CİHAZLAR" },
  // The grid's own refusals.
  { key: "schedule.planner.modelNotLoaded", english: "The model hasn't loaded yet. Try again in a moment.", turkish: "Model henüz yüklenmedi. Birazdan yeniden deneyin." },
  { key: "schedule.planner.gone", english: "This schedule is no longer in the model.", turkish: "Bu çizelge artık modelde değil." },
  {
    key: "schedule.planner.unreadable",
    english: "This schedule couldn't be read for editing. Reload the page and try again.",
    turkish: "Bu çizelge düzenlemek için okunamadı. Sayfayı yenileyip yeniden deneyin.",
  },
  {
    key: "schedule.planner.severalCommands",
    english: "Changes to several items at once can't be saved as one step yet. Change one cell at a time for now.",
    turkish: "Birden çok öğedeki değişiklikler henüz tek adımda kaydedilemiyor. Şimdilik her seferinde bir hücre değiştirin.",
  },
  { key: "schedule.planner.cellEdit", english: "Schedule cell edit", turkish: "Çizelge hücresi düzenlemesi" },
  { key: "schedule.planner.batchEdit", english: "Schedule edit ({{count}} cells)", turkish: "Çizelge düzenlemesi ({{count}} hücre)" },
  // The tree and the saved column widths (§2.4: schedule = çizelge).
  { key: "schedule.tree.notAllowed", english: "You can't open this project's Building Model schedules, so the tree shows Building Model without them.", turkish: "Bu projenin Building Model çizelgelerini açamıyorsunuz, bu yüzden ağaç Building Model’i onlar olmadan gösteriyor." },
  { key: "schedule.tree.retry", english: "Retry", turkish: "Yeniden dene" },
  { key: "schedule.tree.subject", english: "The model’s schedules list", turkish: "Modelin çizelge listesi" },
  { key: "schedule.prefs.widthsNotLoaded", english: "Your column widths for this schedule couldn't be loaded. It opens with the default widths.", turkish: "Bu çizelgenin sütun genişlikleriniz yüklenemedi. Varsayılan genişliklerle açılıyor." },
  { key: "schedule.prefs.widthsNotSaved", english: "The new column widths show here, but couldn't be saved for next time.", turkish: "Yeni sütun genişlikleri burada görünüyor ama bir dahaki sefere için kaydedilemedi." },
  // The loads list's hint and the price table's "whose book".
  { key: "schedule.pipeLoad.rowLabel", english: "Put a row from the Loads list here", turkish: "Yükler listesinden bir satırı buraya koy" },
  { key: "schedule.loadsList.andMore", english: "{{shown}} and {{count}} more", turkish: "{{shown}} ve {{count}} tane daha" },
  {
    key: "schedule.loadsList.undrawnOne",
    english: '{{shown}} isn\\\'t drawn yet. To pipe it: draw the pipe with Route, select it, and pick the row under "{{row}}".',
    turkish: "{{shown}} henüz çizilmedi. Boruya bağlamak için: Boru çiz ile boruyu çizip seçin, sonra “{{row}}” satırını seçin.",
  },
  // §2.4/§6: whose price book it is, in one sentence (§9/Ç20 keeps işveren out of it).
  { key: "schedule.priceWith.anotherCompany", english: "another company", turkish: "başka bir firma" },
  { key: "schedule.priceWith.basisEstimate", english: "estimate", turkish: "tahmin" },
  { key: "schedule.priceWith.basisContract", english: "contract", turkish: "sözleşme" },
  { key: "schedule.priceWith.whose", english: "{{book}}, {{owner}}'s {{basis}} as of {{date}}", turkish: "{{book}}, {{owner}} firmasının {{basis}} fiyatları, {{date}} itibarıyla" },
];

/**
 * How many call sites each shared caption has today. A new site is a deliberate
 * bump here; the number must not fall silently.
 */
const SITES: Readonly<Record<string, number>> = {
  "calc.calculation": 2,
  "calc.remove": 2,
  "schedule.priceWith.retry": 2,
  "schedule.priceWith.title": 2,
  "schedule.elements": 2,
  "schedule.oneElement": 2,
  "schedule.formOnlyTitle": 1,
  "schedule.formOnlyOnSheet": 1,
  "schedule.formOnlyNotPlaced": 1,
  "schedule.openSheetNumber": 1,
  "view.noLimit": 2,
  "view.projection": 2,
  "titleBlock.default": 2,
  "titleBlock.unknownError": 2,
  "panel.linkedModels": 2,
  "panel.newViewOrSheet": 2,
  // The built-in lists: every name is written where it is read and where it is stored.
  "schedule.list.notPlacedYet": 1,
  "schedule.list.loads": 1,
  "schedule.list.spaceLoads": 1,
  "schedule.list.panelLoads": 1,
  "schedule.list.equipmentList": 1,
  // §2.4: the same heading on every list that shows the three sides of a quantity.
  // One call each, inside `sides()`: the three sides of a quantity are written once
  // and used for every unit (§7 keeps `(VA)`, `(WSFU)` as they are).
  "schedule.list.heading.estimate": 1,
  "schedule.list.heading.devicesSoFar": 1,
  "schedule.list.heading.counted": 1,
  "schedule.list.heading.estimateVsDevices": 1,
  // One refusal, said at every place the grid can reach it.
  "schedule.planner.severalCommands": 1,
  "schedule.planner.childRows": 1,
  "schedule.pipeLoad.rowLabel": 1,
  "schedule.loadsList.andMore": 1,
  "schedule.tree.retry": 1,
  "schedule.priceWith.whose": 1,
};

const VALUES: Readonly<Record<string, Readonly<Record<string, string | number>>>> = {
  "schedule.connecting": { name: "Pompa çizelgesi" },
  "schedule.loading": { name: "Pompa çizelgesi" },
  "schedule.elements": { n: 3 },
  "calc.insertTitle": { number: "M-101" },
  "schedule.formOnlyTitle": { name: "Pompa çizelgesi" },
  "schedule.formOnlyOnSheet": { number: "M-101", title: "Pompa listesi" },
  "schedule.list.heading.estimate": { unit: "(VA)" },
  "schedule.list.heading.devicesSoFar": { unit: "(VA)" },
  "schedule.list.heading.counted": { unit: "(VA)" },
  "schedule.planner.batchEdit": { count: 4 },
  "schedule.loadsList.andMore": { shown: "L-1, L-2, L-3", count: 2 },
  "schedule.loadsList.undrawnOne": { shown: "L-4", row: "Yükler listesinden bir satırı buraya koy" },
  "schedule.priceWith.whose": { book: "Acme 2026", owner: "Acme", basis: "tahmin", date: "2026-01-01" },
};

const fill = (template: string, values: Readonly<Record<string, string | number>> | undefined): string =>
  values === undefined ? template : template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(values[name]));

test("every schedule and calculation caption is still keyed in the source, with its English", () => {
  const source = editorSourceCaptions();
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english });
  }
});

test("a caption is still keyed at every place it is written", () => {
  const source = editorSourceCaptions();
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, sites: source.get(caption.key)?.sites }).toEqual({ key: caption.key, sites: SITES[caption.key] ?? 1 });
  }
});

test("no schedule or calculation caption stays English in tr", () => {
  for (const caption of CAPTIONS) {
    const values = VALUES[caption.key];
    const turkish = TR(caption.key, caption.english, { ...values, ns: "editor" });
    expect({ key: caption.key, text: turkish }).toEqual({ key: caption.key, text: fill(caption.turkish, values) });
    expect(turkish).not.toBe(fill(caption.english, values));
  }
});

test("English labels are unchanged", () => {
  for (const caption of CAPTIONS) {
    const values = VALUES[caption.key];
    expect(EN(caption.key, caption.english, { ...values, ns: "editor" })).toBe(fill(caption.english, values));
  }
});

test("the cost code header is Turkish", () => {
  // The takeoff's price table: the first column names a cost code (§6 → "maliyet kodu").
  expect(TR("schedule.costCode", "Cost code", { ns: "editor" })).toBe("Maliyet kodu");
  expect(TR("schedule.unitPrice", "Unit price", { ns: "editor" })).toBe("Birim fiyat");
  expect(EN("schedule.costCode", "Cost code", { ns: "editor" })).toBe("Cost code");
});

// ---------------------------------------------------------------------------
// No Turkish row without a call site, and no call site without its Turkish
// ---------------------------------------------------------------------------

/** `{ schedule: { costCode: "Maliyet kodu" } }` → `"schedule.costCode"`. */
function flatten(source: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    const id = prefix === "" ? key : `${prefix}.${key}`;
    if (typeof value === "string") out[id] = value;
    else if (typeof value === "object" && value !== null) Object.assign(out, flatten(value as Record<string, unknown>, id));
  }
  return out;
}

const LOCALE = flatten(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "locales", "tr", "editor.json"), "utf8")) as Record<string, unknown>);

test("every schedule and calculation caption in the source has its Turkish", () => {
  const inSource = [...editorSourceCaptions().keys()].filter((key) => key.startsWith("schedule.") || key.startsWith("calc."));
  expect(inSource.length).toBeGreaterThan(80);
  expect(inSource.filter((key) => (LOCALE[key] ?? "").trim() === "")).toEqual([]);
});

test("a placeholder is never written with one brace", () => {
  // i18next only fills `{{n}}`: a `{n}` reaches the screen as the four characters it is.
  const wrong = Object.entries(LOCALE)
    .filter(([key]) => key.startsWith("schedule.") || key.startsWith("calc."))
    .filter(([, value]) => /(^|[^{])\{[A-Za-z0-9_]+\}/u.test(value))
    .map(([key]) => key);
  expect(wrong).toEqual([]);
});

// ---------------------------------------------------------------------------
// The leak guards: no raw placeholder, on any path a Turkish screen can reach
// ---------------------------------------------------------------------------

test("a built-in list that cannot be made says so without an English sentence or a raw placeholder", () => {
  // `builtinListBlocked` defaults to `englishOnly`. The editor's `englishOnly` now
  // fills `{{placeholders}}`, and `NewListScheduleDialog` and `BuildingModelSurface`
  // pass the real translator. Both shapes are pinned here: neither an English
  // sentence nor a literal `{{name}}`/`{{reason}}` may reach a Turkish screen.
  const model = {
    modelId: "m",
    revision: 0,
    elements: {},
    connections: [],
    settings: { units: "imperial", precision: 2 },
  } as unknown as Parameters<typeof builtinListBlocked>[0];

  for (const id of ["equipment_list", "loads", "takeoff"] as const) {
    const turkish = builtinListBlocked(model, id, TR);
    const english = builtinListBlocked(model, id, EN);
    if (turkish === null) continue;
    expect(turkish).not.toMatch(/\{\{/u);
    expect(english).not.toMatch(/\{\{/u);
    // A refusal that reaches a Turkish screen is Turkish, not the English default.
    expect(turkish).not.toBe(english);
    expect(turkish).toContain(builtinListLabel(id, TR));
  }
});

test("the editor's englishOnly fills its placeholders rather than printing them", () => {
  // The one-line change that keeps every future default from leaking a `{{name}}`.
  expect(englishOnly("schedule.listCannotBeMade", "{{name}} can’t be made yet: {{reason}}", { name: "Loads", reason: "no field" })).toBe(
    "Loads can’t be made yet: no field",
  );
});

// ---------------------------------------------------------------------------
// The built-in lists: the stored name is an identity, the words are the person's
// ---------------------------------------------------------------------------

/** An empty model: enough for a list to be built and checked, and for nothing to be found in it. */
const MODEL = {
  modelId: "m",
  revision: 0,
  elements: {},
  connections: [],
  settings: { units: "imperial", precision: 2 },
} as unknown as Parameters<typeof builtinListDefinition>[0];

test("a built-in list's stored name stays the model's own word, so a list made last week is still found", () => {
  // `findBuiltinListView` matches a view by this name; translating it would lose the list.
  expect(builtinListStoredName("not_placed_yet")).toBe("Not placed yet");
  expect(builtinListStoredName("loads")).toBe("Loads");
  // What a person reads is the label, and that is Turkish.
  expect(builtinListLabel("not_placed_yet", TR)).toBe("Henüz yerleştirilmedi");
  expect(builtinListLabel("loads", TR)).toBe("Yükler");
  expect(builtinListLabel("loads", EN)).toBe("Loads");
});

test("a list a Turkish person makes is headed in Turkish, and an English one is unchanged", () => {
  const turkish = builtinListDefinition(MODEL, "loads", TR);
  const english = builtinListDefinition(MODEL, "loads", EN);
  const headings = (def: { columns: readonly { heading?: string }[] }) => def.columns.map((column) => column.heading);
  expect(headings(english)).toContain("CW WSFU");
  expect(headings(turkish)).toContain("SOĞUK SU WSFU");
  expect(headings(turkish)).toContain("TOPLAM WSFU");
  // §7: `DFU`, `AIRFLOW` and the unit suffixes are symbols, and both languages print them.
  expect(headings(turkish)).toContain("DFU");
  // The three sides of a quantity are their own heading on the lists that show them.
  expect(headings(builtinListDefinition(MODEL, "space_loads", TR))).toContain("TAHMİN (VA)");
  expect(headings(builtinListDefinition(MODEL, "space_loads", EN))).toContain("ESTIMATE (VA)");
  expect(turkish.name).toBe("Loads");
});

test("the Not placed yet list filters on the placement field's own constant, never on a translated word", () => {
  const turkish = builtinListDefinition(MODEL, "not_placed_yet", TR);
  const filter = turkish.filters[0] as { value?: string };
  expect(filter.value).toBe(PLACEMENT_PLANNED);
  expect(filter.value).toBe("Not placed yet");
});

test("the grid refuses in the language it was given", () => {
  expect(severalCommandsNotYet(EN)).toBe("Changes to several items at once can't be saved as one step yet. Change one cell at a time for now.");
  expect(severalCommandsNotYet(TR)).toBe("Birden çok öğedeki değişiklikler henüz tek adımda kaydedilemiyor. Şimdilik her seferinde bir hücre değiştirin.");
  expect(childRowsNotEditable(TR)).toBe("Sunulan öğeler kendi satırlarında değiştirilir. Çizelgesini açın ya da modelde seçin.");
  // The planner says why a model it cannot read has no cell to edit.
  const planner = new KernelCellPlanner({ model: () => null, t: TR });
  const refusal = planner.plan({ viewId: "v", revision: 0, rows: [], rowCount: 0, window: null, columns: [] } as never, { edits: [] } as never);
  expect(refusal.command).toBe(null);
});

test("how to pipe a load row is said in the language being drawn, with the row's own name inside it", () => {
  expect(pipeLoadRowLabel(EN)).toBe("Put a row from the Loads list here");
  expect(pipeLoadRowLabel(TR)).toBe("Yükler listesinden bir satırı buraya koy");
  const model = { elements: { r1: { id: "r1", kind: "load_point", mark: "L-4", anchor: { kind: "none" } } } } as never;
  const english = undrawnLoadHint(model, ["r1"], EN);
  expect(english).toBe('L-4 isn\'t drawn yet. To pipe it: draw the pipe with Route, select it, and pick the row under "Put a row from the Loads list here".');
  const turkish = undrawnLoadHint(model, ["r1"], TR);
  expect(turkish).toContain("L-4 henüz çizilmedi. Boruya bağlamak için: Boru çiz ile boruyu çizip seçin");
  expect(turkish).toContain("Yükler listesinden bir satırı buraya koy");
});
