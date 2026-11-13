import { enclosingFits, type FaceFit, type Loop } from "@permitzip/bim-geometry";
import type { ElementId, Room, Vec2 } from "../types";

/**
 * Whether a room in one import is the same room as one the model already
 * holds — the thing a firm receiving a model each design revision needs before
 * a quantity comparison means anything.
 *
 * A room is a shape with a name on it, and a revision redraws the shapes: the
 * file is exported again, every product gets a new id, and without this pass
 * revision 2's "Room 101, 17.9 m²" is a different record from revision 1's
 * "Room 101, 18.4 m²", so nothing can say one room changed. With it, the pair
 * is recorded once and the change is a delta (`import/room-changes.ts`).
 *
 * **The order is the argument**, strongest claim first:
 *
 * 1. **Its own number, then its label.** The file's `Name` (a room's "101") is
 *    the identifier a person and the architect both use, and it is unique on a
 *    storey; the label (`LongName`, "Office") is what a person reads. A key
 *    that names exactly one room on each side pairs them outright; a key
 *    several rooms share names nothing by itself (two rooms called "Office" are
 *    two rooms), so those go to the position stages — which is how a room keeps
 *    its counterpart when both are called "Room 3".
 * 2. **Its seed.** Every imported room carries the point furthest inside it
 *    (`labelSeed`), so a room whose walls moved a little has a seed that moved
 *    a little: a seed moves half of what a wall moves, measured (a 300 mm wall
 *    move in a 4.0 × 3.0 m room moves its seed 150 mm). This is what carries a
 *    room a person renamed, since a label that no longer matches says nothing
 *    about which room left.
 * 3. **Its fit.** With no name and no seed to go on, the polygons decide: the
 *    earlier room that both holds this room and is about its size (the
 *    share/cover score of `@permitzip/bim-geometry`, `polygon-containment.ts`)
 *    is the room this one continues.
 * 4. Otherwise **new** — not matched. A room nothing older resembles is a room
 *    the revision added, and pairing it with the nearest old room would invent
 *    a change that never happened.
 *
 * **What this pass refuses to do.** It does not rename a room, merge two into
 * one, or delete one. A person's name for a room is theirs (the comparable
 * editor's `room_named_by_person` refusals) and a silent rename is the one act
 * that makes a quantity history untrustworthy: a pairing is a claim, the change
 * list is its evidence, and settling it is a person's. Nothing here writes to a
 * record; the caller writes the pairing it accepts.
 *
 * **With one import nothing matches**, by construction and by intent: a model
 * holding no room from an earlier import of this linked model has nothing to
 * pair against, every room is added, and a first import behaves exactly as it
 * did before this pass existed.
 *
 * Ported as a design, not a copy: Pascal Editor's `room-zone-migration.ts` pairs
 * a floor plate to the previous one by shared zone ids and then polygon
 * overlap, and keeps a room's identity through a partition edit at the same
 * elevation (MIT licence, Copyright (c) Pascal Group Inc.). The ordering here
 * is ours and adds the seed, because a Revit export carries no zone ids.
 *
 * Units: millimetres, the kernel's. Areas are never compared directly; they
 * enter only through the fit's two ratios, which are unitless.
 */

/**
 * How far two seeds may be apart and still be the room that did not move, mm.
 *
 * A seed moves by half of what a wall moves: measured on a 4.0 × 3.0 m room
 * (`polygonLabel` and the kernel's `labelSeedOf` agree to the millimetre), a
 * 100 mm wall move moves the seed 50 mm, 300 mm moves it 150 mm and 1 m moves it
 * 500 mm. 400 mm therefore covers a room whose wall moved 800 mm — most of a
 * door leaf — and refuses one whose walls moved a metre or more.
 *
 * The other side of the number is that two rooms must never be confused by
 * their seeds. Side by side, two rooms put their seeds half a room apart at
 * least: measured, two 1.2 m-wide rooms are 1200 mm apart and two 3 m rooms
 * 3000 mm apart, so 400 mm is a third of the narrowest of those. The nearest
 * candidate wins and the rest stay free, so a wall of identical narrow rooms
 * still pairs one to one.
 */
