'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ModelState } from '@permitzip/bim-kernel'
import { activeLintRules, DEFAULT_LINT_CONFIG, LintEngine, type Finding, type LintConfig, type LinkedModelIndex } from '@permitzip/bim-lint'
import type { EditorDataAnswer, EditorDataHost } from '@permitzip/bim-editor-host'
import { useOptionalEditorHost } from '@permitzip/bim-editor/host'
import { EditorServiceUnavailableError, unavailableWords } from '@permitzip/bim-editor/host/unavailable'
import { requireAddOns } from '../../contracts/building-model/add-ons'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'

/**
 * Manage › Coordination's data: the person's lint settings, accepted
 * findings and the linked models' index from the server, and the findings
 * from the same lint engine the agent's edits run, here in the browser over
 * the model the person has open. Recomputed when the model changes.
 */

export interface Acceptance {
  readonly findingId: string
  readonly rule: string
  readonly reason: string
  readonly acceptedBy: string
  readonly acceptedAt: string
}

interface ServerState {
  readonly settings: LintConfig
  readonly acceptances: readonly Acceptance[]
  readonly linked: readonly LinkedModelIndex[]
  readonly linkedNote: string | null
  readonly projectName: string | null
}

export type CoordinationState =
  | { readonly status: 'loading'; readonly message: string }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready'
      readonly open: readonly Finding[]
      readonly accepted: ReadonlyArray<{ readonly finding: Finding; readonly acceptance: Acceptance }>
      /** Active acceptances that match no finding in this check (another check's, elements changed, or never a real finding). */
      readonly unmatched: readonly Acceptance[]
      readonly settings: LintConfig
      readonly linkedCount: number
      readonly linkedNote: string | null
      readonly notAvailable: ReadonlyArray<{ readonly rule: string; readonly reason: string | null }>
      readonly revision: number
    }

/** A rule's title, else its id. Read when shown: the add-ons' rules (pressurization, …) join the built-ins once the host installs them. */
export function ruleTitle(rule: string): string {
  return activeLintRules().find((r) => r.id === rule)?.title ?? rule
}

async function readJson<T>(res: EditorDataAnswer, what: string, t: Translate = englishOnly): Promise<T> {
  const body: unknown = await res.json().catch((err: unknown) => {
    console.error(`[coordination] ${what}: the answer wasn't JSON`, err)
    return null
  })
  if (!res.ok) {
    const message = typeof body === 'object' && body !== null && 'error' in body && typeof (body as { error: unknown }).error === 'string' ? (body as { error: string }).error : t('coordination.whatFailed', '{{what}} failed ({{status}})', { ns: 'editor', what, status: res.status })
    throw new Error(message)
  }
  return body as T
}

