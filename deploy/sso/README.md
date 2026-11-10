# Tek Kimlik (SSO) Kurulumu — OpenConstructionERP + KaplanBIM

Bu belge, OpenConstructionERP ile KaplanBIM'in (MutinyBIM) aynı kimliği
doğrulaması için izlenecek yolu adım adım yazar. Girdi, kimlik sağlayıcı
(idP) kararıdır: `docs/decisions/2026-11-10-llm-and-sso.md` §3.

> **Durum uyarısı (önemli):** O karar bir **varsayılan hükümdür (default
> ruling), firma tarafından teyit edilmemiştir** ("Durum: Taslak"). Firma
> onayı gelene kadar buradaki adımlar **gerçek firma verisiyle üretimde
> çalıştırılmamalıdır**; yalnızca geliştirme/demo amaçlıdır (bkz. karar
> belgesi §1 ve §4).

> **"Bu ortamda doğrulanmadı" işaretleri:** Bu belgede canlı bir sunucu
> gerektiren adımlar (ERP'ye giriş, token üretimi, canlı red davranışını
> gözlemlemek) açıkça işaretlenmiştir. Bu ortamda imaj indirme/`docker
> compose up` yapılmadığından bu adımlar yalnızca kaynak kodu ve deploy
> yapılandırması üzerinden belgelenmiştir; çıktıları burada gözlemlenmemiştir.

---

## 1. Seçilen kimlik modeli

**Karar:** ERP, token'ları **RS256 (asimetrik)** ile imzalar ve bir **JWKS
uç noktası** yayınlar; KaplanBIM'in model sunucusu mevcut `SignInSource {
issuer, jwksUrl, audience }` sözleşmesiyle bu token'ı doğrular
(`docs/decisions/2026-11-10-llm-and-sso.md` §3, "Yol B"). Bu, son-kontrol
(final review) denetimiyle belirlenen varsayılandır ve daha önceki HS256
paylaşılan-sır varsayılanını geçersiz kılar.

Bu **tam bir OIDC protokolü değildir**: discovery endpoint'i, OAuth2
authorization-code akışı ve çoklu-istemci token yönetimi yoktur. Gerçek bir
OIDC idP (Keycloak vb.) istenirse bu ayrı bir karar değişikliğidir.

### Kimliğin "tek" olması için gerekenler

Kimliğin "tek" olması için şunlar sağlanmalıdır:

1. **İmza** — ERP token'ı **RS256** ile imzalar; özel anahtar yalnızca
   ERP'de kalır.
2. **JWKS uç noktası** — ERP, genel anahtarı içeren bir JWKS uç noktası
   yayınlar; KaplanBIM `SignInSource.jwksUrl` ile oradan okur.
3. **issuer/audience** — token'ın `iss` ve `aud` claim'leri, KaplanBIM
   tarafında yapılandırılan `SignInSource { issuer, audience }` değerleriyle
   birebir eşleşmeli (bkz. §2, §3).

Bunlardan biri uyuşmazsa token reddedilmelidir — asla sessizce kabul
edilmemelidir (Review Focus 5, §3).

---

## 2. KaplanBIM model sunucusunu yapılandırma (bulunan gerçek anahtarlar)

Model sunucusu `services/bim-authority/` altındadır. Oturum doğrulama kodu
ve yapılandırma yüzeyi şu dosyalardadır (bu depoda gerçekten bulunan, uydurulmamış
anahtarlar):

| Ayar / dosya | Ne yapar |
| --- | --- |
| `services/bim-authority/src/auth/verify.ts` | `LoginVerifier.verify()`: token'ı doğrular. **Yalnızca JWKS (asimetrik anahtar) ile** — `createRemoteJWKSet(jwksUrl)` + `jwtVerify(token, keys, { issuer, audience })`. |
| `services/bim-authority/src/host/contract.ts` | `SignInSource = { issuer, jwksUrl, audience }` — model sunucusunun kimlik kaynağı sözleşmesi. `supabaseSignIn(url)` yardımcısı, Supabase tarzı bir ES256 kaynağı kurar. |
| `services/bim-authority/src/host/load.ts` | `MUTINYBIM_AUTHORIZER_MODULE` ile adlandırılan host eklentisini (plug-in) yükler; `signIn` alanının `issuer` URL + `jwksUrl` URL + `audience` string olduğunu doğrular. |
| `services/bim-authority/src/host/single-user.ts` | Eksiksiz örnek host eklentisi. Okuduğu env anahtarları: `MUTINYBIM_SINGLE_USER_ID`, `MUTINYBIM_SINGLE_USER_ISSUER`, `MUTINYBIM_SINGLE_USER_JWKS_URL`, `MUTINYBIM_SINGLE_USER_AUDIENCE` (varsayılan `"authenticated"`). |
| `services/bim-authority/src/config.ts` | Model sunucusunun env şeması. İlgili anahtarlar: `MUTINYBIM_AUTHORIZER_MODULE` (host eklentisi) ve `MUTINYBIM_SUPABASE_URL` (yalnızca test oturumları). |
| `deploy/bim/docker-compose.yml` | Yerel yığında `MUTINYBIM_SUPABASE_URL: http://127.0.0.1:9999` ve `MUTINYBIM_LOCAL_STACK: "1"` ile yerel ES256 `signin` servisine işaret eder. |

