/**
 * Temporal anti-aliasing: every frame is drawn through a slightly different
 * sub-pixel offset, and the frames are averaged, so an edge that would land
 * between two pixels lands on both of them over eight frames instead.
 *
 * It exists because of what the pipeline does to the frame. The renderer is
 * built with `antialias: true`, but hardware MSAA smooths the DEFAULT
 * framebuffer, and a post-processing chain draws into a render target instead.
 * The moment ambient occlusion turned on, edges got worse than they were
 * before it — this pass is what replaces the smoothing the composer took away.
 *
 * The averaging is where a temporal filter usually goes wrong. Last frame's
 * image is only a valid sample of THIS frame if the camera has not moved; an
 * average taken across a moving camera is a smear, which is exactly the failure
 * this file is written to avoid (Review Focus 2 of the plan). So the weight
 * given to history falls as the camera moves — see `blendForMotion`,
 * `TAA_MOTION_BLEND` and `TAA_RESET_MOTION` — and a still frame is the only
 * frame that gets the full blend.
 *
 * This is not a TRAA: there is no reprojection and no velocity buffer, so the
 * history sample is taken at the same pixel it was written to, and a camera
 * that moves does not move the sample with it. Reprojection needs a per-pixel
 * motion vector pass — a second geometry render plus a float buffer — and this
 * viewer's budget does not have it. Instead of pretending, the blend steps
 * aside: the picture stays sharp while you orbit and accumulates only when you
 * stop, which is when the anti-aliasing is actually visible.
 *
 * It is shading, not palette: the pass averages the linear image and picks no
 * colour, so the theme has nothing to say about it.
 *
 * What it costs, stated rather than measured: two full-resolution render targets
 * (a ping-pong pair, because a draw cannot sample the texture it is writing) at
 * 8 bytes a pixel — 16.59 MB each and 33.18 MB together on a 1920x1080 canvas —
 * and two full-screen quads a frame. The frame time that adds is NOT measured:
 * the browser perf suite does not run in this environment, so nothing here
 * claims a millisecond figure. It is opt-in for that reason, and so is AO: a
 * change to either cannot silently cost the default path anything.
 */
import * as THREE from "three";
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader.js";

/**
 * Offsets in the jitter cycle. Eight samples of a Halton (2,3) sequence: enough
 * that the residual staircase on a near-horizontal edge is under the noise a
 * tone-mapped image already has, and few enough that one whole cycle still fits
 * inside the accumulation window (see `TAA_BLEND`), so every offset is
 * represented in the picture rather than half of them being averaged away
 * before they arrive. Sixteen would smooth further but takes twice as long to
 * settle after the camera stops, and a wheel that quietly takes longer to look
 * right reads as the viewer being slow.
 */
export const TAA_JITTER_SAMPLES = 8;

/**
 * The weight the PREVIOUS frame's image carries when the camera is still. 1
 * would be a frozen image that never updates; 0 is this frame alone, which is
 * no anti-aliasing at all.
 *
 * 0.9 is an exponential window of 1/(1-0.9) = 10 frames. That is just over one
 * 8-sample jitter cycle, so the history holds every offset at least once — the
 * point of the pass — without holding so much that a wall the user just moved
 * keeps a ghost of where it was. At 0.95 (20 frames) an edited wall trails
 * behind the cursor for a third of a second; at 0.75 (4 frames) half the jitter
 * cycle is missing and the sequence itself becomes visible as a faint shimmer.
 */
export const TAA_BLEND = 0.9;

/**
 * The weight the previous frame's image carries while the camera is MOVING.
 *
 * This is Review Focus 2 in one number. Nothing here knows where the old image
 * belongs now, so while the camera moves the old image is wrong by however far
 * the frame shifted, and any weight above "almost none" draws that as a trail.
 * 0.1 is a window of 1.1 frames: the history contributes one frame of edge
 * quality — the two jitter offsets around the edge still average — and a 10%
 * ghost of something one frame stale, which at 60 fps is behind the motion
 * rather than on top of it.
 *
 * Not 0, because a frame drawn at a single jitter offset is *worse* than an
 * unjittered one: the whole image would sit half a pixel off centre and crawl
 * as the offset advances. Not 0.25 or more, because a quarter-weight history
 * against an unreprojected moving frame is a four-frame trail, and a trail is
 * the thing this task exists to prevent.
 */
