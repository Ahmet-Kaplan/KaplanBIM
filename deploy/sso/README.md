# Tek Kimlik (SSO) Kurulumu — Authentik + KaplanBIM

Bu belge, KaplanBIM'in (MutinyBIM) model sunucusunu **Authentik** OIDC kimlik
sağlayıcısına (IdP) bağlamanın yolunu adım adım yazar. Girdi, kimlik
sağlayıcı (idP) kararının güncel hâlidir:
`docs/decisions/2026-11-10-llm-and-sso.md` §3.

> **Durum uyarısı (önemli):** O karar bir **varsayılan hükümdür (default
> ruling), firma tarafından teyit edilmemiştir** ("Durum: Taslak"). Firma
> onayı gelene kadar buradaki adımlar **gerçek firma verisiyle üretimde
> çalıştırılmamalıdır**; yalnızca geliştirme/demo amaçlıdır (bkz. karar
> belgesi §1 ve §4).

> **"Bu ortamda doğrulanmadı" işaretleri:** Bu belgede canlı bir sunucu veya
> imaj indirme gerektiren adımlar açıkça işaretlenmiştir. Bu ortamda imaj
> indirme/`docker compose up` yapılmadığından bu adımlar yalnızca kaynak kodu
> ve deploy yapılandırması üzerinden belgelenmiştir; çıktıları burada
> gözlemlenmemiştir.

---

## 1. Seçilen kimlik modeli

**Karar:** **Authentik**, özel (dedicated) bir OIDC IdP olarak kurulur;
token'ları **RS256 (asimetrik)** ile imzalar ve bir **JWKS uç noktası**
yayınlar. KaplanBIM'in model sunucusu, mevcut `SignInSource { issuer, jwksUrl,
audience }` sözleşmesiyle bu token'ı doğrular
(`docs/decisions/2026-11-10-llm-and-sso.md` §3). Bu, karar kaydındaki eski
**"Yol B" (ERP'nin kendisi JWKS yayınlar)** varsayılanını **geçersiz kılar**;
kimlik artık ERP'de değil, özel bir IdP olan Authentik'te üretilir.

Authentik **tam bir OIDC protokolüdür**: discovery endpoint
(`.well-known/openid-configuration`), OAuth2 authorization-code akışı ve
çoklu-istemci token yönetimi sağlar. Authentik'in standart OIDC URL'leri
şu biçimdedir (`<auth-domain>` = Authentik'e ulaşılan sabit alan adı,
`<slug>` = uygulama slug'ı):

- issuer = `https://<auth-domain>/application/o/<slug>/`
- jwksUrl = `https://<auth-domain>/application/o/<slug>/jwks/`
- discovery = `https://<auth-domain>/application/o/<slug>/.well-known/openid-configuration`
- audience = Authentik **Client ID** (token'ın `aud` claim'i)

### Kimliğin "tek" olması için gerekenler

1. **İmza** — Authentik token'ı **RS256** ile imzalar; özel anahtar yalnızca
   Authentik'te kalır.
2. **JWKS uç noktası** — Authentik, genel anahtarı içeren JWKS uç noktası
   yayınlar; KaplanBIM `SignInSource.jwksUrl` ile oradan okur.
3. **issuer/audience** — token'ın `iss` ve `aud` claim'leri, KaplanBIM
   tarafında yapılandırılan `SignInSource { issuer, audience }` değerleriyle
   birebir eşleşmeli (bkz. §2).

Bunlardan biri uyuşmazsa token reddedilmelidir — asla sessizce kabul
edilmemelidir (bkz. §3).

---

## 2. KaplanBIM model sunucusunu yapılandırma (bulunan gerçek anahtarlar)

Model sunucusu `services/bim-authority/` altındadır. Oturum doğrulama kodu
ve yapılandırma yüzeyi şu dosyalardadır (bu depoda gerçekten bulunan,
uydurulmamış anahtarlar):

