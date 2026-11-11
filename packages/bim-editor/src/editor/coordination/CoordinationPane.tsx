'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, ChevronRight, CircleHelp, RefreshCw, ShieldCheck, TriangleAlert, X } from 'lucide-react'
import type { ModelState } from '@permitzip/bim-kernel'
import { RULESETS, type Finding, type LintConfig } from '@permitzip/bim-lint'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../../ui/alert-dialog'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Field, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemHeader, ItemTitle } from '../../ui/item'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Spinner } from '../../ui/spinner'
import { Textarea } from '../../ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import { QuestionsList, type QuestionsListProps } from '../questions/QuestionsList'
import { SubmittalsPanel, type SubmittalsPanelProps } from '../submittals/SubmittalsPanel'
import { groupFindings, type ElementCluster } from './group-findings'
import { useWindowedRows, windowSlice } from '../use-windowed-rows'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { ruleTitle, useCoordinationFrom, type Acceptance } from './use-coordination'
import { useEditorLanguage, useEditorTranslate, type Translate } from '../i18n/translate'

/**
 * Manage › Coordination: every clash and coordination finding on the open
 * model, from the same lint engine the agent's edits run, grouped by rule.
 * Click a finding to select what it names; accept one with a reason (kept
 * for everyone on the project until its elements change), or retract an
 * acceptance with a reason, including ones that match no finding here.
 */

/** What each check looks at, in the screen's language. A function, not a table of English strings. */
const rulesetLabel = (ruleset: (typeof RULESETS)[number], t: Translate): string => {
  switch (ruleset) {
    case 'coordination':
      return t('coordination.rulesetCoordination', 'Clashes and placement', { ns: 'editor' })
    case 'documents':
      return t('coordination.rulesetDocuments', 'Drawings and sheets', { ns: 'editor' })
    case 'issue':
      return t('coordination.rulesetIssue', 'Before issuing a set', { ns: 'editor' })
    default:
      return t('coordination.rulesetEverything', 'Everything', { ns: 'editor' })
  }
}

const SEVERITY_VARIANT = { error: 'destructive', warning: 'secondary', info: 'outline' } as const

interface Props {
  readonly projectId: string
  readonly modelId: string
  readonly model: ModelState | null
  /** Null when the person can accept findings; else why not. */
  readonly acceptBlocked: string | null
  readonly onSelect: (ids: readonly string[]) => void
  readonly onClose: () => void
  /** Questions and assumptions pinned to the model, listed above the findings. */
  readonly questions?: QuestionsListProps
  /** Submittals beside the design (with `needs`: a fourth chip, Submittals). */
  readonly submittals?: SubmittalsPanelProps
  /** The pane's name (the checklist hosts it as "Checklist"). Default "Coordination". */
  readonly title?: string
  /**
   * What the requirements graph says each place still needs (the checklist).
   * When given, chips choose Needs, Checks (these findings), Questions or (when given) Submittals.
   */
  readonly needs?: { readonly node: ReactNode; readonly count: number }
}

type PaneView = 'needs' | 'checks' | 'questions' | 'submittals'

/** "0.5 in. tolerance, with 2 linked models": what the check looked at. §7 keeps `in.` as it is. */
function scopeText(c: LintConfig, linkedCount: number, t: Translate): string {
  const linked = !c.include_linked
    ? t('coordination.linkedExcluded', 'linked models excluded', { ns: 'editor' })
    : linkedCount === 0
      ? t('coordination.noLinkedModels', 'no linked models loaded', { ns: 'editor' })
      : linkedCount === 1
        ? t('coordination.withOneLinkedModel', 'with 1 linked model', { ns: 'editor' })
        : t('coordination.withLinkedModels', 'with {{count}} linked models', { ns: 'editor', count: linkedCount })
  return t('coordination.scope', '{{tolerance}} in. tolerance, {{linked}}', { ns: 'editor', tolerance: c.tolerance_in, linked })
}

