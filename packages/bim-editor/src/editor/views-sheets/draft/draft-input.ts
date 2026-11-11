import {
  DETAIL_COMPONENTS,
  DRAFTING_SCHEMA_VERSION,
  draftingVersionOf,
  detailComponents,
  chainLines,
  detailComponent,
  detailSnap,
  polygonLines,
  trackAngle,
  type BatchCommand,
  type DimSpec,
  type DimensionKind,
  type DrawingItem,
  type DrawingShape,
  type HatchPattern,
  type LinePattern,
  type LineWeight2D,
  type ModifyOp,
  type SnapKind,
  type Vec2,
  type ViewCommand,
} from '@permitzip/bim-kernel'
import type { SnapPoint } from '../annotation-tools'
import { englishOnly, type Translate } from '../../i18n/translate'

/**
 * The Draft tools' state machine, pure: what each click means for the tool or
 * modify operation in hand, where a click snaps or tracks to, the prompt to
 * show, and the kernel command it ends in. The canvas forwards its pointer and
 * key events here (no listeners of its own) and sends what comes back.
 *
 * Points are paper mm while collecting; `toStored` turns them into the owner's
 * coordinates (model mm in a view, paper mm on a sheet) for the command.
 */

export interface DraftSettings {
  readonly weight: LineWeight2D
  readonly pattern: LinePattern
  readonly hatch: HatchPattern
  /** The Region tool draws a masking region (white, no outline) instead of a hatch. */
  readonly masking: boolean
  readonly symbolId: string
  /** Typed values: batt thickness, component size, repeat spacing; inches, or feet-inches like 2'-6". */
  readonly battThickness: string
  readonly snaps: readonly SnapKind[]
  /** Square to the paper (F8). */
  readonly ortho: boolean
  /** Polar tracking increment in degrees, or off. */
  readonly polarDeg: number | null
  readonly dimKind: DimensionKind
  readonly dimChain: 'single' | 'continuous' | 'baseline'
  /** Polygon: how many sides (3 to 64), and whether the clicked point is a corner (inscribed) or the middle of a side (circumscribed). */
  readonly polygonSides: string
  readonly polygonInscribed: boolean
}

export const DEFAULT_DRAFT_SETTINGS: DraftSettings = {
  weight: 'medium',
  pattern: 'solid',
  hatch: 'diagonal',
  masking: false,
  symbolId: DETAIL_COMPONENTS[0]?.id ?? 'gate_valve',
  battThickness: '2"',
  snaps: ['endpoint', 'midpoint', 'center', 'intersection', 'perpendicular'],
  ortho: false,
  polarDeg: null,
  dimKind: 'linear',
  dimChain: 'single',
  polygonSides: '6',
  polygonInscribed: true,
}

/** Typed values for the modify operation in hand. */
export interface ModifyParams {
  readonly angle: string
  readonly factor: string
  readonly count: string
  readonly distance: string
  readonly copy: boolean
  /** Offset: a typed distance, or two clicks that show it (graphical). */
  readonly offsetMode: 'numerical' | 'graphical'
  /** Offset leaves the original and adds the parallel copy (unchecked: the original moves). */
  readonly offsetCopy: boolean
  /** Split Element: a second click on the same line, and the piece between the two is deleted. */
  readonly deleteInner: boolean
  /** Split with Gap: the gap's length. */
  readonly gap: string
  /** Fillet Arc: the arc's radius. */
  readonly arcRadius: string
}

export const DEFAULT_MODIFY_PARAMS: ModifyParams = { angle: '90', factor: '2', count: '3', distance: '6"', copy: false, offsetMode: 'numerical', offsetCopy: true, deleteInner: false, gap: '1"', arcRadius: '6"' }

export const MODIFY_OPS = [
  'move',
  'copy',
  'rotate',
  'mirror',
  'scale',
  'array',
  'polar_array',
  'align',
  'offset',
  'trim_extend_corner',
  'trim_extend_single',
  'trim_extend_multiple',
  'split',
  'split_gap',
  'fillet_arc',
  'pin',
  'unpin',
] as const
export type ModifyOpName = (typeof MODIFY_OPS)[number]

/**
 * Operations you start with nothing selected and then click the elements
 * (BIM drafting-view conventions): the clicks name the lines, and the tool
 * stays in hand for the next ones until Esc.
 */
export const PICK_ELEMENT_OPS: ReadonlySet<ModifyOpName> = new Set<ModifyOpName>(['trim_extend_corner', 'trim_extend_single', 'trim_extend_multiple', 'split', 'split_gap', 'fillet_arc'])

/** Something waiting for clicks besides a drawing tool: a modify operation, or a leader for a note. */
export type DraftPending = { readonly kind: 'modify'; readonly op: ModifyOpName } | { readonly kind: 'leader'; readonly noteId: string; readonly elbow: boolean } | null

/**
 * What each modify operation is called, in the language on screen (§3's commands:
 * Trim → Kısalt, Extend → Uzat, Fillet → Yuvarlat, Mirror → Aynala, Align → Hizala).
 * An accessor rather than a table, so the words are asked for where they are drawn.
 */
