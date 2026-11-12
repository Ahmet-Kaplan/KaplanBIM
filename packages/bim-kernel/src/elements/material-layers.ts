import { defineExtensionPoint } from "../packs/contract";
import { KNOWN_MATERIAL_LAYER_FUNCTIONS, type BimElement, type MaterialLayer, type MaterialLayerSet } from "../types";
import { isCoreElement } from "./feature";
import { elementTypeValue } from "./types";

/**
 * Material layer sets (FOUNDATION-COVERAGE §2.1): a wall, slab or roof
 * build-up as ordered layers. A set rides on the record itself (`layers`, what
 * an IFC import brings) or lives in a catalogue (a pack's or a firm's library
 * data) that an element or its type names by id through a value, so values
 * stay scalars and one set serves every wall of that type.
 */
export const MATERIAL_LAYER_SET_KEY = "material.layer_set";

export type MaterialLayerSetRead = { readonly ok: true; readonly set: MaterialLayerSet; readonly unknownFunctions: readonly string[] } | { readonly ok: false; readonly reason: string };

function isRecord(v: unknown): v is Readonly<Record<string, unknown>> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A stored layer set: layers checked, a layer function this release doesn't know kept and listed, other fields kept on their objects. */
export function readMaterialLayerSet(raw: unknown): MaterialLayerSetRead {
  if (!isRecord(raw) || typeof raw.id !== "string" || raw.id.length === 0) return { ok: false, reason: "a layer set needs an id" };
  if (!Array.isArray(raw.layers) || raw.layers.length === 0) return { ok: false, reason: `layer set ${raw.id} has no layers` };
  const layers: MaterialLayer[] = [];
  const unknownFunctions: string[] = [];
  for (const [i, l] of raw.layers.entries()) {
    if (!isRecord(l) || typeof l.materialId !== "string" || l.materialId.length === 0) return { ok: false, reason: `layer ${i + 1} of ${raw.id} names no material` };
    if (typeof l.thicknessMm !== "number" || !Number.isFinite(l.thicknessMm) || l.thicknessMm < 0) return { ok: false, reason: `layer ${i + 1} of ${raw.id} needs a thickness of 0 mm or more` };
    if (l.function !== undefined && typeof l.function !== "string") return { ok: false, reason: `layer ${i + 1} of ${raw.id} has a function that isn't text` };
    if (typeof l.function === "string" && !(KNOWN_MATERIAL_LAYER_FUNCTIONS as readonly string[]).includes(l.function)) unknownFunctions.push(l.function);
    layers.push({ ...l, materialId: l.materialId, thicknessMm: l.thicknessMm, ...(typeof l.function === "string" ? { function: l.function } : {}) });
  }
  return { ok: true, set: { ...raw, id: raw.id, layers }, unknownFunctions };
}

export function layerSetThicknessMm(set: MaterialLayerSet): number {
  let t = 0;
  for (const l of set.layers) t += l.thicknessMm;
  return t;
}

/** The layers a record carries itself, or its type carries (`ElementCore.layers`, `ElementTypeElement.layers`). */
function ownLayers(elements: Readonly<Record<string, BimElement>>, el: BimElement): MaterialLayerSet | null {
  if (isCoreElement(el) && el.layers !== undefined) return el.layers;
  const typeId = isCoreElement(el) ? el.typeId : undefined;
  const type = typeId === undefined ? undefined : elements[typeId];
  return type?.kind === "element_type" && type.layers !== undefined ? type.layers : null;
}

/**
 * The layer set an element uses: the one it carries (or its type carries),
 * else the one a `material.layer_set` value names, looked up in `catalogue`.
 * Null when it has none, names one the catalogue doesn't have, or isn't a kind
 * that carries build-ups.
 */
export function layerSetOf(elements: Readonly<Record<string, BimElement>>, el: BimElement, catalogue: ReadonlyMap<string, MaterialLayerSet> = new Map()): MaterialLayerSet | null {
  if (!isCoreElement(el)) return null;
  const carried = ownLayers(elements, el);
  if (carried !== null) return carried;
  let ref = elementTypeValue(elements, el, MATERIAL_LAYER_SET_KEY);
  if (ref === undefined && el.typeId !== undefined) {
    const type = elements[el.typeId];
    if (isCoreElement(type)) ref = type.values?.[MATERIAL_LAYER_SET_KEY];
  }
  return typeof ref === "string" ? (catalogue.get(ref) ?? null) : null;
}

// ── Build-up layer codes (the firm's data, never the kernel's logic) ───────

/**
 * A firm's cost code for a build-up layer, by the material name its models
 * carry ("Sıva", "WD-01 tuğla"): the money side of a layer is the firm's
 * vocabulary, so the kernel holds the lookup and the firm fills it in
 * (`MEMORY`-style data rows, no code list bundled). A layer no row names keeps
 * its own words as the line's group, so a named but unpriced line still shows
 * in the takeoff rather than disappearing.
 */
export interface MaterialLayerCodeDef {
  /** The layer's material as the models spell it, case-folded on lookup. */
  readonly material: string;
  /** The code its line takes off under (a classification system the firm's pack holds). */
  readonly classification: { readonly system: string; readonly code: string };
}

export const MATERIAL_LAYER_CODE_POINT = defineExtensionPoint<MaterialLayerCodeDef>({
  id: "kernel.material_layer_code",
  version: 1,
  label: "Build-up layer codes",
});

/** The code a firm's rows give a layer material, case-folded; null when none does (the line keeps its name). */
export function layerCodeOf(material: string, rows: readonly MaterialLayerCodeDef[]): { readonly system: string; readonly code: string } | null {
  const want = material.trim().toLowerCase();
  if (want === "") return null;
  for (const row of rows) if (row.material.trim().toLowerCase() === want) return row.classification;
  return null;
}

/** Problems with build-up layer code rows, in words (row conformance). */
export function materialLayerCodeProblems(rows: readonly MaterialLayerCodeDef[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const material = row.material.trim().toLowerCase();
    if (material === "") out.push("a build-up layer code names no material");
    else if (seen.has(material)) out.push(`build-up layer codes name "${row.material}" twice; the first one stands`);
    seen.add(material);
    if (row.classification.system.trim() === "" || row.classification.code.trim() === "") out.push(`build-up layer code for "${row.material}" names no code`);
  }
  return out;
}
