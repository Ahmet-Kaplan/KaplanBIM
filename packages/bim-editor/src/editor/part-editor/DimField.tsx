'use client'

import { useState } from 'react'
import { parseFormula, type Dim, type ParamDef } from '@permitzip/bim-kernel'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'
import { MM_PER_IN, dimText } from './draft'

/** Text to a dimension: a number is inches, a parameter's name binds to it, anything else is a formula. */
export function parseDim(text: string, params: readonly ParamDef[], unit: 'in' | 'deg' = 'in', t: Translate = englishOnly): { dim: Dim } | { error: string } {
  const trimmed = text.trim()
  if (trimmed === '') return { error: t('partEditor.dim.needOne', 'Give a number, a parameter name or a formula', { ns: 'editor' }) }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return { dim: unit === 'in' ? Math.round(Number(trimmed) * MM_PER_IN * 1000) / 1000 : Number(trimmed) }
  const param = params.find((p) => p.name === trimmed)
  if (param) return { dim: { param: param.name } }
  try {
    parseFormula(trimmed)
  } catch (err) {
    return { error: err instanceof Error ? err.message : t('partEditor.dim.notFormula', 'Not a formula', { ns: 'editor' }) }
  }
  const known = new Set(params.map((p) => p.name))
  const unknown = trimmed.match(/[a-z_][a-z0-9_]*/gi)?.filter((w) => !known.has(w) && !['in', 'ft', 'mm', 'if', 'min', 'max', 'abs', 'sqrt', 'round', 'floor', 'ceil', 'sin', 'cos', 'tan', 'and', 'or', 'not', 'true', 'false'].includes(w))
  if (unknown && unknown.length > 0) return { error: t('partEditor.dim.notAParameter', '{{name}} is not a parameter', { ns: 'editor', name: unknown[0] }) }
  return { dim: { formula: trimmed } }
}

interface Props {
  id: string
  label: string
  value: Dim
  params: readonly ParamDef[]
  unit?: 'in' | 'deg'
  onChange: (dim: Dim) => void
  disabled?: boolean
}

export function DimField({ id, label, value, params, unit = 'in', onChange, disabled }: Props) {
  const t = useEditorTranslate()
  const shown = unit === 'deg' && typeof value === 'number' ? String(value) : dimText(value)
  const [text, setText] = useState(shown)
  const [lastShown, setLastShown] = useState(shown)
  const [error, setError] = useState<string | null>(null)
  // The value changed elsewhere (undo, another field): show it.
  if (lastShown !== shown) {
    setLastShown(shown)
    setText(shown)
  }
  const commit = () => {
    const r = parseDim(text, params, unit, t)
    if ('error' in r) {
      setError(r.error)
      return
    }
    setError(null)
    // Leaving the field without a change (e.g. clicking Undo) must not add a step to undo.
    if (JSON.stringify(r.dim) !== JSON.stringify(value)) onChange(r.dim)
  }
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={text}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
        }}
      />
      <FieldDescription className={error ? 'text-danger-600' : undefined} role={error ? 'alert' : undefined}>
        {error ??
          (unit === 'in'
            ? t('partEditor.dim.hintInches', 'Inches, a parameter (e.g. height) or a formula (e.g. height / 2 + 1in)', { ns: 'editor' })
            : t('partEditor.dim.hintDegrees', 'Degrees, a parameter or a formula', { ns: 'editor' }))}
      </FieldDescription>
    </Field>
  )
}
