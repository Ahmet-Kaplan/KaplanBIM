'use client'

import { useState } from 'react'
import {
  fittingFamilies,
  familyMismatch,
  inPerFtLabel,
  minSlopeFor,
  nominalInOf,
  resolveFitting,
  serviceOf,
  slopeInPerFt,
  type Command,
  type ModelState,
  type RunFitting,
  type RunSegment,
} from '@permitzip/bim-kernel'
import {
  PipeHydraulicsEngine,
  elementHydraulics,
  type DrainSegmentResult,
  type FittingLossResult,
  type GasSegmentResult,
  type PipeSystemReport,
  type WaterSegmentResult,
} from '@permitzip/bim-pack-plumbing'
import { Badge } from '../../../ui/badge'
import { Button } from '../../../ui/button'
import { Field, FieldDescription, FieldLabel } from '../../../ui/field'
import { Input } from '../../../ui/input'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../../ui/item'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select'
import { Separator } from '../../../ui/separator'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { GasSizingFrom, RegulatorSettings } from '../GasSizing'
import { useEditorTranslate, type Translate } from '../../i18n/translate'
import { PipeSizing } from '../PipeSizing'

/** One engine for the panel: a system's report is reused until one of its elements changes. */
const engine = new PipeHydraulicsEngine()

/** The one refusal every plumbing surface says when the model is open read-only. */
const notLive = (t: Translate): string => t('plumbing.notLive', "Live editing isn't connected, so changes can't be saved", { ns: 'editor' })

