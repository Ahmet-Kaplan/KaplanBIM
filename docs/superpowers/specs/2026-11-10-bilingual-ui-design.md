# MutinyBIM İki Dilli Arayüz (EN/TR) — Tasarım Dokümanı

- **Tarih:** 2026-11-10
- **Durum:** **ONAYLANDI** (2026-11-10) — Ç-A: (iii) metin eşleme, Ç-H: (a) aşama sonu insan incelemesi
- **Bağlı belgeler:** `docs/i18n/glossary.md` (onaylandı — bağlayıcı terim kararları)

---

## 1. Niyet ve Neden

MutinyBIM arayüzü bugün **tamamen İngilizce ve tek dilli**. Hedef: tüm ekranların **İngilizce ve Türkçe** çalışması; kullanıcının dilini kendisi seçebilmesi ve seçimin kalıcı olması.

Neden şimdi: platform tek bir Türk inşaat firmasına kuruluyor (bkz. inşaat platformu tasarımı). Saha ve teknik ofis personeli Türkçe çalışıyor; İngilizce arayüz benimsenmeyi doğrudan düşürür. Aynı zamanda yazılım açık kaynak (Apache-2.0) — çeviri katmanı İngilizceyi bozmadan eklenmeli ki upstream ile uyum korunsun.

**Mevcut durum (ölçüldü):**

| Paket | Kaynak dosya | String içeren | Etiket/title/placeholder |
|-------|--------------|---------------|--------------------------|
| `bim-editor` | 632 | ~210 | ~759 |
| `bim-pack-*` (domain etiketleri) | — | — | ~1333 |
| `bim-schedules-ui` | 19 | ~6 | 67 |
| `apps/mutinybim-web` | 15 | 3 | 24 |
| `bim-ui` | 18 | ~1 | 3 |

Toplam **~2.000+ string**. Hiçbir i18n altyapısı yok (`i18next`, `react-intl`, `t()` çağrısı, locale dosyası yok). Metinler JSX içinde gömülü; bir kısmı modül sabiti (`CHILD_ROWS_NOT_EDITABLE`), bir kısmı veri (`ADDON_UI.label`).

---

## 2. Hedefler / Hedef Dışı / Anti-Hedefler

### Hedefler

1. Tüm kullanıcıya görünen metin `en` ve `tr` olarak iki dilde.
2. Dil seçimi: `LanguageToggle` bileşeni (mevcut `ThemeToggle`'ın yanında), kalıcı tercih (editörde `localStorage`, hosted app'te kullanıcı hesabı).
3. Türkçe sayı/tarih/birim biçimlendirme: SI birim sistemi varsayılan, `Intl` ile sayı biçimi.
4. Sözlüğe (`docs/i18n/glossary.md`) **uyulan** tutarlı terminoloji.
5. İngilizce davranış **birebir korunur** — mevcut `en` metinleri değişmez.
6. Eksik çeviri asla ham anahtar göstermez (`t('nav.models')` görünmez; İngilizceye düşer).

### Hedef dışı (non-goals)

- Üçüncü dil eklemek (altyapı hazır olur, çeviri yapılmaz).
- Paketlerin (`bim-pack-*`) iç mantığını çevirmek — yalnız görünen etiketler.
- Sunucu tarafı (SSR) sayfalarının çevirisi bu fazda: `mutinybim-web`'in sunucu-render sayfaları (`pages.tsx`) kapsamda, ama e-posta/PDF şablonları değil.
- Yazdırılan paftalar ve PDF'ler — bunlar siyah-beyaz, tema okumaz (AGENTS.md istisnası) ve İngilizce kalır.

### Anti-hedefler (teknik olarak çalışsa bile başarısızlık)

- Bir ekranda yarım Türkçe, yarım İngilizce (karışık dil) görünmesi.
- `tr` anahtarı eksik olduğunda arayüzde `nav.models` gibi ham anahtar görünmesi.
- Sözlükle çelişen çeviri (`space` → "alan" gibi) — terim tutarsızlığı.
- İngilizce arayüzün bozulması (regresyon).

---

## 3. Kısıtlar

