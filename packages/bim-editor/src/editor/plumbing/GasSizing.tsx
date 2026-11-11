'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { builtinCalcRegistry, type ProjectCodeAdoption } from '@permitzip/bim-calc'
import { fuelGasAdoptionFrom, type GasSystemSizing, IN_WC_PER_PSI, REGULATOR_PARAMS, regulatorSettings } from '@permitzip/bim-pack-plumbing'
import { type Command, type ModelState, type RunFitting } from '@permitzip/bim-kernel'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import type { EditorDataHost } from '@permitzip/bim-editor-host'
import { unavailableWords } from '@permitzip/bim-editor/host/unavailable'
import { useEditorTranslate, type Translate } from '../i18n/translate'

const registry = builtinCalcRegistry()
const SHOWN = 8

/** The one refusal every plumbing surface says when the model is open read-only. */
const notLive = (t: Translate): string => t('plumbing.notLive', "Live editing isn't connected, so changes can't be saved", { ns: 'editor' })

/** The project's fuel gas code from its Code Study (filed under any discipline), or why it couldn't be read. */
type CodeAdoptionPort = EditorDataHost['codeAdoption']

export function useFuelGasCodeFrom(port: CodeAdoptionPort, projectId: string | undefined): { adoption: ProjectCodeAdoption | null; problem: string | null; loading: boolean } {
  const t = useEditorTranslate()
  const [state, setState] = useState<{ adoption: ProjectCodeAdoption | null; problem: string | null; loading: boolean }>({ adoption: null, problem: null, loading: projectId !== undefined })
  useEffect(() => {
    if (!projectId || !port) return
    let cancelled = false
    port
      .read({ projectId })
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) throw new Error("you can't read this project's Code Study")
        if (!res.ok) throw new Error(`Code Study answered HTTP ${res.status}`)
        const body: unknown = await res.json()
        const rows = typeof body === 'object' && body !== null && 'adopted_codes' in body && Array.isArray(body.adopted_codes) ? body.adopted_codes : []
        const typed = rows.flatMap((r: unknown) => {
          if (typeof r !== 'object' || r === null) return []
          const o = r as Record<string, unknown>
          return typeof o.code_name === 'string' && typeof o.edition === 'string' && typeof o.status === 'string' ? [{ code_name: o.code_name, edition: o.edition, status: o.status }] : []
        })
        if (!cancelled) setState({ adoption: fuelGasAdoptionFrom(typed), problem: null, loading: false })
      })
      .catch((err: unknown) => {
        console.error('[useFuelGasCode] reading the project Code Study failed', { projectId, err })
        if (!cancelled)
          setState({
            adoption: null,
            problem: t('plumbing.codeUnreadable', "The fuel gas code couldn't be read from the Code Study ({{error}}). Pick it here.", { ns: 'editor', error: err instanceof Error ? err.message : String(err) }),
            loading: false,
          })
      })
    return () => {
      cancelled = true
    }
  }, [port, projectId, t])
  if (projectId && !port)
    return {
      adoption: null,
      // The host's own sentence stays English (its owner is `src/host/unavailable.ts`); the noun it names is ours.
      problem: `${unavailableWords(t('plumbing.theProjectsCodeStudy', "The project's Code Study", { ns: 'editor' }))} ${t('plumbing.pickTheFuelGasCodeHere', 'Pick the fuel gas code here.', { ns: 'editor' })}`,
      loading: false,
    }
  return state
}

interface Props {
  port: CodeAdoptionPort
  systemId: string
  model: ModelState
  projectId?: string
  canEdit: boolean
  onCommand: (command: Command) => string | null
}

/**
 * Gas sizing for the selected pipe's system: each regulator's pressure zone,
 * the size every pipe needs by the fuel gas code's tables, what is
 * undersized, the total input, and one "Size pipes" that applies it (one
 * undo). Nothing changes until the person sizes: the setting is check.
 */
