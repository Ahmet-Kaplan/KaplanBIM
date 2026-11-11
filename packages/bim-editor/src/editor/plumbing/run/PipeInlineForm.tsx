'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { fittingFamilies, familyMismatch, type Command, type FittingFamily, type ModelState, type RunSegment } from '@permitzip/bim-kernel'
import { Button } from '../../../ui/button'
import { Field, FieldDescription, FieldLabel } from '../../../ui/field'
import { Input } from '../../../ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../../../ui/select'
import { useEditorTranslate, type Translate } from '../../i18n/translate'

const MM_PER_FT = 304.8

type AccessoryKind = NonNullable<NonNullable<FittingFamily['pipe']>['accessory']>

/** The one refusal every plumbing surface says when the model is open read-only. */
const notLive = (t: Translate): string => t('plumbing.notLive', "Live editing isn't connected, so changes can't be saved", { ns: 'editor' })

/** How a plumber looks for an inline item (review video V1 3:12: "a menu of these kind of fittings"). */
const GROUPS: readonly { readonly key: InlineGroupKey; readonly kinds: readonly AccessoryKind[] }[] = [
  { key: 'fittings', kinds: ['coupling', 'union'] },
  { key: 'cleanouts', kinds: ['cleanout', 'test_tee'] },
  { key: 'valves', kinds: ['valve', 'prv'] },
  { key: 'traps', kinds: ['trap'] },
  { key: 'gas', kinds: ['gas_cock', 'drip_leg'] },
]

type InlineGroupKey = 'fittings' | 'cleanouts' | 'valves' | 'traps' | 'gas' | 'other'

/** A group's heading in words — a `label(t)` accessor, not a table frozen in one language. */
function groupWord(key: InlineGroupKey, t: Translate): string {
  switch (key) {
    case 'fittings':
      return t('plumbing.inline.fittings', 'Fittings', { ns: 'editor' })
    case 'cleanouts':
      return t('plumbing.inline.cleanouts', 'Cleanouts', { ns: 'editor' })
    case 'valves':
      return t('plumbing.inline.valves', 'Valves', { ns: 'editor' })
    case 'traps':
      return t('plumbing.inline.traps', 'Traps', { ns: 'editor' })
    case 'gas':
      return t('plumbing.inline.gas', 'Gas', { ns: 'editor' })
    case 'other':
      return t('plumbing.inline.other', 'Other', { ns: 'editor' })
  }
}

/** The inline items this pipe takes, by group; empty groups are left out. */
export function inlineChoices(segment: RunSegment, model: ModelState): { key: InlineGroupKey; families: FittingFamily[] }[] {
  const system = model.elements[segment.systemId]
  if (system?.kind !== 'mep_system') return []
  const fits = fittingFamilies().filter((f) => f.fittingTypes.includes('accessory') && familyMismatch(f, { fittingType: 'accessory', domain: 'pipe', sizes: [segment.size], systemKind: system.systemKind }) === null)
  const grouped = GROUPS.map((g) => ({ key: g.key, families: fits.filter((f) => f.pipe?.accessory !== undefined && g.kinds.includes(f.pipe.accessory)) }))
  const rest = fits.filter((f) => !GROUPS.some((g) => f.pipe?.accessory !== undefined && g.kinds.includes(f.pipe.accessory)))
  return [...grouped, ...(rest.length > 0 ? [{ key: 'other' as const, families: rest }] : [])].filter((g) => g.families.length > 0)
}

/**
 * Add inline on the selected pipe: cleanouts, test tees, traps, valves,
 * couplings and gas items, grouped, at the top of the pipe's properties.
 * Placed at the given distance from the pipe's start (the middle by default);
 * drag it in the view to slide it along the pipe.
 */
export function PipeInlineForm({ segment, model, canEdit, onCommand }: { segment: RunSegment; model: ModelState; canEdit: boolean; onCommand: (command: Command) => string | null }) {
  const t = useEditorTranslate()
  const length = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y, segment.end.z - segment.start.z)
  const [family, setFamily] = useState<string | undefined>(undefined)
  const [at, setAt] = useState(String(Math.round((length / 2 / MM_PER_FT) * 100) / 100))
  const [error, setError] = useState<string | null>(null)
  const groups = inlineChoices(segment, model)
  if (groups.length === 0) return null
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const ft = Number(at)
    if (!family) {
      setError(t('plumbing.chooseWhatToAdd', 'Choose what to add.', { ns: 'editor' }))
      return
    }
    if (!(ft > 0)) {
      setError(t('plumbing.enterHowFarAlongThePipe', 'Enter how far along the pipe, in feet from its start.', { ns: 'editor' }))
      return
    }
    // The id is built outside the call so a machine name cannot read as words to the caption scan.
    const accessoryId = `acc-${segment.id}-${Date.now().toString(36)}`
    setError(onCommand({ type: 'place_run_accessory', accessoryId, segmentId: segment.id, atMm: Math.round(ft * MM_PER_FT * 1000) / 1000, family }))
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2" data-testid="pipe-accessory">
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <Field>
          <FieldLabel htmlFor="bm-pipe-accessory">{t('plumbing.addInline', 'Add inline', { ns: 'editor' })}</FieldLabel>
          <Select value={family} onValueChange={setFamily} disabled={!canEdit}>
            <SelectTrigger id="bm-pipe-accessory" size="sm" title={canEdit ? undefined : notLive(t)}>
              <SelectValue placeholder={t('plumbing.cleanoutTrapValve', 'Cleanout, trap, valve…', { ns: 'editor' })} />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectGroup key={g.key}>
                  <SelectLabel>{groupWord(g.key, t)}</SelectLabel>
                  {g.families.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="bm-pipe-accessory-at">{t('plumbing.ftFromStart', 'Ft from start', { ns: 'editor' })}</FieldLabel>
          <Input id="bm-pipe-accessory-at" inputMode="decimal" value={at} onChange={(e) => setAt(e.target.value)} disabled={!canEdit} />
        </Field>
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={!canEdit} title={canEdit ? undefined : notLive(t)}>
        <Plus data-icon="inline-start" />
        {t('plumbing.addToThisPipe', 'Add to this pipe', { ns: 'editor' })}
      </Button>
      {error ? (
        <FieldDescription className="text-danger-600" role="alert">
          {error}
        </FieldDescription>
      ) : (
        <FieldDescription>{t('plumbing.dragItInTheView', 'Drag it in the view afterwards to slide it along the pipe.', { ns: 'editor' })}</FieldDescription>
      )}
    </form>
  )
}
