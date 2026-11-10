# 4D program + 5D maliyet modeli kurulumu

Bu belge **Görev 3.1**'in çıktısıdır: Faz 1'de kabul edilen keşfi (BOQ)
OpenConstructionERP'nin **programlama (4D)** ve **maliyet modeli (5D)**
modüllerine bağlayıp, iş programını, S-eğrisi/nakit akışı projeksiyonunu ve
aylık maliyet–değer mutabakatını (CVR) kurma prosedürüdür.

> **Bu ortamda doğrulanmadı.** Bu geliştirme ortamında ayağa kaldırılmış bir
> OpenConstructionERP sunucusu yok (bkz. `deploy/README.md` başındaki aynı
> not). Aşağıdaki adımların **hiçbiri** canlı bir sunucuda çalıştırılıp
> çıktısı (JSON yanıtlar, S-eğrisi değerleri, TL tutarlar) gözlemlenmemiştir.
> Uç noktalar **uydurulmamıştır**: modül davranışları `MODULES.md` ve
> `docs/user-guide/planning-and-cost-control.md`'den, somut HTTP yolları ise
> aynı commit'teki `backend/app/modules/<modül>/router.py` kaynak dosyalarından
> **birebir** okunmuştur (aşağıda § 0). "Beklenen:" satırları canlı kurulumda
> gözlenmesi gereken sonuçtur, gözlenmiş bir sonuç değildir.

---

## 0. Kaynaklar, commit'ler ve modül adı düzeltmesi

### 0.1 Provenance

**OpenConstructionERP deposu** (`datadrivenconstruction/OpenConstructionERP`,
`main`, commit `4993a21b19d9f7a308764d02ce84e36c4020d3cd` — Görev 0.2/0.3/0.4'te
de kullanılan aynı pinned commit; 2026-11-10'da `gh api` + raw `curl` ile tekrar
çekildi, içerik değişmemiş):

- `MODULES.md` § 1 "The module catalog" — `schedule`, `schedule_advanced`,
  `costmodel`, `cvr`, `full_evm`, `finance`, `progress`, `resource_summary`
  modül tanımları (aşağıda birebir alıntılanıyor).
- `docs/user-guide/planning-and-cost-control.md` — 4D/5D/CVR iş akışının
  tarifi (Gantt, kritik yol, Last Planner, S-eğrisi, EVM, CVR).
- `docs/user-guide/bim-to-cost-and-carbon.md` — "model → miktar → fiyat" 5D
  bağının tarifi.
- `backend/app/modules/{schedule,schedule_advanced,costmodel,cvr,full_evm,
  resource_summary,progress}/router.py` — **somut HTTP uç noktaları** (yol +
  HTTP fiili). Bu belgedeki her uç nokta bu dosyalardan okundu.
- `backend/app/core/module_loader.py` — router'ların `/api/v1/{kebab-name}`
  altına nasıl asıldığı (`kebab_name = dir_name.replace("_", "-")`).

**DDC Skills deposu**
(`datadrivenconstruction/DDC_Skills_for_AI_Agents_in_Construction`, `main`,
commit `410ed1e71e4a5c6fd231afd0c8d1e586a9f546e8` — önceki görevlerle aynı):

- `6_OpenConstructionERP/oce-scheduling-4d5d/SKILL.md` — 4D/5D kavramları,
  iş akışı, entegrasyon kuralları, en iyi uygulamalar.
- `6_OpenConstructionERP/oce-estimate-boq/SKILL.md` — BOQ oluşturma ve BIM
  toplu bağlama uç noktası (bu belge BOQ tarafını tekrar üretmez, ona bağlanır).

### 0.2 Görev tanımındaki modül adları → gerçek modül adları

Görev brief'inde geçen üç isim, `MODULES.md`'deki gerçek modül kimlikleriyle
**birebir eşleşmiyor**. Bu, önceki görevlerdeki aynı dürüst düzeltme
kalıbıdır (bkz. `import-check.md` § "`report.json` bulunamadı" ve
`deploy/README.md` § 7.3 "uç nokta farkı"). Düzeltme:

