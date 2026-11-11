import { BatteryCharging, Box, Cable, CircleDot, ClipboardCheck, Factory, Gauge, LayoutGrid, Library, Lightbulb, Network, Plug, PlugZap, Power, Repeat, Scale, Server, SquareStack, Table2, TableProperties, ToggleLeft, Unplug, Waypoints, X, Zap } from 'lucide-react'
import type { RibbonCommand, RibbonGroup, RibbonTab } from '../ribbon/types'
import { tradeTab } from '../ribbon/trade-tab'
import { englishOnly, type Translate } from '../i18n/translate'
import type { ScheduleChoice } from './schedules/schedule-plan'
import type { ScheduleAction } from './schedules/use-schedule-workflow'
import type { DockDeclaration } from '../contributions/types'
import { dockChildren } from '../schedule-tab/dock'

/** The starter types the Electrical tab places (packages/bim-kernel/src/library). */
export const ELECTRICAL_PLACE_TYPES = {
  receptacle: 'builtin:duplex-receptacle@1',
  light: 'builtin:troffer-2x4-led@1',
  switch: 'builtin:switch-single-pole@1',
  junction_box: 'builtin:junction-box-4sq@1',
  equipment_1p: 'builtin:equipment-connection-1p@1',
  equipment_2p: 'builtin:equipment-connection-2p@1',
  equipment_3p: 'builtin:equipment-connection-3p@1',
  panel_208: 'builtin:panelboard-225@1',
  panel_480: 'builtin:panelboard-225-480@1',
  switchboard: 'builtin:switchboard-800-480@1',
  transformer: 'builtin:transformer-75kva@1',
  receptacle_quad: 'builtin:quad-receptacle@1',
  receptacle_gfci: 'builtin:gfci-receptacle@1',
  receptacle_counter: 'builtin:countertop-receptacle@1',
  receptacle_floor: 'builtin:floor-receptacle@1',
  receptacle_ceiling: 'builtin:ceiling-receptacle@1',
  downlight: 'builtin:downlight-6-led@1',
  light_emergency: 'builtin:troffer-2x4-led-em@1',
  exit_sign: 'builtin:exit-sign-led@1',
  panel_208_mcb: 'builtin:panelboard-225-mcb@1',
  panel_480_mcb: 'builtin:panelboard-225-480-mcb@1',
  panel_unit: 'builtin:panelboard-125-208-1ph@1',
  switchboard_sections: 'builtin:switchboard-sections-1600-480@1',
  transformer_45: 'builtin:transformer-45kva@1',
  transformer_112: 'builtin:transformer-112_5kva@1',
  generator: 'builtin:generator-150kw-480@1',
  ats: 'builtin:ats-400-480@1',
  meter: 'builtin:ct-cabinet-meter-800-480@1',
  tap_box: 'builtin:tap-box-1200-480@1',
  disconnect_nf_30: 'builtin:disconnect-nf-30-480@1',
  disconnect_nf_60: 'builtin:disconnect-nf-60-480@1',
  disconnect_fused_60: 'builtin:disconnect-fused-60-480@1',
  disconnect_fused_100: 'builtin:disconnect-fused-100-480@1',
} as const

export type ElectricalPlaceKind = keyof typeof ELECTRICAL_PLACE_TYPES

/** What is selected, as the Circuit tab cares: loads that can go on a circuit, and distribution equipment. */
export interface ElectricalSelection {
  readonly label: string
  /** Devices and equipment with a power connector (not panels). */
  readonly loads: number
  /** Loads already on a circuit. */
  readonly circuited: number
  /** Panelboards, switchboards and transformers. */
  readonly panels: number
  /** Equipment selected that needs a field filled in before it can be circuited or fed. */
  readonly unready?: number
}

export interface ElectricalAction {
  readonly run: () => void
  readonly blocked: string | null
}