export const SEED_MATCH_MM = 400;

/**
 * The lowest share/cover score an earlier room needs to be the room a new one
 * continues.
 *
 * The score is the harmonic mean of how much of the new room the old one holds
 * and how much of the old one the new one fills (1 for the same polygon), so it
 * answers "same room, redrawn" rather than "touching". Measured: a wall moved
 * 300 mm in a 4.0 × 3.0 m room scores 0.961, 1 m scores 0.857, a room that grew
 * 500 mm on one side scores 0.941, and a room that moved sideways 1 m at the
 * same size scores 0.75. 0.8 admits the wall moves and refuses the sideways one
 * as well as any candidate that shares no floor.
 *
 * It is also the line a *division* of a room falls the right side of: when one
 * room becomes two, each half scores 0.667 against the whole, a 60/40 split
 * scores 0.75 and a 75/25 split 0.857. So an ordinary division produces two new
 * rooms rather than silently giving the old room's history to one half — a
 * split is a person's edit, not a match's. (With the old room containing the
 * new, 0.8 is also exactly where the areas differ by two thirds: a room may
 * shrink to ⅔ of its area, or grow by half, and still be itself.)
 *
 * One threshold and not two: the score already carries the share floor. A fit
 * cannot exceed 1, so a score of at least 0.8 needs a `share` of at least ⅔
 * (score = 2·share·cover / (share + cover) is largest at cover = 1, where it is
 * 2·share / (1 + share)). A separate "the old room must hold half the new one"
 * constant would be a number that can never be the one that decides, so this
 * pass has none: ⅔ of the new floor is older floor, or it is another room.
 */
export const FIT_MATCH_SCORE = 0.8;

/** How a pairing was decided, in the order the pass tries them. */
export type RoomMatchReason = "number" | "name" | "seed" | "fit";

/** One room this import recognised as the same room as one already in the model, with the evidence. */
export interface RoomPairing {
  /** The room the model already holds. */
  readonly previousId: ElementId;
  /** The room this import made for it. */
  readonly id: ElementId;
  /** The signal that settled it. */
  readonly reason: RoomMatchReason;
  /** How far apart their seeds are, mm; null when either room states no seed. */
  readonly seedApartMm: number | null;
  /** How much of the new room the old one holds; null when they share no floor at all. */
  readonly share: number | null;
  /** How much of the old room the new one fills; null when they share no floor at all. */
  readonly cover: number | null;
  /** The one number the two make (their harmonic mean); null when they share no floor. */
  readonly score: number | null;
}

export interface RoomMatchResult {
  /** Every pairing, in the order this import gives its rooms. */
  readonly pairs: readonly RoomPairing[];
  /** Rooms this import made that continue nothing: rooms the revision added. */
  readonly added: readonly ElementId[];
  /** Rooms from an earlier import that this one paired with nothing. */
  readonly removed: readonly ElementId[];
}

export interface RoomMatchOptions {
  /**
   * Which storey a room is on, as text that means the same thing for both
   * revisions. Default: the room's `partition.level`, the level a person reads.
   * The import passes a resolver that answers with the level's own id, so a
   * renamed level does not make a whole storey look new.
   */
  readonly storeyOf?: (room: Room) => string;
}

/** A room's storey as the record states it: the level name on its partition. */
export function storeyOfRoom(room: Room): string {
  return room.partition?.level ?? "";
}

/** A pair of rooms the position stages may consider. */
interface Edge {
  readonly previous: Room;
  readonly current: Room;
  /** The number the stage orders by: smaller is better (a seed distance, or a negated score). */
  readonly rank: number;
}

/**
 * Pair the rooms of an earlier import with the rooms of this one, one to one,
 * strongest claim first (see the file's header). Pure: `before` and `after` are
 * read and never changed.
 */
