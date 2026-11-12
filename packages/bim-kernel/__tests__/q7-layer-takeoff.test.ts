/**
 * @jest-environment node
 *
 * q7-layer-takeoff: a wall's build-up takes off per layer, per face.
 *
 * A 200 mm wall that is 15 mm plaster + 170 mm block + 15 mm plaster reaches the
 * takeoff as one volume unless its layers are measured, and nobody can price the
 * plaster. Here each layer is a line of its own under the wall's group: m² of one
 * face of the host (net of the openings it hosts, which is what a painter prices)
 * and the layer's own volume from its thickness.
 *
 * Two seams, both data:
 * - the layers ride on the record (an `element_type`'s or an element's `layers`), so
 *   nothing has to exist in a catalogue for an import to carry a build-up;
 * - a firm's material-name → cost-code rows (`MATERIAL_LAYER_CODE_POINT`) map a
 *   layer to a code when the firm has one. A layer no row names still takes off,
 *   labelled by its own material: a named but unpriced line is useful, a dropped
 *   one is not.
 */
import { MATERIAL_LAYER_CODE_POINT, asElementId, takeoffTotals, type BimElement, type MaterialLayerSet, type ModelState } from "../src";
import { contribute, definePack, PackSet, withPackSet } from "../src/packs";
import { modelOf, openingRecord, typeRecord, wallRecord } from "./q7-fixtures";

/** 15 mm plaster + 170 mm block + 15 mm plaster, exterior first. */
const PLASTERED: MaterialLayerSet = {
  id: "ext-plastered-200",
  name: "WD-01 200mm plastered block",
  totalThicknessMm: 200,
  referenceLineOffsetMm: 100,
  layers: [
    { materialId: "Sıva", thicknessMm: 15, function: "finish", offsetFromReferenceLineMm: -100 },
    { materialId: "Tuğla", thicknessMm: 170, function: "structure", offsetFromReferenceLineMm: -85 },
    { materialId: "Sıva", thicknessMm: 15, function: "finish", offsetFromReferenceLineMm: 85 },
  ],
};

/** The firm's codes: plaster is mapped, the brick is not (a line nobody has priced yet). */
const FIRM = definePack({ id: "zzfirm", name: "Test firm's layer codes", version: "1.0.0", kernel: "^1.0.0" }, [
  contribute(MATERIAL_LAYER_CODE_POINT, [{ material: "sıva", classification: { system: "firm:cost_codes", code: "09.01" } }]),
]);
const FIRM_SET = PackSet.create([FIRM]);

/** One 6 m × 3 m wall at 200 mm, its build-up on its type (`layersOn`: "type" | "element"). */
function building(layersOn: "type" | "element", withDoor = false): ModelState {
  const layers = layersOn === "type" ? undefined : PLASTERED;
  const type = typeRecord("t-wd01", "WD-01 200mm plastered block", { forKinds: ["wall"], ...(layersOn === "type" ? { layers: PLASTERED } : {}) });
  const wall = wallRecord("W-1", { x: 0, y: 0 }, { x: 6000, y: 0 }, { thickness: 200, height: 3000, typeId: asElementId("t-wd01"), ...(layers ? { layers } : {}) });
  const records: BimElement[] = [type, wall];
  if (withDoor) records.push(openingRecord("D-1", "W-1", "door", 900, 2100, 1500));
  return modelOf(records);
}

const layerLines = (model: ModelState) =>
  takeoffTotals(model.elements)
    .filter((t) => t.group.kind === "layer")
    .map((t) => `${t.group.label}|${t.measure.key}|${t.value.toFixed(3)}`)
    .sort();

