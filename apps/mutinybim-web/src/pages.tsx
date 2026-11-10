/** @jsxRuntime automatic */
/**
 * The app's pages, each a function of what it shows, drawn only with the
 * MutinyBIM primitives (packages/bim-ui). Every list has an empty state;
 * every form says what went wrong in words.
 *
 * Bilingual: every user-facing string is a `t('section.name', 'English')` call.
 * English is the source of truth at the call site and the Turkish lives in
 * `locales/tr/web.json`; the language arrives from the request (see `./i18n`).
 * The English text is unchanged by that split, character for character.
 */
import type { ComponentProps, ReactNode } from "react";
import type { TFunction } from "i18next";
import { Badge, Button, buttonVariants, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, cn, Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle, Field, FieldHint, Input, Label, NativeSelect, Separator, type MutinyLanguage } from "@permitzip/bim-ui";
import type { OAuthProviderConfig, QuoteConfig, WebConfig } from "./config";
import type { PendingApproval } from "./assistant-approvals";
import type { AgentKeyRow, AssistantGrantRow, ModelRow, SharedModelRow, ShareRow, UserRow } from "./db";
import { tFor } from "./i18n";
import type { ModelSummary } from "./models";
import { formatWhen, LanguageChoice, LANGUAGES, page, waitingApprovalsOf, type Flash, type FrameOptions, type FrameUser } from "./ui";

/**
 * Every translated string on these pages comes from the `web` namespace
 * (`apps/mutinybim-web/locales/tr/web.json`), so every call carries
 * `{ ns: "web" }`. The option is spelled out on each call because these pages
 * are drawn on the server: there is no `useT('web')` hook to bind the namespace
 * for them, and `npm run i18n:review` reads the namespace off the call itself.
 */

function frameUser(user: UserRow): FrameUser {
  return { displayName: user.display_name, email: user.email, scheme: user.color_scheme, waitingApprovals: waitingApprovalsOf(user.id) };
}

function providerName(p: OAuthProviderConfig): string {
  return p.label.replace(/^Log in with /i, "");
}

/**
 * A provider button's words. The label is configuration the person running the
 * server wrote (`MUTINYBIM_WEB_PROVIDERS`), so it is English: when it has the
 * built-in "Log in with …" shape the words around the provider's own name are
 * translated and the name is not. Any other label is shown exactly as written,
 * because guessing what part of an unknown label is the name would be wrong.
 */
function providerLabel(p: OAuthProviderConfig, t: TFunction): string {
  const match = /^Log in with (.+)$/i.exec(p.label);
  if (!match?.[1]) return p.label;
  return t("login.logInWith", "Log in with {{provider}}", { provider: match[1], ns: "web" });
}

/** `page()`, with the request's language carried into `<html lang>` and the title. */
function pageIn(body: ReactNode, options: FrameOptions, language: MutinyLanguage): string {
  return page(body, { ...options, language });
}

function PageTitle({ children, lede }: { children: ReactNode; lede?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-3xl leading-tight">{children}</h1>
      {lede ? <p className="max-w-prose text-base/relaxed text-(--mutiny-muted)">{lede}</p> : null}
    </div>
  );
}