function FindingRow({ finding, onSelect, acceptBlocked, onAccept }: { finding: Finding; onSelect: (ids: readonly string[]) => void; acceptBlocked: string | null; onAccept: (reason: string) => Promise<void> }) {
  const t = useEditorTranslate()
  const [accepting, setAccepting] = useState(false)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const tooShort = reason.trim().length < 3
  return (
    <Item variant="outline" size="sm" data-testid="coordination-finding" data-rule={finding.rule} data-finding-id={finding.id}>
      <ItemHeader className="min-w-0 flex-wrap">
        <span className="flex min-w-0 items-center gap-2">
          <Badge variant={SEVERITY_VARIANT[finding.severity]}>{finding.severity}</Badge>
          <span className="truncate text-xs text-muted-foreground">{finding.at.level || t('coordination.noLevel', 'No level', { ns: 'editor' })}</span>
        </span>
        <ItemActions className="ml-auto">
          <Button size="sm" variant="outline" data-testid="coordination-select" onClick={() => onSelect(finding.elementIds)} disabled={finding.elementIds.length === 0} title={finding.elementIds.length === 0 ? t('coordination.linkedOnly', 'It names only linked-model elements, which you can’t select', { ns: 'editor' }) : t('coordination.selectWhatItNames', 'Select what it names', { ns: 'editor' })}>
            {t('coordination.select', 'Select', { ns: 'editor' })}
          </Button>
          {!accepting && (
            <Button size="sm" variant="ghost" data-testid="coordination-accept" disabled={acceptBlocked !== null} title={acceptBlocked ?? t('coordination.acceptHint', 'Accept it with a reason', { ns: 'editor' })} onClick={() => setAccepting(true)}>
              {t('coordination.acceptEllipsis', 'Accept…', { ns: 'editor' })}
            </Button>
          )}
        </ItemActions>
      </ItemHeader>
      <ItemContent className="min-w-0 basis-full">
        <ItemDescription className="line-clamp-none [overflow-wrap:anywhere]" data-testid="coordination-finding-message">
          {finding.message}
        </ItemDescription>
        {accepting && (
          <div className="mt-2 flex flex-col gap-2">
            <Field>
              <FieldLabel htmlFor={`accept-${finding.id}`}>{t('coordination.whyAcceptable', 'Why is this acceptable?', { ns: 'editor' })}</FieldLabel>
              <Textarea id={`accept-${finding.id}`} data-testid="coordination-accept-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('coordination.acceptPlaceholder', 'Field-verified, the duct drops under the beam here', { ns: 'editor' })} rows={2} maxLength={500} />
            </Field>
            <div className="flex gap-2">
              <Button
                size="sm"
                data-testid="coordination-accept-confirm"
                disabled={tooShort || saving}
                title={tooShort ? t('coordination.sayWhyFirst', 'Say why in a few words first', { ns: 'editor' }) : undefined}
                onClick={async () => {
                  setSaving(true)
                  try {
                    await onAccept(reason.trim())
                    toast.success(t('coordination.findingAccepted', 'Finding accepted', { ns: 'editor' }))
                    setAccepting(false)
                  } catch (err) {
                    console.error('[coordination] accepting failed', err)
                    toast.error(err instanceof Error ? err.message : t('coordination.acceptingFailed', 'Accepting failed', { ns: 'editor' }))
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                {saving ? <Spinner /> : null}
                {t('coordination.accept', 'Accept', { ns: 'editor' })}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAccepting(false)}>
                {t('coordination.cancel', 'Cancel', { ns: 'editor' })}
              </Button>
            </div>
          </div>
        )}
      </ItemContent>
    </Item>
  )
}

/** Findings about one element under one rule: a header with the count and Select all, the findings under it (folded when there are several). */
function ClusterBlock({ cluster, onSelect, acceptBlocked, onAccept }: { cluster: ElementCluster; onSelect: (ids: readonly string[]) => void; acceptBlocked: string | null; onAccept: (finding: Finding, reason: string) => Promise<void> }) {
  const t = useEditorTranslate()
  const [open, setOpen] = useState(cluster.findings.length <= 2)
  const rows = (
    <ItemGroup className="gap-2">
      {cluster.findings.map((f) => (
        <FindingRow key={f.id} finding={f} onSelect={onSelect} acceptBlocked={acceptBlocked} onAccept={(reason) => onAccept(f, reason)} />
      ))}
    </ItemGroup>
  )
  if (cluster.findings.length === 1) return rows
  const errors = cluster.findings.filter((f) => f.severity === 'error').length
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex min-w-0 flex-col gap-2 rounded-lg border border-dashed p-2" data-testid="coordination-cluster" data-element={cluster.key}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="min-w-0 max-w-full justify-start" aria-label={open ? t('coordination.hideFindingsAbout', 'Hide the {{count}} findings about {{what}}', { ns: 'editor', count: cluster.findings.length, what: cluster.label }) : t('coordination.showFindingsAbout', 'Show the {{count}} findings about {{what}}', { ns: 'editor', count: cluster.findings.length, what: cluster.label })} data-testid="coordination-cluster-toggle">
            <ChevronRight data-icon="inline-start" className={open ? 'rotate-90 transition-transform' : 'transition-transform'} />
            <span className="truncate">{cluster.label}</span>
          </Button>
        </CollapsibleTrigger>
        <Badge variant={errors > 0 ? 'destructive' : 'secondary'} data-testid="coordination-cluster-count">
          {cluster.findings.length}
          {errors > 0 && errors < cluster.findings.length ? (errors === 1 ? t('coordination.errorCountOne', ' (1 error)', { ns: 'editor' }) : t('coordination.errorCount', ' ({{count}} errors)', { ns: 'editor', count: errors })) : ''}
        </Badge>
        <Button size="sm" variant="outline" className="ml-auto" data-testid="coordination-cluster-select" onClick={() => onSelect(cluster.elementIds)} title={t('coordination.selectAllTitle', 'Select {{what}} and the rest of what these findings name', { ns: 'editor', what: cluster.label })}>
          {t('coordination.selectAll', 'Select all', { ns: 'editor' })}
        </Button>
      </div>
      <CollapsibleContent>{rows}</CollapsibleContent>
    </Collapsible>
  )
}

/** Retract… → a confirm asking why; the acceptance is kept with who retracted it and why, and the finding shows again. */
function RetractButton({ what, acceptance, blocked, onRetract }: { what: string; acceptance: Acceptance; blocked: string | null; onRetract: (reason: string) => Promise<void> }) {
  const t = useEditorTranslate()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const tooShort = reason.trim().length < 3
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return
        setOpen(next)
        if (!next) setReason('')
      }}
    >
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" data-testid="coordination-retract" disabled={blocked !== null} title={blocked ?? t('coordination.retractHint', 'Undo this acceptance; the finding shows again', { ns: 'editor' })}>
          {t('coordination.retractEllipsis', 'Retract…', { ns: 'editor' })}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onEscapeKeyDown={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('coordination.retractTitle', 'Retract this acceptance?', { ns: 'editor' })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('coordination.retractDescription', '{{what}} was accepted {{when}} because “{{reason}}”. Retracting shows it again for everyone, people and agents. Who accepted it, who retracted it, and why are kept.', { ns: 'editor', what, when: new Date(acceptance.acceptedAt).toLocaleString(), reason: acceptance.reason })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor={`retract-${acceptance.findingId}`}>{t('coordination.whyRetract', 'Why retract it?', { ns: 'editor' })}</FieldLabel>
          <Textarea id={`retract-${acceptance.findingId}`} data-testid="coordination-retract-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('coordination.retractPlaceholder', "Accepted by mistake; this isn't a real finding", { ns: 'editor' })} rows={2} maxLength={500} />
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>{t('coordination.cancel', 'Cancel', { ns: 'editor' })}</AlertDialogCancel>
          <Button
            variant="destructive"
            data-testid="coordination-retract-confirm"
            disabled={tooShort || saving}
            title={tooShort ? t('coordination.sayWhyFirst', 'Say why in a few words first', { ns: 'editor' }) : undefined}
            onClick={async () => {
              setSaving(true)
              try {
                await onRetract(reason.trim())
                toast.success(t('coordination.acceptanceRetracted', 'Acceptance retracted; the finding shows again', { ns: 'editor' }))
                setOpen(false)
                setReason('')
              } catch (err) {
                console.error('[coordination] retracting failed', err)
                toast.error(err instanceof Error ? err.message : t('coordination.retractingFailed', 'Retracting failed', { ns: 'editor' }))
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? <Spinner /> : null}
            {t('coordination.retract', 'Retract', { ns: 'editor' })}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function AcceptedRow({ finding, acceptance, blocked, onRetract }: { finding: Finding; acceptance: Acceptance; blocked: string | null; onRetract: (reason: string) => Promise<void> }) {
  const t = useEditorTranslate()
  return (
    <Item variant="muted" size="sm" data-testid="coordination-accepted" data-finding-id={finding.id}>
      <ItemContent>
        <ItemTitle className="line-clamp-none text-xs [overflow-wrap:anywhere]">{finding.message}</ItemTitle>
        <ItemDescription>{t('coordination.acceptedPrefix', 'Accepted: {{reason}}', { ns: 'editor', reason: acceptance.reason })}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <RetractButton what={t('coordination.thisFinding', 'This finding', { ns: 'editor' })} acceptance={acceptance} blocked={blocked} onRetract={onRetract} />
      </ItemActions>
    </Item>
  )
}

function UnmatchedRow({ acceptance, blocked, onRetract }: { acceptance: Acceptance; blocked: string | null; onRetract: (reason: string) => Promise<void> }) {
  const t = useEditorTranslate()
  return (
    <Item variant="muted" size="sm" data-testid="coordination-unmatched" data-finding-id={acceptance.findingId}>
      <ItemContent>
        <ItemTitle className="font-mono text-xs break-all">{acceptance.findingId}</ItemTitle>
        <ItemDescription>{t('coordination.acceptedPrefix', 'Accepted: {{reason}}', { ns: 'editor', reason: acceptance.reason })}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <RetractButton what={`"${acceptance.findingId}"`} acceptance={acceptance} blocked={blocked} onRetract={onRetract} />
      </ItemActions>
    </Item>
  )
}

/** Estimated height of one finding cluster in the list, px. */
const FINDING_ROW_PX = 96

export function CoordinationPane({ projectId, modelId, model, acceptBlocked, onSelect, onClose, questions, submittals, title, needs }: Props) {
  const t = useEditorTranslate()
  const language = useEditorLanguage()
  const paneTitle = title ?? t('panel.coordination', 'Coordination', { ns: 'editor' })
  // The close button reads as a sentence, so the pane's word is lower-cased in it —
  // in English only: Turkish `İ`/`I` are not the English pair (see `useEditorLanguage`).
  const paneWords = language === 'tr' ? paneTitle : paneTitle.toLocaleLowerCase('en')
  const { state, config, setConfig, accept, retract, saveSettings, retry } = useCoordinationFrom(useEditorHost().data.coordination, projectId, modelId, model)
  const [view, setView] = useState<PaneView>('needs')
  const showChecks = needs === undefined || view === 'checks'
  const showQuestions = needs === undefined || view === 'questions'
  /** What the person is typing in Tolerance; null shows the setting in force. */
  const [toleranceDraft, setToleranceDraft] = useState<string | null>(null)
  const tolerance = toleranceDraft ?? String(config.tolerance_in)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const groups = useMemo(() => (state.status === 'ready' ? groupFindings(state.open, model) : []), [state, model])
  const flat = useMemo(() => groups.flatMap((g) => [{ kind: 'rule' as const, g }, ...g.clusters.map((c) => ({ kind: 'cluster' as const, g, c }))]), [groups])
  const windowRows = useWindowedRows(flat.length, FINDING_ROW_PX)

  const errors = state.status === 'ready' ? state.open.filter((f) => f.severity === 'error').length : 0
  const warnings = state.status === 'ready' ? state.open.length - errors : 0

  return (
    <Card className="pointer-events-auto absolute top-3 left-3 z-30 flex max-h-[calc(100%-1.5rem)] w-[26rem] max-w-[calc(100%-1.5rem)] min-w-0 flex-col gap-3 overflow-hidden py-4 shadow-lg" data-testid="coordination-panel" role="region" aria-label={paneTitle}>
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2">
          {paneTitle}
          {state.status === 'ready' && (
            <Badge variant={errors > 0 ? 'destructive' : 'secondary'} data-testid="coordination-count">
              {state.open.length}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {state.status === 'ready'
            ? t('coordination.summary', '{{errors}} errors, {{warnings}} warnings at Rev {{revision}}: {{scope}}', {
                ns: 'editor',
                errors: errors === 1 ? t('coordination.oneError', '1 error', { ns: 'editor' }) : t('coordination.errorCountPlain', '{{count}} errors', { ns: 'editor', count: errors }),
                warnings: warnings === 1 ? t('coordination.oneWarning', '1 warning', { ns: 'editor' }) : t('coordination.warningCount', '{{count}} warnings', { ns: 'editor', count: warnings }),
                revision: state.revision,
                scope: scopeText(state.settings, state.linkedCount, t),
              })
            : t('coordination.idleDescription', 'Clashes with our work and linked models, equipment placement, systems and sheets.', { ns: 'editor' })}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon" aria-label={t('panel.closePane', 'Close {{name}} (Esc)', { name: paneWords, ns: 'editor' })} onClick={onClose} data-testid="coordination-close">
            <X />
          </Button>
        </CardAction>
      </CardHeader>
      {/* A short window (a phone, 488 x 640): the controls scroll away with the content and the list keeps room to show and scroll its findings. */}
      <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4" data-testid="coordination-body">
        {needs && (
          <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(v) => v && setView(v as PaneView)} aria-label={t('panel.show', 'Show', { ns: 'editor' })} className="max-w-full flex-wrap justify-start" data-testid="checklist-filters">
            <ToggleGroupItem value="needs" data-testid="checklist-filter-needs">
              {t('coordination.chipNeeds', 'Needs {{count}}', { ns: 'editor', count: needs.count })}
            </ToggleGroupItem>
            <ToggleGroupItem value="checks" data-testid="checklist-filter-checks">
              {state.status === 'ready' ? t('coordination.chipChecksCount', 'Checks {{count}}', { ns: 'editor', count: state.open.length }) : t('coordination.chipChecks', 'Checks', { ns: 'editor' })}
            </ToggleGroupItem>
            <ToggleGroupItem value="questions" data-testid="checklist-filter-questions">
              {t('coordination.chipQuestions', 'Questions', { ns: 'editor' })}
            </ToggleGroupItem>
            {submittals ? (
              <ToggleGroupItem value="submittals" data-testid="checklist-filter-submittals">
                {t('coordination.chipSubmittals', 'Submittals', { ns: 'editor' })}
              </ToggleGroupItem>
            ) : null}
          </ToggleGroup>
        )}
        {needs && view === 'needs' && needs.node}
        {needs && view === 'submittals' && submittals ? <SubmittalsPanel {...submittals} /> : null}
        {showChecks && (
        <div className="flex flex-wrap items-end gap-2">
          <Field className="min-w-40 flex-1">
            <FieldLabel htmlFor="coordination-ruleset">{t('coordination.check', 'Check', { ns: 'editor' })}</FieldLabel>
            <Select value={config.ruleset} onValueChange={(v) => setConfig({ ...config, ruleset: v as LintConfig['ruleset'] })}>
              <SelectTrigger id="coordination-ruleset" data-testid="coordination-ruleset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RULESETS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {rulesetLabel(r, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field className="w-24">
            <FieldLabel htmlFor="coordination-tolerance">{t('coordination.tolerance', 'Tolerance (in.)', { ns: 'editor' })}</FieldLabel>
            <Input
              id="coordination-tolerance"
              inputMode="decimal"
              value={tolerance}
              onChange={(e) => setToleranceDraft(e.target.value)}
              onBlur={() => {
                const v = Number(tolerance)
                if (Number.isFinite(v) && v >= 0 && v <= 12) setConfig({ ...config, tolerance_in: v })
                else toast.error(t('coordination.toleranceInvalid', 'Tolerance is inches, 0 to 12', { ns: 'editor' }))
                setToleranceDraft(null)
              }}
            />
          </Field>
          <Button
            variant="outline"
            size="sm"
            title={t('coordination.saveDefaultHint', 'Save this check and tolerance as your default on this model', { ns: 'editor' })}
            onClick={() =>
              saveSettings(config)
                .then(() => toast.success(t('coordination.savedDefault', 'Saved as your default for this model', { ns: 'editor' })))
                .catch((err: unknown) => {
                  console.error('[coordination] saving settings failed', err)
                  toast.error(err instanceof Error ? err.message : t('coordination.savingFailed', 'Saving failed', { ns: 'editor' }))
                })
            }
          >
            {t('coordination.saveDefault', 'Save default', { ns: 'editor' })}
          </Button>
        </div>
        )}

        {showQuestions && questions ? <QuestionsList {...questions} /> : null}

        {showChecks && state.status === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="coordination-loading">
            <Spinner /> {state.message}
          </div>
        )}
        {showChecks && state.status === 'error' && (
          <Alert variant="destructive" data-testid="coordination-error">
            <TriangleAlert />
            <AlertTitle>{t('coordination.couldntRun', "Coordination couldn't run", { ns: 'editor' })}</AlertTitle>
            <AlertDescription>
              {state.message}
              <Button variant="outline" size="sm" className="mt-2" onClick={retry}>
                <RefreshCw /> {t('coordination.tryAgain', 'Try again', { ns: 'editor' })}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {showChecks && state.status === 'ready' && state.linkedNote && (
          <Alert data-testid="coordination-linked-note">
            <AlertDescription>{state.linkedNote}</AlertDescription>
          </Alert>
        )}
        {showChecks && state.status === 'ready' && state.open.length === 0 && (
          <Empty className="border" data-testid="coordination-empty">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ShieldCheck />
              </EmptyMedia>
              <EmptyTitle>{t('coordination.nothingToCoordinate', 'Nothing to coordinate', { ns: 'editor' })}</EmptyTitle>
              <EmptyDescription>
                {t('coordination.noFindings', 'No findings ({{check}}) at {{scope}}.', { ns: 'editor', check: rulesetLabel(state.settings.ruleset, t).toLocaleLowerCase(language === 'tr' ? 'tr' : 'en'), scope: scopeText(state.settings, state.linkedCount, t) })}
                {state.notAvailable.length > 0 ? t('coordination.notCheckedYet', ' Not checked yet: {{rules}}.', { ns: 'editor', rules: state.notAvailable.map((r) => ruleTitle(r.rule)).join('; ') }) : ''}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {showChecks && state.status === 'ready' && (state.open.length > 0 || state.accepted.length > 0 || state.unmatched.length > 0) && (
          <div ref={windowRows.scrollRef} className="-mr-2 min-h-48 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pr-2" data-testid="coordination-list" tabIndex={0} aria-label={t('panel.coordinationFindings', 'Coordination findings', { ns: 'editor' })}>
            <div className="flex min-w-0 flex-col gap-4">
              {windowRows.windowed && (
                <div className="flex min-w-0 flex-col" data-testid="coordination-windowed">
                  {windowRows.padTop > 0 && <div aria-hidden="true" style={{ height: windowRows.padTop }} />}
                  {windowSlice(flat, windowRows).map(({ item, index }) => (
                    <div key={item.kind === 'rule' ? `rule:${item.g.rule}` : `${item.g.rule}:${item.c.key}`} ref={windowRows.measure} data-index={index} className="min-w-0 pb-2">
                      {item.kind === 'rule' ? (
                        <h3 className="flex items-start gap-2 pt-2 text-sm font-medium" data-testid="coordination-group" data-rule={item.g.rule}>
                          <span className="min-w-0 flex-1">{ruleTitle(item.g.rule)}</span>
                          <Badge variant="outline" className="shrink-0">
                            {item.g.findings.length}
                            {item.g.clusters.length < item.g.findings.length ? ` on ${item.g.clusters.length}` : ''}
                          </Badge>
                        </h3>
                      ) : (
                        <ClusterBlock cluster={item.c} onSelect={onSelect} acceptBlocked={acceptBlocked} onAccept={accept} />
                      )}
                    </div>
                  ))}
                  {windowRows.padBottom > 0 && <div aria-hidden="true" style={{ height: windowRows.padBottom }} />}
                </div>
              )}
              {!windowRows.windowed && groups.map((g) => (
                <section key={g.rule} className="flex min-w-0 flex-col gap-2" data-testid="coordination-group" data-rule={g.rule}>
                  <h3 className="flex items-start gap-2 text-sm font-medium">
                    <span className="min-w-0 flex-1">{ruleTitle(g.rule)}</span>
                    <Badge variant="outline" className="shrink-0">
                      {g.findings.length}
                      {g.clusters.length < g.findings.length ? ` on ${g.clusters.length}` : ''}
                    </Badge>
                  </h3>
                  {g.clusters.map((c) => (
                    <ClusterBlock key={c.key} cluster={c} onSelect={onSelect} acceptBlocked={acceptBlocked} onAccept={accept} />
                  ))}
                </section>
              ))}
              {state.accepted.length > 0 && (
                <section className="flex flex-col gap-2" data-testid="coordination-accepted-group">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="size-4" /> {t('coordination.acceptedHeading', 'Accepted', { ns: 'editor' })}
                    <Badge variant="outline">{state.accepted.length}</Badge>
                  </h3>
                  <ItemGroup className="gap-2">
                    {state.accepted.map(({ finding, acceptance }) => (
                      <AcceptedRow key={finding.id} finding={finding} acceptance={acceptance} blocked={acceptBlocked} onRetract={(reason) => retract(finding.id, reason)} />
                    ))}
                  </ItemGroup>
                </section>
              )}
              {state.unmatched.length > 0 && (
                <section className="flex flex-col gap-2" data-testid="coordination-unmatched-group">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <CircleHelp className="size-4" /> {t('coordination.acceptedNotInCheck', 'Accepted, not in this check', { ns: 'editor' })}
                    <Badge variant="outline">{state.unmatched.length}</Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t('coordination.unmatchedDescription', 'No finding has these ids in this check ({{check}}). They may belong to another check, their elements changed, or they were never real findings. Retract any that shouldn’t be there.', { ns: 'editor', check: rulesetLabel(state.settings.ruleset, t).toLocaleLowerCase(language === 'tr' ? 'tr' : 'en') })}
                  </p>
                  <ItemGroup className="gap-2">
                    {state.unmatched.map((acceptance) => (
                      <UnmatchedRow key={acceptance.findingId} acceptance={acceptance} blocked={acceptBlocked} onRetract={(reason) => retract(acceptance.findingId, reason)} />
                    ))}
                  </ItemGroup>
                </section>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
