# Firma BlackBox'ı — sınıflandırma, birim faktörleri, montaj tarifleri ve Excel rayiç/keşif içe aktarımı

Bu belge, KaplanBIM inşaat platformu entegrasyonunun **Faz 0 / Görev 0.3**
çıktısıdır: firmanın kendi kural kitabını ("BlackBox" — tasarım planındaki
isim, bkz. § 0 Terminoloji notu) OpenConstructionERP'de kurma ve firmanın
mevcut Excel rayiç/keşif şablonlarını içe aktarma prosedürü.

> **Bu ortamda doğrulanmadı.** Bu runbook, görev kapsamında bir
> OpenConstructionERP sunucusu fiilen ayağa kaldırılmadan, yalnızca gerçek
> DDC Skills / OpenConstructionERP belgelerinden derlenerek yazıldı (bkz.
> § Kaynaklar). Aşağıdaki komutlar bu depoda çalıştırılıp çıktıları
> (JSON yanıtlar, kalem sayıları) gözlemlenmemiştir. "Beklenen" satırları,
> gerçek bir sunucuda bunu doğrulayacak kişi için bir kabul kriteri
> listesidir.

---

## 0. Terminoloji notu: "BlackBox" neyi ifade eder?

"BlackBox", KaplanBIM tasarım planının bu projede kullandığı isimdir —
firmanın kendi sınıflandırmaları, birim faktörleri ve montaj (assembly)
tariflerinden oluşan kural kitabı. **Doğrulama:** bu terim, DDC Skills
deposunda ve OpenConstructionERP'nin koduyla belgelerinde aratıldı
(`gh api search/code`, `datadrivenconstruction` org'u) — hiçbir eşleşme
bulunamadı. Yani "BlackBox", OpenConstructionERP'nin arayüzünde veya
belgelerinde görünen bir isim **değildir**; ERP'nin kendisi bu kavramı üç
ayrı, gerçek modüle dağıtır:

| BlackBox parçası | Gerçek ERP modülü | Modül kodu | Kaynak |
|---|---|---|---|
| Rayiç/kalem veritabanı (firma + ulusal tabanlar) | **Cost Database** | `costs` | MODULES.md:78 |
| Montaj tarifleri (işçilik+malzeme+makine → birleşik kalem) | **Assemblies & Calculations** | `assemblies` | MODULES.md:56 |
| Kaynak (malzeme/işçilik/makine) fiyat kataloğu | **Product & Resource Catalog** | `catalog` | MODULES.md:77 |
| Net→brüt birim faktörleri (fire/bindirme/kaplama) | **Waste Factors** | `waste_factors` | MODULES.md:63 |
| Norm katsayısından kaynak talebi türetme | **Production-Norm Expansion** | `norm_expansion` | MODULES.md:65 |
| Ülkeye özgü BOQ hiyerarşisi/sınıflandırma standardı | **Estimating Methodologies** | `methodology` | MODULES.md:55 |

Görev 0.2'de yüklenen `TR_NATIONAL` (Türkiye Birim Fiyat) tabanı, bu
BlackBox'ın **hazır** parçasıdır. Bu görev, firmanın **kendi** ek
kalemlerini/rayiçlerini aynı `costs`/`catalog`/`assemblies` modüllerine
ayrı bir katalog (bölge) olarak ekler — `TR_NATIONAL`'ın üzerine
yazmaz, onunla yan yana durur.

---

## Kaynaklar (uydurulmamıştır — doğrudan alınmıştır)

**DDC Skills deposu**,
https://github.com/datadrivenconstruction/DDC_Skills_for_AI_Agents_in_Construction ,
`main` dalı, commit `410ed1e71e4a5c6fd231afd0c8d1e586a9f546e8` (2026-11-09'da
`gh api .../contents/...` ve `raw.githubusercontent.com` ile çekildi):
- `6_OpenConstructionERP/oce-estimate-boq/SKILL.md` — BOQ iş akışı, kalem
  anatomisi, sınıflandırma standardı seçimi.
- `6_OpenConstructionERP/oce-cost-browser/SKILL.md` — sınıflandırma ağacı,
  kaynak kataloğu, katsayı tabanları için kaynak fiyat sayfası kavramı.
- `6_OpenConstructionERP/oce-load-cost-bases/SKILL.md` ve
  `oce-platform-overview/SKILL.md` — Görev 0.2'de kullanıldı; burada yalnızca
  kimlik doğrulama/rol modeli için tekrar referans verildi (bkz. `deploy/README.md` § 7.0).
- `6_OpenConstructionERP/README.md` — modül/skill eşleme tablosu.

**OpenConstructionERP deposu**,
https://github.com/datadrivenconstruction/OpenConstructionERP , `main` dalı,
commit `4993a21b19d9f7a308764d02ce84e36c4020d3cd` (2026-11-09'da çekildi):
- `MODULES.md` — 194 modülün tam listesi (`costs`, `assemblies`, `catalog`,
  `waste_factors`, `norm_expansion`, `methodology`, `backup`, `jobs` satırları
  burada alıntılanmıştır).
- `docs/user-guide/world-cost-bases.md` — "Bring your own rates" bölümü,
  firmanın kendi Excel/CSV verisini içe aktarabileceğini ve bunun diğer
  tabanlar gibi davrandığını doğrular; gerçek prosedür dokümanına
  (`docs/cost-database-import.md`) yönlendirir.
- `docs/user-guide/estimating-and-boq.md` — montajların ("assembly") "işçilik,
  malzeme ve makine bileşenlerinden oluşan yeniden kullanılabilir tarif"
  tanımı; proje düzeyinde bölge/para birimi/sınıflandırma standardı seçimi.
- `docs/cost-database-import.md` — **bu belgenin ana kaynağı**: gerçek içe
  aktarma uç noktaları (`/import/preview/`, `/import/file/`, `/bulk/`),
  altı kanonik alan, izin modeli (`costs.read`/`costs.create`), yanıt
  alanları, limitler, "import asla güncellemez" kuralı ve bilinen bir
  `factor`/`quantity` tuzağı.

Görevin kendi metnindeki "ERP içe aktarma sihirbazı" ve "kuru çalışma + geri
alma" ifadeleri bir ön tahmindi (Görev 0.2'de olduğu gibi — orada da brief'in
tahmin ettiği uç noktalar gerçek API ile birebir eşleşmemişti). Aşağıda,
`docs/cost-database-import.md`'de fiilen belgelenen **gerçek** mekanizmalar
kullanılmıştır; bunlar tahmin edilenle kavramsal olarak örtüşür (önizleme =
kuru çalışma; bölge temizleme/`PATCH`/yedekten geri yükleme = geri alma) ama
uç nokta adları ve davranış ayrıntıları farklıdır — bu fark § 3.5'te açıkça
işaretlenmiştir.

---

## 1. Ön koşullar

- § 3'teki (bkz. `deploy/README.md`) üretim yığını ayakta olmalı.
- Aynı `oe` alias'ı ve `oe_api()` yardımcı fonksiyonu kullanılır — bunlar
  burada **tekrar tanımlanmaz**; `deploy/README.md` § 7.0'daki tanımı
  kullanın (orada `TOKEN` değişkeni de JWT ile doldurulur).
- **İzin modeli** (`docs/cost-database-import.md`): bir bölgeyi yüklemek
  (`load-cwicr`) yalnızca `costs.read` iznini (viewer seviyesi) gerektirir;
  kalem **yazan** her uç nokta (`/import/preview/`, `/import/file/`,
  `/bulk/`, tekil `POST /`) `costs.create` iznini gerektirir. Bu izin
  dizesinin hangi role (`editor`/`manager`/`admin`) karşılık geldiği bu
  kaynakta açıkça yazmaz — platformun genel rol modelinden (viewer < editor
  < manager < admin, `oce-platform-overview` SKILL.md) **çıkarsanmıştır**,
  doğrulanmamıştır. Pratik sonuç: BlackBox'ı dolduracak kullanıcı en az
  editor rolünde olmalıdır; viewer rolüyle `/import/file/` çağrısı 403
  dönebilir (doğrulanmamış).
- Excel/CSV içe aktarımından **önce** bir `pg_dump` yedeği alın
  (`deploy/README.md` § 4.1) — bkz. § 3.5 aşağıda, bu gerçek "geri alma"
  güvencesidir.

---

## 2. Firma sınıflandırması ve birim faktörlerini tanımlama (Adım 1)

### 2.1 Proje düzeyinde bölge/sınıflandırma standardı

`docs/user-guide/estimating-and-boq.md`'ye göre: bir proje açıldığında önce
bölge, para birimi ve sınıflandırma standardı (DIN 276 / NRM / MasterFormat /
bölgesel) seçilir — tahmin bu ayarı miras alır. Firmanın kendi iç kodlama
şemasını kullanmak istiyorsa (ör. "KAPLAN-01" gibi firma kodları), bu
`classification` alanına **şema adıyla etiketlenmiş** bir sözlük olarak
yazılır (bkz. § 3.3 altı kanonik alan tablosu):

```json
{"masterformat": "03 30 53", "kaplanbim": "KAPLAN-BETON-01"}
```

Bir öğe aynı anda birden fazla şema taşıyabilir — firma kodu, resmî şemanın
**yerine değil yanına** eklenir.

### 2.2 Birim faktörleri — iki gerçek yuva

Görev metninin "birim faktörleri" ifadesi, kaynaklarda iki ayrı gerçek
kavrama karşılık gelir; ikisi de MODULES.md'de tek satırla tanımlıdır ve
bu belgede ayrıntılı API/UI adımları **bulunamamıştır** (dürüst boşluk —
aşağıda işaretlenmiştir):

- **Fire/bindirme/kaplama faktörleri** (net miktardan brüt miktara geçiş) —
  `waste_factors` modülü: *"net-to-gross quantity adjustment with waste,
  lap and coverage factors."*
- **Norm katsayısından kaynak talebi** (bir iş kaleminin birim başına ne
  kadar işçilik/malzeme/makine tükettiği) — `norm_expansion` modülü:
  *"expands a work item into labour, plant and material demand from norm
  coefficients."* Bu, firmanın Excel rayiçlerindeki "analiz" sayfalarının
  (1 m³ beton = X işçi-saat + Y torba çimento + ...) ERP karşılığıdır.

> **Dürüst boşluk.** Bu iki modül için fetch edilen DDC Skills veya
> OpenConstructionERP belgelerinde bir API uç noktası veya adım adım UI
> prosedürü **bulunamadı** — yalnızca MODULES.md'deki tek satırlık modül
> tanımı mevcut. Bu yüzden burada bir komut **uydurulmamıştır**; firmanın bu
> faktörleri gireceği gerçek yer, ERP arayüzünde "Waste Factors" ve
> "Production-Norm Expansion" adlı modül sayfalarıdır (modül kodları
> `waste_factors`, `norm_expansion`) — kesin ekran/alan adları canlı
> sistemde doğrulanmalıdır.

### 2.3 Montaj (assembly) tarifleri

`docs/user-guide/estimating-and-boq.md`: bir BOQ pozisyonuna "assembly'den
bir rate inşa edebilirsiniz — bu, işçilik, malzeme ve makine bileşenlerinden
oluşan yeniden kullanılabilir bir tarif" (`assemblies` modülü, MODULES.md:56
— *"composite rates built from cost-database items with factors and
regional adjustment"*).

Bir montajın alttaki veri şekli, `docs/cost-database-import.md`'nin
"Resource components" bölümünde belgelenmiştir — bir kalemin `components[]`
dizisi:

```json
{
  "code": "WI-DUVAR-TUGLA-20",
  "description": "20 cm tuğla duvar, sıvalı",
  "unit": "m2",
  "rate": "0",
  "currency": "TRY",
  "components": [
    {"type": "labor",    "code": "LAB-DUVARCI-01", "name": "Duvarcı ustası", "quantity": 0.45, "unit": "saat"},
    {"type": "material", "code": "MAT-TUGLA-20",   "name": "Delikli tuğla 20cm", "quantity": 52,  "unit": "adet"},
    {"type": "equipment","code": "EQP-HARC-MIK",    "name": "Harç mikseri",   "quantity": 0.05, "unit": "saat"}
  ]
}
```

Burada `quantity`, tam olarak görev metninin "birim faktörü" dediği şeydir:
1 m² duvar için 0,45 saat duvarcı, 52 adet tuğla, 0,05 saat mikser — bu
oranlar firmanın Excel analiz sayfasından buraya taşınır.

> **Bilinen tuzak — `factor` değil `quantity` yazın.**
> `docs/cost-database-import.md` şunu açıkça belirtir: OpenConstructionERP'nin
> kendi deposundaki `data/templates/cost_database_with_assemblies.json`
> şablonu, bileşenleri `{code, factor, unit, type}` şeklinde yazar —
> ama hiçbir okuyucu `factor` alanını okumaz. Eksik `quantity`, **sıfır**
> miktar olarak okunur; bu da fiyatlandırma çalıştığında (kaynaklar fiyat
> kazandığında) her bileşenin maliyetinin sessizce `0` olmasına ve kalemin
> "tam fiyatlandırıldı" raporlanmasına yol açar (fiyatlar henüz girilmemişken
> bu fark edilmez — zarar ancak fiyatlar girildikten sonraki ilk çalıştırmada
> ortaya çıkar). **Firma montaj tariflerini bu şablondan türetiyorsa,
> `factor` alanlarını `quantity` olarak yeniden adlandırın.** Doğru şekil:
> `{type, code, name, quantity, unit}`.

### 2.4 Kaynak kataloğu çıkarımı

Firmanın girdiği montaj bileşenlerinden bir kaynak fiyat kataloğu
oluşturmak için (`catalog` modülü, `oce-cost-browser` SKILL.md'de
tanımlanan "Resource catalog" kavramının API karşılığı):

```bash
oe_api POST /api/v1/catalog/extract/
```

`docs/cost-database-import.md`'ye göre bu uç nokta `components[]` içindeki
`code`, `type` ve `name` alanlarını okur, kataloğu `type:code` ikilisine
göre gruplar (yani `labor:LAB-DUVARCI-01` ile `material:LAB-DUVARCI-01`
ayrı tutulur) ve her kaynak için temsilî bir fiyat üretir. `code`'u olmayan
bir bileşen atlanır; `type`'ı `material`/`equipment`/`labor`/`operator`
dışında olan bir bileşen de atlanır.

**Beklenen:** çağrıdan sonra `GET` ile `catalog` modülünde firmanın montaj
tariflerinden türetilmiş kaynak satırları görünür.

---

## 3. Mevcut Excel rayiç/keşif şablonlarını içe aktarma (Adım 2)

### 3.1 Dört giriş yolu

`docs/cost-database-import.md`, `costs` modülüne veri girmenin dört gerçek
yolunu tanımlar:

| Elinizde olan | Kullanılacak | Gerekli izin |
|---|---|---|
| DDC'nin yayınladığı bir bölge (TR_NATIONAL gibi) | `POST /load-cwicr/{db_id}` | `costs.read` |
| Firmanın Excel/CSV rayiç tablosu | İçe aktarma sayfası veya `POST /import/file/` | `costs.create` |
| API çağırabilen bir sistem | `POST /bulk/` | `costs.create` |
| Tek bir kalem ekleme/düzeltme | `POST /` | `costs.create` |

Firmanın mevcut Excel rayiç/keşif şablonları için ikinci satır geçerlidir.
Tüm uç noktalar `/api/v1/costs/` altındadır.

> **Eğik çizgi (trailing slash) tuzağı.** Uygulama `redirect_slashes=False`
> ile çalışır: `/api/v1/costs/bulk/` çalışır, `/api/v1/costs/bulk` 404
> döner. Tek istisna `load-cwicr`'dır — onda sondaki `/` **yoktur**. Bir
> çağrı beklenmedik şekilde 404 dönerse önce bunu kontrol edin.

### 3.2 Önizleme — görev metninin "kuru çalışma"sının gerçek karşılığı

```bash
oe_api_file() {
  # oe_api() TOKEN alan JSON gövdesi gönderir; dosya yükleyen bu ayrı
  # yardımcı, backend konteynerine dosyayı -F ile multipart olarak geçirir.
  local method="$1" path="$2" file_in_container="$3" shift_args=("${@:4}")
  oe exec -T backend curl -sS -X "$method" "http://localhost:8000${path}" \
    -H "Authorization: Bearer ${TOKEN:-}" \
    -F "file=@${file_in_container}" "${shift_args[@]}"
}

# 1) Firmanın Excel dosyasını konteynere kopyalayın (ör. /tmp içine)
oe cp ./firma-rayic-2026.xlsx backend:/tmp/firma-rayic-2026.xlsx

# 2) Önizleme — HİÇBİR ŞEY YAZILMAZ
oe_api_file POST /api/v1/costs/import/preview/ /tmp/firma-rayic-2026.xlsx
```

> **Not — `curl` varlığı burada doğrulanmamıştır.** `deploy/README.md` §
> 7.0, `backend` imajında `curl` bulunduğunu doğrulamamıştı (healthcheck
> `python3`/`urllib` kullanıyor). Çok parçalı (`multipart/form-data`) dosya
> yükleme `python3`'ün standart kütüphanesiyle önemli ölçüde daha karmaşıktır;
> bu yüzden yukarıdaki örnek `curl`'ü varsayar — **canlı ortamda `curl`
> eksikse** (doğrulanmamış risk), eşdeğer bir `python3`
> `email.mime.multipart` betiği yazılması gerekir; bu belge o betiği
> **uydurmaz**, yalnızca gerçek API sözleşmesini belgeler.

`docs/cost-database-import.md`'ye göre yanıt şunları içerir:
- dosyanın gerçek başlıkları ve birkaç örnek satır,
- `suggested_map` — platformun, hangi sütununuzun hangi kanonik alana
  karşılık geldiğine dair tahmini,
- `required_fields` — her zaman `["description", "rate"]`,
- `has_currency_column` — dosyanızda bir para birimi sütunu olup olmadığı
  (yoksa içe aktarımda `catalog_currency` belirtmeniz gerekir).

**Beklenen:** hiçbir kalem oluşturulmaz; yalnızca eşleme önerisi döner.
Firma, Excel sütun adlarının (`Tanım`, `Birim Fiyat`, `Poz No` vb.) doğru
alana eşlendiğini bu adımda, gerçek kalemler oluşmadan önce onaylar.

### 3.3 İçe aktarma ve altı kanonik alan

```bash
oe_api_file POST /api/v1/costs/import/file/ /tmp/firma-rayic-2026.xlsx \
  -F catalog_name="KaplanBIM Firma Rayiçleri 2026" \
  -F catalog_currency="TRY"
```

Otomatik eşleme bir alanı kaçırırsa `column_map`'i JSON olarak geçirin:

```bash
# ... -F 'column_map={"description":"Tanım","rate":"Birim Fiyat"}'
```

Altı kanonik alan (`docs/cost-database-import.md`):

| Kanonik alan | Zorunlu mu? | Not |
|---|---|---|
| `code` | hayır | yoksa `IMPORT-<salt>-0001` olarak üretilir |
| `description` | **evet** | eşlemede mutlaka karşılanmalı |
| `unit` | hayır | varsayılan `pcs` |
| `rate` | **evet** | eşlemede mutlaka karşılanmalı |
| `currency` | hayır | kataloğun para biriminden miras alınır |
| `classification` | hayır | MasterFormat, DIN 276 KG, NRM — ne kullanıyorsanız |

Başlıklar büyük/küçük harfe duyarsız olarak İngilizce, Almanca, Rusça ve
yaygın Fransızca/İspanyolca/İtalyanca/Polonyaca/**Türkçe** biçimleriyle
eşleştirilir (ör. `Birim`, `EP`/`Einheit` gibi karşılıklar otomatik
tanınır) — listenin tanımadığı bir başlık için `column_map` kullanılır,
hiçbir sütun sessizce atılmaz.

`description` veya `rate` eşlemede yoksa içe aktarım **422** ile reddedilir
ve eksik alanları adıyla bildirir — bu kasıtlıdır: rate sütunu olmadan içe
aktarılan bir dosya, binlerce kalemi sıfır fiyatla oluşturur ve bu veri gibi
görünür ama değildir.

**Katalog seçimi:** var olan bir kataloğa eklemek için `catalog_id`, yeni
bir katalog açmak için `catalog_name` geçirin — ikisi birden 422'dir,
ikisi de yoksa kalemler paylaşılan genel kataloğa gider (önerilmez).
Kataloğun para birimi sırasıyla: verdiğiniz `catalog_currency`, yoksa
dosyadaki en sık görülen para birimi, o da yoksa 422 ile belirlenir.
Katalog adı, satırların bölge etiketi olarak 50 karaktere kısaltılarak
damgalanır — bu yüzden `"KaplanBIM Firma Rayiçleri 2026"` gibi anlamlı bir
ad verin, aksi hâlde içe aktarımınız sonradan bulunamaz.

**Beklenen yanıt** (`docs/cost-database-import.md`'den):

```json
{
  "imported": 1180, "skipped": 12, "errors": [],
  "total_rows": 1192, "catalog": "KaplanBIM Firma Rayiçleri 2026",
  "catalog_id": "…", "catalog_currency": "TRY",
  "mixed_currency_count": 0, "rate_parse_failures": 3
}
```

Son iki alan **uyarıdır**, hata değil — ikisi de kontrol edilmelidir:
- `mixed_currency_count` > 0 → bazı satırların kendi para birimi, katalog
  para biriminden farklıydı; bu satırlar **olduğu gibi** içe aktarıldı,
  yeniden yazılmadı.
- `rate_parse_failures` > 0 → o hücrede sayı **olmayan** bir içerik vardı
  (ör. `"1.234,50"`, `"bkz. not"`); bu satırlar `rate = 0` ile içe aktarıldı
  — boş bir hücre burada sayılmaz, yalnızca okunamayan bir içerik sayılır.
- `skipped`, kodu ve açıklaması olmayan satırları, bir özet satırı olan
  satırları (`toplam`, `ara toplam`, `genel toplam` ve benzerleri) ve kodu
  o bölgede zaten var olan satırları kapsar.

### 3.4 Limitler ve reddedilme nedenleri

- Yükleme **100 MB** ile sınırlıdır; üzeri 413 döner — dosyayı bölün.
- Uzantı tek başına güven kaynağı değildir: `.xlsx` gerçekten bir OOXML
  konteyneri, `.csv` gerçekten metin olmalıdır — yeniden adlandırılmış bir
  ikili dosya 415 ile reddedilir. `.xlsx` ayrıca kendi bildirdiği
  sıkıştırılmamış boyuta karşı önceden kontrol edilir (zip-bomb koruması).

### 3.5 "Geri alma" — görev metninin varsaydığı tek bir düğme değil, üç gerçek mekanizma

> **Görev metni ile gerçek API arasındaki fark.** Brief, "dry run + undo"
> çalışır diyordu; `docs/cost-database-import.md`'de tek bir "undo" uç
> noktası **yoktur**. Önizleme (§ 3.2) kuru çalışmanın gerçek karşılığıdır.
> "Geri alma" ihtiyacı üç gerçek davranışla karşılanır:

1. **İçe aktarım asla günceller gibi davranmaz — zaten "geri almaya"
   gerek bırakmayan bir güvenlik var.** `(code, region)` zaten varsa satır
   atlanır (`skipped`), var olan kalemin üzerine **yazılmaz** — bu
   `POST /bulk/`, dosya içe aktarımı ve `load-cwicr` için aynen geçerlidir.
   Pratik sonuç: düzeltilmiş bir dosyayı yeniden içe aktarmak hiçbir şey
   yapmaz (`imported: 0`, hepsi `skipped`) — bu bozuk bir yükleme değildir.
2. **Gerçekten değiştirmek/geri almak için** iki yol vardır:
   - Tüm bölgeyi silip yeniden içe aktarın:
     `DELETE /api/v1/costs/actions/clear-region/{region}` (burada `region`,
     katalog adınızdan türeyen bölge etiketidir).
   - Tek kalemi düzeltin: `PATCH /api/v1/costs/{item_id}`.
3. **Beklenmeyen bir `clear-region` veya hatalı bir toplu içe aktarım
   karşısındaki gerçek güvence, önceden alınmış bir yedektir** — `pg_dump`
   (bkz. `deploy/README.md` § 4.1), içe aktarımdan **önce** alınmalıdır. ERP
   kendi içinde satır bazlı bir "undo" sunmaz; veritabanı düzeyindeki
   geri yükleme tek garantili geri alma yoludur.

```bash
# Bölgeyi tamamen temizleyip yeniden içe aktarmak gerekirse:
oe_api DELETE "/api/v1/costs/actions/clear-region/KaplanBIM%20Firma%20Rayi%C3%A7leri%202026"

# Tek bir kalemi düzeltmek için (örnek gövde):
oe_api PATCH /api/v1/costs/<item_id> '{"rate": "1250.00"}'
```

---

## 4. Doğrulama: içe aktarılan kalemler `costs` içinde görünüyor ve düzenlenebiliyor mu (Adım 2 — "beklenen")

```bash
# 1) Firmanın kataloğunda arama yap
oe_api GET "/api/v1/costs/?region=KaplanBIM%20Firma%20Rayi%C3%A7leri%202026&q=duvar&limit=5"

# 2) Bir kalemin bileşen kırılımını kontrol et
oe_api GET /api/v1/costs/<id>

# 3) Sınıflandırma ağacını doğrula
oe_api GET "/api/v1/costs/category-tree/?region=KaplanBIM%20Firma%20Rayi%C3%A7leri%202026"

# 4) Düzenlenebilirliği doğrula — bir kalemi düzelt, sonra tekrar oku
oe_api PATCH /api/v1/costs/<id> '{"description": "20 cm tuğla duvar, sıvalı (güncellendi)"}'
oe_api GET /api/v1/costs/<id>
```

**Beklenen:**
- (1) firmanın yüklediği kalemler arasından en az biri döner; `currency`
  alanı `TRY`'dir.
- (2) `components[]` dizisi, Excel'den gelen işçilik/malzeme/makine
  satırlarını (varsa) veya boş bir dizi (yalnızca `rate` ile içe
  aktarılmışsa) gösterir.
- (3) firmanın kataloğu için boş olmayan bir kategori ağacı döner (yalnızca
  `classification` sütunu eşlenmişse anlamlı olur).
- (4) `PATCH`'ten sonraki `GET`, güncellenmiş açıklamayı döner — bu, görev
  metninin "düzenlenebilir durumda" kabul kriterini karşılar.

---

## 5. Sorun giderme (`docs/cost-database-import.md`'den, Türkçeleştirilmiş)

- **Her şey içe aktarıldı ama fiyatlar hep sıfır.** `rate` sütunu
  eşlenmemiş veya biçimlendirilmiş metin bir sütuna eşlenmiş. Yanıttaki
  `rate_parse_failures`'ı kontrol edin. İçe aktarım 422 ile reddedildiyse
  bu aynı sorunun daha erken yakalanmış hâlidir.
- **`imported: 0` ve her şey `skipped`.** Kodlar o bölgede zaten var —
  bkz. § 3.5.
- **Doğru görünen bir yolda 404.** Eğik çizgi (trailing slash) kontrolü —
  bkz. § 3.1.
- **Kalemler içe aktarıldı ama katalog boş görünüyor.** Satırlar, içe
  aktarımdan kataloğa isim vermediyseniz paylaşılan genel kataloğa gitmiş
  olabilir, adlandırılmış kataloğunuza değil.
- **Son basamaklarda ufak bir fiyat hatası.** Dizgeye (string) gelen `rate`
  alanı, aradaki bir boru hattında `float`'a çevrilmiş olabilir (bkz.
  `docs/cost-database-import.md`'nin "Importing over the API" bölümü —
  `199.99` böyle bir yuvarlamadan `199.98999999999998` olarak geri
  dönebilir). Oran dizgeleri her zaman tırnaklı (string) taşınmalıdır.
- **Fiyatlandırma sonrası her fiyat `0.00` oldu ve işlem "başarılı"
  raporlandı.** Bileşenler `quantity` yerine `factor` taşıyor — bkz. § 2.3
  "bilinen tuzak" kutusu. Bu, bu belgedeki tek "temiz çalıştı" görünen ama
  aslında bozuk olan durumdur; sayaçlara değil doğrudan bir fiyata bakın.

---

## 6. Kapsam dışı bırakılanlar

- `assemblies`/`waste_factors`/`norm_expansion` modüllerinin UI
  adımları/API uç noktaları (§ 2.2'deki dürüst boşluk) — canlı sistemde
  keşfedilmelidir.
- Bir tabanı başka bir piyasaya (PPP) yeniden fiyatlandırma akışı — Görev
  0.2'nin kapsamı, bkz. `deploy/README.md` § 7, kapanış notu.
- GAEB/Excel/PDF BOQ dışa aktarımı (`oce-estimate-boq` SKILL.md'de
  tanımlı) — bu görev yalnızca **içe** aktarımı kapsar.
