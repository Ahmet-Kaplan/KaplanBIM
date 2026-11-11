'use client'

import { useState } from 'react'
import { HostLink as Link } from '@permitzip/bim-editor/host'
import { ChevronDown, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import type { DesignLimit, DesignLimitLayer } from '@permitzip/bim-kernel/policy'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '../../ui/dropdown-menu'
import { Field, FieldDescription, FieldError, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import type { CapacityTargets } from './use-capacity-targets'
import { useEditorTranslate, type Translate } from '../i18n/translate'

/** Where the firm's targets are edited (Library › Design limits). */
export const FIRM_DESIGN_LIMITS_HREF = '/settings/mutinybim-library'

/** A measured value against a design limit's minimum, with the line to print (an add-on's reading has this shape). */
export interface CapacityReading {
  readonly text: string
  readonly below: boolean
  readonly target: { readonly fraction: number; readonly layer: DesignLimitLayer; readonly limit: DesignLimit }
}

/** Which layer a design limit was set on, in words — a `label(t)` accessor. */
function layerWord(layer: DesignLimitLayer, t: Translate): string {
  switch (layer) {
    case 'project':
      return t('electrical.setForThisProject', 'set for this project', { ns: 'editor' })
    case 'firm':
      return t('electrical.theFirmSTarget', 'the firm’s target', { ns: 'editor' })
    case 'addon':
      return t('electrical.theDefaultTarget', 'the default target', { ns: 'editor' })
  }
}

/**
 * One capacity line against its design limit: "Spare capacity: 31 % (target
 * 25 %)". Under the target it says "Below target" in words (amber is only a
 * second cue), and "Change target…" says whether a change is for this project
 * or for the firm.
 */
export function CapacityTargetLine({ reading, targets, canEdit, testId }: { readonly reading: CapacityReading; readonly targets?: CapacityTargets; readonly canEdit: boolean; readonly testId: string }) {
  const t = useEditorTranslate()
  const [editing, setEditing] = useState(false)
  const percent = Math.round(reading.target.fraction * 100)
  return (
    <div className="flex flex-col gap-1" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={reading.below ? 'flex items-center gap-1 font-medium text-warning-700' : undefined} data-testid={`${testId}-text`}>
          {reading.below && <TriangleAlert aria-hidden className="size-3.5" />}
          {reading.text}
        </span>
        <span className="text-muted-foreground" data-testid={`${testId}-layer`}>
          {targets?.status === 'loading' ? t('electrical.loadingTheFirmSAndProjectSTargets', 'Loading the firm’s and project’s targets…', { ns: 'editor' }) : `${t('electrical.percentIs', '{{percent}} % is {{layer}}.', { ns: 'editor', percent, layer: layerWord(reading.target.layer, t) })}`}
        </span>
        {targets && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="link" size="sm" className="h-auto p-0 text-xs" data-testid={`${testId}-change`}>
                {t('electrical.changeTarget', 'Change target…', { ns: 'editor' })}
                <ChevronDown data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>{t('electrical.changeTheLimitTarget', 'Change the {{limit}} target', { ns: 'editor', limit: reading.target.limit.label.toLowerCase() })}</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem disabled={!canEdit || targets.status !== 'ready'} onSelect={() => setEditing(true)} data-testid={`${testId}-change-project`}>
                  {canEdit ? t('electrical.forThisProjectOnly', 'For this project only…', { ns: 'editor' }) : t('electrical.forThisProjectOnlyNeedsEditAccessToThisModel', 'For this project only (needs edit access to this model)', { ns: 'editor' })}
                </DropdownMenuItem>
                <DropdownMenuItem asChild data-testid={`${testId}-change-firm`}>
                  <Link href={FIRM_DESIGN_LIMITS_HREF}>{t('electrical.forTheFirmEveryProjectLibraryDesignLimits', 'For the firm, every project (Library › Design limits)', { ns: 'editor' })}</Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {targets?.problem && (
        <span className="text-danger-600" role="alert">
          {targets.problem}
        </span>
      )}
      {targets && editing && <ProjectTargetDialog reading={reading} targets={targets} onClose={() => setEditing(false)} testId={testId} />}
    </div>
  )
}

function ProjectTargetDialog({ reading, targets, onClose, testId }: { readonly reading: CapacityReading; readonly targets: CapacityTargets; readonly onClose: () => void; readonly testId: string }) {
  const t = useEditorTranslate()
  const [value, setValue] = useState(String(Math.round(reading.target.fraction * 100)))
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const label = reading.target.limit.label
  const save = async () => {
    const n = Number(value)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setProblem(t('electrical.enterAPercentageFrom0To100', 'Enter a percentage from 0 to 100.', { ns: 'editor' }))
      return
    }
    setSaving(true)
    const outcome = await targets.setProjectMinimum(reading.target.limit, n)
    setSaving(false)
    if (!outcome.ok) {
      setProblem(outcome.message)
      return
    }
    toast.success(t('electrical.limitPercentForThisProject', '{{limit}}: {{percent}} % for this project. The firm’s target is unchanged.', { ns: 'editor', limit: label, percent: n }))
    onClose()
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid={`${testId}-dialog`}>
        <DialogHeader>
          <DialogTitle>{t('electrical.limitForThisProject', '{{limit}} for this project', { ns: 'editor', limit: label })}</DialogTitle>
          <DialogDescription>{t('electrical.thisProjectOnlyOtherProjectsKeepTheFirmSTarg', 'This project only. Other projects keep the firm’s target; change that in Library › Design limits.', { ns: 'editor' })}</DialogDescription>
        </DialogHeader>
        <Field data-invalid={problem !== null}>
          <FieldLabel htmlFor={`${testId}-target`}>{t('electrical.target', 'Target (%)', { ns: 'editor' })}</FieldLabel>
          <Input id={`${testId}-target`} type="number" min={0} max={100} value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={problem !== null} />
          <FieldDescription>{t('electrical.now', 'Now', { ns: 'editor' })} {Math.round(reading.target.fraction * 100)} % ({layerWord(reading.target.layer, t)}).</FieldDescription>
          {problem && <FieldError>{problem}</FieldError>}
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('electrical.cancel', 'Cancel', { ns: 'editor' })}
          </Button>
          <Button onClick={() => void save()} disabled={saving} data-testid={`${testId}-save`}>
            {saving ? t('electrical.saving', 'Saving…', { ns: 'editor' }) : t('electrical.saveForThisProject', 'Save for this project', { ns: 'editor' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
