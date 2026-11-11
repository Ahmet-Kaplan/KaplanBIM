import { Check, Circle, Cloud, Eraser, Hexagon, KeyRound, Minus, MoveHorizontal, PaintBucket, Palette, Puzzle, Rainbow, Repeat, Spline, Square, SquareDashed, SquareRoundCorner, Tag, Tags, Type, Waves, Waypoints } from 'lucide-react'
import { DIMENSION_KINDS, detailComponents, type DimensionKind } from '@permitzip/bim-kernel'
import type { RibbonCommand, RibbonGroup, RibbonTab } from './types'
import type { DrawingTool } from '../views-sheets/DrawingCanvas'
import type { DraftController } from '../views-sheets/draft/useDraftController'
import type { BuildingModelRibbonContext } from '../building-model-ribbon'
import { englishOnly, type Translate } from '../i18n/translate'

/**
 * The Annotate tab: everything drawn on a view or a sheet, in one place.
 * Dimension, Detail (detail lines in every shape, revision clouds), Region,
 * Text, Tag and Symbol (detail components, repeating details, insulation).
 * The drawing aids (snaps, Ortho, polar) sit in the options bar above the
 * drawing; the edit verbs are on Modify. Each command says why it is off.
 *
 * Every word a person reads is a `t('<key>', '<English>')` call here, including
 * the tooltips (`description`) that `tooltipFor()` shows on hover: a tab caption
 * in Turkish above a tooltip in English is the mixed screen this work removes.
 * Nothing lowercases a translated word on the way into a sentence — a builder is
 * a pure function with no language, so the labels are phrased to arrive where a
 * capital belongs (see `ribbon.description.drawKindDimensions`).
 */

/** The shapes one Detail line draws; the split button remembers the last one. */
export const DETAIL_SHAPES = ['line', 'rect', 'polygon', 'arc', 'circle', 'polyline', 'spline'] as const satisfies readonly DrawingTool[]
export type DetailShape = (typeof DETAIL_SHAPES)[number]
export function isDetailShape(tool: DrawingTool): tool is DetailShape {
  return (DETAIL_SHAPES as readonly string[]).includes(tool)
}

/** Why the drawing tools are off when no drawing is open, in the host's language. */
export function openADrawing(t: Translate = englishOnly): string {
  return t('ribbon.help.openASheetAPlan', 'Open a sheet, a plan, a section or a detail view from the Views and sheets panel to annotate it.', { ns: 'editor' })
}

export function drawingReason(ctx: BuildingModelRibbonContext, tool: DrawingTool, t: Translate = englishOnly): string | null {
  if (!ctx.drawingOpen) return openADrawing(t)
  if (tool !== 'select' && ctx.editBlocked) return ctx.editBlocked
  if (ctx.drawingTools.includes(tool)) return null
  if (tool === 'dimension') return t('ribbon.help.dimensionsMeasureAViewOpen', 'Dimensions measure a view. Open a plan, section or detail view, or double-click one on the sheet.', { ns: 'editor' })
  if (tool === 'tag') return t('ribbon.help.tagsLabelTheModelOpen', 'Tags label the model. Open a plan or a section, or double-click one on the sheet.', { ns: 'editor' })
  if (tool === 'keynote') return t('ribbon.help.keynotesGoOnElementsIn', 'Keynotes go on elements in a view. Open a plan or a section, or double-click one on the sheet.', { ns: 'editor' })
  if (tool === 'rect') return t('ribbon.help.rectanglesAreDrawnOnSheets', 'Rectangles are drawn on sheets and in detail views.', { ns: 'editor' })
  return t('ribbon.help.a3DViewOrSchedule', 'A 3D view or schedule takes no annotation. Draw on the sheet, or in a plan, section or detail view.', { ns: 'editor' })
}

