/**
 * "Log in with <provider>": an OAuth 2.1 authorization-code client with PKCE,
 * for any authorization server that publishes its metadata (RFC 8414 or
 * OpenID discovery) and a UserInfo endpoint. Public client only: no client
 * secret exists. When the deployment gives no client id, the app registers
 * itself (RFC 7591) and remembers the id per redirect address.
 *
 * The provider's access token is used once, to ask UserInfo who signed in,
 * and is then dropped. It is never stored and never logged.
 */
import type { TFunction } from "i18next";
import type { OAuthProviderConfig } from "./config";
import type { Db } from "./db";
import { tFor } from "./i18n";
import { pkcePair, randomToken } from "./secrets";

/**
 * The English words, for a caller that names no language (a script, a test, the
 * log). Every server handler passes the request's own translator instead, so a
 * person reading the page gets these sentences in the language they chose.
 */
const english: TFunction = tFor("en");

export interface ProviderMetadata {
  readonly authorization_endpoint: string;
  readonly token_endpoint: string;
  readonly userinfo_endpoint: string | null;
  readonly registration_endpoint: string | null;
}

export interface ProviderPerson {
  readonly subject: string;
  readonly email: string | null;
  readonly name: string | null;
}

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** A sign-in failure with words a person can act on. */
export class SignInError extends Error {
  constructor(readonly words: string, detail?: string) {
    super(detail ? `${words} (${detail})` : words);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function url(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    return new URL(value).toString();
  } catch (err) {
    console.error("[mutinybim-web oauth] provider metadata has an unreadable address", { value, err });
    return null;
  }
}

async function readJson(response: Response, what: string, t: TFunction): Promise<Record<string, unknown>> {
  const raw = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`[mutinybim-web oauth] ${what} answered something that is not JSON`, { status: response.status, err });
    throw new SignInError(t("oauth.unreadableAnswer", "The sign-in service answered in a way this app can't read. Try again in a minute.", { ns: "web" }), `${what} ${response.status}`);
  }
  if (!isRecord(parsed)) throw new SignInError(t("oauth.unreadableAnswer", "The sign-in service answered in a way this app can't read. Try again in a minute.", { ns: "web" }), `${what} ${response.status}`);
  return parsed;
}

const metadataCache = new Map<string, { at: number; metadata: ProviderMetadata }>();

export async function discover(provider: OAuthProviderConfig, fetchImpl: Fetch = fetch, t: TFunction = english): Promise<ProviderMetadata> {
  const cached = metadataCache.get(provider.issuer);
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.metadata;
  for (const wellKnown of ["/.well-known/oauth-authorization-server", "/.well-known/openid-configuration"]) {
    let response: Response;
    try {
      response = await fetchImpl(`${provider.issuer}${wellKnown}`, { headers: { accept: "application/json" } });
    } catch (err) {
      console.error("[mutinybim-web oauth] provider metadata unreachable", { provider: provider.id, wellKnown, err });
      throw new SignInError(t("oauth.unreachable", "{{provider}} can't be reached right now. Try again in a minute, or sign in with email.", { provider: provider.label, ns: "web" }));
    }
    if (response.status === 404) continue;
    if (!response.ok) {
      console.error("[mutinybim-web oauth] provider metadata failed", { provider: provider.id, wellKnown, status: response.status });
      throw new SignInError(t("oauth.notAnswering", "{{provider}} sign-in is not answering right now. Try again in a minute, or sign in with email.", { provider: provider.label, ns: "web" }));
    }
    const body = await readJson(response, "metadata", t);
    const authorization = url(body.authorization_endpoint);
    const token = url(body.token_endpoint);
    if (!authorization || !token) throw new SignInError(t("oauth.misconfigured", "{{provider}} sign-in is set up in a way this app can't use.", { provider: provider.label, ns: "web" }), "metadata has no authorize/token address");
    const metadata: ProviderMetadata = {
      authorization_endpoint: authorization,
      token_endpoint: token,
      userinfo_endpoint: url(body.userinfo_endpoint),
      registration_endpoint: url(body.registration_endpoint),
    };
    metadataCache.set(provider.issuer, { at: Date.now(), metadata });
    return metadata;
  }
  throw new SignInError(t("oauth.misconfigured", "{{provider}} sign-in is set up in a way this app can't use.", { provider: provider.label, ns: "web" }), "no metadata document");
}

/** The client id to use: the configured one, the one this app registered before, or a new registration. */
export async function clientIdFor(provider: OAuthProviderConfig, metadata: ProviderMetadata, redirectUri: string, db: Db, fetchImpl: Fetch = fetch, options: { readonly fresh?: boolean; readonly t?: TFunction } = {}): Promise<string> {
  const t = options.t ?? english;
  if (provider.clientId) return provider.clientId;
  const known = options.fresh ? null : db.oauthClient(provider.id, redirectUri);
  if (known && Date.now() - Date.parse(known.registered_at) < 7 * 24 * 3600_000) return known.client_id;
  if (!metadata.registration_endpoint) throw new SignInError(t("oauth.needsClientId", "{{provider}} sign-in needs a client id for this app, and none is set.", { provider: provider.label, ns: "web" }), "no registration endpoint");
  let response: Response;
  try {
    response = await fetchImpl(metadata.registration_endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        client_name: provider.clientName ?? "MutinyBIM",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        scope: provider.scope ?? "openid email profile",
      }),
    });
  } catch (err) {
    console.error("[mutinybim-web oauth] client registration unreachable", { provider: provider.id, err });
    throw new SignInError(t("oauth.unreachable", "{{provider}} can't be reached right now. Try again in a minute, or sign in with email.", { provider: provider.label, ns: "web" }));
  }
  if (!response.ok) {
    console.error("[mutinybim-web oauth] client registration refused", { provider: provider.id, status: response.status });
    throw new SignInError(t("oauth.registrationRefused", "{{provider}} sign-in refused this app's registration. Try again later, or sign in with email.", { provider: provider.label, ns: "web" }));
  }
  const body = await readJson(response, "registration", t);
  if (typeof body.client_id !== "string" || body.client_id.length === 0) throw new SignInError(t("oauth.noClientId", "{{provider}} sign-in answered without a client id.", { provider: provider.label, ns: "web" }));
  db.saveOAuthClient(provider.id, redirectUri, body.client_id);
  return body.client_id;
}

