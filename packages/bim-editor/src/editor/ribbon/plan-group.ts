import { BrickWall, ClipboardList, ListTodo, ScanSearch, SquareDashedMousePointer, SquareSplitHorizontal } from 'lucide-react'
import { addonTabsWith } from '../contributions/registry'
import { englishOnly, type Translate } from '../i18n/translate'
import type { EquipmentListTrade } from '../equipment-list/EquipmentListDialog'
import type { RibbonCommand, RibbonGroup, RibbonTab } from './types'

/**
 * "List first, draw second" (NEXT-BATCH): what exists before it is drawn.
 * One Plan group, right after Select, on the Model tab and every add-on tab
 * whose UI data names a `plan`, with the same three commands in the same
 * order on each, so a person who finds the Equipment list on one finds it in
 * the same spot on the next: Equipment list, Not placed yet, Spaces.
 */

export type PlanTrade = EquipmentListTrade

export interface RibbonPlan {
  readonly equipmentList: (trade: PlanTrade) => void
  /** Null when the list can be pasted; otherwise why not (the dialog itself shows read-only people why they can't add). */
  readonly equipmentListBlocked: string | null
  /** The Not placed yet panel; absent until it is wired. `counts` by tab id is data, so a memoised ribbon sees a count change. */
  readonly notPlacedYet?: { readonly open: (tabId: string) => void; readonly counts: Readonly<Record<string, number>>; readonly blocked: string | null }
  /** Spaces and zones; absent until it is wired. */
  readonly spaces?: {
    readonly open: () => void
    readonly blocked: string | null
    /** Room from walls (key tip R then W): hover a room on the plan, click to make it. */
    readonly roomFromWalls?: () => void
    /** Find rooms from walls (R then F): the rooms the walls close that have no space yet, to review. */
    readonly findFromWalls?: () => void
    /** Split space: a line across a room, then the dialog. */
    readonly split?: () => void
  }
  /** Open an add-on's left-rail section by its id (Model › Plan commands the add-ons bring); absent until it is wired. */
  readonly openRail?: { readonly open: (railId: string) => void; readonly blocked: string | null }
}

/** The Model tab's Plan group lists the equipment the Model tab places. */
const MODEL_PLAN: PlanTrade = 'mechanical'

/** Each tab with a Plan group and what it lists: Model, then the add-ons' tabs. */
function planTabs(): ReadonlyMap<string, PlanTrade> {
  // An add-on's `plan` names one of the equipment list's trades (its own UI data, checked by the add-on's tests).
  return new Map<string, PlanTrade>([['model', MODEL_PLAN], ...addonTabsWith('plan').map((t) => [t.id, t.value as PlanTrade] as const)])
}

/** The tabs whose Plan group carries Not placed yet, in ribbon order. */
export function planTabIds(): readonly string[] {
  return [...planTabs().keys()]
}

