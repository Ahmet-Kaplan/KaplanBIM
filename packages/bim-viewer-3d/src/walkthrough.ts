/**
 * Walking the model: a person, human-paced, with gravity, a floor and walls
 * that stop them.
 *
 * The arithmetic lives here rather than in the render loop so it can be tested
 * without a browser: `Walker` holds where the feet are, which way the head is
 * turned and which keys are down, and `advance(dt)` moves it. What it does not
 * hold is a camera, a canvas or a keyboard — `WalkthroughInput` wires those, and
 * `ModelViewer3D` draws the result.
 *
 * The numbers are human on purpose, and named so they can be argued with:
 * an eye at 1.62 m, a 1.8 m body 0.44 m across, a relaxed 1.4 m/s walk, and a
 * 0.25 m step that is climbed rather than collided with.
 */
import { floorUnder, moveBody, type ColliderWorld } from "@permitzip/bim-geometry";

/** Eye height above the floor, metres: the mean for a standing adult, so the model reads at its real size. */
export const WALK_EYE_HEIGHT_M = 1.62;

/** Top of the colliding body, metres. Above this nothing can hit the walker (a duct at 2.2 m clears a 1.8 m head). */
export const WALK_BODY_HEIGHT_M = 1.8;

/** Plan radius of a person, metres: 0.44 m across, shoulders and a swinging arm. */
export const WALK_BODY_RADIUS_M = 0.22;

/**
 * A step this high is walked over rather than into, metres — and the same
 * clearance is left between the feet and the bottom of the colliding band, so
 * the slab you stand on is never a wall.
 */
export const WALK_STEP_HEIGHT_M = 0.25;

/** A relaxed walking pace, metres per second: a corridor walk, not a march. */
export const WALK_SPEED_MPS = 1.4;

export const WALK_GRAVITY_MPS2 = 9.81;

/** Radians of turn per pixel of pointer movement: about half a turn per 700 px, which is a comfortable drag. */
export const WALK_LOOK_RAD_PER_PX = 0.0022;

/** Where looking stops short of straight up or down, radians, so the view never turns over. */
export const WALK_PITCH_LIMIT_RAD = Math.PI / 2 - 0.05;

/**
 * How far above the storey floor a surface may be and still count as the same
 * storey, metres. A slab, a floor finish and a raised threshold are inside it;
 * the storey above (4.2 m) and the one below are not, which is what keeps a
 * walker on the storey they entered.
 */
export const WALK_STOREY_BAND_M = 0.6;

/** The four directions a walker can hold. Looking is separate: it has no keys. */
export type WalkKey = "forward" | "back" | "left" | "right";

/** Where a walker stands, and what is solid there. */
export interface WalkScene {
  readonly collider: ColliderWorld;
  /** The elevation to stand on where no slab is under you: the storey's floor, metres. */
  readonly groundY: number;
  /**
   * The boxes a step ignores — an open door's leaves (`OpenDoors.passable`).
   *
   * Absent means nothing is passable, which is the right default: a walker that
   * silently walked through a door because no set was supplied would be a bug
   * nobody reports, because it looks like the door working.
   */
  readonly passable?: (box: { readonly tag?: string }) => boolean;
}

export interface WalkerStart {
  readonly x: number;
  readonly z: number;
  /** Which way the walker faces, radians about the up axis (0 looks along -Z, the scene's "north"). */
  readonly yaw: number;
  /** Height of the eye when walkthrough starts, metres: the floor is taken from this. */
  readonly eyeY: number;
}

export interface WalkerState {
  /** Middle of the body, metres. */
  readonly x: number;
  readonly z: number;
  /** The feet, metres. */
  readonly feetY: number;
  /** Where the camera goes, metres. */
  readonly eyeY: number;
  readonly yaw: number;
  readonly pitch: number;
  /** True when the walker is resting on a surface rather than falling through the air. */
  readonly onFloor: boolean;
  /** True when the last step was stopped by a solid. */
  readonly blocked: boolean;
}

