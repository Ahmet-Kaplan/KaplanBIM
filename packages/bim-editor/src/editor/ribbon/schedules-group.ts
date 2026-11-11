import { FolderOpen, Library, Sigma, TableProperties } from 'lucide-react'
import { SCHEDULE_CATEGORIES, type ScheduleCategory } from '@permitzip/bim-kernel'
import { addonTabsWith } from '../contributions/registry'
import { englishOnly, type Translate } from '../i18n/translate'
import { isTradeTab, withTradeSectionCommands } from './trade-tab'
import type { RibbonCommand, RibbonGroup, RibbonTab } from './types'

/**
 * The model schedules on every discipline tab (SCHEDULES-PLAN §7
 * discoverability): New schedule… starts on what that trade lists most,
 * Open a schedule lists the schedules in the model.
 */

export interface RibbonSchedules {
  /** The model's schedule views, by name. */
  readonly views: readonly { readonly id: string; readonly name: string }[]
  readonly newSchedule: (category: ScheduleCategory) => void
  readonly open: (viewId: string) => void
  /** Manage › Library: the firm's shared calculations and schedule templates. */
  readonly openLibrary: () => void
  readonly editBlocked: string | null
  /**
   * One-click load schedules (Space loads, Panel loads, Loads): opens the
   * model's one by that name, making it the first time with the Loads columns
   * already chosen. `blocked` says why one can't be made yet.
   */
  readonly loadSchedules?: {
    readonly lists: readonly { readonly id: string; readonly label: string; readonly description: string; readonly blocked: string | null }[]
    readonly open: (id: string) => void
  }
}

/** What New schedule… starts on from Model, Views and any tab that names nothing else. */
const DEFAULT_START: ScheduleCategory = 'mechanical_equipment'

function isScheduleCategory(value: string): value is ScheduleCategory {
  return (SCHEDULE_CATEGORIES as readonly string[]).includes(value)
}

/** What New schedule… starts on, per tab that carries the group: Model and Views, then every add-on tab whose UI data names a `scheduleStart`. */
function tabStarts(): ReadonlyMap<string, ScheduleCategory> {
  const starts = new Map<string, ScheduleCategory>([
    ['model', DEFAULT_START],
    ['views', DEFAULT_START],
  ])
  for (const t of addonTabsWith('scheduleStart')) {
    if (isScheduleCategory(t.value)) starts.set(t.id, t.value)
    else console.error('[ribbon] an add-on tab names a schedule category the kernel does not have; it starts on the default', { tabId: t.id, category: t.value })
  }
  return starts
}

