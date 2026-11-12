/**
 * "…: not available here, because this app doesn't provide it." in the language on
 * screen.
 *
 * `unavailableWords` in `@permitzip/bim-editor/host/unavailable` writes this sentence for
 * the contracts layer — a package with no translator and dozens of callers in
 * `src/contracts/**` — so splicing its English frame into a Turkish screen mixes two
 * languages in one sentence. The editor says it in its own words instead; the English is
 * character for character the same, so nothing a person reads today changes.
 *
 * The two closing sentences are shared with the editor's own `session.unavailableNext*`
 * keys: one app, one way to say where a missing service is connected.
 */
import type { Translate } from './translate'

/** Why a feature is missing here, in the language the screen is drawn in. */
export function unavailableIn(
  service: string,
  host: { readonly hostName?: string | null; readonly connectHint?: string | null } | null | undefined,
  t: Translate,
): string {
  const where = host?.hostName ?? t('session.thisApp', 'this app', { ns: 'editor' })
  const connectHint = host?.connectHint
  const next =
    connectHint === undefined || connectHint === null
      ? t('session.unavailableNextPlain', ' Open this model in an app that has it set up.', { ns: 'editor' })
      : t('session.unavailableNextHint', ' Connect it in {{where}}, or open this model where it is set up.', { ns: 'editor', where: connectHint })
  return `${t('unavailable.here', "{{service}}: not available here, because {{where}} doesn't provide it.", { ns: 'editor', service, where })}${next}`
}
