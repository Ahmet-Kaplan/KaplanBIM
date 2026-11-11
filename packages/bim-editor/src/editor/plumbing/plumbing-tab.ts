import { ArrowDownToLine, ArrowUpFromLine, Check, ChartSpline, CircleDot, CirclePlus, Droplet, Droplets, Flame, Gauge, Layers, Library, Link2, ListTree, MapPin, Network, PackagePlus, Palette, Route, Square, Wand2 } from 'lucide-react'
import { type PipeSizingMode } from '@permitzip/bim-kernel'
import { CLEANOUT_PROPOSAL_WORDS, FIXTURE_CONNECT_TARGETS, FIXTURE_CONNECT_WORDS, type FixtureConnectTarget, OUTFALL_CONNECTION_WORDS, PLUMBING_DEMAND_CURVES, type PlumbingBuildingType, type PlumbingDemandCurve } from '@permitzip/bim-pack-plumbing'
import { tradeTab } from '../ribbon/trade-tab'
import { buildingTypeWord, demandCurveWord } from './plumbing-words'
import { englishOnly, type Translate } from '../i18n/translate'
import type { RibbonCommand, RibbonGroup, RibbonTab } from '../ribbon/types'

export interface PlumbingAction {
  readonly run: () => void
  /** Null when it runs; otherwise why not, in the operator's words. */
  readonly blocked: string | null
}

/** The project's auto-sizing and demand curve, as the Sizing group shows and changes them. */
export interface PlumbingSizingRibbon {
  readonly mode: PipeSizingMode
  /** Systems that set their own mode, which the project's switch doesn't change. */
  readonly systemsOwnMode: number
  readonly toggle: () => void
  readonly curve: PlumbingDemandCurve | null
  readonly buildingType: PlumbingBuildingType | null
  readonly setCurve: (curve: PlumbingDemandCurve | null) => void
  readonly blocked: string | null
  /** Open the Hunter curve chart with each water system's design point. */
  readonly chart?: PlumbingAction
}

/** The Plumbing tab's state and actions (built by usePlumbingWorkflow). Optional entries show once their feature is wired. */
export interface PlumbingRibbon {
  readonly routePipe: PlumbingAction
  readonly placeFixture: PlumbingAction
  /** On a selected open pipe end: put a load (a fixture's or a lump) there without a fixture. */
  readonly placeLoadPoint?: PlumbingAction
  /** Split a lump load point across new points, totals kept. */
  readonly breakOut?: PlumbingAction
  readonly systems: PlumbingAction
  readonly sizing: PlumbingSizingRibbon
  readonly pipeTypes: PlumbingAction
  /** Connection types for plumbing, gas and air (P01, K07, the air taps). */
  readonly connectionTypes?: PlumbingAction
  readonly riser?: PlumbingAction
  /** Plumbing › Stacks: number the drawn stacks, their tags, the base-of-stack check. */
  readonly stacks?: PlumbingAction
  /** Systems › the selected building drain to a manhole, then the fall and backwater check. */
  readonly outfallConnection?: PlumbingAction
  /** Systems › cleanouts proposed as ghosts on the selected drain; Approve puts them in the pipe. */
  readonly proposeCleanouts?: PlumbingAction
  /** Connect › To drain / vent / cold / hot water on the selected fixtures (round 15). */
  readonly connectFixtures?: Readonly<Record<FixtureConnectTarget, PlumbingAction>>
}

const CONNECT_ICON: Readonly<Record<FixtureConnectTarget, RibbonCommand['icon']>> = { drain: ArrowDownToLine, vent: ArrowUpFromLine, cold_water: Droplet, hot_water: Flame }

/** Connect: one command, its four targets underneath (the group keeps five commands at most). */
function connectCommand(actions: Readonly<Record<FixtureConnectTarget, PlumbingAction>>): RibbonCommand {
  const W = FIXTURE_CONNECT_WORDS
  const open = FIXTURE_CONNECT_TARGETS.some((t) => actions[t].blocked === null)
  return {
    id: 'connect-fixtures',
    label: W.label,
    icon: Link2,
    description: W.description,
    keywords: [...W.keywords],
    disabledReason: open ? null : (actions.drain.blocked ?? W.selectFirst),
    children: FIXTURE_CONNECT_TARGETS.map((t) => cmd(`connect-${t.replace('_', '-')}`, W.target[t].label, CONNECT_ICON[t], W.target[t].description, actions[t], [...W.keywords, W.target[t].label.toLowerCase()])),
    testId: 'ribbon-plumbing-connect-fixtures',
  }
}

