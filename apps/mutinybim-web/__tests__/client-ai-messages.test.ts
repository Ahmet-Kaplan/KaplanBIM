/**
 * The app's own AI client speaks the page's language.
 *
 * `./ai.ts` is not a component: it throws the sentences a person reads when their
 * key is refused, when the model name is unknown or when the provider cannot be
 * reached, and it takes its translator as a parameter. That is the half a caption
 * scan cannot prove — a key can be present and the wrong translator handed in — so
 * these call it the way the bar and the settings script do, in both languages.
 *
 * The English is asserted word for word: it is the source of truth and it must not
 * move by a character when the Turkish is added.
 */
import { AiError, ask, providerName, type AiSettings } from "../client/ai";
import { pageTranslator } from "../client/web-i18n";

const SETTINGS: AiSettings = { provider: "anthropic", key: "sk-test", model: "claude-sonnet-4-5", baseUrl: "" };

/** A fetch that refuses everything with one status, as a provider out of credit would. */
function refusing(status: number): typeof fetch {
  return (async () => ({ ok: false, status, json: async () => ({}) }) as unknown as Response) as typeof fetch;
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe("a provider that refuses the key", () => {
  test("says so in Turkish, with the provider's name in it", async () => {
    global.fetch = refusing(401);
    await expect(ask(SETTINGS, { system: "s", question: "q" }, pageTranslator("tr"))).rejects.toThrow(
      "Anthropic anahtarı kabul etmedi. Ayarlar → Yapay zekânız bölümünde kontrol edin (yanlış yazılmış, iptal edilmiş ya da bakiyesi bitmiş olabilir).",
    );
  });

  test("says exactly what it said before in English", async () => {
    global.fetch = refusing(401);
    await expect(ask(SETTINGS, { system: "s", question: "q" }, pageTranslator("en"))).rejects.toThrow(
      "Anthropic refused the key. Check it in Settings → Your AI (it may be mistyped, revoked or out of credit).",
    );
  });
});

describe("a status this page can name", () => {
  test("a rate limit is a sentence about the person's own account", async () => {
    global.fetch = refusing(429);
    await expect(ask(SETTINGS, { system: "s", question: "q" }, pageTranslator("tr"))).rejects.toThrow(
      "Anthropic istek ya da harcama sınırına ulaştığınızı söylüyor. Bir dakika bekleyin ya da Anthropic hesabınızı kontrol edin.",
    );
  });

  test("an unexplained status carries its number", async () => {
    global.fetch = refusing(418);
    await expect(ask(SETTINGS, { system: "s", question: "q" }, pageTranslator("tr"))).rejects.toThrow("Anthropic bir hatayla yanıt verdi (418).");
  });
});

describe("the provider's name", () => {
  test("stays the provider's own in every language, except the one that is a phrase", () => {
    expect(providerName({ ...SETTINGS, provider: "anthropic" }, pageTranslator("tr"))).toBe("Anthropic");
    expect(providerName({ ...SETTINGS, provider: "openai" }, pageTranslator("tr"))).toBe("OpenAI");
    expect(providerName({ ...SETTINGS, provider: "compatible" }, pageTranslator("tr"))).toBe("sağlayıcınız");
    expect(providerName({ ...SETTINGS, provider: "compatible" }, pageTranslator("en"))).toBe("your provider");
  });
});

describe("a browser that cannot reach the provider", () => {
  test("says what to do next, in the page's language, and is an AiError the panel can show", async () => {
    global.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    await expect(ask(SETTINGS, { system: "s", question: "q" }, pageTranslator("tr"))).rejects.toThrow(AiError);
    await expect(ask(SETTINGS, { system: "s", question: "q" }, pageTranslator("tr"))).rejects.toThrow(
      "Bu tarayıcıdan Anthropic adresine ulaşılamadı. Bağlantınızı kontrol edin. Sürerse Anthropic web sayfalarından gelen istekleri kabul etmiyor olabilir; bunun yerine asistan uygulamanızı bağlayın (Asistan bağla).",
    );
  });
});

describe("a model name nobody set", () => {
  test("is asked for in the page's language, before a request goes anywhere", async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const custom: AiSettings = { ...SETTINGS, provider: "compatible", model: "", baseUrl: "https://api.example.com/v1" };
    await expect(ask(custom, { system: "s", question: "q" }, pageTranslator("tr"))).rejects.toThrow(
      "Ayarlar → Yapay zekânız bölümüne sağlayıcınızın model adını girin.",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
