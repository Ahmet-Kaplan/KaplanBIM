import { type BimElement, type ElementKindItem, type KindSolidShape, type PlanGraphic, type RunSize, type Vec2 } from "@permitzip/bim-kernel";

/**
 * The Architecture add-on's curtain-wall kinds: the panels the envelope is
 * glazed with, and the framing lines between them.
 *
 * - `architecture.curtain_panel`: one sheet standing on its bottom edge, on a
 *   level, `heightMm` tall and `thicknessMm` thick. What a firm prices is its
 *   face, in m²: `start`/`end` × `heightMm` — or, when the file's own sheet
 *   isn't that rectangle (a curved or cut panel), the face area it states in
 *   `areaSqM`, exactly as a room states its own area.
 * - `architecture.curtain_member`: one straight line of framing — a mullion or
 *   a transom — from `start` to `end`, each end `startZmm` / `endZmm` above
 *   its level, of a section (`profile`: a rectangle or a circle). What a firm
 *   prices is its length, and its size groups the takeoff.
 *
 * The words a curtain wall is made of live here, in the trade's add-on, and
 * never in the kernel: the kernel's import rules read a plain solid, this
 * add-on's read a sheet and a line of framing out of one.
 */

export const CURTAIN_PANEL_KIND = "architecture.curtain_panel";
export const CURTAIN_MEMBER_KIND = "architecture.curtain_member";

/** How much a panel's stated face area may differ from its outline × height before the record keeps the file's own number. */
const FACE_TOLERANCE = 0.005;

/** The section of a member, as a person orders it: a rectangle or a round tube, mm. */
export type CurtainMemberProfile = Extract<RunSize, { shape: "rect" | "round" }>;

export interface CurtainPanelRecord {
  readonly id: string;
  readonly kind: typeof CURTAIN_PANEL_KIND;
  readonly levelId: string;
  /** Its bottom edge in plan, mm. */
  readonly start: Vec2;
  readonly end: Vec2;
  readonly heightMm: number;
  readonly thicknessMm: number;
  /** Its bottom above its level, mm. */
  readonly baseOffsetMm: number;
  /**
   * Its face area, m², when that isn't `start`→`end` × `heightMm` (a face that
   * isn't that upright rectangle: a curved, cut or flat-lying sheet). Absent
   * when the shape says it.
   */
  readonly areaSqM?: number;
  /** The type's name as the file gives it ("Glazed panel 1680 × 1420"). */
  readonly panelType?: string;
}

export interface CurtainMemberRecord {
  readonly id: string;
  readonly kind: typeof CURTAIN_MEMBER_KIND;
  readonly levelId: string;
  /** Its axis in plan, mm. */
  readonly start: Vec2;
  readonly end: Vec2;
  /** How high each end sits above its level, mm. */
  readonly startZmm: number;
  readonly endZmm: number;
  /** Its section when it is a rectangle or a circle; absent when the file's section is neither. */
  readonly profile?: CurtainMemberProfile;
  /** Its section's area, mm², when `profile` can't say it (an L or a T section). */
  readonly sectionAreaMm2?: number;
  /** The type's name as the file gives it ("Mullion 90 × 90"). */
  readonly memberType?: string;
}

const isVec = (v: unknown): v is Vec2 => typeof v === "object" && v !== null && typeof (v as { x?: unknown }).x === "number" && typeof (v as { y?: unknown }).y === "number";
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function profileOf(v: unknown): CurtainMemberProfile | null {
  if (typeof v !== "object" || v === null) return null;
  const shape = (v as { shape?: unknown }).shape;
  if (shape === "rect") {
    const width = num((v as { width?: unknown }).width);
    const height = num((v as { height?: unknown }).height);
    return width !== null && height !== null && width > 0 && height > 0 ? { shape: "rect", width, height } : null;
  }
  if (shape === "round") {
    const diameter = num((v as { diameter?: unknown }).diameter);
    return diameter !== null && diameter > 0 ? { shape: "round", diameter } : null;
  }
  return null;
}

/** A stored record as a panel, or null when it isn't one in this shape (kept as stored). */
export function asCurtainPanel(el: BimElement): CurtainPanelRecord | null {
  const r: Record<string, unknown> = { ...el };
  if (r.kind !== CURTAIN_PANEL_KIND || typeof r.levelId !== "string" || !isVec(r.start) || !isVec(r.end)) return null;
  const heightMm = num(r.heightMm);
  const thicknessMm = num(r.thicknessMm);
  if (heightMm === null || heightMm <= 0 || thicknessMm === null || thicknessMm <= 0) return null;
  const areaSqM = num(r.areaSqM);
  return {
    id: el.id,
    kind: CURTAIN_PANEL_KIND,
    levelId: r.levelId,
    start: r.start,
    end: r.end,
    heightMm,
    thicknessMm,
    baseOffsetMm: num(r.baseOffsetMm) ?? 0,
    ...(areaSqM !== null && areaSqM > 0 ? { areaSqM } : {}),
    ...(typeof r.panelType === "string" ? { panelType: r.panelType } : {}),
  };
}

