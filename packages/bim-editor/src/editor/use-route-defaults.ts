'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RouteDefaultDomain, RouteDefaults, RouteDefaultsRead } from '../contracts/building-model/route-defaults'
import type { EditorDataAnswer, EditorDataHost } from '@permitzip/bim-editor-host'
import { useOptionalEditorHost } from '@permitzip/bim-editor/host'
import { useEditorTranslate, type Translate } from './i18n/translate'
import { unavailableIn } from './i18n/unavailable'

export type RouteDefaultsState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly rows: readonly RouteDefaultsRead[] }
  | { readonly status: 'error'; readonly message: string }

export interface RouteDefaultsApi {
  readonly state: RouteDefaultsState
  /** Save (or, with null, forget) one scope; resolves to the reason it failed, or null. */
  save(domain: RouteDefaultDomain, scope: 'project' | 'all', settings: RouteDefaults | null): Promise<string | null>
}

function isReads(v: unknown): v is { defaults: RouteDefaultsRead[] } {
  return typeof v === 'object' && v !== null && 'defaults' in v && Array.isArray(v.defaults)
}

async function errorText(res: EditorDataAnswer, t: Translate): Promise<string> {
  const body: unknown = await res.json().catch((err: unknown) => {
    console.error('[useRouteDefaults] error body unreadable', err)
    return null
  })
  return typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
    ? body.error
    : t('route.serverAnswered', 'The server answered {{status}}', { ns: 'editor', status: res.status })
}

export function useRouteDefaultsFrom(port: EditorDataHost['routeDefaults'], projectId: string, onLoaded: (rows: readonly RouteDefaultsRead[]) => void): RouteDefaultsApi {
  const t = useEditorTranslate()
  const capabilities = useOptionalEditorHost()?.capabilities ?? null
  const unavailable = (): string => unavailableIn(t('route.savedDefaults', 'Saved route defaults', { ns: 'editor' }), capabilities, t)
  const [state, setState] = useState<RouteDefaultsState>({ status: 'loading' })
  const loaded = useRef(onLoaded)
  loaded.current = onLoaded
  useEffect(() => {
    if (!port) return
    let live = true
    port
      .read({ projectId })
      .then(async (res) => {
        if (!res.ok) throw new Error(await errorText(res, t))
        const body: unknown = await res.json()
        if (!isReads(body)) throw new Error(t('route.unreadableShape', 'The saved route defaults came back in a shape this page does not read', { ns: 'editor' }))
        if (!live) return
        setState({ status: 'ready', rows: body.defaults })
        loaded.current(body.defaults)
      })
      .catch((err: unknown) => {
        console.error('[useRouteDefaults] load failed', { projectId, err })
        if (live) setState({ status: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      live = false
    }
  }, [port, projectId])

  const save = useCallback(
    async (domain: RouteDefaultDomain, scope: 'project' | 'all', settings: RouteDefaults | null): Promise<string | null> => {
      if (!port) return unavailable()
      try {
        const res = await port.save({ projectId, domain, scope, settings })
        if (!res.ok) return await errorText(res, t)
        const body: unknown = await res.json()
        if (!isReads(body)) return t('route.savedUnreadableShape', 'Saved, but the answer came back in a shape this page does not read; reload to see it', { ns: 'editor' })
        setState({ status: 'ready', rows: body.defaults })
        return null
      } catch (err) {
        console.error('[useRouteDefaults] save failed', { projectId, domain, scope, err })
        return err instanceof Error ? err.message : String(err)
      }
    },
    [port, capabilities, projectId],
  )
  return { state: port ? state : { status: 'error', message: unavailable() }, save }
}
