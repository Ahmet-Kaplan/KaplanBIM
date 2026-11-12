'use client'

import type { EditorDataAnswer, EditorDataHost } from '@permitzip/bim-editor-host'
import { EditorServiceUnavailableError } from '@permitzip/bim-editor/host/unavailable'
import { englishOnly, type Translate } from './i18n/translate'
import { unavailableIn } from './i18n/unavailable'
import type {
  DocsAddItem,
  DocsAddResult,
  DocsBrowseResponse,
  LinkedFreshnessView,
  LinkedModelsResponse,
  LinkedUpdateOutcome,
  PlacementAdjustment,
  StartUploadRequest,
  StartUploadResponse,
} from '../contracts/building-model/linked-contract'

/** Browser calls for the Building Model's linked models (the host's `linkedModels` port); every failure carries the server's plain-English reason. */

type LinkedPort = EditorDataHost['linkedModels']

function portOf(port: LinkedPort, t: Translate): NonNullable<LinkedPort> {
  if (!port) throw new EditorServiceUnavailableError(unavailableIn(t('session.linkedModelsService', 'Linked models', { ns: 'editor' }), null, t))
  return port
}

/** The places a model can be linked from that this host serves. A source it doesn't serve is not offered. */
export interface LinkSources {
  /** An IFC file from the person's computer. */
  readonly ifcUpload: boolean
  /** The project's connected Revit model, with the models linked in it. */
  readonly revitExport: boolean
  /** Files picked from the project's Autodesk Docs. */
  readonly autodeskDocs: boolean
}

/** What the host's port can link from: a source counts only when every method it needs is there. */
export function linkSourcesOf(port: LinkedPort): LinkSources {
  return {
    ifcUpload: Boolean(port?.startUpload && port.putFile && port.convert),
    revitExport: Boolean(port?.autodeskExport && port.updateFromRevit),
    autodeskDocs: Boolean(port?.browseDocs && port.addDocs && port.refreshDocs && port.lineUp),
  }
}

/** Whether Link (the dialog) has anything to offer: an upload or the Revit model. Autodesk Docs has its own picker. */
export function canLinkFrom(sources: LinkSources): boolean {
  return sources.ifcUpload || sources.revitExport
}

/** What Link a model does here, in words, naming only the sources this host serves. */
export function linkDescription(sources: LinkSources, t: Translate = englishOnly): string {
  const autodesk = sources.revitExport || sources.autodeskDocs
  if (autodesk && sources.ifcUpload) return t('linked.bringFromDocsOrIfc', "Bring in the architect's model from Autodesk Docs or an IFC file", { ns: 'editor' })
  if (autodesk) return t('linked.bringFromDocs', "Bring in the architect's model from Autodesk Docs", { ns: 'editor' })
  if (sources.ifcUpload) return t('linked.bringFromIfc', "Bring in the architect's model from an IFC file", { ns: 'editor' })
  return t('linked.linkingNotAvailable', 'Linking a model is not available here', { ns: 'editor' })
}

/** What the Link button opens, in words. */
export function linkButtonHint(sources: LinkSources, t: Translate = englishOnly): string {
  if (sources.revitExport && sources.ifcUpload) return t('linkedModels.linkWhy', 'Bring in the models linked in our Revit file, or upload an IFC file', { ns: 'editor' })
  if (sources.revitExport) return t('linked.bringRevitLinks', 'Bring in the models linked in our Revit file', { ns: 'editor' })
  return t('linkModel.tabUpload', 'Upload an IFC file', { ns: 'editor' })
}

/** Why nothing can be linked where the editor runs, in words; null when something can. */
export function linkUnavailableReason(sources: LinkSources, hostName: string, t: Translate = englishOnly): string | null {
  if (canLinkFrom(sources) || sources.autodeskDocs) return null
  return t('linked.noLinkSourcesHere', "Linked models aren't available here: {{hostName}} doesn't keep linked model files. You can model without one.", { ns: 'editor', hostName })
}

