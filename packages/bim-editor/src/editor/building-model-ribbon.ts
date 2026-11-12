import {
  BookOpenCheck,
  Plug,
  ShieldAlert,
  ChartLine,
  ImagePlus,
  Activity,
  ArrowUpDown,
  FlipVertical2,
  Axis3d,
  Compass,
  CopyPlus,
  MapPinned,
  Move3d,
  Navigation2,
  ArrowDown,
  ArrowUp,
  Check,
  CornerDownRight,
  Filter,
  Spline,
  SquareDashedMousePointer,
  SquareSplitHorizontal,
  Table2,
  Box,
  Copy,
  Focus,
  Expand,
  Crop,
  Eye,
  FileText,
  Frame,
  Gauge,
  Group,
  History,
  Building2,
  Layers,
  Rows3,
  LayoutTemplate,
  Link2,
  Maximize,
  MousePointer2,
  Move,
  MoveHorizontal,
  PackagePlus,
  PenLine,
  PencilRuler,
  Pencil,
  Plus,
  Printer,
  KeyRound,
  LayoutGrid,
  ListOrdered,
  ClipboardList,
  Stamp,
  Redo2,
  RotateCcw,
  RotateCw,
  Route,
  Ruler,
  Scissors,
  Shapes,
  Sigma,
  Square,
  SquareDashed,
  Trash2,
  Undo2,
  X,
  FileBox,
  GitBranch,
  UserCheck,
  FilePen,
  Sparkles,
} from 'lucide-react'
import { DRAFTING_VIEW_REASON } from '@permitzip/bim-kernel'
import type { RibbonCommand, RibbonGroup, RibbonTab } from './ribbon/types'
import type { AxisLock } from './route-axis'
import type { DrawingTool } from './views-sheets/DrawingCanvas'
import { annotateTab, type DetailShape } from './ribbon/annotate-tab'
import { drawnItemsTab, modifyTab } from './ribbon/modify-tab'
import { englishOnly, type Translate } from './i18n/translate'
import { TOOL_SHORTCUTS, type BuildingModelTool } from './ribbon/tool-shortcuts'
import type { AddonAvailability, AddonId, AddonInput, TablePlacer } from './contributions/types'
import { addonTabAnalyzeCommands, addonTabPlanCommands, contributedCommands, contributedTabs } from './contributions/ribbon'
import { withScheduleGroups, type RibbonSchedules } from './ribbon/schedules-group'
import { withPlanGroups, type RibbonPlan } from './ribbon/plan-group'
import { isTradeTab, withTradeSectionCommands } from './ribbon/trade-tab'
import type { DraftController } from './views-sheets/draft/useDraftController'
import type { PanelRequest } from './views-sheets/ViewsSheetsPanel'
import { calculationCommand } from './calc-sheets/calc-ribbon'
import { riseStyleLabel, type RiseStyle } from './route-rise'
import { placeKeynoteList } from './views-sheets/keynotes'

export { TOOL_SHORTCUTS, type BuildingModelTool }

/** Switches the 3D view between perspective and orthographic (the same key as the numpad toggle in common 3D tools). */
export const PROJECTION_SHORTCUT = '5'

/** Categories box select keeps. */
export type BoxCategory = 'duct' | 'pipe' | 'parts'

/** The Route contextual tab's state and actions, while the Route tool is on. */
export interface RouteRibbon {
  readonly riseStyle: RiseStyle
  readonly setRiseStyle: (style: RiseStyle) => void
  /** Raise (positive) or drop the run at the current point, in feet. */
  readonly rise: (ft: number) => void
  readonly lock: AxisLock
  readonly setLock: (lock: Exclude<AxisLock, 'auto'>) => void
  readonly chooseElbow: () => void
  readonly chooseTakeoff: () => void
  readonly offsetArmed: boolean
  readonly armOffset: () => void
  readonly finish: () => void
  readonly cancel: () => void
  /** Why Finish can't be pressed (null when it can). */
  readonly finishBlocked: string | null
  /** Why a rise can't be added yet (null when it can). */
  readonly riseBlocked: string | null
}

/** What is selected in the model, as far as the ribbon's contextual tab cares. */
export type RibbonSelection =
  | { readonly kind: 'part'; readonly label: string }
  | { readonly kind: 'run'; readonly label: string; readonly domain: 'duct' | 'pipe'; readonly fitting?: boolean }
  | { readonly kind: 'branch'; readonly label: string }
  /** A run, branch or system picked with Tab, or a box selection. */
  | { readonly kind: 'group'; readonly label: string; readonly count: number; readonly runs: number; readonly movable: number }
  | null

export interface BuildingModelRibbonContext {
  /**
   * The ribbon's translator (`useEditorTranslate()` in the surface), so the tab
   * and group captions come out in the host's language. Absent: English, which
   * is the English written at each `t('key', 'English')` call site.
   */
  readonly t?: Translate
  readonly tool: BuildingModelTool
  readonly chooseTool: (tool: BuildingModelTool) => void
  /** Null when editing is allowed; otherwise why not, in the operator's words. */
  readonly editBlocked: string | null
  /** A sheet or a view's printed drawing fills the canvas (the model tools don't apply). */
  readonly drawingOpen: 'sheet' | 'detail' | null
  /** The drawing is of a plan, section or 3D view: the model tools still work (they switch it to its live model). */
  readonly liveViewOnDrawing?: boolean
  /** Swap a plan, section or 3D view's drawing for its live model (what the model tools do before they start). */
  readonly showLiveModel: () => void
  readonly undoLabel: string | null
  readonly redoLabel: string | null
  readonly undo: () => void
  readonly redo: () => void
  readonly fit: () => void
  /** The free 3D model is open (the roof can come off). */
  readonly model3dOpen: boolean
  readonly roofOff: boolean
  readonly setRoofOff: (on: boolean) => void
  readonly showStats: boolean
  readonly setShowStats: (on: boolean) => void
  /** The 3D view's projection; null when no 3D view is in the canvas (plans, sheets, drawings). */
  readonly projection: { readonly value: 'perspective' | 'orthographic'; readonly toggle: () => void } | null
  readonly drawingTool: DrawingTool
  readonly drawingTools: readonly DrawingTool[]
  /** Tag every untagged duct, pipe, terminal, fixture and piece of equipment in the open plan or section; null elsewhere. */
  readonly tagAll: { readonly run: () => void; readonly disabledReason: string | null } | null
  readonly setDrawingTool: (tool: DrawingTool) => void
  /** The shape Annotate › Detail line drew last (its face draws it again); line when unset. */
  readonly lastDetailShape?: DetailShape
  /** Draft settings shared with the drawing canvas (snaps, dimension kind, the modify operation waiting for clicks). */
  readonly draft?: DraftController
  readonly request: (r: PanelRequest) => void
  /** Model schedules on every discipline tab, and Manage › Library; absent: none (tests and read-only hosts). */
  readonly schedules?: RibbonSchedules | null
  /** Equipment list, Not placed yet and Spaces, right after Select on each trade tab (ribbon/plan-group.ts). */
  readonly plan?: RibbonPlan | null
  readonly sectionDrawing: boolean
  readonly toggleSection: () => void
  readonly planOpen: boolean
  readonly openModel: (mode: '3d' | 'plan') => void
  /** The open saved view's crop state; null when no saved view (with a crop) is open. */
  readonly crop: { readonly on: boolean; readonly shown: boolean; readonly set: (change: { cropView?: boolean; showCropBox?: boolean }) => void } | null
  /** The 3D crop box of the 3D picture in the canvas (a 3D view, or your working 3D view in the 3D model); null when none is. */
  readonly crop3d: Crop3dRibbon | null
  readonly sheet: { readonly number: string; readonly editTitleBlock: () => void; readonly print: () => void; readonly arrange: () => void; readonly revisions: () => void; readonly chart?: () => void; readonly picture?: () => void; readonly calculation?: () => void; readonly loadSummary?: () => void; readonly placeTable?: (place: TablePlacer) => void } | null
  /** The model has at least one sheet (Print set / Issue set). */
  readonly hasSheets: boolean
  /** Sheets print black only (the project's choice); false: colour. */
  readonly printBlackOnly?: boolean
  readonly setPrintBlackOnly?: (on: boolean) => void
  readonly canLink: boolean
  readonly openLink: () => void
  /** What Link a model brings in here, naming only the sources the host serves; absent: Autodesk Docs or an IFC file. */
  readonly linkDescription?: string
  /** Why nothing can be linked where the editor runs (the host serves no link source), in words; null or absent when something can. */
  readonly linkUnavailableReason?: string | null
  /** Round 10 T10: Manage › Connect an agent (the core and each pack's connection). */
  readonly openConnectAgent?: () => void
  readonly addLevel: () => void
  /** Model › Datum › Mounting plane: a surface to place air devices on where there is no ceiling. */
  readonly addMountingPlane: () => void
  /** Model › Datum › Architect's levels: the linked model's storeys as levels, previewed first. */
  readonly useArchitectLevels: () => void
  /** The level planes in the 3D view. */
  readonly showLevels: boolean
  readonly setShowLevels: (show: boolean) => void
  /** Model › Parts: the part editor, for a new part type or the selected part's type. */
  readonly parts: PartsRibbon
  readonly selection: RibbonSelection
  readonly rotateSelected: (deg: number) => void
  readonly editType: () => void
  readonly resizeSelected: () => void
  /** Duct fittings: jump to the fitting type picker in the properties panel. */
  readonly chooseFittingType: () => void
  /** Where reducer shape (centred, or flat on top or bottom) is chosen for what is selected. */
  readonly reducerShape: () => void
  /** The selected run's insulation, and Make system default. */
  readonly focusRunInsulation: () => void
  /** Duct runs: show the piece's pressure and the fan's required static in the properties panel. */
  readonly showPressure: () => void
  readonly deleteSelected: () => void
  readonly clearSelection: () => void
  /** Duct and pipe runs: arm the split tool on the selected run. */
  readonly splitSelected: () => void
  /** A group: jump to the move fields in the properties panel. */
  readonly moveSelected: () => void
  readonly boxFilter: Readonly<Record<BoxCategory, boolean>>
  readonly toggleBoxFilter: (category: BoxCategory) => void
  /** Non-null while the Route tool is on. */
  readonly route: RouteRibbon | null
  /** Model › Build › Ceiling: the ceiling plan's Ceiling tool (`ceilings/`); absent until wired. */
  readonly ceiling?: RibbonCommand
  /** Manage › Groups & phases. */
  readonly organization: { readonly openGroups: () => void; readonly openPhases: () => void; readonly openFilters: () => void; readonly openTagStyles: () => void; readonly openConstructionStages?: () => void; readonly openAddons?: () => void; readonly openCodes?: () => void }
  /** Jump to a section of the open view's properties; null when no saved view is open. `range`: plans only; `linked`: with linked models. */
  readonly viewGraphics: { readonly lines: () => void; readonly range: (() => void) | null; readonly linked: (() => void) | null } | null
  readonly coordinates: CoordinatesRibbon
  /** Create similar (C S): start the tool that makes another of the selection, set to match it (create-similar.ts). */
  readonly createSimilar?: () => void
  /** Manage › Coordination: clashes and coordination findings (components/building-model/coordination). */
  readonly coordination?: { readonly open: () => void }
  /** Manage › Versions & sign-off (round 8b): saved versions and branches, who is responsible, change orders. Absent: not offered (tests, read-only hosts). */
  readonly history?: { readonly openVersions: () => void; readonly openResponsibilities: () => void; readonly openChangeOrders: () => void; /** Manage › Copies (contractor and shop copies); absent when the model server isn't connected. */ readonly openCopies?: () => void }
  /** Route duct / Route pipe: start the Route tool on duct or pipe. Absent: Route starts on whatever was routed last. */
  readonly routeAs?: (kind: 'duct' | 'pipe') => void
  /** What the Route tool is drawing while it is on. */
  readonly routeKind?: 'duct' | 'pipe'
  /** Copy (Ctrl+C) the selected parts and Paste (Ctrl+V) them under the pointer; each `blocked` says why it is off. */
  readonly clipboard?: { readonly copyBlocked: string | null; readonly copy: () => void; readonly pasteBlocked: string | null; readonly paste: () => void }
  /** The model's add-ons (`addonAvailability`). Absent: the first-party add-ons only. Add-on tabs and commands come from their contributions (contributions/). */
  readonly addons?: AddonAvailability
  /** Each add-on's ribbon input (its workflow's, or why it is not ready); an add-on's tabs show only when it has one. */
  readonly addonInputs?: Readonly<Record<AddonId, AddonInput<unknown>>>
}

