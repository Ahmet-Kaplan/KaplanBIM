import {
  AlignHorizontalJustifyCenter,
  ArrowRightLeft,
  CircleDot,
  ClipboardCopy,
  ClipboardPaste,
  CopyPlus,
  CornerDownRight,
  CornerRightUp,
  FlipHorizontal2,
  Grid3x3,
  ListEnd,
  MoreHorizontal,
  Move,
  Pin,
  PinOff,
  RotateCw,
  Ruler,
  Scaling,
  Scissors,
  SeparatorVertical,
  SquareRoundCorner,
  Trash2,
  X,
} from 'lucide-react'
import type { RibbonCommand, RibbonGroup, RibbonTab } from './types'
import { modifyLabel, PICK_ELEMENT_OPS, type ModifyOpName } from '../views-sheets/draft/draft-input'
import type { Translate } from '../i18n/translate'
import type { BuildingModelRibbonContext } from '../building-model-ribbon'
import { englishOnly } from '../i18n/translate'
import { TOOL_SHORTCUTS } from './tool-shortcuts'

/**
 * Modify: one set of edit verbs for model elements and drawn items. Each verb
 * works on what is selected where you are: drawn lines and notes on a sheet,
 * a detail view or a view's drawing; parts and runs in the model. A verb that
 * does not work on the model yet says so and says where it does work.
 *
 * The same Modify, Geometry and Edit groups sit on the Modify tab and on the
 * "Modify · Drawn items" tab that opens when drawn items are selected.
 */

const MODIFY_ICON: Record<ModifyOpName, RibbonCommand['icon']> = {
  move: Move,
  copy: CopyPlus,
  rotate: RotateCw,
  mirror: FlipHorizontal2,
  scale: Scaling,
  array: Grid3x3,
  polar_array: CircleDot,
  align: AlignHorizontalJustifyCenter,
  offset: ArrowRightLeft,
  trim_extend_corner: CornerRightUp,
  trim_extend_single: CornerDownRight,
  trim_extend_multiple: ListEnd,
  split: Scissors,
  split_gap: SeparatorVertical,
  fillet_arc: SquareRoundCorner,
  pin: Pin,
  unpin: PinOff,
}
function modifyWhat(t: Translate): Record<ModifyOpName, string> {
  return {
  move: t('ribbon.help.moveWhatIsSelectedFrom', 'Move what is selected from a base point to a new one', { ns: 'editor' }),
  copy: t('ribbon.help.copyWhatIsSelectedFrom', 'Copy what is selected from a base point to a new one', { ns: 'editor' }),
  rotate: t('ribbon.help.turnWhatIsSelectedAbout', 'Turn what is selected about a point by the angle you type', { ns: 'editor' }),
  mirror: t('ribbon.help.flipWhatIsSelectedAcross', 'Flip what is selected across a line you click (or keep the original)', { ns: 'editor' }),
  scale: t('ribbon.help.growOrShrinkWhatIs', 'Grow or shrink what is selected about a point', { ns: 'editor' }),
  array: t('ribbon.help.copiesInARowClick', 'Copies in a row: click the base point and where the next one goes', { ns: 'editor' }),
  polar_array: t('ribbon.help.copiesAroundACentre', 'Copies around a centre', { ns: 'editor' }),
  align: t('ribbon.help.lineAPointOnThe', 'Line a point on the selection up with a line', { ns: 'editor' }),
  offset: t('ribbon.help.aParallelLineArcOr', 'A parallel line, arc or circle a typed distance away (or two clicks apart); a joined chain offsets as one. Uncheck Copy to move the original', { ns: 'editor' }),
  trim_extend_corner: t('ribbon.help.clickTwoLinesOrArcs', 'Click two lines or arcs on the parts to keep: they meet in a sharp corner', { ns: 'editor' }),
  trim_extend_single: t('ribbon.help.clickABoundaryThenA', 'Click a boundary, then a line or arc to cut or lengthen to it', { ns: 'editor' }),
  trim_extend_multiple: t('ribbon.help.clickABoundaryThenEach', 'Click a boundary, then each line or arc to cut or lengthen to it', { ns: 'editor' }),
  split: t('ribbon.help.clickALineOrArcTo', 'Click a line or arc to cut it in two there (or twice, deleting the piece between)', { ns: 'editor' }),
  split_gap: t('ribbon.help.clickALineOrArc', 'Click a line or arc to cut a gap of a typed length into it', { ns: 'editor' }),
  fillet_arc: t('ribbon.help.clickTwoLinesAnArc', 'Click two lines: an arc of the radius you type rounds the corner, and the lines trim to it', { ns: 'editor' }),
  pin: t('ribbon.help.pinWhatIsSelectedSo', 'Pin what is selected so Move, trims, splits and Delete leave it alone', { ns: 'editor' }),
  unpin: t('ribbon.help.unpinWhatIsSelectedSo', 'Unpin what is selected so it can be changed again', { ns: 'editor' }),
  }
}