export function modifyLabel(op: ModifyOpName, t: Translate = englishOnly): string {
  switch (op) {
    case 'move':
      return t('draft.op.move', 'Move', { ns: 'editor' })
    case 'copy':
      return t('draft.op.copy', 'Copy', { ns: 'editor' })
    case 'rotate':
      return t('draft.op.rotate', 'Rotate', { ns: 'editor' })
    case 'mirror':
      return t('draft.op.mirror', 'Mirror', { ns: 'editor' })
    case 'scale':
      return t('draft.op.scale', 'Scale', { ns: 'editor' })
    case 'array':
      return t('draft.op.array', 'Array', { ns: 'editor' })
    case 'polar_array':
      return t('draft.op.polarArray', 'Radial array', { ns: 'editor' })
    case 'align':
      return t('draft.op.align', 'Align', { ns: 'editor' })
    case 'offset':
      return t('draft.op.offset', 'Offset', { ns: 'editor' })
    case 'trim_extend_corner':
      return t('draft.op.trimCorner', 'Trim/Extend to Corner', { ns: 'editor' })
    case 'trim_extend_single':
      return t('draft.op.trimSingle', 'Trim/Extend Single', { ns: 'editor' })
    case 'trim_extend_multiple':
      return t('draft.op.trimMultiple', 'Trim/Extend Multiple', { ns: 'editor' })
    case 'split':
      return t('draft.op.split', 'Split Element', { ns: 'editor' })
    case 'split_gap':
      return t('draft.op.splitGap', 'Split with Gap', { ns: 'editor' })
    case 'fillet_arc':
      return t('draft.op.filletArc', 'Fillet Arc', { ns: 'editor' })
    case 'pin':
      return t('draft.op.pin', 'Pin', { ns: 'editor' })
    case 'unpin':
      return t('draft.op.unpin', 'Unpin', { ns: 'editor' })
  }
}

/** What each pick of a modify operation is, in order. An empty list runs on the typed values alone. */
export function modifyPicks(op: ModifyOpName, params: Pick<ModifyParams, 'deleteInner' | 'offsetMode'>, t: Translate = englishOnly): readonly string[] {
  switch (op) {
    case 'move':
      return [t('draft.pick.basePoint', 'Click the base point', { ns: 'editor' }), t('draft.pick.whereItGoes', 'Click where it goes', { ns: 'editor' })]
    case 'copy':
      return [t('draft.pick.basePoint', 'Click the base point', { ns: 'editor' }), t('draft.pick.whereCopyGoes', 'Click where the copy goes', { ns: 'editor' })]
    case 'rotate':
      return [t('draft.pick.centreToTurn', 'Click the centre to turn about', { ns: 'editor' })]
    case 'mirror':
      return [
        t('draft.pick.mirrorFirst', 'Click the first point of the mirror line', { ns: 'editor' }),
        t('draft.pick.mirrorSecond', 'Click the second point of the mirror line', { ns: 'editor' }),
      ]
    case 'scale':
      return [t('draft.pick.basePointStays', 'Click the base point that stays put', { ns: 'editor' })]
    case 'array':
      return [t('draft.pick.basePoint', 'Click the base point', { ns: 'editor' }), t('draft.pick.nextCopyGoes', 'Click where the next copy goes', { ns: 'editor' })]
    case 'polar_array':
      return [t('draft.pick.arrayCentre', 'Click the centre of the array', { ns: 'editor' })]
    case 'align':
      return [
        t('draft.pick.alignOnSelection', 'Click the point on the selection to line up', { ns: 'editor' }),
        t('draft.pick.alignFirst', 'Click the first point of the line to align to', { ns: 'editor' }),
        t('draft.pick.alignSecond', 'Click the second point of that line', { ns: 'editor' }),
      ]
    case 'offset':
      if (params.offsetMode === 'graphical')
        return [
          t('draft.pick.offsetMeasureFrom', 'Click a point to measure the offset from', { ns: 'editor' }),
          t('draft.pick.whereOffsetGoes', 'Click where the offset goes', { ns: 'editor' }),
        ]
      return [t('draft.pick.offsetSide', 'Click the side to offset to', { ns: 'editor' })]
    case 'trim_extend_corner':
      return [
        t('draft.pick.trimFirstKeep', 'Click the first line or arc, on the part to keep', { ns: 'editor' }),
        t('draft.pick.trimSecondKeep', 'Click the second, on the part to keep', { ns: 'editor' }),
      ]
    case 'trim_extend_single':
      return [
        t('draft.pick.trimBoundary', 'Click the boundary to trim or extend to', { ns: 'editor' }),
        t('draft.pick.trimTarget', 'Click the line or arc to trim or extend, on the part to keep', { ns: 'editor' }),
      ]
    case 'trim_extend_multiple':
      return [
        t('draft.pick.trimBoundary', 'Click the boundary to trim or extend to', { ns: 'editor' }),
        t('draft.pick.trimEach', 'Click each line or arc to trim or extend, on the part to keep', { ns: 'editor' }),
      ]
    case 'split':
      if (params.deleteInner)
        return [
          t('draft.pick.splitFirst', 'Click the line or arc at the first split', { ns: 'editor' }),
          t('draft.pick.splitSecondGone', 'Click it again at the second split (the piece between goes)', { ns: 'editor' }),
        ]
      return [t('draft.pick.splitWhere', 'Click the line or arc where it splits', { ns: 'editor' })]
    case 'split_gap':
      return [t('draft.pick.splitGapWhere', 'Click the line or arc where the gap goes', { ns: 'editor' })]
    case 'fillet_arc':
      return [t('draft.pick.filletFirst', 'Click the first line', { ns: 'editor' }), t('draft.pick.filletSecond', 'Click the second line', { ns: 'editor' })]
    case 'pin':
    case 'unpin':
      return []
  }
}

