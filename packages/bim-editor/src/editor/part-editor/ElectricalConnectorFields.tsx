'use client'

import { ELECTRICAL_LOAD_CLASSES, type ParamDef, type PartConnector } from '@permitzip/bim-kernel'
import { loadClassLabel, parseLoadClass } from '@permitzip/bim-pack-electrical'
import { Checkbox } from '../../ui/checkbox'
import { Field, FieldLabel } from '../../ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { useEditorTranslate } from '../i18n/translate'
import { DimField } from './DimField'
import { peId } from './field-id'

const FROM_CATEGORY = '__category__'

/**
 * A power connector's electrical fields: voltage, poles, design load, load
 * class, continuous and motor horsepower. These are what circuiting checks
 * (voltage and poles against the panel) and what the load totals count
 * (load, class, continuous at 125%, a motor through the code's tables).
 * Numbers or the part's own parameters, like every other connector field.
 */
export function ElectricalConnectorFields({ connector, params, disabled, onChange }: { connector: PartConnector; params: readonly ParamDef[]; disabled: boolean; onChange: (patch: Partial<PartConnector>) => void }) {
  const t = useEditorTranslate()
  const id = connector.id
  const loadClass = connector.loadClass ? parseLoadClass(connector.loadClass) : null
  return (
    <div className="grid grid-cols-2 gap-1" data-testid={peId('c', id, 'electrical')}>
      <DimField
        id={peId('c', id, 'voltage')}
        label={t('partEditor.connector.voltage', 'Voltage (V)', { ns: 'editor' })}
        unit="deg"
        value={connector.voltage ?? 0}
        params={params}
        disabled={disabled}
        onChange={(dim) => onChange({ voltage: dim })}
      />
      <Field>
        <FieldLabel htmlFor={peId('c', id, 'poles')}>{t('partEditor.connector.poles', 'Poles', { ns: 'editor' })}</FieldLabel>
        <Select value={String(connector.poles ?? 1)} onValueChange={(v) => onChange({ poles: Number(v) })} disabled={disabled}>
          <SelectTrigger id={peId('c', id, 'poles')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="1">{t('partEditor.connector.onePole', '1 pole (line to neutral)', { ns: 'editor' })}</SelectItem>
              <SelectItem value="2">{t('partEditor.connector.twoPoles', '2 poles (line to line)', { ns: 'editor' })}</SelectItem>
              <SelectItem value="3">{t('partEditor.connector.threePoles', '3 poles (3-phase)', { ns: 'editor' })}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <DimField
        id={peId('c', id, 'load')}
        label={t('partEditor.connector.load', 'Load (VA)', { ns: 'editor' })}
        unit="deg"
        value={connector.flow ?? 0}
        params={params}
        disabled={disabled}
        onChange={(dim) => onChange({ flow: dim })}
      />
      <Field>
        <FieldLabel htmlFor={peId('c', id, 'class')}>{t('partEditor.connector.loadClass', 'Load class', { ns: 'editor' })}</FieldLabel>
        <Select value={loadClass ?? FROM_CATEGORY} onValueChange={(v) => onChange({ loadClass: v === FROM_CATEGORY ? undefined : v })} disabled={disabled}>
          <SelectTrigger id={peId('c', id, 'class')} size="sm" data-testid={peId('c', id, 'class')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={FROM_CATEGORY}>{t('partEditor.connector.fromCategory', "From the part's category", { ns: 'editor' })}</SelectItem>
              {ELECTRICAL_LOAD_CLASSES.map((c) => (
                <SelectItem key={c} value={c}>
                  {loadClassLabel(c)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <DimField
        id={peId('c', id, 'hp')}
        label={t('partEditor.connector.motorHp', 'Motor (hp)', { ns: 'editor' })}
        unit="deg"
        value={connector.motorHp ?? 0}
        params={params}
        disabled={disabled}
        onChange={(dim) => onChange({ motorHp: dim === 0 ? undefined : dim })}
      />
      <Field orientation="horizontal" className="items-center self-end pb-1">
        <Checkbox
          id={peId('c', id, 'continuous')}
          checked={connector.continuous ?? loadClass === 'lighting'}
          disabled={disabled}
          onCheckedChange={(v) => onChange({ continuous: v === true })}
          aria-label={t('partEditor.connector.continuousAria', 'Runs 3 hours or more (continuous, sized at 125%)', { ns: 'editor' })}
        />
        <FieldLabel htmlFor={peId('c', id, 'continuous')} className="text-xs font-normal">
          {t('partEditor.connector.continuous', 'Continuous (3 h or more)', { ns: 'editor' })}
        </FieldLabel>
      </Field>
    </div>
  )
}
