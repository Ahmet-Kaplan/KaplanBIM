/**
 * What a model tool still needs before a click in the view can do anything,
 * in the person's words, with the one-click fixes the notice offers. A tool
 * that is selected but can't act shows this at the tool and keeps showing it
 * until the cause is gone: pointer moves never clear it (fail-loud, Nielsen 1 and 9).
 * The same answer in every view: the 3D model, a live plan, a printed drawing
 * and a sheet (review video, Nov 6: routing on a printed plan with no level
 * did nothing, and "Add a level first" only showed in 3D).
 *
 * Every word here is `t('<key>', '<English>', { ns: 'editor' })`, and the
 * translator is a **required parameter**: `englishOnly` returns its English
 * argument verbatim, so a default would let `{{doing}}` reach the notice as
 * braces. Each placeholder-bearing sentence also fills its own values through
 * `withValues`, whichever translator arrives.
 */
import { withValues, type Translate } from './i18n/translate'

export type ToolFixId = 'add-first-level' | 'add-level' | 'use-architect-levels' | 'retry-now'

export interface ToolFix {
  readonly id: ToolFixId
  readonly label: string
}

export interface ToolBlocker {
  readonly id: 'no-level' | 'no-part' | 'route-size' | 'no-system' | 'read-only' | 'paused' | 'no-model-view'
  readonly title: string
  readonly message: string
  readonly fixes: readonly ToolFix[]
}

export interface ToolReadinessInput {
  readonly tool: string
  readonly canEdit: boolean
  /** Why editing is off, when it is (shown as is). */
  readonly blockedReason: string | null
  /** Why pointer edits are paused while the live connection is down (`ModelSession.editPausedReason`), or null. */
  readonly editPaused?: string | null
  readonly levelCount: number
  readonly partChosen: boolean
  /** The route panel's size problem ("Width must be a number"), or null when the size is good. */
  readonly routeSizeProblem: string | null
  readonly routeSystemKnown: boolean
  /** A sheet is open and none of its plans or sections is being worked in, so model clicks have nowhere to land. */
  readonly modelToolsOff?: boolean
  /** The sheet's number, for the no-view message. */
  readonly sheetLabel?: string | null
  /** A linked model has storeys the model could take as its levels (offers "Use the architect's levels"). */
  readonly architectLevelsAvailable?: boolean
}

/** The first level a fresh project gets with one click: at grade. */
export const FIRST_LEVEL = { name: 'Level 1', elevationMm: 0 } as const

/** `0'-0"` down the page: a level elevation, written the way the drawing writes it (§7: unit symbols are not translated). */
const AT_GRADE = `0'-0"`

/**
 * What a click would do, as a noun phrase a sentence can hold.
 *
 * A noun, not a verb: the same word has to sit in "Can't ___ here", "Can't ___
 * while reconnecting" and "your clicks won't ___ anything", and Turkish cannot
 * put one verb form in all three. `parça yerleştirme` reads correctly in each.
 */
function doingWords(tool: string, t: Translate): string | null {
  switch (tool) {
    case 'place':
      return t('tool.doing.place', 'place parts', { ns: 'editor' })
    case 'route':
      return t('tool.doing.route', 'route', { ns: 'editor' })
    case 'move':
      return t('tool.doing.move', 'move', { ns: 'editor' })
    case 'split':
      return t('tool.doing.split', 'split', { ns: 'editor' })
    default:
      return null
  }
}

export function toolBlocker(input: ToolReadinessInput, t: Translate): ToolBlocker | null {
  const doing = doingWords(input.tool, t)
  if (!doing) return null
  if (!input.canEdit) {
    return {
      id: 'read-only',
      title: withValues(t('tool.readOnlyTitle', "Can't {{doing}} here", { doing, ns: 'editor' }), { doing }),
      message: input.blockedReason ?? t('tool.readOnlyMessage', "Live editing isn't connected, so nothing can be added.", { ns: 'editor' }),
      fixes: [],
    }
  }
  if (input.editPaused) {
    return {
      id: 'paused',
      title: withValues(t('tool.pausedTitle', "Can't {{doing}} while reconnecting", { doing, ns: 'editor' }), { doing }),
      message: input.editPaused,
      fixes: [{ id: 'retry-now', label: t('status.tryNow', 'Try now', { ns: 'editor' }) }],
    }
  }
  if (input.modelToolsOff) {
    const sheet = input.sheetLabel ?? t('tool.thisSheet', 'this sheet', { ns: 'editor' })
    return {
      id: 'no-model-view',
      title: t('tool.noModelViewTitle', 'Open a plan on this sheet first', { ns: 'editor' }),
      message: withValues(
        t('tool.noModelViewMessage', "Double-click a plan or section on {{sheet}} to work in it. Until then your clicks won't {{doing}} anything.", {
          sheet,
          doing,
          ns: 'editor',
        }),
        { sheet, doing },
      ),
      fixes: [],
    }
  }
  if (input.tool !== 'place' && input.tool !== 'route') return null
  if (input.levelCount === 0) {
    const what = input.tool === 'place' ? t('tool.parts', 'Parts', { ns: 'editor' }) : t('tool.ductsAndPipes', 'Ducts and pipes', { ns: 'editor' })
    const firstLevel = withValues(t('tool.fix.addFirstLevel', 'Add {{name}} at {{at}}', { name: FIRST_LEVEL.name, at: AT_GRADE, ns: 'editor' }), {
      name: FIRST_LEVEL.name,
      at: AT_GRADE,
    })
    return {
      id: 'no-level',
      title: t('tool.noLevelTitle', 'Add a level first', { ns: 'editor' }),
      message: withValues(
        t('tool.noLevelMessage', "{{what}} sit on a level, and this model has none yet. Your clicks won't add anything until it has one. A linked model's storeys don't count until you add them.", {
          what,
          ns: 'editor',
        }),
        { what },
      ),
      fixes: [
        ...(input.architectLevelsAvailable ? [{ id: 'use-architect-levels' as const, label: t('tool.fix.useArchitectLevels', "Use the architect's levels", { ns: 'editor' }) }] : []),
        { id: 'add-first-level', label: firstLevel },
        { id: 'add-level', label: t('tool.fix.addLevel', 'Add a level…', { ns: 'editor' }) },
      ],
    }
  }
  if (input.tool === 'place' && !input.partChosen) {
    return {
      id: 'no-part',
      title: t('tool.noPartTitle', 'Choose a part', { ns: 'editor' }),
      message: t('tool.noPartMessage', 'Pick a part type on the left, then click on a floor, a roof or the model to place it.', { ns: 'editor' }),
      fixes: [],
    }
  }
  if (input.tool === 'route' && input.routeSizeProblem) {
    const reason = input.routeSizeProblem
    return {
      id: 'route-size',
      title: t('tool.routeSizeTitle', 'Fix the size first', { ns: 'editor' }),
      message: withValues(
        t('tool.routeSizeMessage', "{{reason}} Clicks won't draw until the size on the left is valid.", { reason, ns: 'editor' }),
        { reason },
      ),
      fixes: [],
    }
  }
  if (input.tool === 'route' && !input.routeSystemKnown) {
    return {
      id: 'no-system',
      title: t('tool.noSystemTitle', 'Choose a system', { ns: 'editor' }),
      message: t('tool.noSystemMessage', 'Pick the system this run belongs to on the left (or a new one), then click to start.', { ns: 'editor' }),
      fixes: [],
    }
  }
  return null
}
