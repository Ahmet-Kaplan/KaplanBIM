'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { PackSet } from '@permitzip/bim-kernel/packs'
import { CloudDownload, Link2, MoreHorizontal, Move, RefreshCw, Upload } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { Alert, AlertDescription } from '../ui/alert'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../ui/field'
import { Input } from '../ui/input'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../ui/item'
import { Spinner } from '../ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import {
  ALIGNMENT_LABEL,
  alignmentState,
  disciplinesOf,
  linkedContributorLabel,
  linkedDisciplinesLabel,
  docsImportStatusLabel,
  exportStatusLabel,
  finishedUpdates,
  freshnessLabel,
  isInProgress,
  isUsable,
  PLACEMENT_BASIS_LABEL,
  refreshKindOfView,
  updateOutcomeMessage,
  versionStatusLabel,
  type LinkedFreshnessView,
  type LinkedModelsResponse,
  type LinkedReferenceView,
  type PlacementAdjustment,
} from '../contracts/building-model/linked-contract'
import {
  addDocsItemsFrom,
  fetchLinkedFreshnessFrom,
  fetchLinkedModelsFrom,
  lineUpDocsReferenceFrom,
  refreshDocsReferenceFrom,
  retryVersionFrom,
  startAutodeskExportFrom,
  unlinkReferenceFrom,
  updateFromRevitFrom,
  updateLinkedReferenceFrom,
} from './linked-api'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { DocsPickerDialog } from './DocsPickerDialog'
import { ExportFailureDetails } from './ExportFailureDetails'
import { LinkModelDialog } from './LinkModelDialog'
import { LinkedIdentityDialog } from './linked-display/LinkedIdentityDialog'
import { ProposeChangesDialog } from './ifc-import/ProposeChangesDialog'
import { useEditorTranslate } from './i18n/translate'

const POLL_MS = 4000

interface Props {
  projectId: string
  linkOpen: boolean
  onLinkOpenChange(open: boolean): void
  /** The set of models the 3D view should show changed (a version became ready, was switched, moved or unlinked). */
  onViewChange(): void
  /** Whether this person may link, so the empty-state button can say why it's off. */
  onCanEditChange(canEdit: boolean): void
  /** The project's test export, shown read-only (it isn't linked through this panel). */
  fixtureReferences: readonly { readonly id: string; readonly label: string }[]
  /** How this linked model draws in what is open (halftone, see-through…), under its name. */
  displayControl?: (reference: { readonly id: string; readonly label: string }) => ReactNode
  /** The open model's discipline registry, read on each render (its add-ons and firm rows label and fill the pickers). */
  disciplineSet?: () => PackSet | null
  /** The rail draws the "Linked models" title in its section header. */
  headerless?: boolean
}

/** What the 3D view shows: each linked model's current version and its adjustment. */
function viewSignature(data: LinkedModelsResponse): string {
  return data.references
    .map((r) => `${r.id}:${r.currentVersionId ?? '-'}:${r.adjustment.x},${r.adjustment.y},${r.adjustment.z},${r.adjustment.rotationDeg}`)
    .sort()
    .join('|')
}