/** A stored record as a member, or null. */
export function asCurtainMember(el: BimElement): CurtainMemberRecord | null {
  const r: Record<string, unknown> = { ...el };
  if (r.kind !== CURTAIN_MEMBER_KIND || typeof r.levelId !== "string" || !isVec(r.start) || !isVec(r.end)) return null;
  const startZmm = num(r.startZmm);
  const endZmm = num(r.endZmm);
  if (startZmm === null || endZmm === null) return null;
  const profile = profileOf(r.profile);
  const sectionAreaMm2 = num(r.sectionAreaMm2);
  return {
    id: el.id,
    kind: CURTAIN_MEMBER_KIND,
    levelId: r.levelId,
    start: r.start,
    end: r.end,
    startZmm,
    endZmm,
    ...(profile ? { profile } : {}),
    ...(sectionAreaMm2 !== null && sectionAreaMm2 > 0 ? { sectionAreaMm2 } : {}),
    ...(typeof r.memberType === "string" ? { memberType: r.memberType } : {}),
  };
}

const planLengthMm = (a: Vec2, b: Vec2): number => Math.hypot(b.x - a.x, b.y - a.y);

/** A panel's face area, m²: what the file's own sheet states, else its bottom edge × its height. */
export function curtainPanelAreaM2(p: CurtainPanelRecord): number {
  return p.areaSqM ?? (planLengthMm(p.start, p.end) * p.heightMm) / 1e6;
}

/** A member's length, m: along its axis, its rise included. */
export function curtainMemberLengthM(m: CurtainMemberRecord): number {
  return Math.hypot(planLengthMm(m.start, m.end), m.endZmm - m.startZmm) / 1000;
}

/** A member's section area, m²: its profile's, or the area the file's own section states. Null when neither says. */
export function curtainMemberSectionAreaM2(m: CurtainMemberRecord): number | null {
  const profile = m.profile;
  if (profile?.shape === "rect") return (profile.width * profile.height) / 1e6;
  if (profile?.shape === "round") return (Math.PI * profile.diameter * profile.diameter) / 4e6;
  return m.sectionAreaMm2 === undefined ? null : m.sectionAreaMm2 / 1e6;
}

/** A section as a person orders it ("90 × 90 mm", "Ø90 mm"); null when the file's section named no size. */
export function curtainProfileLabel(m: CurtainMemberRecord): string | null {
  const profile = m.profile;
  if (profile?.shape === "rect") return `${round(profile.width)} × ${round(profile.height)} mm`;
  if (profile?.shape === "round") return `Ø${round(profile.diameter)} mm`;
  const area = m.sectionAreaMm2;
  return area === undefined ? null : `${round(Math.sqrt(area))} mm square section`;
}

function round(n: number): number {
  const r = Math.round(n);
  return Math.abs(n - r) < 0.05 ? r : Math.round(n * 10) / 10;
}

/** Whether a panel's face is the rectangle its outline and height give, so the record needs no stated area. */
export function panelFaceNeedsStating(faceMm2: number, outlineHeightMm2: number): boolean {
  return Math.abs(faceMm2 - outlineHeightMm2) > FACE_TOLERANCE * Math.max(faceMm2, 1);
}

// ── drawings ────────────────────────────────────────────────────────────────

function elevationOf(elements: Readonly<Record<string, BimElement>>, levelId: string): number | null {
  const l = elements[levelId];
  return l?.kind === "level" ? l.elevationMm : null;
}

/** A panel's four plan corners, `thicknessMm` across its bottom edge. */
export function panelOutline(p: CurtainPanelRecord): Vec2[] {
  const dx = p.end.x - p.start.x;
  const dy = p.end.y - p.start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return [];
  const nx = (-dy / len) * (p.thicknessMm / 2);
  const ny = (dx / len) * (p.thicknessMm / 2);
  return [
    { x: p.start.x + nx, y: p.start.y + ny },
    { x: p.end.x + nx, y: p.end.y + ny },
    { x: p.end.x - nx, y: p.end.y - ny },
    { x: p.start.x - nx, y: p.start.y - ny },
  ];
}

