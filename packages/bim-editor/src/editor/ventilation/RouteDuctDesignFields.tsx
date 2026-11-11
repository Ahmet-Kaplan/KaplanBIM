'use client'

import { Check } from 'lucide-react'
import {
  COMMON_INSULATION_THICKNESS_IN,
  insulationLabel,
  linerSurface,
  sameSize,
  sizeLabel,
  type DuctInsulation,
  type LinerSurface,
  type RunSize,
} from '@permitzip/bim-kernel'
import {
  ductPerformance,
  sizingCriteriaFor,
  suggestDuctSize,
  type DuctSizeOption,
} from '@permitzip/bim-pack-mechanical'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import type { ExistingSystem, RouteChoices } from '../RoutePanel'
import { inches, mm, routeInsulationChoice, routeSystemDesign } from '../route-design'
import { useEditorTranslate } from '../i18n/translate'

function fpm(v: number) {
  return `${Math.round(v).toLocaleString('en-US')} fpm`
}

function friction(v: number) {
  return `${Math.round(v * 1000) / 1000}" per 100 ft`
}

interface Props {
  choices: RouteChoices
  /** The size the panel describes now, or why it doesn't describe one. */
  size: RunSize | string
  systems: readonly ExistingSystem[]
  onChange: (patch: Partial<RouteChoices>) => void
}

