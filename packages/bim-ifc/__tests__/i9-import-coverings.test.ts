/**
 * @jest-environment node
 *
 * i9-import-coverings: `IfcCovering` becomes the element a firm prices, and an
 * `IfcSpace` becomes a room a person can find and measure.
 *
 * A covering had a class (`arch.ceiling`) and a measure rule (ceiling m²) but
 * no import rule, so a suspended ceiling never came in at all. Now:
 *
 * - `CEILING` becomes a `ceiling` record: its footprint and how high its
 *   underside hangs above its level, which the takeoff's ceiling rule prices
 *   as suspended-ceiling m².
 * - `FLOORING` becomes a slim `slab` under its own class (`arch.finish`, Floor
 *   finishes): a screed or a finish floor is a horizontal plate with an area
 *   and a thickness, so it measures m² to lay and m³ to pour, and it stays a
 *   line of its own rather than joining the structural slabs.
 * - Both carry the file's type (`IfcRelDefinesByType`) as a real
 *   `element_type`, so two Revit types are two takeoff lines.
 *
 * An `IfcSpace` keeps its `LongName` as the room's name and its `Name` as the
 * number, and now also says where its tag goes (`labelSeed`, the point
 * furthest from its own walls) and how tall it is (`ceilingHeightMm`), so the
 * takeoff gives a volume as well as an area.
 */
import { type BimElement, type ModelState, landImport, takeoffTotals } from "@permitzip/bim-kernel";
import { importIfc } from "../src";
import { IfcText, hostModel } from "./i9-fixtures";

const ofKind = <K extends BimElement["kind"]>(records: readonly BimElement[], kind: K) => records.filter((r): r is Extract<BimElement, { kind: K }> => r.kind === kind);

const SQUARE: readonly (readonly [number, number])[] = [
  [0, 0],
  [4000, 0],
  [4000, 3000],
  [0, 3000],
];

/** An L: two wings of a room, whose corner mean falls outside the room. */
const L_SHAPE: readonly (readonly [number, number])[] = [
  [0, 0],
  [6000, 0],
  [6000, 2000],
  [2000, 2000],
  [2000, 6000],
  [0, 6000],
];

/** A covering (`IfcCovering`: the element prefix, then `PredefinedType`) of `outline`, `thickness` deep, with its underside at `z`. */
function covering(t: IfcText, storey: string, name: string, predefined: string, outline: readonly (readonly [number, number])[], thickness: number, z: number, tag?: string): number {
  return t.product(storey, "IFCCOVERING", name, [0, 0, z], t.body([t.extrude(t.polygon(outline), thickness)]), `.${predefined}.`, tag === undefined ? {} : { tag });
}

/** An `IfcSpace`: `(Name, LongName, CompositionType, PredefinedType)`, the last two written as given (`$` for none). */
function space(t: IfcText, storey: string, name: string, longName: string, outline: readonly (readonly [number, number])[], height: number, predefined: string | null): number {
  const rest = `.ELEMENT.,${predefined === null ? "$" : `.${predefined}.`},$`;
  const p = t.place(t.storeyPlacements.get(storey) ?? null, t.axis3([0, 0, 0]));
  const shape = t.body([t.extrude(t.polygon(outline), height)]);
  const id = t.add("IFCSPACE", `${t.guid()},$,'${name}',$,$,#${p},#${shape},'${longName}',${rest}`);
  const s = t.storeys.get(storey);
  if (s) t.contained.set(s, [...(t.contained.get(s) ?? []), id]);
  return id;
}

function convert(text: string, label = "Ceilings and finishes"): ReturnType<typeof importIfc> {
  return importIfc(text, { model: hostModel(), referenceId: "ref-cov", sourceKey: "v1", sourceId: "ver-cov-1", label, disciplines: ["architecture"] });
}

function landed(model: ModelState, records: readonly BimElement[]): ModelState {
  const result = landImport(model, records);
  expect(result.dropped).toEqual([]);
  return result.model;
}

