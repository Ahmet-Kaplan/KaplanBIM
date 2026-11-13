# Render quality

What the 3D view does to a frame after the model is drawn, the constants that
shape it, and how a change to any of it is judged. `docs/architecture/viewers.md`
is the contract for the viewer as a whole; this page is about the picture.

Three effects exist: **ambient occlusion**, **temporal anti-aliasing** and
**daylight**. All three are **off by default**, and the reason is at the bottom:
nobody can measure a frame in CI, so a change that turns one on by default would
regress the default path with no number to catch it.

## The pipeline

`packages/bim-viewer-3d/src/post/render-pipeline.ts`.

```ts
createRenderPipeline(renderer, scene, camera, { ao?: boolean, taa?: boolean })
  .render() · .resize(w, h) · .dispose() · .stats()
```

**With both off it is not a pipeline at all**: one `renderer.render(scene, camera)`
with the arguments the viewer made before the file existed — no composer, no
render target, nothing to leak. `stats().passes` is `1`. That invariant is pinned
by a test, and it is what keeps "turn it off" a real escape hatch rather than a
slower path with the effects skipped.

**The order is the argument.** Occlusion → temporal resolve → tone mapping and
sRGB output. Tone mapping last, because it is a display transform: applying it
before occlusion would have AO gathered over display-referred values, which is
the reason a naive pipeline's corners look like dirt rather than like corners.

**Occlusion is 3D-only, anti-aliasing is not.** A plan or parallel view is a
*drawing* of a model, not a picture of one, and GTAO fixes its projection mode
when the pass is built. Temporal AA applies in both, because a plan view is
exactly the frame a composer's render target took hardware MSAA away from.

## Ambient occlusion

`packages/bim-viewer-3d/src/post/ao.ts`. GTAO, in world space.

| constant | value | why that number |
|---|---|---|
| `AO_INTENSITY` | `0.8` | `1` takes an enclosed point to black; `0.8` leaves a fifth of its light, so a corner deepens and reads as a corner rather than as dirt, and a room lit from one window still shows the shape of the far wall |
| `AO_RADIUS_M` | `0.5` m | half a metre is the scale of a building's joints — a door reveal, the foot of a wall, a slab meeting a partition. Under a quarter metre nothing architectural is wide enough to darken; at a metre or more the kernel spans the whole reveal and **the façade goes muddy** |
| `AO_SAMPLES` | `16` | GTAO's own default, and the point where the grain the Poisson denoise must hide is small enough that a still frame reads clean; halving it doubles the noise the denoise then blurs away |
| `AO_THICKNESS_M` | `1` m | thicker than a wall, a slab or a duct, so a surface is occluded by the thing beside it and **not** by the room beyond that thing |

The radius is the constant that matters most, and it is the one a reviewer should
challenge: it is the whole difference between depth and a smear on a large
façade.

## Temporal anti-aliasing

`packages/bim-viewer-3d/src/post/taa.ts`.

A composer renders to a target, and a render target does not get the hardware
MSAA the `WebGLRenderer` was created with. So adding occlusion would make edges
*worse* than before unless something replaces it — which is why this is not
optional polish.

| constant | value | why that number |
|---|---|---|
| `TAA_JITTER_SAMPLES` | `8` | the sub-pixel offsets cycle before repeating; 8 spreads them over the pixel without a visible pattern |
| `TAA_BLEND` | `0.9` | a history weight of 0.9 is an exponential window of `1/(1-0.9)` = **10 frames** — smooth on a still frame |
| `TAA_MOTION_BLEND` | `0.1` | while the camera moves, the last frame is nearly gone: `1/(1-0.1)` = **1.1 frames**, which leaves no trail |
| `TAA_MOTION_STOPPED` | `0.05` rad | below this per-frame rotation the camera counts as still, and the blend ramps back to `TAA_BLEND` |
| `TAA_SETTLE_FRAMES` | `6` | frames to return to full history after motion stops |
| `TAA_RESET_MOTION` | `8` | a jump this large (a view change, not a drag) discards history instead of blending across unrelated frames |