/** The Electrical tab's state and actions (built by useElectricalWorkflow). Each `…Blocked` is null when it runs, else why not. */
export interface ElectricalRibbon {
  readonly place: (kind: ElectricalPlaceKind) => void
  readonly placeBlocked: string | null
  readonly addToCircuit: () => void
  readonly addBlocked: string | null
  readonly editCircuit: () => void
  readonly editBlocked: string | null
  readonly removeFromCircuit: () => void
  readonly removeBlocked: string | null
  readonly feedPanel: () => void
  readonly feedBlocked: string | null
  readonly openPanelView: () => void
  readonly panelViewBlocked: string | null
  /** Findings, phase balancing and room templates: shown once wired (each `run` + why it can't). */
  readonly check?: ElectricalAction
  readonly balance?: ElectricalAction
  readonly templates?: ElectricalAction
  /** Schedules group: make a live schedule of this kind (`blockedFor` null when it can be made, else why not). */
  readonly schedules?: ScheduleAction
  /** Open (or make) the live diagram of a kind: drawn from the model, kept up to date (diagrams/). */
  readonly diagram?: { readonly open: (kind: 'one_line' | 'electrical_riser') => void; readonly blocked: string | null }
  /** Connection types, feeder types and room templates (the project's electrical catalog). */
  readonly types?: ElectricalAction
  /** One entry per docked record (the add-on's `docks` declaration), each opened beside the plan. */
  readonly docked?: { readonly addon: string; readonly dock: DockDeclaration; readonly list: readonly { readonly id: string; readonly name: string }[]; readonly open: (id: string) => void }
  /** Continue circuit: every device placed while it is on joins the picked circuit (Esc or Stop ends it). */
  readonly continueCircuit?: ElectricalAction
  /** Propose receptacles in rooms the person picks (NEC 210.52 or a density preset); preview, then accept all or some. */
  readonly propose?: ElectricalAction
  /** Early service size from a pasted equipment list (NEC 220); changes nothing in the model. */
  readonly serviceSize?: ElectricalAction
  /** Place a starter service (meter, main, distribution, panels) from a service size; the one-line then draws it. */
  readonly serviceLayout?: ElectricalAction
  readonly selection: ElectricalSelection | null
}

function scheduleCommand(s: ScheduleAction, kind: ScheduleChoice, label: string, icon: RibbonCommand['icon'], description: string, testId: string, keywords: string[] = []): RibbonCommand {
  return { id: `schedule-${kind}`, label, icon, description, keywords, disabledReason: s.blockedFor(kind), run: () => s.run(kind), testId }
}

function schedulesGroup(s: ScheduleAction, t: Translate): RibbonGroup {
  return {
    id: 'electrical-schedules',
    label: t('electrical.electricalSchedules', 'Schedules', { ns: 'editor' }),
    commands: [
      scheduleCommand(s, 'panel', t('electrical.panelSchedule', 'Panel schedule', { ns: 'editor' }), Table2, t('electrical.aLivePanelScheduleOfTheSelectedPanelOrThePan', 'A live panel schedule of the selected panel (or the panel of the selected device), placed on a sheet', { ns: 'editor' }), 'ribbon-electrical-panel-schedule', [t('electrical.panelSchedule_113', 'panel schedule', { ns: 'editor' }), t('electrical.switchboardSchedule', 'switchboard schedule', { ns: 'editor' }), t('electrical.loadSchedule', 'load schedule', { ns: 'editor' }), 'circuits']),
      scheduleCommand(s, 'feeder', t('electrical.feederSchedule', 'Feeder schedule', { ns: 'editor' }), Table2, t('electrical.everyFeederTypeInTheModelWithItsConductorsAn', 'Every feeder type in the model with its conductors and conduit, placed on a sheet', { ns: 'editor' }), 'ribbon-electrical-feeder-schedule', ['feeders', 'conductors', 'wire']),
      {
        id: 'more-schedules',
        label: t('electrical.moreSchedules', 'More schedules', { ns: 'editor' }),
        icon: TableProperties,
        description: t('electrical.moreSchedulesWhy', 'Connection types, equipment connections, and mechanical equipment with its circuit', { ns: 'editor' }),
        keywords: ['schedule'],
        children: [
          scheduleCommand(s, 'connection_types', t('electrical.connectionTypes', 'Connection types', { ns: 'editor' }), Table2, t('electrical.devicesGroupedByTypeAndLoad', 'Devices grouped by type and load', { ns: 'editor' }), 'ribbon-electrical-connection-types-schedule', ['devices', 'receptacles']),
          scheduleCommand(s, 'equipment_connections', t('electrical.equipmentConnections', 'Equipment connections', { ns: 'editor' }), Table2, t('electrical.hardwiredEquipmentWithMCAMOCPAndItsLiveCircu', 'Hardwired equipment with MCA, MOCP and its live circuit', { ns: 'editor' }), 'ribbon-electrical-equipment-connections-schedule', ['mca', 'mocp', 'disconnect']),
          scheduleCommand(s, 'mechanical_equipment', t('electrical.mechanicalEquipmentWithElectrical', 'Mechanical equipment (with electrical)', { ns: 'editor' }), Table2, t('electrical.theMechanicalEquipmentListWithVoltsMCAMOCPAn', 'The mechanical equipment list with volts, MCA, MOCP and the circuit it is on', { ns: 'editor' }), 'ribbon-electrical-mechanical-schedule', ['rtu', 'hvac', t('electrical.crossTrade', 'cross trade', { ns: 'editor' })]),
        ],
        testId: 'ribbon-electrical-more-schedules',
      },
    ],
  }
}

