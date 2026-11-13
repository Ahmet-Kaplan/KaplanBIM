import { IFC_IMPORT_RULE_POINT, rectangleAxis, roundPlan, type BimElement, type ImportExtrusion, type ImportPoint, type ImportProduct, type ImportRuleContext, type ImportRuleDef, type ImportRuleResult, type Level, type Vec2 } from "@permitzip/bim-kernel";
import { type CurtainMemberProfile, type CurtainMemberRecord, type CurtainPanelRecord, CURTAIN_MEMBER_KIND, CURTAIN_PANEL_KIND, panelFaceNeedsStating } from "./curtain";
import { ROOF_KIND, STAIR_KIND, type RoofRecord, type StairRecord } from "./kinds";

/**
 * Roofs, stairs and curtain walls from a linked model
 * (`kernel.ifc_import_rule`): an `IfcRoof` becomes a roof from its body's
 * footprint, thickness and height (its `ROOF` slab part is how it is made,
 * not a second record); an `IfcStair` becomes one straight run from its steps
 * (its flight's risers and treads), rising to the level above; an `IfcPlate`
 * becomes a glazed panel and an `IfcMember` a line of framing, each measured
 * by what a firm prices (the panel's face m², the member's length). Anything
 * else stays linked with its reason.
 */

const round = (n: number): number => Math.round(n * 10) / 10;
const fail = (reason: string): ImportRuleResult => ({ ok: false, reason });
const typeNameOf = (p: ImportProduct, fallback: string): string => (p.typeName?.trim() || p.objectType?.trim() || fallback).slice(0, 200);
const FLAT_MM = 1;

function needLevel(ctx: ImportRuleContext, p: ImportProduct): Level | string {
  return ctx.level(p) ?? "it isn't on a storey this model has a level for";
}

function base(ctx: ImportRuleContext, p: ImportProduct, level: Level, kind?: string) {
  const values = ctx.values(p);
  const type = kind === undefined ? null : ctx.typeFor(p, kind);
  return {
    id: ctx.idFor(p.sourceId),
    version: 0,
    authoredRev: {},
    partition: ctx.partition(level),
    provenance: ctx.provenance(p),
    ...(type ? { typeId: type.id } : {}),
    ...(ctx.cls.source === "builtin" ? {} : { classId: ctx.cls.id }),
    ...(Object.keys(values).length > 0 ? { values } : {}),
  };
}

/** A block of a body: a horizontal footprint pushed up (its sides may lean), bottom and top heights. */
interface Block {
  readonly outline: readonly Vec2[];
  readonly bottom: number;
  readonly top: number;
}

function blockOf(x: ImportExtrusion): Block | null {
  const zs = x.base.map((q) => q.z);
  if (zs.length < 3 || Math.max(...zs) - Math.min(...zs) > FLAT_MM || Math.abs(x.along.z) < FLAT_MM) return null;
  const z0 = zs[0] ?? 0;
  const outline = [...x.base.map((q) => ({ x: q.x, y: q.y })), ...x.base.map((q) => ({ x: q.x + x.along.x, y: q.y + x.along.y }))];
  return { outline, bottom: Math.min(z0, z0 + x.along.z), top: Math.max(z0, z0 + x.along.z) };
}

/** Every block of the body, or why the body can't be read as flat blocks. */
function blocksOf(p: ImportProduct, what: string): Block[] | string {
  if (p.geometry.unread) return `its shape is ${p.geometry.unread}`;
  if (p.geometry.extrusions.length === 0) return `it has no ${what} body of its own to read`;
  const blocks: Block[] = [];
  for (const x of p.geometry.extrusions) {
    const b = blockOf(x);
    if (!b) return `its ${what} isn't made of flat pieces (a sloped or curved surface)`;
    blocks.push(b);
  }
  return blocks;
}

