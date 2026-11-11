import { Cable, Network, PackagePlus, Route, Ruler } from 'lucide-react'
import { AIR_CONNECT_WORDS, SIZE_DUCTS_WORDS } from '@permitzip/bim-pack-mechanical/ui'
import { tradeTab } from '../ribbon/trade-tab'
import { englishOnly, type Translate } from '../i18n/translate'
import type { RibbonCommand, RibbonGroup, RibbonTab } from '../ribbon/types'

export interface MechanicalAction {
  readonly run: () => void
  /** Null when it runs; otherwise why not, in the operator's words. */
  readonly blocked: string | null
}

/** The Mechanical tab's actions (built by the Mechanical workflow host). */
export interface MechanicalRibbon {
  readonly routeDuct: MechanicalAction
  readonly placeEquipment: MechanicalAction
  /** Connect › To duct: the selected diffusers, grilles and units into the nearest duct of their system (a preview window, one undo). */
  readonly connectToDuct: MechanicalAction
  /** Analyze › Size ducts: every run of the selected air systems by each system's sizing rule (a preview window, one undo). */
  readonly sizeDucts: MechanicalAction
  /** Diagrams › Air schematic: the live air schematic view, drawn from the model's ducts. */
  readonly airSchematic: MechanicalAction
}

const cmd = (id: string, label: string, icon: RibbonCommand['icon'], description: string, a: MechanicalAction, keywords: readonly string[]): RibbonCommand => ({ id, label, icon, description, keywords: [...keywords], disabledReason: a.blocked, run: a.run, testId: `ribbon-mechanical-${id}` })

/** Mechanical: the same trade tab pattern as Electrical and Plumbing. Ventilation and Kitchen heat join Analyze from the add-on's commands. */
export function mechanicalTab(m: MechanicalRibbon, select: RibbonGroup, t: Translate = englishOnly): RibbonTab {
  return tradeTab({
    id: 'mechanical',
    label: t('ventilation.tab.mechanical', 'Mechanical', { ns: 'editor' }),
    select,
    create: [
      {
        id: 'mechanical-create',
        label: t('ventilation.group.create', 'Create', { ns: 'editor' }),
        commands: [
          cmd(
            'route-duct',
            t('ventilation.command.routeDuct', 'Route duct', { ns: 'editor' }),
            Route,
            t(
              'ventilation.command.routeDuctDescription',
              'Draw duct: supply, return, exhaust, outdoor air. Fittings go in as you turn and branch; rated walls and tight ceilings are checked as you draw',
              { ns: 'editor' },
            ),
            m.routeDuct,
            [
              t('ventilation.keyword.duct', 'duct', { ns: 'editor' }),
              t('ventilation.keyword.route', 'route', { ns: 'editor' }),
              t('ventilation.keyword.draw', 'draw', { ns: 'editor' }),
              t('ventilation.keyword.supply', 'supply', { ns: 'editor' }),
              t('ventilation.keyword.return', 'return', { ns: 'editor' }),
              t('ventilation.keyword.exhaust', 'exhaust', { ns: 'editor' }),
            ],
          ),
          cmd(
            'place-equipment',
            t('ventilation.command.equipment', 'Equipment', { ns: 'editor' }),
            PackagePlus,
            t('ventilation.command.equipmentDescription', 'Place a unit, fan, diffuser or grille from the parts catalog', { ns: 'editor' }),
            m.placeEquipment,
            [
              t('ventilation.keyword.abbrRtu', 'rtu', { ns: 'editor' }),
              t('ventilation.keyword.abbrAhu', 'ahu', { ns: 'editor' }),
              t('ventilation.keyword.wordFan', 'fan', { ns: 'editor' }),
              t('ventilation.keyword.diffuser', 'diffuser', { ns: 'editor' }),
              t('ventilation.keyword.grille', 'grille', { ns: 'editor' }),
              t('ventilation.keyword.register', 'register', { ns: 'editor' }),
              t('ventilation.keyword.equipment', 'equipment', { ns: 'editor' }),
            ],
          ),
        ],
      },
    ],
    connect: { id: 'mechanical-connect', label: t('ventilation.group.connect', 'Connect', { ns: 'editor' }), commands: [cmd('connect-to-duct', AIR_CONNECT_WORDS.label, Cable, AIR_CONNECT_WORDS.description, m.connectToDuct, AIR_CONNECT_WORDS.keywords)] },
    analyze: { id: 'mechanical-analyze', label: t('ventilation.group.analyze', 'Analyze', { ns: 'editor' }), commands: [cmd('size-ducts', SIZE_DUCTS_WORDS.label, Ruler, SIZE_DUCTS_WORDS.description, m.sizeDucts, SIZE_DUCTS_WORDS.keywords)] },
    documents: [
      {
        id: 'mechanical-diagrams',
        label: t('ventilation.group.diagrams', 'Diagrams', { ns: 'editor' }),
        commands: [
          cmd(
            'air-schematic',
            t('ventilation.command.airSchematic', 'Air schematic', { ns: 'editor' }),
            Network,
            t(
              'ventilation.command.airSchematicDescription',
              'Each air system from its unit through the mains and branches to every diffuser, with sizes and airflow, drawn live from the model; click a symbol to select it in the model',
              { ns: 'editor' },
            ),
            m.airSchematic,
            [
              t('ventilation.keyword.schematic', 'schematic', { ns: 'editor' }),
              t('ventilation.keyword.air', 'air', { ns: 'editor' }),
              t('ventilation.keyword.ductDiagram', 'duct diagram', { ns: 'editor' }),
              t('ventilation.keyword.riser', 'riser', { ns: 'editor' }),
              t('ventilation.keyword.abbrCfm', 'cfm', { ns: 'editor' }),
              t('ventilation.keyword.diagram', 'diagram', { ns: 'editor' }),
            ],
          ),
        ],
      },
    ],
  }, t)
}

const NOTHING = (): void => undefined

/** The Mechanical tab while the Mechanical tools load (or failed): every command off, saying why. */
export function waitingRibbon(reason: string): MechanicalRibbon {
  const off = { run: NOTHING, blocked: reason }
  return { routeDuct: off, placeEquipment: off, connectToDuct: off, sizeDucts: off, airSchematic: off }
}

/** This add-on's tabs by the ids in its `ADDON_UI` (`tabsFrom`). */
export const TABS = { mechanical: mechanicalTab }
