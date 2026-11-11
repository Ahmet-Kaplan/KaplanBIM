'use client'

import { useState } from 'react'
import {
  fittingFamilies,
  familyMismatch,
  type Command,
  type ModelState,
  type RunFitting,
  type RunSegment,
} from '@permitzip/bim-kernel'
import {
  PA_PER_IN_WC,
  PressureEngine,
  type FittingPressure,
  type SegmentPressure,
} from '../../contracts/building-model/air-pressure'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Separator } from '../../ui/separator'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'

/** One engine for the panel: a system's report is reused until one of its elements changes. */
const engine = new PressureEngine()

const wc = (pa: number) => `${(pa / PA_PER_IN_WC).toFixed(3)} in. w.c.`

interface Props {
  element: RunSegment | RunFitting
  model: ModelState
  canEdit: boolean
  actorName: string
  onCommand: (command: Command) => string | null
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
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
  )
}

/** Velocity, friction and loss for a routed duct piece; C with its source and an override for fittings; the system's fan pressure. */
export function RunPressure({ element: el, model, canEdit, actorName, onCommand }: Props) {
  const t = useEditorTranslate()
  if (el.domain !== 'duct') return null
  const report = engine.report(model, el.systemId, el.id)
  if (!report) return null
  if (!report.calculable) {
    return <FieldDescription data-testid="run-pressure-unavailable">{report.reason}</FieldDescription>
  }
  const mine = report.elements[el.id]
  return (
    <div className="flex flex-col gap-3" data-testid="run-pressure">
      <Separator />
      <span className="text-sm font-medium">{t('ventilation.pressure', 'Pressure', { ns: 'editor' })}</span>
      {mine?.kind === 'segment' && <SegmentRows p={mine} t={t} />}
      {mine?.kind === 'fitting' && el.kind === 'run_fitting' && <FittingRows p={mine} fitting={el} model={model} canEdit={canEdit} actorName={actorName} onCommand={onCommand} t={t} />}
      {!mine && <FieldDescription>{t('ventilation.notOnFanPath', 'Not on a path from the fan, so no air flows through it.', { ns: 'editor' })}</FieldDescription>}
      <Rows
        rows={[
          [t('ventilation.fanNeeds', '{{system}}: fan needs', { ns: 'editor', system: report.systemName }), t('ventilation.externalStatic', '{{pressure}} external static', { ns: 'editor', pressure: wc(report.requiredEspPa) })],
          [
            t('ventilation.criticalPath', 'Critical path', { ns: 'editor' }),
            t('ventilation.criticalPathTo', '{{count}} pieces, to {{to}}', {
              ns: 'editor',
              count: report.criticalPath.length,
              to: report.criticalPath[report.criticalPath.length - 1]?.label ?? t('ventilation.nothingYet', 'nothing yet', { ns: 'editor' }),
            }),
          ],
        ]}
      />
      {report.warnings.map((w) => (
        <FieldDescription key={w} className="text-warning-700" role="status">
          {w}
        </FieldDescription>
      ))}
    </div>
  )
}

function SegmentRows({ p, t = englishOnly }: { p: SegmentPressure; readonly t?: Translate }) {
  return (
    <Rows
      rows={[
        [t('ventilation.airflow', 'Airflow', { ns: 'editor' }), `${Math.round(p.flowCfm)} CFM`],
        [t('ventilation.velocity', 'Velocity', { ns: 'editor' }), `${Math.round(p.velocityFpm)} fpm`],
        [t('ventilation.frictionRate', 'Friction rate', { ns: 'editor' }), `${p.frictionRateInPer100Ft.toFixed(3)} in. w.c. / 100 ft`],
        [t('ventilation.straightLength', 'Straight length', { ns: 'editor' }), `${(p.straightLengthMm / 304.8).toFixed(2)} ft`],
        [t('ventilation.loss', 'Loss', { ns: 'editor' }), wc(p.lossPa)],
      ]}
    />
  )
}

