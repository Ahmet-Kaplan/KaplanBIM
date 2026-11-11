import { Calculator } from 'lucide-react'
import type { RibbonCommand } from '../ribbon/types'
import { englishOnly, type Translate } from '../i18n/translate'

/**
 * Sheet tab › Figures › Live table › Calculation: opens Insert a calculation (every
 * template the model's add-ons register), beside Load summary and the
 * computed tables.
 */
export function calculationCommand(open: (() => void) | null | undefined, editBlocked: string | null, t: Translate = englishOnly): RibbonCommand {
  return {
    id: 'sheet-calculation',
    label: t('calc.calculation', 'Calculation', { ns: 'editor' }),
    icon: Calculator,
    description: t(
      'calc.ribbon.description',
      'Put a live calculation sheet on the sheet: inputs read from the model, the table cell that decided the answer marked, checks against your design limits; updated with every edit and frozen when the set is issued',
      { ns: 'editor' },
    ),
    keywords: ['calculation', 'calc', 'sizing', 'table', 'governing', 'check', 'block'],
    disabledReason: open ? editBlocked : t('calc.ribbon.needsSheet', 'Open a sheet to place a calculation: Views and sheets › a sheet.', { ns: 'editor' }),
    ...(open ? { run: open } : {}),
    testId: 'ribbon-sheet-calculation',
  }
}