export const TAA_MOTION_BLEND = 0.1;

/**
 * The view change, per frame, below which the camera counts as STOPPED — in the
 * motion units `viewMotion` returns, where 1 is one
 * `TAA_MOTION_RAD_PER_FRAME` of turn and already fully moving.
 *
 * 0.05 is under a pixel a frame on a 1080p canvas with the viewer's 45° lens:
 * under 0.0005 rad of rotation, or 2.5 mm of travel. That is the drift of an
 * orbit that is settling under damping, not a hand on the mouse. Anything
 * larger is movement, and movement is not allowed the full blend.
 */
export const TAA_MOTION_STOPPED = 0.05;

/**
 * How many consecutive still frames before the full blend returns.
 *
 * Six, for two reasons that point the same way. First, a mouse drag is not a
 * smooth signal: events arrive in bursts and a drag can have a frame or two
 * where the camera does not move, so a blend that jumped back to 0.9 on the
 * first still frame would smear the drag that resumes on the next one. Second,
 * six frames at the moving blend leave 0.1^6 = one millionth of the picture
 * that was there before the stop, so by the time the history is trusted again
 * none of the pre-stop image is left in it — the accumulated frames are all
 * frames the camera was still for.
 *
 * Shorter than the jitter cycle (8) on purpose: waiting a whole cycle would
 * mean the anti-aliasing arrives a beat after the user lets go.
 */
export const TAA_SETTLE_FRAMES = 6;

/**
 * The view change at which this frame is a different place rather than a
 * movement, so the history is thrown away entirely (blend 0).
 *
 * Motion units, so 8 is eight times the smallest movement the blend reacts to:
 * about 4.6° of turn or 40 cm of travel in a single frame. No hand does that at
 * 60 fps — but `setCamera3d`, a storey switch, a plan-to-3D transition and a
 * walkthrough reset all do, and blending even a tenth of the previous storey
 * into the new view leaves a visible ghost of geometry that is not in front of
 * the camera any more. Discarding costs one frame of pure aliasing, which is
 * the cheapest of the available mistakes.
 */
export const TAA_RESET_MOTION = 8;

/**
 * The rotation, in radians per frame, that counts as one motion unit: 0.01 rad
 * is 0.6° a frame, which at 60 fps is a 34°/second orbit — the slow end of a
 * deliberate drag, and already 14 pixels of travel at the edge of a 1080p frame
 * with the viewer's lens. So "fully moving" is reached by a slow, careful
 * movement, not by a flick: the blend steps aside as soon as the picture is
 * genuinely changing.
 */
export const TAA_MOTION_RAD_PER_FRAME = 0.01;

/**
 * The travel, in metres per frame, that counts as one motion unit: 5 cm a frame
 * is 3 m/s at 60 fps, which is a walking pace and a fast pan.
 *
 * Travel is judged without knowing how far away the subject is, because nothing
 * in a pass that runs after the depth buffer knows it either. Reading it against
 * a near subject is the conservative choice: it makes the blend step aside
 * sooner, and a sharp moving frame is never worse than a smeared one.
 */
export const TAA_MOTION_M_PER_FRAME = 0.05;

/** A sub-pixel offset in PIXELS, in [-0.5, 0.5]. */
export interface TaaJitter {
  readonly x: number;
  readonly y: number;
}

export interface TaaPassSize {
  readonly width: number;
  readonly height: number;
}

/** A camera's place, as the motion metric needs it. */
export interface CameraPose {
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
}

/** A camera's projection, before it was jittered, so it can be put back exactly. */
export interface ProjectionSnapshot {
  readonly matrix: THREE.Matrix4;
  readonly inverse: THREE.Matrix4;
}

// ------------------------------------------------------------------ the jitter

/** The `index`-th term of the Halton sequence in `base`, on (0, 1). */
function halton(index: number, base: number): number {
  let fraction = 1;
  let result = 0;
  let remaining = index;
  while (remaining > 0) {
    fraction /= base;
    result += fraction * (remaining % base);
    remaining = Math.floor(remaining / base);
  }
  return result;
}

