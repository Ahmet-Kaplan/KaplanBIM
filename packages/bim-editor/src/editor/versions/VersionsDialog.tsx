'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog'
import type { VersionEntry } from '../../contracts/building-model/branch-versions'
import type { BranchChannel } from '../branches/useBranches'
import type { ModelStore } from '../model-store'
import { useChangeKindSlot } from './ChangeKind'
import type { VersionsState } from './useVersions'
import { VersionsList } from './VersionsList'
import { useEditorTranslate } from '../i18n/translate'

export interface VersionsDialogProps {
  readonly onOpenChange: (open: boolean) => void
  readonly projectId: string
  readonly modelId: string | null
  readonly state: VersionsState
  readonly onRetry: () => void
  readonly onSaveVersion: (name: string) => Promise<void>
  readonly cantEditReason: string | null
  readonly onNewBranchFrom: (entry: VersionEntry) => void
  readonly channel: BranchChannel | null
  readonly store: ModelStore
}

/** Building Model › Manage › Versions, with what kind of change each version was. */
export function VersionsDialog({ onOpenChange, projectId, modelId, state, onRetry, onSaveVersion, cantEditReason, onNewBranchFrom, channel, store }: VersionsDialogProps) {
  const t = useEditorTranslate()
  const entries = state.status === 'ready' ? state.entries : null
  const changeKind = useChangeKindSlot({ projectId, modelId, entries, channel, model: null, store })
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="versions-dialog">
        <DialogHeader>
          <DialogTitle>{t('panel.versions', 'Versions', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>{t('versions.dialogDescription', 'Saved versions and issued sets of this model. Start a branch from one, or say what kind of change it was.', { ns: 'editor' })}</DialogDescription>
        </DialogHeader>
        <VersionsList state={state} onRetry={onRetry} cantEditReason={cantEditReason} onSaveVersion={onSaveVersion} onNewBranchFrom={onNewBranchFrom} renderExtra={changeKind} />
      </DialogContent>
    </Dialog>
  )
}
