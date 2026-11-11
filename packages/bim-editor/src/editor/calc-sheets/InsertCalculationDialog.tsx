'use client'

import { useMemo, useState } from 'react'
import { Calculator } from 'lucide-react'
import { disciplineLabel, type ModelState, type Sheet } from '@permitzip/bim-kernel'
import { calcSheetTemplates, type CalcSheetTemplateRow } from '@permitzip/bim-kernel/calc-sheets'
import { Alert, AlertDescription } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import type { SubmitCommand } from '../views-sheets/types'

import { placeCalculation } from '../blocks/insert'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'


/** Why a template can't be placed for what is selected, or null. */

export function calcTemplateBlocked(
  row: Pick<CalcSheetTemplateRow, 'subjectKinds' | 'label'>,
  model: Pick<ModelState, 'elements'>,
  selectedId: string | null,
  t: Translate = englishOnly,
): string | null {
  if (!row.subjectKinds || row.subjectKinds.length === 0) return null
  const el = selectedId ? model.elements[selectedId] : undefined
  if (el && row.subjectKinds.includes(el.kind)) return null
  return t(
    'calc.selectSubjectFirst',
    'Select what this calculation is about first ({{kinds}}), then come back.',
    { ns: 'editor', kinds: row.subjectKinds.map((k) => k.replace(/^[a-z0-9]+\./, '').replace(/_/g, ' ')).join(' or ') },
  )
}


/**
 * Sheet tab › Figures › Calculation: every calculation the model's add-ons
 * register (a sizing table, a pressure-loss sheet, a beam check…),
 * grouped by discipline. Each is placed live: it re-works when what it reads
 * changes and freezes when the set is issued. Esc and Cancel close; a
 * template that needs a subject says so until one is selected.
 */

export function InsertCalculationDialog({ sheet, model, selectedId, submit, onClose, onPlaced }: { readonly sheet: Sheet; readonly model: ModelState; readonly selectedId: string | null; readonly submit: SubmitCommand; readonly onClose: () => void; readonly onPlaced?: (itemId: string) => void }) {
  const t = useEditorTranslate()
  const [error, setError] = useState<string | null>(null)

  const groups = useMemo(() => {
    const byDiscipline = new Map<string, CalcSheetTemplateRow[]>()
    for (const row of calcSheetTemplates()) {
      const key = row.discipline ?? ''
      byDiscipline.set(key, [...(byDiscipline.get(key) ?? []), row])
    }

    return [...byDiscipline.entries()]
      .map(([d, rows]) => ({
        label: d ? disciplineLabel(d) : t('calc.general', 'General', { ns: 'editor' }),
        rows: [...rows].sort((a, b) => a.label.localeCompare(b.label)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [t])


  const place = (row: CalcSheetTemplateRow) => {
    const subject = row.subjectKinds && row.subjectKinds.length > 0 ? selectedId : null
    const r = placeCalculation(sheet, submit, row, subject)
    if ('refusal' in r) {
      console.error('[InsertCalculationDialog] placing a calculation was refused', { template: row.id, refusal: r.refusal })
      setError(r.refusal)
      return
    }
    onPlaced?.(r.itemId)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="insert-calculation-dialog">
        <DialogHeader>

          <DialogTitle>{t('calc.insertTitle', 'Insert a calculation on {{number}}', { ns: 'editor', number: sheet.number })}</DialogTitle>
          <DialogDescription>
            {t(
              'calc.insertBody',
              'A live calculation sheet: inputs read from the model, the table cell that decided the answer marked, checks against your design limits. It updates with every edit and freezes when the set is issued.',
              { ns: 'editor' },
            )}
          </DialogDescription>

        </DialogHeader>
        {error && (
          <Alert variant="destructive" data-testid="insert-calculation-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {groups.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Calculator />
              </EmptyMedia>

              <EmptyTitle>{t('calc.noneYet', 'No calculations in this model yet', { ns: 'editor' })}</EmptyTitle>
              <EmptyDescription>
                {t(
                  'calc.noneYetWhy',
                  'Calculations come with add-ons, and none of the add-ons on this model brings one yet. Turn one on in Manage › Model settings › Add-ons.',
                  { ns: 'editor' },
                )}
              </EmptyDescription>

            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex max-h-96 flex-col gap-4 overflow-y-auto">
            {groups.map((g) => (
              <div key={g.label} className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">{g.label}</span>
                <ItemGroup>
                  {g.rows.map((row) => {

                    const blocked = calcTemplateBlocked(row, model, selectedId, t)

                    return (
                      <Item key={row.id} variant="outline" size="sm" data-testid={`calc-template-${row.id}`}>
                        <ItemContent>
                          <ItemTitle>{row.label}</ItemTitle>
                          {blocked && <ItemDescription>{blocked}</ItemDescription>}
                        </ItemContent>
                        <ItemActions>
                          <Button size="sm" disabled={blocked !== null} onClick={() => place(row)} data-testid={`calc-template-place-${row.id}`}>

                            {t('calc.place', 'Place', { ns: 'editor' })}
                          </Button>

                        </ItemActions>
                      </Item>
                    )
                  })}
                </ItemGroup>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>

          <Button variant="outline" onClick={onClose}>
            {t('calc.cancel', 'Cancel', { ns: 'editor' })}
          </Button>

        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
