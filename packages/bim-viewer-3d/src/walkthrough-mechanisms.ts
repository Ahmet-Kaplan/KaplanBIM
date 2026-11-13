/**
 * Which doors in the model are open, for the length of this walkthrough.
 *
 * **A door is a session fact, not a model fact.** A model says a door exists, its
 * class, its leaf and its host wall; it does not say that somebody just opened
 * it, and writing that into the model would make an open door a change everyone
 * has to commit, undo and conflict over. So this holds the set in memory, the
 * walker asks it on every step, and closing the walkthrough forgets it.
 *
 * **Only a door may be toggled.** The id has to name an element the caller
 * established is a door — a wall does not open, and a set that could name any
 * element would be a way to walk through walls. The caller passes the door ids
 * it found in the model; anything not in that set is refused rather than
 * remembered.
 *
 * Nothing here is per-frame: `isOpen` is one set lookup, which is why a walk over
 * a thousand doors costs what a walk over none does.
 */
export class OpenDoors {
  private readonly doors: ReadonlySet<string>;
  private readonly open = new Set<string>();

  /** @param doorIds the element ids in this model that are doors and may be opened. */
  constructor(doorIds: Iterable<string>) {
    this.doors = new Set(doorIds);
  }

  /** Whether the model has a door with this id, open or shut. */
  has(id: string): boolean {
    return this.doors.has(id);
  }

  /** Whether the door with this id is open. An unknown id is not open, and never throws. */
  isOpen(id: string): boolean {
    return this.open.has(id);
  }

  /** Opens or closes a door. Returns whether the id was a door at all. */
  set(id: string, open: boolean): boolean {
    if (!this.doors.has(id)) return false;
    if (open) this.open.add(id);
    else this.open.delete(id);
    return true;
  }

  /** The other way it was: the whole point of walking through a door. */
  toggle(id: string): boolean {
    if (!this.doors.has(id)) return false;
    this.set(id, !this.isOpen(id));
    return true;
  }

  /** Every door currently open, for a caller that wants to say so or to reset. */
  openIds(): readonly string[] {
    return [...this.open];
  }

  /** Shuts every door. Called when the walkthrough ends, so a second visit starts as the model is. */
  shutAll(): void {
    this.open.clear();
  }

  /**
   * The predicate `moveBody` wants: an open door's boxes are not in the way.
   *
   * A box with no tag is never passable — geometry that cannot say which element
   * it came from has no business disappearing, and a door's leaves always carry
   * the door's own id.
   */
  readonly passable = (box: { readonly tag?: string }): boolean => box.tag !== undefined && this.open.has(box.tag);
}
