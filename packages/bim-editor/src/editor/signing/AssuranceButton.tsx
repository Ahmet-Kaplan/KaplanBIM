'use client'

import { useState } from 'react'
import { Fingerprint, KeySquare } from 'lucide-react'
import { Button } from '../../ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '../../ui/field'
import { Input } from '../../ui/input'
import { Spinner } from '../../ui/spinner'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { checkTotpCodeFrom, type Assurance } from '../../contracts/bim/signing/client'
import { SIGNING_WORDS, windowWords } from '../../contracts/bim/signing/words'
import type { AssuranceOffer } from './useAssuranceOffer'
import { englishOnly, useEditorTranslate, type Translate } from '../i18n/translate'

/** "Accept and sign with Touch ID" / "Accept and verify with a code"; "Sign with Touch ID" when no action is named. */
export function assuranceLabel(offer: AssuranceOffer, action?: string, t: Translate = englishOnly): string {
  const byCode = offer.state === 'ready' && offer.method === 'code'
  const how = byCode ? t('signing.verifyWithCode', 'verify with a code', { ns: 'editor' }) : t('signing.signWithTouchId', 'sign with Touch ID', { ns: 'editor' })
  // The verb and its manner are one sentence: `Accept and verify with a code` is
  // not a verb spliced onto an English phrase (§0.7 keeps the union in the frame).
  if (action) return t('signing.actionAndHow', '{{action}} and {{how}}', { ns: 'editor', action, how })
  return byCode ? SIGNING_WORDS.verifyButton : SIGNING_WORDS.button
}

/**
 * The one extra button beside a plain Accept / Approve / Decline: Signed with
 * a passkey when the person has one here, else Verified with a one-time code.
 * A code is asked for and checked first (a wrong code records nothing); then
 * `onSecure` records the decision exactly as the plain button does and backs
 * it. When neither can be offered it stays visible and disabled, saying why
 * and what to do; the plain button still records.
 */
export function AssuranceButton({
  offer,
  onSecure,
  busy,
  blockedReason,
  action,
  size = 'default',
  variant = 'outline',
  testId,
}: {
  readonly offer: AssuranceOffer
  readonly onSecure: (assurance: Assurance) => void
  readonly busy: boolean
  /** Why the decision itself can't be made yet (the plain button is disabled for the same reason). */
  readonly blockedReason?: string | null
  /** "Accept", "Approve", … ; the button reads "<action> and sign with Touch ID". */
  readonly action?: string
  readonly size?: 'default' | 'sm'
  readonly variant?: 'default' | 'outline' | 'destructive'
  readonly testId?: string
}) {
  const t = useEditorTranslate()
  const signing = useEditorHost().data.signing
  const [asking, setAsking] = useState(false)
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const why = blockedReason ?? (offer.state === 'unavailable' ? offer.reason : offer.state === 'checking' ? SIGNING_WORDS.checking : null)
  const label = assuranceLabel(offer, action, t)

  function start() {
    if (offer.state !== 'ready') return
    if (offer.method === 'passkey') return onSecure({ method: 'passkey', keys: offer.keys })
    setCode('')
    setError(null)
    setAsking(true)
  }

  async function check() {
    setChecking(true)
    setError(null)
    try {
      const out = await checkTotpCodeFrom(signing, code.trim())
      if (!out.ok) return setError(out.reason)
      setAsking(false)
      onSecure({ method: 'code', grantId: out.grantId })
    } catch (err) {
      console.error('[AssuranceButton] checking the code failed', err)
      setError(err instanceof Error ? err.message : t('signing.codeCheckFailed', 'Couldn’t check the code. Try again.', { ns: 'editor' }))
    } finally {
      setChecking(false)
    }
  }

  const codeBlocked = /^[0-9]{6}$/.test(code.trim()) ? null : t('signing.enterSixDigits', 'Enter the 6 digits your authenticator app shows.', { ns: 'editor' })
  return (
    <span className="inline-flex flex-col gap-1">
      <Button size={size} variant={variant} disabled={why !== null || busy} title={why ?? undefined} aria-describedby={testId ? `${testId}-why` : undefined} onClick={start} data-testid={testId} data-method={offer.state === 'ready' ? offer.method : undefined}>
        {busy ? <Spinner aria-hidden /> : offer.state === 'ready' && offer.method === 'code' ? <KeySquare data-icon="inline-start" /> : <Fingerprint data-icon="inline-start" />}
        {label}
      </Button>
      <span id={testId ? `${testId}-why` : undefined} className="max-w-xs text-xs text-muted-foreground">
        {offer.state === 'unavailable' && !blockedReason ? offer.reason : offer.state === 'ready' ? (offer.method === 'code' ? t('signing.verifiedIsNotSignature', 'Verified is {{what}}. {{window}}', { ns: 'editor', what: SIGNING_WORDS.notASignature, window: windowWords(offer.windowMinutes, 'verify') }) : windowWords(offer.windowMinutes, 'sign')) : null}
      </span>
      <Dialog open={asking} onOpenChange={(o) => (o ? undefined : setAsking(false))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>{SIGNING_WORDS.codeHelp}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!codeBlocked) void check()
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={`${testId ?? 'assurance'}-code`}>{t('signing.oneTimeCode', 'One-time code', { ns: 'editor' })}</FieldLabel>
                <Input id={`${testId ?? 'assurance'}-code`} value={code} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))} data-testid="assurance-code" />
                <FieldDescription>{t('signing.codeRecordedAfter', 'Your decision is recorded only after the code checks.', { ns: 'editor' })}</FieldDescription>
              </Field>
              {error ? <FieldError data-testid="assurance-code-error">{error}</FieldError> : null}
            </FieldGroup>
            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t('signing.cancel', 'Cancel', { ns: 'editor' })}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={codeBlocked !== null || checking} title={codeBlocked ?? undefined} data-testid="assurance-code-submit">
                {checking ? <Spinner aria-hidden /> : null}
                Check code and record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </span>
  )
}
