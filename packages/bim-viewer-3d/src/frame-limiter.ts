/**
 * The walkthrough's frame budget: how much of a frame a walker is allowed to
 * spend, and what a frame that overruns does to the person walking.
 *
 * Two jobs, both of which a naive `clock.getDelta()` gets wrong:
 *
 * - **The walker moves at most once per target frame.** A 144 Hz screen would
 *   otherwise run the same movement arithmetic two and a half times for every
 *   picture anyone can see. Frames that arrive early advance nothing, and the
 *   next one advances by the time that actually passed, so walking speed does
 *   not change with the refresh rate — only how often the work is done.
 * - **A frame that overruns is cut short, not believed.** A hitch of half a
 *   second (a model reloading, a tab coming back) would otherwise ask for a
 *   2 m step, and 2 m is further than a doorway is wide. The step is clamped to
 *   `MAX_STEP_S`; the walker loses that time rather than teleporting through a
 *   wall. The collider splits a long move as well (`moveBody`'s `stride`), so
 *   this is the second of two guards, not the only one.
 *
 * Nothing here renders: it decides, it does not draw.
 */

/** The frame time the walkthrough aims at: 60 frames a second, 16.7 ms. */
export const TARGET_FRAME_MS = 1000 / 60;

/**
 * The longest stretch of time one frame may advance a walker, seconds. At
 * walking pace (1.4 m/s) that is 7 cm — well under a wall's thickness, so a
 * clamped frame can never carry somebody through one.
 */
export const MAX_STEP_S = 0.05;

/** What one frame asked the walker to do. */
export interface FrameStep {
  /** Seconds to advance by. 0 when this frame advanced nothing. */
  readonly dt: number;
  /** True when the frame came too soon after the last one, so nothing moved. */
  readonly skipped: boolean;
  /** True when the frame overran the budget and the step was cut short to `MAX_STEP_S`. */
  readonly overran: boolean;
}

const NOTHING: FrameStep = { dt: 0, skipped: true, overran: false };

/**
 * How far under the target a frame may still count as "the target", milliseconds.
 * A display running at exactly the target rate reports a frame time a few
 * millionths of a millisecond under it, and without this slack a 60 Hz screen
 * would skip every other frame and walk at half speed.
 */
const FRAME_TOLERANCE_MS = 0.5;

/**
 * Hands out the step for each frame, at most one per `targetMs`, and never
 * more than `MAX_STEP_S` of movement. Time is injected (`nowMs`), so the
 * behaviour on an overrun is a test rather than a stopwatch.
 */
export class FrameLimiter {
  /** When the walker last advanced. The first frame only starts the clock. */
  private last: number | null = null;
  /** How many frames this limiter has skipped and how many it cut short (for a HUD and for tests). */
  private skipped = 0;
  private overruns = 0;

  constructor(private readonly targetMs: number = TARGET_FRAME_MS) {}

  step(nowMs: number): FrameStep {
    if (this.last === null) {
      // No step on the first frame: the time before walkthrough started is not walking time.
      this.last = nowMs;
      this.skipped++;
      return NOTHING;
    }
    const elapsedMs = nowMs - this.last;
    if (elapsedMs < this.targetMs - FRAME_TOLERANCE_MS) {
      // Too soon: nothing moves, and `last` stays where it was so the next frame gets the whole elapsed time.
      this.skipped++;
      return NOTHING;
    }
    this.last = nowMs;
    const elapsedS = elapsedMs / 1000;
    const overran = elapsedS > MAX_STEP_S;
    if (overran) this.overruns++;
    return { dt: overran ? MAX_STEP_S : elapsedS, skipped: false, overran };
  }

  /** Start the clock again (entering walkthrough, or coming back to a tab). */
  reset(nowMs?: number): void {
    this.last = nowMs ?? null;
  }

  /** Frames skipped, frames whose step was cut short. */
  counts(): { readonly skipped: number; readonly overruns: number } {
    return { skipped: this.skipped, overruns: this.overruns };
  }
}
