# MutinyBIM İki Dilli Arayüz (EN/TR) — Implementation Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MutinyBIM'in tüm ekranlarını İngilizce ve Türkçe çalıştırmak, dil seçimini kalıcı kılmak ve terminolojiyi onaylı sözlüğe göre tutarlı kılmak.

**Architecture:** `i18next` + `react-i18next`, paket başına namespace (`common`, `editor`, `schedules`, `web`, `domain`). İngilizce metin kod içinde `defaultValue` olarak kalır (tek doğruluk kaynağı); Türkçe paket içinde `locales/tr/<ns>.json` dosyasında yaşar. Eksik çeviri İngilizceye düşer, ham anahtar asla görünmez. Kernel/pack'lerin ürettiği parametreli cümleler **şablon normalizasyonu** ile çevrilir (kernel'e dokunulmadan).

**Tech Stack:** TypeScript · React 19 · i18next + react-i18next · jest (esbuild transform, jsdom) · mevcut `--mutiny-*` tema sistemi.

**Spec:** `docs/superpowers/specs/2026-11-10-bilingual-ui-design.md`
**Bağlayıcı sözlük:** `docs/i18n/glossary.md` (onaylandı)

## Global Constraints

- **İngilizce metin değişmez.** Her string `t('key', 'English')` biçiminde; `defaultValue` mevcut `en` metninin **birebir** aynısıdır. `en` arayüzünde görsel regresyon olmaz.
- **Sözlük bağlayıcı.** `docs/i18n/glossary.md` §1–§10 uygulanır. Terim uydurulmaz; sözlükte yoksa öneri olarak eklenir.
- **Türkçede sayıdan sonra çoğul eki yok:** `{n} eleman` (asla `{n} elemanlar`). i18next `_one`/`_other` İngilizce için; Türkçe tek biçim.
- **Katman kuralı:** i18n yalnız sunum katmanı (5) ve uygulamalarda. `bim-kernel`, `bim-units`, `bim-formula`, `bim-geometry` i18n import etmez. `packages/bim-kernel/src/__tests__/import-layers.test.ts` yeşil kalır.
- **Tema kuralı:** yeni bileşen `--mutiny-*` değişkenleri kullanır; hex renk yok, inline style rengi yok. `Button`/`ToggleGroup`/`Tooltip` vb. `@permitzip/bim-ui` bileşenleri kullanılır, elle buton yazılmaz.
- **Test deseni:** `packages/<pkg>/__tests__/*.test.ts(x)` (jest, jsdom). `bim-ui` testleri bu deseni izler (`packages/bim-ui/__tests__/theme-toggle.test.tsx` örneği).
- **Fallback:** `fallbackLng: 'en'`; anahtar eksikse İngilizce metin görünür, anahtar adı asla.
- **Kapsam dışı:** yazdırılan paftalar/PDF (`bim-sheets`), MCP/ajan metinleri, e-posta şablonları — İngilizce kalır.

## Review Focus

1. **`tr` çevirisi eksik bir anahtar** → kullanıcı İngilizce görür, ham anahtar değil. → Task 1.5 (parity testi) + 1.1 fallback testi.
2. **Türkçede yanlış çoğul** ("3 elemanlar") → sözlük §8 ihlali. → Task 1.6 (sözlük lint testi) + her çeviri görevinde.
3. **Dil değişimi kalıcı olmuyor** (yenilemede İngilizceye dönüyor) → Task 1.3 persistence testleri.
4. **Parametreli kernel cümlesi çevrilmiyor** (Türkçe ekranda İngilizce cümle) → Task 3.4 normalizer testleri, kapsam raporu.
5. **Sayı biçimi karışık** (aynı ekranda `12,345.67` ve `12.345,67`) → Task 1.2 format testleri.

---

## Aşama 1 — Altyapı

### Task 1.1: i18n çekirdeği (`bim-ui`)

**Files:**
- Modify: `package.json` (kök `dependencies`/`devDependencies`), `packages/bim-ui/package.json` (peerDeps)
- Create: `packages/bim-ui/src/i18n/index.ts`
- Create: `packages/bim-ui/src/i18n/provider.tsx`
- Create: `packages/bim-ui/src/i18n/use-t.ts`
- Create: `packages/bim-ui/locales/tr/common.json`
- Test: `packages/bim-ui/__tests__/i18n-core.test.tsx`

**Interfaces:**
- Produces:
  - `createI18n(options?: { language?: MutinyLanguage; resources?: Resource }): i18n` — `packages/bim-ui/src/i18n/index.ts`
  - `type MutinyLanguage = 'en' | 'tr'`
  - `isMutinyLanguage(v: unknown): v is MutinyLanguage`
  - `<I18nProvider language: MutinyLanguage, onLanguageChange?: (l: MutinyLanguage) => void, children>` — `provider.tsx`
  - `useT(namespace?: string): TFunction` — `use-t.ts`
  - `useMutinyLanguage(): { language: MutinyLanguage; setLanguage(l: MutinyLanguage): void; error?: string }`
- Task 1.2–5.x tümü `useT` ve `MutinyLanguage`'ı buradan tüketir.

- [ ] **Step 1: Bağımlılıkları ekle**

Run: `npm install i18next react-i18next --save` (kök)
Run: `npm install -D @types/i18next` (yalnız gerekliyse; i18next kendi tiplerini taşır — gereksizse atla)
Expected: `package.json` güncellenir, `npm ls i18next` sürüm basar.

- [ ] **Step 2: Başarısız testi yaz**

