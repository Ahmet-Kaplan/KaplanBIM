/**
 * @jest-environment node
 *
 * The words route handlers write themselves — a flash after a save, a refusal,
 * a sign-in error — in the language the request asked for.
 *
 * `pages.tsx` draws the pages in either language (stage 2.1), but the flash and
 * error sentences are written by the handlers, before any page function is
 * called, and until now they were English literals in the handler. This is the
 * surface a person meets first: the wrong password, the expired sign-in link,
 * the rate limit, the free-account model limit. It has to speak their language
 * too, and — the other half of the promise — the English it produces has to be
 * the same English, character for character, that it produced before.
 *
 * These are security-sensitive messages (sign-in links, rate limits, expiry), so
 * every case checks both languages: the Turkish one exists, and the English one
 * still says exactly what it said.
 */
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp, type App } from "../src/app";
import type { OAuthProviderConfig, WebConfig } from "../src/config";
import { digest, randomToken } from "../src/secrets";
import type { Fetch } from "../src/oauth";

let dataDir = "";
let app: App | null = null;
let base = "";

const TR = "mutiny.lang=tr";
const EN = "mutiny.lang=en";

function config(port: number, extra: Partial<WebConfig> = {}): WebConfig {
  return { port, host: "127.0.0.1", origin: `http://127.0.0.1:${port}`, dataDir, modelLimit: 3, signupOpen: true, providers: [], quote: null, secure: false, ...extra };
}

async function start(extra: Partial<WebConfig> = {}, fetchImpl?: Fetch): Promise<void> {
  // Two servers on purpose, as `app.test.ts` does: the port has to be known
  // before the config that names it is built.
  const probe = createApp(config(0, extra), { editor: false, ...(fetchImpl ? { fetchImpl } : {}) });
  await new Promise<void>((resolve) => probe.server.listen(0, "127.0.0.1", resolve));
  const address = probe.server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  await probe.close();
  app = createApp(config(address.port, extra), { editor: false, ...(fetchImpl ? { fetchImpl } : {}) });
  await app.listen();
  base = `http://127.0.0.1:${address.port}`;
}

/** The words as React writes them into the markup: five characters escaped. */
function inMarkup(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

interface Answer {
  readonly status: number;
  readonly html: string;
}

/** The cookie header for a person's session, in the language asked for. */
function as(cookie: string, language: "en" | "tr"): string {
  return cookie === "" ? (language === "tr" ? TR : EN) : `${cookie}; ${language === "tr" ? TR : EN}`;
}

async function get(pathname: string, cookie = ""): Promise<Answer> {
  const response = await fetch(`${base}${pathname}`, { headers: cookie === "" ? {} : { cookie }, redirect: "manual" });
  return { status: response.status, html: await response.text() };
}

async function postForm(pathname: string, fields: Record<string, string>, cookie = ""): Promise<Answer> {
  const response = await fetch(`${base}${pathname}`, {
    method: "POST",
    redirect: "manual",
    headers: { origin: base, "content-type": "application/x-www-form-urlencoded", ...(cookie === "" ? {} : { cookie }) },
    body: new URLSearchParams(fields).toString(),
  });
  return { status: response.status, html: await response.text() };
}

async function postJson(pathname: string, body: unknown, cookie = ""): Promise<Answer> {
  const response = await fetch(`${base}${pathname}`, {
    method: "POST",
    redirect: "manual",
    headers: { origin: base, "content-type": "application/json", ...(cookie === "" ? {} : { cookie }) },
    body: JSON.stringify(body),
  });
  return { status: response.status, html: await response.text() };
}

function sessionCookie(response: Response): string {
  const match = (response.headers.get("set-cookie") ?? "").match(/mutinybim_session=[^;]+/);
  if (!match) throw new Error("no session cookie");
  return match[0];
}

async function signUp(email: string, name = "Sam Example", password = "correct-horse"): Promise<string> {
  const response = await fetch(`${base}/signup`, {
    method: "POST",
    redirect: "manual",
    headers: { origin: base, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name, email, password }).toString(),
  });
  return sessionCookie(response);
}

async function makeModel(cookie: string, name: string): Promise<string> {
  const response = await fetch(`${base}/models`, {
    method: "POST",
    redirect: "manual",
    headers: { origin: base, cookie, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name, start: "blank" }).toString(),
  });
  return response.headers.get("location")?.match(/\/m\/([a-z0-9-]+)/)?.[1] ?? "";
}

/**
 * One case in both languages: the same request, twice, and the two answers have
 * to carry the Turkish words and the English words respectively.
 *
 * `send` takes the cookie header to send, so a case can sign a person in and
 * still ask for the other language; the English half is the regression check
 * (byte-identical to what the handler wrote before), and `absent` names an
 * English word that must *not* survive into the Turkish page.
 *
 * `json: true` says the answer is a JSON body the settings page reads, where
 * nothing is HTML-escaped in the way React escapes a page's text.
 */
