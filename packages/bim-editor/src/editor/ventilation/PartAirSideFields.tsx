'use client'

import { useState } from 'react'
import { Waves } from 'lucide-react'
import { INTAKE_LABELS, PART_MOUNT_LABELS, resolveConnectors, takesIntake, type IntakeChoice, type PartInstance, type PartMount, type PartTypeDefinition } from '@permitzip/bim-kernel'
import { Button } from '../../ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '../../ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import type { FlexCandidate } from '../contributions/types'
import { useEditorTranslate, type Translate } from '../i18n/translate'

interface Props {
  part: PartInstance
  type: PartTypeDefinition
  canEdit: boolean
  onMount: (mount: 'as_drawn' | PartMount) => string | null
  onIntake: (connectorId: string, choice: IntakeChoice | null) => string | null
  /** Open duct ends a flex into the neck could leave, nearest first. */
  flexCandidates: () => readonly FlexCandidate[]
  onFlex: (from: FlexCandidate, connectorId: string) => string | null
}

const MOUNTS = ['as_drawn', 'turned_over', 'on_side'] as const
const INTAKE_CHOICES = ['hood', 'louver', 'screen', 'none'] as const

/** What an air device's mount means, in the words a designer uses for the common case. */
function mountHint(mount: (typeof MOUNTS)[number], t: Translate): string {
  switch (mount) {
    case 'as_drawn':
      return t('ventilation.mountHint.asDrawn', 'As the part is drawn (a ceiling diffuser faces down into the room).', { ns: 'editor' })
    case 'turned_over':
      return t('ventilation.mountHint.turnedOver', 'Upside down: a floor register, neck down to the duct below.', { ns: 'editor' })
    case 'on_side':
      return t('ventilation.mountHint.onSide', 'Stood up, facing the way the part is rotated: a sidewall register.', { ns: 'editor' })
  }
}

/**
 * The air side of a placed part: how it is mounted, the hood, louver or
 * screen on each outdoor-air opening, and flex from a nearby open duct end
 * into its neck. Each saves at once through the same commands the agent uses.
 */
export function PartAirSideFields({ part, type, canEdit, onMount, onIntake, flexCandidates, onFlex }: Props) {
  const t = useEditorTranslate()
  const [error, setError] = useState<string | null>(null)
  const connectors = resolveConnectors(type, part.values)
  const intakes = connectors.filter(takesIntake)
  const neck = connectors.find((c) => c.domain === 'duct' && c.shape === 'round' && type.category === 'air_terminal')
  const neckOpen = neck !== undefined && !part.links?.[neck.id]
  const connected = Object.keys(part.links ?? {}).length > 0
  const [candidates] = useState(() => (neckOpen ? flexCandidates() : []))
  const [flexFrom, setFlexFrom] = useState(candidates[0] ? `${candidates[0].elementId}|${candidates[0].port}` : '')
  const mountable = type.category === 'air_terminal' || part.mount !== undefined
  if (!mountable && intakes.length === 0) return null
  const run = (r: string | null) => setError(r)
  return (
    <FieldSet data-testid="part-air-side">
      <FieldLegend variant="label">{t('ventilation.airSide', 'Air side', { ns: 'editor' })}</FieldLegend>
      <FieldGroup className="gap-2">
        {mountable && (
          <Field>
            <FieldLabel>{t('ventilation.mount', 'Mount', { ns: 'editor' })}</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={part.mount ?? 'as_drawn'}
              onValueChange={(v) => {
                if (!v || v === (part.mount ?? 'as_drawn')) return
                const mount = MOUNTS.find((m) => m === v)
                if (mount) run(onMount(mount))
              }}
              disabled={!canEdit || connected}
              aria-label={t('ventilation.mount', 'Mount', { ns: 'editor' })}
            >
              {MOUNTS.map((m) => (
                <ToggleGroupItem key={m} value={m} data-testid={`part-mount-${m}`}>
                  {PART_MOUNT_LABELS[m]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldDescription>{connected ? t('ventilation.mountDisconnect', 'Disconnect its duct to turn it; the neck would move.', { ns: 'editor' }) : mountHint(part.mount ?? 'as_drawn', t)}</FieldDescription>
          </Field>
        )}
        {intakes.map((c) => {
          const current: IntakeChoice = part.intakes?.[c.id] ?? c.intake ?? 'none'
          return (
            <Field key={c.id}>
              <FieldLabel htmlFor={`bm-intake-${c.id}`}>{c.label} opening</FieldLabel>
              <Select
                value={current}
                onValueChange={(v) => {
                  const choice = INTAKE_CHOICES.find((x) => x === v)
                  if (!choice || choice === current) return
                  // Back to what the type ships with clears the part's own choice.
                  run(onIntake(c.id, choice === (c.intake ?? 'none') ? null : choice))
                }}
                disabled={!canEdit}
              >
                <SelectTrigger id={`bm-intake-${c.id}`} size="sm" data-testid={`part-intake-${c.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {INTAKE_CHOICES.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k === 'none' ? t('ventilation.intakeOpen', 'Open (nothing on it)', { ns: 'editor' }) : INTAKE_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )
        })}
        {neck && neckOpen && (
          <Field>
            <FieldLabel htmlFor="bm-flex-from">{t('ventilation.flexFrom', 'Flex into the neck from', { ns: 'editor' })}</FieldLabel>
            {candidates.length > 0 ? (
              <div className="flex gap-2">
                <Select value={flexFrom} onValueChange={setFlexFrom} disabled={!canEdit}>
                  <SelectTrigger id="bm-flex-from" size="sm" className="min-w-0 flex-1" data-testid="part-flex-from">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {candidates.map((f) => (
                        <SelectItem key={`${f.elementId}|${f.port}`} value={`${f.elementId}|${f.port}`}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canEdit || !flexFrom}
                  data-testid="part-run-flex"
                  onClick={() => {
                    const from = candidates.find((f) => `${f.elementId}|${f.port}` === flexFrom)
                    if (from) run(onFlex(from, neck.id))
                  }}
                >
                  <Waves data-icon="inline-start" />
                  {t('ventilation.runFlex', 'Run flex', { ns: 'editor' })}
                </Button>
              </div>
            ) : (
              <FieldDescription>{t('ventilation.noDuctEndForFlex', 'No open round duct end the size of the neck within 12 ft. Route a branch toward it first, then run flex from its end.', { ns: 'editor' })}</FieldDescription>
            )}
          </Field>
        )}
        {error && (
          <FieldDescription className="text-danger-600" role="alert">
            {error}
          </FieldDescription>
        )}
      </FieldGroup>
    </FieldSet>
  )
}