/**
 * Where a person is in the model, and how they move. No DOM, no three.js: the
 * caller feeds it pointer movement, key presses and a frame's worth of time.
 */
export class Walker {
  private x: number;
  private z: number;
  private feetY: number;
  private yawRad: number;
  private pitchRad = 0;
  private falling = 0;
  private exited = false;
  private onFloor = true;
  private blocked = false;
  private scene: WalkScene | null = null;
  private readonly held = new Set<WalkKey>();

  constructor(start: WalkerStart) {
    this.x = start.x;
    this.z = start.z;
    this.yawRad = start.yaw;
    this.feetY = start.eyeY - WALK_EYE_HEIGHT_M;
  }

  /** Take the collider world of the storey the walker is on, and put the feet on its floor. */
  setScene(scene: WalkScene): void {
    this.scene = scene;
    this.feetY = this.surfaceAt(this.x, this.z, scene, this.feetY);
    this.falling = 0;
    this.onFloor = true;
  }

  /**
   * Hand the walker another storey's world mid-walk, feet and all — what a stair
   * does when it reaches the floor above (`walkthrough-stairs.ts` decides when).
   *
   * Unlike `setScene`, which drops the feet onto the floor of the storey being
   * entered, this only ever steps **up**: the feet stay where they are unless the
   * new world's floor is within a step above them, which is the last riser of a
   * flight onto its landing. Anything lower is left to gravity — a walker who
   * teleported down the stairwell because the storey changed under them would be
   * the worst kind of bug, because it looks like the storey working.
   */
  changeScene(scene: WalkScene): void {
    this.scene = scene;
    const surface = this.surfaceAt(this.x, this.z, scene, this.feetY);
    if (surface > this.feetY) {
      this.feetY = surface;
      this.falling = 0;
      this.onFloor = true;
    }
  }

  /** Turn: pixels of pointer movement, right and down positive. */
  look(dxPixels: number, dyPixels: number): void {
    this.yawRad -= dxPixels * WALK_LOOK_RAD_PER_PX;
    this.pitchRad -= dyPixels * WALK_LOOK_RAD_PER_PX;
    if (this.pitchRad > WALK_PITCH_LIMIT_RAD) this.pitchRad = WALK_PITCH_LIMIT_RAD;
    if (this.pitchRad < -WALK_PITCH_LIMIT_RAD) this.pitchRad = -WALK_PITCH_LIMIT_RAD;
  }

  hold(key: WalkKey, down: boolean): void {
    if (down) this.held.add(key);
    else this.held.delete(key);
  }

  /** Let go of everything: leaving walkthrough must not leave a key stuck down. */
  releaseAll(): void {
    this.held.clear();
  }

  /**
   * Advance one frame: walk — stepping up onto anything a step high that is in
   * the way, which is how a stair is climbed — then fall onto whatever is under
   * the new place. `dt` is seconds, already clamped by the frame limiter.
   */
  advance(dt: number): void {
    if (this.exited || dt <= 0) return;
    const scene = this.scene;
    if (!scene) return;
    const forward = (this.held.has("forward") ? 1 : 0) - (this.held.has("back") ? 1 : 0);
    const strafe = (this.held.has("right") ? 1 : 0) - (this.held.has("left") ? 1 : 0);
    if (forward !== 0 || strafe !== 0) {
      const sin = Math.sin(this.yawRad);
      const cos = Math.cos(this.yawRad);
      // A camera with no pitch looks along -Z; turning it by the yaw takes forward to (-sin, -cos) and right to (cos, -sin).
      const dirX = -sin * forward + cos * strafe;
      const dirZ = -cos * forward - sin * strafe;
      const length = Math.hypot(dirX, dirZ);
      const reach = WALK_SPEED_MPS * dt;
      const stepX = (dirX / length) * reach;
      const stepZ = (dirZ / length) * reach;
      let moved = this.move(scene, stepX, stepZ);
      if (moved.blocked) {
        // A step in the way is climbed, not walked into: lift the feet onto it and
        // try the same step again. This is what a stair is (`floorAhead`).
        const ahead = this.floorAhead(scene, dirX / length, dirZ / length);
        if (ahead !== null && ahead > this.feetY) {
          this.feetY = ahead;
          this.falling = 0;
          this.onFloor = true;
          moved = this.move(scene, stepX, stepZ);
        }
      }
      this.x = moved.x;
      this.z = moved.z;
      this.blocked = moved.blocked;
    } else {
      this.blocked = false;
    }
    // Gravity, then the floor: a slab top if there is one on this storey, else the storey's own floor.
    this.falling -= WALK_GRAVITY_MPS2 * dt;
    this.feetY += this.falling * dt;
    const surface = this.surfaceAt(this.x, this.z, scene, this.feetY);
    if (this.feetY <= surface) {
      this.feetY = surface;
      this.falling = 0;
      this.onFloor = true;
    } else {
      this.onFloor = false;
    }
  }

