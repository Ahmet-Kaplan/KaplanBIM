'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowUpCircle } from 'lucide-react'
import type { PartTypeDefinition } from '@permitzip/bim-kernel'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Spinner } from '../../ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import { newerLibraryVersions, partUpdateCommand, partUpdateDiff, type LibraryPartTypeEntry, type NewerPartVersion } from '../../contracts/bim/firm-part-versions'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { useEditorTranslate } from '../i18n/translate'
import { fetchLibraryPartTypesFrom, LibraryReadError } from './part-type-library'

export type PartUpdateCommand = ReturnType<typeof partUpdateCommand>

interface Props {
  /** The model's part types this notice may offer updates for (usually the selected part's type). */
  readonly modelTypes: readonly { readonly typeId: string; readonly definition: PartTypeDefinition }[]
  /** Placed copies per type id, so Update can say how many change. */
  readonly placedCopies: Readonly<Record<string, number>>
  /** Whether this person may change the model, and why not. */
  readonly canEdit: boolean
  readonly editBlockedReason?: string
  /** Sends the update as one model change (one undo step); resolves to the refusal in words, or null. */
  readonly onApply: (command: PartUpdateCommand) => Promise<string | null>
  /** Library part types already loaded by the host; absent: this notice reads them. */
  readonly library?: readonly LibraryPartTypeEntry[]
}

type Choice = 'update' | 'keep'

function DiffLines({ newer }: { readonly newer: NewerPartVersion }) {
  const t = useEditorTranslate()
  const d = partUpdateDiff(newer.before, newer.after)
  const groups: [string, string[]][] = [
    [t('partEditor.tab.parameters', 'Parameters', { ns: 'editor' }), d.parameters],
    [t('partEditor.connectors', 'Connectors', { ns: 'editor' }), d.connectors],
    [t('partEditor.zone.title', 'Clearances', { ns: 'editor' }), d.clearances],
    [t('partEditor.review.groupOther', 'Other', { ns: 'editor' }), d.other],
  ]
  const shown = groups.filter(([, lines]) => lines.length > 0)
  if (shown.length === 0) return <ItemDescription>{t('partEditor.review.layoutOnly', 'Only the stored layout changed; it draws the same.', { ns: 'editor' })}</ItemDescription>
  return (
    <div className="flex flex-col gap-1 text-sm">
      {shown.map(([title, lines]) => (
        <p key={title}>
          <span className="font-medium">{title}:</span> {lines.join('; ')}
        </p>
      ))}
    </div>
  )
}

/**
 * "A newer version is in the library" › Review update, for a placed part
 * whose type matches an older revision of a firm library part. Each size:
 * what changes (parameters, connectors, clearances) and Update or Keep.
 * Update sends one change (one undo step) and says how many placed copies
 * change; Keep, Cancel and Esc change nothing.
 */