function placeCommand(e: ElectricalRibbon, kind: ElectricalPlaceKind, label: string, icon: RibbonCommand['icon'], description: string, keywords: string[] = []): RibbonCommand {
  return { id: `place-${kind}`, label, icon, description, keywords, disabledReason: e.placeBlocked, run: () => e.place(kind), testId: `ribbon-electrical-place-${kind.replace(/_/g, '-')}` }
}

function placeGroup(e: ElectricalRibbon, t: Translate): RibbonGroup {
  return {
    id: 'electrical-place',
    label: t('electrical.electricalPlace', 'Place', { ns: 'editor' }),
    commands: [
      {
        id: 'place-device',
        label: t('electrical.placeDevice', 'Device', { ns: 'editor' }),
        icon: Plug,
        description: t('electrical.placeDeviceWhy', 'Place a receptacle, light, switch, junction box or hardwired equipment connection, then click in a plan or the 3D model', { ns: 'editor' }),
        keywords: ['receptacle', 'outlet', 'light', 'fixture', 'switch', t('electrical.keyword.junctionbox', 'junction box', { ns: 'editor' }), t('electrical.keyword.equipmentconnection', 'equipment connection', { ns: 'editor' }), 'disconnect', 'power'],
        disabledReason: e.placeBlocked,
        children: [
          placeCommand(e, 'receptacle', 'Receptacle', Plug, t('electrical.a20ADuplexReceptacle120V180VA', 'A 20 A duplex receptacle, 120 V, 180 VA', { ns: 'editor' }), ['outlet', 'duplex', 'plug']),
          placeCommand(e, 'receptacle_quad', t('electrical.receptacleQuad', 'Receptacle, quad', { ns: 'editor' }), Plug, t('electrical.twoDuplexesInOneBox360VA', 'Two duplexes in one box, 360 VA', { ns: 'editor' }), ['fourplex', t('electrical.doubleDuplex', 'double duplex', { ns: 'editor' })]),
          placeCommand(e, 'receptacle_gfci', t('electrical.receptacleGFCI', 'Receptacle, GFCI', { ns: 'editor' }), Plug, t('electrical.aGFCIDuplexReceptacle', 'A GFCI duplex receptacle', { ns: 'editor' }), [t('electrical.groundFault', 'ground fault', { ns: 'editor' }), 'gfi', 'wet']),
          placeCommand(e, 'receptacle_counter', t('electrical.receptacleCountertop', 'Receptacle, countertop', { ns: 'editor' }), Plug, t('electrical.aGFCiReceptacle42UpAboveACounter', 'A GFCI receptacle 42" up, above a counter', { ns: 'editor' }), ['kitchen', 'counter', t('electrical.breakRoom', 'break room', { ns: 'editor' })]),
          placeCommand(e, 'receptacle_floor', t('electrical.receptacleFloorBox', 'Receptacle, floor box', { ns: 'editor' }), Plug, t('electrical.aDuplexInAFloorBox', 'A duplex in a floor box', { ns: 'editor' }), ['floor', 'poke-thru']),
          placeCommand(e, 'receptacle_ceiling', t('electrical.receptacleCeiling', 'Receptacle, ceiling', { ns: 'editor' }), Plug, t('electrical.aCeilingMountedDuplex', 'A ceiling-mounted duplex', { ns: 'editor' }), ['ceiling', 'projector']),
          placeCommand(e, 'light', 'Light', Lightbulb, t('electrical.a2x4LEDTroffer277V', 'A 2x4 LED troffer, 277 V', { ns: 'editor' }), ['fixture', 'luminaire', 'troffer', 'lighting']),
          placeCommand(e, 'downlight', 'Downlight', Lightbulb, t('electrical.a6LEDDownlight277V', 'A 6" LED downlight, 277 V', { ns: 'editor' }), ['can', 'recessed']),
          placeCommand(e, 'light_emergency', t('electrical.lightEmergencyBattery', 'Light, emergency battery', { ns: 'editor' }), BatteryCharging, t('electrical.a2x4TrofferWithAnEmergencyBattery', 'A 2x4 troffer with an emergency battery', { ns: 'editor' }), ['emergency', 'egress', 'em']),
          placeCommand(e, 'exit_sign', t('electrical.exitSign', 'Exit sign', { ns: 'editor' }), BatteryCharging, t('electrical.anLEDExitSignWithBattery', 'An LED exit sign with battery', { ns: 'editor' }), ['exit', 'egress']),
          placeCommand(e, 'switch', 'Switch', ToggleLeft, t('electrical.aSinglePoleSwitch', 'A single-pole switch', { ns: 'editor' }), [t('electrical.lightSwitch', 'light switch', { ns: 'editor' }), 'toggle']),
          placeCommand(e, 'junction_box', t('electrical.junctionBox', 'Junction box', { ns: 'editor' }), Box, t('electrical.a4SquareJunctionBox', 'A 4" square junction box', { ns: 'editor' }), ['j-box', 'jbox']),
          placeCommand(e, 'equipment_1p', t('electrical.equipmentConnection120V', 'Equipment connection, 120 V', { ns: 'editor' }), PlugZap, t('electrical.aHardwiredConnection1PoleSetItsLoadAndBreake', 'A hardwired connection, 1 pole: set its load and breaker to the nameplate', { ns: 'editor' }), ['hardwired', 'disconnect', 'equipment']),
          placeCommand(e, 'equipment_2p', t('electrical.equipmentConnection208V2Pole', 'Equipment connection, 208 V 2-pole', { ns: 'editor' }), PlugZap, t('electrical.aHardwiredConnection2Poles', 'A hardwired connection, 2 poles', { ns: 'editor' }), ['hardwired', t('electrical.waterHeater', 'water heater', { ns: 'editor' }), 'equipment']),
          placeCommand(e, 'equipment_3p', t('electrical.equipmentConnection3Phase', 'Equipment connection, 3-phase', { ns: 'editor' }), PlugZap, 'A hardwired connection, 3 poles: set its voltage to 208 or 480', ['hardwired', 'motor', 'equipment']),
        ],
        testId: 'ribbon-electrical-device',
      },
      {
        id: 'place-panel',
        label: t('electrical.placePanel', 'Panel', { ns: 'editor' }),
        icon: Server,
        description: t('electrical.placePanelWhy', 'Place a panelboard or switchboard; name it (L1, H1, MDP) in its properties so circuits read L1-3', { ns: 'editor' }),
        keywords: ['panelboard', 'switchboard', 'mdp', 'distribution', t('electrical.keyword.loadcenter', 'load center', { ns: 'editor' })],
        disabledReason: e.placeBlocked,
        children: [
          placeCommand(e, 'panel_208', 'Panelboard 120/208 V', Server, t('electrical.225A42CircuitsMainLugs', '225 A, 42 circuits, main lugs', { ns: 'editor' }), ['208', t('electrical.lightingPanel', 'lighting panel', { ns: 'editor' }), t('electrical.receptaclePanel', 'receptacle panel', { ns: 'editor' })]),
          placeCommand(e, 'panel_480', 'Panelboard 277/480 V', Server, t('electrical.225A42CircuitsMainLugs', '225 A, 42 circuits, main lugs', { ns: 'editor' }), ['480', 'h panel']),
          placeCommand(e, 'panel_208_mcb', 'Panelboard 120/208 V, main breaker', Server, t('electrical.225AMainBreaker42Circuits', '225 A main breaker, 42 circuits', { ns: 'editor' }), ['mcb', t('electrical.mainBreaker_177', 'main breaker', { ns: 'editor' })]),
          placeCommand(e, 'panel_480_mcb', 'Panelboard 277/480 V, main breaker', Server, t('electrical.225AMainBreaker42Circuits', '225 A main breaker, 42 circuits', { ns: 'editor' }), ['mcb', t('electrical.mainBreaker', 'main breaker', { ns: 'editor' })]),
          placeCommand(e, 'panel_unit', 'Unit panel 120/208 V 1-phase', Server, t('electrical.125AMainBreaker30CircuitsADwellingUnit', '125 A main breaker, 30 circuits: a dwelling unit', { ns: 'editor' }), ['apartment', 'unit', t('electrical.loadCenter', 'load center', { ns: 'editor' }), 'residential']),
          placeCommand(e, 'switchboard', 'Switchboard 277/480 V', SquareStack, t('electrical.800AMainBreaker30Positions', '800 A main breaker, 30 positions', { ns: 'editor' }), ['mdp', t('electrical.mainDistribution_180', 'main distribution', { ns: 'editor' }), 'service']),
          placeCommand(e, 'switchboard_sections', t('electrical.switchboardSections', 'Switchboard, sections', { ns: 'editor' }), SquareStack, t('electrical.1600A3SectionsSetTheCountInItsProperties', '1600 A, 3 sections (set the count in its properties)', { ns: 'editor' }), ['msb', t('electrical.mainSwitchboard', 'main switchboard', { ns: 'editor' }), 'sections']),
        ],
        testId: 'ribbon-electrical-panel',
      },
      placeCommand(e, 'transformer', 'Transformer', Zap, 'A 75 kVA dry-type transformer, 480 V to 208Y/120 V: feed it from a 480 V breaker, then feed a 208 V panel from it', ['step down', 'xfmr', 'kva']),
      {
        id: 'place-equipment',
        label: t('electrical.placeEquipment', 'Equipment', { ns: 'editor' }),
        icon: Factory,
        description: t('electrical.placeEquipmentWhy', 'Place a generator, transfer switch, meter and CT cabinet, tap box, disconnect or another transformer size', { ns: 'editor' }),
        keywords: ['generator', 'ats', t('electrical.keyword.transferswitch', 'transfer switch', { ns: 'editor' }), 'meter', t('electrical.keyword.ctcabinet', 'ct cabinet', { ns: 'editor' }), t('electrical.keyword.tapbox', 'tap box', { ns: 'editor' }), 'disconnect', t('electrical.keyword.safetyswitch', 'safety switch', { ns: 'editor' })],
        disabledReason: e.placeBlocked,
        children: [
          placeCommand(e, 'generator', 'Generator', Power, '150 kW diesel, 480Y/277 V: feed a transfer switch’s emergency side from it', ['genset', 'standby', 'emergency']),
          placeCommand(e, 'ats', t('electrical.transferSwitch', 'Transfer switch', { ns: 'editor' }), Repeat, t('electrical.400A4PoleFedOnItsNormalSideByABreakerAndOnIt', '400 A, 4-pole: fed on its normal side by a breaker and on its emergency side by a generator', { ns: 'editor' }), ['ats', t('electrical.automaticTransfer', 'automatic transfer', { ns: 'editor' })]),
          placeCommand(e, 'meter', t('electrical.meterAndCTCabinet', 'Meter and CT cabinet', { ns: 'editor' }), Gauge, '800 A, 480Y/277 V: between the utility and the main switchboard', ['ct', t('electrical.utilityMeter', 'utility meter', { ns: 'editor' }), 'service']),
          placeCommand(e, 'tap_box', t('electrical.tapBox', 'Tap box', { ns: 'editor' }), Gauge, '1200 A, 480Y/277 V, no breakers: feeders tap off the service here', [t('electrical.tapCan', 'tap can', { ns: 'editor' }), 'wireway', 'gutter', 'service', t('electrical.firePump', 'fire pump', { ns: 'editor' })]),
          placeCommand(e, 'disconnect_nf_30', t('electrical.disconnectNonFused30A', 'Disconnect, non-fused 30 A', { ns: 'editor' }), Unplug, t('electrical.nema3RForRooftopEquipment', 'NEMA 3R, for rooftop equipment', { ns: 'editor' }), [t('electrical.safetySwitch', 'safety switch', { ns: 'editor' }), 'nf', 'rooftop']),
          placeCommand(e, 'disconnect_nf_60', t('electrical.disconnectNonFused60A', 'Disconnect, non-fused 60 A', { ns: 'editor' }), Unplug, 'NEMA 1', [t('electrical.safetySwitch', 'safety switch', { ns: 'editor' }), 'nf']),
          placeCommand(e, 'disconnect_fused_60', t('electrical.disconnectFused60A', 'Disconnect, fused 60 A', { ns: 'editor' }), Unplug, '40 A fuses, NEMA 1', [t('electrical.safetySwitch', 'safety switch', { ns: 'editor' }), 'fused']),
          placeCommand(e, 'disconnect_fused_100', t('electrical.disconnectFused100A', 'Disconnect, fused 100 A', { ns: 'editor' }), Unplug, t('electrical.80AFusesNEMA3R', '80 A fuses, NEMA 3R', { ns: 'editor' }), [t('electrical.safetySwitch', 'safety switch', { ns: 'editor' }), 'fused']),
          placeCommand(e, 'transformer_45', t('electrical.transformer45KVA', 'Transformer 45 kVA', { ns: 'editor' }), Zap, '480 V to 208Y/120 V', ['xfmr']),
          placeCommand(e, 'transformer_112', t('electrical.transformer1125KVA', 'Transformer 112.5 kVA', { ns: 'editor' }), Zap, '480 V to 208Y/120 V', ['xfmr']),
        ],
        testId: 'ribbon-electrical-equipment',
      },
    ],
  }
}