/** Where to send the person, plus the state saved to finish the sign-in when they come back. */
export async function startSignIn(input: { provider: OAuthProviderConfig; redirectUri: string; returnTo: string; db: Db; fetchImpl?: Fetch; t?: TFunction }): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const t = input.t ?? english;
  const metadata = await discover(input.provider, fetchImpl, t);
  const clientId = await clientIdFor(input.provider, metadata, input.redirectUri, input.db, fetchImpl, { t });
  const { verifier, challenge } = pkcePair();
  const state = randomToken();
  input.db.saveOAuthState({ state, provider: input.provider.id, codeVerifier: verifier, returnTo: input.returnTo });
  const target = new URL(metadata.authorization_endpoint);
  target.searchParams.set("response_type", "code");
  target.searchParams.set("client_id", clientId);
  target.searchParams.set("redirect_uri", input.redirectUri);
  target.searchParams.set("scope", input.provider.scope ?? "openid email profile");
  target.searchParams.set("state", state);
  target.searchParams.set("code_challenge", challenge);
  target.searchParams.set("code_challenge_method", "S256");
  return target.toString();
}

/** Trades the code for a token, asks UserInfo who it is, drops the token. */
export async function finishSignIn(input: { provider: OAuthProviderConfig; redirectUri: string; code: string; codeVerifier: string; db: Db; fetchImpl?: Fetch; t?: TFunction }): Promise<ProviderPerson> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const t = input.t ?? english;
  const metadata = await discover(input.provider, fetchImpl, t);
  const clientId = await clientIdFor(input.provider, metadata, input.redirectUri, input.db, fetchImpl, { t });
  let tokenResponse: Response;
  try {
    tokenResponse = await fetchImpl(metadata.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ grant_type: "authorization_code", code: input.code, redirect_uri: input.redirectUri, client_id: clientId, code_verifier: input.codeVerifier }).toString(),
    });
  } catch (err) {
    console.error("[mutinybim-web oauth] token endpoint unreachable", { provider: input.provider.id, err });
    throw new SignInError(t("oauth.tryAgain", "{{provider}} can't be reached right now. Try signing in again.", { provider: input.provider.label, ns: "web" }));
  }
  if (!tokenResponse.ok) {
    console.error("[mutinybim-web oauth] code exchange refused", { provider: input.provider.id, status: tokenResponse.status });
    if (tokenResponse.status === 401) input.db.forgetOAuthClient(input.provider.id, input.redirectUri);
    throw new SignInError(t("oauth.signInExpired", "{{provider}} didn't accept this sign-in (it may have taken too long). Try again.", { provider: input.provider.label, ns: "web" }));
  }
  const tokenBody = await readJson(tokenResponse, "token", t);
  const accessToken = typeof tokenBody.access_token === "string" ? tokenBody.access_token : null;
  if (!accessToken) throw new SignInError(t("oauth.noToken", "{{provider}} answered without a sign-in token. Try again.", { provider: input.provider.label, ns: "web" }));
  if (!metadata.userinfo_endpoint) throw new SignInError(t("oauth.noUserInfo", "{{provider}} doesn't say who signed in (it has no UserInfo address), so this app can't use it yet.", { provider: input.provider.label, ns: "web" }));
  let infoResponse: Response;
  try {
    infoResponse = await fetchImpl(metadata.userinfo_endpoint, { headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" } });
  } catch (err) {
    console.error("[mutinybim-web oauth] userinfo unreachable", { provider: input.provider.id, err });
    throw new SignInError(t("oauth.tryAgain", "{{provider}} can't be reached right now. Try signing in again.", { provider: input.provider.label, ns: "web" }));
  }
  if (!infoResponse.ok) {
    console.error("[mutinybim-web oauth] userinfo refused", { provider: input.provider.id, status: infoResponse.status });
    throw new SignInError(t("oauth.wouldntSay", "{{provider}} wouldn't say who signed in. Try again.", { provider: input.provider.label, ns: "web" }));
  }
  const info = await readJson(infoResponse, "userinfo", t);
  const subject = typeof info.sub === "string" && info.sub.length > 0 ? info.sub : null;
  if (!subject) throw new SignInError(t("oauth.noSubject", "{{provider}} answered without saying who signed in. Try again.", { provider: input.provider.label, ns: "web" }));
  return {
    subject,
    email: typeof info.email === "string" && info.email.includes("@") ? info.email.toLowerCase() : null,
    name: typeof info.name === "string" && info.name.trim() ? info.name.trim().slice(0, 120) : null,
  };
}
