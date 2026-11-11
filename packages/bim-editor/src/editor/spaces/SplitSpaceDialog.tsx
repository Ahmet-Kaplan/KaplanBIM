'use client'

import { useMemo, useState } from 'react'
import { previewSplit, type Command, type ElementId, type ModelState } from '@permitzip/bim-kernel'
import { Alert, AlertDescription } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '../../ui/field'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import { newElementId } from '../placement'
import { useEditorTranslate } from '../i18n/translate'
import type { SeparatorLine } from './separator-tool'
import { formatFt2 } from './space-rows'

const FT2_PER_M2 = 10.7639104

interface Props {
  /** The line just drawn across a room; null when the dialog is closed. */
  readonly line: SeparatorLine | null
  readonly model: ModelState
  readonly submit: (command: Command, undoLabel: string) => string | null
  /** Split, or Cancel / Esc: either way the dialog closes. Cancel writes nothing. */
  readonly onClose: (splitInto: readonly string[] | null) => void
}

/** The sub-room each load goes to by default: the larger one (ties: the first). */
export function defaultKeeper(children: readonly { readonly number: string; readonly areaM2: number }[]): string {
  let best = children[0]
  for (const c of children) if (best && c.areaM2 > best.areaM2) best = c
  return best?.number ?? ''
}

/** The split_space command the dialog sends: one sub-room named for each load that isn't by area. */
export function splitCommand(line: SeparatorLine, loadsTo: Readonly<Record<string, string>>): Command {
  const loads = Object.entries(loadsTo).map(([loadId, to]) => ({ loadId, to }))
  return { type: 'split_space', spaceId: line.spaceId, line: { start: line.start, end: line.end }, separatorId: newElementId('separation-line'), ...(loads.length > 0 ? { loadsTo: loads } : {}) }
}

/**
 * Split space: the room keeps its name and total area; the line makes
 * sub-rooms under it. Loads by area share by each sub-room's area on their
 * own; every other load needs a home, so the dialog asks for each one,
 * starting on the larger sub-room. Cancel or Esc leaves the model as it was.
 */
export function SplitSpaceDialog({ line, model, submit, onClose }: Props) {
  const t = useEditorTranslate()
  const preview = useMemo(() => (line ? previewSplit(model.elements, line.spaceId as ElementId, line) : null), [line, model])
  const [choice, setChoice] = useState<Readonly<Record<string, string>>>({})
  const [refusal, setRefusal] = useState<string | null>(null)
  const ok = preview?.ok === true ? preview : null
  const fallback = ok ? defaultKeeper(ok.children) : ''
  const loadsTo = ok ? Object.fromEntries(ok.typedLoads.map((l) => [l.id, choice[l.id] ?? fallback])) : {}

  const close = (into: readonly string[] | null) => {
    setChoice({})
    setRefusal(null)
    onClose(into)
  }

  const split = () => {
    if (!line || !ok) return
    const refused = submit(splitCommand(line, loadsTo), t('spaces.splitNamed', 'Split {{space}}', { ns: 'editor', space: ok.room }))
    if (refused) {
      setRefusal(refused)
      return
    }
    close(ok.children.map((c) => c.number))
  }

  return (
    <Dialog open={line !== null} onOpenChange={(o) => !o && close(null)}>
      <DialogContent data-testid="split-space-dialog">
        <DialogHeader>
          <DialogTitle>{ok ? t('spaces.splitNamed', 'Split {{space}}', { ns: 'editor', space: ok.room }) : t('spaces.splitSpace', 'Split space', { ns: 'editor' })}</DialogTitle>
          <DialogDescription>
            {ok
              ? t('spaces.splitWhat', '{{space}} keeps its name and total area. The line makes {{count}} sub-rooms under it, each with its own number, use and loads.', { ns: 'editor', space: ok.room, count: ok.children.length })
              : t('spaces.lineCantSplit', 'The line can’t split this room.', { ns: 'editor' })}
          </DialogDescription>
        </DialogHeader>
        {preview && !preview.ok ? (
          <Alert variant="destructive" data-testid="split-space-why">
            <AlertDescription>{preview.message}</AlertDescription>
          </Alert>
        ) : null}
        {ok ? (
          <FieldGroup>
            <p className="text-sm" data-testid="split-space-children">
              {ok.children.map((c) => `${c.number}: ${formatFt2(c.areaM2 * FT2_PER_M2)}`).join(' · ')}
            </p>
            {ok.byAreaLoads > 0 ? (
              <p className="text-xs text-muted-foreground" data-testid="split-space-by-area">
                {ok.byAreaLoads === 1
                  ? t('spaces.oneLoadByArea', '1 load by area shares by each sub-room’s area.', { ns: 'editor' })
                  : t('spaces.loadsByArea', '{{count}} loads by area share by each sub-room’s area.', { ns: 'editor', count: ok.byAreaLoads })}
              </p>
            ) : null}
            {ok.typedLoads.length > 0 ? (
              <FieldSet>
                <FieldLegend variant="label">{t('spaces.whichSubroomKeeps', 'Which sub-room keeps each load?', { ns: 'editor' })}</FieldLegend>
                <FieldDescription>{t('spaces.loadsNotByArea', 'Loads that aren’t by area go to one sub-room. The larger one is picked to start.', { ns: 'editor' })}</FieldDescription>
                {ok.typedLoads.map((l) => (
                  <Field key={l.id} orientation="horizontal" data-testid="split-space-load" data-load={l.id}>
                    <FieldLabel className="min-w-32">{l.label}</FieldLabel>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      size="sm"
                      value={loadsTo[l.id] ?? fallback}
                      onValueChange={(v) => v && setChoice((c) => ({ ...c, [l.id]: v }))}
                      aria-label={t('spaces.subroomThatKeeps', 'Sub-room that keeps {{load}}', { ns: 'editor', load: l.label })}
                    >
                      {ok.children.map((c) => (
                        <ToggleGroupItem key={c.number} value={c.number} aria-label={t('spaces.loadGoesTo', '{{load}} goes to {{room}}', { ns: 'editor', load: l.label, room: c.number })}>
                          {c.number}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </Field>
                ))}
              </FieldSet>
            ) : null}
          </FieldGroup>
        ) : null}
        {refusal ? (
          <Alert variant="destructive" data-testid="split-space-refused">
            <AlertDescription>{refusal}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => close(null)} data-testid="split-space-cancel">
            {t('spaces.cancel', 'Cancel', { ns: 'editor' })}
          </Button>
          <Button onClick={split} disabled={!ok} title={ok ? undefined : preview && !preview.ok ? preview.message : undefined} data-testid="split-space-confirm">
            {t('spaces.split', 'Split', { ns: 'editor' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
