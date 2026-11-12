'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { DEFAULT_PHASE_FILTER_ID, PHASE_DISPLAYS, PHASE_STATUSES, organizationOf, type ModelState, type PhaseStatus } from '@permitzip/bim-kernel'
import { Alert, AlertDescription } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'
import { useEditorTranslate } from '../i18n/translate'
import { newId, type SubmitCommand } from '../views-sheets/types'
import { phaseDisplayLabel, phaseStatusLabel } from './labels'

interface Props {
  readonly model: ModelState
  readonly canEdit: boolean
  readonly blockedReason: string
  readonly submit: SubmitCommand
  readonly onClose: () => void
}

/** Phase filters: for each, how new, existing, demolished and temporary elements draw. */
export function PhaseFiltersDialog({ model, canEdit, blockedReason, submit, onClose }: Props) {
  const t = useEditorTranslate()
  const org = organizationOf(model)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const run = (refusal: string | null) => {
    setError(refusal)
    return refusal
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl" data-testid="phase-filters-dialog">
        <DialogHeader>
          <DialogTitle>{t('org.filters.title', 'Phase filters', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>
            {t('org.filters.description', "A view picks one filter. It decides how each element draws, by where it stands in the view's phase.", { ns: 'editor' })}
          </DialogDescription>
        </DialogHeader>
        {!canEdit && (
          <Alert>
            <AlertDescription>{blockedReason}</AlertDescription>
          </Alert>
        )}
        <Table>
          <TableCaption className="sr-only">
            {t('org.filters.tableCaption', 'How each phase filter draws new, existing, demolished and temporary elements', { ns: 'editor' })}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t('org.filters.filter', 'Filter', { ns: 'editor' })}</TableHead>
              {PHASE_STATUSES.map((s) => (
                <TableHead key={s}>
                  <Tooltip>
                    <TooltipTrigger className="underline decoration-dotted underline-offset-2">{phaseStatusLabel(s, t).label}</TooltipTrigger>
                    <TooltipContent>{phaseStatusLabel(s, t).hint}</TooltipContent>
                  </Tooltip>
                </TableHead>
              ))}
              <TableHead className="w-10">
                <span className="sr-only">{t('org.delete', 'Delete', { ns: 'editor' })}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {org.filters.map((f) => (
              <TableRow key={f.id} data-testid={`phase-filter-${f.id}`}>
                <TableCell>
                  <Input
                    key={`${f.id}:${f.entry.name}`}
                    aria-label={t('org.filters.name', 'Filter name', { ns: 'editor' })}
                    defaultValue={f.entry.name}
                    disabled={!canEdit}
                    className="h-8 min-w-36"
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    onBlur={(e) => {
                      const name = e.target.value.trim()
                      if (name && name !== f.entry.name) run(submit({ type: 'update_phase_filter', filterId: f.id, name }, t('org.undo.renameTo', 'rename {{from}} to {{to}}', { ns: 'editor', from: f.entry.name, to: name })))
                    }}
                  />
                </TableCell>
                {PHASE_STATUSES.map((s: PhaseStatus) => (
                  <TableCell key={s}>
                    <Select
                      value={f.entry.statuses[s]}
                      disabled={!canEdit}
                      onValueChange={(v) => {
                        const next = PHASE_DISPLAYS.find((x) => x === v)
                        if (next)
                          run(
                            submit(
                              { type: 'update_phase_filter', filterId: f.id, statuses: { [s]: next } },
                              t('org.undo.statusAs', '{{filter}}: {{status}} as {{display}}', {
                                ns: 'editor',
                                filter: f.entry.name,
                                status: phaseStatusLabel(s, t).label.toLowerCase(),
                                display: phaseDisplayLabel(next, t).toLowerCase(),
                              }),
                            ),
                          )
                      }}
                    >
                      <SelectTrigger
                        size="sm"
                        aria-label={t('org.filters.statusAria', '{{filter}}: {{status}} elements', { ns: 'editor', filter: f.entry.name, status: phaseStatusLabel(s, t).label })}
                        data-testid={`phase-filter-${f.id}-${s}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {PHASE_DISPLAYS.map((d) => (
                            <SelectItem key={d} value={d}>
                              {phaseDisplayLabel(d, t)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </TableCell>
                ))}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('org.deleteNamed', 'Delete {{name}}', { ns: 'editor', name: f.entry.name })}
                    disabled={!canEdit || org.filters.length <= 1}
                    onClick={() => run(submit({ type: 'delete_phase_filter', filterId: f.id }, t('org.undo.deleteFilter', 'delete filter {{name}}', { ns: 'editor', name: f.entry.name })))}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const name = draft.trim()
            if (!name) return
            const refusal = run(
              submit(
                { type: 'create_phase_filter', filterId: newId('pf'), name, statuses: { new: 'show', existing: 'halftone', demolished: 'dashed', temporary: 'show' } },
                t('org.undo.addFilter', 'add filter {{name}}', { ns: 'editor', name }),
              ),
            )
            if (!refusal) setDraft('')
          }}
        >
          <Field className="flex-1">
            <FieldLabel htmlFor="new-filter-name">
              {t('org.filters.new', 'New filter (starts like {{name}})', {
                ns: 'editor',
                name: org.filterById.get(DEFAULT_PHASE_FILTER_ID)?.entry.name ?? t('org.filters.showAll', 'Show all', { ns: 'editor' }),
              })}
            </FieldLabel>
            <Input
              id="new-filter-name"
              value={draft}
              placeholder={t('org.filters.newPlaceholder', 'e.g. Demolition plan', { ns: 'editor' })}
              disabled={!canEdit}
              onChange={(e) => setDraft(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={!canEdit || draft.trim() === ''}>
            <Plus data-icon="inline-start" />
            {t('org.filters.add', 'Add filter', { ns: 'editor' })}
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