export function drawingCommand(ctx: BuildingModelRibbonContext, tool: DrawingTool, label: string, icon: RibbonCommand['icon'], description: string, keywords: readonly string[], t: Translate = englishOnly): RibbonCommand {
  return {
    id: `draw-${tool}`,
    label,
    icon,
    description,
    keywords,
    disabledReason: drawingReason(ctx, tool, t),
    pressed: ctx.drawingOpen !== null && ctx.drawingTool === tool,
    run: () => ctx.setDrawingTool(tool),
    testId: `ribbon-draw-${tool}`,
    // The drawing takes the keyboard once a tool is picked (Enter finishes a chain); Select leaves it where it is.
    ...(tool !== 'select' ? { handsOffKeyboard: true } : {}),
  }
}

function shapes(t: Translate): Record<DetailShape, { readonly label: string; readonly icon: RibbonCommand['icon']; readonly description: string; readonly keywords: readonly string[] }> {
  return {
    line: { label: t('ribbon.command.line', 'Line', { ns: 'editor' }), icon: Minus, description: t('ribbon.description.dragADetailLinePick', 'Drag a detail line; pick its line style in the bar over the drawing', { ns: 'editor' }), keywords: [t('ribbon.keyword.detailLine', 'detail line', { ns: 'editor' })] },
    rect: { label: t('ribbon.command.rectangle', 'Rectangle', { ns: 'editor' }), icon: Square, description: t('ribbon.description.dragARectangleFourDetail', 'Drag a rectangle: four detail lines joined at the corners, so you can fillet, trim or offset them', { ns: 'editor' }), keywords: ['box', t('ribbon.keyword.joinedLines', 'joined lines', { ns: 'editor' })] },
    arc: { label: t('ribbon.command.arc', 'Arc', { ns: 'editor' }), icon: Rainbow, description: t('ribbon.description.clickTheCentreTheStart', 'Click the centre, the start and the end', { ns: 'editor' }), keywords: ['curve'] },
    circle: { label: t('ribbon.command.circle', 'Circle', { ns: 'editor' }), icon: Circle, description: t('ribbon.description.clickTheCentreAndAPoint', 'Click the centre and a point on it', { ns: 'editor' }), keywords: ['round'] },
    polygon: { label: t('ribbon.command.polygon', 'Polygon', { ns: 'editor' }), icon: Hexagon, description: t('ribbon.description.clickTheCentreAndA', 'Click the centre and a corner: joined detail lines, inscribed or circumscribed, sides typed in the bar', { ns: 'editor' }), keywords: ['hexagon', 'octagon', t('ribbon.keyword.joinedLines', 'joined lines', { ns: 'editor' })] },
    polyline: { label: t('ribbon.command.linesChain', 'Lines (chain)', { ns: 'editor' }), icon: Waypoints, description: t('ribbon.description.clickEachPointOneDetail', 'Click each point: one detail line per segment, joined end to end. Click the first point to close; Enter finishes', { ns: 'editor' }), keywords: ['chain', 'polyline', 'path', t('ribbon.keyword.joinedLines', 'joined lines', { ns: 'editor' })] },
    spline: { label: t('ribbon.command.spline', 'Spline', { ns: 'editor' }), icon: Spline, description: t('ribbon.description.aSmoothCurveThroughThe', 'A smooth curve through the points you click', { ns: 'editor' }), keywords: ['curve', 'smooth', 'flex'] },
  }
}