/** Which picks name an element rather than a point. */
const ITEM_PICKS: Partial<Record<ModifyOpName, readonly number[]>> = {
  trim_extend_corner: [0, 1],
  trim_extend_single: [0, 1],
  trim_extend_multiple: [0, 1],
  split: [0, 1],
  split_gap: [0],
  fillet_arc: [0, 1],
}

/** UI-only drawing tools: a polygon is drawn as joined lines, not stored as its own shape. */
export type DraftToolShape = DrawingShape | 'polygon'
export const DRAFT_SHAPES = ['arc', 'circle', 'polyline', 'polygon', 'spline', 'region', 'component', 'repeat', 'batt'] as const satisfies readonly DraftToolShape[]
export type DraftShape = (typeof DRAFT_SHAPES)[number]
export function isDraftShape(tool: string): tool is DraftShape {
  return (DRAFT_SHAPES as readonly string[]).includes(tool)
}

/** Dimension kinds the click flow draws (linear and aligned single dimensions are a drag). */
export function clickDimension(s: Pick<DraftSettings, 'dimKind' | 'dimChain'>): boolean {
  return !((s.dimKind === 'linear' || s.dimKind === 'aligned') && s.dimChain === 'single')
}

/** Clicks a tool takes: a number, or 'open' (Enter or double-click finishes; min clicks). */
export function clicksFor(tool: DraftShape | 'dimension', s: Pick<DraftSettings, 'dimKind' | 'dimChain'>): { readonly fixed: number } | { readonly min: number } {
  switch (tool) {
    case 'component':
      return { fixed: 1 }
    case 'circle':
    case 'polygon':
    case 'repeat':
    case 'batt':
      return { fixed: 2 }
    case 'arc':
      return { fixed: 3 }
    case 'polyline':
    case 'spline':
      return { min: 2 }
    case 'region':
      return { min: 3 }
    case 'dimension':
      if (s.dimKind === 'angular' || s.dimKind === 'arc_length') return { fixed: 3 }
      if (s.dimKind === 'radial' || s.dimKind === 'diameter' || s.dimKind === 'spot_elevation' || s.dimKind === 'spot_coordinate') return { fixed: 2 }
      return { min: 2 }
  }
}

/** What each click of a drawing tool asks for, in the language on screen. */
function shapePrompts(tool: DraftShape, t: Translate): readonly string[] {
  switch (tool) {
    case 'arc':
      return [
        t('draft.prompt.arcCentre', 'Click the centre of the arc', { ns: 'editor' }),
        t('draft.prompt.arcStart', 'Click where the arc starts', { ns: 'editor' }),
        t('draft.prompt.arcEnd', 'Click where it ends (counter-clockwise)', { ns: 'editor' }),
      ]
    case 'circle':
      return [t('draft.prompt.circleCentre', 'Click the centre', { ns: 'editor' }), t('draft.prompt.circlePoint', 'Click a point on the circle', { ns: 'editor' })]
    case 'polyline':
      return [
        t('draft.prompt.firstPoint', 'Click the first point', { ns: 'editor' }),
        t(
          'draft.prompt.polylineNext',
          'Click the next point. Each segment is its own line, joined to the last. Click the first point again to close, or Enter to finish',
          { ns: 'editor' },
        ),
      ]
    case 'polygon':
      return [
        t('draft.prompt.polygonCentre', 'Click the centre', { ns: 'editor' }),
        t('draft.prompt.polygonCorner', 'Click a corner (or the middle of a side, circumscribed)', { ns: 'editor' }),
      ]
    case 'spline':
      return [
        t('draft.prompt.firstPoint', 'Click the first point', { ns: 'editor' }),
        t('draft.prompt.splineNext', 'Click the next point. Enter or double-click finishes', { ns: 'editor' }),
      ]
    case 'region':
      return [
        t('draft.prompt.regionFirstCorner', 'Click the first corner', { ns: 'editor' }),
        t('draft.prompt.regionNextCorner', 'Click the next corner', { ns: 'editor' }),
        t('draft.prompt.regionClose', 'Click the next corner. Enter or double-click closes it', { ns: 'editor' }),
      ]
    case 'component':
      return [t('draft.prompt.componentWhere', 'Click where the component goes (its bottom-left corner)', { ns: 'editor' })]
    case 'repeat':
      return [t('draft.prompt.repeatStart', 'Click where the repeat starts', { ns: 'editor' }), t('draft.prompt.repeatEnd', 'Click where it ends', { ns: 'editor' })]
    case 'batt':
      return [
        t('draft.prompt.battStart', 'Click where the insulation starts', { ns: 'editor' }),
        t('draft.prompt.battEnd', 'Click where it ends', { ns: 'editor' }),
      ]
  }
}

