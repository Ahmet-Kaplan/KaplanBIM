/**
 * @jest-environment node
 *
 * i9-boolean-clip: a solid the file cut with another shape is measured, not
 * refused. The geometry reader reads the difference's first operand (the whole
 * solid with the cut left in it) and sets `cutsLeftIn`, so `verticalPrism` and
 * `straightSweep` take it and the report says what was measured. `unread` still
 * names the cut: the reading is honest about what it doesn't subtract.
 *
 * A union or an intersection's first operand isn't the product at all, so it
 * still stays on the linked model: measuring less than the model holds is worse
 * than refusing.
 */
import { type BimElement, type Wall } from "@permitzip/bim-kernel";
import { importIfc, readIfcSource } from "../src";
import { IfcText, hostModel } from "./i9-fixtures";

const ofKind = <K extends BimElement["kind"]>(records: readonly BimElement[], kind: K) => records.filter((r): r is Extract<BimElement, { kind: K }> => r.kind === kind);

/** A 6000 x 200 wall, 3000 tall, from the origin along +x, whose body is `operator` of the wall and a box beside it. */
function clipped(operator: "DIFFERENCE" | "UNION" | "INTERSECTION"): string {
  const t = IfcText.start("mm");
  t.storey("Level 1", 0);
  const solid = t.extrude(t.rect(6000, 200, [3000, 0]), 3000);
  const cut = t.extrude(t.rect(1000, 400, [1000, 0]), 3000);
  const item = t.add("IFCBOOLEANRESULT", `.${operator}.,#${solid},#${cut}`);
  t.product("Level 1", "IFCWALL", "Cut wall", [0, 0, 0], t.body([item]), ".STANDARD.");
  return t.text();
}

function convert(text: string) {
  return importIfc(text, { model: hostModel(), referenceId: "ref-clip", sourceKey: "v1", sourceId: "ver-clip-1", label: "Clipped walls", disciplines: ["architecture"] });
}

describe("i9-boolean-clip", () => {
  it("converts a wall cut by another shape, keeping the cut reported", () => {
    const text = clipped("DIFFERENCE");
    const source = readIfcSource(text, { sourceId: "ver-clip-1", label: "Clipped walls", disciplines: ["architecture"] });
    const [product] = source.products;
    // The reader still says the shape wasn't read exactly, and that what it did read holds the whole wall.
    expect(product?.geometry.unread).toBe("cut by another shape");
    expect(product?.geometry.cutsLeftIn).toBe(true);

    const plan = convert(text);
    const [wall] = ofKind(plan.records, "wall") as [Wall, ...Wall[]];
    expect(ofKind(plan.records, "wall")).toHaveLength(1);
    // The uncut solid: 6000 long, 200 thick, 3000 tall, from the origin along +x.
    expect(wall.start).toEqual({ x: 0, y: 0 });
    expect(wall.end.x).toBeCloseTo(6000, 0);
    expect(wall.end.y).toBeCloseTo(0, 0);
    expect(wall.thickness).toBe(200);
    expect(wall.height).toBe(3000);
    // The report tells the truth about it: it was measured, and its cut isn't subtracted.
    expect(plan.report.notes.join(" | ")).toMatch(/measured from its uncut solid .*its shape as cut by another shape/);
    expect(plan.report.classes.find((c) => c.classId === "arch.wall")).toMatchObject({ converted: 1, linked: [] });
  });

  it("leaves a union or an intersection on the linked model: its first operand isn't the product", () => {
    for (const [operator, words] of [
      ["UNION", "a union of two shapes"],
      ["INTERSECTION", "an intersection of two shapes"],
    ] as const) {
      const plan = convert(clipped(operator));
      expect(ofKind(plan.records, "wall")).toHaveLength(0);
      expect(plan.report.classes.find((c) => c.classId === "arch.wall")?.linked).toEqual([{ reason: `its shape is ${words}`, count: 1 }]);
      expect(plan.report.notes.join(" | ")).not.toMatch(/uncut solid/);
    }
  });

  it("refuses a cut solid with a mesh beside it: the mesh isn't in the reading", () => {
    // The base extrusion alone would measure this wall, but the mesh beside it
    // would be dropped, and a wall measured short is worse than one left linked.
    const t = IfcText.start("mm");
    t.storey("Level 1", 0);
    const solid = t.extrude(t.rect(6000, 200, [3000, 0]), 3000);
    const cut = t.add("IFCBOOLEANCLIPPINGRESULT", `.DIFFERENCE.,#${solid},#${solid}`);
    const mesh = t.add("IFCTRIANGULATEDFACESET", `#${t.add("IFCCARTESIANPOINTLIST3D", "((6000.,0.,0.),(6200.,0.,0.),(6200.,0.,3000.))")},$,$,$,$`);
    t.product("Level 1", "IFCWALL", "Wall and flap", [0, 0, 0], t.body([cut, mesh]), ".STANDARD.");
    const source = readIfcSource(t.text(), { sourceId: "ver-clip-2", label: "Wall and flap", disciplines: ["architecture"] });
    expect(source.products[0]?.geometry.cutsLeftIn).toBeUndefined();
    const plan = convert(t.text());
    expect(ofKind(plan.records, "wall")).toHaveLength(0);
    expect(plan.report.classes.find((c) => c.classId === "arch.wall")?.linked).toEqual([{ reason: "its shape is cut by another shape", count: 1 }]);
  });
});
