/**
 * The viewer's render pipeline: one call per frame, and the one place that
 * decides whether a frame is drawn straight to the canvas or through a chain of
 * passes.
 *
 * With both post passes off (the default) it is a pass-through: a single
 * `renderer.render(scene, camera)` with the same arguments the viewer made
 * before this file existed, no composer, no render target, nothing to leak. That
 * is deliberate — the un-post-processed frame is the reference the occluded one
 * is judged against, so it has to be bit for bit what it always was.
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import type { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { createAoPass, syncAoCamera } from "./ao";
import { createTaaPass, type TaaPass } from "./taa";

export interface RenderPipelineOptions {
  /**
   * Ambient occlusion, on the 3D perspective view only. Off by default.
   */
  readonly ao?: boolean;
  /**
   * Temporal anti-aliasing. Off by default, and the reason it is separate from
   * `ao`: turning either one on is a decision, and a frame with both off has to
   * stay the frame the viewer made before any of this existed.
   */
  readonly taa?: boolean;
}

export interface RenderPipelineStats {
  /**
   * How long the pipeline took to issue the last frame, on the CPU. WebGL is
   * asynchronous, so this is not the frame time on the GPU: it is what the
   * orchestration costs, which is what a test without a GPU can see.
   */
  readonly frameMs: number;
  /**
   * Entries in the pass chain for the last frame: 1 when drawing straight to the
   * canvas. A temporal pass is one entry but two draws (the blend, then the copy
   * that publishes it), so this counts passes, not draw calls.
   */
  readonly passes: number;
}

export interface RenderPipeline {
  render(): void;
  resize(width: number, height: number): void;
  dispose(): void;
  stats(): RenderPipelineStats;
  /**
   * The camera this frame is drawn with. The viewer tilts from a perspective 3D
   * view into an orthographic plan and back, and the occlusion pass bakes its
   * projection mode in when it is built, so it has to be told which camera it is
   * about to draw.
   */
  setCamera(camera: THREE.Camera): void;
}

