import { hostLineOf, type BimElement, type Command, type Vec2 } from '@permitzip/bim-kernel'
import { englishOnly, type Translate } from '../../i18n/translate'

/**
 * Placing a door, window or plain opening: hover a wall, the ghost follows
 * along it, Space flips which side it opens to, a click puts it in. Off a
 * wall it says why at the pointer, before any click.
 */

export type OpeningKind = 'door' | 'window' | 'opening'

const DEFAULT_WIDTH_MM: Readonly<Record<OpeningKind, number>> = { door: 915, window: 1220, opening: 1000 }
const DEFAULT_HEIGHT_MM: Readonly<Record<OpeningKind, number>> = { door: 2134, window: 1220, opening: 2134 }

export type OpeningAim =
  | { readonly ok: true; readonly hostId: string; readonly s: number; readonly at: Vec2; readonly widthMm: number }
  | { readonly ok: false; readonly reason: string }

function word(kind: OpeningKind, t: Translate): string {
  switch (kind) {
    case 'door':
      return t('architecture.opening.aDoor', 'A door', { ns: 'editor' })
    case 'window':
      return t('architecture.opening.aWindow', 'A window', { ns: 'editor' })
    case 'opening':
      return t('architecture.opening.anOpening', 'An opening', { ns: 'editor' })
  }
}

/** One door, window or plain opening, as a hint bar names it (§2.3: *door* = **kapı**, *window* = **pencere**, *opening* = **boşluk**). */
export function openingNoun(kind: OpeningKind, t: Translate = englishOnly): string {
  switch (kind) {
    case 'door':
      return t('architecture.noun.door', 'door', { ns: 'editor' })
    case 'window':
      return t('architecture.noun.window', 'window', { ns: 'editor' })
    case 'opening':
      return t('architecture.noun.opening', 'opening', { ns: 'editor' })
  }
}

/** Where the opening would go for what the pointer is over, or why it can't. */
export function aimOpening(elements: Readonly<Record<string, BimElement>>, kind: OpeningKind, hoveredIds: readonly string[], pointer: Vec2 | null, widthMm = DEFAULT_WIDTH_MM[kind], t: Translate = englishOnly): OpeningAim {
  const refusal = { ok: false as const, reason: t('architecture.opening.needsWall', '{{what}} needs a wall to sit in; point at a wall', { ns: 'editor', what: word(kind, t) }) }
  if (!pointer) return refusal
  for (const id of hoveredIds) {
    const host = elements[id]
    const line = host ? hostLineOf(host, elements) : null
    if (!host || !line) continue
    const dx = line.end.x - line.start.x
    const dy = line.end.y - line.start.y
    const len = Math.hypot(dx, dy)
    if (len < widthMm)
      return {
        ok: false,
        reason: t('architecture.opening.doesNotFit', "This wall is {{length}} mm long; a {{width}} mm {{noun}} doesn't fit", { ns: 'editor', length: Math.round(len), width: Math.round(widthMm), noun: openingNoun(kind, t) }),
      }
    const along = ((pointer.x - line.start.x) * dx + (pointer.y - line.start.y) * dy) / len
    const s = Math.round(Math.min(len - widthMm / 2, Math.max(widthMm / 2, along)))
    return { ok: true, hostId: host.id, s, at: { x: line.start.x + (dx / len) * s, y: line.start.y + (dy / len) * s }, widthMm }
  }
  return refusal
}

export function placeOpening(aim: Extract<OpeningAim, { ok: true }>, kind: OpeningKind, side: 1 | -1, elementId: string, typeId?: string, mark?: string, heightMm = DEFAULT_HEIGHT_MM[kind]): Command {
  return {
    type: 'create_hosted',
    elementId,
    kind: 'opening',
    openingType: kind === 'opening' ? 'cased_opening' : kind,
    hostId: aim.hostId,
    s: aim.s,
    side,
    size: { widthMm: aim.widthMm, heightMm },
    ...(typeId ? { typeId } : {}),
    ...(mark ? { mark } : {}),
  }
}

export function openingHint(kind: OpeningKind, aim: OpeningAim | null, t: Translate = englishOnly): string {
  if (!aim) return t('architecture.opening.pointAtWall', 'Point at a wall to put the {{noun}} in', { ns: 'editor', noun: openingNoun(kind, t) })
  if (!aim.ok) return aim.reason
  return t('architecture.opening.clickToPut', 'Click to put the {{noun}} in · Space flips the side it opens to · Esc to stop', { ns: 'editor', noun: openingNoun(kind, t) })
}