/** On a drawing a Select drag on empty paper is already the box; the command is what keeps the box on for the 3D view. */
/** What box select says on a drawing: the words the tooltip shows while the box is on. */
export function boxOnDrawingDescription(t: Translate = englishOnly): string {
  return t('ribbon.description.dragOnEmptySpaceSelects', 'Drag on empty space selects; this keeps the box on for the 3D view', { ns: 'editor' })
}

/** Model › Parts (and Manage › Part types): open the part editor. */
export interface PartsRibbon {
  readonly newPart: () => void
  /** Why New part can't open (null when it can). */
  readonly newBlocked: string | null
  readonly editSelected: () => void
  /** Why Edit part can't open the selection's type (null when it can). */
  readonly editBlocked: string | null
  /** Model in place: click a spot, then draw the part there in the part editor; absent where the host has no spot pick. */
  readonly modelInPlace?: () => void
}

/** Views › Crop while a 3D picture is in the canvas. */
export interface Crop3dRibbon {
  readonly on: boolean
  readonly shown: boolean
  readonly set: (change: { readonly enabled?: boolean; readonly show?: boolean }) => void
  readonly toSelection: () => void
  readonly reset: () => void
  /** Why Crop to selection can't run (null when it can). */
  readonly selectionBlocked: string | null
  /** Turn the box about its middle to the working angle (a command; the box has no rotate handle). */
  readonly alignToWorkingAngle: () => void
  /** Pick a building edge and turn the box square to it. */
  readonly alignToEdge: () => void
  /** Why aligning can't run (null when it can). */
  readonly alignBlocked: string | null
}

/** Manage › Coordinates: moving the origin, the Coordinates dialog (project origin, site point, true north, working angle), aligning the axes to an edge, and the open plan's orientation (Show origin & axes is under Model › Display). */
export interface CoordinatesRibbon {
  readonly showOrigin: boolean
  readonly setShowOrigin: (on: boolean) => void
  /** Dragging the origin: the marker follows the pointer and a click places it. */
  readonly moving: boolean
  readonly toggleMove: () => void
  readonly openTrueNorth: () => void
  readonly openSurveyPoint: () => void
  /** Coordinates on its Project origin tab, the marker on the project origin. */
  readonly openOrigin: () => void
  /** Coordinates on its Working angle tab. */
  readonly openWorkingAngle: () => void
  /** Pick a building edge: the working angle turns square to it. */
  readonly alignAxes: () => void
  /** An edge pick for the working angle is in progress. */
  readonly aligningAxes: boolean
  /** The open saved plan's orientation; null when no saved plan is open. */
  readonly orientation: { readonly value: PlanOrientationChoice; readonly set: (value: PlanOrientationChoice) => void } | null
}

export type PlanOrientationChoice = 'plan_north' | 'true_north' | 'working_angle'

function orientationLabels(t: Translate): Readonly<Record<PlanOrientationChoice, string>> {
  return { plan_north: t('ribbon.help.planNorth', 'Plan north', { ns: 'editor' }), true_north: t('ribbon.help.trueNorth', 'True north', { ns: 'editor' }), working_angle: t('ribbon.help.workingAngle', 'Working angle', { ns: 'editor' }) }
}

function orientationHelp(t: Translate): Readonly<Record<PlanOrientationChoice, string>> {
  return {
    plan_north: t('ribbon.help.drawThePlanWithPlan', 'Draw the plan with plan north (model +Y) up', { ns: 'editor' }),
    true_north: t('ribbon.help.turnThePlanSoTrue', 'Turn the plan so true north points up', { ns: 'editor' }),
    working_angle: t('ribbon.help.turnThePlanSoThe', 'Turn the plan so the building’s walls (the working angle) run square to the screen', { ns: 'editor' }),
  }
}

function openModelForOrigin(t: Translate): string {
  return t('ribbon.help.theOriginShowsInThe', 'The origin shows in the 3D model and plans. Open one from the Views and sheets panel.', { ns: 'editor' })
}

function openAPlanForOrientation(t: Translate): string {
  return t('ribbon.help.openASavedFloorOr', 'Open a saved floor or ceiling plan to set which north is up.', { ns: 'editor' })
}

function open3DToCrop(t: Translate): string {
  return t('ribbon.help.worksIn3DOpenThe', 'Works in 3D: open the 3D model or a 3D view.', { ns: 'editor' })
}

/** Views › Crop in 3D: the box crops (or not), shows its grips (or not), fits the selection, resets. Your own working view needs no edit access to try. */
function crop3dCommands(c: Crop3dRibbon, t: Translate): RibbonCommand[] {
  return [
    { id: 'crop-view', label: t('ribbon.command.3DCropBox', '3D crop box', { ns: 'editor' }), icon: Crop, description: c.on ? t('ribbon.description.croppingToThe3DBox', 'Cropping to the 3D box. Press to show everything again', { ns: 'editor' }) : t('ribbon.description.showOnlyWhatIsInsideThe', 'Show only what is inside the 3D crop box', { ns: 'editor' }), keywords: [t('ribbon.keyword.sectionBox', 'section box', { ns: 'editor' }), 'clip', 'crop'], pressed: c.on, run: () => c.set({ enabled: !c.on, ...(c.on ? {} : { show: true }) }), testId: 'ribbon-crop-3d' },
    { id: 'crop-show', label: t('ribbon.command.showCropBox', 'Show crop box', { ns: 'editor' }), icon: Frame, description: t('ribbon.description.drawTheBoxAndIts', 'Draw the box and its six grips so you can push and pull its sides', { ns: 'editor' }), pressed: c.shown, run: () => c.set({ show: !c.shown }), testId: 'ribbon-crop-3d-show' },
    { id: 'crop-3d-selection', label: t('ribbon.command.cropToSelection', 'Crop to selection', { ns: 'editor' }), icon: Focus, description: t('ribbon.description.fitTheBoxToThe', 'Fit the box to the storey and grid bay around what is selected, and crop', { ns: 'editor' }), keywords: [t('ribbon.keyword.sectionBox', 'section box', { ns: 'editor' }), 'selection box', 'isolate'], disabledReason: c.selectionBlocked, run: c.toSelection, testId: 'ribbon-crop-3d-selection' },
    { id: 'crop-3d-reset', label: t('ribbon.command.resetCrop', 'Reset crop', { ns: 'editor' }), icon: Expand, description: t('ribbon.description.putTheBoxBackAround', 'Put the box back around the whole model, square to the working angle, linked models included', { ns: 'editor' }), run: c.reset, testId: 'ribbon-crop-3d-reset' },
    {
      id: 'crop-3d-align',
      label: t('ribbon.command.alignCropBox', 'Align crop box', { ns: 'editor' }),
      icon: RotateCw,
      description: t('ribbon.description.turnTheBoxAboutIts', 'Turn the box about its middle, size kept: to the working angle, or square to a building edge you pick', { ns: 'editor' }),
      keywords: [t('ribbon.keyword.rotateCrop', 'rotate crop', { ns: 'editor' }), t('ribbon.keyword.turnCrop', 'turn crop', { ns: 'editor' }), t('ribbon.keyword.sectionBox', 'section box', { ns: 'editor' }), t('ribbon.keyword.skewedBuilding', 'skewed building', { ns: 'editor' })],
      disabledReason: c.alignBlocked,
      children: [
        { id: 'crop-3d-align-working', label: t('ribbon.command.toTheWorkingAngle', 'To the working angle', { ns: 'editor' }), icon: Axis3d, description: t('ribbon.description.turnTheBoxSquareTo', 'Turn the box square to the working angle', { ns: 'editor' }), disabledReason: c.alignBlocked, run: c.alignToWorkingAngle, testId: 'ribbon-crop-3d-align-working' },
        { id: 'crop-3d-align-edge', label: t('ribbon.command.toAnEdge', 'To an edge…', { ns: 'editor' }), icon: Ruler, description: t('ribbon.description.clickAWallOrTwoPoints', 'Click a wall, or two points along a building edge, and the box turns square to it', { ns: 'editor' }), disabledReason: c.alignBlocked, run: c.alignToEdge, testId: 'ribbon-crop-3d-align-edge' },
      ],
      testId: 'ribbon-crop-3d-align',
    },
  ]
}

/** What box select calls a kind, in the host's language. */
function boxCategoryName(category: BoxCategory, t: Translate): string {
  if (category === 'duct') return t('ribbon.command.duct', 'Duct', { ns: 'editor' })
  if (category === 'pipe') return t('ribbon.command.pipe', 'Pipe', { ns: 'editor' })
  return t('ribbon.command.parts', 'Parts', { ns: 'editor' })
}

function modelToolsOnSheet(t: Translate): string {
  return t('ribbon.help.modelToolsWorkInPlans', 'Model tools work in plans, sections and the 3D model. Double-click a plan or section on this sheet to edit it here, or open one from the Views and sheets panel.', { ns: 'editor' })
}

/**
 * Select, at the left of every tab: one Select that picks whatever is under
 * the pointer (parts and runs in the model, drawn items on a drawing), box
 * select, and what box select keeps.
 */
function selectGroup(ctx: BuildingModelRibbonContext, modelToolsOffReason: string | null, t: Translate): RibbonGroup {
  const selecting = ctx.drawingOpen && !ctx.liveViewOnDrawing ? ctx.drawingTool === 'select' && !ctx.draft?.pending : ctx.tool === 'select' && (!ctx.drawingOpen || ctx.drawingTool === 'select')
  const chooseSelect = () => {
    ctx.draft?.setPending(null)
    if (ctx.drawingOpen) ctx.setDrawingTool('select')
    ctx.chooseTool('select')
  }
  const label = t('ribbon.group.select', 'Select', { ns: 'editor' })
  return {
    id: 'select',
    label,
    shared: true,
    tool: { value: ctx.tool === 'box' ? 'box' : selecting ? 'select' : '', onValueChange: (v) => (v === 'box' ? ctx.chooseTool('box') : chooseSelect()), ariaLabel: label },
    commands: [
      { id: 'select', label: t('ribbon.command.select', 'Select', { ns: 'editor' }), icon: MousePointer2, description: t('ribbon.description.pickSomethingToSeeIts', 'Pick something to see its properties: a part or a run in the model, a line or a note on a drawing. Drag on empty space of a drawing or plan to box select (left to right: wholly inside; right to left: touching). In 3D, drag turns the view and Shift+drag boxes; the middle button pans. Drag a selection to move it (hold Shift while dragging for up and down)', { ns: 'editor' }), shortcut: TOOL_SHORTCUTS.select, keywords: ['pick', 'modify'], disabledReason: null, run: chooseSelect, testId: 'ribbon-select' },
      {
        id: 'box',
        label: t('ribbon.command.boxSelect', 'Box select', { ns: 'editor' }),
        icon: SquareDashedMousePointer,
        description: ctx.drawingOpen ? boxOnDrawingDescription(t) : t('ribbon.description.dragABoxLeftTo', 'Drag a box: left to right picks what is fully inside, right to left what it touches (Shift+drag with Select does the same)', { ns: 'editor' }),
        shortcut: TOOL_SHORTCUTS.box,
        keywords: ['window', 'crossing', 'marquee', 'region', 'lasso'],
        pressed: ctx.tool === 'box',
        disabledReason: modelToolsOffReason,
        run: () => ctx.chooseTool(ctx.tool === 'box' ? 'select' : 'box'),
        testId: 'ribbon-box-select',
      },
      {
        id: 'box-filter',
        label: t('ribbon.command.filter', 'Filter', { ns: 'editor' }),
        icon: Filter,
        description: t('ribbon.description.boxSelectKeepsWhat', 'Box select keeps: {{kinds}}', {
          ns: 'editor',
          kinds:
            (['duct', 'pipe', 'parts'] as const)
              .filter((c) => ctx.boxFilter[c])
              .map((c) => boxCategoryName(c, t))
              .join(t('ribbon.help.listSeparator', ', ', { ns: 'editor' })) || t('ribbon.help.nothingTurnAKindOn', 'nothing (turn a kind on)', { ns: 'editor' }),
        }),
        keywords: ['category', 'filter'],
        children: (['duct', 'pipe', 'parts'] as const).map((c) => ({
          id: `box-filter-${c}`,
          label: c === 'parts' ? t('ribbon.command.parts', 'Parts', { ns: 'editor' }) : c === 'duct' ? t('ribbon.command.duct', 'Duct', { ns: 'editor' }) : t('ribbon.command.pipe', 'Pipe', { ns: 'editor' }),
          icon: ctx.boxFilter[c] ? Check : Square,
          description: t('ribbon.description.keepCategoryInBoxSelections', '{{keep}} {{category}} in box selections', { ns: 'editor', keep: ctx.boxFilter[c] ? t('ribbon.help.keep', 'Keep', { ns: 'editor' }) : t('ribbon.help.skip', 'Skip', { ns: 'editor' }), category: boxCategoryName(c, t) }),
          pressed: ctx.boxFilter[c],
          run: () => ctx.toggleBoxFilter(c),
          testId: `ribbon-box-filter-${c}`,
        })),
        testId: 'ribbon-box-filter',
      },
    ],
  }
}

