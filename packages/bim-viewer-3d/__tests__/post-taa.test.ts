/**
 * @jest-environment jsdom
 *
 * Temporal anti-aliasing, on the CPU: the jitter it puts on the projection, the
 * weight it gives last frame's image, and — the point of the whole pass — how
 * fast that weight falls away when the camera moves.
 *
 * There is no GPU under jsdom, so this file proves the arithmetic and the
 * orchestration, never the picture. What it cannot prove: that the blended
 * image has no visible ghost, that edges actually look smoother, that the two
 * full-resolution history targets cost what a renderer charges for them, or
 * how many milliseconds a frame takes on hardware. Those need eyes on a canvas
 * and `tools/perf` on a machine with a GPU, and are reported as unverified
 * rather than asserted here.
 */
import * as THREE from "three";
import type { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import type { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import {
  CameraMotion,
  TAA_BLEND,
  TAA_JITTER_SAMPLES,
  TAA_MOTION_BLEND,
  TAA_MOTION_STOPPED,
  TAA_RESET_MOTION,
  TAA_SETTLE_FRAMES,
  applyProjectionJitter,
  blendForMotion,
  createTaaPass,
  jitterForFrame,
  restoreProjection,
  saveProjection,
  viewMotion,
} from "../src/post/taa";
import { createRenderPipeline } from "../src/post/render-pipeline";

interface DrawCall {
  readonly scene: THREE.Object3D;
  readonly camera: THREE.Camera;
  readonly overrideMaterial: THREE.Material | null;
  readonly target: THREE.WebGLRenderTarget | null;
  /** The projection the camera carried at the moment of the draw, so jitter is visible. */
  readonly projection: readonly number[];
}

/**
 * A WebGLRenderer-shaped recorder: the surface EffectComposer, RenderPass,
 * GTAOPass, the temporal pass and OutputPass touch while issuing a frame.
 */
function stubRenderer(capabilities: { readonly logarithmicDepthBuffer: boolean } = { logarithmicDepthBuffer: true }) {
  const calls: DrawCall[] = [];
  const targets: (THREE.WebGLRenderTarget | null)[] = [];
  const size = new THREE.Vector2(800, 600);
  let bound: THREE.WebGLRenderTarget | null = null;
  const renderer = {
    capabilities,
    autoClear: true,
    outputColorSpace: THREE.SRGBColorSpace,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.05,
    getPixelRatio: () => 1,
    getSize: (target?: THREE.Vector2) => (target ?? new THREE.Vector2()).copy(size),
    getDrawingBufferSize: (target?: THREE.Vector2) => (target ?? new THREE.Vector2()).copy(size),
    setSize: (width: number, height: number) => size.set(width, height),
    getRenderTarget: () => bound,
    setRenderTarget: (target: THREE.WebGLRenderTarget | null) => {
      bound = target;
      targets.push(target);
    },
    clear: () => undefined,
    getClearColor: (color: THREE.Color) => color.set(0, 0, 0),
    getClearAlpha: () => 1,
    setClearColor: () => undefined,
    setClearAlpha: () => undefined,
    render: (scene: THREE.Object3D, camera: THREE.Camera) => {
      const overrideMaterial = scene instanceof THREE.Scene ? (scene.overrideMaterial ?? null) : null;
      calls.push({ scene, camera, overrideMaterial, target: bound, projection: [...camera.projectionMatrix.elements] });
    },
  };
  return { renderer: renderer as unknown as THREE.WebGLRenderer, calls, targets };
}

const SIZE = { width: 800, height: 600 };

/** A camera parked at `position` and turned `yaw` radians about y. */
function pose(camera: THREE.PerspectiveCamera, position: readonly [number, number, number], yaw = 0): void {
  camera.position.set(position[0], position[1], position[2]);
  camera.rotation.set(0, yaw, 0);
  camera.updateMatrixWorld(true);
}

describe("the temporal anti-aliasing constants", () => {
  it("are named, documented values", () => {
    expect(TAA_JITTER_SAMPLES).toBe(8);
    expect(TAA_BLEND).toBeCloseTo(0.9);
    expect(TAA_MOTION_BLEND).toBeCloseTo(0.1);
    expect(TAA_MOTION_STOPPED).toBeGreaterThan(0);
    expect(TAA_RESET_MOTION).toBeGreaterThan(1);
    expect(TAA_SETTLE_FRAMES).toBeGreaterThanOrEqual(2);
  });

  it("hold a history window long enough to cover one jitter cycle", () => {
    // A history weight of 0.9 is an exponential window of 1/(1-0.9) = 10
    // frames: just over the 8-sample jitter cycle, so every offset is in the
    // accumulated image. Lighter than that and the jitter pattern itself shows.
    expect(1 / (1 - TAA_BLEND)).toBeGreaterThan(TAA_JITTER_SAMPLES);
    expect(1 / (1 - TAA_BLEND)).toBeLessThan(2 * TAA_JITTER_SAMPLES);
    // While moving, last frame is nearly all gone: a 1/(1-0.1) = 1.1 frame
    // window, which is a frame of edge quality and not a trail.
    expect(TAA_MOTION_BLEND).toBeLessThan(TAA_BLEND / 4);
    // The still threshold sits far below the moving blend, so the ramp between
    // them is a ramp and not a step.
    expect(TAA_MOTION_STOPPED).toBeLessThan(0.5);
    // The settle delay is shorter than the jitter cycle it is flushing.
    expect(TAA_SETTLE_FRAMES).toBeLessThan(TAA_JITTER_SAMPLES + 4);
  });
});

describe("the jitter sequence", () => {
  it("is deterministic", () => {
    const first = Array.from({ length: TAA_JITTER_SAMPLES }, (_, i) => jitterForFrame(i));
    const again = Array.from({ length: TAA_JITTER_SAMPLES }, (_, i) => jitterForFrame(i));
    expect(again).toEqual(first);
  });

  it("stays inside half a pixel, and never sits on the pixel centre", () => {
    for (let i = 0; i < TAA_JITTER_SAMPLES * 4; i++) {
      const jitter = jitterForFrame(i);
      expect(Math.abs(jitter.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(jitter.y)).toBeLessThanOrEqual(0.5);
      // An offset of exactly zero is a frame that anti-aliases nothing.
      expect(Math.abs(jitter.x) + Math.abs(jitter.y)).toBeGreaterThan(0);
    }
  });

  it("visits every sample before it repeats", () => {
    const cycle = Array.from({ length: TAA_JITTER_SAMPLES }, (_, i) => jitterForFrame(i).x + "," + jitterForFrame(i).y);
    expect(new Set(cycle).size).toBe(TAA_JITTER_SAMPLES);
    for (let i = 0; i < TAA_JITTER_SAMPLES * 3; i++) {
      expect(jitterForFrame(i)).toEqual(jitterForFrame(i % TAA_JITTER_SAMPLES));
    }
    // Negative frame numbers cannot come out of a counter, but the sequence is
    // still total: no NaN, no wrapped-around garbage.
    expect(Number.isFinite(jitterForFrame(-1).x)).toBe(true);
  });

  it("shifts the projection by that many pixels, in NDC, on both kinds of camera", () => {
    const perspective = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 5000);
    const flat = saveProjection(perspective);
    applyProjectionJitter(perspective, { x: 0.5, y: -0.25 }, { width: 1920, height: 1080 });
    // x_ndc = (m11 x + m12 y + m13 z + m14 w) / w, so m13 (element 8) moves the
    // sample by a constant NDC amount at every depth — one pixel is 2/width.
    expect(perspective.projectionMatrix.elements[8]).toBeCloseTo(flat.matrix.elements[8] + 1 / 1920, 10);
    expect(perspective.projectionMatrix.elements[9]).toBeCloseTo(flat.matrix.elements[9] - 0.5 / 1080, 10);

    const orthographic = new THREE.OrthographicCamera(-50, 50, 50, -50, -1000, 1000);
    const orthoFlat = saveProjection(orthographic);
    applyProjectionJitter(orthographic, { x: 0.5, y: -0.25 }, { width: 1920, height: 1080 });
    // An orthographic projection has no perspective divide, so the same shift
    // has to go in the translation column or it would scale with depth.
    expect(orthographic.projectionMatrix.elements[12]).toBeCloseTo(orthoFlat.matrix.elements[12] + 1 / 1920, 10);
    expect(orthographic.projectionMatrix.elements[13]).toBeCloseTo(orthoFlat.matrix.elements[13] - 0.5 / 1080, 10);
    expect(orthographic.projectionMatrix.elements[8]).toBe(orthoFlat.matrix.elements[8]);
  });

  it("is undone exactly, including the inverse the depth maths reads", () => {
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 5000);
    const flat = saveProjection(camera);
    applyProjectionJitter(camera, { x: -0.5, y: 0.5 }, { width: 800, height: 600 });
    expect(camera.projectionMatrix.elements).not.toEqual([...flat.matrix.elements]);

    restoreProjection(camera, flat);

    expect(camera.projectionMatrix.elements).toEqual([...flat.matrix.elements]);
    expect(camera.projectionMatrixInverse.elements).toEqual([...flat.inverse.elements]);
  });
});

describe("the camera's motion response (Review Focus 2)", () => {
  it("measures movement in view units, rotation and travel both", () => {
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 5000);
    pose(camera, [40, 30, 40]);
    const start = { position: camera.position.clone(), quaternion: camera.quaternion.clone() };

    pose(camera, [40, 30, 40], 0.02);
    const turned = viewMotion(start, { position: camera.position.clone(), quaternion: camera.quaternion.clone() });
    pose(camera, [40.1, 30, 40]);
    const slid = viewMotion(start, { position: camera.position.clone(), quaternion: camera.quaternion.clone() });
    pose(camera, [40, 30, 40], 0.04);
    const turnedMore = viewMotion(start, { position: camera.position.clone(), quaternion: camera.quaternion.clone() });

    expect(turned).toBeGreaterThan(0);
    expect(slid).toBeGreaterThan(0);
    // Twice the turn is twice the motion; a step of a whole reference unit is
    // the "fully moving" mark.
    expect(turnedMore).toBeCloseTo(2 * turned, 6);
    // No movement at all is exactly still, not merely small.
    expect(viewMotion(start, start)).toBe(0);
  });

  it("drops the history weight while the camera moves, and sharpens further on a cut", () => {
    expect(blendForMotion(0)).toBe(TAA_BLEND);
    expect(blendForMotion(TAA_MOTION_STOPPED)).toBeGreaterThan(TAA_MOTION_BLEND);
    expect(blendForMotion(1)).toBe(TAA_MOTION_BLEND);
    // Monotone: more movement is never more history.
    let previous = blendForMotion(0);
    for (let motion = 0.05; motion <= TAA_RESET_MOTION; motion += 0.05) {
      const blend = blendForMotion(motion);
      expect(blend).toBeLessThanOrEqual(previous + 1e-12);
      previous = blend;
    }
    // A jump that is not a movement but a different place throws the history
    // away entirely: a blend of 0 is this frame alone.
    expect(blendForMotion(TAA_RESET_MOTION)).toBe(0);
    expect(blendForMotion(TAA_RESET_MOTION * 10)).toBe(0);
  });

  it("bleeds off the last frame while turning, then returns to full blend after the camera stops", () => {
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 5000);
    const motion = new CameraMotion();

    // A drag: a degree a frame, which is a slow hand movement and well past the
    // still threshold.
    const moving: number[] = [];
    pose(camera, [40, 30, 40]);
    moving.push(motion.next(camera));
    for (let frame = 1; frame <= 12; frame++) {
      pose(camera, [40, 30, 40], frame * 0.0175);
      moving.push(motion.next(camera));
    }
    // The first frame has nothing behind it to blend with; after that, a moving
    // frame is drawn almost entirely from itself.
    expect(moving[0]).toBe(0);
    for (const blend of moving.slice(1)) expect(blend).toBe(TAA_MOTION_BLEND);

    // Stopped: the same pose, frame after frame.
    const stopping: number[] = [];
    for (let frame = 0; frame < TAA_SETTLE_FRAMES + 4; frame++) {
      stopping.push(motion.next(camera));
    }
    // Still lower than full at first — the frames it just blended in are still
    // on their way out — and full by the documented count.
    expect(stopping[0]).toBe(TAA_MOTION_BLEND);
    expect(stopping[TAA_SETTLE_FRAMES - 1]).toBe(TAA_BLEND);
    for (const blend of stopping.slice(TAA_SETTLE_FRAMES - 1)) expect(blend).toBe(TAA_BLEND);

    // Numerically: this is Review Focus 2. A moving frame keeps a tenth of the
    // last one; a still frame keeps nine tenths.
    const stillBlend = stopping[stopping.length - 1]!;
    const movingBlend = moving[moving.length - 1]!;
    expect(movingBlend).toBeLessThan(stillBlend);
    expect(movingBlend / stillBlend).toBeLessThanOrEqual(1 / 4);
  });

  it("does not hand full blend back for a single frame's pause inside a drag", () => {
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 5000);
    const motion = new CameraMotion();
    pose(camera, [40, 30, 40]);
    motion.next(camera);
    for (let frame = 1; frame <= 10; frame++) {
      pose(camera, [40, 30, 40], frame * 0.0175);
      motion.next(camera);
    }
    // Mouse events arrive in bursts: one still frame must not snap the blend to
    // full and smear the drag that resumes on the next one.
    const pause = motion.next(camera);
    expect(pause).toBeLessThan(TAA_BLEND);
    pose(camera, [40, 30, 40], 11 * 0.0175);
    expect(motion.next(camera)).toBe(TAA_MOTION_BLEND);
  });

  it("starts over from no history after a reset", () => {
    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 5000);
    const motion = new CameraMotion();
    pose(camera, [40, 30, 40]);
    motion.next(camera);
    for (let frame = 0; frame < TAA_SETTLE_FRAMES + 2; frame++) motion.next(camera);
    expect(motion.next(camera)).toBe(TAA_BLEND);

    // A storey switch or a saved view: the camera is somewhere else entirely.
    pose(camera, [-120, 60, 15], 2.1);
    expect(motion.next(camera)).toBe(0);
  });
});

