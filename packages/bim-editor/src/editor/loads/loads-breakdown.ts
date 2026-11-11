import {
  CATALOG_TRADES,
  QUANTITIES,
  QUANTITY_KEYS,
  anchorWords,
  elementsOfKind,
  estimateVsDevicesText,
  formatQuantity,
  loadPointLabel,
  type CatalogTrade,
  type ElementId,
  type LoadProgress,
  type LoadStage,
  type LoadStatus,
  type ModelState,
  type RequirementsEngine,
} from '@permitzip/bim-kernel'
import { englishOnly, type Translate } from '../i18n/translate'

/**
 * What the header's Loads chip opens (round-1 gap): per trade, how far its
 * loads have got; per space and zone, the estimate beside the devices placed
 * so far; what the project counts; and the loads that need someone. Every
 * figure is a read of the kernel's requirements engine (the one the chip, the
 * schedules and the Coordination checks read); nothing is added up here.
 */

/** The engine reads the breakdown uses (the open model's `LoadsLayer` engine). */
export type LoadsEngineReads = Pick<RequirementsEngine, 'progress' | 'statusOf' | 'scopeFigures' | 'counted'>

export interface TradeBreakdown {
  readonly trade: CatalogTrade
  readonly label: string
  readonly total: number
  /** "3 of 12 piped": the chip's words for this trade. */
  readonly done: string
  /** "12 estimates · 3 load points · 5 devices", only the stages that have loads. */
  readonly stages: string
  /** Statuses with loads, in lifecycle order, in operator words. */
  readonly statuses: readonly { readonly status: LoadStatus; readonly label: string; readonly count: number }[]
}

export interface EstimateRow {
  readonly id: ElementId
  readonly kind: 'space' | 'zone'
  readonly name: string
  /** "estimate 2,000 VA, devices so far 800 VA" (the kernel's words). */
  readonly text: string
}

export interface AttentionRow {
  readonly id: ElementId
  /** Elements to select: the load and what it reads that still exists. */
  readonly selectIds: readonly ElementId[]
  readonly reason: 'mismatch' | 'no_source'
  readonly label: string
  readonly why: string
}

export interface LoadsBreakdown {
  readonly total: number
  readonly trades: readonly TradeBreakdown[]
  /** "Counted: 12,000 VA · 25 WSFU"; null when nothing counts yet. */
  readonly counted: string | null
  readonly estimates: readonly EstimateRow[]
  readonly attention: readonly AttentionRow[]
}

/**
 * A load's status in words. A `label(t)` accessor rather than a table: the words
 * are a screen's, so they have to be asked for in the language being drawn, and a
 * const table would be frozen in whichever language the module first loaded in.
 */
export function loadStatusWord(status: LoadStatus, t: Translate = englishOnly): string {
  switch (status) {
    case 'open':
      return t('loads.status.open', 'No source yet', { ns: 'editor' })
    case 'assigned':
      return t('loads.status.assigned', 'Source named, not drawn', { ns: 'editor' })
    case 'placed':
      return t('loads.status.placed', 'Placed', { ns: 'editor' })
    case 'connected':
      return t('loads.status.connected', 'On a pipe, duct or circuit', { ns: 'editor' })
    case 'attached':
      return t('loads.status.attached', 'A device stands for it', { ns: 'editor' })
    case 'mismatch':
      return t('loads.status.mismatch', 'Needs attention', { ns: 'editor' })
  }
}

/**
 * A trade's own word (`Water and drainage`, `Power`, `Air`) — the kernel's
 * `LOAD_TRADE_PROGRESS` label is English data (§9/Ç-B), so the trade is read as a
 * trade and the word chosen here rather than splicing the English into a frame.
 */
export function loadTradeWord(trade: CatalogTrade, t: Translate = englishOnly): string {
  switch (trade) {
    case 'plumbing':
      return t('loads.trade.plumbing', 'Water and drainage', { ns: 'editor' })
    case 'gas':
      return t('loads.trade.gas', 'Gas', { ns: 'editor' })
    case 'electrical':
      return t('loads.trade.electrical', 'Power', { ns: 'editor' })
    case 'mechanical':
      return t('loads.trade.mechanical', 'Air', { ns: 'editor' })
  }
}

const STATUS_ORDER: readonly LoadStatus[] = ['mismatch', 'open', 'assigned', 'placed', 'connected', 'attached']

