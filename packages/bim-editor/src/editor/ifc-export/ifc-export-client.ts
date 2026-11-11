'use client'

import type { z } from 'zod'
import type { EditorDataAnswer, EditorDataHost } from '@permitzip/bim-editor-host'
import { EditorServiceUnavailableError } from '@permitzip/bim-editor/host/unavailable'
import { englishOnly, type Translate } from '../i18n/translate'
import { ifcExportDownloadSchema, ifcExportListSchema, ifcExportViewSchema, type IfcExportView } from '../../contracts/building-model/ifc-export-contract'

/** The browser's side of Export IFC (the host's `ifcExport` port). Every answer is checked against the shared contract. */

type IfcExportPort = EditorDataHost['ifcExport']
function portOf(port: IfcExportPort, t: Translate): NonNullable<IfcExportPort> {
  if (!port) throw new EditorServiceUnavailableError(t('ifcExport.service', 'Export IFC', { ns: 'editor' }))
  return port
}

function errorText(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null
  const detail: unknown = Reflect.get(body, 'detail')
  const error: unknown = Reflect.get(body, 'error')
  if (typeof detail === 'string' && detail) return detail
  return typeof error === 'string' && error ? error : null
}

async function answer<T>(res: EditorDataAnswer, schema: z.ZodType<T>, doing: string, t: Translate): Promise<T> {
  const body: unknown = await res.json().catch((err: unknown) => {
    console.error(`[ifc-export-client] ${doing}: the answer wasn't readable`, err)
    return null
  })
  if (!res.ok) throw new Error(errorText(body) ?? t('ifcExport.doingFailed', '{{doing}} failed (HTTP {{status}}). Try again.', { ns: 'editor', doing, status: res.status }))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    console.error(`[ifc-export-client] ${doing}: unexpected answer`, parsed.error.issues.slice(0, 3))
    throw new Error(t('ifcExport.answerUnreadable', "{{doing}}: the server's answer couldn't be read. Reload and try again.", { ns: 'editor', doing }))
  }
  return parsed.data
}

export async function fetchIfcExportsFrom(port: IfcExportPort, projectId: string, t: Translate = englishOnly): Promise<IfcExportView[]> {
  const doing = t('ifcExport.loadingExports', 'Loading IFC exports', { ns: 'editor' })
  return (await answer(await portOf(port, t).list({ projectId }), ifcExportListSchema, doing, t)).exports
}

export async function startIfcExportFrom(port: IfcExportPort, projectId: string, modelId: string, t: Translate = englishOnly): Promise<IfcExportView> {
  const doing = t('ifcExport.exportingIfc', 'Exporting IFC', { ns: 'editor' })
  const res = await portOf(port, t).start({ projectId, modelId })
  return answer(res, ifcExportViewSchema, doing, t)
}

export async function ifcExportDownloadUrlFrom(port: IfcExportPort, projectId: string, artifactId: string, t: Translate = englishOnly): Promise<string> {
  const doing = t('ifcExport.gettingDownload', 'Getting the IFC download', { ns: 'editor' })
  return (await answer(await portOf(port, t).download({ projectId, artifactId }), ifcExportDownloadSchema, doing, t)).url
}