const midpoint = (m: CurtainMemberRecord): Vec2 => ({ x: (m.start.x + m.end.x) / 2, y: (m.start.y + m.end.y) / 2 });

function memberSideMm(m: CurtainMemberRecord): number {
  const area = curtainMemberSectionAreaM2(m);
  return area === null ? 50 : round(Math.sqrt(area * 1e6));
}

export const CURTAIN_PANEL_KIND_ROW: ElementKindItem = {
  kind: CURTAIN_PANEL_KIND,
  label: "Curtain wall panel",
  nature: "physical",
  newForOlderPeers: true,
  shape: {
    fields: [
      { name: "levelId", form: "id" },
      { name: "start", form: "point" },
      { name: "end", form: "point" },
      { name: "heightMm", form: "number" },
      { name: "thicknessMm", form: "number" },
      { name: "baseOffsetMm", form: "number" },
      { name: "areaSqM", form: "number", optional: true },
      { name: "panelType", form: "text", optional: true },
    ],
    points: (el) => {
      const p = asCurtainPanel(el);
      return p ? [p.start, p.end] : [];
    },
  },
  anchor: (el) => {
    const p = asCurtainPanel(el);
    return p ? { x: (p.start.x + p.end.x) / 2, y: (p.start.y + p.end.y) / 2 } : null;
  },
  planGraphics(el, ctx) {
    const p = asCurtainPanel(el);
    if (!p || p.levelId !== ctx.levelId) return null;
    const outline = panelOutline(p);
    if (outline.length < 3) return null;
    const graphic: PlanGraphic = { form: "polyline", points: outline, closed: true, pen: "thin" };
    return [graphic];
  },
  solid(el, ctx) {
    const p = asCurtainPanel(el);
    if (!p) return null;
    const outline = panelOutline(p);
    if (outline.length < 3) return null;
    const z0 = (elevationOf(ctx.elements, p.levelId) ?? ctx.floorMm) + p.baseOffsetMm;
    const shape: KindSolidShape = { form: "prism", outline, z0, z1: z0 + p.heightMm, category: "walls", role: "architecture" };
    return shape;
  },
};

export const CURTAIN_MEMBER_KIND_ROW: ElementKindItem = {
  kind: CURTAIN_MEMBER_KIND,
  label: "Curtain wall member",
  nature: "physical",
  newForOlderPeers: true,
  shape: {
    fields: [
      { name: "levelId", form: "id" },
      { name: "start", form: "point" },
      { name: "end", form: "point" },
      { name: "startZmm", form: "number" },
      { name: "endZmm", form: "number" },
      { name: "profile", form: "architecture.profile", optional: true },
      { name: "sectionAreaMm2", form: "number", optional: true },
      { name: "memberType", form: "text", optional: true },
    ],
    points: (el) => {
      const m = asCurtainMember(el);
      return m ? [m.start, m.end] : [];
    },
  },
  anchor: (el) => {
    const m = asCurtainMember(el);
    return m ? midpoint(m) : null;
  },
  planGraphics(el, ctx) {
    const m = asCurtainMember(el);
    if (!m || m.levelId !== ctx.levelId) return null;
    // A member lying in the plan is its line; one standing up (a mullion) is
    // its own section, so it is still there to pick and to print.
    if (planLengthMm(m.start, m.end) >= 1) {
      const graphic: PlanGraphic = { form: "line", a: m.start, b: m.end, pen: "medium" };
      return [graphic];
    }
    const side = memberSideMm(m);
    const graphic: PlanGraphic = { form: "rect", center: midpoint(m), size: { x: side, y: side }, pen: "thin" };
    return [graphic];
  },
  solid(el, ctx) {
    const m = asCurtainMember(el);
    if (!m) return null;
    const z = elevationOf(ctx.elements, m.levelId) ?? ctx.floorMm;
    const a = { x: m.start.x, y: m.start.y, z: z + m.startZmm };
    const b = { x: m.end.x, y: m.end.y, z: z + m.endZmm };
    if (Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) < 1) return null;
    const side = memberSideMm(m);
    const size: RunSize = m.profile ?? { shape: "rect", width: side, height: side };
    const shape: KindSolidShape = { form: "run", a, b, size, sizeMm: size.shape === "rect" ? Math.max(size.width, size.height) : side, category: "walls", role: "architecture" };
    return shape;
  },
};

export const CURTAIN_KIND_ROWS: readonly ElementKindItem[] = [CURTAIN_PANEL_KIND_ROW, CURTAIN_MEMBER_KIND_ROW];