| Brief'teki isim | Gerçek modül (manifest) | `MODULES.md` tanımı (birebir) |
|---|---|---|
| `scheduling` | `schedule` (`oe_schedule`) | "4D Schedule — links BOQ positions to a construction timeline." |
| `advanced_schedule` | `schedule_advanced` (`oe_schedule_advanced`) | "Schedule Advanced (Last Planner) — phase plans, look-ahead, constraints, weekly plans and PPC tracking." |
| `5d_planner` | **yok** → `costmodel` (`oe_costmodel`) | "5D Cost Model — S-curves, cash flow projection, earned value and budget tracking." |

`5d_planner` adında bir modül **yoktur**. 5D işlevini `costmodel` modülü taşır;
onunla birlikte çalışan diğer gerçek modüller şunlardır (hepsi `MODULES.md`
§ 1'den birebir):

- `full_evm` — "earned value with forecasting, S-curves and TCPI analysis."
- `cvr` — "monthly reconciliation of cost against value earned with a cashflow forecast."
- `finance` — "invoicing, payments, budgets and earned value."
- `progress` — "percent-complete per BOQ position, period deltas, S-curves and geo-tagged field entries."
- `resource_summary` — "rolls resource splits across the estimate into a procurement-ready statement."

### 0.3 Uç nokta öneki (doğrulandı)

`module_loader.py` her modülün router'ını `/api/v1/{kebab-name}` altına asar,
`kebab-name` = modül dizin adının `_` yerine `-` konmuş hali. Dolayısıyla:

| Modül | Önek |
|---|---|
| `schedule` | `/api/v1/schedule` |
| `schedule_advanced` | `/api/v1/schedule-advanced` |
| `costmodel` | `/api/v1/costmodel` |
| `cvr` | `/api/v1/cvr` |
| `full_evm` | `/api/v1/full-evm` |
| `resource_summary` | `/api/v1/resource-summary` |
| `progress` | `/api/v1/progress` |

Aşağıdaki tüm tam yollar = **önek + router.py'deki yol**. Ör. `schedule`
router'ındaki `GET /schedules/{id}/gantt/` → `GET /api/v1/schedule/schedules/{id}/gantt/`.

---

## Ön koşullar

- `deploy/README.md` § 3'teki üretim yığını ayakta (`oe ps` içinde tüm
  servisler `healthy`); § 7.0'daki `oe`/`oe_api()` yardımcıları ve `$TOKEN`
  (JWT) tanımlı. API çağrıları, backend host'a port açmadığı için
  `oe exec backend ...` ile konteyner içinden yapılır.
- **Faz 1'in kabul edilen keşfi** mevcut: `boq` modülünde fiyatlanmış bir BOQ
  (Task 1.3 çıktısı), `deploy/README.md` § 7'deki `TR_NATIONAL` tabanıyla
  TRY cinsinden fiyatlanmış ve `POST /api/v1/boqs/{id}/validate/` ile
  hatasız/izlenebilir rapor alınmış olmalı. Bu belge o keşfi yeniden üretmez.