async function bothWays(cookie: string, send: (cookieHeader: string) => Promise<Answer>, words: { readonly english: string; readonly turkish: string; readonly absent?: string; readonly json?: true }): Promise<void> {
  const inWire = words.json === true ? (text: string) => text : inMarkup;
  const english = await send(as(cookie, "en"));
  expect(english.html).toContain(inWire(words.english));
  const turkish = await send(as(cookie, "tr"));
  expect(turkish.html).toContain(inWire(words.turkish));
  expect(turkish.html).not.toContain(inWire(words.absent ?? words.english));
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), "mutinybim-web-i18n-test-"));
});

afterEach(async () => {
  await app?.close();
  app = null;
  await rm(dataDir, { recursive: true, force: true });
});

test("the expired sign-in link message is Turkish when the request language is tr", async () => {
  await start({ providers: [{ id: "example", label: "Log in with Example", issuer: "https://id.example.test" }] });
  // A state this app never issued: the link is expired or already used.
  await bothWays("", (cookie) => get("/auth/example/callback?code=code-abc&state=never-issued", cookie), {
    english: "That sign-in link expired or was already used. Start again.",
    turkish: "Bu giriş bağlantısının süresi dolmuş ya da bağlantı zaten kullanılmış. Yeniden başlayın.",
  });
});

test("a sign-up with a password that is too short is refused in Turkish, naming the same minimum", async () => {
  await start();
  const answers = { en: await postForm("/signup", { name: "Sam", email: "sam@example.com", password: "short" }, EN), tr: await postForm("/signup", { name: "Sam", email: "sam@example.com", password: "short" }, TR) };
  // The rule itself is unchanged: eight characters, said in both languages.
  expect(answers.en.html).toContain("Use a password of at least 8 characters.");
  expect(answers.tr.html).toContain("En az 8 karakterlik bir parola kullanın.");
  expect(answers.tr.html).not.toContain("Use a password of at least 8 characters.");
  expect([answers.en.status, answers.tr.status]).toEqual([400, 400]);
});

test("a reset link with a password that is too short is refused in Turkish, naming the same minimum", async () => {
  await start();
  const cookie = await signUp("sam@example.com");
  const user = app?.db.userByEmail("sam@example.com");
  if (!user) throw new Error("no account");
  const token = randomToken();
  app?.db.createPasswordReset(digest(token), user.id, new Date(Date.now() + 3_600_000));
  const answers = { en: await postForm(`/reset/${token}`, { password: "short" }, EN), tr: await postForm(`/reset/${token}`, { password: "short" }, TR) };
  expect(cookie).toContain("mutinybim_session");
  expect(answers.en.html).toContain("Use a password of at least 8 characters.");
  expect(answers.tr.html).toContain("En az 8 karakterlik bir parola kullanın.");
  expect(answers.tr.html).toContain("8");
});

test("the rate-limit message on the log-in form is Turkish", async () => {
  await start();
  // The throttle allows twenty tries in ten minutes from one address; the
  // twenty-first is refused in words, which is the sentence under test.
  let last: Answer = { status: 0, html: "" };
  for (let tryNumber = 0; tryNumber < 21; tryNumber += 1) last = await postForm("/login", { email: "sam@example.com", password: "not-it" }, EN);
  expect(last.status).toBe(429);
  expect(last.html).toContain("Too many tries from here. Wait ten minutes, then try again.");
  const turkish = await postForm("/login", { email: "sam@example.com", password: "not-it" }, TR);
  expect(turkish.status).toBe(429);
  expect(turkish.html).toContain("Buradan çok fazla deneme yapıldı. On dakika bekleyip tekrar deneyin.");
  expect(turkish.html).not.toContain("Too many tries from here.");
});

test("a wrong email and password is refused in Turkish", async () => {
  await start();
  await signUp("sam@example.com");
  await bothWays("", (cookie) => postForm("/login", { email: "sam@example.com", password: "not-the-one" }, cookie), {
    english: "That email and password don't match an account. Check both and try again.",
    turkish: "Bu e-posta ve parola bir hesapla eşleşmiyor. İkisini kontrol edip tekrar deneyin.",
  });
});

test("a duplicate sign-up is refused in Turkish", async () => {
  await start();
  await signUp("sam@example.com");
  await bothWays("", (cookie) => postForm("/signup", { name: "Again", email: "sam@example.com", password: "correct-horse" }, cookie), {
    english: "An account with that email already exists. Log in instead.",
    turkish: "Bu e-postayla bir hesap zaten var. Bunun yerine giriş yapın.",
  });
});

test("the free-account model limit is explained in Turkish, with the same number", async () => {
  await start();
  const cookie = await signUp("sam@example.com");
  for (const name of ["One", "Two", "Three"]) await makeModel(cookie, name);
  await bothWays(cookie, (cookieHeader) => postForm("/models", { name: "Four", start: "blank" }, cookieHeader), {
    english: "A free account keeps up to 3 models. Delete one to make another.",
    turkish: "Ücretsiz bir hesap en fazla 3 model tutar. Bir tane daha yapmak için birini silin.",
  });
});

