'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { Button } from '../ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import {
  exportFailureElementLabel,
  exportFailureSupportText,
  type ExportFailureDetailsView,
} from '../contracts/building-model/linked-contract'
import { useEditorTranslate } from './i18n/translate'

interface Props {
  /** What failed, as the card names it ("Sample Warehouse · from Autodesk Docs"). */
  title: string
  jobId: string
  error: string | null
  details: ExportFailureDetailsView
}

/** The exact reason behind a failed export, from Autodesk's job report, under the plain-language line. */
export function ExportFailureDetails({ title, jobId, error, details }: Props) {
  const t = useEditorTranslate()
  const [open, setOpen] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(exportFailureSupportText({ title, jobId, error }, details))
      toast.success(t('exportFailure.copied', 'Copied the failure details for support.', { ns: 'editor' }))
    } catch (err) {
      console.error('[ExportFailureDetails] copy failed', err)
      toast.error(t('exportFailure.copyFailed', "Couldn't copy to the clipboard. Select the details and copy them by hand.", { ns: 'editor' }))
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-1" data-testid="export-failure-details">
      <div className="flex flex-wrap items-center gap-1">
        <CollapsibleTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 px-1" data-testid="export-failure-details-toggle">
            {open ? <ChevronDown data-icon="inline-start" /> : <ChevronRight data-icon="inline-start" />}
            {open ? t('exportFailure.hideDetails', 'Hide details', { ns: 'editor' }) : t('exportFailure.showDetails', 'Show details', { ns: 'editor' })}
          </Button>
        </CollapsibleTrigger>
        <Button size="sm" variant="ghost" className="h-7 px-1" onClick={() => void copy()} data-testid="export-failure-copy">
          <Copy data-icon="inline-start" />
          {t('exportFailure.copyForSupport', 'Copy for support', { ns: 'editor' })}
        </Button>
      </div>
      <CollapsibleContent className="flex flex-col gap-1 break-words pt-1" data-testid="export-failure-details-body">
        {!details.recorded && (
          <span>
            {t(
              'exportFailure.reportNotKept',
              "Autodesk's report wasn't kept for this attempt (it ran before reports were stored). Try again to record one.",
              { ns: 'editor' },
            )}
          </span>
        )}
        {details.recorded && (
          <>
            {details.exception && (
              <span data-testid="export-failure-exception">
                <span className="font-medium">{t('exportFailure.whatRevitReported', 'What Revit reported:', { ns: 'editor' })}</span> {details.exception}
              </span>
            )}
            {details.crash && <span data-testid="export-failure-crash">{details.crash}</span>}
            {!details.exception && !details.crash && (
              <span>{t('exportFailure.noExceptionNamed', "Autodesk's report names no exception for this failure. Copy the details for support.", { ns: 'editor' })}</span>
            )}
            {details.step && (
              <span>
                <span className="font-medium">{t('exportFailure.step', 'Step:', { ns: 'editor' })}</span> {details.step}
              </span>
            )}
            {details.elements.length > 0 && (
              <span className="flex flex-col" data-testid="export-failure-elements">
                <span className="font-medium">{t('exportFailure.elementsNamed', 'Elements Revit named:', { ns: 'editor' })}</span>
                {details.elements.map((e) => (
                  <span key={e.id}>{exportFailureElementLabel(e)}</span>
                ))}
              </span>
            )}
            {details.skippedElements.length > 0 && (
              <span className="flex flex-col" data-testid="export-failure-skipped">
                <span className="font-medium">{t('exportFailure.leftOut', 'Left out to finish the export:', { ns: 'editor' })}</span>
                {details.skippedElements.map((e) => (
                  <span key={e.id}>{exportFailureElementLabel(e)}</span>
                ))}
              </span>
            )}
            {!details.reportFetched && (
              <span>
                {t('exportFailure.reportNotDownloaded', "Autodesk's report couldn't be downloaded: {{reason}}.", {
                  ns: 'editor',
                  reason: details.reportError ?? t('exportFailure.noReasonGiven', 'no reason given', { ns: 'editor' }),
                })}
              </span>
            )}
            {details.attempts.length > 1 && (
              <span className="flex flex-col" data-testid="export-failure-attempts">
                <span className="font-medium">{t('exportFailure.attempts', 'Attempts:', { ns: 'editor' })}</span>
                {details.attempts.map((a) => (
                  <span key={`${a.attempt}-${a.autodeskJobId}`}>
                    {t('exportFailure.attemptLine', '{{number}}. {{outcome}}{{headline}} (Autodesk job {{job}})', {
                      ns: 'editor',
                      number: a.attempt,
                      outcome:
                        a.outcome === 'revit_crashed'
                          ? t('exportFailure.revitCrashed', 'Revit crashed', { ns: 'editor' })
                          : a.outcome === 'succeeded'
                            ? t('exportFailure.finished', 'Finished', { ns: 'editor' })
                            : t('exportFailure.failed', 'Failed', { ns: 'editor' }),
                      headline: a.headline ? ` — ${a.headline}` : '',
                      job: a.autodeskJobId,
                    })}
                  </span>
                ))}
              </span>
            )}
            <span className="text-muted-foreground" data-testid="export-failure-job-id">
              {t('exportFailure.jobLine', 'Autodesk job {{job}}{{status}}{{revit}}', {
                ns: 'editor',
                job: details.autodeskJobId ?? t('exportFailure.unknown', 'unknown', { ns: 'editor' }),
                status: details.autodeskStatus ? ` · ${details.autodeskStatus}` : '',
                revit: details.engineYear ? t('exportFailure.revitYear', ' · Revit {{year}}', { ns: 'editor', year: details.engineYear }) : '',
              })}
            </span>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