/** One stage's word. Turkish has one form after a number (§8), so the plural is the same word. */
function stageWord(stage: LoadStage, t: Translate): string {
  switch (stage) {
    case 'estimate':
      return t('loads.stage.estimate', 'estimate', { ns: 'editor' })
    case 'concentrated':
      return t('loads.stage.loadPoint', 'load point', { ns: 'editor' })
    case 'device':
      return t('loads.stage.device', 'device', { ns: 'editor' })
  }
}

function stagesLine(p: LoadProgress, t: Translate): string {
  return (['estimate', 'concentrated', 'device'] as const)
    .filter((s) => p.byStage[s] > 0)
    .map((s) => t('loads.stageCount', '{{count}} {{noun}}', { ns: 'editor', count: p.byStage[s], noun: stageWord(s, t) }))
    .join(' · ')
}

/** A trade's past participle (`piped`, `connected`) — the word after "12 of 35". */
function doneWord(trade: CatalogTrade, t: Translate): string {
  switch (trade) {
    case 'plumbing':
    case 'gas':
      return t('loads.done.piped', 'piped', { ns: 'editor' })
    case 'electrical':
      return t('loads.done.connected', 'connected', { ns: 'editor' })
    case 'mechanical':
      return t('loads.done.ducted', 'ducted', { ns: 'editor' })
  }
}

function nameOf(model: ModelState, id: ElementId): string {
  const el = model.elements[id]
  if (!el) return id
  if (el.kind === 'space') return [el.number, el.name].filter((s) => s.trim() !== '').join(' ') || id
  if (el.kind === 'zone') return el.name || id
  if (el.kind === 'part') return el.mark || id
  return 'name' in el && typeof el.name === 'string' && el.name ? el.name : id
}

export function loadsBreakdown(model: ModelState, engine: LoadsEngineReads, t: Translate = englishOnly): LoadsBreakdown {
  const all = engine.progress(model, { kind: 'project' })
  const trades: TradeBreakdown[] = []
  for (const trade of CATALOG_TRADES) {
    const p = engine.progress(model, { kind: 'trade', trade })
    if (p.total === 0) continue
    trades.push({
      trade,
      label: loadTradeWord(trade, t),
      total: p.total,
      done: t('loads.ofTotal', '{{done}} of {{total}} {{noun}}', { ns: 'editor', done: p.byStatus.connected, total: p.total, noun: doneWord(trade, t) }),
      stages: stagesLine(p, t),
      statuses: STATUS_ORDER.filter((s) => p.byStatus[s] > 0).map((s) => ({ status: s, label: loadStatusWord(s, t), count: p.byStatus[s] })),
    })
  }

  const totals = engine.counted(model)
  const countedParts = QUANTITY_KEYS.filter((k) => QUANTITIES[k].add === 'sum' && totals[k] !== 0).map((k) => formatQuantity(k, totals[k]))
  const counted = countedParts.length > 0 ? t('loads.counted', 'Counted: {{parts}}', { ns: 'editor', parts: countedParts.join(' · ') }) : null

  const estimates: EstimateRow[] = []
  for (const el of elementsOfKind(model.elements, 'space', 'zone')) {
    const figures = engine.scopeFigures(model, { kind: el.kind, id: el.id })
    if (figures.estimateIds.length === 0) continue
    const text = estimateVsDevicesText(figures)
    if (text) estimates.push({ id: el.id, kind: el.kind, name: nameOf(model, el.id), text })
  }
  estimates.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  const attention: AttentionRow[] = []
  for (const lp of elementsOfKind(model.elements, 'load_point')) {
    const s = engine.statusOf(model, lp.id)
    const label = loadPointLabel(model.elements, lp)
    if (s?.status === 'mismatch') {
      attention.push({ id: lp.id, selectIds: [lp.id], reason: 'mismatch', label, why: s.why ?? loadStatusWord('mismatch', t) })
    } else if (lp.anchor && lp.anchor.kind !== 'run_end' && !lp.servedBy) {
      // The Coordination check "load-unserved"'s test: typed before it is drawn, naming no source.
      attention.push({
        id: lp.id,
        selectIds: [lp.id],
        reason: 'no_source',
        label,
        why: t('loads.noSource', '{{anchor}}; no panel, meter or heater counts it yet', { ns: 'editor', anchor: anchorWords(lp.anchor, (id) => nameOf(model, id)) }),
      })
    }
  }
  attention.sort((a, b) => (a.reason === b.reason ? a.label.localeCompare(b.label, undefined, { numeric: true }) : a.reason === 'mismatch' ? -1 : 1))

  return { total: all.total, trades, counted, estimates, attention }
}