### Kritik bulgu — çalışan SSO henüz yok: ERP'nin RS256/JWKS yayınlaması gerek

Karar belgesinin seçtiği model (Yol B) **RS256 + JWKS**'tir. KaplanBIM model
sunucusu bu modeli **zaten destekler**:

- `src/auth/verify.ts` token'ı **yalnızca JWKS ile** (`createRemoteJWKSet` +
  `jwtVerify({ issuer, audience })`) doğrular. `SignInSource` sözleşmesi de
  (`issuer`, `jwksUrl`, `audience`) tam olarak bunu ister.
- `services/bim-authority/` altında `JWT_SECRET` / `JWT_ALGORITHM` adında
  **hiçbir env anahtarı yoktur** (`src/config.ts` şemasında da yoktur) ve
  gerek de yoktur — asimetrik modelde sır yalnızca ERP'de kalır.

Ancak **ERP tarafı bugün RS256/JWKS üretmiyor**:

- ERP'nin deploy yapılandırmasında (`deploy/erp/.env.example`,
  `deploy/erp/docker-compose.prod.yml`) `JWT_SECRET`/`JWT_ALGORITHM` varsayılan
  olarak **HS256** üretir ve `issuer`/`audience`/`iss`/`aud`/JWKS adında
  **hiçbir ayar yoktur**. Yani bugünkü ERP token'ı, `sub`+`exp` taşıyan sade
  bir HS256 paylaşılan-sır token'ıdır; KaplanBIM'in doğrulayabildiği RS256 +
  JWKS + `iss`/`aud` claim'lerine sahip değildir.

**Sonuç — dürüst durum:** Model sunucusu ile ERP arasında **çalışan bir SSO
henüz yoktur**. Boşluk artık "KaplanBIM'e HS256 doğrulaması yazmak" değil,
**ERP'nin RS256 imzalama + JWKS uç noktası + `iss`/`aud` claim'lerini
yayınlamasıdır** (bu depoda olmayan ERP backend kod değişikliği, Task 2.4).
Aşağıdaki §5 bu boşluğu kapatmanın somut yolunu verir. Bu belge, var olmayan
env anahtarı adları icat etmez.

---

## 3. Review Focus 5 — kimlik uyumsuzluğunun temiz reddi

Amaç: **geçersiz / süresi dolmuş / yanlış verenden token asla sessizce kabul
edilmemeli**; net bir red mesajı dönmeli.

### Kod bugün ne yapıyor (doğrulanmış kaynak davranışı)

`services/bim-authority/src/auth/verify.ts`:

- Token'ın `iss` claim'i hiçbir yapılandırılmış issuer ile eşleşmezse →
  `throw new Error('Sign-in from an unknown issuer (...)')`.
- `jose`'nun `jwtVerify` çağrısı, süresi dolmuş/bozuk/imza-uyuşmayan token için
  hata fırlatır (ör. `JWTExpired`).

`services/bim-authority/src/server.ts` (`admit()` ve `deny()`):

