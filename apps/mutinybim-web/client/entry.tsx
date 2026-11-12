/**
 * The editor page of the hosted app: the full Building Model editor against
 * this app's model server, under a slim bar with the way back to the model
 * list, Ask AI (the person's own key, browser to provider) and, when the
 * deployment has one, the quote link. Package imports only.
 */
import { StrictMode, useCallback, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { Button, MutinyThemeProvider, Spinner, isMutinyColorScheme, useMutinyPortalContainer, useT, type ColorSchemeAdapter, type MutinyColorScheme, type MutinyLanguage, type MutinyThemeOverrides } from '@permitzip/bim-ui'
import { EditorHostProvider } from '@permitzip/bim-editor/host'
import { createLocalEditorHost, createLocalShellHost } from '@permitzip/bim-editor/host/local'
import { PortalContainerProvider } from '@permitzip/bim-editor/ui/overlay-boundary'
import { TooltipProvider } from '@permitzip/bim-editor/ui/tooltip'
import { BuildingModelSurface, type BuildingModelView } from '@permitzip/bim-editor/editor/BuildingModelSurface'
import { mutinyToShadcnVars } from '../../../packages/bim-editor/demo/theme'
import { EditorLanguageProvider, editorPageLanguage } from './editor-language'
import { HostedBar } from './hosted-bar'
import { pageLanguage, pageTranslator } from './web-i18n'
import { answerApproval, ApprovalsError, fetchWaitingApprovals, type ApprovalAnswer, type WaitingApproval } from './approvals'

interface PageData {
  readonly modelId: string
  readonly modelName: string
  readonly userId: string
  readonly displayName: string
  readonly quoteLabel: string | null
  /** owner, edit or view (view: the model server refuses edits). */
  readonly access: 'owner' | 'edit' | 'view'
  /** Whose model it is, when it was shared with this person. */
  readonly owner: string | null
  readonly colorScheme: MutinyColorScheme
  /** The language the server answered this page in (the cookie, then the account). */
  readonly language: MutinyLanguage
}

function readPageData(): PageData {
  const el = document.getElementById('mutinybim-page')
  if (!el?.textContent) throw new Error('[mutinybim-web] the editor page has no page data')
  const parsed: unknown = JSON.parse(el.textContent)
  if (typeof parsed !== 'object' || parsed === null) throw new Error('[mutinybim-web] the editor page data is not an object')
  const p = parsed as Record<string, unknown>
  const text = (key: string) => {
    const value = p[key]
    if (typeof value !== 'string') throw new Error(`[mutinybim-web] the editor page data has no ${key}`)
    return value
  }
  const access = p.access === 'edit' || p.access === 'view' ? p.access : 'owner'
  return {
    modelId: text('modelId'),
    modelName: text('modelName'),
    userId: text('userId'),
    displayName: text('displayName'),
    quoteLabel: typeof p.quoteLabel === 'string' ? p.quoteLabel : null,
    access,
    owner: typeof p.owner === 'string' ? p.owner : null,
    colorScheme: isMutinyColorScheme(p.colorScheme) ? p.colorScheme : 'system',
    language: editorPageLanguage(p.language),
  }
}

const data = readPageData()
const THEME: MutinyThemeOverrides = {
  brand: { logoUrl: '/assets/bim-ui/mutiny-logo.png', iconUrl: '/assets/bim-ui/mutiny-icon.svg' },
}
const params = new URLSearchParams(window.location.search)
const viewParam = params.get('view')
const initialView: BuildingModelView = viewParam === '3d' || viewParam === 'sheet' ? viewParam : 'plan'
const authorityUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/sync`
const localHost = createLocalEditorHost({
  authorityUrl,
  userId: data.userId,
  displayName: data.displayName,
  token: 'session',
})
const host = {
  ...localHost,
  shell: createLocalShellHost({ connectAgentHref: '/connect' }),
  capabilities: {
    ...localHost.capabilities,
    hostName: 'MutinyBIM',
    // A getter, not a string: the page's language can be switched without this host —
    // and the editor's session effects — being rebuilt (they depend on the host's
    // identity), and `<html lang>` is what `<I18nProvider>` keeps in step with the
    // screen. So the hint is translated when somebody reads it, in the language on
    // screen then.
    get connectHint() {
      const t = pageTranslator(pageLanguage())
      return t('host.connectHint', 'Connect your own AI assistant to this model: Connect an assistant, in the bar above.', { ns: 'web' })
    },
  },
}

/** The theme choice is kept in the account, so the model list and the editor agree. */
const schemeAdapter: ColorSchemeAdapter = {
  get: () => data.colorScheme,
  set: async (scheme) => {
    const response = await fetch('/settings/scheme', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scheme }) })
    if (!response.ok) throw new Error(response.status === 401 ? 'You are signed out, so the theme was not saved.' : 'The theme could not be saved. Try again.')
    document.documentElement.setAttribute('data-mutiny-scheme', scheme)
  },
}

const APPROVALS_EVERY_MS = 5000
const APPROVALS_SHOWN = 2

/** Changes an outside assistant is waiting for this person to approve, shown above the model without a reload. */
function ApprovalNotices() {
  const t = useT('web')
  const [waiting, setWaiting] = useState<readonly WaitingApproval[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<{ readonly ok: boolean; readonly words: string } | null>(null)

  /** False once checking should stop (signed out). */
  const check = useCallback(async (): Promise<boolean> => {
    if (document.visibilityState !== 'visible') return true
    try {
      setWaiting(await fetchWaitingApprovals(t))
      setProblem(null)
      return true
    } catch (err) {
      console.error('[mutinybim-web] checking for approval requests failed', err)
      setProblem(err instanceof ApprovalsError ? err.message : t('approvals.checkFailed', 'Checking for approval requests failed. Open Approvals to see what is waiting.', { ns: 'web' }))
      return !(err instanceof ApprovalsError && err.signedOut)
    }
  }, [t])

  useEffect(() => {
    let timer = 0
    let stopped = false
    const tick = async () => {
      if (stopped || (await check())) return
      stopped = true
      window.clearInterval(timer)
    }
    void tick()
    timer = window.setInterval(() => void tick(), APPROVALS_EVERY_MS)
    const onVisible = () => void tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [check])

  useEffect(() => {
    document.title = `${waiting.length > 0 ? `(${waiting.length}) ` : ''}${data.modelName} · MutinyBIM`
  }, [waiting.length])

  const answer = useCallback(
    async (item: WaitingApproval, decision: ApprovalAnswer) => {
      setBusy(item.id)
      setResult(null)
      try {
        setResult(await answerApproval(item.id, decision, t))
      } catch (err) {
        console.error('[mutinybim-web] answering an approval request failed', err)
        setResult({ ok: false, words: err instanceof ApprovalsError ? err.message : t('approvals.answerNotSent', "Your answer wasn't sent. Check your connection, then answer it on Approvals.", { ns: 'web' }) })
      } finally {
        setBusy(null)
        void check()
      }
    },
    [check, t],
  )

  if (waiting.length === 0 && !problem && !result) return null
  return (
    <div role="region" aria-label={t('approvals.waitingAria', 'Waiting for your approval', { ns: 'web' })} data-testid="approval-notices" className="flex flex-none flex-col gap-1.5 border-b border-(--mutiny-border) bg-(--mutiny-accent-subtle) px-3 py-2 text-sm text-(--mutiny-text)">
      {waiting.slice(0, APPROVALS_SHOWN).map((item) => (
        <div key={item.id} role="status" className="flex flex-wrap items-center gap-2" data-testid="approval-notice">
          <span className="min-w-0 flex-1 basis-64 break-words">
            <strong>{item.assistant}</strong>
            {item.modelId === data.modelId
              ? t('approvals.waitingChangeThisModel', ' is waiting for your approval to change this model: {{title}}', { ns: 'web', title: item.title })
              : t('approvals.waitingChange', ' is waiting for your approval: {{title}}', { ns: 'web', title: item.title })}
          </span>
          <Button type="button" size="sm" disabled={busy !== null} onClick={() => void answer(item, 'approve')}>
            {busy === item.id ? <Spinner /> : null}
            {t('approvals.approve', 'Approve', { ns: 'web' })}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void answer(item, 'decline')}>
            {t('approvals.decline', 'Decline', { ns: 'web' })}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={item.href} target="_blank" rel="noopener noreferrer">
              {t('approvals.seeExactly', 'See exactly what changes', { ns: 'web' })}
            </a>
          </Button>
        </div>
      ))}
      {waiting.length > APPROVALS_SHOWN ? (
        <a className="underline" href="/approvals" target="_blank" rel="noopener noreferrer">
          {t('approvals.andMoreOnApprovals', 'And {{count}} more waiting on Approvals', { ns: 'web', count: waiting.length - APPROVALS_SHOWN })}
        </a>
      ) : null}
      {result ? (
        <p role="status" className={`flex flex-wrap items-center gap-2 ${result.ok ? '' : 'text-(--mutiny-danger)'}`}>
          {result.words}
          <Button type="button" variant="ghost" size="sm" onClick={() => setResult(null)}>
            {t('approvals.dismiss', 'Dismiss', { ns: 'web' })}
          </Button>
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="text-(--mutiny-danger)">
          {problem}{' '}
          <a className="underline" href="/approvals" target="_blank" rel="noopener noreferrer">
            {t('approvals.openApprovals', 'Open Approvals', { ns: 'web' })}
          </a>
        </p>
      ) : null}
    </div>
  )
}

/** Menus, selects and dialogs mount inside the Mutiny root so they wear its palette. */
function Overlays({ children }: { children: ReactNode }) {
  const root = useMutinyPortalContainer()
  return <PortalContainerProvider container={root}>{children}</PortalContainerProvider>
}

/**
 * The editor page's tree, with the language in state.
 *
 * The page opens in the language the server answered in; a change made in the
 * editor re-renders the whole tree in the new one and is saved in the account, so
 * the next page (and the next browser) follows the person — the same shape the
 * theme's `colorSchemeAdapter` has. The bar, its Ask AI panel and the messages
 * behind them read their words from this provider (the app's own `web`
 * namespace), so the chrome above the editor is in the same language as the editor.
 */
function HostedEditorPage() {
  const [language, setLanguage] = useState<MutinyLanguage>(data.language)
  const changeLanguage = useCallback((next: MutinyLanguage) => {
    setLanguage(next)
    void fetch('/settings/language', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ language: next }) })
      .then((response) => {
        if (!response.ok) console.error('[mutinybim-web] the language choice was not saved in the account', { status: response.status })
      })
      .catch((err: unknown) => console.error('[mutinybim-web] the language choice was not saved in the account', { err }))
  }, [])
  return (
    <EditorLanguageProvider language={language} onLanguageChange={changeLanguage}>
      <MutinyThemeProvider presentation="standalone" theme={THEME} hostVars={mutinyToShadcnVars} colorSchemeAdapter={schemeAdapter} initialColorScheme={data.colorScheme} applyToDocument className="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-(--mutiny-surface)" data-testid="mutiny-root">
        <TooltipProvider>
          <Overlays>
            <HostedBar model={data} />
            <ApprovalNotices />
            <EditorHostProvider host={host}>
              <BuildingModelSurface projectId={data.modelId} projectName={data.modelName} projectNumber="" userId={data.userId} userName={data.displayName} initialView={initialView} />
            </EditorHostProvider>
          </Overlays>
        </TooltipProvider>
        <Toaster />
      </MutinyThemeProvider>
    </EditorLanguageProvider>
  )
}

const mount = document.getElementById('app')
if (!mount) throw new Error('[mutinybim-web] the page has no #app element')

createRoot(mount).render(
  <StrictMode>
    <HostedEditorPage />
  </StrictMode>,
)
