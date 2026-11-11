'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeftIcon, FilePlus2Icon, MailIcon, RotateCwIcon, SendIcon } from 'lucide-react'
import { CHANGE_WORDS, changeOrderMoves, type ModelState } from '@permitzip/bim-kernel'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../../ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Skeleton } from '../../ui/skeleton'
import { Spinner } from '../../ui/spinner'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { fetchChangeOrderFrom, fetchChangeOrdersFrom, inviteAddresseeFrom, setChangeOrderStatusFrom } from '../../contracts/bim/change-orders/client'
import { statusWords, type ChangeOrderDetailResponse, type ChangeOrderView, type ChangeOrdersResponse } from '../../contracts/bim/change-orders/model'
import type { VersionEntry } from '../../contracts/building-model/branch-versions'
import type { BranchChannel } from '../branches/useBranches'
import { AnswerChangeOrderDialog, type Answer } from './AnswerChangeOrderDialog'
import { SignoffSignatureLine } from '../signing/SignoffSignatureLine'
import { SignoffCheckedAgainst } from '../code-change/SignoffCheckedAgainst'
import { useAssuranceOffer } from '../signing/useAssuranceOffer'
import { secureLatestEntryFrom } from '../../contracts/bim/signing/client'
import { NewChangeOrderDialog } from './NewChangeOrderDialog'
import { PriceDeltaWith } from './PriceDeltaWith'
import { QuantityDeltaList } from './QuantityDeltaList'
import { useQuantityDelta } from './useQuantityDelta'
import { useEditorTranslate } from '../i18n/translate'

type Load<T> = { readonly state: 'loading' } | { readonly state: 'error'; readonly message: string } | { readonly state: 'ready'; readonly data: T }

function useLoad<T>(fetcher: ((signal: AbortSignal) => Promise<T>) | null, label: string) {
  const t = useEditorTranslate()
  const [attempt, setAttempt] = useState(0)
  const [answer, setAnswer] = useState<{ readonly attempt: number; readonly fetcher: unknown; readonly load: Load<T> } | null>(null)
  useEffect(() => {
    if (!fetcher) return
    const controller = new AbortController()
    fetcher(controller.signal)
      .then((data) => setAnswer({ attempt, fetcher, load: { state: 'ready', data } }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        console.error(`[ChangeOrders] ${label} failed`, err)
        setAnswer({ attempt, fetcher, load: { state: 'error', message: err instanceof Error ? err.message : t('changeOrders.labelDidntLoad', "{{label}} didn't load.", { ns: 'editor', label }) } })
      })
    return () => controller.abort()
  }, [fetcher, attempt, label, t])
  const load: Load<T> = answer && answer.attempt === attempt && answer.fetcher === fetcher ? answer.load : { state: 'loading' }
  return { load, reload: useCallback(() => setAttempt((n) => n + 1), []) }
}

export interface ChangeOrdersDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly projectId: string
  readonly model: ModelState | null
  readonly channel: BranchChannel | null
  /** The Versions list (lane B), for "since version…"; null while it loads. */
  readonly versions: readonly VersionEntry[] | null
}

/**
 * Building Model › Manage › Change orders. Every change order here was
 * opened by a person; nothing opens one by itself. Each is addressed to one
 * contact or company, and only they accept, refuse or mark it no cost, with
 * a reason. A change order carries no price; anyone may price its quantity
 * change with their own book, privately.
 */
