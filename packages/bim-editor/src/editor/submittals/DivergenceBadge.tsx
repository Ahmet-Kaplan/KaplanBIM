'use client'

import { GitBranchPlus } from 'lucide-react'
import { DIVERGENCE_BADGE, type ModelState } from '@permitzip/bim-kernel'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { divergenceFor } from './submittal-rows'
import { useEditorTranslate } from '../i18n/translate'

/**
 * The Inspector's badge on an element an approved substitution names: "Approved
 * substitution: differs from the design. Design not changed." The design is
 * changed only on purpose, through a branch and its merge.
 */
export function DivergenceBadge({ model, elementId, canEdit, blockedReason, onUpdateDesign }: { readonly model: ModelState; readonly elementId: string; readonly canEdit: boolean; readonly blockedReason: string; readonly onUpdateDesign: () => void }) {
  const t = useEditorTranslate()
  const d = divergenceFor(model, elementId)
  if (!d) return null
  return (
    <Alert data-testid="divergence-badge">
      <AlertTitle>{DIVERGENCE_BADGE}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2">
        <span>
          {t('submittals.approvedColon', 'Approved:', { ns: 'editor' })} {d.product}, by {d.approvedBy}
          {d.notes ? `. ${d.notes}` : ''}
          {d.responsible ? t('submittals.responsibleFor', '. Responsible for the difference: {{who}}', { ns: 'editor', who: d.responsible }) : ''}
        </span>
        <Button size="sm" variant="outline" onClick={onUpdateDesign} disabled={!canEdit} title={canEdit ? t('submittals.opensABranch', 'Opens a branch; Main changes only when the branch is merged', { ns: 'editor' }) : blockedReason} data-testid="divergence-update-design">
          <GitBranchPlus data-icon="inline-start" />
          {t('submittals.updateDesign', 'Update design to match (opens a branch for review)', { ns: 'editor' })}
        </Button>
      </AlertDescription>
    </Alert>
  )
}