/** What each click of a dimension asks for, in the language on screen. */
function dimPrompts(kind: DimensionKind, t: Translate): readonly string[] {
  const two = [t('draft.prompt.centreOrCurve', 'Click the centre (or an arc or circle)', { ns: 'editor' }), t('draft.prompt.pointOnCurve', 'Click a point on the curve', { ns: 'editor' })]
  switch (kind) {
    case 'angular':
      return [
        t('draft.prompt.angleCorner', 'Click the corner the angle opens from', { ns: 'editor' }),
        t('draft.prompt.angleFirstSide', 'Click a point on the first side', { ns: 'editor' }),
        t('draft.prompt.angleSecondSide', 'Click a point on the second side', { ns: 'editor' }),
      ]
    case 'arc_length':
      return [
        t('draft.prompt.arcCentre', 'Click the arc centre', { ns: 'editor' }),
        t('draft.prompt.arcStart', 'Click where the arc starts', { ns: 'editor' }),
        t('draft.prompt.arcEndPlain', 'Click where it ends', { ns: 'editor' }),
      ]
    case 'radial':
    case 'diameter':
      return two
    case 'spot_elevation':
    case 'spot_coordinate':
      return [t('draft.prompt.pointToLabel', 'Click the point to label', { ns: 'editor' }), t('draft.prompt.whereLabelGoes', 'Click where the label goes', { ns: 'editor' })]
    default:
      return [
        t('draft.prompt.firstPoint', 'Click the first point', { ns: 'editor' }),
        t('draft.prompt.splineNext', 'Click the next point. Enter or double-click finishes', { ns: 'editor' }),
      ]
  }
}

export function shapePrompt(tool: DraftShape | 'dimension', s: Pick<DraftSettings, 'dimKind' | 'dimChain'>, clicks: number, t: Translate = englishOnly): string {
  const list = tool === 'dimension' ? dimPrompts(s.dimKind, t) : shapePrompts(tool, t)
  return t('draft.promptWithCancel', '{{prompt}}. Esc cancels.', { ns: 'editor', prompt: list[Math.min(clicks, list.length - 1)] ?? '' })
}

/**
 * What the bar says while a modify operation is in hand. Three keyed shapes, one
 * per state: the pick-the-element tools name the step, a run with nothing selected
 * asks for a selection, and a run with a selection says which item and the next
 * pick. Nothing is glued together from an English verb and a translated noun.
 */
export function modifyPrompt(
  op: ModifyOpName,
  picks: number,
  selected: number,
  params: Pick<ModifyParams, 'deleteInner' | 'offsetMode'> = DEFAULT_MODIFY_PARAMS,
  t: Translate = englishOnly,
): string {
  const list = modifyPicks(op, params, t)
  const name = modifyLabel(op, t)
  if (PICK_ELEMENT_OPS.has(op)) {
    const step = list[Math.min(picks, list.length - 1)] ?? ''
    return t('draft.modifyStep', '{{name}}: {{step}}. Esc finishes.', { ns: 'editor', name, step: lowerFirst(step, t) })
  }
  if (selected === 0) return t('draft.modifySelectFirst', '{{name}}: select drawn items first (Shift+click adds more), then pick {{name}} again.', { ns: 'editor', name })
  return t('draft.modifyNextPick', '{{name}} {{count}}: {{step}}. Esc cancels.', {
    ns: 'editor',
    name,
    count: selected === 1 ? t('draft.oneItem', '1 item', { ns: 'editor' }) : t('draft.someItems', '{{n}} items', { ns: 'editor', n: selected }),
    step: lowerFirst(list[picks] ?? t('draft.pressApply', 'Press Apply', { ns: 'editor' }), t),
  })
}

/**
 * A prompt's first letter in lower case, for the middle of a sentence. Turkish
 * `İ`/`I` are why this is not `toLowerCase()` on the first character alone.
 */
function lowerFirst(text: string, t: Translate): string {
  if (text === '') return text
  const first = text.slice(0, 1)
  const lower = first === 'I' ? t('draft.letterDotlessI', 'ı', { ns: 'editor' }) : first === 'İ' ? t('draft.letterDottedI', 'i', { ns: 'editor' }) : first.toLowerCase()
  return lower + text.slice(1)
}

/** Inches, feet-inches (2'-6", 2' 6", 1.5'), or millimetres ("150mm") → mm; null when it isn't a length. */
export function parseLength(text: string): number | null {
  const mm = parseLengthRaw(text)
  return mm === null ? null : Math.round(mm * 1e6) / 1e6
}

/** Inches with an optional fraction: 6, 1.5, 3/4, 1-1/2, 1 1/2. */
function inches(t: string): number | null {
  const m = /^(\d+(?:\.\d+)?)?(?:(?:^|\s+|-)(\d+)\/(\d+))?$/.exec(t.trim())
  if (!m || (!m[1] && !m[2])) return null
  const whole = m[1] ? Number(m[1]) : 0
  const frac = m[2] && m[3] ? Number(m[2]) / Number(m[3]) : 0
  return Number.isFinite(frac) ? whole + frac : null
}

function parseLengthRaw(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\s*(?:"|in)$/, '')
  if (!t) return null
  const neg = t.startsWith('-') ? -1 : 1
  const body = neg < 0 ? t.slice(1) : t
  const mm = /^(\d+(?:\.\d+)?)\s*mm$/.exec(body)
  if (mm?.[1]) return neg * Number(mm[1])
  const ft = /^(\d+(?:\.\d+)?)\s*'\s*-?\s*(.*)$/.exec(body)
  if (ft?.[1] !== undefined) {
    const rest = ft[2]?.trim() ?? ''
    const inch = rest ? inches(rest) : 0
    return inch === null ? null : neg * (Number(ft[1]) * 12 + inch) * 25.4
  }
  const inch = inches(body)
  return inch === null ? null : neg * inch * 25.4
}

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })

