import { limitNumber, type DesignLimit, type DesignLimitRow, type DesignLimitSources } from '@permitzip/bim-kernel/policy'
import type { EditorDataHost } from '@permitzip/bim-editor-host'
import { EditorServiceUnavailableError, unavailableWords } from '@permitzip/bim-editor/host/unavailable'
import { englishOnly, type Translate } from '../i18n/translate'

type LibraryPort = EditorDataHost['firmLibrary']

/** What the firm library is called when the host has no port for it (§2.2: *firm* = **firma**). */
function librarySubject(t: Translate): string {
  return t('designLimits.librarySubject', 'The firm library', { ns: 'editor' })
}

/**
 * A limit's band in words ("at most 8 ft/s"), built here rather than spliced from
 * the kernel's `bandWords`.
 *
 * The kernel's version is data for its own readers, but this is a sentence on a
 * screen: on a Turkish screen it said "at most 8 ft/s" inside a Turkish row. The
 * numbers go through the kernel's own `limitNumber`, so the English reads exactly
 * as it did — one sentence, two languages. The unit is passed through untouched
 * (§7: `ft/s` is a symbol and symbols are never translated).
 */
export function bandWords(limit: Pick<DesignLimit, 'band' | 'unit'>, t: Translate = englishOnly): string {
  const { min, max, target } = limit.band
  const unit = limit.unit
  const aim = target !== undefined ? t('designLimits.band.aim', 'aim for {{target}} {{unit}}', { ns: 'editor', target: limitNumber(target), unit }) : ''
  const edge =
    min !== undefined && max !== undefined
      ? t('designLimits.band.between', '{{min}} to {{max}} {{unit}}', { ns: 'editor', min: limitNumber(min), max: limitNumber(max), unit })
      : max !== undefined
        ? t('designLimits.band.atMost', 'at most {{max}} {{unit}}', { ns: 'editor', max: limitNumber(max), unit })
        : min !== undefined
          ? t('designLimits.band.atLeast', 'at least {{min}} {{unit}}', { ns: 'editor', min: limitNumber(min), unit })
          : ''
  return [edge, aim].filter((s) => s !== '').join(', ')
}

/** A limit the library holds in the scope being edited, with the revision a save starts from. */
export interface LibraryLimit {
  readonly limit: DesignLimit
  readonly revision: number
}

export interface DesignLimitRows {
  readonly rows: readonly DesignLimitRow[]
  /** This scope's own rows (what Change saves over and Put back removes). */
  readonly own: readonly LibraryLimit[]
  /** A band in words ("at most 8 ft/s"). */
  readonly band: (limit: Pick<DesignLimit, 'band' | 'unit'>) => string
}

function isLimit(value: unknown): value is DesignLimit {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.label === 'string' && typeof v.quantity === 'string' && typeof v.unit === 'string' && typeof v.band === 'object' && v.band !== null && typeof v.citation === 'object' && v.citation !== null && typeof v.appliesTo === 'object' && v.appliesTo !== null
}

async function listScope(port: LibraryPort, scope: string, t: Translate = englishOnly): Promise<LibraryLimit[]> {
  if (!port) throw new EditorServiceUnavailableError(librarySubject(t))
  const res = await port.listOfType({ scope, type: 'design_limit' })
  if (!res.ok) throw new Error(t('designLimits.libraryAnsweredLower', 'the library answered {{status}}', { ns: 'editor', status: res.status }))
  const body: unknown = await res.json()
  const items = typeof body === 'object' && body !== null && 'items' in body && Array.isArray(body.items) ? (body.items as unknown[]) : null
  if (!items) throw new Error(t('designLimits.libraryNoItems', 'the library sent no item list', { ns: 'editor' }))
  const out: LibraryLimit[] = []
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue
    const i = item as { limit?: unknown; revision?: unknown; deprecated?: unknown }
    if (i.deprecated === true || !isLimit(i.limit) || typeof i.revision !== 'number') continue
    out.push({ limit: i.limit, revision: i.revision })
  }
  return out
}

