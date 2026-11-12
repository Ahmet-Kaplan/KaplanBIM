'use client'

import { ChevronDown } from 'lucide-react'
import { LINE_WEIGHTS, REFERENCE_DISPLAY_PRESETS, MAX_REFERENCE_TRANSPARENCY_PCT, type ReferenceCategoryDisplay, type ReferenceDisplayPreset } from '@permitzip/bim-kernel'
import { Button } from '../../ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../ui/collapsible'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '../../ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Slider } from '../../ui/slider'
import { useEditorTranslate } from '../i18n/translate'
import type { LinkedDisplay } from './use-linked-display'
import { LinkedDisplayBeforeAfter, LinkedDisplayPreview } from './LinkedDisplayPreview'
import { categoryChoiceWord, categoryListWord, lineSideWord, penWord, presetHint, presetWord } from './linked-display-words'

/**
 * Controls for how a linked model draws: a one-click choice (Normal,
 * Halftone, See-through, Underlay, Hidden) on each linked model card, and in
 * View properties the same choice plus how see-through it is in 3D and
 * per-category exceptions.
 */

function isPreset(value: string): value is ReferenceDisplayPreset {
  return (REFERENCE_DISPLAY_PRESETS as readonly string[]).includes(value)
}

interface SelectProps {
  readonly display: LinkedDisplay
  readonly referenceId: string
  readonly label: string
  /** Why it can't change (shown, and the control stays usable for this tab only when the hook allows it). */
  readonly disabledReason?: string | null
}

