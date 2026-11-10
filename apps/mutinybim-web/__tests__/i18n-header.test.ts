/**
 * @jest-environment node
 *
 * The frame around every page (header, nav, footer) and the language setting,
 * in both languages.
 *
 * The header is the one part of the app a person sees on every screen, so it is
 * checked twice over: as markup (does a Turkish page's nav say "Modellerim"
 * where the English one says "My models"?) and over HTTP (does choosing a
 * language in Settings save it in the account, set the cookie, and make the very
 * next request come back in the new language?).
 *
 * Dates ride along here too: a Turkish sentence with an English date in it reads
 * like a mistake, so `formatWhen` has to format with the page's locale.
 */
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp, type App } from "../src/app";
import type { WebConfig } from "../src/config";
import type { ModelRow, UserRow } from "../src/db";
import { loginPage, modelsPage, settingsPage } from "../src/pages";
import { formatWhen } from "../src/ui";

function config(overrides: Partial<WebConfig> = {}): WebConfig {
  return { port: 0, host: "127.0.0.1", origin: "http://127.0.0.1:0", dataDir: path.join(os.tmpdir(), "mutinybim-header-test"), modelLimit: 3, signupOpen: true, providers: [], quote: null, secure: false, ...overrides };
}

const PERSON: UserRow = { id: "u-1", email: "sam@example.com", display_name: "Sam Example", password_hash: null, created_at: "2026-11-09T10:00:00.000Z", color_scheme: "system", language: "en" };
const MODEL: ModelRow = { id: "m-1", owner_id: "u-1", name: "Sample Warehouse", created_at: "2026-11-09T10:00:00.000Z", updated_at: "2026-11-10T11:30:00.000Z" };

/** The words on a page: markup, styles and scripts taken out. */
const visibleText = (html: string): string => html.replace(/<style>[\s\S]*?<\/style>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");

// ---------------------------------------------------------------- the header

test("header nav labels are Turkish when the language is tr", () => {
  const turkish = visibleText(modelsPage(config(), PERSON, [MODEL], [], null, "tr"));

  expect(turkish).toContain("Modellerim");
  expect(turkish).toContain("Asistan bağla");
  expect(turkish).toContain("Ayarlar");
  expect(turkish).toContain("Oturumu kapat");
  // The English of the same frame is gone, not merely joined by the Turkish.
  expect(turkish).not.toContain("My models");
  expect(turkish).not.toContain("Connect an assistant");
  expect(turkish).not.toContain("Log out");
});

test("header nav labels are English by default", () => {
  const english = visibleText(modelsPage(config(), PERSON, [MODEL], [], null, "en"));

  expect(english).toContain("My models");
  expect(english).toContain("Connect an assistant");
  expect(english).toContain("Settings");
  expect(english).toContain("Log out");
  expect(english).not.toContain("Modellerim");
});

test("the footer and the theme labels speak the page's language", () => {
  const turkish = visibleText(modelsPage(config(), PERSON, [MODEL], [], null, "tr"));
  const english = visibleText(modelsPage(config(), PERSON, [MODEL], [], null, "en"));

  expect(turkish).toContain("açık kaynak");
  expect(turkish).toContain("Kullanım koşulları");
  expect(turkish).toContain("Gizlilik bildirimi");
  expect(turkish).toContain("Koyu");
  expect(english).toContain("MutinyBIM is open source (Apache-2.0).");
  expect(english).toContain("Source code");
  expect(english).toContain("Dark");
  expect(english).not.toContain("Koyu");
});

test("a signed-out visitor gets the language control too, and Log in is translated", () => {
  const page = loginPage(config(), { returnTo: "/models" }, "tr");

  expect(visibleText(page)).toContain("Giriş yap");
  // The toggle sits in the header on every page, signed in or not.
  expect(page).toMatch(/<form[^>]*action="\/settings\/language"[^>]*>/);
  expect(page).toMatch(/name="language"/);
});

// -------------------------------------------------------------- the settings

/** The settings card's own form, so the header's twin control is not measured. */
const settingsLanguageForm = (html: string): string => html.match(/<form[^>]*data-testid="settings-language"[^>]*>[\s\S]*?<\/form>/)?.[0] ?? "";

test("settings page offers both languages and shows the current one", () => {
  const turkish = settingsPage(config(), PERSON, [], {}, "tr");
  const form = settingsLanguageForm(turkish);

  expect(form).not.toBe("");
  // Both languages are offered, each written in its own language, never translated.
  expect(form).toContain('value="en"');
  expect(form).toContain('value="tr"');
  expect(form).toContain("English");
  expect(form).toContain("Türkçe");
  // The account's language is the pressed button (attribute order is the component's).
  const pressed = (value: string): RegExp => new RegExp(`<button(?=[^>]*name="language")(?=[^>]*value="${value}")(?=[^>]*aria-pressed="true")[^>]*>`);
  expect(form).toMatch(pressed("en"));
  expect(form).not.toMatch(pressed("tr"));
  // And it says which one that is, in words.
  expect(turkish).toMatch(/data-testid="settings-language-current"[^>]*>Şu an: English\./);

  // The account is the source of truth for the card, not the page's language:
  // an account set to Turkish shows Türkçe pressed even on an English page.
  const turkishAccount = settingsPage(config(), { ...PERSON, language: "tr" }, [], {}, "en");
  const turkishForm = settingsLanguageForm(turkishAccount);
  expect(turkishForm).toMatch(pressed("tr"));
  expect(turkishForm).not.toMatch(pressed("en"));
  expect(turkishAccount).toMatch(/data-testid="settings-language-current"[^>]*>Now showing Türkçe\./);
});

// --------------------------------------------------------------- the date

test("a Turkish page shows a Turkish-formatted date", () => {
  // The month name is the tell: "Kas" is Turkish for November.
  expect(formatWhen("2026-11-10T11:30:00.000Z", "tr")).toContain("Kas");
  expect(formatWhen("2026-11-10T11:30:00.000Z", "en")).toContain("Nov");
  expect(formatWhen("2026-11-10T11:30:00.000Z", "en")).toBe("Nov 10, 2026, 11:30 AM UTC");

  const turkish = visibleText(modelsPage(config(), PERSON, [MODEL], [], null, "tr"));
  expect(turkish).toContain("Kas");
  expect(turkish).not.toContain("Nov");
});

// ------------------------------------------------------- the provider buttons

test("provider button labels translate", () => {
  const providers = [{ id: "example", label: "Log in with Example", issuer: "https://id.example.com", clientName: "MutinyBIM" }];

  const turkish = visibleText(loginPage(config({ providers }), { returnTo: "/models" }, "tr"));
  expect(turkish).toContain("Example ile giriş yap");
  expect(turkish).not.toContain("Log in with Example");

  const english = visibleText(loginPage(config({ providers }), { returnTo: "/models" }, "en"));
  expect(english).toContain("Log in with Example");
});

// ------------------------------------------------------- over HTTP: the setting

let dataDir = "";
let app: App | null = null;
let base = "";
let realPort = 0;

function httpConfig(port: number): WebConfig {
  return { port, host: "127.0.0.1", origin: `http://127.0.0.1:${port}`, dataDir, modelLimit: 3, signupOpen: true, providers: [], quote: null, secure: false };
}

async function start(): Promise<void> {
  const probe = createApp(httpConfig(0), { editor: false });
  await new Promise<void>((resolve) => probe.server.listen(0, "127.0.0.1", resolve));
  const address = probe.server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  realPort = address.port;
  await probe.close();
  app = createApp(httpConfig(realPort), { editor: false });
  await app.listen();
  base = `http://127.0.0.1:${realPort}`;
}

async function post(pathname: string, form: Record<string, string>, cookie = ""): Promise<Response> {
  return fetch(`${base}${pathname}`, { method: "POST", redirect: "manual", headers: { origin: base, cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form).toString() });
}

function sessionCookie(response: Response): string {
  const raw = response.headers.get("set-cookie") ?? "";
  const match = raw.match(/mutinybim_session=[^;]+/);
  if (!match) throw new Error(`no session cookie in ${raw}`);
  return match[0];
}

async function signUp(email: string): Promise<string> {
  const response = await post("/signup", { name: "Sam Example", email, password: "correct-horse" });
  expect(response.status).toBe(303);
  return sessionCookie(response);
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "mutinybim-web-header-test-"));
});

