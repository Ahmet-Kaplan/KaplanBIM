'use client'

import { useMemo, useState } from 'react'
import {
  allocationPolicyOf,
  estimateVsDevicesText,
  requirementsEngineOf,
  typicalCount,
  typicalOf,
  type AllocationPolicy,
  type Command,
  type ModelState,
} from '@permitzip/bim-kernel'
import { Alert, AlertDescription } from '../../ui/alert'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { useEditorTranslate, type Translate } from '../i18n/translate'

interface Props {
  readonly model: ModelState
  readonly spaceId: string
  readonly canEdit: boolean
  /** Why the control is read-only (shown under it when `canEdit` is false). */
  readonly blockedReason: string
  /** Sends one kernel command with its undo label; returns the refusal, or null when it committed. */
  readonly submit: (command: Command, undoLabel: string) => string | null
}

const POLICIES: readonly AllocationPolicy[] = ['max', 'actual_only', 'allocation_only']
const MODEL = 'model'

function isPolicy(v: string): v is AllocationPolicy {
  return POLICIES.some((p) => p === v)
}

/**
 * The three policies in the language being read.
 *
 * These were `ALLOCATION_POLICY_LABELS` and `ALLOCATION_POLICY_HELP` from the kernel
 * — English data spliced into a Turkish frame ("Modelin dediği gibi (Estimate until
 * devices exceed it)"). The tree writes the English at the call site now, so the
 * caption scan can read it, and `i18n-loads-policy` asserts each row against the
 * kernel's own constant: if the kernel rewords a policy, that test fails and names
 * it rather than letting the two drift. The switches are typed by the kernel's
 * union, so a fourth policy fails to compile here before it can reach a screen in
 * the wrong language.
 */
export function allocationPolicyLabel(policy: AllocationPolicy, t: Translate): string {
  switch (policy) {
    case 'max':
      return t('loadsPolicy.policy.max', 'Estimate until devices exceed it', { ns: 'editor' })
    case 'actual_only':
      return t('loadsPolicy.policy.actualOnly', 'Devices only once any are placed', { ns: 'editor' })
    case 'allocation_only':
      return t('loadsPolicy.policy.allocationOnly', 'Estimate only', { ns: 'editor' })
  }
}

/** What a policy does, in one line, in `t`'s language. */
export function allocationPolicyHelp(policy: AllocationPolicy, t: Translate): string {
  switch (policy) {
    case 'max':
      return t(
        'loadsPolicy.help.max',
        'The estimate counts until the devices placed in the space add up to more, quantity by quantity.',
        { ns: 'editor' },
      )
    case 'actual_only':
      return t(
        'loadsPolicy.help.actualOnly',
        'Once any device is placed in the space, only the devices count; until then the estimate does.',
        { ns: 'editor' },
      )
    case 'allocation_only':
      return t('loadsPolicy.help.allocationOnly', 'Only the estimate counts, whatever is placed (early studies).', {
        ns: 'editor',
      })
  }
}

/** A label read mid-sentence: "Estimate until devices exceed it" → "estimate until…". */
const lowerFirst = (words: string): string => (words === '' ? words : `${words[0]?.toLocaleLowerCase('tr') ?? ''}${words.slice(1)}`)

/**
 * How this space's estimates count once devices are placed in it: the
 * model's setting (default: the estimate until the devices exceed it), or the
 * space's own. Under it, what the space counts right now, and how a typical
 * unit's space counts once here and once per copy in the project.
 */
export function EstimateCountingField({ model, spaceId, canEdit, blockedReason, submit }: Props) {
  const t = useEditorTranslate()
  const [error, setError] = useState<string | null>(null)
  const space = model.elements[spaceId]
  const modelPolicy = allocationPolicyOf(model.elements)
  const own = space?.kind === 'space' ? space.estimateCounting : undefined
  const effective = own ?? modelPolicy
  const now = useMemo(() => {
    if (space?.kind !== 'space') return null
    const f = requirementsEngineOf(model.elements).scopeFigures(model, { kind: 'space', id: space.id })
    return f.estimateIds.length > 0 ? estimateVsDevicesText(f) : null
  }, [model, space])
  const typical = space?.kind === 'space' ? typicalOf(model.elements, space) : null

  if (space?.kind !== 'space') {
    return (
      <Alert data-testid="estimate-counting-missing">
        <AlertDescription>
          {t(
            'loadsPolicy.gone',
            'This space is no longer in the model. Someone may have deleted it; pick another space.',
            { ns: 'editor' },
          )}
        </AlertDescription>
      </Alert>
    )
  }

  const where = space.number || space.name
  const choose = (v: string) => {
    const next = v === MODEL ? null : isPolicy(v) ? v : undefined
    if (next === undefined || (next ?? undefined) === own) return
    const label =
      next === null
        ? t('loadsPolicy.undoModel', 'count estimates as the model says in {{where}}', { ns: 'editor', where })
        : t('loadsPolicy.undoPolicy', 'count estimates: {{policy}} in {{where}}', {
            ns: 'editor',
            policy: lowerFirst(allocationPolicyLabel(next, t)),
            where,
          })
    setError(submit({ type: 'edit_space', spaceId: space.id, estimateCounting: next }, label))
  }

  const id = `estimate-counting-${space.id}`
  return (
    <Field data-testid="estimate-counting">
      <FieldLabel htmlFor={id}>{t('loadsPolicy.label', 'Estimates count', { ns: 'editor' })}</FieldLabel>
      <Select value={own ?? MODEL} disabled={!canEdit} onValueChange={choose}>
        <SelectTrigger
          id={id}
          size="sm"
          aria-label={t('loadsPolicy.aria', "How this space's estimates count", { ns: 'editor' })}
          title={canEdit ? undefined : blockedReason}
          data-testid="estimate-counting-trigger"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={MODEL}>
              {t('loadsPolicy.asModelSays', 'As the model says ({{policy}})', {
                ns: 'editor',
                policy: lowerFirst(allocationPolicyLabel(modelPolicy, t)),
              })}
            </SelectItem>
            {POLICIES.map((p) => (
              <SelectItem key={p} value={p}>
                {allocationPolicyLabel(p, t)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <FieldDescription data-testid="estimate-counting-help">
        {canEdit ? allocationPolicyHelp(effective, t) : blockedReason}
        {now ? ` ${t('loadsPolicy.now', 'Now: {{text}}.', { ns: 'editor', text: now })}` : ''}
        {typical
          ? ` ${t('loadsPolicy.typical', 'In typical {{kind}} {{mark}}: counted once here, {{count}}× in the project totals.', {
              ns: 'editor',
              kind: typical.spec.label.toLocaleLowerCase('tr'),
              mark: typical.spec.mark,
              count: typicalCount(typical.spec),
            })}`
          : ''}
      </FieldDescription>
      {error && (
        <Alert variant="destructive" data-testid="estimate-counting-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </Field>
  )
}
