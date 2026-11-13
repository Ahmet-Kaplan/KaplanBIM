/**
 * Ambient occlusion for the 3D view: the darkness that collects where two
 * surfaces meet — the base of a wall, the inside of a window reveal, the corner
 * of a room — computed per pixel from the normals and the depth of the frame.
 *
 * It is shading, not palette: the pass multiplies occlusion into the linear
 * image and never picks a colour, so the theme has nothing to say about it.
 *
 * The occlusion is gathered over a distance in METRES (see `AO_RADIUS_M`),
 * because that is what the scene is in and because a radius tuned for a
 * two-metre object is what makes a hundred-metre façade look like a muddy wall.
 */
import * as THREE from "three";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";

/**
 * How much of the computed occlusion reaches the image. 1 would take a fully
 * enclosed point to black; 0.8 leaves a fifth of its light there, so a corner
 * deepens and reads as a corner instead of reading as dirt, and a room lit from
 * one window still shows the shape of the far wall.
 */
export const AO_INTENSITY = 0.8;

/**
 * The world-space radius the occlusion is gathered over, in METRES.
 *
 * Half a metre is the scale of a building's joints: a door reveal, the foot of a
 * wall, a slab meeting a partition. Occlusion lands on those and nowhere else,
 * so a 100 m exterior keeps its flat planes lit while its window reveals and
 * copings pick up contact shade — the difference between depth and a smear.
 * Under a quarter metre nothing architectural is wide enough to darken; at a
 * metre or more the kernel spans the whole reveal and the façade goes muddy.
 */
export const AO_RADIUS_M = 0.5;

/**
 * Horizon samples per pixel. GTAO's own default, and the point where the grain
 * the Poisson denoise has to hide is small enough that a still frame reads as
 * clean; halving it doubles the noise the denoise then blurs away.
 */
export const AO_SAMPLES = 16;

/**
 * How far in front of a surface a sample still counts, in METRES. A metre is
 * thicker than a wall, a slab or a duct, so a surface is occluded by the thing
 * beside it and not by the room beyond that thing.
 */
export const AO_THICKNESS_M = 1;

export interface AoPassSize {
  readonly width: number;
  readonly height: number;
}

export interface AoPassOptions {
  /**
   * The renderer was built with `logarithmicDepthBuffer: true`, so the depth
   * buffer holds a log encoding that the occlusion maths cannot read. Say so
   * and the pass linearises it (see `linearizeLogDepth`).
   */
  readonly logarithmicDepthBuffer?: boolean;
}

/**
 * The occlusion pass: GTAO with this viewer's constants, blending into the
 * frame it is handed, and nothing drawn on top of it.
 */
export function createAoPass(scene: THREE.Scene, camera: THREE.PerspectiveCamera, size: AoPassSize, options: AoPassOptions = {}): GTAOPass {
  const pass = new GTAOPass(scene, camera, size.width, size.height);
  pass.updateGtaoMaterial({
    radius: AO_RADIUS_M,
    thickness: AO_THICKNESS_M,
    samples: AO_SAMPLES,
    distanceExponent: 1,
    distanceFallOff: 1,
    scale: 1,
    // A screen-space radius would make the occlusion grow as you zoom in: a
    // reveal would darken on approach and clear on retreat. Metres do not.
    screenSpaceRadius: false,
  });
  // GTAO.OUTPUT.Default multiplies the occlusion into the colour it was given,
  // which is the whole job; the other outputs are debug views.
  pass.output = GTAOPass.OUTPUT.Default;
  pass.blendIntensity = AO_INTENSITY;
  // The occlusion and denoise buffers are written by full-screen quads that
  // neither test nor write depth, so their depth attachments are 4 bytes a
  // pixel of GPU memory for nothing — around 32 MB each on a 3840x2160 canvas.
  // Safe to set here and only here: three allocates a target's framebuffer on
  // its first bind, and this pass has not drawn yet.
  pass.gtaoRenderTarget.depthBuffer = false;
  pass.pdRenderTarget.depthBuffer = false;
  if (options.logarithmicDepthBuffer === true) linearizeLogDepth(pass, camera.near, camera.far);
  return pass;
}

/**
 * Points the pass at a camera. The pass copies the projection and view matrices
 * itself every frame, but the denoise weights read near and far through a
 * shader patch (see `linearizeLogDepth`), so they are kept in step here.
 */
export function syncAoCamera(pass: GTAOPass, camera: THREE.PerspectiveCamera): void {
  pass.camera = camera;
  const near = pass.pdMaterial.uniforms.cameraNear;
  const far = pass.pdMaterial.uniforms.cameraFar;
  if (near !== undefined) near.value = camera.near;
  if (far !== undefined) far.value = camera.far;
}

// ------------------------------------------------------------ logarithmic depth

/**
 * The window depth a standard perspective projection writes for a point at
 * view distance `viewW`, given the depth a logarithmic depth buffer wrote for
 * the same point.
 *
 * three's log depth is `gl_FragDepth = log2(1 + w) / log2(far + 1)` (from
 * `logdepthbuf_fragment`, with `logDepthBufFC = 2 / log2(far + 1)`), so the
 * inverse is `w = (far + 1)^depth - 1`, and the standard projection then gives
 * `zNdc = (f + n)/(f - n) - 2fn/((f - n)w)` and a window depth of `(zNdc + 1)/2`.
 *
 * This is the same arithmetic as the GLSL in `LOG_DEPTH_TO_STANDARD` below; the
 * test feeds this one window depths and compares, because the shader itself
 * cannot be run without a GPU.
 */