- (İsteğe bağlı ama 4D'nin anlamı için) Task 0.4'ün `bim_hub` bağlantısı:
  model elemanları BOQ pozisyonlarına bağlıysa, program faaliyetleri de BIM
  elemanlarına bağlanabilir (bkz. `import-check.md` § 2.3–2.4).

---

## Adım 1 — İş programını keşfe bağla (4D, `schedule`)

`MODULES.md`: **4D Schedule** `schedule` — *"links BOQ positions to a
construction timeline."* `planning-and-cost-control.md`'nin tarif ettiği iki
yol vardır: Gantt'ı elle kurmak **ya da** faaliyetleri doğrudan BOQ
bölümlerinden, maliyetleriyle orantılı sürelerle üretmek. Bu görevin aradığı
"program, keşif kalemlerinden üretilir" beklentisi ikinci yola karşılık gelir.

### 1.1 Program şablonu oluştur

```bash
# schedule router.py: POST /schedules/
oe_api POST /api/v1/schedule/schedules/ \
  '{"project_id": "<project_id>", "name": "Ana İş Programı"}'
```

**Beklenen:** bir `schedule_id` döner. (İstek gövdesindeki alan adları —
`project_id`, `name` — `schedule` router'ının `schemas.py`'sinden bu belge için
çıkarılmamıştır; **doğrulanmadı**, canlı kurulumda OpenAPI şemasından teyit
edin.)

### 1.2 BOQ'dan faaliyet üret (önizle → uygula)

```bash
# Önce önizle: hangi BOQ bölümü/pozisyonundan hangi faaliyet çıkacak
oe_api POST /api/v1/schedule/schedules/<schedule_id>/generate-from-boq/preview/

# Sonra uygula
oe_api POST /api/v1/schedule/schedules/<schedule_id>/generate-from-boq/
```

`planning-and-cost-control.md` birebir: *"you generate activities directly
from BOQ sections with durations proportional to their cost"* — yani süreler
BOQ tutarıyla orantılı atanır.

**Beklenen:** her BOQ bölümü/pozisyonu için bir faaliyet oluşur; faaliyet
süreleri, bağlı BOQ tutarından türetilir.

### 1.3 Faaliyet ↔ BOQ pozisyonu bağını doğrula (ve elle bağla)

Üretim sonrası, "her faaliyet doğrudan maliyetini taşır" kuralının
(`oce-scheduling-4d5d`) somutlaştığı bağdır:

```bash
# Bir faaliyeti bir BOQ pozisyonuna bağla
oe_api POST /api/v1/schedule/activities/<activity_id>/link-position/ \
  '{"boq_position_id": "<boq_position_id>"}'

# Bağı kaldır (gerekirse)
oe_api DELETE /api/v1/schedule/activities/<activity_id>/link-position/<boq_position_id>/
```

### 1.4 (İsteğe bağlı) BIM elemanlarını faaliyetlere bağla

Task 0.4'te `bim_hub` üzerinden eleman → BOQ bağı kurulduysa, aynı elemanlar
görsel sıralama için faaliyetlere de bağlanabilir (`oce-scheduling-4d5d`:
"every task can reference BIM elements so the sequence is visual"):

```bash
# Bir faaliyetin BIM bağlarını güncelle
oe_api PATCH /api/v1/schedule/activities/<activity_id>/bim-links/

# Bir BIM elemanına karşılık gelen faaliyetleri bul
oe_api GET "/api/v1/schedule/activities/by-bim-element/?element_id=<element_id>"
```

### 1.5 Bağımlılıklar, kritik yol ve Gantt

```bash
# CPM hesapla (kritik yol + erken/geç tarihler)
oe_api POST /api/v1/schedule/schedules/<schedule_id>/calculate-cpm/

# Kritik yol
oe_api GET /api/v1/schedule/critical-path/

# Gantt zaman çizelgesi verisi
oe_api GET /api/v1/schedule/schedules/<schedule_id>/gantt/
```

**Beklenen:** kritik yol faaliyetleri işaretlenir; Gantt verisi, bağlı BOQ
pozisyonları ve sürelerle birlikte döner.

### 1.6 (İsteğe bağlı) Last Planner katmanı (`schedule_advanced`)

Yalın teslim kullanan ekipler için `MODULES.md`: **Schedule Advanced (Last
Planner)** — *"phase plans, look-ahead, constraints, weekly plans and PPC
tracking."* Gerçek uç noktalar (önek `/api/v1/schedule-advanced`):

```bash
oe_api POST /api/v1/schedule-advanced/master-schedules/ '{...}'   # ana program
oe_api GET  /api/v1/schedule-advanced/phase-plans/                 # faz planları
oe_api GET  /api/v1/schedule-advanced/look-aheads/current           # look-ahead
oe_api GET  /api/v1/schedule-advanced/constraints/                  # kısıtlar
oe_api POST /api/v1/schedule-advanced/weekly-work-plans/ '{...}'    # haftalık plan
oe_api POST /api/v1/schedule-advanced/baselines/capture             # temel çizgi
oe_api GET  /api/v1/schedule-advanced/rncs/pareto                   # tamamlanmama nedenleri
```

Bu katman opsiyoneldir; temel 4D akışı § 1.1–1.5 ile tamamlanır.

---

## Adım 2 — 5D nakit akışını kur (`costmodel` + `full_evm` + `resource_summary`)

`MODULES.md`: **5D Cost Model** `costmodel` — *"S-curves, cash flow
projection, earned value and budget tracking."* `planning-and-cost-control.md`
birebir: *"The 5D cost model spreads the priced BOQ across the schedule to
produce S-curves, cash-flow projections, budgets and earned value."* Önek
`/api/v1/costmodel`.

### 2.1 Maliyet omurgasını BOQ'dan üret

`costmodel` router'ında `spine` ("omurga") ailesi, BOQ'dan maliyet yapısını
üretir; `5d/*` ailesi ise S-eğrisi/nakit akışı/EVM'i taşır:

```bash
# Omurgayı BOQ'dan üret (kod listesi + hesap yapısı)
oe_api POST /api/v1/costmodel/projects/<project_id>/spine/generate-from-boq/
oe_api GET  /api/v1/costmodel/projects/<project_id>/spine/rollup/
```

### 2.2 Bütçe ve nakit akışı üret

```bash
# Bütçe satırlarını üret
oe_api POST /api/v1/costmodel/projects/<project_id>/5d/generate-budget/
oe_api GET  /api/v1/costmodel/projects/<project_id>/5d/budget/

# Nakit akışı projeksiyonunu üret
oe_api POST /api/v1/costmodel/projects/<project_id>/5d/generate-cash-flow/
oe_api GET  /api/v1/costmodel/projects/<project_id>/5d/cash-flow/
```

**Beklenen:** S-eğrisi ve dönemsel nakit akışı, BOQ tutarının program
faaliyetleri üzerine yayılmasıyla oluşur (maliyet, zamanın bir fonksiyonu
haline gelir).

### 2.3 S-eğrisi ve kazanılmış değer (EVM)

```bash
# S-eğrisi
oe_api GET /api/v1/costmodel/projects/<project_id>/5d/s-curve/

# Kazanılmış değer görünümü
oe_api GET /api/v1/costmodel/projects/<project_id>/5d/evm/

# 5D panosu (hepsi bir arada)
oe_api GET /api/v1/costmodel/projects/<project_id>/5d/dashboard/
```

**Beklenen:** S-eğrisi (planlanan değer), kazanılmış değer (EV) ve fiili
maliyet (AC) aynı zaman ekseninde görünür; SPI/CPI indeksleri `evm`/`dashboard`
yanıtlarında yer alır.

### 2.4 Tam EVM katmanı (`full_evm`, önek `/api/v1/full-evm`)

`MODULES.md`: **Full EVM** — *"earned value with forecasting, S-curves and
TCPI analysis."* Tahmin (EAC/TCPI) ve uyarılar için:

```bash
oe_api POST /api/v1/full-evm/baselines/ '{...}'          # ölçüm temel çizgisi
oe_api GET  /api/v1/full-evm/baselines/<baseline_id>/s-curve/
oe_api POST /api/v1/full-evm/baselines/<baseline_id>/validate/
oe_api POST /api/v1/full-evm/forecasts/calculate/        # EAC/TCPI tahmini
oe_api GET  /api/v1/full-evm/forecasts/alerts/           # sapma uyarıları
```

### 2.5 Tedarik için kaynak özeti (`resource_summary`, önek `/api/v1/resource-summary`)

`MODULES.md`: **Resource Summary** — *"rolls resource splits across the
estimate into a procurement-ready statement."* 5D'nin maliyet tarafı kadar
kaynak tarafı da keşfe bağlanır:

```bash
oe_api GET /api/v1/resource-summary/projects/<project_id>          # kaynak özeti
oe_api GET /api/v1/resource-summary/projects/<project_id>/buy-list  # tedarik listesi
oe_api GET /api/v1/resource-summary/projects/<project_id>/csv       # CSV dışa aktarım
```

---

## Adım 3 — Aylık maliyet–değer mutabakatı (CVR, `cvr`)

`MODULES.md`: **Cost-Value Reconciliation & Cashflow** `cvr` — *"monthly
reconciliation of cost against value earned with a cashflow forecast."*
`planning-and-cost-control.md` birebir: *"Cost-value reconciliation and
cash-flow views compare value earned against cost incurred."* Önek `/api/v1/cvr`.

### 3.1 Aylık mutabakat raporu aç

```bash
oe_api POST /api/v1/cvr/reports/ '{...}'   # dönem raporu (ay, proje)
```

**Beklenen:** bir `report_id` döner; rapor, o dönemin "kazanılan değer"
(value earned) ve "gerçekleşen maliyet" (cost incurred) karşılaştırmasını taşır.

### 3.2 Maliyet satırlarını doldur (saha süresinden)

```bash
# Saha/zaman kayıtlarından maliyet satırı üret
oe_api POST /api/v1/cvr/reports/<report_id>/lines/from-field-time/

# Rapor özeti (değer vs maliyet)
oe_api GET /api/v1/cvr/reports/<report_id>/summary/
```

`from-field-time` yolu, `field_time` (saha çalışma süreleri) kayıtlarının CVR
satırına dönüştüğünü gösterir — bu, maliyet tarafının kaynağının sahada
fiilen harcanan emek olduğu anlamına gelir (uç nokta adı bu belge için
`cvr/router.py`'den birebir okundu).

### 3.3 Nakit akışı tahmini ve kapatma

```bash
# Nakit akışı noktaları/serisi
oe_api POST /api/v1/cvr/cashflow/ '{...}'
oe_api GET  /api/v1/cvr/cashflow/series/

# Raporu kesinleştir (finalize)
oe_api POST /api/v1/cvr/reports/<report_id>/finalize/

# Hak ediş uygulamaları / ilerleme talepleri
oe_api GET /api/v1/cvr/payment-applications/
oe_api GET /api/v1/cvr/progress-claims/
```

**Beklenen:** her ay sonunda maliyet ile kazanılan değer aynı raporda
karşılaştırılır; fark, nakit akışı tahminine yansır; rapor `finalize` ile
kilitlenir.

---

## Adım 4 — Doğrulama: keşif değişince program/nakit akışı güncelleniyor mu

Bu adım, Görev 3.2'nin "otomatik güncelleme" kontrolünün ERP tarafındaki
karşılığını hazırlar. `oce-scheduling-4d5d`'nin entegrasyon kuralı birebir:
*"Quantity changes from BIM re-link update BOQ line quantities, which update
the cost model in turn."* Yani zincir: **keşif miktarı değişir → BOQ tutarı
değişir → faaliyet süresi/maliyeti değişir → S-eğrisi/nakit akışı değişir.**

Doğrulama sırası (canlı ortamda):

1. **Bir BOQ pozisyonunun miktarını değiştir.** (Keşif tarafındaki değişimi
   temsil eder; Task 3.2'nin otomatikleştireceği şey budur.)
2. **Program tarafını kontrol et** — `schedule` router'ında bunun için açık
   bir "diff"/etki uç noktası vardır (bu belge için router.py'den birebir):

   ```bash
   # Değişikliğin program üzerindeki etkisini hesapla
   oe_api POST /api/v1/schedule/schedules/<schedule_id>/diff
   # Silme etkisi (gerekirse)
   oe_api GET /api/v1/schedule/schedules/<schedule_id>/delete-impact/
   ```

   **Beklenen:** etkilenen faaliyetler (bağlı pozisyon miktarı değişenler)
   listelenir; süre/maliyet deltası görünür.

3. **İlerleme/miktar sapmasını kontrol et** — `progress` modülü (önek
   `/api/v1/progress`), keşif miktar sapmasını doğrudan raporlar:

   ```bash
   oe_api GET /api/v1/progress/quantity-variance/
   oe_api GET /api/v1/progress/position/<position_id>/summary
   ```

   **Beklenen:** değişen pozisyon için planlı vs fiili miktar sapması görünür.

4. **5D tarafını kontrol et** — § 2.3'teki `s-curve`/`cash-flow`/`evm`
   yeniden çekilir; S-eğrisi ve nakit akışının değişen pozisyonun tutarına
   göre kaydığı doğrulanır.
5. **BOQ'yu yeniden doğrula** (`oce-scheduling-4d5d`: *"Re-validate the BOQ
   after bulk changes"*) — `POST /api/v1/boqs/{id}/validate/` (bkz.
   `import-check.md` § 3.2) hâlâ hatasız dönmeli.

> **Dürüst sınır:** Bu "diff → sapma → S-eğrisi kayması" zincirinin uçtan
> uca **otomatik** çalıştığı, `MODULES.md`/user-guide düzeyinde ifade edilir
> (yukarıdaki alıntı), ama bu ortamda canlı doğrulanmamıştır. Task 3.2'nin
> yapması gereken asıl iş, bu zincirin hangi adımının insan tetiklemeli
> (`generate-from-boq`, `generate-cash-flow` yeniden çağrısı) hangisinin
> olay-güdümlü (otomatik) olduğunu canlı sunucuda saptamaktır — `events.py`
> dosyalarının varlığı (`costmodel/events.py`) olay-güdümlü bir yolun
> muhtemel olduğuna işaret eder ama bu belge bunu uçtan uca doğrulamaz.

---

## Commit

```bash
git add deploy/erp/4d5d-setup.md
git commit -m "docs: 4D/5D setup"
```

---

## Kapsam dışı / açık sorular (dürüstçe listelenmiş)

1. **Uç noktaların istek/yanıt gövdeleri doğrulanmadı.** Yollar ve HTTP
   fiilleri `router.py`'den birebir okundu, ama her isteğin `body` alan adları
   (`schemas.py`'den) bu belge için **ayrıca çıkarılmadı**. § 1.1'de örnek
   gövde bu yüzden "doğrulanmadı, OpenAPI şemasından teyit edin" işaretli.
   Canlı kurulumda `/api/v1/openapi.json` (veya eşdeğeri) tek doğru kaynaktır.
2. **`5d_planner` modülü yok.** 5D işlevi `costmodel` modülündedir (§ 0.2).
3. **Otomatik vs insan tetiklemeli güncelleme** (§ Adım 4) bu ortamda
   ayrıştırılamadı; Task 3.2'nin konusudur.
4. **`oe_api()`'nin çok adımlı akış için yetersizliği:** `oe_api` tek seferlik
   `urllib` çağrısıdır; `generate-from-boq` → `calculate-cpm` →
   `generate-cash-flow` gibi sıralı akışlar ayrı ayrı çağrılarla yürütülür.
   Sonuçları (ör. `schedule_id`, `activity_id`) elle yakalayıp bir sonraki
   çağrıya geçirmek gerekir. Görev 3.2/API köprüsü bu orkestrasyonu
   kodlayabilir.
5. Bu belgenin hiçbir adımı, gerçek bir BOQ + gerçek bir OpenConstructionERP
   sunucusuyla uçtan uca **çalıştırılmadı**. Canlı doğrulama, bu prosedürün
   kendisinin kabul kriteridir.
