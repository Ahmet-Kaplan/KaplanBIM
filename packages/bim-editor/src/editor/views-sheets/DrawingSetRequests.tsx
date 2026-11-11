'use client'

import { clientOnly as dynamic } from '@permitzip/bim-editor/client-only'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { documentIndex, elementsOfKind, type ModelState, type Sheet } from '@permitzip/bim-kernel'
import type { EditorHost } from '@permitzip/bim-editor-host'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { agentDrawingPrompt } from '../../contracts/building-model/agent-drawing-prompt'
import type { SaveState } from './DrawingSetDialogs'
import type { PanelRequest } from './ViewsSheetsPanel'
import type { SubmitCommand } from './types'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'

const ArrangeSheetDialog = dynamic(() => import('./DrawingSetDialogs').then((m) => m.ArrangeSheetDialog), { ssr: false })
const RevisionsDialog = dynamic(() => import('./DrawingSetDialogs').then((m) => m.RevisionsDialog), { ssr: false })
const PrintSetDialog = dynamic(() => import('./DrawingSetDialogs').then((m) => m.PrintSetDialog), { ssr: false })
const IssueSetDialog = dynamic(() => import('./DrawingSetDialogs').then((m) => m.IssueSetDialog), { ssr: false })
const IfcExportDialog = dynamic(() => import('../ifc-export/IfcExportDialog').then((m) => m.IfcExportDialog), { ssr: false })

/** Where the host has no agent that takes a drafted request: what to do instead, and where to connect an AI when the host has such a page. */
function noAgentToMakeDrawings(host: Pick<EditorHost, 'shell' | 'capabilities'>, t: Translate): void {
  const href = host.shell.connectAgentHref ?? null
  const message = t(
    'agent.needsConnectedAi',
    'Making sheets, views and schedules with an agent needs a connected AI, and {{host}} has none built in.',
    { ns: 'editor', host: host.capabilities.hostName },
  )
  const description = href
    ? t('agent.connectYourOwn', 'Connect your own AI to this model, then ask it to make them.', { ns: 'editor' })
    : t('agent.connectThroughToolServer', 'Connect your own AI to this model through its tool server, then ask it to make them.', { ns: 'editor' })
  toast.info(
    message,
    href
      ? { description, action: { label: t('agent.howToConnect', 'How to connect an AI', { ns: 'editor' }), onClick: () => window.open(href, '_blank', 'noopener') } }
      : { description },
  )
}

/** "Make sheets, views and schedules with the agent": a new Cmd+J thread on this project with the drafted prompt in its composer, unsent. */
export function openAgentToMakeDrawings(
  host: Pick<EditorHost, 'agent' | 'shell' | 'capabilities'>,
  model: ModelState,
  project: { readonly projectId: string; readonly projectName: string; readonly projectNumber: string | null },
  t: Translate = englishOnly,
): void {
  const agent = host.agent
  if (!agent || !agent.seedComposer) {
    noAgentToMakeDrawings(host, t)
    return
  }
  const levels = elementsOfKind(model.elements, 'level')
    .filter((l) => !('deleted' in l && l.deleted))
    .sort((a, b) => a.elevationMm - b.elevationMm)
    .map((l) => l.name)
  const index = documentIndex(model)
  const text = agentDrawingPrompt({ projectNumber: project.projectNumber, projectName: project.projectName, levels, sheetCount: index.sheets.length, scheduleCount: index.views.filter((v) => v.viewType === 'schedule').length })
  agent.seedComposer({ text, modelRef: project.projectId })
  toast('Cmd+J has a drafted request in a new thread. Edit it and press Send; nothing changes until you approve.')
}

const noModelServer = (t: Translate): string =>
  t('drawingSet.needsModelServer', "Printing and issuing a set needs the model server, which isn't connected for this project. Reload, or ask an admin to connect it.", {
    ns: 'editor',
  })

/** The drawing-set dialogs a Views & Sheets or ribbon request opens (arrange, revisions, print set, issue set, IFC export). */
export function DrawingSetRequests({
  request,
  onDone,
  onRequest,
  projectId,
  projectName = '',
  projectNumber = null,
  modelId,
  model,
  sheets,
  save,
  canEdit,
  blockedReason,
  submit,
}: {
  request: PanelRequest | null
  onDone: () => void
  onRequest: (request: PanelRequest) => void
  projectId: string
  /** The project as the drafted agent request names it. */
  projectName?: string
  projectNumber?: string | null
  /** Null when no model server serves this project (fixtures only). */
  modelId: string | null
  model: ModelState | null
  sheets: readonly Sheet[]
  save: SaveState
  canEdit: boolean
  blockedReason: string
  submit: SubmitCommand
}) {
  const t = useEditorTranslate()
  const host = useEditorHost()
  const needsServer = request?.kind === 'print_set' || request?.kind === 'issue_set'
  useEffect(() => {
    if (needsServer && (!modelId || !model)) {
      toast.error(noModelServer(t))
      onDone()
    }
  }, [needsServer, modelId, model, onDone])

  // Make with the agent: no dialog here; Cmd+J opens with the drafted request, and this request is done.
  useEffect(() => {
    if (request?.kind !== 'agent_make') return
    if (model) openAgentToMakeDrawings(host, model, { projectId, projectName, projectNumber }, t)
    else toast.error(t('drawingSet.modelNotOpen', 'The model hasn’t finished opening yet. Wait for it to load, then try again.', { ns: 'editor' }))
    onDone()
  }, [host, request, model, projectId, projectName, projectNumber, onDone])

  if (!request || !model) return null
  switch (request.kind) {
    case 'arrange_sheet':
      return <ArrangeSheetDialog model={model} sheet={request.sheet} onCancel={onDone} submit={submit} />
    case 'sheet_revisions':
      return <RevisionsDialog sheet={request.sheet} allSheets={sheets} onCancel={onDone} submit={submit} />
    case 'print_set':
      return modelId ? <PrintSetDialog projectId={projectId} modelId={modelId} model={model} save={save} onCancel={onDone} /> : null
    case 'issue_set':
      return modelId ? (
        <IssueSetDialog projectId={projectId} modelId={modelId} model={model} save={save} canIssue={canEdit} blockedReason={blockedReason} onCancel={onDone} onPrintAgain={() => onRequest({ kind: 'print_set' })} />
      ) : null
    case 'export_ifc':
      return <IfcExportDialog projectId={projectId} modelId={modelId} pendingEdits={save.pending} onClose={onDone} />
    default:
      return null
  }
}
