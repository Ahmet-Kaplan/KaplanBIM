import type { ConnectionStatus, SaveState } from '@permitzip/bim-sync'
import type { CommandError } from '@permitzip/bim-kernel'
import { translateProse, trProse, type MutinyLanguage } from '@permitzip/bim-ui'
import { withValues, type Translate } from './i18n/translate'

/**
 * Every refusal and every "not connected yet" a person can meet, in the language
 * the editor is drawn in.
 *
 * These are the sentences a person reads when an action *didn't* happen, so each
 * one has to say two things: what stopped it, and what to do next. The Turkish
 * is the glossary's (`docs/i18n/glossary.md` §8 status and error vocabulary,
 * §2.1 *eleman*, §2.4 *pafta*), and it keeps both halves — a softer sentence that
 * drops the "what to do next" step would leave someone stuck.
 *
 * **The translator is a required parameter everywhere, never defaulted to
 * `englishOnly`.** That default returns its English argument verbatim, so a
 * `{{placeholder}}` in a sentence would reach the screen as braces: it has
 * happened twice in this project. Every path that can emit a placeholder also
 * passes its values through `withValues`, so even that translator fills the holes.
 *
 * The namespace is written at each call site rather than read from a hook: this
 * file is threaded a `Translate` (it has no `useT('editor')` to bind to), and
 * `npm run i18n:review` binds a call to a namespace by the literal in the call.
 */

/** What a person sees when the model refuses an edit: what stopped it, in drawing terms, not element ids. */
const MESSAGES: Record<CommandError['code'], (t: Translate) => string> = {
  element_not_found: (t) =>
    t('operator.element_not_found', 'That piece could not be found. Pick it again from the model.', { ns: 'editor' }),
  wrong_kind: (t) => t('operator.wrong_kind', "That piece can't be changed this way.", { ns: 'editor' }),
  outside_host: (t) =>
    t('operator.outside_host', 'That would leave the element it belongs to. Move it back inside, then try again.', { ns: 'editor' }),
  tap_spacing: (t) =>
    t('operator.tap_spacing', 'Too close to another branch takeoff. Keep them at least a takeoff width apart.', { ns: 'editor' }),
  min_straight_length: (t) =>
    t('operator.min_straight_length', 'That would leave an element shorter than its minimum straight length. Slide it along and try again.', {
      ns: 'editor',
    }),
  anchored_would_move: (t) =>
    t('operator.anchored_would_move', 'That would move what it is attached to. Detach it first.', { ns: 'editor' }),
  unsupported_geometry: (t) =>
    t('operator.unsupported_geometry', "The model can't build that shape yet. Change the route and try again.", { ns: 'editor' }),
  profile_incompatible: (t) => t('operator.profile_incompatible', "That size doesn't fit the fittings it joins.", { ns: 'editor' }),
  disconnected: (t) => t('operator.disconnected', 'The ends could not be joined. Check that they face each other.', { ns: 'editor' }),
  invalid_value: (t) => t('operator.invalid_value', "That value isn't valid. Check it and try again.", { ns: 'editor' }),
  already_exists: (t) =>
    t('operator.already_exists', 'That is already there or clashes with something else. Choose another.', { ns: 'editor' }),
  // An OR over the causes, and no remedy. The nineteen sentences behind `in_use` are not
  // one situation: a lock (`"{0}" is locked. Unlock it before deleting it.`), a pinned sheet
  // item, a panel with no free pole space, the default group or phase, a view holding a
  // phase or filter, a shared circuit, a load point already on an end. Naming any single
  // cause would be false for the others — the round-2 wording ("still used somewhere else")
  // was — and naming a remedy would be wrong for most of them, so this says *may be* and
  // lists what is worth checking.
  in_use: (t) =>
    t('operator.in_use', "That couldn't be done. It may be locked, pinned or still in use somewhere else.", { ns: 'editor' }),
  stale_base: (t) =>
    t('operator.stale_base', 'Someone else changed this at the same time. Reload before trying again.', { ns: 'editor' }),
  conflict: (t) =>
    t('operator.conflict', 'Someone else changed this at the same time, so nothing was saved. Check it and try again.', { ns: 'editor' }),
  forbidden: (t) => t('operator.forbidden', "You don't have permission to edit this model.", { ns: 'editor' }),
  // Reassurance only, for the same reason: "nothing was deleted" is false for the one
  // sentence that is about *saving* a connector, and "detach or move them" is wrong for
  // the group and the pinning cases.
  has_dependents: (t) =>
    t('operator.has_dependents', 'Other things are attached to this, so nothing was changed.', { ns: 'editor' }),
  undo_refused: (t) => t('operator.undo_refused', "That change can't be undone now.", { ns: 'editor' }),
  locked: (t) => t('operator.locked', "That is locked, so it couldn't be changed. Unlock it and try again.", { ns: 'editor' }),
}

