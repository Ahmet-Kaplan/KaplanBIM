'use client'

import { useState } from 'react'
import { Building2, MousePointerClick, MoveVertical, Plus } from 'lucide-react'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { MM_PER_FT } from '../placement'
import { useEditorTranslate } from '../i18n/translate'

export interface ExistingLevel {
  readonly id: string
  readonly name: string
  readonly elevationMm: number
}

const ftText = (mm: number) => String(Math.round((mm / MM_PER_FT) * 1000) / 1000)

/**
 * Model › Add level: a named storey at a floor elevation, typed, taken from
 * a surface (Pick a surface: click a roof or floor), or every storey of the
 * architect's model at once. Typing an existing level's name moves that level
 * instead. Esc or Cancel closes; nothing is saved until the button.
 */
export function AddLevelDialog({
  existing,
  initial,
  onCancel,
  onAdd,
  onMove,
  onPickSurface,
  onUseArchitect,
  onNameChange,
}: {
  readonly existing: readonly ExistingLevel[]
  /** A height (and suggested name) picked from a surface. */
  readonly initial?: { readonly name: string; readonly elevationMm: number; readonly from: string } | null
  readonly onCancel: () => void
  readonly onAdd: (name: string, elevationMm: number) => string | null
  /** Move an existing level to this height (absent: typing an existing name is refused). */
  readonly onMove?: (levelId: string, elevationMm: number) => string | null
  readonly onPickSurface?: () => void
  readonly onUseArchitect?: () => void
  /** The level the typed name is (for highlighting it in 3D); null when it names none. */
  readonly onNameChange?: (levelId: string | null) => void
}) {
  const t = useEditorTranslate()
  const highest = existing.reduce((m, l) => Math.max(m, l.elevationMm), -Infinity)
  const [name, setName] = useState(initial?.name ?? `Level ${existing.length + 1}`)
  const [elevation, setElevation] = useState(initial ? ftText(initial.elevationMm) : Number.isFinite(highest) ? String(Math.round(highest / MM_PER_FT + 12)) : '0')
  const [error, setError] = useState<string | null>(null)
  const same = existing.find((l) => l.name.toLowerCase() === name.trim().toLowerCase()) ?? null
  const rename = (v: string) => {
    setName(v)
    setError(null)
    onNameChange?.(existing.find((l) => l.name.toLowerCase() === v.trim().toLowerCase())?.id ?? null)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const ft = Number(elevation)
    if (name.trim() === '' || elevation.trim() === '' || !Number.isFinite(ft)) {
      setError(t('levels.giveNameAndElevation', 'Give the level a name and a floor elevation in feet.', { ns: 'editor' }))
      return
    }
    if (same && !onMove) {
      setError(t('levels.nameTaken', 'There is already a level called {{name}}. Pick another name.', { ns: 'editor', name: name.trim() }))
      return
    }
    const refusal = same && onMove ? onMove(same.id, ft * MM_PER_FT) : onAdd(name.trim(), ft * MM_PER_FT)
    if (refusal) setError(refusal)
    else onCancel()
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md" data-testid="add-level-dialog">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('levels.addALevel', 'Add a level', { ns: 'editor' })}</DialogTitle>
            <DialogDescription>{t('levels.partsSitOnLevel', 'Parts and routes sit on a level. You can undo this.', { ns: 'editor' })}</DialogDescription>
          </DialogHeader>
          {(onUseArchitect || onPickSurface) && (
            <div className="grid grid-cols-2 gap-2">
              {onUseArchitect && (
                <Button type="button" variant="outline" onClick={onUseArchitect} data-testid="add-level-from-architect">
                  <Building2 data-icon="inline-start" />
                  {t('levels.useArchitectLevels', "Use the architect's levels", { ns: 'editor' })}
                </Button>
              )}
              {onPickSurface && (
                <Button type="button" variant="outline" onClick={onPickSurface} data-testid="add-level-pick-surface">
                  <MousePointerClick data-icon="inline-start" />
                  {t('levels.pickASurface', 'Pick a surface', { ns: 'editor' })}
                </Button>
              )}
            </div>
          )}
          <FieldGroup className="grid grid-cols-2 gap-2">
            <Field>
              <FieldLabel htmlFor="bm-new-level-name">{t('levels.name', 'Name', { ns: 'editor' })}</FieldLabel>
              <Input id="bm-new-level-name" value={name} onChange={(e) => rename(e.target.value)} autoFocus />
            </Field>
            <Field>
              <FieldLabel htmlFor="bm-new-level-elev">{t('levels.floorFt', 'Floor (ft)', { ns: 'editor' })}</FieldLabel>
              <Input id="bm-new-level-elev" inputMode="decimal" value={elevation} onChange={(e) => setElevation(e.target.value)} />
            </Field>
          </FieldGroup>
          {initial && <FieldDescription data-testid="add-level-picked">{t('levels.heightTakenFromNamed', 'Height taken from {{from}}.', { ns: 'editor', from: initial.from })}</FieldDescription>}
          {same && onMove && (
            <FieldDescription>{t('levels.alreadyALevel', '{{name}} is already a level (at {{height}} ft); this moves it, with everything on it.', { ns: 'editor', name: same.name, height: ftText(same.elevationMm) })}</FieldDescription>
          )}
          {existing.length > 0 && (
            <FieldDescription>
              {t('levels.existing', 'Existing: {{levels}}', {
                ns: 'editor',
                levels: existing.map((l) => t('levels.nameAtHeight', '{{name}} at {{height}} ft', { ns: 'editor', name: l.name, height: ftText(l.elevationMm) })).join(', '),
              })}
            </FieldDescription>
          )}
          {error && (
            <FieldDescription className="text-danger-600" role="alert">
              {error}
            </FieldDescription>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('levels.cancel', 'Cancel', { ns: 'editor' })}
            </Button>
            <Button type="submit" data-testid="add-level-submit">
              {same && onMove ? <MoveVertical data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
              {same && onMove ? `Move ${same.name}` : t('levels.addLevel', 'Add level', { ns: 'editor' })}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
