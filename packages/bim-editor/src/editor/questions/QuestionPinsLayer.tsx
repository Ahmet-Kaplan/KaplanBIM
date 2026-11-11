'use client'

import { useMemo } from 'react'
import { modelToPaperPoint, viewModelLevel, type ElementId, type ModelState, type ViewOnPaper } from '@permitzip/bim-kernel'
import { questionPinsOn, type QuestionPin } from '../../contracts/bim/questions/kernel'
import { useEditorTranslate, type Translate } from '../i18n/translate'

/**
 * An open question pin wears the theme's provisional colour (the same one a
 * placement not yet committed uses); assumptions and answered ones are quieter.
 * These were bridged shadcn tokens (`--primary`, `--muted-foreground`,
 * `--destructive`), which no theme defines.
 */
const OPEN = 'var(--mutiny-viewer-provisional)'
const QUIET = 'var(--mutiny-muted)'
/** An answer that may no longer hold: its tick turns to a warning. */
const WARN = 'var(--mutiny-warning)'

interface Props {
  readonly model: ModelState
  /** The plan the person is on (a plan by itself, or its viewport on a sheet). */
  readonly view: ViewOnPaper
  /** A pin was clicked or activated with Enter: open Coordination › Questions at it. */
  readonly onOpen: (questionId: ElementId) => void
  readonly focusedQuestionId?: ElementId | null
}

/** What a pin says when it is hovered or read out: the number, and what stands of the question. */
function pinLabel(p: QuestionPin, t: Translate): string {
  const state = p.status === 'open'
    ? p.blocksIssue
      ? t('questions.pinOpenHoldsIssue', 'open, holds the issue', { ns: 'editor' })
      : t('questions.pinOpen', 'open', { ns: 'editor' })
    : p.mayNoLongerHold
      ? t('questions.pinAnsweredMayNotHold', 'answered, but the answer may no longer hold', { ns: 'editor' })
      : p.status === 'answered'
        ? t('questions.pinAnswered', 'answered', { ns: 'editor' })
        : p.status === 'assumed'
          ? t('questions.pinAssumed', 'assumed', { ns: 'editor' })
          : p.status
  return t('questions.pinLabel', 'Question {{number}}, {{state}}. Open it in Coordination', { ns: 'editor', number: p.number, state })
}

/** Answered questions keep their pin with a tick, so the history stays where it happened. Declined, not in scope and withdrawn ones have no pin (they stay in the Questions list). */
const TICK_W = 1.8

/**
 * Question pins on a plan (SVG, paper millimetres): a tag per question at its
 * point or at what it is pinned to. Click (or Tab to it and press Enter) to
 * open the question in Coordination › Questions.
 */
export function QuestionPinsLayer({ model, view, onOpen, focusedQuestionId }: Props) {
  const t = useEditorTranslate()
  const level = viewModelLevel(model, view.view.props?.level, view.view.props?.levelElevationMm)
  const pins = useMemo(() => (level ? questionPinsOn(model, level.id) : []), [model, level])
  if (!level || pins.length === 0) return null
  const z = level.elevationMm
  return (
    <g data-testid="question-pins-layer" data-level={level.id}>
      {pins.map((p) => {
        const at = modelToPaperPoint(view, { x: p.position.x, y: p.position.y, z })
        const colour = p.status === 'open' ? OPEN : QUIET
        const focused = focusedQuestionId === p.questionId
        const answered = p.status === 'answered'
        const w = 2.2 + p.number.length * 1.25 + (answered ? TICK_W : 0)
        return (
          <g
            key={p.questionId}
            role="button"
            tabIndex={0}
            aria-label={pinLabel(p, t)}
            className="cursor-pointer outline-none"
            onClick={(e) => {
              e.stopPropagation()
              onOpen(p.questionId)
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen(p.questionId)
              }
            }}
            data-testid="question-pin"
            data-question={p.questionId}
            data-status={p.status}
            data-may-no-longer-hold={p.mayNoLongerHold ? 'true' : undefined}
          >
            <title>{pinLabel(p, t)}</title>
            <line x1={at.x} y1={at.y} x2={at.x + 2} y2={at.y - 3} stroke={colour} strokeWidth={0.25} />
            <rect x={at.x + 2} y={at.y - 5.2} width={w} height={3.2} rx={0.6} fill="var(--background)" stroke={colour} strokeWidth={focused ? 0.6 : 0.3} strokeDasharray={p.status === 'assumed' ? '0.8 0.4' : undefined} />
            {answered ? <path d={`M ${at.x + 2.6} ${at.y - 3.6} l 0.5 0.6 l 1 -1.3`} fill="none" stroke={p.mayNoLongerHold ? WARN : colour} strokeWidth={p.mayNoLongerHold ? 0.45 : 0.3} data-testid={p.mayNoLongerHold ? 'question-pin-warning' : 'question-pin-tick'} /> : null}
            <text x={at.x + 2 + (answered ? TICK_W : 0) + (w - (answered ? TICK_W : 0)) / 2} y={at.y - 2.9} fontSize={2.2} textAnchor="middle" fill={colour} fontWeight={p.blocksIssue && p.status === 'open' ? 700 : 400}>
              {p.number}
            </text>
          </g>
        )
      })}
    </g>
  )
}
