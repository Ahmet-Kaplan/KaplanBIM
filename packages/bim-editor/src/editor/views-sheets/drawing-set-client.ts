'use client'

import type { SheetRevision } from '@permitzip/bim-kernel'
import type { ReissueCheck } from '@permitzip/bim-sheets'
import type { EditorDataAnswer, EditorDataHost } from '@permitzip/bim-editor-host'
import { EditorServiceUnavailableError } from '@permitzip/bim-editor/host/unavailable'
import type { IssueCheckResult, IssueSetResult, PrintSetResult, SetHistory } from '../../contracts/bim/drawing-set-results'
import { englishOnly, type Translate } from '../i18n/translate'

/**
 * The browser's side of Print set and Issue set: the Building Model asks the
 * host's server, which prints and issues through the same path as the agent's
 * tools.
 */

export interface SetStatus {
  readonly check: IssueCheckResult
  readonly history: SetHistory
  /** Round 10 C10: approvals on these sheets checked against an older rule (absent from an older server). */
  readonly codeCheck?: ReissueCheck
}

async function answer<T>(res: EditorDataAnswer, doing: string): Promise<T> {
  const body: unknown = await res.json().catch((err: unknown) => {
    console.error(`[drawing-set-client] ${doing}: the answer wasn't readable`, err)
    return null
  })
  if (!res.ok) {
    const said = body && typeof body === 'object' ? ((body as { error?: unknown; detail?: unknown }).detail ?? (body as { error?: unknown }).error) : null
    throw new Error(typeof said === 'string' && said ? said : `${doing} failed (HTTP ${res.status}). Try again.`)
  }
  if (body === null) throw new Error(`${doing}: the server's answer couldn't be read. Try again.`)
  return body as T
}

type DrawingSetsPort = EditorDataHost['drawingSets']

function portOf(port: DrawingSetsPort, t: Translate): NonNullable<DrawingSetsPort> {
  if (!port)
    throw new EditorServiceUnavailableError(t('set.setsService', 'Printing and issuing sets', { ns: 'editor' }))
  return port
}

export async function fetchSetStatusFrom(
  port: DrawingSetsPort,
  projectId: string,
  modelId: string,
  sheets?: readonly string[],
  t: Translate = englishOnly,
): Promise<SetStatus> {
  return answer<SetStatus>(
    await portOf(port, t).status({ projectId, modelId, ...(sheets ? { sheets } : {}) }),
    t('set.checking', 'Checking the set', { ns: 'editor' }),
  )
}

export async function printSetFrom(
  port: DrawingSetsPort,
  projectId: string,
  modelId: string,
  input: { sheets?: readonly string[]; title?: string },
  t: Translate = englishOnly,
): Promise<PrintSetResult> {
  const res = await portOf(port, t).print({ projectId, modelId, input })
  return answer<PrintSetResult>(res, t('set.printing', 'Printing the set', { ns: 'editor' }))
}

export async function issueSetFrom(
  port: DrawingSetsPort,
  projectId: string,
  modelId: string,
  input: { name: string; expectedRevision: number; sheets?: readonly string[]; addRevision?: SheetRevision; acceptChangesSincePrint?: boolean },
  t: Translate = englishOnly,
): Promise<IssueSetResult> {
  const res = await portOf(port, t).issue({ projectId, modelId, input })
  return answer<IssueSetResult>(res, t('set.issuing', 'Issuing the set', { ns: 'editor' }))
}