export function ChangeOrdersDialog({ open, onOpenChange, projectId, model, channel, versions }: ChangeOrdersDialogProps) {
  const t = useEditorTranslate()
  const changeOrders = useEditorHost().data.changeOrders
  const listFetcher = useCallback((signal: AbortSignal) => fetchChangeOrdersFrom(changeOrders, projectId, signal), [changeOrders, projectId])
  const { load, reload } = useLoad<ChangeOrdersResponse>(open ? listFetcher : null, t('changeOrders.title', 'Change orders', { ns: 'editor' }))
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const modelId = load.state === 'ready' ? load.data.modelId : null
  const powers = load.state === 'ready' ? load.data.powers : null
  const openWhy = powers === null ? 'Loading…' : !powers.onProject ? t('changeOrders.onlyPeopleOpen', 'Only people on this project open change orders.', { ns: 'editor' }) : !powers.canOpen ? t('changeOrders.canSeeNotOpen', 'You can see change orders here but not open them. Ask the project lead for change-order access.', { ns: 'editor' }) : !modelId ? t('changeOrders.noModelYet', 'This project has no building model yet.', { ns: 'editor' }) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('panel.changeOrders', 'Change orders', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>{CHANGE_WORDS.notAChangeOrder} {t('changeOrders.whatIsOne', 'A change order exists only when someone opens one and addresses it to the party it is for.', { ns: 'editor' })}</DialogDescription>
        </DialogHeader>

        {notice ? (
          <Alert>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}

        {selected ? (
          <ChangeOrderDetail
            projectId={projectId}
            id={selected}
            model={model}
            channel={channel}
            canInvite={powers?.canInvite ?? false}
            onBack={() => setSelected(null)}
            onChanged={reload}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {load.state === 'ready'
                  ? load.data.orders.length === 1
                    ? t('changeOrders.oneChangeOrder', '{{count}} change order', { ns: 'editor', count: load.data.orders.length })
                    : t('changeOrders.manyChangeOrders', '{{count}} change orders', { ns: 'editor', count: load.data.orders.length })
                  : ' '}
              </p>
              <Button size="sm" disabled={openWhy !== null} title={openWhy ?? undefined} onClick={() => setCreating(true)}>
                <FilePlus2Icon aria-hidden /> {t('changeOrders.newChangeOrder', 'New change order', { ns: 'editor' })}
              </Button>
            </div>
            {openWhy && powers !== null ? <p className="text-xs text-muted-foreground">{openWhy}</p> : null}
            {load.state === 'loading' ? (
              <div role="status" aria-label={t('changeOrders.loading', 'Loading change orders', { ns: 'editor' })} className="flex flex-col gap-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : load.state === 'error' ? (
              <Alert variant="destructive">
                <AlertTitle>{t('changeOrders.loadFailed', 'Change orders didn’t load', { ns: 'editor' })}</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-2">
                  {load.message}
                  <Button size="sm" variant="outline" onClick={reload}>
                    <RotateCwIcon aria-hidden /> {t('changeOrders.retry', 'Retry', { ns: 'editor' })}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : load.data.orders.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{t('changeOrders.noneYet', 'No change orders yet', { ns: 'editor' })}</EmptyTitle>
                  <EmptyDescription>{t('changeOrders.noneYetWhy', 'Design changes, merges and answered questions never open one. Press New change order when a change needs one.', { ns: 'editor' })}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup aria-label={t('panel.changeOrders', 'Change orders', { ns: 'editor' })} className="max-h-[50vh] overflow-y-auto">
                {load.data.orders.map((o) => (
                  <ChangeOrderRow key={o.id} order={o} onOpen={() => setSelected(o.id)} />
                ))}
              </ItemGroup>
            )}
          </div>
        )}

        {creating && modelId ? (
          <NewChangeOrderDialog
            open={creating}
            onOpenChange={setCreating}
            projectId={projectId}
            modelId={modelId}
            model={model}
            channel={channel}
            versions={versions}
            onOpened={(id, why) => {
              setNotice(why ?? null)
              reload()
              setSelected(id)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ChangeOrderRow({ order, onOpen }: { readonly order: ChangeOrderView; readonly onOpen: () => void }) {
  const t = useEditorTranslate()
  return (
    <Item variant="outline" size="sm">
      <ItemContent>
        <ItemTitle>
          {order.title}
          <Badge variant={order.status === 'refused' ? 'destructive' : 'secondary'}>{order.statusWords}</Badge>
          {order.iAmAddressee && order.status === 'sent' ? <Badge>{t('changeOrders.forYou', 'For you', { ns: 'editor' })}</Badge> : null}
        </ItemTitle>
        <ItemDescription>
          {t('changeOrders.forAndOpenedBy', 'For {{to}} · {{target}} · opened by {{who}}', { ns: 'editor', to: order.addressee.label, target: order.targetWords, who: order.openedByLabel })}
          {order.waitingWords ? ` · ${order.waitingWords}` : ''}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="sm" variant="outline" onClick={onOpen}>
          {t('changeOrders.open', 'Open', { ns: 'editor' })}
        </Button>
      </ItemActions>
    </Item>
  )
}

function ChangeOrderDetail({ projectId, id, model, channel, canInvite, onBack, onChanged }: { readonly projectId: string; readonly id: string; readonly model: ModelState | null; readonly channel: BranchChannel | null; readonly canInvite: boolean; readonly onBack: () => void; readonly onChanged: () => void }) {
  const t = useEditorTranslate()
  const host = useEditorHost().data
  const fetcher = useCallback((signal: AbortSignal) => fetchChangeOrderFrom(host.changeOrders, projectId, id, signal), [host.changeOrders, projectId, id])
  const { load, reload } = useLoad<ChangeOrderDetailResponse>(fetcher, t('changeOrders.theChangeOrder', 'The change order', { ns: 'editor' }))
  const order = load.state === 'ready' ? load.data.order : null
  const { state: delta, retry } = useQuantityDelta(channel, model, order ? order.target : null)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [busy, setBusy] = useState<'send' | 'invite' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const signing = useAssuranceOffer(true)
  const [invited, setInvited] = useState(false)

  if (load.state === 'loading') {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner aria-hidden /> {t('changeOrders.loadingOne', 'Loading the change order…', { ns: 'editor' })}
      </p>
    )
  }
  if (load.state === 'error' || !order) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('changeOrders.oneDidntLoad', 'The change order didn’t load', { ns: 'editor' })}</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-2">
          {load.state === 'error' ? load.message : ''}
          <Button size="sm" variant="outline" onClick={reload}>
            <RotateCwIcon aria-hidden /> {t('changeOrders.retry', 'Retry', { ns: 'editor' })}
          </Button>
          <Button size="sm" variant="ghost" onClick={onBack}>
            {t('changeOrders.backToList', 'Back to the list', { ns: 'editor' })}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const canSend = order.iOpenedIt && changeOrderMoves(order.statusKnown, 'opener').includes('sent')
  const answers = order.iAmAddressee ? changeOrderMoves(order.statusKnown, 'addressee') : []
  const digest = delta.status === 'ready' ? delta.read.digest : undefined
  const done = () => {
    reload()
    onChanged()
  }

  async function send() {
    setBusy('send')
    setActionError(null)
    try {
      await setChangeOrderStatusFrom(host.changeOrders, projectId, id, { status: 'sent', ...(digest ? { deltaDigest: digest } : {}) })
      done()
    } catch (err) {
      console.error('[ChangeOrderDetail] sending failed', err)
      setActionError(err instanceof Error ? err.message : t('changeOrders.sendFailed', 'Couldn\'t send it. Try again.', { ns: 'editor' }))
    } finally {
      setBusy(null)
    }
  }

  async function invite(email: string, contactId: string | null) {
    setBusy('invite')
    setActionError(null)
    try {
      await inviteAddresseeFrom(host.changeOrders, projectId, email, contactId)
      setInvited(true)
      done()
    } catch (err) {
      console.error('[ChangeOrderDetail] inviting the addressee failed', err)
      setActionError(err instanceof Error ? err.message : t('changeOrders.inviteFailed', 'Couldn\'t send the invite. Try again.', { ns: 'editor' }))
    } finally {
      setBusy(null)
    }
  }

  const needsLogin = order.addressee.kind === 'contact' && !order.addresseeHasLogin
  const inviteWhy = !canInvite ? t('changeOrders.inviteNeedsAdmin', 'Inviting people to the project needs client access rights. Ask a project admin.', { ns: 'editor' }) : !order.addresseeEmail ? t('changeOrders.noEmailOnContact', 'This contact has no email in the contact list. Add one on the Contacts page first.', { ns: 'editor' }) : null

  return (
    <div className="flex flex-col gap-3">
      <Button size="sm" variant="ghost" className="self-start" onClick={onBack}>
        <ArrowLeftIcon aria-hidden /> {t('changeOrders.allChangeOrders', 'All change orders', { ns: 'editor' })}
      </Button>
      <div>
        <h3 className="flex flex-wrap items-center gap-2 font-medium">
          {order.title} <Badge variant={order.status === 'refused' ? 'destructive' : 'secondary'}>{order.statusWords}</Badge>
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('changeOrders.forAndOpenedBy', 'For {{to}} · {{target}} · opened by {{who}}', { ns: 'editor', to: order.addressee.label, target: order.targetWords, who: order.openedByLabel })}
        </p>
        {order.description ? <p className="mt-1 whitespace-pre-wrap text-sm">{order.description}</p> : null}
        {order.reason ? (
          <p className="mt-1 text-sm">
            {statusWords(order.status)}: {order.reason}
            {order.citation ? t('changeOrders.cites', ' (cites {{what}})', { ns: 'editor', what: order.citation }) : ''}
          </p>
        ) : null}
        {order.status === 'accepted' || order.status === 'refused' || order.status === 'no_cost' ? <SignoffSignatureLine projectId={projectId} subjectId={id} /> : null}
        {order.status === 'accepted' || order.status === 'no_cost' ? <SignoffCheckedAgainst projectId={projectId} subjectId={id} model={model} /> : null}
        {order.waitingWords ? <p className="mt-1 text-sm text-muted-foreground">{order.waitingWords}</p> : null}
      </div>

      <QuantityDeltaList state={delta} onRetry={retry} />
      {delta.status === 'ready' && delta.read.deltas.length > 0 ? <PriceDeltaWith projectId={projectId} deltas={delta.read.deltas} /> : null}

      {needsLogin && order.status !== 'draft' ? (
        invited || order.invitePending ? (
          <p className="text-sm text-muted-foreground">{t('changeOrders.inviteSent', 'Invite sent. They answer once they sign in.', { ns: 'editor' })}</p>
        ) : (
          <Button size="sm" variant="outline" className="self-start" disabled={inviteWhy !== null || busy !== null} title={inviteWhy ?? undefined} onClick={() => order.addresseeEmail && void invite(order.addresseeEmail, order.addressee.kind === 'contact' ? order.addressee.id : null)}>
            {busy === 'invite' ? <Spinner aria-hidden /> : <MailIcon aria-hidden />}
            Invite {order.addressee.label}
          </Button>
        )
      ) : null}
      {needsLogin && inviteWhy ? <p className="text-xs text-muted-foreground">{inviteWhy}</p> : null}

      {canSend || answers.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {canSend ? (
            <Button size="sm" disabled={busy !== null} onClick={() => void send()}>
              {busy === 'send' ? <Spinner aria-hidden /> : <SendIcon aria-hidden />}
              Send to {order.addressee.label}
            </Button>
          ) : null}
          {answers.includes('accepted') ? (
            <Button size="sm" onClick={() => setAnswer('accepted')}>
              {t('changeOrders.accept', 'Accept', { ns: 'editor' })}
            </Button>
          ) : null}
          {answers.includes('refused') ? (
            <Button size="sm" variant="outline" onClick={() => setAnswer('refused')}>
              {t('changeOrders.refuse', 'Refuse', { ns: 'editor' })}
            </Button>
          ) : null}
          {answers.includes('no_cost') ? (
            <Button size="sm" variant="outline" onClick={() => setAnswer('no_cost')}>
              {t('changeOrders.noCost', 'No cost', { ns: 'editor' })}
            </Button>
          ) : null}
        </div>
      ) : order.status === 'sent' && !order.iAmAddressee ? (
        <p className="text-xs text-muted-foreground">{CHANGE_WORDS.onlyAddressee}</p>
      ) : null}
      {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}

      {load.data.events.length > 0 ? (
        <ol aria-label={t('panel.history', 'History', { ns: 'editor' })} className="flex flex-col gap-0.5 border-t pt-2 text-xs text-muted-foreground">
          {load.data.events.map((e, i) => (
            <li key={`${e.at}|${i}`}>
              {new Date(e.at).toLocaleString()}: {statusWords(e.to)}
              {e.reason ? `: ${e.reason}` : ''}
              {e.citation ? t('changeOrders.cites', ' (cites {{what}})', { ns: 'editor', what: e.citation }) : ''}
            </li>
          ))}
        </ol>
      ) : null}

      <AnswerChangeOrderDialog
        answer={answer}
        title={order.title}
        onClose={() => setAnswer(null)}
        signing={signing}
        onAnswer={async ({ assurance, ...input }) => {
          await setChangeOrderStatusFrom(host.changeOrders, projectId, id, { ...input, ...(digest ? { deltaDigest: digest } : {}) })
          if (assurance) {
            const secured = await secureLatestEntryFrom(host.signing, projectId, id, assurance)
            if (secured.level === 'recorded') setActionError(secured.words)
          }
          done()
        }}
      />
    </div>
  )
}