/** Takeoff lines of the landed model, as `<measure>|<group kind>|<label>|value|elements`. */
function lines(model: ModelState): string[] {
  return takeoffTotals(model.elements)
    .map((t) => `${t.measure.key}|${t.group.kind}|${t.group.label}|${Math.round(t.value * 100) / 100}|${t.elementCount}`)
    .sort();
}

describe("i9-import-coverings", () => {
  it("a ceiling covering converts to a ceiling: its footprint, its height above the level, and m² to price", () => {
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    covering(t, "Level 1", "Suspended ceiling", "CEILING", SQUARE, 20, 2700);
    const plan = convert(t.text());
    const [ceiling] = ofKind(plan.records, "ceiling");
    expect(ceiling).toBeDefined();
    // Its class is the registry's (`arch.ceiling` recognises the kind), so no
    // `classId` is needed on the record: the takeoff finds it from the kind.
    expect(ceiling?.levelId).toBe("L1");
    expect(ceiling?.form).toBe("flat");
    // Its underside hangs 2700 mm above Level 1, not 2720: the height is where you look up to.
    expect(ceiling?.heightMm).toBe(2700);
    expect(ceiling?.outline).toHaveLength(4);
    expect(plan.report.converted).toBe(1);
    expect(plan.report.classes.find((c) => c.classId === "arch.ceiling")).toMatchObject({ converted: 1, linked: [] });
    const measured = lines(landed(hostModel(), plan.records));
    expect(measured).toEqual(expect.arrayContaining(["qto.count|class|Ceilings|1|1", "qto.area|class|Ceilings|12|1", "qto.area_surface|class|Ceilings|12|1"]));
  });

  it("a flooring covering converts to a floor finish, not to a structural floor: m² to lay and m³ to pour, apart from the slabs", () => {
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    // The structural slab, then the screed over it.
    t.product("Level 1", "IFCSLAB", "Floor", [0, 0, -250], t.body([t.extrude(t.polygon(SQUARE), 250)]), ".FLOOR.");
    covering(t, "Level 1", "Screed", "FLOORING", SQUARE, 60, 0);
    const plan = convert(t.text());
    const finishes = ofKind(plan.records, "slab").filter((s) => s.classId === "arch.finish");
    expect(finishes).toHaveLength(1);
    expect(finishes[0]?.thickness).toBe(60);
    // The structural slab (`IfcSlab`/FLOOR) came in under its own class, and the finish under its own.
    expect(ofKind(plan.records, "slab").filter((s) => s.classId !== "arch.finish")).toHaveLength(1);
    const measured = lines(landed(hostModel(), plan.records));
    expect(measured).toEqual(expect.arrayContaining(["qto.area|class|Floor finishes|12|1", "qto.volume|class|Floor finishes|0.72|1"]));
    // The structural slab's own area is a different line: the finish never folds into it.
    expect(measured).toEqual(expect.arrayContaining(["qto.area|class|Floor decks|12|1", "qto.volume|class|Floor decks|3|1"]));
  });

  it("two coverings of different Revit types are two takeoff lines, one per type", () => {
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    const acoustic = covering(t, "Level 1", "Ceiling A", "CEILING", SQUARE, 20, 2700);
    const plaster = covering(t, "Level 1", "Ceiling B", "CEILING", SQUARE.map(([x, y]) => [x + 6000, y] as const), 15, 2700);
    t.type("IFCCOVERINGTYPE", "Acoustic tile 600", [acoustic], "CEILING");
    t.type("IFCCOVERINGTYPE", "Plasterboard", [plaster], "CEILING");
    const plan = convert(t.text());
    expect(ofKind(plan.records, "element_type").map((x) => x.name).sort()).toEqual(["Acoustic tile 600", "Plasterboard"]);
    const ceilings = ofKind(plan.records, "ceiling");
    expect(ceilings).toHaveLength(2);
    // The element type is a real record the ceiling names, so the takeoff groups by the file's own type name.
    for (const c of ceilings) expect(ofKind(plan.records, "element_type").some((x) => x.id === c.typeId)).toBe(true);
    expect(ceilings.map((c) => c.typeId)).toEqual([expect.any(String), expect.any(String)]);
    expect(ceilings[0]?.typeId).not.toBe(ceilings[1]?.typeId);
    const measured = lines(landed(hostModel(), plan.records)).filter((l) => l.startsWith("qto.area|type|"));
    expect(measured).toEqual(["qto.area|type|Acoustic tile 600|12|1", "qto.area|type|Plasterboard|12|1"]);
  });

  it("a cladding covering stays linked, saying so, rather than becoming a ceiling", () => {
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    covering(t, "Level 1", "Wall cladding", "CLADDING", SQUARE, 20, 1200);
    const plan = convert(t.text());
    expect(ofKind(plan.records, "ceiling")).toHaveLength(0);
    expect(plan.report.converted).toBe(0);
    expect(plan.report.summary).toBe("Nothing in this linked model could be converted. Left 1 covering as the linked model.");
    expect(plan.report.classes.flatMap((c) => c.linked).map((r) => r.reason)).toEqual(["no class in this model takes it"]);
  });
});

