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
import { Alert, Badge, Button, MutinyWordmark, formatDate, themeStyleSheet, type MutinyColorScheme, type MutinyLanguage } from "@permitzip/bim-ui";
import type { QuoteConfig } from "./config";
import { tFor } from "./i18n";

const THEME_CSS = themeStyleSheet();

export interface FrameUser {
  readonly displayName: string;
  readonly email: string;
  readonly scheme: MutinyColorScheme;
  /** Changes from outside assistants waiting for this person's answer (shown in the header when any). */
  readonly waitingApprovals: number;
}

let waitingApprovals: (userId: string) => number = () => 0;
/** The app tells the frame how to count a person's waiting approvals. */
export function setWaitingApprovals(count: (userId: string) => number): void {
  waitingApprovals = count;
}
export function waitingApprovalsOf(userId: string): number {
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
 */
export function LanguageChoice({ language, current, className, "data-testid": testId = "language-choice" }: { language: MutinyLanguage; current: MutinyLanguage; className?: string; "data-testid"?: string }) {
  const t = tFor(language);
  const classes = `inline-flex rounded-(--mutiny-radius) border border-(--mutiny-border) bg-(--mutiny-field) p-0.5${className ? ` ${className}` : ""}`;
  return (
    <form method="post" action="/settings/language" className={classes} aria-label={t("language.label", "Language", { ns: "web" })} data-testid={testId}>
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
              {user.waitingApprovals > 0 || current === "approvals" ? (
                <Button asChild variant="ghost" size="sm" className={current === "approvals" ? CURRENT_LINK : undefined}>
                  <a href="/approvals" aria-current={current === "approvals" ? "page" : undefined} data-testid="nav-approvals">
                    {t("nav.approvals", "Approvals", { ns: "web" })}
                    {user.waitingApprovals > 0 ? <Badge variant="destructive">{user.waitingApprovals}</Badge> : null}
                  </a>
                </Button>
              ) : null}
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

export function page(body: ReactNode, options: FrameOptions): string {
  const scheme = options.user?.scheme ?? "system";
  const language = options.language ?? "en";
  const t = tFor(language);
  const markup = renderToStaticMarkup(
    <html lang={language} data-mutiny-scheme={scheme}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${options.title} · MutinyBIM`}</title>
        <link rel="icon" type="image/svg+xml" href="/assets/bim-ui/mutiny-icon.svg" />
        <style dangerouslySetInnerHTML={{ __html: THEME_CSS }} />
        <link rel="stylesheet" href="/static/app.css" />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <Header user={options.user} quote={options.quote} current={options.current} language={language} t={t} />
        <main className={`mx-auto flex w-full flex-1 flex-col gap-5 px-4 py-8 ${options.narrow ? "max-w-md" : "max-w-4xl"}`}>
          <FlashMessage flash={options.flash ?? null} />
          {body}
        </main>
        <footer className="border-t border-(--mutiny-border) px-4 py-5 text-center text-xs text-(--mutiny-muted)">
          {t("footer.openSource", "MutinyBIM is open source (Apache-2.0).", { ns: "web" })}{" "}
          <a href="https://github.com/permitzip/mutinybim">{t("footer.source", "Source code", { ns: "web" })}</a> · <a href="/terms">{t("footer.terms", "Terms", { ns: "web" })}</a> ·{" "}
          <a href="/privacy">{t("footer.privacy", "Privacy", { ns: "web" })}</a> · {t("footer.bringYourOwnAi", "Bring your own AI: this app pays for none and sees none of your keys.", { ns: "web" })}
        </footer>
        {(options.scripts ?? []).map((src) => (
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
 */
export function formatWhen(iso: string, language: MutinyLanguage = "en"): string {
  const date = new Date(iso);
  return `${formatDate(date, language, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC`;
}

/** Escapes text for the few places a page still writes raw HTML (the editor page shell). */
export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}