/** Undo and Redo: beside Find a tool on every tab. */
export function buildingModelQuickCommands(ctx: Pick<BuildingModelRibbonContext, 'undoLabel' | 'redoLabel' | 'undo' | 'redo' | 'editBlocked'>, t: Translate = englishOnly): RibbonCommand[] {
  return [
    { id: 'undo', label: t('ribbon.command.undo', 'Undo', { ns: 'editor' }), ariaLabel: ctx.undoLabel ? t('ribbon.aria.undoLabel', 'Undo {{label}}', { ns: 'editor', label: ctx.undoLabel }) : t('ribbon.aria.undo', 'Undo', { ns: 'editor' }), icon: Undo2, description: ctx.undoLabel ? t('ribbon.description.undoLabel', 'Undo {{label}}', { ns: 'editor', label: ctx.undoLabel }) : t('ribbon.description.undoYourLastEdit', 'Undo your last edit', { ns: 'editor' }), shortcut: '⌘Z', disabledReason: ctx.editBlocked ?? (ctx.undoLabel ? null : t('ribbon.help.nothingOfYoursToUndo', 'Nothing of yours to undo yet', { ns: 'editor' })), run: ctx.undo, testId: 'ribbon-undo' },
    { id: 'redo', label: t('ribbon.command.redo', 'Redo', { ns: 'editor' }), ariaLabel: ctx.redoLabel ? t('ribbon.aria.redoLabel', 'Redo {{label}}', { ns: 'editor', label: ctx.redoLabel }) : t('ribbon.aria.redo', 'Redo', { ns: 'editor' }), icon: Redo2, description: ctx.redoLabel ? t('ribbon.description.redoLabel', 'Redo {{label}}', { ns: 'editor', label: ctx.redoLabel }) : t('ribbon.description.redo', 'Redo', { ns: 'editor' }), shortcut: '⇧⌘Z', disabledReason: ctx.editBlocked ?? (ctx.redoLabel ? null : t('ribbon.help.nothingToRedo', 'Nothing to redo', { ns: 'editor' })), run: ctx.redo, testId: 'ribbon-redo' },
  ]
}

