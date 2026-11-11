'use client'

import { useState } from 'react'
import {
  COMMON_INSULATION_THICKNESS_IN,
  ductAirway,
  ductOuterSize,
  insulationLabel,
  linerSurface,
  sameInsulation,
  sameSize,
  sizeLabel,
  type Command,
  type DuctInsulation,
  type LinerSurface,
  type ModelState,
  type RunFitting,
  type RunSegment,
  type RunSize,
} from '@permitzip/bim-kernel'
import {
  ductPerformance,
  sizingCriteriaFor,
  suggestDuctSize,
} from '@permitzip/bim-pack-mechanical'
import { Button } from '../../ui/button'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Separator } from '../../ui/separator'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import { MM_PER_IN } from '../placement'
import { useEditorTranslate } from '../i18n/translate'

type Kind = 'none' | 'wrap' | 'liner'
type Scope = 'piece' | 'run' | 'system'

const inches = (mm: number) => String(Math.round((mm / MM_PER_IN) * 1000) / 1000)

interface Props {
  element: RunSegment | RunFitting
  model: ModelState
  canEdit: boolean
  onCommand: (command: Command) => string | null
  onResize: (segmentId: string, size: RunSize) => string | null
}

/** Duct pieces: insulation or liner (with what it does to the inside and outside size), and a size from the airflow the piece carries. */
export function RunDuctDesign({ element: el, model, canEdit, onCommand, onResize }: Props) {
  if (el.domain !== 'duct') return null
  return <DuctDesignForm key={`${el.id}:${el.version}`} element={el} model={model} canEdit={canEdit} onCommand={onCommand} onResize={onResize} />
}

