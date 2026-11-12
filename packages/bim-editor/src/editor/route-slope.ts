import { isGravity, type SystemKind } from '@permitzip/bim-kernel'
import type { ExistingSystem, RouteChoices } from './RoutePanel'
import { englishOnly, type Translate } from './i18n/translate'

/** The system kind a Route tool system value means: an existing system's, or `new:<kind>`'s. */
export function systemKindOfChoice(value: string, systems: readonly ExistingSystem[], kinds: readonly SystemKind[]): SystemKind | null {
  const existing = systems.find((s) => s.id === value)
  if (existing) return existing.kind
  return value.startsWith('new:') ? (kinds.find((kind) => `new:${kind}` === value) ?? null) : null
}

/** Slopes a gravity pipe can be drawn at, in inches per foot. */
export const SLOPE_CHOICES: readonly string[] = ['0.0625', '0.125', '0.25', '0.5']

/**
 * A standard slope's words: `1/8" per ft`. §7 keeps unit symbols as they are, so
 * only the "per foot" is words — and in Turkish it leads, `ft başına 1/8"`.
 */
export function slopeChoiceWords(value: string, t: Translate = englishOnly): string {
  switch (value) {
    case '0.0625':
      return t('route.slope116', '1/16" per ft', { ns: 'editor' })
    case '0.125':
      return t('route.slope18', '1/8" per ft', { ns: 'editor' })
    case '0.25':
      return t('route.slope14', '1/4" per ft', { ns: 'editor' })
    case '0.5':
      return t('route.slope12', '1/2" per ft', { ns: 'editor' })
    default:
      return value
  }
}

/** The slope and fall direction a route sends: only for a gravity system; absent fields keep the kernel's own rule. */
export function routeSlope(c: RouteChoices, kind: SystemKind | null): { slopeInPerFt?: number; flow?: 'with_points' | 'against_points' } {
  if (c.kind !== 'pipe' || !kind || !isGravity(kind)) return {}
  const slope = c.slopeInPerFt ? Number(c.slopeInPerFt) : NaN
  return {
    ...(Number.isFinite(slope) && slope > 0 ? { slopeInPerFt: slope } : {}),
    ...(c.slopeDirection === 'down' ? { flow: 'with_points' as const } : c.slopeDirection === 'up' ? { flow: 'against_points' as const } : {}),
  }
}

/** A run's slope as a Route tool choice: the nearest standard slope when it is one, else the value. */
export function slopeChoiceOf(inPerFt: number): string {
  if (!(inPerFt > 0.005)) return ''
  const near = SLOPE_CHOICES.find((s) => Math.abs(Number(s) - inPerFt) < 0.01)
  return near ?? String(Math.round(inPerFt * 1000) / 1000)
}
