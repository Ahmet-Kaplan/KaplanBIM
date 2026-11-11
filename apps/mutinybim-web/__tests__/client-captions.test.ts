/**
 * The hosted app's browser code: every caption still keyed, with the English it
 * has today.
 *
 * `packages/bim-editor/__tests__/i18n-negative-space.test.ts` proves that no
 * *unkeyed* English is left in `apps/*\/client` — the hole that left a Turkish
 * editor under an English bar (`Ask AI`, `View only`, `← My models`). That scan
 * cannot see the other half: a caption that is keyed but whose English was
 * quietly rewritten, which is invisible to a Turkish screen and wrong for an
 * English one.
 *
 * So this pins each key to its English and to the number of places it is written,
 * the way the editor's own caption guards do (`i18n-project-panels.test.tsx`
 * and its `SITES`). The scan is the editor's (`captionsIn`), not a second one:
 * a second scanner is a second thing to keep honest, and this file's whole point
 * is that the two halves of the client's words stay where a person can count them.
 */
import path from "node:path";
import { readFileSync } from "node:fs";
import { captionsIn } from "../../../packages/bim-editor/__tests__/helpers/editor-source-captions";

/** `<repo>/apps/mutinybim-web/client`: the browser code the hosted editor ships. */
const CLIENT_SRC = path.join(__dirname, "..", "client");

/** The namespace every one of these keys lives in (`locales/tr/web.json`). */
const WEB = "web";

/**
 * Every caption the hosted client writes, with the English a person reads in
 * English. A changed sentence fails here, and so does a new one nobody listed.
 */
const CAPTIONS: readonly { readonly key: string; readonly english: string }[] = [
  // ./ai.ts — the app's own AI client, in the person's browser.
  { key: "ai.provider.yourOwn", english: "your provider" },
  {
    key: "ai.error.address",
    english: "Enter your provider's address (it starts with https:// and usually ends in /v1) in Settings → Your AI.",
  },
  {
    key: "ai.error.refusedKey",
    english: "{{provider}} refused the key. Check it in Settings → Your AI (it may be mistyped, revoked or out of credit).",
  },
  {
    key: "ai.error.unknownModel",
    english: "{{provider}} doesn't know that model name. Clear the Model box in Settings → Your AI to use the usual one.",
  },
  {
    key: "ai.error.limit",
    english: "{{provider}} says you've hit your rate limit or spending limit. Wait a minute or check your {{provider}} account.",
  },
  { key: "ai.error.serverProblem", english: "{{provider}} had a problem answering. Try again in a minute." },
  { key: "ai.error.statusAnswered", english: "{{provider}} answered with an error ({{status}})." },
  { key: "ai.error.modelName", english: "Enter the model name for your provider in Settings → Your AI." },
  {
    key: "ai.error.unreachable",
    english:
      "Couldn't reach {{provider}} from this browser. Check your connection. If it keeps failing, {{provider}} may not accept requests from web pages; connect your assistant app instead (Connect an assistant).",
  },
  { key: "ai.error.nothingToShow", english: "{{provider}} answered, but with nothing this page can show." },
  { key: "ai.error.signedOut", english: "You are signed out. Log in again, then ask." },
  { key: "ai.error.summary", english: "The model summary could not be read from the server. Try again." },
  { key: "ai.prompt.none", english: "none" },
  {
    key: "ai.prompt.system",
    english:
      'You help a person working in MutinyBIM, a browser building model for every AEC trade. Their model "{{model}}" is at revision {{revision}} with {{elements}} elements ({{kinds}}), levels {{levels}}, and {{connections}} connections. You can see only this summary, not the drawing. Answer plainly and briefly. To let an assistant change the model, they connect it with "Connect an assistant".',
  },
  // ./hosted-bar.tsx — the bar and its Ask AI panel.
  { key: "bar.back", english: "← My models" },
  { key: "bar.backTitle", english: "Back to my models" },
  { key: "bar.owner", english: "{{owner}}'s" },
  { key: "bar.viewOnlyTitle", english: "The owner shared this model to view. Edits are refused." },
  { key: "askAi.title", english: "Ask AI" },
  { key: "askAi.closeLabel", english: "Close Ask AI" },
  { key: "askAi.close", english: "Close" },
  {
    key: "askAi.noKey",
    english: "No AI key in this browser yet. This app pays for no AI: add your own Claude, ChatGPT or Grok key in",
  },
  { key: "askAi.settingsYourAi", english: "Settings → Your AI" },
  { key: "askAi.staysInBrowser", english: "(it stays in this browser), or" },
  { key: "askAi.connectYourAssistant", english: "connect your assistant app" },
  {
    key: "askAi.usesKey",
    english: "Uses your {{provider}} key, from this browser straight to {{provider}}. It sees a summary of this model, not the drawing.",
  },
  { key: "askAi.questionPlaceholder", english: "What should I check before sizing these ducts?" },
  { key: "askAi.questionLabel", english: "Your question" },
  { key: "askAi.ask", english: "Ask" },
  { key: "askAi.asking", english: "Asking…" },
  { key: "askAi.stop", english: "Stop" },
  { key: "askAi.typeFirst", english: "Type a question first." },
  { key: "askAi.waiting", english: "Waiting for {{provider}}…" },
  { key: "askAi.failed", english: "Asking failed for a reason this page can't name. Try again." },
  // ./settings.ts — Settings → Your AI, as the browser script draws it.
  { key: "settingsScript.keyFirst", english: "Paste your API key first." },
  { key: "settingsScript.modelPlaceholder", english: "the model name your provider gives" },
  { key: "settingsScript.savedKey", english: "A {{provider}} key is saved in this browser." },
  { key: "settingsScript.noKey", english: "No key saved in this browser yet." },
  {
    key: "settingsScript.saved",
    english: "Saved in this browser. The editor's Ask AI button now uses your {{provider}} key.",
  },
  {
    key: "settingsScript.saveBlocked",
    english: "This browser wouldn't save the key (private browsing can block it). Nothing was sent anywhere.",
  },
  { key: "settingsScript.testing", english: "Asking {{provider}} a one-line question…" },
  { key: "settingsScript.testSystem", english: "Answer in five words or fewer." },
  { key: "settingsScript.testQuestion", english: "Say that the key works." },
  {
    key: "settingsScript.testWorked",
    english: "{{provider}} answered: “{{answer}}”. The key works. Press Save to keep it.",
  },
  { key: "settingsScript.testFailed", english: "The test failed for a reason this page can't name. Try again." },
  { key: "settingsScript.forgetQuestion", english: "Forget the AI key saved in this browser?" },
  { key: "settingsScript.forgotten", english: "Forgotten. No AI key is saved in this browser." },
  // Shared with the server-rendered pages, written here the same way.
  { key: "common.viewOnly", english: "View only" },
  { key: "nav.connect", english: "Connect an assistant" },
  // ./entry.tsx — the hint the editor shows where a feature needs the person's own assistant.
  {
    key: "host.connectHint",
    english: "Connect your own AI assistant to this model: Connect an assistant, in the bar above.",
  },
];

