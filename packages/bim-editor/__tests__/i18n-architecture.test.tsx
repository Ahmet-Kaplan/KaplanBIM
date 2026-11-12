/**
 * The Architecture tree in two languages — the half the negative-space guard
 * cannot see.
 *
 * `i18n-negative-space.test.ts` proves that no English caption in
 * `src/editor/architecture` sits outside a translator (**177** sites in fifteen
 * files, zero). It cannot see four things this file does:
 *
 *   1. **The Turkish says the right thing.** §1 keeps *Architecture* as
 *      **Mimarlık**; §2.3 pins *wall* = **duvar**, *room* = **oda**, *floor* =
 *      **döşeme**, *ceiling* = **tavan**, *roof* = **çatı**, *level* = **kat**,
 *      *opening* = **boşluk**; §2.2 keeps *type* = **tip**; §7 leaves `mm` and `°`
 *      alone; §8 forbids a plural suffix after a number.
 *   2. **Every keyed caption actually has Turkish.** A `t('architecture.…')` call
 *      with no entry in `locales/tr/editor.json` shows English on a Turkish screen
 *      and no guard would say so.
 *   3. **The English did not move by one character.** The tool table, the hint bar,
 *      the snap marker and every refusal are accessors now (`label(t)`,
 *      `description(t)`, `noun(t)`, `chainHint(…, t)`), so the words a person read
 *      before are pinned here against the literals they came from.
 *   4. **A pack's word is data, the words around it are ours.** A linked model's
 *      own noun arrives from the kernel (`ReferenceSnapLine.noun`) and is translated
 *      through the same six-word table the dimension anchors use — never spliced
 *      into an English frame.
 */
import { editorSourceCaptions } from "./helpers/editor-source-captions";
import { translateFor } from "./helpers/editor-i18n";
import { editorResources } from "../src/editor/i18n/resources";
import { BUILD_TOOLS, DATUM_TOOLS, toolById, ARCHITECTURE_TOOLS } from "../src/editor/architecture/tools/catalog";
import { levelButton, TABS } from "../src/editor/architecture/architecture-tab";
import { chainHint } from "../src/editor/architecture/tools/wall-chain";
import { openingHint } from "../src/editor/architecture/tools/opening-place";
import { doorFlipCommand } from "../src/editor/architecture/tools/door-flips";
import { draftHint, startDraft, type Draft } from "../src/editor/architecture/tools/draft";
import { snapPoint } from "../src/editor/architecture/tools/snap";
import { changedValues, usedByWords } from "../src/editor/architecture/type-fields";
import { parseWallHeight, wallBaseCommand, wallTopCommand } from "../src/editor/architecture/WallTopField";
import { endDragHint } from "../src/editor/architecture/WallEndGrips";
import { EMPTY_CHAIN } from "../src/editor/architecture/tools/wall-chain";
import type { ModelState } from "@permitzip/bim-kernel";

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

/** Every `architecture.` key the source writes (both shapes: `t(` and a `translate` alias). */
const IN_SOURCE = [...editorSourceCaptions().keys()].filter((key) => key.startsWith("architecture."));

// ---------------------------------------------------------------------------
// §1, §2.2, §2.3, §2.4 — the words, pinned
// ---------------------------------------------------------------------------

/** One caption as the glossary writes it: the English it must keep, and the Turkish it must say. */
interface Caption {
  readonly key: string;
  readonly english: string;
  readonly turkish: string;
}

