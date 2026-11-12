'use client'

import { useEffect, useState } from 'react'
import { Library } from 'lucide-react'
import type { PartTypeDefinition } from '@permitzip/bim-kernel'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Spinner } from '../../ui/spinner'
import { drawnPartItemId } from '../../contracts/bim/firm-part-versions'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { useEditorTranslate } from '../i18n/translate'
import { fetchLibraryPartTypesFrom, publishPartTypeFrom } from './part-type-library'

type Stage =
  | { readonly kind: 'checking' }
  | { readonly kind: 'ready'; readonly current: number | null }
  | { readonly kind: 'saving'; readonly current: number | null }
  | { readonly kind: 'failed'; readonly message: string; readonly current: number | null }

interface Props {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly definition: PartTypeDefinition
  readonly partName: string
  readonly sizesText: string
  /** Keeps Place part's firm list current (the older firm parts store); resolves to its refusal or null. */
  readonly alsoSaveForPlacePart?: (definition: PartTypeDefinition) => Promise<string | null>
  /** The outcome in words, for the editor's status line. */
  readonly onDone: (message: { readonly ok: boolean; readonly text: string }) => void
}

/**
 * Part editor › Publish…: the part, every size, as the next revision of its
 * firm library part type. Placed copies of older revisions then offer
 * "A newer version is in the library" › Review update in the projects that
 * use them. Esc or Cancel leaves everything as it was.
 */
export function PublishPartDialog({ open, onOpenChange, definition, partName, sizesText, alsoSaveForPlacePart, onDone }: Props) {
  const t = useEditorTranslate()
  const library = useEditorHost().data.firmLibrary
  const [stage, setStage] = useState<Stage>({ kind: 'checking' })
  const modelId = definition.model?.id ?? null

  useEffect(() => {
    if (!open) return
    let live = true
    fetchLibraryPartTypesFrom(library, t)
      .then(({ partTypes }) => {
        if (!live) return
        const found = modelId ? partTypes.find((p) => p.id === drawnPartItemId(modelId)) : undefined
        setStage({ kind: 'ready', current: found?.revision ?? null })
      })
      .catch((err: unknown) => {
        console.error('[part-editor] reading the firm library before publish failed', err)
        if (live)
          setStage({
            kind: 'failed',
            message: t('partEditor.publish.noAnswer', "The firm library didn't answer: {{reason}}. Close and try again.", {
              ns: 'editor',
              reason: err instanceof Error ? err.message : t('partEditor.library.connectionDropped', 'the connection dropped', { ns: 'editor' }),
            }),
            current: null,
          })
      })
    return () => {
      live = false
    }
  }, [library, open, modelId, t])

  const current = stage.kind === 'checking' ? null : stage.current
  const publish = async () => {
    setStage({ kind: 'saving', current })
    try {
      const answer = await publishPartTypeFrom(library, definition, t)
      if (!answer.ok) {
        setStage({ kind: 'failed', message: t('partEditor.save.notPublished', 'Not published: {{reason}}', { ns: 'editor', reason: answer.message }), current })
        return
      }
      const placeRefused = alsoSaveForPlacePart ? await alsoSaveForPlacePart(definition) : null
      const text = answer.upToDate
        ? t('partEditor.publish.alreadyCurrent', '{{name}} is already revision {{revision}} in the firm library; nothing changed.', {
            ns: 'editor',
            name: partName,
            revision: answer.revision,
          })
        : t('partEditor.publish.published', 'Published {{name}} as revision {{revision}} in the firm library ({{sizes}}).', {
            ns: 'editor',
            name: partName,
            revision: answer.revision,
            sizes: sizesText,
          })
      onDone(
        placeRefused
          ? { ok: false, text: t('partEditor.publish.placeListStale', "{{text}} Place part's list wasn't updated: {{reason}}", { ns: 'editor', text, reason: placeRefused }) }
          : { ok: true, text },
      )
      onOpenChange(false)
    } catch (err) {
      console.error('[part-editor] publish failed', err)
      setStage({
        kind: 'failed',
        message: t('partEditor.publish.notPublishedRetry', 'Not published: {{reason}}. Nothing changed; try again.', {
          ns: 'editor',
          reason: err instanceof Error ? err.message : t('partEditor.library.connectionDropped', 'the connection dropped', { ns: 'editor' }),
        }),
        current,
      })
    }
  }

  const next = (current ?? 0) + 1
  return (
    <Dialog open={open} onOpenChange={(o) => stage.kind !== 'saving' && onOpenChange(o)}>
      <DialogContent data-testid="pe-publish-dialog">
        <DialogHeader>
          <DialogTitle>{t('partEditor.publish.title', 'Publish {{name}}', { ns: 'editor', name: partName })}</DialogTitle>
          <DialogDescription>
            {stage.kind === 'checking'
              ? t('partEditor.publish.checking', 'Checking the firm library…', { ns: 'editor' })
              : current === null
                ? t('partEditor.publish.firstRevision', 'New in the firm library: revision 1 ({{sizes}}).', { ns: 'editor', sizes: sizesText })
                : t(
                    'partEditor.publish.nextRevision',
                    'Revision {{current}} is in the firm library. This publishes revision {{next}} ({{sizes}}); projects with copies of revision {{current}} are offered the update and choose for themselves.',
                    { ns: 'editor', current, next, sizes: sizesText },
                  )}
          </DialogDescription>
        </DialogHeader>
        {stage.kind === 'failed' && (
          <Alert variant="destructive">
            <AlertTitle>{t('partEditor.publish.notPublished', 'Not published', { ns: 'editor' })}</AlertTitle>
            <AlertDescription>{stage.message}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={stage.kind === 'saving'}>
              {t('partEditor.cancel', 'Cancel', { ns: 'editor' })}
            </Button>
          </DialogClose>
          <Button onClick={() => void publish()} disabled={stage.kind === 'checking' || stage.kind === 'saving'} data-testid="pe-publish-confirm">
            {stage.kind === 'saving' ? <Spinner data-icon="inline-start" /> : <Library data-icon="inline-start" />}
            {stage.kind === 'saving'
              ? t('partEditor.publish.saving', 'Saving…', { ns: 'editor' })
              : t('partEditor.publish.publishRevision', 'Publish revision {{n}}', { ns: 'editor', n: next })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