function circuitCommands(e: ElectricalRibbon, t: Translate): RibbonCommand[] {
  const onCircuit = (e.selection?.circuited ?? 0) > 0
  return [
    {
      id: 'add-to-circuit',
      label: onCircuit && e.selection?.loads === e.selection?.circuited ? t('electrical.changeCircuit', 'Change circuit', { ns: 'editor' }) : t('electrical.addToCircuit', 'Add to circuit', { ns: 'editor' }),
      icon: Cable,
      description: t('electrical.addToCircuitWhy', 'Put what you selected on a circuit: pick the panel, and the free slots that best balance its phases are chosen for you', { ns: 'editor' }),
      keywords: ['circuit', t('electrical.keyword.homerun', 'home run', { ns: 'editor' }), t('electrical.keyword.branchcircuit', 'branch circuit', { ns: 'editor' }), 'assign', 'panel'],
      disabledReason: e.addBlocked,
      run: e.addToCircuit,
      testId: 'ribbon-electrical-add-to-circuit',
    },
    {
      id: 'edit-circuit',
      label: t('electrical.editCircuit', 'Edit circuit', { ns: 'editor' }),
      icon: Waypoints,
      description: t('electrical.editCircuitWhy', 'Change the selected device’s circuit: its slots, breaker, wire and what is on it', { ns: 'editor' }),
      keywords: ['breaker', 'wire', 'slot', t('electrical.keyword.movecircuit', 'move circuit', { ns: 'editor' }), t('electrical.keyword.removedevice', 'remove device', { ns: 'editor' })],
      disabledReason: e.editBlocked,
      run: e.editCircuit,
      testId: 'ribbon-electrical-edit-circuit',
    },
    {
      id: 'feed-panel',
      label: t('electrical.feedPanel', 'Feed panel', { ns: 'editor' }),
      icon: Unplug,
      description: t('electrical.feedTheSelectedPanelOrTransformerFromAB', 'Feed the selected panel or transformer from a breaker in another panel or switchboard', { ns: 'editor' }),
      keywords: ['feeder', t('electrical.keyword.supplyfrom', 'supply from', { ns: 'editor' }), t('electrical.keyword.fedfrom', 'fed from', { ns: 'editor' }), 'sub-feed', 'transformer'],
      disabledReason: e.feedBlocked,
      run: e.feedPanel,
      testId: 'ribbon-electrical-feed-panel',
    },
  ]
}

