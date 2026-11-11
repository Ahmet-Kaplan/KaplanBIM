'use client'

import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, Zap } from 'lucide-react'
import type { Command, ModelState } from '@permitzip/bim-kernel'
import { Alert, AlertDescription } from '../../ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../ui/alert-dialog'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '../../ui/input-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import { newElementId } from '../placement'
import { EstimateCountingField } from '../loads-policy/EstimateCountingField'
import { SpaceLoadsSections } from '../contributions/space-loads-sections'
import { useEditorTranslate } from '../i18n/translate'
import {
  addLoadCommand,
  editLoadCommand,
  figuresLine,
  libraryDensity,
  LOAD_QUANTITIES,
  loadQuantity,
  policyWords,
  removeLoadCommand,
  scopeFigures,
  scopeLoads,
  scopeNoun,
  scopeWord,
  type LoadBasisChoice,
  type LoadDraft,
  type LoadQuantityId,
  type LoadScope,
  type ScopeLoadRow,
} from './space-loads'

interface Props {
  /** The space or zone whose loads are open; null when closed. */
  readonly scope: LoadScope | null
  readonly model: ModelState
  readonly canEdit: boolean
  readonly blockedReason: string
  readonly submit: (command: Command, undoLabel: string) => string | null
  readonly onClose: () => void
  /** The project the model belongs to (add-ons' Loads sections read its tables); null or absent: none. */
  readonly projectId?: string | null
}

const BLANK: LoadDraft = { name: 'Lighting', quantityId: 'power', basis: 'lump', amount: '' }
const trimNumber = (v: number) => String(Math.round(v * 1000) / 1000)

/**
 * Loads on a space or zone (the product owner's decision 4): add a total ("Lighting 5 kW")
 * or a density ("1.5 W/ft²", from the space-use library), see the estimate
 * against the devices placed so far, change or remove each one. Every edit
 * goes through the one edit path with Undo; Esc closes with nothing changed.
 */
