'use client'

import { useCallback, useEffect, useState } from 'react'
import { GitMerge, Hand, RefreshCw } from 'lucide-react'
import type { LandedPart, MergePreview, WaitingPart } from '@permitzip/bim-sync'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { ConfirmAction } from '../../ui/confirm-action'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../../ui/empty'
import { Skeleton } from '../../ui/skeleton'
import { Spinner } from '../../ui/spinner'
import type { ProposalView } from '../../contracts/bim/merge/model'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { fetchMergesFrom, proposeMergeFrom, recordLandedFrom, takeResponsibilityFrom } from '../../contracts/bim/responsibilities/client'
import { takeOutcomeWords } from '../responsibilities/signoff-words'
import { useEditorTranslate } from '../i18n/translate'
import { domainLabelOf } from '../i18n/domain'

/**
 * In a branch › header › Propose merge to Main. Shows what would merge, by
 * part, with who approves each ("Waiting for approval from: <discipline>
 * (J. Rao), <discipline> (K. The product owner)") and any conflicts in words. Proposing
 * puts it in each approver's Checklist › Merges waiting for you; the
 * proposer then presses Merge approved parts, and the model server lands
 * only what every covering person approved and nothing that hangs on a part
 * still waiting. A merge is never a change order and never a cost.
 *
 * The model-server calls come in as props (lane B's branch session sends
 * `merge_preview` / `merge_apply`), so this screen holds no socket.
 */

export interface MergeApplyResult {
  readonly landed: readonly LandedPart[]
  readonly waiting: readonly WaitingPart[]
  readonly allLanded: boolean
}

export interface ProposeMergeDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly projectId: string
  readonly branchId: string
  /** Null: the person may propose and merge; else why not (shown on the disabled buttons). */
  readonly blockedReason: string | null
  readonly requestPreview: () => Promise<MergePreview>
  readonly requestApply: (proposalId: string) => Promise<MergeApplyResult>
  readonly labelOf?: (discipline: string) => string
}

type Load =
  | { readonly state: 'loading' }
  | { readonly state: 'error'; readonly message: string }
  | { readonly state: 'ready'; readonly preview: MergePreview; readonly proposal: ProposalView | null; readonly viewerId: string }

