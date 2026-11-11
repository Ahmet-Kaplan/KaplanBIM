'use client'

import { useMemo, useState } from 'react'
import { Link2Off, Trash2 } from 'lucide-react'
import {
  QUANTITIES,
  connectionTypeOfLoadPoint,
  elementValues,
  formatQuantity,
  loadPointFindingsFor,
  loadPointLabel,
  loadPointLoad,
  loadPointQuantities,
  loadPointSystemKind,
  primaryQuantity,
  runEndOf,
  type CatalogTrade,
  type Command,
  type LoadPointElement,
  type ModelState,
  type QuantityKey,
  type SystemKind,
} from '@permitzip/bim-kernel'
import { Alert, AlertDescription } from '../../ui/alert'
import { Button } from '../../ui/button'
import { ConfirmAction } from '../../ui/confirm-action'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Separator } from '../../ui/separator'
import { ConnectionTypeSelect } from '../connection-types/ConnectionTypeSelect'
import { useEditorTranslate } from '../i18n/translate'

/** Which connection types a pipe end lists: gas on gas, air on duct, plumbing on the rest. */
export function tradeForSystem(kind: SystemKind | null, domain: string | null): CatalogTrade {
  if (domain === 'duct') return 'mechanical'
  if (kind === 'natural_gas') return 'gas'
  return 'plumbing'
}

/** The values a load point's form shows, by trade: few, the ones that trade sizes with. */
const FIELDS: Readonly<Record<CatalogTrade, readonly QuantityKey[]>> = {
  plumbing: ['wsfu_cold', 'wsfu_hot', 'wsfu_total', 'dfu', 'gph_demand'],
  gas: ['mbh', 'min_inlet_pressure'],
  mechanical: ['cfm'],
  electrical: ['va'],
}

const FIXTURE_CATEGORIES = new Set(['plumbing_fixture', 'pipe_accessory', 'mechanical_equipment', 'air_terminal'])

/**
 * A load point's properties: what is connected at this pipe end, its
 * connection type and loads (the type's values, with this point's own on
 * top), the fixture it stands for, and what it adds to the pipe. Every edit
 * is one undoable command, the same one bim_edit_load_point sends.
 */