const cmd = (id: string, label: string, icon: RibbonCommand['icon'], description: string, a: PlumbingAction, keywords: string[]): RibbonCommand => ({ id, label, icon, description, keywords, disabledReason: a.blocked, run: a.run, testId: `ribbon-plumbing-${id}` })

function createGroup(p: PlumbingRibbon, t: Translate): RibbonGroup {
  return {
    id: 'plumbing-create',
    label: t('plumbing.create', 'Create', { ns: 'editor' }),
    commands: [
      cmd('route-pipe', t('plumbing.routePipe', 'Route pipe', { ns: 'editor' }), Route, t('plumbing.routePipeWhy', 'Draw pipe: water, sanitary, vent, storm, gas. The fittings are placed as you turn and branch', { ns: 'editor' }), p.routePipe, ['pipe', 'route', 'draw', 'sanitary', 'water', 'gas', 'vent']),
      ...(p.placeLoadPoint
        ? [cmd('place-load-point', t('plumbing.loadPoint', 'Load point', { ns: 'editor' }), MapPin, t('plumbing.loadPointWhy', 'Put a load on the selected open pipe end (a fixture’s WSFU, DFU, gas input) without placing the fixture', { ns: 'editor' }), p.placeLoadPoint, [t('plumbing.keyword.loadPoint', 'load point', { ns: 'editor' }), 'nub', t('plumbing.keyword.connectionPoint', 'connection point', { ns: 'editor' }), t('plumbing.keyword.stubOut', 'stub out', { ns: 'editor' }), t('plumbing.keyword.fixtureUnits', 'fixture units', { ns: 'editor' }), 'dfu', 'wsfu'])]
        : []),
      cmd('place-fixture', t('plumbing.fixture', 'Fixture', { ns: 'editor' }), PackagePlus, t('plumbing.fixtureWhy', 'Place a plumbing fixture or piece of equipment from the parts catalog', { ns: 'editor' }), p.placeFixture, ['fixture', 'water closet', 'lavatory', 'sink', 'water heater', 'equipment']),
      ...(p.breakOut ? [cmd('break-out', t('plumbing.breakOut', 'Break out', { ns: 'editor' }), ListTree, t('plumbing.breakOutWhy', 'Split the selected lump load point (a whole kitchen) across new load points; the totals stay the same', { ns: 'editor' }), p.breakOut, ['split', 'lump', t('plumbing.keyword.breakOutLoad', 'break out load', { ns: 'editor' })])] : []),
    ],
  }
}

