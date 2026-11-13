# Viewers and the shared look

## What it owns

| Package | What it draws | What it may not know |
|---|---|---|
| `packages/bim-ui` | The theme (`theme.ts`, `color-scheme.ts`, `theme-css.ts`), the primitives (`src/ui/*`), i18n, brand marks, window controls | Nothing about a model. It imports **no** `@permitzip` package at all — React, i18next and radix only |
| `packages/bim-viewer` | The dev baseline page: an SVG plan, a live sheet, presence, drag-to-move and a schedules demo (`src/app.ts:57`, `src/schedules-demo.ts:1`) | The editor's business: there is no import of `@permitzip/bim-editor` anywhere in it |
| `packages/bim-viewer-3d` | WebGL solids, picking, crop boxes, level planes, framing, orientation, IFC import, the walkthrough (`src/viewer.ts`, `viewer-colors.ts`, `walkthrough.ts`) | Model *meaning*: it is handed a scene and colours, not a tool or a command |
| `packages/bim-grid` | A virtualised, editable data grid with its own range selection and TSV clipboard (`src/DataGrid.tsx`, `virtual.ts`, `tsv.ts`) | Any host's look or words: peer dependency `react` and nothing else |

None of the four imports the editor; none of them creates a provider; none of them
reaches for a host's router, storage or sign-in. `bim-viewer` and `bim-viewer-3d`
peer-depend on the kernel and `bim-sync` — they read a model and speak the wire
protocol, and that is the whole of their coupling. `bim-viewer-3d` also
peer-depends on `bim-geometry`, layer 0, for the walkthrough's collider world.

## Walking the model

The walkthrough is a viewer feature, not an editor one. The viewer owns the
camera, and the camera becoming a person is the same kind of change as the
camera tilting down into plan.

Four pieces, each where its layer allows:

| File | Layer | What it is |
|---|---|---|
| `packages/bim-geometry/src/collider-world.ts` | L0 | Upright boxes, a plan grid over them, a circle sliding along a face, a floor under a point. Pure: no three.js, no kernel, no DOM |
| `packages/bim-viewer-3d/src/walkthrough-collider.ts` | viewer | The solids the viewer already draws, turned into collider boxes, grouped by storey and built the first time somebody walks into one |
| `packages/bim-viewer-3d/src/walkthrough.ts` | viewer | The person: eye height, pace, gravity, the storey they stay on. The human constants live here, named |
| `packages/bim-viewer-3d/src/walkthrough-input.ts` | viewer | Keys, pointer capture, Escape. The only part a test without a browser cannot reach |

`ModelViewer3D.enterWalkthrough()` / `exitWalkthrough()` are the whole public
surface, plus `onWalkthroughChange` so a host can draw the way in and the way
out. **The viewer draws no walking chrome**: the button and the "W A S D, Esc"
line are the editor's (`WalkthroughOverlay.tsx`), keyed like every other caption.
The single exception is the headset entry below, which no host can draw without
asking this package's presentation what the browser supports.

Two rules that are easy to break and were the point of the design:

- **A walk that meets nothing must be returned unchanged, bit for bit.** A
  movement resolver that rounds or snaps makes an open room feel sticky. The
  test asserts `toBe`, not `toBeCloseTo`.
- **Lazily, per storey.** A collider world for a 250,000-element model at once is
  a stall nobody forgives, and a walker needs one storey. The solids are grouped
  by storey when the model lands (an index, not a build); a storey's world is
  built on first use and a handful are kept (`PartitionColliders.MAX_BUILT`).

## Presenting in a headset

`src/xr/presentation.ts` is the WebXR half of the walkthrough. It is a browser
API, not a dependency, and it is **asked, never assumed**: `navigator.xr` may be
absent, present with `isSessionSupported('immersive-vr')` false (every phone, most
desktops), or present and able. Only the last state is offered anything, and the
entry is empty — no button, nothing to focus — in the other two. A button that
cannot work is worse than no button; `ThemeToggle` follows the same rule.

**The walker carries the headset; the headset does not drive the walker.** The
session's reference space is `local-floor`, so y = 0 is the floor the person
stands on, and the walker's feet are that origin: three.js adds the head's own
pose on top of it. Walking is the hand controllers' thumbstick, pressed through
the *same* `Walker.advance` the keyboard presses — same pace, same colliders,
same stairs, same doors — and the head's yaw becomes the walker's yaw each frame
so "forward" means where the person is looking. The other way round was refused:
a headset pose is a physical person in a room the app cannot refuse, so a walker
that followed the head would walk through walls and could only cross a two-metre
play area.

Two consequences worth knowing before touching it:

- **A refusal is the normal case.** `enterPresentation()` returns
  `"not-available"` or `"refused"`; nothing is thrown, no session is left
  half-started, no key is left held and the flat view is untouched.
- **A headset frame is drawn straight to its framebuffer**, not through the
  `post/` pipeline: a composer's render targets hold one picture and a headset
  needs two. Ambient occlusion and TAA are left out in XR rather than drawn
  wrong.

The one caption this package draws is the entry button, because no host can know
whether the browser can present without asking it. Its colours, radius and font
are `--mutiny-*` variables; a host with its own chrome may draw a `bim-ui`
`Button` on `viewer.enterPresentation()` instead.

