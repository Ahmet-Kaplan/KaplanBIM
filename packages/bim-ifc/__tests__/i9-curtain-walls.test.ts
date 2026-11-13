/**
 * @jest-environment node
 *
 * i9-curtain-walls (plan step 8): a glazed façade comes in. An `IfcPlate` is
 * the sheet a façade is priced by m² and an `IfcMember` the mullion or transom
 * it is priced by length, through the Architecture add-on's two classes and
 * two rules. Before this, every plate and member of the repo's own sample
 * model (25 of its 34 products) stayed linked with "no class in this model
 * takes it".
 *
 * The readings are the honest ones: a sheet's face is its own largest side, so
 * a sheet lying flat or a face that isn't the upright rectangle keeps the area
 * the file gives rather than a length × height that would be wrong; a section
 * that is neither a rectangle nor a circle keeps its length and its area, and
 * says it named no profile size.
 */
import { type BimElement, type ModelState, landImport, takeoffTotals, withUpgradePolicy } from "@permitzip/bim-kernel";
import { CURTAIN_MEMBER_KIND, CURTAIN_PANEL_KIND } from "@permitzip/bim-pack-architecture";
import { importIfc } from "../src";
import { IfcText, hostModel } from "./i9-fixtures";

const ofKind = (records: readonly BimElement[], kind: string) => records.filter((r) => r.kind === kind);
const panel = (records: readonly BimElement[]) => ofKind(records, CURTAIN_PANEL_KIND) as unknown as ReadonlyArray<Record<string, unknown>>;
const member = (records: readonly BimElement[]) => ofKind(records, CURTAIN_MEMBER_KIND) as unknown as ReadonlyArray<Record<string, unknown>>;

function convert(text: string): ReturnType<typeof importIfc> {
  return importIfc(text, { model: hostModel(), referenceId: "ref-curtain", sourceKey: "v1", sourceId: "ver-curtain-1", label: "Glazed façade", disciplines: ["architecture"] });
}

/** Landed as the model server decides it: every peer reads the add-on kinds an import writes. */
function landed(records: readonly BimElement[]): ModelState {
  const result = withUpgradePolicy(() => true, () => landImport(hostModel(), records));
  expect(result.dropped).toEqual([]);
  return result.model;
}

/** Takeoff lines of one measure, as `<group kind>|<label>|<elements>|<value>`. */
function lines(elements: ModelState["elements"], measure: string): string[] {
  return takeoffTotals(elements)
    .filter((t) => t.measure.key === measure)
    .map((t) => `${t.group.kind}|${t.group.label}|${t.elementCount}|${t.value.toFixed(2)}`)
    .sort();
}

/** A standing sheet: a `length` × `thickness` footprint at `baseZ`, pushed up `height`. */
function sheet(t: IfcText, length: number, thickness: number, height: number, baseZ: number): number {
  return t.extrude(t.rect(length, thickness, [length / 2, 0]), height, t.axis3([0, 0, baseZ]));
}

/** A straight bar of `width` × `depth` at `baseZ`, pushed up `height` (a mullion, or a transom extruded up its own 90 mm). */
function bar(t: IfcText, length: number, depth: number, height: number, baseZ: number): number {
  return t.extrude(t.rect(length, depth, [length / 2, 0]), height, t.axis3([0, 0, baseZ]));
}

