import { activeClassRegistry } from "../registry";
import type { Registry } from "../registry/types";
import { activePackSet, withModelStatePacks } from "../packs/scope";
import { GLOBAL_PARTITION } from "../partition";
import { elementsOfKind } from "../store";
import type { BimElement, ElementId, ElementTypeElement, Level, ModelState, ParamValue, Room } from "../types";
import { IFC_IMPORT_RULE_POINT, type ImportRuleContext, type ImportRuleDef, type ImportTypedKind } from "./rule-point";
import { reverseClassMap } from "./reverse-map";
import { importedLayerSet } from "./layers";
import { joinNotes, planWallJoins } from "./joins";
import { importElementId } from "./rules";
import { roomChanges } from "./room-changes";
import type { RoomMatchReason } from "./room-identity";
import type { IfcImportPlan, IfcImportReport, ImportClassLine, ImportGroup, ImportProduct, ImportRoomIdentity, ImportSource } from "./types";

/**
 * Plan an import (round 9 I9): every product of a linked model asks the
 * reverse class map for its class and that class's rule; what converts
 * becomes new records carrying `provenance`, what doesn't stays on the
 * linked model with its reason. Pure: reads `model` (Main's head, for levels
 * and ids) and the pack set bound to it, writes nothing. The model server
 * lands the plan on a new branch (`import_elements`).
 */

export interface PlanImportOptions {
  /** Main's head: its levels are matched to the file's storeys, and no new id may collide with one of its elements. */
  readonly model: ModelState;
  /** The linked model (reference) the storeys belong to, for new levels' `source`. */
  readonly referenceId: string;
  /** Short key for element ids (`imp.<key>.<GlobalId>`); the source version's id prefix. */
  readonly sourceKey: string;
  /** Override the classes (tests); default: the model's set's registry. */
  readonly registry?: Registry;
  /** Override the rules (tests); default: the model's set's `kernel.ifc_import_rule` rows. */
  readonly rules?: readonly ImportRuleDef[];
}

const LEVEL_MATCH_MM = 50;
/** How far a build-up's stated total and the element's measured thickness may part before the report says so, mm. */
const LAYER_THICKNESS_TOLERANCE_MM = 5;