/** Duct only: insulation or liner for the route, and an airflow that suggests a size. */
export function RouteDuctDesignFields({ choices, size, systems, onChange }: Props) {
  const t = useEditorTranslate()
  const sys = routeSystemDesign(choices.system, systems)
  const fallback = sys.design?.insulation
  const kind = choices.insulation === 'default' ? (fallback?.kind ?? 'none') : choices.insulation
  const thicknessIn = choices.insulation === 'default' && fallback ? inches(fallback.thicknessMm) : choices.insulationIn
  const surface: LinerSurface = choices.insulation === 'default' ? (linerSurface(fallback) ?? 'faced') : choices.linerSurface
  const asked = routeInsulationChoice(choices)
  const insulation: DuctInsulation | undefined = asked === undefined ? fallback : (asked ?? undefined)
  const thicknessOptions = [...new Set([...COMMON_INSULATION_THICKNESS_IN.map(String), thicknessIn])]
  const who = sys.name ?? (sys.kind ? t('ventilation.newSystem', 'A new system', { ns: 'editor' }) : t('ventilation.thisSystem', 'This system', { ns: 'editor' }))
  // The kernel says `No insulation`; the sentence around it says `none`, so the word
  // is swapped here rather than spliced raw (§9/Ç-B: kernel labels are Stage 5's).
  const defaultWord = insulationLabel(fallback).replace(t('ventilation.noInsulationKernel', 'No insulation', { ns: 'editor' }), t('ventilation.insulationNoneLower', 'none', { ns: 'editor' }))

  const cfm = Number(choices.airflowCfm)
  const hasAirflow = choices.airflowCfm.trim() !== '' && Number.isFinite(cfm) && cfm > 0
  const criteria = sys.kind ? sizingCriteriaFor(sys.kind, sys.design) : null
  const holdHeightMm = choices.shape === 'rect' && Number(choices.heightIn) > 0 ? mm(Number(choices.heightIn)) : undefined
  const suggestion = hasAirflow && criteria ? suggestDuctSize({ cfm, shape: choices.shape, criteria, ...(insulation ? { insulation } : {}), ...(sys.design ? { design: sys.design } : {}), ...(holdHeightMm ? { holdHeightMm } : {}) }) : null
  const current = hasAirflow && typeof size !== 'string' ? ductPerformance(cfm, size, insulation, sys.design) : null
  const over = current && criteria ? [current.frictionInPer100Ft > criteria.frictionInPer100Ft + 1e-9 ? `over ${friction(criteria.frictionInPer100Ft)}` : null, current.velocityFpm > criteria.maxVelocityFpm + 1e-9 ? `over ${fpm(criteria.maxVelocityFpm)}` : null].filter((x): x is string => x !== null) : []

  const use = (o: DuctSizeOption) => {
    const s = o.size
    if (s.shape === 'rect') onChange({ widthIn: inches(s.width), heightIn: inches(s.height) })
    else if (s.shape === 'round') onChange({ diameterIn: inches(s.diameter) })
  }
  const inUse = (o: DuctSizeOption) => typeof size !== 'string' && sameSize(size, o.size)
  const primary = suggestion?.ok ? (suggestion.atHeight ?? suggestion.best) : null
  const leastMetal = suggestion?.ok && suggestion.atHeight && !sameSize(suggestion.atHeight.size, suggestion.best.size) ? suggestion.best : null

  return (
    <FieldGroup className="flex flex-col gap-2" data-testid="route-duct-design">
      <Field>
        <FieldLabel htmlFor="bm-route-insulation">{t('ventilation.insulation', 'Insulation', { ns: 'editor' })}</FieldLabel>
        <div className="flex items-center gap-2">
          <ToggleGroup
            id="bm-route-insulation"
            type="single"
            variant="outline"
            size="sm"
            value={kind}
            onValueChange={(v) => (v === 'none' || v === 'wrap' || v === 'liner') && onChange({ insulation: v, insulationIn: thicknessIn, linerSurface: surface })}
            aria-label={t('ventilation.insulation', 'Insulation', { ns: 'editor' })}
            data-testid="route-insulation"
          >
            <ToggleGroupItem value="none">{t('ventilation.insulationNone', 'None', { ns: 'editor' })}</ToggleGroupItem>
            <ToggleGroupItem value="wrap">{t('ventilation.insulationWrap', 'Wrap', { ns: 'editor' })}</ToggleGroupItem>
            <ToggleGroupItem value="liner">{t('ventilation.insulationLiner', 'Liner', { ns: 'editor' })}</ToggleGroupItem>
          </ToggleGroup>
          <Select value={thicknessIn} onValueChange={(v) => onChange({ insulation: kind, insulationIn: v, linerSurface: surface })} disabled={kind === 'none'}>
            <SelectTrigger size="sm" aria-label={t('ventilation.insulationThickness', 'Insulation thickness', { ns: 'editor' })} data-testid="route-insulation-thickness">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {thicknessOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace('.5', '½')}&quot;
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        {kind === 'liner' && (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={surface}
            onValueChange={(v) => (v === 'faced' || v === 'spray_coated') && onChange({ insulation: 'liner', insulationIn: thicknessIn, linerSurface: v })}
            aria-label={t('ventilation.linerSurface', 'Liner surface', { ns: 'editor' })}
            data-testid="route-liner-surface"
          >
            <ToggleGroupItem value="faced">{t('ventilation.linerFaced', 'Faced', { ns: 'editor' })}</ToggleGroupItem>
            <ToggleGroupItem value="spray_coated">{t('ventilation.linerSprayCoated', 'Spray-coated', { ns: 'editor' })}</ToggleGroupItem>
          </ToggleGroup>
        )}
        <FieldDescription data-testid="route-insulation-note">
          {choices.insulation === 'default'
            ? `${t('ventilation.systemDefault', '{{who}}’s default: {{value}}.', { ns: 'editor', who, value: defaultWord })}${sys.isNew ? t('ventilation.newSystemKeepsDefault', ' A new system keeps its first route’s choice as its default.', { ns: 'editor' }) : ''}`
            : `${t('ventilation.thisRouteOnly', 'This route only{{extra}}. Liner sits inside the size above and narrows the airway (spray-coated is rougher than faced); wrap goes outside it.', { ns: 'editor', extra: sys.isNew ? t('ventilation.andNewSystemDefault', ', and the new system’s default', { ns: 'editor' }) : '' })}`}
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="bm-route-cfm">{t('ventilation.airflowCfm', 'Airflow (CFM)', { ns: 'editor' })}</FieldLabel>
        <Input id="bm-route-cfm" inputMode="numeric" placeholder={t('ventilation.sizeFromAirflow', 'Size from airflow', { ns: 'editor' })} value={choices.airflowCfm} onChange={(e) => onChange({ airflowCfm: e.target.value })} data-testid="route-airflow" />
        {choices.airflowCfm.trim() !== '' && !hasAirflow && (
          <FieldDescription className="text-danger-600" role="alert">
            {t('ventilation.enterAirflow', 'Enter the airflow as a number of CFM.', { ns: 'editor' })}
          </FieldDescription>
        )}
        {suggestion && !suggestion.ok && (
          <FieldDescription className="text-danger-600" role="alert" data-testid="route-size-refused">
            {suggestion.reason}.
          </FieldDescription>
        )}
        {primary && (
          <div className="flex flex-col gap-1" data-testid="route-size-suggestion">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs">
                {t('ventilation.suggested', 'Suggested', { ns: 'editor' })} <span className="font-medium">{sizeLabel(primary.size)}</span>: {fpm(primary.velocityFpm)}, {friction(primary.frictionInPer100Ft)}
              </span>
              <Button size="sm" variant={inUse(primary) ? 'ghost' : 'outline'} disabled={inUse(primary)} onClick={() => use(primary)} data-testid="route-size-accept">
                {inUse(primary) ? (
                  <>
                    <Check data-icon="inline-start" />
                    {t('ventilation.inUse', 'In use', { ns: 'editor' })}
                  </>
                ) : (
                  t('ventilation.useSize', 'Use {{size}}', { ns: 'editor', size: sizeLabel(primary.size) })
                )}
              </Button>
            </div>
            {leastMetal && (
              <Button size="sm" variant="ghost" className="self-start" onClick={() => use(leastMetal)} data-testid="route-size-least-metal">
                {t('ventilation.orLeastMetal', 'Or {{size}}, the least sheet metal', { ns: 'editor', size: sizeLabel(leastMetal.size) })}
              </Button>
            )}
          </div>
        )}
        {current && typeof size !== 'string' && (
          <FieldDescription className={over.length > 0 ? 'text-warning-700' : undefined} data-testid="route-size-readout">
            {t('ventilation.atSize', 'At {{size}}', { ns: 'editor', size: sizeLabel(size) })}
            {insulation?.kind === 'liner' ? t('ventilation.sizeInside', ' ({{airway}} inside)', { ns: 'editor', airway: sizeLabel(current.airway) }) : ''}: {fpm(current.velocityFpm)}, {friction(current.frictionInPer100Ft)}
            {over.length > 0 ? `, ${over.join(t('ventilation.andConjunction', ' and ', { ns: 'editor' }))}` : ''}.
          </FieldDescription>
        )}
        {criteria && (
          <FieldDescription>
            {t('ventilation.sizingNote', 'Sizes aim for {{friction}} or less and {{velocity}} at most{{aspect}}{{typical}}. Nothing resizes until you choose a size.', {
              ns: 'editor',
              friction: friction(criteria.frictionInPer100Ft),
              velocity: fpm(criteria.maxVelocityFpm),
              aspect: choices.shape === 'rect' ? t('ventilation.upToAspect', ', up to {{ratio}}:1', { ns: 'editor', ratio: criteria.maxAspectRatio }) : '',
              typical: criteria.typical.length > 0 ? t('ventilation.typicalValues', ' (typical values; verify for the project)', { ns: 'editor' }) : '',
            })}
          </FieldDescription>
        )}
      </Field>
      <Field orientation="horizontal">
        <Checkbox id="bm-route-last-flex" checked={choices.lastStretchFlex === true} onCheckedChange={(v) => onChange({ lastStretchFlex: v === true })} data-testid="route-last-stretch-flex" />
        <FieldLabel htmlFor="bm-route-last-flex" className="font-normal">
          {t('ventilation.finishWithFlex', 'Finish with flex into the diffuser or grille', { ns: 'editor' })}
        </FieldLabel>
      </Field>
      <FieldDescription>
        {t('ventilation.lastStretchFlexWhy', 'When the route ends on a diffuser, grille or unit, the stretch from your last click into its neck is flex (6 ft or less is typical). Off: rigid duct all the way.', { ns: 'editor' })}
      </FieldDescription>
    </FieldGroup>
  )
}
