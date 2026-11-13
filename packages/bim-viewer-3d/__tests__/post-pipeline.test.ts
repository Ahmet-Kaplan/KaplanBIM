/**
 * @jest-environment jsdom
 *
 * The render pipeline, on the CPU: what it draws, in which order, and what it
 * frees. There is no GPU under jsdom, so this file proves the orchestration —
 * the number of draws per frame, that the model pass still gets the scene and
 * the camera unchanged when ambient occlusion is off, that the occlusion buffer
 * is built before the pass that tone maps, that a resize reaches the render
 * targets and that dispose releases them.
 *
 * What it cannot prove: that the shading is right, that AO looks the way a
 * person expects on a real façade, or how long a frame takes on hardware. The
 * renderer here is a stub that records calls; nothing is rasterised.
 */
import * as THREE from "three";
import type { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import type { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { AO_INTENSITY, AO_RADIUS_M, AO_SAMPLES, createAoPass, logDepthToStandardNdc } from "../src/post/ao";
import { createRenderPipeline } from "../src/post/render-pipeline";

interface DrawCall {
  readonly scene: THREE.Object3D;
  readonly camera: THREE.Camera;
  readonly overrideMaterial: THREE.Material | null;
  readonly target: THREE.WebGLRenderTarget | null;
}

/**
 * A WebGLRenderer-shaped recorder. `render` is what the pipeline is judged on;
 * the rest is the surface EffectComposer, RenderPass, GTAOPass and OutputPass
 * touch while issuing a frame (render targets, clear colour, canvas size).
 */
function stubRenderer(capabilities: { readonly logarithmicDepthBuffer: boolean } = { logarithmicDepthBuffer: true }) {
  const calls: DrawCall[] = [];
  const targets: (THREE.WebGLRenderTarget | null)[] = [];
  const size = new THREE.Vector2(800, 600);
  const renderer = {
    capabilities,
    autoClear: true,
    // What the viewer sets on the real renderer, and what OutputPass reads to
    // decide the look of the final pass.
    outputColorSpace: THREE.SRGBColorSpace,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.05,
    getPixelRatio: () => 1,
    getSize: (target?: THREE.Vector2) => (target ?? new THREE.Vector2()).copy(size),
    getDrawingBufferSize: (target?: THREE.Vector2) => (target ?? new THREE.Vector2()).copy(size),
    setSize: (width: number, height: number) => size.set(width, height),
    getRenderTarget: () => null,
    setRenderTarget: (target: THREE.WebGLRenderTarget | null) => {
      targets.push(target);
    },
    clear: () => undefined,
    getClearColor: (color: THREE.Color) => color.set(0, 0, 0),
    getClearAlpha: () => 1,
    setClearColor: () => undefined,
    setClearAlpha: () => undefined,
    render: (scene: THREE.Object3D, camera: THREE.Camera) => {
      const overrideMaterial = scene instanceof THREE.Scene ? (scene.overrideMaterial ?? null) : null;
      calls.push({ scene, camera, overrideMaterial, target: targets[targets.length - 1] ?? null });
    },
  };
  return { renderer: renderer as unknown as THREE.WebGLRenderer, calls, targets };
}

const SIZE = { width: 800, height: 600 };

describe("the render pipeline", () => {
  it("draws the scene itself, once, when ambient occlusion is off", () => {
    const { renderer, calls, targets } = stubRenderer();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const pipeline = createRenderPipeline(renderer, scene, camera);

    pipeline.render();

    // The whole point of the default: one renderer.render with the same two
    // arguments the viewer used before this file existed.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.scene).toBe(scene);
    expect(calls[0]?.camera).toBe(camera);
    // No composer was ever built, so no render target was ever bound.
    expect(targets).toHaveLength(0);
    expect(pipeline.stats().passes).toBe(1);
    expect(pipeline.stats().frameMs).toBeGreaterThanOrEqual(0);
  });

  it("builds the occlusion buffer before the pass that tone maps and encodes", () => {
    const { renderer, calls } = stubRenderer();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const pipeline = createRenderPipeline(renderer, scene, camera, { ao: true });

    pipeline.render();

    // 1: the model into a linear buffer. 2: the same model again as normals and
    // depth, which is what GTAO reads. Then the full-screen quads: the AO
    // computation, the denoise, the blend, and last the output pass.
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(calls[0]?.scene).toBe(scene);
    expect(calls[0]?.camera).toBe(camera);
    expect(calls[0]?.overrideMaterial).toBeNull();
    expect(calls[0]?.target).not.toBeNull();
    expect(calls[1]?.scene).toBe(scene);
    expect(calls[1]?.overrideMaterial).toBeInstanceOf(THREE.MeshNormalMaterial);

    // The last draw is the output pass: not the model, and onto the canvas.
    const last = calls[calls.length - 1];
    expect(last?.camera).not.toBe(camera);
    expect(last?.target).toBeNull();

    expect(pipeline.stats().passes).toBe(3);
  });

  it("draws exactly one pass-through frame for a plan view, occlusion or not", () => {
    const { renderer, calls, targets } = stubRenderer();
    const scene = new THREE.Scene();
    const pipeline = createRenderPipeline(renderer, scene, new THREE.PerspectiveCamera(), { ao: true });
    pipeline.render();

    // Plan and parallel views are orthographic drawings; occlusion there would
    // darken line work, and GTAO's projection mode is fixed when the pass is
    // built. So an orthographic camera goes the old way.
    const planCamera = new THREE.OrthographicCamera();
    pipeline.setCamera(planCamera);
    const before = calls.length;
    const boundBefore = targets.length;
    pipeline.render();

    expect(calls.length - before).toBe(1);
    expect(calls[calls.length - 1]?.camera).toBe(planCamera);
    expect(targets.length).toBe(boundBefore);
    expect(pipeline.stats().passes).toBe(1);
  });

  it("carries a new perspective camera into the passes", () => {
    const { renderer, calls } = stubRenderer();
    const scene = new THREE.Scene();
    const pipeline = createRenderPipeline(renderer, scene, new THREE.PerspectiveCamera(), { ao: true });
    pipeline.render();

    const other = new THREE.PerspectiveCamera(35, 1, 0.5, 900);
    pipeline.setCamera(other);
    pipeline.render();

    const modelDraws = calls.filter((call) => call.scene === scene && call.overrideMaterial === null);
    expect(modelDraws.map((call) => call.camera)).toEqual([expect.any(THREE.PerspectiveCamera), other]);
    // The AO pass reads the new camera's clipping range, not the first one's.
    const ao = pipeline as unknown as { aoPass: GTAOPass | null };
    expect(ao.aoPass?.camera).toBe(other);
  });

  it("resizes the composer and the occlusion buffers with the canvas", () => {
    const { renderer } = stubRenderer();
    const pipeline = createRenderPipeline(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), { ao: true });
    pipeline.render();

    pipeline.resize(1280, 720);

    const internals = pipeline as unknown as { composer: EffectComposer | null; aoPass: GTAOPass | null };
    expect(internals.composer?.renderTarget1.width).toBe(1280);
    expect(internals.composer?.renderTarget1.height).toBe(720);
    expect(internals.aoPass?.gtaoRenderTarget.width).toBe(1280);
    expect(internals.aoPass?.gtaoRenderTarget.height).toBe(720);
  });

  it("releases the render targets and the pass materials on dispose", () => {    const { renderer, calls } = stubRenderer();
    const pipeline = createRenderPipeline(renderer, new THREE.Scene(), new THREE.PerspectiveCamera(), { ao: true });
    pipeline.render();
    const internals = pipeline as unknown as { composer: EffectComposer | null; aoPass: GTAOPass | null };
    const composer = internals.composer!;
    const ao = internals.aoPass!;
    const freed = jest.fn();
    for (const node of [composer.renderTarget1, composer.renderTarget2, ao.gtaoRenderTarget, ao.pdRenderTarget, ao.gtaoMaterial, ao.pdMaterial]) {
      node.addEventListener("dispose", freed);
    }

    pipeline.dispose();

    // Render targets are GPU memory: a viewer that keeps them dies on the
    // second model.
    expect(freed).toHaveBeenCalledTimes(6);
    const draws = calls.length;
    pipeline.render();
    pipeline.dispose();
    expect(calls.length).toBe(draws);
  });
});

describe("the ambient occlusion constants", () => {
  it("are named, documented values", () => {
    expect(AO_RADIUS_M).toBe(0.5);
    expect(AO_SAMPLES).toBe(16);
    expect(AO_INTENSITY).toBeCloseTo(0.8);
  });

  it("keep the radius in metres, sized for a building rather than a product shot", () => {
    // Metres: the scene is in metres, so a radius under a quarter of one gathers
    // nothing architectural, and one past a metre smears a 100 m façade.
    expect(AO_RADIUS_M).toBeGreaterThanOrEqual(0.25);
    expect(AO_RADIUS_M).toBeLessThanOrEqual(1);
    expect(Number.isInteger(AO_SAMPLES)).toBe(true);
    expect(AO_SAMPLES).toBeGreaterThan(0);
    expect(AO_INTENSITY).toBeGreaterThan(0);
    expect(AO_INTENSITY).toBeLessThanOrEqual(1);
  });

  it("reach the pass as a world radius, a sample count and a blend", () => {
    const pass = createAoPass(new THREE.Scene(), new THREE.PerspectiveCamera(), SIZE);
    expect(pass.gtaoMaterial.uniforms.radius?.value).toBe(AO_RADIUS_M);
    expect(pass.gtaoMaterial.defines?.SAMPLES).toBe(AO_SAMPLES);
    expect(pass.blendIntensity).toBe(AO_INTENSITY);
    // Screen-space radius would make the occlusion grow with zoom; metres do not.
    expect(pass.gtaoMaterial.defines?.SCREEN_SPACE_RADIUS).toBe(0);
    expect(pass.output).toBe(0);
    // The two AO-only buffers carry no depth: nothing in them reads it.
    expect(pass.gtaoRenderTarget.depthBuffer).toBe(false);
    expect(pass.pdRenderTarget.depthBuffer).toBe(false);
    // The buffer the scene's normals and depth are rendered into still does.
    expect((pass as unknown as { normalRenderTarget: THREE.WebGLRenderTarget }).normalRenderTarget.depthBuffer).toBe(true);
  });
});

describe("a logarithmic depth buffer", () => {
  const near = 0.1;
  const far = 5000;
  /** three writes gl_FragDepth = log2(1 + w) / log2(far + 1) when the renderer has one. */
  const logWindowDepth = (viewW: number): number => Math.log2(1 + viewW) / Math.log2(far + 1);
  /** The window depth a standard perspective projection writes for the same point. */
  const standardWindowDepth = (viewW: number): number => ((far + near) / (far - near) - (2 * far * near) / ((far - near) * viewW) + 1) / 2;

  it("linearises back to the standard depth the occlusion maths assumes", () => {
    for (const viewW of [near, 1, 10, 100, 1000, far]) {
      expect(logDepthToStandardNdc(logWindowDepth(viewW), near, far)).toBeCloseTo(standardWindowDepth(viewW), 6);
    }
    // The cleared depth means "nothing here" in both encodings.
    expect(logDepthToStandardNdc(1, near, far)).toBe(1);
  });

  it("is linearised inside the occlusion pass, and only when the renderer has one", () => {
    const logged = createAoPass(new THREE.Scene(), new THREE.PerspectiveCamera(near, 1, near, far), SIZE, { logarithmicDepthBuffer: true });
    // Both shaders that read depth: the occlusion itself and the edge-aware denoise.
    expect(logged.gtaoMaterial.fragmentShader).toContain("logDepthToStandard");
    expect(logged.pdMaterial.fragmentShader).toContain("logDepthToStandard");
    expect(logged.pdMaterial.uniforms.cameraFar?.value).toBe(far);

    const plain = createAoPass(new THREE.Scene(), new THREE.PerspectiveCamera(near, 1, near, far), SIZE);
    expect(plain.gtaoMaterial.fragmentShader).not.toContain("logDepthToStandard");
    expect(plain.pdMaterial.fragmentShader).not.toContain("logDepthToStandard");
  });
});