interface Props {
  element: RunSegment | RunFitting
  model: ModelState
  canEdit: boolean
  onCommand: (command: Command) => string | null
  /** For the project's Code Study (its fuel gas code). */
  projectId?: string
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

function ventSystem(model: ModelState, systemId: string): boolean {
  const system = model.elements[systemId]
  return system?.kind === 'mep_system' && serviceOf(system.systemKind) === 'vent'
}

function n(v: number, d = 2): string {
  return (Math.round(v * 10 ** d) / 10 ** d).toString()
}

/** Hydraulics for a routed pipe piece: flow, velocity and friction (water), fixture units and capacity at slope (drains), drop (gas); the system's result; type, slope and accessories. */
export function RunHydraulics({ element: el, model, canEdit, onCommand, projectId }: Props) {
  const t = useEditorTranslate()
  const codeAdoption = useEditorHost().data.codeAdoption
  const [error, setError] = useState<string | null>(null)
  if (el.domain !== 'pipe') return null
  const found = elementHydraulics(engine, model, el.id)
  if (!found) return null
  const { report, segment, fitting } = found
  const mine = report.warnings.filter((w) => w.elementId === el.id)
  const others = report.warnings.filter((w) => w.elementId !== el.id)
  return (
    <div className="flex flex-col gap-3" data-testid="run-hydraulics">
      <Separator />
      <span className="text-sm font-medium">{t('plumbing.hydraulics', 'Hydraulics', { ns: 'editor' })}</span>
      {report.kind === 'not_calculated' ? (
        <FieldDescription data-testid="run-hydraulics-unavailable">{report.reason}</FieldDescription>
      ) : (
        <>
          {segment && <SegmentRows report={report} segment={segment} />}
          {fitting && <FittingLosses fitting={fitting} unit={report.kind === 'gas' ? 'in. w.c.' : 'psi'} />}
          <SystemSummary report={report} />
        </>
      )}
      {el.kind === 'run_fitting' && <RegulatorSettings key={`reg:${el.id}:${el.version}`} fitting={el} model={model} canEdit={canEdit} onCommand={onCommand} />}
      {el.kind === 'run_fitting' && <PipeTypePicker fitting={el} model={model} canEdit={canEdit} onCommand={onCommand} onError={setError} />}
      {el.kind === 'run_segment' && <SlopeForm key={`${el.id}:${el.version}`} segment={el} model={model} canEdit={canEdit} onCommand={onCommand} onError={setError} />}
      {report.kind === 'gas' && <GasSizingFrom port={codeAdoption} systemId={el.systemId} model={model} canEdit={canEdit} onCommand={onCommand} {...(projectId ? { projectId } : {})} />}
      {(report.kind === 'water' || report.kind === 'drainage' || ventSystem(model, el.systemId)) && <PipeSizing systemId={el.systemId} model={model} canEdit={canEdit} onCommand={onCommand} {...(projectId ? { projectId } : {})} />}
      {error && (
        <FieldDescription className="text-danger-600" role="alert" data-testid="run-hydraulics-error">
          {error}
        </FieldDescription>
      )}
      {[...mine, ...others.slice(0, 3)].map((w) => (
        <FieldDescription key={`${w.elementId ?? 'system'}:${w.message}`} className="text-warning-700" role="status">
          {w.message}
        </FieldDescription>
      ))}
      {others.length > 3 && (
        <FieldDescription>{t('plumbing.moreNotesOnThisSystem', '{{count}} more notes on this system in the pipe report.', { ns: 'editor', count: others.length - 3 })}</FieldDescription>
      )}
    </div>
  )
}

function SegmentRows({ report, segment }: { report: Exclude<PipeSystemReport, { kind: 'not_calculated' }>; segment: WaterSegmentResult | DrainSegmentResult | GasSegmentResult }) {
  const t = useEditorTranslate()
  if (report.kind === 'water') {
    const s = segment as WaterSegmentResult
    return (
      <Rows
        rows={[
          [t('plumbing.fixtureUnitsWord', 'Fixture units', { ns: 'editor' }), n(s.fixtureUnits)],
          [t('plumbing.flowWord', 'Flow', { ns: 'editor' }), `${n(s.gpm)} gpm`],
          [
            t('plumbing.velocityWord', 'Velocity', { ns: 'editor' }),
            `${n(s.velocityFps)} ft/s${s.overVelocity ? t('plumbing.overTheLimit', ' (over the limit)', { ns: 'editor' }) : ''}`,
          ],
          [t('plumbing.frictionWord', 'Friction', { ns: 'editor' }), `${n(s.frictionPsiPer100Ft, 3)} psi / 100 ft`],
          [
            t('plumbing.lossHere', 'Loss here', { ns: 'editor' }),
            t('plumbing.lossHereValue', '{{friction}} psi friction, {{height}} psi height', { ns: 'editor', friction: n(s.frictionPsi, 3), height: n(s.elevationPsi, 3) }),
          ],
        ]}
      />
    )
  }
  if (report.kind === 'drainage') {
    const s = segment as DrainSegmentResult
    return (
      <Rows
        rows={[
          [t('plumbing.fixtureUnitsWord', 'Fixture units', { ns: 'editor' }), t('plumbing.dfuGpm', '{{dfu}} DFU ({{gpm}} gpm)', { ns: 'editor', dfu: n(s.fixtureUnits), gpm: n(s.designGpm) })],
          [
            s.role === 'stack' ? t('plumbing.stackCapacity', 'Stack capacity', { ns: 'editor' }) : t('plumbing.capacityAtSlope', 'Capacity at slope', { ns: 'editor' }),
            t('plumbing.capacityValue', '{{gpm}} gpm{{atSlope}}', {
              ns: 'editor',
              gpm: n(s.capacityGpm),
              atSlope: s.slopeInPerFt !== null ? t('plumbing.capacityAtSlopeValue', ' at {{slope}}', { ns: 'editor', slope: inPerFtLabel(s.slopeInPerFt) }) : '',
            }),
          ],
          [
            t('plumbing.usedWord', 'Used', { ns: 'editor' }),
            t('plumbing.usedValue', '{{percent}}%{{table}}', {
              ns: 'editor',
              percent: Math.round(s.utilisation * 100),
              table: s.tableMaxDfu !== null ? t('plumbing.tableAllows', ' (table allows {{dfu}} DFU)', { ns: 'editor', dfu: s.tableMaxDfu }) : '',
            }),
          ],
          ...(s.role === 'horizontal' ? ([[t('plumbing.velocityWord', 'Velocity', { ns: 'editor' }), `${n(s.velocityFps)} ft/s`]] as [string, string][]) : []),
        ]}
      />
    )
  }
  const s = segment as GasSegmentResult
  return (
    <Rows
      rows={[
        [t('plumbing.loadWord', 'Load', { ns: 'editor' }), t('plumbing.mbhCfh', '{{mbh}} MBH ({{cfh}} cfh)', { ns: 'editor', mbh: n(s.mbh), cfh: n(s.cfh) })],
        [t('plumbing.dropHere', 'Drop here', { ns: 'editor' }), `${n(s.dropInWc, 4)} in. w.c.`],
        [
          t('plumbing.overTheLongestRun', 'Over the longest run', { ns: 'editor' }),
          t('plumbing.dropValue', '{{drop}} in. w.c.{{tooMuch}}', {
            ns: 'editor',
            drop: n(s.designDropInWc, 4),
            tooMuch: s.ok ? '' : t('plumbing.tooMuch', ' (too much)', { ns: 'editor' }),
          }),
        ],
      ]}
    />
  )
}

function FittingLosses({ fitting, unit }: { fitting: FittingLossResult; unit: string }) {
  const t = useEditorTranslate()
  return (
    <div className="flex flex-col gap-1" data-testid="pipe-fitting-loss">
      {fitting.paths.map((p) => (
        <div key={p.role} className="flex flex-col gap-1">
          <Rows
            rows={[
              [
                fitting.paths.length > 1
                  ? t('plumbing.fittingPathK', '{{path}}: K', {
                      ns: 'editor',
                      path: p.role === 'branch' ? t('plumbing.branchWord', 'Branch', { ns: 'editor' }) : t('plumbing.throughWord', 'Through', { ns: 'editor' }),
                    })
                  : t('plumbing.kWord', 'K', { ns: 'editor' }),
                `${n(p.k, 3)} (${n(p.equivalentLengthFt)} ft of pipe), ${n(p.loss, 4)} ${unit}`,
              ],
            ]}
          />
          <Badge variant={p.verify ? 'outline' : 'secondary'} className="w-fit">
            {p.source}
          </Badge>
        </div>
      ))}
    </div>
  )
}

function SystemSummary({ report }: { report: Exclude<PipeSystemReport, { kind: 'not_calculated' }> }) {
  const t = useEditorTranslate()
  const verdict = report.pass === null ? null : report.pass ? t('plumbing.passes', 'Passes', { ns: 'editor' }) : t('plumbing.fails', 'Fails', { ns: 'editor' })
  const rows: [string, string][] =
    report.kind === 'water'
      ? [
          [
            t('plumbing.criticalFixture', '{{system}}: critical fixture', { ns: 'editor', system: report.systemName }),
            report.critical
              ? t('plumbing.criticalFixtureValue', '{{label}}, {{pressure}} psi', { ns: 'editor', label: report.critical.label, pressure: n(report.critical.pressure) })
              : t('empty.noneConnectedYet', 'None connected yet', { ns: 'editor' }),
          ],
          [
            t('plumbing.needsWord', 'Needs', { ns: 'editor' }),
            report.minFixturePsi !== null ? t('plumbing.psiValue', '{{psi}} psi', { ns: 'editor', psi: report.minFixturePsi }) : t('empty.notSet', 'Not set', { ns: 'editor' }),
          ],
        ]
      : report.kind === 'drainage'
        ? [[t('plumbing.totalWord', '{{system}}: total', { ns: 'editor', system: report.systemName }), t('plumbing.dfuValue', '{{dfu}} DFU', { ns: 'editor', dfu: n(report.totalFixtureUnits) })]]
        : report.zones
          ? report.zones.map((z): [string, string] => [
              z.label,
              t('plumbing.zoneDrop', '{{state}} its {{drop}} in. w.c. drop over {{length}} ft', {
                ns: 'editor',
                state: z.pass ? t('plumbing.withinWord', 'Within', { ns: 'editor' }) : t('plumbing.overWord', 'Over', { ns: 'editor' }),
                drop: z.allowableDropInWc,
                length: n(z.longestFt, 1),
              }),
            ])
          : [
              [t('plumbing.longestRun', '{{system}}: longest run', { ns: 'editor', system: report.systemName }), t('plumbing.feetValue', '{{length}} ft', { ns: 'editor', length: n(report.longestRunFt, 1) })],
              [
                t('plumbing.worstOutlet', 'Worst outlet', { ns: 'editor' }),
                report.critical
                  ? t('plumbing.worstOutletValue', '{{label}}, {{pressure}} in. w.c. ({{drop}} allowed drop)', {
                      ns: 'editor',
                      label: report.critical.label,
                      pressure: n(report.critical.pressure, 3),
                      drop: report.allowableDropInWc,
                    })
                  : t('empty.noneConnectedYet', 'None connected yet', { ns: 'editor' }),
              ],
            ]
  return (
    <div className="flex flex-col gap-1" data-testid="pipe-system-summary">
      <Rows rows={rows} />
      {verdict && (
        <Badge variant={report.pass ? 'secondary' : 'destructive'} className="w-fit">
          {verdict}
        </Badge>
      )}
      <FieldDescription className="text-xs">{report.basis[0]}</FieldDescription>
    </div>
  )
}

function PipeTypePicker({ fitting, model, canEdit, onCommand, onError }: { fitting: RunFitting; model: ModelState; canEdit: boolean; onCommand: (command: Command) => string | null; onError: (message: string | null) => void }) {
  const t = useEditorTranslate()
  const system = model.elements[fitting.systemId]
  const host = fitting.host ? model.elements[fitting.host.segmentId] : undefined
  if (system?.kind !== 'mep_system') return null
  const sizes = fitting.fittingType === 'accessory' && host?.kind === 'run_segment' ? [host.size] : fitting.ports.map((p) => p.size)
  const current = resolveFitting(system, fitting)
  // Types that fit this fitting's shape, material and service; a direction change the kernel refuses is explained on choosing.
  const choices = fittingFamilies().filter(
    (f) =>
      familyMismatch(f, {
        fittingType: fitting.fittingType,
        domain: 'pipe',
        sizes,
        systemKind: system.systemKind,
        ...(fitting.angleDeg !== undefined ? { angleDeg: fitting.angleDeg } : {}),
        ...(host?.kind === 'run_segment' ? { main: host.size } : {}),
      }) === null,
  )
  return (
    <Field>
      <FieldLabel htmlFor="bm-pipe-fitting-type">{t('plumbing.fittingType', 'Fitting type', { ns: 'editor' })}</FieldLabel>
      <Select value={current?.family.id} onValueChange={(family) => onError(onCommand({ type: 'swap_fitting', fittingId: fitting.id, family }))} disabled={!canEdit || choices.length < 2}>
        <SelectTrigger
          id="bm-pipe-fitting-type"
          data-testid="pipe-fitting-type"
          title={canEdit ? (choices.length < 2 ? t('plumbing.noOtherTypeFits', 'No other type fits this fitting', { ns: 'editor' }) : undefined) : notLive(t)}
        >
          <SelectValue placeholder={t('plumbing.chooseAType', 'Choose a type', { ns: 'editor' })} />
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
      {current?.family.pipe?.joints && typeof current.params.joint === 'string' && (
        <FieldDescription>
          {t('plumbing.jointLine', 'Joint: {{joint}}. Drainage types that can’t make this change of direction are refused with the one to use.', {
            ns: 'editor',
            joint: current.params.joint.replace(/_/g, ' '),
          })}
        </FieldDescription>
      )}
    </Field>
  )
}

function SlopeForm({ segment, model, canEdit, onCommand, onError }: { segment: RunSegment; model: ModelState; canEdit: boolean; onCommand: (command: Command) => string | null; onError: (message: string | null) => void }) {
  const t = useEditorTranslate()
  const system = model.elements[segment.systemId]
  const plan = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y)
  const service = system?.kind === 'mep_system' ? serviceOf(system.systemKind) : null
  const has = slopeInPerFt(segment)
  const [value, setValue] = useState(has > 0 ? String(Math.round(has * 1000) / 1000) : '')
  if (system?.kind !== 'mep_system' || service !== 'drainage' || plan < 1 || has > 1.001) return null
  const need = minSlopeFor(nominalInOf(segment.size), system.design?.pipe)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = value.trim() === '' ? undefined : Number(value)
    if (v !== undefined && !(v >= 0)) {
      onError(t('plumbing.enterTheFall', 'Enter the fall in inches per foot, for example 0.25.', { ns: 'editor' }))
      return
    }
    onError(onCommand({ type: 'set_slope', segmentId: segment.id, ...(v !== undefined ? { inPerFt: v } : {}) }))
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2" data-testid="pipe-slope">
      <Field>
        <FieldLabel htmlFor="bm-pipe-slope">{t('plumbing.slopeInPerFt', 'Slope (in per ft)', { ns: 'editor' })}</FieldLabel>
        <Input id="bm-pipe-slope" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} disabled={!canEdit} placeholder={String(need)} />
        <FieldDescription>
          {t('plumbing.slopeNowLine', 'Now {{now}}; this system needs at least {{need}}. Empty uses the minimum. The far end moves and what is connected follows.', {
            ns: 'editor',
            now: inPerFtLabel(has),
            need: inPerFtLabel(need),
          })}
        </FieldDescription>
      </Field>
      <Button type="submit" size="sm" disabled={!canEdit} title={canEdit ? undefined : notLive(t)}>
        {t('plumbing.setSlope', 'Set slope', { ns: 'editor' })}
      </Button>
    </form>
  )
}