/**
 * How many call sites each shared caption has today; a new one is a deliberate
 * bump here. `askAi.title` is the panel's dialog name, its heading and the bar's
 * button — one sentence, three places, so a revert at any one of them fails.
 */
const SITES: Readonly<Record<string, number>> = { "askAi.title": 3 };

/** The prefixes this app's browser code writes. A key under one that is not listed fails. */
const PREFIXES = ["ai.", "askAi.", "bar.", "settingsScript.", "host."] as const;

const SCRIPT_SETTINGS = path.join(__dirname, "..", "locales", "tr", `${WEB}.json`);

test("every hosted-client caption is still keyed, with the English it has today", () => {
  const source = captionsIn(CLIENT_SRC);
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, english: source.get(caption.key)?.english }).toEqual({ key: caption.key, english: caption.english });
  }
});

test("a hosted-client caption is still keyed at every place it is written", () => {
  const source = captionsIn(CLIENT_SRC);
  for (const caption of CAPTIONS) {
    expect({ key: caption.key, sites: source.get(caption.key)?.sites }).toEqual({ key: caption.key, sites: SITES[caption.key] ?? 1 });
  }
});

test("nothing is keyed in the client that this file does not name", () => {
  const source = captionsIn(CLIENT_SRC);
  const unlisted = [...source.keys()].filter((key) => PREFIXES.some((prefix) => key.startsWith(prefix)) && !CAPTIONS.some((caption) => caption.key === key));
  expect(unlisted).toEqual([]);
});

test("every hosted-client caption has Turkish of its own in the web namespace", () => {
  const turkish = JSON.parse(readFileSync(SCRIPT_SETTINGS, "utf8")) as Record<string, unknown>;
  const valueAt = (key: string): unknown => key.split(".").reduce<unknown>((node, part) => (typeof node === "object" && node !== null ? (node as Record<string, unknown>)[part] : undefined), turkish);
  const missing = CAPTIONS.map((caption) => caption.key).filter((key) => {
    const value = valueAt(key);
    return typeof value !== "string" || value === "" || value === key;
  });
  expect(missing).toEqual([]);
});

test("the placeholder counts in English and Turkish agree, so no value goes missing in one language", () => {
  const turkish = JSON.parse(readFileSync(SCRIPT_SETTINGS, "utf8")) as Record<string, unknown>;
  const valueAt = (key: string): string =>
    key.split(".").reduce<unknown>((node, part) => (typeof node === "object" && node !== null ? (node as Record<string, unknown>)[part] : undefined), turkish) as string;
  const placeholders = (text: string): string[] => [...text.matchAll(/\{\{(\w+)\}\}/gu)].map((match) => match[1] ?? "").sort();
  const disagreed = CAPTIONS.filter((caption) => /\{\{/u.test(caption.english)).filter((caption) => {
    const [english, tr] = [placeholders(caption.english), placeholders(valueAt(caption.key) ?? "")];
    const uniqueEnglish = [...new Set(english)];
    const uniqueTurkish = [...new Set(tr)];
    return JSON.stringify(uniqueEnglish) !== JSON.stringify(uniqueTurkish);
  });
  expect(disagreed.map((caption) => caption.key)).toEqual([]);
});
