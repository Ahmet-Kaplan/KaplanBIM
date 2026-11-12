import { readCode } from "../classification/registry";
import { classificationTypeOf, resolveClassification, type ResolvedClassification } from "../classification/resolve";
import { layerCodeOf, MATERIAL_LAYER_CODE_POINT } from "../elements/material-layers";
import { activePackSet } from "../packs/scope";
import type { PackSet } from "../packs/set";
import { activeClassRegistry } from "../registry";
import type { BimElement } from "../types";
import { measureClassOf, type ElementMeasure } from "./measure";
import type { MeasureLine } from "./types";

/**
 * What a measured element's quantities group under: its classification code
 * when it has one (in the asked system, else its first), else its type's
 * name, else its class, else its kind. Every group has words a person reads
 * ("TEST-0100 Partitions", "1-hour wall", "Doors").
 *
 * A line a rule reports on its own (a wall's layer) groups *under* its
 * element's group and on its own key, so "Sıva 15 mm" is a line a plasterer's
 * rate can price, and never folds into the wall's volume.
 */

type Elements = Readonly<Record<string, BimElement>>;

export type QtoGroupKind = "classification" | "type" | "class" | "kind" | "layer";

export interface QtoGroup {
  /** Stable within a model: `code:<system>:<code>`, `type:<id>`, `class:<id>`, `kind:<kind>`, and a line's `<parent>/line:<key>`. */
  readonly key: string;
  readonly kind: QtoGroupKind;
  /** As a person reads it ("TEST-0100", "1-hour wall", "Doors", "Sıva 15 mm"). */
  readonly label: string;
  readonly classification?: ResolvedClassification;
  /** Set for a classification code the model's code lists don't know (named, never dropped). */
  readonly warning?: string;
  /** The group a line hangs under (a layer's wall type), absent on an element's own group. */
  readonly parent?: { readonly key: string; readonly label: string };
}

function kindWords(kind: string): string {
  const w = kind.replace(/_/g, " ");
  return `${w.charAt(0).toUpperCase()}${w.slice(1)}s`;
}

/** The group of one measured element. `system`: group by that code system; absent, by the element's first code. */
export function qtoGroupOf(elements: Elements, el: BimElement, system?: string): QtoGroup {
  const codes = resolveClassification(elements, el);
  const code = system === undefined ? codes[0] : codes.find((c) => c.system === system);
  if (code) {
    const read = readCode(code.system, code.code);
    return {
      key: `code:${code.system}:${code.code}`,
      kind: "classification",
      label: read.label ? `${code.code} ${read.label}` : code.code,
      classification: code,
      ...(read.warning ? { warning: read.warning } : {}),
    };
  }
  const type = classificationTypeOf(elements, el);
  if (type && type.name.trim() !== "") return { key: `type:${type.id}`, kind: "type", label: type.name.trim() };
  const cls = measureClassOf(elements, el);
  if (cls !== null) {
    const label = activeClassRegistry().getClass(cls)?.label;
    return { key: `class:${cls}`, kind: "class", label: label ?? cls };
  }
  return { key: `kind:${el.kind}`, kind: "kind", label: kindWords(el.kind) };
}

/**
 * The group of one line a rule reports beside its values: under the element's
 * own group, keyed by the line, with the firm's code for its material when its
 * rows name one (`MATERIAL_LAYER_CODE_POINT`, data the firm fills in). A
 * material no row names keeps its own words as the label, so a named line
 * nobody has priced yet still shows instead of disappearing.
 */
export function qtoLineGroupOf(parent: QtoGroup, line: MeasureLine, set: PackSet = activePackSet()): QtoGroup {
  const code = line.subject === undefined || line.subject === "" ? null : layerCodeOf(line.subject, set.items(MATERIAL_LAYER_CODE_POINT));
  const read = code === null ? null : readCode(code.system, code.code);
  return {
    key: `${parent.key}\u0000line:${line.key}`,
    kind: "layer",
    label: line.label,
    parent: { key: parent.key, label: parent.label },
    ...(code === null ? {} : { classification: { system: code.system, code: code.code, from: "instance" as const } }),
    ...(read?.warning ? { warning: read.warning } : {}),
  };
}

/** The stage an element is built in, by stored id (absent: none). */
export function constructionStageIdOf(el: BimElement): string | null {
  if (!("constructionStageId" in el)) return null;
  const v: unknown = el.constructionStageId;
  return typeof v === "string" && v !== "" ? v : null;
}

/** For a measured element: its group, size group and stage at once. */
export function qtoKeysOf(elements: Elements, el: BimElement, measure: ElementMeasure, system?: string): { readonly group: QtoGroup; readonly sizeGroup: string | null; readonly stageId: string | null } {
  return { group: qtoGroupOf(elements, el, system), sizeGroup: measure.sizeGroup, stageId: constructionStageIdOf(el) };
}
