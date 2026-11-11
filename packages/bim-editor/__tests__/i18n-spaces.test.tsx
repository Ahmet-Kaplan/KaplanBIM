/**
 * The Spaces panel in two languages — the half of Task 4.4 the negative-space
 * guard cannot see.
 *
 * `i18n-negative-space.test.ts` proves that no English caption in
 * `src/editor/spaces` sits outside a translator (427 sites to zero). It cannot
 * see three things this file does:
 *
 *   1. **The Turkish says the right thing.** §2.3 pins *Space* to **mekan** and
 *      reserves *alan* for *area*; §5 pins the load quantities and the unit
 *      symbols (§7: `kW`, `CFM`, `gal/h`, `W/ft²` do not travel); §8 forbids a
 *      plural suffix after a number ("3 mekan", never "3 mekanlar").
 *   2. **Every keyed caption actually has Turkish.** A `t('spaces.…')` call with
 *      no entry in `locales/tr/editor.json` shows the English on a Turkish
 *      screen and no guard would say so.
 *   3. **The label tables speak the reader's language.** `PURPOSES`,
 *      `LOAD_QUANTITIES`, `QUANTITIES` and the equipment headings are accessors
 *      taking a `Translate`, not string tables: a table of strings is exactly how
 *      English shipped under a keyed frame before.
 */
import { editorSourceCaptions } from "./helpers/editor-source-captions";
import { translateFor } from "./helpers/editor-i18n";
import { editorResources } from "../src/editor/i18n/resources";
import { LOAD_QUANTITIES, policyWord, scopeNoun, scopeWord } from "../src/editor/spaces/space-loads";
import { formatFt2, zoneFitHeading } from "../src/editor/spaces/space-rows";
import { atLeastWords } from "../src/editor/spaces/fire-areas";

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
  // §2.3: a space is a mekan, never an alan.
  { key: "panel.spaces", english: "Spaces", turkish: "Mekanlar" },
  { key: "spaces.spaceName", english: "Space {{number}}", turkish: "Mekan {{number}}" },
  { key: "spaces.tableCaption", english: "Spaces with their use, area, occupants and loads", turkish: "Kullanımı, alanı, kullanıcısı ve yükleriyle mekanlar" },
  // §2.3: a room is an oda, a level a kat.
  { key: "spaces.roomName", english: "Room {{number}}", turkish: "Oda {{number}}" },
  { key: "spaces.levelColumn", english: "Level", turkish: "Kat" },
  // §2.3/Ç15: a zone is a bölge, a fire area a yangın bölgesi.
  { key: "spaces.zoneTitle", english: "Zones", turkish: "Bölgeler" },
  { key: "spaces.purposeFireArea", english: "Fire area", turkish: "Yangın bölgesi" },
  { key: "spaces.fireAreaName", english: "Fire area {{number}}", turkish: "Yangın bölgesi {{number}}" },
  // §2.3: an underlay is an altlık.
  { key: "spaces.addUnderlayCommand", english: "Add underlay", turkish: "Altlık ekle" },
  // §5/§7: a load is a yük; the quantity words travel, the symbols do not.
  { key: "spaces.loadWord", english: "Load", turkish: "Yük" },
  { key: "spaces.loadElectrical", english: "Electrical", turkish: "Elektrik" },
  { key: "spaces.loadAirflow", english: "Airflow", turkish: "Hava debisi" },
  { key: "spaces.loadHotWater", english: "Hot water", turkish: "Sıcak su" },
  { key: "spaces.unitKw", english: "kW", turkish: "kW" },
  { key: "spaces.unitCfmPerFt2", english: "CFM/ft²", turkish: "CFM/ft²" },
  { key: "spaces.unitGalPerHour", english: "gal/h", turkish: "gal/h" },
  // §0.7: a button is a singular command, a sentence is a polite plural.
  { key: "spaces.accept", english: "Accept", turkish: "Kabul et" },
  { key: "spaces.tryAgain", english: "Try again", turkish: "Yeniden dene" },
  { key: "spaces.acceptAtLeastOneRoom", english: "Accept at least one room first.", turkish: "Önce en az bir odayı kabul edin." },
  // §9/Ç7: a UI side panel is a panel, not a pano.
  { key: "spaces.loadingTheSpaces", english: "Loading the spaces", turkish: "Mekanlar yükleniyor" },
];

const fill = (template: string, values: Readonly<Record<string, string | number>> | undefined): string =>
  values === undefined ? template : template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(values[name]));

test("every spaces caption is keyed in the source, with its English unchanged", () => {
  const source = editorSourceCaptions();
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english });
  }
});

test("every spaces caption has Turkish, and it says what the glossary pins", () => {
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, turkish: TURKISH[caption.key] }).toEqual({ key: caption.key, turkish: caption.turkish });
  }
});

test("every spaces key in the source has a Turkish value — no caption falls back to English", () => {
  const source = editorSourceCaptions();
  const missing = [...source.keys()].filter((key) => key.startsWith("spaces.")).filter((key) => TURKISH[key] === undefined || TURKISH[key] === "");
  expect(missing).toEqual([]);
});