function DuctDesignForm({ element: el, model, canEdit, onCommand, onResize }: Props) {
  const t = useEditorTranslate()
  const notLive = t('ventilation.notLive', "Live editing isn't connected, so changes can't be saved", { ns: 'editor' })
  const noInsulation = t('ventilation.noInsulationKernel', 'No insulation', { ns: 'editor' })
  const noneLower = t('ventilation.insulationNoneLower', 'none', { ns: 'editor' })
  const system = model.elements[el.systemId]
  const mep = system?.kind === 'mep_system' ? system : null
  const current = el.insulation
  const [kind, setKind] = useState<Kind>(current?.kind ?? 'none')
  const [thicknessIn, setThicknessIn] = useState(current ? inches(current.thicknessMm) : '1')
  const [surface, setSurface] = useState<LinerSurface>(linerSurface(current) ?? 'faced')
  const [scope, setScope] = useState<Scope>('run')
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)
  const chosen: DuctInsulation | undefined = kind === 'none' ? undefined : { kind, thicknessMm: Math.round(Number(thicknessIn) * MM_PER_IN * 1000) / 1000, ...(kind === 'liner' && surface === 'spray_coated' ? { surface } : {}) }
  const size = el.kind === 'run_segment' ? el.size : el.ports[0]?.size
  const thicknessOptions = [...new Set([...COMMON_INSULATION_THICKNESS_IN.map(String), thicknessIn])]

  const rows: [string, string][] = [['Insulation', insulationLabel(current)]]
  if (current && size) rows.push(['Inside', sizeLabel(ductAirway(size, current))], ['Outside', sizeLabel(ductOuterSize(size, current))])

  const report = (err: string | null, ok: string) => setMessage(err ? { error: true, text: err } : { error: false, text: ok })
  const apply = () =>
    report(onCommand({ type: 'set_run_insulation', elementId: el.id, insulation: chosen ?? null, scope }), t('ventilation.undo.insulationApplied', '{{insulation}} applied.', { ns: 'editor', insulation: insulationLabel(chosen) }))
  const isDefault = sameInsulation(mep?.design?.insulation, chosen)
  const makeDefault = () =>
    mep &&
    report(
      onCommand({ type: 'set_system_design', systemId: mep.id, design: { insulation: chosen ?? null } }),
      t('ventilation.undo.newRunsGet', 'New {{system}} runs get {{insulation}}.', { ns: 'editor', system: mep.name, insulation: insulationLabel(chosen).toLowerCase() }),
    )

  // A size from what the segment carries (airflow is derived from the air devices it reaches).
  const seg = el.kind === 'run_segment' ? el : null
  const perf = seg && seg.flow > 0 ? ductPerformance(seg.flow, seg.size, current, mep?.design) : null
  const criteria = mep ? sizingCriteriaFor(mep.systemKind, mep.design) : null
  const shape = seg?.size.shape === 'round' ? 'round' : seg?.size.shape === 'rect' ? 'rect' : null
  const suggestion = seg && perf && criteria && shape ? suggestDuctSize({ cfm: seg.flow, shape, criteria, ...(current ? { insulation: current } : {}), ...(mep?.design ? { design: mep.design } : {}), ...(seg.size.shape === 'rect' ? { holdHeightMm: seg.size.height } : {}) }) : null
  const suggested = suggestion?.ok ? (suggestion.atHeight ?? suggestion.best) : null

  return (
    <div className="flex flex-col gap-2" data-testid="run-duct-design">
      <Separator />
      <ItemGroup className="gap-1">
        {rows.map(([k, v]) => (
          <Item key={k} size="sm">
            <ItemContent>
              <ItemDescription className="text-xs">{k}</ItemDescription>
              <ItemTitle className="text-xs font-normal">{v}</ItemTitle>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
      <Field>
        <FieldLabel htmlFor="bm-run-insulation">{t('ventilation.changeInsulation', 'Change insulation', { ns: 'editor' })}</FieldLabel>
        <div className="flex items-center gap-2">
          <ToggleGroup id="bm-run-insulation" type="single" variant="outline" size="sm" value={kind} onValueChange={(v) => (v === 'none' || v === 'wrap' || v === 'liner') && setKind(v)} aria-label={t('ventilation.insulation', 'Insulation', { ns: 'editor' })} disabled={!canEdit}>
            <ToggleGroupItem value="none">{t('ventilation.insulationNone', 'None', { ns: 'editor' })}</ToggleGroupItem>
            <ToggleGroupItem value="wrap">{t('ventilation.insulationWrap', 'Wrap', { ns: 'editor' })}</ToggleGroupItem>
            <ToggleGroupItem value="liner">{t('ventilation.insulationLiner', 'Liner', { ns: 'editor' })}</ToggleGroupItem>
          </ToggleGroup>
          <Select value={thicknessIn} onValueChange={setThicknessIn} disabled={!canEdit || kind === 'none'}>
            <SelectTrigger size="sm" aria-label={t('ventilation.insulationThickness', 'Insulation thickness', { ns: 'editor' })}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {thicknessOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace('.5', '½')}&quot;
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        {kind === 'liner' && (
          <ToggleGroup type="single" variant="outline" size="sm" value={surface} onValueChange={(v) => (v === 'faced' || v === 'spray_coated') && setSurface(v)} aria-label={t('ventilation.linerSurface', 'Liner surface', { ns: 'editor' })} disabled={!canEdit} data-testid="run-liner-surface">
            <ToggleGroupItem value="faced">{t('ventilation.linerFaced', 'Faced', { ns: 'editor' })}</ToggleGroupItem>
            <ToggleGroupItem value="spray_coated">{t('ventilation.linerSprayCoated', 'Spray-coated', { ns: 'editor' })}</ToggleGroupItem>
          </ToggleGroup>
        )}
        <ToggleGroup type="single" variant="outline" size="sm" value={scope} onValueChange={(v) => (v === 'piece' || v === 'run' || v === 'system') && setScope(v)} aria-label={t('ventilation.applyTo', 'Apply to', { ns: 'editor' })} disabled={!canEdit}>
          <ToggleGroupItem value="piece">{t('ventilation.scopePiece', 'This piece', { ns: 'editor' })}</ToggleGroupItem>
          <ToggleGroupItem value="run">{t('ventilation.scopeRun', 'This run', { ns: 'editor' })}</ToggleGroupItem>
          <ToggleGroupItem value="system">{t('ventilation.scopeSystem', 'Whole system', { ns: 'editor' })}</ToggleGroupItem>
        </ToggleGroup>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" onClick={apply} disabled={!canEdit} title={canEdit ? undefined : notLive} data-testid="run-insulation-apply">
            {t('ventilation.apply', 'Apply', { ns: 'editor' })}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={makeDefault}
            disabled={!canEdit || !mep || isDefault}
            title={!canEdit ? notLive : isDefault ? t('ventilation.alreadySystemDefault', 'This is already {{system}}’s default', { ns: 'editor', system: mep?.name ?? t('ventilation.theSystem', 'the system', { ns: 'editor' }) }) : undefined}
            data-testid="run-insulation-default"
          >
            {t('ventilation.makeSystemDefault', 'Make system default', { ns: 'editor' })}
          </Button>
        </div>
        {message && (
          <FieldDescription className={message.error ? 'text-danger-600' : 'text-success-700'} role={message.error ? 'alert' : 'status'} data-testid="run-insulation-message">
            {message.text}
          </FieldDescription>
        )}
        <FieldDescription>
          {t('ventilation.runStopsAt', 'A run stops at transitions and branches. Fittings take the insulation of the duct they join.', { ns: 'editor' })}{' '}
          {mep
            ? t('ventilation.systemDefault', '{{who}}’s default: {{value}}.', {
                ns: 'editor',
                who: mep.name,
                value: insulationLabel(mep.design?.insulation).replace(noInsulation, noneLower),
              })
            : ''}
        </FieldDescription>
      </Field>
      {seg && perf && (
        <Field data-testid="run-airflow-sizing">
          <FieldLabel>{t('ventilation.airflow', 'Airflow', { ns: 'editor' })}</FieldLabel>
          <FieldDescription>
            {t('ventilation.carries', 'Carries {{cfm}} CFM: {{fpm}} fpm, {{friction}}” per 100 ft{{through}}.', {
              ns: 'editor',
              cfm: Math.round(seg.flow).toLocaleString('en-US'),
              fpm: Math.round(perf.velocityFpm).toLocaleString('en-US'),
              friction: Math.round(perf.frictionInPer100Ft * 1000) / 1000,
              through: current?.kind === 'liner' ? t('ventilation.throughInside', ' through {{size}} inside', { ns: 'editor', size: sizeLabel(perf.airway) }) : '',
            })}
          </FieldDescription>
          {suggestion && !suggestion.ok && <FieldDescription className="text-danger-600">{suggestion.reason}.</FieldDescription>}
          {suggested && !sameSize(suggested.size, seg.size) && (
            <Button
              size="sm"
              variant="outline"
              disabled={!canEdit}
              title={canEdit ? undefined : notLive}
              onClick={() => report(onResize(seg.id, suggested.size), t('ventilation.undo.resizedTo', 'Resized to {{size}}.', { ns: 'editor', size: sizeLabel(suggested.size) }))}
              data-testid="run-size-accept"
            >
              {t('ventilation.resizeTo', 'Resize to {{size}} ({{fpm}} fpm, {{friction}}”)', {
                ns: 'editor',
                size: sizeLabel(suggested.size),
                fpm: Math.round(suggested.velocityFpm).toLocaleString('en-US'),
                friction: Math.round(suggested.frictionInPer100Ft * 1000) / 1000,
              })}
            </Button>
          )}
          {suggested && sameSize(suggested.size, seg.size) && (
            <FieldDescription>{t('ventilation.sizeItsAirflowCallsFor', 'This is the size its airflow calls for.', { ns: 'editor' })}</FieldDescription>
          )}
        </Field>
      )}
    </div>
  )
}