/** Detail line ▾: the face draws the last shape used (when it fits here), the arrow lists every shape. */
function detailLine(ctx: BuildingModelRibbonContext, t: Translate): RibbonCommand {
  const last = ctx.lastDetailShape ?? 'line'
  const face: DetailShape = drawingReason(ctx, last, t) === null ? last : 'line'
  const SHAPE = shapes(t)
  // The English this replaced lowercased the shape's own name into the sentence
  // ("Draw a detail line on this drawing"); Turkish is lowercased the same way, so
  // the sentence keeps its shape in both languages.
  const lower = (word: string): string => word.toLocaleLowerCase()
  const list = DETAIL_SHAPES.map((shape) => drawingCommand(ctx, shape, SHAPE[shape].label, SHAPE[shape].icon, SHAPE[shape].description, SHAPE[shape].keywords, t))
  return {
    id: 'detail-line',
    label: t('ribbon.command.detailLine', 'Detail line', { ns: 'editor' }),
    icon: SHAPE[face].icon,
    description: t('ribbon.description.drawAShapeOnThisDrawing', 'Draw a {{shape}} on this drawing; the arrow picks another shape (line, rectangle, polygon, arc, circle, chain of lines, spline)', { ns: 'editor', shape: lower(SHAPE[face].label) }),
    keywords: ['line', t('ribbon.keyword.detailLine', 'detail line', { ns: 'editor' }), 'draw', 'linework', 'shape'],
    disabledReason: drawingReason(ctx, face, t),
    pressed: ctx.drawingOpen !== null && isDetailShape(ctx.drawingTool),
    run: () => ctx.setDrawingTool(face),
    split: true,
    children: list,
    testId: 'ribbon-detail-line',
    handsOffKeyboard: true,
  }
}

function dimensionLabels(t: Translate): Record<DimensionKind, string> {
  return { linear: t('ribbon.help.linearHorizontalOrVertical', 'Linear (horizontal or vertical)', { ns: 'editor' }), aligned: t('ribbon.help.aligned', 'Aligned', { ns: 'editor' }), angular: t('ribbon.command.angular', 'Angle', { ns: 'editor' }), radial: t('ribbon.command.radius', 'Radius', { ns: 'editor' }), diameter: t('ribbon.command.diameter', 'Diameter', { ns: 'editor' }), arc_length: t('ribbon.help.arcLength', 'Arc length', { ns: 'editor' }), spot_elevation: t('ribbon.help.spotElevation', 'Spot elevation', { ns: 'editor' }), spot_coordinate: t('ribbon.help.spotCoordinate', 'Spot coordinate', { ns: 'editor' }) }
}

/** Dimension kinds: every kind people draw, plus strings of dimensions end to end or from one baseline. */
function dimensionKinds(ctx: BuildingModelRibbonContext, draft: DraftController, t: Translate): RibbonCommand {
  const s = draft.settings
  const reason = drawingReason(ctx, 'dimension', t)
  const DIM_KIND_LABEL = dimensionLabels(t)
  const pick = (dimKind: DimensionKind, dimChain: 'single' | 'continuous' | 'baseline') => () => {
    draft.setSettings({ ...s, dimKind, dimChain })
    ctx.setDrawingTool('dimension')
  }
  const on = (k: DimensionKind, c: 'single' | 'continuous' | 'baseline') => ctx.drawingTool === 'dimension' && s.dimKind === k && s.dimChain === c
  const chain = s.dimChain === 'single' ? '' : s.dimChain === 'continuous' ? t('ribbon.help.chainEndToEnd', ', end to end', { ns: 'editor' }) : t('ribbon.help.chainFromABaseline', ', from a baseline', { ns: 'editor' })
  return {
    id: 'dimension-kinds',
    label: t('ribbon.command.dimensionKinds', 'Dimension kinds', { ns: 'editor' }),
    icon: MoveHorizontal,
    description: t('ribbon.description.nowKindChain', 'Now: {{kind}}{{chain}}', { ns: 'editor', kind: DIM_KIND_LABEL[s.dimKind].toLocaleLowerCase(), chain }),
    keywords: ['angular', 'radius', 'diameter', t('ribbon.keyword.arcLength', 'arc length', { ns: 'editor' }), t('ribbon.keyword.spotElevation', 'spot elevation', { ns: 'editor' }), 'chain', 'baseline', 'continuous'],
    children: [
      ...DIMENSION_KINDS.map((k) => ({ id: `dimension-kind-${k}`, label: DIM_KIND_LABEL[k], icon: on(k, 'single') ? Check : MoveHorizontal, description: t('ribbon.description.drawKindDimensions', 'Draw {{kind}} dimensions', { ns: 'editor', kind: DIM_KIND_LABEL[k].toLocaleLowerCase() }), disabledReason: reason, pressed: on(k, 'single'), run: pick(k, 'single'), testId: `ribbon-dimension-${k}`, handsOffKeyboard: true })),
      { id: 'dimension-kind-continuous', label: t('ribbon.command.stringEndToEnd', 'String, end to end', { ns: 'editor' }), icon: on('linear', 'continuous') ? Check : MoveHorizontal, description: t('ribbon.description.clickEachPointEnterFinishes', 'Click each point; Enter finishes one string of dimensions', { ns: 'editor' }), disabledReason: reason, pressed: on('linear', 'continuous'), run: pick('linear', 'continuous'), testId: 'ribbon-dimension-continuous', handsOffKeyboard: true },
      { id: 'dimension-kind-baseline', label: t('ribbon.command.stringFromABaseline', 'String, from a baseline', { ns: 'editor' }), icon: on('linear', 'baseline') ? Check : MoveHorizontal, description: t('ribbon.description.eachDimensionMeasuredFromThe', 'Each dimension measured from the first point', { ns: 'editor' }), disabledReason: reason, pressed: on('linear', 'baseline'), run: pick('linear', 'baseline'), testId: 'ribbon-dimension-baseline', handsOffKeyboard: true },
    ],
    testId: 'ribbon-dimension-kinds',
  }
}

