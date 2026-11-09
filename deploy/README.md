# OpenConstructionERP — kurulum, HTTPS ve yedekleme runbook'u

Bu belge, KaplanBIM inşaat platformu entegrasyonunun **Faz 0 / Görev 0.1**
çıktısıdır: OpenConstructionERP'yi (sistemin kaydı — Postgres 16 + FastAPI +
React) tek bir Linux sunucusunda, HTTPS arkasında, üretim modunda ayağa
kaldırma ve yedekleme/geri yükleme prosedürü. Tek kişinin yapabileceği
basitlikte tutulmuştur (bkz. tasarım dokümanı § Kısıtlar #7).

İlgili dosyalar:
- `deploy/erp/docker-compose.prod.yml` — upstream'in üretim compose dosyası +
  HTTPS ters vekili (Caddy). Dosyanın başındaki yorum, upstream'den farkları
  listeler.
- `deploy/erp/.env.example` — sır/ayar şablonu. Gerçek `.env` **asla**
  commit edilmez (kök `.gitignore`'da `.env` ve `.env.*` hariç tutulur).

> **Bu ortamda doğrulanamayanlar.** Bu runbook, görev kapsamında bir
> OpenConstructionERP sunucusu fiilen ayağa kaldırılmadan yazıldı (gerekli
> disk alanı ve sunucu bu geliştirme ortamında yok — sadece ~6.3 GB boş disk
> var, `make quickstart`/imaj indirme bunu aşar). Doğrulanan tek şey:
> `docker compose -f deploy/erp/docker-compose.prod.yml config -q` ile YAML'ın
> sözdizimi ve zorunlu değişken kontrolleri (imaj indirmeden/çekmeden).
> Aşağıdaki adımların geri kalanı gerçek bir sunucuda çalıştırılıp
> doğrulanmalı; "Beklenen" satırları bunun için bir kabul kriteri listesidir.

---

## 0. Önemli: bu compose dosyası nereye konur?

`deploy/erp/docker-compose.prod.yml`, upstream OpenConstructionERP
deposundaki `docker-compose.prod.yml`'in üzerine HTTPS katmanı eklenmiş
hâlidir. `backend`/`frontend` servisleri `build: context: .` ile **kendi
deposunun kökünden** (`deploy/docker/Dockerfile.unified`,
`deploy/docker/Dockerfile.frontend`) imaj inşa eder — bu, KaplanBIM
deposunun kökü değil, OpenConstructionERP checkout'unun köküdür.

Bu yüzden sunucuda şu yerleşim kullanılır:

```
/opt/openconstructionerp/              ← OpenConstructionERP git checkout'u
├── docker-compose.prod.yml            ← KaplanBIM'deki deploy/erp/docker-compose.prod.yml KOPYASI
├── .env                               ← KaplanBIM'deki deploy/erp/.env.example'dan türetilen gerçek sırlar
├── deploy/docker/Dockerfile.unified   ← upstream'in kendi dosyası (değişmez)
└── ...
```

Tüm komutlar `/opt/openconstructionerp` içinden, bu iki dosya oraya
kopyalandıktan sonra çalıştırılır. Kolaylık için bir alias:

```bash
alias oe='docker compose -p openconstructionerp -f docker-compose.prod.yml --env-file .env'
```

(`-p openconstructionerp` proje adını sabitler; aksi hâlde Compose proje adını
dizin adından türetir ve taşınırsa birim/konteyner adları değişebilir.)

---

## 1. Sunucu ön koşullarını doğrula

```bash
docker compose version && git --version && make --version
```

**Beklenen:** Compose v2 (v2.24+ önerilir — bu dosya gömülü `configs:
content:` kullanır, bkz. not aşağıda), Git ve GNU Make sürümleri basılır.

> **Eski Docker Compose.** `configs: ... content:` (gömülü Caddyfile) Docker
> Compose v2.24'ten (2024) öncesinde desteklenmez. `docker compose version`
> daha eskiyse: Compose'u güncelleyin **veya** aşağıdaki içeriği elle
> `/opt/openconstructionerp/Caddyfile` olarak yazıp
> `docker-compose.prod.yml`'deki `caddy.configs:` bloğunu
> `caddy.volumes: - ./Caddyfile:/etc/caddy/Caddyfile:ro` ile değiştirin:
> ```caddyfile
> {
>     email {$ACME_EMAIL}
> }
> {$DOMAIN} {
>     encode zstd gzip
>     reverse_proxy frontend:80
> }
> ```

---

## 2. OpenConstructionERP'yi klonla ve (isteğe bağlı) demo ile dene

```bash
git clone --depth 1 https://github.com/datadrivenconstruction/OpenConstructionERP.git /opt/openconstructionerp
cd /opt/openconstructionerp
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)" >  .env
echo "JWT_SECRET=$(openssl rand -hex 32)"           >> .env
make quickstart
```

**Beklenen:** `http://localhost:8080` açılır; giriş ekranında demo hesaplar
(`demo@openconstructionerp.com` vb.) görünür. Bu adım yalnızca kurulumun
genel olarak çalıştığını doğrulamak içindir — **üretimde kullanılmaz**
(`docker-compose.quickstart.yml` dosyasının kendisi "EVALUATION / LOCAL-DEMO
ONLY — NOT FOR PRODUCTION" uyarısı taşır).

Bitirince, **yalnızca konteynerleri durdurmak yetmez** — `pg_data`/`app_data`
birimlerini de silin. Aksi hâlde demo verisiyle dolu bu birimler üretim
yığınına da taşınabilir: `make quickstart-down` konteynerleri durdurur ama
birimleri bırakır; § 3.3'te üretim için kullanılan `-p openconstructionerp`,
Compose'un `make quickstart` için varsayılan olarak dizin adından türettiği
proje adıyla (`openconstructionerp`) **aynıdır**, dolayısıyla birim adları da
(`openconstructionerp_pg_data` vb.) çakışır — `SEED_DEMO=false` yalnızca
*zaten boş* bir veritabanında yeni demo satırı eklenmesini engeller, mevcut
demo hesaplarını silmez. Bu yüzden `quickstart-down` yerine, verileri de
silen `quickstart-reset` kullanın:

```bash
make quickstart-reset   # docker compose -f docker-compose.quickstart.yml down -v — pg_data + app_data birimlerini de siler
```

Bu adımı atlamak isterseniz, demo denemesini (§ 2) üretim sunucusunda hiç
çalıştırmayın — ayrı bir makinede/VM'de deneyip üretim sunucusuna yalnızca
§ 3'ten başlayın.

---

## 3. Üretim yapılandırmasına geç (HTTPS, demo kapalı)

### 3.1 Sır üretimi

Adım 2'deki `.env`'i tekrar kullanmayın (quickstart'a özeldi); üretim için
ayrı ve kalıcı bir `.env` yazın:

```bash
cd /opt/openconstructionerp
rm -f .env   # quickstart'tan kalan varsa

echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)" >  .env
echo "JWT_SECRET=$(openssl rand -hex 32)"           >> .env
echo "DOMAIN=erp.firmaniz.com.tr"                    >> .env
echo "ACME_EMAIL=bilgi-islem@firmaniz.com.tr"        >> .env
echo "ALLOWED_ORIGINS=https://erp.firmaniz.com.tr"   >> .env
echo "SEED_DEMO=false"                               >> .env
chmod 600 .env
```

Alternatif olarak `KaplanBIM/deploy/erp/.env.example`'ı bu dizine
`.env` adıyla kopyalayıp değerleri elle doldurabilirsiniz — alanların
açıklamaları orada yorum olarak mevcuttur.

`POSTGRES_PASSWORD` ve `JWT_SECRET` değerleri bu görevin arayüzüdür: sonraki
görevler (API köprüsü, n8n entegrasyonu vb.) bu ERP'ye bağlanırken aynı
`.env`'i (veya içindeki `JWT_SECRET`'le uyumlu bir servis hesabı token'ını)
kullanır. Bu değerleri bir parola yöneticisinde/sır deposunda da saklayın.

### 3.2 Compose ve HTTPS dosyalarını yerleştir

KaplanBIM deposundan sunucuya (ör. `scp` veya `git`'le çekip kopyalayarak):

```bash
cp <KaplanBIM>/deploy/erp/docker-compose.prod.yml /opt/openconstructionerp/docker-compose.prod.yml
```

`DOMAIN` genel DNS üzerinden bu sunucuya çözülmelidir (Let's Encrypt HTTP-01
doğrulaması için sunucunun 80 ve 443 portları İnternet'ten erişilebilir
olmalı).

#### Firma içi (genel DNS/İnternet erişimi olmadan) HTTPS

Sunucu yalnızca firma içi ağdaysa (genel DNS kaydı yok, Let's Encrypt
ulaşamaz), gömülü Caddyfile'da `{$DOMAIN} { ... }` bloğuna `tls internal`
ekleyin — Caddy kendi dahili CA'sıyla imzalı bir sertifika üretir
(tarayıcı "güvenilmeyen sertifika" uyarısı verir, bir kerelik istisna
eklenir; trafik yine de uçtan uca şifrelenir):

```bash
# docker-compose.prod.yml içindeki configs: caddyfile: content: bloğunu
# düzenleyip şu satırı ekleyin (reverse_proxy satırının altına):
#     tls internal
```

### 3.3 Ayağa kaldır

```bash
cd /opt/openconstructionerp
alias oe='docker compose -p openconstructionerp -f docker-compose.prod.yml --env-file .env'
oe up -d --build
oe ps
oe logs -f backend   # ^C ile çık
```

**Beklenen:** `oe ps` içinde `postgres`, `backend`, `frontend`, `caddy`
`healthy`/`running` görünür. `https://<DOMAIN>` tarayıcıda açılır, sertifika
geçerlidir (veya firma-içi modda dahili CA uyarısıyla açılır), giriş
ekranında **demo hesap görünmez** (`SEED_DEMO=false`). `http://<DOMAIN>`
otomatik olarak `https://`'ye yönlenir (Caddy'nin varsayılan davranışı).
`http://<sunucu-ip>:8080` veya `:80` üzerinden **doğrudan** erişim
**olmamalıdır** — `frontend` artık host'a port yayınlamaz, yalnızca
`caddy` üzerinden erişilir.

Sorun giderme: `https://<DOMAIN>` açılır ama giriş sonrası boş ekran —
`ALLOWED_ORIGINS` tarayıcının gördüğü kökle (DOMAIN ile) birebir
uyuşmuyordur; `.env`'de düzeltip `oe up -d` ile yeniden başlatın
(ayrıntı: upstream `deploy/docker/README.md` § "allowed origin").

---

## 4. Yedekleme ve geri yükleme

### 4.1 Yedek al (`pg_dump`)

```bash
cd /opt/openconstructionerp
alias oe='docker compose -p openconstructionerp -f docker-compose.prod.yml --env-file .env'

mkdir -p backups
set -a; source .env; set +a   # POSTGRES_USER/POSTGRES_DB .env'de yoksa varsayılanlar (oe/openestimate) kullanılır
TS=$(date +%Y%m%d-%H%M%S)
oe exec -T postgres pg_dump -U "${POSTGRES_USER:-oe}" -d "${POSTGRES_DB:-openestimate}" \
  | gzip > "backups/openestimate-${TS}.sql.gz"
```

**Beklenen:** `backups/openestimate-<tarih>.sql.gz` oluşur ve boyutu sıfırdan
büyüktür (`gzip -l` veya `ls -lh` ile kontrol edin).

Düzenli yedek için bir cron satırı (her gece 03:00, 14 günden eski yedekleri
siler):

```cron
0 3 * * * cd /opt/openconstructionerp && set -a && . ./.env && set +a && docker compose -p openconstructionerp -f docker-compose.prod.yml --env-file .env exec -T postgres pg_dump -U "${POSTGRES_USER:-oe}" -d "${POSTGRES_DB:-openestimate}" | gzip > backups/openestimate-$(date +\%Y\%m\%d).sql.gz && find backups -name '*.sql.gz' -mtime +14 -delete
```

Ayrıca `app_data` biriminde (OE_DATA_DIR, BIM geometrisi/vektör verisi) ve
Caddy'nin `caddy_data` biriminde (TLS sertifikaları — Let's Encrypt rate
limit'ine takılmamak için) de yedek alınması önerilir:

```bash
docker run --rm -v openconstructionerp_app_data:/data -v "$PWD/backups":/backup \
  alpine tar czf "/backup/app_data-${TS}.tar.gz" -C /data .
```

### 4.2 Temiz bir Postgres'e geri yükle

Bu adım, felaket kurtarma senaryosunu (yeni/boş bir sunucu) simüle eder:

```bash
cd /opt/openconstructionerp
alias oe='docker compose -p openconstructionerp -f docker-compose.prod.yml --env-file .env'

# 1) Durdur, veritabanı birimini sıfırla (DİKKAT: pg_data'yı siler)
oe down
docker volume rm openconstructionerp_pg_data

# 2) Yalnızca postgres'i başlat, sağlıklı olmasını bekle
oe up -d postgres
until oe exec -T postgres pg_isready -U "${POSTGRES_USER:-oe}" -d "${POSTGRES_DB:-openestimate}"; do sleep 2; done

# 3) Yedeği yükle
gunzip -c backups/openestimate-<TARIH>.sql.gz \
  | oe exec -T postgres psql -U "${POSTGRES_USER:-oe}" -d "${POSTGRES_DB:-openestimate}"

# 4) Kalan servisleri başlat
oe up -d --build
```

**Beklenen:** `oe up -d --build` sonrası uygulama `https://<DOMAIN>` üzerinde
açılır, geri yüklenen projeler/kullanıcılar görünür ve giriş çalışır. Yeni
sunucuya taşıma ise aynı prosedür + adım 4.1'deki `app_data` tar
arşivinin de geri yüklenmesidir (`docker run ... tar xzf ... -C /data`).

> `pg_dump`/`pg_restore` ikilisi yerine düz `psql` kullanılmasının nedeni:
> tek dosyalık düz SQL formatı, versiyon/araç bağımsız ve elle okunabilir
> olduğu için tek kişilik operasyonlarda en az sürpriz veren yoldur.

---

## 5. Güncelleme (upgrade)

```bash
cd /opt/openconstructionerp
alias oe='docker compose -p openconstructionerp -f docker-compose.prod.yml --env-file .env'

# 0) Önce yedek al (bkz. § 4.1) — her güncellemeden önce zorunlu adım.
# 1) Upstream'in yeni sürümünü çek
git fetch --tags
git checkout <yeni-surum-etiketi>   # ör. v6.8.0 — CHANGELOG/release notlarını okuyun

# 2) docker-compose.prod.yml'in upstream'de değişip değişmediğini kontrol edin
#    (KaplanBIM/deploy/erp/docker-compose.prod.yml ile upstream'in yeni
#    sürümdeki dosyasını karşılaştırın; HTTPS/SEED_DEMO eklerini yeni
#    upstream sürümüne yeniden uygulayıp KaplanBIM deposuna da işleyin).

# 3) Yeniden inşa et ve taşımaları (migration) çalıştır
oe build
oe up -d
oe exec backend alembic upgrade head   # backend container'ı başlangıçta zaten çalıştırır; emin olmak için tekrar
oe ps
```

**Beklenen:** Tüm servisler `healthy`, `GET /api/health` yeni sürüm numarasını
döndürür, mevcut veriler (projeler, kullanıcılar, BOQ) korunur. Bir sorun
çıkarsa: `git checkout <önceki-etiket>`, `oe build && oe up -d`, gerekirse
§ 4.2 ile bir önceki yedeği geri yükleyin.

---

## 6. Özet: değişkenlerin akışı

`deploy/erp/.env` içindeki `POSTGRES_PASSWORD` ve `JWT_SECRET`, bu görevin
(0.1) ürettiği ve sonraki görevlere (IFC köprüsü, API köprüsü, n8n) girdi
olan iki değerdir — ERP'nin veritabanı erişimi ve oturum/JWT imzalama
anahtarı. Bu değerleri değiştirmek (rotasyon) tüm bağımlı servislerin
yeniden başlatılmasını gerektirir.

---

## 7. Türkiye Birim Fiyat maliyet tabanını yükleme

Bu bölüm, **Görev 0.2**'nin çıktısıdır: OpenConstructionERP'nin gömülü CWICR
(DataDrivenConstruction) maliyet veritabanından Türkiye "Birim Fiyat" ulusal
tabanını (`TR_NATIONAL`) yükleme ve doğrulama prosedürü.

**Kaynak (uydurulmamıştır — doğrudan alınmıştır):** DDC Skills deposu,
https://github.com/datadrivenconstruction/DDC_Skills_for_AI_Agents_in_Construction ,
`main` dalı, commit `410ed1e71e4a5c6fd231afd0c8d1e586a9f546e8` (2026-11-09'da
çekildi):
- `6_OpenConstructionERP/oce-load-cost-bases/SKILL.md` — yükleme/doğrulama/
  sorun giderme komutları.
- `6_OpenConstructionERP/oce-platform-overview/SKILL.md` — kimlik doğrulama
  modeli (JWT, bootstrap admin) ve modül/uç nokta haritası.

> **Bu ortamda doğrulanmadı.** § başındaki genel notla aynı gerekçeyle: bu
> adımlar canlı, § 3'teki gibi ayağa kaldırılmış bir OpenConstructionERP
> sunucusu gerektirir. Aşağıdaki komutlar yukarıdaki DDC Skill
> dosyalarından alınmıştır; bu depoda fiilen çalıştırılıp çıktıları
> (JSON yanıtlar, kalem sayıları, TL fiyatlar) gözlemlenmemiştir.

### 7.0 Ön koşullar

- § 3'teki üretim yığını ayakta olmalı (`oe ps` içinde tüm servisler
  `healthy`); `POSTGRES_PASSWORD` ve `JWT_SECRET` `.env`'de tanımlı.
- `backend` servisi host'a port açmaz (yalnızca `expose: 8000`) — bu yüzden
  API çağrıları `oe exec backend ...` ile konteyner içinden yapılır. (`caddy`
  yalnızca `frontend`'e vekillik eder; `frontend`'in `/api`'yi ayrıca
  `backend:8000`'e ilettiği bu depoda doğrulanmamıştır — upstream
  `Dockerfile.frontend`/nginx yapılandırması bu KaplanBIM deposunda yoktur,
  bkz. § 0. Üretimde doğrulanırsa aşağıdaki komutlar
  `curl https://<DOMAIN>/api/...` ile de yazılabilir.)
- HTTP çağrıları için `curl`'ün `backend` imajında bulunduğu **doğrulanmamıştır**
  (compose'daki `backend` healthcheck'i kasıtlı olarak `curl` değil
  `python -c "import urllib.request; ..."` kullanıyor — bkz.
  `docker-compose.prod.yml`, bu da imajda `curl` olmayabileceğine işaret
  eder). Bu yüzden aşağıdaki örnekler, varlığı healthcheck'ten **doğrulanmış**
  olan `python3` ile yazılmıştır.
- Yetkilendirme: API JWT tabanlı oturum ve rol (viewer/editor/manager/admin)
  kullanır (`oce-platform-overview` SKILL.md — bu genel platform ifadesidir;
  `oce-load-cost-bases` SKILL.md'nin kendisi `costs`/`catalog` uç noktaları
  için auth zorunluluğunu açıkça yazmaz, bu adım o genel kuraldan
  **çıkarsanmıştır**, doğrulanmamıştır). Üretimde `SEED_DEMO=false`
  olduğundan demo hesap yoktur; **ilk kaydolan kullanıcı otomatik admin
  olur** ("bootstrap admin"). Daha önce hiç kullanıcı oluşturulmadıysa:

```bash
cd /opt/openconstructionerp
alias oe='docker compose -p openconstructionerp -f docker-compose.prod.yml --env-file .env'

# Tüm API çağrıları için ortak yardımcı (curl yerine doğrulanmış python3 ile):
oe_api() {
  local method="$1" path="$2" body="${3:-}"
  oe exec -T backend python3 - "$method" "$path" "${TOKEN:-}" "$body" <<'PY'
import sys, urllib.request, urllib.error
method, path, token, body = sys.argv[1:5]
req = urllib.request.Request(f"http://localhost:8000{path}", method=method,
                              data=body.encode() if body else None)
req.add_header("Content-Type", "application/json")
if token:
    req.add_header("Authorization", f"Bearer {token}")
try:
    print(urllib.request.urlopen(req).read().decode())
except urllib.error.HTTPError as e:
    sys.stderr.write(f"HTTP {e.code}: {e.read().decode()}\n")
    sys.exit(1)
PY
}

oe_api POST /auth/register '{"email":"admin@firmaniz.com.tr","password":"<guclu-parola>","full_name":"ERP Admin"}'
TOKEN=$(oe_api POST /auth/login '{"email":"admin@firmaniz.com.tr","password":"<guclu-parola>"}' \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
```

**Beklenen:** `/auth/register` ilk kullanıcıyı admin rolüyle oluşturur;
`/auth/login` bir JWT `access_token` döner; `$TOKEN`, aşağıdaki tüm
`costs`/`catalog` çağrılarında `oe_api` tarafından `Authorization: Bearer`
başlığı olarak otomatik eklenir. Bir admin zaten varsa `/auth/register`
adımını atlayıp doğrudan `/auth/login` ile devam edin.

### 7.1 `TR_NATIONAL` tabanını yükle

```bash
oe_api POST /api/v1/costs/load-cwicr/TR_NATIONAL
```

DDC Skill'e göre bu çağrı:
- Yerel `WORLD_COST_BASES` dizinini, önbelleği, gömülü (bundled) dizini ve
  son çare olarak GitHub indirmesini sırayla dener; `TR_NATIONAL` parquet'ini
  bulur — **Türkiye (Birim Fiyat, ÇŞB + 10 kurum), 22.704 kalem, TRY,
  fiyatlandırılmış** (DDC'nin 8 ulusal tabanından biri).
- Satırları `rate_code` ile gruplar (her iş kalemi için bir kayıt, bileşenler
  `components[]` içinde inline).
- **Idempotenttir**: `(code, region)` çiftine göre; ikinci çağrıda
  `{"status": "already_loaded", ...}` döner — tekrar çalıştırmak güvenlidir.
- Yükleme sonrası backend, bölgenin metnini tabanın anadil parquet'ine
  (`TR___DDC_CWICR/TR_tr_...`) çevirir — kalem adları doğrudan Türkçe
  görünür.

**Beklenen:** `{"status": "loaded", ...}` (veya zaten yüklenmişse
`"already_loaded"`) içeren bir JSON yanıtı.

### 7.2 (İsteğe bağlı) Kaynak kataloğunu içe aktar

İşçilik/malzeme/makine birim fiyatlarının ayrı bir kaynak fiyat sayfasından
gelmesi isteniyorsa:

```bash
oe_api POST /api/v1/catalog/import/TR_NATIONAL
```

`DDC_CWICR_TR_Catalog.csv` dosyasını okur (`resource_code, name, type,
category, unit, price_avg, price_min, price_max, currency, usage_count` +
sınıflandırma hiyerarşisi `specifications` alanında korunur).

### 7.3 Doğrulama

> **Görev arayüzü ile gerçek API arasındaki fark.** Görev tanımında önerilen
> `GET /api/v1/costs/regions` ve `GET /api/v1/costs/items?region=TR&query=...`
> uç noktaları, DDC Skill'in fiilen belgelediği uç noktalarla **birebir
> eşleşmiyor** — bunlar bir ön tahmindi. Aşağıdakiler SKILL.md'den alınan
> **gerçek** uç noktalardır: bölge kimliği `TR` değil `TR_NATIONAL`
> (DDC'nin `^[A-Z]{2,3}_[A-Z0-9]+$` biçimi), sorgu parametresi `query`
> değil `q`, ve "bölgeler" listesi `regions` değil `regions/stats/`'tır.

```bash
# 1) Bölge başına kalem sayısı — TR_NATIONAL burada görünmeli (~22.704)
oe_api GET /api/v1/costs/regions/stats/

# 2) Bilinen bir kalemi ara — ör. beton C25/30
oe_api GET "/api/v1/costs/?region=TR_NATIONAL&q=C25%2F30&limit=5"

# 3) Kalem detayını çek (yukarıdaki yanıttan bir "id" alın) — birim fiyat
#    ve bileşenler (işçilik/malzeme/makine) burada görünür
oe_api GET /api/v1/costs/<id>

# 4) Sınıflandırma ağacını doğrula
oe_api GET "/api/v1/costs/category-tree/?region=TR_NATIONAL"
```

**Beklenen:**
- (1) yanıtında `TR_NATIONAL` bölgesi için kalem sayısı `22704` civarında
  görünür (DDC veri sürümüne göre küçük sapmalar olabilir).
- (2) beton C25/30 ile eşleşen en az bir kalem döner; yanıttaki `currency`
  alanı `TRY`, birim fiyat alanı (`rate`/`total_cost_per_position`) sıfırdan
  büyük bir sayıdır — **belirli bir TL rakamı burada garanti edilmez**
  (DDC veri sürümüne göre değişir), yalnızca pozitif ve TRY cinsinden
  olması beklenir.
- (3) `components[]` dizisinde en az bir işçilik/malzeme/makine satırı
  görünür (`is_labor`/`is_material`/`is_machine` bayraklarından biri true).
- (4) `TR_NATIONAL` için boş olmayan bir kategori ağacı
  (collection/department/section/subsection/category) döner.

Başarılı bir yükleme ve doğrulamadan sonra görev arayüzünün beklediği
sonuç fiilen şu şekilde karşılanmış olur: ERP `costs` modülünde aktif bir
Türkiye bölgesi (`TR_NATIONAL`) ve bilinen bir kalemde TL birim fiyatı.

### 7.4 Sorun giderme (DDC Skill'den)

- **404 "not found"** → yerel parquet yok ve GitHub indirmesi başarısız;
  `~/.openestimator/cache/{db_id}.parquet`'i ve konteynerin dış ağ erişimini
  kontrol edin (`oe exec backend sh -c 'ls -la ~/.openestimator/cache/ 2>&1'`).
- **Boş `currency` alanı** → bölge, para birimi eşlemesinde yok; düzeltme
  OpenConstructionERP kod tabanında (`cwicr_v3_catalogue.py` →
  `_REGION_CURRENCY`) yapılır, bu KaplanBIM deposunda değil.
- **Katsayı tabanı `rate 0` gösteriyor** → bu yalnızca fiyatlandırılmamış
  taban olan VN_NATIONAL/ID_NATIONAL için normaldir; **TR_NATIONAL
  fiyatlandırılmış bir tabandır**, orada `rate 0` görmek yüklemenin
  eksik/bozuk olduğunu gösterir — § 7.1'i tekrarlayın (idempotent olduğu
  için güvenlidir).
- **Yinelenen satırlar** → içe aktarıcı `(code, region)`'a göre birleştirir;
  aynı kod için birden fazla fiyat katmanı varsa yalnızca ilki tutulur.

> Not: DDC CWICR koleksiyonu Türkiye dışında 7 ulusal taban daha (Çin,
> Brezilya, İspanya, İtalya, Yunanistan, Vietnam, Endonezya) ve 30 küresel
> piyasa (CIS/GESN-FER-TER ailesi) içerir; aynı `load-cwicr/{region_id}` uç
> noktasıyla yüklenirler. Bir tabanı başka bir piyasaya (PPP) yeniden
> fiyatlandırma akışı `GET /api/v1/costs/base-catalog` ile piyasa kartı
> seçimini içerir — bu görevin kapsamı dışındadır, ayrıntı için
> `oce-load-cost-bases` SKILL.md'ye bakın.
