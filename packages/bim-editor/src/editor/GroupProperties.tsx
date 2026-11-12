'use client'

import { useState } from 'react'
import { Maximize, Move, Trash2 } from 'lucide-react'
import type { FittingChoice, RunSize, ScopeSummary } from '@permitzip/bim-kernel'
import { Button } from '../ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '../ui/field'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Separator } from '../ui/separator'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'
import { MM_PER_IN } from './placement'
import { useEditorTranslate, type Translate } from './i18n/translate'
import { parseFeet } from './RunMoveForm'

const MM_PER_FT = 304.8

export interface GroupTotals {
  readonly summary: ScopeSummary
  readonly pressure: readonly { readonly system: string; readonly espInWc: number | null; readonly reason: string | null }[]
}

type Shape = 'rect' | 'round' | 'oval'
type TransitionPick = 'auto' | 'concentric' | 'eccentric_top' | 'eccentric_bottom' | 'eccentric_left' | 'eccentric_right' | 'rect_round'

const TRANSITIONS: readonly TransitionPick[] = ['auto', 'concentric', 'eccentric_top', 'eccentric_bottom', 'eccentric_left', 'eccentric_right', 'rect_round']

/**
 * The transition's own word, each as a literal `t()` call.
 *
 * Not a table of `{ key, english }` pairs: a key behind a variable is invisible to
 * `npm run i18n:review` and to `editorSourceCaptions()`, so the Turkish of a lookup
 * table is a Turkish nobody checks — the reason `plumbing-words.ts` writes its
 * accessors the same way.
 */
function transitionWord(pick: TransitionPick, t: Translate): string {
  switch (pick) {
    case 'auto':
      return t('group.transitionAuto', "The system's default", { ns: 'editor' })
    case 'concentric':
      return t('group.transitionConcentric', 'Concentric', { ns: 'editor' })
    case 'eccentric_top':
      return t('group.transitionTop', 'Eccentric, flat on top', { ns: 'editor' })
    case 'eccentric_bottom':
      return t('group.transitionBottom', 'Eccentric, flat on bottom', { ns: 'editor' })
    case 'eccentric_left':
      return t('group.transitionLeft', 'Eccentric, flat on the left', { ns: 'editor' })
    case 'eccentric_right':
      return t('group.transitionRight', 'Eccentric, flat on the right', { ns: 'editor' })
    case 'rect_round':
      return t('group.transitionRectRound', 'Rectangular-to-round', { ns: 'editor' })
  }
}

function transitionChoice(pick: TransitionPick): FittingChoice | undefined {
  switch (pick) {
    case 'auto':
      return undefined
    case 'concentric':
      return { family: 'duct.transition.concentric' }
    case 'eccentric_top':
      return { family: 'duct.transition.eccentric', params: { flat: 'top' } }
    case 'eccentric_bottom':
      return { family: 'duct.transition.eccentric', params: { flat: 'bottom' } }
    case 'eccentric_left':
      return { family: 'duct.transition.eccentric', params: { flat: 'left' } }
    case 'eccentric_right':
      return { family: 'duct.transition.eccentric', params: { flat: 'right' } }
    case 'rect_round':
      return { family: 'duct.transition.rect_round' }
  }
}

/** "2 straight pieces (the fitting follows)": what Resize changes, so a selection of 3 doesn't read as 2. */
export function resizeLabel(segments: number, fittings: number, t: Translate): string {
  const pieces =
    segments === 1
      ? t('group.piecesOne', '{{count}} straight piece', { ns: 'editor', count: segments })
      : t('group.piecesMany', '{{count}} straight pieces', { ns: 'editor', count: segments })
  if (fittings === 0) return pieces
  return fittings === 1
    ? t('group.resizeWithOne', '{{pieces}} (the fitting follows)', { ns: 'editor', pieces })
    : t('group.resizeWithMany', '{{pieces}} ({{count}} fittings follow)', { ns: 'editor', pieces, count: fittings })
}

