'use client'

import { useEffect, useState } from 'react'
import type { SigningKeyView } from '../../contracts/bim/signing/api'
import { useEditorHost } from '@permitzip/bim-editor/host'
import { useEditorTranslate } from '../i18n/translate'
import { fetchSigningKeysFrom, passkeysSupported } from '../../contracts/bim/signing/client'
import { SIGNING_WORDS } from '../../contracts/bim/signing/words'

/**
 * Which extra assurance can be offered beside a plain button, strongest
 * first: Signed (a passkey made for this site, in a browser with passkeys),
 * else Verified (an authenticator app), else nothing, with what to do. It is
 * offered, never required: the plain button always records.
 */
export type AssuranceOffer =
  | { readonly state: 'checking' }
  | { readonly state: 'ready'; readonly method: 'passkey'; readonly keys: readonly SigningKeyView[]; readonly windowMinutes: number }
  | { readonly state: 'ready'; readonly method: 'code'; readonly windowMinutes: number }
  | { readonly state: 'unavailable'; readonly reason: string }

export function useAssuranceOffer(enabled: boolean): AssuranceOffer {
  const t = useEditorTranslate()
  const signing = useEditorHost().data.signing
  const [offer, setOffer] = useState<AssuranceOffer>({ state: 'checking' })
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    fetchSigningKeysFrom(signing, controller.signal)
      .then((res) => {
        const usable = passkeysSupported() ? res.keys.filter((k) => k.usableHere) : []
        if (usable.length > 0) return setOffer({ state: 'ready', method: 'passkey', keys: usable, windowMinutes: res.attachWindowMinutes })
        if (res.totp.state === 'active') return setOffer({ state: 'ready', method: 'code', windowMinutes: res.attachWindowMinutes })
        if (res.totp.state === 'locked') return setOffer({ state: 'unavailable', reason: t('signing.tooManyWrongCodes', 'Too many wrong codes: your authenticator is paused for 15 minutes. The plain button still records your decision.', { ns: 'editor' }) })
        setOffer({ state: 'unavailable', reason: res.keys.some((k) => k.usableHere) && !passkeysSupported() ? SIGNING_WORDS.noPasskeyBrowser : SIGNING_WORDS.noFactor })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        console.error('[useAssuranceOffer] checking for a passkey or authenticator failed; the plain button still records', err)
        setOffer({ state: 'unavailable', reason: t('signing.factorCheckFailed', 'Couldn’t check for your passkey or authenticator ({{why}}). The plain button still records your decision.', { ns: 'editor', why: err instanceof Error ? err.message : t('signing.noAnswer', 'no answer', { ns: 'editor' }) }) })
      })
    return () => controller.abort()
  }, [signing, enabled, t])
  return offer
}