/** Every limit in force for a scope: the add-ons' defaults, the firm's rows, and (for `project:<id>`) the project's. */
export async function loadDesignLimitRowsFrom(port: LibraryPort, scope: string, t: Translate = englishOnly): Promise<DesignLimitRows> {
  const project = scope.startsWith('project:')
  const [policy, firm, own] = await Promise.all([
    import('@permitzip/bim-kernel/policy'),
    listScope(port, 'firm', t),
    project ? listScope(port, scope, t) : Promise.resolve(null),
  ])
  const rows = policy.designLimitRows({ firm: firm.map((f) => f.limit), project: own?.map((o) => o.limit) ?? [] })
  return { rows, own: own ?? firm, band: policy.bandWords }
}

/** The firm's and (with a project) the project's own limits, as route checks and lint read them. */
export async function loadDesignLimitSourcesFrom(port: LibraryPort, projectId: string | null, t: Translate = englishOnly): Promise<DesignLimitSources> {
  const [firm, project] = await Promise.all([
    listScope(port, 'firm', t),
    projectId ? listScope(port, `project:${projectId}`, t) : Promise.resolve([]),
  ])
  return { firm: firm.map((f) => f.limit), project: project.map((p) => p.limit) }
}

export type PublishOutcome = { readonly ok: true } | { readonly ok: false; readonly message: string }

/** Save one limit as a library item revision (`baseRevision` 0 for a new one); `deprecated` puts it back to the default. */
export async function publishDesignLimitFrom(
  port: LibraryPort,
  scope: string,
  limit: DesignLimit,
  baseRevision: number,
  opts: { readonly deprecated?: boolean } = {},
  t: Translate = englishOnly,
): Promise<PublishOutcome> {
  if (!port)
    return {
      ok: false,
      message: t('designLimits.notSavedWhy', "{{name}} wasn't saved. {{reason}}", { ns: 'editor', name: limit.label, reason: unavailableWords(librarySubject(t)) }),
    }
  const { designLimitItemBody } = await import('@permitzip/bim-library')
  const { setBy: _shownOnly, ...toSave } = limit
  const body = { ...designLimitItemBody(toSave, baseRevision + 1), ...(opts.deprecated ? { deprecated: true } : {}) }
  try {
    const res = await port.publish({ scope, item: { type: 'design_limit', body }, baseRevision })
    const answer: unknown = await res.json().catch((err: unknown) => {
      console.error('[design-limits] the publish answer was not JSON', err)
      return null
    })
    if (res.ok) return { ok: true }
    const message =
      typeof answer === 'object' && answer !== null && 'message' in answer && typeof answer.message === 'string'
        ? answer.message
        : t('designLimits.libraryAnswered', 'The library answered {{status}}.', { ns: 'editor', status: res.status })
    if (res.status === 409)
      return {
        ok: false,
        message: t('designLimits.conflict', 'Someone changed {{name}} while you were editing. Reload and try again. ({{message}})', {
          ns: 'editor',
          name: limit.label,
          message,
        }),
      }
    return { ok: false, message }
  } catch (err) {
    console.error('[design-limits] publishing a design limit failed', err)
    return {
      ok: false,
      message: t('designLimits.unreachable', "{{name}} wasn't saved: the library couldn't be reached. Check your connection and try again.", {
        ns: 'editor',
        name: limit.label,
      }),
    }
  }
}

/** What a limit applies to, in words ("<discipline> · <system>"). */
export function appliesToWords(limit: Pick<DesignLimit, 'appliesTo'>, t: Translate = englishOnly): string {
  const a = limit.appliesTo
  const parts = [a.discipline, ...(a.systems ?? []), ...(a.services ?? []), ...(a.materials ?? []), ...(a.elementClasses ?? [])].filter((p): p is string => typeof p === 'string' && p.length > 0)
  return parts.length === 0 ? t('designLimits.everything', 'Everything', { ns: 'editor' }) : parts.map((p) => p.replace(/^[a-z0-9]+\./, '').replace(/_/g, ' ')).join(' · ')
}
