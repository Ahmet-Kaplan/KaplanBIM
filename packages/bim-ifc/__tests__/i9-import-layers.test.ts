/**
 * @jest-environment node
 *
 * i9-import-layers: `IfcMaterialLayerSetUsage` is read as an ordered build-up,
 * not just the first layer's material name.
 *
 * Before this the reader walked a usage down to its first layer and kept the
 * material name (`material`), dropping thicknesses, order and the refexence
 * line's offset. A 200 mm wall that is 15 mm plaster + 170 mm block + 15 mm
 * plaster then reached the takeoff as one volume, and nobody could price the
 * plaster. The neutral product now carries the whole set (`layerSet`), the plan
 * stamps it on the wall (or its type) as `layers`, and the takeoff measures each
 * layer's face and volume. `material` stays the first layer's name for older
 * readers.
 */
import { type BimElement, type ModelState, landImport, takeoffTotals, withUpgradePolicy } from "@permitzip/bim-kernel";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { importIfc, readIfcSource } from "../src";
import { IfcText, hostModel } from "./i9-fixtures";

/** `15.` / `200.` / `-100.` as STEP writes them. */
const n = (v: number): string => (Number.isInteger(v) ? `${v}.` : String(v));

/** An `IfcMaterialLayerSet` of `layers`, and the usage that places its reference line `offset` mm from the outer face. */
function layerSet(t: IfcText, layers: readonly { readonly material: string; readonly thickness: number; readonly ventilated?: boolean }[], offset: number): number {
  const materials = layers.map((l) => t.add("IFCMATERIAL", `'${l.material}',$,$`));
  // IFC4's IfcMaterialLayer: Material, LayerThickness, IsVentilated, Name, …
  const made = layers.map((l, i) => t.add("IFCMATERIALLAYER", `#${materials[i]},${n(l.thickness)},${l.ventilated ? ".T." : "$"},$,$,$,$`));
  const set = t.add("IFCMATERIALLAYERSET", `(${made.map((i) => `#${i}`).join(",")}),'Wall',$`);
  return t.add("IFCMATERIALLAYERSETUSAGE", `#${set},.AXIS2.,.POSITIVE.,${n(offset)},$`);
}

/** A file of one 6 m wall whose material relationship is `material` (`IfcMaterialLayerSetUsage` or a plain material). */
function fileWith(material: (t: IfcText) => number): string {
  const t = IfcText.start("mm");
  t.storey("Level 1", 0);
  const wall = t.wall("Level 1", "Wall A", [0, 0], 6000, 200, 3000);
  const m = material(t);
  t.add("IFCRELASSOCIATESMATERIAL", `${t.guid()},$,$,$,(#${wall}),#${m}`);
  return t.text();
}

function convert(text: string): ReturnType<typeof importIfc> {
  return importIfc(text, { model: hostModel(), referenceId: "ref-layers", sourceKey: "v1", sourceId: "ver-layers-1", label: "Layered walls", disciplines: ["architecture"] });
}

const READ_INPUT = { sourceId: "ver-layers-1", label: "Layered walls", disciplines: ["architecture"] } as const;

// Landed as the model server decides it: every peer reads the add-on kinds an import writes.
const landed = (records: readonly BimElement[]): ModelState => withUpgradePolicy(() => true, () => landImport(hostModel(), records).model);

describe("i9-import-layers", () => {
  it("reads the whole build-up in order: material, thickness, place and offset from the reference line", () => {
    // The file puts the reference line 100 mm from the outer face of a 200 mm
    // build-up: half of it, which is the number a centred wall's set carries.
    const text = fileWith((t) => layerSet(t, [{ material: "Sıva", thickness: 15 }, { material: "Tuğla", thickness: 170 }, { material: "Sıva", thickness: 15 }], -100));
    const [product] = readIfcSource(text, READ_INPUT).products;
    expect(product?.layerSet).toEqual({
      name: "Wall",
      // The outer face is 100 mm from the reference line and the build-up grows
      // back across it, so the three layers' faces fall at −100, −85 and +85.
      layers: [
        { materialName: "Sıva", thicknessMm: 15, order: 1, offsetFromReferenceLineMm: -100 },
        { materialName: "Tuğla", thicknessMm: 170, order: 2, offsetFromReferenceLineMm: -85 },
        { materialName: "Sıva", thicknessMm: 15, order: 3, offsetFromReferenceLineMm: 85 },
      ],
      totalThicknessMm: 200,
      referenceLineOffsetMm: 100,
    });
    // The first layer's name is still carried for readers that only ever wanted that.
    expect(product?.material).toBe("Sıva");
  });

  it("a wall with no build-up has no layer set, and reads as it did", () => {
    const text = fileWith((t) => t.add("IFCMATERIAL", `'Brick',$,$`));
    const [product] = readIfcSource(text, READ_INPUT).products;
    expect(product?.layerSet).toBeNull();
    expect(product?.material).toBe("Brick");
  });

  it("a ventilated cavity is named as one", () => {
    const text = fileWith((t) => layerSet(t, [{ material: "Brick", thickness: 100 }, { material: "Air", thickness: 25, ventilated: true }], -50));
    const [product] = readIfcSource(text, READ_INPUT).products;
    expect(product?.layerSet?.layers.map((l) => l.ventilated === true)).toEqual([false, true]);
  });

  it("lands on the wall as layers, and takes off per layer, per face", () => {
    const text = fileWith((t) => layerSet(t, [{ material: "Sıva", thickness: 15 }, { material: "Tuğla", thickness: 170 }, { material: "Sıva", thickness: 15 }], -100));
    const plan = convert(text);
    const [wall] = plan.records.filter((r): r is Extract<BimElement, { kind: "wall" }> => r.kind === "wall");
    expect(wall?.layers?.layers.map((l) => `${l.materialId} ${l.thicknessMm}`)).toEqual(["Sıva 15", "Tuğla 170", "Sıva 15"]);
    expect(wall?.layers?.totalThicknessMm).toBe(200);
    const totals = takeoffTotals(landed(plan.records).elements);
    const faces = totals.filter((t) => t.group.kind === "layer" && t.measure.key === "qto.layer_area");
    // 6 m × 3 m of wall: each of the three layers is one face of it.
    expect(faces.map((t) => `${t.group.label}|${t.value.toFixed(2)}`).sort()).toEqual(["Sıva 15 mm|18.00", "Sıva 15 mm|18.00", "Tuğla 170 mm|18.00"]);
    // The build-up's total is the wall's own thickness here, so the layers' volume adds up to the wall's.
    const volume = totals.find((t) => t.measure.key === "qto.volume")?.value ?? 0;
    const layered = totals.filter((t) => t.measure.key === "qto.layer_volume").reduce((s, t) => s + t.value, 0);
    expect(layered).toBeCloseTo(volume, 6);
  });

  it("says so when the build-up's total and the shape's thickness part ways", () => {
    // A 200 mm wall carrying a 240 mm build-up: the layers' volumes then don't add up to the wall's, and the report says it instead of leaving it to be found.
    const text = fileWith((t) => layerSet(t, [{ material: "Sıva", thickness: 20 }, { material: "Tuğla", thickness: 200 }, { material: "Sıva", thickness: 20 }], -120));
    const plan = convert(text);
    expect(plan.report.notes.join(" | ")).toMatch(/1 element states a build-up 240 mm thick where its shape measures 200 mm, so its layers' volumes don't add up to its own\./);
  });

  it("the repo's sample model: one 360 mm brick layer on four walls, m² summing to their net face area", () => {
    const text = readFileSync(join(__dirname, "../../../sample-models/IfcOpenHouse_IFC4.ifc"), "utf8");
    const input = { model: hostModel(), referenceId: "ref-house", sourceKey: "v1", sourceId: "ver-house-1", label: "IfcOpenHouse", disciplines: ["architecture", "structure"] } as const;
    const source = readIfcSource(text, input);
    const withSet = source.products.filter((p) => p.layerSet !== null);
    expect(withSet.map((p) => p.name).sort()).toEqual(["East wall", "North wall", "South wall", "West wall"]);
    expect(withSet.every((p) => p.layerSet?.layers.length === 1 && p.layerSet.layers[0]?.materialName === "Brick" && p.layerSet.layers[0]?.thicknessMm === 360)).toBe(true);
    const plan = importIfc(text, input);
    const totals = takeoffTotals(landed(plan.records).elements);
    const layerM2 = totals.filter((t) => t.measure.key === "qto.layer_area").reduce((s, t) => s + t.value, 0);
    const netFace = totals.find((t) => t.measure.key === "qto.area_net")?.value ?? 0;
    // One layer per wall, so the layer m² is the walls' net face area: 4 walls, one door taken out (117.8 m²).
    expect(netFace).toBeCloseTo(117.8, 6);
    expect(layerM2).toBeCloseTo(netFace, 6);
  });
});