function hull(points: readonly Vec2[]): Vec2[] {
  const q = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (q.length < 3) return q;
  const cross = (o: Vec2, a: Vec2, b: Vec2): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (pts: readonly Vec2[]): Vec2[] => {
    const out: Vec2[] = [];
    for (const v of pts) {
      while (out.length >= 2 && cross(out[out.length - 2] as Vec2, out[out.length - 1] as Vec2, v) <= 0) out.pop();
      out.push(v);
    }
    return out;
  };
  const lower = half(q);
  const upper = half([...q].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export const ROOF_IMPORT_RULE: ImportRuleDef = {
  id: "architecture.roof",
  label: "Flat roofs",
  forKinds: [ROOF_KIND],
  convert(p, ctx) {
    const level = needLevel(ctx, p);
    if (typeof level === "string") return fail(level);
    const blocks = blocksOf(p, "roof");
    if (typeof blocks === "string") return fail(blocks);
    const outline = hull(blocks.flatMap((b) => b.outline)).map(roundPlan);
    if (outline.length < 3) return fail("its footprint has no area");
    const bottom = Math.min(...blocks.map((b) => b.bottom));
    const top = Math.max(...blocks.map((b) => b.top));
    if (blocks.length > 1) ctx.note(`${p.name?.trim() || p.sourceId}: its openings come in on their own; the roof is drawn round them`);
    const roof: RoofRecord = { id: ctx.idFor(p.sourceId), kind: ROOF_KIND, levelId: level.id, outline, thicknessMm: round(top - bottom), baseOffsetMm: round(bottom - level.elevationMm) };
    return { ok: true, records: [{ ...base(ctx, p, level), ...roof } as unknown as BimElement] };
  },
};

function numberIn(p: ImportProduct, set: string, key: string): number | null {
  const v = p.properties[set]?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export const STAIR_IMPORT_RULE: ImportRuleDef = {
  id: "architecture.stair",
  label: "Straight stairs",
  forKinds: [STAIR_KIND],
  convert(p, ctx) {
    const level = needLevel(ctx, p);
    if (typeof level === "string") return fail(level);
    const blocks = blocksOf(p, "stair");
    if (typeof blocks === "string") return fail(blocks);
    const name = p.name?.trim() || p.sourceId;
    const all = blocks.flatMap((b) => b.outline);
    let u: Vec2;
    let risers: number | null = numberIn(p, "Pset_StairCommon", "NumberOfRiser");
    if (blocks.length > 1) {
      // Steps climb from the foot: the run goes from the lowest step's middle towards the highest's.
      const mid = (b: Block): Vec2 => ({ x: b.outline.reduce((s, q) => s + q.x, 0) / b.outline.length, y: b.outline.reduce((s, q) => s + q.y, 0) / b.outline.length });
      const sorted = [...blocks].sort((a, b) => a.top - b.top);
      const lo = mid(sorted[0] as Block);
      const hi = mid(sorted[sorted.length - 1] as Block);
      const d = Math.hypot(hi.x - lo.x, hi.y - lo.y);
      if (d < FLAT_MM) return fail("its steps don't climb in one straight line");
      u = { x: (hi.x - lo.x) / d, y: (hi.y - lo.y) / d };
      risers ??= blocks.length + 1;
    } else {
      const axis = rectangleAxis(hull(all));
      if (!axis) return fail("its footprint isn't a rectangle (a turning or curved stair)");
      const d = Math.hypot(axis.end.x - axis.start.x, axis.end.y - axis.start.y);
      u = { x: (axis.end.x - axis.start.x) / d, y: (axis.end.y - axis.start.y) / d };
      ctx.note(`${name}: the file doesn't say which end is its foot; check its UP arrow`);
    }
    const along = all.map((q) => q.x * u.x + q.y * u.y);
    const across = all.map((q) => -q.x * u.y + q.y * u.x);
    const [a0, a1, c0, c1] = [Math.min(...along), Math.max(...along), Math.min(...across), Math.max(...across)];
    const c = (c0 + c1) / 2;
    const at = (a: number): Vec2 => roundPlan({ x: a * u.x - c * u.y, y: a * u.y + c * u.x });
    const stair: StairRecord = { id: ctx.idFor(p.sourceId), kind: STAIR_KIND, levelId: level.id, start: at(a0), end: at(a1), widthMm: round(c1 - c0), ...(risers !== null && risers >= 2 ? { risers: Math.round(risers) } : {}) };
    return { ok: true, records: [{ ...base(ctx, p, level), ...stair } as unknown as BimElement] };
  },
};

// ── curtain walls ───────────────────────────────────────────────────────────

/** A solid read as one profile pushed along one vector: what a sheet and a line of framing are read out of. */
interface Prism {
  readonly profile: readonly ImportPoint[];
  readonly along: ImportPoint;
  /** Set when the profile is a circle: its centre and radius (its section, when the push is its axis). */
  readonly circle?: { readonly centre: ImportPoint; readonly radius: number };
}

const len3 = (v: ImportPoint): number => Math.hypot(v.x, v.y, v.z);
const dot3 = (a: ImportPoint, b: ImportPoint): number => a.x * b.x + a.y * b.y + a.z * b.z;
const unit3 = (v: ImportPoint): ImportPoint => {
  const l = len3(v) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};
const cross3 = (a: ImportPoint, b: ImportPoint): ImportPoint => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

/**
 * The solid as one profile pushed along one vector, or why it isn't one. A
 * reading that isn't exact but holds the whole solid (a boolean cut left in)
 * is measured and the report says what was cut; any other unread solid is
 * refused, because measuring less than the model holds is worse than saying
 * so.
 */
function prismOf(p: ImportProduct, noun: string): Prism | string {
  if (p.geometry.unread !== null && p.geometry.cutsLeftIn !== true) return `its ${noun} is ${p.geometry.unread}`;
  const [only, ...rest] = p.geometry.extrusions;
  if (!only || rest.length > 0) return `it isn't one straight ${noun} with a constant profile`;
  if (len3(only.along) < FLAT_MM) return `its ${noun} has no depth to read`;
  const profile = dedupe3(only.base);
  if (profile.length < 3) return `its profile has no area`;
  return { profile, along: only.along, ...(only.circle ? { circle: only.circle } : {}) };
}

function dedupe3(points: readonly ImportPoint[]): ImportPoint[] {
  const out: ImportPoint[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || len3({ x: p.x - last.x, y: p.y - last.y, z: p.z - last.z }) > 0.5) out.push(p);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (first && last && out.length > 1 && len3({ x: first.x - last.x, y: first.y - last.y, z: first.z - last.z }) <= 0.5) out.pop();
  return out;
}

/** A profile's area, mm²: the magnitude of its area vector, so a profile in any plane reads (a plan footprint, a section). */
function profileAreaMm2(profile: readonly ImportPoint[]): number {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i] as ImportPoint;
    const b = profile[(i + 1) % profile.length] as ImportPoint;
    x += a.y * b.z - a.z * b.y;
    y += a.z * b.x - a.x * b.z;
    z += a.x * b.y - a.y * b.x;
  }
  return Math.hypot(x, y, z) / 2;
}

function edgesOf(profile: readonly ImportPoint[]): ImportPoint[] {
  return profile.map((a, i) => {
    const b = profile[(i + 1) % profile.length] as ImportPoint;
    return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  });
}

/** How far a set of points runs along a direction, mm. */
function extentAlong(points: readonly ImportPoint[], u: ImportPoint): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of points) {
    const at = dot3(p, u);
    if (at < lo) lo = at;
    if (at > hi) hi = at;
  }
  return hi - lo;
}

