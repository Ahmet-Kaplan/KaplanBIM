'use client'

import { useMemo, useState } from 'react'
import { CircleAlert, RotateCcw } from 'lucide-react'
import {
  SYSTEM_LINE_PATTERNS,
  SYSTEM_LINE_WEIGHTS,
  elementsOfKind,
  serviceLabel,
  systemStyle,
  type Command,
  type MepSystem,
  type ModelState,
  type PipeSizingMode,
  type SystemLinePattern,
  type SystemLineWeight,
} from '@permitzip/bim-kernel'
import { PLUMBING_BUILDING_TYPES, PLUMBING_DEMAND_CURVES, type PlumbingBuildingType, type PlumbingDemandCurve, type PipeInsulationRow, type PlumbingSettingsEntry, gasFuelOf, projectPlumbingSettings } from '@permitzip/bim-pack-plumbing'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../../ui/empty'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Switch } from '../../ui/switch'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { useEditorTranslate } from '../i18n/translate'
import type { SubmitCommand } from '../views-sheets/types'
import { PipeInsulationSchedule } from './PipeInsulationSchedule'
import { buildingTypeWord, demandCurveWord, gasFuelWord, linePatternWord, lineWeightWord } from './plumbing-words'

export type PlumbingSystemsTab = 'systems' | 'project' | 'insulation'

interface Props {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly tab: PlumbingSystemsTab
  readonly model: ModelState
  readonly editBlocked: string | null
  readonly submit: SubmitCommand
}

const PROJECT = '__project'
const BY_BUILDING = '__building'

