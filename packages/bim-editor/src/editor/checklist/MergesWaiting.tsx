'use client'

import { useCallback, useEffect, useState } from 'react'
import { GitMerge, Hand, RefreshCw } from 'lucide-react'
import { checkingContextFor, disciplineLabel, writeCheckingContext, type ModelState } from '@permitzip/bim-kernel'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { ConfirmAction } from '../../ui/confirm-action'
import { Skeleton } from '../../ui/skeleton'
import { Textarea } from '../../ui/textarea'
import type { PartView, ProposalView } from '../../contracts/bim/merge/model'
import type { MergesResponse, ResponsibilitiesResponse } from '../../contracts/bim/responsibilities/api'
import { AssuranceButton } from '../signing/AssuranceButton'
import { SignoffSignatureLine } from '../signing/SignoffSignatureLine'
import { SignoffCheckedAgainst } from '../code-change/SignoffCheckedAgainst'
import { useAssuranceOffer, type AssuranceOffer } from '../signing/useAssuranceOffer'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { secureLatestEntryFrom, secureOutcomeWords, type Assurance } from '../../contracts/bim/signing/client'
import { acceptResponsibilityFrom, decideMergePartFrom, decideRequestFrom, fetchMergesFrom, fetchResponsibilitiesFrom, takeResponsibilityFrom } from '../../contracts/bim/responsibilities/client'
import { useEditorTranslate, type Translate } from '../i18n/translate'
import { recordedWords, takeOutcomeWords } from '../responsibilities/signoff-words'

/**
 * Checklist › Merges waiting for you: responsibilities you were named for
 * and haven't accepted ("You were named responsible for a discipline
 * and scope. Accept?"), then each open merge with your parts first, each
 * with Approve and Decline (a decline says why).
 */

export interface MergesWaitingProps {
  readonly projectId: string
  /** Discipline names as the open model's registry says them. */
  readonly labelOf?: (discipline: string) => string
  /** The open model (C10): an approval pins the code it was checked against, and each decided line says so. */
  readonly model?: ModelState | null
}

type Load = { readonly state: 'loading' } | { readonly state: 'error'; readonly message: string } | { readonly state: 'ready'; readonly merges: MergesResponse; readonly named: ResponsibilitiesResponse }

/** How one approver's decision reads on a part (§8 status vocabulary). */
function stateWord(state: 'approved' | 'declined' | 'waiting' | 'stale', t: Translate): string {
  switch (state) {
    case 'approved':
      return t('checklist.merges.stateApproved', 'Approved', { ns: 'editor' })
    case 'declined':
      return t('checklist.merges.stateDeclined', 'Declined', { ns: 'editor' })
    case 'waiting':
      return t('checklist.merges.stateWaiting', 'Waiting', { ns: 'editor' })
    case 'stale':
      return t('checklist.merges.stateStale', 'Changed since approval', { ns: 'editor' })
  }
}

