'use client'

import { useState } from 'react'
import { insulationLabel, nominalInOf, pipeDims, type Command, type DuctInsulation, type ModelState, type RunFitting, type RunSegment } from '@permitzip/bim-kernel'
import { scheduledPipeInsulation, projectPlumbingSettings } from '@permitzip/bim-pack-plumbing'
import { Button } from '../../ui/button'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Separator } from '../../ui/separator'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import { useEditorTranslate, type Translate } from '../i18n/translate'

/** The one refusal every plumbing surface says when the model is open read-only. */
const notLive = (t: Translate): string => t('plumbing.notLive', "Live editing isn't connected, so changes can't be saved", { ns: 'editor' })
const IN = 25.4
const THICKNESSES = ['0', '0.5', '1', '1.5', '2'] as const

/** A pipe's insulation: what it has, what the project's schedule calls for, and a wrap set on the piece, the run or the whole system (one undo). */
export function RunPipeInsulation({ element: el, model, canEdit, onCommand }: { element: RunSegment | RunFitting; model: ModelState; canEdit: boolean; onCommand: (command: Command) => string | null }) {
  if (el.domain !== 'pipe') return null
  return <PipeInsulationForm key={`${el.id}:${el.version}`} element={el} model={model} canEdit={canEdit} onCommand={onCommand} />
}

function PipeInsulationForm({ element: el, model, canEdit, onCommand }: { element: RunSegment | RunFitting; model: ModelState; canEdit: boolean; onCommand: (command: Command) => string | null }) {
  const t = useEditorTranslate()
  const system = model.elements[el.systemId]
  const size = el.kind === 'run_segment' ? el.size : el.ports[0]?.size
  const scheduled = system?.kind === 'mep_system' && size?.shape === 'pipe' ? scheduledPipeInsulation(projectPlumbingSettings(model.elements).pipeInsulation, system.systemKind, nominalInOf(size)) : null
  const current = el.insulation
  const [thickness, setThickness] = useState<string>(current ? String(Math.round((current.thicknessMm / IN) * 8) / 8) : scheduled ? String(scheduled.thicknessIn) : '0')
  const [scope, setScope] = useState<'piece' | 'run' | 'system'>('run')
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)
  const typed = Number(thickness)
  const chosen: DuctInsulation | null = typed > 0 ? { kind: 'wrap', thicknessMm: Math.round(typed * IN * 1000) / 1000, ...(scheduled?.material ? { material: scheduled.material } : {}) } : null
  const outside = size?.shape === 'pipe' ? (pipeDims(size).odMm + 2 * (current?.thicknessMm ?? 0)) / IN : null
  const apply = () => {
    const err = onCommand({ type: 'set_run_insulation', elementId: el.id, insulation: chosen, scope })
    setMessage(err ? { error: true, text: err } : { error: false, text: t('plumbing.insulationApplied', '{{insulation}} applied.', { ns: 'editor', insulation: insulationLabel(chosen ?? undefined) }) })
  }
  const options = [...new Set([...THICKNESSES, thickness])]
  return (
    <div className="flex flex-col gap-2" data-testid="run-pipe-insulation">
      <Separator />
      <Field>
        <FieldLabel htmlFor="bm-pipe-insulation">{t('plumbing.insulation', 'Insulation', { ns: 'editor' })}</FieldLabel>
        <FieldDescription className="text-xs">
          {t('plumbing.insulationLine', '{{insulation}}{{outside}}. {{scheduled}}', {
            ns: 'editor',
            insulation: insulationLabel(current),
            outside: outside !== null && current ? t('plumbing.outsideDiameter', ', {{size}}" outside', { ns: 'editor', size: Math.round(outside * 100) / 100 }) : '',
            scheduled: scheduled
              ? t('plumbing.scheduleCallsFor', 'The schedule calls for {{thickness}} here.', {
                  ns: 'editor',
                  thickness: scheduled.thicknessIn > 0 ? `${scheduled.thicknessIn}"` : t('plumbing.noneLower', 'none', { ns: 'editor' }),
                })
              : t('plumbing.noScheduleRowForThisPipe', 'The project schedule has no row for this pipe (Plumbing › Systems › Insulation).', { ns: 'editor' }),
          })}
        </FieldDescription>
        <div className="flex items-center gap-2">
          <Select value={thickness} onValueChange={setThickness} disabled={!canEdit}>
            <SelectTrigger id="bm-pipe-insulation" size="sm" aria-label={t('plumbing.insulationThickness', 'Insulation thickness', { ns: 'editor' })} data-testid="run-pipe-insulation-thickness">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {options.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o === '0'
                      ? t('plumbing.insulationNone', 'None', { ns: 'editor' })
                      : t('plumbing.insulationWrapSize', '{{size}}" wrap', { ns: 'editor', size: o.replace('.5', '½').replace(/^0½/, '½') })}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={scope}
            onValueChange={(v) => (v === 'piece' || v === 'run' || v === 'system') && setScope(v)}
            aria-label={t('plumbing.applyTo', 'Apply to', { ns: 'editor' })}
            disabled={!canEdit}
          >
            <ToggleGroupItem value="piece">{t('plumbing.scopePiece', 'Piece', { ns: 'editor' })}</ToggleGroupItem>
            <ToggleGroupItem value="run">{t('plumbing.scopeRun', 'Run', { ns: 'editor' })}</ToggleGroupItem>
            <ToggleGroupItem value="system">{t('plumbing.system', 'System', { ns: 'editor' })}</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <Button size="sm" variant="outline" onClick={apply} disabled={!canEdit} title={canEdit ? undefined : notLive(t)} data-testid="run-pipe-insulation-apply">
          {t('plumbing.applyInsulation', 'Apply insulation', { ns: 'editor' })}
        </Button>
        {message && (
          <FieldDescription className={message.error ? 'text-danger-600' : 'text-success-700'} role={message.error ? 'alert' : 'status'}>
            {message.text}
          </FieldDescription>
        )}
      </Field>
    </div>
  )
}
