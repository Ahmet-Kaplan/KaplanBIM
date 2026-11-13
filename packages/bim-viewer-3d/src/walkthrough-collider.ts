/**
 * The collider world a walkthrough walks in, built from the solids the viewer
 * draws — never from a second reading of the model. What you see is what you
 * bump into, which is the only way the two cannot come apart.
 *
 * **Built lazily, one storey at a time.** The budget is a 250,000-element model
 * (`docs/PERFORMANCE.md`): a collider world for all of it at once is a stall
 * nobody would forgive, and a walker needs exactly one storey. So the solids are
 * grouped by partition the moment the model lands (an index, not a build), and a
 * storey's boxes are made the first time somebody walks into it. A model you
 * never enter walkthrough in never pays for this at all.
 *
 * **Partition means storey here.** Every element carries a `{ level, zone,
 * discipline }` partition and the index below is keyed by the whole of it, but
 * what a person collides with is decided by the storey: a duct on the level
 * above is 4 m up, and a zone boundary is not a wall. Keying by storey alone
 * would drop a model that keeps two zones' work at different heights, so the key
 * is the whole partition and the walker asks for the ones on its storey.
 */
import { buildColliderWorld, boxesOfTriangles, type ColliderBox, type ColliderWorld } from "@permitzip/bim-geometry";
import type { RenderGroup, Solid } from "./native-geometry";

/**
 * Groups a person can stand on. A slab's top is a floor; a wall's top is not,
 * and a duct's lid is not. `filler`, `glazing` and `structure` are all things
 * you walk into, not on — except a stair, whose treads are the surface you climb
 * (see `Solid.steps`).
 */
const WALKABLE_GROUPS: ReadonlySet<RenderGroup> = new Set<RenderGroup>(["slab"]);

/**
 * Groups that are drawn but not there to bump into: the see-through wrapper
 * round insulated duct (the metal inside it already collides) and a mounting
 * plane (a zero-thickness surface on a wall's face).
 */
const PASSABLE_GROUPS: ReadonlySet<RenderGroup> = new Set<RenderGroup>(["insulation", "mounting_plane"]);

/**
 * The collider boxes of one render solid. A box is one box; a cylinder is a box
 * round it (its diameter both ways); a mesh — a wall cut round its doors, an
 * L-shaped slab, a sheet-metal fitting — is one box per triangle, so a doorway
 * stays a doorway (`boxesOfTriangles`).
 *
 * The fall (a drain's slope, `pitch`) is dropped: it tips a box by a few
 * degrees at most, which changes nothing a shoulder can feel, and dropping it
 * keeps the overlap test the two subtractions in a box's own frame that make
 * this cheap enough to run per frame.
 *
 * **A stair's treads are floors.** A body that climbs in steps (`Solid.steps`)
 * is one prism per tread, so its up-facing caps are one per tread as well, and a
 * cap is a flat triangle: a zero-height box whose top is exactly where a person
 * puts their foot. Marked walkable, `WALK_STEP_HEIGHT_M` climbs them one at a
 * time; left unmarked, every tread is the lid of a solid block and the flight is
 * a wall. The risers stay solid, which is why walking into the side of a stair
 * still stops you.
 */
export function colliderBoxesOf(solid: Solid): ColliderBox[] {
  if (PASSABLE_GROUPS.has(solid.group)) return [];
  const floor = WALKABLE_GROUPS.has(solid.group) || solid.steps === true;
  const tag = solid.elementId;
  if (solid.shape === "mesh") {
    if (!solid.mesh) return [];
    return boxesOfTriangles(solid.mesh.positions, solid.mesh.indices, {
      center: solid.center,
      yaw: solid.yaw,
      floor,
      tag,
    });
  }
  const [length, height, depth] = solid.size;
  const upright = solid.shape === "cylinder" && solid.vertical === true;
  const halfX = upright ? height / 2 : length / 2;
  const halfY = upright ? length / 2 : height / 2;
  const halfZ = upright ? height / 2 : depth / 2;
  if (!(halfX > 0) || !(halfY > 0) || !(halfZ > 0)) return [];
  return [
    {
      center: solid.center,
      half: [halfX, halfY, halfZ],
      // A riser's own axis is up, so turning it about the up axis changes nothing.
      yaw: upright ? 0 : solid.yaw,
      ...(floor ? { floor: true } : {}),
      tag,
    },
  ];
}

/** The collider boxes of a whole set of solids, in the order they are given. */
export function colliderBoxesOfAll(solids: readonly Solid[]): ColliderBox[] {
  const out: ColliderBox[] = [];
  for (const solid of solids) out.push(...colliderBoxesOf(solid));
  return out;
}

/**
 * Collider worlds by partition, built on first use and kept for a few
 * partitions so stepping between two of them does not rebuild.
 *
 * `source` is asked for the solids of a partition and must not itself be
 * expensive: the viewer hands back a slice of an index it already grouped.
 */
export class PartitionColliders {
  /** How many partitions' worlds stay built at once. */
  static readonly MAX_BUILT = 4;
  private readonly built = new Map<string, ColliderWorld>();

  constructor(private readonly source: (partition: string) => readonly Solid[]) {}

  /** The world for a partition, built now if it was not built before. Null when there is nothing to collide with. */
  world(partition: string): ColliderWorld | null {
    const had = this.built.get(partition);
    if (had) {
      // Re-inserting marks it as the most recently used, which is what the cap below evicts last.
      this.built.delete(partition);
      this.built.set(partition, had);
      return had.boxCount > 0 ? had : null;
    }
    const world = buildColliderWorld(colliderBoxesOfAll(this.source(partition)));
    this.built.set(partition, world);
    while (this.built.size > PartitionColliders.MAX_BUILT) {
      const oldest = this.built.keys().next();
      if (oldest.done === true) break;
      this.built.delete(oldest.value);
    }
    return world.boxCount > 0 ? world : null;
  }

  /** The partitions whose world is built, least recently used first. */
  partitions(): string[] {
    return [...this.built.keys()];
  }

  /** How many boxes are held, across every built partition. */
  boxCount(): number {
    let total = 0;
    for (const world of this.built.values()) total += world.boxCount;
    return total;
  }

  /** Throw every built world away: the model changed shape. */
  clear(): void {
    this.built.clear();
  }
}
