'use client'

import { useMemo, useState } from 'react'
import { CircleAlert, CircleCheck, Crosshair, Wrench } from 'lucide-react'
import { asElementId, type ModelState } from '@permitzip/bim-kernel'
import { OUTFALL_CONNECTION_WORDS, outfallConnectionChoices, routedSegmentsOf, outfallConnectionCommands, outfallFixCommand, outfallWalk, type OutfallConnectionPlan, type OutfallWalkFinding } from '@permitzip/bim-pack-plumbing'
import { Alert, AlertDescription, AlertTitle } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '../../ui/item'
import { Label } from '../../ui/label'
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group'
import { useEditorTranslate } from '../i18n/translate'
import { newId, type SubmitCommand } from '../views-sheets/types'

interface Props {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly model: ModelState
  /** The selected building drain (the pipe whose end leaves the building). */
  readonly drainId: string
  /** Null when this person may edit; otherwise why not, in words. */
  readonly editBlocked: string | null
  readonly submit: SubmitCommand
  readonly select: (ids: readonly string[]) => void
}

const MM_PER_FT = 304.8
const NEW = 'new'

/** Feet typed by a person, as mm above project zero; null when blank, undefined when not a number. */
function feetToMm(text: string): number | null | undefined {
  const t = text.trim()
  if (t === '') return null
  const v = Number(t)
  return Number.isFinite(v) ? v * MM_PER_FT : undefined
}

/**
 * Systems › the outfall connection: take the selected building drain to
 * a manhole (one in the model, or a new one with its invert and rim), then
 * walk the drawn drain to it and list what's wrong, each with Select and its
 * Fix. Every step is one undoable command.
 */
