'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { HostLink as Link } from '@permitzip/bim-editor/host'
import { Calculator } from 'lucide-react'
import { formatMoney, money } from '@permitzip/bim-units'
import type { ModelState, PricedTakeoff, ScheduleDefinitionV2 } from '@permitzip/bim-kernel'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Spinner } from '../../ui/spinner'
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../../ui/table'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { priceBooksApiFrom } from '../../contracts/bim/cost-source/client'
import { priceWithBook } from '../../contracts/bim/cost-source/cost-source'
import type { PriceBookSummary, ReadablePriceBook } from '../../contracts/bim/cost-source/types'

import { useEditorTranslate, type Translate } from '../i18n/translate'


/** True for a schedule laid out as the takeoff (grouped by cost code), the one Price with applies to. */
export function isTakeoffSchedule(definition: ScheduleDefinitionV2 | null): boolean {
  return definition?.groups?.[0]?.path === 'qto.code' && definition.columns.some((c) => c.kind === 'field' && c.path === 'qto.code')
}

type Books =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly books: readonly PriceBookSummary[]; readonly hasCompany: boolean }

type Picked = { readonly kind: 'none' } | { readonly kind: 'loading'; readonly id: string } | { readonly kind: 'error'; readonly id: string; readonly message: string } | { readonly kind: 'ready'; readonly readable: ReadablePriceBook }

const NOT_PRICED = '__not_priced__'


function stageName(model: ModelState, stageId: string | null, t: Translate): string {
  if (stageId === null) return t('schedule.priceWith.noStage', 'No stage', { ns: 'editor' })

  const el = model.elements[stageId]
  return el && el.kind === 'construction_stage' ? el.stage.name : stageId
}

function bookLabel(b: PriceBookSummary): string {
  return `${b.name} (${b.mine ? 'your company' : (b.owner.name ?? 'another company')})`
}

/**
 * Takeoff › Price with: multiply this model's quantities by a price book you
 * can read on this project, here in the browser. Nothing is saved to the
 * model. Every amount says whose book it is; a code the book has no rate for
 * says "No price", never $0.
 */
