/**
 * @jest-environment node
 *
 * The pages drawn in Turkish, and in English by default.
 *
 * Two layers are checked, because they fail differently: the pages themselves
 * (does `landingPage(config, "tr")` actually speak Turkish, with the Turkish
 * file's text and i18next interpolating its placeholders?) and the request
 * (does the app hand the page the language it resolved, so that a request with
 * the cookie, or only with `Accept-Language: tr`, arrives in Turkish?).
 */
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp, type App } from "../src/app";
import type { WebConfig } from "../src/config";
import type { ModelRow, UserRow } from "../src/db";
import { assistantConsentPage, connectPage, landingPage, modelsPage, resetPage, settingsPage, sharePage } from "../src/pages";

function config(overrides: Partial<WebConfig> = {}): WebConfig {
  return { port: 0, host: "127.0.0.1", origin: "http://127.0.0.1:0", dataDir: path.join(os.tmpdir(), "mutinybim-pages-test"), modelLimit: 3, signupOpen: true, providers: [], quote: null, secure: false, ...overrides };
}

const PERSON: UserRow = { id: "u-1", email: "sam@example.com", display_name: "Sam Example", password_hash: null, created_at: "2026-11-09T10:00:00.000Z", color_scheme: "system" };
const MODEL: ModelRow = { id: "m-1", owner_id: "u-1", name: "Sample Warehouse", created_at: "2026-11-09T10:00:00.000Z", updated_at: "2026-11-10T11:30:00.000Z" };

const ENGLISH_HEADLINE = "A building model you can open in a browser, free.";
const TURKISH_HEADLINE = "Tarayıcıda açabileceğiniz ücretsiz bir yapı modeli.";

/** The words on a page: markup, styles and scripts taken out. */
const visibleText = (html: string): string => html.replace(/<style>[\s\S]*?<\/style>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");

/**
 * A key that reached the screen instead of its text: `landing.headline`,
 * `share.title`. Checked over the visible words of several pages at once, which
 * is what a leaked key looks like, rather than one namespace on one page.
 */
const TRANSLATION_KEY = /\b(?:auth|common|nav|landing|login|signup|legal|terms|privacy|forgot|reset|models|share|settings|connect|consent|approvals|approval|quote)\.[a-z][A-Za-z]*/;

test("the landing page renders Turkish when the language is tr", () => {
  const html = landingPage(config(), "tr");

  expect(html).toContain(TURKISH_HEADLINE);
  expect(html).toContain("Ücretsiz hesap oluştur");
  // The page says which language it is in, for a screen reader.
  expect(html).toContain('<html lang="tr"');
  // Nothing of the English source leaks through.
  expect(html).not.toContain(ENGLISH_HEADLINE);
});

test("the landing page renders English by default", () => {
  const html = landingPage(config(), "en");

  expect(html).toContain(ENGLISH_HEADLINE);
  expect(html).toContain("Create a free account");
  expect(html).toContain('<html lang="en"');
  expect(html).not.toContain(TURKISH_HEADLINE);
});

test("a Turkish page interpolates its placeholders", () => {
  // `{{email}}` must reach the page as the address, never as the braces.
  const html = resetPage({ token: "t".repeat(24), email: "sam@example.com" }, "tr");

  expect(html).toContain("sam@example.com için.");
  expect(html).not.toContain("{{");
});

test("a Turkish page keeps names and numbers the way it was given them", () => {
  const html = modelsPage(config(), PERSON, [], [], null, "tr");

  expect(html).toContain("Modellerim");
  expect(html).toContain("Henüz model yok");
  // The free-account allowance is numbers and a noun: no plural suffix (glossary §8).
  expect(html).toContain("Ücretsiz hesapta 3 modelden 0 tanesi kullanıldı.");
});

test("no Turkish page shows a translation key instead of words", () => {
  // The failure this guards is a key that misses its Turkish entry and reaches
  // the screen as `settings.aiTitle` instead of words, so it is checked over the
  // visible text of every kind of page rather than one namespace on one page.
  const rendered = [
    landingPage(config(), "tr"),
    modelsPage(config(), PERSON, [], [], null, "tr"),
    sharePage(config(), PERSON, MODEL, [], {}, "tr"),
    settingsPage(config(), PERSON, [], {}, "tr"),
    connectPage(config(), PERSON, { models: [], keys: [], assistants: [], newKey: null }, null, "tr"),
    assistantConsentPage(config(), PERSON, { clientName: "Test Assistant", backTo: "https://claude.ai", request: "r=1", models: 1, shared: 0 }, "tr"),
    resetPage({ token: "t".repeat(24), email: "sam@example.com" }, "tr"),
  ];
  for (const html of rendered) expect(visibleText(html)).not.toMatch(TRANSLATION_KEY);
});

describe("the language a request arrives in", () => {
  let dataDir = "";
  let app: App | null = null;
  let base = "";

  beforeAll(async () => {
    dataDir = await mkdtemp(path.join(os.tmpdir(), "mutinybim-web-lang-"));
    app = createApp(config({ dataDir }), { editor: false });
    await new Promise<void>((resolve) => app?.server.listen(0, "127.0.0.1", resolve));
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    base = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app?.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  const home = (headers: Record<string, string> = {}): Promise<string> => fetch(`${base}/`, { headers }).then((response) => response.text());

  test("a browser that asks for Turkish gets the Turkish page", async () => {
    const html = await home({ "accept-language": "tr-TR,tr;q=0.9,en;q=0.8" });
    expect(html).toContain(TURKISH_HEADLINE);
  });

  test("the language cookie beats the browser's own preference", async () => {
    const html = await home({ "accept-language": "tr-TR,tr;q=0.9", cookie: "mutiny.lang=en" });
    expect(html).toContain(ENGLISH_HEADLINE);
  });

  test("a browser with no preference gets English", async () => {
    expect(await home()).toContain(ENGLISH_HEADLINE);
  });

  test("a cookie with a broken escape gives a page, not a dead server", async () => {
    // `Cookie: mutiny.lang=%` makes `decodeURIComponent` raise `URIError`. It used
    // to reach an uncaught exception in the request listener and end the process;
    // now the cookie is simply ignored.
    const response = await fetch(`${base}/`, { headers: { cookie: "mutiny.lang=%" } });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(ENGLISH_HEADLINE);
  });

  test("a broken cookie beside a good one leaves the good one working", async () => {
    expect(await home({ cookie: "x=100%; mutiny.lang=tr" })).toContain(TURKISH_HEADLINE);
    expect(await home({ cookie: "a=1; b=%zz; mutiny.lang=tr" })).toContain(TURKISH_HEADLINE);
  });

  test("a truncated multi-byte escape does not stop the page", async () => {
    const response = await fetch(`${base}/`, { headers: { cookie: "x=%E0%A4%A" } });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(ENGLISH_HEADLINE);
  });
});