function continueCircuitCommand(a: ElectricalAction, t: Translate): RibbonCommand {
  return {
    id: 'continue-circuit',
    label: t('electrical.continueCircuit', 'Continue circuit', { ns: 'editor' }),
    icon: Repeat,
    description: t('electrical.continueCircuitWhy', 'Pick a panel and a circuit (or a new one), then every device you place joins it; Esc or Stop ends it', { ns: 'editor' }),
    keywords: [t('electrical.keyword.keepadding', 'keep adding', { ns: 'editor' }), t('electrical.keyword.circuitwhileplacing', 'circuit while placing', { ns: 'editor' }), t('electrical.keyword.daisychain', 'daisy chain', { ns: 'editor' }), t('electrical.keyword.homerun', 'home run', { ns: 'editor' }), t('electrical.keyword.placeoncircuit', 'place on circuit', { ns: 'editor' })],
    disabledReason: a.blocked,
    run: a.run,
    testId: 'ribbon-electrical-continue-circuit',
  }
}

function diagramsGroup(d: NonNullable<ElectricalRibbon['diagram']>, t: Translate): RibbonGroup {
  return {
    id: 'electrical-diagrams',
    label: t('electrical.electricalDiagrams', 'Diagrams', { ns: 'editor' }),
    commands: [
      {
        id: 'one-line-diagram',
        label: t('electrical.oneLineDiagramWhy', 'One-line diagram', { ns: 'editor' }),
        icon: Network,
        description: t('electrical.oneLineDiagramWhy_265', 'The live one-line, drawn from your panels and feeders and redrawn whenever they change; place it on a sheet like any view', { ns: 'editor' }),
        keywords: [
          t('electrical.keyword.singleline', 'single line', { ns: 'editor' }),
          'sld',
          t('electrical.keyword.oneline', 'one line', { ns: 'editor' }),
          'riser',
          'distribution',
          'feeder',
        ],
        disabledReason: d.blocked,
        run: () => d.open('one_line'),
        testId: 'ribbon-electrical-one-line',
      },
      { id: 'electrical-riser', label: t('electrical.electricalRiserWhy', 'Riser diagram', { ns: 'editor' }), icon: Network, description: t('electrical.electricalRiserWhy_266', 'The live electrical riser: the same equipment and feeders drawn floor by floor', { ns: 'editor' }), keywords: ['riser', 'vertical', 'floors'], disabledReason: d.blocked, run: () => d.open('electrical_riser'), testId: 'ribbon-electrical-riser' },
    ],
  }
}