export function logDepthToStandardNdc(logWindowDepth: number, near: number, far: number): number {
  if (logWindowDepth >= 1) return 1;
  const viewW = Math.pow(far + 1, logWindowDepth) - 1;
  const zNdc = (far + near) / (far - near) - (2 * far * near) / ((far - near) * Math.max(viewW, 1e-6));
  return Math.min(Math.max((zNdc + 1) / 2, 0), 1);
}

/** `logDepthToStandardNdc`, in GLSL. Kept beside it so the two are read together. */
const LOG_DEPTH_TO_STANDARD = `
	float logDepthToStandard(const in float raw) {
		if (raw >= 1.0) return 1.0;
		float viewW = pow(cameraFar + 1.0, raw) - 1.0;
		float zNdc = (cameraFar + cameraNear) / (cameraFar - cameraNear) - (2.0 * cameraFar * cameraNear) / ((cameraFar - cameraNear) * max(viewW, 1e-6));
		return clamp((zNdc + 1.0) * 0.5, 0.0, 1.0);
	}
`;

/** The uniform declarations the linearisation needs; GTAO's own shader has them already. */
const LOG_DEPTH_UNIFORMS = "uniform float cameraNear;\n\t\tuniform float cameraFar;\n";

/**
 * Rewrites every depth fetch in the pass to linearise the log encoding.
 *
 * The viewer draws with `logarithmicDepthBuffer: true` (a 0.1–5000 m range is
 * what keeps a site free of z-fighting), and GTAO reconstructs a view position
 * from the depth it samples through the inverse projection matrix, assuming a
 * standard projection. Fed a log depth, it occludes at wrong distances: not a
 * subtle error, a wrong picture.
 *
 * Linearising here rather than turning the renderer's log depth off keeps the
 * geometry path exactly as it is — the fix is confined to the occlusion, so if
 * it were wrong only the occlusion would be wrong.
 */
function linearizeLogDepth(pass: GTAOPass, near: number, far: number): void {
  // The occlusion itself. GTAO's shader declares cameraNear and cameraFar for
  // its own projection maths, so only the body of getDepth changes.
  pass.gtaoMaterial.fragmentShader = linearizeDepthFetches(pass.gtaoMaterial.fragmentShader, "return logDepthToStandard(textureLod(tDepth, uv.xy, 0.0).DEPTH_SWIZZLING);", "");
  pass.gtaoMaterial.needsUpdate = true;

  // The edge-aware denoise, which weighs neighbours by how far their depth is
  // from the centre pixel's, keeping its own two-way depth read as it is. This
  // shader has no clipping planes, so it gets them.
  const pdBody = `#if DEPTH_VALUE_SOURCE == 1
			return logDepthToStandard(textureLod(tDepth, uv.xy, 0.0).a);
		#else
			return logDepthToStandard(textureLod(tDepth, uv.xy, 0.0).r);
		#endif`;
  pass.pdMaterial.fragmentShader = linearizeDepthFetches(pass.pdMaterial.fragmentShader, pdBody, LOG_DEPTH_UNIFORMS);
  pass.pdMaterial.uniforms.cameraNear = { value: near };
  pass.pdMaterial.uniforms.cameraFar = { value: far };
  pass.pdMaterial.needsUpdate = true;
}

/**
 * Replaces `float getDepth(const vec2 uv) { … }` in `source` with the same read
 * wrapped in `logDepthToStandard`, and inserts the helper and any uniform
 * declarations the shader is missing. Throws when the function is not there:
 * a three upgrade that rewrites the shader must be noticed, not silently
 * ignored while the occlusion draws garbage.
 */
function linearizeDepthFetches(source: string, body: string, uniformDeclarations: string): string {  const open = source.indexOf("float getDepth(const vec2 uv) {");
  if (open < 0) throw new Error("[bim-viewer-3d] the ambient occlusion shader no longer has getDepth(const vec2 uv); its depth linearisation must be revisited");
  let depth = 0;
  let close = -1;
  for (let i = source.indexOf("{", open); i < source.length; i++) {
    const char = source[i];
    if (char === "{") depth++;
    else if (char === "}" && --depth === 0) {
      close = i;
      break;
    }
  }
  if (close < 0) throw new Error("[bim-viewer-3d] the ambient occlusion shader's getDepth has no closing brace");
  const patched = `float getDepth(const vec2 uv) {\n\t\t\t${body}\n\t\t}`;
  const withHelper = `${LOG_DEPTH_TO_STANDARD.trimEnd()}\n\n\t\t${patched}`;
  const rewritten = source.slice(0, open) + withHelper + source.slice(close + 1);
  return uniformDeclarations === "" ? rewritten : injectUniforms(rewritten, uniformDeclarations);
}

/** Adds the clipping planes to a shader that has no camera; right after the depth sampler. */
function injectUniforms(source: string, declarations: string): string {
  const anchor = "uniform sampler2D tDepth;";
  const at = source.indexOf(anchor);
  if (at < 0) throw new Error("[bim-viewer-3d] the ambient occlusion denoise shader no longer samples tDepth; its depth linearisation must be revisited");
  return source.slice(0, at + anchor.length) + "\n\t\t" + declarations + source.slice(at + anchor.length);
}
