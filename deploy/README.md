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
