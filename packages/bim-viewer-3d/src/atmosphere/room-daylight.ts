/**
 * How much daylight reaches each room — the number a client asks for ("how much
 * daylight does this office get?") and the thing a design review argues about.
 *
 * ## The model, stated plainly
 *
 * It is a **daylight factor**, the classic architectural daylight metric: the
 * illuminance inside, as a percentage of the illuminance outside, under the same
 * sky. It is estimated, not simulated:
 *
 *     litArea   = Σ  width x height x transmittance x cos(sun, outward normal)
 *                 w                            (only over openings that face open air
 *                                               and whose outward normal faces the sun)
 *     surface   = floor + ceiling + Σ wall length x height
 *     daylightFactor % = 100 x litArea / surface
 *
 * In words: how many square metres of lit glass a room has, against how many
 * square metres of surface the light has to fill before it reaches a person.
 * More glass, more daylight; glass facing the sun, more daylight; a bigger or
 * taller room with the same window, less; a window on the side away from the
 * sun, none. That is the whole of it.
 *
 * ## What it ignores, and why that is honest
 *
 * - **It is not a simulation.** No ray is traced, no rebound is integrated, no
 *   sky luminance distribution is sampled. It is the arithmetic above.
 * - **No reflected light.** Real rooms get a large part of their daylight from
 *   the walls and the floor bouncing it about. This model counts only what
 *   arrives straight through an opening, so its number is pessimistic — the
 *   right direction to be wrong in for a room that is being judged.
 * - **No glazing depth, no frames, no shading.** A reveal, a mullion, a blind,
 *   a balcony soffit, a neighbouring building and a tree all reduce daylight in
 *   life and none of them is a term here. `DAYLIGHT_TRANSMITTANCE` absorbs the
 *   glass and nothing else.
 * - **No room shape.** The light is spread evenly over the whole surface area,
 *   so a room reads the same whether the window is beside the desk or in the
 *   far corner. Real daylight falls off steeply with distance from a window.
 * - **No opening height.** A high window throws light further into a room than a
 *   low one of the same area; this model cannot tell them apart.
 * - **A room the model cannot pair with its openings gets no credit, by
 *   design.** An opening whose two sides are both rooms is an interior door and
 *   gives nothing; an opening with no room on either side gives nothing.
 *
 * Units: the model is in kernel millimetres (plan X east, Y north), like the
 * rest of the model, and the results are m² and percent.
 *
 * It is reachable from the `/light` entry the Building Model surface loads
 * before the 3D view exists, so it must not drag three.js or an editor in. It
 * does not: the polygon measures it uses (`containsPoint`, `polygonArea`) are
 * pure TypeScript, and the manifold core behind `bim-geometry` is a dynamic
 * import that only a solid operation ever pulls.
 */
import { containsPoint, polygonArea } from "@permitzip/bim-geometry";
import { sunDirection, type SceneDirection, type SunAngles } from "./daylight";

/** A plan point in kernel millimetres. */
export interface PlanPoint {
  readonly x: number;
  readonly y: number;
}

/** A room, as much of the kernel's `Room` record as daylight needs. */
export interface DaylightRoom {
  readonly id: string;
  readonly number: string;
  readonly name: string;
  /** Plan outline, kernel millimetres (`Room.outline`). */
  readonly outline: readonly PlanPoint[];
  /** Stored floor area, m² (`Room.areaSqM`); measured from the outline when it is not a usable number. */
  readonly areaSqM: number;
  /** Floor to ceiling, mm (`Room.ceilingHeightMm`), when the room states one. */
  readonly ceilingHeightMm?: number;
  /** The earlier import's room this one is paired with (`Room.continuesId`), carried through unchanged. */
  readonly continuesId?: string;
}

/** A wall, as much of the kernel's `Wall` record as daylight needs. */
export interface DaylightWall {
  readonly id: string;
  readonly start: PlanPoint;
  readonly end: PlanPoint;
  /** Wall thickness, mm; the probe that decides which side a room is on clears it. */
  readonly thickness?: number;
}

/** A door or window, as much of the kernel's `Opening` record as daylight needs. */
export interface DaylightOpening {
  readonly id: string;
  /** The wall it is hosted in (`Opening.hostId`). */
  readonly hostId: string;
  /** World centre on the host wall, kernel millimetres (`Opening.position`). */
  readonly position: PlanPoint;
  /** Aperture, mm. */
  readonly width: number;
  readonly height: number;
  /** `window`, `door`, or a newer peer's type. */
  readonly openingType: string;
}

/** A model's rooms, walls and openings, in the shape daylight reads them. */
export interface DaylightModel {
  readonly rooms: readonly DaylightRoom[];
  readonly walls: readonly DaylightWall[];
  readonly openings: readonly DaylightOpening[];
}