export function GasSizingFrom({ port, systemId, model, projectId, canEdit, onCommand }: Props) {
  const t = useEditorTranslate()
  const code = useFuelGasCodeFrom(port, projectId)
  const [picked, setPicked] = useState<'2021' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const result = useMemo(() => {
    if (code.loading) return null
    return registry.run({ calc: 'plumbing.gas_system', inputs: { system_id: systemId }, model, ...(picked ? { fuelGasEdition: picked } : {}), projectAdoptions: { fuel_gas: code.adoption } })
  }, [systemId, model, picked, code.adoption, code.loading])
  if (code.loading || !result) return <FieldDescription data-testid="gas-sizing-loading">{t('plumbing.readingTheFuelGasCode', "Reading the project's fuel gas code…", { ns: 'editor' })}</FieldDescription>
  const editionPicker = (
    <Field>
      <FieldLabel htmlFor="bm-gas-code">{t('plumbing.fuelGasCode', 'Fuel gas code', { ns: 'editor' })}</FieldLabel>
      <Select value={picked ?? undefined} onValueChange={(v) => setPicked(v === '2021' ? '2021' : null)}>
        <SelectTrigger id="bm-gas-code" data-testid="gas-code-pick">
          <SelectValue placeholder={t('plumbing.pickTheEdition', 'Pick the edition', { ns: 'editor' })} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="2021">{t('plumbing.ifgc2021', '2021 (IFGC; VFGC in Virginia)', { ns: 'editor' })}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <FieldDescription>{code.problem ?? t('plumbing.noFuelGasCodeInCodeStudy', 'The Code Study names no fuel gas code. Record it there to make this automatic; this pick is for this tab only.', { ns: 'editor' })}</FieldDescription>
    </Field>
  )
  if (!result.ok) {
    return (
      <div className="flex flex-col gap-2" data-testid="gas-sizing">
        <span className="text-sm font-medium">{t('plumbing.gasSizing', 'Gas sizing', { ns: 'editor' })}</span>
        {!code.adoption && !picked ? editionPicker : <FieldDescription role="status">{result.reason}</FieldDescription>}
      </div>
    )
  }
  const sizing = result.run.detail as GasSystemSizing | null
  if (!sizing) {
    return (
      <div className="flex flex-col gap-2" data-testid="gas-sizing">
        <span className="text-sm font-medium">{t('plumbing.gasSizing', 'Gas sizing', { ns: 'editor' })}</span>
        <FieldDescription role="status">{result.run.issues.map((i) => i.message).join(' ')}</FieldDescription>
      </div>
    )
  }
  const changes = sizing.proposals.filter((p) => p.change === 'up')
  const errors = sizing.findings.filter((f) => f.severity === 'error' && f.code !== 'undersized_gas_pipe')
  const tables = [...new Set(sizing.zones.map((z) => z.table).filter((t): t is string => t !== null))]
  const count = changes.length
  // §8: a count takes no plural suffix in Turkish, so the two English shapes are two keys.
  const sized = (withTables: boolean): string =>
    count === 1
      ? withTables
        ? t('plumbing.sizedPipesOnOne', 'Sized {{count}} pipe on {{system}} from {{tables}}', { ns: 'editor', count, system: sizing.systemName, tables: tables.join(', ') || t('plumbing.theEquation', 'the 402.4 equation', { ns: 'editor' }) })
        : t('plumbing.sizedPipesDoneOne', 'Sized {{count}} pipe on {{system}}. Undo puts them back.', { ns: 'editor', count, system: sizing.systemName })
      : withTables
        ? t('plumbing.sizedPipesOnMany', 'Sized {{count}} pipes on {{system}} from {{tables}}', { ns: 'editor', count, system: sizing.systemName, tables: tables.join(', ') || t('plumbing.theEquation', 'the 402.4 equation', { ns: 'editor' }) })
        : t('plumbing.sizedPipesDoneMany', 'Sized {{count}} pipes on {{system}}. Undo puts them back.', { ns: 'editor', count, system: sizing.systemName })
  const size = () => {
    const why = onCommand({ type: 'set_pipe_sizes', idPrefix: `size-${Date.now().toString(36)}`, systemId: sizing.systemId, label: sized(true).slice(0, 160), sizes: changes.map((p) => ({ segmentId: p.segmentId, nominalIn: p.proposedIn })) })
    setError(why)
    if (!why) toast.success(sized(false))
  }
  const disabledWhy = !canEdit ? notLive(t) : changes.length === 0 ? t('plumbing.everyPipeCarriesItsLoad', 'Every pipe already carries its load at its zone pressure', { ns: 'editor' }) : undefined
  return (
    <div className="flex flex-col gap-2" data-testid="gas-sizing">
      <span className="text-sm font-medium">{t('plumbing.gasSizing', 'Gas sizing', { ns: 'editor' })}</span>
      <FieldDescription className="text-xs">
        {t('plumbing.gasSizingLine', '{{fuel}}, {{method}} method, {{tables}}. {{adoption}} Total input {{input}} Btu/h.', {
          ns: 'editor',
          fuel: sizing.gas === 'propane' ? t('plumbing.undilutedPropane', 'Undiluted propane', { ns: 'editor' }) : t('plumbing.naturalGasFuel', 'Natural gas', { ns: 'editor' }),
          method: sizing.method === 'branch_length' ? t('plumbing.branchLengthMethod', 'branch length', { ns: 'editor' }) : t('plumbing.longestLengthMethod', 'longest length', { ns: 'editor' }),
          tables: tables.join(', ') || t('plumbing.equationShort', '402.4 equation', { ns: 'editor' }),
          adoption: code.adoption
            ? t('plumbing.codeStudyNamed', 'Code Study: {{code}}.', { ns: 'editor', code: code.adoption.codeName })
            : t('plumbing.editionPickedHere', 'Edition picked here.', { ns: 'editor' }),
          input: Math.round(sizing.totalMbh * 1000).toLocaleString(),
        })}
      </FieldDescription>
      <ItemGroup className="gap-1" data-testid="gas-zones">
        {sizing.zones.map((z) => (
          <Item key={z.id} size="sm" data-testid="gas-zone">
            <ItemContent>
              <ItemTitle className="text-xs">{z.label}</ItemTitle>
              <ItemDescription className="text-xs">
                {t('plumbing.zoneLine', '{{drop}} drop, {{mbh}} MBH, longest {{ft}} ft', { ns: 'editor', drop: z.allowableDrop, mbh: z.totalMbh, ft: z.longestFt })}
              </ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
      {changes.length > 0 ? (
        <ItemGroup className="gap-1" data-testid="gas-undersized">
          {changes.slice(0, SHOWN).map((p) => (
            <Item key={p.segmentId} size="sm">
              <ItemContent>
                <ItemDescription className="text-xs">{p.label}</ItemDescription>
                <ItemTitle className="text-xs font-normal">
                  {p.current}&quot; → {p.proposed}&quot;
                </ItemTitle>
              </ItemContent>
            </Item>
          ))}
          {changes.length > SHOWN && <FieldDescription>{t('plumbing.morePipesNeedALargerSize', '{{count}} more pipes need a larger size.', { ns: 'editor', count: changes.length - SHOWN })}</FieldDescription>}
        </ItemGroup>
      ) : (
        <Badge variant="secondary" className="w-fit" data-testid="gas-sized-ok">
          {t('plumbing.everyPipeIsLargeEnough', 'Every pipe is large enough', { ns: 'editor' })}
        </Badge>
      )}
      {errors.map((f) => (
        <FieldDescription key={`${f.code}:${f.elementId ?? ''}`} className="text-danger-600" role="alert" data-testid="gas-sizing-finding">
          {f.message}
        </FieldDescription>
      ))}
      <Button type="button" size="sm" onClick={size} disabled={disabledWhy !== undefined} title={disabledWhy} data-testid="gas-size-pipes">
        {changes.length > 0
          ? changes.length === 1
            ? t('plumbing.sizePipesOne', 'Size {{count}} pipe', { ns: 'editor', count: changes.length })
            : t('plumbing.sizePipesMany', 'Size {{count}} pipes', { ns: 'editor', count: changes.length })
          : t('plumbing.sizePipes', 'Size pipes', { ns: 'editor' })}
      </Button>
      <FieldDescription className="text-xs">{t('plumbing.gasSizingWhy', 'Checks only until you size; one undo puts every pipe back. Reducers go where sizes change.', { ns: 'editor' })}</FieldDescription>
      {error && (
        <FieldDescription className="text-danger-600" role="alert" data-testid="gas-sizing-error">
          {error}
        </FieldDescription>
      )}
    </div>
  )
}

/** A regulator's kind in words — a `label(t)` accessor, not a table frozen in one language. */
function roleWord(role: string, t: Translate): string {
  switch (role) {
    case 'line':
      return t('plumbing.role.line', 'Line regulator', { ns: 'editor' })
    case 'service':
      return t('plumbing.role.service', 'Service regulator', { ns: 'editor' })
    case 'appliance':
      return t('plumbing.role.appliance', 'Appliance regulator', { ns: 'editor' })
    default:
      return role
  }
}

/** Where a regulator's relief vent goes, in words — a `label(t)` accessor. */
function ventWord(vent: string, t: Translate): string {
  switch (vent) {
    case 'vent_limiter':
      return t('plumbing.regVent.ventLimiter', 'Vent limiter', { ns: 'editor' })
    case 'vent_to_outdoors':
      return t('plumbing.regVent.ventToOutdoors', 'Vent to outdoors', { ns: 'editor' })
    case 'none':
      return t('plumbing.regVent.none', 'None (outdoors)', { ns: 'editor' })
    default:
      return vent
  }
}

/** A gas pressure regulator's settings: what kind, the pressure it holds downstream, the drop that zone may lose, its vent. */
export function RegulatorSettings({ fitting, model, canEdit, onCommand }: { fitting: RunFitting; model: ModelState; canEdit: boolean; onCommand: (command: Command) => string | null }) {
  const t = useEditorTranslate()
  const s = regulatorSettings(model.elements, fitting)
  const [unit, setUnit] = useState<'in_wc' | 'psi'>(s && s.outletInWc >= IN_WC_PER_PSI ? 'psi' : 'in_wc')
  const show = (inWc: number) => String(Math.round((unit === 'psi' ? inWc / IN_WC_PER_PSI : inWc) * 100) / 100)
  const [role, setRole] = useState(s?.role ?? 'line')
  const [vent, setVent] = useState(s?.vent ?? 'vent_limiter')
  const [outlet, setOutlet] = useState(s ? show(s.outletInWc) : '')
  const [drop, setDrop] = useState(s ? show(s.zoneDropInWc) : '')
  const [error, setError] = useState<string | null>(null)
  if (!s) return null
  const switchUnit = (next: string) => {
    if (next !== 'psi' && next !== 'in_wc') return
    const toWc = (v: string) => (unit === 'psi' ? Number(v) * IN_WC_PER_PSI : Number(v))
    const fromWc = (v: number) => String(Math.round((next === 'psi' ? v / IN_WC_PER_PSI : v) * 100) / 100)
    if (Number.isFinite(Number(outlet))) setOutlet(fromWc(toWc(outlet)))
    if (Number.isFinite(Number(drop))) setDrop(fromWc(toWc(drop)))
    setUnit(next)
  }
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const factor = unit === 'psi' ? IN_WC_PER_PSI : 1
    const o = Number(outlet) * factor
    const d = Number(drop) * factor
    if (!(o > 0) || !(d > 0)) {
      setError(t('plumbing.enterTheOutletPressure', 'Enter the outlet pressure and the allowable drop downstream.', { ns: 'editor' }))
      return
    }
    setError(onCommand({ type: 'swap_fitting', fittingId: fitting.id, family: 'pipe.gas.regulator', params: { role, vent, outlet_in_wc: Math.round(o * 1000) / 1000, zone_drop_in_wc: Math.round(d * 1000) / 1000 } }))
  }
  const roleOptions = REGULATOR_PARAMS.find((p) => p.key === 'role')
  const ventOptions = REGULATOR_PARAMS.find((p) => p.key === 'vent')
  return (
    <form onSubmit={save} className="flex flex-col gap-2" data-testid="gas-regulator">
      <span className="text-sm font-medium">{t('plumbing.regulator', 'Regulator', { ns: 'editor' })}</span>
      <Field>
        <FieldLabel htmlFor="bm-reg-role">{t('plumbing.kind', 'Kind', { ns: 'editor' })}</FieldLabel>
        <Select value={role} onValueChange={(v) => setRole(v === 'service' || v === 'appliance' ? v : 'line')} disabled={!canEdit}>
          <SelectTrigger id="bm-reg-role" title={canEdit ? undefined : notLive(t)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {(roleOptions?.kind === 'choice' ? roleOptions.options : ['line']).map((o) => (
                <SelectItem key={o} value={o}>
                  {roleWord(o, t)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <ToggleGroup type="single" value={unit} onValueChange={switchUnit} variant="outline" size="sm" aria-label={t('plumbing.pressureUnit', 'Pressure unit', { ns: 'editor' })}>
        <ToggleGroupItem value="in_wc">{t('plumbing.inWc', 'in. w.c.', { ns: 'editor' })}</ToggleGroupItem>
        <ToggleGroupItem value="psi">psi</ToggleGroupItem>
      </ToggleGroup>
      <Field>
        <FieldLabel htmlFor="bm-reg-outlet">{t('plumbing.outletPressure', 'Outlet pressure ({{unit}})', { ns: 'editor', unit: unit === 'psi' ? 'psi' : t('plumbing.inWc', 'in. w.c.', { ns: 'editor' }) })}</FieldLabel>
        <Input id="bm-reg-outlet" inputMode="decimal" value={outlet} onChange={(e) => setOutlet(e.target.value)} disabled={!canEdit} data-testid="gas-regulator-outlet" />
      </Field>
      <Field>
        <FieldLabel htmlFor="bm-reg-drop">{t('plumbing.allowableDropDownstream', 'Allowable drop downstream ({{unit}})', { ns: 'editor', unit: unit === 'psi' ? 'psi' : t('plumbing.inWc', 'in. w.c.', { ns: 'editor' }) })}</FieldLabel>
        <Input id="bm-reg-drop" inputMode="decimal" value={drop} onChange={(e) => setDrop(e.target.value)} disabled={!canEdit} data-testid="gas-regulator-drop" />
        <FieldDescription>{t('plumbing.newPressureZone', 'Everything downstream is a new pressure zone, sized at this pressure and drop.', { ns: 'editor' })}</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="bm-reg-vent">{t('plumbing.vent', 'Vent', { ns: 'editor' })}</FieldLabel>
        <Select value={vent} onValueChange={setVent} disabled={!canEdit}>
          <SelectTrigger id="bm-reg-vent" title={canEdit ? undefined : notLive(t)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {(ventOptions?.kind === 'choice' ? ventOptions.options : ['vent_limiter']).map((o) => (
                <SelectItem key={o} value={o}>
                  {ventWord(o, t)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Button type="submit" size="sm" variant="outline" disabled={!canEdit} title={canEdit ? undefined : notLive(t)} data-testid="gas-regulator-save">
        {t('plumbing.saveRegulator', 'Save regulator', { ns: 'editor' })}
      </Button>
      {error && (
        <FieldDescription className="text-danger-600" role="alert">
          {error}
        </FieldDescription>
      )}
    </form>
  )
}
