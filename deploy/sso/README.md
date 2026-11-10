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

**Karar:** OpenConstructionERP'nin mevcut JWT oturumu, iki sistemin
paylaştığı **tek kimlik kaynağıdır** (`docs/decisions/2026-11-10-llm-and-sso.md`
§3, "Seçenek 1"). ERP kullanıcıyı doğrular ve `/auth/login` ile bir JWT
`access_token` üretir; KaplanBIM'in model sunucusu **aynı token'ı** doğrulayıp
kabul eder.

Bu **tam bir OIDC protokolü değildir**: discovery endpoint'i, OAuth2
authorization-code akışı ve çoklu-istemci token yönetimi yoktur. Bugünkü
mekanizma, **paylaşılan-sır tabanlı (HS256) basitleştirilmiş tek kimliktir**
(karar belgesi §3 "terminolojik dürüstlük" notu). Gerçek bir OIDC idP
(Keycloak vb.) istenirse bu ayrı bir karar değişikliğidir.

### Her iki tarafın aynı şeyi doğrulaması gerekir

Kimliğin "tek" olması için üç şey iki sistemde de **birebir aynı** olmalıdır:

1. **İmzalama sırrı** — `JWT_SECRET` (ERP: `deploy/erp/.env`).
2. **Algoritma** — `HS256` (`JWT_ALGORITHM`, varsayılan `HS256`).
3. **issuer/audience** — token'ın `iss` ve `aud` claim'leri, KaplanBIM
   tarafında yapılandırılan değerlerle birebir eşleşmeli (bkz. §2, §3).

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

### Kritik bulgu — ERP'nin HS256 token'ı bugünkü kodla doğrulanamaz (boşluk)

Karar belgesi "paylaşılan sır (`JWT_SECRET`) + HS256" modelini seçmiştir. Ancak
bu depoda **model sunucusunun HS256 (paylaşılan-sır) token doğrulaması yoktur**:

- `src/auth/verify.ts` token'ı **yalnızca JWKS ile** (`createRemoteJWKSet`)
  doğrular. `SignInSource` sözleşmesi de (`issuer`, `jwksUrl`, `audience`)
  bir **yayınlanmış anahtar kümesi URL'i** ister; **paylaşılan sır için bir
  alan yoktur.**
- `services/bim-authority/` altında `JWT_SECRET` / `JWT_ALGORITHM` adında
  **hiçbir env anahtarı yoktur** (`src/config.ts` şemasında da yoktur).
- ERP tarafının deploy yapılandırmasında da (`deploy/erp/.env.example`,
  `deploy/erp/docker-compose.prod.yml`) `issuer`/`audience`/`iss`/`aud` adında
  **hiçbir ayar yoktur**; yani ERP'nin HS256 JWT'si, `sub`+`exp` taşıyan sade
  bir paylaşılan-sır token'ıdır — OIDC tarzı `iss`/`aud` claim'leri bu
  yapılandırmada tanımlı değildir.

**Sonuç — dürüst durum:** Model sunucusu ile ERP arasında **çalışan bir SSO
henüz yoktur**. Karar belgesinin kendisi de bunu "KaplanBIM tarafı … henüz
yapılacak iş" olarak işaretlemiştir (karar belgesi §1, §3 "Sonuçlar": Task 2.4).
Aşağıdaki §5, bu boşluğu kapatmanın iki somut yolunu verir; ikisi de **kod
değişikliği** gerektirir ve Task 2.4'e bırakılmıştır. Bu belge, var olmayan
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
3. **Yanlış sır:** Aynı issuer/audience'a sahip ama **farklı `JWT_SECRET`**
   ile imzalanmış bir token. Beklenen: `jwtVerify` imza uyumsuzluğu fırlatır,
   aynı `denied` + `4003` sonucu döner.
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

## 5. Adım adım kurulum — iki yol (ikisi de kod işi, Task 2.4)

Aşağıdaki iki yol birbirinin alternatifidir; hangisi seçilirse seçilsin
**bu depoda henüz yapılmamış bir kod değişikliği** gerektirir. Adlar öneri
değilse açıkça "öneri" olarak işaretlenmiştir; var olan bir anahtar gibi
sunulmamıştır.

### Yol A — Karar belgesinin seçtiği yol: HS256 paylaşılan sır

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

### Yol B — ERP'yi asimetrik (RS256) + JWKS'e çevirmek

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