export function LoadPointProperties({ model, point, canEdit, onCommand }: { readonly model: ModelState; readonly point: LoadPointElement; readonly canEdit: boolean; readonly onCommand: (command: Command) => string | null }) {
  const t = useEditorTranslate()
  const runEnd = runEndOf(point)
  const host = runEnd ? model.elements[runEnd.elementId] : undefined
  const kind = loadPointSystemKind(model.elements, point)
  const trade = tradeForSystem(kind, host?.kind === 'run_segment' || host?.kind === 'run_fitting' ? host.domain : null)
  const bag = loadPointQuantities(model.elements, point)
  const type = connectionTypeOfLoadPoint(model.elements, point)
  const findings = loadPointFindingsFor(model.elements, point)
  const adds = primaryQuantity(kind)
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS[trade].map((k) => [k, point.values[k] === undefined ? '' : String(point.values[k])])))
  const [mark, setMark] = useState(point.mark ?? '')
  const [fixture, setFixture] = useState('')
  const [error, setError] = useState<string | null>(null)
  const blocked = canEdit ? null : t('plumbing.notLive', "Live editing isn't connected, so changes can't be saved", { ns: 'editor' })
  const fixtures = useMemo(
    () =>
      elementValues(model.elements).flatMap((el) => {
        if (el.kind !== 'part') return []
        const t = model.elements[el.typeId]
        return t?.kind === 'part_type' && FIXTURE_CATEGORIES.has(t.definition.category) ? [{ id: el.id, name: `${el.mark || t.definition.familyName}${el.mark ? ` · ${t.definition.familyName}` : ''}` }] : []
      }),
    [model.elements],
  )
  const send = (command: Command) => setError(onCommand(command))

  const saveValues = (e: React.FormEvent) => {
    e.preventDefault()
    const values: Record<string, number> = {}
    const reset: QuantityKey[] = []
    for (const k of FIELDS[trade]) {
      const raw = (draft[k] ?? '').trim()
      if (raw === '') {
        if (point.values[k] !== undefined) reset.push(k)
        continue
      }
      const n = Number(raw)
      if (!Number.isFinite(n) || n < 0) return setError(t('plumbing.mustBeANumber', '{{label}} must be a number, 0 or more.', { ns: 'editor', label: QUANTITIES[k].label }))
      values[k] = n
    }
    send({ type: 'edit_load_point', loadPointId: point.id, values, ...(reset.length > 0 ? { reset } : {}), ...(mark.trim() !== (point.mark ?? '') ? { mark: mark.trim() } : {}) })
  }

  return (
    <div className="flex flex-col gap-3" data-testid="load-point-properties" data-load-point-id={point.id}>
      <span className="text-sm font-medium">{loadPointLabel(model.elements, point)}</span>
      {findings.map((f) => (
        <Alert key={f.code} className="border-warning-300 bg-warning-50">
          <AlertDescription className="text-xs">{f.message}</AlertDescription>
        </Alert>
      ))}
      <FieldDescription className="text-xs" data-testid="load-point-adds">
        {adds
          ? t('plumbing.addsToThisPipe', 'Adds {{amount}} to this pipe', { ns: 'editor', amount: formatQuantity(adds, loadPointLoad(model.elements, point)) })
          : t('plumbing.addsNothing', 'Adds nothing this pipe sizes on (vent)', { ns: 'editor' })}
        {point.schematic ? t('plumbing.aLumpToBreakOut', ' · a lump to break out later', { ns: 'editor' }) : ''}
      </FieldDescription>
      <Field>
        <FieldLabel htmlFor={`lp-type-${point.id}`} className="text-xs">
          {t('plumbing.connectionType', 'Connection type', { ns: 'editor' })}
        </FieldLabel>
        <ConnectionTypeSelect
          model={model}
          trade={trade}
          id={`lp-type-${point.id}`}
          value={point.connectionType || '__none__'}
          noneLabel={t('plumbing.noneOnlyOwnValues', "None (only this point's own values)", { ns: 'editor' })}
          disabled={!canEdit}
          testId="load-point-connection-type"
          onChange={(v) => send({ type: 'edit_load_point', loadPointId: point.id, connectionType: v === '__none__' ? '' : v })}
        />
        {type && (
          <FieldDescription className="text-xs">
            {type.comments ? t('plumbing.typeComments', '{{comments}}. ', { ns: 'editor', comments: type.comments }) : ''}
            {t('plumbing.editingTheTypeChanges', 'Editing the type changes every point and fixture naming it.', { ns: 'editor' })}
          </FieldDescription>
        )}
      </Field>
      <form onSubmit={saveValues} className="flex flex-col gap-2" data-testid="load-point-values">
        <FieldGroup className="grid grid-cols-2 gap-2">
          {FIELDS[trade].map((k) => (
            <Field key={k}>
              <FieldLabel htmlFor={`lp-${k}-${point.id}`} className="text-xs">
                {QUANTITIES[k].label} ({QUANTITIES[k].unit})
              </FieldLabel>
              <Input
                id={`lp-${k}-${point.id}`}
                inputMode="decimal"
                value={draft[k] ?? ''}
                placeholder={bag[k] === undefined ? '—' : t('plumbing.amountFromType', '{{amount}} from {{type}}', { ns: 'editor', amount: bag[k] ?? '', type: point.connectionType || t('plumbing.typeLower', 'type', { ns: 'editor' }) })}
                onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                disabled={!canEdit}
              />
            </Field>
          ))}
          <Field>
            <FieldLabel htmlFor={`lp-mark-${point.id}`} className="text-xs">
              {t('plumbing.fixtureMark', 'Fixture mark', { ns: 'editor' })}
            </FieldLabel>
            <Input id={`lp-mark-${point.id}`} value={mark} placeholder="K01-2" onChange={(e) => setMark(e.target.value)} disabled={!canEdit} />
          </Field>
        </FieldGroup>
        <FieldDescription className="text-xs">
          {t(
            'plumbing.blankUsesTheConnectionType',
            'Blank uses the connection type’s value. A fixture’s cold and hot points share its mark, so the service counts its total units.',
            { ns: 'editor' },
          )}
        </FieldDescription>
        <Button type="submit" size="sm" disabled={!canEdit} title={blocked ?? undefined} data-testid="load-point-save">
          {t('plumbing.saveLoads', 'Save loads', { ns: 'editor' })}
        </Button>
      </form>
      <Separator />
      {point.attachedPartId ? (
        <div className="flex items-center gap-2">
          <FieldDescription className="flex-1 text-xs" data-testid="load-point-fixture">
            {t('plumbing.standsFor', 'Stands for {{name}}; its loads are this point’s.', {
              ns: 'editor',
              name: fixtures.find((f) => f.id === point.attachedPartId)?.name ?? point.attachedPartId,
            })}
          </FieldDescription>
          <Button
            size="sm"
            variant="outline"
            disabled={!canEdit}
            title={blocked ?? t('plumbing.pointKeepsItsLoads', 'The point keeps its loads', { ns: 'editor' })}
            onClick={() => send({ type: 'detach_part_from_load_point', loadPointId: point.id })}
          >
            <Link2Off data-icon="inline-start" />
            {t('plumbing.detach', 'Detach', { ns: 'editor' })}
          </Button>
        </div>
      ) : (
        <Field>
          <FieldLabel htmlFor={`lp-fixture-${point.id}`} className="text-xs">
            {t('plumbing.attachAFixture', 'Attach a fixture', { ns: 'editor' })}
          </FieldLabel>
          <div className="flex gap-1">
            <Select value={fixture} onValueChange={setFixture} disabled={!canEdit || fixtures.length === 0}>
              <SelectTrigger id={`lp-fixture-${point.id}`} size="sm" className="flex-1">
                <SelectValue
                  placeholder={
                    fixtures.length === 0
                      ? t('plumbing.noFixturesPlacedYet', 'No fixtures placed yet', { ns: 'editor' })
                      : t('plumbing.pickTheFixture', 'Pick the fixture', { ns: 'editor' })
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {fixtures.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled={!canEdit || fixture === ''}
              title={fixture === '' ? t('plumbing.pickTheFixtureFirst', 'Pick the fixture first', { ns: 'editor' }) : (blocked ?? undefined)}
              onClick={() => send({ type: 'attach_part_to_load_point', loadPointId: point.id, partId: fixture })}
            >
              {t('plumbing.attach', 'Attach', { ns: 'editor' })}
            </Button>
          </div>
          <FieldDescription className="text-xs">
            {t('plumbing.itTakesThisPointsType', 'It takes this point’s connection type and loads; totals don’t change.', { ns: 'editor' })}
          </FieldDescription>
        </Field>
      )}
      {error && (
        <FieldDescription className="text-xs text-danger-600" role="alert" data-testid="load-point-error">
          {error}
        </FieldDescription>
      )}
      <ConfirmAction
        title={t('plumbing.deleteThisLoadPointQ', 'Delete this load point?', { ns: 'editor' })}
        description={t(
          'plumbing.deleteThisLoadPointWhy',
          'The pipe stops carrying its loads. An attached fixture stays, with its connection type. Undo brings it back.',
          { ns: 'editor' },
        )}
        confirmLabel={t('plumbing.deleteWord', 'Delete', { ns: 'editor' })}
        destructive
        onConfirm={() => send({ type: 'delete_load_points', loadPointIds: [point.id] })}
      >
        <Button variant="outline" size="sm" disabled={!canEdit} title={blocked ?? undefined}>
          <Trash2 data-icon="inline-start" />
          {t('plumbing.deleteLoadPoint', 'Delete load point', { ns: 'editor' })}
        </Button>
      </ConfirmAction>
    </div>
  )
}
