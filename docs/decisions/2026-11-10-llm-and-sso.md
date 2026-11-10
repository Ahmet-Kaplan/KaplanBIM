# Karar Kaydı: LLM/Veri Gizliliği ve SSO (idP) Seçimi

- **Tarih:** 2026-11-10
- **Durum:** Taslak — varsayılan (default) karar uygulanıyor, **firma onayı bekleniyor**
- **İlgili doküman:** `docs/superpowers/specs/2026-11-10-kaplanbim-construction-platform-design.md`, §8 açık kalem 4 ve 5
- **Etkilediği görevler:** Faz 2 — Task 2.2 (AI asistan entegrasyonu), Task 2.4 (kimlik/erişim gibi sonraki görevler)

> **Önemli not:** Bu belgedeki iki karar, tasarım dokümanının §8'inde "bu
> firmanın gizlilik tercihiyle belirlenir" ve "Faz 2 öncesi netleşir" olarak
> işaretlenmiş açık kalemlerdir — yani **nihai olarak firmanın kendi
> kararlarıdır**, bu belgenin yazarının değil. Bu kayıt, Faz 2
> implementasyonunun bu kararlar netleşmeden tamamen durmaması için
> denetleyici (controller) tarafından verilmiş bir **varsayılan hüküm
> (default ruling)**'ü yazıya döker. Aşağıdaki iki karar **varsayılandır,
> teyit edilmiş firma kararı değildir**; firma onayı gelene kadar üretimde
> firma verisiyle çalıştırılmamalıdır (bkz. "Firma onayı bekleniyor"
> bölümü).

---

## 1. Bağlam ve kısıtlar

- Firma tek bir inşaat şirketi; **kalıcı bir yazılım geliştirme ekibi yok**.
  Bu, hem LLM hem SSO kararlarında "kim bunu bakımda tutacak" sorusunu
  belirleyici kılıyor (tasarım dokümanı §3, kısıtlar).
- Tasarım dokümanı §5'teki mimaride iki sistem var: **OpenConstructionERP**
  (sistem-of-record, FastAPI/Postgres, metraj/maliyet/ihale) ve **KaplanBIM**
  (görüntüleyici + AI ajan katmanı, TypeScript monorepo + model server).
  AI asistan, KaplanBIM tarafında çalışıp OpenConstructionERP'nin API'sini
  sorgulayacak (§5, "API köprüsü").
- §5 "Entegrasyon noktaları" madde 3: *"SSO: Tek kimlik. Her iki sistem aynı
  kimlik sağlayıcısını doğrular (başlangıçta basit bir iç OIDC/idP veya
  firma hesap sistemi)."* — yani tasarım zaten tek-kimlik yönünü
  kararlaştırmış; bu belgenin eklediği şey, o tek kimliğin **hangi somut
  mekanizma** olacağı.