export interface Constrained {
  readonly at: Vec2
  /** What it snapped to, in words, for the marker's tooltip and the hint. */
  readonly snapLabel: string | null
  /** A dimension point's element / item it follows. */
  readonly snapRef: SnapPoint['ref'] | null
  /** The tracking line drawn from the last point, when tracking. */
  readonly tracking: { readonly from: Vec2; readonly angleDeg: number } | null
  /** The drawn item under the snap, if any (trim / extend boundaries, radial dimensions). */
  readonly itemId: string | null
}

/** What a click snapped to, in the language on screen. */
function snapWord(kind: SnapKind, t: Translate): string {
  switch (kind) {
    case 'endpoint':
      return t('draft.snapWord.endpoint', 'endpoint', { ns: 'editor' })
    case 'midpoint':
      return t('draft.snapWord.midpoint', 'midpoint', { ns: 'editor' })
    case 'center':
      return t('draft.snapWord.center', 'centre', { ns: 'editor' })
    case 'intersection':
      return t('draft.snapWord.intersection', 'intersection', { ns: 'editor' })
    case 'perpendicular':
      return t('draft.snapWord.perpendicular', 'perpendicular', { ns: 'editor' })
    case 'nearest':
      return t('draft.snapWord.nearest', 'nearest point', { ns: 'editor' })
  }
}

/**
 * Where a click lands: a model / dimension snap point first (it is followed),
 * then a detail-linework snap, then ortho or polar tracking from the last
 * point, else the pointer.
 */
export function constrainPoint(input: {
  readonly at: Vec2
  readonly from: Vec2 | null
  readonly items: readonly DrawingItem[]
  readonly toPaper: (p: Vec2) => Vec2
  readonly settings: Pick<DraftSettings, 'snaps' | 'ortho' | 'polarDeg'>
  readonly reachMm: number
  /** Points dimensions follow (model ends and edges), when a dimension is being drawn. */
  readonly anchors?: readonly SnapPoint[]
  /** Also snap to the nearest point on a line (picking a trim / extend boundary). */
  readonly nearest?: boolean
  /** Picking an element: only the nearest point on a line counts (an endpoint snap at a corner would name either line). */
  readonly pickElement?: boolean
  /** Degrees counter-clockwise from paper-right that ortho and polar steps start from: the working angle on paper. Absent: 0. */
  readonly trackBaseDeg?: number
  /** The language the snap's own word is drawn in. */
  readonly t?: Translate
}): Constrained {
  const { at, from, settings, reachMm } = input
  const translate = input.t ?? englishOnly
  let bestAnchor: SnapPoint | null = null
  let bestD = reachMm
  for (const a of input.anchors ?? []) {
    const d = Math.hypot(a.at.x - at.x, a.at.y - at.y)
    if (d < bestD) {
      bestAnchor = a
      bestD = d
    }
  }
  if (input.pickElement) {
    const snap = detailSnap(input.items, input.toPaper, at, { kinds: new Set<SnapKind>(['nearest']), reachMm })
    return snap
      ? { at: snap.at, snapLabel: snapWord('nearest', translate), snapRef: null, tracking: null, itemId: snap.itemId }
      : { at, snapLabel: null, snapRef: null, tracking: null, itemId: null }
  }
  if (bestAnchor) return { at: bestAnchor.at, snapLabel: bestAnchor.label, snapRef: bestAnchor.ref, tracking: null, itemId: input.items.some((i) => i.id === bestAnchor.ref.elementId) ? bestAnchor.ref.elementId : null }
  const kinds = new Set<SnapKind>(settings.snaps)
  if (input.nearest) kinds.add('nearest')
  if (kinds.size > 0) {
    const snap = detailSnap(input.items, input.toPaper, at, { kinds, reachMm, ...(from ? { from } : {}) })
    if (snap) return { at: snap.at, snapLabel: snapWord(snap.kind, translate), snapRef: null, tracking: null, itemId: snap.itemId }
  }
  if (from && (settings.ortho || settings.polarDeg)) {
    const t = trackFrom(from, at, settings.ortho ? 90 : (settings.polarDeg ?? 90), input.trackBaseDeg ?? 0)
    if (t) return { at: t.at, snapLabel: null, snapRef: null, tracking: { from, angleDeg: t.angleDeg }, itemId: null }
  }
  return { at, snapLabel: null, snapRef: null, tracking: null, itemId: null }
}

/** Paper y runs down: turning counter-clockwise by `deg` on screen. */
function turnPaper(v: Vec2, deg: number): Vec2 {
  const a = (deg * Math.PI) / 180
  return { x: v.x * Math.cos(a) + v.y * Math.sin(a), y: -v.x * Math.sin(a) + v.y * Math.cos(a) }
}

/** Ortho / polar tracking whose steps start from `baseDeg` (the working angle on paper) instead of paper-right. */
export function trackFrom(from: Vec2, at: Vec2, incrementDeg: number, baseDeg: number): { at: Vec2; angleDeg: number } | null {
  if (baseDeg === 0) return trackAngle(from, at, incrementDeg)
  const local = turnPaper(sub(at, from), -baseDeg)
  const t = trackAngle({ x: 0, y: 0 }, local, incrementDeg)
  if (!t) return null
  const back = turnPaper(t.at, baseDeg)
  return { at: { x: from.x + back.x, y: from.y + back.y }, angleDeg: (((t.angleDeg + baseDeg) % 360) + 360) % 360 }
}

