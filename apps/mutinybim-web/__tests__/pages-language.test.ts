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
import type { UserRow } from "../src/db";
import { landingPage, modelsPage, resetPage } from "../src/pages";

function config(overrides: Partial<WebConfig> = {}): WebConfig {
  return { port: 0, host: "127.0.0.1", origin: "http://127.0.0.1:0", dataDir: path.join(os.tmpdir(), "mutinybim-pages-test"), modelLimit: 3, signupOpen: true, providers: [], quote: null, secure: false, ...overrides };
}

const PERSON: UserRow = { id: "u-1", email: "sam@example.com", display_name: "Sam Example", password_hash: null, created_at: "2026-11-09T10:00:00.000Z", color_scheme: "system" };

const ENGLISH_HEADLINE = "A building model you can open in a browser, free.";
const TURKISH_HEADLINE = "Tarayıcıda açabileceğiniz ücretsiz bir yapı modeli.";

test("the landing page renders Turkish when the language is tr", () => {
  const html = landingPage(config(), "tr");

  expect(html).toContain(TURKISH_HEADLINE);
  expect(html).toContain("Ücretsiz hesap oluştur");
  // The page says which language it is in, for a screen reader.
  expect(html).toContain('<html lang="tr"');
  // Nothing of the English source leaks through, and no key name is ever shown.
  expect(html).not.toContain(ENGLISH_HEADLINE);
  expect(html).not.toMatch(/landing\.\w/);
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
  expect(html).toContain("Ücretsiz hesapta 3 modelden 0.");
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
});