export function useCoordinationFrom(port: EditorDataHost['coordination'], projectId: string, modelId: string, model: ModelState | null) {
  const t = useEditorTranslate()
  const COORDINATION = t('coordination.service', 'Coordination (lint settings, accepted findings and linked models)', { ns: 'editor' })
  const capabilities = useOptionalEditorHost()?.capabilities ?? null
  const [server, setServer] = useState<ServerState | null>(null)
  const [state, setState] = useState<CoordinationState>({ status: 'loading', message: t('coordination.loading', 'Loading coordination settings and linked models (the first time a linked model is read takes a few seconds)…', { ns: 'editor' }) })
  const [config, setConfig] = useState<LintConfig | null>(null)
  const engineRef = useRef<{ engine: LintEngine; linked: readonly LinkedModelIndex[] } | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!port) return
    let cancelled = false
    port
      .read({ projectId, modelId })
      .then((res) => readJson<ServerState>(res, t('coordination.loadingCoordination', 'Loading coordination', { ns: 'editor' }), t))
      .then((s) => {
        if (cancelled) return
        setServer(s)
        setConfig((c) => c ?? s.settings)
      })
      .catch((err: unknown) => {
        console.error('[coordination] loading failed', err)
        if (!cancelled) setState({ status: 'error', message: err instanceof Error ? err.message : t('coordination.loadingFailed', 'Loading coordination failed', { ns: 'editor' }) })
      })
    return () => {
      cancelled = true
    }
  }, [port, projectId, modelId, reload, t])

  useEffect(() => {
    if (!server || !model || !config) return
    let cancelled = false
    // A tick first so the loading state paints before the check runs.
    const timer = setTimeout(() => {
      if (cancelled) return
      try {
        const acceptedIds = new Set(server.acceptances.map((a) => a.findingId))
        // The rules of the add-ons this model pins (and this deployment has) run with the built-in ones.
        const { all, notAvailable } = requireAddOns().host.withPinnedPacks(model, () => {
          let held = engineRef.current
          if (!held || held.linked !== server.linked) {
            held = { engine: new LintEngine(), linked: server.linked }
            held.engine.build(model, server.linked)
            engineRef.current = held
          } else if (held.engine.model !== model) {
            held.engine.build(model, server.linked)
          }
          return {
            all: held.engine.check({ config, accepted: acceptedIds, includeAccepted: true, projectName: server.projectName }),
            notAvailable: held.engine.availability(config).filter((r) => !r.available).map((r) => ({ rule: r.rule, reason: r.reason })),
          }
        })
        const byId = new Map(server.acceptances.map((a) => [a.findingId, a]))
        const found = new Set(all.map((f) => f.id))
        setState({
          status: 'ready',
          open: all.filter((f) => !acceptedIds.has(f.id)),
          accepted: all.flatMap((f) => {
            const acceptance = byId.get(f.id)
            return acceptance ? [{ finding: f, acceptance }] : []
          }),
          unmatched: server.acceptances.filter((a) => !found.has(a.findingId)),
          settings: config,
          linkedCount: server.linked.length,
          linkedNote: server.linkedNote,
          notAvailable,
          revision: model.revision,
        })
      } catch (err) {
        console.error('[coordination] the check failed', err)
        setState({ status: 'error', message: err instanceof Error ? t('coordination.checkFailedReason', 'The check failed: {{error}}', { ns: 'editor', error: err.message }) : t('coordination.checkFailed', 'The check failed', { ns: 'editor' }) })
      }
    }, 30)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [server, model, config, t])

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      if (!port) throw new EditorServiceUnavailableError(COORDINATION, capabilities)
      const res = await port.save({ projectId, modelId, body })
      return readJson<{ acceptances?: Acceptance[]; settings?: LintConfig }>(res, t('coordination.saving', 'Saving', { ns: 'editor' }), t)
    },
    [port, capabilities, projectId, modelId, t, COORDINATION],
  )

  const accept = useCallback(
    async (finding: Finding, reason: string) => {
      const r = await post({ action: 'accept', finding_id: finding.id, rule: finding.rule, reason })
      setServer((s) => (s && r.acceptances ? { ...s, acceptances: r.acceptances } : s))
    },
    [post],
  )

  const retract = useCallback(
    async (findingId: string, reason: string) => {
      const r = await post({ action: 'retract', finding_id: findingId, reason })
      setServer((s) => (s && r.acceptances ? { ...s, acceptances: r.acceptances } : s))
    },
    [post],
  )

  const saveSettings = useCallback(
    async (next: LintConfig) => {
      const r = await post({ action: 'settings', settings: next })
      if (r.settings) setConfig(r.settings)
    },
    [post],
  )

  const retry = useCallback(() => {
    setState({ status: 'loading', message: t('coordination.loadingShort', 'Loading coordination settings and linked models…', { ns: 'editor' }) })
    setReload((n) => n + 1)
  }, [t])

  const shown: CoordinationState = port ? state : { status: 'error', message: unavailableWords(COORDINATION, capabilities) }
  return { state: shown, config: config ?? DEFAULT_LINT_CONFIG, setConfig, accept, retract, saveSettings, retry }
}