/**
 * The sub-pixel offset for one frame, in PIXELS, cycling through
 * `TAA_JITTER_SAMPLES` offsets and then repeating.
 *
 * Halton(2,3) because it is deterministic (the same frame number always gives
 * the same offset, so a test and a recorded frame agree), it is cheap, and its
 * two bases are coprime so the offsets never fall on a diagonal: a jitter that
 * moved along one line would anti-alias one edge direction and leave the
 * perpendicular ones exactly as they were.
 */
export function jitterForFrame(frame: number): TaaJitter {
  // Negative or non-integer frame numbers cannot come from a counter, but the
  // function stays total: a bad input gives a valid offset, not a NaN matrix.
  const step = (Math.trunc(Math.abs(frame)) % TAA_JITTER_SAMPLES) + 1;
  return { x: halton(step, 2) - 0.5, y: halton(step, 3) - 0.5 };
}

/** The camera's projection and its inverse, cloned, before any jitter. */
export function saveProjection(camera: THREE.Camera): ProjectionSnapshot {
  return { matrix: camera.projectionMatrix.clone(), inverse: camera.projectionMatrixInverse.clone() };
}

/** Puts a projection back exactly as `saveProjection` found it. */
export function restoreProjection(camera: THREE.Camera, snapshot: ProjectionSnapshot): void {
  camera.projectionMatrix.copy(snapshot.matrix);
  camera.projectionMatrixInverse.copy(snapshot.inverse);
}

/**
 * Shifts the camera's projection by `jitter` pixels, for this frame only.
 *
 * The camera object itself is what gets jittered, and that is deliberate: the
 * colour pass and the occlusion pass both read `camera.projectionMatrix`, so
 * they cannot end up half a pixel apart and occlude the wrong pixel. The caller
 * must put it back with `restoreProjection` before anything else looks at the
 * camera — picking, framing, and the next frame's save all read it.
 *
 * A perspective projection gets the offset in element 8/9, the third column:
 * clip.w is −z, so adding δ there moves the sample by the same NDC amount at
 * every depth (one pixel is 2/width in NDC). An orthographic projection has no
 * perspective divide, so the same shift has to go in the translation column
 * (element 12/13) or it would scale with depth.
 */
