'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { builtinCalcRegistry } from '@permitzip/bim-calc'
import { hunterChart, type PipeSystemSizing } from '@permitzip/bim-pack-plumbing'
import type { Command, ModelState } from '@permitzip/bim-kernel'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { HunterCurveChart } from './HunterCurveChart'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { useProjectPlumbingCodesFrom } from './use-auto-size'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'

const registry = builtinCalcRegistry()
const SHOWN = 8

/** The one refusal every plumbing surface says when the model is open read-only. */
const notLive = (t: Translate): string => t('plumbing.notLive', "Live editing isn't connected, so changes can't be saved", { ns: 'editor' })

/** What a sizing rests on, for the undo label: "Sized 3 pipes on Storm from Tables 1106.2(1) and 1106.3". */
export function sizingBasis(sizing: PipeSystemSizing, t: Translate = englishOnly): string {
  if (sizing.service === 'water') return sizing.curve?.label ?? t('plumbing.theDemandCurve', 'the demand curve', { ns: 'editor' })
  if (sizing.service === 'vent') return t('plumbing.ventTables', 'Table 906.1 and 906.2', { ns: 'editor' })
  if (sizing.service === 'storm') return t('plumbing.stormTables', 'Tables 1106.2(1) and 1106.3', { ns: 'editor' })
  return t('plumbing.theDfuTables', 'the DFU tables', { ns: 'editor' })
}

/** What this sizing rests on, in the words the panel shows above the size button. */
function summary(sizing: PipeSystemSizing, t: Translate = englishOnly): string {
  switch (sizing.service) {
    case 'water':
      return t('plumbing.waterSummary', '{{load}} WSFU{{designPoint}}. {{friction}}velocity within {{velocity}} ft/s.', {
        ns: 'editor',
        load: sizing.totalLoad,
        designPoint: sizing.designPoint
          ? t('plumbing.waterDesignPoint', ', {{gpm}} gpm on {{curve}}', { ns: 'editor', gpm: sizing.designPoint.gpm, curve: sizing.curve?.label ?? '' })
          : '',
        friction:
          sizing.allowablePsiPer100Ft !== null
            ? t('plumbing.waterFriction', 'Friction within {{friction}} psi/100 ft ({{available}} psi over {{length}} ft + fittings), ', {
                ns: 'editor',
                friction: sizing.allowablePsiPer100Ft ?? '',
                available: sizing.availablePsi ?? '',
                length: sizing.developedLengthFt ?? '',
              })
            : '',
        velocity: sizing.maxVelocityFps ?? '',
      })
    case 'vent':
      return t('plumbing.ventSummary', '{{load}} DFU vented{{length}}. Vent stacks by Table 906.1 on the stack they serve; other vents half the drain they vent, 1-1/4" least, a size up over 40 ft.', {
        ns: 'editor',
        load: sizing.totalLoad,
        length: sizing.developedLengthFt !== null ? t('plumbing.ventDevelopedLength', ', longest developed length {{length}} ft', { ns: 'editor', length: sizing.developedLengthFt }) : '',
      })
    case 'storm':
      return sizing.rainfallInPerHr === undefined
        ? t('plumbing.stormSummaryNoRate', 'Storm pipe sizes on roof area at the design rainfall rate.', { ns: 'editor' })
        : t('plumbing.stormSummary', '{{load}} sq ft of roof at {{rate}} in/h. Leaders by Table 1106.2(1), horizontal drains by Table 1106.3 at their fall, never smaller downstream.', {
            ns: 'editor',
            load: sizing.totalLoad,
            rate: sizing.rainfallInPerHr,
          })
    default:
      return t('plumbing.sanitarySummary', '{{load}} DFU at the outfall. Building drain by Table 710.1(1) at its fall, branches and stacks by Table 710.1(2), never smaller downstream.', { ns: 'editor', load: sizing.totalLoad })
  }
}