/** Fillet Arc: a draw tool that picks two lines and rounds their corner with the radius typed in the bar. */
function filletArc(ctx: BuildingModelRibbonContext, draft: DraftController, t: Translate): RibbonCommand {
  const on = draft.pending?.kind === 'modify' && draft.pending.op === 'fillet_arc'
  return {
    id: 'draw-fillet-arc',
    label: t('ribbon.command.filletArc', 'Fillet arc', { ns: 'editor' }),
    icon: SquareRoundCorner,
    description: t('ribbon.description.clickTwoDetailLinesAn', 'Click two detail lines: an arc of the radius in the bar rounds their corner and the lines trim to it', { ns: 'editor' }),
    keywords: ['fillet', t('ribbon.keyword.roundCorner', 'round corner', { ns: 'editor' }), 'radius'],
    disabledReason: ctx.drawingOpen ? ctx.editBlocked : openADrawing(t),
    pressed: on,
    run: () => {
      ctx.setDrawingTool('select')
      draft.setPending(on ? null : { kind: 'modify', op: 'fillet_arc' })
    },
    testId: 'ribbon-draw-fillet-arc',
    handsOffKeyboard: true,
  }
}

function region(ctx: BuildingModelRibbonContext, draft: DraftController, masking: boolean, t: Translate): RibbonCommand {
  return {
    ...drawingCommand(
      ctx,
      'region',
      masking ? t('ribbon.command.maskingRegion', 'Masking region', { ns: 'editor' }) : t('ribbon.command.filledRegion', 'Filled region', { ns: 'editor' }),
      masking ? Eraser : PaintBucket,
      masking
        ? t('ribbon.help.aWhiteRegionThatHides', 'A white region that hides linework under it; click its corners', { ns: 'editor' })
        : t('ribbon.help.aHatchedOrSolidRegion', 'A hatched or solid region; click its corners, Enter closes it', { ns: 'editor' }),
      masking
        ? [t('ribbon.keyword.mask', 'mask', { ns: 'editor' }), 'wipeout', 'cover']
        : ['hatch', 'fill', 'poche'],
      t,
    ),
    id: masking ? 'draft-masking' : 'draft-region',
    pressed: ctx.drawingTool === 'region' && draft.settings.masking === masking,
    run: () => {
      draft.setSettings({ ...draft.settings, masking })
      ctx.setDrawingTool('region')
    },
    testId: masking ? 'ribbon-draft-masking' : 'ribbon-draft-region',
  }
}