/** Electrical: on every project's Building Model, whether or not anything electrical is in it yet. Same pattern as every trade's tab (ribbon/trade-tab.ts). */
export function electricalTab(e: ElectricalRibbon, select: RibbonGroup, t: Translate = englishOnly): RibbonTab {
  return tradeTab({
    id: 'electrical',
    label: t('electrical.electrical', 'Electrical', { ns: 'editor' }),
    select,
    create: [placeGroup(e, t)],
    connect: { id: 'electrical-circuit', label: t('electrical.electricalCircuit', 'Circuits', { ns: 'editor' }), commands: [...circuitCommands(e, t), ...(e.continueCircuit ? [continueCircuitCommand(e.continueCircuit, t)] : [])] },
    analyze: {
      id: 'electrical-panels',
      label: t('electrical.electricalPanels', 'Panels', { ns: 'editor' }),
      commands: [
        {
          id: 'panel-view',
          label: t('electrical.panelView', 'Panel view', { ns: 'editor' }),
          icon: CircleDot,
          description: t('electrical.panelViewWhy', 'The live panel schedule: every slot, its circuit, breaker and load by phase', { ns: 'editor' }),
          keywords: [t('electrical.keyword.panelschedule', 'panel schedule', { ns: 'editor' }), 'slots', 'breakers', 'loads'],
          disabledReason: e.panelViewBlocked,
          run: e.openPanelView,
          testId: 'ribbon-electrical-panel-view',
          // One entry per docked record opens its schedule beside the plan.
          ...(e.docked && e.docked.list.length > 0 ? { split: true, children: dockChildren(e.docked.addon, e.docked.dock, CircleDot, e.docked.list, e.docked.open) } : {}),
        },
        ...(e.check ? [{ id: 'electrical-check', label: t('electrical.electricalCheckWhy', 'Check', { ns: 'editor' }), icon: ClipboardCheck, description: t('electrical.electricalCheckWhy_295', 'What needs attention: devices on no circuit, voltage mismatches, overloaded or unbalanced panels', { ns: 'editor' }), keywords: ['findings', 'errors', 'uncircuited', 'overloaded', 'unbalanced', 'audit'], disabledReason: e.check.blocked, run: e.check.run, testId: 'ribbon-electrical-check' }] : []),
        ...(e.balance ? [{ id: 'electrical-balance', label: t('electrical.electricalBalanceWhy', 'Balance phases', { ns: 'editor' }), icon: Scale, description: t('electrical.electricalBalanceWhy_296', 'Suggest slot moves that even out the load on A, B and C; you choose which to apply', { ns: 'editor' }), keywords: ['rebalance', 'phase balance', 'load balance'], disabledReason: e.balance.blocked, run: e.balance.run, testId: 'ribbon-electrical-balance' }] : []),
      ],
    },
    design: {
      id: 'electrical-design',
      label: t('electrical.electricalDesign', 'Design', { ns: 'editor' }),
      commands: [
        ...(e.types ? [{ id: 'electrical-types', label: t('electrical.electricalTypesWhy', 'Electrical types', { ns: 'editor' }), icon: Library, description: t('electrical.electricalTypesWhy_303', 'Connection types (E.05: load, voltage, poles, class), feeder types (F225: breaker, conductors, conduit) and room templates', { ns: 'editor' }), keywords: ['connection type', 'feeder type', 'feeder schedule', 'designator', 'catalog', 'f225'], disabledReason: e.types.blocked, run: e.types.run, testId: 'ribbon-electrical-types' }] : []),
        ...(e.propose ? [{ id: 'electrical-propose', label: t('electrical.electricalProposeWhy', 'Propose receptacles', { ns: 'editor' }), icon: LayoutGrid, description: t('electrical.electricalProposeWhy_304', 'Pick rooms and a receptacle type: see where NEC 210.52 spacing (or a light, medium or heavy density) puts them, then accept all or some. Nothing is circuited', { ns: 'editor' }), keywords: ['receptacle layout', '210.52', 'outlet spacing', 'suggest receptacles', 'density', 'dwelling'], disabledReason: e.propose.blocked, run: e.propose.run, testId: 'ribbon-electrical-propose' }] : []),
        ...(e.serviceSize ? [{ id: 'electrical-service-size', label: t('electrical.electricalServiceSizeWhy', 'Service size', { ns: 'editor' }), icon: Gauge, description: t('electrical.electricalServiceSizeWhy_305', 'Paste the kitchen and mechanical equipment lists: confirm each load class and get the NEC Article 220 service size with its trail, before any layout', { ns: 'editor' }), keywords: ['service', 'load calc', 'equipment list', 'kitchen schedule', 'article 220', 'utility'], disabledReason: e.serviceSize.blocked, run: e.serviceSize.run, testId: 'ribbon-electrical-service-size' }] : []),
        ...(e.serviceLayout
          ? [
              {
                id: 'electrical-service-layout',
                label: t('electrical.electricalServiceLayoutWhy', 'Service layout', { ns: 'editor' }),
                icon: Network,
                description: t(
                  'electrical.electricalServiceLayoutWhy_308',
                  'From a service size (400 A 120/208 V): place the meter, main, main distribution and the panels you list, each fed from what you pick, as one edit; the one-line then shows it',
                  { ns: 'editor' },
                ),
                keywords: [
                  t('electrical.keyword.onelineskeleton', 'one-line skeleton', { ns: 'editor' }),
                  t('electrical.keyword.serviceentrance', 'service entrance', { ns: 'editor' }),
                  'mdp',
                  t('electrical.keyword.maindistribution', 'main distribution', { ns: 'editor' }),
                  t('electrical.keyword.starterlayout', 'starter layout', { ns: 'editor' }),
                  'riser',
                  t('electrical.keyword.singleline', 'single line', { ns: 'editor' }),
                ],
                disabledReason: e.serviceLayout.blocked,
                run: e.serviceLayout.run,
                testId: 'ribbon-electrical-service-layout',
              },
            ]
          : []),
        ...(e.templates ? [{ id: 'electrical-templates', label: t('electrical.electricalTemplatesWhy', 'Room templates', { ns: 'editor' }), icon: SquareStack, description: t('electrical.electricalTemplatesWhy_307', 'Your firm’s circuit conventions (bedroom on circuit 1, living room on 2…), applied to the units you pick', { ns: 'editor' }), keywords: ['template', 'dwelling', 'unit', 'convention', 'multifamily'], disabledReason: e.templates.blocked, run: e.templates.run, testId: 'ribbon-electrical-templates' }] : []),
      ],
    },
    documents: [e.schedules ? schedulesGroup(e.schedules, t) : null, e.diagram ? diagramsGroup(e.diagram, t) : null],
  }, t)
}