/** The Building Model's ribbon: every tool it has, in tabs, with why each is off when it is. Undo and Redo are separate (`buildingModelQuickCommands`). */
export function buildingModelRibbon(ctx: BuildingModelRibbonContext): RibbonTab[] {
  const t = ctx.t ?? englishOnly
  const modelToolsOff = ctx.drawingOpen !== null && !ctx.liveViewOnDrawing
  // A view drawing that is off is a detail view: it has no model in it.
  const MODEL_TOOLS_ON_DRAWING = ctx.drawingOpen === 'detail' ? DRAFTING_VIEW_REASON : modelToolsOnSheet(t)
  const modelToolReason = (needsEdit: boolean): string | null => (modelToolsOff ? MODEL_TOOLS_ON_DRAWING : needsEdit ? ctx.editBlocked : null)
  const select = selectGroup(ctx, modelToolsOff ? MODEL_TOOLS_ON_DRAWING : null, t)
  const tool = (id: BuildingModelTool, label: string, icon: RibbonCommand['icon'], description: string, needsEdit: boolean, keywords: string[] = []): RibbonCommand => ({
    id,
    label,
    icon,
    description,
    shortcut: TOOL_SHORTCUTS[id],
    keywords,
    disabledReason: modelToolReason(needsEdit),
    run: () => ctx.chooseTool(id),
    testId: `ribbon-tool-${id}`,
  })

  const routeAs = (kind: 'duct' | 'pipe') => (ctx.routeAs ? ctx.routeAs(kind) : ctx.chooseTool('route'))

  const newItems: RibbonCommand[] = [
    { id: 'new-floor-plan', label: t('ribbon.command.floorPlanForALevel', 'Floor plan for a level', { ns: 'editor' }), icon: Layers, description: t('ribbon.description.aPlanOfOneLevel', 'A plan of one level, cut at desk height', { ns: 'editor' }), keywords: ['plan', 'view'], disabledReason: ctx.editBlocked, run: () => ctx.request({ kind: 'new_view', viewType: 'floor_plan' }) },
    { id: 'new-ceiling-plan', label: t('ribbon.command.ceilingPlan', 'Ceiling plan', { ns: 'editor' }), icon: SquareDashed, description: t('ribbon.description.lookingUpAtTheCeiling', 'Looking up at the ceiling of a level', { ns: 'editor' }), keywords: ['rcp', 'reflected'], disabledReason: ctx.editBlocked, run: () => ctx.request({ kind: 'new_view', viewType: 'ceiling_plan' }) },
    { id: 'new-section', label: t('ribbon.command.sectionDrawACutLine', 'Section (draw a cut line)', { ns: 'editor' }), icon: Scissors, description: t('ribbon.description.drawWhereTheSectionCuts', 'Draw where the section cuts on a plan', { ns: 'editor' }), keywords: ['cut'], disabledReason: ctx.editBlocked, run: () => ctx.request({ kind: 'new_view', viewType: 'section' }) },
    { id: 'new-3d-view', label: t('ribbon.command.3DView', '3D view', { ns: 'editor' }), icon: Box, description: t('ribbon.description.aSaved3DViewWith', 'A saved 3D view with its own crop box', { ns: 'editor' }), keywords: ['isometric', 'axon'], disabledReason: ctx.editBlocked, run: () => ctx.request({ kind: 'new_view', viewType: 'three_d' }) },
    { id: 'new-detail', label: t('ribbon.command.detailViewDrawingOnly', 'Detail view (drawing-only)', { ns: 'editor' }), icon: PenLine, description: t('ribbon.description.aBlankDraftingViewFor', 'A blank drafting view for lines, text and dimensions', { ns: 'editor' }), keywords: ['drafting'], disabledReason: ctx.editBlocked, run: () => ctx.request({ kind: 'new_view', viewType: 'detail' }) },
    { id: 'new-sheet', label: t('ribbon.command.newSheet', 'New sheet', { ns: 'editor' }), icon: FileText, description: t('ribbon.description.aSheetWithATitle', 'A sheet with a title block to place views on', { ns: 'editor' }), keywords: ['drawing', 'page'], disabledReason: ctx.editBlocked, run: () => ctx.request({ kind: 'new_sheet' }) },
  ]

  const parts = ctx.parts
  const newPart: RibbonCommand = {
    id: 'new-part',
    label: t('ribbon.command.newPart', 'New part', { ns: 'editor' }),
    icon: Shapes,
    description: t('ribbon.description.drawANewPartType', 'Draw a new part type (a rooftop unit, a drain, a fan coil) in the part editor, then place it. To draw one where it goes, use Model in place.', { ns: 'editor' }),
    keywords: [t('ribbon.keyword.partEditor', 'part editor', { ns: 'editor' }), t('ribbon.keyword.genericModel', 'generic model', { ns: 'editor' }), t('ribbon.keyword.modelElement', 'model element', { ns: 'editor' }), 'equipment', 'create', 'extrude', 'massing'],
    disabledReason: modelToolsOff ? MODEL_TOOLS_ON_DRAWING : parts.newBlocked,
    run: parts.newPart,
    testId: 'ribbon-new-part',
  }
  const editPart: RibbonCommand = {
    id: 'edit-part',
    label: t('ribbon.command.editPart', 'Edit part', { ns: 'editor' }),
    icon: PencilRuler,
    description: t('ribbon.description.openTheSelectedPartsType', 'Open the selected part’s type in the part editor (right-click it for the same)', { ns: 'editor' }),
    keywords: [t('ribbon.keyword.editDefinition', 'edit definition', { ns: 'editor' }), t('ribbon.keyword.partEditor', 'part editor', { ns: 'editor' }), t('ribbon.keyword.genericModel', 'generic model', { ns: 'editor' }), t('ribbon.keyword.changeShape', 'change shape', { ns: 'editor' })],
    disabledReason: modelToolsOff ? MODEL_TOOLS_ON_DRAWING : parts.editBlocked,
    run: parts.editSelected,
    testId: 'ribbon-edit-part',
  }

  const modelInPlace: RibbonCommand | null = parts.modelInPlace
    ? {
        id: 'model-in-place',
        label: t('ribbon.command.modelInPlace', 'Model in place', { ns: 'editor' }),
        icon: Box,
        description: t('ribbon.description.clickASpotInA', 'Click a spot in a plan or the 3D model, then draw the part there in the part editor; Save places it, Publish makes it reusable', { ns: 'editor' }),
        keywords: [t('ribbon.keyword.inPlace', 'in place', { ns: 'editor' }), 'in-place', 'massing', t('ribbon.keyword.genericModel', 'generic model', { ns: 'editor' }), 'one-off', t('ribbon.keyword.partEditor', 'part editor', { ns: 'editor' }), 'extrude'],
        disabledReason: modelToolsOff ? MODEL_TOOLS_ON_DRAWING : parts.newBlocked,
        run: parts.modelInPlace,
        testId: 'ribbon-model-in-place',
      }
    : null

  const tabs: RibbonTab[] = [
    {
      id: 'model',
      label: t('ribbon.tab.model', 'Model', { ns: 'editor' }),
      groups: [
        select,
        {
          id: 'create',
          label: t('ribbon.group.create', 'Create', { ns: 'editor' }),
          tool: {
            value: ctx.tool === 'place' ? 'place' : ctx.tool === 'route' ? (ctx.routeAs && ctx.routeKind === 'pipe' ? 'route-pipe' : 'route') : '',
            onValueChange: (v) => (v === 'route-pipe' ? routeAs('pipe') : v === 'route' ? routeAs('duct') : ctx.chooseTool(v === 'place' ? v : 'select')),
            ariaLabel: t('ribbon.group.create', 'Create', { ns: 'editor' }),
          },
          commands: [
            tool('place', t('ribbon.help.placePart', 'Place part', { ns: 'editor' }), PackagePlus, t('ribbon.help.addEquipmentAirDevicesReceptacles', 'Add equipment, air devices, receptacles, panels, lights or fixtures', { ns: 'editor' }), true, ['equipment', 'fixture', 'diffuser', 'insert', 'component']),
            ...(ctx.routeAs
              ? [
                  { ...tool('route', t('ribbon.help.routeDuct', 'Route duct', { ns: 'editor' }), Route, t('ribbon.help.routeDuctBetweenParts', 'Route duct between parts, with the fittings it needs; it can finish with flex into a device', { ns: 'editor' }), true, ['duct', 'run', 'draw', 'supply', 'return', 'exhaust', 'flex', 'flexible']), run: () => routeAs('duct') },
                  { id: 'route-pipe', label: t('ribbon.command.routePipe', 'Route pipe', { ns: 'editor' }), icon: Spline, description: t('ribbon.description.routePipeWaterSanitaryVent', 'Route pipe (water, sanitary, vent, storm, gas) with the fittings it needs', { ns: 'editor' }), keywords: ['pipe', 'piping', 'plumbing', 'run', 'draw'], disabledReason: modelToolReason(true), run: () => routeAs('pipe'), testId: 'ribbon-tool-route-pipe' },
                ]
              : [tool('route', 'Route', Route, t('ribbon.help.routeDuctOrPipeBetween', 'Route duct or pipe between parts, with the fittings it needs', { ns: 'editor' }), true, ['duct', 'pipe', 'run', 'draw'])]),
          ],
        },
        ...(ctx.ceiling ? [{ id: 'build', label: t('ribbon.group.build', 'Build', { ns: 'editor' }), commands: [ctx.ceiling] }] : []),
        { id: 'parts', label: t('ribbon.group.parts', 'Parts', { ns: 'editor' }), commands: [newPart, ...(modelInPlace ? [modelInPlace] : []), editPart] },
        {
          id: 'datum',
          label: t('ribbon.group.datum', 'Datum', { ns: 'editor' }),
          commands: [
            { id: 'levels', label: t('ribbon.command.addLevel', 'Add level', { ns: 'editor' }), icon: Layers, description: t('ribbon.description.addALevelAStorey', 'Add a level (a storey) at an elevation you type or take from a roof or floor you click', { ns: 'editor' }), keywords: ['storey', 'floor', 'datum', 'pick surface', 'roof'], disabledReason: modelToolsOff ? MODEL_TOOLS_ON_DRAWING : ctx.editBlocked, run: ctx.addLevel, testId: 'ribbon-add-level' },
            { id: 'mounting-plane', label: t('ribbon.command.mountingPlane', 'Mounting plane', { ns: 'editor' }), icon: SquareDashed, description: t('ribbon.description.aFlatSurfaceAtA', 'A flat surface at a height above a level to place diffusers and grilles on where there is no ceiling; parts on it move with it', { ns: 'editor' }), keywords: ['no ceiling', 'open ceiling', 'diffuser', 'register', 'datum'], disabledReason: modelToolsOff ? MODEL_TOOLS_ON_DRAWING : ctx.editBlocked, run: ctx.addMountingPlane, testId: 'ribbon-mounting-plane' },
            { id: 'levels-architect', label: t('ribbon.command.architectsLevels', "Architect's levels", { ns: 'editor' }), icon: Building2, description: t('ribbon.description.makeALevelForEach', "Make a level for each storey in the architect's linked model, at its height here. Shows what changes first; run it again after the architect moves a floor", { ns: 'editor' }), keywords: ['storey', 'storeys', 'ifc', 'linked levels', 'sync levels', 'copy monitor'], disabledReason: ctx.editBlocked, run: ctx.useArchitectLevels, testId: 'ribbon-architect-levels' },
            { id: 'levels-show', label: t('ribbon.command.showLevels', 'Show levels', { ns: 'editor' }), icon: Rows3, description: t('ribbon.description.drawEachLevelIn3D', 'Draw each level in 3D as a faint outline with its name and height', { ns: 'editor' }), keywords: ['level planes', 'datum'], pressed: ctx.showLevels, disabledReason: ctx.model3dOpen ? null : 'Levels draw in the 3D model; sections show them as level lines.', run: () => ctx.setShowLevels(!ctx.showLevels), testId: 'ribbon-show-levels' },
          ],
        },
        {
          id: 'display',
          label: t('ribbon.group.display', 'Display', { ns: 'editor' }),
          commands: [
            { id: 'fit', label: t('ribbon.command.fit', 'Fit', { ns: 'editor' }), icon: Maximize, description: t('ribbon.description.fitEverythingInView', 'Fit everything in view', { ns: 'editor' }), shortcut: 'F', keywords: ['zoom', 'extents', 'home'], disabledReason: ctx.drawingOpen ? (ctx.drawingOpen === 'sheet' ? t('ribbon.help.sheetsFitWithTheZoom', 'Sheets fit with the zoom control above the drawing (0).', { ns: 'editor' }) : t('ribbon.help.drawingsFitWithTheZoom', 'Drawings fit with the zoom control above the drawing (0).', { ns: 'editor' })) : null, run: ctx.fit },
            { id: 'roof', label: t('ribbon.command.liftTheRoofOff', 'Lift the roof off', { ns: 'editor' }), icon: Eye, description: t('ribbon.description.cutTheModelJustAbove', 'Cut the model just above the new work so you can see in', { ns: 'editor' }), keywords: [t('ribbon.keyword.sectionBox', 'section box', { ns: 'editor' }), 'hide roof'], pressed: ctx.roofOff, disabledReason: ctx.model3dOpen ? null : 'Works in the 3D model. Open it from the Views and sheets panel.', run: () => ctx.setRoofOff(!ctx.roofOff) },
            {
              id: 'projection',
              label: t('ribbon.command.orthographic', 'Orthographic', { ns: 'editor' }),
              icon: Axis3d,
              description: ctx.projection?.value === 'orthographic' ? t('ribbon.description.parallelViewIsOnCube', 'Parallel view is on: cube faces are true elevations, corners true isometrics. Press to go back to perspective', { ns: 'editor' }) : t('ribbon.description.parallelOrthographic3DViewInstead', 'Parallel (orthographic) 3D view instead of perspective', { ns: 'editor' }),
              shortcut: PROJECTION_SHORTCUT,
              keywords: ['perspective', 'parallel', 'isometric', 'axonometric', 'projection', 'camera'],
              pressed: ctx.projection?.value === 'orthographic',
              disabledReason: ctx.projection ? null : t('ribbon.help.worksIn3DViewsPlans', 'Works in 3D views. Plans, sections on paper and sheets are always orthographic.', { ns: 'editor' }),
              run: ctx.projection?.toggle,
              testId: 'ribbon-projection',
            },
            { id: 'stats', label: t('ribbon.command.performance', 'Performance', { ns: 'editor' }), icon: Activity, description: t('ribbon.description.showFramesPerSecondAnd', 'Show frames per second and draw calls', { ns: 'editor' }), keywords: ['fps'], pressed: ctx.showStats, run: () => ctx.setShowStats(!ctx.showStats) },
            showOriginCommand(ctx),
          ],
        },
      ],
    },
    ...contributedTabs('ribbon-tab', ctx, select),
    annotateTab(ctx, select),
    modifyTab(ctx, select, modelToolReason(false)),
    {
      id: 'views',
      label: t('ribbon.tab.views', 'Views', { ns: 'editor' }),
      groups: [
        select,
        {
          id: 'create',
          label: t('ribbon.group.create', 'Create', { ns: 'editor' }),
          commands: [
            { id: 'new', label: t('ribbon.command.newView', 'New view', { ns: 'editor' }), icon: Plus, description: t('ribbon.description.makeAPlanSection3D', 'Make a plan, section, 3D view, detail view or sheet', { ns: 'editor' }), disabledReason: ctx.editBlocked, children: newItems, testId: 'new-view-or-sheet' },
            {
              id: 'new-3d-view-now',
              label: t('ribbon.command.new3DView', 'New 3D view', { ns: 'editor' }),
              icon: Box,
              description: t('ribbon.description.saveWhatYouSeeNow', 'Save what you see now as a 3D view: this camera and the crop box that is cropping it', { ns: 'editor' }),
              keywords: ['isometric', 'axon', t('ribbon.keyword.saveView', 'save view', { ns: 'editor' }), 'camera'],
              disabledReason: ctx.editBlocked,
              run: () => ctx.request({ kind: 'new_view', viewType: 'three_d' }),
              testId: 'ribbon-new-3d-view',
            },
            {
              id: 'section-cut',
              label: t('ribbon.command.sectionCut', 'Section cut', { ns: 'editor' }),
              icon: Scissors,
              description: ctx.planOpen ? t('ribbon.description.dragACutLineAcross', 'Drag a cut line across this plan to make a section', { ns: 'editor' }) : t('ribbon.description.opensAFloorPlanSo', 'Opens a floor plan so you can draw where the section cuts', { ns: 'editor' }),
              pressed: ctx.sectionDrawing,
              disabledReason: ctx.editBlocked,
              run: ctx.toggleSection,
              testId: 'ribbon-section-cut',
            },
          ],
        },
        {
          id: 'open',
          label: t('ribbon.group.open', 'Open', { ns: 'editor' }),
          commands: [
            { id: 'open-3d', label: t('ribbon.command.3DModel', '3D model', { ns: 'editor' }), icon: Box, description: t('ribbon.description.everythingLiveIn3D', 'Everything, live, in 3D', { ns: 'editor' }), run: () => ctx.openModel('3d') },
            { id: 'open-plan', label: t('ribbon.command.topDownPlan', 'Top-down plan', { ns: 'editor' }), icon: LayoutTemplate, description: t('ribbon.description.allLevelsLookingDown', 'All levels, looking down', { ns: 'editor' }), run: () => ctx.openModel('plan') },
          ],
        },
        {
          id: 'graphics',
          label: t('ribbon.group.graphics', 'Graphics', { ns: 'editor' }),
          commands: [
            { id: 'view-lines', label: t('ribbon.command.linesAndColours', 'Lines and colours', { ns: 'editor' }), icon: PenLine, description: t('ribbon.description.lineWeightForDuctPipe', 'Line weight for duct, pipe, walls and each linked model, hidden lines and visual style for the open view', { ns: 'editor' }), keywords: ['line weight', 'pen', 'pen weight', 'halftone', 'linework'], disabledReason: ctx.viewGraphics ? null : 'Open a saved plan, section or 3D view to set how it draws.', run: ctx.viewGraphics?.lines, testId: 'ribbon-view-lines' },
            { id: 'view-range', label: t('ribbon.command.whatThisViewShows', 'What this view shows', { ns: 'editor' }), icon: ArrowUpDown, description: t('ribbon.description.theTopCutHeightBottom', 'The top, cut height, bottom and depth of the open plan, for our model and the linked models', { ns: 'editor' }), keywords: ['cut plane', 'cut height', 'view depth', 'bottom', 'top'], disabledReason: ctx.viewGraphics?.range ? null : 'Open a saved floor or ceiling plan to set its top, cut and bottom.', run: ctx.viewGraphics?.range ?? undefined, testId: 'ribbon-view-range' },
            { id: 'view-linked', label: t('ribbon.command.linkedModelLook', 'Linked model look', { ns: 'editor' }), icon: Link2, description: t('ribbon.description.halftoneHideWhatIsUnderneath', 'Halftone, hide what is underneath, leave out small things, and pens for the linked models in the open view', { ns: 'editor' }), keywords: ['halftone', 'underlay', 'linked models', 'architect', 'simplify', 'furniture'], disabledReason: ctx.viewGraphics?.linked ? null : ctx.viewGraphics ? t('ribbon.help.thisProjectHasNoLinked', 'This project has no linked models in view.', { ns: 'editor' }) : t('ribbon.help.openASavedViewToSet', 'Open a saved view to set how its linked models draw.', { ns: 'editor' }), run: ctx.viewGraphics?.linked ?? undefined, testId: 'ribbon-view-linked' },
          ],
        },
        {
          id: 'crop',
          label: t('ribbon.group.crop', 'Crop', { ns: 'editor' }),
          commands: ctx.crop3d ? crop3dCommands(ctx.crop3d, t) : [
            {
              id: 'crop-view',
              label: t('ribbon.command.cropView', 'Crop view', { ns: 'editor' }),
              icon: Crop,
              description: t('ribbon.description.showOnlyWhatIsInside', 'Show only what is inside the crop box, as it prints', { ns: 'editor' }),
              pressed: ctx.crop?.on ?? false,
              disabledReason: ctx.crop ? ctx.editBlocked : t('ribbon.help.openASavedViewToCrop', 'Open a saved view to crop it.', { ns: 'editor' }),
              run: () => ctx.crop?.set({ cropView: !ctx.crop.on }),
            },
            {
              id: 'crop-show',
              label: t('ribbon.command.showCropBox', 'Show crop box', { ns: 'editor' }),
              icon: Frame,
              description: t('ribbon.description.drawTheCropBoxSo', 'Draw the crop box so you can drag its edges', { ns: 'editor' }),
              pressed: ctx.crop?.shown ?? false,
              disabledReason: ctx.crop ? ctx.editBlocked : t('ribbon.help.openASavedViewTo', 'Open a saved view to show its crop box.', { ns: 'editor' }),
              run: () => ctx.crop?.set({ showCropBox: !ctx.crop.shown }),
            },
            { id: 'crop-3d-selection', label: t('ribbon.command.cropToSelection', 'Crop to selection', { ns: 'editor' }), icon: Focus, description: t('ribbon.description.fitThe3DCropBox', 'Fit the 3D crop box to the storey and grid bay around what is selected', { ns: 'editor' }), disabledReason: open3DToCrop(t), testId: 'ribbon-crop-3d-selection' },
            { id: 'crop-3d-reset', label: t('ribbon.command.resetCrop', 'Reset crop', { ns: 'editor' }), icon: Expand, description: t('ribbon.description.putThe3DCropBox', 'Put the 3D crop box back around the whole model', { ns: 'editor' }), disabledReason: open3DToCrop(t), testId: 'ribbon-crop-3d-reset' },
            { id: 'crop-3d-align', label: t('ribbon.command.alignCropBox', 'Align crop box', { ns: 'editor' }), icon: RotateCw, description: t('ribbon.description.turnThe3DCropBox', 'Turn the 3D crop box to the working angle or a building edge', { ns: 'editor' }), disabledReason: open3DToCrop(t), testId: 'ribbon-crop-3d-align' },
          ],
        },
      ],
    },
    {
      id: 'sheets',
      label: t('ribbon.tab.sheets', 'Sheets', { ns: 'editor' }),
      groups: [
        select,
        {
          id: 'sheet',
          label: t('ribbon.group.sheet', 'Sheet', { ns: 'editor' }),
          commands: [
            { id: 'sheet-new', label: t('ribbon.command.newSheet', 'New sheet', { ns: 'editor' }), icon: FileText, description: t('ribbon.description.aSheetWithATitle', 'A sheet with a title block to place views on', { ns: 'editor' }), disabledReason: ctx.editBlocked, run: () => ctx.request({ kind: 'new_sheet' }) },
            { id: 'sheet-title-block', label: t('ribbon.command.titleBlock', 'Title block', { ns: 'editor' }), icon: Pencil, description: t('ribbon.description.editTheSheetNumberName', 'Edit the sheet number, name and title block fields', { ns: 'editor' }), disabledReason: ctx.sheet ? ctx.editBlocked : t('ribbon.help.openASheetToEdit', 'Open a sheet to edit its title block.', { ns: 'editor' }), run: ctx.sheet?.editTitleBlock },
            { id: 'sheet-arrange', label: t('ribbon.command.arrangeViews', 'Arrange views', { ns: 'editor' }), icon: LayoutGrid, description: t('ribbon.description.placeTheSheetsViewsAnd', "Place the sheet's views and schedules in rows or a grid inside the border", { ns: 'editor' }), keywords: ['layout', 'auto layout', 'viewports'], disabledReason: ctx.sheet ? ctx.editBlocked : 'Open a sheet to arrange its views.', run: ctx.sheet?.arrange, testId: 'ribbon-sheet-arrange' },
            { id: 'sheet-revisions', label: t('ribbon.command.revisions', 'Revisions', { ns: 'editor' }), icon: ListOrdered, description: t('ribbon.description.editTheSheetsRevisionTable', "Edit the sheet's revision table", { ns: 'editor' }), keywords: ['revision table', 'rev', 'title block'], disabledReason: ctx.sheet ? ctx.editBlocked : 'Open a sheet to edit its revisions.', run: ctx.sheet?.revisions, testId: 'ribbon-sheet-revisions' },
            { id: 'sheet-project-info', label: t('ribbon.command.projectInfo', 'Project info', { ns: 'editor' }), icon: ClipboardList, description: t('ribbon.description.theProjectsNameNumberAddress', "The project's name, number, address, people, issue date and status, filled in once and printed on every sheet", { ns: 'editor' }), keywords: ['title block', 'project parameters', 'date', 'status', 'address', 'client', 'engineer of record'], run: () => ctx.request({ kind: 'project_info' }), testId: 'ribbon-sheet-project-info' },
            { id: 'sheet-agent-make', label: t('ribbon.command.withTheAgent', 'With the agent', { ns: 'editor' }), icon: Sparkles, description: t('ribbon.description.openCmdJWithA', 'Open Cmd+J with a drafted request to make sheets, views and schedules by script: edit it and send it; nothing changes until you approve', { ns: 'editor' }), keywords: ['agent', 'script', 'sheets per level', 'drawing set', 'automate', 'views', 'schedules'], disabledReason: ctx.editBlocked, run: () => ctx.request({ kind: 'agent_make' }), testId: 'ribbon-sheet-agent-make' },
          ],
        },
        {
          id: 'figures',
          // Disabled with no sheet open: the caption says why, not only the tooltip.
          label: ctx.sheet ? t('ribbon.group.figures', 'Figures', { ns: 'editor' }) : t('ribbon.group.figuresNeedsSheet', 'Figures · open a sheet first', { ns: 'editor' }),
          commands: [
            { id: 'sheet-chart', label: t('ribbon.command.chart', 'Chart', { ns: 'editor' }), icon: ChartLine, description: t('ribbon.description.putALiveChartOn', 'Put a live chart on the sheet (the Hunter curve): drawn from the model every time it shows or prints', { ns: 'editor' }), keywords: ['hunter curve', 'graph', 'demand curve', 'figure'], disabledReason: ctx.sheet?.chart ? ctx.editBlocked : t('ribbon.help.openASheetToPlaceAChart', 'Open a sheet to place a chart: Views and sheets › a sheet.', { ns: 'editor' }), run: ctx.sheet?.chart, testId: 'ribbon-sheet-chart' },
            { id: 'sheet-picture', label: t('ribbon.command.picture', 'Picture', { ns: 'editor' }), icon: ImagePlus, description: t('ribbon.description.putAPNGOrJPEG', 'Put a PNG or JPEG on the sheet (a logo, a photo, a key plan); it is kept in the project workspace and prints in the PDF', { ns: 'editor' }), keywords: ['image', 'logo', 'photo', 'png', 'jpeg', 'figure'], disabledReason: ctx.sheet?.picture ? ctx.editBlocked : 'Open a sheet to place a picture: Views and sheets › a sheet.', run: ctx.sheet?.picture, testId: 'ribbon-sheet-picture' },
            {
              id: 'sheet-live-table',
              label: t('ribbon.command.liveTable', 'Live table', { ns: 'editor' }),
              icon: Table2,
              description: t('ribbon.description.putALiveTableOn', 'Put a live table on the sheet (load summary, ventilation, pressurization, gas): drawn from the model with every edit and frozen when the set is issued', { ns: 'editor' }),
              keywords: ['table', 'schedule', 'block', 'figure'],
              // New live tables go in this menu: Figures must stay under the five-control cap with every table named, not folded under More.
              children: [
                { id: 'sheet-load-summary', label: t('ribbon.command.loadSummary', 'Load summary', { ns: 'editor' }), icon: Sigma, description: t('ribbon.description.putTheLiveElectricalLoad', 'Put the live electrical load summary on the sheet: total connected kVA and amps at the service, updated with every edit and frozen when the set is issued', { ns: 'editor' }), keywords: ['load study', 'block', 'kva', 'amps', 'service'], disabledReason: ctx.sheet?.loadSummary ? ctx.editBlocked : 'Open a sheet to place a load summary: Views and sheets › a sheet.', run: ctx.sheet?.loadSummary, testId: 'ribbon-sheet-load-summary' },
                { id: 'sheet-keynote-list', label: t('ribbon.command.keynoteList', 'Keynote list', { ns: 'editor' }), icon: KeyRound, description: t('ribbon.description.putTheKeynoteListOn', 'Put the keynote list on the sheet: each keynote used on the views placed here, with its words, updated with every edit and frozen when the set is issued', { ns: 'editor' }), keywords: ['keynotes', 'legend', 'general notes', 'key notes'], disabledReason: ctx.sheet?.placeTable ? ctx.editBlocked : 'Open a sheet to place a keynote list: Views and sheets › a sheet.', run: ctx.sheet?.placeTable ? () => ctx.sheet?.placeTable?.((sheet, submit) => placeKeynoteList(sheet, submit, undefined, t)) : undefined, testId: 'ribbon-sheet-keynote-list' },
                ...contributedCommands('sheet-live-table', ctx),
                calculationCommand(ctx.sheet?.calculation, ctx.editBlocked, t),
              ],
              testId: 'ribbon-sheet-live-table',
            },
          ],
        },
        {
          id: 'issue',
          label: ctx.sheet || !ctx.hasSheets ? t('ribbon.group.issue', 'Issue', { ns: 'editor' }) : t('ribbon.group.issueNeedsSheet', 'Issue · open a sheet to print it', { ns: 'editor' }),
          commands: [
            {
              id: 'print-pdf',
              label: t('ribbon.command.printPDF', 'Print PDF', { ns: 'editor' }),
              icon: Printer,
              description: ctx.sheet ? t('ribbon.description.printNumberToAVector', 'Print {{number}} to a vector PDF at scale', { ns: 'editor', number: ctx.sheet.number }) : t('ribbon.description.printASheetToA', 'Print a sheet to a vector PDF at scale', { ns: 'editor' }),
              keywords: ['export', 'pdf', 'issue'],
              disabledReason: ctx.sheet ? null : t('ribbon.help.openASheetFromThe', 'Open a sheet from the Views and sheets panel to print it.', { ns: 'editor' }),
              run: ctx.sheet?.print,
              testId: 'print-pdf',
            },
            { id: 'print-set', label: t('ribbon.command.printSet', 'Print set', { ns: 'editor' }), icon: Printer, description: t('ribbon.description.printTheDrawingSetTo', 'Print the drawing set to one PDF, a page per sheet, at scale', { ns: 'editor' }), keywords: ['set', 'pdf', 'plot'], disabledReason: ctx.hasSheets ? null : t('ribbon.help.makeASheetFirstViews', 'Make a sheet first: Views and sheets › +.', { ns: 'editor' }), run: () => ctx.request({ kind: 'print_set' }), testId: 'ribbon-print-set' },
            { id: 'issue-set', label: t('ribbon.command.issueSet', 'Issue set', { ns: 'editor' }), icon: Stamp, description: t('ribbon.description.checkTheSetAgainstIts', 'Check the set against its last print, add the revision row and issue it', { ns: 'editor' }), keywords: ['issue', 'revision', 'permit', 'transmittal'], disabledReason: ctx.hasSheets ? ctx.editBlocked : t('ribbon.help.makeASheetFirstViews', 'Make a sheet first: Views and sheets › +.', { ns: 'editor' }), run: () => ctx.request({ kind: 'issue_set' }), testId: 'ribbon-issue-set' },
            {
              id: 'print-black-only',
              label: t('ribbon.command.blackOnly', 'Black only', { ns: 'editor' }),
              icon: Printer,
              description: ctx.printBlackOnly ? t('ribbon.description.sheetsPrintBlackOnlyAs', 'Sheets print black only, as a black-only plotter does: colours print black, halftone and fills stay grey. Press to print in colour', { ns: 'editor' }) : t('ribbon.description.sheetsPrintInColourPress', 'Sheets print in colour. Press to print this project black only (colours black, halftone and fills grey), for Print PDF, Print set and Issue set', { ns: 'editor' }),
              keywords: [t('ribbon.keyword.blackAndWhite', 'black and white', { ns: 'editor' }), 'monochrome', 'plot', 'colour', 'color', 'print'],
              pressed: ctx.printBlackOnly === true,
              disabledReason: ctx.setPrintBlackOnly ? (ctx.hasSheets ? ctx.editBlocked : t('ribbon.help.makeASheetFirstViews', 'Make a sheet first: Views and sheets › +.', { ns: 'editor' })) : t('ribbon.help.blackOnlyPrintingIsNot', 'Black-only printing is not available here.', { ns: 'editor' }),
              run: () => ctx.setPrintBlackOnly?.(!ctx.printBlackOnly),
              testId: 'ribbon-print-black-only',
            },
            { id: 'export-ifc', label: t('ribbon.command.exportIFC', 'Export IFC', { ns: 'editor' }), icon: FileBox, description: t('ribbon.description.writeTheSavedModelAs', 'Write the saved model as an IFC 4.3 file that other BIM and coordination software and contractors open: spaces, zones, systems and every element with its parameters', { ns: 'editor' }), keywords: ['ifc', 'export', 'bim', 'coordination', 'ifc4', 'open bim'], disabledReason: null, run: () => ctx.request({ kind: 'export_ifc' }), testId: 'ribbon-export-ifc' },
          ],
        },
      ],
    },
    {
      id: 'manage',
      label: t('ribbon.tab.manage', 'Manage', { ns: 'editor' }),
      groups: [
        select,
        {
          id: 'project',
          label: t('ribbon.group.project', 'Project', { ns: 'editor' }),
          commands: [
            {
              id: 'part-types',
              label: t('ribbon.command.partTypes', 'Part types', { ns: 'editor' }),
              icon: PackagePlus,
              description: t('ribbon.description.thePartCatalogBrowseAnd', 'The part catalog: browse and place a part, or draw a new part type', { ns: 'editor' }),
              keywords: ['catalog', 'library', 'types'],
              children: [
                { id: 'part-types-browse', label: t('ribbon.command.browseAndPlace', 'Browse and place', { ns: 'editor' }), icon: PackagePlus, description: t('ribbon.description.openTheCatalogInPlace', 'Open the catalog in Place part', { ns: 'editor' }), keywords: ['catalog'], disabledReason: modelToolReason(true), run: () => ctx.chooseTool('place'), testId: 'ribbon-part-types-browse' },
                { ...newPart, id: 'part-types-new', testId: 'ribbon-part-types-new' },
                { ...editPart, id: 'part-types-edit', label: t('ribbon.command.editTheSelectedPart', 'Edit the selected part', { ns: 'editor' }), testId: 'ribbon-part-types-edit' },
              ],
              testId: 'ribbon-part-types',
            },
            { id: 'link', label: t('ribbon.command.linkAModel', 'Link a model', { ns: 'editor' }), icon: Link2, description: ctx.linkDescription ?? t('ribbon.description.bringInTheArchitectsModel', "Bring in the architect's model from Autodesk Docs or an IFC file", { ns: 'editor' }), keywords: ['ifc', 'linked models', 'reference'], disabledReason: ctx.linkUnavailableReason ?? (ctx.canLink ? null : t('ribbon.help.linkingNeedsEditAccess', "Linking needs edit access to this project's model; ask a project lead.", { ns: 'editor' })), run: ctx.openLink },
            ...(ctx.openConnectAgent ? [{ id: 'connect-agent', label: t('ribbon.command.connectAnAgent', 'Connect an agent', { ns: 'editor' }), icon: Plug, description: t('ribbon.description.connectClaudeCursorChatGPTOr', 'Connect Claude, Cursor, ChatGPT or another agent: the core and each pack as its own connection, with a copy button', { ns: 'editor' }), keywords: ['agent', 'mcp', 'claude', 'cursor', 'chatgpt', 'connect', 'pack', 'api'], disabledReason: null, run: ctx.openConnectAgent, testId: 'ribbon-connect-agent' }] : []),
          ],
        },
        coordinatesGroup(ctx),
        {
          id: 'groups-phases',
          label: t('ribbon.group.groupsPhases', 'Groups & phases', { ns: 'editor' }),
          commands: [
            { id: 'manage-groups', label: t('ribbon.command.groups', 'Groups', { ns: 'editor' }), icon: Group, description: t('ribbon.description.createRenameColourLockAnd', 'Create, rename, colour, lock and delete groups', { ns: 'editor' }), keywords: ['group', 'lock', 'existing', 'new work', 'demolition', 'coordination'], run: ctx.organization.openGroups, testId: 'ribbon-manage-groups' },
            { id: 'manage-phases', label: t('ribbon.command.phases', 'Phases', { ns: 'editor' }), icon: History, description: t('ribbon.description.addRenameAndReorderPhases', 'Add, rename and reorder phases (Existing, New construction…)', { ns: 'editor' }), keywords: ['phase', 'existing', 'new construction', 'demolish'], run: ctx.organization.openPhases, testId: 'ribbon-manage-phases' },
            { id: 'phase-filters', label: t('ribbon.command.phaseFilters', 'Phase filters', { ns: 'editor' }), icon: Filter, description: t('ribbon.description.howNewExistingDemolishedAnd', 'How new, existing, demolished and temporary work draws in views', { ns: 'editor' }), keywords: ['phase filter', 'show all', 'show new', 'existing', 'demo', 'halftone', 'dashed'], run: ctx.organization.openFilters, testId: 'ribbon-phase-filters' },
            ...(ctx.organization.openConstructionStages ? [{ id: 'construction-stages', label: t('ribbon.command.constructionStages', 'Construction stages', { ns: 'editor' }), icon: History, description: t('ribbon.description.theOrderTheBuildingGoes', 'The order the building goes up in: add, rename, reorder and delete stages; takeoffs total by stage', { ns: 'editor' }), keywords: ['stage', 'sequence', 'takeoff', 'work area', 'schedule of values', 'quantities'], run: ctx.organization.openConstructionStages, testId: 'ribbon-construction-stages' }] : []),
          ],
        },
        ...(ctx.organization.openAddons
          ? [
              {
                id: 'model-settings',
                label: t('ribbon.command.modelSettings', 'Model settings', { ns: 'editor' }),
                commands: [
                  { id: 'model-addons', label: 'Add-ons', icon: PackagePlus, description: t('ribbon.description.switchPreviewAddOnsStructural', 'Switch Preview add-ons (Structural, Civil) on or off for this model', { ns: 'editor' }), keywords: ['add-on', 'structural', 'civil', 'preview', 'pack'], run: ctx.organization.openAddons, testId: 'ribbon-model-addons' },
                  ...(ctx.organization.openCodes ? [{ id: 'model-codes', label: t('ribbon.command.codes', 'Codes', { ns: 'editor' }), icon: BookOpenCheck, description: t('ribbon.description.theProjectsCodeOfRecord', "The project's code of record for each discipline, and where the project is; approvals say which code they were checked against", { ns: 'editor' }), keywords: ['code', 'code of record', 'ibc', 'edition', 'jurisdiction', 'adoption', 'checked against'], run: ctx.organization.openCodes, testId: 'ribbon-model-codes' }] : []),
                ],
              },
            ]
          : []),
        ...(ctx.history
          ? [
              {
                id: 'versions-signoff',
                label: t('ribbon.group.versionsSignoff', 'Versions & sign-off', { ns: 'editor' }),
                commands: [
                  { id: 'manage-versions', label: t('ribbon.command.versions', 'Versions', { ns: 'editor' }), icon: GitBranch, description: t('ribbon.description.savedVersionsAndIssuedSets', 'Saved versions and issued sets: save one, start a branch from one, say what kind of change it was', { ns: 'editor' }), keywords: ['version', 'branch', 'history', 'save version', 'issued set', 'option', 'what kind of change'], run: ctx.history.openVersions, testId: 'ribbon-manage-versions' },
                  { id: 'manage-responsibilities', label: t('ribbon.command.responsibilities', 'Responsibilities', { ns: 'editor' }), icon: UserCheck, description: t('ribbon.description.whoIsResponsibleForEach', 'Who is responsible for each discipline and part of it; they accept, and approve merges of their parts', { ns: 'editor' }), keywords: ['responsible', 'engineer of record', 'approve', 'merge', 'sign-off', 'architect of record'], run: ctx.history.openResponsibilities, testId: 'ribbon-manage-responsibilities' },
                  { id: 'manage-change-orders', label: t('ribbon.command.changeOrders', 'Change orders', { ns: 'editor' }), icon: FilePen, description: t('ribbon.description.openAChangeOrderSince', 'Open a change order since a version or for a branch, addressed to a contact or company; they accept, refuse or mark it no cost', { ns: 'editor' }), keywords: ['change order', 'co', 'refuse', 'no cost', 'owner requested', 'quantity change'], run: ctx.history.openChangeOrders, testId: 'ribbon-manage-change-orders' },
                  ...(ctx.history.openCopies ? [{ id: 'manage-copies', label: t('ribbon.command.copies', 'Copies', { ns: 'editor' }), icon: Copy, description: t('ribbon.description.contractorAndShopDrawingCopies', 'Contractor and shop-drawing copies: name who works in each, review what they changed, accept chosen records back', { ns: 'editor' }), keywords: ['contractor', 'shop drawings', 'submittal', 'coordination', 'accept back', 'review', 'copy', 'people'], run: ctx.history.openCopies, testId: 'ribbon-manage-copies' }] : []),
                ],
              },
            ]
          : []),
        ...(ctx.coordination
          ? [
              {
                id: 'coordination',
                label: t('ribbon.group.coordination', 'Coordination', { ns: 'editor' }),
                commands: [
                  {
                    id: 'coordination',
                    label: t('ribbon.command.coordination', 'Coordination', { ns: 'editor' }),
                    icon: ShieldAlert,
                    description: t('ribbon.description.opensTheChecklistWhatThe', 'Opens the Checklist: what the code studies say each room still needs, clashes with our work and linked models, and questions; select one, record a decision, override with a reason, or accept a finding with a reason', { ns: 'editor' }),
                    keywords: ['checklist', 'requirements', t('ribbon.keyword.codeStudy', 'code study', { ns: 'editor' }), t('ribbon.keyword.whatIsLeft', 'what is left', { ns: 'editor' }), 'clash', t('ribbon.keyword.clashDetection', 'clash detection', { ns: 'editor' }), 'interference', 'collision', 'lint', 'coordinated', t('ribbon.keyword.outsideBuilding', 'outside building', { ns: 'editor' }), 'floating', t('ribbon.keyword.linkedModel', 'linked model', { ns: 'editor' })],
                    run: ctx.coordination.open,
                    testId: 'ribbon-manage-coordination',
                  },
                ],
              },
            ]
          : []),
      ],
    },
  ]

  const sel = ctx.selection
  if (sel?.kind === 'part') {
    tabs.push({
      id: 'selection',
      label: t('ribbon.tab.part', 'Part', { ns: 'editor' }),
      contextual: true,
      groups: [
        select,
        {
          id: 'part',
          label: sel.label,
          commands: [
            { id: 'rotate-cw', label: t('ribbon.command.rotate902', 'Rotate 90°', { ns: 'editor' }), icon: RotateCw, description: t('ribbon.description.turnThePartAQuarterTurn', 'Turn the part a quarter turn clockwise', { ns: 'editor' }), disabledReason: ctx.editBlocked, run: () => ctx.rotateSelected(90) },
            { id: 'rotate-ccw', label: t('ribbon.command.rotate90', 'Rotate −90°', { ns: 'editor' }), icon: RotateCcw, description: t('ribbon.description.turnThePartAQuarter', 'Turn the part a quarter turn back', { ns: 'editor' }), disabledReason: ctx.editBlocked, run: () => ctx.rotateSelected(-90) },
            { id: 'move-part', label: t('ribbon.command.move', 'Move', { ns: 'editor' }), icon: Move, description: t('ribbon.description.dragItToANew', 'Drag it to a new spot', { ns: 'editor' }), shortcut: TOOL_SHORTCUTS.move, disabledReason: ctx.editBlocked, run: () => ctx.chooseTool('move') },
            { id: 'edit-type', label: t('ribbon.command.editType', 'Edit type', { ns: 'editor' }), icon: Pencil, description: t('ribbon.description.changeTheValuesEveryPart', 'Change the values every part of this type shares', { ns: 'editor' }), disabledReason: ctx.editBlocked, run: ctx.editType },
            ...createSimilarCommand(ctx, t('ribbon.help.placeAnotherOfThisType', 'Place another of this type on its level, at its height', { ns: 'editor' })),
            { id: 'delete-part', label: t('ribbon.command.delete', 'Delete…', { ns: 'editor' }), icon: Trash2, description: t('ribbon.description.deleteItAsksFirstUndo', 'Delete it (asks first; undo brings it back)', { ns: 'editor' }), shortcut: 'Del', disabledReason: ctx.editBlocked, run: ctx.deleteSelected },
          ],
        },
        { id: 'done', label: t('ribbon.group.selection', 'Selection', { ns: 'editor' }), commands: [{ id: 'deselect', label: t('ribbon.command.deselect', 'Deselect', { ns: 'editor' }), icon: X, description: t('ribbon.description.clearTheSelection', 'Clear the selection', { ns: 'editor' }), shortcut: 'Esc', run: ctx.clearSelection }] },
      ],
    })
  } else if (sel?.kind === 'run') {
    tabs.push({
      id: 'selection',
      label: sel.domain === 'pipe' ? t('ribbon.tab.pipeRun', 'Pipe run', { ns: 'editor' }) : t('ribbon.tab.ductRun', 'Duct run', { ns: 'editor' }),
      contextual: true,
      groups: [
        select,
        {
          id: 'run',
          label: sel.label,
          commands: [
            { id: 'resize-run', label: t('ribbon.command.resize', 'Resize', { ns: 'editor' }), icon: Maximize, description: t('ribbon.description.changeItsSizeOrShape', 'Change its size or shape (the fittings follow; transitions where it meets another size)', { ns: 'editor' }), disabledReason: ctx.editBlocked, run: ctx.resizeSelected },
            ...(sel.fitting ? [] : [{ id: 'split-run', label: t('ribbon.command.split', 'Split', { ns: 'editor' }), icon: Scissors, description: t('ribbon.description.clickAlongTheRunTo', 'Click along the run to split it there (resize a stretch between two splits)', { ns: 'editor' }), shortcut: TOOL_SHORTCUTS.split, keywords: ['cut', 'break', 'divide'], pressed: ctx.tool === 'split', disabledReason: ctx.editBlocked, run: ctx.splitSelected, testId: 'ribbon-split' }]),
            ...(sel.domain === 'duct' && sel.fitting
              ? [{ id: 'fitting-type', label: t('ribbon.command.fittingType', 'Fitting type', { ns: 'editor' }), icon: Shapes, description: t('ribbon.description.chooseTheFittingRadiusElbow', 'Choose the fitting (radius elbow, mitered, tee…) and its loss coefficient', { ns: 'editor' }), keywords: ['elbow', 'tee', 'transition', 'coefficient', 'smacna', 'ashrae'], disabledReason: ctx.editBlocked, run: ctx.chooseFittingType }]
              : []),
            ...(sel.domain === 'duct'
              ? [
                  {
                    id: 'duct-design',
                    label: t('ribbon.command.reducersAndInsulation', 'Reducers and insulation', { ns: 'editor' }),
                    icon: FlipVertical2,
                    description: t('ribbon.description.reducerShapeCentredOrFlat', 'Reducer shape (centred, or flat on top or bottom) and the wrap or liner on this run', { ns: 'editor' }),
                    keywords: ['eccentric', 'concentric', 'reducer', 'transition', 'wrap', 'liner', 'insulation'],
                    disabledReason: ctx.editBlocked,
                    testId: 'ribbon-duct-design',
                    children: [
                      { id: 'reducer-shape', label: t('ribbon.command.reducerShape', 'Reducer shape', { ns: 'editor' }), icon: FlipVertical2, description: sel.fitting ? t('ribbon.description.makeThisReducerCentredOr', 'Make this reducer centred, or flat on top or bottom (eccentric)', { ns: 'editor' }) : t('ribbon.help.reducersCentredOrFlat', 'Reducers centred or flat on top or bottom (eccentric): press Tab to select the run, then pick where it meets another size', { ns: 'editor' }), keywords: ['eccentric', 'concentric', 'flat on top', 'flat on bottom', 'transition', 'reducer'], disabledReason: ctx.editBlocked, run: ctx.reducerShape, testId: 'ribbon-reducer-shape' },
                      { id: 'run-insulation', label: t('ribbon.command.insulation', 'Insulation', { ns: 'editor' }), icon: Layers, description: t('ribbon.description.wrapOrLinerOnThis', 'Wrap or liner on this run; Make system default gives new runs on its system the same', { ns: 'editor' }), keywords: ['wrap', 'liner', 'lining', 'insulation default', 'system default'], disabledReason: ctx.editBlocked, run: ctx.focusRunInsulation, testId: 'ribbon-run-insulation' },
                    ],
                  },
                ]
              : []),
            ...(sel.domain === 'duct'
              ? [{ id: 'pressure', label: t('ribbon.command.pressure', 'Pressure', { ns: 'editor' }), icon: Gauge, description: t('ribbon.description.velocityFrictionAndLossHere', "Velocity, friction and loss here, and the fan's external static pressure", { ns: 'editor' }), keywords: ['static', 'esp', 'friction', 'velocity', t('ribbon.keyword.criticalPath', 'critical path', { ns: 'editor' })], run: ctx.showPressure }]
              : []),
            ...createSimilarCommand(ctx, t('ribbon.description.routeAnotherLikeThis', 'Route another {{domain}} like this: same system, size{{what}}, at its height', { ns: 'editor', domain: sel.domain, what: sel.domain === 'pipe' ? t('ribbon.help.materialAndSlope', ', material and slope', { ns: 'editor' }) : t('ribbon.help.andInsulation', ' and insulation', { ns: 'editor' }) })),
            { id: 'delete-run', label: t('ribbon.command.delete', 'Delete…', { ns: 'editor' }), icon: Trash2, description: t('ribbon.description.deleteItOrItAnd', 'Delete it, or it and what depends on it (asks first)', { ns: 'editor' }), shortcut: 'Del', disabledReason: ctx.editBlocked, run: ctx.deleteSelected },
          ],
        },
        { id: 'done', label: t('ribbon.group.selection', 'Selection', { ns: 'editor' }), commands: [{ id: 'deselect', label: t('ribbon.command.deselect', 'Deselect', { ns: 'editor' }), icon: X, description: t('ribbon.description.clearTheSelection', 'Clear the selection', { ns: 'editor' }), shortcut: 'Esc', run: ctx.clearSelection }] },
      ],
    })
  } else if (sel?.kind === 'group') {
    tabs.push({
      id: 'selection',
      label: t('ribbon.tab.selection', 'Selection', { ns: 'editor' }),
      contextual: true,
      groups: [
        select,
        {
          id: 'group',
          label: sel.label,
          commands: [
            { id: 'move-group', label: t('ribbon.command.move', 'Move', { ns: 'editor' }), icon: Move, description: t('ribbon.description.moveTheSelectionByA', 'Move the selection by a distance (connected runs follow; fixed parts refuse)', { ns: 'editor' }), disabledReason: ctx.editBlocked ?? (sel.movable > 0 ? null : 'Nothing in this selection moves on its own.'), run: ctx.moveSelected, testId: 'ribbon-move-group' },
            { id: 'resize-group', label: t('ribbon.command.resize', 'Resize', { ns: 'editor' }), icon: Maximize, description: t('ribbon.description.giveEveryDuctOrPipe', 'Give every duct or pipe piece a new size or shape in one edit, with transitions where neighbours differ', { ns: 'editor' }), disabledReason: ctx.editBlocked ?? (sel.runs > 0 ? null : 'There is no routed duct or pipe in this selection.'), run: ctx.resizeSelected, testId: 'ribbon-resize-group' },
            { id: 'reducer-shape-group', label: t('ribbon.command.reducerShape', 'Reducer shape', { ns: 'editor' }), icon: FlipVertical2, description: t('ribbon.description.centredOrFlatOnTop', 'Centred, or flat on top or bottom (eccentric), where a new size meets the old', { ns: 'editor' }), keywords: ['eccentric', 'concentric', 'transition', 'reducer'], disabledReason: ctx.editBlocked ?? (sel.runs > 0 ? null : 'There is no routed duct or pipe in this selection.'), run: ctx.reducerShape, testId: 'ribbon-reducer-shape-group' },
            { id: 'delete-group', label: t('ribbon.command.delete', 'Delete…', { ns: 'editor' }), icon: Trash2, description: t('ribbon.description.deleteAllAllCount', 'Delete all {{count}} (asks first; undo brings them back)', { ns: 'editor', count: sel.count }), shortcut: 'Del', disabledReason: ctx.editBlocked, run: ctx.deleteSelected, testId: 'ribbon-delete-group' },
            { id: 'deselect', label: t('ribbon.command.deselect', 'Deselect', { ns: 'editor' }), icon: X, description: t('ribbon.description.clearTheSelection', 'Clear the selection', { ns: 'editor' }), shortcut: 'Esc', run: ctx.clearSelection },
          ],
        },
      ],
    })
  } else if (sel?.kind === 'branch') {
    tabs.push({
      id: 'selection',
      label: t('ribbon.tab.branch', 'Branch', { ns: 'editor' }),
      contextual: true,
      groups: [
        select,
        {
          id: 'branch',
          label: sel.label,
          commands: [
            { id: 'resize-branch', label: t('ribbon.command.resize', 'Resize', { ns: 'editor' }), icon: Maximize, description: t('ribbon.description.changeTheTrunkSizeIn', 'Change the trunk size in the properties panel', { ns: 'editor' }), disabledReason: ctx.editBlocked, run: ctx.resizeSelected },
            { id: 'deselect', label: t('ribbon.command.deselect', 'Deselect', { ns: 'editor' }), icon: X, description: t('ribbon.description.clearTheSelectionDragThe', 'Clear the selection (drag the branch in the view to slide it)', { ns: 'editor' }), shortcut: 'Esc', run: ctx.clearSelection },
          ],
        },
      ],
    })
  }
  tabs.push(...contributedTabs('contextual-tab', ctx, select))
  const route = ctx.route
  if (route) {
    tabs.push({
      id: 'route',
      label: t('ribbon.tab.route', 'Route', { ns: 'editor' }),
      contextual: true,
      groups: [
        select,
        {
          id: 'height',
          label: t('ribbon.group.height', 'Height', { ns: 'editor' }),
          commands: [
            { id: 'rise', label: t('ribbon.command.rise1Ft', 'Rise 1 ft', { ns: 'editor' }), icon: ArrowUp, description: t('ribbon.description.riseAtTheCurrentPoint', 'Rise at the current point (or type a new height)', { ns: 'editor' }), shortcut: ']', disabledReason: route.riseBlocked, run: () => route.rise(1), testId: 'ribbon-route-rise' },
            { id: 'drop', label: t('ribbon.command.drop1Ft', 'Drop 1 ft', { ns: 'editor' }), icon: ArrowDown, description: t('ribbon.description.dropAtTheCurrentPoint', 'Drop at the current point', { ns: 'editor' }), shortcut: '[', disabledReason: route.riseBlocked, run: () => route.rise(-1), testId: 'ribbon-route-drop' },
            { id: 'rise-45', label: route.riseStyle === 'vertical' || route.riseStyle === '45' ? t('ribbon.command.45Rises', '45° rises', { ns: 'editor' }) : t('ribbon.command.angleRises', '{{angle}} rises', { ns: 'editor', angle: riseStyleLabel(route.riseStyle).replace(' slope', '') }), icon: CornerDownRight, description: route.riseStyle !== 'vertical' ? t('ribbon.description.risesAndDropsSlopeAt', 'Rises and drops slope at {{angle}} (two elbows of that angle); press for straight up and down. Other slopes: Route › Rises and drops', { ns: 'editor', angle: riseStyleLabel(route.riseStyle).replace(' slope', '') }) : t('ribbon.help.risesAndDropsGoStraight', 'Rises and drops go straight up and down (two 90° elbows); press for 45° slopes', { ns: 'editor' }), pressed: route.riseStyle !== 'vertical', run: () => route.setRiseStyle(route.riseStyle !== 'vertical' ? 'vertical' : '45'), testId: 'ribbon-route-45' },
          ],
        },
        {
          id: 'axis',
          label: t('ribbon.group.axis', 'Axis', { ns: 'editor' }),
          commands: [
            ...(['x', 'y', 'z'] as const).map((a) => ({
              id: `lock-${a}`,
              label: a.toUpperCase(),
              ariaLabel: t('ribbon.aria.lockToAxis', 'Lock to {{axis}}', { ns: 'editor', axis: a.toUpperCase() }),
              icon: a === 'z' ? ArrowUp : MoveHorizontal,
              description: a === 'z' ? t('ribbon.description.drawStraightUpOrDown', 'Draw straight up or down from the last point (Shift does the same while held)', { ns: 'editor' }) : t('ribbon.description.drawDirectionOnly', 'Draw {{direction}} only', { ns: 'editor', direction: a === 'x' ? t('ribbon.help.eastWest', 'east-west', { ns: 'editor' }) : t('ribbon.help.northSouth', 'north-south', { ns: 'editor' }) }),
              shortcut: a.toUpperCase(),
              pressed: route.lock === a,
              run: () => route.setLock(a),
              testId: `ribbon-route-lock-${a}`,
            })),
            {
              id: 'lock-free',
              label: t('ribbon.command.anyAngle', 'Any angle', { ns: 'editor' }),
              icon: Compass,
              description: t('ribbon.description.ductLegsSnapTo15', 'Duct legs snap to 15°, 22.5°, 30°, 45°, 60° and 90°; press (or hold Alt / Option) to draw at any angle. The elbow is made to the angle.', { ns: 'editor' }),
              shortcut: 'Alt',
              pressed: route.lock === 'free',
              run: () => route.setLock('free'),
              testId: 'ribbon-route-lock-free',
            },
          ],
        },
        {
          id: 'route-fittings',
          label: t('ribbon.group.fittings', 'Fittings', { ns: 'editor' }),
          commands: [
            { id: 'route-elbow', label: t('ribbon.command.elbowType', 'Elbow type', { ns: 'editor' }), icon: Spline, description: t('ribbon.description.chooseTheElbowsThisRoute', 'Choose the elbows this route places (radius, mitred with vanes, gored…)', { ns: 'editor' }), run: route.chooseElbow, testId: 'ribbon-route-elbow' },
            { id: 'route-takeoff', label: t('ribbon.command.takeoffType', 'Takeoff type', { ns: 'editor' }), icon: SquareSplitHorizontal, description: t('ribbon.description.chooseTheTapTeeOr', 'Choose the tap, tee or wye a branch starts with', { ns: 'editor' }), run: route.chooseTakeoff },
            { id: 'route-around', label: t('ribbon.command.offsetAround', 'Offset around', { ns: 'editor' }), icon: CornerDownRight, description: t('ribbon.description.pickTheBeamPipeOr', 'Pick the beam, pipe or wall in the way: the leg rises over it and comes back down', { ns: 'editor' }), shortcut: 'O', pressed: route.offsetArmed, run: route.armOffset, testId: 'ribbon-route-around' },
          ],
        },
        {
          id: 'route-finish',
          label: t('ribbon.group.finish', 'Finish', { ns: 'editor' }),
          commands: [
            { id: 'route-done', label: t('ribbon.command.finishHere', 'Finish here', { ns: 'editor' }), icon: Check, description: t('ribbon.description.endTheRouteAtThe', 'End the route at the last point', { ns: 'editor' }), shortcut: 'Enter', disabledReason: route.finishBlocked, run: route.finish },
            { id: 'route-cancel', label: t('ribbon.command.cancel', 'Cancel', { ns: 'editor' }), icon: X, description: t('ribbon.description.dropTheRouteBeingDrawn', 'Drop the route being drawn; nothing is saved', { ns: 'editor' }), shortcut: 'Esc', run: route.cancel },
          ],
        },
      ],
    })
  }
  const drawn = drawnItemsTab(ctx, select, modelToolReason(false))
  if (drawn) tabs.push(drawn)
  const analyze = addonTabAnalyzeCommands(ctx)
  const withAnalyze = tabs.map((tab) => (analyze[tab.id] && isTradeTab(tab) ? withTradeSectionCommands(tab, 'analyze', analyze[tab.id] ?? [], false, t) : tab))
  return withPlanGroups(withScheduleGroups(withAnalyze, ctx.schedules, t), ctx.plan, { ...addonTabPlanCommands(ctx), model: contributedCommands('model-plan', ctx) }, t)
}