export function operatorMessage(code: CommandError['code'], t: Translate): string {
  return MESSAGES[code](t)
}

/**
 * The codes whose kernel sentence is passed through as written: it names the group,
 * the sheet, the revision or the sheet-view that the generic sentence above cannot.
 * They are the six a person met in English before this composition existed.
 */
export const KERNEL_WORD_CODES: ReadonlySet<CommandError['code']> = new Set<CommandError['code']>([
  'has_dependents',
  'undo_refused',
  'conflict',
  'already_exists',
  'in_use',
  'locked',
])

/**
 * What a person reads when the model refuses an edit: the kernel's own sentence when
 * it can be said in their language, else the editor's sentence for that code.
 *
 * The kernel writes an English sentence, not a message key (`CommandError.message`),
 * and it may not import i18n — it is the engine. So the sentence is translated where
 * it is shown, by template: numbers out to `{0}`, `{1}`…, the template looked up in
 * `locales/tr/prose.json`, the numbers put back in order (`translateProse`).
 *
 * When no template can key the sentence — it names something, so the runtime text and
 * the template differ by whole words (`2 elements are in "Level 1"`) — the answer is
 * **not** the English sentence. The person gets the translated generic sentence for
 * that code: a Turkish sentence that says less, never an English one on a Turkish
 * screen. English is the source and is answered with the kernel's sentence for the six
 * codes above and the editor's own sentence for the rest, exactly as before.
 */
