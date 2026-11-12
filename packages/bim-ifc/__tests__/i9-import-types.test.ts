/**
 * @jest-environment node
 *
 * i9-import-types: `IfcRelDefinesByType` becomes a real `element_type`. The
 * reader already carried the type's GlobalId and name on the neutral product;
 * the plan makes one `element_type` per converted type and stamps `typeId` on
 * its instances, so `qtoGroupOf` groups the takeoff by the file's own type name
 * (or by the code the type carries) instead of collapsing a trade into one line.
 *
 * Before this, every imported wall was one "Walls" takeoff line and the Revit
 * type survived only as the free string `wallType`, which nothing groups on.
 */
import { type BimElement, type ModelState, landImport, takeoffTotals } from "@permitzip/bim-kernel";
import { importIfc } from "../src";
import { IfcText, hostModel } from "./i9-fixtures";

const ofKind = <K extends BimElement["kind"]>(records: readonly BimElement[], kind: K) => records.filter((r): r is Extract<BimElement, { kind: K }> => r.kind === kind);

/** `walls`: one entry per wall, the type name it is assigned (null: no type). `coded`: "Brick 200" carries a classification code. */
function model(walls: readonly (string | null)[], coded = false): string {
  const t = IfcText.start("mm");
  t.storey("Level 1", 0);
  const made = walls.map((_name, i) => t.wall("Level 1", `Wall ${i + 1}`, [0, i * 1000], 6000, 200, 3000));
  const byName = new Map<string, number[]>();
  for (const [i, name] of walls.entries()) {
    const id = made[i];
    if (name === null || id === undefined) continue;
    byName.set(name, [...(byName.get(name) ?? []), id]);
  }
  for (const [name, products] of byName) {
    const typeId = t.type("IFCWALLTYPE", name, products, "STANDARD");
    // The code the type carries, from the file's own classification library.
    if (coded && name === "Brick 200") t.classify([typeId], "Uniclass 2015", "EF_25_10");
  }
  return t.text();
}

function convert(text: string): ReturnType<typeof importIfc> {
  return importIfc(text, { model: hostModel(), referenceId: "ref-types", sourceKey: "v1", sourceId: "ver-types-1", label: "Typed walls", disciplines: ["architecture"] });
}

/** The host model with the plan's records landed on it, so the takeoff reads them as the model would. */
function landed(records: readonly BimElement[]): ModelState {
  const result = landImport(hostModel(), records);
  expect(result.dropped).toEqual([]);
  return result.model;
}

const lines = (elements: ModelState["elements"]) =>
  takeoffTotals(elements)
    .filter((t) => t.measure.key === "qto.count")
    .map((t) => `${t.group.kind}|${t.group.label}|${t.elementCount}`)
    .sort();

describe("i9-import-types", () => {
  it("two walls of different types are two takeoff lines, named after their types", () => {
    const plan = convert(model(["Brick 200", "Stud 92"]));
    const types = ofKind(plan.records, "element_type");
    expect(types.map((t) => t.name).sort()).toEqual(["Brick 200", "Stud 92"]);
    expect(types.every((t) => t.forKinds?.join() === "wall")).toBe(true);
    expect(types.every((t) => t.provenance?.source === "ver-types-1")).toBe(true);
    const walls = ofKind(plan.records, "wall");
    // Each wall names the type of the one it is: wall 1 is at y 0 (Brick 200), wall 2 at y 1000 (Stud 92).
    expect(walls.find((w) => w.start.y === 0)?.typeId).toBe(types.find((t) => t.name === "Brick 200")?.id);
    expect(walls.find((w) => w.start.y === 1000)?.typeId).toBe(types.find((t) => t.name === "Stud 92")?.id);
    // The free string is still there for older readers; nothing groups on it.
    expect(walls.map((w) => w.wallType).sort()).toEqual(["Brick 200", "Stud 92"]);
    // Grouped by type, not by class: the file's own type names are the rows.
    expect(lines(landed(plan.records).elements).filter((l) => l.startsWith("type|"))).toEqual(["type|Brick 200|1", "type|Stud 92|1"]);
  });

  it("walls of one type are one line with both walls in it", () => {
    const plan = convert(model(["Stud 92", "Stud 92"]));
    const types = ofKind(plan.records, "element_type");
    expect(types).toHaveLength(1);
    expect(ofKind(plan.records, "wall").map((w) => w.typeId)).toEqual([types[0]?.id, types[0]?.id]);
    expect(lines(landed(plan.records).elements).filter((l) => l.startsWith("type|"))).toEqual(["type|Stud 92|2"]);
  });

  it("an untyped wall keeps the class line beside the typed one", () => {
    const plan = convert(model(["Stud 92", null]));
    expect(ofKind(plan.records, "element_type")).toHaveLength(1);
    expect(lines(landed(plan.records).elements)).toEqual(["class|Walls|1", "type|Stud 92|1"]);
  });

  it("the code a type carries groups the takeoff by classification, not by type name", () => {
    const plan = convert(model(["Brick 200", "Stud 92"], true));
    const brick = ofKind(plan.records, "element_type").find((t) => t.name === "Brick 200");
    expect(brick?.classification).toEqual([{ system: "Uniclass 2015", code: "EF_25_10" }]);
    // A type code reaches its instances (`resolveClassification`), so its walls group under the code.
    expect(lines(landed(plan.records).elements)).toEqual(["classification|EF_25_10|1", "type|Stud 92|1"]);
  });
});