- §8 açık kalem 4 (LLM/veri gizliliği) ve 5 (SSO idP'si), bu belgenin konusu.
- **Doğrulanmış gerçek durum (bu task'ın girdisi, önceki görevlerden):**
  - OpenConstructionERP'nin `ai` modülü **"bring your own key" (BYOK)**
    modelinde çalışıyor: `ai/manifest.py`'nin `InferenceDeclaration.basis`
    alanı *"no key ships with the product, so nothing here infers anything
    until an operator supplies credentials of their own"* diyor
    (`deploy/blackbox/calibration.md`'de doğrulanmış alıntı). Sağlayıcı
    anahtarı `PATCH /api/v1/ai/settings/` ile kaydediliyor (ör.
    `anthropic_api_key`, `preferred_model`); desteklenen sağlayıcı listesi
    `GET /api/v1/ai/providers/` ile dönüyor; bağlantı `POST
    /api/v1/ai/settings/test/` ile doğrulanıyor.
  - Aynı `ai` modülü **self-hosted** uç noktaları da destekliyor:
    `ollama_base_url`/`vllm_base_url` alanları,
    `backend/app/modules/ai/schemas.py`'deki `_reject_unsafe_base_url` adlı
    Pydantic `field_validator` üzerinden `backend/app/core/url_safety.py`'nin
    `validate_ai_provider_url`'ine gider: link-local/bulut-metadata adresleri
    reddedilir, loopback/özel ağ adresleri (yerelde çalışan Ollama/vLLM gibi
    bir model için) **kabul edilir**. Yani sistem hem üçüncü taraf API'yi hem
    self-hosted modeli aynı yapılandırma yüzeyinden destekliyor — bu bir
    varsayım değil, kod düzeyinde doğrulanmış bir kapasite.
  - OpenConstructionERP'nin mevcut oturum açma mekanizması **JWT**'dir:
    `/auth/login` bir `access_token` döner (JWT, varsayılan `HS256`, ortak
    sır `JWT_SECRET` ile imzalanır — `deploy/erp/.env.example`,
    `deploy/erp/docker-compose.prod.yml`). Bu, **henüz tam bir OIDC
    protokolü (discovery endpoint, issuer, OAuth2 authorization-code akışı)
    değil**; basit, paylaşılan-sır tabanlı bir JWT oturumudur. Tasarım
    dokümanının §5'teki "basit bir iç OIDC/idP" ifadesi bu yönde bir hedefi
    tarif ediyor, ama bugünkü kod bu hedefin henüz ötesinde değil — bu fark
    aşağıdaki SSO kararında açıkça not edilmiştir.
  - KaplanBIM tarafında (bu monorepo), model sunucusunun kimlik doğrulama
    kodu bu görevin son-kontrolü (final review) sırasında doğrulanmıştır:
    `services/bim-authority/src/auth/verify.ts` token'ı **yalnızca JWKS
    (asimetrik anahtar) ile** doğrular (`createRemoteJWKSet` +
    `jwtVerify({ issuer, audience })`); `src/host/contract.ts` içindeki
    `SignInSource = { issuer, jwksUrl, audience }` sözleşmesi de paylaşılan
    sır (HS256) için bir alan taşımaz. Bu nedenle SSO kararının "KaplanBIM
    tarafı", yeni doğrulama kodu yazmayı gerektirmeyen **JWKS/RS256** yönüne
    dayanır (bkz. §3).

---

## 2. Karar 1 — LLM seçimi ve veri gizliliği

### Seçenekler

1. **Üçüncü taraf LLM API (OpenAI/Anthropic/Gemini vb.)**
   - Artı: Sıfır bakım yükü, en güncel/yetenekli modeller, OpenConstructionERP
     `ai` modülü zaten bunu BYOK ile destekliyor (bkz. §1), kurulum tek bir API
     anahtarı girmekten ibaret.
   - Eksi: Firma verisi (BOQ kalemleri, maliyet, proje adları, metin
     istemleri) üçüncü taraf sunucusuna gider. Firmanın ticari/sözleşmesel
     gizlilik yükümlülükleri varsa (işveren NDA'ları, rekabetçi teklif
     verileri) bu kabul edilemez olabilir.
2. **Self-hosted LLM (yerelde çalışan Ollama/vLLM)**
   - Artı: Veri hiçbir zaman firma ağının dışına çıkmaz; `ai` modülü bunu
     zaten destekliyor (`ollama_base_url`/`vllm_base_url`, SSRF koruması ile
     loopback/özel ağ kabul).
   - Eksi: GPU/donanım, model güncelleme, performans ayarı, hata ayıklama —
     hepsi **kalıcı bir dev/ops ekibi** gerektirir. Firmada böyle bir ekip
     yok (bkz. §1, kısıt). Küçük/orta açık modellerin BOQ/metraj gibi
     alan-spesifik görevlerdeki kalitesi, büyük ticari modellerin gerisinde
     kalabilir.
3. **Hibrit: Varsayılan üçüncü taraf, opsiyonel self-hosted**
   - Artı: Her iki yol da `ai` modülünde zaten var olan tek bir yapılandırma
     yüzeyinden (sağlayıcı seçimi + anahtar/URL) erişilebilir; firma ileride
     fikrini değiştirirse kod değişikliği gerekmez, sadece ayar değişir.
   - Eksi: Yok denecek kadar az — zaten mevcut olan bir kapasiteyi "varsayılan
     + kapı açık" olarak kullanmaktan ibaret.

### Varsayılan karar (controller hükmü)

**Seçenek 3'ün varsayılanı: sağlayıcıdan bağımsız, yapılandırılabilir
üçüncü taraf LLM API'si.** Somut olarak:

- Varsayılan yapılandırma, OpenConstructionERP'nin `ai` modülünün zaten
  desteklediği BYOK mekanizmasıdır: sağlayıcı ve anahtar `PATCH
  /api/v1/ai/settings/` ile seçilir/kaydedilir (OpenAI/Anthropic/Gemini
  tarzı REST sağlayıcılarından biri), bağlantı `POST
  /api/v1/ai/settings/test/` ile doğrulanır.
- Aynı yapılandırma yüzeyi üzerinden, istenirse `ollama_base_url`/
  `vllm_base_url` ile **self-hosted bir modele** (örn. yerel bir Ollama/vLLM
  sunucusu) geçmek **zaten mümkündür** — bu bir "gelecek görev" değil,
  bugün var olan bir seçenektir. Karar, hangisinin *varsayılan* olacağıdır;
  self-hosted yolu kapatılmamıştır.
- Konfigürasyon fikri olarak "sağlayıcı + anahtar" (ör. `LLM_PROVIDER`/
  `LLM_API_KEY` tarzı iki parametre) basittir, ama bu belge **gerçek alan
  adlarını OpenConstructionERP koduna göre doğrulamıştır**: doğrulanmış
  mekanizma, ortam değişkeni değil, yukarıdaki `PATCH /api/v1/ai/settings/`
  uç noktasına gönderilen alanlardır (`anthropic_api_key`,
  `preferred_model`, `ollama_base_url`, `vllm_base_url` vb.). "LLM_PROVIDER/
  LLM_API_KEY" ifadesi bu görevin brief'inde kavramsal bir kısaltma olarak
  geçmiştir; bu belge, var olmadığını doğrulamadığı ortam değişkeni adlarını
  icat etmek yerine gerçek uç noktaya atıfta bulunur.

### Gerekçe

- Firmanın kalıcı bir geliştirme/ops ekibi yok; self-hosted bir LLM'in
  bakımı (donanım, güncelleme, izleme) bu firma profiline uygun değil.
- OpenConstructionERP zaten "herhangi bir LLM REST üzerinden" (tasarım
  dokümanı §5, teknik yığın tablosu) ilkesiyle kurulmuş ve bunu kod
  düzeyinde (BYOK + self-hosted URL desteği) karşılıyor — varsayılanı
  üçüncü taraf seçmek, var olan altyapıyı en az sürtünmeyle kullanmak
  demektir.
- Self-hosted yol tamamen kapatılmıyor: firma ileride veri gizliliği
  endişesiyle self-hosted'a geçmek isterse, aynı modülün `ollama_base_url`/
  `vllm_base_url` alanlarını kullanabilir — mimari değişikliği gerekmez.

### Sonuçlar

- **Üretimde gerçek firma verisiyle (BOQ, maliyet, proje adı, teklif
  detayları) çalıştırmadan önce, veri gizliliği sorusu firma tarafından
  olumlu yanıtlanmalıdır** (bkz. §4 aşağıda). Bu onay gelene kadar bu
  varsayılan yalnızca **geliştirme/demo** amaçlı, gerçek olmayan veya
  anonimleştirilmiş veriyle kullanılmalıdır.
- Task 2.2 (AI asistan entegrasyonu), bu varsayılanı girdi olarak alır:
  asistan, ERP'nin `ai` modülünü BYOK sağlayıcı yapılandırmasıyla çağırır;
  kodda sağlayıcıyı sabitlemez, `ai/providers` listesinden okur.
- Hangi sağlayıcı seçilirse seçilsin, seçilen sağlayıcının kendi veri
  saklama/eğitim politikası (promptların model eğitiminde kullanılıp
  kullanılmadığı) firma tarafından ayrıca kontrol edilmelidir — bu belge bu
  kontrolü yapmamıştır, sadece mekanizmayı kaydetmiştir.

---

## 3. Karar 2 — SSO / idP seçimi

### Seçenekler

1. **ERP'nin kendi token'ını tek kimlik kaynağı yapmak** (iki varyant)
   - **Varyant A — HS256 paylaşılan sır:** ERP bugün `/auth/login` ile HS256
     (`JWT_SECRET`) JWT üretiyor; KaplanBIM aynı sırrı paylaşarak aynı token'ı
     doğrular. Eksi: KaplanBIM model sunucusu bugün HS256'yı **hiç
     doğrulayamıyor** (yalnızca JWKS/asimetrik destekliyor), dolayısıyla
     KaplanBIM'e yeni paylaşılan-sır doğrulama kodu yazılması gerekir;
     paylaşılan sır iki sistemde birden tutulup rotasyonu koordine edilmelidir.
   - **Varyant B — RS256 + JWKS:** ERP token'ları RS256 ile imzalayıp bir JWKS
     uç noktası yayınlar; KaplanBIM mevcut `SignInSource { issuer, jwksUrl,
     audience }` sözleşmesiyle doğrular. Artı: KaplanBIM tarafında yeni
     doğrulama kodu gerekmez; özel anahtar yalnızca ERP'de kalır.
   - Ortak eksi: Bugünkü mekanizma tam bir OIDC protokolü değil (discovery/
     authorization-code yok).
2. **Gerçek bir OIDC sağlayıcısı kurmak (ör. Keycloak, basit bir iç idP)**
   - Artı: Standart protokol, token rotasyonu/iptali/çoklu-istemci desteği
     daha sağlam; ileride üçüncü bir sistem eklenirse (ör. SharePoint,
     mobil uygulama) aynı idP'ye bağlanması kolaydır.
   - Eksi: Yeni bir servis demek — kurulum, yedekleme, güncelleme, bakım.
     Kalıcı bir dev/ops ekibi olmayan bir firma için ek bir "sistem" daha.
3. **Firmanın zaten sahip olduğu bir kurumsal hesap sistemine (ör. Microsoft
   Entra ID/Google Workspace SSO) bağlanmak**
   - Artı: Personel zaten bu hesapla oturum açıyorsa, yeni şifre/kullanıcı
     yönetimi yükü yok; IT tarafı (varsa) zaten bu sistemi yönetiyor.
   - Eksi: Firmanın böyle bir sistemi olup olmadığı **bu görev kapsamında
     bilinmiyor** (bkz. §4) — varsa entegrasyon (OAuth2/OIDC federasyonu)
     ek iş; yoksa bu seçenek uygulanamaz.

### Varsayılan karar (controller hükmü)

**Yol B'nin varsayılanı: ERP, token'ları RS256 ile imzalayıp bir JWKS uç
noktası yayınlar; KaplanBIM, mevcut `SignInSource { issuer, jwksUrl,
audience }` sözleşmesiyle bu token'ı doğrular.** Somut olarak:

- OpenConstructionERP, kullanıcıları doğrulamaya devam eder ama `access_token`
  üretimini **RS256 (asimetrik)** imzaya çevirir, token'a `iss`/`aud`
  claim'lerini ekler ve bir **JWKS uç noktası** yayınlar. Bu, ERP backend
  tarafında yapılacak bir değişikliktir (bu depoda olmayan kod); açık kalem
  olarak kaydedilmiştir (bkz. "Sonuçlar").
- KaplanBIM'in model sunucusu **hiçbir yeni doğrulama kodu gerektirmez**:
  `services/bim-authority/src/auth/verify.ts` zaten `createRemoteJWKSet` +
  `jwtVerify({ issuer, audience })` ile JWKS/asimetrik token doğrular ve
  `SignInSource = { issuer, jwksUrl, audience }` sözleşmesi bunu taşır. Tek
  yapılacak, ERP'nin `issuer`/`jwksUrl`/`audience` değerlerini döndüren bir
  host eklentisini (örnek: `src/host/single-user.ts`) bağlamaktır.
- **Bu karar, daha önceki HS256 paylaşılan-sır varsayılanını geçersiz
  kılar.** İlk taslak "ERP'nin mevcut HS256 `JWT_SECRET` paylaşılan-sır
  JWT'si" yönündeydi; son-kontrol (final review) denetimi, KaplanBIM model
  sunucusunun HS256'yı hiç doğrulayamadığını (yalnızca JWKS/asimetrik
  destekliyor) tespit etti ve varsayılanı Yol B'ye çevirdi. Paylaşılan-sır
  yaklaşımı artık varsayılan değildir.
- **Not — terminolojik dürüstlük:** Bu, tam bir OIDC protokolü (discovery/
  authorization-code) değil; "ERP'nin ürettiği RS256 token'ı KaplanBIM'in
  JWKS ile doğrulaması" anlamında en düşük maliyetli tek-kimlik
  gerçekleşmesidir. Gerçek bir OIDC sağlayıcısı (Seçenek 2) kurmak istenirse,
  ayrı bir karar değişikliğiyle yapılabilir.

### Gerekçe

- KaplanBIM model sunucusunun doğrulama kodu **zaten JWKS/asimetrik**
  destekliyor ve HS256'yı desteklemiyor (`services/bim-authority/src/auth/verify.ts`,
  `src/host/contract.ts`). KaplanBIM tarafında **yeni doğrulama kodu
  yazmamak** için RS256/JWKS en az iş çıkaran yoldur; HS256 yolu KaplanBIM'e
  yeni (ve bugün var olmayan) paylaşılan-sır doğrulaması yazmayı gerektirirdi.
- Asimetrik imza, `JWT_SECRET` paylaşılan sırrının iki sistemde birden
  tutulması ve rotasyonunun koordine edilmesi yükünü ortadan kaldırır:
  yalnızca ERP özel anahtarı bilir; KaplanBIM yalnızca **genel** anahtarı
  JWKS'ten okur.
- Firmanın kalıcı bir dev/ops ekibi yok; yeni bir idP servisi kurup işletmek
  (Seçenek 2) bu profile uygun değil. Bu yol sıfır yeni servis ekler ve
  tasarım dokümanının "tek kimlik" ilkesine (§5, madde 3) ulaşır.
- Firmanın zaten bir kurumsal hesap sistemi varsa (Seçenek 3), bu daha iyi
  bir uzun vadeli çözüm olabilir — ama bu bilgi bu görev kapsamında firma
  tarafından teyit edilmediği için varsayılan olarak seçilemez.

### Sonuçlar

- **ERP tarafı (yapılacak iş, bu depoda değil):** OpenConstructionERP
  backend'i token üretimini **RS256**'ya çevirmeli, token'a `iss`/`aud`
  claim'lerini eklemeli ve bir **JWKS uç noktası** yayınlamalıdır. Bu açık
  kalemdir; çalışan SSO'nun teslimi buna bağlıdır.
- **KaplanBIM tarafı:** yeni doğrulama kodu gerekmez — mevcut `SignInSource
  { issuer, jwksUrl, audience }` sözleşmesi ve `verify.ts` zaten JWKS/RS256
  doğruluyor. Task 2.4'ün KaplanBIM tarafı, ERP'nin `issuer`/`jwksUrl`/
  `audience` değerlerini döndüren bir host eklentisini bağlamaktan ibarettir.
- **Çalışan SSO henüz teslim edilmemiştir:** ERP RS256/JWKS yayınlamadığı
  sürece iki sistem arasında uçtan uca kimlik çalışmaz; bu boşluk
  `deploy/sso/README.md`'de dürüstçe kaydedilmiştir.
- Firma gerçekte bir kurumsal idP'ye (Seçenek 3) sahipse, bu varsayılan
  gözden geçirilmeli ve bu belge güncellenmelidir (bkz. §4).

---

## 4. Firma onayı bekleniyor

Bu belgedeki her iki karar da **varsayılandır, firma tarafından teyit
edilmemiştir**. Aşağıdaki iki soru firmaya yöneltilmeli ve yanıtlar
geldiğinde bu belge güncellenmelidir:

1. **Veri gizliliği (LLM):** Firma verisi (proje adları, BOQ kalemleri,
   maliyet rakamları, teklif metinleri, AI asistana yazılan istemler)
   üçüncü taraf bir LLM API'sine (OpenAI/Anthropic/Gemini vb.) **gidebilir
   mi**? Yanıt "hayır" ise, varsayılan tersine çevrilir ve self-hosted
   (Ollama/vLLM) yol zorunlu hale gelir — bu durumda firmanın bu self-hosted
   modeli çalıştıracak donanım/bakım kapasitesi (veya bunu üstlenecek bir
   üçüncü taraf barındırma anlaşması) ayrıca netleşmelidir.
2. **SSO/idP:** Firmanın **zaten kullandığı bir kurumsal kimlik sistemi
   (ör. Microsoft/Google iş hesabı, Active Directory) var mı**? Varsa, bu
   sistemle federasyon (Seçenek 3) değerlendirilmelidir; yoksa, bu
   belgedeki varsayılan (ERP'nin RS256/JWKS token'ı üzerinden tek kimlik)
   geçerliliğini korur.

**Yanıt geldiğinde yapılacak:** Bu dosya (`docs/decisions/2026-11-10-llm-and-sso.md`)
güncellenir — "Durum" alanı "Taslak"tan "Firma onaylı"ya çevrilir, ilgili
kararın "Varsayılan karar" bölümü firmanın gerçek seçimiyle değiştirilir
(gerekirse §2/§3'teki seçenek listesine yeni bir seçenek eklenir), ve bu
güncelleme ayrı bir commit olarak kaydedilir. Task 2.2/2.4, implementasyona
başlamadan önce bu belgenin "Durum" alanını kontrol etmelidir; "Taslak"
durumundayken gerçek firma verisiyle üretime alınmamalıdır.