/** Where the Modify verbs act right now. */
type Target = 'drawn' | 'model'

function target(ctx: BuildingModelRibbonContext): Target {
  if (!ctx.drawingOpen) return 'model'
  // On a sheet or a detail view only drawn items can be picked. On a plan's drawing, drawn items win when some are picked; otherwise the model tools swap to its live model.
  if ((ctx.draft?.selectedIds.length ?? 0) > 0 || !ctx.liveViewOnDrawing) return 'drawn'
  return 'model'
}

function drawnReason(ctx: BuildingModelRibbonContext, op: ModifyOpName, t: Translate): string | null {
  if (!ctx.draft)
    return t('draft.editsLoadWithDrawing', 'Drawing edits load with the drawing. Open a sheet, a detail view, a plan or a section.', { ns: 'editor' })
  if (ctx.editBlocked) return ctx.editBlocked
  // Trim/Extend, Split and Fillet Arc start with nothing selected: you click the lines.
  if (PICK_ELEMENT_OPS.has(op)) return null
  const selected = ctx.draft.selectedIds.length
  if (selected === 0) return t('draft.selectDrawnFirst', 'Select drawn items first (Shift+click adds more).', { ns: 'editor' })
  return null
}

/** Verbs that work on drawn items only today. */
function notOnModelYet(op: ModifyOpName, t: Translate): string {
  return t('draft.notOnModelYet', '{{name}} works on drawn lines and notes today. Open a sheet, a detail view or a plan’s drawing and select what to change. Parts and runs move, turn and split from here.', {
    ns: 'editor',
    name: modifyLabel(op, t),
  })
}

function draftOp(ctx: BuildingModelRibbonContext, op: ModifyOpName): RibbonCommand {
  const t = ctx.t ?? englishOnly
  const draft = ctx.draft
  const where = target(ctx)
  return {
    id: `draft-${op}`,
    label: modifyLabel(op, t),
    icon: MODIFY_ICON[op],
    description: modifyWhat(t)[op],
    keywords: ['modify', 'edit', op.replace('_', ' ')],
    disabledReason: where === 'drawn' ? drawnReason(ctx, op, t) : notOnModelYet(op, t),
    pressed: draft?.pending?.kind === 'modify' && draft.pending.op === op,
    run: () => {
      if (!draft) return
      ctx.setDrawingTool('select')
      draft.setPending(draft.pending?.kind === 'modify' && draft.pending.op === op ? null : { kind: 'modify', op })
    },
    testId: `ribbon-draft-${op}`,
  }
}

function modelReason(ctx: BuildingModelRibbonContext): string | null {
  return ctx.editBlocked
}

