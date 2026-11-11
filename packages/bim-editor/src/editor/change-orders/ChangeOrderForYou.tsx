'use client'

import { useCallback, useEffect, useState } from 'react'
import { FilePen } from 'lucide-react'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '../../ui/alert'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Skeleton } from '../../ui/skeleton'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { fetchChangeOrderFrom, fetchChangeOrdersForMeFrom, setChangeOrderStatusFrom } from '../../contracts/bim/change-orders/client'
import type { ChangeOrderDetailResponse, ChangeOrderForMe } from '../../contracts/bim/change-orders/model'
import { AnswerChangeOrderDialog, type Answer } from './AnswerChangeOrderDialog'
import { useAssuranceOffer } from '../signing/useAssuranceOffer'
import { secureLatestEntryFrom, secureOutcomeWords } from '../../contracts/bim/signing/client'
import { useEditorTranslate } from '../i18n/translate'

type Load =
  | { readonly state: 'loading' }
  | { readonly state: 'error'; readonly message: string }
  | { readonly state: 'not_waiting' }
  | { readonly state: 'ready'; readonly mine: ChangeOrderForMe; readonly detail: ChangeOrderDetailResponse }

/**
 * Bell › Change orders for you › one order: what it is, who opened it, and
 * Accept / Refuse / No cost, each with a reason. For an addressee with no
 * other access to the project (a client's or a contractor's login); the
 * project's own people reach the same order through Building Model › Manage
 * › Change orders.
 */
export function ChangeOrderForYou({ changeOrderId }: { readonly changeOrderId: string }) {
  const t = useEditorTranslate()
  const host = useEditorHost().data
  const [attempt, setAttempt] = useState(0)
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [answered, setAnswered] = useState<string | null>(null)
  const signing = useAssuranceOffer(true)

  useEffect(() => {
    const controller = new AbortController()
    void attempt
    fetchChangeOrdersForMeFrom(host.changeOrders, controller.signal)
      .then(async (list) => {
        const mine = list.orders.find((o) => o.id === changeOrderId)
        if (!mine) return setLoad({ state: 'not_waiting' })
        const detail = await fetchChangeOrderFrom(host.changeOrders, mine.projectId, changeOrderId, controller.signal)
        setLoad({ state: 'ready', mine, detail })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        console.error('[ChangeOrderForYou] loading the change order failed', { changeOrderId, err })
        setLoad({ state: 'error', message: err instanceof Error ? err.message : t('changeOrders.loadOneFailed', 'Couldn\'t load the change order.', { ns: 'editor' }) })
      })
    return () => controller.abort()
  }, [host.changeOrders, changeOrderId, attempt])

  const retry = useCallback(() => {
    setLoad({ state: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  if (answered) {
    return (
      <Empty data-testid="change-order-for-you-answered">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FilePen />
          </EmptyMedia>
          <EmptyTitle>{t('changeOrders.answerRecorded', 'Answer recorded', { ns: 'editor' })}</EmptyTitle>
          <EmptyDescription>{answered}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  if (load.state === 'loading') {
    return (
      <div className="flex flex-col gap-3" data-testid="change-order-for-you-loading" aria-busy="true">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (load.state === 'error') {
    return (
      <Alert variant="destructive" data-testid="change-order-for-you-error">
        <AlertTitle>{t('changeOrders.couldntLoadOne', 'Couldn\'t load this change order', { ns: 'editor' })}</AlertTitle>
        <AlertDescription>{load.message}</AlertDescription>
        <AlertAction>
          <Button size="sm" variant="outline" onClick={retry}>
            {t('changeOrders.retry', 'Retry', { ns: 'editor' })}
          </Button>
        </AlertAction>
      </Alert>
    )
  }
  if (load.state === 'not_waiting') {
    return (
      <Empty data-testid="change-order-for-you-not-waiting">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FilePen />
          </EmptyMedia>
          <EmptyTitle>{t('changeOrders.notWaitingForYou', 'This change order isn\'t waiting for you', { ns: 'editor' })}</EmptyTitle>
          <EmptyDescription>{t('changeOrders.maybeAnswered', 'It may have been answered already, withdrawn, or addressed to someone else.', { ns: 'editor' })}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const { mine, detail } = load
  const order = detail.order
  return (
    <Card data-testid="change-order-for-you">
      <CardHeader>
        <CardDescription>
          {t('changeOrders.projectFor', '{{project}} · for {{to}}', { ns: 'editor', project: mine.projectLabel, to: order.addressee.label })}
        </CardDescription>
        <CardTitle className="flex items-center gap-2">
          {order.title}
          <Badge variant="secondary">{order.statusWords}</Badge>
        </CardTitle>
        <CardDescription>
          {t('changeOrders.targetOpenedBy', '{{target}} · opened by {{who}}', { ns: 'editor', target: order.targetWords, who: order.openedByLabel })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {order.description ? <p className="whitespace-pre-wrap">{order.description}</p> : null}
        {order.waitingWords ? <p className="text-muted-foreground">{order.waitingWords}</p> : null}
        <p className="text-muted-foreground">{t('changeOrders.quantitiesOnly', 'Quantities only: no price is part of this change order. Price it with your own price book if you choose to.', { ns: 'editor' })}</p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button onClick={() => setAnswer('accepted')} data-testid="change-order-for-you-accept">
          {t('changeOrders.accept', 'Accept', { ns: 'editor' })}
        </Button>
        <Button variant="outline" onClick={() => setAnswer('refused')} data-testid="change-order-for-you-refuse">
          {t('changeOrders.refuse', 'Refuse', { ns: 'editor' })}
        </Button>
        <Button variant="outline" onClick={() => setAnswer('no_cost')} data-testid="change-order-for-you-no-cost">
          {t('changeOrders.noCost', 'No cost', { ns: 'editor' })}
        </Button>
      </CardFooter>
      <AnswerChangeOrderDialog
        answer={answer}
        title={order.title}
        onClose={() => setAnswer(null)}
        signing={signing}
        onAnswer={async ({ status, reason, citation, assurance }) => {
          await setChangeOrderStatusFrom(host.changeOrders, mine.projectId, order.id, { status, reason, ...(citation ? { citation } : {}) })
          const what =
            status === 'accepted'
              ? t('changeOrders.undo.accepted', 'You accepted “{{title}}”.', { ns: 'editor', title: order.title })
              : status === 'refused'
                ? t('changeOrders.undo.refused', 'You refused “{{title}}”.', { ns: 'editor', title: order.title })
                : t('changeOrders.undo.markedNoCost', 'You marked “{{title}}” no cost.', { ns: 'editor', title: order.title })
          if (!assurance) return setAnswered(what)
          setAnswered(`${what} ${secureOutcomeWords(await secureLatestEntryFrom(host.signing, mine.projectId, order.id, assurance))}`)
        }}
      />
    </Card>
  )
}