describe("the temporal pass's history buffer", () => {
  it("keeps a pair of full-resolution targets at the composer's size", () => {
    const pass = createTaaPass(SIZE);
    expect(pass.historyTargets).toHaveLength(2);
    for (const target of pass.historyTargets) {
      expect(target.width).toBe(SIZE.width);
      expect(target.height).toBe(SIZE.height);
      // Linear radiance, like the composer's own buffers: the blend is an
      // average of light, and it happens before tone mapping.
      expect(target.texture.type).toBe(THREE.HalfFloatType);
      expect(target.depthBuffer).toBe(false);
    }
    expect(pass.historyTargets[0]).not.toBe(pass.historyTargets[1]);
  });

  it("is resized with the composer, and forgets what it held", () => {
    const camera = new THREE.PerspectiveCamera();
    const pass = createTaaPass(SIZE);
    pose(camera, [40, 30, 40]);
    pass.beginFrame(camera);
    pass.endFrame(camera);

    pass.setSize(1280, 720);

    for (const target of pass.historyTargets) {
      expect(target.width).toBe(1280);
      expect(target.height).toBe(720);
    }
    // Reallocating a target throws its contents away, so the first frame after
    // a resize must not blend against whatever the driver left there.
    expect(pass.beginFrame(camera)).toBe(0);
    pass.endFrame(camera);
  });

  it("releases both targets and both materials, and survives a second dispose", () => {
    const pass = createTaaPass(SIZE);
    const freed = jest.fn();
    for (const node of [...pass.historyTargets, pass.blendMaterial, pass.copyMaterial]) node.addEventListener("dispose", freed);

    pass.dispose();

    expect(freed).toHaveBeenCalledTimes(4);
    expect(() => pass.dispose()).not.toThrow();
    // A disposed pass draws nothing: a frame after dispose must not resurrect
    // the targets a session has already given back.
    expect(() => pass.render({} as THREE.WebGLRenderer, {} as THREE.WebGLRenderTarget, {} as THREE.WebGLRenderTarget)).not.toThrow();
  });
});