describe("i9-import-spaces", () => {
  it("a space's LongName is the room's name and its Name the number", () => {
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    space(t, "Level 1", "101", "Office", SQUARE, 2800, "INTERNAL");
    const plan = convert(t.text());
    const [room] = ofKind(plan.records, "room");
    expect(room).toMatchObject({ number: "101", name: "Office", areaSqM: 12 });
  });

  it("a space with no PredefinedType still matches a class and converts", () => {
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    space(t, "Level 1", "102", "Store", SQUARE, 2400, null);
    const plan = convert(t.text());
    const [room] = ofKind(plan.records, "room");
    expect(room).toMatchObject({ number: "102", name: "Store" });
    expect(plan.report.classes.find((c) => c.classId === "arch.room")).toMatchObject({ converted: 1, linked: [] });
  });

  it("a space the file calls SPACE stays linked, and the report says why (the engineers' spaces have no import rule)", () => {
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    space(t, "Level 1", "103", "Server room", SQUARE, 2600, "SPACE");
    const plan = convert(t.text());
    expect(ofKind(plan.records, "room")).toHaveLength(0);
    // `.SPACE.` is the engineers' space, whose class names a kind the importer
    // has no rule for yet; it is reported, never dropped in silence.
    expect(plan.report.classes.find((c) => c.label === "Spaces")).toMatchObject({ converted: 0, linked: [{ reason: "Spaces can't be edited here yet", count: 1 }] });
  });

  it("a room is a quantity container: a tag seed well inside it, its own height, and a volume in the takeoff", () => {
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    space(t, "Level 1", "201", "L room", L_SHAPE, 3000, "INTERNAL");
    const plan = convert(t.text());
    const [room] = ofKind(plan.records, "room");
    if (!room) throw new Error("the space didn't convert to a room");
    // The corner mean of this L (2333, 2333) sits in the notch, outside the room; the seed is inside.
    expect(inside(L_SHAPE, room.labelSeed)).toBe(true);
    expect(Math.hypot((room.labelSeed?.x ?? 0) - 2333, (room.labelSeed?.y ?? 0) - 2333)).toBeGreaterThan(500);
    // Its own solid says floor to ceiling; the storey says nothing about it.
    expect(room.ceilingHeightMm).toBe(3000);
    const measured = lines(landed(hostModel(), plan.records));
    // 20 m² of floor (a 6×2 m wing and a 2×4 m one), 3000 mm tall.
    expect(measured).toEqual(expect.arrayContaining(["qto.area|class|Rooms|20|1", "qto.volume|class|Rooms|60|1", "qto.count|class|Rooms|1|1"]));
  });
});

/** Whether a plan point is inside a closed outline (ray casting), for the seed check. */
function inside(outline: readonly (readonly [number, number])[], p: { readonly x: number; readonly y: number } | undefined): boolean {
  if (!p) return false;
  let within = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i];
    const b = outline[j];
    if (!a || !b) continue;
    if (a[1] > p.y !== b[1] > p.y && p.x < ((b[0] - a[0]) * (p.y - a[1])) / (b[1] - a[1]) + a[0]) within = !within;
  }
  return within;
}
