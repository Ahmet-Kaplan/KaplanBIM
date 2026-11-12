import type { SelectionScope, SelectionScopeKind } from '@permitzip/bim-kernel'
import { englishOnly, type Translate } from './i18n/translate'

/**
 * "Tab to select more": hovering pre-highlights the piece under the pointer;
 * each Tab widens the highlight (piece, stretch, run, branch, system, back to
 * the piece); Shift+Tab narrows it; a click selects what is highlighted. Moving
 * along the highlighted scope keeps it, so the highlight doesn't flicker as
 * the pointer slides down a duct.
 */
export interface PreHighlight {
  readonly anchorId: string
  readonly scopes: readonly SelectionScope[]
  readonly level: number
}

export function hoverTo(state: PreHighlight | null, id: string | null, scopesFor: (id: string) => readonly SelectionScope[]): PreHighlight | null {
  if (id === null) return null
  if (state && (state.anchorId === id || (state.level > 0 && (state.scopes[state.level]?.ids.some((x) => x === id) ?? false)))) return state
  const scopes = scopesFor(id)
  return scopes.length > 0 ? { anchorId: id, scopes, level: 0 } : null
}

export function cycle(state: PreHighlight | null, direction: 1 | -1): PreHighlight | null {
  if (!state || state.scopes.length < 2) return state
  const n = state.scopes.length
  return { ...state, level: (state.level + direction + n) % n }
}

export function currentScope(state: PreHighlight | null): SelectionScope | null {
  return state ? (state.scopes[state.level] ?? null) : null
}

/** One scope's word, in the language the hint is drawn in (`session.scope*`). */
function word(kind: SelectionScopeKind, t: Translate): string {
  switch (kind) {
    case 'element':
      return t('session.scopeElement', 'this piece', { ns: 'editor' })
    case 'stretch':
      return t('session.scopeStretch', 'stretch', { ns: 'editor' })
    case 'run':
      return t('session.scopeRun', 'run', { ns: 'editor' })
    case 'branch':
      return t('session.scopeBranch', 'branch', { ns: 'editor' })
    case 'system':
      return t('session.scopeSystem', 'system', { ns: 'editor' })
  }
}

/** "1 element" / "3 elements": English splits at one, Turkish does not (§8). */
function count(n: number, t: Translate): string {
  return n === 1 ? t('session.oneElement', '1 element', { ns: 'editor', count: n }) : t('session.countElements', '{{count}} elements', { ns: 'editor', count: n })
}

export function scopeWord(kind: SelectionScopeKind, t: Translate = englishOnly): string {
  return word(kind, t)
}

/** The status line: what a click selects now and what Tab would select next. */
export function tabHint(state: PreHighlight | null, t: Translate = englishOnly): string | null {
  const now = currentScope(state)
  if (!state || !now) return null
  const click =
    now.kind === 'element'
      ? t('session.tabClickIt', 'Click to select it', { ns: 'editor' })
      : t('session.tabClickScope', 'Click to select the {{word}} ({{count}})', { ns: 'editor', word: word(now.kind, t), count: count(now.ids.length, t) })
  if (state.scopes.length < 2) return `${click}.`
  const next = state.scopes[(state.level + 1) % state.scopes.length]
  if (!next) return `${click}.`
  const tab =
    next.kind === 'element'
      ? t('session.tabBackToThisPiece', 'Tab: back to this piece', { ns: 'editor' })
      : t('session.tabSelectScope', 'Tab: select {{word}} ({{count}})', { ns: 'editor', word: word(next.kind, t), count: count(next.ids.length, t) })
  return `${tab} · ${click}${state.level > 0 ? t('session.tabShiftBack', ' · Shift+Tab: back', { ns: 'editor' }) : ''}.`
}