**The motion response is the point.** A temporal filter that only looks good on a
still frame is a filter that smears every pan. Still and moving differ by **9×**
in history weight, and the difference is asserted by a test rather than described
here.

The jitter lives on the camera for the length of one frame and is restored in a
`finally`, so a thrown frame does not leave the camera permanently offset.

## Daylight

`packages/bim-viewer-3d/src/atmosphere/daylight.ts` (the sun) and
`room-daylight.ts` (how much of it reaches a room).

**The lights are one place.** `sceneLightRig(sun)` replaces the viewer's key
light; it does not join it. A second ambient on top of the existing one gives a
washed-out interior, and replacing the lights silently would change every
screenshot — so the rig is a single function and a test asserts that turning
daylight on adds **no** light and changes **no** total ambient.

| constant | value | why |
|---|---|---|
| `DEFAULT_SUN` | azimuth `150°`, altitude `35°` | a design review wants a sun that shows a façade's depth without raking it flat |
| `SUN_INTENSITY` | `2.3` | in the rig's existing units — the daylight stays in one scale rather than introducing a second |
| `SKY_INTENSITY` | `0.95`, `SKY_COLOR` / `GROUND_COLOR` | the hemisphere around the sun |
| `SUN_DISTANCE_M` | `300` | far enough that the direction is what matters, near enough for depth precision |
| no shadow map | — | a shadow map that resolves a window reveal is not free, and the 3D budgets are unmeasured (below), so casting shadows would be an unmeasured cost. Stated, not hidden. |

**The room model is arithmetic, not a simulation**, and its limits are the
reason to trust it:

- **no reflected light** — real rooms get much of their daylight bounced off
  walls and floor; this counts only what arrives straight through an opening, so
  its number is **pessimistic**, the right direction to be wrong in for a room
  being judged
- **no glazing depth, frames or shading** — a reveal, a mullion, a blind, a
  balcony soffit, a neighbouring building and a tree all reduce daylight in life
  and none is a term. `DAYLIGHT_TRANSMITTANCE` (0.6) absorbs the glass and
  nothing else
- **no room shape** — light is spread evenly over the surface area, so a room
  reads the same whether the window is beside the desk or in a far corner. Real
  daylight falls off steeply with distance from a window
- **no opening height** — a high window throws light further than a low one of
  the same area
- **a door is a door** (`DOOR_TRANSMITTANCE` 0.06, not the window's 0.6), and an
  opening with a room on both sides is an interior door that gives nothing

## Why all three are off by default

`packages/bim-viewer-3d` is render code whose cost the gate **cannot measure**.
Four browser-scope rows exist in `docs/perf/mutinybim-budgets.json`
(`3d.synthetic.load`, `3d.edit.redraw`, `3d.frame.weak`,
`part.mesh.instanced.draw`), and they report **`NOT-MEASURED`** — not "not
applicable": the suite that would consume them has never existed in this
repository, its fixture is private client data, and no runner here installs a
browser. `docs/PERFORMANCE.md` §*The 3D rows: a person measures these* has the
hand method.

So the honest position is:

- **a feature that is off cannot regress the default frame**, and the default
  frame is the one nobody can measure;
- turning one on is a **decision with a measurement behind it**, made by a person
  on the reference hardware, not a default that arrives in a pull request;
- the pass-through invariant (one `renderer.render`, `passes === 1`) is the test
  that keeps "off" meaning off.

## What this page cannot tell you

Nothing here has been seen on a screen by its author. Every claim above is from
the code and from jest tests that run without a GPU. Unverified, and to be
checked on hardware before this is called done:

- that a sunlit interior reads the way a person expects, and that a shadow would
  improve it
- that AO at 0.5 m looks like depth on a façade rather than a smear
- that TAA removes jaggies on a still frame and leaves no trail on a pan
- the cost of any of it: bytes of render targets are arithmetic (a 1920×1080
  half-float target is ~16 MB), **frame time is not**.

Check all four in **light and dark** (the theme rule is for screens; AO and
daylight are shading and must not tint), then record what you measured next to
the budget row it belongs to.
