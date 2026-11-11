'use client'

import { type ViewElement, type ViewPropsPatch } from '@permitzip/bim-kernel'
import { resolveCircuitGraphics, type CircuitGraphicStyle, type CircuitGraphicsProps, type HashMarkStyle } from '@permitzip/bim-pack-electrical'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '../../ui/field'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import { useEditorTranslate, type Translate } from '../i18n/translate'

/** How circuits can draw, in the language on screen. */
function circuitStyles(t: Translate): ReadonlyArray<{ readonly value: CircuitGraphicStyle; readonly label: string; readonly hint: string }> {
  return [
    {
      value: 'arcs',
      label: t('circuits.styleArcs', 'Arcs', { ns: 'editor' }),
      hint: t('circuits.styleArcsHint', 'Curved lines join each circuit’s devices, with a home run on the one nearest the panel.', { ns: 'editor' }),
    },
    {
      value: 'orthogonal',
      label: t('circuits.styleSquare', 'Square', { ns: 'editor' }),
      hint: t(
        'circuits.styleSquareHint',
        'Lines with 90° corners. Drag a line on the drawing to move its corner; it stays where you put it.',
        { ns: 'editor' },
      ),
    },
    {
      value: 'numbers',
      label: t('circuits.styleNumbers', 'Numbers', { ns: 'editor' }),
      hint: t('circuits.styleNumbersHint', 'The circuit number beside each device and one home run per circuit (multifamily style).', { ns: 'editor' }),
    },
    { value: 'off', label: t('circuits.styleOff', 'Off', { ns: 'editor' }), hint: t('circuits.styleOffHint', 'No circuiting on this plan.', { ns: 'editor' }) },
  ];
}

type Mark = 'hot' | 'neutral' | 'ground'

/** Wire hash marks (round 12), each with a picture of a 1-pole home run as it draws. */
/** Wire hash marks (round 12), each with a picture of a 1-pole home run as it draws. */
function hashMarks(t: Translate): ReadonlyArray<{ readonly value: HashMarkStyle; readonly label: string; readonly hint: string; readonly marks: readonly Mark[] }> {
  return [
    { value: 'off', label: t('circuits.marksNone', 'None', { ns: 'editor' }), hint: t('circuits.marksNoneHint', 'No marks on the home runs.', { ns: 'editor' }), marks: [] },
    {
      value: 'hots_neutral',
      label: t('circuits.marksHotNeutral', 'Hot + neutral', { ns: 'editor' }),
      hint: t('circuits.marksHotNeutralHint', 'A long mark for each hot wire and a short one for the neutral.', { ns: 'editor' }),
      marks: ['hot', 'neutral'],
    },
    {
      value: 'hots_neutral_ground',
      label: t('circuits.marksWithGround', 'With ground', { ns: 'editor' }),
      hint: t('circuits.marksWithGroundHint', 'Hots long, the neutral short, and the ground as a long mark with a foot.', { ns: 'editor' }),
      marks: ['hot', 'neutral', 'ground'],
    },
  ];
}

/** A 48 × 20 picture: a home run with its marks, as the plan draws them. */
function HashMarkPicture({ marks }: { readonly marks: readonly Mark[] }) {
  const cx = 24
  return (
    <svg width={48} height={20} viewBox="0 0 48 20" aria-hidden className="text-foreground">
      <line x1={4} y1={10} x2={40} y2={10} stroke="currentColor" strokeWidth={1.2} />
      <polyline points="36,7 41,10 36,13" fill="none" stroke="currentColor" strokeWidth={1.2} />
      {marks.map((m, i) => {
        const x = cx + (i - (marks.length - 1) / 2) * 4
        const half = m === 'neutral' ? 3 : 5
        return (
          <g key={i}>
            <line x1={x - 1.5} y1={10 + half} x2={x + 1.5} y2={10 - half} stroke="currentColor" strokeWidth={1} />
            {m === 'ground' && <line x1={x + 1.5} y1={10 - half} x2={x + 4} y2={10 - half} stroke="currentColor" strokeWidth={1} />}
          </g>
        )
      })}
    </svg>
  )
}

