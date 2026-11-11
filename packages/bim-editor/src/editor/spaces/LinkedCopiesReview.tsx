'use client'

import { useMemo, useState } from 'react'
import { linkedCopiesOf, linkedCopyReview, type Command, type ModelState } from '@permitzip/bim-kernel'
import { Alert, AlertDescription } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { keepMineCommand, updateFromLinkCommand } from '../linked-reference/linked-copies-for-loads'
import { linkedReferenceWords } from '../linked-reference/linked-reference-store'
import { useLinkedReferenceState } from '../linked-reference/use-linked-reference'
import { newElementId } from '../placement'
import { useEditorTranslate } from '../i18n/translate'

/**
 * Spaces › Copies from the linked model: the walls and openings copied from
 * the link whose source moved, changed or left it since they were copied.
 * Each is settled on its own: "Update from the link" (one undo) or "Keep
 * mine". Shown only when the model has copies.
 */
export function LinkedCopiesReview({ model, submit, editReason }: { readonly model: ModelState; readonly submit: (command: Command, undoLabel: string) => string | null; readonly editReason: string | null }) {
  const t = useEditorTranslate()
  const linked = useLinkedReferenceState()
  const [refusal, setRefusal] = useState<string | null>(null)
  const count = useMemo(() => linkedCopiesOf(model.elements).length, [model])
  const review = useMemo(() => (linked.status === 'ready' && count > 0 ? linkedCopyReview(model.elements, linked.index) : null), [linked, model, count])
  if (count === 0) return null

  const send = (command: Command | string, label: string) => {
    if (typeof command === 'string') {
      setRefusal(command)
      return
    }
    setRefusal(submit(command, label))
  }

  return (
    <section className="flex flex-col gap-2 border-t pt-2" aria-label={t('spaces.copiesFromLinkedModel', 'Copies from the linked model', { ns: 'editor' })} data-testid="linked-copies-review">
      <h3 className="text-xs font-medium text-muted-foreground">{t('spaces.copiesFromLinkedModel', 'Copies from the linked model', { ns: 'editor' })}</h3>
      {!review ? (
        <p className="text-xs text-muted-foreground">
          {linkedReferenceWords(linked) ?? t('spaces.copiesLinkedNotLoaded', "{{count}} copies; the linked model isn't loaded, so whether they still match it can't be checked yet.", { ns: 'editor', count })}
        </p>
      ) : review.rows.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-testid="linked-copies-current">
          {t('spaces.allCopiesMatch', 'All {{count}} copies match the linked model{{notLoaded}}.', {
            ns: 'editor',
            count: review.current,
            notLoaded: review.notLoaded > 0 ? t('spaces.fromALinkNotLoaded', ' ({{count}} from a linked model not loaded here)', { ns: 'editor', count: review.notLoaded }) : '',
          })}
        </p>
      ) : (
        <ItemGroup>
          {review.rows.map((row) => (
            <Item key={row.elementId} size="sm" variant="outline" data-testid="linked-copy-row" data-status={row.status}>
              <ItemContent>
                <ItemTitle>{row.status === 'gone' ? t('spaces.copySourceGone', '{{kind}} whose source is gone', { ns: 'editor', kind: row.kind }) : t('spaces.copySourceChanged', '{{kind}} whose source changed', { ns: 'editor', kind: row.kind })}</ItemTitle>
                <ItemDescription>{row.words}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  size="sm"
                  disabled={editReason !== null}
                  title={
                    editReason ??
                    (row.status === 'gone'
                      ? t('spaces.updateFromLinkWhyGone', 'Removes this copy, as the linked model no longer has it', { ns: 'editor' })
                      : t('spaces.updateFromLinkWhyChanged', "Makes this copy match the linked model's new version", { ns: 'editor' }))
                  }
                  onClick={() => linked.status === 'ready' && send(updateFromLinkCommand(model, linked.index, row, newElementId), t('spaces.updateKinFromLink', 'Update {{kind}} from the linked model', { ns: 'editor', kind: row.kind }))}
                  data-testid="linked-copy-update"
                >
                  {t('spaces.updateFromLink', 'Update from the link', { ns: 'editor' })}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={editReason !== null}
                  title={
                    editReason ??
                    (row.status === 'gone'
                      ? t('spaces.keepMineWhyGone', 'Keeps this copy and stops following the linked model for it', { ns: 'editor' })
                      : t('spaces.keepMineWhyChanged', 'Keeps this copy as it is and marks this change as seen', { ns: 'editor' }))
                  }
                  onClick={() => linked.status === 'ready' && send(keepMineCommand(linked.index, row), t('spaces.keepMineCommand', 'Keep my {{kind}}', { ns: 'editor', kind: row.kind }))}
                  data-testid="linked-copy-keep"
                >
                  {t('spaces.keepMine', 'Keep mine', { ns: 'editor' })}
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
      {refusal ? (
        <Alert variant="destructive" data-testid="linked-copies-refused">
          <AlertDescription>{refusal}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}