function PartRow({
  part,
  proposal,
  label,
  onDecide,
  busy,
  take,
  projectId,
  signing,
  model,
}: {
  part: PartView
  proposal: ProposalView
  label: string
  /** `assurance`: sign (Touch ID) or verify (a code) after recording (S9). */
  onDecide: (decision: 'approved' | 'declined', note?: string, assurance?: Assurance) => Promise<void>
  busy: boolean
  projectId: string
  signing: AssuranceOffer
  /** No one is named and no lead: offer "Take responsibility for this" (or say the request went out). */
  take: { readonly sentTo: string | null; readonly onTake: () => Promise<void> } | null
  model: ModelState | null
}) {
  const t = useEditorTranslate()
  const [declining, setDeclining] = useState(false)
  const [note, setNote] = useState('')
  const mine = part.mine
  const whyDecline = t('checklist.merges.declineWhy', 'Say why you decline, so the proposer knows what to change.', { ns: 'editor' })
  return (
    <li className="flex flex-col gap-1.5 py-2" data-testid="merge-part" data-discipline={part.discipline} data-mine={mine ? 'true' : 'false'}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {part.elementCount === 1
            ? t('checklist.merges.oneChange', '{{count}} change', { ns: 'editor', count: part.elementCount })
            : t('checklist.merges.changes', '{{count}} changes', { ns: 'editor', count: part.elementCount })}
        </span>
        {mine ? (
          <Badge>
            {mine.asLead
              ? t('checklist.merges.yoursAsLead', 'Yours (as project lead)', { ns: 'editor' })
              : t('checklist.merges.yours', 'Yours', { ns: 'editor' })}
          </Badge>
        ) : null}
        {part.waiting === null ? <Badge variant="secondary">{t('checklist.merges.stateApproved', 'Approved', { ns: 'editor' })}</Badge> : null}
      </div>
      <ul className="flex flex-col gap-1 text-xs" aria-label={t('checklist.merges.approvers', '{{part}} approvers', { ns: 'editor', part: label })}>
        {part.approvers.map((a) => (
          <li key={`${a.responsibilityId ?? 'lead'}-${a.label}`} className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">
              {t('checklist.merges.approverState', '{{who}}: {{state}}', { ns: 'editor', who: a.label, state: stateWord(a.state, t) })}
            </Badge>
            {a.decidedAt && a.signoffSeq !== undefined && (a.state === 'approved' || a.state === 'declined') ? (
              <span className="text-muted-foreground" data-testid="merge-recorded">
                {recordedWords(a.decidedAt, a.signoffSeq)}
              </span>
            ) : null}
            {a.decidedAt && a.signoffSeq !== undefined && (a.state === 'approved' || a.state === 'declined') ? <SignoffSignatureLine projectId={projectId} subjectId={proposal.id} seq={a.signoffSeq} /> : null}
            {a.decidedAt && a.signoffSeq !== undefined && a.state === 'approved' ? <SignoffCheckedAgainst projectId={projectId} subjectId={proposal.id} seq={a.signoffSeq} model={model} /> : null}
          </li>
        ))}
      </ul>
      {part.waiting ? <p className="text-xs text-muted-foreground">{part.waiting}</p> : null}
      {take ? (
        take.sentTo !== null ? (
          <p className="text-xs" data-testid="merge-take-sent">
            {t('checklist.merges.requestSent', 'Request sent to {{who}}', { ns: 'editor', who: take.sentTo })}
          </p>
        ) : (
          <ConfirmAction
            title={t('checklist.merges.takeTitle', 'Take responsibility for {{part}}?', { ns: 'editor', part: label })}
            description={
              part.suggested
                ? t(
                    'checklist.merges.takeSuggested',
                    'You become responsible for {{part}} on {{scenario}}: where this part’s changes are (change it later in Manage › Responsibilities). If you can edit the project and no one is named, it counts at once; otherwise the project lead is asked.',
                    { ns: 'editor', part: label, scenario: part.suggested.words },
                  )
                : t(
                    'checklist.merges.takeAll',
                    'You become responsible for all of {{part}} on this model (narrow it later in Manage › Responsibilities). If you can edit the project and no one is named, it counts at once; otherwise the project lead is asked.',
                    { ns: 'editor', part: label },
                  )
            }
            confirmLabel={t('checklist.merges.take', 'Take responsibility', { ns: 'editor' })}
            onConfirm={take.onTake}
          >
            <Button size="sm" variant="outline" disabled={busy} className="self-start" data-testid="merge-take">
              <Hand data-icon="inline-start" />
              {t('checklist.merges.takeThis', 'Take responsibility for this', { ns: 'editor' })}
            </Button>
          </ConfirmAction>
        )
      ) : null}
      {mine && !declining ? (
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={() => void onDecide('approved')} data-testid="merge-approve">
            {t('checklist.merges.approve', 'Approve', { ns: 'editor' })}
          </Button>
          <AssuranceButton size="sm" offer={signing} busy={busy} onSecure={(a) => void onDecide('approved', undefined, a)} action="Approve" testId="merge-approve-signed" />
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setDeclining(true)} data-testid="merge-decline">
            {t('checklist.merges.declineMore', 'Decline…', { ns: 'editor' })}
          </Button>
        </div>
      ) : null}
      {mine && declining ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (note.trim() === '') return
            void onDecide('declined', note.trim()).then(() => setDeclining(false))
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation()
              setDeclining(false)
            }
          }}
        >
          <Textarea
            aria-label={t('checklist.merges.declineAria', 'Why you decline {{part}} on {{branch}}', { ns: 'editor', part: label, branch: proposal.branchName })}
            placeholder={t('checklist.merges.declinePlaceholder', 'What should change on the branch', { ns: 'editor' })}
            value={note}
            maxLength={2000}
            autoFocus
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              type="submit"
              variant="destructive"
              disabled={busy || note.trim() === ''}
              title={note.trim() === '' ? whyDecline : undefined}
              data-testid="merge-decline-confirm"
            >
              {t('checklist.merges.decline', 'Decline', { ns: 'editor' })}
            </Button>
            <AssuranceButton
              size="sm"
              variant="destructive"
              offer={signing}
              busy={busy}
              blockedReason={note.trim() === '' ? whyDecline : null}
              onSecure={(a) => void onDecide('declined', note.trim(), a).then(() => setDeclining(false))}
              action="Decline"
              testId="merge-decline-signed"
            />
            <Button size="sm" type="button" variant="ghost" onClick={() => setDeclining(false)}>
              {t('checklist.cancel', 'Cancel', { ns: 'editor' })}
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  )
}

