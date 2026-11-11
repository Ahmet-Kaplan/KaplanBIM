'use client'

import { useCallback, useEffect, useState } from 'react'
import type { DrawingUnderlay } from '@permitzip/bim-kernel'
import type { EditorDataAnswer, EditorDataHost } from '@permitzip/bim-editor-host'
import { useOptionalEditorHost } from '@permitzip/bim-editor/host'
import { EditorServiceUnavailableError, unavailableWords } from '@permitzip/bim-editor/host/unavailable'
import { underlayRoutes, type UnderlayCandidate, type UnderlayPageInfo, type UnderlaySegment } from '../../contracts/bim/underlays/formats'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'

/**
 * The host side of underlays (`underlays` port): the project's workspace
 * drawings to pick from, and for a placed underlay its page picture and
 * linework. Every read goes through the host, which checks the person's
 * access each time.
 */

type UnderlaysPort = EditorDataHost['underlays']

/** The console label for the candidates read. Developer text, never on a screen, so not a keyed caption. */
const UNDERLAY_CANDIDATES = 'underlayCandidates'

/** What the port is called when it is missing: "Drawings to trace over are not available here". */
const drawingsWord = (t: Translate = englishOnly): string => t('spaces.drawingsToTrace', 'Drawings to trace over', { ns: 'editor' })

export type Loadable<T> = { readonly state: 'loading' } | { readonly state: 'error'; readonly message: string } | { readonly state: 'ready'; readonly value: T }

async function readJson<T>(url: string, request: () => Promise<EditorDataAnswer>, what: string, t: Translate): Promise<T> {
  const res = await request()
  const body: unknown = await res.json().catch((err: unknown) => {
    console.error('[use-underlays] reading the reply failed', { url, err })
    return null
  })
  if (!res.ok) throw new Error(underlayReplyMessage(res.status, body, what, t))
  return body as T
}

/** What a refused underlay request says to the person: access in plain words, otherwise the server's own reason. */
export function underlayReplyMessage(status: number, body: unknown, what: string, t: Translate = englishOnly): string {
  if (status === 401) return t('spaces.signedOut', 'You’re signed out. Sign in again, then reopen the drawings.', { ns: 'editor' })
  if (status === 403) return t('spaces.cannotSeeDrawings', 'You can’t see this project’s drawings. Ask the project lead to add you to the project.', { ns: 'editor' })
  const said = typeof body === 'object' && body !== null ? Reflect.get(body, 'error') : undefined
  return typeof said === 'string' && said.trim() !== '' ? said : t('spaces.requestFailed', '{{what}} didn’t load (error {{status}}). Try again in a moment.', { ns: 'editor', what, status })
}

/** The workspace drawings the person can place, newest first. `reload` after an upload. */
export function useUnderlayCandidatesFrom(port: UnderlaysPort, projectId: string, enabled: boolean): { readonly files: Loadable<readonly UnderlayCandidate[]>; readonly reload: () => void } {
  const t = useEditorTranslate()
  const capabilities = useOptionalEditorHost()?.capabilities ?? null
  const [files, setFiles] = useState<Loadable<readonly UnderlayCandidate[]>>({ state: 'loading' })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!enabled || !port) return
    let live = true
    setFiles({ state: 'loading' })
    readJson<{ files: UnderlayCandidate[] }>(UNDERLAY_CANDIDATES, () => port.candidates({ projectId }), t('spaces.theDrawingsList', 'The drawings list', { ns: 'editor' }), t)
      .then((r) => live && setFiles({ state: 'ready', value: r.files }))
      .catch((err: unknown) => {
        console.error('[use-underlays] listing drawings failed', { projectId, err })
        if (live) setFiles({ state: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      live = false
    }
  }, [port, projectId, enabled, tick, t])
  const reload = useCallback(() => setTick((count) => count + 1), [])
  return { files: port ? files : { state: 'error', message: unavailableWords(drawingsWord(t), capabilities) }, reload }
}

const infoCache = new Map<string, Promise<UnderlayPageInfo>>()
const lineworkCache = new Map<string, Promise<readonly UnderlaySegment[]>>()

export function underlayPageInfoFrom(port: UnderlaysPort, projectId: string, fileId: string, page: number, t: Translate = englishOnly): Promise<UnderlayPageInfo> {
  if (!port) return Promise.reject(new EditorServiceUnavailableError(drawingsWord(t)))
  const url = underlayRoutes(projectId, fileId, page).info
  let p = infoCache.get(url)
  if (!p) {
    p = readJson<UnderlayPageInfo>(url, () => port.pageInfo({ projectId, fileId, page }), t('spaces.theDrawingPage', 'The drawing page', { ns: 'editor' }), t)
    p.catch(() => infoCache.delete(url))
    infoCache.set(url, p)
  }
  return p
}

export function underlayLineworkFrom(port: UnderlaysPort, url: string, t: Translate = englishOnly): Promise<readonly UnderlaySegment[]> {
  if (!port) return Promise.reject(new EditorServiceUnavailableError(drawingsWord(t)))
  let p = lineworkCache.get(url)
  if (!p) {
    p = readJson<{ segments: UnderlaySegment[] }>(url, () => port.linework({ url }), t('spaces.theDrawingLinework', 'The drawing linework', { ns: 'editor' }), t).then((r) => r.segments)
    p.catch(() => lineworkCache.delete(url))
    lineworkCache.set(url, p)
  }
  return p
}

/** A placed underlay's page (size, picture link) and its linework once loaded. */
export function useUnderlayPageFrom(port: UnderlaysPort, projectId: string, underlay: DrawingUnderlay | null): { readonly page: Loadable<UnderlayPageInfo>; readonly linework: readonly UnderlaySegment[] } {
  const t = useEditorTranslate()
  const [page, setPage] = useState<Loadable<UnderlayPageInfo>>({ state: 'loading' })
  const [linework, setLinework] = useState<readonly UnderlaySegment[]>([])
  const ref = underlay?.source.ref ?? null
  const pageNo = underlay?.source.page ?? 1
  useEffect(() => {
    if (!ref) return
    let live = true
    setPage({ state: 'loading' })
    setLinework([])
    underlayPageInfoFrom(port, projectId, ref, pageNo, t)
      .then((info) => {
        if (!live) return
        setPage({ state: 'ready', value: info })
        if (info.lineworkUrl)
          underlayLineworkFrom(port, info.lineworkUrl, t)
            .then((s) => live && setLinework(s))
            .catch((err: unknown) => console.error('[use-underlays] linework failed; tracing still works, without snapping to the drawing', { ref, err }))
      })
      .catch((err: unknown) => {
        console.error('[use-underlays] page info failed', { projectId, ref, err })
        if (live) setPage({ state: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => {
      live = false
    }
  }, [port, projectId, ref, pageNo, t])
  return { page, linework }
}
