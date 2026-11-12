'use client'

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
import type { DeletePlan } from './model-session'
import { useEditorTranslate } from './i18n/translate'

export type DeletePolicy = 'refuse' | 'disconnect' | 'cascade'

/** Building Model › Delete: what else goes with it, before anything is deleted. */
export function DeleteConfirmDialog({ pending, onClose, onConfirm }: { readonly pending: { readonly title: string; readonly plan: DeletePlan } | null; readonly onClose: () => void; readonly onConfirm: (policy: DeletePolicy) => void }) {
  const t = useEditorTranslate()
  return (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent data-testid="delete-confirmation">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('delete.title', 'Delete {{what}}?', { ns: 'editor', what: pending?.title ?? '' })}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2">
              {pending?.plan.kind === 'clear' && <p>{t('delete.nothingElseDepends', 'Nothing else depends on it. You can undo this.', { ns: 'editor' })}</p>}
              {pending?.plan.kind === 'refused' && <p>{pending.plan.message}</p>}
              {pending?.plan.kind === 'dependents' && (
                <>
                  <p>
                    {pending.plan.dependents.length > 0
                      ? t('delete.theseDependOnIt', 'These depend on it and would be deleted too:', { ns: 'editor' })
                      : pending.plan.connections === 1
                        ? t('delete.oneConnectionCut', 'It has 1 connection that would be cut.', { ns: 'editor', count: pending.plan.connections })
                        : t('delete.connectionsCut', 'It has {{count}} connections that would be cut.', { ns: 'editor', count: pending.plan.connections })}
                  </p>
                  {pending.plan.dependents.length > 0 && (
                    <ul className="list-disc pl-5" data-testid="delete-dependents">
                      {pending.plan.dependents.slice(0, 8).map((d) => (
                        <li key={d.id}>{d.label}</li>
                      ))}
                      {pending.plan.dependents.length > 8 && (
                        <li>{t('delete.andMore', 'and {{count}} more', { ns: 'editor', count: pending.plan.dependents.length - 8 })}</li>
                      )}
                    </ul>
                  )}
                  <p>{t('delete.youCanUndo', 'You can undo this.', { ns: 'editor' })}</p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('delete.keepIt', 'Keep it', { ns: 'editor' })}</AlertDialogCancel>
          {pending?.plan.kind === 'clear' && (
            <AlertDialogAction variant="destructive" onClick={() => onConfirm('refuse')}>
              Delete
            </AlertDialogAction>
          )}
          {pending?.plan.kind === 'dependents' && (
            <AlertDialogAction variant="destructive" onClick={() => onConfirm(pending.plan.kind === 'dependents' && pending.plan.dependents.length > 0 ? 'cascade' : 'disconnect')}>
              {pending.plan.dependents.length > 0
                ? t('delete.allOfThese', 'Delete all of these', { ns: 'editor' })
                : t('delete.andCutConnections', 'Delete and cut connections', { ns: 'editor' })}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