/** One room's daylight, as a design review or a client reads it. */
export interface RoomDaylight {
  readonly roomId: string;
  readonly number: string;
  readonly name: string;
  readonly continuesId?: string;
  /** Floor area used, m²: the room's stored area, else measured from its outline. */
  readonly floorAreaSqM: number;
  /** Floor to ceiling used, metres: the room's own, else `ASSUMED_CEILING_M`. */
  readonly ceilingHeightM: number;
  /** Whether the height was assumed because the room states none. */
  readonly heightAssumed: boolean;
  /** Everything the light has to fill: floor + ceiling + walls, m². */
  readonly surfaceAreaSqM: number;
  /** Aperture of the openings attributed to this room and facing open air, m² (transmittance not applied). */
  readonly openingAreaSqM: number;
  /** Aperture x transmittance x the sun's incidence on it, m²: the equivalent fully lit area. */
  readonly litAreaSqM: number;
  /** `litArea` over `surfaceArea`, in percent: the room's daylight factor. Zero when nothing faces the sun. */
  readonly daylightFactorPct: number;
}

/**
 * What share of the light falling on it a window frame's worth of clear
 * double-glazing passes. A 4 mm single pane is around 0.85; two panes with a
 * coating are 0.55-0.70. 0.6 is the ordinary middle of that, and it is the only
 * thing in this model that stands in for glass.
 */
export const DAYLIGHT_TRANSMITTANCE = 0.6;

/**
 * What share a door passes. The kernel's opening types are `door` and `window`
 * and nothing in them says whether a door is glazed, so every door is taken as
 * solid and almost shut: a tenth of a window. A glazed door reads low here, and
 * that is the safe direction to be wrong in — the alternative counted a solid
 * store door as a picture window.
 */
export const DOOR_TRANSMITTANCE = 0.06;

/**
 * The ceiling height assumed when a room states none, in metres. A room can
 * arrive from a file that carries no height (`Room.ceilingHeightMm` is absent
 * for a room that does not state one), and the surface it has to fill cannot be
 * worked out without one. 2.7 m is the ordinary apartment and office floor to
 * ceiling in the stock this firm works on; a stated height always wins, and the
 * result says `heightAssumed` so a schedule can print the assumption instead of
 * asserting it.
 */
export const ASSUMED_CEILING_M = 2.7;

/**
 * How far past the wall's face the probe that attributes an opening to a room is
 * put, in millimetres. Half the wall's thickness clears the wall itself; half a
 * metre more puts the probe inside the room rather than in the skirting.
 *
 * The cost of getting this wrong is an opening attributed to no room, which is
 * visible as a zero, not as a plausible wrong number.
 */
const INNER_PROBE_MM = 500;

/** Kernel plan (x east, y north) direction to scene (x east, y up, z south). */
function planToScene(dx: number, dy: number): SceneDirection {
  return [dx, 0, -dy];
}

/** A room outline as the polygon measures in `bim-geometry` want it. */
function asLoop(outline: readonly PlanPoint[]): readonly (readonly [number, number])[] {
  return outline.map((point) => [point.x, point.y] as const);
}

function contains(room: DaylightRoom, point: PlanPoint): boolean {
  if (room.outline.length < 3) return false;
  return containsPoint(asLoop(room.outline), [point.x, point.y]);
}

/** Every room a plan point falls in. Usually one; none in open air. */
export function roomsAt(model: DaylightModel, point: PlanPoint): readonly DaylightRoom[] {
  return model.rooms.filter((room) => contains(room, point));
}

/** The room a plan point falls in, if any. */
function roomAt(model: DaylightModel, point: PlanPoint): DaylightRoom | null {
  return roomsAt(model, point)[0] ?? null;
}

/** How far around a room's outline goes, metres. */
function perimeterM(outline: readonly PlanPoint[]): number {
  if (outline.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < outline.length; i++) {
    const from = outline[i]!;
    const to = outline[(i + 1) % outline.length]!;
    total += Math.hypot(to.x - from.x, to.y - from.y);
  }
  return total / 1000;
}

/** A room's floor area: the area it states, else the one its outline encloses. */
function floorAreaSqM(room: DaylightRoom): number {
  if (Number.isFinite(room.areaSqM) && room.areaSqM > 0) return room.areaSqM;
  if (room.outline.length < 3) return 0;
  // `polygonArea` is in mm² like its input; a square metre is 10^6 of them.
  return polygonArea(asLoop(room.outline)) / 1_000_000;
}

/** What share of the light on it an opening of this type passes. */
function transmittanceOf(opening: DaylightOpening): number {
  return opening.openingType === "door" ? DOOR_TRANSMITTANCE : DAYLIGHT_TRANSMITTANCE;
}

interface OpeningSides {
  readonly room: DaylightRoom;
  /** Scene-space direction pointing out of the room, through the opening. */
  readonly outward: SceneDirection;
}