function move(ctx: BuildingModelRibbonContext): RibbonCommand {
  const t = ctx.t ?? englishOnly
  if (target(ctx) === 'drawn') return draftOp(ctx, 'move')
  const group = ctx.selection?.kind === 'group' ? ctx.selection : null
  return {
    id: 'draft-move',
    label: t('ribbon.command.move', 'Move', { ns: 'editor' }),
    icon: Move,
    description: group ? t('ribbon.description.moveTheSelectionByA', 'Move the selection by a distance (connected runs follow; fixed parts refuse)', { ns: 'editor' }) : t('ribbon.description.dragAPartToA', 'Drag a part to a new spot (on a drawing: from a base point to a new one)', { ns: 'editor' }),
    shortcut: TOOL_SHORTCUTS.move,
    keywords: ['modify', 'drag', 'relocate'],
    disabledReason: modelReason(ctx) ?? (group && group.movable === 0 ? t('ribbon.help.nothingInThisSelectionMoves', 'Nothing in this selection moves on its own.', { ns: 'editor' }) : null),
    pressed: ctx.tool === 'move',
    run: group ? ctx.moveSelected : () => ctx.chooseTool(ctx.tool === 'move' ? 'select' : 'move'),
    testId: 'ribbon-draft-move',
  }
}

function rotate(ctx: BuildingModelRibbonContext): RibbonCommand {
  const t = ctx.t ?? englishOnly
  if (target(ctx) === 'drawn') return draftOp(ctx, 'rotate')
  const part = ctx.selection?.kind === 'part'
  return {
    id: 'draft-rotate',
    label: t('ribbon.command.rotate', 'Rotate', { ns: 'editor' }),
    icon: RotateCw,
    description: t('ribbon.description.turnTheSelectedPartA', 'Turn the selected part a quarter turn clockwise (typed angles work on drawn lines and notes)', { ns: 'editor' }),
    keywords: ['modify', 'turn', 'spin'],
    disabledReason: modelReason(ctx) ?? (part ? null : t('ribbon.help.selectAPartToTurn', 'Select a part to turn it a quarter turn. Typed angles work on drawn lines and notes.', { ns: 'editor' })),
    run: () => ctx.rotateSelected(90),
    testId: 'ribbon-draft-rotate',
  }
}

function split(ctx: BuildingModelRibbonContext): RibbonCommand {
  const t = ctx.t ?? englishOnly
  if (target(ctx) === 'drawn') {
    const face = draftOp(ctx, 'split')
    return { ...face, id: 'modify-split', split: true, children: [face, draftOp(ctx, 'split_gap')], testId: 'ribbon-modify-split' }
  }
  const sel = ctx.selection
  const straightRun = target(ctx) === 'model' && sel?.kind === 'run' && !sel.fitting
  return {
    id: 'modify-split',
    label: t('ribbon.command.split', 'Split', { ns: 'editor' }),
    icon: Scissors,
    description: t('ribbon.description.clickAlongTheSelectedDuct', 'Click along the selected duct or pipe run to split it there', { ns: 'editor' }),
    shortcut: TOOL_SHORTCUTS.split,
    keywords: ['cut', 'break', 'divide'],
    pressed: ctx.tool === 'split',
    disabledReason: modelReason(ctx) ?? (straightRun ? null : t('ribbon.help.selectAStraightDuctOr', 'Select a straight duct or pipe run, then click where to split it. Drawn lines split from a sheet or a detail view.', { ns: 'editor' })),
    run: ctx.splitSelected,
    testId: 'ribbon-modify-split',
  }
}