export function applyProjectionJitter(camera: THREE.Camera, jitter: TaaJitter, size: TaaPassSize): void {
  if (size.width < 1 || size.height < 1) return;
  const elements = camera.projectionMatrix.elements;
  const x = (jitter.x * 2) / size.width;
  const y = (jitter.y * 2) / size.height;
  if (camera instanceof THREE.OrthographicCamera) {
    elements[12] = (elements[12] ?? 0) + x;
    elements[13] = (elements[13] ?? 0) + y;
  } else {
    elements[8] = (elements[8] ?? 0) + x;
    elements[9] = (elements[9] ?? 0) + y;
  }
  // Whatever reconstructs a view position from this matrix — the occlusion
  // does — has to see the same sub-pixel shift, so the inverse follows.
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

// ------------------------------------------------------------------- the motion

/** The angle of a rotation, in radians, computed where it is stable: near zero. */
function rotationAngle(a: THREE.Quaternion, b: THREE.Quaternion): number {
  // The relative rotation conjugate(a) * b, then 2*atan2(|vector|, |scalar|):
  // unlike the usual acos of the dot product this keeps its digits for the
  // sub-degree rotations the still threshold is looking for.
  const w = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
  const x = a.w * b.x - a.x * b.w - a.y * b.z + a.z * b.y;
  const y = a.w * b.y + a.x * b.z - a.y * b.w - a.z * b.x;
  const z = a.w * b.z - a.x * b.y + a.y * b.x - a.z * b.w;
  const vector = Math.hypot(x, y, z);
  // q and -q are the same rotation, so |w| is what carries the angle.
  return 2 * Math.atan2(vector, Math.abs(w));
}

/**
 * How much the view changed between two frames, in motion units: 0 is the same
 * picture, 1 is a slow deliberate movement — enough that the blend steps aside
 * — and above `TAA_RESET_MOTION` it is a different picture entirely.
 *
 * Rotation and travel are both in it, each divided by the amount that counts as
 * one unit, and the larger of the two wins: a camera that slid without turning
 * changes the picture as much as one that turned without sliding.
 */
export function viewMotion(previous: CameraPose, next: CameraPose): number {
  const radians = rotationAngle(previous.quaternion, next.quaternion);
  const metres = previous.position.distanceTo(next.position);
  return Math.max(radians / TAA_MOTION_RAD_PER_FRAME, metres / TAA_MOTION_M_PER_FRAME);
}

/**
 * The weight the previous frame's image gets, for a given view change.
 *
 * Linear from `TAA_BLEND` (still) to `TAA_MOTION_BLEND` (moving) over the first
 * motion unit, flat at the moving blend until `TAA_RESET_MOTION`, and 0 past
 * it. Linear and not a step, because a step in the blend is itself a visible
 * change in how sharp the frame is: the picture would snap as a drag crosses a
 * threshold. It does not need to be a curve — every value on the ramp is a
 * compromise someone might take, and the ends are the two that matter.
 *
 * A non-finite motion means the pose is not usable, and the safe answer to
 * "I do not know how much this moved" is to keep less of the old frame.
 */
export function blendForMotion(motion: number): number {
  if (!Number.isFinite(motion)) return TAA_MOTION_BLEND;
  if (motion <= 0) return TAA_BLEND;
  if (motion >= TAA_RESET_MOTION) return 0;
  if (motion >= 1) return TAA_MOTION_BLEND;
  return TAA_BLEND + (TAA_MOTION_BLEND - TAA_BLEND) * motion;
}

/**
 * The camera's motion across frames, and the history weight that follows from
 * it. Pure CPU state: no renderer, no GPU, so the motion response — the whole
 * of Review Focus 2 — is testable without a canvas.
 *
 * The camera is read through `position` and `quaternion`, which are its LOCAL
 * transform. The viewer does not parent its cameras, so local is world there.
 */
export class CameraMotion {
  private previous: CameraPose | null = null;
  private stillFrames = 0;

  /** The history weight for this frame, given where the camera is now. */
  next(camera: THREE.Camera): number {
    const pose: CameraPose = { position: camera.position.clone(), quaternion: camera.quaternion.clone() };
    const previous = this.previous;
    this.previous = pose;

    // The first frame of a session has no image behind it to blend with.
    if (previous === null) {
      this.stillFrames = 1;
      return 0;
    }

    const motion = viewMotion(previous, pose);
    this.stillFrames = motion <= TAA_MOTION_STOPPED ? this.stillFrames + 1 : 0;

    // A cut, not a movement: nothing of the old frame belongs in this one.
    if (motion >= TAA_RESET_MOTION) {
      this.stillFrames = 0;
      return 0;
    }

    const blend = blendForMotion(motion);
    // Until the camera has been still for `TAA_SETTLE_FRAMES` frames the blend
    // is capped at the moving value, so a pause inside a drag never hands back
    // full history the drag would then smear.
    return this.stillFrames >= TAA_SETTLE_FRAMES ? blend : Math.min(blend, TAA_MOTION_BLEND);
  }

  /** Forget the camera's place: the next frame starts with no history. */
  reset(): void {
    this.previous = null;
    this.stillFrames = 0;
  }
}

// --------------------------------------------------------------------- the pass

const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * The blend, in LINEAR light: the composer's buffers hold radiance, not display
 * values (three skips tone mapping when it draws into a target), and an average
 * of radiance is the average a camera would have taken. Averaging after tone
 * mapping would darken every edge — the average of two compressed values is not
 * the compression of their average — and no later pass could undo it.
 */
const HISTORY_BLEND_FRAGMENT = /* glsl */ `
uniform sampler2D tNew;
uniform sampler2D tOld;
uniform float historyWeight;

varying vec2 vUv;

void main() {
  vec4 current = texture2D(tNew, vUv);
  vec4 previous = texture2D(tOld, vUv);
  gl_FragColor = mix(current, previous, historyWeight);
}
`;

/**
 * The temporal pass: hands the jitter to the camera, blends this frame with the
 * one before it, and publishes the result to the rest of the chain.
 *
 * It writes two full-screen quads a frame. The first blends history into the
 * new frame; the second copies that result into the composer's buffer, because
 * the pass after this one (the output pass) reads the composer's buffer and not
 * ours. Two quads, the same cost as any other route that keeps a history.
 */
class TaaPass extends Pass {
  /** The ping-pong pair. `historyTargets[slot]` is the last frame the user saw. */
  readonly historyTargets: readonly [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  readonly blendMaterial: THREE.ShaderMaterial;
  readonly copyMaterial: THREE.ShaderMaterial;

  private readonly quad: FullScreenQuad;
  private readonly size: { width: number; height: number };
  private readonly motion = new CameraMotion();
  private slot = 0;
  /** False until a frame has been written, and after any resize: nothing to blend with. */
  private historyValid = false;
  private weight = 0;
  private frame = 0;
  /** The camera currently carrying a jitter, and the projection to put back. */
  private jittered: THREE.Camera | null = null;
  private saved: ProjectionSnapshot | null = null;
  private disposed = false;

  constructor(size: TaaPassSize) {
    super();
    this.size = { width: Math.max(1, Math.round(size.width)), height: Math.max(1, Math.round(size.height)) };
    this.historyTargets = [this.historyTarget(this.size.width, this.size.height), this.historyTarget(this.size.width, this.size.height)];
    this.blendMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tNew: { value: null },
        tOld: { value: null },
        historyWeight: { value: 0 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: HISTORY_BLEND_FRAGMENT,
      depthTest: false,
      depthWrite: false,
      // The blend result IS the frame; nothing is behind it to mix with.
      blending: THREE.NoBlending,
    });
    this.copyMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms),
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
    this.quad = new FullScreenQuad(this.blendMaterial);
  }

  /**
   * Starts a frame: jitters the camera and returns the history weight this frame
   * will be drawn with. Call it before the composer renders, because the jitter
   * has to be on the camera while the model is drawn.
   */
  beginFrame(camera: THREE.Camera): number {
    if (this.disposed) return 0;
    // A frame that was begun and never ended (an exception in between) left a
    // jitter on the camera; take it off before saving, or the offsets stack.
    if (this.jittered !== null && this.saved !== null) restoreProjection(this.jittered, this.saved);

    const blend = this.motion.next(camera);
    this.weight = this.historyValid ? blend : 0;
    this.saved = saveProjection(camera);
    this.jittered = camera;
    applyProjectionJitter(camera, jitterForFrame(this.frame), this.size);
    this.frame += 1;
    return this.weight;
  }

  /** Ends a frame: puts the camera's projection back exactly as it was found. */
  endFrame(camera: THREE.Camera): void {
    if (this.saved !== null) restoreProjection(camera, this.saved);
    this.saved = null;
    this.jittered = null;
  }

  setSize(width: number, height: number): void {
    this.size.width = Math.max(1, Math.round(width));
    this.size.height = Math.max(1, Math.round(height));
    for (const target of this.historyTargets) target.setSize(this.size.width, this.size.height);
    // A reallocated target holds whatever the driver left in it, which is not
    // last frame. The first frame at a new size is drawn sharp.
    this.historyValid = false;
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    if (this.disposed) return;
    const previous = this.historyTargets[this.slot]!;
    const current = this.historyTargets[1 - this.slot]!;

    this.blendMaterial.uniforms.tNew!.value = readBuffer.texture;
    this.blendMaterial.uniforms.tOld!.value = previous.texture;
    this.blendMaterial.uniforms.historyWeight!.value = this.weight;
    this.quad.material = this.blendMaterial;
    renderer.setRenderTarget(current);
    if (this.clear) renderer.clear();
    this.quad.render(renderer);

    // Publish to the chain. `renderToScreen` is false in practice — the output
    // pass that tone maps is always after this one — but a pass that is last
    // still has to draw.
    this.copyMaterial.uniforms.tDiffuse!.value = current.texture;
    this.quad.material = this.copyMaterial;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);

    this.slot = 1 - this.slot;
    this.historyValid = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const target of this.historyTargets) target.dispose();
    this.blendMaterial.dispose();
    this.copyMaterial.dispose();
    // The full-screen quad's geometry is one shared buffer for every pass in
    // three's module, so it is not this pass's to dispose.
  }

  /**
   * One full-resolution history target: half float, no depth.
   *
   * Half float because the blend happens in linear radiance before tone
   * mapping, and 8 bits of linear light bands visibly in a dark corner. No
   * depth or stencil because nothing but a full-screen quad ever draws into it.
   */
  private historyTarget(width: number, height: number): THREE.WebGLRenderTarget {
    return new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
  }
}

export { TaaPass };

/** The temporal pass at a given size. Build it once, with the composer. */
export function createTaaPass(size: TaaPassSize): TaaPass {
  return new TaaPass(size);
}