  /** One step of the walk through the scene's collider: where it lands, and whether a solid stopped it. */
  private move(scene: WalkScene, dx: number, dz: number): { readonly x: number; readonly z: number; readonly blocked: boolean } {
    return moveBody(
      scene.collider,
      { x: this.x, z: this.z, radius: WALK_BODY_RADIUS_M, minY: this.feetY + WALK_STEP_HEIGHT_M, maxY: this.feetY + WALK_BODY_HEIGHT_M },
      dx,
      dz,
      // An open door's leaves are not in the way; a closed one's are. The set
      // lives in the session (`OpenDoors`), so this module still remembers
      // nothing about a building.
      scene.passable ? { passable: scene.passable } : {},
    );
  }

  /**
   * The surface one body radius on along the way the walker is going, when it is
   * above the feet and within a step; null when there is nothing to step onto.
   *
   * A stair is climbed this way. Its treads arrive as one body of upright prisms,
   * so the riser of a tread two steps up reaches down to the storey floor and is
   * a face inside the colliding band: a walker standing on the tread before it is
   * stopped there. A person is not stopped — they put a foot up — so this does
   * too, once, and only after a move was actually blocked.
   */
  private floorAhead(scene: WalkScene, dirX: number, dirZ: number): number | null {
    return this.floorAt(this.x + dirX * WALK_BODY_RADIUS_M, this.z + dirZ * WALK_BODY_RADIUS_M, scene, this.feetY);
  }

  /** The highest surface at (x, z) no more than a step above the feet, or null when there is none on this storey. */
  private floorAt(x: number, z: number, scene: WalkScene, feetY: number): number | null {
    const hit = floorUnder(scene.collider, x, z, {
      belowY: feetY + WALK_STEP_HEIGHT_M,
      minY: scene.groundY - WALK_STOREY_BAND_M,
      radius: WALK_BODY_RADIUS_M * 0.5,
    });
    return hit ? hit.y : null;
  }

  /** Where the feet rest at (x, z): the highest walkable surface on this storey, else the storey floor. */
  private surfaceAt(x: number, z: number, scene: WalkScene, feetY: number): number {
    const hit = this.floorAt(x, z, scene, feetY);
    return hit === null ? scene.groundY : hit;
  }

  /** Stop the walker moving: a disposed viewer keeps no half-walking ghost. */
  stop(): void {
    this.exited = true;
    this.held.clear();
  }

  /** Where the camera goes: the feet plus the eye height. */
  eye(): { readonly x: number; readonly y: number; readonly z: number } {
    return { x: this.x, y: this.feetY + WALK_EYE_HEIGHT_M, z: this.z };
  }

  yaw(): number {
    return this.yawRad;
  }

  pitch(): number {
    return this.pitchRad;
  }

  state(): WalkerState {
    return {
      x: this.x,
      z: this.z,
      feetY: this.feetY,
      eyeY: this.feetY + WALK_EYE_HEIGHT_M,
      yaw: this.yawRad,
      pitch: this.pitchRad,
      onFloor: this.onFloor,
      blocked: this.blocked,
    };
  }
}
