/**
 * Bring-your-own AI, entirely in the browser. The person's provider key is
 * kept in this browser's storage and sent only to their provider, never to
 * the MutinyBIM server. This app has no AI account and pays for no model use.
 *
 * Every message a person can read is translated: this module is not a component,
 * so the translator arrives as a parameter from the tree that shows the words
 * (`./hosted-bar` takes it from `useT('web')`, `./settings` from `./web-i18n`),
 * and the namespace is written at each call site because `npm run i18n:review`
 * binds a call to its namespace by the literal in the call.
 */
import type { TFunction } from "i18next";

export type AiProvider = "anthropic" | "openai" | "xai" | "compatible";

export interface AiSettings {
  readonly provider: AiProvider;
  readonly key: string;
  readonly model: string;
  /** For "compatible": the provider's OpenAI-style address, ending in /v1. */
  readonly baseUrl: string;
}

const STORAGE_KEY = "mutinybim.ai.v1";

export const DEFAULT_MODELS: Readonly<Record<AiProvider, string>> = {
  anthropic: "claude-sonnet-4-5",
  openai: "gpt-5-mini",
  xai: "grok-4-fast",
  compatible: "",
};

const PROVIDER_NAMES: Readonly<Record<Exclude<AiProvider, "compatible">, string>> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  xai: "xAI",
};

function isProvider(value: unknown): value is AiProvider {
  return value === "anthropic" || value === "openai" || value === "xai" || value === "compatible";
}

export function readAiSettings(): AiSettings | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.error("[mutinybim-web ai] this browser won't let the page read its storage", err);
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const p = parsed as Record<string, unknown>;
    if (!isProvider(p.provider) || typeof p.key !== "string" || p.key === "") return null;
    return { provider: p.provider, key: p.key, model: typeof p.model === "string" ? p.model : "", baseUrl: typeof p.baseUrl === "string" ? p.baseUrl : "" };
  } catch (err) {
    console.error("[mutinybim-web ai] the saved AI settings are unreadable; treating them as absent", err);
    return null;
  }
}

export function saveAiSettings(settings: AiSettings): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function forgetAiSettings(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function providerName(settings: AiSettings, t: TFunction): string {
  if (settings.provider === "compatible") return t("ai.provider.yourOwn", "your provider", { ns: "web" });
  return PROVIDER_NAMES[settings.provider];
}

/** A failure the page can show as is. */
export class AiError extends Error {}

function baseUrlOf(settings: AiSettings, t: TFunction): string {
  if (settings.provider === "openai") return "https://api.openai.com/v1";
  if (settings.provider === "xai") return "https://api.x.ai/v1";
  const base = settings.baseUrl.trim().replace(/\/$/, "");
  if (!/^https:\/\//.test(base)) {
    throw new AiError(t("ai.error.address", "Enter your provider's address (it starts with https:// and usually ends in /v1) in Settings → Your AI.", { ns: "web" }));
  }
  return base;
}

function statusWords(status: number, name: string, t: TFunction): string {
  if (status === 401 || status === 403) {
    return t("ai.error.refusedKey", "{{provider}} refused the key. Check it in Settings → Your AI (it may be mistyped, revoked or out of credit).", {
      ns: "web",
      provider: name,
    });
  }
  if (status === 404) {
    return t("ai.error.unknownModel", "{{provider}} doesn't know that model name. Clear the Model box in Settings → Your AI to use the usual one.", { ns: "web", provider: name });
  }
  if (status === 429) {
    return t("ai.error.limit", "{{provider}} says you've hit your rate limit or spending limit. Wait a minute or check your {{provider}} account.", { ns: "web", provider: name });
  }
  if (status >= 500) return t("ai.error.serverProblem", "{{provider}} had a problem answering. Try again in a minute.", { ns: "web", provider: name });
  return t("ai.error.statusAnswered", "{{provider}} answered with an error ({{status}}).", { ns: "web", provider: name, status });
}

export interface AskInput {
  readonly system: string;
  readonly question: string;
  readonly signal?: AbortSignal;
}

/** One question, one answer, straight from the browser to the person's provider. */
export async function ask(settings: AiSettings, input: AskInput, t: TFunction): Promise<string> {
  const name = providerName(settings, t);
  const model = settings.model.trim() || DEFAULT_MODELS[settings.provider];
  if (!model) throw new AiError(t("ai.error.modelName", "Enter the model name for your provider in Settings → Your AI.", { ns: "web" }));
  let response: Response;
  try {
    if (settings.provider === "anthropic") {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: input.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": settings.key,
          "anthropic-version": "2023-06-01",
          // Anthropic asks browser callers to say they are one; the key is the person's own.
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({ model, max_tokens: 1024, system: input.system, messages: [{ role: "user", content: input.question }] }),
      });
    } else {
      response = await fetch(`${baseUrlOf(settings, t)}/chat/completions`, {
        method: "POST",
        signal: input.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${settings.key}` },
        body: JSON.stringify({ model, messages: [{ role: "system", content: input.system }, { role: "user", content: input.question }] }),
      });
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    if (err instanceof AiError) throw err;
    console.error("[mutinybim-web ai] the request to the provider didn't go through", err);
    throw new AiError(
      t(
        "ai.error.unreachable",
        "Couldn't reach {{provider}} from this browser. Check your connection. If it keeps failing, {{provider}} may not accept requests from web pages; connect your assistant app instead (Connect an assistant).",
        { ns: "web", provider: name },
      ),
    );
  }
  if (!response.ok) {
    console.error("[mutinybim-web ai] the provider refused the request", { provider: settings.provider, status: response.status });
    throw new AiError(statusWords(response.status, name, t));
  }
  const body: unknown = await response.json();
  const text = answerText(body);
  if (text === null) {
    throw new AiError(t("ai.error.nothingToShow", "{{provider}} answered, but with nothing this page can show.", { ns: "web", provider: name }));
  }
  return text;
}

function answerText(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (Array.isArray(b.content)) {
    const parts = b.content.flatMap((part: unknown) => (typeof part === "object" && part !== null && "text" in part && typeof part.text === "string" ? [part.text] : []));
    return parts.length > 0 ? parts.join("\n") : null;
  }
  if (Array.isArray(b.choices)) {
    const first: unknown = b.choices[0];
    if (typeof first === "object" && first !== null && "message" in first) {
      const message: unknown = first.message;
      if (typeof message === "object" && message !== null && "content" in message && typeof message.content === "string") return message.content;
    }
  }
  return null;
}