function sizingGroup(s: PlumbingSizingRibbon, t: Translate): RibbonGroup {
  const on = s.mode === 'auto'
  // §8: a count takes no plural suffix, so the two English shapes are two keys.
  const others = s.systemsOwnMode > 0
    ? s.systemsOwnMode === 1
      ? t('plumbing.systemsOwnOne', ' ({{count}} system set their own)', { ns: 'editor', count: s.systemsOwnMode })
      : t('plumbing.systemsOwnMany', ' ({{count}} systems set their own)', { ns: 'editor', count: s.systemsOwnMode })
    : ''
  const curveNow = s.curve
    ? demandCurveWord(s.curve, t)
    : s.buildingType
      ? t('plumbing.fromTheBuildingType', 'from the building type ({{type}})', { ns: 'editor', type: buildingTypeWord(s.buildingType, t) })
      : t('plumbing.notChosenYet', 'not chosen yet', { ns: 'editor' })
  return {
    id: 'plumbing-sizing',
    label: t('plumbing.sizing', 'Sizing', { ns: 'editor' }),
    commands: [
      {
        id: 'auto-size',
        label: t('plumbing.autoSize', 'Auto-size', { ns: 'editor' }),
        icon: Wand2,
        description: on
          ? t('plumbing.autoSizeRibbonOn', 'On: suggested pipe sizes are applied as you model{{others}}. Press to go back to checking only', { ns: 'editor', others })
          : t('plumbing.autoSizeRibbonOff', 'Off: every pipe is checked and sizes are suggested; nothing changes until you accept{{others}}. Press to let sizes apply as you model', { ns: 'editor', others }),
        keywords: [t('plumbing.keyword.autoSize', 'auto size', { ns: 'editor' }), t('plumbing.keyword.automaticSizing', 'automatic sizing', { ns: 'editor' }), 'sizing', 'check', 'audit', 'lint'],
        pressed: on,
        disabledReason: s.blocked,
        run: s.toggle,
        testId: 'ribbon-plumbing-auto-size',
      },
      {
        id: 'demand-curve',
        label: t('plumbing.demandCurve', 'Demand curve', { ns: 'editor' }),
        icon: Gauge,
        description: t('plumbing.demandCurveWhy', 'Fixture units to gpm for water sizing: {{curve}}', { ns: 'editor', curve: curveNow }),
        keywords: [t('plumbing.keyword.hunterCurve', 'hunter curve', { ns: 'editor' }), 'ashrae', 'curve a', 'wsfu', 'demand', 'appendix e', 'gpm'],
        disabledReason: s.blocked,
        children: [
          ...PLUMBING_DEMAND_CURVES.filter((c) => c !== 'legacy_fit').map((c) => ({
            id: `demand-curve-${c}`,
            label: demandCurveWord(c, t),
            icon: s.curve === c ? Check : Square,
            description: t('plumbing.sizeWaterPipesOn', 'Size water pipes on {{curve}}', { ns: 'editor', curve: demandCurveWord(c, t) }),
            pressed: s.curve === c,
            disabledReason: s.blocked,
            run: () => s.setCurve(c),
            testId: `ribbon-plumbing-demand-curve-${c}`,
          })),
          { id: 'demand-curve-building', label: t('plumbing.fromTheBuildingTypeLabel', 'From the building type', { ns: 'editor' }), icon: s.curve === null ? Check : Square, description: t('plumbing.useTheCurveTheBuildingTypeCallsFor', 'Use the curve the building type calls for (set it in Systems › Project)', { ns: 'editor' }), pressed: s.curve === null, disabledReason: s.blocked, run: () => s.setCurve(null), testId: 'ribbon-plumbing-demand-curve-building' },
        ],
        testId: 'ribbon-plumbing-demand-curve',
      },
      ...(s.chart
        ? [
            cmd('hunter-curve', t('plumbing.hunterCurve', 'Hunter curve', { ns: 'editor' }), ChartSpline, t('plumbing.hunterCurveWhy', "The demand curves and where each water system's fixture units fall on its curve", { ns: 'editor' }), s.chart, [
              t('plumbing.keyword.hunterCurve', 'hunter curve', { ns: 'editor' }),
              'chart',
              'graph',
              'demand',
              'gpm',
              'wsfu',
              t('plumbing.keyword.operatingPoint', 'operating point', { ns: 'editor' }),
              t('plumbing.keyword.designPoint', 'design point', { ns: 'editor' }),
            ]),
          ]
        : []),
    ],
  }
}

