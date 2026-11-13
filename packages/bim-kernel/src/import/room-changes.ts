import type { ElementId, Room } from "../types";
import { matchRooms, type RoomMatchOptions, type RoomMatchReason } from "./room-identity";

/**
 * What two imports of one linked model say about the same rooms: the room-level
 * change set a person reads, as data.
 *
 * The deliverable is the sentence a firm actually wants — *"Room 101: 18.4 m² →
 * 17.9 m²"* — and every other sentence of the same kind beside it: a room the
 * revision added, a room it dropped, a label that moved, a ceiling height that
 * did. Nothing here is prose: a caller renders it in whatever words and
 * language it likes, and a schedule or a script reads the numbers straight
 * out.
 *
 * The pairing is the import's own (`import/room-identity.ts`): the same pass,
 * the same order and the same thresholds, so the change set a person compares
 * is the pairing the next import will record rather than a second opinion that
 * may disagree with it.
 *
 * `before` is the earlier import's rooms and `after` this one's, in whatever
 * order the caller holds them; pairs and additions come back in `after`'s
 * order and removals in `before`'s, so the same two lists always produce the
 * same answer.
 */

/** One room as a comparison sees it: the words, the area and the height, nothing positional. */
export interface RoomSnapshot {
  readonly id: ElementId;
  /** The file's `Name` ("101"), or the id it had none but this. */
  readonly number: string;
  /** The label a person reads ("Office"). */
  readonly name: string;
  /** Plan area, m², less holes, as the import measured it. */
  readonly areaSqM: number;
  /** Floor to ceiling, mm; null when the file states none. */
  readonly ceilingHeightMm: number | null;
}

/** One field that differs between a room and the room it continues. */
export type RoomFieldChange =
  | { readonly field: "number"; readonly before: string; readonly after: string }
  | { readonly field: "name"; readonly before: string; readonly after: string }
  | { readonly field: "areaSqM"; readonly before: number; readonly after: number; readonly deltaSqM: number }
  | { readonly field: "ceilingHeightMm"; readonly before: number | null; readonly after: number | null; readonly deltaMm: number | null };

/** One room through both revisions: the pairing, both snapshots, and what moved between them. */
export interface RoomChange {
  /** The room as the earlier import left it, which is the record a person has been reading. */
  readonly previous: RoomSnapshot;
  /** The room this import made for it. */
  readonly current: RoomSnapshot;
  /** The signal that said these are one room. */
  readonly reason: RoomMatchReason;
  /** What differs, area first and then the words, then the height; empty when nothing did. */
  readonly changes: readonly RoomFieldChange[];
}

/** All of a revision's rooms against another's, exactly as measured. */
export interface RoomChangeSet {
  /** Every pair, changed or not, in this import's room order. */
  readonly pairs: readonly RoomChange[];
  /** Rooms this import made that continue nothing. */
  readonly added: readonly RoomSnapshot[];
  /** Rooms the earlier import had that this one paired with nothing. */
  readonly removed: readonly RoomSnapshot[];
  /** How many pairs differ in nothing at all. */
  readonly unchanged: number;
}

/** The rooms of one import, as a snapshot: what a comparison reads. */
export function roomSnapshot(room: Room): RoomSnapshot {
  return { id: room.id, number: room.number, name: room.name, areaSqM: room.areaSqM, ceilingHeightMm: room.ceilingHeightMm ?? null };
}

/** Every room-level change between two imports of one linked model. */
export function roomChanges(before: readonly Room[], after: readonly Room[], options: RoomMatchOptions = {}): RoomChangeSet {
  const match = matchRooms(before, after, options);
  const previousById = new Map(before.map((room) => [room.id, room]));
  const currentById = new Map(after.map((room) => [room.id, room]));
  const pairs: RoomChange[] = [];
  let unchanged = 0;
  for (const pairing of match.pairs) {
    const previous = previousById.get(pairing.previousId);
    const current = currentById.get(pairing.id);
    if (!previous || !current) continue;
    const changes = changesBetween(previous, current);
    if (changes.length === 0) unchanged += 1;
    pairs.push({ previous: roomSnapshot(previous), current: roomSnapshot(current), reason: pairing.reason, changes });
  }
  return {
    pairs,
    added: match.added.flatMap((id) => {
      const room = currentById.get(id);
      return room === undefined ? [] : [roomSnapshot(room)];
    }),
    removed: match.removed.flatMap((id) => {
      const room = previousById.get(id);
      return room === undefined ? [] : [roomSnapshot(room)];
    }),
    unchanged,
  };
}

/**
 * What differs between one room and the room it continues.
 *
 * An area is compared at the hundredth of a square metre the import stores it
 * to, so a change smaller than that is no change: the file gives whole
 * millimetres and the record gives two decimals, and reporting a 0.004 m²
 * "change" would be reporting rounding. A height compares in whole millimetres
 * for the same reason. A height that one revision states and the other does not
 * is a change with no delta — the number was learned or lost, not moved.
 */
export function changesBetween(previous: Room, current: Room): RoomFieldChange[] {
  const out: RoomFieldChange[] = [];
  const areaDelta = round2(current.areaSqM - previous.areaSqM);
  if (areaDelta !== 0) out.push({ field: "areaSqM", before: previous.areaSqM, after: current.areaSqM, deltaSqM: areaDelta });
  if (previous.number !== current.number) out.push({ field: "number", before: previous.number, after: current.number });
  if (previous.name !== current.name) out.push({ field: "name", before: previous.name, after: current.name });
  const heightBefore = previous.ceilingHeightMm ?? null;
  const heightAfter = current.ceilingHeightMm ?? null;
  if (heightBefore !== heightAfter) {
    out.push({ field: "ceilingHeightMm", before: heightBefore, after: heightAfter, deltaMm: heightBefore === null || heightAfter === null ? null : round1(heightAfter - heightBefore) });
  }
  return out;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