/** The add command for a finished drawing-tool shape, or why it can't be drawn. */
export function shapeCommand(input: {
  readonly tool: DraftShape
  readonly paper: readonly Vec2[]
  readonly settings: DraftSettings
  readonly toStored: (p: Vec2) => Vec2
  /** Paper mm → stored length (× view scale in a view, 1 on a sheet). */
  readonly storedPerPaperMm: number
  readonly ownerId: string
  readonly itemId: string
  /** The language a refusal is said in. */
  readonly t?: Translate
}): ViewCommand | BatchCommand | string {
  const { tool, paper, settings, toStored, ownerId, itemId } = input
  const t = input.t ?? englishOnly
  const pts = paper.map(toStored)
  const lineStyle = settings.weight !== 'medium' || settings.pattern !== 'solid' ? { lineStyle: { ...(settings.weight !== 'medium' ? { weight: settings.weight } : {}), ...(settings.pattern !== 'solid' ? { pattern: settings.pattern } : {}) } } : {}
  const base = { type: 'add_drawing_item' as const, itemId, ownerId, ...lineStyle }
  const symbol = detailComponent(settings.symbolId)
  const joined = (sides: ReadonlyArray<readonly [Vec2, Vec2]>, label: string): BatchCommand => ({
    type: 'batch_documents',
    label,
    commands: sides.map(([p, q], k) => ({ ...base, itemId: `${itemId}-${k}`, shape: 'line' as const, points: [p, q] })),
  })
  switch (tool) {
    case 'arc':
      return { ...base, shape: 'arc', points: pts.slice(0, 3), ccw: true }
    case 'circle':
      return { ...base, shape: 'circle', points: pts.slice(0, 2) }
    case 'polyline': {
      // Joined detail lines, one per segment; landing back on the first point closes the chain.
      if (pts.length < 2) return t('draft.need.twoPoints', 'Click at least two points.', { ns: 'editor' })
      const firstPaper = paper[0]
      const lastPaper = paper[paper.length - 1]
      const closes = paper.length >= 4 && firstPaper && lastPaper && Math.hypot(lastPaper.x - firstPaper.x, lastPaper.y - firstPaper.y) < 0.3
      const sides = chainLines(closes ? pts.slice(0, -1) : pts, Boolean(closes))
      return sides.length > 0
        ? joined(sides, closes ? t('draft.what.closedChain', 'Draw a closed chain of lines', { ns: 'editor' }) : t('draft.what.chain', 'Draw a chain of lines', { ns: 'editor' }))
        : t('draft.need.twoDifferentPoints', 'Click at least two different points.', { ns: 'editor' })
    }
    case 'polygon': {
      const sides = Number(settings.polygonSides)
      if (!Number.isInteger(sides) || sides < 3 || sides > 64)
        return t('draft.need.sides', 'Type the number of sides, 3 to 64 (“{{typed}}” isn’t).', { ns: 'editor', typed: settings.polygonSides })
      const [center, corner] = pts
      if (!center || !corner || Math.hypot(corner.x - center.x, corner.y - center.y) < 1e-6)
        return t('draft.need.polygonCorner', 'Click the centre, then a corner away from it.', { ns: 'editor' })
      return joined(polygonLines(center, corner, sides, settings.polygonInscribed), `Draw a ${sides}-sided polygon`)
    }
    case 'spline':
      return pts.length >= 2 ? { ...base, shape: tool, points: pts } : t('draft.need.twoPoints', 'Click at least two points.', { ns: 'editor' })
    case 'region':
      if (pts.length < 3) return t('draft.need.regionCorners', 'A region needs three corners or more.', { ns: 'editor' })
      return { ...base, shape: 'region', points: pts, fill: settings.masking ? { pattern: 'solid', masking: true } : { pattern: settings.hatch } }
    case 'component':
      if (!symbol) return t('draft.need.pickComponent', 'Pick a component from the library first.', { ns: 'editor' })
      return { ...base, shape: 'component', points: pts.slice(0, 1), component: { symbolId: symbol.id } }
    case 'repeat':
      if (!symbol) return t('draft.need.pickComponent', 'Pick a component from the library first.', { ns: 'editor' })
      return { ...base, shape: 'repeat', points: pts.slice(0, 2), component: { symbolId: symbol.id } }
    case 'batt': {
      const thickness = parseLength(settings.battThickness)
      if (!thickness || thickness <= 0) return `Type the insulation thickness (like 2" or 50mm); "${settings.battThickness}" isn't a length.`
      // A typed thickness is the real one in a view (model inches), or paper inches on a sheet.
      return { ...base, shape: 'batt', points: pts.slice(0, 2), batt: { thicknessMm: thickness } }
    }
  }
}

