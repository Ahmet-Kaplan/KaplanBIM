'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link2, RefreshCw, X } from 'lucide-react'
import { Alert, AlertDescription } from '../../ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../ui/alert-dialog'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../../ui/empty'
import { Field, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Item, ItemContent, ItemGroup, ItemTitle } from '../../ui/item'
import { Skeleton } from '../../ui/skeleton'
import type { LinkCandidate, QuestionLinkView } from '../../contracts/bim/questions/links'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { createQuestionLinkFrom, fetchLinkCandidatesFrom, fetchQuestionLinksFrom, removeQuestionLinkFrom } from '../../contracts/bim/questions/links-client'
import { useEditorTranslate } from '../i18n/translate'

export interface QuestionLinksProps {
  readonly projectId: string
  readonly modelId: string
  readonly recordKind: 'question' | 'submittal'
  readonly recordId: string
  readonly number: string
  readonly editReason: string | null
}

/**
 * A question's links to the project's own records: client RFIs, client
 * submissions and Procore items. You see only links to rows you can open;
 * the picker lists only those. Remove asks first.
 */
export function QuestionLinks({ projectId, modelId, recordKind, recordId, number, editReason }: QuestionLinksProps) {
  const t = useEditorTranslate()
  const questions = useEditorHost().data.questions
  const [links, setLinks] = useState<readonly QuestionLinkView[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [candidates, setCandidates] = useState<readonly LinkCandidate[] | null>(null)
  const [procoreNote, setProcoreNote] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [removing, setRemoving] = useState<QuestionLinkView | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      setLinks(await fetchQuestionLinksFrom(questions, projectId, modelId, recordId))
    } catch (err) {
      console.error('[QuestionLinks] loading links failed', err)
      setError(err instanceof Error ? err.message : t('questions.linksDidntLoad', "The links didn't load.", { ns: 'editor' }))
      setLinks([])
    }
  }, [questions, projectId, modelId, recordId, t])

  useEffect(() => {
    let live = true
    fetchQuestionLinksFrom(questions, projectId, modelId, recordId)
      .then((l) => live && setLinks(l))
      .catch((err: unknown) => {
        console.error('[QuestionLinks] loading links failed', err)
        if (live) {
          setError(err instanceof Error ? err.message : t('questions.linksDidntLoad', "The links didn't load.", { ns: 'editor' }))
          setLinks([])
        }
      })
    return () => {
      live = false
    }
  }, [questions, projectId, modelId, recordId])

  const openPicker = async () => {
    setPicking(true)
    setCandidates(null)
    try {
      const r = await fetchLinkCandidatesFrom(questions, projectId)
      setCandidates(r.candidates)
      setProcoreNote(r.procoreNote)
    } catch (err) {
      console.error('[QuestionLinks] loading link candidates failed', err)
      setError(err instanceof Error ? err.message : t('questions.candidatesDidntLoad', "What can be linked didn't load.", { ns: 'editor' }))
      setCandidates([])
    }
  }

  const linked = useMemo(() => new Set((links ?? []).map((l) => `${l.linkKind}:${l.linkedId}`)), [links])
  const shown = useMemo(() => (candidates ?? []).filter((c) => !linked.has(`${c.linkKind}:${c.id}`) && `${c.kindLabel} ${c.label}`.toLowerCase().includes(filter.trim().toLowerCase())), [candidates, linked, filter])

  const link = async (c: LinkCandidate) => {
    try {
      const made = await createQuestionLinkFrom(questions, projectId, { modelId, recordKind, recordId, linkKind: c.linkKind, linkedId: c.id })
      setLinks((prior) => [...(prior ?? []), made])
      setPicking(false)
      setFilter('')
    } catch (err) {
      console.error('[QuestionLinks] linking failed', err)
      setError(err instanceof Error ? err.message : t('questions.couldntLink', "That couldn't be linked.", { ns: 'editor' }))
    }
  }

  const remove = async (l: QuestionLinkView) => {
    try {
      await removeQuestionLinkFrom(questions, projectId, l.id)
      setLinks((prior) => (prior ?? []).filter((x) => x.id !== l.id))
    } catch (err) {
      console.error('[QuestionLinks] removing a link failed', err)
      setError(err instanceof Error ? err.message : t('questions.couldntUnlink', "That link couldn't be removed.", { ns: 'editor' }))
    }
  }

  return (
    <div className="flex flex-col gap-1" data-testid="question-links">
      {links === null ? (
        <Skeleton className="h-5 w-40" />
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          {links.map((l) => (
            <Badge key={l.id} variant="outline" className="gap-1" data-testid="question-link">
              {l.label}
              <Button variant="ghost" size="icon-xs" aria-label={t('questions.removeLink', 'Remove the {{what}} link', { ns: 'editor', what: l.label.toLowerCase() })} onClick={() => setRemoving(l)} disabled={editReason !== null} title={editReason ?? undefined}>
                <X />
              </Button>
            </Badge>
          ))}
          <Button size="sm" variant="ghost" onClick={() => void openPicker()} disabled={editReason !== null} title={editReason ?? t('questions.linkHint', 'Link a client RFI, a client submission or a Procore item', { ns: 'editor' })} data-testid="question-link-open">
            <Link2 data-icon="inline-start" />
            {t('questions.link', 'Link…', { ns: 'editor' })}
          </Button>
        </div>
      )}
      {error ? (
        <Alert variant="destructive" data-testid="question-links-error">
          <AlertDescription className="flex items-center gap-2">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              <RefreshCw data-icon="inline-start" />
              {t('questions.tryAgain', 'Try again', { ns: 'editor' })}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Dialog open={picking} onOpenChange={(next) => !next && (setPicking(false), setFilter(''))}>
        <DialogContent data-testid="question-link-picker">
          <DialogHeader>
            <DialogTitle>{t('questions.linkTitle', 'Link {{number}}', { ns: 'editor', number })}</DialogTitle>
            <DialogDescription>{t('questions.linkDescription', "Pick a client RFI, a client submission or a Procore item on this project. People who can't open it won't see the link.", { ns: 'editor' })}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={`link-filter-${recordId}`}>{t('questions.find', 'Find', { ns: 'editor' })}</FieldLabel>
            <Input id={`link-filter-${recordId}`} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('questions.filterPlaceholder', 'RFI 14, beam', { ns: 'editor' })} />
          </Field>
          {candidates === null ? (
            <Skeleton className="h-16" />
          ) : shown.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>{t('questions.nothingToLink', 'Nothing to link', { ns: 'editor' })}</EmptyTitle>
                <EmptyDescription>{filter ? t('questions.nothingMatches', 'Nothing matches. Clear the search.', { ns: 'editor' }) : t('questions.noLinkCandidates', 'This project has no client RFIs, submissions or Procore items you can open.', { ns: 'editor' })}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup className="max-h-72 gap-1 overflow-y-auto">
              {shown.map((c) => (
                <Item key={`${c.linkKind}:${c.id}`} size="xs" variant="outline">
                  <ItemContent>
                    <ItemTitle className="text-sm">
                      <Button type="button" variant="link" className="h-auto whitespace-normal p-0 text-left text-sm" onClick={() => void link(c)} data-testid="question-link-candidate">
                        {c.label}
                      </Button>
                      <span className="font-normal text-muted-foreground">· {c.kindLabel}</span>
                    </ItemTitle>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          )}
          {procoreNote ? <p className="text-xs text-muted-foreground">{procoreNote}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => (setPicking(false), setFilter(''))}>
              {t('questions.cancel', 'Cancel', { ns: 'editor' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removing !== null} onOpenChange={(next) => !next && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('questions.removeLinkTitle', 'Remove this link?', { ns: 'editor' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('questions.removeLinkDescription', '{{what}} stays as it is; only the link from {{number}} goes.', { ns: 'editor', what: removing?.label ?? '', number })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('questions.cancel', 'Cancel', { ns: 'editor' })}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing) void remove(removing)
                setRemoving(null)
              }}
            >
              {t('questions.remove', 'Remove', { ns: 'editor' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
