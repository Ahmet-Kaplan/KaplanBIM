/**
 * @jest-environment node
 *
 * i9-convert-sample: small synthetic linked models convert with the right
 * counts and geometry. One file carries two disciplines (architecture and
 * structure from one firm); one is not architecture at all (mechanical and
 * fire sprinkler: segments, terminals and systems). The same model in feet
 * converts to the same millimetres. Heads only a pack knows convert once
 * that pack is in the model's set, through its own rule.
 *
 * Fails on round 8b's code: bim-ifc had no reader and the kernel no import.
 */
import { type BimElement, type ModelState, type Wall, landImport, takeoffTotals } from "@permitzip/bim-kernel";
import { PackSet, bindModelPacks, unbindModelPacks } from "@permitzip/bim-kernel/packs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { importIfc, readIfcSource } from "../src";
import { FIRE_PROTECTION_TEST_PACK, HEAD_CLASS } from "./fixtures/i9-fire-protection-pack";
import { architectureAndStructure, hostModel, mechanicalAndSprinkler } from "./i9-fixtures";

const ofKind = <K extends BimElement["kind"]>(records: readonly BimElement[], kind: K) => records.filter((r): r is Extract<BimElement, { kind: K }> => r.kind === kind);

function arch(units: "mm" | "ft" = "mm") {
  return importIfc(architectureAndStructure(units).text, { model: hostModel(), referenceId: "ref-arch", sourceKey: "v1", sourceId: "ver-arch-1", label: "Main St shell", disciplines: ["architecture", "structure"] });
}

/** The repo's own sample model: IfcOpenHouse (CC0-1.0), 34 products, 4 cut or plain walls, 1 door, footings, members and plates. */
function openHouse() {
  const text = readFileSync(join(__dirname, "../../../sample-models/IfcOpenHouse_IFC4.ifc"), "utf8");
  const input = { model: hostModel(), referenceId: "ref-house", sourceKey: "v1", sourceId: "ver-house-1", label: "IfcOpenHouse", disciplines: ["architecture", "structure"] } as const;
  return { text, input, source: readIfcSource(text, input), plan: importIfc(text, input) };
}

/** Takeoff lines of the landed model, as `<group kind>|<label>|<elements>`, by measure. */
function takeoffLines(model: ModelState, measure = "qto.count"): string[] {
  return takeoffTotals(model.elements)
    .filter((t) => t.measure.key === measure)
    .map((t) => `${t.group.kind}|${t.group.label}|${t.elementCount}`)
    .sort();
}