describe("a wall's layers take off as their own lines", () => {
  it("measures each layer's face and volume: 6 × 3 m of wall, three layers", () => {
    const model = building("element");
    const face = takeoffTotals(model.elements).find((t) => t.group.kind === "layer" && t.measure.key === "qto.layer_area");
    // 18 m² of wall face, no openings.
    expect(face?.value).toBeCloseTo(18, 6);
    expect(face?.elementCount).toBe(1);
    expect(layerLines(model)).toEqual([
      "Sıva 15 mm|qto.layer_area|18.000",
      "Sıva 15 mm|qto.layer_area|18.000",
      "Sıva 15 mm|qto.layer_volume|0.270",
      "Sıva 15 mm|qto.layer_volume|0.270",
      "Tuğla 170 mm|qto.layer_area|18.000",
      "Tuğla 170 mm|qto.layer_volume|3.060",
    ]);
  });

  it("groups a layer under its wall's type, and a two-sided finish is two lines, one per face", () => {
    const model = building("type");
    const plaster = takeoffTotals(model.elements).filter((t) => t.group.kind === "layer" && t.measure.key === "qto.layer_area");
    // Two plaster layers of one set (one at each end of the build-up) stay two lines: both faces are priced.
    expect(plaster).toHaveLength(3);
    const one = plaster.find((t) => t.group.label === "Sıva 15 mm");
    expect(one?.group.parent).toEqual({ key: "type:t-wd01", label: "WD-01 200mm plastered block" });
    // Both plaster faces add up to both sides of the wall.
    const faces = plaster.filter((t) => t.group.label === "Sıva 15 mm").reduce((s, t) => s + t.value, 0);
    expect(faces).toBeCloseTo(36, 6);
  });

  it("a finish face is net of the openings the wall hosts", () => {
    const withDoor = takeoffTotals(building("type", true).elements);
    // 18 m² less a 0.9 × 2.1 m door = 16.11 m².
    expect(withDoor.find((t) => t.measure.key === "qto.area_net")?.value).toBeCloseTo(16.11, 6);
    const plaster = withDoor.filter((t) => t.group.kind === "layer" && t.group.label === "Sıva 15 mm" && t.measure.key === "qto.layer_area");
    expect(plaster.every((t) => Math.abs(t.value - 16.11) < 1e-6)).toBe(true);
    // Which is less than the same wall without a door, by the door's face.
    const plain = takeoffTotals(building("type").elements).filter((t) => t.group.kind === "layer" && t.group.label === "Sıva 15 mm" && t.measure.key === "qto.layer_area");
    expect(plain[0]?.value).toBeCloseTo(18, 6);
  });

  it("a layer the firm's rows name takes off under its code; one they don't keeps its own name", () => {
    const model = building("type");
    withPackSet(FIRM_SET, () => {
      const lines = takeoffTotals(model.elements).filter((t) => t.group.kind === "layer" && t.measure.key === "qto.layer_area");
      const plaster = lines.find((t) => t.group.label === "Sıva 15 mm");
      expect(plaster?.group.classification).toMatchObject({ system: "firm:cost_codes", code: "09.01" });
      // The brick has no row: it still takes off, named by its material.
      const brick = lines.find((t) => t.group.label === "Tuğla 170 mm");
      expect(brick?.group.classification).toBeUndefined();
      expect(brick?.value).toBeCloseTo(18, 6);
    });
    // Without the firm's pack no layer is coded, and every layer is still a line.
    const uncoded = takeoffTotals(model.elements).filter((t) => t.group.kind === "layer" && t.measure.key === "qto.layer_area");
    expect(uncoded.every((t) => t.group.classification === undefined)).toBe(true);
    expect(uncoded.map((t) => t.group.label).sort()).toEqual(["Sıva 15 mm", "Sıva 15 mm", "Tuğla 170 mm"]);
  });

  it("a wall with no build-up measures exactly as it did: no layer lines, same values", () => {
    const model = modelOf([wallRecord("W-1", { x: 0, y: 0 }, { x: 6000, y: 0 }, { thickness: 200, height: 3000 })]);
    const totals = takeoffTotals(model.elements);
    expect(totals.filter((t) => t.group.kind === "layer")).toEqual([]);
    expect(totals.find((t) => t.measure.key === "qto.area_net")?.value).toBeCloseTo(18, 6);
    expect(totals.find((t) => t.measure.key === "qto.volume")?.value).toBeCloseTo(3.6, 6);
    expect(totals.find((t) => t.measure.key === "qto.length")?.value).toBeCloseTo(6, 6);
  });
});