export function LinkedModelsPanel({ projectId, linkOpen, onLinkOpenChange, onViewChange, onCanEditChange, fixtureReferences, displayControl, disciplineSet, headerless = false }: Props) {
  const t = useEditorTranslate()
  const linked = useEditorHost().data.linkedModels
  const disciplines = disciplineSet?.() ?? undefined
  const [data, setData] = useState<LinkedModelsResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const signatureRef = useRef<string | null>(null)
  const [replacing, setReplacing] = useState<{
    id: string
    label: string
  } | null>(null)
  const [unlinking, setUnlinking] = useState<LinkedReferenceView | null>(null)
  const [adjusting, setAdjusting] = useState<LinkedReferenceView | null>(null)
  const [identifying, setIdentifying] = useState<LinkedReferenceView | null>(null)
  const [proposing, setProposing] = useState<LinkedReferenceView | null>(null)
  const [docsOpen, setDocsOpen] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const refresh = useCallback(() => setRefreshTick((t) => t + 1), [])
  const previousRef = useRef<LinkedModelsResponse | null>(null)
  const [freshness, setFreshness] = useState<ReadonlyMap<string, LinkedFreshnessView> | null>(null)
  const [freshnessError, setFreshnessError] = useState<string | null>(null)
  const [freshTick, setFreshTick] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetchLinkedModelsFrom(linked, projectId, controller.signal)
      .then((next) => {
        for (const done of finishedUpdates(previousRef.current, next)) {
          if (done.status === 'ready') {
            toast.success(t('linkedModels.isUpdated', '{{label}} is updated (version {{version}}).', { ns: 'editor', label: done.label, version: done.versionNumber }))
          } else if (done.error) {
            toast.error(t('linkedModels.didNotUpdateWhy', "{{label}} didn't update: {{reason}}", { ns: 'editor', label: done.label, reason: done.error }))
          } else {
            toast.error(t('linkedModels.didNotUpdate', "{{label}} didn't update.", { ns: 'editor', label: done.label }))
          }
        }
        previousRef.current = next
        setData(next)
        setLoadError(null)
        onCanEditChange(next.canEdit)
        const sig = viewSignature(next)
        const previous = signatureRef.current
        signatureRef.current = sig
        if (previous !== null && previous !== sig) onViewChange()
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        console.error('[LinkedModelsPanel] load failed', err)
        setLoadError(err instanceof Error ? err.message : t('linkedModels.couldNotLoad', "Couldn't load the linked models.", { ns: 'editor' }))
      })
    return () => controller.abort()
  }, [linked, projectId, refreshTick, onViewChange, onCanEditChange, t])

  const busy = useMemo(
    () =>
      data !== null &&
      ((data.autodeskExport !== null && isInProgress(data.autodeskExport.status)) ||
        data.docsImports.some((j) => isInProgress(j.status)) ||
        data.references.some((r) => r.versions.some((v) => isInProgress(v.status)))),
    [data],
  )

  useEffect(() => {
    if (!busy) return
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [busy, refresh])

  // Asking Autodesk takes a moment, so it loads after the list, and again whenever an update finishes.
  const hasReferences = (data?.references.length ?? 0) > 0
  useEffect(() => {
    if (!hasReferences || busy) return
    const controller = new AbortController()
    fetchLinkedFreshnessFrom(linked, projectId, controller.signal)
      .then((models) => {
        setFreshness(new Map(models.map((m) => [m.referenceId, m])))
        setFreshnessError(null)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        console.error('[LinkedModelsPanel] checking for new versions failed', err)
        setFreshnessError(err instanceof Error ? err.message : t('linkedModels.couldNotCheck', "Couldn't check Autodesk Docs for new versions.", { ns: 'editor' }))
      })
    return () => controller.abort()
  }, [linked, projectId, hasReferences, busy, freshTick, t])

  const canEdit = data?.canEdit ?? false
  const exportRunning = data?.autodeskExport ? isInProgress(data.autodeskExport.status) : false
  const projectModel = data?.references.find((r) => r.isProjectModel) ?? null
  const projectModelReadyAt = projectModel?.versions.find((v) => v.id === projectModel.currentVersionId)?.readyAt ?? null
  const hostName = data?.revitModel?.name ?? t('linkedModels.ourRevitModel', 'our Revit model', { ns: 'editor' })
  // The project's Revit model is connected but has never been exported here.
  const hostNeverExported = data !== null && data.revitModel !== null && projectModel === null && data.autodeskExport === null
  const startHostExport = useCallback(async () => {
    try {
      await startAutodeskExportFrom(linked, projectId)
    } catch (err) {
      console.error('[LinkedModelsPanel] starting the export of our Revit model failed', err)
      toast.error(err instanceof Error ? err.message : t('linkedModels.couldNotBeExported', "{{host}} couldn't be exported.", { ns: 'editor', host: hostName }))
    }
    refresh()
  }, [linked, projectId, refresh, hostName, t])
  // Bring our own Revit model in by itself the first time the panel sees it
  // connected without ever having been exported (projects linked before the
  // Integrations link started the export). Once per project per mount.
  const autoStartedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!hostNeverExported || !canEdit || autoStartedFor.current === projectId) return
    autoStartedFor.current = projectId
    void startHostExport()
  }, [hostNeverExported, canEdit, projectId, startHostExport])
  const editReason = canEdit
    ? null
    : t('linkedModels.needEditAccess', "You can view linked models. Linking and unlinking need edit access to this project's model.", { ns: 'editor' })
  const docsReason = editReason ?? (data && !data.revitModel ? t('linkedModels.connectFirst', "Connect this project's Revit model first; its Autodesk Docs project is where models are picked from.", { ns: 'editor' }) : null)

  async function refreshFromDocs(ref: Pick<LinkedReferenceView, 'id' | 'label'>, mode: 'check' | 'relink') {
    try {
      const result = await refreshDocsReferenceFrom(linked, projectId, ref.id, mode)
      if (result.outcome === 'up_to_date') {
        toast.success(
          result.versionNumber !== null
            ? t('linkedModels.upToDateWithVersion', '{{label}} is up to date (Docs version {{version}}).', { ns: 'editor', label: ref.label, version: result.versionNumber })
            : t('linkedModels.upToDate', '{{label}} is up to date.', { ns: 'editor', label: ref.label }),
        )
      } else if (result.outcome === 'already_running') {
        toast(t('linkedModels.alreadyComingIn', '{{label}} is already coming in from Autodesk Docs.', { ns: 'editor', label: ref.label }))
      } else {
        toast.success(
          mode === 'check'
            ? t('linkedModels.newerVersionInDocs', 'A newer version of {{label}} is in Docs. Bringing it in…', { ns: 'editor', label: ref.label })
            : t('linkedModels.bringingInAgain', 'Bringing {{label}} in again from Autodesk Docs…', { ns: 'editor', label: ref.label }),
        )
      }
      refresh()
    } catch (err) {
      console.error(`[LinkedModelsPanel] Docs ${mode} failed`, err)
      toast.error(err instanceof Error ? err.message : t('linkedModels.docsDidNotAnswer', "Autodesk Docs didn't answer.", { ns: 'editor' }))
    }
  }

  async function updateModel(ref: Pick<LinkedReferenceView, 'id' | 'label'>, force: boolean) {
    try {
      const result = await updateFromRevitFrom(linked, projectId, ref.id, force)
      const message = updateOutcomeMessage(ref.label, result, hostName)
      if (result.outcome === 'up_to_date') toast.success(message)
      else toast(message)
      refresh()
      setFreshTick((t) => t + 1)
    } catch (err) {
      console.error('[LinkedModelsPanel] Update from Revit failed', err)
      toast.error(err instanceof Error ? err.message : t('linkedModels.couldNotBeUpdated', "{{label}} couldn't be updated.", { ns: 'editor', label: ref.label }))
    }
  }

  async function act(what: string, run: () => Promise<void>, done?: string) {
    try {
      await run()
      if (done) toast.success(done)
      refresh()
    } catch (err) {
      console.error(`[LinkedModelsPanel] ${what} failed`, err)
      toast.error(err instanceof Error ? err.message : t('linkedModels.didNotWork', "{{what}} didn't work.", { ns: 'editor', what }))
    }
  }

  return (
    <div className="flex flex-col gap-2" data-testid="linked-models-panel" data-busy={busy ? 'true' : 'false'}>
      <div className={headerless ? 'flex items-center justify-end gap-2' : 'flex items-center justify-between gap-2'}>
        {!headerless && <span className="text-sm font-medium">{t('panel.linkedModels', 'Linked models', { ns: 'editor' })}</span>}
        <div className="flex flex-wrap items-center justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" variant="outline" onClick={() => setDocsOpen(true)} disabled={docsReason !== null} data-testid="docs-picker-open">
                <CloudDownload data-icon="inline-start" />
                {t('linkedModels.addFromDocs', 'Add from Autodesk Docs…', { ns: 'editor' })}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{docsReason ?? t('linkedModels.addFromDocsWhy', "Pick the architect's (or anyone's) Revit or IFC files in this project's Autodesk Docs", { ns: 'editor' })}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" variant="outline" onClick={() => onLinkOpenChange(true)} disabled={!canEdit} data-testid="link-model-open">
                <Link2 data-icon="inline-start" />
                {t('linkedModels.link', 'Link', { ns: 'editor' })}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{editReason ?? t('linkedModels.linkWhy', 'Bring in the models linked in our Revit file, or upload an IFC file', { ns: 'editor' })}</TooltipContent>
        </Tooltip>
        </div>
      </div>

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>
            {loadError}{' '}
            <Button variant="link" size="sm" className="h-auto p-0" onClick={refresh}>
              {t('linkedModels.tryAgain', 'Try again', { ns: 'editor' })}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {data?.autodeskExport && data.autodeskExport.status !== 'done' && (
        <Alert variant={data.autodeskExport.status === 'failed' ? 'destructive' : 'default'} data-testid="linked-models-export-status">
          {isInProgress(data.autodeskExport.status) && <Spinner />}
          <AlertDescription className="text-xs">
            <span className="block font-medium">{t('linkedModels.hostThisProject', "{{host}} · this project's Revit model", { ns: 'editor', host: hostName })}</span>
            {exportStatusLabel(data.autodeskExport)}
            {data.autodeskExport.status === 'failed' && data.autodeskExport.details && (
              <ExportFailureDetails
                title={t('linkedModels.exportOf', 'Export of {{name}}', {
                  ns: 'editor',
                  name: data.revitModel?.name ?? t('linkedModels.theProjectRevitModel', "the project's Revit model", { ns: 'editor' }),
                })}
                jobId={data.autodeskExport.id}
                error={data.autodeskExport.error}
                details={data.autodeskExport.details}
              />
            )}
          </AlertDescription>
        </Alert>
      )}
      {freshnessError && (
        <Alert data-testid="linked-models-freshness-error">
          <AlertDescription className="text-xs">
            {t('linkedModels.couldNotCheckNewer', "Couldn't check Autodesk Docs for newer versions:", { ns: 'editor' })} {freshnessError}{' '}
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setFreshTick((t) => t + 1)}>
              {t('linkedModels.checkAgain', 'Check again', { ns: 'editor' })}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {data?.autodeskExport?.leftLocks && (
        <Alert variant="destructive" data-testid="linked-models-left-locks">
          <AlertDescription className="text-xs">
            <span className="block font-medium">{t('linkedModels.leftLocksTitle', 'The last export left elements borrowed in a Revit model', { ns: 'editor' })}</span>
            {t('linkedModels.leftLocksWhere', '{{count}} caught. The button is on the Autodesk Revit card: project menu → Setup → Links.', { ns: 'editor', count: data.autodeskExport.leftLocks })}
          </AlertDescription>
        </Alert>
      )}
      {data?.autodeskExport && data.autodeskExport.status === 'done' && data.autodeskExport.notice && (
        <Alert data-testid="linked-models-export-notice">
          <AlertDescription className="text-xs">{data.autodeskExport.notice}</AlertDescription>
        </Alert>
      )}
      {data?.autodeskExport && data.autodeskExport.status === 'done' && data.autodeskExport.foundNoRevitLinks && (
        <Alert data-testid="linked-models-no-revit-links">
          <AlertDescription className="text-xs">
            {t('linkedModels.noRevitLinks', "{{host}} has no Revit links, so only the project's own model came in. If the architect's model is a separate file in Autodesk Docs, use Add from Autodesk Docs; otherwise upload its IFC with Link.", {
              ns: 'editor',
              host: data.revitModel?.name ?? t('linkedModels.theRevitModel', 'The Revit model', { ns: 'editor' }),
            })}
          </AlertDescription>
        </Alert>
      )}
      {data?.autodeskExport && data.autodeskExport.status === 'done' && data.autodeskExport.missingLinks.length > 0 && (
        <Alert data-testid="linked-models-missing-links">
          <AlertDescription className="text-xs">
            <span className="block font-medium">{t('linkedModels.notBroughtIn', 'Not brought in from Revit:', { ns: 'editor' })}</span>
            {data.autodeskExport.missingLinks.map((m) => (
              <span key={m.title} className="block">
                {m.title}: {m.reason}
                {m.detail && (
                  <span className="block break-words text-muted-foreground" data-testid="linked-models-missing-detail">
                    {t('linkedModels.whatRevitReported', 'What Revit reported: {{detail}}', { ns: 'editor', detail: m.detail })}
                  </span>
                )}
              </span>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {data?.docsImports.map((job) => (
        <Alert
          key={job.jobId}
          variant={job.status === 'failed' ? 'destructive' : 'default'}
          data-testid="docs-import"
          data-status={job.status}
        >
          {isInProgress(job.status) && <Spinner />}
          <AlertDescription className="text-xs">
            <span className="block font-medium">{t('linkedModels.docsImportHeading', '{{label}} · from Autodesk Docs', { ns: 'editor', label: job.label })}</span>
            {job.status === 'done' && job.notice ? <span data-testid="docs-import-notice">{job.notice}</span> : docsImportStatusLabel(job)}
            {job.status === 'failed' && job.details && (
              <ExportFailureDetails
                title={t('linkedModels.docsExportOf', '{{label}} ({{file}}) from Autodesk Docs', { ns: 'editor', label: job.label, file: job.fileName })}
                jobId={job.jobId}
                error={job.error}
                details={job.details}
              />
            )}
            {job.status === 'failed' && canEdit && (
              <Button
                size="sm"
                variant="outline"
                className="mt-1 h-7 self-start"
                onClick={() =>
                  void (job.referenceId
                    ? refreshFromDocs({ id: job.referenceId, label: job.label }, 'relink')
                    : act(
                        t('linkedModels.tryingAgainWhat', 'Trying again', { ns: 'editor' }),
                        async () => {
                          await addDocsItemsFrom(linked, projectId, [{ itemId: job.itemId, label: job.label, discipline: job.discipline }])
                        },
                        t('linkedModels.bringingInAgain', 'Bringing {{label}} in again from Autodesk Docs…', { ns: 'editor', label: job.label }),
                      ))
                }
              >
                <RefreshCw data-icon="inline-start" />
                {t('linkedModels.tryAgain', 'Try again', { ns: 'editor' })}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ))}

      <ItemGroup className="gap-1">
        {data === null && !loadError && (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner className="size-3" />
            {t('linkedModels.loading', 'Loading…', { ns: 'editor' })}
          </span>
        )}
        {data?.references.length === 0 && fixtureReferences.length === 0 && (
          <span className="text-xs text-muted-foreground" data-testid="linked-models-empty">
            {t('linkedModels.noneYet', "None linked yet. Linking is optional: start modeling now and bring in the architect's model with Link whenever you have it.", { ns: 'editor' })}
          </span>
        )}
        {data?.revitModel && projectModel === null && (
          <Item size="sm" variant="outline" data-testid="project-model-pending" data-export={data.autodeskExport?.status ?? 'none'}>
            <ItemContent>
              <ItemTitle className="text-xs">{data.revitModel.name}</ItemTitle>
              <ItemDescription className="text-xs">
                {t('linkedModels.thisProjectRevitModel', "This project's Revit model", { ns: 'editor' })}
                {exportRunning ? (
                  <span className="flex items-center gap-1">
                    <Spinner className="size-3" />
                    {t('linkedModels.comingInFromRevit', 'Coming in from Revit (usually 2–5 minutes)…', { ns: 'editor' })}
                  </span>
                ) : data.autodeskExport?.status === 'failed' ? (
                  <span className="block text-destructive">{t('linkedModels.notInYet', "Not in yet: the last export didn't finish (details above).", { ns: 'editor' })}</span>
                ) : data.autodeskExport?.status === 'done' ? (
                  <span className="block">{t('linkedModels.finishedWithoutIt', 'The last export finished without bringing it in. Export it again.', { ns: 'editor' })}</span>
                ) : (
                  <span className="block">{t('linkedModels.connectedNotIn', 'Connected but not in the Building Model yet.', { ns: 'editor' })}</span>
                )}
              </ItemDescription>
              {canEdit && !exportRunning && (
                <Button size="sm" className="mt-1 h-7 self-start" data-testid="project-model-export" onClick={() => void startHostExport()}>
                  <RefreshCw data-icon="inline-start" />
                  {data.autodeskExport ? t('linkedModels.exportItAgain', 'Export it again', { ns: 'editor' }) : t('linkedModels.bringItIn', 'Bring it in', { ns: 'editor' })}
                </Button>
              )}
              {!canEdit && !exportRunning && (
                <span className="text-xs text-muted-foreground">{t('linkedModels.needsEditAccess', "Someone with edit access to this project's model can bring it in.", { ns: 'editor' })}</span>
              )}
            </ItemContent>
          </Item>
        )}
        {fixtureReferences.map((ref) => (
          <Item key={ref.id} size="sm" variant="outline" data-testid="fixture-model">
            <ItemContent>
              <ItemTitle className="text-xs">{ref.label}</ItemTitle>
              {displayControl?.(ref)}
              <ItemDescription className="text-xs">{t('linkedModels.fixtureFrom', "From this project's test export · read-only here", { ns: 'editor' })}</ItemDescription>
            </ItemContent>
          </Item>
        ))}
        {data?.references.map((ref) => {
          const latest = ref.versions[0] ?? null
          const current = ref.versions.find((v) => v.id === ref.currentVersionId) ?? null
          const shown = latest && !isUsable(latest) ? latest : current
          const readyVersions = ref.versions.filter(isUsable)
          const alignment = current ? alignmentState(current, ref) : null
          const needsAttention = alignment === 'needs_alignment' || alignment === 'review'
          const fromDocs = ref.source === 'autodesk_docs_item'
          const converting = ref.versions.some((v) => isInProgress(v.status))
          // Our model came in again after this placement, so what it was missing may be there now.
          const hostNewer = projectModelReadyAt !== null && current?.readyAt != null && Date.parse(projectModelReadyAt) > Date.parse(current.readyAt)
          const waitingOnOurModel = fromDocs && current?.alignmentRemedy === 'reexport_host' && !hostNewer
          const offerLineUp = fromDocs && current !== null && (needsAttention || current.placementBasis === 'file_origin') && !waitingOnOurModel
          const kind = refreshKindOfView(ref)
          const fresh = freshness?.get(ref.id) ?? null
          const updating = converting || (exportRunning && (kind === 'project_model' || kind === 'revit_link'))
          return (
            <Item
              key={ref.id}
              size="sm"
              variant="outline"
              data-testid="linked-model"
              data-status={shown?.status ?? 'none'}
              data-alignment={alignment ?? 'none'}
            >
              <ItemContent>
                <ItemTitle className="text-xs">{ref.label}</ItemTitle>
                {current && isUsable(current) && displayControl?.(ref)}
                <ItemDescription className="text-xs">
                  {ref.isProjectModel
                    ? t('linkedModels.thisProjectRevitModel', "This project's Revit model", { ns: 'editor' })
                    : linkedDisciplinesLabel(disciplinesOf(ref), disciplines)}
                  {!ref.isProjectModel && linkedContributorLabel(ref.contributor ?? null)
                    ? t('linkedModels.fromContributor', ' · from {{who}}', { ns: 'editor', who: linkedContributorLabel(ref.contributor ?? null) ?? '' })
                    : ''}
                  {current ? t('linkedModels.versionNumber', ' · version {{number}}', { ns: 'editor', number: current.number }) : ''}
                  {ref.docsItem && (
                    <span className="block" data-testid="linked-model-docs">
                      {t('linkedModels.fromDocs', 'From Autodesk Docs · {{file}}', { ns: 'editor', file: ref.docsItem.fileName })}
                      {ref.docsItem.versionNumber !== null
                        ? t('linkedModels.docsVersionNumber', ' · Docs version {{version}}', { ns: 'editor', version: ref.docsItem.versionNumber })
                        : ''}
                    </span>
                  )}
                  {current?.placementBasis && !ref.isProjectModel && <span className="block">{PLACEMENT_BASIS_LABEL[current.placementBasis]}</span>}
                  {alignment && (
                    <span className={needsAttention ? 'block font-medium text-warning-700' : 'block'} data-testid="linked-model-alignment">
                      {ALIGNMENT_LABEL[alignment]}
                      {needsAttention && current?.alignmentNote ? `: ${current.alignmentNote}` : ''}
                    </span>
                  )}
                  {current && (
                    <span className="block">
                      {t('linkedModels.fromWhoAndFile', 'From {{who}} · {{file}}', {
                        ns: 'editor',
                        who: current.suppliedBy.organization
                          ? t('linkedModels.orgViaPerson', '{{organization}} (via {{name}})', { ns: 'editor', organization: current.suppliedBy.organization, name: current.suppliedBy.name })
                          : current.suppliedBy.name,
                        file: current.originalFileName,
                      })}
                    </span>
                  )}
                  {shown && !isUsable(shown) && (
                    <span className={shown.status === 'failed' ? 'block text-destructive' : 'flex items-center gap-1'}>
                      {isInProgress(shown.status) && <Spinner className="size-3" />}
                      {versionStatusLabel(shown)}
                    </span>
                  )}
                  {fresh && (
                    <span
                      className={fresh.state === 'newer_available' ? 'block font-medium text-warning-700' : 'block'}
                      data-testid="linked-model-freshness"
                      data-state={fresh.state}
                    >
                      {freshnessLabel(fresh, hostName)}
                    </span>
                  )}
                  {!fresh && kind !== 'upload' && freshness === null && !freshnessError && (
                    <span className="block text-muted-foreground">{t('linkedModels.checkingDocs', 'Checking Autodesk Docs for a newer version…', { ns: 'editor' })}</span>
                  )}
                </ItemDescription>
                {canEdit && kind !== 'upload' && (
                  <Button
                    size="sm"
                    variant={fresh?.state === 'newer_available' || fresh?.state === 'never_recorded' ? 'default' : 'outline'}
                    className="mt-1 h-7 self-start"
                    disabled={updating}
                    data-testid="linked-model-update"
                    title={
                      kind === 'docs_item'
                        ? t('linkedModels.bringNewest', "Brings in {{label}}'s newest version from Autodesk Docs", { ns: 'editor', label: ref.label })
                        : t('linkedModels.exportsFromRevit', 'Exports {{host}} from Revit; it and every model linked in it update together', { ns: 'editor', host: hostName })
                    }
                    onClick={() => void updateModel(ref, false)}
                  >
                    {updating ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
                    {updating ? t('linkedModels.updating', 'Updating…', { ns: 'editor' }) : t('linkedModels.updateFromRevit', 'Update from Revit', { ns: 'editor' })}
                  </Button>
                )}
                {canEdit && (waitingOnOurModel || offerLineUp || needsAttention) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {waitingOnOurModel && exportRunning && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="linked-model-waiting-host">
                        <Spinner className="size-3" />
                        {t('linkedModels.waitingForHost', 'Waiting for {{host}} to finish exporting; then choose Line up with the project model.', { ns: 'editor', host: hostName })}
                      </span>
                    )}
                    {waitingOnOurModel && !exportRunning && (
                      <Button
                        size="sm"
                        className="h-7"
                        data-testid="linked-model-reexport-host"
                        title={t('linkedModels.exportsHostNotLabel', "Exports {{host}} (this project's model), not {{label}}", { ns: 'editor', host: hostName, label: ref.label })}
                        onClick={() =>
                          void act(
                            t('linkedModels.reexportingWhat', 'Re-exporting our Revit model', { ns: 'editor' }),
                            () => startAutodeskExportFrom(linked, projectId),
                            t('linkedModels.reexportingDone', "Exporting {{host}}… When it's in, choose Line up with the project model on {{label}}.", { ns: 'editor', host: hostName, label: ref.label }),
                          )
                        }
                      >
                        <RefreshCw data-icon="inline-start" />
                        {t('linkedModels.reexportToLineUp', 'Re-export {{host}} to line this up', { ns: 'editor', host: hostName })}
                      </Button>
                    )}
                    {offerLineUp && (
                      <Button
                        size="sm"
                        className="h-7"
                        disabled={converting}
                        data-testid="linked-model-line-up"
                        onClick={() =>
                          void act(
                            t('linkedModels.liningUpWhat', 'Lining up', { ns: 'editor' }),
                            () => lineUpDocsReferenceFrom(linked, projectId, ref.id),
                            t('linkedModels.liningUpDone', 'Lining {{label}} up with the project model…', { ns: 'editor', label: ref.label }),
                          )
                        }
                      >
                        {converting ? <Spinner data-icon="inline-start" /> : <Link2 data-icon="inline-start" />}
                        {converting ? t('linkedModels.liningUp', 'Lining up…', { ns: 'editor' }) : t('linkedModels.lineUp', 'Line up with the project model', { ns: 'editor' })}
                      </Button>
                    )}
                    {needsAttention && (
                      <Button size="sm" variant="outline" className="h-7" onClick={() => setAdjusting(ref)}>
                        <Move data-icon="inline-start" />
                        {t('linkedModels.adjustPosition', 'Adjust position', { ns: 'editor' })}
                      </Button>
                    )}
                  </div>
                )}
                {shown?.status === 'abandoned' && canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1 h-7 self-start"
                    onClick={() => {
                      setReplacing({ id: ref.id, label: ref.label })
                      onLinkOpenChange(true)
                    }}
                  >
                    <Upload data-icon="inline-start" />
                    {t('linkedModels.uploadAgain', 'Upload again', { ns: 'editor' })}
                  </Button>
                )}
                {shown?.status === 'failed' && canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1 h-7 self-start"
                    onClick={() =>
                      void act(
                        t('linkedModels.tryingAgainWhat', 'Trying again', { ns: 'editor' }),
                        () => retryVersionFrom(linked, projectId, shown.id),
                        t('linkedModels.tryingConversionAgain', 'Trying the conversion again…', { ns: 'editor' }),
                      )
                    }
                  >
                    <RefreshCw data-icon="inline-start" />
                    {t('linkedModels.tryAgain', 'Try again', { ns: 'editor' })}
                  </Button>
                )}
              </ItemContent>
              <ItemActions>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7" aria-label={t('linkedModels.optionsFor', 'Options for {{label}}', { ns: 'editor', label: ref.label })}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel className="text-xs">{ref.label}</DropdownMenuLabel>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger disabled={readyVersions.length < 2 || !canEdit}>
                        {readyVersions.length < 2
                          ? t('linkedModels.onlyOneVersion', 'Only one version so far', { ns: 'editor' })
                          : t('linkedModels.showVersion', 'Show version', { ns: 'editor' })}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup
                          value={ref.currentVersionId ?? ''}
                          onValueChange={(versionId) =>
                            void act(
                              t('linkedModels.switchingVersionWhat', 'Switching version', { ns: 'editor' }),
                              () =>
                                updateLinkedReferenceFrom(linked, projectId, ref.id, {
                                  currentVersionId: versionId,
                                }),
                              t('linkedModels.switchedVersion', 'Switched version', { ns: 'editor' }),
                            )
                          }
                        >
                          {readyVersions.map((v) => (
                            <DropdownMenuRadioItem key={v.id} value={v.id}>
                              {t('linkedModels.versionOption', 'Version {{number}} · {{date}} · {{file}}', {
                                ns: 'editor',
                                number: v.number,
                                date: new Date(v.createdAt).toLocaleDateString(),
                                file: v.originalFileName,
                              })}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuItem disabled={!canEdit || !current} onSelect={() => setAdjusting(ref)}>
                      {t('linkedModels.adjustPositionEllipsis', 'Adjust position…', { ns: 'editor' })}
                    </DropdownMenuItem>
                    {!ref.isProjectModel && (
                      <DropdownMenuItem disabled={!canEdit} onSelect={() => setIdentifying(ref)} data-testid="linked-model-identity">
                        {t('linkedModels.identity', 'What it shows and who sent it…', { ns: 'editor' })}
                      </DropdownMenuItem>
                    )}
                    {!ref.isProjectModel && (
                      <DropdownMenuItem disabled={current?.status !== 'ready'} onSelect={() => setProposing(ref)} data-testid="linked-model-propose">
                        {current?.status === 'ready'
                          ? t('linkedModels.propose', 'Propose changes to this model…', { ns: 'editor' })
                          : t('linkedModels.proposeWhenReady', 'Propose changes to this model (once this version is ready)', { ns: 'editor' })}
                      </DropdownMenuItem>
                    )}
                    {ref.source === 'autodesk_docs_item' ? (
                      <>
                        <DropdownMenuItem
                          disabled={!canEdit || !current || converting}
                          onSelect={() =>
                            void act(
                              t('linkedModels.liningUpWhat', 'Lining up', { ns: 'editor' }),
                              () => lineUpDocsReferenceFrom(linked, projectId, ref.id),
                              t('linkedModels.liningUpDone', 'Lining {{label}} up with the project model…', { ns: 'editor', label: ref.label }),
                            )
                          }
                        >
                          {converting ? t('linkedModels.liningUp', 'Lining up…', { ns: 'editor' }) : t('linkedModels.lineUp', 'Line up with the project model', { ns: 'editor' })}
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={!canEdit} onSelect={() => void refreshFromDocs(ref, 'relink')}>
                          {t('linkedModels.exportAgainFromDocs', 'Export again from Autodesk Docs (even if nothing changed)', { ns: 'editor' })}
                        </DropdownMenuItem>
                      </>
                    ) : ref.source === 'autodesk_docs' ? (
                      <DropdownMenuItem disabled={!canEdit || updating} onSelect={() => void updateModel(ref, true)} data-testid="linked-model-force-update">
                        {t('linkedModels.exportHostAgain', 'Export {{host}} again (even if nothing changed)', { ns: 'editor', host: hostName })}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        disabled={!canEdit}
                        onSelect={() => {
                          setReplacing({ id: ref.id, label: ref.label })
                          onLinkOpenChange(true)
                        }}
                      >
                        {t('linkedModels.uploadNewVersion', 'Upload a new version…', { ns: 'editor' })}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" disabled={!canEdit} onSelect={() => setUnlinking(ref)}>
                      {t('linkedModels.unlinkEllipsis', 'Unlink…', { ns: 'editor' })}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </ItemActions>
            </Item>
          )
        })}
      </ItemGroup>

      <LinkModelDialog
        key={linkOpen ? `open-${replacing?.id ?? 'new'}-${data?.revitModel ? 'revit' : 'none'}` : 'closed'}
        projectId={projectId}
        open={linkOpen}
        onOpenChange={(open) => {
          onLinkOpenChange(open)
          if (!open) setReplacing(null)
        }}
        revitModel={data?.revitModel ?? null}
        autodeskExport={data?.autodeskExport ?? null}
        replacing={replacing}
        onQueued={refresh}
        disciplineSet={disciplines}
        onOpenDocsPicker={
          docsReason === null
            ? () => {
                onLinkOpenChange(false)
                setDocsOpen(true)
              }
            : null
        }
      />

      <DocsPickerDialog
        key={docsOpen ? 'docs-open' : 'docs-closed'}
        projectId={projectId}
        open={docsOpen}
        onOpenChange={setDocsOpen}
        revitModelName={data?.revitModel?.name ?? null}
        onQueued={refresh}
        disciplineSet={disciplines}
      />

      <AlertDialog open={unlinking !== null} onOpenChange={(open) => !open && setUnlinking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('linkedModels.unlinkQuestion', 'Unlink {{label}}?', { ns: 'editor', label: unlinking?.label ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('linkedModels.unlinkBody', "It disappears from this project's Building Model for everyone. Its files and versions are kept, so linking it again is quick.", { ns: 'editor' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('linkedModels.keepIt', 'Keep it', { ns: 'editor' })}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const target = unlinking
                if (target) {
                  void act(
                    t('linkedModels.unlinkingWhat', 'Unlinking', { ns: 'editor' }),
                    () => unlinkReferenceFrom(linked, projectId, target.id),
                    t('linkedModels.unlinkedDone', '{{label}} unlinked', { ns: 'editor', label: target.label }),
                  )
                }
              }}
            >
              {t('linkedModels.unlink', 'Unlink', { ns: 'editor' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdjustPositionDialog
        reference={adjusting}
        onClose={() => setAdjusting(null)}
        onSave={(adjustment) => {
          const target = adjusting
          if (!target) return
          setAdjusting(null)
          void act(
            t('linkedModels.savingPositionWhat', 'Saving the position', { ns: 'editor' }),
            () => updateLinkedReferenceFrom(linked, projectId, target.id, { adjustment }),
            t('linkedModels.positionSaved', 'Position saved', { ns: 'editor' }),
          )
        }}
      />
      <LinkedIdentityDialog projectId={projectId} reference={identifying} set={disciplines} onClose={() => setIdentifying(null)} onSaved={refresh} />
      <ProposeChangesDialog projectId={projectId} reference={proposing} set={disciplines} onClose={() => setProposing(null)} />
    </div>
  )
}

function AdjustPositionDialog({
  reference,
  onClose,
  onSave,
}: {
  reference: LinkedReferenceView | null
  onClose(): void
  onSave(adjustment: PlacementAdjustment): void
}) {
  return (
    <Dialog open={reference !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">{reference && <AdjustPositionForm key={reference.id} reference={reference} onSave={onSave} />}</DialogContent>
    </Dialog>
  )
}

function AdjustPositionForm({ reference, onSave }: { reference: LinkedReferenceView; onSave(adjustment: PlacementAdjustment): void }) {
  const t = useEditorTranslate()
  const a = reference.adjustment
  const [values, setValues] = useState({
    x: String(a.x),
    y: String(a.y),
    z: String(a.z),
    rotationDeg: String(a.rotationDeg),
  })
  const parsed = {
    x: Number(values.x),
    y: Number(values.y),
    z: Number(values.z),
    rotationDeg: Number(values.rotationDeg),
  }
  const invalid = Object.values(parsed).some((v) => !Number.isFinite(v)) || Math.abs(parsed.rotationDeg) >= 360
  const fields: { key: keyof typeof values; label: string; hint: string }[] = [
    {
      key: 'x',
      label: t('linkedModels.moveEastM', 'Move east (m)', { ns: 'editor' }),
      hint: t('linkedModels.moveEastWhyM', "Along the model's east axis; negative moves west", { ns: 'editor' }),
    },
    {
      key: 'y',
      label: t('linkedModels.moveNorthM', 'Move north (m)', { ns: 'editor' }),
      hint: t('linkedModels.moveNorthWhyM', "Along the model's north axis; negative moves south", { ns: 'editor' }),
    },
    { key: 'z', label: t('linkedModels.moveUpM', 'Move up (m)', { ns: 'editor' }), hint: t('linkedModels.moveDownWhyM', 'Negative moves down', { ns: 'editor' }) },
    {
      key: 'rotationDeg',
      label: t('linkedModels.turnDegrees', 'Turn (degrees)', { ns: 'editor' }),
      hint: t('linkedModels.turnWhy', "Counter-clockwise seen from above, about where the file's own origin sits; less than 360", { ns: 'editor' }),
    },
  ]
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('linkedModels.adjustTitle', 'Adjust {{label}}', { ns: 'editor', label: reference.label })}</DialogTitle>
        <DialogDescription>
          {reference.isProjectModel
            ? t('linkedModels.adjustProjectModel', "This is the project's own Revit model; its links are placed around it. Only adjust it if it doesn't line up with the new ductwork.", { ns: 'editor' })
            : reference.source === 'autodesk_docs' || (reference.source === 'autodesk_docs_item' && reference.versions[0]?.placementBasis === 'revit_link')
              ? t('linkedModels.adjustRevitLink', "This model already sits where it's linked in Revit. Only adjust it if it still doesn't line up.", { ns: 'editor' })
              : reference.source === 'autodesk_docs_item' && reference.versions[0]?.placementBasis === 'revit_shared_coordinates'
                ? t('linkedModels.adjustSharedCoordinates', "This model is placed by Revit shared coordinates. Only adjust it if the architect's coordinates don't match ours.", { ns: 'editor' })
                : t('linkedModels.adjustUploaded', 'Line the uploaded model up with the building. Set everything to 0 to put it back where the file places it.', { ns: 'editor' })}
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <Field key={f.key}>
            <FieldLabel htmlFor={`adjust-${f.key}`}>{f.label}</FieldLabel>
            <Input
              id={`adjust-${f.key}`}
              inputMode="decimal"
              value={values[f.key]}
              onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
            <FieldDescription className="text-xs">{f.hint}</FieldDescription>
          </Field>
        ))}
      </FieldGroup>
      <DialogFooter>
        <Button variant="outline" onClick={() => setValues({ x: '0', y: '0', z: '0', rotationDeg: '0' })}>
          {t('linkedModels.resetToZero', 'Reset to 0', { ns: 'editor' })}
        </Button>
        <Button
          onClick={() => onSave(parsed)}
          disabled={invalid}
          title={invalid ? t('linkedModels.enterNumbersOnly', 'Enter numbers only; the turn must be less than 360 degrees', { ns: 'editor' }) : undefined}
        >
          {t('linkedModels.savePosition', 'Save position', { ns: 'editor' })}
        </Button>
      </DialogFooter>
    </>
  )
}
