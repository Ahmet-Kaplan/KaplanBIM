'use client'

import { useMemo, useState } from 'react'
import { FilePlus2, FileStack, RefreshCw } from 'lucide-react'
import { isSubmittalRecord, SUBMITTAL_REVIEW_LABELS, SUBMITTAL_REVIEW_STATES, type ElementId, type ModelState, type SubmittalCommand } from '@permitzip/bim-kernel'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Skeleton } from '../../ui/skeleton'
import { Textarea } from '../../ui/textarea'
import { submittalRows, type SubmittalItemRow, type SubmittalRow } from './submittal-rows'
import { useEditorTranslate } from '../i18n/translate'

export interface SubmittalsPanelProps {
  readonly model: ModelState | null
  readonly error?: string | null
  readonly onRetry?: () => void
  readonly canEdit: boolean
  readonly blockedReason: string
  /** The session's one edit path: the model's refusal in words, or null. */
  readonly submit: (command: SubmittalCommand, undoLabel: string) => string | null
  readonly selection: readonly ElementId[]
  readonly selectionLabel: string
}

type Reviewable = (typeof SUBMITTAL_REVIEW_STATES)[number]

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Building Model › rail › Submittals: product data and shop drawings offered
 * for elements or a type, reviewed item by item, beside the design. An
 * approved substitution is recorded as a difference from the design; the
 * design itself changes only through a branch (the element's Inspector badge
 * offers "Update design to match"). No dates, no prices.
 */
