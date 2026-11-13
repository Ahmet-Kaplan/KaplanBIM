/**
 * Daylight: the sun's direction, its colour, and the one place that says which
 * lights a MutinyBIM scene gets.
 *
 * ## One source of light, not two
 *
 * The viewer used to add three lights inline: a hemisphere for the sky, a key
 * light that stood in for the sun, and a fill from the opposite side. A
 * "daylight" feature that added its own sun and its own ambient on top would
 * double the sky (a washed-out interior, every corner lifted) and put two key
 * lights in the scene casting nothing but a brighter picture. A daylight that
 * quietly replaced them would change every screenshot the moment it was
 * switched on.
 *
 * So the rig lives here and only here, and it has two settings:
 *
 * - `null`, the default: byte for byte the rig the viewer has always had — the
 *   same three lights, the same colours, the same intensities, the same key
 *   light position. Nothing changes unless somebody asks.
 * - `DEFAULT_SUN` or any other angles: the same three lights, with the key
 *   light **moved to the sun and coloured like it**. The hemisphere and the
 *   fill are untouched, so the ambient is the ambient it has always been —
 *   turning the sun on cannot double it, because there is only one sun and it
 *   is the key light.
 *
 * The renderer maps a rig onto three.js objects in exactly one place
 * (`viewer.ts`); nothing else in the package makes a light.
 *
 * ## The units
 *
 * three multiplies a directional light's contribution by `intensity` and by the
 * light's colour; these numbers are not lux, not W/m², and not candela. They are
 * relative radiance under a fixed exposure (`ACESFilmicToneMapping`, exposure
 * 1.05, set on the renderer since the viewer was written). The key light has
 * been 2.3 in these units since then, and the sun here is 2.3 too: a sun in lux
 * is about 100 000, which is a second scale and would blow the exposure out.
 *
 * ## No shadow map
 *
 * The sun casts no shadow. A shadow map that resolves a window reveal on a
 * 250 000-element model means a large map per light per frame, and this task's
 * budget rule is that a render addition is measured before it ships — which
 * cannot be done without a GPU. What replaces it is `room-daylight.ts`: the
 * interior is darker because the room advertises how much of the sky it can
 * see, not because a depth map says a wall is in the way.
 *
 * Nothing here imports three.js: this module is reachable from the `/light`
 * entry, which the Building Model surface loads before the 3D view exists.
 */

/**
 * Where the sun is, in the two angles a person actually names.
 */
export interface SunAngles {
  /** Degrees clockwise from plan north: 0 north, 90 east, 180 south, 270 west. */
  readonly azimuthDeg: number;
  /** Degrees above the horizon: 0 at sunrise or sunset, 90 at the zenith. */
  readonly altitudeDeg: number;
}

/**
 * The sun a design review wants, not the sun a render farm bakes.
 *
 * **150° (south-south-east), not 180°.** In the northern hemisphere a review
 * argues about the south elevation and the shadow it throws, so the sun sits on
 * that elevation rather than behind it. Thirty degrees off due south and not
 * zero: a sun square to a façade flattens it — every reveal and mullion loses
 * its own shadow — whereas 30° lets each jamb, reveal and mullion draw a line,
 * which is the depth a client is being shown.
 *
 * **35° up, not 60-70°.** At 35° a shadow is about 1.4 times the height of the
 * thing casting it: long enough to read the building's massing on the ground,
 * and low enough that an overhang, a balcony or a window reveal reads as depth
 * instead of as a colour. A summer-noon sun at 60°+ is what a render farm
 * defaults to and it makes a façade look like a flat card — and at 35° the
 * south façade still receives 71% of the sun's own incidence, so nothing is
 * lost in brightness to get the shadow.
 */
export const DEFAULT_SUN: SunAngles = { azimuthDeg: 150, altitudeDeg: 35 };