afterEach(async () => {
  await app?.close();
  app = null;
  await rm(dataDir, { recursive: true, force: true });
});

test("posting a language updates the account preference and the cookie, and the next request is in it", async () => {
  await start();
  const cookie = await signUp("sam@example.com");

  const before = await (await fetch(`${base}/models`, { headers: { cookie } })).text();
  expect(before).toContain("My models");

  const response = await post("/settings/language", { language: "tr" }, cookie);
  expect(response.status).toBe(303);

  // The cookie is written now, so the server paints the next page in Turkish
  // on its first byte (no flash of English, spec Ç-D).
  const setCookie = response.headers.get("set-cookie") ?? "";
  expect(setCookie).toMatch(/mutiny\.lang=tr/);

  // And the choice is in the account, so it travels to another browser.
  const signedUp = app?.db.userByEmail("sam@example.com");
  expect(signedUp?.language).toBe("tr");

  const after = await (await fetch(`${base}/models`, { headers: { cookie } })).text();
  expect(after).toContain("Modellerim");
  expect(after).toContain('<html lang="tr"');

  // A fresh browser with only the session (no language cookie) follows the account.
  const accountOnly = await (await fetch(`${base}/models`, { headers: { cookie } })).text();
  expect(accountOnly).toContain("Modellerim");
});

test("the account's language wins over Accept-Language, and the cookie wins over the account", async () => {
  await start();
  const cookie = await signUp("sam@example.com");

  await post("/settings/language", { language: "tr" }, cookie);
  const englishBrowser = await (await fetch(`${base}/models`, { headers: { cookie, "accept-language": "en-US,en;q=0.9" } })).text();
  expect(englishBrowser).toContain("Modellerim");

  const cookieWins = await (await fetch(`${base}/models`, { headers: { cookie: `${cookie}; mutiny.lang=en`, "accept-language": "tr-TR,tr;q=0.9" } })).text();
  expect(cookieWins).toContain("My models");
});

test("a visitor who is signed out gets their choice in the cookie alone", async () => {
  await start();

  const response = await post("/settings/language", { language: "tr" });
  expect(response.status).toBe(303);
  const cookie = (response.headers.get("set-cookie") ?? "").match(/mutiny\.lang=tr/)?.[0] ?? "";
  expect(cookie).not.toBe("");

  // The landing page is painted in Turkish from its first byte.
  const landing = await (await fetch(`${base}/`, { headers: { cookie: "mutiny.lang=tr" } })).text();
  expect(landing).toContain("Ücretsiz hesap oluştur");
  expect(landing).toContain('<html lang="tr"');
});

test("a language this app does not speak is refused, not saved", async () => {
  await start();
  const cookie = await signUp("sam@example.com");

  const response = await post("/settings/language", { language: "de" }, cookie);
  expect(response.status).toBe(400);
  expect(app?.db.userByEmail("sam@example.com")?.language).toBe("en");
});