export function SubmittalsPanel({ model, error, onRetry, canEdit, blockedReason, submit, selection, selectionLabel }: SubmittalsPanelProps) {
  const t = useEditorTranslate()
  const rows = useMemo(() => (model ? submittalRows(model, t) : []), [model, t])
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [items, setItems] = useState('')
  const [substituting, setSubstituting] = useState<{ readonly row: SubmittalRow; readonly item: SubmittalItemRow } | null>(null)
  const [product, setProduct] = useState('')
  const [notes, setNotes] = useState('')
  const [responsible, setResponsible] = useState('')
  const [refusal, setRefusal] = useState<string | null>(null)

  const editReason = canEdit ? null : blockedReason
  const newReason = editReason ?? (selection.length === 0 ? t('submittals.selectFirst', 'Select the elements (or one of the type) the submittal is for first.', { ns: 'editor' }) : null)

  const send = (command: SubmittalCommand, label: string): boolean => {
    const refused = submit(command, label)
    setRefusal(refused)
    return refused === null
  }

  const closeNew = () => {
    setCreating(false)
    setTitle('')
    setItems('')
    setRefusal(null)
  }
  const closeSub = () => {
    setSubstituting(null)
    setProduct('')
    setNotes('')
    setResponsible('')
    setRefusal(null)
  }

  const saveNew = () => {
    const lines = items.split('\n').map((l) => l.trim()).filter(Boolean)
    const list = (lines.length > 0 ? lines : [t('submittals.productData', 'Product data', { ns: 'editor' })]).map((label, i) => ({ id: String(i + 1), label }))
    if (send({ type: 'add_submittal', submittalId: newId('sub'), title: title.trim(), offeredFor: { elementIds: [...selection] }, items: list }, t('submittals.newSubmittal', 'New submittal', { ns: 'editor' }))) closeNew()
  }

  const saveSub = () => {
    if (!substituting || !model) return
    const s: { readonly kind: string } | undefined = model.elements[substituting.row.id]
    const basis = isSubmittalRecord(s) ? s.submittal.offeredFor : null
    const ok = send(
      {
        type: 'record_divergence',
        divergenceId: newId('div'),
        designBasis: { ...(basis?.elementIds?.length ? { elementIds: [...basis.elementIds] } : {}), ...(basis?.typeIds?.length ? { typeIds: [...basis.typeIds] } : {}) },
        approvedProduct: { label: product.trim(), submittalId: substituting.row.id, itemId: substituting.item.id },
        notes: notes.trim(),
        ...(responsible.trim() ? { responsibleParty: { label: responsible.trim() } } : {}),
      },
      t('submittals.recordApprovedSubstitution', 'Record approved substitution', { ns: 'editor' }),
    )
    if (ok) closeSub()
  }

  if (error)
    return (
      <Alert variant="destructive" data-testid="submittals-error">
        <AlertTitle>{t('submittals.loadFailed', 'The submittals didn’t load', { ns: 'editor' })}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          <span>{error}</span>
          {onRetry ? (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw data-icon="inline-start" />
              {t('submittals.tryAgain', 'Try again', { ns: 'editor' })}
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    )
  if (!model)
    return (
      <section aria-label={t('panel.submittals', 'Submittals', { ns: 'editor' })} aria-busy="true" className="flex flex-col gap-2" data-testid="submittals-panel">
        <span className="sr-only">{t('submittals.loading', 'Loading the submittals', { ns: 'editor' })}</span>
        <Skeleton className="h-8" />
      </section>
    )

  return (
    <section aria-label={t('panel.submittals', 'Submittals', { ns: 'editor' })} className="flex min-w-0 flex-col gap-2" data-testid="submittals-panel">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <FileStack className="size-4" /> {t('panel.submittals', 'Submittals', { ns: 'editor' })}
      </h3>
      <Button size="sm" className="self-start" onClick={() => setCreating(true)} disabled={newReason !== null} title={newReason ?? t('submittals.newSubmittalFor', 'New submittal for {{what}}', { ns: 'editor', what: selectionLabel })} data-testid="submittals-new">
        <FilePlus2 data-icon="inline-start" />
        {t('submittals.newSubmittal', 'New submittal', { ns: 'editor' })}
      </Button>
      {editReason ? <p className="text-xs text-muted-foreground">{editReason}</p> : null}
      {refusal && !creating && !substituting ? (
        <Alert variant="destructive" data-testid="submittals-refusal">
          <AlertDescription>{refusal}</AlertDescription>
        </Alert>
      ) : null}
      {rows.length === 0 ? (
        <Empty className="border" data-testid="submittals-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileStack />
            </EmptyMedia>
            <EmptyTitle>{t('submittals.noSubmittals', 'No submittals yet', { ns: 'editor' })}</EmptyTitle>
            <EmptyDescription>{t('submittals.noSubmittalsWhy', 'Select what a submittal is for on the plan, then New submittal. Each item is reviewed on its own; the design stays as it is.', { ns: 'editor' })}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="gap-2">
          {rows.map((r) => (
            <Item key={r.id} variant="outline" size="sm" data-testid="submittals-row" data-submittal={r.id}>
              <ItemContent className="min-w-0">
                <ItemTitle className="flex flex-wrap items-center gap-2">
                  {r.title}
                  <Badge variant="outline">{t('submittals.rev', 'Rev', { ns: 'editor' })} {r.revision}</Badge>
                </ItemTitle>
                <ItemDescription>
                  {r.about ? t('submittals.forAbout', 'For {{about}}', { ns: 'editor', about: r.about }) : t('submittals.forTypeOrRequirement', 'For a type or requirement', { ns: 'editor' })}
                  {r.submittedBy ? t('submittals.fromWho', ' · from {{who}}', { ns: 'editor', who: r.submittedBy }) : ''}
                </ItemDescription>
                <ul className="mt-1 flex flex-col gap-1">
                  {r.items.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center gap-2 text-xs" data-testid="submittals-item" data-item={i.id}>
                      <span className="min-w-0 flex-1">{i.label}</span>
                      <Select
                        value={i.state === 'pending' || SUBMITTAL_REVIEW_STATES.some((s) => s === i.state) ? i.state : undefined}
                        onValueChange={(v) => {
                          const state = SUBMITTAL_REVIEW_STATES.find((s) => s === v)
                          if (state) send({ type: 'review_submittal', submittalId: r.id, itemId: i.id, state }, t('submittals.undo.review', 'Review: {{state}}', { ns: 'editor', state: SUBMITTAL_REVIEW_LABELS[state] }))
                        }}
                        disabled={editReason !== null}
                      >
                        <SelectTrigger size="sm" className="w-44" aria-label={t('submittals.reviewOf', 'Review of {{item}}', { ns: 'editor', item: i.label })} title={editReason ?? undefined} data-testid="submittals-item-review">
                          <SelectValue placeholder={i.stateLabel} />
                        </SelectTrigger>
                        <SelectContent>
                          {SUBMITTAL_REVIEW_STATES.map((s: Reviewable) => (
                            <SelectItem key={s} value={s}>
                              {SUBMITTAL_REVIEW_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {i.substituted ? (
                        <Badge variant="secondary">{t('submittals.approvedSubstitution', 'Approved substitution', { ns: 'editor' })}</Badge>
                      ) : i.state === 'approved' || i.state === 'approved_as_noted' ? (
                        <Button size="sm" variant="ghost" onClick={() => setSubstituting({ row: r, item: i })} disabled={editReason !== null} title={editReason ?? t('submittals.differsWhy', 'Record that the approved product differs from the design. The design is not changed.', { ns: 'editor' })} data-testid="submittals-substitution">
                          {t('submittals.differsFromDesign', 'It differs from the design', { ns: 'editor' })}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}

      <Dialog open={creating} onOpenChange={(next) => !next && closeNew()}>
        <DialogContent data-testid="submittals-new-dialog">
          <DialogHeader>
            <DialogTitle>{t('submittals.newSubmittal', 'New submittal', { ns: 'editor' })}</DialogTitle>
            <DialogDescription>
              {t('submittals.newSubmittalForWhy', 'For {{what}}. Files stay in the project’s files; this records what was offered and how each item is reviewed.', {
                ns: 'editor',
                what: selectionLabel || t('submittals.theSelection', 'the selection', { ns: 'editor' }),
              })}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="submittal-title">{t('submittals.title', 'Title', { ns: 'editor' })}</FieldLabel>
            <Input id="submittal-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={t('submittals.titlePlaceholder', 'Rooftop unit product data', { ns: 'editor' })} data-testid="submittals-new-title" />
          </Field>
          <Field>
            <FieldLabel htmlFor="submittal-items">{t('submittals.itemsOnePerLine', 'Items, one per line', { ns: 'editor' })}</FieldLabel>
            <Textarea id="submittal-items" value={items} onChange={(e) => setItems(e.target.value)} placeholder={t('submittals.itemsPlaceholder', 'Product data\nWiring diagram', { ns: 'editor' })} data-testid="submittals-new-items" />
            <FieldDescription>{t('submittals.eachItemReviewed', 'Each item is reviewed on its own. Empty: one item, product data.', { ns: 'editor' })}</FieldDescription>
          </Field>
          {refusal ? (
            <Alert variant="destructive">
              <AlertDescription>{refusal}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeNew}>
              {t('submittals.cancel', 'Cancel', { ns: 'editor' })}
            </Button>
            <Button onClick={saveNew} disabled={title.trim() === ''} title={title.trim() === '' ? t('submittals.giveTitleFirst', 'Give it a title first.', { ns: 'editor' }) : undefined} data-testid="submittals-new-save">
              {t('submittals.saveSubmittal', 'Save submittal', { ns: 'editor' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={substituting !== null} onOpenChange={(next) => !next && closeSub()}>
        <DialogContent data-testid="submittals-substitution-dialog">
          <DialogHeader>
            <DialogTitle>{t('submittals.approvedSubstitution', 'Approved substitution', { ns: 'editor' })}</DialogTitle>
            <DialogDescription>{t('submittals.substitutionWhy', "Records that the approved product differs from the design. The design is not changed; update it on purpose from the element's Inspector (it opens a branch).", { ns: 'editor' })}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="substitution-product">{t('submittals.approvedProduct', 'Approved product', { ns: 'editor' })}</FieldLabel>
            <Input id="substitution-product" value={product} onChange={(e) => setProduct(e.target.value)} maxLength={200} placeholder={t('submittals.approvedProductPlaceholder', 'Alternate unit, maker B', { ns: 'editor' })} data-testid="submittals-substitution-product" />
          </Field>
          <Field>
            <FieldLabel htmlFor="substitution-notes">{t('submittals.notes', 'Notes', { ns: 'editor' })}</FieldLabel>
            <Textarea id="substitution-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </Field>
          <Field>
            <FieldLabel htmlFor="substitution-responsible">Who is responsible for this difference? (optional)</FieldLabel>
            <Input id="substitution-responsible" value={responsible} onChange={(e) => setResponsible(e.target.value)} maxLength={120} placeholder={t('submittals.contractor', 'Contractor', { ns: 'editor' })} />
          </Field>
          {refusal ? (
            <Alert variant="destructive">
              <AlertDescription>{refusal}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeSub}>
              {t('submittals.cancel', 'Cancel', { ns: 'editor' })}
            </Button>
            <Button onClick={saveSub} disabled={product.trim() === ''} title={product.trim() === '' ? t('submittals.nameProductFirst', 'Name the approved product first.', { ns: 'editor' }) : undefined} data-testid="submittals-substitution-save">
              {t('submittals.recordSubstitution', 'Record substitution', { ns: 'editor' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
