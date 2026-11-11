'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, FileBox, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Spinner } from '../../ui/spinner'
import type { IfcExportView } from '../../contracts/building-model/ifc-export-contract'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { fetchIfcExportsFrom, ifcExportDownloadUrlFrom, startIfcExportFrom } from './ifc-export-client'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'

/**
 * Building Model › Sheets › Issue › Export IFC. Writes the last saved model
 * as an IFC 4.3 file (spaces, zones, systems, circuits, equipment with its
 * parameters; planned equipment without a body) and lists this project's
 * exports with their state: exporting, ready to download, or failed with
 * the reason and Retry.
 */

/** An export's status in words — asked for in the language being drawn. */
function statusWord(status: IfcExportView['status'], t: Translate = englishOnly): string {
  switch (status) {
    case 'exporting':
      return t('ifcExport.statusExporting', 'Exporting', { ns: 'editor' })
    case 'ready':
      return t('ifcExport.statusReady', 'Ready', { ns: 'editor' })
    case 'failed':
      return t('ifcExport.statusFailed', 'Failed', { ns: 'editor' })
  }
}

function sizeWords(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function whenWords(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function summary(e: IfcExportView, t: Translate = englishOnly): string {
  const parts = [e.revision !== null ? `Rev ${e.revision}` : null, e.byName, whenWords(e.startedAt)]
  const c = e.counts
  if (c)
    parts.push(
      t('ifcExport.counts', '{{spaces}} spaces, {{systems}} systems, {{elements}} elements ({{planned}} planned)', { ns: 'editor', spaces: c.spaces, systems: c.systems, elements: c.elements, planned: c.planned }),
    )
  return parts.filter((p): p is string => !!p).join(' · ')
}

export function IfcExportDialog({ projectId, modelId, pendingEdits, onClose }: {
  projectId: string
  /** Null when no model server serves this project. */
  modelId: string | null
  /** Edits not saved yet: the export writes the last saved revision. */
  pendingEdits: number
  onClose: () => void
}) {
  const t = useEditorTranslate()
  const ifcExport = useEditorHost().data.ifcExport
  const [exports, setExports] = useState<IfcExportView[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  const fetchList = useCallback(
    () =>
      fetchIfcExportsFrom(ifcExport, projectId, t).then(
        (list) => ({ list, error: null }),
        (err: unknown) => {
          console.error('[IfcExportDialog] loading exports failed', err)
          return { list: null, error: err instanceof Error ? err.message : t('ifcExport.listFailed', 'This project\'s IFC exports couldn\'t be loaded. Try again.', { ns: 'editor' }) }
        },
      ),
    [ifcExport, projectId],
  )

  const load = async () => {
    setLoadError(null)
    const got = await fetchList()
    if (got.list) setExports(got.list)
    setLoadError(got.error)
  }

  useEffect(() => {
    let live = true
    void fetchList().then((got) => {
      if (!live) return
      if (got.list) setExports(got.list)
      setLoadError(got.error)
    })
    return () => {
      live = false
    }
  }, [fetchList])

  const run = async () => {
    if (!modelId) return
    setRunning(true)
    try {
      const done = await startIfcExportFrom(ifcExport, projectId, modelId, t)
      setExports((list) => [done, ...(list ?? []).filter((e) => e.jobId !== done.jobId)])
      if (done.status === 'ready')
        toast.success(
          done.file
            ? t('ifcExport.readyNamed', 'IFC file ready: {{name}}.', { ns: 'editor', name: done.file.name })
            : t('ifcExport.ready', 'IFC file ready.', { ns: 'editor' }),
        )
      else toast.error(done.error ?? t('ifcExport.exportFailed', 'The IFC export didn\'t finish.', { ns: 'editor' }))
    } catch (err) {
      console.error('[IfcExportDialog] export failed', err)
      toast.error(err instanceof Error ? err.message : t('ifcExport.startFailed', 'The IFC export couldn\'t start. Try again.', { ns: 'editor' }))
      await load()
    } finally {
      setRunning(false)
    }
  }

  const download = async (e: IfcExportView) => {
    if (!e.file) return
    setDownloading(e.jobId)
    try {
      window.open(await ifcExportDownloadUrlFrom(ifcExport, projectId, e.file.artifactId, t), '_blank', 'noopener,noreferrer')
    } catch (err) {
      console.error('[IfcExportDialog] download link failed', err)
      toast.error(err instanceof Error ? err.message : t('ifcExport.linkFailed', 'The download link couldn\'t be made. Try again.', { ns: 'editor' }))
    } finally {
      setDownloading(null)
    }
  }

  const exportDisabled = !modelId
    ? t('ifcExport.notConnected', "This project's model server isn't connected, so there is no saved model to export. Reload, or ask an admin to connect it.", { ns: 'editor' })
    : running
      ? t('ifcExport.anExportRunning', 'An export is running.', { ns: 'editor' })
      : null
  const anyRunning = running || (exports ?? []).some((e) => e.status === 'exporting')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl" data-testid="ifc-export-dialog">
        <DialogHeader>
          <DialogTitle>{t('ifcExport.exportIfc', 'Export IFC', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>
            {t(
              'ifcExport.descriptionLong',
              "An IFC 4.3 file of the last saved model for Revit, Navisworks and contractors: levels, spaces, zones, systems and circuits, and every element with its parameters. Planned equipment is listed without a body. Exporting again keeps every element's IFC id.",
              { ns: 'editor' },
            )}
          </DialogDescription>
        </DialogHeader>
        {pendingEdits > 0 && (
          <p className="text-xs text-muted-foreground">
            {pendingEdits === 1
              ? t('ifcExport.oneEditUnsaved', "{{count}} of your changes isn't saved yet; the export writes the model as last saved.", { ns: 'editor', count: pendingEdits })
              : t('ifcExport.editsUnsaved', "{{count}} of your changes aren't saved yet; the export writes the model as last saved.", { ns: 'editor', count: pendingEdits })}
          </p>
        )}
        {loadError && (
          <Alert variant="destructive">
            <AlertTitle>{t('ifcExport.loadFailed', 'Couldn\'t load the exports', { ns: 'editor' })}</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              {loadError}
              <Button variant="outline" size="sm" className="self-start" onClick={() => void load()}>
                <RotateCcw data-icon="inline-start" />
                {t('ifcExport.tryAgain', 'Try again', { ns: 'editor' })}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {exports === null && !loadError ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            {t('ifcExport.loading', 'Loading exports…', { ns: 'editor' })}
          </div>
        ) : exports && exports.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileBox />
              </EmptyMedia>
              <EmptyTitle>{t('ifcExport.noneYet', 'No IFC exports yet', { ns: 'editor' })}</EmptyTitle>
              <EmptyDescription>{t('ifcExport.noneYetWhy', 'Export IFC writes the first one; it is kept here for everyone on the project.', { ns: 'editor' })}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : exports ? (
          <ItemGroup className="max-h-80 overflow-y-auto" data-testid="ifc-export-list">
            {exports.map((e) => (
              <Item key={e.jobId} variant="outline" size="sm" data-testid="ifc-export-row" data-status={e.status}>
                <ItemContent>
                  <ItemTitle>
                    {e.file?.name ?? (e.status === 'exporting' ? t('ifcExport.writing', 'Writing the file…', { ns: 'editor' }) : t('ifcExport.noFile', 'No file', { ns: 'editor' }))}
                    <Badge variant={e.status === 'failed' ? 'destructive' : e.status === 'ready' ? 'secondary' : 'outline'}>{statusWord(e.status, t)}</Badge>
                  </ItemTitle>
                  <ItemDescription>
                    {e.status === 'failed'
                      ? e.error
                      : [
                          summary(e, t),
                          e.file ? sizeWords(e.file.bytes) : null,
                          e.warnings > 0 ? t('ifcExport.warnings', '{{count}} written as generic or adjusted', { ns: 'editor', count: e.warnings }) : null,
                        ]
                          .filter((part): part is string => part !== null)
                          .join(' · ')}
                  </ItemDescription>
                  {e.status === 'ready' && e.workspace && (
                    <ItemDescription data-testid="ifc-export-files-status">
                      {e.workspace.status === 'filed'
                        ? t('ifcExport.filedAs', "Also in the project's Files › {{folder}} as {{name}}", { ns: 'editor', folder: e.workspace.folder, name: e.workspace.name })
                        : t('ifcExport.notFiled', "Not added to the project's Files: {{why}}. Download it here instead.", { ns: 'editor', why: e.workspace.reason })}
                    </ItemDescription>
                  )}
                </ItemContent>
                <ItemActions>
                  {e.status === 'exporting' && <Spinner />}
                  {e.status === 'ready' && e.file && (
                    <Button variant="outline" size="sm" onClick={() => void download(e)} disabled={downloading !== null} data-testid="ifc-export-download">
                      {downloading === e.jobId ? <Spinner data-icon="inline-start" /> : <Download data-icon="inline-start" />}
                      Download
                    </Button>
                  )}
                  {e.status === 'failed' && (
                    <Button variant="outline" size="sm" onClick={() => void run()} disabled={exportDisabled !== null || anyRunning} title={exportDisabled ?? (anyRunning ? t('ifcExport.anExportRunning', 'An export is running.', { ns: 'editor' }) : undefined)} data-testid="ifc-export-retry">
                      <RotateCcw data-icon="inline-start" />
                      {t('ifcExport.retry', 'Retry', { ns: 'editor' })}
                    </Button>
                  )}
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        ) : null}
        {exportDisabled && !running && <p className="text-xs text-muted-foreground">{exportDisabled}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('ifcExport.close', 'Close', { ns: 'editor' })}
          </Button>
          <Button onClick={() => void run()} disabled={exportDisabled !== null || anyRunning} data-testid="ifc-export-start">
            {running ? <Spinner data-icon="inline-start" /> : <FileBox data-icon="inline-start" />}
            {running ? t('ifcExport.exporting', 'Exporting…', { ns: 'editor' }) : t('ifcExport.title', 'Export IFC', { ns: 'editor' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