/** A dimension from clicked points (and what each snapped to), for every kind but a single linear / aligned drag. */
export function dimensionCommand(input: {
  readonly paper: readonly Constrained[]
  readonly settings: Pick<DraftSettings, 'dimKind' | 'dimChain'>
  readonly toStored: (p: Vec2) => Vec2
  readonly items: readonly DrawingItem[]
  readonly ownerId: string
  readonly itemId: string
  readonly t?: Translate
}): ViewCommand | string {
  const { paper, settings, toStored, ownerId, itemId } = input
  const translate = input.t ?? englishOnly
  const kind = settings.dimKind
  const refs = paper.map((c) => c.snapRef)
  let points = paper.map((c) => c.at)
  let dimRefs = refs
  if (kind === 'radial' || kind === 'diameter') {
    // A first click on an arc or circle measures it from its centre.
    const curve = paper[0]?.itemId ? input.items.find((i) => i.id === paper[0]?.itemId && (i.shape === 'arc' || i.shape === 'circle')) : undefined
    if (curve && paper[1]) {
      points = [paper[0]?.at ?? paper[1].at, paper[1].at]
      dimRefs = [{ elementId: curve.id, anchor: 'center' }, null]
    }
  }
  const square = (a: Vec2, b: Vec2) => (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? 'horizontal' : 'vertical')
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last) return translate('draft.need.dimensionPoints', 'Click the points to dimension.', { ns: 'editor' })
  const dim: DimSpec = {
    kind,
    ...(kind === 'linear' ? { direction: square(first, last) } : {}),
    ...(settings.dimChain !== 'single' && (kind === 'linear' || kind === 'aligned') ? { chain: settings.dimChain } : {}),
    ...(dimRefs.some((r) => r) ? { refs: dimRefs } : {}),
    offsetMm: kind === 'angular' ? 12 : kind === 'arc_length' ? 4 : -8,
  }
  return { type: 'add_drawing_item', itemId, ownerId, shape: 'dimension', points: points.map(toStored), dim }
}

/** The modify operation from its picks (paper mm) and typed values, in stored coordinates. */
export function modifyOperation(
  op: ModifyOpName,
  picks: readonly Constrained[],
  params: ModifyParams,
  toStored: (p: Vec2) => Vec2,
  t: Translate = englishOnly,
): ModifyOp | string {
  const p = picks.map((c) => toStored(c.at))
  const num = (text: string, what: string): number | string => {
    const v = Number(text)
    return Number.isFinite(v) ? v : t('draft.need.number', 'Type a number for the {{what}}.', { ns: 'editor', what })
  }
  const length = (text: string, what: string): number | string =>
    parseLength(text) ?? t('draft.need.length', 'Type the {{what}} as a length, like 6" or 1\'-6".', { ns: 'editor', what })
  const [a, b, c] = p
  switch (op) {
    case 'move':
    case 'copy':
      return a && b ? { op, delta: sub(b, a) } : t('draft.need.baseThenWhere', 'Click the base point, then where it goes.', { ns: 'editor' })
    case 'array': {
      const count = num(params.count, t('draft.what.count', 'count', { ns: 'editor' }))
      if (typeof count === 'string') return count
      return a && b ? { op, count: Math.round(count), delta: sub(b, a) } : t('draft.need.baseThenNextCopy', 'Click the base point, then where the next copy goes.', { ns: 'editor' })
    }
    case 'rotate': {
      const angleDeg = num(params.angle, t('draft.what.angle', 'angle', { ns: 'editor' }))
      if (typeof angleDeg === 'string') return angleDeg
      return a ? { op, center: a, angleDeg, ...(params.copy ? { copy: true } : {}) } : t('draft.need.theCentre', 'Click the centre.', { ns: 'editor' })
    }
    case 'polar_array': {
      const angleDeg = num(params.angle, t('draft.what.angleTheArraySpans', 'angle the array spans', { ns: 'editor' }))
      const count = num(params.count, 'count')
      if (typeof angleDeg === 'string') return angleDeg
      if (typeof count === 'string') return count
      return a ? { op, center: a, angleDeg, count: Math.round(count) } : t('draft.need.theCentre', 'Click the centre.', { ns: 'editor' })
    }
    case 'scale': {
      const factor = num(params.factor, t('draft.what.scaleFactor', 'scale factor', { ns: 'editor' }))
      if (typeof factor === 'string') return factor
      return a ? { op, center: a, factor } : t('draft.need.theBasePoint', 'Click the base point.', { ns: 'editor' })
    }
    case 'mirror':
      return a && b ? { op, a, b, ...(params.copy ? { copy: true } : {}) } : t('draft.need.mirrorPoints', 'Click two points on the mirror line.', { ns: 'editor' })
    case 'align':
      return a && b && c ? { op, from: a, a: b, b: c } : t('draft.need.alignPoints', 'Click the point to line up, then two points on the line.', { ns: 'editor' })
    case 'offset': {
      const copy = params.offsetCopy ? {} : { copy: false }
      if (params.offsetMode === 'graphical') {
        if (!a || !b) return t('draft.need.offsetPoints', 'Click a point to measure from, then where the offset goes.', { ns: 'editor' })
        const distance = Math.hypot(b.x - a.x, b.y - a.y)
        return distance > 1e-6 ? { op, distance, side: b, ...copy } : t('draft.need.twoDifferentPoints', 'Click two different points to show the offset distance.', { ns: 'editor' })
      }
      const distance = length(params.distance, t('draft.what.offsetDistance', 'offset distance', { ns: 'editor' }))
      if (typeof distance === 'string') return distance
      return a ? { op, distance, side: a, ...copy } : t('draft.pick.offsetSide', 'Click the side to offset to', { ns: 'editor' })
    }
    case 'trim_extend_corner':
      return a && b ? { op, keep1: a, keep2: b } : t('draft.need.twoPartsToKeep', 'Click the two lines, each on the part to keep.', { ns: 'editor' })
    case 'trim_extend_single':
      return picks[0]?.itemId && b
        ? { op, boundaryId: picks[0].itemId, keep: b }
        : t('draft.need.boundaryThenLine', 'Click the boundary, then the line to trim or extend.', { ns: 'editor' })
    case 'trim_extend_multiple':
      return picks[0]?.itemId && b ? { op, boundaryId: picks[0].itemId, keeps: [b] } : t('draft.need.boundaryThenEach', 'Click the boundary, then each line to trim or extend.', { ns: 'editor' })
    case 'split':
      if (!a) return t('draft.need.splitWhere', 'Click the line or arc where it splits.', { ns: 'editor' })
      return params.deleteInner ? (b ? { op, at: a, to: b } : t('draft.need.secondSplit', 'Click the line again at the second split.', { ns: 'editor' })) : { op, at: a }
    case 'split_gap': {
      const gap = length(params.gap, t('draft.what.gap', 'gap', { ns: 'editor' }))
      if (typeof gap === 'string') return gap
      return a ? { op, at: a, gap } : t('draft.pick.splitGapWhere', 'Click the line or arc where the gap goes', { ns: 'editor' })
    }
    case 'fillet_arc': {
      const radius = length(params.arcRadius, t('draft.what.arcRadius', 'arc radius', { ns: 'editor' }))
      if (typeof radius === 'string') return radius
      if (!(radius > 0)) return t('draft.need.radiusAboveZero', 'Type a radius above zero (Trim/Extend to Corner makes a sharp corner).', { ns: 'editor' })
      return a && b ? { op, radius, near1: a, near2: b } : t('draft.need.twoLinesToRound', 'Click the two lines to round the corner between.', { ns: 'editor' })
    }
    case 'pin':
    case 'unpin':
      return { op }
  }
}