interface Props {
  readonly view: ViewElement
  readonly canEdit: boolean
  readonly disabledHint: string | undefined
  readonly set: (patch: ViewPropsPatch, label: string) => void
}

/**
 * How this plan draws circuits: lines (arcs or square), the number beside each
 * device, or nothing; home runs, dashed switch legs, and circuiting on every
 * copy of a typical unit. The lines are worked out from the circuits each time
 * the plan draws, so they follow devices when they move.
 */
export function CircuitGraphicsFields({ view, canEdit, disabledHint, set }: Props) {
  const t = useEditorTranslate()
  const styles = circuitStyles(t)
  const marks = hashMarks(t)
  const current: CircuitGraphicsProps = view.props?.circuitGraphics ?? {}
  const resolved = resolveCircuitGraphics(view)
  const change = (patch: Partial<CircuitGraphicsProps>, label: string) => set({ circuitGraphics: { ...current, ...patch } }, label)
  const bends = Object.values(current.hints ?? {}).reduce((n, h) => n + Object.keys(h.bends ?? {}).length, 0)
  const hint = styles.find((s) => s.value === resolved.style)?.hint ?? ''
  const off = resolved.style === 'off'
  const defaulted = current.style === undefined

  return (
    <FieldSet data-testid="view-circuit-graphics">
      <FieldLegend variant="label">{t('circuits.onThisPlan', 'Circuits on this plan', { ns: 'editor' })}</FieldLegend>
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel>{t('circuits.drawAs', 'Draw circuits as', { ns: 'editor' })}</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={resolved.style}
            onValueChange={(v) => {
              const picked = styles.find((s) => s.value === v)
              if (picked) change({ style: picked.value }, t('circuits.changeHow', 'change how circuits draw', { ns: 'editor' }))
            }}
            disabled={!canEdit}
            data-testid="view-circuit-style"
          >
            {styles.map((s) => (
              <ToggleGroupItem key={s.value} value={s.value} aria-label={s.label} data-testid={`view-circuit-style-${s.value}`}>
                {s.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription className="text-xs">
            {disabledHint ??
              (defaulted
                ? `${hint} ${
                    view.props?.discipline === 'electrical'
                      ? t('circuits.electricalDefault', 'Electrical plans draw arcs unless you pick otherwise.', { ns: 'editor' })
                      : t('circuits.otherDefault', 'Plans of other disciplines draw none unless you pick a style.', { ns: 'editor' })
                  }`
                : hint)}
          </FieldDescription>
        </Field>
        {([
          [
            'homeRuns',
            t('circuits.homeRuns', 'Home runs', { ns: 'editor' }),
            t('circuits.homeRunsLower', 'home runs', { ns: 'editor' }),
            t('circuits.homeRunsWhy', 'An arrow and the panel and circuit number (L1-1) on the device nearest the panel.', { ns: 'editor' }),
            resolved.homeRuns,
          ],
          [
            'switchLegs',
            t('circuits.switchLegs', 'Switch legs', { ns: 'editor' }),
            t('circuits.switchLegsLower', 'switch legs', { ns: 'editor' }),
            t('circuits.switchLegsWhy', 'Dashed lines from each switch to the fixtures with its switch letter.', { ns: 'editor' }),
            resolved.switchLegs,
          ],
          [
            'allCopies',
            t('circuits.allUnits', 'Show circuiting on all units', { ns: 'editor' }),
            t('circuits.allUnitsLower', 'circuiting on all units', { ns: 'editor' }),
            t('circuits.allUnitsWhy', 'Typical units draw their own circuiting. Off: only the original, its home runs marked TYP.', { ns: 'editor' }),
            resolved.allCopies,
          ],
        ] as const).map(([key, label, what, description, checked]) => (
          <Field key={key} orientation="horizontal">
            <Checkbox
              id={`vp-circuit-${key}`}
              checked={checked}
              disabled={!canEdit || off}
              onCheckedChange={(v) =>
                change(
                  { [key]: v === true },
                  v === true
                    ? t('circuits.showNamed', 'show {{name}}', { ns: 'editor', name: what })
                    : t('circuits.hideNamed', 'hide {{name}}', { ns: 'editor', name: what }),
                )
              }
              data-testid={`view-circuit-${key}`}
            />
            <FieldLabel htmlFor={`vp-circuit-${key}`} className="font-normal" title={off ? t('circuits.pickStyleFirst', 'Pick a style first: this plan draws no circuits.', { ns: 'editor' }) : description}>
              {label}
            </FieldLabel>
          </Field>
        ))}
        <Field orientation="horizontal">
          <Checkbox
            id="vp-typ-labels-once"
            checked={resolved.typLabelsOnce}
            disabled={!canEdit || off || !resolved.allCopies || !resolved.homeRuns}
            onCheckedChange={(v) =>
              change(
                { typLabelsOnce: v === true },
                v === true
                  ? t('circuits.labelOnceWhat', 'label repeated typicals once', { ns: 'editor' })
                  : t('circuits.labelEveryWhat', 'label every typical unit', { ns: 'editor' }),
              )
            }
            data-testid="view-typ-labels-once"
          />
          <FieldContent>
            <FieldLabel htmlFor="vp-typ-labels-once" className="font-normal">
              {t('circuits.labelRepeatedOnce', 'Label repeated typicals once', { ns: 'editor' })}
            </FieldLabel>
            <FieldDescription className="text-xs">
              {off || !resolved.allCopies || !resolved.homeRuns
                ? t('circuits.typOnceApplies', 'Applies when home runs and circuiting on all units are on.', { ns: 'editor' })
                : resolved.typLabelsOnce
                  ? t(
                      'circuits.typOnceShared',
                      'Units fed from one shared source: the first unit’s home run carries the project’s typical label (Electrical types › Drafting) and the others draw the arrow only. Units with their own source keep their own labels.',
                      { ns: 'editor' },
                    )
                  : t('circuits.typOnceEvery', 'Every unit’s home run carries its own label.', { ns: 'editor' })}
            </FieldDescription>
          </FieldContent>
        </Field>
        <Field>
          <FieldLabel>{t('circuits.wireHashMarks', 'Wire hash marks', { ns: 'editor' })}</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={resolved.hashMarks}
            onValueChange={(v) => {
              const picked = marks.find((s) => s.value === v)
              if (picked) change({ hashMarks: picked.value }, t('circuits.changeHashMarks', 'change the wire hash marks', { ns: 'editor' }))
            }}
            disabled={!canEdit || off || !resolved.homeRuns}
            data-testid="view-circuit-hash-marks"
          >
            {marks.map((s) => (
              <ToggleGroupItem key={s.value} value={s.value} aria-label={s.label} title={s.hint} className="h-auto flex-col gap-1 py-1" data-testid={`view-circuit-hash-marks-${s.value}`}>
                <HashMarkPicture marks={s.marks} />
                <span className="text-xs">{s.label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription className="text-xs">
            {off || !resolved.homeRuns
              ? t('circuits.marksNeedHomeRuns', 'Marks draw across each home run: turn home runs on first.', { ns: 'editor' })
              : (marks.find((s) => s.value === resolved.hashMarks)?.hint ?? '')}
          </FieldDescription>
        </Field>
        {bends > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={!canEdit}
            onClick={() => change({ hints: Object.fromEntries(Object.entries(current.hints ?? {}).map(([id, h]) => [id, { ...(h.priority !== undefined ? { priority: h.priority } : {}) }])) }, t('circuits.clearBendsWhat', 'clear the pinned bends', { ns: 'editor' }))}
            data-testid="view-circuit-clear-bends"
          >
            {t('circuits.clearPinnedBends', 'Clear {{n}} pinned bends', { ns: 'editor', n: bends })}
          </Button>
        )}
      </FieldGroup>
    </FieldSet>
  )
}