describe("i9 curtain walls", () => {
  it("an IfcPlate is a panel by its m² and an IfcMember a line of framing by its length", () => {
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    t.product("Level 1", "IFCPLATE", "Glazed panel", [0, 0, 0], t.body([sheet(t, 1680, 10, 1420, 490)]), ".SHEET.");
    t.product("Level 1", "IFCMEMBER", "Mullion", [0, 0, 0], t.body([bar(t, 90, 90, 1420, 490)]), ".MULLION.");
    const plan = convert(t.text());
    // Both convert: the file's `.SHEET.` is a glazed panel as much as `.CURTAIN_PANEL.`, and a
    // member's predefined type (MULLION, TRANSOM, STUD…) doesn't change what it is measured as.
    expect(plan.report.converted).toBe(2);
    const [p] = panel(plan.records);
    expect(p).toMatchObject({ levelId: "L1", start: { x: 0, y: 0 }, end: { x: 1680, y: 0 }, heightMm: 1420, thicknessMm: 10, baseOffsetMm: 490 });
    expect(p?.areaSqM).toBeUndefined();
    const [m] = member(plan.records);
    // A mullion stands up: its axis is its push, and its section is the 90 × 90 it was drawn with.
    expect(m).toMatchObject({ start: { x: 45, y: 0 }, end: { x: 45, y: 0 }, startZmm: 490, endZmm: 1910, profile: { shape: "rect", width: 90, height: 90 } });
    const model = landed(plan.records);
    // m² for the glazing, m for the framing, and the framing groups by its profile size.
    expect(lines(model.elements, "qto.area").filter((l) => l.includes("Curtain wall panels"))).toEqual(["class|Curtain wall panels|1|2.39"]);
    expect(lines(model.elements, "qto.length").filter((l) => l.includes("Mullions"))).toEqual(["class|Mullions and transoms|1|1.42"]);
    const length = takeoffTotals(model.elements).find((t) => t.measure.key === "qto.length");
    expect(length?.sizeGroup).toBe("90 × 90 mm");
    const section = takeoffTotals(model.elements).find((t) => t.measure.key === "qto.section_area");
    expect(section?.value.toFixed(4)).toBe("0.0081");
  });

  it("a transom drawn as its section pushed along its length reads the same way", () => {
    // The other way a viewer exports a horizontal member: the 90 × 90 section is
    // the profile and the push is the 1860 mm it runs. Same length, same section.
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    t.product("Level 1", "IFCMEMBER", "Transom", [0, 0, 0], t.body([t.extrude(t.rect(90, 90), 1860, t.axis3([0, 0, 445], [1, 0, 0], [0, 0, 1]))]), ".TRANSOM.");
    const plan = convert(t.text());
    const [m] = member(plan.records);
    expect(m).toMatchObject({ start: { x: 0, y: 0 }, end: { x: 1860, y: 0 }, startZmm: 445, endZmm: 445, profile: { shape: "rect", width: 90, height: 90 } });
    expect(lines(landed(plan.records).elements, "qto.length")).toEqual(["class|Mullions and transoms|1|1.86"]);
  });

  it("the file's own type reaches a panel and a member (`IfcRelDefinesByType`, step 2's path)", () => {
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    const p1 = t.product("Level 1", "IFCPLATE", "Panel 1", [0, 0, 0], t.body([sheet(t, 1680, 10, 1420, 490)]), ".CURTAIN_PANEL.");
    const p2 = t.product("Level 1", "IFCPLATE", "Panel 2", [0, 0, 0], t.body([sheet(t, 1680, 10, 1420, 490)]), ".CURTAIN_PANEL.");
    const m = t.product("Level 1", "IFCMEMBER", "Mullion", [0, 0, 0], t.body([bar(t, 90, 90, 1420, 490)]), ".MULLION.");
    t.type("IFCPLATETYPE", "Glazed panel 1680 × 1420", [p1, p2], "CURTAIN_PANEL");
    t.type("IFCMEMBERTYPE", "Mullion 90 × 90", [m], "MULLION");
    const plan = convert(t.text());
    const types = ofKind(plan.records, "element_type") as unknown as ReadonlyArray<{ id: string; name: string; forKinds?: readonly string[] }>;
    expect(types.map((ty) => `${ty.name}|${ty.forKinds?.join()}`).sort()).toEqual(["Glazed panel 1680 × 1420|architecture.curtain_panel", "Mullion 90 × 90|architecture.curtain_member"]);
    const panelType = types.find((ty) => ty.name === "Glazed panel 1680 × 1420");
    expect(panel(plan.records).map((p) => p.typeId)).toEqual([panelType?.id, panelType?.id]);
    expect(member(plan.records).map((m2) => m2.typeId)).toEqual([types.find((ty) => ty.name === "Mullion 90 × 90")?.id]);
    // Grouped by the file's type, so the takeoff splits two panels of one type from the framing's own type.
    expect(lines(landed(plan.records).elements, "qto.area")).toEqual(["type|Glazed panel 1680 × 1420|2|4.77"]);
    expect(lines(landed(plan.records).elements, "qto.length")).toEqual(["type|Mullion 90 × 90|1|1.42"]);
  });

  it("a panel whose profile isn't a rectangle still comes in with its face area", () => {
    // A tapered sheet: 1680 long, 10 mm at one end and 30 mm at the other, 1420 tall.
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    const face = t.polygon([[0, -5], [1680, -15], [1680, 15], [0, 5]]);
    t.product("Level 1", "IFCPLATE", "Tapered panel", [0, 0, 0], t.body([t.extrude(face, 1420, t.axis3([0, 0, 490]))]), ".SHEET.");
    const plan = convert(t.text());
    // Nothing is refused for the profile: the sheet's largest side is 1680 × 1420,
    // which is what a glazier prices, and that is exactly what the record states.
    expect(plan.report.classes.find((c) => c.classId === "arch.curtain_panel")).toMatchObject({ converted: 1, linked: [] });
    const [p] = panel(plan.records);
    expect(p?.areaSqM).toBeUndefined();
    expect(lines(landed(plan.records).elements, "qto.area")).toEqual(["class|Curtain wall panels|1|2.39"]);
  });

  it("a sheet lying flat takes the face the file gives, not a length × height that would be wrong", () => {
    // A 1000 × 1000 sheet 10 mm thick: its face is the floor plan, so the record
    // states that m² (as a room states its own area) and says so in the report.
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    t.product("Level 1", "IFCPLATE", "Flat sheet", [0, 0, 0], t.body([t.extrude(t.rect(1000, 1000), 10)]), ".SHEET.");
    const plan = convert(t.text());
    const [p] = panel(plan.records);
    expect(p).toMatchObject({ heightMm: 10, thicknessMm: 10, areaSqM: 1 });
    expect(plan.report.notes.join(" | ")).toMatch(/its face isn't the upright rectangle its plan extent and height give/);
    expect(lines(landed(plan.records).elements, "qto.area")).toEqual(["class|Curtain wall panels|1|1.00"]);
  });

  it("a member whose section is neither a rectangle nor a circle keeps its length and its area", () => {
    // An L-section mullion: 90 × 90 with a 30 × 30 notch, 1420 tall (7200 mm², not 8100).
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    const l = t.polygon([[0, 0], [90, 0], [90, 60], [60, 60], [60, 90], [0, 90]]);
    t.product("Level 1", "IFCMEMBER", "L mullion", [0, 0, 0], t.body([t.extrude(l, 1420, t.axis3([0, 0, 490]))]), ".MULLION.");
    const plan = convert(t.text());
    const [m] = member(plan.records);
    expect(m).toMatchObject({ startZmm: 490, endZmm: 1910 });
    expect(m?.profile).toBeUndefined();
    expect(m?.sectionAreaMm2).toBe(7200);
    expect(plan.report.notes.join(" | ")).toMatch(/its section isn't a rectangle or a circle/);
    const model = landed(plan.records);
    expect(lines(model.elements, "qto.length")).toEqual(["class|Mullions and transoms|1|1.42"]);
    expect(takeoffTotals(model.elements).find((x) => x.measure.key === "qto.section_area")?.value.toFixed(4)).toBe("0.0072");
    // Its size group says what it is rather than pretending to a profile size.
    expect(takeoffTotals(model.elements).find((x) => x.measure.key === "qto.length")?.sizeGroup).toBe("84.9 mm square section");
  });

  it("a sheet in two pieces stays linked, with the reason the reading gives", () => {
    // Two extruded pieces are not one sheet of a constant section: nothing here
    // can say which face a glazier would price, so it stays on the linked model.
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    t.product("Level 1", "IFCPLATE", "Split panel", [0, 0, 0], t.body([sheet(t, 800, 10, 1420, 490), sheet(t, 800, 10, 1420, 490)]), ".SHEET.");
    const plan = convert(t.text());
    const cls = plan.report.classes.find((c) => c.classId === "arch.curtain_panel");
    expect(cls?.converted).toBe(0);
    expect(cls?.linked).toEqual([{ reason: "it isn't one straight sheet with a constant profile", count: 1 }]);
  });
});