/** Storm: the design rainfall rate the code library can't give (Figure 1106.1 is a map image), set on the system. */
function RainfallRate({ systemId, systemName, canEdit, onCommand }: { systemId: string; systemName: string; canEdit: boolean; onCommand: (command: Command) => string | null }) {
  const t = useEditorTranslate()
  const [rate, setRate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const value = Number(rate)
  const valid = rate.trim() !== '' && Number.isFinite(value) && value > 0 && value <= 20
  const save = () => {
    if (!valid) return
    const why = onCommand({ type: 'set_system_design', systemId, design: { pipe: { rainfallInPerHr: value } } })
    setError(why)
    if (!why) toast.success(t('plumbing.sizesAtRate', '{{system}} sizes at {{rate}} in/h. Undo puts it back.', { ns: 'editor', system: systemName, rate: value }))
  }
  return (
    <Field data-testid="pipe-sizing-rainfall">
      <FieldLabel htmlFor={`bm-rainfall-${systemId}`}>{t('plumbing.designRainfall', 'Design rainfall (in/h)', { ns: 'editor' })}</FieldLabel>
      <div className="flex gap-2">
        <Input id={`bm-rainfall-${systemId}`} inputMode="decimal" placeholder="3.2" className="h-8 w-24" value={rate} onChange={(e) => setRate(e.target.value)} disabled={!canEdit} data-testid="pipe-sizing-rainfall-input" />
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={!canEdit || !valid}
          title={!canEdit ? notLive(t) : !valid ? t('plumbing.rainfallRateHint', 'Type the 100-year, 1-hour rate in inches per hour (0 to 20)', { ns: 'editor' }) : undefined}
          data-testid="pipe-sizing-rainfall-save"
        >
          {t('plumbing.saveRate', 'Save rate', { ns: 'editor' })}
        </Button>
      </div>
      <FieldDescription>{t('plumbing.rainfallRateWhy', 'The 100-year, 1-hour rate for the site from approved local weather data (VPC 1106.1). It is saved on {{system}}.', { ns: 'editor', system: systemName })}</FieldDescription>
      {error && (
        <FieldDescription className="text-danger-600" role="alert">
          {error}
        </FieldDescription>
      )}
    </Field>
  )
}

interface Props {
  systemId: string
  model: ModelState
  projectId?: string
  canEdit: boolean
  onCommand: (command: Command) => string | null
}

/**
 * Water, sanitary, vent or storm sizing for the selected pipe's system: what each pipe
 * carries, the size the plumbing code needs against the size drawn, what's
 * undersized, and one "Size pipes" (one undo). With auto-sizing on for the
 * system, sizes already follow as you model; this shows what they rest on.
 */
export function PipeSizing({ systemId, model, projectId, canEdit, onCommand }: Props) {
  const t = useEditorTranslate()
  const code = useProjectPlumbingCodesFrom(useEditorHost().data.codeAdoption, projectId)
  const [picked, setPicked] = useState<'2021' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const result = useMemo(() => {
    if (code.loading) return null
    return registry.run({ calc: 'plumbing.size_system', inputs: { system_id: systemId }, model, ...(picked ? { plumbingEdition: picked } : {}), projectAdoptions: { plumbing: code.plumbing } })
  }, [systemId, model, picked, code.plumbing, code.loading])
  const chart = useMemo(() => hunterChart(model), [model])
  if (code.loading || !result) return <FieldDescription data-testid="pipe-sizing-loading">{t('plumbing.readingThePlumbingCode', "Reading the project's plumbing code…", { ns: 'editor' })}</FieldDescription>
  if (!result.ok) {
    return (
      <div className="flex flex-col gap-2" data-testid="pipe-sizing">
        <span className="text-sm font-medium">{t('plumbing.pipeSizing', 'Pipe sizing', { ns: 'editor' })}</span>
        {!code.plumbing && !picked ? (
          <Field>
            <FieldLabel htmlFor="bm-plumbing-code">{t('plumbing.plumbingCode', 'Plumbing code', { ns: 'editor' })}</FieldLabel>
            <Select value={picked ?? undefined} onValueChange={(v) => setPicked(v === '2021' ? '2021' : null)}>
              <SelectTrigger id="bm-plumbing-code" data-testid="pipe-sizing-code-pick">
                <SelectValue placeholder={t('plumbing.pickTheEdition', 'Pick the edition', { ns: 'editor' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="2021">{t('plumbing.ipc2021', '2021 (IPC; VPC in Virginia)', { ns: 'editor' })}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>{code.problem ?? t('plumbing.noPlumbingCodeInCodeStudy', 'The Code Study names no plumbing code. Record it there to size (and auto-size) without asking; this pick is for this panel only.', { ns: 'editor' })}</FieldDescription>
          </Field>
        ) : (
          <FieldDescription role="status">{result.reason}</FieldDescription>
        )}
      </div>
    )
  }
  const sizing = result.run.detail as PipeSystemSizing | null
  if (!sizing) return <FieldDescription role="status">{result.run.issues.map((i) => i.message).join(' ')}</FieldDescription>
  const up = sizing.proposals.filter((p) => p.change === 'up')
  const down = sizing.proposals.filter((p) => p.change === 'down')
  const problems = sizing.findings.filter((f) => f.code !== 'undersized_pipe' && f.code !== 'oversized_pipe' && f.code !== 'walk' && f.severity !== 'info')
  const auto = sizing.sizingMode === 'auto'
  const needsRainfall = sizing.findings.some((f) => f.code === 'no_rainfall_rate')
  const apply = (which: 'up' | 'all') => {
    const changes = which === 'up' ? up : [...up, ...down]
    const basis = sizingBasis(sizing, t)
    const count = changes.length
    // §8: a count takes no plural suffix in Turkish, so the two English shapes are two keys.
    const label = count === 1
      ? t('plumbing.sizedPipesOnOne', 'Sized {{count}} pipe on {{system}} from {{tables}}', { ns: 'editor', count, system: sizing.systemName, tables: basis })
      : t('plumbing.sizedPipesOnMany', 'Sized {{count}} pipes on {{system}} from {{tables}}', { ns: 'editor', count, system: sizing.systemName, tables: basis })
    const why = onCommand({ type: 'set_pipe_sizes', idPrefix: `size-${sizing.systemId}-r${model.revision}`, systemId: sizing.systemId, label: label.slice(0, 160), sizes: changes.map((p) => ({ segmentId: p.segmentId, nominalIn: p.proposedIn })) })
    setError(why)
    if (!why)
      toast.success(
        count === 1
          ? t('plumbing.sizedPipesDoneOne', 'Sized {{count}} pipe on {{system}}. Undo puts them back.', { ns: 'editor', count, system: sizing.systemName })
          : t('plumbing.sizedPipesDoneMany', 'Sized {{count}} pipes on {{system}}. Undo puts them back.', { ns: 'editor', count, system: sizing.systemName }),
      )
  }
  const blocked = !canEdit ? notLive(t) : undefined
  return (
    <div className="flex flex-col gap-2" data-testid="pipe-sizing">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{t('plumbing.pipeSizing', 'Pipe sizing', { ns: 'editor' })}</span>
        <Badge
          variant={auto ? 'default' : 'secondary'}
          data-testid="pipe-sizing-mode"
          title={
            sizing.sizingModeFrom === 'system'
              ? t('plumbing.systemOwnAutoSize', "This system's own setting (Plumbing › Systems)", { ns: 'editor' })
              : t('plumbing.projectAutoSizeSetting', 'The project setting (Plumbing › Analyze › Auto-size)', { ns: 'editor' })
          }
        >
          {auto ? t('plumbing.autoSizeOn', 'Auto-size on', { ns: 'editor' }) : t('plumbing.checkOnly', 'Check only', { ns: 'editor' })}
        </Badge>
      </div>
      <FieldDescription className="text-xs">
        {summary(sizing, t)}{' '}
        {auto
          ? t('plumbing.sizesFollowAsYouModel', 'Sizes follow as you model; each resize is its own undo.', { ns: 'editor' })
          : t('plumbing.nothingChangesUntilYouSize', 'Nothing changes until you size.', { ns: 'editor' })}
      </FieldDescription>
      {sizing.service === 'water' && sizing.curve && <HunterCurveChart chart={chart} only={[sizing.curve.id]} className="h-[180px] w-full" />}
      {needsRainfall && <RainfallRate systemId={sizing.systemId} systemName={sizing.systemName} canEdit={canEdit} onCommand={onCommand} />}
      {needsRainfall ? null : up.length > 0 ? (
        <ItemGroup className="gap-1" data-testid="pipe-sizing-undersized">
          {up.slice(0, SHOWN).map((p) => (
            <Item key={p.segmentId} size="sm">
              <ItemContent>
                <ItemDescription className="text-xs">
                  {p.label}: {p.carries}
                </ItemDescription>
                <ItemTitle className="text-xs font-normal">
                  {p.current}&quot; → {p.proposed}&quot; ({p.governs})
                </ItemTitle>
              </ItemContent>
            </Item>
          ))}
          {up.length > SHOWN && <FieldDescription>{t('plumbing.morePipesNeedALargerSize', '{{count}} more pipes need a larger size.', { ns: 'editor', count: up.length - SHOWN })}</FieldDescription>}
        </ItemGroup>
      ) : (
        <Badge variant="secondary" className="w-fit" data-testid="pipe-sized-ok">
          {t('plumbing.everyPipeIsLargeEnough', 'Every pipe is large enough', { ns: 'editor' })}
        </Badge>
      )}
      {down.length > 0 && (
        <FieldDescription className="text-xs">
          {down.length === 1
            ? t('plumbing.pipeLargerThanNeeded', '{{count}} pipe is larger than needed.', { ns: 'editor', count: down.length })
            : t('plumbing.pipesLargerThanNeeded', '{{count}} pipes are larger than needed.', { ns: 'editor', count: down.length })}
        </FieldDescription>
      )}
      {problems.map((f) => (
        <FieldDescription key={`${f.code}:${f.elementId ?? ''}:${f.message}`} className={f.severity === 'error' ? 'text-danger-600' : 'text-warning-700'} role={f.severity === 'error' ? 'alert' : 'status'} data-testid="pipe-sizing-finding">
          {f.message}
        </FieldDescription>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => apply('up')}
          disabled={blocked !== undefined || up.length === 0}
          title={blocked ?? (up.length === 0 ? t('plumbing.everyPipeAlreadyCarriesItsLoad', 'Every pipe already carries its load', { ns: 'editor' }) : undefined)}
          data-testid="pipe-size-pipes"
        >
          {up.length > 0
            ? up.length === 1
              ? t('plumbing.sizePipesOne', 'Size {{count}} pipe', { ns: 'editor', count: up.length })
              : t('plumbing.sizePipesMany', 'Size {{count}} pipes', { ns: 'editor', count: up.length })
            : t('plumbing.sizePipes', 'Size pipes', { ns: 'editor' })}
        </Button>
        {down.length > 0 && (
          <Button type="button" size="sm" variant="outline" onClick={() => apply('all')} disabled={blocked !== undefined} title={blocked} data-testid="pipe-size-pipes-all">
            {t('plumbing.alsoReduce', 'Also reduce {{count}}', { ns: 'editor', count: down.length })}
          </Button>
        )}
      </div>
      {error && (
        <FieldDescription className="text-danger-600" role="alert" data-testid="pipe-sizing-error">
          {error}
        </FieldDescription>
      )}
    </div>
  )
}