/**
 * The operation and the elements it acts on: the clicked elements for the
 * pick-the-element tools (Trim/Extend, Split, Fillet Arc), else what is
 * selected.
 */
export function modifyRequest(
  op: ModifyOpName,
  picks: readonly Constrained[],
  params: ModifyParams,
  toStored: (p: Vec2) => Vec2,
  selectedIds: readonly string[],
  t: Translate = englishOnly,
): { readonly operation: ModifyOp; readonly ids: readonly string[] } | string {
  const operation = modifyOperation(op, picks, params, toStored, t)
  if (typeof operation === 'string') return operation
  if (!PICK_ELEMENT_OPS.has(op)) return { operation, ids: selectedIds }
  const at = (i: number) => picks[i]?.itemId ?? null
  switch (op) {
    case 'trim_extend_corner':
    case 'fillet_arc': {
      const first = at(0)
      const second = at(1)
      if (!first || !second) return t('draft.need.twoLines', 'Click right on two drawn lines.', { ns: 'editor' })
      // One rectangle from an earlier drawing picked twice stands for the two sides at that corner.
      return { operation, ids: first === second ? [first] : [first, second] }
    }
    case 'trim_extend_single':
    case 'trim_extend_multiple': {
      const boundary = at(0)
      const target = at(1)
      if (!boundary || !target) return t('draft.need.boundaryThenLine', 'Click the boundary, then the line to trim or extend.', { ns: 'editor' })
      if (boundary === target) return t('draft.need.differentLine', 'Pick a different line than the boundary.', { ns: 'editor' })
      return { operation, ids: [target] }
    }
    case 'split':
    case 'split_gap': {
      const target = at(0)
      if (!target) return t('draft.need.onALine', 'Click right on a drawn line or arc.', { ns: 'editor' })
      if (op === 'split' && params.deleteInner && at(1) !== target)
        return t('draft.need.sameLineTwice', 'Click the same line both times to delete the piece between.', { ns: 'editor' })
      return { operation, ids: [target] }
    }
    default:
      return { operation, ids: selectedIds }
  }
}

/**
 * Whether the picked items stay selected after the operation: it changed them where they are
 * (move, rotate, mirror, scale, align, pin), so a second change needs no re-pick. Operations
 * that make copies or new pieces leave nothing selected, and so does an edit that first
 * replaces an item from an older drawing (a rectangle becomes four lines with new ids).
 */
export function keepsSelection(operation: ModifyOp, items: readonly DrawingItem[], ids: readonly string[]): boolean {
  if (items.some((i) => ids.includes(i.id) && draftingVersionOf(i) < DRAFTING_SCHEMA_VERSION)) return false
  switch (operation.op) {
    case 'move':
    case 'scale':
    case 'align':
    case 'pin':
    case 'unpin':
      return true
    case 'rotate':
    case 'mirror':
      return operation.copy !== true
    default:
      return false
  }
}

/** Whether the pick at this index must land on a drawn element. */
export function pickNeedsItem(op: ModifyOpName, index: number): boolean {
  return ITEM_PICKS[op]?.includes(index) ?? false
}

/** The library grouped for a picker: category → components. */
export function componentGroups(): Array<{ category: string; items: Array<{ id: string; name: string }> }> {
  const out = new Map<string, Array<{ id: string; name: string }>>()
  for (const c of detailComponents()) out.set(c.category, [...(out.get(c.category) ?? []), { id: c.id, name: c.name }])
  return [...out].map(([category, items]) => ({ category, items }))
}