export function SpaceLoadsDialog({ scope, model, canEdit, blockedReason, submit, onClose, projectId }: Props) {
  const t = useEditorTranslate()
  const [draft, setDraft] = useState<LoadDraft>(BLANK)
  const [editing, setEditing] = useState<ScopeLoadRow | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [removing, setRemoving] = useState<ScopeLoadRow | null>(null)

  const rows = useMemo(() => (scope ? scopeLoads(model, scope, t) : []), [model, scope, t])
  const figures = useMemo(() => (scope ? scopeFigures(model, scope) : null), [model, scope])
  const q = loadQuantity(draft.quantityId)
  const library = scope && draft.basis === 'density' ? libraryDensity(model, scope, q, draft.name, t) : null
  const editReason = canEdit ? null : blockedReason
  const densityReason = q.density ? null : t('spaces.loadsAreTotals', '{{kind}} loads are typed as a total, not per square foot.', { ns: 'editor', kind: q.label(t) })

  const reset = () => {
    setDraft(BLANK)
    setEditing(null)
    setNotice(null)
  }
  const close = () => {
    reset()
    setRemoving(null)
    onClose()
  }

  const setBasis = (basis: LoadBasisChoice) => {
    if (basis === 'density' && scope) {
      const lib = libraryDensity(model, scope, q, draft.name, t)
      setDraft((current) => ({ ...current, basis, amount: typeof lib === 'string' ? '' : trimNumber(lib.typed) }))
    } else setDraft((current) => ({ ...current, basis, amount: '' }))
  }
  const setQuantity = (quantityId: LoadQuantityId) => {
    const next = loadQuantity(quantityId)
    setDraft((current) => ({ ...current, quantityId, basis: next.density ? current.basis : 'lump', amount: '' }))
  }

  const save = () => {
    if (!scope) return
    if (editing) {
      const command = editLoadCommand(editing, draft, t)
      if (command === null) {
        reset()
        return
      }
      if (typeof command === 'string') {
        setNotice(command)
        return
      }
      const refused = submit(command, t('spaces.changeNamed', 'Change {{name}}', { ns: 'editor', name: editing.name }))
      if (refused) setNotice(refused)
      else reset()
      return
    }
    const command = addLoadCommand(scope, draft, newElementId('load'), t)
    if (typeof command === 'string') {
      setNotice(command)
      return
    }
    const refused = submit(command, t('spaces.addNamedToScope', 'Add {{name}} to {{scope}}', { ns: 'editor', name: draft.name.trim(), scope: scope.label }))
    if (refused) setNotice(refused)
    else reset()
  }

  const startEdit = (row: ScopeLoadRow) => {
    setEditing(row)
    setNotice(null)
    setDraft({ name: row.name, quantityId: row.quantity.id, basis: row.basis, amount: trimNumber(row.typed) })
  }

  const unit = draft.basis === 'density' ? (q.density?.label(t) ?? q.lump.label(t)) : q.lump.label(t)
  const scopeWords = scopeWord(scope?.kind ?? 'space', t)

  return (
    <>
      <Dialog open={scope !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="sm:max-w-xl" data-testid="space-loads-dialog">
          <DialogHeader>
            <DialogTitle>{t('spaces.loadsOnNamed', 'Loads on {{scope}}', { ns: 'editor', scope: scope?.label ?? '' })}</DialogTitle>
            <DialogDescription>{policyWords(model, t)}</DialogDescription>
          </DialogHeader>
          {scope?.kind === 'space' && <EstimateCountingField model={model} spaceId={scope.id} canEdit={canEdit} blockedReason={blockedReason} submit={submit} />}

          <p className="text-sm" data-testid="space-loads-figures">
            {figures
              ? figuresLine(figures, t)
              : t('spaces.noEstimateYet', 'No estimate yet. Add the loads you know now; devices placed inside later count against them.', { ns: 'editor' })}
            {figures && scope?.kind === 'zone' ? (
              <span className="block text-xs text-muted-foreground">{t('spaces.zoneIncludesSpaceLoads', 'Includes the loads on the zone’s spaces; the list below is the zone’s own.', { ns: 'editor' })}</span>
            ) : null}
          </p>
          {scope?.kind === 'space' ? <SpaceLoadsSections model={model} spaceId={scope.id} projectId={projectId ?? null} /> : null}

          {rows.length === 0 ? (
            <Empty className="border py-4" data-testid="space-loads-empty">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Zap />
                </EmptyMedia>
                <EmptyTitle>{t('spaces.noLoadsOnNamed', 'No loads on {{scope}} yet', { ns: 'editor', scope: scope?.label ?? '' })}</EmptyTitle>
                <EmptyDescription>{t('spaces.typeATotalOrDensity', 'Type a total such as lighting 5 kW, or a density per square foot from the space’s use.', { ns: 'editor' })}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table data-testid="space-loads-table">
              <TableCaption className="sr-only">{t('spaces.loadsSpreadOverNamed', 'Loads spread over {{scope}}', { ns: 'editor', scope: scope?.label ?? '' })}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('spaces.loadColumn', 'Load', { ns: 'editor' })}</TableHead>
                  <TableHead>{t('spaces.amountColumn', 'Amount', { ns: 'editor' })}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t('spaces.actions', 'Actions', { ns: 'editor' })}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} data-testid="space-load-row" data-load={r.id} data-selected={editing?.id === r.id}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-xs tabular-nums">{r.text}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('spaces.changeNamed', 'Change {{name}}', { ns: 'editor', name: r.name })}
                        title={editReason ?? undefined}
                        disabled={editReason !== null}
                        onClick={() => startEdit(r)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('spaces.removeNamed', 'Remove {{name}}', { ns: 'editor', name: r.name })}
                        title={editReason ?? undefined}
                        disabled={editReason !== null}
                        onClick={() => setRemoving(r)}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <FieldGroup className="gap-3 border-t pt-3">
            <h3 className="text-sm font-medium">
              {editing ? t('spaces.changeNamed', 'Change {{name}}', { ns: 'editor', name: editing.name }) : t('spaces.addALoad', 'Add a load', { ns: 'editor' })}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="space-load-name">{t('spaces.name', 'Name', { ns: 'editor' })}</FieldLabel>
                <Input id="space-load-name" value={draft.name} maxLength={40} disabled={editReason !== null} onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))} data-testid="space-load-name" />
              </Field>
              <Field>
                <FieldLabel htmlFor="space-load-quantity">{t('spaces.kind', 'Kind', { ns: 'editor' })}</FieldLabel>
                <Select value={draft.quantityId} disabled={editReason !== null || editing !== null} onValueChange={(v) => setQuantity(LOAD_QUANTITIES.find((x) => x.id === v)?.id ?? 'power')}>
                  <SelectTrigger
                    id="space-load-quantity"
                    aria-label={t('spaces.kindOfLoad', 'Kind of load', { ns: 'editor' })}
                    title={editing ? t('spaces.toChangeKindRemoveFirst', 'To change the kind, remove this load and add another.', { ns: 'editor' }) : (editReason ?? undefined)}
                    data-testid="space-load-quantity"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {LOAD_QUANTITIES.map((x) => (
                        <SelectItem key={x.id} value={x.id}>
                          {x.label(t)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel>{t('spaces.typedAs', 'Typed as', { ns: 'editor' })}</FieldLabel>
              <ToggleGroup
                type="single"
                size="sm"
                variant="outline"
                value={draft.basis}
                disabled={editReason !== null}
                onValueChange={(v) => (v === 'lump' || v === 'density') && setBasis(v)}
                aria-label={t('spaces.typedAsTotalOrDensity', 'Typed as a total or per square foot', { ns: 'editor' })}
                data-testid="space-load-basis"
              >
                <ToggleGroupItem value="lump">{t('spaces.total', 'Total', { ns: 'editor' })}</ToggleGroupItem>
                <ToggleGroupItem
                  value="density"
                  disabled={densityReason !== null}
                  title={densityReason ?? t('spaces.perSquareFootOfScope', 'Per square foot of {{scope}}’s drawn area', { ns: 'editor', scope: scopeWords })}
                >
                  {t('spaces.perSqFt', 'Per sq ft', { ns: 'editor' })}
                </ToggleGroupItem>
              </ToggleGroup>
              {densityReason ? <FieldDescription>{densityReason}</FieldDescription> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="space-load-amount">{t('spaces.amountColumn', 'Amount', { ns: 'editor' })}</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="space-load-amount"
                  inputMode="decimal"
                  value={draft.amount}
                  disabled={editReason !== null}
                  onChange={(e) => setDraft((current) => ({ ...current, amount: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && save()}
                  data-testid="space-load-amount"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{unit}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              {draft.basis === 'density' && library ? (
                <FieldDescription data-testid="space-load-library">
                  {typeof library === 'string'
                    ? library
                    : t('spaces.fromTheLibrary', 'From the space-use library: {{amount}} {{unit}} ({{source}}).', { ns: 'editor', amount: trimNumber(library.typed), unit, source: library.source })}
                </FieldDescription>
              ) : draft.quantityId === 'power' && draft.basis === 'lump' ? (
                <FieldDescription>{t('spaces.countedAsVoltAmperes', 'Counted as volt-amperes at unity power factor: 1 kW = 1,000 VA.', { ns: 'editor' })}</FieldDescription>
              ) : null}
            </Field>
            {notice ? (
              <Alert variant="destructive" data-testid="space-loads-notice">
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            ) : null}
            {editReason ? <p className="text-xs text-muted-foreground" data-testid="space-loads-edit-reason">{editReason}</p> : null}
          </FieldGroup>

          <DialogFooter>
            {editing ? (
              <Button variant="outline" onClick={reset}>
                {t('spaces.cancelChange', 'Cancel change', { ns: 'editor' })}
              </Button>
            ) : (
              <Button variant="outline" onClick={close}>
                {t('spaces.close', 'Close', { ns: 'editor' })}
              </Button>
            )}
            <Button onClick={save} disabled={editReason !== null} title={editReason ?? undefined} data-testid="space-load-save">
              {editing ? null : <Plus data-icon="inline-start" />}
              {editing ? t('spaces.saveChange', 'Save change', { ns: 'editor' }) : t('spaces.addLoad', 'Add load', { ns: 'editor' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('spaces.removeNamedFromScope', 'Remove {{name}} from {{scope}}?', { ns: 'editor', name: removing?.name ?? '', scope: scope?.label ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('spaces.removeLoadWhat', 'The estimate comes off the {{scope}} and out of every total. Devices already placed stay. Undo puts it back.', { ns: 'editor', scope: scopeNoun(scope?.kind ?? 'space', t) })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('spaces.keepIt', 'Keep it', { ns: 'editor' })}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing && scope) {
                  const refused = submit(removeLoadCommand(removing), t('spaces.removeNamedFromNamed', 'Remove {{name}} from {{scope}}', { ns: 'editor', name: removing.name, scope: scope.label }))
                  setNotice(refused)
                  if (!refused && editing?.id === removing.id) reset()
                }
                setRemoving(null)
              }}
            >
              {t('spaces.remove', 'Remove', { ns: 'editor' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
