'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { renderFieldBlock, type DrawingItem, type FieldBlockSpec, type ModelState } from '@permitzip/bim-kernel'
import { calcSheetTemplate } from '@permitzip/bim-kernel/calc-sheets'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog'
import { Button } from '../../ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip'

import { CalcSheetTable } from './CalcSheetTable'
import { useEditorTranslate } from '../i18n/translate'


/**
 * Properties of a calculation on a sheet: which calculation it is, its
 * freshness (Live / Matches SD issue / Changed since SD issue), and the sheet
 * as it prints now with the governing cell marked. Removing it confirms
 * first; undo brings it back.
 */
export function CalcBlockProperties({ item, block, model, canEdit, blockedReason, freshness, onDelete }: { readonly item: DrawingItem; readonly block: FieldBlockSpec; readonly model: ModelState; readonly canEdit: boolean; readonly blockedReason: string; readonly freshness: ReactNode; readonly onDelete: () => void }) {

  const t = useEditorTranslate()
  const [confirm, setConfirm] = useState(false)
  const rendered = useMemo(() => renderFieldBlock(model, block), [model, block])
  const template = block.calc ? calcSheetTemplate(block.calc.template) : null
  const name = block.title ?? template?.label ?? t('calc.calculation', 'Calculation', { ns: 'editor' })

  const remove = (
    <Button variant="outline" size="sm" disabled={!canEdit} onClick={() => setConfirm(true)} data-testid="calc-block-delete">

      <Trash2 data-icon="inline-start" />
      {t('calc.remove', 'Remove', { ns: 'editor' })}

    </Button>
  )
  return (
    <div className="flex flex-col gap-3" data-testid="calc-block-properties" data-item-id={item.id}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-medium">{name}</span>

          <span className="text-xs text-muted-foreground">
            {template
              ? t('calc.calculationIs', 'Calculation: {{name}}', { ns: 'editor', name: template.label })
              : t('calc.addonGone', 'This model has no add-on with the {{name}} calculation; it shows what it last could.', { ns: 'editor', name: block.calc?.template ?? '' })}
          </span>

        </div>
        {freshness}
      </div>

      <CalcSheetTable text={rendered.text} caption={t('calc.tableCaption', '{{name}}: inputs, table lookups and steps', { ns: 'editor', name })} />

      <div className="flex justify-end">
        {canEdit ? (
          remove
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{remove}</span>
            </TooltipTrigger>
            <TooltipContent>{blockedReason}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>

            <AlertDialogTitle>{t('calc.removeTitle', 'Remove {{name}} from this sheet?', { ns: 'editor', name })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('calc.removeBody', 'Copies already issued keep what they said. Undo puts it back.', { ns: 'editor' })}
            </AlertDialogDescription>

          </AlertDialogHeader>
          <AlertDialogFooter>

            <AlertDialogCancel>{t('calc.keepIt', 'Keep it', { ns: 'editor' })}</AlertDialogCancel>

            <AlertDialogAction
              onClick={() => {
                setConfirm(false)
                onDelete()
              }}

              data-testid="calc-block-delete-confirm"
            >
              {t('calc.remove', 'Remove', { ns: 'editor' })}

            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