function component(ctx: BuildingModelRibbonContext, draft: DraftController, t: Translate): RibbonCommand {
  const base = drawingCommand(ctx, 'component', t('ribbon.command.component', 'Component', { ns: 'editor' }), Puzzle, t('ribbon.help.placeA2DDetailComponent', 'Place a 2D detail component: duct, pipe, hanger, valve, anchor, steel', { ns: 'editor' }), ['symbol', 'library', 'hanger', 'valve', 'anchor', 'strut'], t)
  return {
    ...base,
    children: detailComponents().map((c) => ({
      id: `draft-component-${c.id}`,
      label: c.name,
      icon: draft.settings.symbolId === c.id && ctx.drawingTool === 'component' ? Check : Puzzle,
      description: t('ribbon.description.placeAName', 'Place a {{name}}', { ns: 'editor', name: c.name.toLocaleLowerCase() }),
      disabledReason: base.disabledReason,
      run: () => {
        draft.setSettings({ ...draft.settings, symbolId: c.id })
        ctx.setDrawingTool('component')
      },
      testId: `ribbon-component-${c.id}`,
      handsOffKeyboard: true,
    })),
  }
}

export function annotateTab(ctx: BuildingModelRibbonContext, leading: RibbonGroup): RibbonTab {
  const t = ctx.t ?? englishOnly
  const draft = ctx.draft
  const groups: RibbonGroup[] = [
    leading,
    {
      id: 'dimension',
      label: t('ribbon.group.dimension', 'Dimension', { ns: 'editor' }),
      commands: [
        drawingCommand(ctx, 'dimension', t('ribbon.command.dimension', 'Dimension', { ns: 'editor' }), MoveHorizontal, t('ribbon.help.dragBetweenTwoPoints', 'Drag between two points; ends that land on an element follow it', { ns: 'editor' }), ['measure', 'annotation', 'associative', 'aligned', 'linear'], t),
        ...(draft ? [dimensionKinds(ctx, draft, t)] : []),
      ],
    },
    { id: 'detail', label: t('ribbon.group.detail', 'Detail', { ns: 'editor' }), commands: [detailLine(ctx, t), ...(draft ? [filletArc(ctx, draft, t)] : []), drawingCommand(ctx, 'cloud', t('ribbon.help.revisionCloud', 'Revision cloud', { ns: 'editor' }), Cloud, t('ribbon.help.cloudAChangeOnThe', 'Cloud a change on the sheet', { ns: 'editor' }), ['revision'], t)] },
    ...(draft ? [{ id: 'region', label: t('ribbon.group.region', 'Region', { ns: 'editor' }), commands: [region(ctx, draft, false, t), region(ctx, draft, true, t)] }] : []),
    { id: 'text', label: t('ribbon.group.text', 'Text', { ns: 'editor' }), commands: [drawingCommand(ctx, 'text', t('ribbon.command.text', 'Text', { ns: 'editor' }), Type, t('ribbon.help.addANoteDragIts', 'Add a note; drag its grips to re-wrap', { ns: 'editor' }), ['note', 'label', 'leader'], t)] },
    {
      id: 'tag',
      label: t('ribbon.group.tag', 'Tag', { ns: 'editor' }),
      commands: [
        drawingCommand(ctx, 'tag', t('ribbon.command.tag', 'Tag', { ns: 'editor' }), Tag, t('ribbon.help.clickAnElementToTag', 'Click an element to tag it with its size, mark or CFM', { ns: 'editor' }), ['label', 'mark', 'size', 'cfm'], t),
        drawingCommand(ctx, 'keynote', t('ribbon.command.keynote', 'Keynote', { ns: 'editor' }), KeyRound, t('ribbon.help.pickAKeynoteOrType', 'Pick a keynote (or type a key), then click elements: each gets the key and a keynote tag, and the sheet’s keynote list (Sheets › Live table › Keynote list) shows its words', { ns: 'editor' }), ['keynote', t('ribbon.help.keyNote', 'key note', { ns: 'editor' }), t('ribbon.help.noteNumber', 'note number', { ns: 'editor' }), t('ribbon.help.generalNote', 'general note', { ns: 'editor' }), 'legend'], t),
        drawingCommand(ctx, 'callout', t('ribbon.command.callout', 'Callout', { ns: 'editor' }), SquareDashed, t('ribbon.help.dragABoxRoundPart', 'Drag a box round part of a plan, then pick the enlarged view it refers to: its head shows that view’s number and sheet, and follows it to another sheet', { ns: 'editor' }), [t('ribbon.help.enlargedPlan', 'enlarged plan', { ns: 'editor' }), t('ribbon.help.viewReference', 'view reference', { ns: 'editor' }), t('ribbon.help.detailCallout', 'detail callout', { ns: 'editor' }), t('ribbon.help.referenceBubble', 'reference bubble', { ns: 'editor' })], t),
        {
          id: 'tag-all',
          label: t('ribbon.command.tagAll', 'Tag all', { ns: 'editor' }),
          icon: Tags,
          description: t('ribbon.description.tagEveryUntaggedDuctPipe', 'Tag every untagged duct, pipe, terminal, fixture and piece of equipment here, each at a clear spot (undo removes them all)', { ns: 'editor' }),
          keywords: [t('ribbon.keyword.autoTag', 'auto tag', { ns: 'editor' }), t('ribbon.keyword.tagAllUntagged', 'tag all untagged', { ns: 'editor' }), t('ribbon.keyword.labelEverything', 'label everything', { ns: 'editor' })],
          disabledReason: ctx.tagAll ? ctx.tagAll.disabledReason : t('ribbon.help.openAPlanOrA', 'Open a plan or a section to tag what it shows.', { ns: 'editor' }),
          run: ctx.tagAll?.run,
          testId: 'ribbon-tag-all',
        },
        {
          id: 'tag-styles',
          label: t('ribbon.command.tagStyles', 'Tag styles', { ns: 'editor' }),
          icon: Palette,
          description: t('ribbon.description.namedTagLooksWhatA', 'Named tag looks: what a tag says (any field, part parameters too), its size, box and leader, and the default for each kind of element', { ns: 'editor' }),
          keywords: [t('ribbon.keyword.tagType', 'tag type', { ns: 'editor' }), t('ribbon.keyword.labelStyle', 'label style', { ns: 'editor' }), t('ribbon.keyword.tagParameters', 'tag parameters', { ns: 'editor' }), t('ribbon.keyword.customTag', 'custom tag', { ns: 'editor' }), t('ribbon.keyword.insulationTag', 'insulation tag', { ns: 'editor' })],
          disabledReason: null,
          run: ctx.organization.openTagStyles,
          testId: 'ribbon-tag-styles',
        },
      ],
    },
    ...(draft
      ? [
          {
            id: 'symbol',
            label: t('ribbon.group.symbol', 'Symbol', { ns: 'editor' }),
            commands: [
              component(ctx, draft, t),
              drawingCommand(ctx, 'repeat', t('ribbon.help.repeatingDetail', 'Repeating detail', { ns: 'editor' }), Repeat, t('ribbon.help.aComponentRepeatedAlongA', 'A component repeated along a line (threaded rod, flex duct, brick)', { ns: 'editor' }), ['repeat', t('ribbon.help.arrayAlong', 'array along', { ns: 'editor' })], t),
              drawingCommand(ctx, 'batt', t('ribbon.command.insulation', 'Insulation', { ns: 'editor' }), Waves, t('ribbon.help.battInsulationOfATyped', 'Batt insulation of a typed thickness between two points', { ns: 'editor' }), ['batt', 'insulation', 'wrap'], t),
            ],
          },
        ]
      : []),
  ]
  return { id: 'annotate', label: t('ribbon.tab.annotate', 'Annotate', { ns: 'editor' }), groups }
}
