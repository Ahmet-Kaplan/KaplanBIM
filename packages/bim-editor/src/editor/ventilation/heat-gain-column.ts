import { useMemo } from 'react'
import { draftHeatGainCell } from '@permitzip/bim-pack-mechanical'
import type { ComputedEquipmentColumn } from '../equipment-list/EquipmentListDialog'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'
import { useKitchenHeatTablesFrom, type KitchenHeatTables } from './kitchen-heat-client'

/** The Equipment list's Heat gain column over tables already read: the table's heat for a row that names an appliance it has. */
export function heatGainColumn(tables: KitchenHeatTables, t: Translate = englishOnly): ComputedEquipmentColumn {
  return {
    id: 'heat-gain',
    label: t('ventilation.heatGain', 'Heat gain', { ns: 'editor' }),
    cell: (row) => {
      if (tables.status === 'loading') return { text: '…', title: t('ventilation.readingHeatTable', 'Reading the kitchen heat table', { ns: 'editor' }) }
      if (tables.status === 'error')
        return { text: t('ventilation.notRead', 'Not read', { ns: 'editor' }), title: tables.error ?? t('ventilation.heatTablesUnread', "Couldn't read the kitchen heat tables", { ns: 'editor' }) }
      return draftHeatGainCell(row.description, { firm: tables.firm, project: tables.project })
    },
  }
}

/** The Heat gain column for the Equipment list, reading the firm's and the project's tables once. */
export function useHeatGainColumns(projectId: string | null | undefined): readonly ComputedEquipmentColumn[] {
  const t = useEditorTranslate()
  const tables = useKitchenHeatTablesFrom(useEditorHost().data.firmLibrary, projectId)
  return useMemo(() => [heatGainColumn(tables, t)], [tables, t])
}