const mean3 = (points: readonly ImportPoint[]): ImportPoint => {
  const n = Math.max(points.length, 1);
  return { x: points.reduce((s, p) => s + p.x, 0) / n, y: points.reduce((s, p) => s + p.y, 0) / n, z: points.reduce((s, p) => s + p.z, 0) / n };
};

/**
 * A glazed panel: `IfcPlate` (a `.CURTAIN_PANEL.`, or the plain `.SHEET.` a
 * façade is usually exported as). Its quantity is the sheet's own face — its
 * largest side, m² — so a curved, cut or lying-flat sheet still comes in with
 * an area a firm can price; its record states that area when it isn't the
 * upright rectangle its bottom edge and height give, and the report says the
 * outline is the sheet's plan extent.
 */
const curtainPanel: ImportRuleDef = {
  id: CURTAIN_PANEL_KIND,
  label: "Curtain wall panels",
  forKinds: [CURTAIN_PANEL_KIND],
  convert(p, ctx) {
    const level = needLevel(ctx, p);
    if (typeof level === "string") return fail(level);
    const prism = prismOf(p, "sheet");
    if (typeof prism === "string") return fail(prism);
    const bounds = p.geometry.bounds;
    if (!bounds) return fail("its position couldn't be read");
    // The face a glazing price is for: the sheet's largest side. One side of the
    // profile times how far it is pushed is one face; the profile itself is the
    // other (a sheet extruded through its thickness, or lying flat).
    const capMm2 = profileAreaMm2(prism.profile);
    let sideMm2 = 0;
    for (const edge of edgesOf(prism.profile)) sideMm2 = Math.max(sideMm2, len3(edge) * len3(prism.along));
    const faceMm2 = Math.max(capMm2, sideMm2);
    if (!(faceMm2 >= FLAT_MM)) return fail("it has no face to measure");
    const thicknessMm = (capMm2 * len3(prism.along)) / faceMm2;
    const dx = bounds.max.x - bounds.min.x;
    const dy = bounds.max.y - bounds.min.y;
    const lengthMm = Math.max(dx, dy);
    const heightMm = bounds.max.z - bounds.min.z;
    if (!(lengthMm >= FLAT_MM) || !(heightMm >= FLAT_MM)) return fail("its face has no width or no height");
    // Its bottom edge is its plan extent: across the long side of its box.
    const midY = (bounds.min.y + bounds.max.y) / 2;
    const midX = (bounds.min.x + bounds.max.x) / 2;
    const start = dx >= dy ? { x: bounds.min.x, y: midY } : { x: midX, y: bounds.min.y };
    const end = dx >= dy ? { x: bounds.max.x, y: midY } : { x: midX, y: bounds.max.y };
    const stated = panelFaceNeedsStating(faceMm2, lengthMm * heightMm);
    if (stated) ctx.note(`${p.name?.trim() || p.sourceId}: its face isn't the upright rectangle its plan extent and height give; the panel takes the sheet's own face area and its outline is that extent`);
    const panel: CurtainPanelRecord = {
      ...base(ctx, p, level, CURTAIN_PANEL_KIND),
      kind: CURTAIN_PANEL_KIND,
      levelId: level.id,
      start: roundPlan(start),
      end: roundPlan(end),
      heightMm: round(heightMm),
      thicknessMm: round(thicknessMm),
      baseOffsetMm: round(bounds.min.z - level.elevationMm),
      ...(stated ? { areaSqM: Math.round((faceMm2 / 1e6) * 100) / 100 } : {}),
      panelType: typeNameOf(p, "Imported panel"),
    };
    return { ok: true, records: [panel as unknown as BimElement] };
  },
};

