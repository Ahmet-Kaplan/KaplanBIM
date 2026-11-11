'use client'

import { useState } from 'react'
import { Save, ShieldCheck, Trash2 } from 'lucide-react'
import { dedicatedSpaceZone } from '@permitzip/bim-pack-electrical'
import { partClearances, type ClearanceOverride, type ModelState, type PartInstance } from '@permitzip/bim-kernel'
import { Button } from '../../ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import type { SubmitCommand } from '../views-sheets/types'
import { useEditorTranslate } from '../i18n/translate'

const MM_PER_FT = 304.8
const ft = (mm: number) => String(Math.round((mm / MM_PER_FT) * 100) / 100)

/** The placed part's override that adds the NEC 110.26(E) dedicated space (the shared clearance model's dedicated variant). */
export function dedicatedSpaceOverride(extra: Pick<ClearanceOverride, 'suspendedCeilingMm' | 'structureMm'> = {}): { readonly id: string; readonly override: ClearanceOverride } {
  const z = dedicatedSpaceZone(null)
  return {
    id: z.id,
    override: { name: z.name, purpose: z.purpose, face: z.face, depth: typeof z.depth === 'number' ? z.depth : 1828.8, excludes: 'foreign_systems', toStructure: true, endsAtSuspendedCeiling: true, ...(z.cite ? { cite: z.cite } : {}), ...extra },
  }
}

/**
 * The dedicated space above a panel (NEC 110.26(E)(1)(a)): turn it on, and say
 * what is over the panel (a suspended ceiling with removable panels, the
 * structure) so the coordination check ends the zone there. Ducts and pipes in
 * it show in Coordination with the clause.
 */
export function DedicatedSpaceForm({ model, part, canEdit, editBlocked, submit }: { readonly model: ModelState; readonly part: PartInstance; readonly canEdit: boolean; readonly editBlocked: string | null; readonly submit: SubmitCommand }) {
  const t = useEditorTranslate()
  const zone = partClearances(model, part).find((z) => z.excludes === 'foreign_systems')
  const [ceiling, setCeiling] = useState(zone?.suspendedCeilingMm !== undefined ? ft(zone.suspendedCeilingMm) : '')
  const [structure, setStructure] = useState(zone?.structureMm !== undefined ? ft(zone.structureMm) : '')
  const [error, setError] = useState<string | null>(null)
  const name = part.mark || part.id
  const send = (overrides: Record<string, ClearanceOverride | null>, label: string) => setError(submit({ type: 'set_part_clearances', id: part.id, scope: 'instance', overrides }, label))
  if (!zone) {
    const { id, override } = dedicatedSpaceOverride()
    return (
      <div className="flex flex-col gap-1" data-testid="dedicated-space">
        <Button variant="outline" size="sm" disabled={!canEdit} title={canEdit ? t('electrical.ductsAndPipesAreKeptOutOfTheSpace6FtAboveItO', 'Ducts and pipes are kept out of the space 6 ft above it (or to the structure), as NEC 110.26(E) requires', { ns: 'editor' }) : (editBlocked ?? undefined)} onClick={() => send({ [id]: override }, t('electrical.keepTheSpaceAboveNameClear', 'keep the space above {{name}} clear', { ns: 'editor', name }))} data-testid="dedicated-space-add">
          <ShieldCheck data-icon="inline-start" />
          {t('electrical.keepTheSpaceAboveClearNEC11026E', 'Keep the space above clear (NEC 110.26(E))', { ns: 'editor' })}
        </Button>
        {error && (
          <span className="text-xs text-danger-600" role="alert">
            {error}
          </span>
        )}
      </div>
    )
  }
  const parse = (v: string) => (v.trim() === '' ? null : Number(v))
  const c = parse(ceiling)
  const s = parse(structure)
  const bad = (c !== null && (!Number.isFinite(c) || c <= 0)) || (s !== null && (!Number.isFinite(s) || s <= 0))
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (bad) return
    const { override } = dedicatedSpaceOverride({ ...(c !== null ? { suspendedCeilingMm: c * MM_PER_FT } : {}), ...(s !== null ? { structureMm: s * MM_PER_FT } : {}) })
    send({ [zone.id]: override }, t('electrical.sayWhatIsAboveName', 'say what is above {{name}}', { ns: 'editor', name }))
  }
  return (
    <form className="flex flex-col gap-2 rounded-md border p-2" onSubmit={save} data-testid="dedicated-space">
      <FieldDescription className="text-xs">
        {t('electrical.dedicatedSpaceAboveNameItsFootprint', 'Dedicated space above {{name}}: its footprint, 6 ft up from its top or to the structure if lower, kept free of ducts and pipes ({{cite}}). A suspended ceiling with removable panels ends it.', {
          ns: 'editor',
          name,
          cite: zone.cite ?? 'NEC 110.26(E)(1)(a)',
        })}
      </FieldDescription>
      <FieldGroup className="grid grid-cols-2 gap-2">
        <Field>
          <FieldLabel htmlFor={`bm-ded-ceiling-${part.id}`} className="text-xs">
            {t('electrical.suspendedCeilingFtAboveFloor', 'Suspended ceiling (ft above floor)', { ns: 'editor' })}
          </FieldLabel>
          <Input id={`bm-ded-ceiling-${part.id}`} inputMode="decimal" placeholder={t('electrical.nonePlaceholder', 'none', { ns: 'editor' })} value={ceiling} onChange={(e) => setCeiling(e.target.value)} disabled={!canEdit} data-testid="dedicated-space-ceiling" />
        </Field>
        <Field>
          <FieldLabel htmlFor={`bm-ded-structure-${part.id}`} className="text-xs">
            {t('electrical.structureAboveFtAboveFloor', 'Structure above (ft above floor)', { ns: 'editor' })}
          </FieldLabel>
          <Input id={`bm-ded-structure-${part.id}`} inputMode="decimal" placeholder={t('electrical.fromTheModel', 'from the model', { ns: 'editor' })} value={structure} onChange={(e) => setStructure(e.target.value)} disabled={!canEdit} data-testid="dedicated-space-structure" />
        </Field>
      </FieldGroup>
      {bad && <FieldDescription className="text-xs text-danger-600">{t('electrical.heightsAreFeetAboveTheFloorNumbersAbove0', 'Heights are feet above the floor, numbers above 0.', { ns: 'editor' })}</FieldDescription>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="outline" disabled={!canEdit || bad} title={canEdit ? undefined : (editBlocked ?? undefined)} data-testid="dedicated-space-save">
          <Save data-icon="inline-start" />
          {t('electrical.save', 'Save', { ns: 'editor' })}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={!canEdit} title={canEdit ? undefined : (editBlocked ?? undefined)} onClick={() => send({ [zone.id]: null }, t('electrical.stopKeepingTheSpaceAboveNameClear', 'stop keeping the space above {{name}} clear', { ns: 'editor', name }))} data-testid="dedicated-space-remove">
          <Trash2 data-icon="inline-start" />
          {t('electrical.remove', 'Remove', { ns: 'editor' })}
        </Button>
      </div>
      {error && (
        <span className="text-xs text-danger-600" role="alert">
          {error}
        </span>
      )}
    </form>
  )
}
