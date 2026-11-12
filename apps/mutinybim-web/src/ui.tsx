/** @jsxRuntime automatic */
/**
 * The frame every server-rendered page shares: header, flash message, body,
 * footer. Drawn with the MutinyBIM primitives and theme (packages/bim-ui),
 * the same ones the editor uses; the theme arrives as `--mutiny-*`
 * variables from `themeStyleSheet`, light, dark or the computer's setting.
 *
 * Bilingual, like `pages.tsx`: every word in here is `t('<section>.<name>',
 * '<exact English>')` with the Turkish in `locales/tr/web.json`, so the header
 * and the footer speak the page's language too.
 */
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { TFunction } from "i18next";
import { Alert, AlertDescription, AlertTitle, Badge, Button, MutinyWordmark, formatDate, themeStyleSheet, type MutinyColorScheme, type MutinyLanguage } from "@permitzip/bim-ui";
import type { WaitingApproval } from "./assistant-approvals";
import type { QuoteConfig } from "./config";
import { tFor } from "./i18n";

const THEME_CSS = themeStyleSheet();

export interface FrameUser {
  readonly displayName: string;
  readonly email: string;
  readonly scheme: MutinyColorScheme;
  /** Changes from outside assistants waiting for this person's answer (shown in the header when any). */
  readonly waitingApprovals: readonly WaitingApproval[];
}

let waitingApprovals: (userId: string) => readonly WaitingApproval[] = () => [];
/** The app tells the frame how to find what is waiting for a person's answer. */
export function setWaitingApprovals(find: (userId: string) => readonly WaitingApproval[]): void {
  waitingApprovals = find;
}
export function waitingApprovalsOf(userId: string): readonly WaitingApproval[] {
  return waitingApprovals(userId);
}

export type Flash = { readonly kind: "ok" | "error"; readonly text: string } | null;

export interface FrameOptions {
  readonly title: string;
  readonly user: FrameUser | null;
  readonly quote: QuoteConfig | null;
  /** Which header link is the current page. */
  readonly current?: "models" | "connect" | "settings" | "quote" | "approvals";
  /** A one-line message above the page (after a save, or a problem). */
  readonly flash?: Flash;
  readonly scripts?: readonly string[];
  /** Narrow column for sign-in forms. */
  readonly narrow?: boolean;
  /**
   * The language the page is written in, for `<html lang>`: a screen reader has
   * to read Turkish with Turkish rules. English when a page says nothing.
   */
  readonly language?: MutinyLanguage;
}

const CURRENT_LINK = "bg-(--mutiny-accent-subtle) shadow-[inset_0_-2px_0_var(--mutiny-selection)]";

function NavLink({ href, label, current }: { href: string; label: string; current: boolean }) {
  return (
    <Button asChild variant="ghost" size="sm" className={current ? CURRENT_LINK : undefined}>
      <a href={href} aria-current={current ? "page" : undefined}>
        {label}
      </a>
    </Button>
  );
}

/** Light / Dark / Auto, saved in the account (the editor reads the same choice). */
export function SchemeToggle({ scheme, language }: { scheme: MutinyColorScheme; language: MutinyLanguage }) {
  const t = tFor(language);
  // One literal `t()` per string: `npm run i18n:review` reads the key and the
  // English off the call itself, so a key held in a variable would hide these
  // strings from its coverage report.
  const schemes: readonly { readonly value: MutinyColorScheme; readonly label: string; readonly title: string }[] = [
    { value: "light", label: t("theme.light", "Light", { ns: "web" }), title: t("theme.lightTitle", "Light theme", { ns: "web" }) },
    { value: "dark", label: t("theme.dark", "Dark", { ns: "web" }), title: t("theme.darkTitle", "Dark theme", { ns: "web" }) },
    { value: "system", label: t("theme.auto", "Auto", { ns: "web" }), title: t("theme.systemTitle", "Match your computer's light or dark setting", { ns: "web" }) },
  ];
  return (
    <form method="post" action="/settings/scheme" className="inline-flex rounded-(--mutiny-radius) border border-(--mutiny-border) bg-(--mutiny-field) p-0.5" aria-label={t("theme.label", "Theme", { ns: "web" })} data-testid="scheme-toggle">
      {schemes.map((s) => (
        <Button
          key={s.value}
          type="submit"
          name="scheme"
          value={s.value}
          size="sm"
          variant="ghost"
          aria-pressed={scheme === s.value}
          className={scheme === s.value ? "bg-(--mutiny-accent-subtle) text-(--mutiny-text) shadow-[inset_0_0_0_1px_var(--mutiny-selection)]" : "text-(--mutiny-muted)"}
          title={s.title}
        >
          {s.label}
        </Button>
      ))}
    </form>
  );
}