export function PriceWith({ projectId, model }: { readonly projectId: string; readonly model: ModelState | null }) {
  const t = useEditorTranslate()
  const costSource = useEditorHost().data.costSource
  const priceBooksApi = useMemo(() => priceBooksApiFrom(costSource), [costSource])
  const [books, setBooks] = useState<Books>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [picked, setPicked] = useState<Picked>({ kind: 'none' })
  const retryBooks = useCallback(() => setAttempt((a) => a + 1), [])

  useEffect(() => {
    let live = true
    setBooks({ kind: 'loading' })
    priceBooksApi
      .list(projectId)
      .then((r) => live && setBooks({ kind: 'ready', books: r.books, hasCompany: r.companies.length > 0 }))
      .catch((err: unknown) => {
        console.error('[PriceWith] loading price books failed', err)

        if (live) setBooks({ kind: 'error', message: err instanceof Error ? err.message : t('schedule.priceWith.connectionDropped', 'The connection dropped.', { ns: 'editor' }) })

      })
    return () => {
      live = false
    }
  }, [priceBooksApi, projectId, attempt])

  const pick = useCallback(
    (id: string) => {
      if (id === NOT_PRICED) return setPicked({ kind: 'none' })
      setPicked({ kind: 'loading', id })
      priceBooksApi
        .read(id, projectId)
        .then((readable) => setPicked((p) => (p.kind === 'loading' && p.id === id ? { kind: 'ready', readable } : p)))
        .catch((err: unknown) => {
          console.error('[PriceWith] loading the price book failed', err)

          setPicked((p) =>
            p.kind === 'loading' && p.id === id
              ? { kind: 'error', id, message: err instanceof Error ? err.message : t('schedule.priceWith.bookDidNotLoad', 'The book did not load.', { ns: 'editor' }) }
              : p,
          )

        })
    },
    [priceBooksApi, projectId],
  )

  const priced = useMemo((): { ok: true; value: PricedTakeoff } | { ok: false; message: string } | null => {
    if (picked.kind !== 'ready' || !model) return null
    try {
      return { ok: true, value: priceWithBook(model, picked.readable) }
    } catch (err) {
      console.error('[PriceWith] pricing the takeoff failed', err)

      return { ok: false, message: err instanceof Error ? err.message : t('schedule.priceWith.notPricedMessage', 'The takeoff could not be priced.', { ns: 'editor' }) }

    }
  }, [picked, model])

  const pickedId = picked.kind === 'none' ? NOT_PRICED : picked.kind === 'ready' ? picked.readable.book.id : picked.id

  return (

<section
      className="mb-3 flex flex-col gap-2 rounded-md border p-3"
      aria-label={t('schedule.priceWith.title', 'Price with', { ns: 'editor' })}
      data-testid="price-with"
    >

      <div className="flex flex-wrap items-center gap-2">
        <Calculator className="size-4 text-muted-foreground" aria-hidden />

<span className="text-sm font-medium">{t('schedule.priceWith.title', 'Price with', { ns: 'editor' })}</span>

        {books.kind === 'loading' && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">

<Spinner /> {t('schedule.priceWith.loadingBooks', 'Loading the price books you can use here…', { ns: 'editor' })}

          </span>
        )}
        {books.kind === 'error' && (
          <>

<span className="text-sm text-danger-700">
              {t('schedule.priceWith.booksFailed', 'Price books didn’t load: {{message}}', { ns: 'editor', message: books.message })}
            </span>
            <Button size="sm" variant="outline" onClick={retryBooks}>
              {t('schedule.priceWith.retry', 'Retry', { ns: 'editor' })}
            </Button>

          </>
        )}
        {books.kind === 'ready' && books.books.length === 0 && (
          <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" data-testid="price-with-empty">

{books.hasCompany
              ? t('schedule.priceWith.noCompanyBooks', 'Your company has no price books yet, and none are shared with it on this project.', { ns: 'editor' })
              : t('schedule.priceWith.noCompany', "You aren't part of a company with price books yet.", { ns: 'editor' })}
            <Button asChild size="sm" variant="link" className="h-auto p-0">
              <Link href="/settings/price-books">{t('schedule.priceWith.addInSettings', 'Add one in Settings › Price books', { ns: 'editor' })}</Link>
            </Button>

          </span>
        )}
        {books.kind === 'ready' && books.books.length > 0 && (
          <Select value={pickedId} onValueChange={pick}>
            <SelectTrigger className="w-80" aria-label={t('panel.priceBook', 'Price book', { ns: 'editor' })} data-testid="price-with-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>

<SelectItem value={NOT_PRICED}>{t('schedule.priceWith.notPriced', 'Not priced (quantities only)', { ns: 'editor' })}</SelectItem>

                {books.books.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {bookLabel(b)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}

{picked.kind === 'loading' && <Spinner aria-label={t('schedule.priceWith.loadingBook', 'Loading the book', { ns: 'editor' })} />}

      </div>

<p className="text-xs text-muted-foreground">
        {t(
          'schedule.priceWith.privacy',
          'Prices are worked out here in your browser from your company’s book. They are never saved to the model or seen by anyone else.',
          { ns: 'editor' },
        )}
      </p>


      {picked.kind === 'error' && (
        <Alert variant="destructive">

<AlertTitle>{t('schedule.priceWith.thatBookFailed', 'That book didn’t load', { ns: 'editor' })}</AlertTitle>

          <AlertDescription className="flex flex-col items-start gap-2">

{picked.message}
            <Button size="sm" variant="outline" onClick={() => pick(picked.id)}>
              {t('schedule.priceWith.retry', 'Retry', { ns: 'editor' })}
            </Button>

          </AlertDescription>
        </Alert>
      )}
      {priced && !priced.ok && (
        <Alert variant="destructive">

<AlertTitle>{t('schedule.priceWith.notPricedTitle', 'Not priced', { ns: 'editor' })}</AlertTitle>

          <AlertDescription>{priced.message}</AlertDescription>
        </Alert>
      )}

{picked.kind === 'ready' && priced?.ok && model && <PricedTable model={model} readable={picked.readable} priced={priced.value} t={t} />}

    </section>
  )
}


/**
 * What a price book's rates are: an estimate, a budget or a contract price.
 * The contracts layer's `PRICE_BOOK_BASIS_LABELS` is data for the routes; a
 * sentence that puts one of them mid-sentence says it in the reader's language,
 * and the English default is already lowercased (it is used after a possessive).
 */
function basisWord(basis: PriceBookSummary['basis'], t: Translate): string {
  switch (basis) {
    case 'estimate':
      return t('schedule.priceWith.basisEstimate', 'estimate', { ns: 'editor' })
    case 'budget':
      return t('schedule.priceWith.basisBudget', 'budget', { ns: 'editor' })
    case 'contract':
      return t('schedule.priceWith.basisContract', 'contract', { ns: 'editor' })
  }
}

function PricedTable({ model, readable, priced, t }: { readonly model: ModelState; readonly readable: ReadablePriceBook; readonly priced: PricedTakeoff; readonly t: Translate }) {
  const { book } = readable

  const owner = book.owner.name ?? t('schedule.priceWith.anotherCompany', 'another company', { ns: 'editor' })
  // Who the prices belong to, in one sentence: the possessive and "as of" are the
  // language's, so a Turkish row never reads "Acme's estimate as of 2026-01-01".
  const whose = t('schedule.priceWith.whose', "{{book}}, {{owner}}'s {{basis}} as of {{date}}", {
    ns: 'editor',
    book: book.name,
    owner,
    basis: basisWord(book.basis, t),
    date: book.effectiveDate,
  })
  const fmt = (minor: number) => formatMoney(money(minor, book.currency))
  if (priced.lines.length === 0 && priced.noRate.length === 0 && priced.unpriced.length === 0) {

    return (
      <p className="text-sm text-muted-foreground">
        {t('schedule.priceWith.noCostCodes', 'Nothing in this model has a cost code from {{book}}’s code lists yet. Set cost codes on types or elements, then price again.', {
          ns: 'editor',
          book: book.name,
        })}
      </p>
    )

  }
  return (
    <Table data-testid="price-with-table">

<TableCaption>{t('schedule.priceWith.caption', 'Prices from {{whose}}.', { ns: 'editor', whose })}</TableCaption>

      <TableHeader>
        <TableRow>

<TableHead>{t('schedule.costCode', 'Cost code', { ns: 'editor' })}</TableHead>
          <TableHead>{t('schedule.stage', 'Stage', { ns: 'editor' })}</TableHead>
          <TableHead className="text-right">{t('schedule.quantity', 'Quantity', { ns: 'editor' })}</TableHead>
          <TableHead className="text-right">{t('schedule.unitPrice', 'Unit price', { ns: 'editor' })}</TableHead>
          <TableHead className="text-right">{t('schedule.amount', 'Amount', { ns: 'editor' })}</TableHead>

        </TableRow>
      </TableHeader>
      <TableBody>
        {priced.lines.map((l) => (
          <TableRow key={l.takeoffKey} data-testid="price-with-line">
            <TableCell className="font-medium">{l.code}</TableCell>

<TableCell>{stageName(model, l.stageId, t)}</TableCell>


<TableCell
              className="text-right tabular-nums"
              title={`${l.quantityFrom.from}, ${
                l.quantityFrom.elementCount === 1
                  ? t('schedule.oneElement', '1 element', { ns: 'editor' })
                  : t('schedule.elements', '{{n}} elements', { ns: 'editor', n: l.quantityFrom.elementCount })
              }`}
            >

              {l.quantity.toLocaleString('en-US', { maximumFractionDigits: 2 })} {l.per}
            </TableCell>
            <TableCell className="text-right tabular-nums">{fmt(l.unitRate.minor)}</TableCell>

<TableCell className="text-right tabular-nums" title={t('schedule.priceWith.fromWhose', 'From {{whose}}', { ns: 'editor', whose })}>

              {fmt(l.amount.minor)}
            </TableCell>
          </TableRow>
        ))}
        {priced.noRate.map((l) => (
          <TableRow key={`no-rate-${l.system}-${l.code}-${l.stageId ?? ''}`} data-testid="price-with-no-price">
            <TableCell className="font-medium">{l.code}</TableCell>

<TableCell>{stageName(model, l.stageId, t)}</TableCell>

            <TableCell className="text-right text-muted-foreground">

              {l.elementCount === 1
                ? t('schedule.oneElement', '1 element', { ns: 'editor' })
                : t('schedule.elements', '{{n}} elements', { ns: 'editor', n: l.elementCount })}

            </TableCell>
            <TableCell colSpan={2} className="text-right text-muted-foreground">

{t('schedule.priceWith.noRate', 'No price: {{book}} has no rate for {{code}}', { ns: 'editor', book: book.name, code: l.code })}

            </TableCell>
          </TableRow>
        ))}
        {priced.unpriced.map((u) => (
          <TableRow key={`unpriced-${u.takeoffKey}`} data-testid="price-with-no-price">
            <TableCell className="font-medium">{u.groupLabel}</TableCell>
            <TableCell />
            <TableCell className="text-right text-muted-foreground">{u.measure.replace(/^qto\./, '').replace(/_/g, ' ')}</TableCell>
            <TableCell colSpan={2} className="text-right text-muted-foreground">

{t('schedule.priceWith.noPriceReason', 'No price: {{reason}}', { ns: 'editor', reason: u.reason })}

            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>

<TableCell colSpan={4}>
            {priced.noRate.length + priced.unpriced.length > 0
              ? t('schedule.priceWith.totalSome', 'Total of priced lines ({{owner}}’s prices; lines with no price are not included)', { ns: 'editor', owner })
              : t('schedule.priceWith.total', 'Total of priced lines ({{owner}}’s prices)', { ns: 'editor', owner })}
          </TableCell>

          <TableCell className="text-right font-semibold tabular-nums" data-testid="price-with-total">
            {fmt(priced.total.minor)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}
