'use client'

import { useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import { linkedEnvelopeAt, spaceEnvelopeOf, spaceOutlines, type Command, type ElementId, type LinkedEnvelope, type LinkedReferenceIndex, type ModelState } from '@permitzip/bim-kernel'
import { Button } from '../../ui/button'
import { linkedPlanHeight, linkedReferenceWords } from '../linked-reference/linked-reference-store'
import { copyEnvelopeForLoads } from '../linked-reference/linked-copies-for-loads'
import { useLinkedReferenceState } from '../linked-reference/use-linked-reference'
import { feetInches, newElementId } from '../placement'
import { useEditorTranslate, type Translate } from '../i18n/translate'

/**
 * A space's envelope as the linked building model shows it: the outside
 * walls along its edges (length, which way they face) and the windows and
 * doors in them, for load calculations. Read-only until "Copy into the model
 * for loads" copies them as walls and openings that are kept in step with the
 * link (Spaces › Copies from the linked model lists any that changed).
 */

const envelopeCache = new WeakMap<LinkedReferenceIndex, Map<number, LinkedEnvelope>>()

function envelopeOf(index: LinkedReferenceIndex, zMm: number): LinkedEnvelope {
  let byZ = envelopeCache.get(index)
  if (!byZ) {
    byZ = new Map()
    envelopeCache.set(index, byZ)
  }
  const held = byZ.get(zMm)
  if (held) return held
  const env = linkedEnvelopeAt(index, zMm)
  byZ.set(zMm, env)
  return env
}

const SQ_FT_PER_M2 = 10.7639

/** The model's +y is plan north until the project's true north is set, so this says "plan" directions. */
function facingWords(deg: number, t: Translate): string {
  const at = Math.round(deg / 45) % 8
  switch (at) {
    case 0:
      return t('spaces.facingEast', 'east', { ns: 'editor' })
    case 1:
      return t('spaces.facingNorthEast', 'north-east', { ns: 'editor' })
    case 2:
      return t('spaces.facingNorth', 'north', { ns: 'editor' })
    case 3:
      return t('spaces.facingNorthWest', 'north-west', { ns: 'editor' })
    case 4:
      return t('spaces.facingWest', 'west', { ns: 'editor' })
    case 5:
      return t('spaces.facingSouthWest', 'south-west', { ns: 'editor' })
    case 6:
      return t('spaces.facingSouth', 'south', { ns: 'editor' })
    default:
      return t('spaces.facingSouthEast', 'south-east', { ns: 'editor' })
  }
}

interface Props {
  readonly model: ModelState
  readonly spaceId: ElementId
  readonly submit: (command: Command, undoLabel: string) => string | null
  /** Why edits are off, in words; null when they may be made. */
  readonly editReason: string | null
}

export function SpaceLinkedEnvelope({ model, spaceId, submit, editReason }: Props) {
  const t = useEditorTranslate()
  const linked = useLinkedReferenceState()
  const [notice, setNotice] = useState<{ readonly tone: 'info' | 'error'; readonly text: string } | null>(null)
  const space = model.elements[spaceId]
  const levelId = space?.kind === 'space' ? (space.levelId ?? null) : null
  const result = useMemo(() => {
    if (linked.status !== 'ready' || space?.kind !== 'space' || !levelId) return null
    const zMm = linkedPlanHeight(model, levelId)
    const outline = spaceOutlines(model.elements, space)[0]
    if (zMm === null || !outline) return null
    return spaceEnvelopeOf(envelopeOf(linked.index, zMm), outline)
  }, [linked, model, space, levelId])

  if (linked.status === 'none' || !levelId) return null
  const words = linkedReferenceWords(linked, t)
  const windows = result ? result.openings.filter((o) => o.role === 'window').length : 0

  const copy = () => {
    if (linked.status !== 'ready' || !result) return
    const outcome = copyEnvelopeForLoads(model, linked.index, result, levelId, newElementId, t)
    if (outcome.kind === 'nothing') {
      setNotice({ tone: 'info', text: outcome.message })
      return
    }
    const refused = submit(outcome.command, t('spaces.copyOutsideWallsCommand', 'Copy outside walls and windows for loads', { ns: 'editor' }))
    setNotice(
      refused
        ? { tone: 'error', text: refused }
        : {
            tone: 'info',
            text: t(
              'spaces.copiedEnvelope',
              'Copied {{walls}} {{wallWord}} and {{openings}} {{openingWord}} from the linked model. They stay in step with it: when it changes, Spaces lists them to update or keep.',
              {
                ns: 'editor',
                walls: outcome.walls,
                wallWord: outcome.walls === 1 ? t('spaces.wallOne', 'wall', { ns: 'editor' }) : t('spaces.wallMany', 'walls', { ns: 'editor' }),
                openings: outcome.openings,
                openingWord: outcome.openings === 1 ? t('spaces.openingOne', 'window or door', { ns: 'editor' }) : t('spaces.openingMany', 'windows and doors', { ns: 'editor' }),
              },
            ),
          },
    )
  }

  return (
    <div className="flex flex-col gap-1 text-xs" data-testid="space-linked-envelope">
      <span className="font-medium text-muted-foreground">{t('spaces.outsideWallsFromLinkedModel', 'Outside walls and windows from the linked model', { ns: 'editor' })}</span>
      {words ? (
        <span className="text-muted-foreground">{words}</span>
      ) : !result || result.walls.length === 0 ? (
        <span className="text-muted-foreground">{t('spaces.noOutsideWallAlongSpace', 'No outside wall of the linked model runs along this space.', { ns: 'editor' })}</span>
      ) : (
        <>
          <span data-testid="space-linked-envelope-summary">
            {t('spaces.envelopeSummary', '{{walls}} outside {{wallWord}}, {{length}} long; {{windows}} {{windowWord}}, {{area}} sq ft', {
              ns: 'editor',
              walls: result.walls.length,
              wallWord: result.walls.length === 1 ? t('spaces.wallOne', 'wall', { ns: 'editor' }) : t('spaces.wallMany', 'walls', { ns: 'editor' }),
              length: feetInches(result.exteriorLengthMm),
              windows,
              windowWord: windows === 1 ? t('spaces.windowOne', 'window', { ns: 'editor' }) : t('spaces.windowMany', 'windows', { ns: 'editor' }),
              area: (result.windowAreaM2 * SQ_FT_PER_M2).toFixed(1),
            })}
          </span>
          <ul className="flex flex-col gap-0.5 text-muted-foreground">
            {result.walls.map((w) => (
              <li key={`${w.wall.sourceId}:${w.wall.globalId}`}>
                {t('spaces.envelopeWallLine', 'Faces plan {{facing}}: {{length}} of {{name}}', { ns: 'editor', facing: facingWords(w.facingDeg, t), length: feetInches(w.lengthMm), name: w.name })}
              </li>
            ))}
          </ul>
          <div>
            <Button
              size="sm"
              variant="outline"
              onClick={copy}
              disabled={editReason !== null}
              title={editReason ?? t('spaces.copyEnvelopeWhy', 'Copies these walls, windows and doors into this model as walls and openings that load calculations read; each is kept in step with the linked model', { ns: 'editor' })}
              data-testid="space-linked-envelope-copy"
            >
              <Copy data-icon="inline-start" />
              {t('spaces.copyEnvelope', 'Copy into the model for loads', { ns: 'editor' })}
            </Button>
          </div>
        </>
      )}
      {notice ? (
        <span className={notice.tone === 'error' ? 'text-danger-600' : 'text-muted-foreground'} role="status" data-testid="space-linked-envelope-notice">
          {notice.text}
        </span>
      ) : null}
    </div>
  )
}
