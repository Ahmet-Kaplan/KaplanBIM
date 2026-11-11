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
import { builtinListBlocked, builtinListLabel } from "../src/editor/schedules/builtin-lists";
import { translateFor } from "./helpers/editor-i18n";
import { createI18n } from "@permitzip/bim-ui";
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
};

const VALUES: Readonly<Record<string, Readonly<Record<string, string | number>>>> = {
  "schedule.connecting": { name: "Pompa çizelgesi" },
  "schedule.loading": { name: "Pompa çizelgesi" },
  "schedule.elements": { n: 3 },
  "calc.insertTitle": { number: "M-101" },
  "schedule.formOnlyTitle": { name: "Pompa çizelgesi" },
  "schedule.formOnlyOnSheet": { number: "M-101", title: "Pompa listesi" },
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