1. **Katman kuralları korunur.** `docs/ARCHITECTURE.md`: her katman yalnız altındakini import eder; `packages/bim-kernel/src/__tests__/import-layers.test.ts` ihlali yakalar. i18n bağımlılığı **yalnız sunum katmanında** (katman 5: `bim-viewer`, `bim-ui`, `bim-editor`, `bim-schedules-ui`) ve uygulamalarda olabilir — kernel/units/geometry'ye giremez.
2. **Kernel'de metin yok.** `bim-kernel`, `bim-units`, `bim-formula`, `bim-geometry` çevrilebilir UI metni içermez; içerirlerse bu bir katman ihlalidir. Reddedilen komut mesajları (`refusals are in words`) — bunlar kernel'de üretiliyor mu, sunum katmanında mı çevrilmeli? **Karar gerekli** (§7/Ç-A).
3. **`--mutiny-*` tema kuralı** (AGENTS.md): yeni bileşen de tema değişkenlerini kullanır, hex renk yok.
4. **Test altyapısı:** repo `jest` kullanıyor (`jest.config.cjs`), `bim-editor`'da jest. Yeni i18n testleri mevcut koşucuya uyar.
5. **Bağımlılık disiplini:** `i18next` + `react-i18next` eklenecek. Repo `npm` workspaces kullanıyor; sürümler tek yerden.
6. **Sözlük bağlayıcı.** `docs/i18n/glossary.md` onaylandı; çeviri ona uyar.

---

## 4. Yaklaşımlar (değerlendirildi)
### A — i18next + react-i18next, anahtar başına İngilizce `defaultValue` **(SEÇİLDİ)**

Her string anahtarlanır; **İngilizce metin kod içinde `defaultValue` olarak kalır**, Türkçe ayrı sözlük dosyasında:

```tsx
const { t } = useTranslation('editor');
<Button>{t('ribbon.merge', 'Merge')}</Button>
```

- **Artı:** `en` tek doğruluk kaynağı ve kod incelemesinde görünür (ayrı `en.json` yok, senkron kayması yok). Anahtar eksikse İngilizce gösterilir — ham anahtar riski yok. Çoğul/ICU hazır. Namespace = paket.
- **Eksi:** Her çağrıda iki argüman; çeviri dosyası yalnız `tr.json`.

### B — Ayrı `en.json` + `tr.json`, `t('key')` tek argüman

- **Artı:** Temiz ayrım, çevirmene tam dosya. **Eksi:** İki dosya senkron tutulmalı; anahtar eksikse ham anahtar görünür. İngilizce metni kod içinde görememe.

### C — Gettext tarzı: İngilizce metin anahtar, yalnız TR sözlüğü

- **Artı:** En az kod değişikliği. **Eksi:** Metin değişince anahtar kırılır; çoğul/bağlam zayıf; uzun cümleler anahtar olarak kullanılamaz.

**Karar:** **A.** Uzun cümleler (reddetme mesajları) ve ~2000 anahtar için en düşük risk: İngilizce asla bozulmaz, eksik çeviri zarifçe düşer.

---

## 5. Mimari

```text
packages/bim-ui/
  src/i18n/
    index.ts            createI18n(): i18next örneği, dil algılama, fallback 'en'
    provider.tsx        <I18nProvider> (mevcut MutinyThemeProvider desenine paralel)
    use-t.ts            useT(namespace) ince sarmalayıcı
    format.ts           Intl sayı/tarih/birim biçimlendirme (yerel ayarlı)
  src/language-toggle.tsx   EN | TR seçici (theme-toggle.tsx yanına)
  locales/
    tr/common.json      ortak anahtarlar (kaydet, iptal, sil…)

packages/bim-editor/
  locales/tr/editor.json      editör string'leri
packages/bim-schedules-ui/
  locales/tr/schedules.json
apps/mutinybim-web/
  locales/tr/web.json
```

**Anahtar adlandırma:** `<bölüm>.<alt>.<ad>` — `ribbon.merge`, `panels.properties`, `errors.offline`, `fields.costCode`.

**Namespace = paket adı.** Paket kendi çevirisini taşır (monorepo özerkliği); `bim-ui` ortak `common` namespace'ini sağlar.

**Domain etiketleri (`ADDON_UI.label`, `disciplines.ts`, miktar türleri):** Bunlar **veri**, UI string'i değil. Karar (§7/Ç-B): paketlerde İngilizce tanımlayıcı **değişmez**; render anında `t('domain.<id>', label)` ile çözülür. Böylece paket mantığı hiç ellenmez, ~1333 etiket tek yerden çevrilir.