| Ayar / dosya | Ne yapar |
| --- | --- |
| `services/bim-authority/src/auth/verify.ts` | `LoginVerifier.verify()`: token'ı doğrular. **Yalnızca JWKS (asimetrik anahtar) ile** — `createRemoteJWKSet(jwksUrl)` + `jwtVerify(token, keys, { issuer, audience })`. |
| `services/bim-authority/src/host/contract.ts` | `SignInSource = { issuer, jwksUrl, audience }` — model sunucusunun kimlik kaynağı sözleşmesi. `supabaseSignIn(url)` yardımcısı, Supabase tarzı bir ES256 kaynağı kurar. |
| `services/bim-authority/src/host/load.ts` | `MUTINYBIM_AUTHORIZER_MODULE` ile adlandırılan host eklentisini (plug-in) yükler; `signIn` alanının `issuer` URL + `jwksUrl` URL + `audience` string olduğunu doğrular. |
| `services/bim-authority/src/host/single-user.ts` | Eksiksiz örnek host eklentisi. Okuduğu env anahtarları: `MUTINYBIM_SINGLE_USER_ID`, `MUTINYBIM_SINGLE_USER_ISSUER`, `MUTINYBIM_SINGLE_USER_JWKS_URL`, `MUTINYBIM_SINGLE_USER_AUDIENCE` (varsayılan `"authenticated"`). |
| `services/bim-authority/src/config.ts` | Model sunucusunun env şeması. İlgili anahtarlar: `MUTINYBIM_AUTHORIZER_MODULE` (host eklentisi) ve `MUTINYBIM_SUPABASE_URL` (yalnızca test oturumları). |
| `deploy/bim/docker-compose.yml` | Yerel yığında `MUTINYBIM_SUPABASE_URL: http://127.0.0.1:9999` ve `MUTINYBIM_LOCAL_STACK: "1"` ile yerel ES256 `signin` servisine işaret eder. |

### Authentik'e bağlanan somut env anahtarları

Authentik tarafı kurulduktan sonra (`deploy/auth/README.md`), KaplanBIM model
sunucusunun okuduğu anahtarlar şunlardır (`single-user.ts` + `load.ts` içinde
doğrulanmış — uydurulmamıştır):

```
MUTINYBIM_AUTHORIZER_MODULE=./src/host/single-user.ts
MUTINYBIM_SINGLE_USER_ID=<token'ın sub claim'i (Authentik kullanıcısının sub'ı)>
MUTINYBIM_SINGLE_USER_ISSUER=https://<auth-domain>/application/o/<slug>/
MUTINYBIM_SINGLE_USER_JWKS_URL=https://<auth-domain>/application/o/<slug>/jwks/
MUTINYBIM_SINGLE_USER_AUDIENCE=<Client ID>
```

> **`MUTINYBIM_SINGLE_USER_AUDIENCE` boş bırakılmamalıdır.** `single-user.ts`
> içindeki varsayılan `"authenticated"` Supabase tarzıdır; Authentik token'ının
> `aud` claim'i **Client ID** olduğundan varsayılanla eşleşmez. Bu anahtar
> Authentik'in Client ID'sine ayarlanmalıdır.

### Kritik bulgu — çalışan SSO henüz yok

Karar belgesinin seçtiği model (Authentik RS256 + JWKS) KaplanBIM model
sunucusunun **zaten desteklediği** modeldir:

- `src/auth/verify.ts` token'ı **yalnızca JWKS ile** (`createRemoteJWKSet` +
  `jwtVerify({ issuer, audience })`) doğrular. `SignInSource` sözleşmesi de
  (`issuer`, `jwksUrl`, `audience`) tam olarak bunu ister.
- `services/bim-authority/` altında `JWT_SECRET` / `JWT_ALGORITHM` adında
  **hiçbir env anahtarı yoktur** (`src/config.ts` şemasında da yoktur) ve
  gerek de yoktur — asimetrik modelde sır yalnızca Authentik'te kalır.

Ancak **iki sistem arasında çalışan bir SSO henüz yoktur**, çünkü:

- **Authentik henüz kurulmamıştır** (bu görevin `deploy/auth/` yığını kurulumu
  belgeler; bu ortamda ayağa kaldırılmamıştır).
- **ERP tarafı Authentik'i tanımaz:** OpenConstructionERP bugün kendi **HS256
  `JWT_SECRET`** paylaşılan-sır token'ıyla oturum açar (`deploy/erp/.env.example`,
  `deploy/erp/docker-compose.prod.yml`) ve tam bir OIDC istemcisi değildir.
  ERP'nin Authentik'i OIDC IdP olarak kabul etmesi, **ERP backend'inde
  yapılacak ayrı bir entegrasyondur ve bu depo kapsamı dışındadır** (bkz. §5).

**Sonuç — dürüst durum:** Model sunucusu tarafı (JWKS/RS256 doğrulama) hazır
olsa da, uçtan uca SSO'nun teslimi **Authentik kurulumu** ve **ERP tarafı
OIDC entegrasyonu** ile tamamlanır. KaplanBIM tarafında yapılacak iş yalnızca
yukarıdaki `MUTINYBIM_SINGLE_USER_*` anahtarlarını döndüren host eklentisini
bağlamaktır; yeni doğrulama kodu yazılmaz. Bu belge, var olmayan env anahtarı
adları icat etmez.

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
Authentik token'ını doğrulayacak **kaynağın henüz bağlanmamış olmasıdır** (§2).

### Somut test (SSO bağlandıktan sonra — bu ortamda doğrulanmadı)