function ProviderButtons({ providers, returnTo, t }: { providers: readonly OAuthProviderConfig[]; returnTo: string; t: TFunction }) {
  if (providers.length === 0) return null;
  return (
    <>
      <div className="flex flex-col gap-2">
        {providers.map((p) => (
          <Button key={p.id} asChild size="lg" variant="outline" className="w-full">
            <a href={`/auth/${p.id}/start?return_to=${encodeURIComponent(returnTo)}`}>{providerLabel(p, t)}</a>
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-(--mutiny-muted)">
        <Separator className="flex-1" />
        {t("login.orWithEmail", "or with email", { ns: "web" })}
        <Separator className="flex-1" />
      </div>
    </>
  );
}

function TextField({ label, hint, ...input }: { label: string; hint?: string } & ComponentProps<typeof Input>) {
  const id = `f-${input.name ?? label}`;
  return (
    <Field>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...input} />
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </Field>
  );
}

function ConfirmForm({ action, question, children, className }: { action: string; question: string; children: ReactNode; className?: string }) {
  return (
    <form method="post" action={action} data-confirm={question} className={className}>
      {children}
    </form>
  );
}

export function landingPage(config: WebConfig, language: MutinyLanguage): string {
  const t = tFor(language);
  const points: readonly [string, string][] = [
    [t("landing.pointSavedTitle", "Your models, saved.", { ns: "web" }), t("landing.pointSavedText", "Open them from any computer, with branches and saved versions kept.", { ns: "web" })],
    [t("landing.pointTogetherTitle", "Work together.", { ns: "web" }), t("landing.pointTogetherText", "Share a model with a colleague to view or edit, and see each other's changes live.", { ns: "web" })],
    [
      t("landing.pointAiTitle", "Your AI, your bill.", { ns: "web" }),
      t("landing.pointAiText", "Paste your own Claude, ChatGPT or Grok key, or connect your assistant app. This app pays for no AI and never sees your key.", { ns: "web" }),
    ],
    [t("landing.pointOpenSourceTitle", "Open source.", { ns: "web" }), t("landing.pointOpenSourceText", "The same engine runs on your own computer with npm run demo.", { ns: "web" })],
  ];
  return pageIn(
    <div className="flex flex-col gap-8 py-6">
      <div className="flex flex-col items-start gap-5">
        <Badge variant="secondary">{t("landing.badge", "Free · open source · every trade", { ns: "web" })}</Badge>
        <h1 className="max-w-3xl text-4xl leading-tight sm:text-5xl">{t("landing.headline", "A building model you can open in a browser, free.", { ns: "web" })}</h1>
        <p className="max-w-2xl text-lg/relaxed text-(--mutiny-muted)">
          {t(
            "landing.lede",
            "MutinyBIM is an open-source building model for every trade: plans, 3D, sheets and schedules, with several people editing the same model live. Bring your own AI assistant to work beside you.",
            { ns: "web" },
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {config.signupOpen ? (
            <Button asChild size="lg">
              <a href="/signup">{t("auth.createAccount", "Create a free account", { ns: "web" })}</a>
            </Button>
          ) : null}
          <Button asChild size="lg" variant="outline">
            <a href="/login">{t("auth.logIn", "Log in", { ns: "web" })}</a>
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {points.map(([title, text]) => (
          <Card key={title} className="gap-1.5 p-4">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{text}</CardDescription>
          </Card>
        ))}
      </div>
    </div>,
    { title: t("landing.pageTitle", "Free building models", { ns: "web" }), user: null, quote: null },
    language,
  );
}

export function loginPage(config: WebConfig, options: { email?: string; returnTo: string; flash?: Flash }, language: MutinyLanguage): string {
  const t = tFor(language);
  return pageIn(
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t("auth.logIn", "Log in", { ns: "web" })}</CardTitle>
        <CardDescription>{t("login.lede", "Open your models and the ones shared with you.", { ns: "web" })}</CardDescription>
      </CardHeader>
      <CardContent>
        <ProviderButtons providers={config.providers} returnTo={options.returnTo} t={t} />
        <form method="post" action="/login" className="flex flex-col gap-3">
          <input type="hidden" name="return_to" value={options.returnTo} />
          <TextField label={t("common.email", "Email", { ns: "web" })} name="email" type="email" autoComplete="email" required defaultValue={options.email ?? ""} />
          <TextField label={t("common.password", "Password", { ns: "web" })} name="password" type="password" autoComplete="current-password" required minLength={8} />
          <Button type="submit" size="lg">
            {t("auth.logIn", "Log in", { ns: "web" })}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-between text-sm text-(--mutiny-muted)">
        <a href="/forgot">{t("login.forgot", "Forgot your password?", { ns: "web" })}</a>
        {config.signupOpen ? <a href="/signup">{t("auth.createAccount", "Create a free account", { ns: "web" })}</a> : null}
      </CardFooter>
    </Card>,
    { title: t("auth.logIn", "Log in", { ns: "web" }), user: null, quote: null, flash: options.flash ?? null, narrow: true },
    language,
  );
}

export function signupPage(config: WebConfig, options: { email?: string; name?: string; flash?: Flash }, language: MutinyLanguage): string {
  const t = tFor(language);
  if (!config.signupOpen) {
    return pageIn(
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("signup.closedTitle", "Sign-ups are closed for now", { ns: "web" })}</CardTitle>
          <CardDescription>{t("signup.closedLede", "New accounts can't be made on this server right now.", { ns: "web" })}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <a href="/login">{t("signup.closedLogin", "Log in to an existing account", { ns: "web" })}</a>
          </Button>
        </CardFooter>
      </Card>,
      { title: t("signup.pageTitle", "Sign up", { ns: "web" }), user: null, quote: null, narrow: true },
      language,
    );
  }
  return pageIn(
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t("auth.createAccount", "Create a free account", { ns: "web" })}</CardTitle>
        <CardDescription>{t("signup.lede", "Free models, shared with whoever you choose.", { ns: "web" })}</CardDescription>
      </CardHeader>
      <CardContent>
        <ProviderButtons providers={config.providers} returnTo="/models" t={t} />
        <form method="post" action="/signup" className="flex flex-col gap-3">
          <TextField label={t("signup.name", "Your name", { ns: "web" })} hint={t("signup.nameHint", "People editing with you see it.", { ns: "web" })} name="name" autoComplete="name" required maxLength={80} defaultValue={options.name ?? ""} />
          <TextField label={t("common.email", "Email", { ns: "web" })} name="email" type="email" autoComplete="email" required defaultValue={options.email ?? ""} />
          <TextField label={t("common.password", "Password", { ns: "web" })} hint={t("common.passwordHint", "At least 8 characters.", { ns: "web" })} name="password" type="password" autoComplete="new-password" required minLength={8} />
          <label className="flex items-start gap-2 text-sm text-(--mutiny-muted)">
            <input type="checkbox" name="agree" value="1" required className="mt-1" />
            <span>
              {t("signup.agreePrefix", "I agree to the", { ns: "web" })} <a href="/terms">{t("legal.termsOfUse", "Terms of use", { ns: "web" })}</a> {t("signup.agreeAnd", "and the", { ns: "web" })}{" "}
              <a href="/privacy">{t("legal.privacyNotice", "Privacy notice", { ns: "web" })}</a>.
            </span>
          </label>
          <Button type="submit" size="lg">
            {t("signup.submit", "Create account", { ns: "web" })}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-sm text-(--mutiny-muted)">
        {t("signup.alreadyHaveOne", "Already have one?", { ns: "web" })}&nbsp;<a href="/login">{t("auth.logIn", "Log in", { ns: "web" })}</a>
      </CardFooter>
    </Card>,
    { title: t("signup.pageTitle", "Sign up", { ns: "web" }), user: null, quote: null, flash: options.flash ?? null, narrow: true },
    language,
  );
}

/** A short legal page: a title and paragraphs, in the same narrow frame as the forms. */
function legalPage(title: string, paragraphs: ReactNode[], t: TFunction, language: MutinyLanguage): string {
  return pageIn(
    <div className="flex flex-col gap-4 text-sm/relaxed">
      <h1 className="text-2xl">{title}</h1>
      {paragraphs.map((text, i) => (
        <p key={i}>{text}</p>
      ))}
      <p className="text-(--mutiny-muted)">{t("legal.updated", "Last updated November 9, 2026.", { ns: "web" })}</p>
    </div>,
    { title, user: null, quote: null, narrow: true },
    language,
  );
}

/**
 * Terms of use. Short on purpose: the software is Apache-2.0, the hosted
 * service is provided as-is, and the person keeps their models.
 */
export function termsPage(language: MutinyLanguage): string {
  const t = tFor(language);
  return legalPage(
    t("legal.termsOfUse", "Terms of use", { ns: "web" }),
    [
      t(
        "terms.software",
        "These terms cover the hosted MutinyBIM app at app.mutinybim.com, run by PermitZIP. The MutinyBIM software itself is open source under the Apache License 2.0: you can read, use and change the code from the public repository, and that license governs the code.",
        { ns: "web" },
      ),
      <>
        <strong>{t("terms.asIsTitle", "The service is provided as is.", { ns: "web" })}</strong>{" "}
        {t(
          "terms.asIsBody",
          "It is free and comes with no warranty of any kind, including that it will be available, error-free or fit for a particular purpose. To the fullest extent the law allows, PermitZIP is not liable for any loss or damage from using the service, including lost models or lost time. Nothing here limits liability the law does not let us limit.",
          { ns: "web" },
        )}
      </>,
      t(
        "terms.models",
        "You own the models you make. You give us permission only to store them and to show them to the people you share them with. Don't upload anything you don't have the right to, and don't use the service to break the law or to attack the service or other people.",
        { ns: "web" },
      ),
      t(
        "terms.stopping",
        "You can stop using the service at any time, and you can ask us to delete your account and models. We may suspend or close an account that breaks these terms, and we may change or stop the service. If we change these terms, the date at the bottom changes and the new terms apply from then on.",
        { ns: "web" },
      ),
    ],
    t,
    language,
  );
}

/**
 * Privacy notice. What is stored, what never reaches the server (the AI key),
 * and how to ask for deletion.
 */
export function privacyPage(language: MutinyLanguage): string {
  const t = tFor(language);
  return legalPage(
    t("legal.privacyNotice", "Privacy notice", { ns: "web" }),
    [
      t("privacy.intro", "This notice covers the hosted MutinyBIM app at app.mutinybim.com, run by PermitZIP.", { ns: "web" }),
      <>
        <strong>{t("privacy.storesTitle", "What we store:", { ns: "web" })}</strong>{" "}
        {t(
          "privacy.storesBody",
          "your name, your email address, a one-way hash of your password (never the password itself), your models, and who you share them with. We also keep a short server log of requests, which includes your IP address, so we can run and protect the service.",
          { ns: "web" },
        )}
      </>,
      <>
        <strong>{t("privacy.neverTitle", "What we never see:", { ns: "web" })}</strong>{" "}
        {t("privacy.neverBody", "your AI key. It stays in your browser and goes straight from there to your own AI provider. We don't receive it, store it or pay for your AI use.", { ns: "web" })}
      </>,
      t(
        "privacy.use",
        "We use this information to run your account and your models, and for nothing else. We don't sell it and we don't use it for advertising. If you sign in with another provider, we receive only the name and email that provider shares.",
        { ns: "web" },
      ),
      t(
        "privacy.deletion",
        "You can ask us to export or delete your account and models, and to correct your name or email. Email the address on the PermitZIP website and we'll do it. Some records, such as server logs, are kept only as long as we need them to run and secure the service.",
        { ns: "web" },
      ),
    ],
    t,
    language,
  );
}

/** No email is sent by this app, so recovery is a linked sign-in or a reset link from whoever runs the server. */
export function forgotPage(config: WebConfig, language: MutinyLanguage): string {
  const t = tFor(language);
  return pageIn(
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t("login.forgot", "Forgot your password?", { ns: "web" })}</CardTitle>
        <CardDescription>{t("forgot.lede", "This server sends no email, so there are two ways back in.", { ns: "web" })}</CardDescription>
      </CardHeader>
      <CardContent>
        {config.providers.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p>
              <strong>{t("forgot.linkedTitle", "If you linked {{providers}}", { providers: config.providers.map(providerName).join(` ${t("common.or", "or", { ns: "web" })} `), ns: "web" })}</strong>{" "}
              {t(
                "forgot.linkedBody",
                "to your account, log in with it, then set a new password under Settings → Password. No old password is needed for ten minutes after that sign-in.",
                { ns: "web" },
              )}
            </p>
            {config.providers.map((p) => (
              <Button key={p.id} asChild variant="outline" className="w-full">
                <a href={`/auth/${p.id}/start?return_to=%2Fsettings%23password`}>{providerLabel(p, t)}</a>
              </Button>
            ))}
          </div>
        ) : null}
        <p>
          <strong>{t("forgot.elseTitle", "Otherwise, ask whoever runs this server", { ns: "web" })}</strong> {t("forgot.elseBody", "for a reset link. They make one with", { ns: "web" })}{" "}
          <code>npm run web:reset-password -- you@example.com</code>
          {t("forgot.elseTail", "; it works once, for one hour.", { ns: "web" })}
        </p>
      </CardContent>
      <CardFooter>
        <Button asChild variant="ghost">
          <a href="/login">{t("forgot.back", "Back to log in", { ns: "web" })}</a>
        </Button>
      </CardFooter>
    </Card>,
    { title: t("forgot.pageTitle", "Forgot your password", { ns: "web" }), user: null, quote: null, narrow: true },
    language,
  );
}