async function readJson<T>(res: EditorDataAnswer, guard: (v: unknown) => v is T, what: string, t: Translate): Promise<T> {
  const body: unknown = await res.json().catch((err: unknown) => {
    console.error(`[linked-api] ${what}: response was not JSON`, err)
    return null
  })
  if (!res.ok) {
    const message = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string' ? body.error : null
    throw new Error(message ?? t('linked.requestFailed', '{{what}} failed (HTTP {{status}}).', { ns: 'editor', what, status: res.status }))
  }
  if (!guard(body)) throw new Error(t('linked.unexpectedAnswer', '{{what}}: the server sent an unexpected answer.', { ns: 'editor', what }))
  return body
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isOk = (v: unknown): v is { ok: true } => isObject(v) && v.ok === true

function isLinkedModelsResponse(v: unknown): v is LinkedModelsResponse {
  return isObject(v) && typeof v.canEdit === 'boolean' && Array.isArray(v.references) && 'revitModel' in v && 'autodeskExport' in v
}

function isStartUploadResponse(v: unknown): v is StartUploadResponse {
  return isObject(v) && typeof v.referenceId === 'string' && typeof v.versionId === 'string' && typeof v.sourcePath === 'string'
}

export async function fetchLinkedModelsFrom(port: LinkedPort, projectId: string, signal?: AbortSignal, t: Translate = englishOnly): Promise<LinkedModelsResponse> {
  return readJson(
    await portOf(port, t).list({ projectId }, { signal }),
    isLinkedModelsResponse,
    t('linked.loadingModels', 'Loading linked models', { ns: 'editor' }),
    t,
  )
}

export async function startUploadFrom(port: LinkedPort, projectId: string, request: StartUploadRequest, t: Translate = englishOnly): Promise<StartUploadResponse> {
  const p = portOf(port, t)
  if (!p.startUpload) throw new EditorServiceUnavailableError(unavailableIn(t('linked.uploadService', 'Uploading an IFC file', { ns: 'editor' }), null, t))
  return readJson(await p.startUpload({ projectId, request }), isStartUploadResponse, t('linked.startingUpload', 'Starting the upload', { ns: 'editor' }), t)
}

export async function completeUploadFrom(port: LinkedPort, projectId: string, versionId: string, t: Translate = englishOnly): Promise<void> {
  const p = portOf(port, t)
  if (!p.convert) throw new EditorServiceUnavailableError(unavailableIn(t('linked.uploadService', 'Uploading an IFC file', { ns: 'editor' }), null, t))
  await readJson(await p.convert({ projectId, versionId }), isOk, t('linked.queuingConversion', 'Queuing the conversion', { ns: 'editor' }), t)
}

export async function retryVersionFrom(port: LinkedPort, projectId: string, versionId: string, t: Translate = englishOnly): Promise<void> {
  const p = portOf(port, t)
  if (!p.convert) throw new EditorServiceUnavailableError(unavailableIn(t('linked.uploadService', 'Uploading an IFC file', { ns: 'editor' }), null, t))
  await readJson(await p.convert({ projectId, versionId }), isOk, t('linked.retryingConversion', 'Trying the conversion again', { ns: 'editor' }), t)
}

export async function startAutodeskExportFrom(port: LinkedPort, projectId: string, t: Translate = englishOnly): Promise<void> {
  const p = portOf(port, t)
  if (!p.autodeskExport) throw new EditorServiceUnavailableError(unavailableIn(t('linked.revitService', "Bringing in the project's Revit model", { ns: 'editor' }), null, t))
  await readJson(await p.autodeskExport({ projectId }), isOk, t('linked.startingExport', 'Starting the export from Revit', { ns: 'editor' }), t)
}

function isDocsBrowseResponse(v: unknown): v is DocsBrowseResponse {
  return isObject(v) && Array.isArray(v.folders) && Array.isArray(v.files)
}

function isDocsAddResponse(v: unknown): v is { results: DocsAddResult[] } {
  return isObject(v) && Array.isArray(v.results)
}

function isDocsRefreshResponse(v: unknown): v is { outcome: 'up_to_date' | 'queued' | 'already_running'; versionNumber: number | null } {
  return isObject(v) && (v.outcome === 'up_to_date' || v.outcome === 'queued' || v.outcome === 'already_running')
}

/** One folder of the project's Autodesk Docs project (null = its top folders), or a search below it. */
export async function browseDocsFrom(
  port: LinkedPort,
  projectId: string,
  request: { readonly folderId: string | null; readonly query?: string },
  signal?: AbortSignal,
  t: Translate = englishOnly,
): Promise<DocsBrowseResponse> {
  const p = portOf(port, t)
  if (!p.browseDocs) throw new EditorServiceUnavailableError(unavailableIn(t('linked.docsService', 'Adding models from Autodesk Docs', { ns: 'editor' }), null, t))
  return readJson(await p.browseDocs({ projectId, request }, { signal }), isDocsBrowseResponse, t('linked.openingDocs', 'Opening Autodesk Docs', { ns: 'editor' }), t)
}

export async function addDocsItemsFrom(port: LinkedPort, projectId: string, items: readonly DocsAddItem[], t: Translate = englishOnly): Promise<DocsAddResult[]> {
  const p = portOf(port, t)
  if (!p.addDocs) throw new EditorServiceUnavailableError(unavailableIn(t('linked.docsService', 'Adding models from Autodesk Docs', { ns: 'editor' }), null, t))
  const body = await readJson(await p.addDocs({ projectId, items }), isDocsAddResponse, t('linked.addingModels', 'Adding the models', { ns: 'editor' }), t)
  return body.results
}

export async function refreshDocsReferenceFrom(
  port: LinkedPort,
  projectId: string,
  referenceId: string,
  mode: 'check' | 'relink',
  t: Translate = englishOnly,
): Promise<{ outcome: 'up_to_date' | 'queued' | 'already_running'; versionNumber: number | null }> {
  const p = portOf(port, t)
  if (!p.refreshDocs) throw new EditorServiceUnavailableError(unavailableIn(t('linked.docsService', 'Adding models from Autodesk Docs', { ns: 'editor' }), null, t))
  return readJson(
    await p.refreshDocs({ projectId, referenceId, mode }),
    isDocsRefreshResponse,
    mode === 'check'
      ? t('linked.checkingDocs', 'Checking Autodesk Docs', { ns: 'editor' })
      : t('linked.relinkingDocs', 'Re-linking from Autodesk Docs', { ns: 'editor' }),
    t,
  )
}

const FRESHNESS_STATES = new Set(['up_to_date', 'newer_available', 'never_recorded', 'updating', 'unknown', 'manual'])

function isFreshnessResponse(v: unknown): v is { models: LinkedFreshnessView[] } {
  return isObject(v) && Array.isArray(v.models) && v.models.every((m) => isObject(m) && typeof m.referenceId === 'string' && typeof m.state === 'string' && FRESHNESS_STATES.has(m.state))
}

function isUpdateOutcome(v: unknown): v is LinkedUpdateOutcome {
  return isObject(v) && (v.outcome === 'up_to_date' || v.outcome === 'queued' || v.outcome === 'already_running') && typeof v.kind === 'string'
}

/** Whether each linked model is behind Autodesk Docs (asks Autodesk, so it loads after the list). */
export async function fetchLinkedFreshnessFrom(port: LinkedPort, projectId: string, signal?: AbortSignal, t: Translate = englishOnly): Promise<LinkedFreshnessView[]> {
  const p = portOf(port, t)
  if (!p.freshness) throw new EditorServiceUnavailableError(unavailableIn(t('linked.checkingNewVersionsService', 'Checking Autodesk Docs for new versions', { ns: 'editor' }), null, t))
  const body = await readJson(await p.freshness({ projectId }, { signal }), isFreshnessResponse, t('linked.checkingNewVersions', 'Checking Autodesk Docs for new versions', { ns: 'editor' }), t)
  return body.models
}

/** Update a linked model from Revit; `force` exports it again even when Docs has nothing newer. */
export async function updateFromRevitFrom(port: LinkedPort, projectId: string, referenceId: string, force: boolean, t: Translate = englishOnly): Promise<LinkedUpdateOutcome> {
  const p = portOf(port, t)
  if (!p.updateFromRevit) throw new EditorServiceUnavailableError(unavailableIn(t('linked.revitService', "Bringing in the project's Revit model", { ns: 'editor' }), null, t))
  return readJson(await p.updateFromRevit({ projectId, referenceId, force }), isUpdateOutcome, t('linked.updatingFromRevit', 'Updating from Revit', { ns: 'editor' }), t)
}

export async function lineUpDocsReferenceFrom(port: LinkedPort, projectId: string, referenceId: string, t: Translate = englishOnly): Promise<void> {
  const p = portOf(port, t)
  if (!p.lineUp) throw new EditorServiceUnavailableError(unavailableIn(t('linked.docsService', 'Adding models from Autodesk Docs', { ns: 'editor' }), null, t))
  await readJson(await p.lineUp({ projectId, referenceId }), isOk, t('linked.liningUp', 'Lining it up with the project model', { ns: 'editor' }), t)
}

export async function updateLinkedReferenceFrom(
  port: LinkedPort,
  projectId: string,
  referenceId: string,
  patch: { readonly currentVersionId?: string; readonly adjustment?: PlacementAdjustment; readonly disciplines?: readonly string[]; readonly contributor?: { readonly organization?: string; readonly contact?: string } },
  t: Translate = englishOnly,
): Promise<void> {
  await readJson(
    await portOf(port, t).update({ projectId, referenceId, patch }),
    isOk,
    t('linked.savingLinkedModel', 'Saving the linked model', { ns: 'editor' }),
    t,
  )
}

export async function unlinkReferenceFrom(port: LinkedPort, projectId: string, referenceId: string, t: Translate = englishOnly): Promise<void> {
  await readJson(await portOf(port, t).unlink({ projectId, referenceId }), isOk, t('linked.unlinking', 'Unlinking', { ns: 'editor' }), t)
}

export interface UploadHandle {
  readonly done: Promise<void>
  cancel(): void
}

/**
 * Upload the file to the one path the server handed back, as the signed-in
 * person (the host's storage only accepts that exact path while it awaits
 * this upload, and never overwrites a file), reporting progress (0–1).
 */
export async function putFileFrom(
  port: LinkedPort,
  sourcePath: string,
  file: File,
  onProgress: (fraction: number) => void,
  t: Translate = englishOnly,
): Promise<UploadHandle> {
  const p = portOf(port, t)
  if (!p.putFile) throw new EditorServiceUnavailableError(unavailableIn(t('linked.uploadService', 'Uploading an IFC file', { ns: 'editor' }), null, t))
  const handle = await p.putFile({ sourcePath, file }, onProgress)
  // The host rejects a cancelled upload with an AbortError; callers tell it apart by `UploadCancelled`.
  const done = handle.done.catch((err: unknown) => {
    throw typeof err === 'object' && err !== null && 'name' in err && err.name === 'AbortError'
      ? new UploadCancelled(t('linked.uploadCancelled', 'Upload cancelled.', { ns: 'editor' }))
      : err
  })
  return { done, cancel: () => handle.cancel() }
}

export class UploadCancelled extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UploadCancelled'
  }
}
