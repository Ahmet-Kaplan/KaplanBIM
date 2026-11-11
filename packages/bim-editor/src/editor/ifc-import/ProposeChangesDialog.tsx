'use client'

import { useCallback, useEffect, useState } from 'react'
import { useEditorNavigation } from '@permitzip/bim-editor/host'
import { GitBranch, RefreshCw } from 'lucide-react'
import type { PackSet } from '@permitzip/bim-kernel/packs'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Progress } from '../../ui/progress'
import { ScrollArea } from '../../ui/scroll-area'
import { Spinner } from '../../ui/spinner'
import { withBranch } from '../../contracts/building-model/branch-href'
import { linkedDisciplinesLabel } from '../../contracts/building-model/linked-contract'
import { PROPOSE_WORDS, type ImportReportView, type ProposeProgress, type ProposeState } from '../../contracts/building-model/ifc-import/contract'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { fetchProposalProgressFrom, fetchProposeStateFrom, startProposalFrom, stopProposalFrom } from './propose-api'
import { useEditorTranslate } from '../i18n/translate'

/**
 * Linked models › a model › Propose changes to this model (round 9 I9): the
 * data-use agreement (once), the branch's name, then progress and the report
 * of what converted and what stays as the linked model, and Open the branch.
 * People only. Any discipline, any company: the words name the model and its
 * disciplines, never who sent it.
 */

const POLL_MS = 1500

type Phase =
  | { readonly kind: 'loading' }
  | { readonly kind: 'load_failed'; readonly message: string }
  | { readonly kind: 'ready'; readonly state: ProposeState }
  | { readonly kind: 'starting'; readonly state: ProposeState }
  | { readonly kind: 'running'; readonly state: ProposeState; readonly runId: string; readonly jobId: string; readonly progress: ProposeProgress | null; readonly stopping: boolean }