export function planCommands(tabId: string, trade: PlanTrade, p: RibbonPlan, t: Translate = englishOnly): RibbonCommand[] {
  const out: RibbonCommand[] = [
    {
      id: `${tabId}-equipment-list`,
      label: t('ribbon.command.equipmentList', 'Equipment list', { ns: 'editor' }),
      icon: ClipboardList,
      description: t('ribbon.description.pasteTheVendorsEquipmentOr', 'Paste the vendor’s equipment or fixture schedule (from a PDF, a spreadsheet or a CSV): each row becomes planned equipment with its electrical, gas and water values, before anything is drawn', { ns: 'editor' }),
      keywords: [t('ribbon.keyword.equipmentSchedule', 'equipment schedule', { ns: 'editor' }), t('ribbon.keyword.kitchenSchedule', 'kitchen schedule', { ns: 'editor' }), 'paste', 'csv', t('ribbon.keyword.vendorList', 'vendor list', { ns: 'editor' }), 'planned', 'import'],
      disabledReason: p.equipmentListBlocked,
      run: () => p.equipmentList(trade),
      testId: `ribbon-${tabId}-equipment-list`,
    },
  ]
  if (p.notPlacedYet) {
    const n = p.notPlacedYet
    const count = n.counts[tabId] ?? 0
    out.push({
      id: `${tabId}-not-placed-yet`,
      label: count > 0 ? t('ribbon.command.notPlacedYetCount', 'Not placed yet ({{count}})', { ns: 'editor', count }) : t('ribbon.command.notPlacedYet', 'Not placed yet', { ns: 'editor' }),
      icon: ListTodo,
      description: t('ribbon.description.everythingThatExistsButIsnt', 'Everything that exists but isn’t drawn yet: panels from a service layout, rooftop units, kitchen items. Place each one in the view you are in', { ns: 'editor' }),
      keywords: ['planned', 'unplaced', 'checklist', t('ribbon.keyword.toPlace', 'to place', { ns: 'editor' }), 'place'],
      disabledReason: n.blocked,
      run: () => n.open(tabId),
      testId: `ribbon-${tabId}-not-placed-yet`,
    })
  }
  if (p.spaces) {
    out.push({
      id: `${tabId}-spaces`,
      label: t('ribbon.command.spaces', 'Spaces', { ns: 'editor' }),
      icon: SquareDashedMousePointer,
      description: t('ribbon.description.theRoomsAndZonesYou', 'The rooms and zones you design for: make them from the architect’s rooms or trace them over a PDF or CAD drawing, then give them area loads', { ns: 'editor' }),
      keywords: ['space', 'zone', 'room', t('ribbon.keyword.areaLoad', 'area load', { ns: 'editor' }), 'trace', 'underlay', 'density'],
      disabledReason: p.spaces.blocked,
      run: p.spaces.open,
      testId: `ribbon-${tabId}-spaces`,
    })
    const sp = p.spaces
    if (sp.roomFromWalls)
      out.push({
        id: `${tabId}-room-from-walls`,
        label: t('ribbon.command.roomFromWalls', 'Room from walls', { ns: 'editor' }),
        icon: BrickWall,
        description: t('ribbon.description.hoverInsideTheWallsOf', 'Hover inside the walls of a room to see it and its area, then click to make it a space that follows its walls', { ns: 'editor' }),
        shortcut: 'R W',
        keywords: ['room', 'space', 'walls', 'bounded', t('ribbon.keyword.clickInside', 'click inside', { ns: 'editor' }), t('ribbon.keyword.makeRoom', 'make room', { ns: 'editor' })],
        disabledReason: sp.blocked,
        run: sp.roomFromWalls,
        testId: `ribbon-${tabId}-room-from-walls`,
      })
    if (sp.findFromWalls)
      out.push({
        id: `${tabId}-find-rooms-from-walls`,
        label: t('ribbon.command.findRoomsFromWalls', 'Find rooms from walls', { ns: 'editor' }),
        icon: ScanSearch,
        description: t('ribbon.description.findEveryRoomTheWalls', 'Find every room the walls on this plan close that has no space yet; accept or reject each before anything is saved', { ns: 'editor' }),
        shortcut: 'R F',
        keywords: [t('ribbon.keyword.detectRooms', 'detect rooms', { ns: 'editor' }), t('ribbon.keyword.findRooms', 'find rooms', { ns: 'editor' }), 'walls', 'propose', 'spaces'],
        disabledReason: sp.blocked,
        run: sp.findFromWalls,
        testId: `ribbon-${tabId}-find-rooms-from-walls`,
      })
    if (sp.split)
      out.push({
        id: `${tabId}-split-space`,
        label: t('ribbon.command.splitSpace', 'Split space', { ns: 'editor' }),
        icon: SquareSplitHorizontal,
        description: t('ribbon.description.drawALineFromWall', 'Draw a line from wall to wall across a room; the room keeps its name and area and gets sub-rooms under it', { ns: 'editor' }),
        keywords: ['split', 'sub-room', t('ribbon.keyword.separationLine', 'separation line', { ns: 'editor' }), t('ribbon.keyword.divideRoom', 'divide room', { ns: 'editor' }), t('ribbon.keyword.openOffice', 'open office', { ns: 'editor' })],
        disabledReason: sp.blocked,
        run: sp.split,
        testId: `ribbon-${tabId}-split-space`,
      })
  }
  return out
}

/**
 * Put the Plan group right after Select on each trade tab. `added` by tab id:
 * commands the add-ons contribute after the shared three. `t` translates the
 * group's caption.
 */
export function withPlanGroups(tabs: readonly RibbonTab[], p: RibbonPlan | null | undefined, added: Readonly<Record<string, readonly RibbonCommand[]>> = {}, t: Translate = englishOnly): RibbonTab[] {
  if (!p) return [...tabs]
  const plans = planTabs()
  return tabs.map((tab) => {
    const trade = plans.get(tab.id)
    if (!trade) return tab
    const group: RibbonGroup = { id: `${tab.id}-plan`, label: t('ribbon.group.plan', 'Plan', { ns: 'editor' }), commands: [...planCommands(tab.id, trade, p, t), ...(added[tab.id] ?? [])] }
    const at = tab.groups.findIndex((g) => g.id === 'select')
    const groups = [...tab.groups]
    groups.splice(at >= 0 ? at + 1 : 0, 0, group)
    return { ...tab, groups }
  })
}