const CAPTIONS: readonly Caption[] = [
  // §1: the discipline is Mimarlık; the tab, its groups and its own panel.
  { key: "architecture.tab", english: "Architecture", turkish: "Mimarlık" },
  { key: "architecture.group.datums", english: "Datums", turkish: "Referanslar" },
  { key: "architecture.group.build", english: "Build", turkish: "Kur" },
  { key: "architecture.group.types", english: "Types", turkish: "Tipler" },
  // §2.3: one noun each, and §2.2 keeps *type* as tip.
  { key: "architecture.tool.wall", english: "Wall", turkish: "Duvar" },
  { key: "architecture.tool.floor", english: "Floor", turkish: "Döşeme" },
  { key: "architecture.tool.room", english: "Room", turkish: "Oda" },
  { key: "architecture.tool.ceiling", english: "Ceiling", turkish: "Tavan" },
  { key: "architecture.tool.roof", english: "Roof", turkish: "Çatı" },
  { key: "architecture.tool.opening", english: "Opening", turkish: "Boşluk" },
  { key: "architecture.tool.level", english: "Level", turkish: "Kat" },
  { key: "architecture.tool.grid", english: "Grid", turkish: "Izgara" },
  { key: "architecture.tool.referencePlane", english: "Reference plane", turkish: "Referans düzlemi" },
  { key: "architecture.tool.column", english: "Column", turkish: "Kolon" },
  { key: "architecture.tool.stair", english: "Stair", turkish: "Merdiven" },
  { key: "architecture.noun.level", english: "level", turkish: "kat" },
  { key: "architecture.noun.gridLine", english: "grid line", turkish: "ızgara çizgisi" },
  { key: "architecture.type.label", english: "Type", turkish: "Tip" },
  { key: "architecture.type.new", english: "New type…", turkish: "Yeni tip…" },
  { key: "architecture.editType", english: "Edit type…", turkish: "Tipi düzenle…" },
  // §2.3: a type's rating words; §7 keeps `1 hr`/`90 min` as the typed examples.
  { key: "architecture.fireRating", english: "Fire rating", turkish: "Yangın derecesi" },
  { key: "architecture.fireResistance", english: "Fire resistance", turkish: "Yangın dayanımı" },
  { key: "architecture.rated.not", english: "Not rated", turkish: "Dereceli değil" },
  // §8: the status vocabulary a wall's top and base use.
  { key: "architecture.top.label", english: "Top", turkish: "Üst" },
  { key: "architecture.base.label", english: "Base", turkish: "Taban" },
  { key: "architecture.top.unconnected", english: "Unconnected (set height)", turkish: "Bağlantısız (yükseklik ver)" },
  { key: "architecture.top.topOffset", english: "Top offset", turkish: "Üst kaydırması" },
  // §3: Cancel is İptal here (a dialog's own button, not Vazgeç).
  { key: "architecture.cancel", english: "Cancel", turkish: "İptal" },
  // The snap marker: §2.3 *wall* = duvar, *midpoint* = orta nokta (§5.2).
  { key: "architecture.snap.wallEnd", english: "Wall end", turkish: "Duvar ucu" },
  { key: "architecture.snap.wallMidpoint", english: "Wall midpoint", turkish: "Duvar orta noktası" },
  { key: "architecture.snap.perpendicular", english: "Perpendicular to the wall", turkish: "Duvara dik" },
  { key: "architecture.snap.free", english: "Free", turkish: "Serbest" },
  // §7: `6"` is an inch mark and `mm` a unit symbol; neither is a word.
  { key: "architecture.snap.inchGrid", english: '6" drafting grid', turkish: '6" çizim ızgarası' },
  // §8: a door says why it won't fit without a plural suffix.
  {
    key: "architecture.opening.doesNotFit",
    english: "This wall is {{length}} mm long; a {{width}} mm {{noun}} doesn't fit",
    turkish: "Bu duvar {{length}} mm uzunluğunda; {{width}} mm'lik bir {{noun}} sığmaz",
  },
  // Two whole sentences, one key: the second is never spliced into the first.
  {
    key: "architecture.top.notTiedOrRun",
    english: '{{height}}, not tied to a level. Pick "Up to {{level}}" to make it follow that level, or run it to the slab above, a ceiling or a roof.',
    turkish: '{{height}}, bir kata bağlı değil. O katı izlemesi için "{{level}} katına kadar" seçin, ya da üstteki döşemeye, bir tavana veya çatıya uzatın.',
  },
  // The count sentence: English pluralises the noun in its own default (§8).
  { key: "architecture.usedBy.none", english: "Not used by anything yet", turkish: "Henüz hiçbir şey tarafından kullanılmıyor" },
  { key: "architecture.usedBy.one", english: "Used by 1 {{what}}", turkish: "1 {{what}} tarafından kullanılıyor" },
  { key: "architecture.usedBy.many", english: "Used by {{count}} {{what}}s", turkish: "{{count}} {{what}} tarafından kullanılıyor" },
];

