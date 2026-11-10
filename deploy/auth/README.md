# Authentik — Tek Kimlik Sağlayıcı (OIDC IdP) Kurulumu

Bu dizin, KaplanBIM (MutinyBIM) model sunucusunun kimlik kaynağı olarak
kullanılacak **Authentik** OIDC kimlik sağlayıcısının (IdP) Docker Compose
yığınını barındırır. Girdi, kimlik kararının güncel hâlidir:
`docs/decisions/2026-11-10-llm-and-sso.md` §3 — **Authentik, özel bir OIDC IdP
olarak RS256 imzalı token üretir ve JWKS uç noktası yayınlar**; KaplanBIM
model sunucusu bu token'ı mevcut `SignInSource { issuer, jwksUrl, audience }`
sözleşmesiyle doğrular. Bu, karar kaydındaki eski "Yol B" (ERP'nin kendisi
JWKS yayınlar) varsayılanını geçersiz kılar.

> **Durum uyarısı (önemli):** Karar bir **varsayılan hükümdür (default
> ruling), firma tarafından teyit edilmemiştir** ("Durum: Taslak"). Firma
> onayı gelene kadar buradaki adımlar **gerçek firma verisiyle üretimde
> çalıştırılmamalıdır**; yalnızca geliştirme/demo amaçlıdır (bkz. karar
> belgesi §1 ve §4).

> **"Bu ortamda doğrulanmadı" işaretleri:** Bu belgede canlı bir sunucu,
> imaj indirme veya Authentik web arayüzü gerektiren adımlar açıkça
> işaretlenmiştir. Bu ortamda imaj indirme/`docker compose up` **yapılmadığından**
> (ayrıca disk ~2,6 GiB boş — imajlar sığmaz) bu adımlar yalnızca kaynak ve
> deploy yapılandırması üzerinden belgelenmiştir; çıktıları burada
> gözlemlenmemiştir.

---

## 1. Bu yığın ne çalıştırır

Authentik'in standart Compose kurulumu — tek imaj, dört servis
(`docker-compose.yml`):

| Servis | İmaj | Görev |
| --- | --- | --- |
| `server` | `ghcr.io/goauthentik/server` | Web/API + gömülü reverse proxy (9000 HTTP / 9443 HTTPS) |
| `worker` | `ghcr.io/goauthentik/server` | Arka plan görevleri (outpost yönetimi vb.) |
| `postgresql` | `postgres:16-alpine` | Authentik'in kendi veritabanı |
| `redis` | `redis:alpine` | Önbellek / kuyruk |

Proje adı `name: authentik` ile sabitlenmiştir; `-p authentik` geçmek gerekmez.

---

## 2. Sır üretimi ve `.env`

`docker-compose.yml`, aynı dizindeki `.env` dosyasını otomatik okur. Zorunlu
değişkenler `:?` kalkanıyla korunur (boşsa compose başlamayı reddeder).

```sh
# 1) Şablonu kopyala
cp deploy/auth/.env.example deploy/auth/.env

# 2) Sırları üret ve yaz (gerçek değerler — ASLA commit etme)
echo "AUTHENTIK_SECRET_KEY=$(openssl rand -hex 32)"          >> deploy/auth/.env
echo "AUTHENTIK_POSTGRESQL__PASSWORD=$(openssl rand -base64 24)" >> deploy/auth/.env
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"          >> deploy/auth/.env
```

> **Önemli:** `AUTHENTIK_POSTGRESQL__PASSWORD` ile `POSTGRES_PASSWORD` **aynı
> değer** olmalıdır (ilki Authentik'in postgres'e bağlanırken kullandığı
> şifre, ikincisi postgres konteynerinin kendi şifresi). En temizi: tek değer
> üretip iki satıra da aynısını yazmak. Şablon dosyasındaki örnek komutlar
> kolaylık içindir; değerleri elle tek bir yerde üretip iki satıra
> yapıştırmak daha güvenlidir.

`AUTHENTIK_SECRET_KEY` üretim komutu görev brief'inde `openssl rand -hex 32`
olarak belirtilmiştir (64 hex karakter — Authentik için fazlasıyla yeterli
entropi). İsterseniz Authentik dokümanındaki `openssl rand -base64 36`
biçimi de kullanılabilir; ikisi de geçerlidir.

---

## 3. Ayağa kaldırma (sunucuda — bu ortamda doğrulanmadı)

```sh
# Sunucuda, repo kökünden:
docker compose -f deploy/auth/docker-compose.yml up -d
# Ardından durumu gözle:
docker compose -f deploy/auth/docker-compose.yml ps
```

İlk açılışta `postgresql` ve `redis` sağlık kontrolünden geçer; `server` ve
`worker` ancak onlar hazır olduktan sonra başlar (`depends_on` +
`condition: service_healthy`).

**Erişim adresleri (varsayılan portlar):**