/**
 * The two languages MutinyBIM speaks. Each is written in its own language and is
 * never translated: someone who cannot read the page still finds their own
 * language by its name (the rule `LanguageToggle` in packages/bim-ui follows).
 */
export const LANGUAGES: readonly { readonly value: MutinyLanguage; readonly label: string }[] = [
  { value: "en", label: "English" },
  { value: "tr", label: "Türkçe" },
];

/**
 * English / Türkçe, as a form that posts the choice to the server.
 *
 * Not `LanguageToggle` from packages/bim-ui: that one is a client component. It
 * reads and writes the `I18nProvider` context and changes the tree through
 * React, and it throws outright outside a provider. These pages are plain
 * server-rendered HTML with no hydration, so a React-only control would draw a
 * button that cannot be pressed. This is the same choice in the one shape this
 * app can honour — a POST, like the theme toggle beside it — and the server
 * saves it in the account and in the `mutiny.lang` cookie, so the next page is
 * painted in the new language from its first byte (spec §7/Ç-D).
 *
 * `label` names this control for a screen reader. The header and the settings
 * page both draw one, and two pickers with the same accessible name on one page
 * are indistinguishable, so the settings page passes its own.
 */
export function LanguageChoice({
  language,
  current,
  label,
  className,
  "data-testid": testId = "language-choice",
}: {
  language: MutinyLanguage;
  current: MutinyLanguage;
  label?: string;
  className?: string;
  "data-testid"?: string;
}) {
  const t = tFor(language);
  const classes = `inline-flex rounded-(--mutiny-radius) border border-(--mutiny-border) bg-(--mutiny-field) p-0.5${className ? ` ${className}` : ""}`;
  return (
    <form method="post" action="/settings/language" className={classes} aria-label={label ?? t("language.label", "Language", { ns: "web" })} data-testid={testId}>
      {LANGUAGES.map((option) => (
        <Button
          key={option.value}
          type="submit"
          name="language"
          value={option.value}
          size="sm"
          variant="ghost"
          lang={option.value}
          aria-pressed={current === option.value}
          className={current === option.value ? "bg-(--mutiny-accent-subtle) text-(--mutiny-text) shadow-[inset_0_0_0_1px_var(--mutiny-selection)]" : "text-(--mutiny-muted)"}
        >
          {option.label}
        </Button>
      ))}
    </form>
  );
}

