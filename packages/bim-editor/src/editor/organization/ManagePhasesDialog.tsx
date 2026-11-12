'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { DEFAULT_PHASE_ID, organizationOf, type ModelState } from '@permitzip/bim-kernel'
import { Alert, AlertDescription } from '../../ui/alert'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Item, ItemActions, ItemContent, ItemGroup } from '../../ui/item'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'
import { useEditorTranslate } from '../i18n/translate'
import { newId, type SubmitCommand } from '../views-sheets/types'

interface Props {
  readonly model: ModelState
  readonly canEdit: boolean
  readonly blockedReason: string
  readonly submit: SubmitCommand
  readonly onClose: () => void
}

/** The model's phases in time order: add, rename, reorder, delete. */
export function ManagePhasesDialog({ model, canEdit, blockedReason, submit, onClose }: Props) {
  const t = useEditorTranslate()
  const org = organizationOf(model)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const run = (refusal: string | null) => {
    setError(refusal)
    return refusal
  }
  const phases = org.phases
  const moveUp = (i: number) => {
    const p = phases[i]
    if (!p) return
    run(
      submit(
        { type: 'update_phase', phaseId: p.id, after: i >= 2 ? (phases[i - 2]?.id ?? null) : null },
        t('org.undo.moveEarlier', 'move {{name}} earlier', { ns: 'editor', name: p.entry.name }),
      ),
    )
  }
  const moveDown = (i: number) => {
    const p = phases[i]
    const next = phases[i + 1]
    if (!p || !next) return
    run(submit({ type: 'update_phase', phaseId: p.id, after: next.id }, t('org.undo.moveLater', 'move {{name}} later', { ns: 'editor', name: p.entry.name })))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="manage-phases-dialog">
        <DialogHeader>
          <DialogTitle>{t('org.phases.title', 'Phases', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>
            {t(
              'org.phases.description',
              "Phases are steps in time, earliest first. Each element is built in one phase and may be demolished in a later one; each view shows the model as of its phase.",
              { ns: 'editor' },
            )}
          </DialogDescription>
        </DialogHeader>
        {!canEdit && (
          <Alert>
            <AlertDescription>{blockedReason}</AlertDescription>
          </Alert>
        )}
        <ItemGroup>
          {phases.map((p, i) => (
            <Item key={p.id} variant="outline" size="sm" data-testid={`manage-phase-${p.id}`}>
              <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}</span>
              <ItemContent>
                <Input
                  key={`${p.id}:${p.entry.name}`}
                  aria-label={t('org.phases.name', 'Phase name', { ns: 'editor' })}
                  defaultValue={p.entry.name}
                  disabled={!canEdit}
                  className="h-8"
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  onBlur={(e) => {
                    const name = e.target.value.trim()
                    if (name && name !== p.entry.name) run(submit({ type: 'update_phase', phaseId: p.id, name }, t('org.undo.renameTo', 'rename {{from}} to {{to}}', { ns: 'editor', from: p.entry.name, to: name })))
                  }}
                />
              </ItemContent>
              <ItemActions>
                {org.activePhaseId === p.id ? (
                  <Badge variant="secondary">{t('org.active', 'Active', { ns: 'editor' })}</Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canEdit}
                    onClick={() => run(submit({ type: 'set_active_phase', phaseId: p.id }, t('org.undo.workIn', 'work in {{name}}', { ns: 'editor', name: p.entry.name })))}
                  >
                    {t('org.makeActive', 'Make active', { ns: 'editor' })}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('org.phases.moveEarlier', 'Move {{name}} earlier', { ns: 'editor', name: p.entry.name })}
                  disabled={!canEdit || i === 0}
                  onClick={() => moveUp(i)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('org.phases.moveLater', 'Move {{name}} later', { ns: 'editor', name: p.entry.name })}
                  disabled={!canEdit || i === phases.length - 1}
                  onClick={() => moveDown(i)}
                >
                  <ArrowDown />
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('org.deleteNamed', 'Delete {{name}}', { ns: 'editor', name: p.entry.name })}
                        disabled={!canEdit || p.id === DEFAULT_PHASE_ID || phases.length <= 1}
                        onClick={() => run(submit({ type: 'delete_phase', phaseId: p.id }, t('org.undo.deletePhase', 'delete phase {{name}}', { ns: 'editor', name: p.entry.name })))}
                      >
                        <Trash2 />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {p.id === DEFAULT_PHASE_ID
                      ? t('org.phases.defaultHolds', 'Elements without a phase are built here, so it stays. Rename it instead.', { ns: 'editor' })
                      : t('org.phases.deleteHint', 'Delete {{name}} (only when nothing and no view uses it; undo brings it back)', { ns: 'editor', name: p.entry.name })}
                  </TooltipContent>
                </Tooltip>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const name = draft.trim()
            if (name && !run(submit({ type: 'create_phase', phaseId: newId('phase'), name }, t('org.undo.addPhase', 'add phase {{name}}', { ns: 'editor', name })))) setDraft('')
          }}
        >
          <Field className="flex-1">
            <FieldLabel htmlFor="new-phase-name">{t('org.phases.new', 'New phase (added last)', { ns: 'editor' })}</FieldLabel>
            <Input
              id="new-phase-name"
              value={draft}
              placeholder={t('org.phases.newPlaceholder', 'e.g. Phase 2', { ns: 'editor' })}
              disabled={!canEdit}
              onChange={(e) => setDraft(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={!canEdit || draft.trim() === ''}>
            <Plus data-icon="inline-start" />
            {t('org.phases.add', 'Add phase', { ns: 'editor' })}
          </Button>
        </form>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('org.done', 'Done', { ns: 'editor' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