Bu test canlı bir yığın gerektirir; aşağıdaki komutlar §5'teki yapılandırma
tamamlandıktan sonra sunucuda çalıştırılmak üzere yazılmıştır, çıktıları bu
ortamda gözlemlenmemiştir.

1. **Süresi dolmuş token:** Authentik'ten alınan token'ın `exp` süresi
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
kaldırılmalı** ve yerine §2'deki gerçek Authentik token doğrulaması
geçmelidir. `MUTINYBIM_SUPABASE_URL` bir test kolaylığıdır, üretim kimliği
değildir; `MUTINYBIM_LOCAL_STACK=1` de yalnızca dizüstü test içindir ve
`FLY_APP_NAME` set edildiğinde zaten reddedilir (`src/config.ts`).

---

## 5. Adım adım kurulum (Task 2.4)

Karar belgesi **Authentik'i (Seçenek 2)** seçmiştir; eski "Yol B" (ERP'nin
kendisi JWKS yayınlar) ve "Yol A" (HS256 paylaşılan sır) geçersiz
kılınmıştır. KaplanBIM tarafında **yeni doğrulama kodu yazılmaz**; yalnızca
bir host eklentisi bağlanır.

### 1. Authentik'i kur (bu depoda, `deploy/auth/`)

- `deploy/auth/README.md` adımlarını izle: `.env` oluştur, sırları üret
  (`openssl rand -hex 32` vb.), `docker compose -f deploy/auth/docker-compose.yml
  up -d` ile ayağa kaldır, ilk yöneticiyi oluştur, KaplanBIM için bir
  OAuth2/OIDC Provider + Application (slug, ör. `kaplanbim`) oluştur.
- Oradan `issuer`, `jwksUrl` ve `audience` (Client ID) değerlerini oku.
  **Bu ortamda doğrulanmadı** (imaj indirilmedi, yığın ayağa kaldırılmadı).

### 2. KaplanBIM model sunucusunu bağla

`single-user.ts` host eklentisini kopyalayıp (veya doğrudan kullanıp) aşağıdaki
env anahtarlarını üretim dağıtımına ekle (§2'deki değerler):

```
MUTINYBIM_AUTHORIZER_MODULE=./src/host/single-user.ts
MUTINYBIM_SINGLE_USER_ID=<token'ın sub claim'i>
MUTINYBIM_SINGLE_USER_ISSUER=https://<auth-domain>/application/o/<slug>/
MUTINYBIM_SINGLE_USER_JWKS_URL=https://<auth-domain>/application/o/<slug>/jwks/
MUTINYBIM_SINGLE_USER_AUDIENCE=<Client ID>
```

`MUTINYBIM_SUPABASE_URL` ve `MUTINYBIM_LOCAL_STACK` üretimde kaldırılır (§4).
Bu adım, anahtar adlarını `single-user.ts`'ten doğrular; ancak canlı bağlama
bu ortamda yapılmamıştır (doğrulanmadı).

### 3. ERP tarafı — kapsam dışı, açık kalem

OpenConstructionERP bugün kendi **HS256 `JWT_SECRET`** paylaşılan-sır
token'ıyla çalışır ve Authentik'i tanımaz. Tek-kimlik hedefine ERP tarafından
ulaşılması için ERP'nin Authentik'i bir OIDC IdP olarak kabul etmesi (OIDC
authorization-code istemcisi olması) gerekir — **bu, ERP backend'inde
yapılacak bir değişikliktir ve bu depo kapsamı dışındadır; doğrulanmamıştır.**
KaplanBIM tarafının (JWKS/RS256 doğrulama) bu entegrasyondan **bağımsız**
olarak çalışması için yukarıdaki adım yeterlidir.

### Ortak adımlar

- Model sunucusuna yalnızca **Authentik issuer'ı** kabul edecek şekilde host
  eklentisi bağlanır; `MUTINYBIM_SUPABASE_URL` ve `MUTINYBIM_LOCAL_STACK`
  üretimde kaldırılır (§4).
- Yetki (authorization) katmanı ayrı bir konudur: token'ın doğrulanması
  (kimlik) ile kişinin modelde ne yapabileceği (yetki, `ModelAuthorizer`)
  ayrı katmanlardır (`packages/bim-sync/AUTHORIZATION.md`, `src/host/contract.ts`).
  `single-user.ts` tek kişilik (single-seat) bir örnektir; gerçek bir host
  kendi yetki sistemini kişinin token'ıyla sorgular. Bu belge yalnızca kimlik
  (SSO) katmanını kapsar.
- Değişiklik sonrası §3'teki dört test çalıştırılır ve hepsinin "red + net
  mesaj" ürettiği doğrulanır (bu ortamda doğrulanmadı).