export function PartUpdateReview({ modelTypes, placedCopies, canEdit, editBlockedReason, onApply, library }: Props) {
  const t = useEditorTranslate()
  const firmLibrary = useEditorHost().data.firmLibrary
  const [loaded, setLoaded] = useState<{ readonly state: 'loading' } | { readonly state: 'ready'; readonly entries: readonly LibraryPartTypeEntry[] } | { readonly state: 'failed'; readonly message: string }>(library ? { state: 'ready', entries: library } : { state: 'loading' })
  const [open, setOpen] = useState(false)
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [sending, setSending] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  useEffect(() => {
    if (library) return
    let live = true
    fetchLibraryPartTypesFrom(firmLibrary, t)
      .then(({ partTypes }) => live && setLoaded({ state: 'ready', entries: partTypes }))
      .catch((err: unknown) => {
        if (err instanceof LibraryReadError && err.status === 403) {
          console.info('[part-update-review] this person may not read the firm library; no updates to offer')
          if (live) setLoaded({ state: 'ready', entries: [] })
          return
        }
        console.error('[part-update-review] reading the firm library failed', err)
        if (live) setLoaded({ state: 'failed', message: err instanceof Error ? err.message : t('partEditor.library.connectionDropped', 'the connection dropped', { ns: 'editor' }) })
      })
    return () => {
      live = false
    }
  }, [firmLibrary, library, t])

  const newer = useMemo(() => (loaded.state === 'ready' ? newerLibraryVersions(modelTypes, loaded.entries) : []), [loaded, modelTypes])
  if (loaded.state === 'failed') {
    return (
      <Alert data-testid="part-update-failed">
        <AlertTitle>{t('partEditor.review.checkFailed', "Couldn't check the firm library for newer versions", { ns: 'editor' })}</AlertTitle>
        <AlertDescription>{t('partEditor.review.checkFailedWhy', '{{message}}. The part is unchanged.', { ns: 'editor', message: loaded.message })}</AlertDescription>
      </Alert>
    )
  }
  if (newer.length === 0) return null

  const choiceOf = (typeId: string): Choice => choices[typeId] ?? 'update'
  const chosen = newer.filter((n) => choiceOf(n.typeId) === 'update')
  const copies = chosen.reduce((sum, n) => sum + (placedCopies[n.typeId] ?? 0), 0)
  const first = newer[0]

  const apply = async () => {
    setSending(true)
    setRefusal(null)
    try {
      const why = await onApply(partUpdateCommand(chosen, copies))
      if (why) setRefusal(why)
      else setOpen(false)
    } catch (err) {
      console.error('[part-update-review] update failed', err)
      setRefusal(err instanceof Error ? err.message : t('partEditor.review.notSent', 'The update was not sent; nothing changed.', { ns: 'editor' }))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Alert data-testid="part-update-available">
        <ArrowUpCircle />
        <AlertTitle>{t('partEditor.review.newerInLibrary', 'A newer version is in the library', { ns: 'editor' })}</AlertTitle>
        <AlertDescription>
          {first && newer.length === 1
            ? t('partEditor.review.newerOne', '{{name}}: placed from revision {{placed}}; the library has revision {{latest}}.', {
                ns: 'editor',
                name: first.name,
                placed: first.placedRevision,
                latest: first.latestRevision,
              })
            : t('partEditor.review.newerMany', '{{n}} sizes have a newer library revision.', { ns: 'editor', n: newer.length })}
        </AlertDescription>
        <AlertAction>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)} data-testid="part-update-review">
            {t('partEditor.review.reviewUpdate', 'Review update', { ns: 'editor' })}
          </Button>
        </AlertAction>
      </Alert>
      <Dialog open={open} onOpenChange={(o) => !sending && setOpen(o)}>
        <DialogContent data-testid="part-update-dialog">
          <DialogHeader>
            <DialogTitle>{t('partEditor.review.reviewUpdate', 'Review update', { ns: 'editor' })}</DialogTitle>
            <DialogDescription>
              {t(
                'partEditor.review.choosePerSize',
                'Choose Update or Keep for each size. Nothing changes until you press Update; it is one step to undo.',
                { ns: 'editor' },
              )}
            </DialogDescription>
          </DialogHeader>
          <ItemGroup>
            {newer.map((n) => (
              <Item key={n.typeId} variant="outline" data-testid={`part-update-${n.typeId}`}>
                <ItemContent>
                  <ItemTitle>
                    {t('partEditor.review.revisionArrow', '{{name}}: revision {{placed}} → {{latest}}', {
                      ns: 'editor',
                      name: n.name,
                      placed: n.placedRevision,
                      latest: n.latestRevision,
                    })}
                  </ItemTitle>
                  <ItemDescription>
                    {(placedCopies[n.typeId] ?? 0) === 1
                      ? t('partEditor.review.placedCopyOne', '{{n}} placed copy', { ns: 'editor', n: 1 })
                      : t('partEditor.review.placedCopyMany', '{{n}} placed copies', { ns: 'editor', n: placedCopies[n.typeId] ?? 0 })}
                  </ItemDescription>
                  <DiffLines newer={n} />
                </ItemContent>
                <ItemActions>
                  <ToggleGroup type="single" size="sm" variant="outline" value={choiceOf(n.typeId)} onValueChange={(v) => v && setChoices((c) => ({ ...c, [n.typeId]: v === 'keep' ? 'keep' : 'update' }))} aria-label={t('partEditor.review.updateOrKeepAria', 'Update or keep {{name}}', { ns: 'editor', name: n.name })}>
                    <ToggleGroupItem value="update">{t('partEditor.review.update', 'Update', { ns: 'editor' })}</ToggleGroupItem>
                    <ToggleGroupItem value="keep">{t('partEditor.review.keep', 'Keep', { ns: 'editor' })}</ToggleGroupItem>
                  </ToggleGroup>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
          {refusal && (
            <Alert variant="destructive">
              <AlertTitle>{t('partEditor.review.notUpdated', 'Not updated', { ns: 'editor' })}</AlertTitle>
              <AlertDescription>{refusal}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={sending}>
                {t('partEditor.cancel', 'Cancel', { ns: 'editor' })}
              </Button>
            </DialogClose>
            <Button
              onClick={() => void apply()}
              disabled={!canEdit || chosen.length === 0 || sending}
              title={
                !canEdit
                  ? (editBlockedReason ?? t('partEditor.review.cannotChange', 'You can view this model but not change it', { ns: 'editor' }))
                  : chosen.length === 0
                    ? t('partEditor.review.allKeep', 'Every size is set to Keep, so there is nothing to update', { ns: 'editor' })
                    : undefined
              }
              data-testid="part-update-apply"
            >
              {sending && <Spinner data-icon="inline-start" />}
              {sending
                ? t('partEditor.review.updating', 'Updating…', { ns: 'editor' })
                : chosen.length === 0
                  ? t('partEditor.review.nothingToUpdate', 'Nothing to update', { ns: 'editor' })
                  : copies === 1
                    ? t('partEditor.review.updateOneCopy', 'Update {{n}} placed copy', { ns: 'editor', n: 1 })
                    : t('partEditor.review.updateCopies', 'Update {{n}} placed copies', { ns: 'editor', n: copies })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
