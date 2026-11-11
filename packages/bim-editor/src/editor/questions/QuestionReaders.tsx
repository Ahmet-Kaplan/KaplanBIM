'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eye, RefreshCw } from 'lucide-react'
import type { ModelState } from '@permitzip/bim-kernel'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../ui/alert-dialog'
import { Button } from '../../ui/button'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '../../ui/item'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { deleteThreadReaderFrom, fetchThreadReadersFrom, putSharedThreadCopyFrom } from '../../contracts/bim/questions/readers'
import type { ThreadReader } from '../../contracts/bim/questions/contract'
import { sharedThreadOf } from '../../contracts/bim/questions/shared-thread'
import { useEditorTranslate, type Translate } from '../i18n/translate'

type State = { readonly kind: 'loading' } | { readonly kind: 'error'; readonly message: string } | { readonly kind: 'ready'; readonly readers: readonly ThreadReader[] }

/** Why a reader outside the project still reads this conversation, in words a person reads. */
const reasonWords = (reason: ThreadReader['reason'], t: Translate): string =>
  reason === 'former_addressee' ? t('questions.reasonFormerAddressee', 'it was asked of them before', { ns: 'editor' }) : t('questions.reasonForwardedOutside', 'forwarded to their company', { ns: 'editor' })

/**
 * "Read-only for people outside the project": who keeps reading this one
 * conversation, and Stop sharing (confirmed, Nielsen 5). While anyone reads
 * it, the read-only copy they see is brought up to date when the thread is
 * opened and whenever the conversation changes here. Nothing shows when it isn't shared.
 */
export function QuestionReaders({ projectId, modelId, questionId, model, version, canEdit }: { readonly projectId: string; readonly modelId: string; readonly questionId: string; readonly model: ModelState; readonly version: number; readonly canEdit: boolean }) {
  const t = useEditorTranslate()
  const questions = useEditorHost().data.questions
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [stopping, setStopping] = useState<ThreadReader | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchThreadReadersFrom(questions, projectId, modelId, questionId)
      .then((readers) => setState({ kind: 'ready', readers }))
      .catch((err: unknown) => {
        console.error('[QuestionReaders] loading who the conversation is shared with failed', err)
        setState({ kind: 'error', message: err instanceof Error ? err.message : t('questions.readersDidntLoad', "Who this is shared with didn't load.", { ns: 'editor' }) })
      })
  }, [questions, projectId, modelId, questionId, t])

  useEffect(() => {
    load()
  }, [load, version])

  // Keep the copy outside readers see in step with the conversation here.
  const thread = useMemo(() => sharedThreadOf(model, questionId), [model, questionId])
  const threadKey = thread ? `${thread.status}|${thread.entries.length}|${thread.entries.at(-1)?.at ?? ''}|${thread.askOf}` : ''
  const sentKey = useRef<string | null>(null)
  const shared = state.kind === 'ready' && state.readers.length > 0
  useEffect(() => {
    // Opened while shared (the copy may be behind an agent's act or the share itself), then on every change.
    if (!shared || !thread || !canEdit) return
    if (sentKey.current === threadKey) return
    sentKey.current = threadKey
    putSharedThreadCopyFrom(questions, projectId, { modelId, questionId, thread }).catch((err: unknown) => {
      console.error('[QuestionReaders] bringing the shared copy up to date failed', err)
      setProblem(t('questions.sharedCopyBehind', 'Saved here, but the copy people outside the project read is behind: {{error}}.', { ns: 'editor', error: err instanceof Error ? err.message : t('questions.tryAgainLater', 'try again later', { ns: 'editor' }) }))
    })
  }, [questions, shared, thread, threadKey, canEdit, projectId, modelId, questionId, t])

  if (state.kind === 'loading') return null
  if (state.kind === 'error')
    return (
      <p className="flex items-center gap-2 text-xs text-danger-600" role="status" data-testid="question-readers-error">
        {state.message}
        <Button size="sm" variant="ghost" onClick={load}>
          <RefreshCw data-icon="inline-start" />
          {t('questions.tryAgain', 'Try again', { ns: 'editor' })}
        </Button>
      </p>
    )
  if (state.readers.length === 0) return null

  return (
    <section className="flex flex-col gap-1" aria-label={t('questions.readOnlyOutside', 'Read-only for people outside the project', { ns: 'editor' })} data-testid="question-readers">
      <p className="text-xs font-medium text-muted-foreground">{t('questions.readOnlyOutside', 'Read-only for people outside the project', { ns: 'editor' })}</p>
      <ItemGroup className="gap-1">
        {state.readers.map((r) => (
          <Item key={r.id} size="xs" variant="muted" className="p-2" data-testid="question-reader">
            <ItemMedia variant="icon">
              <Eye aria-hidden="true" />
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle className="text-xs">{r.name}</ItemTitle>
              <ItemDescription className="text-xs">
                {t('questions.thisConversationOnly', 'This conversation only — {{reason}}. Shared by {{who}}.', { ns: 'editor', reason: reasonWords(r.reason, t), who: r.sharedBy })}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button size="sm" variant="ghost" onClick={() => setStopping(r)} disabled={!canEdit} title={canEdit ? t('questions.canNoLongerRead', '{{who}} can no longer read it', { ns: 'editor', who: r.name }) : t('questions.onlyQuestionWorkers', 'Only someone who works on this project’s questions can stop sharing.', { ns: 'editor' })} data-testid="question-reader-stop">
                {t('questions.stopSharing', 'Stop sharing', { ns: 'editor' })}
              </Button>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
      {problem ? (
        <p role="status" className="text-xs text-danger-600" data-testid="question-readers-problem">
          {problem}
        </p>
      ) : null}
      <AlertDialog open={stopping !== null} onOpenChange={(next) => !next && setStopping(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('questions.stopSharingTitle', 'Stop sharing with {{who}}?', { ns: 'editor', who: stopping?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('questions.stopSharingDescription', 'They will no longer be able to read this conversation. You can share it again by forwarding it to them.', { ns: 'editor' })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('questions.keepSharing', 'Keep sharing', { ns: 'editor' })}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const r = stopping
                setStopping(null)
                if (!r) return
                deleteThreadReaderFrom(questions, projectId, r.id)
                  .then(load)
                  .catch((err: unknown) => {
                    console.error('[QuestionReaders] stopping sharing failed', err)
                    setProblem(err instanceof Error ? err.message : t('questions.sharingDidntStop', "Sharing didn't stop. Try again.", { ns: 'editor' }))
                  })
              }}
              data-testid="question-reader-stop-confirm"
            >
              {t('questions.stopSharing', 'Stop sharing', { ns: 'editor' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