/**
 * A line of framing: `IfcMember` (a `.MULLION.`, `.TRANSOM.`, `.STUD.`…). Its
 * length is along the direction the member runs furthest in — its push (a
 * mullion extruded up) or one of its profile's own sides (a transom extruded
 * up its 90 mm) — and its section is its volume over that length, which is
 * exact for a prism whatever plane its profile is in. The section's size is
 * kept when it is a rectangle or a circle (the size a firm prices by); any
 * other section keeps its area alone.
 */
const curtainMember: ImportRuleDef = {
  id: CURTAIN_MEMBER_KIND,
  label: "Mullions and transoms",
  forKinds: [CURTAIN_MEMBER_KIND],
  convert(p, ctx) {
    const level = needLevel(ctx, p);
    if (typeof level === "string") return fail(level);
    const prism = prismOf(p, "member");
    if (typeof prism === "string") return fail(prism);
    const alongMm = len3(prism.along);
    const capMm2 = profileAreaMm2(prism.profile);
    const push = unit3(prism.along);
    const vertices: ImportPoint[] = [...prism.profile, ...prism.profile.map((v) => ({ x: v.x + prism.along.x, y: v.y + prism.along.y, z: v.z + prism.along.z }))];
    // The axis is the direction the solid runs furthest in: its push, or a side
    // of its profile (a member extruded up its own section, which is how most
    // viewers export a transom).
    const candidates: ImportPoint[] = [push, ...edgesOf(prism.profile).map(unit3)];
    let axis = push;
    let lengthMm = -1;
    for (const c of candidates) {
      const extent = extentAlong(vertices, c);
      if (extent > lengthMm) {
        lengthMm = extent;
        axis = c;
      }
    }
    if (!(lengthMm >= FLAT_MM)) return fail("it has no length");
    const sectionMm2 = (capMm2 * alongMm) / lengthMm;
    if (!(sectionMm2 >= FLAT_MM)) return fail("it has no section to measure");
    // Two directions across the axis, for its section's own size.
    const across = candidates.filter((c) => Math.abs(dot3(c, axis)) < 0.2).sort((a, b) => extentAlong(vertices, b) - extentAlong(vertices, a))[0] ?? { x: -axis.y, y: axis.x, z: 0 };
    const third = unit3(cross3(axis, across));
    const [ev, ew] = [extentAlong(vertices, across), extentAlong(vertices, third)];
    const centre = mean3(vertices);
    const along = vertices.map((v) => dot3(v, axis));
    const mid = dot3(centre, axis);
    const at = (d: number): ImportPoint => ({ x: centre.x + axis.x * (d - mid), y: centre.y + axis.y * (d - mid), z: centre.z + axis.z * (d - mid) });
    const lo = at(Math.min(...along));
    const hi = at(Math.max(...along));
    // A circle profile is the section only when the push runs along the axis.
    const diameter = prism.circle !== undefined && Math.abs(dot3(push, axis)) > 0.99 ? prism.circle.radius * 2 : null;
    const rectangular = diameter === null && ev >= FLAT_MM && ew >= FLAT_MM && Math.abs(sectionMm2 - ev * ew) <= 0.01 * sectionMm2;
    const profile: CurtainMemberProfile | undefined = diameter !== null ? { shape: "round", diameter } : rectangular ? { shape: "rect", width: round(Math.max(ev, ew)), height: round(Math.min(ev, ew)) } : undefined;
    const member: CurtainMemberRecord = {
      ...base(ctx, p, level, CURTAIN_MEMBER_KIND),
      kind: CURTAIN_MEMBER_KIND,
      levelId: level.id,
      start: roundPlan({ x: lo.x, y: lo.y }),
      end: roundPlan({ x: hi.x, y: hi.y }),
      startZmm: round(lo.z - level.elevationMm),
      endZmm: round(hi.z - level.elevationMm),
      ...(profile ? { profile } : { sectionAreaMm2: round(sectionMm2) }),
      memberType: typeNameOf(p, "Imported member"),
    };
    if (profile === undefined) ctx.note(`${p.name?.trim() || p.sourceId}: its section isn't a rectangle or a circle; its length and section area come in, its profile size doesn't`);
    return { ok: true, records: [member as unknown as BimElement] };
  },
};

export const ARCHITECTURE_IMPORT_RULES: readonly ImportRuleDef[] = [ROOF_IMPORT_RULE, STAIR_IMPORT_RULE, curtainPanel, curtainMember];
export { IFC_IMPORT_RULE_POINT };