function Header({ user, quote, current, language, t }: Pick<FrameOptions, "user" | "quote" | "current"> & { language: MutinyLanguage; t: TFunction }) {
  return (
    <header className="sticky top-0 z-10 border-b border-(--mutiny-border) bg-(--mutiny-surface)/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2.5">
        <a href={user ? "/models" : "/"} data-slot="brand" className="mr-2 flex items-center gap-2 text-(--mutiny-text)" aria-label={t("nav.home", "MutinyBIM home", { ns: "web" })}>
          <img src="/assets/bim-ui/mutiny-icon.svg" alt="" width={28} height={28} />
          <MutinyWordmark className="h-5" title="MutinyBIM" />
          <span className="text-xs font-semibold tracking-wide text-(--mutiny-muted)">BIM</span>
        </a>
        {user ? (
          <>
            <nav className="flex flex-wrap items-center gap-1" aria-label={t("nav.main", "Main", { ns: "web" })}>
              <NavLink href="/models" label={t("nav.models", "My models", { ns: "web" })} current={current === "models"} />
              <NavLink href="/connect" label={t("nav.connect", "Connect an assistant", { ns: "web" })} current={current === "connect"} />
              <NavLink href="/settings" label={t("nav.settings", "Settings", { ns: "web" })} current={current === "settings"} />
              <Button asChild variant="ghost" size="sm" className={current === "approvals" ? CURRENT_LINK : undefined}>
                <a
                  href="/approvals"
                  aria-current={current === "approvals" ? "page" : undefined}
                  aria-label={user.waitingApprovals.length > 0 ? t("nav.approvalsWaiting", "Approvals, {{n}} waiting for you", { ns: "web", n: user.waitingApprovals.length }) : t("nav.approvals", "Approvals", { ns: "web" })}
                  data-approvals-nav=""
                  data-approvals-label={t("nav.approvalsWaiting", "Approvals, {{n}} waiting for you", { ns: "web", n: "%n" })}
                  data-approvals-label-none={t("nav.approvals", "Approvals", { ns: "web" })}
                  data-testid="nav-approvals"
                >
                  {t("nav.approvals", "Approvals", { ns: "web" })}
                  <Badge variant="destructive" hidden={user.waitingApprovals.length === 0} data-approvals-count="" data-testid="nav-approvals-count">
                    {user.waitingApprovals.length}
                  </Badge>
                </a>
              </Button>
            </nav>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {quote ? (
                <Button asChild size="sm" variant={current === "quote" ? "outline" : "default"}>
                  <a href="/quote">{quote.label}</a>
                </Button>
              ) : null}
              <SchemeToggle scheme={user.scheme} language={language} />
              <LanguageChoice language={language} current={language} />
              <span className="max-w-[16ch] truncate text-sm text-(--mutiny-muted)" title={user.email}>
                {user.displayName}
              </span>
              <form method="post" action="/logout">
                <Button type="submit" size="sm" variant="outline">
                  {t("nav.logOut", "Log out", { ns: "web" })}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <LanguageChoice language={language} current={language} />
            <Button asChild size="sm" variant="ghost">
              <a href="/login">{t("nav.logIn", "Log in", { ns: "web" })}</a>
            </Button>
            <Button asChild size="sm">
              <a href="/signup">{t("nav.signUp", "Sign up free", { ns: "web" })}</a>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

export function FlashMessage({ flash }: { flash: Flash }) {
  if (!flash) return null;
  return (
    <Alert variant={flash.kind === "error" ? "destructive" : "default"} role={flash.kind === "error" ? "alert" : "status"} className={flash.kind === "ok" ? "border-(--mutiny-selection) bg-(--mutiny-accent-subtle)" : "border-(--mutiny-danger)"} data-testid="flash">
      {flash.text}
    </Alert>
  );
}

const NOTICES_SHOWN = 3;

/** What is waiting for the person's answer, on every signed-in page but Approvals itself (which lists it all). */
function WaitingNotices({ waiting, listed, t }: { waiting: readonly WaitingApproval[]; listed: boolean; t: TFunction }) {
  const more = waiting.length - NOTICES_SHOWN;
  return (
    <section aria-label={t("approvals.waitingAria", "Waiting for your approval", { ns: "web" })} className="contents" data-approvals-shown={waiting.map((w) => w.id).join(",")} data-testid="approval-notices">
      {listed
        ? null
        : waiting.slice(0, NOTICES_SHOWN).map((w) => (
            <Alert key={w.id} role="status" className="border-(--mutiny-selection) bg-(--mutiny-accent-subtle)" data-approval-notice={w.id} data-testid="approval-notice">
              <AlertTitle>
                {t("approvals.assistantWaiting", "{{assistant}} is waiting for your approval to change {{model}}", { ns: "web", assistant: w.assistant, model: w.modelId ? `“${w.modelName}”` : w.modelName })}
              </AlertTitle>
              <AlertDescription className="break-words">{w.title}</AlertDescription>
              <form method="post" action={w.href} className="mt-1.5 flex flex-wrap items-center gap-2">
                <Button type="submit" name="decision" value="approve" size="sm">
                  {t("approvals.approve", "Approve", { ns: "web" })}
                </Button>
                <Button type="submit" name="decision" value="decline" size="sm" variant="outline">
                  {t("approvals.decline", "Decline", { ns: "web" })}
                </Button>
                <a href={w.href}>{t("approvals.seeExactly", "See exactly what changes", { ns: "web" })}</a>
              </form>
            </Alert>
          ))}
      {!listed && more > 0 ? (
        <p className="text-sm" data-approval-more="">
          {t("approvals.andMoreWaiting", "And {{count}} more waiting on", { ns: "web", count: more })}{" "}
          <a href="/approvals">{t("nav.approvals", "Approvals", { ns: "web" })}</a>.
        </p>
      ) : null}
      <Alert role="status" hidden className="border-(--mutiny-selection) bg-(--mutiny-accent-subtle)" data-approvals-new="">
        <AlertTitle>{t("approvals.newChangeWaiting", "A new change is waiting for your approval.", { ns: "web" })}</AlertTitle>
        <AlertDescription>
          <a href="/approvals">{t("approvals.reviewIt", "Review it on Approvals", { ns: "web" })}</a>
        </AlertDescription>
      </Alert>
      <Alert variant="destructive" hidden className="border-(--mutiny-danger)" data-approvals-problem="">
        {t("approvals.couldNotCheck", "This page couldn't check for new approval requests. Reload it to see what is waiting.", { ns: "web" })}
      </Alert>
    </section>
  );
}

export function page(body: ReactNode, options: FrameOptions): string {
  const scheme = options.user?.scheme ?? "system";
  const language = options.language ?? "en";
  const t = tFor(language);
  const waiting = options.user?.waitingApprovals ?? [];
  const scripts = [...(options.scripts ?? []), ...(options.user ? ["/static/approvals.js"] : [])];
  const markup = renderToStaticMarkup(
    <html lang={language} data-mutiny-scheme={scheme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${waiting.length > 0 ? `(${waiting.length}) ` : ""}${options.title} · MutinyBIM`}</title>
        <link rel="icon" type="image/svg+xml" href="/assets/bim-ui/mutiny-icon.svg" />
        <style dangerouslySetInnerHTML={{ __html: THEME_CSS }} />
        <link rel="stylesheet" href="/static/app.css" />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <Header user={options.user} quote={options.quote} current={options.current} language={language} t={t} />
        <main className={`mx-auto flex w-full flex-1 flex-col gap-5 px-4 py-8 ${options.narrow ? "max-w-md" : "max-w-4xl"}`}>
          <FlashMessage flash={options.flash ?? null} />
          {options.user ? <WaitingNotices waiting={waiting} listed={options.current === "approvals"} t={t} /> : null}
          {body}
        </main>
        <footer className="border-t border-(--mutiny-border) px-4 py-5 text-center text-xs text-(--mutiny-muted)">
          {t("footer.openSource", "MutinyBIM is open source (Apache-2.0).", { ns: "web" })}{" "}
          <a href="https://github.com/permitzip/mutinybim">{t("footer.source", "Source code", { ns: "web" })}</a> · <a href="/terms">{t("footer.terms", "Terms", { ns: "web" })}</a> ·{" "}
          <a href="/privacy">{t("footer.privacy", "Privacy", { ns: "web" })}</a> · {t("footer.bringYourOwnAi", "Bring your own AI: this app pays for none and sees none of your keys.", { ns: "web" })}
        </footer>
        {scripts.map((src) => (
          <script key={src} type="module" src={src} />
        ))}
      </body>
    </html>,
  );
  return `<!doctype html>${markup}`;
}

/**
 * A moment in the page's own language: "Nov 10, 2026, 11:30 AM UTC" in English,
 * "10 Kas 2026 11:30 UTC" in Turkish. The format follows the language (the
 * glossary's §7 rule) and the zone stays UTC, because these are records of when
 * something happened on the server, not clock times in the reader's city.
 *
 * The language is required, with no English default: a default is exactly how
 * the English date got into Turkish sentences the first time.
 */
export function formatWhen(iso: string, language: MutinyLanguage): string {
  const date = new Date(iso);
  return `${formatDate(date, language, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC`;
}

/** Escapes text for the few places a page still writes raw HTML (the editor page shell). */
export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}