/** The pipe systems in the model, by name. */
export function pipeSystems(model: Pick<ModelState, 'elements'>): readonly MepSystem[] {
  return elementsOfKind(model.elements, 'mep_system')
    .filter((s) => s.domain === 'pipe')
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The command that saves the project's plumbing settings with `patch` applied. */
export function projectSettingsCommand(
  current: PlumbingSettingsEntry,
  patch: { readonly sizingMode?: PipeSizingMode; readonly buildingType?: PlumbingBuildingType | null; readonly demandCurve?: PlumbingDemandCurve | null; readonly pipeInsulation?: readonly PipeInsulationRow[] | null; readonly pipeInsulationSource?: string | null },
): Command {
  const buildingType = patch.buildingType === undefined ? current.buildingType : (patch.buildingType ?? undefined)
  const demandCurve = patch.demandCurve === undefined ? current.demandCurve : (patch.demandCurve ?? undefined)
  const pipeInsulation = patch.pipeInsulation === undefined ? current.pipeInsulation : (patch.pipeInsulation ?? undefined)
  const pipeInsulationSource = patch.pipeInsulationSource === undefined ? current.pipeInsulationSource : (patch.pipeInsulationSource ?? undefined)
  return {
    type: 'save_catalog_entry',
    entry: {
      type: 'plumbing_settings',
      name: 'Project',
      sizingMode: patch.sizingMode ?? current.sizingMode,
      ...(buildingType ? { buildingType } : {}),
      ...(demandCurve ? { demandCurve } : {}),
      ...(pipeInsulation && pipeInsulation.length > 0 ? { pipeInsulation: [...pipeInsulation] } : {}),
      ...(pipeInsulationSource ? { pipeInsulationSource } : {}),
    },
  }
}

/** Plumbing › Systems: each pipe system's look and sizing, and the project's auto-sizing and demand curve. */
export function PlumbingSystemsDialog({ open, onOpenChange, tab, model, editBlocked, submit }: Props) {
  const t = useEditorTranslate()
  const [current, setCurrent] = useState<PlumbingSystemsTab>(tab)
  const [error, setError] = useState<string | null>(null)
  const systems = useMemo(() => pipeSystems(model), [model])
  const settings = projectPlumbingSettings(model.elements)
  const send = (command: Command, label: string) => setError(submit(command, label))
  const canEdit = editBlocked === null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" data-testid="plumbing-systems-dialog">
        <DialogHeader>
          <DialogTitle>{t('plumbing.plumbingSystems', 'Plumbing systems', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>{t('plumbing.plumbingSystemsWhy', 'How each pipe system looks on screen and in print, and whether pipe sizes are only checked or applied as you model.', { ns: 'editor' })}</DialogDescription>
        </DialogHeader>
        {editBlocked && (
          <Alert>
            <CircleAlert />
            <AlertTitle>{t('plumbing.viewOnly', 'View only', { ns: 'editor' })}</AlertTitle>
            <AlertDescription>{editBlocked}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive" data-testid="plumbing-systems-error">
            <CircleAlert />
            <AlertTitle>{t('plumbing.notSaved', 'Not saved', { ns: 'editor' })}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Tabs value={current} onValueChange={(v) => (v === 'systems' || v === 'project' || v === 'insulation') && setCurrent(v)}>
          <TabsList>
            <TabsTrigger value="systems">{t('plumbing.systems', 'Systems', { ns: 'editor' })}</TabsTrigger>
            <TabsTrigger value="project">{t('plumbing.project', 'Project', { ns: 'editor' })}</TabsTrigger>
            <TabsTrigger value="insulation" data-testid="plumbing-insulation-tab">
              {t('plumbing.insulation', 'Insulation', { ns: 'editor' })}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="systems">
            {systems.length === 0 ? (
              <Empty className="border py-4">
                <EmptyHeader>
                  <EmptyTitle>{t('plumbing.noPipeSystemsYet', 'No pipe systems yet', { ns: 'editor' })}</EmptyTitle>
                  <EmptyDescription>{t('plumbing.noPipeSystemsYetWhy', 'Route pipe (Plumbing › Route pipe) and its system appears here, with its standard look: cold water blue dash-dot, vent dashed, gas long dash.', { ns: 'editor' })}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table data-testid="plumbing-systems-table">
                <TableCaption className="sr-only">{t('plumbing.pipeSystems', 'Pipe systems', { ns: 'editor' })}</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('plumbing.system', 'System', { ns: 'editor' })}</TableHead>
                    <TableHead>{t('plumbing.colour', 'Colour', { ns: 'editor' })}</TableHead>
                    <TableHead>{t('plumbing.lines', 'Lines', { ns: 'editor' })}</TableHead>
                    <TableHead>{t('plumbing.weight', 'Weight', { ns: 'editor' })}</TableHead>
                    <TableHead>{t('plumbing.autoSize', 'Auto-size', { ns: 'editor' })}</TableHead>
                    <TableHead>
                      <span className="sr-only">{t('plumbing.standardLook', 'Standard look', { ns: 'editor' })}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {systems.map((s) => (
                    <SystemRow key={s.id} system={s} projectMode={settings.sizingMode} canEdit={canEdit} send={send} />
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
          <TabsContent value="project">
            <FieldGroup>
              <Field orientation="horizontal">
                <Switch
                  id="plumbing-auto-size"
                  checked={settings.sizingMode === 'auto'}
                  disabled={!canEdit}
                  onCheckedChange={(on) =>
                    send(
                      projectSettingsCommand(settings, { sizingMode: on ? 'auto' : 'check' }),
                      on ? t('plumbing.turnAutoSizingOn', 'turn auto-sizing on', { ns: 'editor' }) : t('plumbing.turnAutoSizingOff', 'turn auto-sizing off', { ns: 'editor' }),
                    )
                  }
                  data-testid="plumbing-project-auto-size"
                />
                <FieldLabel htmlFor="plumbing-auto-size">{t('plumbing.autoSizePipes', 'Auto-size pipes', { ns: 'editor' })}</FieldLabel>
                <FieldDescription>
                  {settings.sizingMode === 'auto'
                    ? t('plumbing.autoSizeOnProject', 'On: suggested sizes apply as you model, except on systems set to check.', { ns: 'editor' })
                    : t('plumbing.autoSizeOffProject', 'Off: every pipe is checked and sizes are suggested; nothing changes until you accept.', { ns: 'editor' })}
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="plumbing-building-type">{t('plumbing.buildingType', 'Building type', { ns: 'editor' })}</FieldLabel>
                <Select
                  value={settings.buildingType ?? ''}
                  disabled={!canEdit}
                  onValueChange={(v) =>
                    (PLUMBING_BUILDING_TYPES as readonly string[]).includes(v) &&
                    send(projectSettingsCommand(settings, { buildingType: v as PlumbingBuildingType }), t('plumbing.setTheBuildingType', 'set the building type', { ns: 'editor' }))
                  }
                >
                  <SelectTrigger id="plumbing-building-type" size="sm" data-testid="plumbing-building-type">
                    <SelectValue placeholder={t('plumbing.chooseBuildingType', 'Choose (restaurant, office…)', { ns: 'editor' })} />
                  </SelectTrigger>
                  <SelectContent>
                    {PLUMBING_BUILDING_TYPES.map((b) => (
                      <SelectItem key={b} value={b}>
                        {buildingTypeWord(b, t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>{t('plumbing.buildingTypeWhy', 'Picks the demand curve unless you choose one: restaurant → ASHRAE Curve A, hospital or hotel → B, apartments → C, office or school → D.', { ns: 'editor' })}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="plumbing-demand-curve">{t('plumbing.demandCurve', 'Demand curve', { ns: 'editor' })}</FieldLabel>
                <Select
                  value={settings.demandCurve ?? BY_BUILDING}
                  disabled={!canEdit}
                  onValueChange={(v) => send(projectSettingsCommand(settings, { demandCurve: v === BY_BUILDING ? null : (v as PlumbingDemandCurve) }), t('plumbing.setTheDemandCurve', 'set the demand curve', { ns: 'editor' }))}
                >
                  <SelectTrigger id="plumbing-demand-curve" size="sm" data-testid="plumbing-project-demand-curve">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={BY_BUILDING}>{t('plumbing.fromTheBuildingTypeLabel', 'From the building type', { ns: 'editor' })}</SelectItem>
                    {PLUMBING_DEMAND_CURVES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {demandCurveWord(c, t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>{t('plumbing.demandCurveProjectWhy', 'How water supply fixture units become gpm when water pipes are sized. A system can use its own (Systems tab).', { ns: 'editor' })}</FieldDescription>
              </Field>
            </FieldGroup>
          </TabsContent>
          <TabsContent value="insulation">
            <PipeInsulationSchedule
              model={model}
              settings={settings}
              systems={systems}
              canEdit={canEdit}
              send={send}
              saveSchedule={(rows, label, source) => send(projectSettingsCommand(settings, { pipeInsulation: rows, ...(source !== undefined ? { pipeInsulationSource: source } : {}) }), label)}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

/** The standard look a system's dropdowns write, in the words of the request they send. */
function SystemRow({ system, projectMode, canEdit, send }: { system: MepSystem; projectMode: PipeSizingMode; canEdit: boolean; send: (command: Command, label: string) => void }) {
  const t = useEditorTranslate()
  const style = systemStyle(system)
  const own = system.design?.pipe?.sizingMode
  const graphics = (patch: { colour?: string | null; pattern?: SystemLinePattern | null; weight?: SystemLineWeight | null }, change: string) =>
    send({ type: 'set_system_graphics', systemId: system.id, ...patch }, t('plumbing.graphicsUndo', '{{change}} on {{system}}', { ns: 'editor', change, system: system.name }))
  const custom = style.overridden.colour || style.overridden.pattern || style.overridden.weight
  const fuel = gasFuelOf(system)
  return (
    <TableRow data-testid={`plumbing-system-${system.id}`}>
      <TableCell>
        <div className="font-medium">{system.name}</div>
        {fuel ? (
          <Select
            value={fuel}
            disabled={!canEdit}
            onValueChange={(v) => {
              if (v !== 'natural' && v !== 'propane') return
              send(
                { type: 'set_system_design', systemId: system.id, design: { pipe: { gasType: v } } },
                t('plumbing.setSystemFuel', 'set {{system}} to {{fuel}}', { ns: 'editor', system: system.name, fuel: gasFuelWord(v, t).toLocaleLowerCase() }),
              )
            }}
          >
            <SelectTrigger
              size="sm"
              className="mt-1"
              aria-label={t('plumbing.gasOn', 'Gas on {{system}}', { ns: 'editor', system: system.name })}
              title={t('plumbing.gasOnWhy', 'Sets the gas tables used to size this system and the word its labels, tags and schedules print', { ns: 'editor' })}
              data-testid="plumbing-system-fuel"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="natural">{gasFuelWord('natural', t)}</SelectItem>
              <SelectItem value="propane">{gasFuelWord('propane', t)}</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div className="text-xs text-muted-foreground">{serviceLabel(system.systemKind)}</div>
        )}
      </TableCell>
      <TableCell>
        <Input
          type="color"
          aria-label={t('plumbing.colourOf', 'Colour of {{system}}', { ns: 'editor', system: system.name })}
          className="h-8 w-12 p-1"
          value={style.colour}
          disabled={!canEdit}
          onChange={(e) => graphics({ colour: e.target.value }, t('plumbing.changeTheColour', 'change the colour', { ns: 'editor' }))}
          data-testid="plumbing-system-colour"
        />
      </TableCell>
      <TableCell>
        <Select
          value={style.pattern}
          disabled={!canEdit}
          onValueChange={(v) =>
            (SYSTEM_LINE_PATTERNS as readonly string[]).includes(v) && graphics({ pattern: v as SystemLinePattern }, t('plumbing.changeTheLinePattern', 'change the line pattern', { ns: 'editor' }))
          }
        >
          <SelectTrigger size="sm" aria-label={t('plumbing.linePatternOf', 'Line pattern of {{system}}', { ns: 'editor', system: system.name })} data-testid="plumbing-system-pattern">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SYSTEM_LINE_PATTERNS.map((p) => (
              <SelectItem key={p} value={p}>
                {linePatternWord(p, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={style.weight ?? 'standard'}
          disabled={!canEdit}
          onValueChange={(v) => graphics({ weight: v === 'standard' ? null : (v as SystemLineWeight) }, t('plumbing.changeTheLineWeight', 'change the line weight', { ns: 'editor' }))}
        >
          <SelectTrigger size="sm" aria-label={t('plumbing.lineWeightOf', 'Line weight of {{system}}', { ns: 'editor', system: system.name })} data-testid="plumbing-system-weight">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="standard">{t('plumbing.standard', 'Standard', { ns: 'editor' })}</SelectItem>
            {SYSTEM_LINE_WEIGHTS.map((w) => (
              <SelectItem key={w} value={w}>
                {lineWeightWord(w, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={own ?? PROJECT}
          disabled={!canEdit}
          onValueChange={(v) => {
            if (v !== PROJECT && v !== 'check' && v !== 'auto') return
            const sizingMode: PipeSizingMode | null = v === PROJECT ? null : v
            const design = { pipe: { sizingMode } }
            send({ type: 'set_system_design', systemId: system.id, design }, t('plumbing.autoSizeOf', 'auto-size {{system}}', { ns: 'editor', system: system.name }))
          }}
        >
          <SelectTrigger size="sm" aria-label={t('plumbing.autoSizeOf', 'auto-size {{system}}', { ns: 'editor', system: system.name })} data-testid="plumbing-system-sizing">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PROJECT}>
              {t('plumbing.asTheProject', 'As the project ({{state}})', {
                ns: 'editor',
                state: projectMode === 'auto' ? t('plumbing.onWord', 'on', { ns: 'editor' }) : t('plumbing.offWord', 'off', { ns: 'editor' }),
              })}
            </SelectItem>
            <SelectItem value="check">{t('plumbing.offCheckOnly', 'Off: check only', { ns: 'editor' })}</SelectItem>
            <SelectItem value="auto">{t('plumbing.onApplySizes', 'On: apply sizes', { ns: 'editor' })}</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('plumbing.standardLookOf', 'Standard look for {{system}}', { ns: 'editor', system: system.name })}
          title={
            custom
              ? t('plumbing.standardLookBack', 'Back to the standard look for this kind of system', { ns: 'editor' })
              : t('plumbing.standardLookAlready', 'Already the standard look', { ns: 'editor' })
          }
          disabled={!canEdit || !custom}
          onClick={() => graphics({ colour: null, pattern: null, weight: null }, t('plumbing.resetTheLook', 'reset the look', { ns: 'editor' }))}
        >
          <RotateCcw />
        </Button>
      </TableCell>
    </TableRow>
  )
}