test("the Turkish placeholder in a spaces caption matches the English one", () => {
  // `{{n}}` in the Turkish and `{{count}}` in the English would interpolate one
  // side and leak a raw `{{count}}` onto the other, which the parity guard in
  // bim-ui cannot see because it reads the written keys, not every namespace.
  const placeholders = (text: string): string[] =>
    [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/gu)].map((match) => match[1] ?? "").sort();
  const source = editorSourceCaptions();
  const wrong = [...source.entries()]
    .filter(([key]) => key.startsWith("spaces."))
    .map(([key, caption]) => ({ key, english: placeholders(caption.english), turkish: placeholders(TURKISH[key] ?? "") }))
    .filter((row) => row.english.join(",") !== row.turkish.join(","));
  expect(wrong).toEqual([]);
});

test("§2.3: a number is followed by a singular in Turkish — 3 mekan, never 3 mekanlar", () => {
  // The English distinguishes one from many; the Turkish must not grow a suffix.
  expect(fill(TR("spaces.fireAreaName", "Fire area {{number}}", { ns: "editor", number: 3 }), { number: 3 })).toBe("Yangın bölgesi 3");
  expect(fill(TR("spaces.roomName", "Room {{number}}", { ns: "editor", number: 12 }), { number: 12 })).toBe("Oda 12");
  expect(TR("spaces.fireAreaOne", "fire area", { ns: "editor" })).toBe(TR("spaces.fireAreaMany", "fire areas", { ns: "editor" }));
  expect(TR("spaces.roomOne", "room", { ns: "editor" })).toBe(TR("spaces.roomMany", "rooms", { ns: "editor" }));
  expect(TR("spaces.wallOne", "wall", { ns: "editor" })).toBe(TR("spaces.wallMany", "walls", { ns: "editor" }));
  expect(TR("spaces.windowOne", "window", { ns: "editor" })).toBe(TR("spaces.windowMany", "windows", { ns: "editor" }));
});

test("the equipment headings are an accessor, not a table of English", () => {
  expect(zoneFitHeading("thermal", TR)).toBe("Isıtma ve soğutma ekipmanı");
  expect(zoneFitHeading("ventilation", TR)).toBe("Isıtma ve soğutma ekipmanı");
  expect(zoneFitHeading("electrical_load_region", TR)).toBe("Elektrik ekipmanı");
  expect(zoneFitHeading("drainage_catchment", TR)).toBe("Sıhhi tesisat ekipmanı");
  expect(zoneFitHeading("fire_area", TR)).toBe("Ekipman");
  // English is unchanged, character for character.
  expect(zoneFitHeading("thermal", EN)).toBe("Heating and cooling equipment");
  expect(zoneFitHeading("fire_area", EN)).toBe("Equipment");
});

test("the load quantities speak Turkish while their unit symbols stay put (§7)", () => {
  expect(LOAD_QUANTITIES.map((q) => q.label(TR))).toEqual(["Elektrik", "Hava debisi", "Gaz", "Sıcak su"]);
  expect(LOAD_QUANTITIES.map((q) => q.lump.label(TR))).toEqual(["kW", "CFM", "MBH", "gal/h"]);
  expect(LOAD_QUANTITIES.flatMap((q) => (q.density ? [q.density.label(TR)] : []))).toEqual(["W/ft²", "CFM/ft²"]);
  // English first, so a host without a language reads exactly what it read before.
  expect(LOAD_QUANTITIES.map((q) => q.label(EN))).toEqual(["Electrical", "Airflow", "Gas", "Hot water"]);
  expect(LOAD_QUANTITIES.map((q) => q.lump.label(EN))).toEqual(["kW", "CFM", "MBH", "gal/h"]);
});

test("a load's sentence names the space and the zone in the reader's language", () => {
  expect(scopeWord("space", TR)).toBe("mekanın");
  expect(scopeWord("zone", TR)).toBe("bölgenin");
  expect(scopeNoun("space", TR)).toBe("mekan");
  expect(scopeNoun("zone", TR)).toBe("bölge");
  expect(scopeWord("space", EN)).toBe("the space");
  expect(scopeNoun("zone", EN)).toBe("zone");
});

test("the three counting policies each have their own Turkish sentence", () => {
  const turkish = [policyWord("max", TR), policyWord("actual_only", TR), policyWord("allocation_only", TR)];
  expect(new Set(turkish).size).toBe(3);
  expect(turkish.every((sentence) => sentence.trim() !== "" && !/devices|estimate counts/.test(sentence))).toBe(true);
});

test("a fire area's rating reads in Turkish with the rating itself unchanged (§7)", () => {
  const kind = { id: "hourly", label: "Hourly", unit: "hour", levels: [1, 2] } as unknown as Parameters<typeof atLeastWords>[0];
  // The rating is the registry's data ("1 hour"); only the frame travels.
  expect(atLeastWords(kind, 1, EN)).toBe("1 hour or more");
  expect(atLeastWords(kind, 1, TR)).toBe("1 hour ve üzeri");
});

test("an area keeps its §7 unit: the number is localised, the symbol is not", () => {
  expect(formatFt2(420)).toBe("420 sq ft");
  expect(formatFt2(null)).toBe("—");
});