/** Plumbing: on every project's Building Model, like Electrical, in the same tab pattern. */
export function plumbingTab(p: PlumbingRibbon, select: RibbonGroup, t: Translate = englishOnly): RibbonTab {
  return tradeTab({
    id: 'plumbing',
    label: t('plumbing.plumbing', 'Plumbing', { ns: 'editor' }),
    select,
    create: [createGroup(p, t)],
    connect: {
      id: 'plumbing-systems',
      label: t('plumbing.systems', 'Systems', { ns: 'editor' }),
      commands: [
        ...(p.connectFixtures ? [connectCommand(p.connectFixtures)] : []),
        cmd('systems', t('plumbing.systems', 'Systems', { ns: 'editor' }), Palette, t('plumbing.systemsWhy', 'Name each pipe system, its colour and line pattern (vents dashed in print), and whether it sizes itself', { ns: 'editor' }), p.systems, ['system', 'rename', 'colour', 'color', t('plumbing.keyword.lineStyle', 'line style', { ns: 'editor' }), 'dashed', t('plumbing.keyword.lineWeight', 'line weight', { ns: 'editor' }), 'graphics', 'visibility']),
        ...(p.outfallConnection ? [cmd('outfall-connection', OUTFALL_CONNECTION_WORDS.label, CircleDot, OUTFALL_CONNECTION_WORDS.description, p.outfallConnection, [...OUTFALL_CONNECTION_WORDS.keywords])] : []),
        ...(p.proposeCleanouts ? [cmd('propose-cleanouts', CLEANOUT_PROPOSAL_WORDS.label, CirclePlus, CLEANOUT_PROPOSAL_WORDS.description, p.proposeCleanouts, [...CLEANOUT_PROPOSAL_WORDS.keywords])] : []),
        ...(p.stacks
          ? [
              cmd('stacks', t('plumbing.stacks', 'Stacks', { ns: 'editor' }), Layers, t('plumbing.stacksWhy', 'Every sanitary, vent and storm stack: number them, see each floor’s size, DFU and offsets, and the tag they print (4"//S/K/L//19)', { ns: 'editor' }), p.stacks, [
                'stack',
                'stacks',
                'riser',
                t('plumbing.keyword.stackNumber', 'stack number', { ns: 'editor' }),
                t('plumbing.keyword.stackTag', 'stack tag', { ns: 'editor' }),
                'offset',
                t('plumbing.keyword.baseOfStack', 'base of stack', { ns: 'editor' }),
                '3 diameter',
                t('plumbing.keyword.wasteStack', 'waste stack', { ns: 'editor' }),
                t('plumbing.keyword.ventStack', 'vent stack', { ns: 'editor' }),
              ]),
            ]
          : []),
      ],
    },
    analyze: sizingGroup(p.sizing, t),
    design: {
      id: 'plumbing-types',
      label: t('plumbing.types', 'Types', { ns: 'editor' }),
      commands: [
        cmd('pipe-types', t('plumbing.pipeTypes', 'Pipe types', { ns: 'editor' }), Library, t('plumbing.pipeTypesWhy', 'DW-PEX, SAN-PVC, GAS-SCH40…: material, sizes and joints, and the fittings each material takes', { ns: 'editor' }), p.pipeTypes, [t('plumbing.keyword.pipeType', 'pipe type', { ns: 'editor' }), 'material', 'pex', 'pvc', t('plumbing.keyword.castIron', 'cast iron', { ns: 'editor' }), 'copper', 'fittings', t('plumbing.keyword.pipingSpecifications', 'piping specifications', { ns: 'editor' })]),
        ...(p.connectionTypes
          ? [
              cmd('connection-types', t('plumbing.connectionTypes', 'Connection types', { ns: 'editor' }), Droplets, t('plumbing.connectionTypesWhy', 'P01, K07…: what a fixture or appliance connects with (WSFU, DFU, gas input, CFM), used by load points and fixtures', { ns: 'editor' }), p.connectionTypes, [
                t('plumbing.keyword.connectionType', 'connection type', { ns: 'editor' }),
                t('plumbing.keyword.fixtureType', 'fixture type', { ns: 'editor' }),
                'wsfu',
                'dfu',
                'mbh',
                'cfm',
                'designator',
              ]),
            ]
          : []),
      ],
    },
    documents: [
      p.riser
        ? {
            id: 'plumbing-diagrams',
            label: t('plumbing.diagrams', 'Diagrams', { ns: 'editor' }),
            commands: [cmd('riser', t('plumbing.riserDiagram', 'Riser diagram', { ns: 'editor' }), Network, t('plumbing.riserDiagramWhy', 'The live plumbing riser drawn from the model, redrawn as it changes; place it on a sheet like any view', { ns: 'editor' }), p.riser, ['riser', 'isometric', 'schematic', 'diagram'])],
          }
        : null,
    ],
  }, t)
}

const NOTHING = (): void => undefined

/** The Plumbing tab while the plumbing tools load (or failed): every command off, saying why. */
export function waitingRibbon(reason: string): PlumbingRibbon {
  const off = { run: NOTHING, blocked: reason }
  return {
    routePipe: off,
    placeFixture: off,
    systems: off,
    sizing: { mode: 'check', systemsOwnMode: 0, toggle: NOTHING, curve: null, buildingType: null, setCurve: NOTHING, blocked: reason },
    pipeTypes: off,
  }
}

/** This add-on's tabs by the ids in its `ADDON_UI` (`tabsFrom`). */
export const TABS = { plumbing: plumbingTab }