export function resetPage(options: { token: string; email: string | null; flash?: Flash }, language: MutinyLanguage): string {
  const t = tFor(language);
  if (!options.email) {
    return pageIn(
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t("reset.brokenTitle", "That reset link doesn't work", { ns: "web" })}</CardTitle>
          <CardDescription>{t("reset.brokenLede", "It was already used, or it is more than an hour old. Ask for a new one.", { ns: "web" })}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <a href="/forgot">{t("reset.waysBack", "Ways back in", { ns: "web" })}</a>
          </Button>
        </CardFooter>
      </Card>,
      { title: t("reset.pageTitle", "Reset your password", { ns: "web" }), user: null, quote: null, flash: options.flash ?? null, narrow: true },
      language,
    );
  }
  return pageIn(
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t("reset.title", "Set a new password", { ns: "web" })}</CardTitle>
        <CardDescription>{t("reset.lede", "For {{email}}. You are signed out everywhere else once it is saved.", { email: options.email, ns: "web" })}</CardDescription>
      </CardHeader>
      <CardContent>
        <form method="post" action={`/reset/${encodeURIComponent(options.token)}`} className="flex flex-col gap-3">
          <TextField label={t("common.newPassword", "New password", { ns: "web" })} hint={t("common.passwordHint", "At least 8 characters.", { ns: "web" })} name="password" type="password" autoComplete="new-password" required minLength={8} />
          <Button type="submit" size="lg">
            {t("reset.submit", "Save and log in", { ns: "web" })}
          </Button>
        </form>
      </CardContent>
    </Card>,
    { title: t("reset.pageTitle", "Reset your password", { ns: "web" }), user: null, quote: null, flash: options.flash ?? null, narrow: true },
    language,
  );
}

function ModelEmpty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Empty className="rounded-[calc(var(--mutiny-radius)*2)] border border-dashed border-(--mutiny-border) bg-(--mutiny-panel)">
      <EmptyHeader>
        <EmptyMedia>
          <img src="/assets/bim-ui/mutiny-icon.svg" alt="" width={44} height={44} />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function OwnModel({ m, t, language }: { m: ModelRow; t: TFunction; language: MutinyLanguage }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-(--mutiny-radius) border border-(--mutiny-border) bg-(--mutiny-field) px-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col">
        <a href={`/m/${m.id}?view=plan`} className="truncate font-semibold">
          {m.name}
        </a>
        <span className="text-xs text-(--mutiny-muted)">{t("models.changed", "Changed {{when}}", { when: formatWhen(m.updated_at, language), ns: "web" })}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button asChild size="sm">
          <a href={`/m/${m.id}?view=plan`}>{t("common.open", "Open", { ns: "web" })}</a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={`/models/${m.id}/share`}>{t("common.share", "Share", { ns: "web" })}</a>
        </Button>
        <details className="group relative">
          <summary data-slot="button" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "cursor-pointer list-none")}>
            {t("common.rename", "Rename", { ns: "web" })}
          </summary>
          <form method="post" action={`/models/${m.id}/rename`} className="absolute right-0 z-10 mt-1 flex w-72 gap-1.5 rounded-(--mutiny-radius) border border-(--mutiny-border) bg-(--mutiny-panel) p-2 shadow-md">
            <Input name="name" required maxLength={120} defaultValue={m.name} aria-label={t("models.newName", "New name", { ns: "web" })} className="h-8" />
            <Button type="submit" size="sm">
              {t("common.save", "Save", { ns: "web" })}
            </Button>
          </form>
        </details>
        <ConfirmForm
          action={`/models/${m.id}/delete`}
          question={t(
            "models.deleteQuestion",
            "Delete “{{name}}”? People editing it are disconnected and lose access. This can't be undone from here.",
            { name: m.name, ns: "web" },
          )}
        >
          <Button type="submit" size="sm" variant="ghost" className="text-(--mutiny-danger)">
            {t("common.delete", "Delete", { ns: "web" })}
          </Button>
        </ConfirmForm>
      </div>
    </li>
  );
}

