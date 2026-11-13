import { elementTypeValue, type BimElement, type MeasureRuleDef } from "@permitzip/bim-kernel";
import { asCurtainMember, asCurtainPanel, curtainMemberLengthM, curtainMemberSectionAreaM2, curtainPanelAreaM2, curtainProfileLabel, CURTAIN_MEMBER_KIND, CURTAIN_PANEL_KIND } from "./curtain";

/**
 * The Architecture add-on's measure rule (`MEASURE_RULE_POINT`) for its
 * curtain-wall kinds: the glazing by m² and the framing by length, which is
 * how each is priced. A member's section groups its lengths ("90 × 90 mm"), so
 * a mullion schedule and a rate can be read by profile size; a section the
 * file draws but names no size for groups under its own area instead of
 * disappearing.
 */

/** Type parameters the kernel's own rules read for weight; a curtain wall's type may state them too. */
const QTO_UNIT_MASS_KEY = "qto.unit_mass";
const QTO_MASS_PER_LENGTH_KEY = "qto.mass_per_length";

const COUNT = { key: "qto.count", kind: "count", unit: "ea", from: "one per element", label: "Count" } as const;
const MASS_UNIT = { key: "qto.mass", kind: "mass", unit: "kg", from: `count × the type's unit weight (${QTO_UNIT_MASS_KEY})`, label: "Weight" } as const;
const MASS_LINEAR = { key: "qto.mass", kind: "mass", unit: "kg", from: `length × the type's weight per length (${QTO_MASS_PER_LENGTH_KEY})`, label: "Weight" } as const;

function typeNumber(el: BimElement, elements: Readonly<Record<string, BimElement>>, key: string): number | null {
  const v = elementTypeValue(elements, el, key);
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export const CURTAIN_PANEL_MEASURE_RULE: MeasureRuleDef = {
  id: "architecture.curtain_panel",
  label: "Curtain wall panels",
  kinds: [CURTAIN_PANEL_KIND],
  // `qto.area` is shared with a slab's plan and an opening's width × height, and the
  // table keeps the first rule's words for a key: it is worded for the key, not for a panel.
  measures: [{ key: "qto.area", kind: "area", unit: "m2", from: "its own area (a sheet's face, a slab's plan, an opening's width × height)", label: "Area", primary: true }, COUNT, MASS_UNIT],
  measure(el, elements) {
    const panel = asCurtainPanel(el);
    if (!panel) return {};
    const out: Record<string, number> = { "qto.area": curtainPanelAreaM2(panel), "qto.count": 1 };
    const unit = typeNumber(el, elements, QTO_UNIT_MASS_KEY);
    if (unit !== null) out["qto.mass"] = unit;
    return out;
  },
};

export const CURTAIN_MEMBER_MEASURE_RULE: MeasureRuleDef = {
  id: "architecture.curtain_member",
  label: "Mullions and transoms",
  kinds: [CURTAIN_MEMBER_KIND],
  measures: [
    { key: "qto.length", kind: "length", unit: "m", from: "centreline length along its axis, a member's rise included", label: "Length", primary: true },
    { key: "qto.section_area", kind: "area", unit: "m2", from: "its section's area: its profile, or the area the file's own section states", label: "Section area" },
    COUNT,
    MASS_LINEAR,
  ],
  sizeGroup: (el) => {
    const member = asCurtainMember(el);
    return member === null ? null : curtainProfileLabel(member);
  },
  measure(el, elements) {
    const member = asCurtainMember(el);
    if (!member) return {};
    const length = curtainMemberLengthM(member);
    const out: Record<string, number> = { "qto.length": length, "qto.count": 1 };
    const section = curtainMemberSectionAreaM2(member);
    if (section !== null) out["qto.section_area"] = section;
    const perLength = typeNumber(el, elements, QTO_MASS_PER_LENGTH_KEY);
    if (perLength !== null) out["qto.mass"] = perLength * length;
    return out;
  },
};

export const CURTAIN_MEASURE_RULES: readonly MeasureRuleDef[] = [CURTAIN_PANEL_MEASURE_RULE, CURTAIN_MEMBER_MEASURE_RULE];