function deleteCommand(ctx: BuildingModelRibbonContext): RibbonCommand {
  const t = ctx.t ?? englishOnly
  if (target(ctx) === 'drawn') {
    const n = ctx.draft?.selectedIds.length ?? 0
    return {
      id: 'modify-delete',
      label: t('ribbon.command.deleteDrawn', 'Delete', { ns: 'editor' }),
      icon: Trash2,
      description:
        n === 1
          ? t('ribbon.description.deleteTheSelectedDrawn', 'Delete the selected drawn item (undo brings it back)', { ns: 'editor' })
          : t('ribbon.description.deleteSelectedDrawnItems', 'Delete the {{count}} selected drawn items (undo brings them back)', { ns: 'editor', count: n }),
      shortcut: 'Del',
      keywords: ['remove', 'erase'],
      disabledReason: ctx.editBlocked ?? (n > 0 ? null : t('ribbon.help.selectDrawnItemsToDelete', 'Select drawn items to delete them.', { ns: 'editor' })),
      run: () => ctx.draft?.sendRequest('delete'),
      testId: 'ribbon-modify-delete',
    }
  }
  return {
    id: 'modify-delete',
    label: t('ribbon.command.delete', 'Delete…', { ns: 'editor' }),
    icon: Trash2,
    description: t('ribbon.description.deleteWhatIsSelectedAsks', 'Delete what is selected (asks first; undo brings it back)', { ns: 'editor' }),
    shortcut: 'Del',
    keywords: ['remove', 'erase'],
    disabledReason: modelReason(ctx) ?? (ctx.selection ? null : t('ribbon.help.selectSomethingToDeleteIt', 'Select something to delete it.', { ns: 'editor' })),
    run: ctx.deleteSelected,
    testId: 'ribbon-modify-delete',
  }
}

function measure(ctx: BuildingModelRibbonContext, reason: string | null): RibbonCommand {
  const t = ctx.t ?? englishOnly
  return {
    id: 'measure',
    label: t('ribbon.command.measure', 'Measure', { ns: 'editor' }),
    icon: Ruler,
    description: t('ribbon.description.clickTwoPointsToMeasure', 'Click two points to measure between them', { ns: 'editor' }),
    shortcut: TOOL_SHORTCUTS.measure,
    keywords: ['distance', 'tape'],
    pressed: ctx.tool === 'measure',
    disabledReason: reason,
    run: () => ctx.chooseTool(ctx.tool === 'measure' ? 'select' : 'measure'),
    testId: 'ribbon-measure',
  }
}

/** Trim/Extend ▾: the face runs Trim/Extend to Corner; the arrow lists Single and Multiple. */
function trimExtend(ctx: BuildingModelRibbonContext): RibbonCommand {
  const face = draftOp(ctx, 'trim_extend_corner')
  return { ...face, id: 'draft-trim-extend', split: true, children: [face, draftOp(ctx, 'trim_extend_single'), draftOp(ctx, 'trim_extend_multiple')], testId: 'ribbon-draft-trim-extend' }
}

/** Pin ▾: Pin, and Unpin in the menu. */
function pinCommand(ctx: BuildingModelRibbonContext): RibbonCommand {
  const face = draftOp(ctx, 'pin')
  return { ...face, id: 'draft-pin-menu', split: true, children: [face, draftOp(ctx, 'unpin')], testId: 'ribbon-draft-pin-menu' }
}

/** Copy (Ctrl+C) and Paste (Ctrl+V) of placed parts, in Modify › More so the group keeps five faces. */
function clipboardCommands(ctx: BuildingModelRibbonContext): RibbonCommand[] {
  const t = ctx.t ?? englishOnly
  const c = ctx.clipboard
  if (!c) return []
  return [
    { id: 'clipboard-copy', label: t('ribbon.command.copyParts', 'Copy parts', { ns: 'editor' }), icon: ClipboardCopy, description: t('ribbon.description.rememberTheSelectedDevicesFixtures', 'Remember the selected devices, fixtures and equipment to paste them elsewhere', { ns: 'editor' }), shortcut: '⌘C', keywords: ['copy', 'clipboard', 'duplicate'], disabledReason: c.copyBlocked, run: c.copy, testId: 'ribbon-clipboard-copy' },
    { id: 'clipboard-paste', label: t('ribbon.command.pasteParts', 'Paste parts', { ns: 'editor' }), icon: ClipboardPaste, description: t('ribbon.description.putACopyOfWhat', 'Put a copy of what you copied under the pointer: one edit, one undo, on no circuit and with no mark', { ns: 'editor' }), shortcut: '⌘V', keywords: ['paste', 'clipboard'], disabledReason: c.pasteBlocked, run: c.paste, testId: 'ribbon-clipboard-paste' },
  ]
}