describe("the pipeline with temporal anti-aliasing", () => {
  it("still draws the scene itself, once, when both passes are off", () => {
    const { renderer, calls, targets } = stubRenderer();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const pipeline = createRenderPipeline(renderer, scene, camera);

    pipeline.render();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.scene).toBe(scene);
    expect(calls[0]?.camera).toBe(camera);
    expect(targets).toHaveLength(0);
    expect(pipeline.stats().passes).toBe(1);
  });

  it("jitters the frame it draws, and leaves the camera exactly as it found it", () => {
    const { renderer, calls } = stubRenderer();
    const camera = new THREE.PerspectiveCamera(45, 800 / 600, 0.1, 5000);
    const pipeline = createRenderPipeline(renderer, new THREE.Scene(), camera, { taa: true });
    const flat = [...camera.projectionMatrix.elements];
    const flatInverse = [...camera.projectionMatrixInverse.elements];

    pipeline.render();
    pipeline.render();

    const modelDraws = calls.filter((call) => call.scene instanceof THREE.Scene && call.overrideMaterial === null && call.camera === camera);
    expect(modelDraws).toHaveLength(2);
    // Each frame in the cycle is drawn half a pixel or less from the last, and
    // the offset is the one the sequence says for that frame.
    for (const [index, draw] of modelDraws.entries()) {
      const jitter = jitterForFrame(index);
      expect(draw.projection[8]).toBeCloseTo((flat[8] ?? 0) + (jitter.x * 2) / SIZE.width, 10);
      expect(draw.projection[9]).toBeCloseTo((flat[9] ?? 0) + (jitter.y * 2) / SIZE.height, 10);
    }
    // Frame 1's offset is not the pixel centre, so the second draw really moved.
    expect(jitterForFrame(1).x).not.toBe(0);
    expect(modelDraws[1]!.projection[8]).not.toBe(modelDraws[0]!.projection[8]);

    // The camera is unjittered again the moment the frame is issued, because
    // picking, framing and the AO camera sync all read the same matrix.
    expect(camera.projectionMatrix.elements).toEqual(flat);
    expect(camera.projectionMatrixInverse.elements).toEqual(flatInverse);
  });

  it("gives the occlusion and the colour frame the same jittered projection", () => {
    const { renderer, calls } = stubRenderer();
    const camera = new THREE.PerspectiveCamera(45, 800 / 600, 0.1, 5000);
    const pipeline = createRenderPipeline(renderer, new THREE.Scene(), camera, { ao: true, taa: true });

    pipeline.render();

    // Model, then the normals-and-depth buffer GTAO reads. If those two saw
    // different projections the occlusion would sit half a pixel off the
    // shading it belongs to, which is exactly the kind of wrong a still frame
    // hides.
    const model = calls[0]!;
    const normals = calls[1]!;
    expect(normals.overrideMaterial).toBeInstanceOf(THREE.MeshNormalMaterial);
    expect(normals.projection[8]).toBe(model.projection[8]);
    expect(normals.projection[9]).toBe(model.projection[9]);

    // Model, occlusion, the temporal blend, the copy that publishes it, and
    // the output pass last, onto the canvas.
    expect(pipeline.stats().passes).toBe(4);
    expect(calls[calls.length - 1]?.target).toBeNull();
  });

  it("resizes the history with the composer", () => {
    const { renderer } = stubRenderer();
    const pipeline = createRenderPipeline(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), { taa: true });
    pipeline.render();

    pipeline.resize(1024, 768);

    const internals = pipeline as unknown as { composer: EffectComposer | null; taaPass: ReturnType<typeof createTaaPass> | null };
    expect(internals.composer?.renderTarget1.width).toBe(1024);
    for (const target of internals.taaPass!.historyTargets) {
      expect(target.width).toBe(1024);
      expect(target.height).toBe(768);
    }
  });

  it("releases the history when the pipeline is disposed, once", () => {
    const { renderer, calls } = stubRenderer();
    const pipeline = createRenderPipeline(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), { ao: true, taa: true });
    pipeline.render();
    const internals = pipeline as unknown as { taaPass: ReturnType<typeof createTaaPass> | null; aoPass: GTAOPass | null };
    const freed = jest.fn();
    for (const target of internals.taaPass!.historyTargets) target.addEventListener("dispose", freed);

    pipeline.dispose();

    expect(freed).toHaveBeenCalledTimes(2);
    expect(internals.taaPass).toBeNull();
    const draws = calls.length;
    pipeline.render();
    pipeline.dispose();
    expect(calls.length).toBe(draws);
  });

  it("keeps a plan view on the old path when only occlusion is on", () => {
    const { renderer, calls, targets } = stubRenderer();
    const pipeline = createRenderPipeline(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), { ao: true });
    pipeline.setCamera(new THREE.OrthographicCamera());
    const before = calls.length;
    const boundBefore = targets.length;

    pipeline.render();

    expect(calls.length - before).toBe(1);
    expect(targets.length).toBe(boundBefore);
  });

  it("anti-aliases a plan view too, since the composer takes hardware MSAA away", () => {
    const { renderer, calls } = stubRenderer();
    const ortho = new THREE.OrthographicCamera(-50, 50, 50, -50, -1000, 1000);
    const pipeline = createRenderPipeline(renderer, new THREE.Scene(), ortho, { taa: true });

    // The second frame of the cycle moves in both axes, so both halves of the
    // translation column are exercised.
    pipeline.render();
    pipeline.render();

    const model = calls.filter((call) => call.scene !== null && call.camera === ortho && call.overrideMaterial === null)[1]!;
    expect(model.target).not.toBeNull();
    // An orthographic camera has no perspective divide, so the jitter is in the
    // translation column and the depth column is untouched.
    const jitter = jitterForFrame(1);
    expect(model.projection[12]).toBeCloseTo((jitter.x * 2) / SIZE.width, 10);
    expect(model.projection[13]).toBeCloseTo((jitter.y * 2) / SIZE.height, 10);
    expect(model.projection[8]).toBe(0);
    expect(model.projection[9]).toBe(0);
    expect(calls[calls.length - 1]?.target).toBeNull();
  });
});