**Dil algılama ve kalıcılık:**
1. Kullanıcı tercihi varsa o (hosted app: hesap ayarı; editör: `localStorage['mutiny.lang']`).
2. Yoksa `navigator.language` (`tr-*` → `tr`).
3. Yoksa `en`.
`<html lang>` de güncellenir (erişilebilirlik + CSS `:lang()`).

**Eksik çeviri davranışı:** `fallbackLng: 'en'`; üretimde `saveMissing: false`; geliştirmede eksik anahtar uyarısı konsola düşer.

---

## 6. Aşamalar

Her aşama tek başına çalışır ve doğrulanır; yarım dilde ekran bırakmaz.

### Aşama 1 — Altyapı ve kabuk
`i18next`/`react-i18next` kurulumu, `bim-ui`'de `I18nProvider` + `useT` + `format.ts`, `LanguageToggle`, kalıcı tercih (editör `localStorage` + web kullanıcı ayarı), `<html lang>`, dil değiştirme testi. Çeviri: `bim-ui` (3 string) + ortak `common`.
**Çıkış:** Dil değiştirilebiliyor; kabuk metinleri iki dilde.

### Aşama 2 — Hosted app sayfaları
`apps/mutinybim-web/src/pages.tsx` + `ui.tsx`: landing, login, signup, terms, privacy, forgot, reset, "My models", share, settings, connect, approvals, quote, message. Ayarlar sayfasına **dil bölümü** eklenir.
**Çıkış:** Uygulama tamamen iki dilli.

### Aşama 3 — Editör çerçevesi
Ribbon sekmeleri/grupları, yan paneller, diyalog başlıkları, durum çubuğu, reddetme/hata mesajları (`operator-messages.ts`), boş durumlar.
**Çıkış:** Editörün kabuğu iki dilli; paneller Aşama 4'te.

### Aşama 4 — Editör panelleri
schedules, calc-sheets, views/sheets/notes, parts-list, equipment, loads, balance, ventilation, plumbing, electrical, branches, coordination, settings, levels, spaces, library, change-orders, signing, versions, merge, submittals, questions, diagrams, orientation, ifc-import/export. Ayrıca `bim-schedules-ui` (67 string).
**Çıkış:** Editör tamamen iki dilli.

### Aşama 5 — Domain etiketleri ve tema temizliği
`bim-pack-*` + `bim-units` miktar türleri + disiplin etiketleri (~1333) tek çeviri haritasından. Ardından **tema ihlalleri**: `bim-viewer/viewer.css` (35 hex), `bim-schedules-ui/schedules.css` (34 hex), `bim-editor` (3), `apps/mutinybim-web` (1).
**Çıkış:** Hiçbir kullanıcı metni İngilizce kalmadı; hex renk ihlalleri temizlendi.

---

## 7. Açık kalemler — kararlar

> Aşağıdaki Ç-A ve Ç-H **kullanıcı kararı** bekler; diğerleri builder kontrolü sonrası **benim kararım** olarak işaretlendi.

### Ç-A. Kernel ve pack'lerin ürettiği **cümleler** kapsamda mı? *(kullanıcı kararı — en önemli)*

Builder kontrolü, dokümandaki ilk varsayımımın eksik olduğunu gösterdi. Sorun yalnız "reddetme mesajları" değil:

- `CommandError` serbest İngilizce metin taşıyor (`bim-kernel/src/command-core.ts:40-45`) ve ekrana **olduğu gibi** ulaşıyor (`bim-editor/src/editor/model-session.ts:2166,2173,2217`).
- `docs/ARCHITECTURE.md:115` bu cümleleri **sayı içeren tam cümleler** olarak *zorunlu* kılıyor ("Leg 3 is 0.51 ft long, but…"). Yani bunlar parametreli cümleler — düz metin→TR eşlemesi **çalışmaz**.
- Ayrıca ~**1000** İngilizce cümle `bim-pack-*/src` içinde (plumbing 171, electrical 105, mechanical 27): lint bulguları, hesap sayfası adım açıklamaları, alan `problem`/`text` metinleri.
- Ve ~**205** `message:` cümlesi `bim-kernel/src` içinde (ör. `levels.ts:127`, `parts.ts:449-486`) diyaloglarda görünüyor.
- `operator-messages.ts` yalnız 18 kaba kod eşliyor ve **parametre taşımıyor**.

**Seçenekler:**