function originOff(ctx: BuildingModelRibbonContext): boolean {
  return ctx.drawingOpen !== null && !ctx.liveViewOnDrawing
}

function showOriginCommand(ctx: BuildingModelRibbonContext): RibbonCommand {
  const t = ctx.t ?? englishOnly
  return {
    id: 'show-origin',
    label: t('ribbon.command.showOriginAxes', 'Show origin & axes', { ns: 'editor' }),
    icon: Axis3d,
    description: t('ribbon.description.showTheOriginMarkerWith', 'Show the origin marker with its X, Y and Z axes running to the edges of the view, and its site coordinates', { ns: 'editor' }),
    keywords: ['origin', 'axes', t('ribbon.keyword.basePoint', 'base point', { ns: 'editor' }), 'triad', 'coordinates'],
    pressed: ctx.coordinates.showOrigin,
    disabledReason: originOff(ctx) ? openModelForOrigin(t) : null,
    run: () => {
      if (ctx.liveViewOnDrawing) ctx.showLiveModel()
      ctx.coordinates.setShowOrigin(ctx.liveViewOnDrawing ? true : !ctx.coordinates.showOrigin)
    },
    testId: 'ribbon-show-origin',
  }
}

function coordinatesGroup(ctx: BuildingModelRibbonContext): RibbonGroup {
  const t = ctx.t ?? englishOnly
  const c = ctx.coordinates
  const orientationOff = c.orientation ? ctx.editBlocked : openAPlanForOrientation(t)
  return {
    id: 'coordinates',
    label: t('ribbon.group.coordinates', 'Coordinates', { ns: 'editor' }),
    commands: [
      {
        id: 'move-origin',
        label: t('ribbon.command.moveOrigin', 'Move origin', { ns: 'editor' }),
        icon: Move3d,
        description: t('ribbon.description.theOriginMarkerFollowsThe', 'The origin marker follows the pointer (snapping to parts and run ends); click to place it, then say whether only the marker moves or the building moves on the site. Also on the marker: right-click or double-click it', { ns: 'editor' }),
        keywords: [t('ribbon.keyword.projectOrigin', 'project origin', { ns: 'editor' }), t('ribbon.keyword.projectBasePoint', 'project base point', { ns: 'editor' }), 'relocate', t('ribbon.keyword.sharedCoordinates', 'shared coordinates', { ns: 'editor' })],
        pressed: c.moving,
        disabledReason: originOff(ctx) ? openModelForOrigin(t) : ctx.editBlocked,
        run: () => {
          if (ctx.liveViewOnDrawing) ctx.showLiveModel()
          c.toggleMove()
        },
        testId: 'ribbon-move-origin',
      },
      {
        id: 'coordinates-dialog',
        label: t('ribbon.command.coordinates', 'Coordinates', { ns: 'editor' }),
        icon: Compass,
        description: t('ribbon.description.seeOrSetTheProject', 'See or set the project origin, the site point, true north and the working angle, with a picture of what each one is', { ns: 'editor' }),
        keywords: [t('ribbon.keyword.projectBasePoint', 'project base point', { ns: 'editor' }), t('ribbon.keyword.surveyPoint', 'survey point', { ns: 'editor' }), t('ribbon.keyword.trueNorth', 'true north', { ns: 'editor' }), t('ribbon.keyword.workingAngle', 'working angle', { ns: 'editor' }), t('ribbon.keyword.siteCoordinates', 'site coordinates', { ns: 'editor' })],
        children: [
          { id: 'coord-origin', label: t('ribbon.command.projectOrigin', 'Project origin…', { ns: 'editor' }), icon: Move3d, description: t('ribbon.description.whereDrawingsAndSiteCoordinates', 'Where drawings and site coordinates are measured from', { ns: 'editor' }), run: c.openOrigin, testId: 'ribbon-coord-origin' },
          {
            id: 'survey-point',
            label: t('ribbon.command.sitePoint', 'Site point…', { ns: 'editor' }),
            icon: MapPinned,
            description: t('ribbon.description.showTheSitePointA', 'Show the site point (a fixed mark on the land, from the survey) on the marker and see or set its site coordinates', { ns: 'editor' }),
            keywords: [t('ribbon.keyword.surveyPoint', 'survey point', { ns: 'editor' }), t('ribbon.keyword.sharedSite', 'shared site', { ns: 'editor' }), t('ribbon.keyword.siteCoordinates', 'site coordinates', { ns: 'editor' }), 'northing', 'easting'],
            run: c.openSurveyPoint,
            testId: 'ribbon-survey-point',
          },
          {
            id: 'true-north',
            label: t('ribbon.command.trueNorth', 'True north…', { ns: 'editor' }),
            icon: Compass,
            description: t('ribbon.description.typeTheAngleFromPlan', 'Type the angle from plan north to true north, or pick two points along it', { ns: 'editor' }),
            keywords: ['north', 'rotate', 'bearing', 'angle'],
            disabledReason: ctx.editBlocked,
            run: c.openTrueNorth,
            testId: 'ribbon-true-north',
          },
          { id: 'working-angle', label: t('ribbon.command.workingAngle', 'Working angle…', { ns: 'editor' }), icon: Axis3d, description: t('ribbon.description.typeTheAngleTheBuilding', 'Type the angle the building is turned by, or put it back square', { ns: 'editor' }), keywords: [t('ribbon.keyword.rotateProjectNorth', 'rotate project north', { ns: 'editor' }), 'skewed', 'grid angle'], run: c.openWorkingAngle, testId: 'ribbon-working-angle' },
        ],
        testId: 'ribbon-coordinates',
      },
      {
        id: 'align-axes',
        label: t('ribbon.command.alignAxesToAnEdge', 'Align axes to an edge', { ns: 'editor' }),
        icon: Ruler,
        description: t('ribbon.description.clickAWallOrTwo', 'Click a wall, or two points along a building edge: route snaps, the placement grid, drafting ortho and new crop boxes turn to match it. Nothing moves', { ns: 'editor' }),
        keywords: [t('ribbon.keyword.rotateProjectNorth', 'rotate project north', { ns: 'editor' }), t('ribbon.keyword.skewedBuilding', 'skewed building', { ns: 'editor' }), t('ribbon.keyword.workingAngle', 'working angle', { ns: 'editor' }), t('ribbon.keyword.userCoordinateSystem', 'user coordinate system', { ns: 'editor' }), t('ribbon.keyword.alignGrid', 'align grid', { ns: 'editor' })],
        pressed: c.aligningAxes,
        disabledReason: ctx.editBlocked,
        run: () => {
          if (ctx.liveViewOnDrawing) ctx.showLiveModel()
          c.alignAxes()
        },
        testId: 'ribbon-align-axes',
      },
      {
        id: 'view-orientation',
        label: t('ribbon.command.viewOrientation', 'View orientation', { ns: 'editor' }),
        icon: Navigation2,
        description: c.orientation
          ? c.orientation.value === 'working_angle'
            ? t('ribbon.description.thisPlanIsTurnedTo', 'This plan is turned to the working angle', { ns: 'editor' })
            : c.orientation.value === 'true_north'
              ? t('ribbon.description.thisPlanIsDrawnWithTrue', 'This plan is drawn with true north up', { ns: 'editor' })
              : t('ribbon.description.thisPlanIsDrawnWithPlan', 'This plan is drawn with plan north up', { ns: 'editor' })
          : t('ribbon.description.turnAPlanSoPlan', 'Turn a plan so plan north, true north or the working angle is up', { ns: 'editor' }),
        keywords: [t('ribbon.keyword.trueNorth', 'true north', { ns: 'editor' }), t('ribbon.keyword.planNorth', 'plan north', { ns: 'editor' }), t('ribbon.keyword.workingAngle', 'working angle', { ns: 'editor' }), t('ribbon.keyword.rotateView', 'rotate view', { ns: 'editor' })],
        disabledReason: orientationOff,
        children: (['plan_north', 'true_north', 'working_angle'] as const).map((value) => ({
          id: `orientation-${value}`,
          label: orientationLabels(t)[value],
          icon: c.orientation?.value === value ? Check : Square,
          description: orientationHelp(t)[value],
          pressed: c.orientation?.value === value,
          disabledReason: orientationOff,
          run: () => c.orientation?.set(value),
          testId: `ribbon-orientation-${value}`,
        })),
        testId: 'ribbon-view-orientation',
      },
    ],
  }
}

/** The Create similar button for a selection tab; absent when the surface doesn't offer it. */
function createSimilarCommand(ctx: BuildingModelRibbonContext, description: string): RibbonCommand[] {
  const t = ctx.t ?? englishOnly
  const run = ctx.createSimilar
  return run ? [{ id: 'create-similar', label: t('ribbon.command.createSimilar', 'Create similar', { ns: 'editor' }), icon: CopyPlus, description, shortcut: 'C S', keywords: ['cs', 'copy', 'same', 'another like this', 'duplicate'], disabledReason: ctx.editBlocked, run, testId: 'ribbon-create-similar' }] : []
}