```tsx
// packages/bim-ui/__tests__/i18n-core.test.tsx
import { isMutinyLanguage, createI18n } from "../src/i18n";

test("isMutinyLanguage accepts only en and tr", () => {
  expect(isMutinyLanguage("en")).toBe(true);
  expect(isMutinyLanguage("tr")).toBe(true);
  expect(isMutinyLanguage("de")).toBe(false);
  expect(isMutinyLanguage(undefined)).toBe(false);
});

test("a missing tr key falls back to the English defaultValue, never the key", () => {
  const i18n = createI18n({ language: "tr", resources: { tr: { common: {} } } });
  expect(i18n.t("greet", { ns: "common", defaultValue: "Hello" })).toBe("Hello");
  expect(i18n.t("greet", { ns: "common", defaultValue: "Hello" })).not.toBe("greet");
});

test("a present tr key resolves to Turkish", () => {
  const i18n = createI18n({ language: "tr", resources: { tr: { common: { greet: "Merhaba" } } } });
  expect(i18n.t("greet", { ns: "common", defaultValue: "Hello" })).toBe("Merhaba");
});
```

- [ ] **Step 3: Testin başarısız olduğunu doğrula**

Run: `npx jest packages/bim-ui/__tests__/i18n-core.test.tsx -v`
Expected: FAIL — "Cannot find module '../src/i18n'".

- [ ] **Step 4: `createI18n` + `isMutinyLanguage` + `MutinyLanguage` uygula**

`createI18n` i18next'i şu ayarlarla başlatır: `fallbackLng: 'en'`, `lng: options.language ?? 'en'`, `defaultNS: 'common'`, `ns: ['common','editor','schedules','web','domain']`, `interpolation: { escapeValue: false }`, `returnNull: false`, `resources: options.resources ?? {}`, `saveMissing: false`, `missingKeyHandler` yalnız `NODE_ENV !== 'production'` iken `console.warn`.

- [ ] **Step 5: Testin geçtiğini doğrula**

Run: `npx jest packages/bim-ui/__tests__/i18n-core.test.tsx -v`
Expected: PASS (3 test).

- [ ] **Step 6: `I18nProvider` + `useT` + `common.json` ekle ve provider testini yaz**

```tsx
// ayrı test: packages/bim-ui/__tests__/i18n-provider.test.tsx
test("useT returns the active language's string and re-renders on change", () => { /* render provider tr, assert "Merhaba"; setLanguage('en'); assert "Hello" */ });
```

Provider, mevcut `theme-provider.tsx` desenini izler: React context + `useMutinyLanguage()`; `setLanguage` çağrısı `i18n.changeLanguage` yapar ve `onLanguageChange`'i tetikler; `document.documentElement.lang` güncellenir.

- [ ] **Step 7: Tüm `bim-ui` testlerini çalıştır**

Run: `npx jest packages/bim-ui -v`
Expected: PASS (mevcut theme testleri dahil, hepsi yeşil).

- [ ] **Step 8: Commit**

```bash
git add package.json packages/bim-ui
git commit -m "feat(i18n): i18next core, provider and useT in bim-ui"
```

### Task 1.2: Sayı/tarih biçimlendirme (`format.ts`)

**Files:**
- Create: `packages/bim-ui/src/i18n/format.ts`
- Test: `packages/bim-ui/__tests__/i18n-format.test.ts`

**Interfaces:**
- Consumes: `MutinyLanguage` (Task 1.1)
- Produces:
  - `formatNumber(value: number, language: MutinyLanguage, options?: Intl.NumberFormatOptions): string`
  - `formatQuantity(value: number, unit: string, language: MutinyLanguage): string` — sayı + boşluk + birim sembolü (sembol çevrilmez)
  - `formatDate(value: Date | number, language: MutinyLanguage, options?: Intl.DateTimeFormatOptions): string`
  - `separatorsFor(language: MutinyLanguage): { decimal: string; thousands: string }` — `bim-units` `DisplayProfile`'a beslenmek üzere

- [ ] **Step 1: Başarısız testi yaz**

```ts
// packages/bim-ui/__tests__/i18n-format.test.ts
import { formatNumber, formatQuantity, separatorsFor } from "../src/i18n/format";

test("tr uses comma decimal and dot thousands", () => {
  expect(formatNumber(12345.67, "tr")).toBe("12.345,67");
});
test("en keeps dot decimal and comma thousands", () => {
  expect(formatNumber(12345.67, "en")).toBe("12,345.67");
});
test("separatorsFor returns the profile values for tr", () => {
  expect(separatorsFor("tr")).toEqual({ decimal: ",", thousands: "." });
});
test("formatQuantity never translates the unit symbol", () => {
  expect(formatQuantity(12.5, "kVA", "tr")).toBe("12,5 kVA");
});
test("formatQuantity keeps CFM untranslated in tr", () => {
  expect(formatQuantity(400, "CFM", "tr")).toBe("400 CFM");
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx jest packages/bim-ui/__tests__/i18n-format.test.ts -v`
Expected: FAIL — module not found.

- [ ] **Step 3: `format.ts` uygula**

`Intl.NumberFormat`/`Intl.DateTimeFormat` kullan (`tr-TR`, `en-US` yerelleri); `separatorsFor` `Intl.NumberFormat(locale).formatToParts(1234.5)` üzerinden `decimal`/`group` karakterlerini okur (sabit string yazılmaz — sözlük §7 kuralı: sembol çevrilmez, biçim yerelleşir).

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `npx jest packages/bim-ui/__tests__/i18n-format.test.ts -v`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add packages/bim-ui/src/i18n/format.ts packages/bim-ui/__tests__/i18n-format.test.ts
git commit -m "feat(i18n): locale-aware number, date and quantity formatting"
```

### Task 1.3: `LanguageToggle` ve kalıcı tercih

**Files:**
- Create: `packages/bim-ui/src/language-toggle.tsx`
- Create: `packages/bim-ui/src/i18n/persistence.ts`
- Modify: `packages/bim-ui/src/index.ts` (export)
- Test: `packages/bim-ui/__tests__/language-toggle.test.tsx`
- Test: `packages/bim-ui/__tests__/i18n-persistence.test.ts`

**Interfaces:**
- Consumes: `useMutinyLanguage` (1.1), `ToggleGroup` (`ui/toggle-group.tsx`), `Tooltip`
- Produces:
  - `<LanguageToggle className?, "data-testid"?>` — `ThemeToggle` ile aynı görsel desen; `presentation === 'embedded'` ise `null` döner (ThemeToggle ile aynı kural)
  - `readLanguagePreference(storage: Storage | undefined): MutinyLanguage | undefined`
  - `writeLanguagePreference(storage: Storage | undefined, language: MutinyLanguage): void`
  - `resolveInitialLanguage(input: { account?: MutinyLanguage; stored?: MutinyLanguage; navigator?: string }): MutinyLanguage` — sıra: account → stored → navigator → 'en'

- [ ] **Step 1: `resolveInitialLanguage` için başarısız test yaz**

```ts
// packages/bim-ui/__tests__/i18n-persistence.test.ts
import { resolveInitialLanguage } from "../src/i18n/persistence";