export function ProposeChangesDialog({
  projectId,
  reference,
  set,
  onClose,
}: {
  readonly projectId: string
  readonly reference: { readonly id: string; readonly label: string } | null
  readonly set?: PackSet
  readonly onClose: () => void
}) {
  return (
    <Dialog open={reference !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="propose-changes-dialog">
        {reference && <ProposeFlow key={reference.id} projectId={projectId} reference={reference} set={set} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function ProposeFlow({ projectId, reference, set, onClose }: { readonly projectId: string; readonly reference: { readonly id: string; readonly label: string }; readonly set?: PackSet; readonly onClose: () => void }) {
  const t = useEditorTranslate()
  const ifcImport = useEditorHost().data.ifcImport
  const { router, pathname, searchParams } = useEditorNavigation()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [accepted, setAccepted] = useState(false)
  const [name, setName] = useState('')
  const [startError, setStartError] = useState<string | null>(null)
  const [pollError, setPollError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const load = useCallback(() => {
    const controller = new AbortController()
    fetchProposeStateFrom(ifcImport, projectId, reference.id, controller.signal, t)
      .then((state) => {
        setPhase({ kind: 'ready', state })
        setName(state.defaultName)
        setAccepted(state.agreement.acceptedAt !== null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        console.error('[ProposeChangesDialog] loading failed', err)
        setPhase({ kind: 'load_failed', message: err instanceof Error ? err.message : t('ifcImport.agreementUnread', 'Couldn\'t read the agreement.', { ns: 'editor' }) })
      })
    return controller
  }, [ifcImport, projectId, reference.id])

  useEffect(() => {
    const controller = load()
    return () => controller.abort()
  }, [load])

  const running = phase.kind === 'running' ? phase : null
  const runId = running?.runId ?? null
  const jobId = running?.jobId ?? null
  const live = running !== null && (running.progress === null || running.progress.status === 'converting' || running.progress.status === 'landing')
  useEffect(() => {
    if (!live || !runId || !jobId) return
    let cancelled = false
    const timer = setTimeout(() => {
      fetchProposalProgressFrom(ifcImport, projectId, reference.id, runId, jobId, t)
        .then((progress) => {
          if (cancelled) return
          setPollError(null)
          setPhase((p) => (p.kind === 'running' && p.runId === runId ? { ...p, progress } : p))
        })
        .catch((err: unknown) => {
          console.error('[ProposeChangesDialog] checking progress failed', err)
          if (!cancelled) setPollError(err instanceof Error ? err.message : t('ifcImport.proposalCheckFailed', 'Couldn\'t check on the proposal.', { ns: 'editor' }))
        })
        .finally(() => {
          if (!cancelled) setTick((t) => t + 1)
        })
    }, POLL_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [ifcImport, live, tick, projectId, reference.id, runId, jobId])

  async function start(state: ProposeState) {
    setStartError(null)
    setPhase({ kind: 'starting', state })
    try {
      const started = await startProposalFrom(ifcImport, projectId, reference.id, { agreementVersion: state.agreement.version, name: name.trim() }, t)
      setPhase({ kind: 'running', state, runId: started.runId, jobId: started.jobId, progress: null, stopping: false })
    } catch (err) {
      console.error('[ProposeChangesDialog] starting failed', err)
      setStartError(err instanceof Error ? err.message : t('ifcImport.proposalStartFailed', 'The proposal couldn\'t be started.', { ns: 'editor' }))
      setPhase({ kind: 'ready', state })
    }
  }

  async function stop() {
    const r = running
    if (!r) return
    setPhase({ ...r, stopping: true })
    try {
      await stopProposalFrom(ifcImport, projectId, reference.id, r.runId, t)
    } catch (err) {
      console.error('[ProposeChangesDialog] stopping failed', err)
      setPollError(err instanceof Error ? err.message : t('ifcImport.couldntStop', 'Couldn\'t stop it.', { ns: 'editor' }))
      setPhase((p) => (p.kind === 'running' ? { ...p, stopping: false } : p))
    }
  }

  function openBranch(branchId: string) {
    router.replace(withBranch(`${pathname}?${searchParams.toString()}`, branchId))
    onClose()
  }

  if (phase.kind === 'loading') {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{PROPOSE_WORDS.title(reference.label)}</DialogTitle>
          <DialogDescription>{t('ifcImport.readingAgreement', 'Reading the data-use agreement…', { ns: 'editor' })}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      </>
    )
  }

  if (phase.kind === 'load_failed') {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{PROPOSE_WORDS.title(reference.label)}</DialogTitle>
        </DialogHeader>
        <Alert variant="destructive">
          <AlertTitle>{t('ifcImport.couldntOpenThis', 'Couldn\'t open this', { ns: 'editor' })}</AlertTitle>
          <AlertDescription>{phase.message}</AlertDescription>
        </Alert>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('ifcImport.close', 'Close', { ns: 'editor' })}
          </Button>
          <Button
            onClick={() => {
              setPhase({ kind: 'loading' })
              load()
            }}
          >
            <RefreshCw data-icon="inline-start" />
            {t('ifcImport.tryAgain', 'Try again', { ns: 'editor' })}
          </Button>
        </DialogFooter>
      </>
    )
  }

  const state = phase.state
  const disciplines = linkedDisciplinesLabel(state.reference.disciplines, set)
  const describe = [disciplines, state.reference.contributor].filter(Boolean).join(' · ')

  if (phase.kind === 'running') {
    return <RunningView label={state.reference.label} describe={describe} phase={phase} pollError={pollError} onStop={() => void stop()} onOpen={openBranch} onClose={onClose} onAgain={() => void start(state)} />
  }

  const alreadyAccepted = state.agreement.acceptedAt !== null
  const nameOk = name.trim().length > 0 && name.trim().length <= 70
  const why = state.blocked ?? (!accepted ? 'Accept the data-use agreement first.' : !nameOk ? 'Name the branch (up to 70 characters).' : null)
  return (
    <>
      <DialogHeader>
        <DialogTitle>{PROPOSE_WORDS.title(state.reference.label)}</DialogTitle>
        <DialogDescription>{describe ? `${describe}. ` : ''}{PROPOSE_WORDS.intro}</DialogDescription>
      </DialogHeader>
      {state.blocked ? (
        <Alert>
          <AlertTitle>{t('ifcImport.notAvailableHere', 'Not available here', { ns: 'editor' })}</AlertTitle>
          <AlertDescription>{state.blocked}</AlertDescription>
        </Alert>
      ) : (
        <FieldGroup>
          <Field>
            <FieldLabel>{state.agreement.title}</FieldLabel>
            <ScrollArea className="h-36 rounded-md border p-3 text-sm whitespace-pre-line" data-testid="propose-agreement">
              {state.agreement.body}
            </ScrollArea>
            {alreadyAccepted ? (
              <FieldDescription>{t('ifcImport.acceptedOn', 'You accepted this version on {{when}}.', { ns: 'editor', when: new Date(state.agreement.acceptedAt ?? '').toLocaleDateString() })}</FieldDescription>
            ) : (
              <Field orientation="horizontal">
                <Checkbox id="propose-accept" checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} aria-label={PROPOSE_WORDS.agree} />
                <FieldLabel htmlFor="propose-accept">{PROPOSE_WORDS.agree}</FieldLabel>
              </Field>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="propose-name">{t('ifcImport.branchName', 'Branch name', { ns: 'editor' })}</FieldLabel>
            <Input id="propose-name" value={name} maxLength={70} onChange={(e) => setName(e.target.value)} />
            <FieldDescription>
              {t('ifcImport.onlyYouEditDisciplines', 'Only you edit it. Merging any of it into Main needs the approvals the project names for those disciplines.', { ns: 'editor' })}
            </FieldDescription>
          </Field>
          {startError && (
            <Alert variant="destructive">
              <AlertTitle>{t('ifcImport.itDidntStart', 'It didn\'t start', { ns: 'editor' })}</AlertTitle>
              <AlertDescription>{startError}</AlertDescription>
            </Alert>
          )}
        </FieldGroup>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('ifcImport.cancel', 'Cancel', { ns: 'editor' })}
        </Button>
        <Button disabled={why !== null || phase.kind === 'starting'} title={why ?? undefined} onClick={() => void start(state)} data-testid="propose-start">
          {phase.kind === 'starting' ? <Spinner data-icon="inline-start" /> : <GitBranch data-icon="inline-start" />}
          {PROPOSE_WORDS.start}
        </Button>
      </DialogFooter>
      {why && !state.blocked && <p className="text-muted-foreground text-right text-xs">{why}</p>}
    </>
  )
}

function RunningView({
  label,
  describe,
  phase,
  pollError,
  onStop,
  onOpen,
  onClose,
  onAgain,
}: {
  readonly label: string
  readonly describe: string
  readonly phase: Extract<Phase, { kind: 'running' }>
  readonly pollError: string | null
  readonly onStop: () => void
  readonly onOpen: (branchId: string) => void
  readonly onClose: () => void
  readonly onAgain: () => void
}) {
  const t = useEditorTranslate()
  const p = phase.progress
  const status = p?.status ?? 'converting'
  const inFlight = status === 'converting' || status === 'landing'
  return (
    <>
      <DialogHeader>
        <DialogTitle>{PROPOSE_WORDS.title(label)}</DialogTitle>
        <DialogDescription>{describe || t('ifcImport.linkedModel', 'Linked model', { ns: 'editor' })}</DialogDescription>
      </DialogHeader>
      {inFlight && (
        <div className="flex flex-col gap-2" role="status" aria-live="polite">
          <p className="text-sm">{status === 'landing' && p ? PROPOSE_WORDS.landing(p.landed, p.total) : PROPOSE_WORDS.converting}</p>
          {status === 'landing' && p && p.total > 0 ? <Progress value={(p.landed / p.total) * 100} /> : <Spinner />}
          <p className="text-muted-foreground text-xs">{t('ifcImport.keepsGoing', 'You can close this; it keeps going, and the branch shows in the Branch picker when it is ready.', { ns: 'editor' })}</p>
        </div>
      )}
      {pollError && (
        <Alert>
          <AlertTitle>{t('ifcImport.couldntCheckJustNow', 'Couldn\'t check just now', { ns: 'editor' })}</AlertTitle>
          <AlertDescription>{pollError} {t('ifcImport.triesAgain', 'It tries again by itself.', { ns: 'editor' })}</AlertDescription>
        </Alert>
      )}
      {status === 'done' && <p className="text-sm font-medium">{PROPOSE_WORDS.done}</p>}
      {(status === 'failed' || status === 'cancelled') && (
        <Alert variant={status === 'failed' ? 'destructive' : 'default'}>
          <AlertTitle>{status === 'failed' ? t('ifcImport.itDidntFinish', 'It didn\'t finish', { ns: 'editor' }) : PROPOSE_WORDS.stopped}</AlertTitle>
          <AlertDescription>{p?.error ?? t('ifcImport.mainUnchanged', 'Main didn’t change.', { ns: 'editor' })}</AlertDescription>
        </Alert>
      )}
      {p?.report && <ImportReport report={p.report} />}
      <DialogFooter>
        {inFlight ? (
          <>
            <Button variant="outline" onClick={onClose}>
              {t('ifcImport.close', 'Close', { ns: 'editor' })}
            </Button>
            <Button variant="destructive" disabled={phase.stopping} onClick={onStop} data-testid="propose-stop">
              {phase.stopping && <Spinner data-icon="inline-start" />}
              {PROPOSE_WORDS.stop}
            </Button>
          </>
        ) : status === 'done' && p?.branchId ? (
          <>
            <Button variant="outline" onClick={onClose}>
              {t('ifcImport.close', 'Close', { ns: 'editor' })}
            </Button>
            <Button onClick={() => p.branchId && onOpen(p.branchId)} data-testid="propose-open-branch">
              <GitBranch data-icon="inline-start" />
              {PROPOSE_WORDS.openBranch}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              {t('ifcImport.close', 'Close', { ns: 'editor' })}
            </Button>
            <Button onClick={onAgain}>
              <RefreshCw data-icon="inline-start" />
              {t('ifcImport.tryAgain', 'Try again', { ns: 'editor' })}
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  )
}

/** What converted and what stays as the linked model, by kind, with the reasons. */
export function ImportReport({ report }: { readonly report: ImportReportView }) {
  const t = useEditorTranslate()
  const left = report.classes.filter((c) => c.linked.length > 0)
  return (
    <div className="flex flex-col gap-2 text-sm" data-testid="propose-report">
      <p>{report.summary}</p>
      {report.levelsAdded.length > 0 && <p className="text-muted-foreground">{t('ifcImport.newLevels', 'New levels:', { ns: 'editor' })} {report.levelsAdded.join(', ')}.</p>}
      {left.length > 0 && (
        <ScrollArea className="max-h-40 rounded-md border p-2">
          <ul className="flex flex-col gap-1">
            {left.map((c) => (
              <li key={c.classId ?? c.label}>
                <span className="font-medium">{c.label}</span>
                {c.converted > 0 ? t('ifcImport.convertedParen', ' ({{count}} converted)', { ns: 'editor', count: c.converted }) : ''}:{' '}
                {c.linked
                  .map((r) => t('ifcImport.stayLinked', '{{count}} stay linked because {{why}}', { ns: 'editor', count: r.count, why: r.reason }))
                  .join('; ')}
                .
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
      {report.notes.length > 0 && (
        <p className="text-muted-foreground text-xs">
          {report.notes.slice(0, 5).join('. ')}
          {report.notes.length > 5 ? t('ifcImport.andCountMore', ' (and {{count}} more)', { ns: 'editor', count: report.notes.length - 5 }) : ''}.
        </p>
      )}
    </div>
  )
}