## The contract

1. **The theme rule is absolute.** Every colour, font and radius comes from a
   `--mutiny-*` variable. No hex in a stylesheet, no hex in a component, no inline
   `style={{ color }}`, no one-off palette. Light, dark and the computer's setting all
   come from `mutinyDefaultTheme` / `mutinyDarkTheme`: React screens get the variables
   from `MutinyThemeProvider`, server-rendered pages from `themeStyleSheet()`
   (`packages/bim-ui/src/theme-css.ts:11`).
2. **The only hex lives in two files** — `packages/bim-ui/src/theme.ts` and
   `src/color-scheme.ts`, where the variables are defined. That is not a convention:
   it is the whitelist the guard scans against.
3. **Paper is the exception.** Printed sheets and issued PDFs stay black on white and
   never read the theme. So do the stored colours a model carries: a discipline's
   colour, a system's graphic colour, a person's presence colour, and the parseable
   hex WebGL needs.
4. **Components are reused, not re-implemented.** `Button`, `Badge`, `Alert`, `Card`,
   `Input`, `Textarea`, `NativeSelect`, `Label`, `Field`, `Empty`, `Separator`,
   `Spinner`, `Tooltip`, `ToggleGroup`, `ThemeToggle` are exported from
   `@permitzip/bim-ui` (`src/index.ts:11-15`). The editor draws no `<button>` of its own
   — a search for one under `packages/bim-editor/src` and
   `apps/mutinybim-web/src` returns nothing.
5. **A missing primitive is added, not copied.** If a screen needs something
   `bim-ui/src/ui/` lacks, it goes there in the same change, with `--mutiny-*` colours
   only, and the screen uses it. A styled local copy is the failure.
6. **A viewer takes the theme, it does not pick colours.** `bim-viewer-3d` reads
   `viewer-colors.ts`; `bim-grid` is styled by `grid.css`; `bim-viewer` by
   `viewer.css`. Each of those files reads `--mutiny-*` and is inside the guard.

One honest exception: `bim-grid` keeps its own cell primitives —
`GridButton`, `CellInput`, `CellSelect` in `src/components/ui/cell-controls.tsx:1-26` —
hand-rolled and styled by `grid.css` rather than Tailwind, so the grid draws the same
in any host. It is exempt from rule 4 in practice, not in writing, and no test says
so.

## How it goes wrong

- **A hex in a stylesheet.** `color: #f2611d` looks innocent until dark mode ships and
  the screen keeps its light accent. The same defect wearing a variable's name: a
  fallback (`var(--mutiny-panel, #f2f3f4)`) or a variable that exists in light and not
  in dark.
- **A colour through an inline style.** `style={{ color: '#5d6670' }}` on a table row,
  or `backgroundColor: 'rgba(0,0,0,.2)'` — invisible to a `className` audit.
- **A hand-rolled button.** A `<button>` with its own padding and border makes one
  screen disagree with every other screen's hover, focus ring and disabled state. *Tell:*
  a component file that imports no primitive from `@permitzip/bim-ui`.
- **A component that reaches for the kernel.** A `bim-ui` primitive importing
  `@permitzip/bim-kernel` would drag the engine into every page that shows a badge.
- **A viewer that imports the editor.** `bim-viewer` importing a screen from
  `bim-editor` inverts the layer and puts the whole editor in the first download of a
  read-only page.
- **A one-off palette.** A local stylesheet that picks its own greys reads as a
  different product in the same window.

## Where the guard is

`packages/bim-ui/__tests__/theme-token-compliance.test.ts`.

- **What it scans.** Every `.css`, `.ts` and `.tsx` under `packages/*/src` and
  `apps/*/src` — over 200 files, and it asserts it found that many, naming
  `packages/bim-viewer/src/viewer.css`, `packages/bim-schedules-ui/src/schedules.css`,
  `packages/bim-grid/src/grid.css` and `apps/mutinybim-web/src/app.ts` as files it must
  have covered.
- **Three rules.** No hex outside the theme's two files (hex in a `url(#id)` reference
  and `&nbsp;`-style character references do not count); no colour set through
  `style={{ … }}` unless it is a `var(--mutiny-…)`; every `--mutiny-*` a package
  *reads* exists in **both** themes.
- **What it exempts,** each with the mechanism that makes the hex content rather than
  styling: discipline and system colours and element graphics stored in the model,
  drawing and diagram output that prints on paper, title-block and rich-text colour,
  the presence colours in the sync protocol, the 3D viewer's WebGL colours, the image
  an agent is shown, and one skill file's text.
- **It proves each exemption is real.** Every exempted path must still exist **and**
  still contain hex; an exemption whose file was deleted, or whose hex is gone, fails
  the guard. That is what stops the list from quietly becoming a place to put files.
- **It proves it bites.** A self-test plants the shapes it must reject (`color: #f2611d`,
  a hex fallback, `fill: #dbeafe`, an inline `borderColor`) and the shapes it must
  accept (`var(--mutiny-text)`, `url(#drop-shadow)`) and asserts both sides.

No guard forbids a viewer importing the editor, and no guard requires a new primitive
to land in `bim-ui` rather than beside its screen. Both are review-only, and the second
is the one that decays quietly.