test("sharing with an email no account uses is refused in Turkish", async () => {
  await start();
  const cookie = await signUp("sam@example.com");
  const id = await makeModel(cookie, "Sample Warehouse");
  await bothWays(cookie, (cookieHeader) => postForm(`/models/${id}/share`, { email: "nobody@example.com", role: "view" }, cookieHeader), {
    english: "No MutinyBIM account here uses nobody@example.com. Ask them to sign up first (this app sends no invitations), then share again.",
    turkish: "Burada nobody@example.com adresini kullanan bir MutinyBIM hesabı yok. Önce o kişi hesap oluştursun (bu uygulama davetiye göndermez), sonra yeniden paylaşın.",
  });
});

test("a model that does not exist is refused in Turkish", async () => {
  await start();
  const cookie = await signUp("sam@example.com");
  await bothWays(cookie, (cookieHeader) => get("/api/hosted/models/m-0123456789abcdef01/summary", cookieHeader), {
    english: "That model isn't in your account or shared with you. It may have been deleted, or its owner stopped sharing it.",
    turkish: "Bu model hesabınızda değil ve sizinle paylaşılmamış. Silinmiş olabilir ya da sahibi paylaşımı durdurmuş olabilir.",
    json: true,
  });
});

test("an empty name on the profile form is refused in Turkish", async () => {
  await start();
  const cookie = await signUp("sam@example.com");
  await bothWays(cookie, (cookieHeader) => postForm("/settings/profile", { name: "  " }, cookieHeader), {
    english: "Your name can't be empty.",
    turkish: "Adınız boş olamaz.",
  });
});

test("a theme the app does not know is refused in Turkish, in the JSON the settings page reads", async () => {
  await start();
  const cookie = await signUp("sam@example.com");
  await bothWays(cookie, (cookieHeader) => postJson("/settings/scheme", { scheme: "sepia" }, cookieHeader), {
    english: "Pick light, dark or system.",
    turkish: "Açık, koyu veya otomatik seçin.",
  });
});

test("a language the app does not speak is refused in Turkish", async () => {
  await start();
  const cookie = await signUp("sam@example.com");
  await bothWays(cookie, (cookieHeader) => postJson("/settings/language", { language: "fr" }, cookieHeader), {
    english: "Pick English or Türkçe.",
    turkish: "English veya Türkçe seçin.",
  });
});

test("the closed-signup message a provider sign-in runs into is Turkish", async () => {
  const issuer = "https://id.example.test";
  const fetchImpl: Fetch = async (input) => {
    if (input === `${issuer}/.well-known/oauth-authorization-server`) {
      return Response.json({ authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, registration_endpoint: `${issuer}/register`, userinfo_endpoint: `${issuer}/userinfo` });
    }
    if (input === `${issuer}/register`) return Response.json({ client_id: "client-123" }, { status: 201 });
    if (input === `${issuer}/token`) return Response.json({ access_token: "provider-token", token_type: "bearer" });
    if (input === `${issuer}/userinfo`) return Response.json({ sub: "person-1", email: "pat@example.com", name: "Pat Example" });
    return new Response("not here", { status: 404 });
  };
  await start({ signupOpen: false, providers: [{ id: "example", label: "Log in with Example", issuer }] }, fetchImpl);

  /** Walks the sign-in far enough to come back with a state this app issued. */
  const stateFor = async (cookie: string): Promise<string> => {
    const begin = await fetch(`${base}/auth/example/start?return_to=%2Fmodels`, { redirect: "manual", headers: { cookie } });
    return new URL(begin.headers.get("location") ?? "").searchParams.get("state") ?? "";
  };

  const english = await get(`/auth/example/callback?code=code-abc&state=${await stateFor(EN)}`, EN);
  expect(english.html).toContain(inMarkup("New accounts can't be made on this server right now."));
  const turkish = await get(`/auth/example/callback?code=code-abc&state=${await stateFor(TR)}`, TR);
  expect(turkish.html).toContain("Bu sunucuda şu anda yeni hesap açılamıyor.");
  expect(turkish.html).not.toContain(inMarkup("New accounts can't be made on this server right now."));
});

test("a provider that cannot be reached is described in Turkish (the sign-in module's words)", async () => {
  const issuer = "https://id.example.test";
  const unreachable: Fetch = async () => {
    throw new Error("connection refused");
  };
  const provider: OAuthProviderConfig = { id: "example", label: "Log in with Example", issuer };
  await start({ providers: [provider] }, unreachable);
  await bothWays("", (cookie) => get("/auth/example/start?return_to=%2Fmodels", cookie), {
    english: "Example can't be reached right now. Try again in a minute, or sign in with email.",
    turkish: "Example hizmetine şu anda ulaşılamıyor. Bir dakika sonra tekrar deneyin ya da e-postayla giriş yapın.",
  });
});

test("no translation key is ever shown instead of its words", async () => {
  await start();
  const pages = [
    (await postForm("/signup", { name: "Sam", email: "sam@example.com", password: "short" })).html,
    (await get("/auth/nope/start")).html,
    (await get("/nowhere")).html,
  ];
  for (const page of pages) {
    // A leaked key reads `errors.passwordTooShort` — a section, a dot, a camelCase name.
    expect(page).not.toMatch(/\b(?:errors|flash|oauth|callback|message)\.[a-z][A-Za-z]*/);
  }
});