- Yönetim (admin) arayüzü: `http://<sunucu>:9000/if/admin/`
- Kullanıcı arayüzü: `http://<sunucu>:9000/if/user/`
- Gömülü HTTPS (kendinden imzalı sertifika): `https://<sunucu>:9443`

> **Üretim notu (TLS):** Authentik'in gömülü 9443 sertifikası varsayılan
> olarak kendinden imzalıdır ve tarayıcı uyarısı verir. Firmanın ağına
> açmadan önce, ERP yığınındaki `caddy` örneğinde olduğu gibi (bkz.
> `deploy/erp/docker-compose.prod.yml`), Authentik'i sabit bir alan adının
> arkasına ters vekil (reverse proxy) ile koyup gerçek TLS sonlandırmanız
> önerilir. `issuer` değerinin **tek ve sabit** olması kritiktir (bkz. §6) —
> bu nedenle Authentik'e **her zaman tek bir alan adı üzerinden** ulaşılmalıdır
> (`AUTHENTIK_HOST`/`AUTHENTIK_HOST_BROWSER` gibi eski/ipuçlu değişkenler bu
> dosyada kullanılmamıştır; issuer, Authentik'e ulaşılan URL'den türetilir).

> **`worker` ve Docker soketi:** Standart kurulumda `worker`, Authentik'in
> gömülü outpost'unun konteynerlerini yönetebilmesi için
> `/var/run/docker.sock`'i bağlar ve `user: root` ile çalışır. Outpost'ları
> ayrı/elle yönetiyorsanız bu iki satırı kaldırabilirsiniz; bu bir güvenlik
> tercihidir.

> **Çalışma anında oluşan dizinler:** `media/`, `certs/` ve `custom-templates/`
> dizinleri ilk `up` sırasında oluşturulur (bind mount). Bunlar runtime
> verisidir; commit etmeyin.

---

## 4. İlk açılış (bootstrap) — yönetici hesabı

> **Bu ortamda doğrulanmadı** (canlı Authentik arayüzü gerekir). Adımlar
> Authentik'in resmî ilk kurulum akışından aktarılmıştır.

1. `http://<sunucu>:9000/if/flow/initial-setup/` adresine git (ilk açılışta
   yönlendirilir).
2. **E-posta** ve **şifre** girerek ilk (süper) yönetici hesabını oluştur.
   Bu hesap, admin arayüzüne giriş yapmak içindir; son kullanıcı hesabı
   değildir.
3. Admin arayüzüne (`/if/admin/`) bu hesapla giriş yap.

> Alternatif olarak yönetici, komut satırından şöyle oluşturulabilir:
> `docker compose -f deploy/auth/docker-compose.yml exec server ak create_admin`
> (kimlik bilgilerini sorar). Bu ortamda doğrulanmadı.

---

## 5. KaplanBIM için Provider + Application oluşturma

> **Bu ortamda doğrulanmadı** (canlı Authentik arayüzü gerekir). Adımlar
> Authentik'in OAuth2/OIDC sağlayıcı kurulumundan aktarılmıştır; menü/alan
> adları sürüme göre hafifçe farklı olabilir.

1. **Admin arayüzü → Applications → Providers → Create → OAuth2/OpenID
   Provider** seç.
2. Aşağıdaki alanları doldur:
   - **Name:** ör. `KaplanBIM`
   - **Authentication flow:** `default-provider-authorization-implicit-consent`
     (veya `...-explicit-consent`).
   - **Authorization flow:** `default-provider-authorization-implicit-consent`.
   - **Client type:** `Confidential`.
   - **Redirect URIs/Origins (Regular):** KaplanBIM istemcisinin yönlendirme
     adresi (ör. `https://bim.firma.com.tr/*`). KaplanBIM model sunucusu
     yalnızca token **doğrular**, token değiş-tokuşu yapmaz; bu alan asıl
     olarak KaplanBIM ön yüzünde oturum açma akışı kurulursa kullanılır.
   - Diğer alanları varsayılan bırak. Kaydet.
3. Kaydedince Authentik bir **Client ID** (hex bir dize) ve (confidential
   tipte) bir **Client Secret** üretir. KaplanBIM için gerekli olan yalnızca
   **Client ID**'dir (bkz. §6).