/** The one-click display choice for one linked model in whatever is open. */
export function LinkedModelDisplaySelect({ display, referenceId, label, disabledReason = null }: SelectProps) {
  const t = useEditorTranslate()
  const { preset } = display.entry(referenceId)
  const id = `linked-display-${referenceId}`
  return (
    <Field orientation="horizontal" className="gap-2" data-testid="linked-model-display">
      <FieldLabel htmlFor={id} className="shrink-0 text-xs font-normal text-muted-foreground">
        {t('linkedDisplay.inPlace', 'In {{where}}', { ns: 'editor', where: display.targetLabel })}
      </FieldLabel>
      <Select
        value={preset}
        disabled={disabledReason !== null}
        onValueChange={(value) => {
          if (isPreset(value)) display.setPreset(referenceId, label, value)
        }}
      >
        <SelectTrigger id={id} size="sm" className="h-7 min-w-32 text-xs" aria-label={t('linkedDisplay.howDrawsIn', 'How {{name}} draws in {{where}}', { ns: 'editor', name: label, where: display.targetLabel })} title={disabledReason ?? presetHint(preset, t)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {REFERENCE_DISPLAY_PRESETS.map((p) => (
              <SelectItem key={p} value={p} className="text-xs" title={presetHint(p, t)}>
                <LinkedDisplayPreview preset={p} className="h-5 w-8" />
                {presetWord(p, t)}
              </SelectItem>
            ))}
            {preset === 'custom' && (
              <SelectItem value="custom" disabled className="text-xs">
                {presetWord('custom', t)}
              </SelectItem>
            )}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

/** Common categories of an architect's model a person turns down or off. */
export const LINKED_CATEGORIES: readonly string[] = ['IFCWALL', 'IFCDOOR', 'IFCWINDOW', 'IFCSLAB', 'IFCROOF', 'IFCCOVERING', 'IFCCOLUMN', 'IFCFURNISHINGELEMENT']

type CategoryChoice = 'follow' | 'halftone' | 'ink' | 'hidden'
const CATEGORY_CHOICES: readonly CategoryChoice[] = ['follow', 'halftone', 'ink', 'hidden']

function categoryChoice(c: ReferenceCategoryDisplay | undefined): CategoryChoice {
  if (!c) return 'follow'
  if (c.visible === false) return 'hidden'
  if (c.halftone === true) return 'halftone'
  if (c.halftone === false) return 'ink'
  return 'follow'
}

function categoryOverride(choice: CategoryChoice): ReferenceCategoryDisplay | null {
  switch (choice) {
    case 'follow':
      return null
    case 'hidden':
      return { visible: false }
    case 'halftone':
      return { halftone: true }
    case 'ink':
      return { halftone: false }
  }
}

function isCategoryChoice(value: string): value is CategoryChoice {
  return (CATEGORY_CHOICES as readonly string[]).includes(value)
}

interface FieldsProps {
  readonly display: LinkedDisplay
  readonly references: readonly { readonly id: string; readonly label: string }[]
  readonly canEdit: boolean
  readonly disabledHint: string | null
}

/** View properties › Linked models in this view. */
export function LinkedModelDisplayFields({ display, references, canEdit, disabledHint }: FieldsProps) {
  const t = useEditorTranslate()
  const reason = canEdit ? null : disabledHint
  return (
    <FieldGroup className="gap-3" data-testid="linked-model-display-fields">
      {references.map((r) => {
        const { stored, resolved, preset } = display.entry(r.id)
        const sliderId = `linked-transparency-${r.id}`
        return (
          <div key={r.id} className="flex flex-col gap-2" data-testid="linked-model-display-row" data-preset={preset}>
            <p className="text-xs font-medium">{r.label}</p>
            <LinkedModelDisplaySelect display={display} referenceId={r.id} label={r.label} disabledReason={reason} />
            <FieldDescription className="text-xs">{reason ?? presetHint(preset, t)}</FieldDescription>
            <LinkedDisplayBeforeAfter preset={preset} />
            {display.surface === 'drawing' && resolved.visible && (
              <div className="grid grid-cols-2 gap-2" data-testid="linked-model-pens">
                {(['cut', 'beyond'] as const).map((kind) => {
                  const current = kind === 'cut' ? stored?.cutPen : stored?.beyondPen
                  return (
                    <Field key={kind}>
                      <FieldLabel htmlFor={`linked-pen-${kind}-${r.id}`} className="text-xs font-normal">
                        {kind === 'cut'
                          ? t('linkedDisplay.cutLines', 'Cut lines (walls)', { ns: 'editor' })
                          : t('linkedDisplay.belowCutLines', 'Lines below the cut', { ns: 'editor' })}
                      </FieldLabel>
                      <Select
                        value={current ?? 'default'}
                        disabled={!canEdit}
                        onValueChange={(value) => {
                          const pen = LINE_WEIGHTS.find((w) => w === value) ?? null
                          if (pen !== (current ?? null)) display.setPen(r.id, r.label, kind, pen)
                        }}
                      >
                        <SelectTrigger id={`linked-pen-${kind}-${r.id}`} size="sm" className="h-7 text-xs" aria-label={t('linkedDisplay.lineWeight', '{{name}} {{where}} line weight', { ns: 'editor', name: r.label, where: lineSideWord(kind, t) })}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="default" className="text-xs">
                              {kind === 'cut'
                                ? t('linkedDisplay.defaultWide', 'Default (wide)', { ns: 'editor' })
                                : t('linkedDisplay.defaultThin', 'Default (thin)', { ns: 'editor' })}
                            </SelectItem>
                            {LINE_WEIGHTS.map((w) => (
                              <SelectItem key={w} value={w} className="text-xs">
                                {penWord(w, t)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  )
                })}
              </div>
            )}
            {display.surface === '3d' && resolved.visible && (
              <Field>
                <FieldLabel htmlFor={sliderId} className="text-xs font-normal">
                  {t('linkedDisplay.seeThroughIn3d', 'See-through in 3D: {{pct}}%', { ns: 'editor', pct: resolved.transparencyPct })}
                </FieldLabel>
                <Slider
                  id={sliderId}
                  min={0}
                  max={MAX_REFERENCE_TRANSPARENCY_PCT}
                  step={5}
                  value={[resolved.transparencyPct]}
                  disabled={!canEdit}
                  aria-label={t('linkedDisplay.howSeeThrough', 'How see-through {{name}} is in 3D', { ns: 'editor', name: r.label })}
                  onValueCommit={([pct]) => {
                    if (pct !== undefined && pct !== resolved.transparencyPct) display.setTransparency(r.id, r.label, pct)
                  }}
                />
              </Field>
            )}
            {resolved.visible && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-fit px-1 text-xs">
                    <ChevronDown data-icon="inline-start" />
                    {Object.keys(resolved.categories).length > 0
                      ? t('linkedDisplay.byCategoryChanged', 'By category ({{count}} changed)', { ns: 'editor', count: Object.keys(resolved.categories).length })
                      : t('linkedDisplay.byCategory', 'By category', { ns: 'editor' })}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <FieldGroup className="gap-1 pl-2">
                    {LINKED_CATEGORIES.map((c) => {
                      const id = `linked-cat-${r.id}-${c}`
                      const choice = categoryChoice(stored?.categories?.[c])
                      return (
                        <Field key={c} orientation="horizontal" className="justify-between gap-2">
                          <FieldContent>
                            <FieldLabel htmlFor={id} className="text-xs font-normal">
                              {categoryListWord(c, t)}
                            </FieldLabel>
                          </FieldContent>
                          <Select
                            value={choice}
                            disabled={!canEdit}
                            onValueChange={(value) => {
                              if (isCategoryChoice(value) && value !== choice) display.setCategory(r.id, r.label, c, categoryOverride(value))
                            }}
                          >
                            <SelectTrigger
                              id={id}
                              size="sm"
                              className="h-7 w-32 text-xs"
                              aria-label={t('linkedDisplay.categoryOf', '{{category}} of {{name}}', { ns: 'editor', category: categoryListWord(c, t), name: r.label })}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {CATEGORY_CHOICES.map((k) => (
                                  <SelectItem key={k} value={k} className="text-xs">
                                    {categoryChoiceWord(k, t)}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>
                      )
                    })}
                  </FieldGroup>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )
      })}
    </FieldGroup>
  )
}