export function refusalWords(code: CommandError['code'], message: string, language: MutinyLanguage, t: Translate): string {
  if (language !== 'tr') return KERNEL_WORD_CODES.has(code) ? message : operatorMessage(code, t)
  const sentences = translateProse(message, language, trProse)
  return sentences === message ? operatorMessage(code, t) : sentences
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

/** The words of one problem; `kind` and `retryable` are facts, not language. */
function problemWords(kind: ConnectionProblemKind, t: Translate, serverReason: string | undefined): Omit<ConnectionProblem, 'kind'> {
  switch (kind) {
    case 'unreachable':
      return {
        title: t('connection.unreachable.title', "Can't reach the model server", { ns: 'editor' }),
        message: t('connection.unreachable.message', 'Check your connection or try again. Still trying in the background.', { ns: 'editor' }),
        retryable: true,
      }
    case 'device_offline':
      return {
        title: t('connection.device_offline.title', 'This computer is offline', { ns: 'editor' }),
        message: t('connection.device_offline.message', 'Edits you already made stay here and are sent when the connection is back. Reconnects on its own.', {
          ns: 'editor',
        }),
        retryable: true,
      }
    case 'quiet':
      return {
        title: t('connection.quiet.title', 'Checking the connection', { ns: 'editor' }),
        message: t('connection.quiet.message', "The model server hasn't answered for a few seconds. Your edits are kept on this computer and sent when it answers.", {
          ns: 'editor',
        }),
        retryable: true,
      }
    case 'signed_out':
      return {
        title: t('connection.signed_out.title', "You're signed out", { ns: 'editor' }),
        message: t('connection.signed_out.message', 'Sign in again, then try again.', { ns: 'editor' }),
        retryable: true,
      }
    case 'sign_in_refused':
      return {
        title: t('connection.sign_in_refused.title', 'The model server refused your sign-in', { ns: 'editor' }),
        message: t('connection.sign_in_refused.message', 'Sign out and back in, then try again. If it keeps happening, tell the software team.', {
          ns: 'editor',
        }),
        retryable: true,
      }
    case 'no_model':
      return {
        title: t('connection.no_model.title', "Live editing isn't set up for this project yet", { ns: 'editor' }),
        message: t('connection.no_model.message', 'The linked models still show here. Live editing starts the first time someone who can edit this project opens it.', {
          ns: 'editor',
        }),
        retryable: false,
      }
    case 'no_access': {
      const title = t('connection.no_access.title', 'No access to edit this model', { ns: 'editor' })
      // The server's own words travel inside our sentence: they are quoted, never
      // reworded, and never dropped — they are the only thing that says which access was refused.
      if (!serverReason) return { title, message: t('connection.no_access.message', 'Ask a project lead to give you access.', { ns: 'editor' }), retryable: false }
      const reason = serverReason
      return {
        title,
        message: withValues(t('connection.serverSaid', 'The model server said: {{reason}}', { reason, ns: 'editor' }), { reason }),
        retryable: false,
      }
    }
  }
}

export function connectionProblem(kind: ConnectionProblemKind, t: Translate, serverReason?: string): ConnectionProblem {
  return { kind, ...problemWords(kind, t, serverReason) }
}

/** Why editing is off in this view. A cause, not prose: one place words it. */
export type EditingOffCause = 'read_only' | 'no_access' | 'connecting'

/**
 * Why this view can't be edited, in one sentence: the cause **and** what can be
 * done about it.
 *
 * This is the single wording for the read-only half of the surface — the tool
 * notice, the ribbon's disabled reasons, the properties panels and the toast all
 * show this same string, so translating it once translates all of them. (There
 * used to be a second, competing sentence in `tool-readiness.ts`; it was deleted
 * rather than left to drift.)
 */
export function editingOffReason(cause: EditingOffCause, t: Translate): string {
  switch (cause) {
    case 'read_only':
      return t('blocked.readOnly', "Live editing isn't connected for this project, so views and sheets can't be made here yet.", { ns: 'editor' })
    case 'no_access':
      return t('blocked.noAccess', "You can look, but you don't have editing access to this model. Ask a project lead.", { ns: 'editor' })
    case 'connecting':
      return t('blocked.connecting', 'Connecting to the model server…', { ns: 'editor' })
  }
}

/** Map the model server's refusal to a problem. */
export function problemForDenied(reason: string, t: Translate): ConnectionProblem {
  if (reason === NO_SUCH_MODEL) return connectionProblem('no_model', t)
  if (/sign in/i.test(reason)) return connectionProblem('sign_in_refused', t, reason)
  return connectionProblem('no_access', t, reason)
}

/**
 * "1 edit" / "3 edits", in the language the status bar is drawn in.
 *
 * Turkish has one form after a number (§8): both are `{{n}} düzenleme`, so the
 * pair of keys is not a plural rule but two English sentences, each keyed.
 *
 * `withValues` is not decoration: a `Translate` may be `englishOnly`, which
 * returns the English argument **verbatim** — `{{n}} edits` would reach the
 * screen as those seven characters. The fill repairs every path, whichever
 * translator arrives.
 */
function edits(n: number, t: Translate): string {
  if (n === 1) return t('status.editOne', '1 edit', { ns: 'editor' })
  return withValues(t('status.editsMany', '{{n}} edits', { n, ns: 'editor' }), { n })
}

/** " Your 3 edits from before are queued and will be sent." — the half that says nothing was lost. */
function keptWords(queued: number, t: Translate): string {
  const count = edits(queued, t)
  if (queued === 1)
    return withValues(t('paused.keptOne', 'Your {{edits}} from before is queued and will be sent.', { edits: count, ns: 'editor' }), { edits: count })
  return withValues(t('paused.keptMany', 'Your {{edits}} from before are queued and will be sent.', { edits: count, ns: 'editor' }), {
    edits: count,
  })
}

/**
 * Why pointer edits (Move, Place, Route, Split, drags and nudges) are off while
 * the live connection is down. They draw on the model as last seen, so they
 * wait; edits already made stay queued and are sent on reconnect.
 */
export function editsPausedMessage(queued: number, deviceOffline: boolean, t: Translate): string {
  const why = deviceOffline
    ? t('paused.whyOffline', 'This computer is offline', { ns: 'editor' })
    : t('paused.whyReconnecting', 'Reconnecting to the model server', { ns: 'editor' })
  const toolsOff = t('paused.toolsOff', "Move, Place, Route and Split are off until it's back, so nothing is drawn on an out-of-date model.", { ns: 'editor' })
  const kept = queued > 0 ? ` ${keptWords(queued, t)}` : ''
  return `${why}. ${toolsOff}${kept}`
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
 * The one word it can show that arrives already-worded is a known connection
 * problem's *title*: `connectionProblem()` says it in the same language.
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