- **(i) Kapsam dışı — yalnız etiketler çevrilir.** Etiketler/butonlar/başlıklar Türkçe; kernel/pack cümleleri (uyarılar, bulgular, reddetme toast'ları, hesap adımları) **İngilizce kalır**. Hızlı; ama "karışık dil yok" başarı ölçütü **çürür** — Türkçe ekranda İngilizce cümleler çıkar.
- **(ii) Kapsam içi — kod + parametre.** Kernel ve pack'ler `{ code, params }` döndürür, sunum katmanı çevirir. Doğru mimari; ama iş katman 1–3'e iner ve **projeyi kabaca 2–3 katına çıkarır** (kernel + 9 pack + tüm çağrı yerleri).
- **(iii) Ara yol — İngilizce metni çeviri haritasıyla eşle, parametreleri regex ile yakala.** `{n}`/sayı yer tutucularını yakalayan bir eşleyici. Orta maliyet; kırılgan (İngilizce metin değişince çeviri düşer) ama iş katman 1–3'e inmez.

**Önerim: (iii).** Sebep: kullanıcının gördüğü Türkçe ekranda İngilizce cümle kalmaz (ölçüt korunur), kernel'in "cümlelerle reddet" tasarımı ve katman kuralı bozulmaz, (ii)'nin maliyeti bu işin kapsamına sığmaz. Bedeli: kırılganlık — İngilizce cümle değişirse o cümle Türkçe yerine İngilizce görünür (zarif bozulma, ham anahtar değil).

**KARAR: (iii) — onaylandı.** Gerçekleme ayrıntısı (elle regex yazmak yerine **şablon normalizasyonu**):

1. Bir betik kernel/pack kaynaklarındaki mesaj literallerini tarar ve **şablon listesini** üretir.
2. Çalışma anında gelen İngilizce cümle normalize edilir: sayılar/birimler sırayla `{0}`, `{1}` yer tutucularına çevrilir.
3. Normalize şablon → TR şablon haritasında aranır; bulunursa TR yer tutucularla doldurulur, bulunmazsa **İngilizce olduğu gibi** gösterilir.

Bu yaklaşım elle ~1200 regex yazmayı önler, kapsamı **ölçülebilir** kılar (kaç şablon çevrildi / kaçı eksik) ve test edilebilir. Kapsam hedefi: ekrana en çok ulaşan mesajlar (18 operatör kodu + kernel reddetmeleri + yaygın lint bulguları) çevrilir; kuyruk İngilizce kalır ve bu **açıkça belgelenir** (bkz. başarı ölçütü 7).

> **(i) seçilirse:** başarı ölçütü 1 "etiketler ve ekran metinleri iki dilli; kernel/pack üretimi cümleler İngilizce" olarak yeniden yazılır ve bu bir **kabul edilmiş sınır** olarak belgelenir.

### Ç-B. Domain etiket stratejisi *(benim kararım)*

**Karar:** Paketlerde İngilizce tanımlayıcı **değişmez**; render anında `t('domain.<id>', label)` ile çözülür. ~1333 etiket tek haritadan çevrilir, pack mantığı hiç ellenmez. Gerekçe: pack dosyalarına dokunmamak katman kuralını ve upstream uyumunu korur.

### Ç-C. Sayı ve birim biçimi *(benim kararım — premise düzeltildi)*

Builder, dokümandaki varsayımımı düzeltti: `bim-units/src/format.ts` **bilerek** `toLocaleString` kullanmıyor (satır 9); ayırıcılar veriden geliyor (`DisplayProfile.thousands`/`decimal`, `types.ts:192-206`, `PROFILE_METRIC_MM`). Yani çizelge/miktar gösterimi zaten yerelleştirilebilir.

**Karar:** (a) Miktar/çizelge gösterimi **veri odaklı** kalır; `tr` için metrik profil + TR ayırıcıları (ondalık virgül, binlik nokta) kullanılır. (b) `bim-kernel/src/quantities/index.ts:156`, `blocks/render.ts:118` ve ~40 pack sitesindeki `toLocaleString("en-US")` **Ç-A kararına bağlıdır** — cümle üreten kod oldukları için (iii) seçilirse metin eşlemesiyle birlikte ele alınır. (c) Birim sistemi `tr` için **SI**. Birim **sembolleri** çevrilmez; yalnız açık yazılmış adlar (Amper, Volt) çevrilir (sözlük §7).

### Ç-D. Sunucu-render dil tercihi *(benim kararım)*

**Karar:** Dil tercihi **çerezde** tutulur (`mutiny.lang`), sunucu ilk boyamada doğru dili verir (FOUC yok); istemci `<html lang>` ve i18next örneğini çerezle senkronlar. FOUC alternatifi (istemcide değişim) ilk boyamada İngilizce flaş üretir — reddedildi.

### Ç-E. Hosted editörde dilin doğruluk kaynağı *(benim kararım)*

Builder haklı: hosted editör aynı uygulamanın istemci paketi (`client/entry.tsx:238`), hesap şeması sunucudan enjekte ediliyor (`app.ts:646` `pageData.colorScheme` → `entry.tsx:80` `schemeAdapter`). Yerel demo'da hiç storage yok.

**Karar:** Tercih sırası — (1) **oturum açıksa hesap tercihi** (`users.language`; kişinin ayarı kendisiyle taşınır ve başkasının makinesini ezmez), (2) oturum yoksa (yerel demo) `localStorage['mutiny.lang']`, (3) yoksa `navigator.language`, (4) yoksa `en`. Oturum kapatılınca `navigator.language`'a döner. `LanguageToggle` hosted editörde hesaba yazar (mevcut `schemeAdapter` desenine paralel `languageAdapter`), yerel demoda `localStorage`'a.

### Ç-F. Route handler metinleri Aşama 2 kapsamında *(benim kararım)*

Builder haklı: `app.ts` (819 satır) flash ve hata metinlerini `pages.tsx` dışında yazıyor (`app.ts:289,312,343,363` + `models.ts`/`oauth.ts` içinde ~50 benzeri literal). **Karar: kapsam içi.** "Uygulama tamamen iki dilli" çıkışı bunlar olmadan tutmaz; ilk giriş hatası Türkçe olmalı. Route handler'lar çerezden çözülen bir çevirici alır (`page()` çağrılmadan önce).

### Ç-G. Kapsam dışı olduğu doğrulananlar *(benim kararım)*

- **Yazdırılan paftalar ve PDF'ler** İngilizce kalır — `bim-sheets` ayrı bir `pdf-lib` yolu, ekranla React paylaşmıyor; AGENTS.md'nin "kağıt siyah-beyaz" istisnası zaten geçerli.
- **Ajan/MCP'ye bakan metinler** İngilizce kalır — bu tasarım **ekranlar** hakkında.
- **E-posta şablonları** bu fazda kapsam dışı.

### Ç-H. Türkçe metnin sahibi ve insan incelemesi *(kullanıcı kararı)*

**KARAR: (a) — onaylandı.** Ajan yazar; her aşama sonunda **ekran ekran TR/EN inceleme listesi** üretilir ve kullanıcı gözden geçirir. Aşama, inceleme listesi teslim edilmeden "tamam" sayılmaz (liste teslimi yeterli; kullanıcı onayı aşamayı bloklamaz, düzeltmeler bir sonraki aşamaya taşınır).

---

## 8. Başarı ölçütleri

1. Her ekran `tr` ve `en` olarak gezilebiliyor; hiçbir ekranda karışık dil yok. *(Ç-A'da (i) seçilirse: "karışık dil yok" yalnız etiket/ekran metinleri için geçerli; kernel/pack cümleleri İngilizce kalır ve bu belgelenir.)*
2. Arayüzde ham anahtar (`nav.models`) görünmüyor — otomatik test.
3. `en` arayüzü önceki hâliyle aynı (regresyon testi: kritik akışlar `en`'de değişmemiş).
4. Sözlük uyumu testi: aynı İngilizce terim tek Türkçeye eşleniyor.
5. `tr`/`en` anahtar eşliği testi: eksik anahtar yok.
6. Hex renk ihlalleri sıfır (Aşama 5 sonunda).
7. **Kernel/pack cümle kapsamı ölçülür ve raporlanır:** çevrilen şablon sayısı / toplam şablon sayısı; ekrana en çok ulaşan mesajlarda kapsam ≥ %80. Eksik kalanlar listelenir (gizlenmez).

---

## 9. Builder'a bırakılanlar

- i18next yapılandırma ayrıntıları (namespace yükleme, lazy load, geliştirme uyarıları).
- Test dosyası yerleşimi ve parity testinin gerçeklemesi.
- `LanguageToggle` görsel tasarımı (`ToggleGroup` ile, `ThemeToggle` desenine uygun).
- Çeviri dosyalarının bölünme boyutu (paket başına tek dosya mı, panel başına mı).
- Aşama içi görev kırılımı (implementation planında).