/** How many call sites each shared caption has today — a new one is a deliberate bump. */
const SITES: Readonly<Record<string, number>> = {
  // The shared nouns: the tool table, the type sentences and the hint bar.
  "architecture.noun.wall": 4,
  "architecture.noun.door": 5,
  "architecture.noun.window": 5,
  "architecture.noun.opening": 5,
  "architecture.noun.ceiling": 3,
  "architecture.noun.column": 3,
  "architecture.noun.floor": 3,
  "architecture.type.none": 2,
  "architecture.fireRating": 3,
  "architecture.noun.element": 2,
  "architecture.top.wallHeight": 2,
  "architecture.top.theLevelAbove": 2,
  "architecture.snap.perpendicularToLinked": 3,
  "architecture.snap.perpendicular": 2,
  "architecture.thisLevel": 2,
  "architecture.undo.draw": 3,
  "architecture.cancel": 2,
  "architecture.hint.start": 2,
  "architecture.location.centreLine": 2,
  "architecture.location.finishFace": 2,
  "architecture.top.noLevelToMeasure": 2,
  "architecture.base.noLevelToStandOn": 2,
  "architecture.top.setTopOffset": 2,
  "architecture.rated.not": 3,
  "architecture.rated.useType": 2,
  "architecture.type.save": 1,
  "architecture.level.needsSurface": 2,
  "architecture.referentIt": 2,
  "architecture.opening.pointAtWall": 1,
};

const VALUES: Readonly<Record<string, Readonly<Record<string, string | number>>>> = {
  "architecture.opening.doesNotFit": { length: 900, width: 1000, noun: "kapı" },
  "architecture.top.notTiedOrRun": { height: "3 m yüksekliğinde", level: "Kat 2" },
  "architecture.usedBy.one": { what: "duvar" },
  "architecture.usedBy.many": { count: 14, what: "kapı" },
};

const fill = (template: string, values: Readonly<Record<string, string | number>> | undefined): string =>
  values === undefined ? template : template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) => String(values[name]));

test("every architecture caption is still keyed in the source, with its English unchanged", () => {
  const source = editorSourceCaptions();
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english });
  }
});

test("every architecture caption has Turkish, and it says what the glossary pins", () => {
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, turkish: TURKISH[caption.key] }).toEqual({ key: caption.key, turkish: caption.turkish });
  }
});

test("every architecture key in the source has a Turkish value — no caption falls back to English", () => {
  expect(IN_SOURCE.length).toBeGreaterThan(200);
  expect(IN_SOURCE.filter((key) => (TURKISH[key] ?? "").trim() === "")).toEqual([]);
});

test("no architecture key is translated without a call site", () => {
  const written = new Set(IN_SOURCE);
  const orphans = Object.keys(TURKISH)
    .filter((key) => key.startsWith("architecture."))
    .filter((key) => !written.has(key));
  expect(orphans).toEqual([]);
});

test("a caption is still keyed at every place it is written", () => {
  const source = editorSourceCaptions();
  for (const [key, sites] of Object.entries(SITES)) {
    expect({ key, sites: source.get(key)?.sites }).toEqual({ key, sites });
  }
});

test("no shared architecture caption is unpinned: every key written twice is in SITES", () => {
  const twice = [...editorSourceCaptions().entries()].filter(([key, caption]) => key.startsWith("architecture.") && caption.sites > 1);
  expect(twice.filter(([key]) => SITES[key] === undefined).map(([key, caption]) => `${key} (${caption.sites} sites)`)).toEqual([]);
});