function FittingRows({
  p,
  fitting,
  model,
  canEdit,
  actorName,
  onCommand,
  t = englishOnly,
}: {
  p: FittingPressure
  fitting: RunFitting
  model: ModelState
  canEdit: boolean
  actorName: string
  onCommand: (command: Command) => string | null
  readonly t?: Translate
}) {
  const notLive = t('ventilation.notLive', "Live editing isn't connected, so changes can't be saved", { ns: 'editor' })
  const [error, setError] = useState<string | null>(null)
  const host = fitting.host ? model.elements[fitting.host.segmentId] : undefined
  const choices = fittingFamilies().filter(
    (f) =>
      familyMismatch(f, {
        fittingType: fitting.fittingType,
        domain: fitting.domain,
        sizes: fitting.ports.map((q) => q.size),
        ...(fitting.angleDeg !== undefined ? { angleDeg: fitting.angleDeg } : {}),
        ...(host?.kind === 'run_segment' ? { main: host.size } : {}),
      }) === null,
  )
  const swap = (family: string) => setError(onCommand({ type: 'swap_fitting', fittingId: fitting.id, family }))
  return (
    <div className="flex flex-col gap-2">
      <Field>
        <FieldLabel htmlFor="bm-fitting-type">{t('ventilation.fittingType', 'Fitting type', { ns: 'editor' })}</FieldLabel>
        <Select value={p.familyId ?? undefined} onValueChange={swap} disabled={!canEdit || choices.length < 2}>
          <SelectTrigger id="bm-fitting-type" data-testid="fitting-type" title={canEdit ? undefined : notLive}>
            <SelectValue placeholder={t('ventilation.chooseAType', 'Choose a type', { ns: 'editor' })} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {choices.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {p.defaultedFamily && <FieldDescription>{t('ventilation.shownAsSystemDefault', "Shown as the system's default; choosing a type records it on this fitting.", { ns: 'editor' })}</FieldDescription>}
      </Field>
      {p.paths.map((path) => (
        <div key={path.role} className="flex flex-col gap-1" data-testid={`fitting-path-${path.role}`}>
          <Rows
            rows={[
              [
                p.paths.length > 1
                  ? t('ventilation.pathCoefficient', '{{role}}: C', { ns: 'editor', role: path.role === 'branch' ? t('ventilation.pathBranch', 'Branch', { ns: 'editor' }) : t('ventilation.pathStraightThrough', 'Straight through', { ns: 'editor' }) })
                  : t('ventilation.lossCoefficient', 'Loss coefficient C', { ns: 'editor' }),
                t('ventilation.onVelocityPressure', '{{c}} on the {{reference}}’s velocity pressure', {
                  ns: 'editor',
                  c: path.c.toFixed(3),
                  reference:
                    path.reference === 'small_end'
                      ? t('ventilation.referenceSmallEnd', 'small end', { ns: 'editor' })
                      : path.reference === 'upstream'
                        ? t('ventilation.referenceUpstream', 'upstream', { ns: 'editor' })
                        : path.reference === 'branch'
                          ? t('ventilation.referenceBranch', 'branch', { ns: 'editor' })
                          : t('ventilation.referenceFitting', 'fitting', { ns: 'editor' }),
                }),
              ],
              [t('ventilation.velocity', 'Velocity', { ns: 'editor' }), `${Math.round(path.velocityFpm)} fpm (${Math.round(path.flowCfm)} CFM)`],
              [t('ventilation.loss', 'Loss', { ns: 'editor' }), wc(path.lossPa)],
            ]}
          />
          <Badge variant={path.verify ? 'outline' : 'secondary'} className="w-fit" title={path.method}>
            {path.source.label}
          </Badge>
        </div>
      ))}
      {p.paths.length > 0 && <OverrideForm key={`${fitting.id}:${fitting.coefficientOverride?.c ?? 'none'}`} fitting={fitting} roles={p.paths.map((x) => x.role)} canEdit={canEdit} actorName={actorName} onCommand={onCommand} onError={setError} t={t} />}
      {error && (
        <FieldDescription className="text-danger-600" role="alert" data-testid="fitting-error">
          {error}
        </FieldDescription>
      )}
    </div>
  )
}

function OverrideForm({
  fitting,
  roles,
  canEdit,
  actorName,
  onCommand,
  onError,
  t = englishOnly,
}: {
  fitting: RunFitting
  roles: readonly ('body' | 'branch' | 'main')[]
  canEdit: boolean
  actorName: string
  onCommand: (command: Command) => string | null
  onError: (message: string | null) => void
  readonly t?: Translate
}) {
  const notLive = t('ventilation.notLive', "Live editing isn't connected, so changes can't be saved", { ns: 'editor' })
  const current = fitting.coefficientOverride
  const role = current?.role ?? roles[0] ?? 'body'
  const [value, setValue] = useState(current ? String(current.c) : '')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const c = Number(value)
    if (value.trim() === '' || !Number.isFinite(c) || c < 0) {
      onError(t('ventilation.enterCoefficient', 'Enter a loss coefficient of 0 or more.', { ns: 'editor' }))
      return
    }
    onError(onCommand({ type: 'set_fitting_coefficient', fittingId: fitting.id, role, c, by: actorName, at: new Date().toISOString() }))
  }
  const clear = () => onError(onCommand({ type: 'set_fitting_coefficient', fittingId: fitting.id, role, c: null, by: actorName, at: new Date().toISOString() }))
  return (
    <form onSubmit={submit} className="flex flex-col gap-2" data-testid="fitting-override">
      <Field>
        <FieldLabel htmlFor="bm-fitting-c">
          {t('ventilation.engineersC', "Engineer's C", { ns: 'editor' })}
          {roles.length > 1 ? t('ventilation.roleParen', ' ({{role}})', { ns: 'editor', role: role === 'branch' ? t('ventilation.pathBranchLower', 'branch', { ns: 'editor' }) : t('ventilation.pathStraightThroughLower', 'straight through', { ns: 'editor' }) }) : ''}
        </FieldLabel>
        <Input id="bm-fitting-c" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} disabled={!canEdit} placeholder={t('ventilation.leaveEmptyForSource', 'Leave empty to use the source above', { ns: 'editor' })} />
        {current && <FieldDescription>{t('ventilation.setBy', 'Set by {{who}} on {{when}}.', { ns: 'editor', who: current.by, when: current.at.slice(0, 10) })}</FieldDescription>}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!canEdit} title={canEdit ? undefined : notLive}>
          {t('ventilation.useThisC', 'Use this C', { ns: 'editor' })}
        </Button>
        {current && (
          <Button type="button" size="sm" variant="outline" disabled={!canEdit} onClick={clear}>
            {t('ventilation.clear', 'Clear', { ns: 'editor' })}
          </Button>
        )}
      </div>
    </form>
  )
}