/**
 * Which room an opening lights, and which way it faces the sky — from the wall
 * it is hosted in and the rooms either side of that wall.
 *
 * A wall's `start` → `end` gives a left normal; the probe goes half a wall plus
 * `INNER_PROBE_MM` to each side. A room on exactly one side is the room the
 * opening lights, and the opening faces out the other side. Both sides a room:
 * an interior door, and no daylight. Neither side: a wall no room touches, and
 * nothing to attribute.
 *
 * An opening with no readable host wall is taken as a skylight: it faces
 * straight up and lights the room its plan position is in. The kernel's
 * `openingType` has no `skylight` yet, but the field keeps a newer peer's type,
 * and a roof opening arrives that way.
 */
function sidesOf(model: DaylightModel, opening: DaylightOpening): OpeningSides | null {
  const host = model.walls.find((wall) => wall.id === opening.hostId);
  if (host === undefined) {
    const room = roomAt(model, opening.position);
    return room === null ? null : { room, outward: [0, 1, 0] };
  }
  const dx = host.end.x - host.start.x;
  const dy = host.end.y - host.start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const leftX = -dy / length;
  const leftY = dx / length;
  const reach = (host.thickness ?? 0) / 2 + INNER_PROBE_MM;
  const leftRoom = roomAt(model, { x: opening.position.x + leftX * reach, y: opening.position.y + leftY * reach });
  const rightRoom = roomAt(model, { x: opening.position.x - leftX * reach, y: opening.position.y - leftY * reach });
  if (leftRoom !== null && rightRoom === null) return { room: leftRoom, outward: planToScene(-leftX, -leftY) };
  if (rightRoom !== null && leftRoom === null) return { room: rightRoom, outward: planToScene(leftX, leftY) };
  return null;
}

/**
 * Every room's daylight, in the order the model lists its rooms.
 *
 * A room with no opening that faces the sun has a factor of exactly zero — no
 * floor, no minimum. A number a client compares must be allowed to read as none
 * rather than as a small something a reader rounds up.
 */
export function roomDaylight(model: DaylightModel, sun: SunAngles): readonly RoomDaylight[] {
  const toSun = sunDirection(sun);
  const attributed = new Map<string, { openingAreaSqM: number; litAreaSqM: number }>();
  for (const opening of model.openings) {
    const sides = sidesOf(model, opening);
    if (sides === null) continue;
    const aperture = (opening.width / 1000) * (opening.height / 1000);
    const incidence = Math.max(0, sides.outward[0] * toSun[0] + sides.outward[1] * toSun[1] + sides.outward[2] * toSun[2]);
    const running = attributed.get(sides.room.id) ?? { openingAreaSqM: 0, litAreaSqM: 0 };
    attributed.set(sides.room.id, {
      openingAreaSqM: running.openingAreaSqM + aperture,
      litAreaSqM: running.litAreaSqM + aperture * transmittanceOf(opening) * incidence,
    });
  }

  return model.rooms.map((room) => {
    const floor = floorAreaSqM(room);
    const heightAssumed = !(typeof room.ceilingHeightMm === "number" && room.ceilingHeightMm > 0);
    const ceilingHeightM = heightAssumed ? ASSUMED_CEILING_M : room.ceilingHeightMm! / 1000;
    // Six sides, four of them one height: floor, ceiling, and the walls around.
    const surfaceAreaSqM = floor + floor + perimeterM(room.outline) * ceilingHeightM;
    const openings = attributed.get(room.id) ?? { openingAreaSqM: 0, litAreaSqM: 0 };
    const daylightFactorPct = surfaceAreaSqM > 0 ? (100 * openings.litAreaSqM) / surfaceAreaSqM : 0;
    return {
      roomId: room.id,
      number: room.number,
      name: room.name,
      ...(room.continuesId === undefined ? {} : { continuesId: room.continuesId }),
      floorAreaSqM: floor,
      ceilingHeightM,
      heightAssumed,
      surfaceAreaSqM,
      openingAreaSqM: openings.openingAreaSqM,
      litAreaSqM: openings.litAreaSqM,
      daylightFactorPct,
    };
  });
}

/**
 * The daylight a person standing at this plan point receives, or null in open
 * air.
 *
 * This is what keeps daylight inside the building: a point on a façade is in no
 * room, so nothing the room model says is applied to it. An exterior surface
 * that read as a room's interior — the wash that makes a façade look dirty —
 * cannot happen through this function, and `daylight.test.ts` asserts it.
 */
export function daylightAt(model: DaylightModel, point: PlanPoint, sun: SunAngles): RoomDaylight | null {
  const room = roomAt(model, point);
  if (room === null) return null;
  return roomDaylight(model, sun).find((entry) => entry.roomId === room.id) ?? null;
}