/**
 * How far from the origin the key light is placed, in scene metres. A
 * directional light's distance changes nothing in the picture — only its
 * direction is used — so this is chosen to sit well outside any building: far
 * enough that a future shadow camera would start beyond the model rather than
 * inside it.
 */
export const SUN_DISTANCE_M = 300;

/**
 * The sky half of the rig: a hemisphere light. Its intensity is the ambient of
 * this scene and there is no other, which is what makes "daylight on must not
 * double the ambient" a matter of arithmetic rather than of taste.
 */
export const SKY_COLOR = 0xffffff;
export const GROUND_COLOR = 0x7d8794;
export const SKY_INTENSITY = 0.95;

/** The sun, in the same relative-radiance units as the light it replaces. */
export const SUN_INTENSITY = 2.3;

/** The fill from the side the sun is not on, so a shadowed face is not black. */
export const FILL_COLOR = 0xdfe8ff;
export const FILL_INTENSITY = 0.45;
export const FILL_POSITION: SceneDirection = [-50, 30, -40];

/**
 * The key light before there was a sun to place: the rig's own history, kept
 * literal rather than re-derived from angles, because the point of "daylight
 * off" is that nothing in the picture changed.
 */
export const LEGACY_KEY_COLOR = 0xfff6ea;
export const LEGACY_KEY_POSITION: SceneDirection = [60, 100, 35];

/** A direction in scene axes: X east, Y up, Z south (`coords.ts`). */
export type SceneDirection = readonly [number, number, number];

/**
 * The direction **to** the sun — the unit vector a surface's normal is dotted
 * with to get the cosine of the sun's incidence on it.
 *
 * Scene axes, so `+X` is east, `+Y` is up and `+Z` is south (kernel plan north
 * is scene `-Z`, `coords.ts`). Azimuth counts clockwise from north, which is
 * the reading a compass gives and the one `orientation.ts` uses.
 *
 * Not clamped: an altitude below the horizon is the sun under the ground, and
 * the arithmetic that follows then gives a zero cosine, which is the answer —
 * nothing is lit from beneath. `sceneLightRig` is what a caller should use
 * while somebody is choosing a sun.
 */
export function sunDirection(sun: SunAngles): SceneDirection {
  const azimuth = (sun.azimuthDeg * Math.PI) / 180;
  const altitude = (sun.altitudeDeg * Math.PI) / 180;
  const horizontal = Math.cos(altitude);
  return [horizontal * Math.sin(azimuth), Math.sin(altitude), -horizontal * Math.cos(azimuth)];
}

/** Where the key light goes for this sun, in scene metres. */
export function sunPosition(sun: SunAngles): SceneDirection {
  const direction = sunDirection(sun);
  return [direction[0] * SUN_DISTANCE_M, direction[1] * SUN_DISTANCE_M, direction[2] * SUN_DISTANCE_M];
}

/**
 * The colour temperature of sunlight, by altitude, in kelvin, linearly
 * interpolated between the points below and clamped at the ends.
 *
 * The reason it moves at all: low sunlight crosses forty times as much
 * atmosphere as a high sun does, and the atmosphere scatters the blue out of it.
 * A sun at the horizon is the deep orange of a sunset at about 1900 K; a sun
 * overhead is close to neutral white at 6000 K. Lighting every altitude with
 * one white makes a 10 a.m. sun look like noon and an evening shadow look
 * indoor.
 *
 * The points, and why they are what they are:
 *
 * | altitude | kelvin | what it is |
 * |---|---|---|
 * | 0° | 1900 | on the horizon, the red of a sunset |
 * | 10° | 2700 | an hour after sunrise: warm, still clearly tinted |
 * | 30° | 4500 | mid-morning: warm white, the design-review range |
 * | 60° | 5500 | near the D55 the word "daylight white" is defined at |
 * | 90° | 6000 | zenith sun: slightly cooler than D55 |
 */
