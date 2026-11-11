import type { ConnectionStatus, SaveState } from '@permitzip/bim-sync'
import type { CommandError } from '@permitzip/bim-kernel'
import { englishOnly, withValues, type Translate } from './i18n/translate'

/** What a person sees when the model refuses an edit: what stopped it, in drawing terms, not element ids. */
const MESSAGES: Record<CommandError['code'], string> = {
  element_not_found: 'That piece was removed by someone else. The view has been refreshed.',
  wrong_kind: "That piece can't be changed this way.",
  outside_host: "The branch can't slide past the end of the trunk.",
  tap_spacing: 'Too close to another branch takeoff. Keep them at least a takeoff width apart.',
  min_straight_length: 'A duct run would get shorter than its minimum straight length.',
  anchored_would_move: 'That would move ductwork that is pinned in place.',
  unsupported_geometry: "That change isn't supported for this shape of run yet.",
  profile_incompatible: "That size doesn't fit the fittings it connects to.",
  disconnected: 'That would disconnect the ductwork.',
  invalid_value: 'Enter a positive size.',
  already_exists: 'Something with that name or number already exists. Pick another.',
  in_use: "That's still placed on a sheet. Remove it from the sheet first.",
  stale_base: 'Someone else changed this at the same time. Your view has been updated; try again.',
  conflict: 'Someone else changed this at the same time. Your view has been updated; try again.',
  forbidden: "You don't have permission to edit this model.",
  has_dependents: 'Other things depend on this. Nothing was deleted.',
  undo_refused: "That change can't be undone now.",
  locked: 'That is in a locked group. Unlock the group in Manage › Groups & phases first.',
}

export function operatorMessage(code: CommandError['code']): string {
  return MESSAGES[code]
}

// The model server's wording (bim-sync NO_SUCH_MODEL) when a project you can see has no live model yet.
// Editors never get it: their first opening creates the model.
const NO_SUCH_MODEL = 'No such model'

export type ConnectionProblemKind = 'unreachable' | 'device_offline' | 'quiet' | 'signed_out' | 'sign_in_refused' | 'no_model' | 'no_access'

/** Why live editing isn't connected, in words a person can act on. */
export interface ConnectionProblem {
  readonly kind: ConnectionProblemKind
  readonly title: string
  readonly message: string
  /** True when trying again can help without anyone changing anything. */
  readonly retryable: boolean
}

export function connectionProblem(kind: ConnectionProblemKind, serverReason?: string): ConnectionProblem {
  switch (kind) {
    case 'unreachable':
      return { kind, title: "Can't reach the model server", message: "Check your connection or try again. Still trying in the background.", retryable: true }
    case 'device_offline':
      return { kind, title: 'This computer is offline', message: 'Edits you already made stay here and are sent when the connection is back. Reconnects on its own.', retryable: true }
    case 'quiet':
      return { kind, title: 'Checking the connection', message: "The model server hasn't answered for a few seconds. Your edits are kept on this computer and sent when it answers.", retryable: true }
    case 'signed_out':
      return { kind, title: "You're signed out", message: 'Sign in again, then try again.', retryable: true }
    case 'sign_in_refused':
      return { kind, title: 'The model server refused your sign-in', message: 'Sign out and back in, then try again. If it keeps happening, tell the software team.', retryable: true }
    case 'no_model':
      return { kind, title: "Live editing isn't set up for this project yet", message: 'The linked models still show here. Live editing starts the first time someone who can edit this project opens it.', retryable: false }
    case 'no_access':
      return { kind, title: 'No access to edit this model', message: serverReason ? `The model server said: ${serverReason}` : 'Ask a project lead to give you access.', retryable: false }
  }
}

/** Map the model server's refusal to a problem. */
export function problemForDenied(reason: string): ConnectionProblem {
  if (reason === NO_SUCH_MODEL) return connectionProblem('no_model')
  if (/sign in/i.test(reason)) return connectionProblem('sign_in_refused', reason)
  return connectionProblem('no_access', reason)
}

/**
 * "1 edit" / "3 edits", in the language the status bar is drawn in.
 *
 * Turkish has one form after a number (§8): both are `{{n}} düzenleme`, so the
 * pair of keys is not a plural rule but two English sentences, each keyed.
 *
 * `withValues` is not decoration: the default translator is `englishOnly`, which
 * returns the English argument **verbatim** — `{{n}} edits` would reach the
 * screen as those seven characters. `editsPausedMessage` takes that path (it has
 * no translator), so without the fill an ordinary offline-with-queued-edits
 * status line would print `Your {{n}} edits from before are queued`.
 */
function edits(n: number, t: Translate = englishOnly): string {
  if (n === 1) return t('status.editOne', '1 edit', { ns: 'editor' })
  return withValues(t('status.editsMany', '{{n}} edits', { n, ns: 'editor' }), { n })
}