/** Circuit: opens by itself when something electrical is selected. Null when nothing is. */
export function circuitTab(e: ElectricalRibbon, select: RibbonGroup, t: Translate = englishOnly): RibbonTab | null {
  const sel = e.selection
  if (!sel) return null
  return {
    id: 'circuit',
    label: t('electrical.circuit', 'Circuit', { ns: 'editor' }),
    contextual: true,
    groups: [
      select,
      {
        id: 'circuit',
        label: sel.label,
        commands: [
          ...circuitCommands(e, t),
          { id: 'remove-from-circuit', label: t('electrical.removeFromCircuitWhy', 'Take off circuit', { ns: 'editor' }), icon: X, description: t('electrical.removeFromCircuitWhy_329', 'Take the selected devices off their circuits; the circuit stays as a spare if nothing is left on it', { ns: 'editor' }), keywords: ['remove', 'unassign', 'disconnect'], disabledReason: e.removeBlocked, run: e.removeFromCircuit, testId: 'ribbon-electrical-remove-from-circuit' },
          { id: 'circuit-panel-view', label: t('electrical.circuitPanelViewWhy', 'Panel view', { ns: 'editor' }), icon: CircleDot, description: t('electrical.circuitPanelViewWhy_330', 'Open the panel schedule of the selected panel, or of the panel the selected device is on', { ns: 'editor' }), disabledReason: e.panelViewBlocked, run: e.openPanelView, testId: 'ribbon-circuit-panel-view' },
        ],
      },
    ],
  }
}

const NOTHING = (): void => undefined

/** The Electrical and Circuit tabs while the electrical tools load (or failed): every command off, saying why. */
export function waitingRibbon(reason: string): ElectricalRibbon {
  return {
    place: NOTHING,
    placeBlocked: reason,
    addToCircuit: NOTHING,
    addBlocked: reason,
    editCircuit: NOTHING,
    editBlocked: reason,
    removeFromCircuit: NOTHING,
    removeBlocked: reason,
    feedPanel: NOTHING,
    feedBlocked: reason,
    openPanelView: NOTHING,
    panelViewBlocked: reason,
    selection: null,
  }
}

/** This add-on's tabs by the ids in its `ADDON_UI` (`tabsFrom`). */
export const TABS = { electrical: electricalTab, circuit: circuitTab }
