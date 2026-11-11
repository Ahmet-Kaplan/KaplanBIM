'use client'

import { useState } from 'react'
import type { ElementId } from '@permitzip/bim-kernel'
import { Alert, AlertDescription } from '../../ui/alert'
import { Button } from '../../ui/button'
import { Checkbox } from '../../ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Textarea } from '../../ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group'
import { NAMED_AUDIENCES, QUESTION_TYPES, type QuestionCommand, type KnownQuestionType as QuestionType } from '../../contracts/bim/questions/kernel'
import { newElementId } from '../placement'
import { useEditorTranslate, type Translate } from '../i18n/translate'
import { audienceLabel, typeLabel } from './question-rows'

/** What each kind of question records, in the words the dialog shows under the picker. */
const TYPE_HINT: Readonly<Record<QuestionType, (t: Translate) => string>> = {
  question: (t) => t('questions.typeHintQuestion', 'Someone has to tell us. It stays open until answered.', { ns: 'editor' }),
  assumption: (t) => t('questions.typeHintAssumption', 'We go ahead on it now and ask them to confirm.', { ns: 'editor' }),
  field_verify: (t) => t('questions.typeHintVerify', 'Someone checks it on site. It stays open until checked.', { ns: 'editor' }),
}

function isQuestionType(v: string): v is QuestionType {
  return (QUESTION_TYPES as readonly string[]).includes(v)
}

interface Props {
  readonly open: boolean
  /** What the question is about: the elements selected on the plan. */
  readonly elementIds: readonly ElementId[]
  /** "SD-1, SD-2": what the person sees selected. */
  readonly aboutLabel: string
  readonly submit: (command: QuestionCommand, undoLabel: string) => string | null
  readonly onClose: () => void
  /** Asking a closed question anew: the new question links back ("Asked before: Q-12, closed: not in scope"). */
  readonly askedBefore?: { readonly id: ElementId; readonly words: string } | null
}

/** Ask about what is selected: the question, who it is for, and whether it holds the issue. Esc or Cancel closes with nothing added. */
export function AskQuestionDialog({ open, elementIds, aboutLabel, submit, onClose, askedBefore }: Props) {
  const t = useEditorTranslate()
  const [text, setText] = useState('')
  const [type, setType] = useState<QuestionType>('question')
  const [askOf, setAskOf] = useState<string>('client')
  const [holds, setHolds] = useState(false)
  const [closeBy, setCloseBy] = useState('')
  const [refusal, setRefusal] = useState<string | null>(null)

  const missing = text.trim() === '' ? t('questions.typeQuestionFirst', 'Type the question first.', { ns: 'editor' }) : elementIds.length === 0 ? t('questions.selectWhatItsAboutFirst', 'Select what it is about on the plan first.', { ns: 'editor' }) : null

  const reset = () => {
    setText('')
    setType('question')
    setHolds(false)
    setCloseBy('')
    setRefusal(null)
  }

  const save = () => {
    if (missing) return
    const refused = submit(
      {
        type: 'add_question',
        questions: [
          {
            questionId: newElementId('question'),
            type,
            text: text.trim(),
            askOf,
            anchor: { elementIds: [...elementIds] },
            ...(holds && type !== 'assumption' ? { blocksIssue: true } : {}),
            ...(closeBy.trim() ? { closeBy: closeBy.trim() } : {}),
            ...(askedBefore ? { askedBefore: askedBefore.id } : {}),
          },
        ],
      },
      type === 'assumption' ? t('questions.addAssumption', 'Add assumption', { ns: 'editor' }) : t('questions.addQuestion', 'Add question', { ns: 'editor' }),
    )
    if (refused) {
      setRefusal(refused)
      return
    }
    reset()
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent data-testid="questions-ask-dialog">
        <DialogHeader>
          <DialogTitle>{t('questions.askAboutTitle', 'Ask about {{what}}', { ns: 'editor', what: aboutLabel || t('questions.theSelection', 'the selection', { ns: 'editor' }) })}</DialogTitle>
          <DialogDescription>{askedBefore ? t('questions.askedBeforeDescription', 'A new question that links back to {{words}}. It pins to the same things.', { ns: 'editor', words: askedBefore.words }) : t('questions.askDescription', 'It pins to what is selected and shows in Coordination › Questions.', { ns: 'editor' })}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="question-text">{t('questions.fieldQuestion', 'Question', { ns: 'editor' })}</FieldLabel>
            <Textarea id="question-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('questions.placeholderQuestion', 'Is there a beam here? Please confirm.', { ns: 'editor' })} maxLength={1000} data-testid="questions-ask-text" />
          </Field>
          <Field>
            <FieldLabel>{t('questions.fieldKind', 'Kind', { ns: 'editor' })}</FieldLabel>
            <ToggleGroup type="single" variant="outline" value={type} onValueChange={(v) => isQuestionType(v) && setType(v)} aria-label={t('questions.fieldKind', 'Kind', { ns: 'editor' })}>
              {QUESTION_TYPES.map((kind) => (
                <ToggleGroupItem key={kind} value={kind} data-testid={`questions-ask-type-${kind}`}>
                  {typeLabel(kind, t)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldDescription>{TYPE_HINT[type](t)}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="question-ask-of">{t('questions.fieldFor', 'For', { ns: 'editor' })}</FieldLabel>
            <Select value={askOf} onValueChange={setAskOf}>
              <SelectTrigger id="question-ask-of" data-testid="questions-ask-of">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {NAMED_AUDIENCES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {audienceLabel(a, t)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field orientation="horizontal">
            <Checkbox id="question-holds" checked={holds} onCheckedChange={(v) => setHolds(v === true)} disabled={type === 'assumption'} aria-label={t('questions.holdsTheIssue', 'Holds the issue', { ns: 'editor' })} data-testid="questions-ask-holds" />
            <FieldLabel htmlFor="question-holds">{t('questions.holdsTheIssue', 'Holds the issue', { ns: 'editor' })}</FieldLabel>
            <FieldDescription>{type === 'assumption' ? t('questions.assumptionNeverHolds', 'An assumption never holds an issue: the design goes ahead on it.', { ns: 'editor' }) : t('questions.holdsHint', 'Sheets showing this can’t be issued while it is open.', { ns: 'editor' })}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="question-close-by">{t('questions.neededByOptional', 'Needed by (optional)', { ns: 'editor' })}</FieldLabel>
            <Input id="question-close-by" value={closeBy} onChange={(e) => setCloseBy(e.target.value)} placeholder="DD" maxLength={40} />
          </Field>
        </FieldGroup>
        {refusal ? (
          <Alert variant="destructive" data-testid="questions-ask-refusal">
            <AlertDescription>{refusal}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            {t('questions.cancel', 'Cancel', { ns: 'editor' })}
          </Button>
          <Button onClick={save} disabled={missing !== null} title={missing ?? undefined} data-testid="questions-ask-save">
            {type === 'assumption' ? t('questions.addAssumption', 'Add assumption', { ns: 'editor' }) : t('questions.addQuestion', 'Add question', { ns: 'editor' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
