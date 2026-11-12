'use client'

import { CircleCheck, TriangleAlert } from 'lucide-react'
import type { PartImportReport } from '@permitzip/bim-kernel'
import { Badge } from '../../ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../ui/empty'
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { useEditorTranslate } from '../i18n/translate'

/**
 * The connector report for one part type (round 9 J9): every bad connector,
 * named, with what to do next. Shown before a type is saved (Library ›
 * Import, Part editor › Check connectors). Saving is still allowed: the
 * problems show as issues wherever the type is placed.
 */
export function ConnectorReport({ report }: { readonly report: PartImportReport }) {
  const t = useEditorTranslate()
  if (report.connectorCount === 0) {
    return (
      <Empty className="border" data-testid="connector-report-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert />
          </EmptyMedia>
          <EmptyTitle>{t('partEditor.report.noneTitle', 'No connectors', { ns: 'editor' })}</EmptyTitle>
          <EmptyDescription>
            {t('partEditor.report.noneWhy', '{{name}} has no connectors, so nothing can be joined to it. Add them in the part editor before connecting this part.', {
              ns: 'editor',
              name: report.typeName,
            })}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  if (report.problems.length === 0) {
    return (
      <Empty className="border" data-testid="connector-report-clean">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CircleCheck />
          </EmptyMedia>
          <EmptyTitle>{t('partEditor.report.allGood', 'Every connector checks out', { ns: 'editor' })}</EmptyTitle>
          <EmptyDescription>
            {report.connectorCount === 1
              ? t('partEditor.report.oneGood', 'Its one connector has a size, a direction out of the part, a system and an end type where one is needed.', { ns: 'editor' })
              : t('partEditor.report.allGoodWhy', 'All {{n}} connectors have a size, a direction out of the part, a system and an end type where one is needed.', {
                  ns: 'editor',
                  n: report.connectorCount,
                })}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }
  return (
    <div className="flex flex-col gap-2" data-testid="connector-report-problems">
      <p className="text-sm">
        {report.problems.length === 1
          ? t('partEditor.report.oneProblem', '1 connector problem on {{name}}. You can still save it; the problems show as issues wherever it is placed.', { ns: 'editor', name: report.typeName })
          : t('partEditor.report.manyProblems', '{{n}} connector problems on {{name}}. You can still save it; the problems show as issues wherever it is placed.', {
              ns: 'editor',
              n: report.problems.length,
              name: report.typeName,
            })}
      </p>
      <ItemGroup className="gap-1" aria-label={t('partEditor.report.problemsOn', 'Connector problems on {{name}}', { ns: 'editor', name: report.typeName })}>
        {report.problems.map((p, i) => (
          <Item key={`${p.connectorId}-${p.check}-${i}`} variant="outline" size="sm">
            <ItemContent>
              <ItemTitle>
                <Badge variant="outline">{p.connectorLabel}</Badge>
                {p.message}
              </ItemTitle>
              <ItemDescription>{p.nextStep}</ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    </div>
  )
}