test("account preference wins over stored and navigator", () => {
  expect(resolveInitialLanguage({ account: "tr", stored: "en", navigator: "en-US" })).toBe("tr");
});
test("stored wins when there is no account preference", () => {
  expect(resolveInitialLanguage({ stored: "tr", navigator: "en-US" })).toBe("tr");
});
test("navigator tr-* resolves to tr", () => {
  expect(resolveInitialLanguage({ navigator: "tr-TR" })).toBe("tr");
});
test("unknown navigator falls back to en", () => {
  expect(resolveInitialLanguage({ navigator: "de-DE" })).toBe("en");
  expect(resolveInitialLanguage({})).toBe("en");
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx jest packages/bim-ui/__tests__/i18n-persistence.test.ts -v`
Expected: FAIL — module not found.

- [ ] **Step 3: `persistence.ts` uygula**

`STORAGE_KEY = 'mutiny.lang'`. `readLanguagePreference` `isMutinyLanguage` ile doğrular (bozuk değer → `undefined`). `resolveInitialLanguage` §7/Ç-E sırasını uygular: `navigator` yalnız `startsWith('tr')` ise `'tr'`, aksi hâlde `'en'`.

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `npx jest packages/bim-ui/__tests__/i18n-persistence.test.ts -v`
Expected: PASS (4 test).

- [ ] **Step 5: `LanguageToggle` için başarısız test yaz**

```tsx
// packages/bim-ui/__tests__/language-toggle.test.tsx
test("renders EN and TR options and marks the active one", () => { /* provider tr → TR item has aria-checked/data-state active */ });
test("clicking TR calls setLanguage('tr')", () => { /* fireEvent → spy onLanguageChange called with 'tr' */ });
test("renders nothing when embedded", () => { /* presentation embedded → container empty */ });
test("every visible label is translated in tr", () => { /* aria-labels differ between en and tr render */ });
```

- [ ] **Step 6: `LanguageToggle` uygula**

`ThemeToggle` dosyasını birebir desen alır: `OPTIONS = [{value:'en',label:'English'},{value:'tr',label:'Türkçe'}]`, `ToggleGroup type="single"`, boş string (`""`) gelirse yok say, `aria-label={t('language.label','Language')}`, item test id'leri `mutiny-language-en` / `mutiny-language-tr`. Sözlük: `language.label` → `Dil`, `language.english` → `English`, `language.turkish` → `Türkçe` (dil adları kendi dilinde yazılır — çevrilmez).

- [ ] **Step 7: Testin geçtiğini doğrula**

Run: `npx jest packages/bim-ui/__tests__/language-toggle.test.tsx -v`
Expected: PASS (4 test).

- [ ] **Step 8: `index.ts`'e export ekle ve tüm paketi doğrula**

Run: `npx jest packages/bim-ui -v && npx tsc -p packages/tsconfig.bim.json --noEmit`
Expected: PASS, tip hatası yok.

- [ ] **Step 9: Commit**

```bash
git add packages/bim-ui
git commit -m "feat(i18n): LanguageToggle and persisted language preference"
```

### Task 1.4: Guard testleri (parity + sözlük)

**Files:**
- Create: `packages/bim-ui/__tests__/i18n-parity.test.ts`
- Create: `packages/bim-ui/__tests__/i18n-glossary.test.ts`

**Interfaces:**
- Consumes: paketlerdeki `locales/tr/*.json` dosyaları
- Produces: koruyucu testler — her yeni çeviri görevinde koşar

- [ ] **Step 1: Parity testini yaz**

```ts
// packages/bim-ui/__tests__/i18n-parity.test.ts
// Walk every packages/*/locales/tr/*.json and apps/*/locales/tr/*.json.
// Assert: (a) valid JSON, (b) no key whose value equals its key,
// (c) no value containing the literal placeholder-less failure strings
//     'undefined', 'null', or an untranslated '{' artifact.
test("every tr locale file is valid and fully translated", () => { /* glob + assert */ });
test("no tr value equals its own key", () => { /* guard against key-as-value accidents */ });
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx jest packages/bim-ui/__tests__/i18n-parity.test.ts -v`
Expected: FAIL — glob bulunamadı ya da `common.json` henüz boş olduğu için ilk assert düşer.

- [ ] **Step 3: Sözlük lint testini yaz**

```ts
// packages/bim-ui/__tests__/i18n-glossary.test.ts
// Read docs/i18n/glossary.md §9 forbidden mappings and assert tr locales obey them.
test("tr never renders a plural suffix after a number", () => {
  // forbid /\d+\s+\w+lar\b|\d+\s+\w+ler\b/ patterns such as "3 elemanlar"
});
test("space is translated as mekan, never alan (§2.3)", () => {
  // the tr value for any key matching /space/i must not contain "alan"
});
test("sheet is translated as pafta, never tablo (§2.4)", () => {
  // any key matching /sheet/i must not contain "tablo"
});
```

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `npx jest packages/bim-ui/__tests__/i18n-glossary.test.ts -v`
Expected: PASS (henüz çeviri az olduğu için boş küme üzerinde geçer; ileride ihlal yakalar).

- [ ] **Step 5: Tüm guard'ları ve tüm repoyu doğrula**

Run: `npx jest packages/bim-ui -v && npx jest 2>&1 | tail -20`
Expected: bim-ui yeşil; repo genelinde bu değişiklikten kaynaklı kırılma yok.

- [ ] **Step 6: Commit**

```bash
git add packages/bim-ui/__tests__/i18n-parity.test.ts packages/bim-ui/__tests__/i18n-glossary.test.ts
git commit -m "test(i18n): locale parity and glossary guard tests"
```

### Task 1.5: Aşama inceleme paketi üreteci

**Files:**
- Create: `tools/i18n/review-bundle.mjs`
- Modify: `package.json` (`scripts.i18n:review`)
- Test: `tools/i18n/__tests__/review-bundle.test.mjs`

**Interfaces:**
- Produces: `npm run i18n:review` → `docs/i18n/review/<tarih>-stage-<N>.md` — ekran/grup başına `EN` ve `TR` yan yana tablo (kullanıcının aşama sonunda gözden geçirdiği çıktı, Ç-H/(a))

- [ ] **Step 1: Başarısız testi yaz**

```js
// tools/i18n/__tests__/review-bundle.test.mjs
test("bundle lists every key with its en default and tr value", () => { /* fixture iki dosya → çıktı iki satır içerir */ });
test("bundle marks untranslated keys explicitly", () => { /* tr eksik → satırda '⚠️ eksik' */ });
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx jest tools/i18n/__tests__/review-bundle.test.mjs -v`
Expected: FAIL — script yok.

- [ ] **Step 3: Betiği uygula**

Girdi: `packages/*/locales/tr/*.json` + `apps/*/locales/tr/*.json`. Anahtar yolunu (`editor.ribbon.merge`) ve TR değerini yazar; İngilizce `defaultValue`'yu kaynak dosyadan `grep` ile bulur (`t('<anahtar>', '<İngilizce>')` deseni). Eksik olanları **⚠️ eksik** olarak işaretler (sessizce atlamaz — Global Constraint "kapsam ölçülür ve raporlanır").

- [ ] **Step 4: Testin geçtiğini doğrula ve betiği çalıştır**

Run: `npx jest tools/i18n/__tests__/review-bundle.test.mjs -v && npm run i18n:review`
Expected: PASS; `docs/i18n/review/` altında rapor üretilir.

- [ ] **Step 5: Commit**

```bash
git add tools/i18n package.json docs/i18n/review
git commit -m "feat(i18n): per-stage TR/EN review bundle generator"
```

---

## Aşama 2 — Hosted app

### Task 2.1: `pages.tsx` çevirisi + sunucu tarafı dil çözümü

**Files:**
- Create: `apps/mutinybim-web/locales/tr/web.json`
- Create: `apps/mutinybim-web/src/i18n.ts` (sunucu: çerez → dil, `t` sağlar)
- Modify: `apps/mutinybim-web/src/pages.tsx`
- Modify: `apps/mutinybim-web/src/app.ts` (dil çerezini çöz, `pageData.language` ekle)
- Test: `apps/mutinybim-web/__tests__/i18n-language-cookie.test.ts`

**Interfaces:**
- Consumes: `createI18n`, `resolveInitialLanguage`, `MutinyLanguage` (Task 1.1/1.3)
- Produces:
  - `resolveRequestLanguage(req: { cookies: Record<string,string>; user?: { language?: string }; header: (n: string) => string | undefined }): MutinyLanguage`
  - `tFor(language: MutinyLanguage): TFunction` (sunucu tarafı, istek başına)
  - `pageData.language: MutinyLanguage`

- [ ] **Step 1: `resolveRequestLanguage` için başarısız test yaz**

```ts
// çerez > hesap > Accept-Language > en  sırası
test("language cookie wins", ...);
test("account language wins when no cookie", ...);
test("accept-language tr is honoured", ...);
test("defaults to en", ...);
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx jest apps/mutinybim-web/__tests__/i18n-language-cookie.test.ts -v`
Expected: FAIL — module not found.

- [ ] **Step 3: `resolveRequestLanguage` + `tFor` uygula**

`COOKIE_NAME = 'mutiny.lang'`; çerez değeri `isMutinyLanguage` ile doğrulanır; geçersizse yok sayılır (asla throw etmez).

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `npx jest apps/mutinybim-web/__tests__/i18n-language-cookie.test.ts -v`
Expected: PASS (4 test).

- [ ] **Step 5: `pages.tsx` metinlerini `t(...)`'e çevir**

Her kullanıcı metni `t('<bölüm>.<ad>', '<mevcut İngilizce>')` olur. `locales/tr/web.json` Türkçesini alır. `documents.empty`, `documents.missing`, `vocabulary`, `labelWithHint` gözden geçirilir (sözlük §1–§6 uygulanır). **İngilizce metinler birebir korunur.**

- [ ] **Step 6: Sayfa testini yaz ve koştur**

```ts
test("landing page renders Turkish when the cookie says tr", ...);
test("landing page renders English by default", ...);
```

Run: `npx jest apps/mutinybim-web -v`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mutinybim-web
git commit -m "feat(i18n): hosted app pages bilingual, server-side language resolution"
```

### Task 2.2: Header/nav + ayarlarda dil bölümü

**Files:**
- Modify: `apps/mutinybim-web/src/ui.tsx` (Header, nav, `SchemeToggle` yanına `LanguageToggle`)
- Modify: `apps/mutinybim-web/src/pages.tsx` (`settingsPage()` dil bölümü)
- Modify: `apps/mutinybim-web/locales/tr/web.json`
- Test: `apps/mutinybim-web/__tests__/i18n-header.test.ts`

**Interfaces:**
- Consumes: `LanguageToggle` (1.3), `tFor` (2.1)
- Produces: nav etiketleri iki dilli; ayarlarda kalıcı dil seçimi (POST → `users.language`)

- [ ] **Step 1: Başarısız testi yaz**

```ts
test("header nav labels are Turkish when language is tr", ...);
test("settings page offers both languages and shows the current one", ...);
test("posting a language updates the account preference", ...);
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx jest apps/mutinybim-web/__tests__/i18n-header.test.ts -v`
Expected: FAIL.

- [ ] **Step 3: Header + ayar bölümünü uygula**

`LanguageToggle` `SchemeToggle`'ın yanına (`ui.tsx`); ayarlarda radyo/`ToggleGroup` + form POST; `users.language` kolonu eklenir (`db.ts` mevcut `color_scheme` desenine paralel) ve çerez de yazılır (sunucu ilk boyamada doğru dili versin — §7/Ç-D).

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `npx jest apps/mutinybim-web -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mutinybim-web
git commit -m "feat(i18n): header language toggle and account language setting"
```

### Task 2.3: Route handler metinleri (flash + hata)

**Files:**
- Modify: `apps/mutinybim-web/src/app.ts` (~50 literal: `:289`, `:312`, `:343`, `:363` ve benzerleri)
- Modify: `apps/mutinybim-web/src/models.ts`, `apps/mutinybim-web/src/oauth.ts`
- Modify: `apps/mutinybim-web/locales/tr/web.json`
- Test: `apps/mutinybim-web/__tests__/i18n-route-messages.test.ts`

**Interfaces:**
- Consumes: `tFor` (2.1)
- Produces: tüm flash/hata metinleri istek diliyle üretilir

- [ ] **Step 1: Başarısız testi yaz**

```ts
test("expired sign-in link message is Turkish when the request language is tr", ...);
test("password-too-short message is Turkish", ...);
test("rate-limit message is Turkish", ...);
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx jest apps/mutinybim-web/__tests__/i18n-route-messages.test.ts -v`
Expected: FAIL.

- [ ] **Step 3: Route handler'ları çevir**

Her handler isteğin dilini `resolveRequestLanguage` ile çözer, metinleri `tFor(language)(...)` ile üretir. Çeviri anahtarları `web:<bölüm>.<ad>`; parametreler i18next interpolasyonu (`{{max}}`) ile.

- [ ] **Step 4: Testin geçtiğini doğrula + inceleme paketini üret**

Run: `npx jest apps/mutinybim-web -v && npm run i18n:review`
Expected: PASS; `docs/i18n/review/` altında Aşama 2 raporu.

- [ ] **Step 5: Commit**

```bash
git add apps/mutinybim-web
git commit -m "feat(i18n): bilingual route handler flash and error messages"
```

---

## Aşama 3 — Editör çerçevesi

### Task 3.1: Ribbon sekmeleri ve grupları

**Files:**
- Create: `packages/bim-editor/locales/tr/editor.json`
- Modify: `packages/bim-editor/src/editor/building-model-ribbon.ts` (etiketler anahtarlanır)
- Modify: `packages/bim-editor/src/editor/ribbon/*` (sekme/grup render)
- Test: `packages/bim-editor/__tests__/i18n-ribbon.test.tsx`

**Interfaces:**
- Consumes: `useT` (1.1)
- Produces: `t('ribbon.model','Model')` vb.; sekme ve grup adları iki dilli

- [ ] **Step 1: Başarısız testi yaz**

```tsx
test("ribbon tabs render Turkish labels when language is tr", ...); // 'Model' → 'Model', 'Views' → 'Görünümler', 'Sheets' → 'Paftalar', 'Manage' → 'Yönet'
test("English labels are unchanged", ...);
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx jest packages/bim-editor/__tests__/i18n-ribbon.test.tsx -v`
Expected: FAIL.

- [ ] **Step 3: Etiketleri anahtarla ve çevir**

Sözlük §4 sekmeleri birebir: Model · Görünümler · Paftalar · Yönet · Açıklama · Değiştir · Parça · Seçim · Dal · Güzergâh · Plan · Çizelgeler · Hızlı. Ticari sekme bölümleri: Seç · Oluştur · Bağla · Analiz · Tasarım · Belgeler.

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `npx jest packages/bim-editor/__tests__/i18n-ribbon.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bim-editor
git commit -m "feat(i18n): bilingual ribbon tabs and groups"
```

### Task 3.2: Yan paneller ve durum çubuğu

**Files:**
- Modify: `packages/bim-editor/src/editor/` — dock panel başlıkları (`Properties`, `Views and sheets`, `Parts`, `Spaces`, `Schedules`, `Questions`, `Submittals`, `Change orders`, `Versions`, `Responsibilities`, `Coordination findings`, `Linked models`, `Design limits`, `Add-ons`, `History`, `Price book`, `Checklist`, `Copies`, `Revisions`, `Title blocks`, `Notes legend`, `Panel view`, `Panel schedule`)
- Modify: `packages/bim-editor/locales/tr/editor.json`
- Test: `packages/bim-editor/__tests__/i18n-panels-chrome.test.tsx`

**Interfaces:**
- Consumes: `useT` (1.1)
- Produces: panel başlıkları + durum çubuğu iki dilli

- [ ] **Step 1: Başarısız testi yaz**

```tsx
test("dock panel titles are Turkish when language is tr", ...); // 'Properties' → 'Özellikler', 'Schedules' → 'Çizelgeler'
test("status bar connection states are Turkish", ...); // 'Connected. All changes saved' → 'Bağlandı. Tüm değişiklikler kaydedildi'
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx jest packages/bim-editor/__tests__/i18n-panels-chrome.test.tsx -v`
Expected: FAIL.

- [ ] **Step 3: Uygula**

Sözlük §4 panelleri + §8 durum sözlüğü birebir uygulanır.

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `npx jest packages/bim-editor/__tests__/i18n-panels-chrome.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bim-editor
git commit -m "feat(i18n): bilingual dock panels and status bar"
```

### Task 3.3: Operatör mesajları, boş durumlar, hata kodları

**Files:**
- Modify: `packages/bim-editor/src/editor/operator-messages.ts` (18 kod)
- Modify: boş durum/diyalog metinleri (`Nothing yet`, `None yet`, `Not set`, `Mixed phases`)
- Modify: `packages/bim-editor/locales/tr/editor.json`
- Test: `packages/bim-editor/__tests__/i18n-operator-messages.test.ts`

**Interfaces:**
- Consumes: `useT` (1.1)
- Produces: `operatorMessage(code, t)` — 18 kodun Türkçesi; boş durumlar iki dilli

- [ ] **Step 1: Başarısız testi yaz**

```ts
test("every operator message code has a Turkish string", ...); // 18 kodun tamamı dolu, eksik yok
test("no operator message falls back to English in tr", ...);
test("empty state strings are Turkish", ...);
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx jest packages/bim-editor/__tests__/i18n-operator-messages.test.ts -v`
Expected: FAIL.

- [ ] **Step 3: Uygula**

§8 durum/hata sözlüğü birebir. `no-level` → "Önce bir kat ekleyin", `no-part` → "Bir parça seçin", `route-size` → "Önce boyutu düzeltin", `read-only` → "Salt okunur", `paused` → "Duraklatıldı", `no-model-view` → "Önce bu paftada bir plan açın".

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `npx jest packages/bim-editor/__tests__/i18n-operator-messages.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bim-editor
git commit -m "feat(i18n): bilingual operator messages and empty states"
```

### Task 3.4: Kernel/pack cümle şablonları (Ç-A/(iii))

**Files:**
- Create: `tools/i18n/extract-prose.mjs` (şablon çıkarıcı)
- Create: `packages/bim-ui/src/i18n/prose.ts` (normalizer + lookup)
- Create: `packages/bim-ui/locales/tr/prose.json` (şablon → TR)
- Modify: mesaj gösterim noktaları (`packages/bim-editor/src/editor/model-session.ts:2166,2173,2217`, diyaloglar)
- Test: `packages/bim-ui/__tests__/i18n-prose.test.ts`
- Test: `tools/i18n/__tests__/extract-prose.test.mjs`

**Interfaces:**
- Produces:
  - `normalizeProse(english: string): { template: string; slots: string[] }` — sayıları/birimleri `{0}`,`{1}`… ile değiştirir
  - `translateProse(english: string, language: MutinyLanguage, t: TFunction): string` — şablon bulunursa TR (slotlar doldurulur), bulunmazsa `english` aynen
  - `npm run i18n:prose:extract` → `docs/i18n/prose-templates.json` (kapsam raporu)
- **Algoritma (imza ve testler belirlemiyor, bu yüzden açık):**
  1. `normalizeProse` içinde sırayla: tarih/saat kalıpları → uzunluk/birim sayıları (`/[\d.,]+\s*(?:mm|cm|m|km|in|ft|yd|ft²|m²|m³|L|gal|kg|lb|s|min|h|°|°C|°F|A|V|W|kW|VA|kVA|Pa|kPa|psi|CFM|L\/s|m³\/h|gpm|fpm)/gi`) → çıplak sayılar (`/-?\d+(?:[.,]\d+)?/g`) sırayla `{0}`, `{1}`… ile değiştirilir; orijinal metinler `slots`'a sırayla konur.
  2. `translateProse` çeviride `{0}`… yer tutucularını `slots` ile doldurur; sıra korunur.
  3. Şablon yoksa `english` döner — **asla** anahtar/şablon adı gösterilmez.

- [ ] **Step 1: Normalizer için başarısız test yaz**

```ts
// packages/bim-ui/__tests__/i18n-prose.test.ts
import { normalizeProse, translateProse } from "../src/i18n/prose";

test("normalizeProse replaces numbers and units with ordered slots", () => {
  const { template, slots } = normalizeProse("Leg 3 is 0.51 ft long, but the elbow and transition there need 1.27 ft");
  expect(template).toBe("Leg {0} is {1} long, but the elbow and transition there need {2}");
  expect(slots).toEqual(["3", "0.51 ft", "1.27 ft"]);
});

test("translateProse fills slots in order", () => {
  const tr = { "Leg {0} is {1} long, but the elbow and transition there need {2}": "{0}. bacak {1} uzunluğunda, ama oradaki dirsek ve geçiş {2} gerektiriyor" };
  expect(translateProse("Leg 3 is 0.51 ft long, but the elbow and transition there need 1.27 ft", "tr", fakeT(tr)))
    .toBe("3. bacak 0.51 ft uzunluğunda, ama oradaki dirsek ve geçiş 1.27 ft gerektiriyor");
});

test("an unknown sentence is returned unchanged, never as a template key", () => {
  const english = "Something nobody translated";
  expect(translateProse(english, "tr", fakeT({}))).toBe(english);
});

test("English input is returned verbatim for language en", () => {
  expect(translateProse("Anything at all", "en", fakeT({}))).toBe("Anything at all");
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula**

Run: `npx jest packages/bim-ui/__tests__/i18n-prose.test.ts -v`
Expected: FAIL — module not found.

- [ ] **Step 3: `prose.ts` uygula**

Yukarıdaki algoritma. `normalizeProse` birim listesini uzunluk sırasına göre dener (`ft²` `ft`'den önce) ki kısa birim uzun olanı yutmasın.

- [ ] **Step 4: Testin geçtiğini doğrula**

Run: `npx jest packages/bim-ui/__tests__/i18n-prose.test.ts -v`
Expected: PASS (4 test).

- [ ] **Step 5: Çıkarıcı betiği yaz ve test et**

```js
// tools/i18n/__tests__/extract-prose.test.mjs
test("extractor finds message literals and emits unique normalized templates", ...);
test("extractor reports a coverage count", ...);
```

Betik `packages/bim-kernel/src/**` ve `packages/bim-pack-*/src/**` içinde `message:` / `text:` / `problem:` literallerini tarar, `normalizeProse` ile şablonlaştırır, tekilleştirir, `docs/i18n/prose-templates.json`'a yazar (`{ template, count, sources[] }`).

Run: `npx jest tools/i18n/__tests__/extract-prose.test.mjs -v && npm run i18n:prose:extract`
Expected: PASS; `prose-templates.json` üretilir, toplam şablon sayısı raporlanır.

- [ ] **Step 6: Ekrana en çok ulaşan şablonları çevir**

`docs/i18n/prose-templates.json`'ı `count`/`sources` ile sırala; **18 operatör kodunun arkasındaki mesajlar + kernel reddetmeleri + yaygın lint bulguları** için TR yaz, `packages/bim-ui/locales/tr/prose.json`'a ekle. Kuyruk çevrilmez; kapsam `npm run i18n:review` raporunda **ölçülü** olarak görünür (Global Constraint: kapsam ölçülür ve raporlanır).

- [ ] **Step 7: Gösterim noktalarını bağla**

`model-session.ts:2166,2173,2217` ve diyalog mesajlarında `res.error.message` / `outcome.error.message` yerine `translateProse(message, language, t)` kullanılır. Kernel değişmez.

- [ ] **Step 8: Doğrula**

Run: `npx jest packages/bim-ui packages/bim-editor -v && npm run i18n:review`
Expected: PASS; kapsam raporu üretilir.

- [ ] **Step 9: Commit**

```bash
git add tools/i18n packages/bim-ui packages/bim-editor docs/i18n
git commit -m "feat(i18n): kernel and pack prose translation via template normalization"
```

---

## Aşama 4 — Editör panelleri

> Her görev aynı desende: metinleri `t()`'e çevir, `locales/tr/editor.json`'a TR yaz, sözlük uygula, test yaz, doğrula, commit. Aşağıda her görevin **kapsamı ve test adları** verilmiştir; gövde tekrarı yoktur.

### Task 4.1: Çizelgeler, hesap sayfaları, `bim-schedules-ui`

**Files:**
- Modify: `packages/bim-editor/src/editor/schedules/**`, `packages/bim-editor/src/editor/calc-sheets/**`
- Modify: `packages/bim-schedules-ui/src/**` (ScheduleGrid, ScheduleBuilder, LibraryBrowser, NewFieldForm, SaveToLibrary, ScheduleColumnsSheet), `packages/bim-schedules-ui/locales/tr/schedules.json`
- Test: `packages/bim-editor/__tests__/i18n-schedules.test.tsx`, `packages/bim-schedules-ui/__tests__/i18n-schedules-ui.test.tsx`

**Interfaces:**
- Consumes: `useT` (1.1)
- Produces: §5 alan adları + toplam seçenekleri (`sum/max/min/none` → **toplam/azami/asgari/yok**) iki dilli

- [ ] **Testler:** `test("schedule field labels are Turkish", …)`, `test("roll-up options are Turkish", …)`, `test("cost code header is Turkish", …)`, `test("English labels are unchanged", …)`
- [ ] **Uygula** → **Doğrula:** `npx jest packages/bim-editor packages/bim-schedules-ui -v` → **Commit:** `feat(i18n): bilingual schedules and calc sheets`

### Task 4.2: Görünümler, paftalar, notlar, yönlendirme

**Files:**
- Modify: `packages/bim-editor/src/editor/views-sheets/**`, `orientation/**`, `diagrams/**`
- Test: `packages/bim-editor/__tests__/i18n-views-sheets.test.tsx`

- [ ] **Testler:** `test("sheet and title block labels are Turkish", …)` (pafta/antet), `test("view crop and orientation labels are Turkish", …)`, `test("detail level reads detay seviyesi, not kat", …)` (sözlük Ç6)
- [ ] **Uygula** → **Doğrula:** `npx jest packages/bim-editor -v` → **Commit:** `feat(i18n): bilingual views, sheets, notes and orientation`

### Task 4.3: MEP panelleri

**Files:**
- Modify: `packages/bim-editor/src/editor/{electrical,plumbing,ventilation,balance,loads}/**`
- Test: `packages/bim-editor/__tests__/i18n-mep.test.tsx`

- [ ] **Testler:** `test("panel view reads pano, and UI panel reads panel", …)` (Ç7), `test("branch reads branşman in MEP context", …)` (Ç8), `test("run reads hat in MEP context", …)` (Ç9), `test("unit symbols are never translated", …)` (`kVA`, `CFM`, `fpm` aynen kalır)
- [ ] **Uygula** → **Doğrula:** `npx jest packages/bim-editor -v` → **Commit:** `feat(i18n): bilingual MEP panels`

### Task 4.4: Proje yönetimi panelleri

**Files:**
- Modify: `packages/bim-editor/src/editor/{parts-list,equipment-list,library,change-orders,signing,versions,merge,submittals,questions,coordination,settings,levels,spaces,ifc-import,ifc-export}/**`
- Test: `packages/bim-editor/__tests__/i18n-project-panels.test.tsx`

- [ ] **Testler:** `test("submittal panels read imalat onayı", …)` (Ç19), `test("change order reads değişiklik emri", …)`, `test("space reads mekan, never alan", …)` (Ç3/sözlük §2.3), `test("every panel title is translated", …)`
- [ ] **Uygula** → **Doğrula:** `npx jest packages/bim-editor -v && npm run i18n:review` → **Commit:** `feat(i18n): bilingual project management panels`

---

## Aşama 5 — Domain etiketleri ve tema temizliği

### Task 5.1: Domain etiket haritası (~1333)

**Files:**
- Create: `packages/bim-ui/locales/tr/domain.json`
- Create: `packages/bim-ui/src/i18n/domain.ts` — `translateDomainLabel(label: string, t: TFunction): string`
- Modify: `packages/bim-editor/src/editor/build*` ve pack UI render noktaları (etiketlerin gösterildiği yerler)
- Test: `packages/bim-ui/__tests__/i18n-domain.test.ts`

**Interfaces:**
- Produces: `translateDomainLabel(label, t)` — `t('domain.<normalized>', label)`; `normalized` = küçük harf, boşluk/noktalama → `_`
- **Pack dosyaları değişmez** (§7/Ç-B kararı).

- [ ] **Step 1: Başarısız test yaz**

```ts
test("a known discipline label is Turkish", ...);       // 'Electrical' → 'Elektrik'
test("a quantity kind is Turkish", ...);                 // 'Airflow' → 'Hava debisi'
test("an unknown label returns the English label unchanged", ...);
test("labels are keyed case- and punctuation-insensitively", ...); // 'Fire protection' ve 'fire-protection' aynı anahtar
```

- [ ] **Step 2: FAIL doğrula** → Run: `npx jest packages/bim-ui/__tests__/i18n-domain.test.ts -v`

- [ ] **Step 3: `domain.ts` + `domain.json` uygula**

Sözlük §1 (disiplinler), §5 (miktar türleri), §2 (kavramlar) birebir.

- [ ] **Step 4: PASS doğrula** → `npx jest packages/bim-ui -v`

- [ ] **Step 5: Render noktalarını bağla** → disiplin sekmeleri, miktar türü seçicileri, pack alan etiketleri `translateDomainLabel` kullanır.

- [ ] **Step 6: Doğrula + inceleme paketi** → `npx jest -v && npm run i18n:review`

- [ ] **Step 7: Commit** → `feat(i18n): bilingual domain labels for disciplines and quantity kinds`

### Task 5.2: Tema ihlali temizliği

**Files:**
- Modify: `packages/bim-viewer/src/viewer.css` (35 hex → `--mutiny-*`)
- Modify: `packages/bim-schedules-ui/src/schedules.css` (34 hex fallback → `var(--mutiny-*)` temiz fallback)
- Modify: `packages/bim-editor/src/editor/schedules/ModelSchedulePane.tsx:26` (`PRESENCE_COLORS`), `ui/chart.tsx:55`, `levels/use-level-planes.ts:36`
- Modify: `apps/mutinybim-web/src/app.ts:674` (inline `color:#5d6670`)
- Test: `packages/bim-ui/__tests__/theme-token-compliance.test.ts`

**Interfaces:**
- Produces: hiçbir `.css`/`.tsx` içinde tema kaynağı (`theme.ts`, `color-scheme.ts`) dışında hex renk yok

- [ ] **Step 1: Başarısız testi yaz**

```ts
// packages/bim-ui/__tests__/theme-token-compliance.test.ts
test("no hex colours outside the theme source of truth", () => {
  // glob packages/*/src/**/*.{css,tsx,ts} + apps/*/src/**
  // exclude packages/bim-ui/src/theme.ts and color-scheme.ts
  // fail listing file:line for every #[0-9a-f]{3,8}
});
test("no inline style colours in tsx", () => { /* forbid style={{ … color/backgroundColor/stopColor: '#… */ });
```

- [ ] **Step 2: FAIL doğrula** → Run: `npx jest packages/bim-ui/__tests__/theme-token-compliance.test.ts -v` (mevcut 73 ihlal listelenir)

- [ ] **Step 3: İhlalleri temizle**

`bim-viewer/viewer.css`: kendi `:root` paletini kaldır, `--mutiny-*` kullan (bu paket demo amaçlı ama kural istisnasız). `schedules.css`: hex fallback'leri kaldır. Editör'deki 3 hex: `PRESENCE_COLORS` tema değişkenlerine, `chart.tsx` `currentColor`/`var(--mutiny-*)`, `use-level-planes.ts` tema değişkeni. `app.ts:674` inline renk → sınıf/tema değişkeni.

- [ ] **Step 4: PASS doğrula** → `npx jest packages/bim-ui/__tests__/theme-token-compliance.test.ts -v`

- [ ] **Step 5: Işık ve karanlık temada gözle kontrol** (AGENTS.md kural 3)

Run: `npm run demo` → tarayıcıda tema geçişi; her iki dilde ekranları gez.
Expected: hiçbir ekranda okunmayan kontrast yok, hex sızıntısı yok.

- [ ] **Step 6: Tüm testler + inceleme paketi**

Run: `npx jest -v && npx tsc -p packages/tsconfig.bim.json --noEmit && npm run i18n:review`
Expected: hepsi yeşil; Aşama 5 raporu üretilir.

- [ ] **Step 7: Commit**

```bash
git add packages apps
git commit -m "fix(ui): replace hardcoded hex colours with theme tokens"
```

---

## Self-Review Notları

- **Spec kapsamı:** §6'daki 5 aşamanın tamamı görevlere eşlendi (Aşama 1 → 1.1–1.5, Aşama 2 → 2.1–2.3, Aşama 3 → 3.1–3.4, Aşama 4 → 4.1–4.4, Aşama 5 → 5.1–5.2). Ç-A (prose) → 3.4; Ç-B → 5.1; Ç-C → 1.2; Ç-D/Ç-E → 1.3 + 2.1; Ç-F → 2.3; Ç-H → 1.5.
- **Review Focus:** 5 girdi sınıfının her biri sahibi göreve bağlandı (1.5/1.1, 1.4, 1.3, 3.4, 1.2).
- **Tip tutarlılığı:** `MutinyLanguage` (1.1) → 1.2, 1.3, 2.1, 3.4, 5.1'de aynı adla kullanılır. `useT` (1.1) → 3.x, 4.x. `translateProse` (3.4), `translateDomainLabel` (5.1). `resolveRequestLanguage`/`tFor` (2.1) → 2.2, 2.3.
- **Aşama çıkışları ölçülebilir:** her aşama `npm run i18n:review` ile TR/EN inceleme listesi üretir (Ç-H/(a) gereği) ve kapsamı raporlar.
- **Kapsam dışı korundu:** yazdırma/PDF, MCP metinleri, e-posta — hiçbir görev bunlara dokunmaz.