4. **Applications → Applications → Create → Name:** ör. `KaplanBIM`,
   **Slug:** ör. `kaplanbim` (bu, issuer URL'sinin bir parçası olur),
   **Provider:** az önce oluşturduğun sağlayıcı. Kaydet.

---

## 6. issuer / jwksUrl / audience değerlerini okuma

Oluşturduğun uygulamanın **slug**'ı (ör. `kaplanbim`) ve **Client ID**'si
üzerinden üç değer şöyle türetilir (`<auth-domain>` = Authentik'e ulaşılan
sabit alan adı, ör. `auth.firma.com.tr`):

| KaplanBIM anahtarı | Değer |
| --- | --- |
| issuer | `https://<auth-domain>/application/o/<slug>/` |
| jwksUrl | `https://<auth-domain>/application/o/<slug>/jwks/` |
| audience | **Client ID** (Authentik admin arayüzünden okunur) |

Örnek (slug `kaplanbim`, domain `auth.firma.com.tr`):

- issuer = `https://auth.firma.com.tr/application/o/kaplanbim/`
- jwksUrl = `https://auth.firma.com.tr/application/o/kaplanbim/jwks/`
- audience = `<Client ID>` (ör. `aB3x...9z` gibi hex bir dize)

**Doğrulama yöntemi (sunucuda):** discovery belgesi bu üçünün kaynağıdır:

```sh
curl -fsS https://<auth-domain>/application/o/<slug>/.well-known/openid-configuration
```

Bu belge `issuer` alanını ve `jwks_uri` değerini döner — bunlar yukarıdaki
iki URL ile birebir eşleşmelidir. `audience` (Client ID), üretilen token'ın
`aud` claim'ine girer; doğru değer Authentik admin arayüzündeki **Client ID**'dir.
Bu ortamda doğrulanmadı.

> **Kritik — issuer tekliği:** Token'ın `iss` claim'i, Authentik'e ulaşılan
> URL'den türetilir. Kullanıcı bir gün `http://sunucu:9000`, başka gün
> `https://auth.firma.com.tr` üzerinden girerse `iss` farklı olur ve KaplanBIM
> token'ı reddeder ("Sign-in from an unknown issuer"). Bu yüzden Authentik'e
> **tek ve sabit** bir URL üzerinden ulaşın (bkz. §3 üretim notu).

---

## 7. KaplanBIM model sunucusunu bağlama

Authentik tarafı hazır olduğunda, KaplanBIM model sunucusunun okuduğu env
anahtarları şunlardır (anahtar adları `services/bim-authority/src/host/single-user.ts`
ve `src/host/load.ts` içinde doğrulanmıştır — uydurulmamıştır):

```
MUTINYBIM_AUTHORIZER_MODULE=./src/host/single-user.ts
MUTINYBIM_SINGLE_USER_ID=<token'ın sub claim'i (Authentik kullanıcısının sub'ı)>
MUTINYBIM_SINGLE_USER_ISSUER=https://<auth-domain>/application/o/<slug>/
MUTINYBIM_SINGLE_USER_JWKS_URL=https://<auth-domain>/application/o/<slug>/jwks/
MUTINYBIM_SINGLE_USER_AUDIENCE=<Client ID>
```

Notlar:

- `MUTINYBIM_SINGLE_USER_AUDIENCE` **boş bırakılmamalıdır**; `single-user.ts`
  içindeki varsayılanı `"authenticated"`'dir (Supabase tarzı) ve Authentik
  token'ının `aud` claim'i Client ID olduğu için varsayılanla **eşleşmez**.
  Authentik'te bu anahtar `Client ID`'ye ayarlanmalıdır.
- `MUTINYBIM_SINGLE_USER_ID`, token'ın `sub` claim'iyle birebir eşleşmelidir
  (yoksa `single-user` authorizer herkesi reddeder). Authentik'te `sub`
  genellikle kullanıcının UUID'sidir; kesin değeri üretilen bir token'ın
  payload'ından (veya sağlayıcının "Subject mode" ayarına göre) okumak
  gerekir.
- Bu anahtarların nasıl üretime bağlandığı ve "yeni doğrulama kodu
  yazılmadığı" ayrıntısı için `deploy/sso/README.md`'ye bakın.

---

## 8. Dürüst durum ve kapsam dışı işler

- **Bu ortamda hiçbir adım canlı çalıştırılmadı:** `docker compose up`
  yapılmadı (imajlar indirilmedi; disk ~2,6 GiB boş olduğundan sığmaz).
  Yalnızca `docker compose ... config -q` ile sözdizimi doğrulandı. §4–§6
  adımlarının çıktıları gözlemlenmemiştir.
- **ERP tarafı kapsam dışı:** OpenConstructionERP bugün kendi **HS256
  `JWT_SECRET`** paylaşılan-sır token'ıyla oturum açar (`deploy/erp/.env.example`,
  `deploy/erp/docker-compose.prod.yml`) ve Authentik'i henüz tanımaz. ERP'nin
  Authentik'i OIDC IdP olarak kabul etmesi (tek-kimlik hedefine ERP tarafından
  ulaşılması) ERP backend'inde yapılacak ayrı bir entegrasyondur ve **bu depo
  kapsamı dışındadır** (bkz. `deploy/sso/README.md` §5).
- **Çalışan SSO henüz teslim edilmedi:** Authentik kurulup KaplanBIM host
  eklentisi bağlanmadan iki sistem arasında uçtan uca kimlik çalışmaz.
- Karar hâlâ "Taslak" durumundadır; firma onayı gelmeden gerçek firma
  verisiyle üretime alınmamalıdır (`docs/decisions/2026-11-10-llm-and-sso.md`
  §4).