/** "2 walls", "1 air terminal", "1 floor or slab": the label's nouns counted (registry labels are mostly plural, some singular). */
function plural(n: number, label: string): string {
  const one = (w: string) => (w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
  const many = (w: string) => (w.endsWith("s") ? w : `${w}s`);
  const nouns = label.toLowerCase().split(" and ");
  if (nouns.length > 1) return `${n} ${n === 1 ? nouns.map((p) => p.split(" ").map((w, i, a) => (i === a.length - 1 ? one(w) : w)).join(" ")).join(" or ") : nouns.join(" and ")}`;
  const words = (nouns[0] ?? "").split(" ");
  return `${n} ${words.map((w, i) => (i === words.length - 1 ? (n === 1 ? one(w) : many(w)) : w)).join(" ")}`;
}

/** "IfcCurtainWall" → "Curtain walls". */
function entityWords(entity: string): string {
  const words = entity.replace(/^Ifc/i, "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  const text = words.charAt(0).toUpperCase() + words.slice(1);
  return text.endsWith("s") ? text : `${text}s`;
}

function list(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function planIfcImport(source: ImportSource, opts: PlanImportOptions): IfcImportPlan {
  return withModelStatePacks(opts.model, () => planInScope(source, opts));
}

function planInScope(source: ImportSource, opts: PlanImportOptions): IfcImportPlan {
  const registry = opts.registry ?? activeClassRegistry();
  const rules = opts.rules ?? activePackSet().items(IFC_IMPORT_RULE_POINT);
  const map = reverseClassMap(registry, rules);
  const records: BimElement[] = [];
  const byId = new Map<string, BimElement>();
  const converted = new Map<string, ElementId>();
  const notes = new Set<string>();
  const shared = new Map<string, BimElement | string>();
  const exists = (id: ElementId) => byId.has(id) || opts.model.elements[id] !== undefined;
  const push = (r: BimElement) => {
    if (exists(r.id)) throw new Error(`[bim-kernel/import] the planned id ${r.id} is already used; the import key must be unique per source`);
    records.push(r);
    byId.set(r.id, r);
  };
  /** The same planned record, changed (a type widened to a second kind): the plan holds one copy of it. */
  const replace = (was: BimElement, now: BimElement) => {
    const at = records.indexOf(was);
    if (at >= 0) records[at] = now;
    byId.set(now.id, now);
  };

  // Levels: the file's storeys matched to Main's levels (by the storey they came from, then name, then height), new ones made.
  const levels = elementsOfKind(opts.model.elements, "level");
  const storeyLevel = new Map<string, Level>();
  const levelsAdded: string[] = [];
  const taken = new Set(levels.map((l) => l.name.toLowerCase()));
  for (const storey of [...source.storeys].sort((a, b) => a.elevationMm - b.elevationMm)) {
    const match =
      levels.find((l) => l.source?.storeyId === storey.sourceId) ??
      levels.find((l) => l.name.trim().toLowerCase() === storey.name.trim().toLowerCase()) ??
      levels.find((l) => Math.abs(l.elevationMm - storey.elevationMm) <= LEVEL_MATCH_MM);
    if (match) {
      storeyLevel.set(storey.sourceId, match);
      continue;
    }
    let name = storey.name.trim() || `Level at ${Math.round(storey.elevationMm)} mm`;
    if (taken.has(name.toLowerCase())) name = `${name} (${source.label})`.slice(0, 120);
    taken.add(name.toLowerCase());
    const level: Level = {
      id: importElementId(opts.sourceKey, storey.sourceId),
      kind: "level",
      version: 0,
      authoredRev: {},
      name,
      elevationMm: Math.round(storey.elevationMm),
      source: { referenceId: opts.referenceId, storeyId: storey.sourceId, storeyName: storey.name },
    };
    push(level);
    storeyLevel.set(storey.sourceId, level);
    levels.push(level);
    levelsAdded.push(name);
  }
  const byElevation = [...levels].sort((a, b) => a.elevationMm - b.elevationMm);
  const levelFor = (p: ImportProduct): Level | null => {
    const direct = p.storeyId ? storeyLevel.get(p.storeyId) : undefined;
    if (direct) return direct;
    const z = p.geometry.bounds?.min.z;
    if (z === undefined) return null;
    let best: Level | null = null;
    for (const l of byElevation) if (l.elevationMm <= z + LEVEL_MATCH_MM) best = l;
    return best ?? byElevation[0] ?? null;
  };

  const groups = new Map<string, ImportGroup>(source.groups.map((g) => [g.sourceId, g]));
  const lines = new Map<string, { classId: string | null; label: string; converted: number; linked: Map<string, number> }>();
  const line = (key: string, classId: string | null, label: string) => {
    let l = lines.get(key);
    if (!l) {
      l = { classId, label, converted: 0, linked: new Map() };
      lines.set(key, l);
    }
    return l;
  };
  const stay = (key: string, classId: string | null, label: string, reason: string, count = 1) => {
    const l = line(key, classId, label);
    l.linked.set(reason, (l.linked.get(reason) ?? 0) + count);
  };

  const chosen: Array<{ product: ImportProduct; choice: Extract<ReturnType<typeof map.choose>, { ok: true }>["choice"] }> = [];
  for (const product of source.products) {
    const answer = map.choose(product);
    if (answer.ok) chosen.push({ product, choice: answer.choice });
    else stay(answer.cls?.id ?? product.entity, answer.cls?.id ?? null, answer.cls?.label ?? entityWords(product.entity), answer.reason);
  }
  chosen.sort((a, b) => (a.choice.rule.order ?? 10) - (b.choice.rule.order ?? 10));

  // Step 6, the wall join pass: the file's wall pieces become the walls the
  // building has — the pieces of one wall merged, and the ends of walls that
  // meet slid along their own axes onto their neighbours' reference lines or
  // faces — on the neutral products, so the model receives walls that already
  // meet instead of records mutated afterwards. A merge names the wall it
  // changed in the report; an inferred reference line takes no part.
  const joins = planWallJoins(
    chosen.map((c) => c.product),
    { wallIds: new Set(chosen.filter((c) => (c.choice.rule.forKinds ?? []).includes("wall")).map((c) => c.product.sourceId)) },
  );
  const joinedById = new Map(joins.products.map((p) => [p.sourceId, p]));

  // The file's types become real `element_type` records, one per type, made
  // when the first product of that type converts (a type nothing converted
  // leaves no empty record behind). Instances name it through `typeId`, so the
  // takeoff groups by the file's own type name (`qtoGroupOf`) instead of
  // collapsing a whole trade into one line.
  const types = new Map<string, ElementTypeElement>();
  const typeFor = (product: ImportProduct, kind: ImportTypedKind): ElementTypeElement | null => {
    const typeId = product.typeId?.trim() ?? "";
    const name = product.typeName?.trim() ?? "";
    if (typeId === "" || name === "") return null;
    const layers = importedLayerSet(product);
    const have = types.get(typeId);
    if (have) {
      // One type used by two kinds (a file that reuses a type): it admits both.
      if (have.forKinds && !have.forKinds.includes(kind)) {
        const widened: ElementTypeElement = { ...have, forKinds: [...have.forKinds, kind] };
        types.set(typeId, widened);
        replace(have, widened);
        return widened;
      }
      return have;
    }
    const record: ElementTypeElement = {
      id: importElementId(opts.sourceKey, typeId, "type"),
      kind: "element_type",
      version: 0,
      authoredRev: {},
      partition: GLOBAL_PARTITION,
      name: name.slice(0, 120),
      forKinds: [kind],
      provenance: { ifcGlobalId: typeId, source: source.id },
      // The type's build-up, so a wall of this type made later has it too, and the layers ride one record rather than one per instance.
      ...(layers ? { layers } : {}),
      ...(product.typeClassification && product.typeClassification.length > 0 ? { classification: product.typeClassification.map((c) => ({ system: c.system, code: c.code })) } : {}),
    };
    types.set(typeId, record);
    push(record);
    return record;
  };
  /** Records read with their cuts left in, by the cut the reader named. */
  const cutLeftIn = new Map<string, number>();
  /** Records whose reference line was inferred from the body, by why the file couldn't give one. */
  const inferredReference = new Map<string, number>();
  /** Build-ups whose stated total and the shape's measured thickness part ways, by "stated|measured". */
  const layerMismatch = new Map<string, number>();

  for (const { product: asRead, choice } of chosen) {
    // A piece a merge consumed: its length is on the wall that carries it now.
    if (joins.alias.has(asRead.sourceId)) continue;
    const product = joinedById.get(asRead.sourceId) ?? asRead;
    const { cls } = choice;
    const ctx: ImportRuleContext = {
      cls,
      fields: choice.fields,
      options: choice.options,
      idFor: (sourceId, suffix) => importElementId(opts.sourceKey, sourceId, suffix),
      level: levelFor,
      partition: (level) => ({ level: level.name, zone: "Z1", discipline: cls.discipline }),
      converted: (sourceId) => {
        const id = converted.get(sourceId);
        return id ? (byId.get(id) ?? null) : null;
      },
      group: (sourceId) => groups.get(sourceId) ?? null,
      shared: <T extends BimElement>(key: string, make: () => T | string): T | string => {
        const have = shared.get(key);
        if (have !== undefined) return have as T | string;
        const made = make();
        if (typeof made !== "string") push(made);
        shared.set(key, made);
        return made;
      },
      typeFor,
      values: (p) => mappedValues(registry, cls.id, p),
      provenance: (p) => ({ ifcGlobalId: p.sourceId, source: source.id }),
      note: (text) => {
        if (notes.size < 200) notes.add(text);
      },
    };
    let result;
    try {
      result = choice.rule.convert(product, ctx);
    } catch (err) {
      console.error("[bim-kernel/import] an import rule threw; the product stays linked", { rule: choice.rule.id, entity: product.entity, sourceId: product.sourceId, err });
      result = { ok: false as const, reason: `the ${choice.rule.label.toLowerCase()} rule failed on it` };
    }
    if (!result.ok) {
      stay(cls.id, cls.id, cls.label, result.reason);
      continue;
    }
    for (const r of result.records) push(r);
    const own = result.records[result.records.length - 1];
    if (own) converted.set(product.sourceId, own.id);
    // The pieces this wall was merged from point at it, so a door in one of them
    // still finds the wall it is in.
    if (own) for (const [piece, into] of joins.alias) if (into === product.sourceId) converted.set(piece, own.id);
    // A solid read with its cuts left in converts, and the report says what it measured (a wall's openings aren't subtracted, so it reads long).
    if (product.geometry.cutsLeftIn) cutLeftIn.set(product.geometry.unread ?? "cut", (cutLeftIn.get(product.geometry.unread ?? "cut") ?? 0) + 1);
    // A record placed on a reference line inferred from its body: the file gave none it could be read from.
    if (own && "referenceLineInferred" in own && own.referenceLineInferred === true) {
      const why = product.referenceLine === undefined ? "the file states no reference line for it" : product.referenceLine.unread !== undefined ? `the file's reference line is ${product.referenceLine.unread}` : "the file's reference line is curved";
      inferredReference.set(why, (inferredReference.get(why) ?? 0) + 1);
    }
    // A build-up measures its layers against the wall's shape; when the file's own total and that
    // thickness part ways, the layers' volumes don't add up to the element's and the report says so.
    const stated = importedLayerSet(product)?.totalThicknessMm;
    const measured = own && "thickness" in own && typeof own.thickness === "number" ? own.thickness : null;
    if (stated !== undefined && measured !== null && Math.abs(stated - measured) > LAYER_THICKNESS_TOLERANCE_MM) {
      const key = `${Math.round(stated)}|${Math.round(measured)}`;
      layerMismatch.set(key, (layerMismatch.get(key) ?? 0) + 1);
    }
    line(cls.id, cls.id, cls.label).converted += 1;
  }
  for (const u of source.unreadable) stay(u.entity, null, entityWords(u.entity), u.reason, u.count);
  // What the join pass did, before the notes about what the file couldn't state.
  for (const note of joinNotes(joins.report)) {
    if (notes.size >= 200) break;
    notes.add(note);
  }
  for (const [cut, count] of cutLeftIn) {
    if (notes.size >= 200) break;
    const one = count === 1;
    notes.add(`${count} ${one ? "element was" : "elements were"} measured from its uncut solid (the file gives ${one ? "its" : "their"} shape as ${cut}), so what was cut out isn't subtracted. Check ${one ? "it" : "them"} against the source model.`);
  }

  for (const [key, count] of layerMismatch) {
    if (notes.size >= 200) break;
    const [stated, measured] = key.split("|");
    const one = count === 1;
    notes.add(`${count} ${one ? "element states a build-up" : "elements state build-ups"} ${stated} mm thick where ${one ? "its shape measures" : "their shapes measure"} ${measured} mm, so ${one ? "its" : "their"} layers' volumes don't add up to ${one ? "its" : "their"} own. Check the layer set against the shape.`);
  }

  for (const [why, count] of inferredReference) {
    if (notes.size >= 200) break;
    const one = count === 1;
    notes.add(`${count} ${one ? "element" : "elements"} came in on a reference line inferred from ${one ? "its" : "their"} body's footprint (${why}), so a thickness change moves the line rather than the face. Check ${one ? "it" : "them"} against the source model.`);
  }

  const rooms = roomIdentity(records, opts, levels, byId, replace, source);

  const classes: ImportClassLine[] = [...lines.values()]
    .map((l) => ({ classId: l.classId, label: l.label, converted: l.converted, linked: [...l.linked].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count) }))
    .sort((a, b) => b.converted - a.converted || a.label.localeCompare(b.label));
  const convertedCount = classes.reduce((s, c) => s + c.converted, 0);
  const linkedCount = classes.reduce((s, c) => s + c.linked.reduce((t, r) => t + r.count, 0), 0);
  const did = classes.filter((c) => c.converted > 0).map((c) => plural(c.converted, c.label));
  const left = classes.map((c) => ({ c, n: c.linked.reduce((t, r) => t + r.count, 0) })).filter((x) => x.n > 0).map((x) => plural(x.n, x.c.label));
  const summary = [did.length > 0 ? `Converted ${list(did)}.` : "Nothing in this linked model could be converted.", left.length > 0 ? `Left ${list(left)} as the linked model.` : "Everything else came in too."].join(" ");
  const report: IfcImportReport = {
    source: { id: source.id, label: source.label, disciplines: source.disciplines },
    converted: convertedCount,
    stayLinked: linkedCount,
    levelsAdded,
    classes,
    joins: joins.report,
    notes: [...notes],
    summary,
    ...(rooms ? { rooms } : {}),
  };
  return { records, converted, report };
}

/**
 * The rooms this import made, against the rooms the model already holds from an
 * earlier import of the same linked model (`import/room-identity.ts`): a room
 * the revision kept is stamped with the earlier room's id on its
 * `continuesId`, and the report gets the pairing's evidence and the change set
 * a person reads (`import/room-changes.ts`).
 *
 * **A first import pairs nothing**: a model holding no room from an earlier
 * import of this linked model has nothing to compare against, so every room is
 * added, no record is stamped, and nothing a single import did before this
 * pass existed has changed. It returns the section even then, with
 * `comparedAgainst: 0`, so "nothing was compared" is in the report rather than
 * left to a reader to infer.
 *
 * `opts.referenceId` is what makes "an earlier import of the same linked
 * model" mean anything: a level records the linked model it came from, so the
 * rooms under it are that model's. Rooms from another linked model, and rooms
 * a person drew, are not candidates — pairing them would claim a continuity
 * that does not exist.
 */
function roomIdentity(
  records: BimElement[],
  opts: PlanImportOptions,
  levels: readonly Level[],
  byId: ReadonlyMap<string, BimElement>,
  replace: (was: BimElement, now: BimElement) => void,
  source: ImportSource,
): ImportRoomIdentity | null {
  const roomsNow = records.filter((r): r is Room => r.kind === "room");
  if (roomsNow.length === 0) return null;
  // A room states its storey by the level's name; resolve that to the level
  // record, which the two revisions share, so the match is per storey without
  // depending on the wording.
  const levelOf = (room: Room): Level | undefined => {
    const name = room.partition?.level ?? "";
    return levels.find((l) => l.name === name) ?? levels.find((l) => l.source?.storeyName === name);
  };
  const storeyOf = (room: Room): string => levelOf(room)?.id ?? (room.partition?.level ?? "");
  const previousRooms = elementsOfKind(opts.model.elements, "room").filter((room) => {
    if (room.provenance?.source === undefined || room.provenance.source === source.id) return false;
    return levelOf(room)?.source?.referenceId === opts.referenceId;
  });
  const changes = roomChanges(previousRooms, roomsNow, { storeyOf });
  for (const paired of changes.pairs) {
    const record = byId.get(paired.current.id);
    if (record?.kind === "room" && record.continuesId !== paired.previous.id) replace(record, { ...record, continuesId: paired.previous.id });
  }
  const byReason: Record<RoomMatchReason, number> = { number: 0, name: 0, seed: 0, fit: 0 };
  for (const paired of changes.pairs) byReason[paired.reason] += 1;
  return {
    comparedAgainst: previousRooms.length,
    matched: changes.pairs.length,
    added: changes.added.length,
    byReason,
    changes: changes.pairs.filter((paired) => paired.changes.length > 0),
    missing: changes.removed,
  };
}

/** Values the registry maps from property sets onto the class's text, yes/no and choice fields (numbers wait for unit checks). */
function mappedValues(registry: Registry, classId: string, p: ImportProduct): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};
  for (const f of registry.fieldsFor(classId)) {
    if (!f.key || !f.ifc || !("pset" in f.ifc) || f.binding !== "instance") continue;
    const v = p.properties[f.ifc.pset]?.[f.ifc.property];
    if (v === undefined) continue;
    if (f.valueType === "text" && typeof v === "string") out[f.key] = v.slice(0, 400);
    else if (f.valueType === "boolean" && typeof v === "boolean") out[f.key] = v;
    else if (f.valueType === "choice" && typeof v === "string" && (!f.choices || f.choices.includes(v))) out[f.key] = v;
  }
  return out;
}