test("the Turkish placeholder in an architecture caption matches the English one", () => {
  const placeholders = (text: string): string[] => [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/gu)].map((match) => match[1] ?? "").sort();
  const source = editorSourceCaptions();
  const wrong = [...source.entries()]
    .filter(([key]) => key.startsWith("architecture."))
    .map(([key, caption]) => ({ key, english: placeholders(caption.english), turkish: placeholders(TURKISH[key] ?? "") }))
    .filter((row) => row.english.join(",") !== row.turkish.join(","));
  expect(wrong).toEqual([]);
});

test("a placeholder is never written with one brace", () => {
  const wrong = Object.entries(TURKISH)
    .filter(([key]) => key.startsWith("architecture."))
    .filter(([, value]) => /(^|[^{])\{[A-Za-z0-9_]+\}/u.test(value))
    .map(([key]) => key);
  expect(wrong).toEqual([]);
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
// The tool table is an accessor, not a Record of English
// ---------------------------------------------------------------------------

test("every tool says its name, its why and its noun in the language being drawn", () => {
  expect(ARCHITECTURE_TOOLS.length).toBe(14);
  const wall = toolById("wall");
  expect(wall?.label(EN)).toBe("Wall");
  expect(wall?.label(TR)).toBe("Duvar");
  expect(wall?.noun(EN)).toBe("wall");
  expect(wall?.noun(TR)).toBe("duvar");
  expect(wall?.description(EN)).toBe("Draw walls corner to corner; they join where they meet");
  expect(DATUM_TOOLS.map((tool) => tool.label(TR))).toEqual(["Kat", "Izgara", "Referans düzlemi"]);
  // The rectangle tool draws the same noun as the wall tool: one word, one key.
  expect(BUILD_TOOLS.find((tool) => tool.id === "wall_rectangle")?.noun(TR)).toBe("duvar");
});

test("the Architecture tab's buttons and tooltips are Turkish, and its English is what it was", () => {
  const ribbon = { tool: null, setTool: () => undefined, blocked: null, editType: null, addLevel: null };
  const select = { id: "select", label: "Select", commands: [] };
  const english = TABS.architecture(ribbon, select, EN);
  const turkish = TABS.architecture(ribbon, select, TR);
  expect(english.label).toBe("Architecture");
  expect(turkish.label).toBe("Mimarlık");
  const labels = (tab: typeof english) => tab.groups.flatMap((group) => group.commands.map((command) => command.label));
  expect(labels(english)).toContain("Wall");
  expect(labels(turkish)).toContain("Duvar");
  // A tool's tooltip is its description in the same language.
  expect(labels(turkish)).toContain("Tipi düzenle…");
});

test("why the Level tool can't open is the editor's sentence, in its language", () => {
  expect(levelButton({ editBlocked: null, modelToolsOff: true }, EN).levelWhy).toBe("Add levels from a plan or the 3D view: open one from the Views and sheets panel");
  expect(levelButton({ editBlocked: null, modelToolsOff: true }, TR).levelWhy).toBe("Katları plandan veya 3B görünümden ekleyin: Görünümler ve paftalar panelinden birini açın");
  expect(levelButton({ editBlocked: null, modelToolsOff: false }, TR).levelWhy).toBe("Katları bu yüzeyde Model › Katlar'dan ekleyin");
});

// ---------------------------------------------------------------------------
// The hint bar
// ---------------------------------------------------------------------------

test("the chain hint is the same English and a Turkish sentence", () => {
  expect(chainHint(EMPTY_CHAIN, "wall", EN)).toBe("Click the wall's start");
  expect(chainHint(EMPTY_CHAIN, "duvar", TR)).toBe("duvar başlangıcına tıklayın");
  const typed = { ...EMPTY_CHAIN, points: [{ x: 0, y: 0 }], typed: "450" };
  // §7: `mm` is a unit symbol and travels as it is.
  expect(chainHint(typed, "wall", EN)).toBe("450 mm: Enter puts the corner down along the pointer");
  expect(chainHint(typed, "duvar", TR)).toBe("450 mm: Enter köşeyi işaretçi yönünde koyar");
});

test("the draft hint names the tool with its own noun, in either language", () => {
  const wallTool = toolById("wall");
  if (!wallTool) throw new Error("the wall tool is gone");
  const wallDraft = startDraft(wallTool);
  expect(draftHint(wallDraft, EN)).toBe("Click the wall's start");
  expect(draftHint(wallDraft, TR)).toBe("duvar başlangıcına tıklayın");
  const rectTool = toolById("wall_rectangle");
  if (!rectTool) throw new Error("the rectangle tool is gone");
  const rect = startDraft(rectTool);
  expect(draftHint(rect, EN)).toBe("Click one corner of the rectangle");
  expect(draftHint(rect, TR)).toBe("Dikdörtgenin bir köşesine tıklayın");
});

test("a door off a wall says why at the pointer, in the language being drawn", () => {
  const door = toolById("door");
  const draft: Draft = { tool: door!, chain: EMPTY_CHAIN, side: 1, aim: null, face: null };
  const hint = draftHint({ ...draft, chain: { ...EMPTY_CHAIN, points: [] } }, TR);
  expect(hint).toBe("kapı yerleştirmek için bir duvara işaret edin");
  expect(openingHint("door", null, EN)).toBe("Point at a wall to put the door in");
  expect(openingHint("window", null, TR)).toBe("pencere yerleştirmek için bir duvara işaret edin");
});

test("the two door flips refuse in the editor's words, and English reads as it did", () => {
  const notADoor = { id: "x", kind: "wall" } as never;
  expect(doorFlipCommand({}, notADoor, "hinge", EN)).toBe("Select one door to flip it.");
  expect(doorFlipCommand({}, notADoor, "hinge", TR)).toBe("Çevirmek için tek bir kapı seçin.");
});

test("how tall the wall's end drag is said in the language being drawn", () => {
  // No wall joins this end, and the pointer is 3'-0" from the fixed end.
  expect(endDragHint({}, "w1", "start", null, 914.4, EN)).toBe("Drag the wall's end · 3'-0\" long · Nothing is joined at this end · Esc cancels");
  expect(endDragHint({}, "w1", "start", null, 914.4, TR)).toBe("Duvarın ucunu sürükleyin · 3'-0\" uzunluğunda · Bu uçta birleşen yok · Esc vazgeçirir");
});

// ---------------------------------------------------------------------------
// The snap marker
// ---------------------------------------------------------------------------

const EMPTY_MODEL = { modelId: "m", revision: 0, elements: {}, connections: [], settings: { units: "imperial", precision: 2 } } as unknown as ModelState;

test("a snap marker speaks the language being drawn, and its English is unchanged", () => {
  const input = { model: EMPTY_MODEL, levelId: "L1", raw: { x: 12, y: 34 }, toleranceMm: 300, corners: [], gridMm: null };
  expect(snapPoint({ ...input, t: EN }).label).toBe("Free");
  expect(snapPoint({ ...input, t: TR }).label).toBe("Serbest");
  const grid = { ...input, gridMm: 152.4 };
  expect(snapPoint({ ...grid, t: EN }).label).toBe('6" drafting grid');
  expect(snapPoint({ ...grid, t: TR }).label).toBe('6" çizim ızgarası');
  // §8: a number is followed by a singular, and `mm` is not translated.
  expect(snapPoint({ ...input, gridMm: 200, t: TR }).label).toBe("200 mm çizim ızgarası");
  const closing = { ...input, corners: [{ x: 12, y: 34 }, { x: 900, y: 900 }] };
  expect(snapPoint({ ...closing, t: TR }).label).toBe("İlk köşe: döngüyü kapatır");
});

// ---------------------------------------------------------------------------
// The type fields and their refusals
// ---------------------------------------------------------------------------

const PART = { id: "d1", kind: "opening", openingType: "door", levelId: "L1", hostId: "w1", height: 2134 } as never;

test("how many use a type is said in the language being drawn, without an English noun inside it", () => {
  expect(usedByWords([], EN)).toBe("Not used by anything yet");
  expect(usedByWords([], TR)).toBe("Henüz hiçbir şey tarafından kullanılmıyor");
  expect(usedByWords([PART], EN)).toBe("Used by 1 door");
  // §8: no plural suffix after a number, so Turkish keeps the singular noun.
  expect(usedByWords([PART], TR)).toBe("1 kapı tarafından kullanılıyor");
  expect(usedByWords([PART, PART], EN)).toBe("Used by 2 doors");
  expect(usedByWords([PART, PART], TR)).toBe("2 kapı tarafından kullanılıyor");
});

test("a number typed wrong is refused in the language being drawn, and English reads as it did", () => {
  const fields = [{ key: "thickness", label: "Thickness", group: "Geometry", control: "number" as const, unit: "in" }];
  const refused = changedValues({ values: {} }, fields, { thickness: "2 1/2" }, EN);
  expect("refusal" in refused ? refused.refusal : null).toBe('Thickness needs a number in in; "2 1/2" isn\'t one.');
  const turkish = changedValues({ values: {} }, fields, { thickness: "2 1/2" }, TR);
  expect("refusal" in turkish ? turkish.refusal : null).toBe('Thickness in cinsinden bir sayı olmalı; "2 1/2" bir sayı değil.');
});

test("a height that doesn't read is refused in the language being drawn", () => {
  const english = parseWallHeight("10 ft-ish", EN);
  expect("why" in english ? english.why : null).toBe('"10 ft-ish" doesn\'t read as a height. Type feet and inches: 10\'-0", 9 ft 6 in, 108".');
  const turkish = parseWallHeight("10 ft-ish", TR);
  expect("why" in turkish ? turkish.why : null).toBe('"10 ft-ish" bir yükseklik olarak okunmuyor. Fit ve inç yazın: 10\'-0", 9 ft 6 in, 108".');
  // What reads as a height is read the same way in both languages: the parser is not translated.
  expect(parseWallHeight("10'-0\"", TR)).toEqual({ mm: 3048 });
});

test("a wall with no level to measure from says so in the language being drawn", () => {
  // A wall with no placement has no level to measure its top or to stand on.
  const loose = { id: "w1", kind: "wall", height: 3000 } as never;
  expect(wallTopCommand(EMPTY_MODEL, loose, { heightMm: 3000 }, EN)).toBe("This wall has no level to measure its top from; move it onto a level first");
  expect(wallTopCommand(EMPTY_MODEL, loose, { heightMm: 3000 }, TR)).toBe("Bu duvarın üstünü ölçecek bir katı yok; önce onu bir kata taşıyın");
  expect(wallBaseCommand(EMPTY_MODEL, loose, { on: "level" }, TR)).toBe("Bu duvarın üzerinde duracağı bir katı yok; önce onu bir kata taşıyın");
});

test("§7: a refusal that names a length keeps its unit symbols, and a height of zero is refused", () => {
  // The level exists, so the top can be measured; the height itself is the problem.
  const model = {
    modelId: "m",
    revision: 0,
    elements: {
      L1: { id: "L1", kind: "level", name: "1", elevationMm: 0 },
      w1: { id: "w1", kind: "wall", height: 3000, levelId: "L1", placement: { kind: "line", start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } }, values: {} },
    },
    connections: [],
    settings: { units: "imperial", precision: 2 },
  } as unknown as ModelState;
  const wall = (model.elements as Record<string, unknown>)["w1"] as never;
  expect(wallTopCommand(model, wall, { heightMm: 0 }, EN)).toBe("A wall needs a height above zero");
  expect(wallTopCommand(model, wall, { heightMm: 0 }, TR)).toBe("Bir duvarın yüksekliği sıfırdan büyük olmalı");
});