- Doğrulama hatası yakalanır ve istemciye `{ type: "denied", reason:
  "Sign in again: your session is not valid" }` gönderilir; soket `4003`
  koduyla kapatılır. **Sessiz kabul yoktur.**
- HTTP uç noktalarında (`authorizeBearer`) doğrulama başarısızsa yanıt
  `403` + `{ "error": "..." }` döner (ör. `server.ts` satır 890, 907, 916).

Yani red davranışı zaten "net hata" ilkesine uygun tasarlanmıştır; eksik olan,
ERP token'ını doğrulayacak **kaynağın henüz bağlanmamış olmasıdır** (§2).

### Somut test (SSO bağlandıktan sonra — bu ortamda doğrulanmadı)

Bu test canlı bir yığın gerektirir; aşağıdaki komutlar §5'teki yapılandırma
tamamlandıktan sonra sunucuda çalıştırılmak üzere yazılmıştır, çıktıları bu
ortamda gözlemlenmemiştir.

1. **Süresi dolmuş token:** ERP'den alınan `access_token`'ın `exp` süresi
   geçtikten sonra (veya `exp` değeri elle geçmişe çekilmiş bir token ile)
   editörü `/m/demo` adresinde aç. Beklenen: model açılmaz; `denied` mesajı
   "Sign in again: your session is not valid" (soket `4003`).
2. **Yanlış veren (issuer):** Başka bir sistemin ürettiği token ile aynı
   adrese bağlan. Beklenen: günlükte `Sign-in from an unknown issuer (...)`,
   istemcide `denied` + `4003`.