export function OutfallConnectionDialog({ open, onOpenChange, model, drainId, editBlocked, submit, select }: Props) {
  const t = useEditorTranslate()
  const choices = useMemo(() => outfallConnectionChoices(model), [model])
  const [picked, setPicked] = useState<string>(choices[0]?.id ?? NEW)
  const [mark, setMark] = useState('MH-1')
  const [invert, setInvert] = useState('')
  const [rim, setRim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ readonly prefix: string; readonly next: NonNullable<OutfallConnectionPlan['next']> } | null>(null)
  const [walkedFrom, setWalkedFrom] = useState<string | null>(null)

  const routedOn = pending !== null && routedSegmentsOf(model, pending.prefix).length > 0

  const placeManhole = () => {
    if (!pending) return
    const next = pending.next(model)
    if ('refused' in next) {
      setError(next.refused)
      return
    }
    for (const c of next) {
      const refusal = submit(c, OUTFALL_CONNECTION_WORDS.joinUndo)
      if (refusal) {
        setError(refusal)
        return
      }
    }
    setPending(null)
    setWalkedFrom(drainId)
  }

  const walk = walkedFrom ? outfallWalk(model, asElementId(walkedFrom)) : null
  const invertMm = feetToMm(invert)
  const rimMm = feetToMm(rim)
  const badNumber =
    picked === NEW && (invertMm === undefined || rimMm === undefined)
      ? t('plumbing.invertRimHint', 'Type the invert and rim in feet above project zero (for example -8.5), or leave them blank to add later.', { ns: 'editor' })
      : null
  const blocked =
    editBlocked ?? badNumber ?? (picked === NEW && mark.trim() === '' ? t('plumbing.giveTheManholeAMark', 'Give the manhole a mark (MH-1).', { ns: 'editor' }) : null)

  const connect = () => {
    setError(null)
    const prefix = newId('outfall')
    const plan = outfallConnectionCommands(model, drainId, picked === NEW ? { kind: 'new', partId: newId('mh'), mark: mark.trim(), invertMm: invertMm ?? null, rimMm: rimMm ?? null } : { kind: 'existing', manholeId: asElementId(picked) }, prefix)
    if ('refused' in plan) {
      setError(plan.refused)
      return
    }
    for (const c of plan.first) {
      const refusal = submit(c, OUTFALL_CONNECTION_WORDS.routeUndo)
      if (refusal) {
        setError(refusal)
        return
      }
    }
    if (plan.next) setPending({ prefix, next: plan.next })
    else setWalkedFrom(drainId)
  }

  const fix = (f: OutfallWalkFinding) => {
    if (!f.fix) return
    const cmd = outfallFixCommand(model, f.fix, newId(f.fix.places === 'ejector' ? 'ejector' : 'bwv'))
    const refusal = 'refused' in cmd ? cmd.refused : submit(cmd, f.fix.label.toLowerCase())
    setError(refusal)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="outfall-connection-dialog">
        <DialogHeader>
          <DialogTitle>{OUTFALL_CONNECTION_WORDS.title}</DialogTitle>
          <DialogDescription>{OUTFALL_CONNECTION_WORDS.intro}</DialogDescription>
        </DialogHeader>

        {walk === null ? (
          <div className="flex flex-col gap-4">
            <RadioGroup value={picked} onValueChange={setPicked} aria-label={t('plumbing.manhole', 'Manhole', { ns: 'editor' })}>
              {choices.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <RadioGroupItem value={c.id} id={`outfall-${c.id}`} />
                  <Label htmlFor={`outfall-${c.id}`}>
                    {c.label}
                    {c.invertMm !== null
                      ? t('plumbing.manholeInvert', ', invert {{ft}} ft', { ns: 'editor', ft: (c.invertMm / MM_PER_FT).toFixed(2) })
                      : t('plumbing.manholeNoInvertYet', ', no invert yet', { ns: 'editor' })}
                  </Label>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <RadioGroupItem value={NEW} id="outfall-new" />
                <Label htmlFor="outfall-new">{t('plumbing.aNewManhole', 'A new manhole', { ns: 'editor' })}</Label>
              </div>
            </RadioGroup>
            {picked === NEW && (
              <div className="grid grid-cols-3 gap-3">
                <Field>
                  <FieldLabel htmlFor="outfall-mark">{t('plumbing.mark', 'Mark', { ns: 'editor' })}</FieldLabel>
                  <Input id="outfall-mark" value={mark} onChange={(e) => setMark(e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="outfall-invert">{t('plumbing.invertFt', 'Invert (ft)', { ns: 'editor' })}</FieldLabel>
                  <Input id="outfall-invert" inputMode="decimal" value={invert} onChange={(e) => setInvert(e.target.value)} placeholder="-8.5" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="outfall-rim">{t('plumbing.rimFt', 'Rim (ft)', { ns: 'editor' })}</FieldLabel>
                  <Input id="outfall-rim" inputMode="decimal" value={rim} onChange={(e) => setRim(e.target.value)} placeholder="-2" />
                </Field>
                <FieldDescription className="col-span-3">
                  {t('plumbing.invertRimWhy', 'Feet above project zero. Leave one blank and the check says what to add; it never guesses.', { ns: 'editor' })}
                </FieldDescription>
              </div>
            )}
          </div>
        ) : walk.findings.length === 0 ? (
          <Alert>
            <CircleCheck />
            <AlertTitle>
              {t('plumbing.theDrainReachesByGravity', 'The drain reaches {{outfall}} by gravity', {
                ns: 'editor',
                outfall: walk.outfall?.label ?? t('plumbing.theManhole', 'the manhole', { ns: 'editor' }),
              })}
            </AlertTitle>
            <AlertDescription>{t('plumbing.noBackwaterValveNeeded', 'No backwater valve is needed for the floors it serves.', { ns: 'editor' })}</AlertDescription>
          </Alert>
        ) : (
          <ItemGroup data-testid="outfall-walk-findings">
            {walk.findings.map((f) => (
              <Item key={`${f.code}-${f.message}`} variant="outline">
                <ItemContent>
                  <ItemTitle>{f.message}</ItemTitle>
                  {f.fix && (
                    <ItemDescription>{t('plumbing.fixPlacesStarter', '{{fix}} places the starter part on that pipe; connect it there.', { ns: 'editor', fix: f.fix.label })}</ItemDescription>
                  )}
                </ItemContent>
                <ItemActions>
                  <Button size="sm" variant="outline" onClick={() => select(f.selectIds)}>
                    <Crosshair />
                    {t('plumbing.select', 'Select', { ns: 'editor' })}
                  </Button>
                  {f.fix && (
                    <Button size="sm" onClick={() => fix(f)} disabled={editBlocked !== null} title={editBlocked ?? undefined}>
                      <Wrench />
                      {f.fix.label}
                    </Button>
                  )}
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}

        {error && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>{t('plumbing.didntGoThrough', "That didn't go through", { ns: 'editor' })}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {walk ? t('plumbing.done', 'Done', { ns: 'editor' }) : t('plumbing.cancel', 'Cancel', { ns: 'editor' })}
          </Button>
          {walk === null && pending === null && (
            <Button onClick={connect} disabled={blocked !== null} title={blocked ?? undefined}>
              {t('plumbing.connectAndCheck', 'Connect and check', { ns: 'editor' })}
            </Button>
          )}
          {walk === null && pending !== null && (
            <Button
              onClick={placeManhole}
              disabled={!routedOn || editBlocked !== null}
              title={routedOn ? (editBlocked ?? undefined) : t('plumbing.routingTheDrainOn', 'Routing the drain on…', { ns: 'editor' })}
            >
              {routedOn
                ? t('plumbing.placeAndCheck', 'Place {{mark}} and check', { ns: 'editor', mark: mark.trim() })
                : t('plumbing.routingTheDrainOn', 'Routing the drain on…', { ns: 'editor' })}
            </Button>
          )}
        </DialogFooter>
        {walk === null && blocked && <p className="text-muted-foreground text-sm">{blocked}</p>}
      </DialogContent>
    </Dialog>
  )
}