/** The word for what a click selects, each as a literal `t()` call (see `transitionWord`). */
function scopeWord(scope: string, t: Translate): string {
  switch (scope) {
    case 'stretch':
      return t('group.scopeStretch', 'Stretch', { ns: 'editor' })
    case 'run':
      return t('group.scopeRun', 'Run', { ns: 'editor' })
    case 'branch':
      return t('group.scopeBranch', 'Branch', { ns: 'editor' })
    case 'system':
      return t('group.scopeSystem', 'System', { ns: 'editor' })
    case 'box':
      return t('group.scopeBox', 'Box selection', { ns: 'editor' })
    case 'element':
    default:
      return t('group.scopeElement', 'Selection', { ns: 'editor' })
  }
}

interface Props {
  readonly scope: string
  readonly count: number
  readonly totals: GroupTotals | null
  readonly canEdit: boolean
  /** East / north in plan and up, mm, as one move. */
  readonly onMove: (deltaMm: { x: number; y: number }, upMm: number) => string | null
  readonly onResize: (size: RunSize, transition: FittingChoice | undefined) => string | null
  readonly onDelete: () => void
}

/** Properties of a run, branch, system or box selection: its totals, and Move / Resize / Delete for all of it at once. */
export function GroupProperties({ scope, count, totals, canEdit, onMove, onResize, onDelete }: Props) {
  const t = useEditorTranslate()
  const [dx, setDx] = useState('0')
  const [dy, setDy] = useState('0')
  const [dz, setDz] = useState('0')
  const [shape, setShape] = useState<Shape>('rect')
  const [w, setW] = useState('14')
  const [h, setH] = useState('10')
  const [d, setD] = useState('12')
  const [pipeIn, setPipeIn] = useState('2')
  const [transition, setTransition] = useState<TransitionPick>('auto')
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const s = totals?.summary
  const isPipe = s?.domain === 'pipe'
  const isDuct = s?.domain === 'duct'
  const flowWord = isPipe ? t('group.flowEnteringPipe', 'Flow entering (the system\u2019s unit)', { ns: 'editor' }) : t('group.airflowEntering', 'Airflow entering', { ns: 'editor' })

  const run = (result: string | null, ok: string) => {
    setProblem(result)
    setDone(result ? null : ok)
  }

  const size = (): RunSize | string => {
    const n = (v: string) => Number(v)
    const mm = (inches: number) => Math.round(inches * MM_PER_IN * 1000) / 1000
    if (isPipe) return n(pipeIn) > 0 ? { shape: 'pipe', nominalMm: mm(n(pipeIn)), material: 'copper' } : t('group.needPipeSize', 'Give the pipe size in inches.', { ns: 'editor' })
    if (shape === 'round') return n(d) > 0 ? { shape: 'round', diameter: mm(n(d)) } : t('group.needDiameter', 'Give the diameter in inches.', { ns: 'editor' })
    if (!(n(w) > 0 && n(h) > 0)) return t('group.needWidthAndHeight', 'Give the width and height in inches.', { ns: 'editor' })
    if (shape === 'oval' && n(w) < n(h)) return t('group.ovalWiderThanTall', 'A flat oval is wider than it is tall; swap the width and height.', { ns: 'editor' })
    return { shape, width: mm(n(w)), height: mm(n(h)) }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="group-properties">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium" data-testid="group-title">
          {count === 1
            ? t('group.titleOne', '{{scope}} · {{count}} element', { ns: 'editor', scope: scopeWord(scope, t), count })
            : t('group.titleMany', '{{scope}} · {{count}} elements', { ns: 'editor', scope: scopeWord(scope, t), count })}
        </span>
        <span className="text-xs text-muted-foreground">{t('group.widenHint', 'Tab while hovering widens what a click selects; Esc clears.', { ns: 'editor' })}</span>
      </div>
      {s ? (
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm" data-testid="group-totals">
          <dt className="text-muted-foreground">{t('group.straightPieces', 'Straight pieces', { ns: 'editor' })}</dt>
          <dd data-testid="group-segments">{s.segments}</dd>
          <dt className="text-muted-foreground">{t('group.fittings', 'Fittings', { ns: 'editor' })}</dt>
          <dd>{s.fittings}</dd>
          <dt className="text-muted-foreground">{t('group.parts', 'Parts', { ns: 'editor' })}</dt>
          <dd>{s.parts}</dd>
          <dt className="text-muted-foreground">{t('group.length', 'Length', { ns: 'editor' })}</dt>
          <dd>{(s.lengthMm / MM_PER_FT).toFixed(1)} ft</dd>
          <dt className="text-muted-foreground">{flowWord}</dt>
          <dd data-testid="group-flow">{s.flowEntering === null ? t('empty.noneYet', 'None yet', { ns: 'editor' }) : `${Math.round(s.flowEntering)}${isPipe ? '' : ' CFM'}`}</dd>
          {(totals?.pressure ?? []).map((p) => (
            <div key={p.system} className="contents">
              <dt className="text-muted-foreground">{t('group.fanStatic', '{{system}} fan static', { ns: 'editor', system: p.system })}</dt>
              <dd data-testid="group-esp">{p.espInWc === null ? (p.reason ? t('empty.notCalculated', 'Not calculated', { ns: 'editor' }) : t('empty.noFanYet', 'No fan yet', { ns: 'editor' })) : t('group.espValue', '{{esp}} in. w.c.', { ns: 'editor', esp: p.espInWc.toFixed(2) })}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <FieldDescription>{t('empty.totalsNotConnected', 'Totals appear once the model is connected.', { ns: 'editor' })}</FieldDescription>
      )}
      <Separator />
      <FieldSet disabled={!canEdit}>
        <FieldLegend variant="label">{t('group.moveAllOfIt', 'Move all of it', { ns: 'editor' })}</FieldLegend>
        <div className="grid grid-cols-3 gap-2">
          <Field>
            <FieldLabel htmlFor="bm-group-dx">{t('group.eastFt', 'East (ft)', { ns: 'editor' })}</FieldLabel>
            <Input id="bm-group-dx" inputMode="decimal" value={dx} onChange={(e) => setDx(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="bm-group-dy">{t('group.northFt', 'North (ft)', { ns: 'editor' })}</FieldLabel>
            <Input id="bm-group-dy" inputMode="decimal" value={dy} onChange={(e) => setDy(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="bm-group-dz">{t('group.upFt', 'Up (ft)', { ns: 'editor' })}</FieldLabel>
            <Input id="bm-group-dz" inputMode="decimal" value={dz} onChange={(e) => setDz(e.target.value)} />
          </Field>
        </div>
        <Button
          size="sm"
          variant="outline"
          data-testid="group-move"
          onClick={() => {
            const read = (text: string) => (text.trim() === '' ? 0 : parseFeet(text))
            const [x, y, z] = [read(dx), read(dy), read(dz)]
            if (x === null || y === null || z === null) return run(t('run.needFeet', "Enter feet, like 2, -1.5 or 2'6\". East, north and up are positive; west, south and down negative.", { ns: 'editor' }), '')
            if (x === 0 && y === 0 && z === 0) return run(t('group.needDistance', 'Give a distance east, north or up (negative goes west, south or down).', { ns: 'editor' }), '')
            run(onMove({ x: x * MM_PER_FT, y: y * MM_PER_FT }, z * MM_PER_FT), t('group.moved', 'Moved. Ctrl+Z undoes it.', { ns: 'editor' }))
          }}
        >
          <Move data-icon="inline-start" />
          {t('run.move', 'Move', { ns: 'editor' })}
        </Button>
      </FieldSet>
      {(isDuct || isPipe) && (
        <FieldSet disabled={!canEdit}>
          <FieldLegend variant="label">
            {isPipe
              ? t('group.newSizeForEveryPipePiece', 'New size for every pipe piece', { ns: 'editor' })
              : t('group.newSizeForEveryDuctPiece', 'New size for every duct piece', { ns: 'editor' })}
          </FieldLegend>
          {isDuct ? (
            <FieldGroup className="flex flex-col gap-2">
              <ToggleGroup type="single" variant="outline" size="sm" value={shape} onValueChange={(v) => (v === 'rect' || v === 'round' || v === 'oval') && setShape(v)} aria-label={t('group.ductShape', 'Duct shape', { ns: 'editor' })}>
                <ToggleGroupItem value="rect">{t('group.rectangular', 'Rectangular', { ns: 'editor' })}</ToggleGroupItem>
                <ToggleGroupItem value="round">{t('group.round', 'Round', { ns: 'editor' })}</ToggleGroupItem>
                <ToggleGroupItem value="oval">{t('group.flatOval', 'Flat oval', { ns: 'editor' })}</ToggleGroupItem>
              </ToggleGroup>
              {shape === 'round' ? (
                <Field>
                  <FieldLabel htmlFor="bm-group-size">{t('run.diameterIn', 'Diameter (in)', { ns: 'editor' })}</FieldLabel>
                  <Input id="bm-group-size" inputMode="decimal" value={d} onChange={(e) => setD(e.target.value)} />
                </Field>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Field>
                    <FieldLabel htmlFor="bm-group-size">{t('run.widthIn', 'Width (in)', { ns: 'editor' })}</FieldLabel>
                    <Input id="bm-group-size" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="bm-group-h">{t('run.heightIn', 'Height (in)', { ns: 'editor' })}</FieldLabel>
                    <Input id="bm-group-h" inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} />
                  </Field>
                </div>
              )}
              <Field>
                <FieldLabel htmlFor="bm-group-transition">{t('group.transitionsWhereItMeets', 'Transitions where it meets another size', { ns: 'editor' })}</FieldLabel>
                <Select value={transition} onValueChange={(v) => setTransition(TRANSITIONS.find((pick) => pick === v) ?? 'auto')}>
                  <SelectTrigger id="bm-group-transition" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {TRANSITIONS.map((pick) => (
                        <SelectItem key={pick} value={pick}>
                          {transitionWord(pick, t)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>{t('group.lengthFollowsWallAngle', "Length follows the wall angle. If it doesn't fit beside a fitting, nothing changes and you're told why.", { ns: 'editor' })}</FieldDescription>
              </Field>
            </FieldGroup>
          ) : (
            <Field>
              <FieldLabel htmlFor="bm-group-size">{t('group.pipeSizeIn', 'Pipe size (in)', { ns: 'editor' })}</FieldLabel>
              <Input id="bm-group-size" inputMode="decimal" value={pipeIn} onChange={(e) => setPipeIn(e.target.value)} />
            </Field>
          )}
          <Button
            size="sm"
            variant="outline"
            data-testid="group-resize"
            onClick={() => {
              const next = size()
              if (typeof next === 'string') return run(next, '')
              run(onResize(next, isDuct ? transitionChoice(transition) : undefined), t('group.resizedOneEdit', 'Resized in one edit. Ctrl+Z undoes it.', { ns: 'editor' }))
            }}
          >
            <Maximize data-icon="inline-start" />
            {t('group.resizeButton', 'Resize {{pieces}}', { ns: 'editor', pieces: resizeLabel(s?.segments ?? 0, s?.fittings ?? 0, t) })}
          </Button>
        </FieldSet>
      )}
      {problem && (
        <FieldDescription className="text-danger-600" role="alert" data-testid="group-problem">
          {problem}
        </FieldDescription>
      )}
      {done && (
        <FieldDescription role="status" data-testid="group-done">
          {done}
        </FieldDescription>
      )}
      <Separator />
      <Button size="sm" variant="outline" className="text-danger-600" disabled={!canEdit} onClick={onDelete} data-testid="group-delete">
        <Trash2 data-icon="inline-start" />
        {t('group.deleteAll', 'Delete all {{count}}…', { ns: 'editor', count })}
      </Button>
    </div>
  )
}