3. **Yanlış anahtar:** Aynı issuer/audience'a sahip ama **farklı bir özel
   anahtarla imzalanmış** (JWKS'te bulunmayan) bir token. Beklenen: `jwtVerify`
   imza uyumsuzluğu fırlatır, aynı `denied` + `4003` sonucu döner.
4. **HTTP uç noktası:** Geçersiz `Authorization: Bearer <token>` ile
   `POST /import` (veya drill uç noktası) çağrısı. Beklenen: `403` + açıklayıcı
   `{"error": "..."}`.

**Başarı ölçütü:** dört durumda da açık bir hata mesajı ve red durumu
gözlemlenir; hiçbirinde model sessizce açılmaz veya "kabul" yanıtı dönmez.

---

## 4. Yerel yığının "127.0.0.1'de herkese güven" oturumu — üretimde kaldırılmalı

`deploy/bim/docker-compose.yml` ve `deploy/bim/README.md` ("Sunucuya
taşımadan önce") bunu zaten bir **dağıtım öncesi engel** olarak işaretler.
Somut mekanizma:

- `services/bim-authority/src/local-stack/signin.ts` — yerel ES256 `signin`
  servisi. `GET /token?name=<isim>` çağrısına **kim sorusorsa sorsun** o isim
  için token üretir; anahtar çifti her başlangıçta yeniden üretilir. Dosyanın
  kendi yorumu: *"For a computer you trust; it signs in anyone who asks …
  Never point a deployed model server at it."*
- `deploy/bim/docker-compose.yml` bu servisi `MUTINYBIM_SUPABASE_URL:
  http://127.0.0.1:9999` üzerinden model sunucusunun test oturum kaynağı
  yapar (tüm portlar `127.0.0.1`'e bağlıdır).

**Üretim kuralı:** Firmanın ağına açılmadan önce bu yerel oturum **tamamen
kaldırılmalı** ve yerine §5'teki gerçek ERP-token doğrulaması geçmelidir.
`MUTINYBIM_SUPABASE_URL` bir test kolaylığıdır, üretim kimliği değildir;
`MUTINYBIM_LOCAL_STACK=1` de yalnızca dizüstü test içindir ve `FLY_APP_NAME`
set edildiğinde zaten reddedilir (`src/config.ts`).

---

## 5. Adım adım kurulum (Task 2.4)

Karar belgesi **Yol B'yi (RS256 + JWKS)** seçmiştir; Yol A (HS256 paylaşılan
sır) son-kontrol (final review) denetimiyle geçersiz kılınmıştır. İki yol
aşağıda belgelenmiştir: Yol B **KaplanBIM tarafında yeni doğrulama kodu
gerektirmez** (yalnızca bir host eklentisi bağlanır), Yol A ise HS256
doğrulaması yazmayı gerektirirdi. Adlar öneri değilse açıkça "öneri" olarak
işaretlenmiştir; var olan bir anahtar gibi sunulmamıştır.

### Yol A — geçersiz kılınan alternatif: HS256 paylaşılan sır

1. **ERP tarafında** token'ın taşıdığı claim'ler netleştirilir. Bugün
   `deploy/erp/.env.example` içinde `iss`/`aud` ayarı yoktur; doğrulamanın
   `issuer`/`audience` eşleşmesi gerekiyorsa (bkz. §2) ERP token'ına
   `iss` ve `aud` eklenmesi gerekir — **bu, bu depoda olmayan ERP backend
   kodunun değişmesi demektir; doğrulanmamıştır.**
2. **Model sunucusu tarafında** `src/auth/verify.ts` HS256'yı destekleyecek
   şekilde genişletilir: JWKS yerine `jwtVerify(token, <JWT_SECRET'ten
   türetilmiş anahtar>, { algorithms: ["HS256"], issuer, audience })`.
3. `src/host/contract.ts` içindeki `SignInSource` sözleşmesi, paylaşılan-sır
   doğrulamasını da taşıyacak biçimde genişletilir (şu an yalnızca `jwksUrl`
   kabul ediyor).
4. Model sunucusuna **yeni bir env anahtarı** eklenir (paylaşılan sır için).
   Adı bu depoda mevcut değildir; Task 2.4'te `JWT_SECRET` ile uyumlu bir ad
   seçilir (ör. ERP'deki `JWT_SECRET` değerini okuyan tek bir anahtar). Bu
   belge var olmayan bir ad icat etmez.
5. `JWT_SECRET`'in iki sistem arasında **güvenli dağıtımı ve rotasyonu**
   koordine edilir (karar belgesi §3 "Sonuçlar"): iki taraf aynı sırrı
   okuyorsa, sır değiştiğinde ikisi de aynı anda yeniden başlatılmalıdır.
   Bu adım bu ortamda doğrulanmamıştır.

### Yol B — Karar belgesinin seçtiği yol: RS256 + JWKS

1. ERP backend'i token'ları RS256 ile imzalar ve bir JWKS uç noktası yayınlar
   (bu depoda olmayan ERP backend kod değişikliği — doğrulanmamıştır).
2. Model sunucusu tarafı **hiç değişmeden** çalışır: mevcut `SignInSource`
   sözleşmesi zaten `{ issuer, jwksUrl, audience }` bekliyor. Bir host
   eklentisi (örnek: `src/host/single-user.ts` kopyalanarak) ERP'nin
   `issuer`/`jwksUrl`/`audience` değerlerini döndürür ve `MUTINYBIM_AUTHORIZER_MODULE`
   ile yüklenir.
3. Bu yol, `JWT_SECRET`'in iki sistemde birden tutulması sorununu ortadan
   kaldırır (yalnızca ERP özel anahtarı bilir; KaplanBIM yalnızca **genel**
   anahtarı JWKS'ten okur) — karar belgesinin §3 "Eksi" satırındaki
   "paylaşılan sır rotasyonu" yükünü hafifletir.

### Ortak adımlar

- Model sunucusuna yalnızca **ERP issuer'ı** kabul edecek şekilde host
  eklentisi bağlanır; `MUTINYBIM_SUPABASE_URL` ve `MUTINYBIM_LOCAL_STACK`
  üretimde kaldırılır (§4).
- Yetki (authorization) katmanı ayrı bir konudur: token'ın doğrulanması
  (kimlik) ile kişinin modelde ne yapabileceği (yetki, `ModelAuthorizer`)
  ayrı katmanlardır (`packages/bim-sync/AUTHORIZATION.md`, `src/host/contract.ts`).
  Bu belge yalnızca kimlik (SSO) katmanını kapsar.
- Değişiklik sonrası §3'teki dört test çalıştırılır ve hepsinin "red + net
  mesaj" ürettiği doğrulanır (bu ortamda doğrulanmadı).