function scheduleCommands(tabId: string, start: ScheduleCategory, s: RibbonSchedules, t: Translate): RibbonCommand[] {
  const open: RibbonCommand = {
    id: `${tabId}-open-schedule`,
    label: t('ribbon.command.openASchedule', 'Open a schedule', { ns: 'editor' }),
    icon: FolderOpen,
    description: t('ribbon.description.openOneOfTheModels', 'Open one of the model’s schedules as a spreadsheet you can edit', { ns: 'editor' }),
    keywords: ['schedule', 'spreadsheet', 'grid', 'table'],
    disabledReason: s.views.length === 0 ? t('ribbon.help.noSchedulesInThisModel', 'No schedules in this model yet. Make one with New schedule…', { ns: 'editor' }) : null,
    children: s.views.map((v) => ({
      id: `${tabId}-open-schedule-${v.id}`,
      label: v.name,
      icon: TableProperties,
      description: t('ribbon.description.openNameAsASpreadsheet', 'Open {{name}} as a spreadsheet', { ns: 'editor', name: v.name }),
      run: () => s.open(v.id),
      testId: `ribbon-open-schedule-${v.id}`,
    })),
    testId: `ribbon-${tabId}-open-schedule`,
  }
  const loads: RibbonCommand[] = s.loadSchedules
    ? [
        {
          id: `${tabId}-load-schedules`,
          label: t('ribbon.command.loadSchedules', 'Load schedules', { ns: 'editor' }),
          icon: Sigma,
          description: t('ribbon.description.aScheduleWithTheLoads', 'A schedule with the Loads columns already chosen: estimate, devices so far and counted, per space or per panel', { ns: 'editor' }),
          keywords: ['loads', t('ribbon.keyword.loadStudy', 'load study', { ns: 'editor' }), t('ribbon.keyword.spaceLoads', 'space loads', { ns: 'editor' }), t('ribbon.keyword.panelLoads', 'panel loads', { ns: 'editor' }), 'estimate', t('ribbon.keyword.devicesSoFar', 'devices so far', { ns: 'editor' }), 'counted', 'va', 'wsfu', 'dfu', 'cfm'],
          children: s.loadSchedules.lists.map((l) => ({
            id: `${tabId}-load-schedule-${l.id}`,
            label: l.label,
            icon: TableProperties,
            description: l.description,
            disabledReason: l.blocked,
            run: () => s.loadSchedules?.open(l.id),
            testId: `ribbon-${tabId}-load-schedule-${l.id}`,
          })),
          testId: `ribbon-${tabId}-load-schedules`,
        },
      ]
    : []
  return [
    {
      id: `${tabId}-new-schedule`,
      label: t('ribbon.command.newSchedule', 'New schedule…', { ns: 'editor' }),
      icon: TableProperties,
      description: t('ribbon.description.listItemsFromTheModel', 'List items from the model in a spreadsheet: choose what to list, then the columns', { ns: 'editor' }),
      keywords: ['schedule', 'list', 'spreadsheet', 'grid', 'table', 'takeoff'],
      disabledReason: s.editBlocked,
      run: () => s.newSchedule(start),
      testId: `ribbon-${tabId}-new-schedule`,
    },
    open,
    ...loads,
  ]
}

export function libraryCommand(s: RibbonSchedules, t: Translate = englishOnly): RibbonCommand {
  return {
    id: 'manage-library',
    label: t('ribbon.command.library', 'Library', { ns: 'editor' }),
    icon: Library,
    description: t('ribbon.description.theFirmsSharedCalculationsFields', 'The firm’s shared calculations, fields and schedule templates', { ns: 'editor' }),
    keywords: ['library', 'formula', 'calculation', 'template', t('ribbon.keyword.sharedParameters', 'shared parameters', { ns: 'editor' })],
    run: s.openLibrary,
    testId: 'ribbon-manage-library',
  }
}

/** Add the Schedules commands to each discipline tab (into its own Schedules group when it has one), and Library to Manage. `t` translates the group captions. */
export function withScheduleGroups(tabs: readonly RibbonTab[], s: RibbonSchedules | null | undefined, t: Translate = englishOnly): RibbonTab[] {
  if (!s) return [...tabs]
  const starts = tabStarts()
  return tabs.map((tab) => {
    if (tab.id === 'manage') return { ...tab, groups: [...tab.groups, { id: 'manage-library', label: t('ribbon.group.library', 'Library', { ns: 'editor' }), commands: [libraryCommand(s, t)] }] }
    const start = starts.get(tab.id)
    if (!start) return tab
    const commands = scheduleCommands(tab.id, start, s, t)
    // A trade's tab keeps them in its Documents section, first.
    if (isTradeTab(tab)) return withTradeSectionCommands(tab, 'documents', commands, true, t)
    // Idempotent by the id this builder gives its own group. Matching on the caption
    // `'Schedules'` was a trap: the moment a pack's tab translates that word (Stage 4)
    // this would stop finding the group and append a second one beside it.
    const existing = tab.groups.findIndex((g) => g.id === `${tab.id}-schedules`)
    if (existing >= 0) {
      const groups = tab.groups.map((g, i): RibbonGroup => (i === existing ? { ...g, commands: [...commands, ...g.commands] } : g))
      return { ...tab, groups }
    }
    return { ...tab, groups: [...tab.groups, { id: `${tab.id}-schedules`, label: t('ribbon.group.schedules', 'Schedules', { ns: 'editor' }), commands }] }
  })
}