export function matchRooms(before: readonly Room[], after: readonly Room[], options: RoomMatchOptions = {}): RoomMatchResult {
  const storeyOf = options.storeyOf ?? storeyOfRoom;
  const byAfter = new Map<ElementId, RoomPairing>();
  const pairedBefore = new Set<ElementId>();

  const evidence = new Map<string, Evidence>();
  const evidenceOf = (previous: Room, current: Room): Evidence => {
    const key = `${previous.id}\u0000${current.id}`;
    const had = evidence.get(key);
    if (had !== undefined) return had;
    const made: Evidence = { seedApartMm: seedApartMm(previous, current), fit: fitOf(previous, current) };
    evidence.set(key, made);
    return made;
  };

  const pair = (previous: Room, current: Room, reason: RoomMatchReason): void => {
    const { seedApartMm: apart, fit } = evidenceOf(previous, current);
    byAfter.set(current.id, { previousId: previous.id, id: current.id, reason, seedApartMm: apart, share: fit?.share ?? null, cover: fit?.cover ?? null, score: fit?.score ?? null });
    pairedBefore.add(previous.id);
  };
  const freeBefore = (rooms: readonly Room[]): Room[] => rooms.filter((room) => !pairedBefore.has(room.id));
  const freeAfter = (rooms: readonly Room[]): Room[] => rooms.filter((room) => !byAfter.has(room.id));
  const pairAll = (edges: readonly Edge[], reason: RoomMatchReason): void => {
    for (const edge of [...edges].sort(byRank)) {
      if (pairedBefore.has(edge.previous.id) || byAfter.has(edge.current.id)) continue;
      pair(edge.previous, edge.current, reason);
    }
  };

  const previousByStorey = byStorey(before, storeyOf);
  const currentByStorey = byStorey(after, storeyOf);
  const storeys = [...currentByStorey.keys()].sort(textOrder);
  const poolOf = (storey: string): { previous: Room[]; current: Room[] } => ({
    previous: freeBefore(previousByStorey.get(storey) ?? []),
    current: freeAfter(currentByStorey.get(storey) ?? []),
  });

  // 1. Its own number, then its label. A key naming exactly one room on each
  //    side pairs them; a key several rooms share names nothing on its own, so
  //    those rooms settle between themselves by position.
  for (const field of ["number", "name"] as const) {
    for (const storey of storeys) {
      const pool = poolOf(storey);
      const previousByKey = buckets(pool.previous, (room) => keyOf(room, field));
      for (const [key, currentRooms] of buckets(pool.current, (room) => keyOf(room, field))) {
        const previousRooms = freeBefore(previousByKey.get(key) ?? []);
        const currentFree = freeAfter(currentRooms);
        if (previousRooms.length === 0 || currentFree.length === 0) continue;
        const [previous] = previousRooms;
        const [current] = currentFree;
        // A name is a claim about identity, the floor is a claim about the place:
        // two rooms sharing no floor are not the same room whatever they are
        // called, and its fit is the evidence the pairing is reported with.
        if (previousRooms.length === 1 && currentFree.length === 1 && previous && current && !contradicts(previous, current) && evidenceOf(previous, current).fit !== null) {
          pair(previous, current, field);
          continue;
        }
        pairAll(seedEdges(previousRooms, currentFree, storeyOf), "seed");
        pairAll(fitEdges(previousRooms, currentFree, storeyOf), "fit");
      }
    }
  }

  // 2. Its seed, then 3. its fit: what position says once no words agree.
  for (const storey of storeys) {
    const pool = poolOf(storey);
    pairAll(seedEdges(pool.previous, pool.current, storeyOf), "seed");
    const afterSeed = poolOf(storey);
    pairAll(fitEdges(afterSeed.previous, afterSeed.current, storeyOf), "fit");
  }

  return {
    pairs: after.flatMap((room) => {
      const found = byAfter.get(room.id);
      return found === undefined ? [] : [found];
    }),
    added: after.filter((room) => !byAfter.has(room.id)).map((room) => room.id),
    removed: before.filter((room) => !pairedBefore.has(room.id)).map((room) => room.id),
  };
}

interface Evidence {
  readonly seedApartMm: number | null;
  readonly fit: FaceFit | null;
}