/** The Modify, Geometry and Edit groups (shared by the Modify tab and the drawn-items tab). `modelToolReason` is why model tools are off here, if they are. */
export function modifyGroups(ctx: BuildingModelRibbonContext, modelToolReason: string | null): RibbonGroup[] {
  const t = ctx.t ?? englishOnly
  return [
    {
      id: 'modify',
      label: t('ribbon.group.modify', 'Modify', { ns: 'editor' }),
      shared: true,
      commands: [
        move(ctx),
        draftOp(ctx, 'copy'),
        rotate(ctx),
        draftOp(ctx, 'mirror'),
        { id: 'draft-modify-more', label: t('ribbon.command.more', 'More', { ns: 'editor' }), icon: MoreHorizontal, description: ctx.clipboard ? t('ribbon.description.copyAndPastePartsScale', 'Copy and paste parts, scale, align and arrays', { ns: 'editor' }) : t('ribbon.description.scaleAlignAndArrays', 'Scale, align and arrays', { ns: 'editor' }), children: [...clipboardCommands(ctx), draftOp(ctx, 'scale'), draftOp(ctx, 'align'), draftOp(ctx, 'array'), draftOp(ctx, 'polar_array')], testId: 'ribbon-draft-modify-more' },
      ],
    },
    { id: 'geometry', label: t('ribbon.group.geometry', 'Geometry', { ns: 'editor' }), shared: true, commands: [draftOp(ctx, 'offset'), trimExtend(ctx), split(ctx), draftOp(ctx, 'fillet_arc')] },
    { id: 'edit', label: t('ribbon.group.edit', 'Edit', { ns: 'editor' }), shared: true, commands: [deleteCommand(ctx), pinCommand(ctx), measure(ctx, modelToolReason)] },
  ]
}

export function modifyTab(ctx: BuildingModelRibbonContext, leading: RibbonGroup, modelToolReason: string | null): RibbonTab {
  const t = ctx.t ?? englishOnly
  return { id: 'modify', label: t('ribbon.tab.modify', 'Modify', { ns: 'editor' }), groups: [leading, ...modifyGroups(ctx, modelToolReason)] }
}

/** "Modify · Drawn items": opens while drawn lines, notes or symbols are selected on the open drawing. */
export function drawnItemsTab(ctx: BuildingModelRibbonContext, leading: RibbonGroup, modelToolReason: string | null): RibbonTab | null {
  const t = ctx.t ?? englishOnly
  const n = ctx.draft?.selectedIds.length ?? 0
  if (!ctx.drawingOpen || n === 0) return null
  return {
    id: 'drawn-items',
    label: t('ribbon.tab.drawnItems', 'Modify · Drawn items', { ns: 'editor' }),
    contextual: true,
    groups: [
      leading,
      ...modifyGroups(ctx, modelToolReason),
      { id: 'drawn-done', label: n === 1 ? t('ribbon.command.1DrawnItem', '1 drawn item', { ns: 'editor' }) : t('ribbon.command.nDrawnItems', '{{count}} drawn items', { ns: 'editor', count: n }), commands: [{ id: 'deselect-drawn', label: t('ribbon.command.deselect', 'Deselect', { ns: 'editor' }), icon: X, description: t('ribbon.description.clearTheSelection', 'Clear the selection', { ns: 'editor' }), shortcut: 'Esc', run: () => ctx.draft?.sendRequest('deselect'), testId: 'ribbon-deselect-drawn' }] },
    ],
  }
}