export function sunColorTemperatureK(altitudeDeg: number): number {
  const points: readonly (readonly [number, number])[] = [
    [0, 1900],
    [10, 2700],
    [30, 4500],
    [60, 5500],
    [90, 6000],
  ];
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (!(altitudeDeg > first[0])) return first[1];
  if (altitudeDeg >= last[0]) return last[1];
  for (let i = 1; i < points.length; i++) {
    const [hiAltitude, hiKelvin] = points[i]!;
    if (altitudeDeg > hiAltitude) continue;
    const [loAltitude, loKelvin] = points[i - 1]!;
    const t = (altitudeDeg - loAltitude) / (hiAltitude - loAltitude);
    return loKelvin + t * (hiKelvin - loKelvin);
  }
  return last[1];
}

/** The lowest colour temperature this module will render, in kelvin. */
const MIN_KELVIN = 1000;
/** The highest: past about 12 000 K the blue end stops moving anyway. */
const MAX_KELVIN = 12_000;

/**
 * A black-body colour temperature as an sRGB hex, the same shape as the hex
 * codes the rig has always carried (so `new THREE.Color(hex)` treats the two
 * identically).
 *
 * Tanner Helland's closed-form approximation: rgb is 255 at the red end, falls
 * as `ln(t)` towards the middle, and comes back up at the blue end, with a
 * power law above 6600 K. It is accurate to a few percent against the Planckian
 * locus over the range this module uses, which is far finer than the difference
 * between one sun and another is visible. Trigonometry and logarithms, no
 * dependency.
 */
export function colorTemperatureRgb(kelvin: number): number {
  const k = Math.min(MAX_KELVIN, Math.max(MIN_KELVIN, Number.isFinite(kelvin) ? kelvin : 6500));
  const t = k / 100;
  const clamp = (value: number): number => Math.min(255, Math.max(0, Math.round(value)));
  const red = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const green = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const blue = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return (clamp(red) << 16) | (clamp(green) << 8) | clamp(blue);
}

/** The sun's colour for these angles, as sRGB, following its colour temperature. */
export function sunColor(sun: SunAngles): number {
  return colorTemperatureRgb(sunColorTemperatureK(sun.altitudeDeg));
}

/** A light the scene is to be given, in the terms three.js takes it in. */
export interface HemisphereDescription {
  readonly kind: "hemisphere";
  readonly skyColor: number;
  readonly groundColor: number;
  readonly intensity: number;
}

export interface DirectionalDescription {
  readonly kind: "directional";
  readonly color: number;
  readonly intensity: number;
  /** Scene metres; only the direction from the origin is used. */
  readonly position: SceneDirection;
  /**
   * Always false, and stated rather than omitted: no shadow map is built for
   * this light. See the module comment.
   */
  readonly castsShadow: false;
}

/** Everything a scene's light is, in one readable object. */
export interface SceneLightRig {
  readonly hemisphere: HemisphereDescription;
  readonly key: DirectionalDescription;
  readonly fill: DirectionalDescription;
}

/**
 * The scene's lights for a sun, or for no sun at all.
 *
 * `null` returns the rig the viewer had before daylight existed, exactly; a sun
 * moves the key light onto it and leaves the sky and the fill alone. Either way
 * it is three lights, and the hemisphere — the only ambient in the scene — has
 * the same intensity, so switching daylight on cannot wash the interior out.
 */
export function sceneLightRig(sun: SunAngles | null): SceneLightRig {
  return {
    hemisphere: { kind: "hemisphere", skyColor: SKY_COLOR, groundColor: GROUND_COLOR, intensity: SKY_INTENSITY },
    key:
      sun === null
        ? { kind: "directional", color: LEGACY_KEY_COLOR, intensity: SUN_INTENSITY, position: LEGACY_KEY_POSITION, castsShadow: false }
        : { kind: "directional", color: sunColor(sun), intensity: SUN_INTENSITY, position: sunPosition(sun), castsShadow: false },
    fill: { kind: "directional", color: FILL_COLOR, intensity: FILL_INTENSITY, position: FILL_POSITION, castsShadow: false },
  };
}
