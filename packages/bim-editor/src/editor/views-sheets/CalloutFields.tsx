'use client'

import { useState } from 'react'
import { ExternalLink, Trash2 } from 'lucide-react'
import { calloutHead, documentIndex, type CalloutSpec, type DrawingItem, type ModelState, type ViewElement } from '@permitzip/bim-kernel'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../../ui/empty'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { useEditorTranslate, type Translate } from '../i18n/translate'

/** Views a callout can refer to: plans, sections and detail views, other than the one it is drawn in. */
export function calloutTargets(model: ModelState, ownerId: string): ViewElement[] {
  return documentIndex(model)
    .views.filter((v) => v.id !== ownerId && v.viewType !== 'schedule' && v.viewType !== 'three_d')
    .sort((a, b) => a.name.localeCompare(b.name))
}

function placedText(model: ModelState, view: ViewElement, t: Translate): string {
  const head = calloutHead(model, { viewId: view.id })
  return head.resolved
    ? t('callout.placedOn', '{{name}} (view {{view}} on {{sheet}})', { ns: 'editor', name: view.name, view: head.top, sheet: head.bottom })
    : t('callout.placedNowhere', '{{name}} (not on a sheet yet)', { ns: 'editor', name: view.name })
}

function ViewPicker({ model, ownerId, value, onChange, disabled }: { model: ModelState; ownerId: string; value: string; onChange: (viewId: string) => void; disabled?: boolean }) {
  const t = useEditorTranslate()
  const views = calloutTargets(model, ownerId)
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id="callout-view" size="sm" data-testid="callout-view-select">
        <SelectValue placeholder={t('callout.pickEnlargedView', 'Pick the enlarged view', { ns: 'editor' })} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {views.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {placedText(model, v, t)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

interface DialogProps {
  readonly model: ModelState
  readonly ownerId: string
  readonly open: boolean
  readonly onCancel: () => void
  readonly onPlace: (spec: CalloutSpec) => void
}

/** After the box is dragged: which view the callout refers to, and an optional head label. Esc or Cancel saves nothing. */
export function CalloutViewDialog({ model, ownerId, open, onCancel, onPlace }: DialogProps) {
  const t = useEditorTranslate()
  const [viewId, setViewId] = useState('')
  const [label, setLabel] = useState('')
  const views = calloutTargets(model, ownerId)
  const picked = views.find((v) => v.id === viewId)
  const reason =
    views.length === 0
      ? t('callout.noOtherView', 'There is no other plan, section or detail view to refer to. Make the enlarged view first.', { ns: 'editor' })
      : !picked
        ? t('callout.pickTheView', 'Pick the view this callout refers to.', { ns: 'editor' })
        : null
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent data-testid="callout-dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('callout.title', 'Callout', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>
            {t(
              'callout.description',
              'The head shows the view’s number and the sheet it is on, and updates when the view moves to another sheet.',
              { ns: 'editor' },
            )}
          </DialogDescription>
        </DialogHeader>
        {views.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t('callout.noView', 'No view to refer to', { ns: 'editor' })}</EmptyTitle>
              <EmptyDescription>
                {t('callout.noViewWhy', 'Make the enlarged plan or section first (Views → New view), then draw the callout again.', { ns: 'editor' })}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel htmlFor="callout-view">{t('callout.refersTo', 'Refers to', { ns: 'editor' })}</FieldLabel>
              <ViewPicker model={model} ownerId={ownerId} value={viewId} onChange={setViewId} />
            </Field>
            <Field>
              <FieldLabel htmlFor="callout-label">{t('callout.headLabel', 'Head label (optional)', { ns: 'editor' })}</FieldLabel>
              <Input id="callout-label" value={label} maxLength={12} placeholder="EEP" onChange={(e) => setLabel(e.target.value)} data-testid="callout-label" />
              <FieldDescription>
                {t('callout.headLabelWhy', 'Left empty, the head shows the view’s number on its sheet.', { ns: 'editor' })}
              </FieldDescription>
            </Field>
          </FieldGroup>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('callout.cancel', 'Cancel', { ns: 'editor' })}
          </Button>
          <Button
            disabled={reason !== null}
            title={reason ?? undefined}
            onClick={() => picked && onPlace({ viewId: picked.id, ...(label.trim() ? { label: label.trim() } : {}) })}
            data-testid="callout-place"
          >
            {t('callout.place', 'Place callout', { ns: 'editor' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface PropsPanel {
  readonly item: DrawingItem
  readonly model: ModelState
  readonly canEdit: boolean
  readonly blockedReason: string
  readonly onChange: (spec: CalloutSpec) => void
  readonly onOpenView: (viewId: string) => void
  readonly onDelete: () => void
}

/** A selected callout: what it refers to and what its head reads right now, with a way to go to that view. */
export function CalloutProperties({ item, model, canEdit, blockedReason, onChange, onOpenView, onDelete }: PropsPanel) {
  const t = useEditorTranslate()
  const spec = item.callout
  if (!spec) return null
  const head = calloutHead(model, spec)
  const target = model.elements[spec.viewId]
  return (
    <FieldGroup className="gap-3" data-testid="callout-properties">
      <Field>
        <FieldLabel>{t('callout.headReads', 'Head reads', { ns: 'editor' })}</FieldLabel>
        <p className="text-sm" data-testid="callout-head">
          {head.top} / {head.bottom}
        </p>
        <FieldDescription>
          {head.resolved
            ? t('callout.onSheet', '{{name}} is on sheet {{number}}.', { ns: 'editor', name: head.viewName, number: head.bottom })
            : head.viewName
              ? t('callout.notOnSheetYet', '{{name}} is on no sheet yet: the head shows — until it is placed.', { ns: 'editor', name: head.viewName })
              : t('callout.targetDeleted', 'The view it referred to was deleted. Pick another.', { ns: 'editor' })}
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="callout-view">{t('callout.refersTo', 'Refers to', { ns: 'editor' })}</FieldLabel>
        <ViewPicker model={model} ownerId={item.ownerId} value={target?.kind === 'view' && !target.deleted ? spec.viewId : ''} onChange={(viewId) => onChange({ ...spec, viewId })} disabled={!canEdit} />
        {!canEdit && <FieldDescription>{blockedReason}</FieldDescription>}
      </Field>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={target?.kind !== 'view' || target.deleted === true} onClick={() => onOpenView(spec.viewId)} data-testid="callout-open-view">
          <ExternalLink data-icon="inline-start" />
          {t('callout.openTheView', 'Open the view', { ns: 'editor' })}
        </Button>
        <Button variant="outline" size="sm" disabled={!canEdit} title={canEdit ? undefined : blockedReason} onClick={onDelete}>
          <Trash2 data-icon="inline-start" />
          {t('callout.delete', 'Delete', { ns: 'editor' })}
        </Button>
      </div>
    </FieldGroup>
  )
}