export function MergesWaiting({ projectId, labelOf = disciplineLabel, model = null }: MergesWaitingProps) {
  const t = useEditorTranslate()
  const host = useEditorHost().data
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<Readonly<Record<string, string>>>({})
  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const signing = useAssuranceOffer(true)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([fetchMergesFrom(host.responsibilities, projectId, controller.signal), fetchResponsibilitiesFrom(host.responsibilities, projectId, controller.signal)])
      .then(([merges, named]) => setLoad({ state: 'ready', merges, named }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        console.error('[MergesWaiting] loading failed', err)
        setLoad({ state: 'error', message: err instanceof Error ? err.message : t('checklist.merges.loadFailedOne', 'Merges waiting for you didn’t load.', { ns: 'editor' }) })
      })
    return () => controller.abort()
  }, [host.responsibilities, projectId, attempt, t])

  /**
   * Run one action and show what it said. `failed` is a whole sentence in the
   * language on screen: "Couldn’t accept it. Try again." is never built from a
   * verb and a noun, because the verb and its object sit in that order in English
   * and in no other language.
   */
  const act = async (fn: () => Promise<string>, failed: string) => {
    setBusy(true)
    setNotice(null)
    try {
      setNotice(await fn())
      reload()
    } catch (err) {
      console.error('[MergesWaiting] an action failed', { failed, err })
      setNotice(err instanceof Error ? err.message : failed)
    } finally {
      setBusy(false)
    }
  }

  if (load.state === 'loading')
    return (
      <section aria-label={t('checklist.merges.heading', 'Merges waiting for you', { ns: 'editor' })} aria-busy="true" data-testid="merges-waiting" className="flex flex-col gap-2">
        <span className="sr-only">{t('checklist.merges.loading', 'Loading merges waiting for you', { ns: 'editor' })}</span>
        <Skeleton className="h-8" />
      </section>
    )
  if (load.state === 'error')
    return (
      <section aria-label={t('checklist.merges.heading', 'Merges waiting for you', { ns: 'editor' })} data-testid="merges-waiting">
        <Alert variant="destructive" data-testid="merges-waiting-error">
          <AlertTitle>{t('checklist.merges.loadFailed', 'Merges waiting for you didn’t load', { ns: 'editor' })}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>{load.message}</span>
            <Button size="sm" variant="outline" onClick={reload}>
              <RefreshCw data-icon="inline-start" />
              {t('checklist.merges.tryAgain', 'Try again', { ns: 'editor' })}
            </Button>
          </AlertDescription>
        </Alert>
      </section>
    )

  const toAccept = load.named.responsibilities.filter((r) => r.isMine && r.partyKind === 'person' && !r.acceptedAt)
  const deciderWords = load.named.deciders.map((d) => d.label).join(', ') || t('checklist.merges.theProjectLead', 'the project lead', { ns: 'editor' })
  const myPending = (discipline: string) => (load.named.responsibilities.some((r) => r.isMine && r.pendingRequest && r.discipline === discipline) ? deciderWords : null)
  const requests = load.named.canDecideRequests ? load.named.responsibilities.filter((r) => r.pendingRequest && !r.isMine) : []
  const waitingOnMe = load.merges.proposals.filter((p) => p.parts.some((part) => part.mine && part.approvers.some((a) => a.state !== 'approved')))
  const others = load.merges.proposals.filter((p) => !waitingOnMe.includes(p))

  return (
    <section aria-label={t('checklist.merges.heading', 'Merges waiting for you', { ns: 'editor' })} data-testid="merges-waiting" className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <GitMerge className="size-4" aria-hidden /> {t('checklist.merges.heading', 'Merges waiting for you', { ns: 'editor' })}
        <Badge variant={waitingOnMe.length + toAccept.length + requests.length > 0 ? 'default' : 'outline'} data-testid="merges-waiting-count">
          {waitingOnMe.length + toAccept.length + requests.length}
        </Badge>
      </h3>
      {notice ? (
        <p role="status" className="text-xs text-muted-foreground" data-testid="merges-waiting-notice">
          {notice}
        </p>
      ) : null}
      {toAccept.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm" data-testid="merges-accept-row">
          <span className="flex-1">
            {t('checklist.merges.named', 'You were named responsible for {{what}}. Accept?', {
              ns: 'editor',
              what: `${labelOf(r.discipline)}${r.wholeDiscipline ? '' : ` (${r.scopeWords})`}`,
            })}
          </span>
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void act(async () => {
                const out = await acceptResponsibilityFrom(host.responsibilities, projectId, r.id)
                return t('checklist.merges.accepted', 'Accepted. You can now approve merges in that part.{{recorded}}', {
                  ns: 'editor',
                  recorded: out.signoffSeq !== null ? ` ${recordedWords(out.acceptedAt, out.signoffSeq)}.` : '',
                })
              }, t('checklist.merges.acceptFailed', 'Couldn’t accept it. Try again.', { ns: 'editor' }))
            }
            data-testid="merges-accept"
          >
            {t('checklist.merges.accept', 'Accept', { ns: 'editor' })}
          </Button>
        </div>
      ))}
      {requests.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm" data-testid="merges-request-row">
          <span className="flex-1">
            {t('checklist.merges.requested', '{{who}} asked to be responsible for {{what}}. Approve or decline in Manage › Responsibilities, or approve here.', {
              ns: 'editor',
              who: r.label,
              what: `${labelOf(r.discipline)}${r.wholeDiscipline ? '' : ` (${r.scopeWords})`}`,
            })}
          </span>
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void act(
                async () =>
                  (await decideRequestFrom(host.responsibilities, projectId, r.id, { grant: true })).granted
                    ? t('checklist.merges.nowResponsible', '{{who}} is now responsible.', { ns: 'editor', who: r.label })
                    : t('checklist.merges.saved', 'Saved.', { ns: 'editor' }),
                t('checklist.merges.grantFailed', 'Couldn’t approve the request. Try again.', { ns: 'editor' }),
              )
            }
            data-testid="merges-request-grant"
          >
            {t('checklist.merges.approve', 'Approve', { ns: 'editor' })}
          </Button>
        </div>
      ))}
      {waitingOnMe.length === 0 && toAccept.length === 0 && requests.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-testid="merges-waiting-empty">
          {t('checklist.merges.empty', 'No merges are waiting for you.', { ns: 'editor' })}
        </p>
      ) : null}
      {[...waitingOnMe, ...others].map((p) => (
        <article key={p.id} className="rounded-md border p-2" data-testid="merge-proposal" data-proposal={p.id}>
          <header className="text-sm">
            <span className="font-medium">{t('checklist.merges.branch', 'Branch: {{name}}', { ns: 'editor', name: p.branchName })}</span>
            <span className="text-muted-foreground">
              {t('checklist.merges.proposedBy', ' · proposed by {{who}} · version {{version}}', { ns: 'editor', who: p.proposedByLabel, version: p.branchHead })}
            </span>
          </header>
          <p className="text-xs text-muted-foreground">{t('checklist.merges.designChange', 'Design change. Not a change order.', { ns: 'editor' })}</p>
          {p.conflicts.length > 0 ? (
            <Alert className="mt-2">
              <AlertTitle>
                {p.conflicts.length === 1
                  ? t('checklist.merges.oneConflict', '1 conflict with Main to resolve on the branch first', { ns: 'editor' })
                  : t('checklist.merges.conflicts', '{{count}} conflicts with Main to resolve on the branch first', { ns: 'editor', count: p.conflicts.length })}
              </AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {p.conflicts.slice(0, 5).map((c) => (
                    <li key={c.elementId}>{c.words}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
          <ul className="divide-y">
            {[...p.parts].sort((a, b) => Number(b.mine !== undefined) - Number(a.mine !== undefined)).map((part) => (
              <PartRow
                key={`${part.discipline}-${part.approvers.map((a) => a.responsibilityId ?? 'lead').join(',')}`}
                part={part}
                proposal={p}
                label={labelOf(part.discipline)}
                busy={busy}
                projectId={projectId}
                signing={signing}
                model={model}
                take={
                  part.uncovered && load.named.leads.length === 0
                    ? {
                        sentTo: sentTo[part.discipline] ?? myPending(part.discipline),
                        onTake: () =>
                          act(async () => {
                            const s = part.suggested
                            const scope = s ? { ...(s.scope.levels ? { levels: [...s.scope.levels] } : {}), ...(s.scope.systems ? { systems: [...s.scope.systems] } : {}) } : null
                            const out = await takeResponsibilityFrom(host.responsibilities, projectId, { discipline: part.discipline, ...(s && scope ? { scope, scopeWords: s.words } : {}) })
                            if (out.outcome === 'requested')
                              setSentTo((m) => ({ ...m, [part.discipline]: out.sentTo.join(', ') || t('checklist.merges.theProjectLead', 'the project lead', { ns: 'editor' }) }))
                            return takeOutcomeWords(out, labelOf(part.discipline))
                          }, t('checklist.merges.takeFailed', 'Couldn’t take responsibility. Try again.', { ns: 'editor' })),
                      }
                    : null
                }
                onDecide={(decision, note, assurance) =>
                  act(
                    async () => {
                      const out = await decideMergePartFrom(host.responsibilities, projectId, p.id, { responsibilityId: part.mine?.responsibilityId ?? null, decision, ...(note ? { note } : {}), branchHead: p.branchHead, deltaDigest: part.deltaDigest, ...(model && decision === 'approved' ? { checkingContext: writeCheckingContext(checkingContextFor(model)) } : {}) })
                      const what =
                        decision === 'approved'
                          ? t('checklist.merges.approvedIt', 'Approved {{part}} on {{branch}}.', { ns: 'editor', part: labelOf(part.discipline), branch: p.branchName })
                          : t('checklist.merges.declinedIt', 'Declined {{part}} on {{branch}}. The proposer sees why.', { ns: 'editor', part: labelOf(part.discipline), branch: p.branchName })
                      if (assurance) return `${what} ${secureOutcomeWords(await secureLatestEntryFrom(host.signing, projectId, p.id, assurance))}`
                      return `${what} ${recordedWords(new Date().toISOString(), out.signoffSeq)}.`
                    },
                    t('checklist.merges.decideFailed', 'Couldn’t save your decision. Try again.', { ns: 'editor' }),
                  )
                }
              />
            ))}
          </ul>
        </article>
      ))}
    </section>
  )
}