export function modelsPage(config: WebConfig, user: UserRow, models: readonly ModelRow[], shared: readonly SharedModelRow[], flash: Flash, language: MutinyLanguage): string {
  const t = tFor(language);
  const atLimit = models.length >= config.modelLimit;
  return pageIn(
    <>
      <PageTitle>{t("models.title", "My models", { ns: "web" })}</PageTitle>
      <Card>
        <CardHeader>
          <CardTitle>{t("models.yours", "Yours", { ns: "web" })}</CardTitle>
          <CardDescription>{t("models.limit", "{{used}} of {{limit}} on a free account.", { used: models.length, limit: config.modelLimit, ns: "web" })}</CardDescription>
        </CardHeader>
        <CardContent>
          {models.length === 0 ? (
            <ModelEmpty title={t("models.emptyTitle", "No models yet", { ns: "web" })}>
              {t("models.emptyBody", "Make your first one below. Start blank (one level), or from the sample mechanical model to look around first.", { ns: "web" })}
            </ModelEmpty>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="own-models">
              {models.map((m) => (
                <OwnModel key={m.id} m={m} t={t} language={language} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {shared.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("models.sharedTitle", "Shared with you", { ns: "web" })}</CardTitle>
            <CardDescription>{t("models.sharedLede", "Models other people opened to you. Only they can share, rename or delete them.", { ns: "web" })}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2" data-testid="shared-models">
              {shared.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-(--mutiny-radius) border border-(--mutiny-border) bg-(--mutiny-field) px-3 py-2.5">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <a href={`/m/${m.id}?view=plan`} className="truncate font-semibold">
                      {m.name}
                    </a>
                    <span className="text-xs text-(--mutiny-muted)">
                      {t("models.sharedChanged", "{{owner}}'s · changed {{when}}", { owner: m.owner_name, when: formatWhen(m.updated_at, language), ns: "web" })}
                    </span>
                  </div>
                  <Badge variant={m.role === "edit" ? "default" : "secondary"}>{m.role === "edit" ? t("common.canEdit", "Can edit", { ns: "web" }) : t("common.viewOnly", "View only", { ns: "web" })}</Badge>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/m/${m.id}?view=plan`}>{t("common.open", "Open", { ns: "web" })}</a>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      {atLimit ? (
        <Card>
          <CardDescription>
            {t("models.atLimit", "You have {{used}} models, the most one free account can keep. Delete one to make another.", { used: models.length, ns: "web" })}
          </CardDescription>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("models.newTitle", "New model", { ns: "web" })}</CardTitle>
          </CardHeader>
          <form method="post" action="/models" className="flex flex-col gap-4">
            <TextField label={t("common.name", "Name", { ns: "web" })} name="name" required maxLength={120} placeholder={t("models.sampleName", "Sample Warehouse", { ns: "web" })} />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{t("models.startFrom", "Start from", { ns: "web" })}</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="start" value="blank" defaultChecked className="accent-(--mutiny-selection)" /> {t("models.startBlank", "A blank model with one level", { ns: "web" })}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="start" value="sample" className="accent-(--mutiny-selection)" />{" "}
                {t("models.startSample", "The sample mechanical model (an air handler with ducts and diffusers)", { ns: "web" })}
              </label>
            </fieldset>
            <div>
              <Button type="submit" size="lg">
                {t("models.submit", "Make the model", { ns: "web" })}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </>,
    { title: t("models.title", "My models", { ns: "web" }), user: frameUser(user), quote: config.quote, current: "models", flash: flash ?? null, scripts: ["/static/confirm.js"] },
    language,
  );
}

export function sharePage(
  config: WebConfig,
  user: UserRow,
  model: ModelRow,
  shares: readonly ShareRow[],
  options: { email?: string; flash?: Flash },
  language: MutinyLanguage,
): string {
  const t = tFor(language);
  return pageIn(
    <>
      <PageTitle
        lede={t(
          "share.lede",
          "People you share with see it under “Shared with you” on their My models page. They need a MutinyBIM account on this server; this app sends no email, so tell them yourself.",
          { ns: "web" },
        )}
      >
        {t("share.title", "Share “{{name}}”", { name: model.name, ns: "web" })}
      </PageTitle>
      <Card>
        <CardHeader>
          <CardTitle>{t("share.whoHasIt", "Who has it", { ns: "web" })}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2" data-testid="shares">
            <li className="flex items-center gap-3 rounded-(--mutiny-radius) border border-(--mutiny-border) bg-(--mutiny-field) px-3 py-2">
              <span className="flex-1">
                <strong>{user.display_name}</strong> <span className="text-(--mutiny-muted)">({user.email})</span>
              </span>
              <Badge variant="outline">{t("share.owner", "Owner", { ns: "web" })}</Badge>
            </li>
            {shares.map((s) => (
              <li key={s.user_id} className="flex flex-wrap items-center gap-3 rounded-(--mutiny-radius) border border-(--mutiny-border) bg-(--mutiny-field) px-3 py-2">
                <span className="min-w-0 flex-1">
                  <strong>{s.display_name}</strong> <span className="text-(--mutiny-muted)">({s.email})</span>
                </span>
                <form method="post" action={`/models/${model.id}/share`} className="flex items-center gap-1.5">
                  <input type="hidden" name="email" value={s.email} />
                  <NativeSelect name="role" defaultValue={s.role} aria-label={t("share.roleFor", "What {{name}} can do", { name: s.display_name, ns: "web" })} className="h-8 w-auto">
                    <option value="view">{t("common.viewOnly", "View only", { ns: "web" })}</option>
                    <option value="edit">{t("common.canEdit", "Can edit", { ns: "web" })}</option>
                  </NativeSelect>
                  <Button type="submit" size="sm" variant="outline">
                    {t("share.change", "Change", { ns: "web" })}
                  </Button>
                </form>
                <ConfirmForm
                  action={`/models/${model.id}/share/${s.user_id}/delete`}
                  question={t("share.removeQuestion", "Stop sharing “{{model}}” with {{name}}? They are disconnected at once.", { model: model.name, name: s.display_name, ns: "web" })}
                >
                  <Button type="submit" size="sm" variant="ghost" className="text-(--mutiny-danger)">
                    {t("share.remove", "Remove", { ns: "web" })}
                  </Button>
                </ConfirmForm>
              </li>
            ))}
          </ul>
          {shares.length === 0 ? <p className="text-(--mutiny-muted)">{t("share.onlyYou", "Only you have this model so far.", { ns: "web" })}</p> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("share.addTitle", "Add someone", { ns: "web" })}</CardTitle>
          <CardDescription>
            {t(
              "share.addLede",
              "“Can edit” lets them change the model, make branches and save versions. “View only” lets them look and nothing else.",
              { ns: "web" },
            )}
          </CardDescription>
        </CardHeader>
        <form method="post" action={`/models/${model.id}/share`} className="flex flex-wrap items-end gap-2">
          <Field className="min-w-60 flex-1">
            <Label htmlFor="share-email">{t("share.theirEmail", "Their account email", { ns: "web" })}</Label>
            <Input id="share-email" name="email" type="email" required defaultValue={options.email ?? ""} placeholder={t("share.emailPlaceholder", "colleague@example.com", { ns: "web" })} />
          </Field>
          <Field>
            <Label htmlFor="share-role">{t("share.can", "Can", { ns: "web" })}</Label>
            <NativeSelect id="share-role" name="role" defaultValue="edit">
              <option value="edit">{t("common.edit", "Edit", { ns: "web" })}</option>
              <option value="view">{t("common.viewOnly", "View only", { ns: "web" })}</option>
            </NativeSelect>
          </Field>
          <Button type="submit" size="lg">
            {t("common.share", "Share", { ns: "web" })}
          </Button>
        </form>
      </Card>
      <div>
        <Button asChild variant="ghost">
          <a href="/models">{t("share.back", "← Back to my models", { ns: "web" })}</a>
        </Button>
      </div>
    </>,
    { title: t("share.pageTitle", "Share {{name}}", { name: model.name, ns: "web" }), user: frameUser(user), quote: config.quote, current: "models", flash: options.flash ?? null, scripts: ["/static/confirm.js"] },
    language,
  );
}

export function settingsPage(config: WebConfig, user: UserRow, linked: readonly string[], options: { flash?: Flash; passwordFree?: boolean }, language: MutinyLanguage): string {
  const t = tFor(language);
  return pageIn(
    <>
      <PageTitle>{t("settings.title", "Settings", { ns: "web" })}</PageTitle>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.account", "Your account", { ns: "web" })}</CardTitle>
          <CardDescription>{t("settings.emailLine", "Email: {{email}}", { email: user.email, ns: "web" })}</CardDescription>
        </CardHeader>
        <form method="post" action="/settings/profile" className="flex flex-wrap items-end gap-2">
          <Field className="min-w-60 flex-1">
            <Label htmlFor="profile-name">{t("common.name", "Name", { ns: "web" })}</Label>
            <Input id="profile-name" name="name" required maxLength={80} defaultValue={user.display_name} />
          </Field>
          <Button type="submit" variant="outline" size="lg">
            {t("settings.saveName", "Save name", { ns: "web" })}
          </Button>
        </form>
        {config.providers.length > 0 ? (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              <h3 className="text-sm">{t("settings.waysToLogIn", "Ways to log in", { ns: "web" })}</h3>
              <ul className="flex flex-col gap-2">
                {config.providers.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <strong>{providerName(p)}</strong>
                    {linked.includes(p.id) ? (
                      <Badge>{t("settings.linked", "Linked", { ns: "web" })}</Badge>
                    ) : (
                      <>
                        <Badge variant="secondary">{t("settings.notLinked", "Not linked", { ns: "web" })}</Badge>
                        <Button asChild size="sm" variant="outline">
                          <a href={`/auth/${p.id}/start?link=1&return_to=%2Fsettings`}>{t("settings.linkIt", "Link it", { ns: "web" })}</a>
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </Card>
      <Card id="language">
        <CardHeader>
          <CardTitle>{t("settings.languageTitle", "Language", { ns: "web" })}</CardTitle>
          <CardDescription>{t("settings.languageLede", "The language of these pages and of the editor. It is saved in your account, so every browser you sign in from opens in it.", { ns: "web" })}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {/*
            `language`, not `user.language`: this card must press and name what the
            page is actually written in — the same value the header presses — or a
            person whose cookie and account disagree sees two contradictory
            controls and a line that is false. Pressing one changes both the
            account and the cookie, so the two cannot stay apart after this page.
          */}
          <LanguageChoice language={language} current={language} label={t("settings.languagePicker", "The language of these pages", { ns: "web" })} data-testid="settings-language" />
          <span className="text-sm text-(--mutiny-muted)" data-testid="settings-language-current">
            {t("settings.languageCurrent", "Now showing {{language}}.", { language: LANGUAGES.find((option) => option.value === language)?.label ?? "English", ns: "web" })}
          </span>
        </CardContent>
      </Card>
      <Card id="password">
        <CardHeader>
          <CardTitle>{t("common.password", "Password", { ns: "web" })}</CardTitle>
          <CardDescription>
            {user.password_hash
              ? t("settings.passwordChangeLede", "Changing it signs you out on every other device.", { ns: "web" })
              : t("settings.passwordSetLede", "You sign in through a linked account. Set a password to also log in with your email.", { ns: "web" })}
          </CardDescription>
        </CardHeader>
        <form method="post" action="/settings/password" className="flex flex-col gap-3">
          {user.password_hash && !options.passwordFree ? <TextField label={t("settings.currentPassword", "Current password", { ns: "web" })} name="current" type="password" autoComplete="current-password" required /> : null}
          {user.password_hash && options.passwordFree ? (
            <FieldHint>{t("settings.passwordFree", "You just logged in with a linked account, so no current password is needed for the next few minutes.", { ns: "web" })}</FieldHint>
          ) : null}
          <TextField label={t("common.newPassword", "New password", { ns: "web" })} hint={t("common.passwordHint", "At least 8 characters.", { ns: "web" })} name="password" type="password" autoComplete="new-password" required minLength={8} />
          <div>
            <Button type="submit" variant="outline" size="lg">
              {user.password_hash ? t("settings.changePassword", "Change password", { ns: "web" }) : t("settings.setPassword", "Set password", { ns: "web" })}
            </Button>
          </div>
        </form>
      </Card>
      <Card id="ai">
        <CardHeader>
          <CardTitle>{t("settings.aiTitle", "Your AI", { ns: "web" })}</CardTitle>
          <CardDescription>
            {t("settings.aiLede1", "This app pays for no AI. Paste a key from your own AI provider and the", { ns: "web" })} <strong>{t("settings.askAi", "Ask AI", { ns: "web" })}</strong>{" "}
            {t("settings.aiLede2", "button in the editor uses it. The key is kept", { ns: "web" })} <strong>{t("settings.onlyInThisBrowser", "only in this browser", { ns: "web" })}</strong>
            {t(
              "settings.aiLede3",
              ": never sent to this server, never saved in your account, never in our logs. Your browser sends your questions straight to the provider, and the provider bills you.",
              { ns: "web" },
            )}
          </CardDescription>
        </CardHeader>
        <div id="ai-settings" className="group flex flex-col gap-3" data-state="loading">
          <p className="text-sm text-(--mutiny-muted) group-data-[state=ready]:hidden">{t("settings.aiLoading", "Loading your AI settings…", { ns: "web" })}</p>
          <Field>
            <Label htmlFor="ai-provider">{t("settings.provider", "Provider", { ns: "web" })}</Label>
            <NativeSelect id="ai-provider" name="provider">
              <option value="anthropic">{t("settings.providerAnthropic", "Anthropic (Claude)", { ns: "web" })}</option>
              <option value="openai">{t("settings.providerOpenAi", "OpenAI (ChatGPT models)", { ns: "web" })}</option>
              <option value="xai">{t("settings.providerXai", "xAI (Grok)", { ns: "web" })}</option>
              <option value="compatible">{t("settings.providerCompatible", "Another provider with an OpenAI-style address", { ns: "web" })}</option>
            </NativeSelect>
          </Field>
          <Field className="hidden group-data-[provider=compatible]:flex">
            <Label htmlFor="ai-base">{t("settings.address", "Address", { ns: "web" })}</Label>
            <Input id="ai-base" name="baseUrl" type="url" placeholder="https://api.example.com/v1" />
            <FieldHint>{t("settings.addressHint", "Ends in /v1.", { ns: "web" })}</FieldHint>
          </Field>
          <Field>
            <Label htmlFor="ai-model">{t("settings.model", "Model", { ns: "web" })}</Label>
            <Input id="ai-model" name="model" />
            <FieldHint>{t("settings.modelHint", "Leave blank for the provider's usual one.", { ns: "web" })}</FieldHint>
          </Field>
          <Field>
            <Label htmlFor="ai-key">{t("settings.apiKey", "API key", { ns: "web" })}</Label>
            <Input id="ai-key" name="key" type="password" autoComplete="off" spellCheck={false} placeholder={t("settings.pasteKey", "Paste your key", { ns: "web" })} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="button" data-action="save">
              {t("settings.saveInBrowser", "Save in this browser", { ns: "web" })}
            </Button>
            <Button type="button" variant="outline" data-action="test">
              {t("settings.testKey", "Test the key", { ns: "web" })}
            </Button>
            <Button type="button" variant="ghost" className="text-(--mutiny-danger)" data-action="forget">
              {t("settings.forgetKey", "Forget the key", { ns: "web" })}
            </Button>
          </div>
          <p className="status text-sm text-(--mutiny-muted) data-[kind=error]:text-(--mutiny-danger) data-[kind=ok]:text-(--mutiny-text)" role="status" aria-live="polite" />
        </div>
        <CardDescription>
          {t("settings.preferApp", "Prefer your own assistant app (Claude Desktop, ChatGPT, Cursor)?", { ns: "web" })}{" "}
          <a href="/connect">{t("settings.connectIt", "Connect it to your models", { ns: "web" })}</a> {t("settings.instead", "instead.", { ns: "web" })}
        </CardDescription>
      </Card>
    </>,
    { title: t("settings.title", "Settings", { ns: "web" }), user: frameUser(user), quote: config.quote, current: "settings", flash: options.flash ?? null, scripts: ["/static/settings.js"] },
    language,
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-(--mutiny-radius) bg-(--mutiny-subtle) px-1 py-0.5 text-[0.85em]">{children}</code>;
}

export interface ConnectView {
  readonly models: readonly ModelRow[];
  readonly keys: readonly AgentKeyRow[];
  readonly assistants: readonly AssistantGrantRow[];
  readonly newKey: string | null;
}

export function connectPage(config: WebConfig, user: UserRow, view: ConnectView, flash: Flash, language: MutinyLanguage): string {
  const t = tFor(language);
  const { models, keys, assistants, newKey } = view;
  const mcpUrl = `${config.origin}/mcp`;
  const syncUrl = `${config.origin.replace(/^http/, "ws")}/sync`;
  const modelArgs = models.length > 0 ? models.slice(0, 5).map((m) => `--model ${m.id}`).join(" ") : "--model <model id>";
  const command = `node packages/bim-mcp/bin/mutinybim-mcp.mjs --http --model-server "${syncUrl}?key=${newKey ?? "<your agent key>"}" ${modelArgs}`;
  return pageIn(
    <>
      <PageTitle
        lede={t(
          "connect.lede",
          "Claude, ChatGPT, Grok, Cursor or any assistant that speaks the Model Context Protocol (MCP) can read and change your models. Every change it proposes asks you first, and models shared with you to view stay view-only. You pay your AI provider; this app pays nothing and sees nothing of your AI account.",
          { ns: "web" },
        )}
      >
        {t("connect.title", "Connect your own assistant", { ns: "web" })}
      </PageTitle>
      {newKey ? (
        <Card className="border-(--mutiny-selection) bg-(--mutiny-accent-subtle)" role="status">
          <CardTitle className="text-base">{t("connect.newKeyTitle", "Your new agent key", { ns: "web" })}</CardTitle>
          <code className="block overflow-x-auto rounded-(--mutiny-radius) bg-(--mutiny-field) p-2 text-sm" data-testid="new-agent-key">
            {newKey}
          </code>
          <CardDescription>
            {t(
              "connect.newKeyLede",
              "Copy it now. It is shown once and only its fingerprint is kept. Anyone with it can edit your models and the ones shared with you for editing, so treat it like a password.",
              { ns: "web" },
            )}
          </CardDescription>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{t("connect.pasteAddress", "Paste this address into your assistant", { ns: "web" })}</CardTitle>
          <CardDescription>{t("connect.addConnector", "Add MutinyBIM as a custom connector (an MCP server) and paste:", { ns: "web" })}</CardDescription>
        </CardHeader>
        <code className="block overflow-x-auto rounded-(--mutiny-radius) border border-(--mutiny-border) bg-(--mutiny-field) p-3 text-base" data-testid="mcp-url">
          {mcpUrl}
        </code>
        <ul className="flex flex-col gap-2 text-sm">
          <li>
            <strong>Claude</strong>{" "}
            {t("connect.claudeSteps", "(claude.ai or Claude Desktop): Settings → Connectors → Add custom connector, paste the address, then Connect.", { ns: "web" })}
          </li>
          <li>
            <strong>ChatGPT:</strong>{" "}
            {t("connect.chatGptSteps", "Settings → Apps & Connectors → Create (developer mode), paste the address, choose OAuth, then Create.", { ns: "web" })}
          </li>
          <li>
            <strong>Grok:</strong> {t("connect.grokSteps", "add a custom connector (MCP server) and paste the address.", { ns: "web" })}
          </li>
          <li>
            <strong>Claude Code:</strong> <Code>{`claude mcp add --transport http mutinybim ${mcpUrl}`}</Code>
          </li>
          <li>
            <strong>Cursor:</strong> {t("connect.cursorAdd", "add", { ns: "web" })} <Code>{`{ "mcpServers": { "mutinybim": { "url": "${mcpUrl}" } } }`}</Code>{" "}
            {t("connect.cursorTo", "to", { ns: "web" })} <Code>~/.cursor/mcp.json</Code>
          </li>
        </ul>
        <CardDescription>
          {t(
            "connect.mcpOauth",
            "Your assistant opens a MutinyBIM sign-in page: log in and press Allow. No key to copy. It starts with the core tools (ten at most); ask it to turn on a tool family when a job needs one, or connect a family directly at",
            { ns: "web" },
          )}{" "}
          <Code>{`${config.origin}/packs/<family>/mcp`}</Code> {t("connect.forExample", "(for example", { ns: "web" })} <Code>{`${config.origin}/packs/electrical/mcp`}</Code>
          {t("connect.closeParen", ").", { ns: "web" })}
        </CardDescription>
        <CardDescription>
          {t("connect.approvalsLead", "When your assistant can't ask you itself, its changes wait on", { ns: "web" })} <a href="/approvals">{t("nav.approvals", "Approvals", { ns: "web" })}</a>{" "}
          {t(
            "connect.approvalsTail",
            "until you press Approve. Its scripts run here in a sealed box with no network; a script only previews until you approve what it does.",
            { ns: "web" },
          )}
        </CardDescription>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("connect.assistantsTitle", "Assistants signed in", { ns: "web" })}</CardTitle>
        </CardHeader>
        {assistants.length === 0 ? (
          <CardDescription>
            {t("connect.assistantsEmpty", "None yet. After you press Allow in your assistant, it is listed here, and you can sign it out.", { ns: "web" })}
          </CardDescription>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="assistant-list">
            {assistants.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-(--mutiny-radius) border border-(--mutiny-border) bg-(--mutiny-field) px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <strong>{a.client_name}</strong>{" "}
                  <span className="text-(--mutiny-muted)">
                    {t("connect.signedIn", "signed in {{when}}", { when: formatWhen(a.created_at, language), ns: "web" })} ·{" "}
                    {a.last_used_at ? t("connect.lastUsed", "last used {{when}}", { when: formatWhen(a.last_used_at, language), ns: "web" }) : t("connect.notUsedYet", "not used yet", { ns: "web" })}
                  </span>
                </span>
                <ConfirmForm
                  action={`/connect/assistants/${a.id}/delete`}
                  question={t("connect.signOutQuestion", "Sign out “{{name}}”? It loses access to your models at once.", { name: a.client_name, ns: "web" })}
                >
                  <Button type="submit" size="sm" variant="ghost" className="text-(--mutiny-danger)">
                    {t("connect.signOut", "Sign out", { ns: "web" })}
                  </Button>
                </ConfirmForm>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("connect.localTitle", "Or run the tool server on your own computer", { ns: "web" })}</CardTitle>
          <CardDescription>
            {t("connect.localLede", "For an assistant that only starts local tools. You need Node 22.13 or newer, the open-source repository and an agent key.", { ns: "web" })}
          </CardDescription>
        </CardHeader>
        {keys.length === 0 ? (
          <CardDescription>{t("connect.noKeys", "No agent keys yet.", { ns: "web" })}</CardDescription>
        ) : (
          <ul className="flex flex-col gap-2">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center gap-2 rounded-(--mutiny-radius) border border-(--mutiny-border) bg-(--mutiny-field) px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <strong>{k.label}</strong>{" "}
                  <span className="text-(--mutiny-muted)">
                    {t("connect.keyEnding", "ending …{{last4}}", { last4: k.last4, ns: "web" })} ·{" "}
                    {t("connect.keyMade", "made {{when}}", { when: formatWhen(k.created_at, language), ns: "web" })} ·{" "}
                    {k.last_used_at ? t("connect.lastUsed", "last used {{when}}", { when: formatWhen(k.last_used_at, language), ns: "web" }) : t("connect.neverUsed", "never used", { ns: "web" })}
                  </span>
                </span>
                <ConfirmForm
                  action={`/connect/keys/${k.id}/delete`}
                  question={t("connect.turnOffQuestion", "Turn off “{{label}}”? Assistants using it lose access at once.", { label: k.label, ns: "web" })}
                >
                  <Button type="submit" size="sm" variant="ghost" className="text-(--mutiny-danger)">
                    {t("connect.turnOff", "Turn off", { ns: "web" })}
                  </Button>
                </ConfirmForm>
              </li>
            ))}
          </ul>
        )}
        <form method="post" action="/connect/keys" className="flex flex-wrap gap-2">
          <Input
            name="label"
            required
            maxLength={60}
            placeholder={t("connect.keyLabelPlaceholder", "Claude on my laptop", { ns: "web" })}
            aria-label={t("connect.keyLabelAria", "What the key is for", { ns: "web" })}
            className="max-w-xs"
          />
          <Button type="submit" variant="outline">
            {t("connect.makeKey", "Make a key", { ns: "web" })}
          </Button>
        </form>
        <pre className="overflow-x-auto rounded-(--mutiny-radius) border border-(--mutiny-border) bg-(--mutiny-canvas) p-3 text-xs/relaxed">
          <code>{`git clone https://github.com/permitzip/mutinybim.git\ncd mutinybim\nnpm install\n${command}`}</code>
        </pre>
        <CardDescription>
          {t("connect.servesAt", "That serves your assistant at", { ns: "web" })} <Code>http://127.0.0.1:3333/mcp</Code>
          {t("connect.servesAfter", ", connected to your models here; leave out", { ns: "web" })} <Code>--http</Code>{" "}
          {t("connect.servesEnd", "to let your assistant start it itself. Full guide:", { ns: "web" })}{" "}
          <a href="https://github.com/permitzip/mutinybim/blob/main/docs/CONNECT-AN-AGENT.md">{t("connect.fullGuide", "Connect an AI assistant", { ns: "web" })}</a>.
        </CardDescription>
        {models.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            {models.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2">
                <span className="min-w-40">{m.name}</span>
                <Code>{m.id}</Code>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </>,
    { title: t("connect.pageTitle", "Connect an assistant", { ns: "web" }), user: frameUser(user), quote: config.quote, current: "connect", flash: flash ?? null, scripts: ["/static/confirm.js"] },
    language,
  );
}

/** What the sign-in approval for an outside assistant shows. */
export interface AssistantConsent {
  readonly clientName: string;
  /** Where the person goes back to after answering (the assistant's address). */
  readonly backTo: string;
  /** The original request, posted back with the answer. */
  readonly request: string;
  readonly models: number;
  readonly shared: number;
}

export function assistantConsentPage(_config: WebConfig, user: UserRow, consent: AssistantConsent, language: MutinyLanguage): string {
  const t = tFor(language);
  return pageIn(
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t("consent.title", "Let “{{client}}” use your models?", { client: consent.clientName, ns: "web" })}</CardTitle>
        <CardDescription>
          {t("consent.signedInAs", "You're signed in as", { ns: "web" })} <strong>{user.display_name}</strong>{" "}
          {t("consent.emailAndAfter", "({{email}}). After you answer you go back to", { email: user.email, ns: "web" })} <strong>{consent.backTo}</strong>.
        </CardDescription>
      </CardHeader>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
        <li>
          {consent.models === 1
            ? t("consent.readModel", "It can read your {{models}} model", { models: consent.models, ns: "web" })
            : t("consent.readModels", "It can read your {{models}} models", { models: consent.models, ns: "web" })}
          {consent.shared > 0 ? t("consent.andShared", " and the {{shared}} shared with you", { shared: consent.shared, ns: "web" }) : null}.
        </li>
        <li>{t("consent.proposes", "It can propose changes. Every change asks you first, and models shared with you to view stay view-only.", { ns: "web" })}</li>
        <li>{t("consent.cannotSee", "It can't see your password, your settings or your AI keys, and it can't share or delete models.", { ns: "web" })}</li>
        <li>{t("consent.signOutAnyTime", "You can sign it out any time under Connect an assistant.", { ns: "web" })}</li>
      </ul>
      <CardDescription>
        {t("consent.nameCaveat", "The name above is the one the assistant gave itself. Only allow it if you just asked your assistant to connect to MutinyBIM.", { ns: "web" })}
      </CardDescription>
      <form method="post" action="/oauth/authorize" className="flex flex-wrap gap-2">
        <input type="hidden" name="request" value={consent.request} />
        <Button type="submit" name="decision" value="allow" size="lg">
          {t("consent.allow", "Allow", { ns: "web" })}
        </Button>
        <Button type="submit" name="decision" value="deny" size="lg" variant="outline">
          {t("consent.deny", "Don't allow", { ns: "web" })}
        </Button>
      </form>
    </Card>,
    { title: t("connect.pageTitle", "Connect an assistant", { ns: "web" }), user: frameUser(user), quote: null, narrow: true },
    language,
  );
}

function ApprovalBadge({ state, t }: { state: PendingApproval["state"]; t: TFunction }) {
  const words: Record<PendingApproval["state"], string> = {
    waiting: t("approvals.stateWaiting", "Waiting for you", { ns: "web" }),
    approved: t("approvals.stateApproved", "Approved", { ns: "web" }),
    declined: t("approvals.stateDeclined", "Declined", { ns: "web" }),
    landed: t("approvals.stateApplied", "Applied", { ns: "web" }),
    failed: t("approvals.stateFailed", "Couldn't apply", { ns: "web" }),
    expired: t("approvals.stateDropped", "Dropped", { ns: "web" }),
  };
  return <Badge variant={state === "waiting" ? "default" : state === "failed" || state === "declined" ? "destructive" : "secondary"}>{words[state]}</Badge>;
}

function ApprovalButtons({ item, t }: { item: PendingApproval; t: TFunction }) {
  if (item.state !== "waiting") return null;
  return (
    <form method="post" action={`/approvals/${item.id}`} className="flex flex-wrap gap-2">
      <Button type="submit" name="decision" value="approve" data-testid="approve">
        {t("approvals.approve", "Approve", { ns: "web" })}
      </Button>
      <Button type="submit" name="decision" value="decline" variant="outline">
        {t("approvals.decline", "Decline", { ns: "web" })}
      </Button>
    </form>
  );
}

export function approvalsPage(config: WebConfig, user: UserRow, items: readonly PendingApproval[], language: MutinyLanguage): string {
  const t = tFor(language);
  return pageIn(
    <>
      <PageTitle
        lede={t(
          "approvals.lede",
          "Changes your assistants want to make, when they couldn't ask you themselves. Nothing lands until you approve it; a request waits 30 minutes, then it's dropped.",
          { ns: "web" },
        )}
      >
        {t("nav.approvals", "Approvals", { ns: "web" })}
      </PageTitle>
      {items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("approvals.emptyTitle", "Nothing waiting", { ns: "web" })}</EmptyTitle>
            <EmptyDescription>
              {t("approvals.emptyLead", "When an assistant you", { ns: "web" })} <a href="/connect">{t("approvals.connected", "connected", { ns: "web" })}</a>{" "}
              {t("approvals.emptyTail", "proposes a change and can't ask you itself, it shows up here.", { ns: "web" })}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <a href={`/approvals/${item.id}`}>{item.summary}</a> <ApprovalBadge state={item.state} t={t} />
                  </CardTitle>
                  <CardDescription>
                    {item.clientName} · “{item.modelName}” · {formatWhen(new Date(item.createdAt).toISOString(), language)}
                  </CardDescription>
                </CardHeader>
                {item.outcome ? <CardDescription>{item.outcome}</CardDescription> : null}
                <ApprovalButtons item={item} t={t} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>,
    { title: t("nav.approvals", "Approvals", { ns: "web" }), user: frameUser(user), quote: config.quote, current: "approvals" },
    language,
  );
}

export function approvalPage(config: WebConfig, user: UserRow, item: PendingApproval, language: MutinyLanguage): string {
  const t = tFor(language);
  return pageIn(
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-2xl">
          {item.summary} <ApprovalBadge state={item.state} t={t} />
        </CardTitle>
        <CardDescription>
          {t("approval.wantsChange", "{{client}} wants to make this change in", { client: item.clientName, ns: "web" })}{" "}
          {item.modelId ? <a href={`/m/${encodeURIComponent(item.modelId.split("~")[0] ?? item.modelId)}`}>“{item.modelName}”</a> : item.modelName}
          {t("approval.askedWhen", ", asked {{when}}.", { when: formatWhen(new Date(item.createdAt).toISOString(), language), ns: "web" })}
        </CardDescription>
      </CardHeader>
      {item.details.length > 0 ? (
        <pre className="max-h-80 overflow-auto rounded-(--mutiny-radius) border border-(--mutiny-border) bg-(--mutiny-canvas) p-3 text-xs/relaxed" aria-label={t("approval.detailsAria", "Exactly what changes", { ns: "web" })}>
          <code>{item.details.join("\n")}</code>
        </pre>
      ) : null}
      {item.outcome ? (
        <CardDescription role="status" data-testid="approval-outcome">
          {item.outcome}
        </CardDescription>
      ) : null}
      <ApprovalButtons item={item} t={t} />
      <CardFooter>
        <a href="/approvals">{t("approval.allApprovals", "All approvals", { ns: "web" })}</a>
      </CardFooter>
    </Card>,
    { title: t("approval.pageTitle", "Approve a change", { ns: "web" }), user: frameUser(user), quote: config.quote, current: "approvals", narrow: true },
    language,
  );
}

export function quotePage(config: WebConfig, quote: QuoteConfig, user: UserRow, models: readonly ModelRow[], chosen: ModelRow | null, summary: ModelSummary | null, language: MutinyLanguage): string {
  const t = tFor(language);
  const target = new URL(quote.url);
  target.searchParams.set("source", "mutinybim");
  if (chosen) target.searchParams.set("model", chosen.name);
  target.searchParams.set("email", user.email);
  const kinds = summary
    ? Object.entries(summary.byKind)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`)
        .join(", ")
    : "";
  return pageIn(
    <>
      <PageTitle lede={quote.blurb ?? t("quote.lede", "{{provider}} can price the engineering for your project.", { provider: quote.provider, ns: "web" })}>{quote.label}</PageTitle>
      <Card>
        {models.length === 0 ? (
          <CardDescription>{t("quote.noModels", "You have no models yet; you can still ask for a quote.", { ns: "web" })}</CardDescription>
        ) : (
          <form method="get" action="/quote" className="flex flex-wrap items-end gap-2">
            <Field className="min-w-60 flex-1">
              <Label htmlFor="quote-model">{t("quote.whichProject", "Which project?", { ns: "web" })}</Label>
              <NativeSelect id="quote-model" name="model" defaultValue={chosen?.id}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Button type="submit" variant="outline" size="lg">
              {t("quote.useThisOne", "Use this one", { ns: "web" })}
            </Button>
          </form>
        )}
        <Separator />
        <CardHeader>
          <CardTitle>{t("quote.asksTitle", "What the quote form asks for", { ns: "web" })}</CardTitle>
        </CardHeader>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
          <li>
            {t("quote.yourName", "Your name and email (yours here:", { ns: "web" })} <strong>{user.display_name}</strong>, {user.email})
          </li>
          <li>
            {t("quote.theProject", "The project", { ns: "web" })}
            {chosen ? (
              <>
                {" "}
                (<strong>{chosen.name}</strong>)
              </>
            ) : null}
            {t("quote.sizeAndNeeds", ", its size and what it needs", { ns: "web" })}
          </li>
        </ul>
        {summary ? (
          <CardDescription>
            {summary.levels.length === 1
              ? t(
                  "quote.summaryLevel",
                  "This model has {{elements}} elements ({{kinds}}) on {{levels}} level. Nothing from this model is sent; {{provider}} asks you for drawings if they need them.",
                  { elements: summary.elements, kinds: kinds || t("quote.noneYet", "none yet", { ns: "web" }), levels: summary.levels.length, provider: quote.provider, ns: "web" },
                )
              : t(
                  "quote.summaryLevels",
                  "This model has {{elements}} elements ({{kinds}}) on {{levels}} levels. Nothing from this model is sent; {{provider}} asks you for drawings if they need them.",
                  { elements: summary.elements, kinds: kinds || t("quote.noneYet", "none yet", { ns: "web" }), levels: summary.levels.length, provider: quote.provider, ns: "web" },
                )}
          </CardDescription>
        ) : null}
        <CardFooter>
          <Button asChild size="lg">
            <a href={target.toString()} target="_blank" rel="noopener" data-testid="quote-link">
              {t("quote.openForm", "Open {{provider}}'s quote form", { provider: quote.provider, ns: "web" })}
            </a>
          </Button>
        </CardFooter>
        <CardDescription>
          {t(
            "quote.formNote",
            "The form opens in a new tab on {{host}}. It is told the request came from MutinyBIM, with this project's name and your email filled in, so {{provider}} knows where it came from. {{provider}} replies by email.",
            { host: target.host, provider: quote.provider, ns: "web" },
          )}
        </CardDescription>
      </Card>
    </>,
    { title: quote.label, user: frameUser(user), quote: config.quote, current: "quote" },
    language,
  );
}

export function messagePage(config: WebConfig, user: UserRow | null, title: string, words: string, action: { href: string; label: string } | undefined, language: MutinyLanguage): string {
  return pageIn(
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{words}</CardDescription>
      </CardHeader>
      {action ? (
        <CardFooter>
          <Button asChild>
            <a href={action.href}>{action.label}</a>
          </Button>
        </CardFooter>
      ) : null}
    </Card>,
    { title, user: user ? frameUser(user) : null, quote: user ? config.quote : null, narrow: true },
    language,
  );
}