/**
 * Why pointer edits (Move, Place, Route, Split, drags and nudges) are off while
 * the live connection is down. They draw on the model as last seen, so they
 * wait; edits already made stay queued and are sent on reconnect.
 */
export function editsPausedMessage(queued: number, deviceOffline: boolean): string {
  const why = deviceOffline ? 'This computer is offline' : 'Reconnecting to the model server'
  const kept = queued > 0 ? ` Your ${edits(queued)} from before ${queued === 1 ? 'is' : 'are'} queued and will be sent.` : ''
  return `${why}. Move, Place, Route and Split are off until it's back, so nothing is drawn on an out-of-date model.${kept}`
}

export type BadgeTone = 'ok' | 'busy' | 'warn' | 'muted'

function offlineLabel(pending: number, t: Translate): string {
  if (pending === 0) return t('status.offline', 'Offline: changes kept on this computer', { ns: 'editor' })
  const count = edits(pending, t)
  return withValues(t('status.offlineEdits', 'Offline: {{edits}} kept on this computer', { edits: count, ns: 'editor' }), { edits: count })
}

/**
 * The header's one-line connection and save state. "All changes saved" shows
 * only when the line is live, nothing is waiting, no problem is known and
 * edits aren't paused: it never claims saved over a dead or doubtful line.
 *
 * Every word it owns is `t('<key>', '<English>')` (§8's status vocabulary), so a
 * Turkish editor says `Bağlandı. Tüm değişiklikler kaydedildi` where an English
 * one says `Connected. All changes saved`.
 *
 * `t` is **required**: `englishOnly` returns the English verbatim, so a default
 * would let a future caller print `Offline: {{edits}}…`. A required parameter
 * turns that omission into a compile error instead of a screen with braces on it.
 *
 * The words it can show that are still English belong to Task 3.3: the 18
 * refusal codes, `editsPausedMessage`'s sentence, and the *title* of a known
 * connection problem — that one arrives on `problem`, worded by
 * `connectionProblem()`.
 */
export function statusBadge(
  status: ConnectionStatus | 'read_only',
  save: SaveState,
  problem: ConnectionProblem | null,
  editPaused: string | null,
  t: Translate,
): { label: string; tone: BadgeTone } {
  if (status === 'read_only') return { label: t('status.readOnly', 'View only — live editing not connected', { ns: 'editor' }), tone: 'muted' }
  if (problem?.kind === 'no_model') return { label: t('status.readOnlyNotSetUp', "View only — live editing isn't set up yet", { ns: 'editor' }), tone: 'muted' }
  if (status === 'denied' || (problem?.kind === 'no_access' && status !== 'live')) return { label: t('status.noAccess', 'No access to edit this model', { ns: 'editor' }), tone: 'warn' }
  // Had the model and lost the line (offline), or got the line back and is replaying (catching_up).
  const lostLine = status === 'offline' || (status === 'catching_up' && problem !== null)
  if (lostLine) {
    const pastGrace = problem?.kind === 'unreachable' || problem?.kind === 'device_offline'
    if (pastGrace) return { label: offlineLabel(save.pending, t), tone: 'warn' }
    if (save.pending === 0) return { label: t('status.reconnecting', 'Reconnecting…', { ns: 'editor' }), tone: 'busy' }
    const count = edits(save.pending, t)
    return {
      label: withValues(t('status.reconnectingKept', 'Reconnecting… {{edits}} kept on this computer', { edits: count, ns: 'editor' }), { edits: count }),
      tone: 'busy',
    }
  }
  if (problem?.kind === 'device_offline') return { label: offlineLabel(save.pending, t), tone: 'warn' }
  if (problem?.kind === 'quiet') return { label: t('status.checking', 'Checking the connection…', { ns: 'editor' }), tone: 'busy' }
  if (problem && status !== 'live') return { label: t('status.notConnected', 'Not connected', { ns: 'editor' }), tone: 'warn' }
  if (problem) return { label: problem.title, tone: 'warn' }
  if (editPaused) return { label: t('status.reconnecting', 'Reconnecting…', { ns: 'editor' }), tone: 'busy' }
  if (status === 'degraded') return { label: save.message ?? t('status.notSavedRetrying', 'Not saved yet — retrying', { ns: 'editor' }), tone: 'warn' }
  if (save.retrying > 0) return { label: withValues(t('status.notSavedRetryingCount', 'Not saved yet ({{n}}) — retrying', { n: save.retrying, ns: 'editor' }), { n: save.retrying }), tone: 'warn' }
  if (save.pending > 0) return { label: t('status.saving', 'Saving…', { ns: 'editor' }), tone: 'busy' }
  if (status === 'catching_up') return { label: t('status.catchingUp', "Catching up with others' changes…", { ns: 'editor' }), tone: 'busy' }
  if (status !== 'live') return { label: t('status.connecting', 'Connecting…', { ns: 'editor' }), tone: 'busy' }
  return { label: t('status.live', 'Connected. All changes saved', { ns: 'editor' }), tone: 'ok' }
}