describe("i9-convert-sample", () => {
  it("converts an architecture + structure model: counts and geometry within 0.5 mm", () => {
    const plan = arch();
    const r = plan.records;
    expect(ofKind(r, "wall")).toHaveLength(2);
    expect(ofKind(r, "opening")).toHaveLength(1);
    expect(ofKind(r, "room")).toHaveLength(1);
    expect(ofKind(r, "slab")).toHaveLength(1);
    expect(ofKind(r, "column")).toHaveLength(1);
    expect(ofKind(r, "beam")).toHaveLength(1);
    const [a, b] = ofKind(r, "wall").sort((x, y) => x.start.x - y.start.x || x.start.y - y.start.y) as [Wall, Wall];
    expect(a.start.x).toBeCloseTo(0, 0);
    expect(a.end.x).toBeCloseTo(6000, 0);
    expect(a.thickness).toBeCloseTo(200, 0);
    expect(a.height).toBeCloseTo(3000, 0);
    expect(a.wallType).toBe("Interior 200");
    expect(b.start).toEqual({ x: 6000, y: 0 });
    expect(b.end.x).toBeCloseTo(6000, 0);
    expect(b.end.y).toBeCloseTo(5000, 0);
    const [door] = ofKind(r, "opening");
    expect(door).toMatchObject({ openingType: "door", hostId: a.id, offset: 1500, width: 900, height: 2100, mark: "D-101" });
    const [room] = ofKind(r, "room");
    expect(room).toMatchObject({ number: "101", name: "Office", areaSqM: 12 });
    const [slab] = ofKind(r, "slab");
    expect(slab?.thickness).toBe(250);
    const [column] = ofKind(r, "column");
    expect(column).toMatchObject({ position: { x: 3000, y: 2500 }, size: { x: 400, y: 400 } });
    const [beam] = ofKind(r, "beam");
    expect(beam).toMatchObject({ start: { x: 0, y: 2500 }, end: { x: 6000, y: 2500 } });
    // Every converted record remembers the GlobalId it came from and the linked model version.
    for (const rec of r.filter((x) => x.kind !== "level")) expect(Reflect.get(rec, "provenance")).toEqual({ ifcGlobalId: expect.stringMatching(/^[0-9A-Z]{22}$/), source: "ver-arch-1" });
    // Level 1 matched the host's level by name; Level 2 is new and remembers its storey.
    expect(plan.report.levelsAdded).toEqual(["Level 2"]);
    expect(ofKind(r, "level")[0]?.source).toMatchObject({ referenceId: "ref-arch", storeyName: "Level 2" });
    expect(beam?.partition?.level).toBe("Level 2");
    // Two disciplines of one model, and each record is filed under its class's own.
    expect(plan.report.source.disciplines).toEqual(["architecture", "structure"]);
    expect(column?.partition?.discipline).toBe("structure");
    expect(a.partition?.discipline).toBe("architecture");
  });

  it("the same model drawn in feet converts to the same millimetres", () => {
    const mm = arch("mm").records.filter((x) => x.kind === "wall" || x.kind === "column");
    const ft = arch("ft").records.filter((x) => x.kind === "wall" || x.kind === "column");
    expect(ft).toHaveLength(mm.length);
    for (const [i, m] of mm.entries()) {
      const f = ft[i];
      if (m.kind === "wall" && f?.kind === "wall") {
        expect(Math.abs(f.end.x - m.end.x)).toBeLessThan(0.5);
        expect(Math.abs(f.thickness - m.thickness)).toBeLessThan(0.5);
      }
      if (m.kind === "column" && f?.kind === "column") expect(Math.abs(f.position.x - m.position.x)).toBeLessThan(0.5);
    }
  });

  it("converts a mechanical + fire sprinkler model: segments in their system, the terminal as a part of its type", () => {
    const { text } = mechanicalAndSprinkler();
    const plan = importIfc(text, { model: hostModel(), referenceId: "ref-mech", sourceKey: "v7", sourceId: "ver-mech-7", label: "Acme MEP", disciplines: ["mechanical", "fire_sprinkler"] });
    const segs = ofKind(plan.records, "run_segment");
    expect(segs).toHaveLength(2);
    expect(segs.map((s) => s.domain)).toEqual(["duct", "duct"]);
    expect(segs.map((s) => s.size)).toEqual(expect.arrayContaining([{ shape: "rect", width: 400, height: 300 }, { shape: "round", diameter: 300 }]));
    const rect = segs.find((s) => s.size.shape === "rect");
    expect(rect).toMatchObject({ start: { x: 0, y: 1000, z: 2800 }, end: { x: 5000, y: 1000, z: 2800 }, levelId: "L1" });
    const [system] = ofKind(plan.records, "mep_system");
    expect(system).toMatchObject({ name: "Supply Air 1", systemKind: "supply_air", domain: "duct" });
    expect(segs.every((s) => s.systemId === system?.id)).toBe(true);
    const [terminal] = ofKind(plan.records, "part");
    const [type] = ofKind(plan.records, "part_type");
    expect(terminal).toMatchObject({ typeId: type?.id, mark: "SD-1", position: { x: 5000, y: 4000 }, offsetMm: 2700 });
    expect(type?.definition).toMatchObject({ category: "air_terminal", typeName: "Square diffuser 600", source: { kind: "ifc", entity: "IfcAirTerminal" } });
    // The sprinkler pipe and heads stay on the linked model, each with its reason.
    const pipe = plan.report.classes.find((c) => c.classId === "mep.pipe");
    expect(pipe?.linked[0]?.reason).toMatch(/add-on that owns these runs' sizes/);
    const heads = plan.report.classes.find((c) => c.label === "Fire suppression terminals");
    expect(heads?.linked).toEqual([{ reason: "no class in this model takes it", count: 2 }]);
    expect(plan.report.notes).toEqual(expect.arrayContaining([]));
  });

  it("a fire-protection add-on converts its heads with zero kernel or importer edits", () => {
    const model = { ...hostModel(), modelId: "i9-fp" };
    bindModelPacks(model.modelId, PackSet.create([FIRE_PROTECTION_TEST_PACK]));
    try {
      const plan = importIfc(mechanicalAndSprinkler().text, { model, referenceId: "ref-mech", sourceKey: "v7", sourceId: "ver-mech-7", label: "Acme MEP", disciplines: ["mechanical", "fire_sprinkler"] });
      const heads = ofKind(plan.records, "component").filter((c) => c.classId === HEAD_CLASS);
      expect(heads).toHaveLength(2);
      expect(heads.map((h) => Math.round(h.position.x)).sort((x, y) => x - y)).toEqual([1500, 4500]);
      expect(heads[0]?.partition?.discipline).toBe("fire_protection");
    } finally {
      unbindModelPacks(model.modelId);
    }
  });

  describe("the repo's own sample model (IfcOpenHouse)", () => {
    it("converts every wall, cut or plain, and the door in one of them", () => {
      const { source, plan } = openHouse();
      expect(source.products).toHaveLength(34);
      // 4 walls and 1 door convert (it was 2 walls before a cut solid was measured
      // rather than refused) and the footing is a component; the 25 members and
      // plates, the two roof decks, the roof, the stair and the windows stay linked
      // for reasons this slice doesn't touch.
      expect(ofKind(plan.records, "wall")).toHaveLength(4);
      expect(ofKind(plan.records, "opening")).toHaveLength(1);
      expect(plan.report.converted).toBe(6);
      expect(plan.report.classes.find((c) => c.classId === "arch.wall")).toMatchObject({ converted: 4, linked: [] });
      expect(plan.report.classes.find((c) => c.classId === "arch.door")).toMatchObject({ converted: 1, linked: [] });
      // The door is in the south wall, which converts: it comes in with its host.
      const [door] = ofKind(plan.records, "opening");
      expect(ofKind(plan.records, "wall").some((w) => w.id === door?.hostId)).toBe(true);
      expect(plan.report.summary).toBe("Converted 4 walls, 1 door and 1 footing. Left 20 members, 5 plates, 2 roof decks, 1 roof, 1 stair flight and 5 windows as the linked model.");
    });

    it("still reports the two walls whose shape the file cuts, without refusing them", () => {
      const { source, plan } = openHouse();
      const cut = source.products.filter((p) => p.geometry.cutsLeftIn === true);
      expect(cut.map((p) => p.name).sort()).toEqual(["East wall", "West wall"]);
      // `unread` keeps naming the cut: the reading is honest about what it doesn't subtract.
      expect(cut.every((p) => p.geometry.unread === "cut by another shape")).toBe(true);
      expect(plan.report.notes.join(" | ")).toMatch(/2 elements were measured from its uncut solid \(the file gives their shape as cut by another shape\)/);
      // Nothing is refused for the cut any more.
      expect(plan.report.classes.flatMap((c) => c.linked).map((r) => r.reason)).not.toContain("its shape is cut by another shape");
    });

    it("is measured, not merely converted: four walls in one line, no type to split them by", () => {
      const { plan } = openHouse();
      // The sample carries no `IfcRelDefinesByType` at all, so its walls have no type to group by
      // and stay one line (i9-import-types shows the typed case).
      expect(ofKind(plan.records, "element_type")).toHaveLength(0);
      const model = landImport(hostModel(), plan.records);
      expect(model.dropped).toEqual([]);
      expect(takeoffLines(model.model).filter((l) => l.includes("Walls"))).toEqual(["class|Walls|4"]);
      const length = takeoffTotals(model.model.elements).find((t) => t.measure.key === "qto.length");
      expect(Math.round(length?.value ?? 0)).toBe(30);
    });
  });
});