class ViewerRenderPipeline implements RenderPipeline {
  private composer: EffectComposer | null = null;
  private aoPass: GTAOPass | null = null;
  private taaPass: TaaPass | null = null;
  private outputPass: OutputPass | null = null;
  private camera: THREE.Camera;
  private readonly size: { width: number; height: number };
  private frameMs = 0;
  private passes = 1;
  private disposed = false;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    camera: THREE.Camera,
    private readonly ao: boolean,
    private readonly taa: boolean,
  ) {
    this.camera = camera;
    const size = renderer.getSize(new THREE.Vector2());
    this.size = { width: size.width, height: size.height };
  }

  render(): void {
    if (this.disposed) return;
    const started = performance.now();
    const camera = this.camera;
    const perspective = camera instanceof THREE.PerspectiveCamera;
    // Occlusion is a 3D-view effect: plan and parallel views are drawings of a
    // model, not pictures of one, and GTAO fixes its projection mode when the
    // pass is built. Temporal AA is not — a plan view is exactly the frame the
    // composer's render target took hardware MSAA away from, so it is worth
    // anti-aliasing in both.
    const occlusion = this.ao && perspective;
    if (this.taa || occlusion) {
      const composer = this.composed(camera, occlusion);
      if (this.taaPass !== null) this.taaPass.beginFrame(camera);
      try {
        composer.render();
      } finally {
        // The jitter lives on the camera for the length of one frame only.
        this.taaPass?.endFrame(camera);
      }
      this.passes = composer.passes.length;
    } else {
      this.renderer.render(this.scene, camera);
      this.passes = 1;
    }
    this.frameMs = performance.now() - started;
  }

  resize(width: number, height: number): void {
    this.size.width = width;
    this.size.height = height;
    this.composer?.setSize(width, height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    // Render targets are GPU memory. The composer owns two of them, the
    // temporal pass two more, the occlusion pass five, plus their materials; all
    // of it has to go, or the second model in a session runs out of memory.
    this.aoPass?.dispose();
    // GTAOPass.dispose frees its targets and most of its materials, but not the
    // occlusion material or the blend that multiplies it in (three r185), so
    // their two programs are freed here rather than left to the GPU.
    this.aoPass?.gtaoMaterial.dispose();
    this.aoPass?.blendMaterial.dispose();
    this.taaPass?.dispose();
    this.outputPass?.dispose();
    this.composer?.dispose();
    this.aoPass = null;
    this.taaPass = null;
    this.outputPass = null;
    this.composer = null;
  }

  stats(): RenderPipelineStats {
    return { frameMs: this.frameMs, passes: this.passes };
  }

  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  /** The composer, built once, on the first frame that needs one. */
  private composed(camera: THREE.Camera, occlusion: boolean): EffectComposer {
    if (this.composer === null) this.composer = this.build(camera);
    else {
      const renderPass = this.composer.passes[0];
      if (renderPass instanceof RenderPass) renderPass.camera = camera;
    }
    if (occlusion) this.enableOcclusion(camera);
    else if (this.aoPass !== null) this.aoPass.enabled = false;
    return this.composer;
  }

  /**
   * Builds the occlusion pass on the first perspective frame that wants it, and
   * keeps it pointed at the camera being drawn. Built lazily because GTAO fixes
   * its projection mode when it is constructed: a session that starts in plan
   * and only later tilts into 3D would otherwise build it for the wrong camera.
   */
  private enableOcclusion(camera: THREE.Camera): void {
    if (!(camera instanceof THREE.PerspectiveCamera) || this.composer === null) return;
    if (this.aoPass === null) {
      this.aoPass = createAoPass(this.scene, camera, this.size, {
        logarithmicDepthBuffer: this.renderer.capabilities.logarithmicDepthBuffer === true,
      });
      // Straight after the model, and so before the temporal pass: occlusion is
      // a ratio of linear radiance, and a temporally averaged frame is still
      // linear radiance. Blending first would leave the occlusion's own grain
      // unresolved on every still frame, which is most of what a temporal pass
      // is for here.
      this.composer.insertPass(this.aoPass, 1);
    }
    this.aoPass.enabled = true;
    syncAoCamera(this.aoPass, camera);
  }

  /**
   * The pass chain, and the reason for its order:
   *
   *   1. the model, into a linear buffer
   *   2. ambient occlusion, multiplied into that linear radiance
   *   3. temporal anti-aliasing, blending with the previous frame's image
   *   4. tone mapping and the sRGB encode, to the canvas
   *
   * The composer's buffers are linear: three skips tone mapping and the output
   * colour space when it draws into a render target, and only applies them when
   * it draws to the canvas (`currentRenderTarget === null` in `WebGLPrograms`).
   * So pass 2 still holds light, and occlusion — a ratio of light — is the right
   * thing to multiply into it, and pass 3 is averaging light, which is what a
   * camera would have averaged. Reverse the order and AO darkens the compressed
   * display curve instead: corners crush to black on a sunlit façade, the
   * shadows stop responding to the exposure, and the radius no longer reads as
   * metres. Tone mapping is not invertible, so no later pass can put it back.
   *
   * Where tone mapping lives, decided once: on the renderer, where the viewer
   * has always set it (ACES filmic, exposure 1.05). `OutputPass` reads
   * `renderer.toneMapping`, `renderer.toneMappingExposure` and
   * `renderer.outputColorSpace` and applies them exactly once, at the end, so
   * there is one place to change the look and no second copy to drift. The
   * model pass inside the composer must not tone map, and does not.
   *
   * Both optional passes are added lazily but always in this order — occlusion
   * is inserted at index 1 the first time a perspective frame asks for it, and
   * the temporal pass is added here before the output pass — so the chain is
   * the same whichever one is switched on first.
   */
  private build(camera: THREE.Camera): EffectComposer {
    const composer = new EffectComposer(this.renderer);
    this.outputPass = new OutputPass();
    composer.addPass(new RenderPass(this.scene, camera));
    if (this.taa) {
      this.taaPass = createTaaPass(this.size);
      composer.addPass(this.taaPass);
    }
    composer.addPass(this.outputPass);
    if (this.size.width > 1 && this.size.height > 1) composer.setSize(this.size.width, this.size.height);
    return composer;
  }
}

export function createRenderPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: RenderPipelineOptions = {},
): RenderPipeline {
  return new ViewerRenderPipeline(renderer, scene, camera, options.ao === true, options.taa === true);
}