export function ProposeMergeDialog({ open, onOpenChange, projectId, branchId, blockedReason, requestPreview, requestApply, labelOf: labelOfGiven }: ProposeMergeDialogProps) {
  const t = useEditorTranslate()
  // A discipline's name is domain data (`domain.json`: *Electrical* → *Elektrik*),
  // so the default reader translates it where it is drawn; a host that names its
  // own parts passes its own `labelOf` and keeps it.
  const labelOf = labelOfGiven ?? domainLabelOf(t)
  const responsibilities = useEditorHost().data.responsibilities
  const [attempt, setAttempt] = useState(0)
  const key = `${projectId}|${branchId}|${attempt}`
  // Answers are kept with the request they belong to; any other request reads as loading.
  const [answer, setAnswer] = useState<{ readonly key: string; readonly load: Load } | null>(null)
  const load: Load = open && answer && answer.key === key ? answer.load : { state: 'loading' }
  const [busy, setBusy] = useState<'propose' | 'merge' | null>(null)
  const [notice, setNotice] = useState<{ readonly tone: 'ok' | 'error'; readonly text: string } | null>(null)
  const [result, setResult] = useState<MergeApplyResult | null>(null)
  const [sentTo, setSentTo] = useState<Readonly<Record<string, string>>>({})
  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!open) return
    let live = true
    Promise.all([requestPreview(), fetchMergesFrom(responsibilities, projectId)])
      .then(([preview, merges]) => {
        if (!live) return
        const proposal = merges.proposals.find((p) => p.branchId === branchId) ?? null
        setAnswer({ key, load: { state: 'ready', preview, proposal, viewerId: merges.viewerId } })
      })
      .catch((err: unknown) => {
        if (!live) return
        console.error('[ProposeMerge] loading the merge failed', err)
        setAnswer({ key, load: { state: 'error', message: err instanceof Error ? err.message : t('merge.previewFailed', 'The merge preview didn’t load.', { ns: 'editor' }) } })
      })
    return () => {
      live = false
    }
  }, [responsibilities, open, key, projectId, branchId, requestPreview])

  const changeOpen = (next: boolean) => {
    if (!next) {
      setNotice(null)
      setResult(null)
      setAnswer(null)
    }
    onOpenChange(next)
  }

  async function propose(preview: MergePreview) {
    setBusy('propose')
    setNotice(null)
    try {
      const saved = await proposeMergeFrom(responsibilities, projectId, preview)
      setNotice({ tone: 'ok', text: saved.refreshed ? t('merge.proposalUpdated', 'Proposal updated. Approvers see this version.', { ns: 'editor' }) : t('merge.proposed', 'Proposed. Each approver sees it in Checklist › Merges waiting for you.', { ns: 'editor' }) })
      reload()
    } catch (err) {
      console.error('[ProposeMerge] proposing failed', err)
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : t('merge.proposeFailed', 'Couldn’t propose the merge. Try again.', { ns: 'editor' }) })
    } finally {
      setBusy(null)
    }
  }

  async function take(discipline: string) {
    setNotice(null)
    try {
      const out = await takeResponsibilityFrom(responsibilities, projectId, { discipline })
      if (out.outcome === 'requested') setSentTo((m) => ({ ...m, [discipline]: out.sentTo.join(', ') || t('merge.theProjectLead', 'the project lead', { ns: 'editor' }) }))
      setNotice({ tone: 'ok', text: takeOutcomeWords(out, labelOf(discipline)) })
      reload()
    } catch (err) {
      console.error('[ProposeMerge] taking responsibility failed', err)
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : t('merge.responsibilityFailed', 'Couldn’t take responsibility. Try again.', { ns: 'editor' }) })
    }
  }

  async function merge(proposal: ProposalView) {
    setBusy('merge')
    setNotice(null)
    try {
      const out = await requestApply(proposal.id)
      setResult(out)
      if (out.landed.length > 0) await recordLandedFrom(responsibilities, projectId, proposal.id, { landed: out.landed, allLanded: out.allLanded })
      reload()
    } catch (err) {
      console.error('[ProposeMerge] merging failed', err)
      setNotice({ tone: 'error', text: err instanceof Error ? err.message : t('merge.mergeFailed', 'The merge didn’t finish. Try again.', { ns: 'editor' }) })
    } finally {
      setBusy(null)
    }
  }

  const ready = load.state === 'ready' ? load : null
  const proposal = ready?.proposal ?? null
  const mine = proposal !== null && ready !== null && proposal.proposedBy === ready.viewerId
  const nothing = ready !== null && ready.preview.parts.length === 0 && ready.preview.conflicts.length === 0
  const proposeBlocked =
    blockedReason ??
    (nothing
      ? t('merge.noChanges', 'This branch has no changes Main doesn’t already have.', { ns: 'editor' })
      : proposal && !mine
        ? t('merge.alreadyProposedBy', '{{who}} already proposed this branch.', { ns: 'editor', who: proposal.proposedByLabel })
        : null)
  const anyApproved = proposal?.parts.some((p) => p.waiting === null) ?? false
  const mergeBlocked =
    blockedReason ??
    (proposal === null
      ? t('merge.proposeFirst', 'Propose it first, so the approvers can see it.', { ns: 'editor' })
      : !mine
        ? t('merge.onlyProposerMerges', 'Only {{who}}, who proposed it, merges it.', { ns: 'editor', who: proposal.proposedByLabel })
        : !anyApproved
          ? t('merge.noPartApproved', 'No part is approved yet. Each part says whom it waits for.', { ns: 'editor' })
          : null)

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-w-2xl" data-testid="propose-merge-dialog">
        <DialogHeader>
          <DialogTitle>{t('merge.title', 'Propose merge to Main', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>{t('merge.description', 'Main changes only when the approved parts land. Design change. Not a change order.', { ns: 'editor' })}</DialogDescription>
        </DialogHeader>
        {load.state === 'loading' ? (
          <div aria-busy="true" className="flex flex-col gap-2">
            <span className="sr-only">{t('merge.comparing', 'Comparing this branch with Main', { ns: 'editor' })}</span>
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : load.state === 'error' ? (
          <Alert variant="destructive" data-testid="propose-merge-error">
            <AlertTitle>{t('merge.previewFailedTitle', 'The merge preview didn’t load', { ns: 'editor' })}</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              <span>{load.message}</span>
              <Button size="sm" variant="outline" onClick={reload}>
                <RefreshCw data-icon="inline-start" />
                {t('merge.tryAgain', 'Try again', { ns: 'editor' })}
              </Button>
            </AlertDescription>
          </Alert>
        ) : nothing ? (
          <Empty data-testid="propose-merge-empty">
            <EmptyHeader>
              <EmptyTitle>{t('merge.nothingToMerge', 'Nothing to merge', { ns: 'editor' })}</EmptyTitle>
              <EmptyDescription>{t('merge.noChanges', 'This branch has no changes Main doesn’t already have.', { ns: 'editor' })}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
            {load.preview.conflicts.length > 0 ? (
              <Alert data-testid="propose-merge-conflicts">
                <AlertTitle>
                  {load.preview.conflicts.length === 1
                    ? t('merge.oneConflict', '1 conflict', { ns: 'editor' })
                    : t('merge.manyConflicts', '{{count}} conflicts', { ns: 'editor', count: load.preview.conflicts.length })}{' '}
                  {t('merge.toResolveFirst', 'to resolve on the branch first', { ns: 'editor' })}
                </AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {load.preview.conflicts.map((c) => (
                      <li key={c.elementId}>{c.words}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}
            <p className="text-sm" data-testid="propose-merge-waiting-for">
              {(() => {
                const pending = (proposal?.parts ?? []).filter((p) => p.waiting !== null)
                if (proposal === null) {
                  const who = load.preview.parts.map(
                    (p) =>
                      `${labelOf(p.discipline)} (${p.approvers.length > 0 ? p.approvers.join(', ') : t('merge.noOneNamedAndNoLead', 'no one named and no project lead', { ns: 'editor' })})`,
                  )
                  return t('merge.willNeedApprovalFrom', 'Will need approval from: {{who}}', { ns: 'editor', who: who.join(', ') })
                }
                if (pending.length === 0) return t('merge.everyPartApproved', 'Every part is approved.', { ns: 'editor' })
                return t('merge.waitingForApprovalFrom', 'Waiting for approval from: {{who}}', {
                  ns: 'editor',
                  who: pending
                    .map((p) => `${labelOf(p.discipline)} (${p.approvers.filter((a) => a.state !== 'approved').map((a) => a.label).join(', ') || t('merge.noOneNamed', 'no one named', { ns: 'editor' })})`)
                    .join(', '),
                })
              })()}
            </p>
            <ul className="divide-y" aria-label={t('merge.parts', 'Parts', { ns: 'editor' })}>
              {load.preview.parts.map((p) => {
                const view = proposal?.parts.find((v) => v.discipline === p.discipline && v.elementCount === p.elementIds.length)
                return (
                  <li key={`${p.discipline}-${p.responsibilityIds.join(',')}`} className="flex flex-wrap items-center gap-2 py-1.5" data-testid="propose-merge-part">
                    <span className="text-sm font-medium">{labelOf(p.discipline)}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.elementIds.length} {p.elementIds.length === 1 ? t('merge.change', 'change', { ns: 'editor' }) : t('merge.changes', 'changes', { ns: 'editor' })}
                    </span>
                    {view ? <Badge variant={view.waiting === null ? 'secondary' : 'outline'}>{view.waiting === null ? t('merge.approved', 'Approved', { ns: 'editor' }) : view.waiting}</Badge> : null}
                    {p.approvers.length === 0 ? (
                      sentTo[p.discipline] ? (
                        <span className="text-xs" data-testid="propose-merge-take-sent">
                          {t('merge.requestSentTo', 'Request sent to', { ns: 'editor' })} {sentTo[p.discipline]}
                        </span>
                      ) : (
                        <ConfirmAction
                          title={t('merge.takeResponsibilityFor', 'Take responsibility for {{part}}?', { ns: 'editor', part: labelOf(p.discipline) })}
                          description={t(
                            'merge.takeResponsibilityWhy',
                            'No one is named for {{part}} and no project lead is named. You become responsible for all of it on this model (narrow it later in Manage › Responsibilities); if you can edit the project it counts at once, otherwise the project lead is asked.',
                            { ns: 'editor', part: labelOf(p.discipline) },
                          )}
                          confirmLabel={t('merge.takeResponsibility', 'Take responsibility', { ns: 'editor' })}
                          onConfirm={() => take(p.discipline)}
                        >
                          <Button size="sm" variant="outline" data-testid="propose-merge-take">
                            <Hand data-icon="inline-start" />
                            {t('merge.takeResponsibilityForThis', 'Take responsibility for this', { ns: 'editor' })}
                          </Button>
                        </ConfirmAction>
                      )
                    ) : null}
                  </li>
                )
              })}
            </ul>
            {result ? (
              <Alert data-testid="propose-merge-result">
                <AlertTitle>{result.allLanded ? t('merge.mergedIntoMain', 'Merged into Main', { ns: 'editor' }) : result.landed.length > 0 ? t('merge.someMerged', 'Some parts merged into Main', { ns: 'editor' }) : t('merge.nothingLanded', 'Nothing landed yet', { ns: 'editor' })}</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {result.landed.map((l) => (
                      <li key={`${l.discipline}-${l.revision}`}>
                        {t('merge.landedAsVersionOf', '{{part}} landed as version {{revision}}.', { ns: 'editor', part: labelOf(l.discipline), revision: l.revision })}
                      </li>
                    ))}
                    {result.waiting.map((w) => (
                      <li key={`${w.discipline}-${w.words}`}>{w.words}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        )}
        {notice ? (
          <p role="status" className={notice.tone === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'} data-testid="propose-merge-notice">
            {notice.text}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">{t('merge.close', 'Close', { ns: 'editor' })}</Button>
          </DialogClose>
          {ready ? (
            <>
              <Button variant="outline" disabled={proposeBlocked !== null || busy !== null} title={proposeBlocked ?? undefined} onClick={() => void propose(ready.preview)} data-testid="propose-merge-propose">
                {busy === 'propose' ? <Spinner aria-hidden /> : null}
                {proposal && mine ? t('merge.updateProposal', 'Update proposal', { ns: 'editor' }) : t('merge.proposeMerge', 'Propose merge', { ns: 'editor' })}
              </Button>
              <Button disabled={mergeBlocked !== null || busy !== null} title={mergeBlocked ?? undefined} onClick={() => proposal && void merge(proposal)} data-testid="propose-merge-merge">
                {busy === 'merge' ? <Spinner aria-hidden /> : <GitMerge data-icon="inline-start" />}
                {t('merge.mergeApprovedParts', 'Merge approved parts', { ns: 'editor' })}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