function byRank(a: Edge, b: Edge): number {
  return a.rank - b.rank || textOrder(a.current.id, b.current.id) || textOrder(a.previous.id, b.previous.id);
}

function byStorey(rooms: readonly Room[], storeyOf: (room: Room) => string): Map<string, Room[]> {
  const out = new Map<string, Room[]>();
  for (const room of rooms) {
    const storey = storeyOf(room);
    const had = out.get(storey);
    if (had === undefined) out.set(storey, [room]);
    else had.push(room);
  }
  return out;
}

/** Rooms grouped by a key of theirs, in the order they were given; an empty key groups nothing. */
function buckets(rooms: readonly Room[], keyOf: (room: Room) => string): Map<string, Room[]> {
  const out = new Map<string, Room[]>();
  for (const room of rooms) {
    const key = keyOf(room);
    if (key === "") continue;
    const had = out.get(key);
    if (had === undefined) out.set(key, [room]);
    else had.push(room);
  }
  return out;
}

/** The text a room's own number or label gives it, trimmed; empty when it states none. */
function keyOf(room: Room, field: "number" | "name"): string {
  return (field === "number" ? room.number : room.name).trim();
}

/**
 * Whether the room's *other* word refuses the pairing: two rooms that both
 * state a number and state different ones are two rooms, whatever their labels
 * say ("101 Office" is not "102 Office"). A room stating no number has nothing
 * to contradict.
 */
function contradicts(previous: Room, current: Room): boolean {
  const a = previous.number.trim();
  const b = current.number.trim();
  return a !== "" && b !== "" && a !== b;
}

/** Every pair within `SEED_MATCH_MM`, nearest first. */
function seedEdges(previous: readonly Room[], current: readonly Room[], storeyOf: (room: Room) => string): Edge[] {
  const edges: Edge[] = [];
  for (const room of current) {
    for (const candidate of previous) {
      if (storeyOf(candidate) !== storeyOf(room)) continue;
      const apart = seedApartMm(candidate, room);
      if (apart === null || apart > SEED_MATCH_MM) continue;
      edges.push({ previous: candidate, current: room, rank: apart });
    }
  }
  return edges;
}

/** How far apart two rooms' seeds are, mm; null when either states none. */
function seedApartMm(previous: Room, current: Room): number | null {
  const a = previous.labelSeed;
  const b = current.labelSeed;
  if (!a || !b) return null;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Every pair that fits well enough to be one room, best score first (`rank` is the negated score). */
function fitEdges(previous: readonly Room[], current: readonly Room[], storeyOf: (room: Room) => string): Edge[] {
  const boxes = new Map<ElementId, Box | null>();
  const boxOf = (room: Room): Box | null => {
    if (!boxes.has(room.id)) boxes.set(room.id, outlineBox(room.outline));
    return boxes.get(room.id) ?? null;
  };
  const edges: Edge[] = [];
  for (const room of current) {
    const box = boxOf(room);
    if (box === null) continue;
    for (const candidate of previous) {
      if (storeyOf(candidate) !== storeyOf(room)) continue;
      const other = boxOf(candidate);
      if (other === null || !boxesMeet(box, other)) continue;
      const fit = fitOf(candidate, room);
      if (fit === null || fit.score < FIT_MATCH_SCORE) continue;
      edges.push({ previous: candidate, current: room, rank: -fit.score });
    }
  }
  return edges;
}

/** How the new room sits in the earlier one, or null when they share no floor. */
function fitOf(previous: Room, current: Room): FaceFit | null {
  const fit = enclosingFits(ringOf(current.outline), [ringOf(previous.outline)], { minimumShare: 0, minimumCover: 0 })[0];
  return fit ?? null;
}

/** A room outline in the geometry package's tuple form. */
function ringOf(outline: readonly Vec2[]): Loop {
  return outline.map((point) => [point.x, point.y] as const);
}

interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function outlineBox(outline: readonly Vec2[]): Box | null {
  if (outline.length < 3) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of outline) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Whether two outlines could share any floor at all: a cheap refusal before the polygons are intersected. */
function boxesMeet(a: Box, b: Box): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}

function textOrder(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
