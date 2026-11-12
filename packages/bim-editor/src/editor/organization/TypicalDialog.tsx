'use client'

import { useState } from 'react'
import { MAX_TYPICAL_COPIES, arrayCopies, type GroupEntry, type Resolved, type TypicalCapStatus } from '@permitzip/bim-kernel'
import { Alert, AlertDescription } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Switch } from '../../ui/switch'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import { useEditorTranslate } from '../i18n/translate'
import { parseLength } from '../views-sheets/draft/draft-input'
import type { SubmitCommand } from '../views-sheets/types'

const FT = 304.8

interface Props {
  readonly group: Resolved<GroupEntry>
  readonly elementCount: number
  /** How many typical types the project has against the contract's cap. */
  readonly capStatus?: TypicalCapStatus
  readonly canEdit: boolean
  readonly blockedReason: string
  readonly submit: SubmitCommand
  readonly onClose: () => void
}

function feet(mm: number): string {
  return `${Math.round((mm / FT) * 100) / 100}'`
}

/**
 * Make a group a typical unit or bay: how many there are in all, laid out in
 * rows, and how far apart. The copies draw on plans and their loads count on
 * whatever serves the group from outside it (24 units: 24 times the load on
 * the house panel). Editing the original edits every copy.
 */
export function TypicalDialog({ group, elementCount, capStatus, canEdit, blockedReason, submit, onClose }: Props) {
  const t = useEditorTranslate()
  const spec = group.entry.typical
  // Making a new typical adds a type; changing an existing one's copies does not.
  const wouldBe = capStatus ? capStatus.count + (spec ? 0 : 1) : 0
  const overCap = capStatus !== undefined && wouldBe > capStatus.cap
  const first = spec?.copies[0]
  const across = spec ? Math.max(1, spec.copies.findIndex((c) => Math.abs(c.offset.y) > 1e-6) + 1 || spec.copies.length + 1) : 6
  const down = spec?.copies.find((c) => Math.abs(c.offset.y) > 1e-6)
  const [label, setLabel] = useState(spec?.label ?? t('org.typical.unit', 'Unit', { ns: 'editor' }))
  const [mark, setMark] = useState(spec?.mark ?? '001')
  const [count, setCount] = useState(String(spec ? spec.copies.length + 1 : 24))
  const [columns, setColumns] = useState(String(across))
  const [dx, setDx] = useState(first ? feet(first.offset.x) : "40'")
  const [dy, setDy] = useState(down ? feet(down.offset.y) : "-30'")
  const [error, setError] = useState<string | null>(null)
  const [spread, setSpread] = useState(spec?.phaseRotation !== 'same')
  // Mirror every other copy (the unit next door handed the other way); the per-copy checks then run on the mirrored layout.
  const mirrored = spec?.copies.find((c) => c.mirror)
  const [mirror, setMirror] = useState(mirrored !== undefined)
  const [mirrorAxis, setMirrorAxis] = useState<'x' | 'y'>(mirrored?.mirror?.axis ?? 'x')

  const n = Number(count)
  const cols = Number(columns)
  const sx = parseLength(dx)
  const sy = parseLength(dy.trim().startsWith('-') ? dy.trim().slice(1) : dy)
  const spacingY = sy === null ? null : dy.trim().startsWith('-') ? -sy : sy
  const reason = !canEdit
    ? blockedReason
    : elementCount === 0
      ? t('org.typical.needsOneUnit', '"{{name}}" has nothing in it. Put one unit’s panel and devices in it first.', { ns: 'editor', name: group.entry.name })
      : !Number.isInteger(n) || n < 1 || n > MAX_TYPICAL_COPIES
        ? t('org.typical.countRange', 'How many must be a whole number from 1 to {{max}}.', { ns: 'editor', max: MAX_TYPICAL_COPIES })
        : !Number.isInteger(cols) || cols < 1 || cols > 100
          ? t('org.typical.acrossRange', 'Across must be a whole number from 1 to 100.', { ns: 'editor' })
          : sx === null || spacingY === null
            ? t('org.typical.spacingIsALength', "Type the spacing as a length, like 40' or 12.5'.", { ns: 'editor' })
            : mark.trim() === ''
              ? t('org.typical.giveAMark', 'Give this unit a mark, like 001.', { ns: 'editor' })
              : null

  const apply = () => {
    if (reason || sx === null || spacingY === null) return
    const unit = t('org.typical.unit', 'Unit', { ns: 'editor' })
    const base = { type: 'set_group_typical' as const, groupId: group.id, label: label.trim() || unit, mark: mark.trim(), phaseRotation: spread ? ('rotate' as const) : ('same' as const) }
    const laidOut = mirror
      ? { copies: arrayCopies(group.id, mark.trim(), n, cols, { x: sx, y: spacingY }).map((c, i) => ({ mark: c.mark, offset: c.offset, rotationDeg: c.rotationDeg, ...(i % 2 === 0 ? { mirror: { axis: mirrorAxis } } : {}) })) }
      : { array: { count: n, columns: cols, spacingMm: { x: sx, y: spacingY } } }
    const refusal = submit(
      { ...base, ...laidOut },
      mirror
        ? t('org.undo.makeTypicalMirrored', 'make {{name}} a typical of {{n}}, every other one mirrored', { ns: 'editor', name: group.entry.name, n })
        : t('org.undo.makeTypical', 'make {{name}} a typical of {{n}}', { ns: 'editor', name: group.entry.name, n }),
    )
    setError(refusal)
    if (!refusal) onClose()
  }

  /** Which way a mirrored copy is turned: the toggle's own two words, in the case a sentence puts them in. */
  const axisWord = mirrorAxis === 'x' ? t('org.typical.mirroredLeftForRight', 'left for right', { ns: 'editor' }) : t('org.typical.mirroredFrontForBack', 'front for back', { ns: 'editor' })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="typical-dialog">
        <DialogHeader>
          <DialogTitle>{t('org.typical.title', '{{name}}: typical', { ns: 'editor', name: group.entry.name })}</DialogTitle>
          <DialogDescription>
            {t(
              'org.typical.description',
              'Draw this group once and repeat it. Copies show on plans, and every trade’s loads (power, water, drainage, gas, air) count once per copy wherever they are added up from outside it: a house panel, the building drain, the project totals.',
              { ns: 'editor' },
            )}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="typical-label">{t('org.typical.eachOne', 'Each one is a', { ns: 'editor' })}</FieldLabel>
            <Input id="typical-label" value={label} maxLength={40} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="typical-mark">{t('org.typical.thisOnesMark', 'This one’s mark', { ns: 'editor' })}</FieldLabel>
            <Input id="typical-mark" value={mark} maxLength={20} onChange={(e) => setMark(e.target.value)} data-testid="typical-mark" />
          </Field>
          <Field>
            <FieldLabel htmlFor="typical-count">{t('org.typical.howMany', 'How many in all', { ns: 'editor' })}</FieldLabel>
            <Input id="typical-count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} data-testid="typical-count" />
          </Field>
          <Field>
            <FieldLabel htmlFor="typical-columns">{t('org.typical.across', 'Across', { ns: 'editor' })}</FieldLabel>
            <Input id="typical-columns" inputMode="numeric" value={columns} onChange={(e) => setColumns(e.target.value)} data-testid="typical-columns" />
          </Field>
          <Field>
            <FieldLabel htmlFor="typical-dx">{t('org.typical.spacingAcross', 'Spacing across', { ns: 'editor' })}</FieldLabel>
            <Input id="typical-dx" value={dx} onChange={(e) => setDx(e.target.value)} data-testid="typical-dx" />
          </Field>
          <Field>
            <FieldLabel htmlFor="typical-dy">{t('org.typical.spacingBetweenRows', 'Spacing between rows', { ns: 'editor' })}</FieldLabel>
            <Input id="typical-dy" value={dy} onChange={(e) => setDy(e.target.value)} data-testid="typical-dy" />
            <FieldDescription>{t('org.typical.negativeGoesDown', 'Negative goes down the plan.', { ns: 'editor' })}</FieldDescription>
          </Field>
          <Field orientation="horizontal" className="col-span-2">
            <Switch id="typical-spread" checked={spread} onCheckedChange={setSpread} data-testid="typical-spread" />
            <FieldLabel htmlFor="typical-spread">{t('org.typical.spreadOverPhases', 'Spread copies over the phases (A-B, B-C, C-A)', { ns: 'editor' })}</FieldLabel>
            <FieldDescription>
              {t(
                'org.typical.spreadWhy',
                "On a 3-phase house panel each unit panel gets its own breaker; off puts every copy on this one's phases.",
                { ns: 'editor' },
              )}
            </FieldDescription>
          </Field>
          <Field orientation="horizontal" className="col-span-2">
            <Switch id="typical-mirror" checked={mirror} onCheckedChange={setMirror} data-testid="typical-mirror" />
            <FieldLabel htmlFor="typical-mirror">{t('org.typical.mirrorEveryOther', 'Mirror every other one', { ns: 'editor' })}</FieldLabel>
            {mirror && (
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={mirrorAxis}
                onValueChange={(v) => (v === 'x' || v === 'y') && setMirrorAxis(v)}
                aria-label={t('org.typical.howCopiesMirrored', 'How copies are mirrored', { ns: 'editor' })}
                data-testid="typical-mirror-axis"
              >
                <ToggleGroupItem value="x">{t('org.typical.leftForRight', 'Left for right', { ns: 'editor' })}</ToggleGroupItem>
                <ToggleGroupItem value="y">{t('org.typical.frontForBack', 'Front for back', { ns: 'editor' })}</ToggleGroupItem>
              </ToggleGroup>
            )}
          </Field>
        </FieldGroup>
        {Number.isInteger(n) && n > 1 && !reason && (
          <p className="text-sm text-muted-foreground" data-testid="typical-summary">
            {t('org.typical.summaryHead', '{{n}} {{label}}s: {{mark}} and {{copies}} copies, {{cols}} across', {
              ns: 'editor',
              n,
              label: label.trim().toLowerCase() || t('org.typical.unitWord', 'unit', { ns: 'editor' }),
              mark: mark.trim(),
              copies: n - 1,
              cols,
            })}
            {mirror
              ? t('org.typical.summaryMirrored', '; every other copy mirrored {{axis}} ({{marks}}), and the intake and exhaust checks run on the mirrored layout', {
                  ns: 'editor',
                  axis: axisWord,
                  marks: arrayCopies(group.id, mark.trim(), Math.min(n, 6), cols, { x: 1, y: 1 })
                    .filter((_, i) => i % 2 === 0)
                    .map((c) => c.mark)
                    .join(', ') + (n > 6 ? '…' : ''),
                })
              : ''}
            {t('org.typical.summaryTail', '. Their loads count {{n}}× at the house panel, the building drain and in the project totals, once inside {{mark}} itself.', {
              ns: 'editor',
              n,
              mark: mark.trim(),
            })}
          </p>
        )}
        {overCap && capStatus && (
          <Alert className="border-warning-300 bg-warning-50" data-testid="typical-over-cap">
            <AlertDescription>
              {spec
                ? t('org.typical.overCapExisting', 'This project has {{n}} typicals; the contract covers {{cap}}. You can still go ahead; agree the extra ones with the client.', {
                    ns: 'editor',
                    n: wouldBe,
                    cap: capStatus.cap,
                  })
                : t('org.typical.overCapNew', 'Making this a typical gives the project {{n}} typicals; the contract covers {{cap}}. You can still go ahead; agree the extra ones with the client.', {
                    ns: 'editor',
                    n: wouldBe,
                    cap: capStatus.cap,
                  })}
            </AlertDescription>
          </Alert>
        )}
        {(error ?? reason) && (
          <Alert variant={error ? 'destructive' : 'default'} data-testid="typical-reason">
            <AlertDescription>{error ?? reason}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          {spec && (
            <Button
              variant="outline"
              disabled={!canEdit}
              onClick={() => {
                const refusal = submit({ type: 'clear_group_typical', groupId: group.id }, t('org.undo.stopRepeating', 'stop repeating {{name}}', { ns: 'editor', name: group.entry.name }))
                setError(refusal)
                if (!refusal) onClose()
              }}
              data-testid="typical-clear"
            >
              {t('org.typical.stopRepeating', 'Stop repeating', { ns: 'editor' })}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {t('org.cancel', 'Cancel', { ns: 'editor' })}
          </Button>
          <Button disabled={reason !== null} onClick={apply} data-testid="typical-apply">
            {spec ? t('org.typical.updateCopies', 'Update copies', { ns: 'editor' }) : t('org.typical.makeTypical', 'Make typical', { ns: 'editor' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
