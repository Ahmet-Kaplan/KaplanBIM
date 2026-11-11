/**
 * Settings → Your AI: save, test and forget the person's own provider key, in this
 * browser only.
 *
 * The page is drawn on the server, so this script has no React tree and no
 * `<I18nProvider>` above it: the translator arrives as a parameter
 * (`./web-i18n`'s `pageTranslator`, in the language `<html lang>` carries) and
 * every status line is written with it. The namespace is named at each call
 * because `npm run i18n:review` binds a call to its namespace by the literal in
 * the call.
 */
import { ask, AiError, DEFAULT_MODELS, forgetAiSettings, providerName, readAiSettings, saveAiSettings, type AiProvider, type AiSettings } from "./ai";
import type { TFunction } from "i18next";
import { pageLanguage, pageTranslator } from "./web-i18n";

function field<T extends HTMLInputElement | HTMLSelectElement>(root: ParentNode, name: string): T {
  const el = root.querySelector(`[name="${name}"]`);
  if (!el) throw new Error(`[mutinybim-web settings] the AI form has no ${name} field`);
  return el as T;
}

function setStatus(root: ParentNode, kind: "ok" | "error" | "info", text: string): void {
  const status = root.querySelector(".status");
  if (!status) return;
  status.textContent = text;
  status.setAttribute("data-kind", kind);
}

function current(root: ParentNode, t: TFunction): AiSettings | null {
  const provider = field<HTMLSelectElement>(root, "provider").value as AiProvider;
  const key = field<HTMLInputElement>(root, "key").value.trim();
  if (!key) {
    setStatus(root, "error", t("settingsScript.keyFirst", "Paste your API key first.", { ns: "web" }));
    return null;
  }
  return {
    provider,
    key,
    model: field<HTMLInputElement>(root, "model").value.trim(),
    baseUrl: field<HTMLInputElement>(root, "baseUrl").value.trim(),
  };
}

function showProvider(root: HTMLElement, t: TFunction): void {
  const provider = field<HTMLSelectElement>(root, "provider").value as AiProvider;
  root.setAttribute("data-provider", provider);
  field<HTMLInputElement>(root, "model").placeholder = DEFAULT_MODELS[provider] || t("settingsScript.modelPlaceholder", "the model name your provider gives", { ns: "web" });
}

/**
 * Wires the settings form, in the page's language.
 *
 * A function of the element and the translator rather than module-level code, so a
 * test can drive it and so the words are the caller's to choose: the bundle's entry
 * calls it with the language the server drew the page in.
 */
export function startAiSettings(root: HTMLElement, t: TFunction): void {
  const saved = readAiSettings();
  if (saved) {
    field<HTMLSelectElement>(root, "provider").value = saved.provider;
    field<HTMLInputElement>(root, "model").value = saved.model;
    field<HTMLInputElement>(root, "baseUrl").value = saved.baseUrl;
    field<HTMLInputElement>(root, "key").value = saved.key;
  }
  showProvider(root, t);
  root.setAttribute("data-state", "ready");
  setStatus(
    root,
    "info",
    saved
      ? t("settingsScript.savedKey", "A {{provider}} key is saved in this browser.", { ns: "web", provider: providerName(saved, t) })
      : t("settingsScript.noKey", "No key saved in this browser yet.", { ns: "web" }),
  );
  field<HTMLSelectElement>(root, "provider").addEventListener("change", () => showProvider(root, t));

  root.querySelector('[data-action="save"]')?.addEventListener("click", () => {
    const settings = current(root, t);
    if (!settings) return;
    try {
      saveAiSettings(settings);
      setStatus(
        root,
        "ok",
        t("settingsScript.saved", "Saved in this browser. The editor's Ask AI button now uses your {{provider}} key.", {
          ns: "web",
          provider: providerName(settings, t),
        }),
      );
    } catch (err) {
      console.error("[mutinybim-web settings] saving the key in this browser failed", err);
      setStatus(
        root,
        "error",
        t("settingsScript.saveBlocked", "This browser wouldn't save the key (private browsing can block it). Nothing was sent anywhere.", { ns: "web" }),
      );
    }
  });

  const testButton = root.querySelector<HTMLButtonElement>('[data-action="test"]');
  testButton?.addEventListener("click", async () => {
    const settings = current(root, t);
    if (!settings) return;
    testButton.disabled = true;
    setStatus(root, "info", t("settingsScript.testing", "Asking {{provider}} a one-line question…", { ns: "web", provider: providerName(settings, t) }));
    try {
      const answer = await ask(
        settings,
        {
          system: t("settingsScript.testSystem", "Answer in five words or fewer.", { ns: "web" }),
          question: t("settingsScript.testQuestion", "Say that the key works.", { ns: "web" }),
        },
        t,
      );
      setStatus(
        root,
        "ok",
        t("settingsScript.testWorked", "{{provider}} answered: “{{answer}}”. The key works. Press Save to keep it.", {
          ns: "web",
          provider: providerName(settings, t),
          answer: answer.slice(0, 120),
        }),
      );
    } catch (err) {
      setStatus(
        root,
        "error",
        err instanceof AiError ? err.message : t("settingsScript.testFailed", "The test failed for a reason this page can't name. Try again.", { ns: "web" }),
      );
      if (!(err instanceof AiError)) console.error("[mutinybim-web settings] key test failed", err);
    } finally {
      testButton.disabled = false;
    }
  });

  root.querySelector('[data-action="forget"]')?.addEventListener("click", () => {
    if (!window.confirm(t("settingsScript.forgetQuestion", "Forget the AI key saved in this browser?", { ns: "web" }))) return;
    forgetAiSettings();
    field<HTMLInputElement>(root, "key").value = "";
    setStatus(root, "ok", t("settingsScript.forgotten", "Forgotten. No AI key is saved in this browser.", { ns: "web" }));
  });
}

const root = document.getElementById("ai-settings");
if (root) startAiSettings(root, pageTranslator(pageLanguage()));
